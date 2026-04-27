from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Cookie, Header
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import json
import logging
import uuid
import random
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText, OpenAITextToSpeech


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    level: str = "Beginner"
    xp: int = 0
    streak: int = 0
    last_active_date: Optional[str] = None
    completed_lesson_ids: List[str] = []
    is_premium: bool = False
    premium_until: Optional[str] = None
    goal: Optional[str] = None


GOALS = {
    "job_interview": {
        "label": "Ace job interviews",
        "tutor_persona": "You are Coach Ada, helping the learner prepare for English job interviews. Steer toward professional vocabulary, behavioural questions (STAR), and clear, confident answers. Keep replies 1-3 sentences. Gently correct grammar inline using (→ correction).",
        "lesson_priority": ["i4", "a2", "i1", "a1", "a4", "i3"],
    },
    "travel": {
        "label": "Travel with confidence",
        "tutor_persona": "You are Coach Ada, helping the learner travel comfortably in English. Focus on airports, hotels, restaurants, asking for directions, polite phrases. 1-3 sentences. Gently correct grammar inline using (→ correction).",
        "lesson_priority": ["b4", "b1", "i2", "b2", "i1"],
    },
    "ielts": {
        "label": "Prepare for IELTS",
        "tutor_persona": "You are Coach Ada, an IELTS coach. Push for richer vocabulary, complex sentence structures, cohesive devices, and academic register. Give brief feedback on band-level after each turn. 1-3 sentences. Correct grammar inline using (→ correction).",
        "lesson_priority": ["a4", "a1", "a2", "a3", "i3", "i1"],
    },
    "casual": {
        "label": "Casual speaking",
        "tutor_persona": "You are Coach Ada, a friendly conversation partner. Keep things light and natural — small talk, hobbies, daily life. 1-3 sentences. Gently correct grammar inline using (→ correction).",
        "lesson_priority": ["b1", "b3", "i2", "a3", "i1"],
    },
}


# ---------- Free-tier limits ----------
FREE_LIMITS = {
    "conversation": 5,
    "grammar": 3,
    "writing": 3,
    "pronunciation": 5,
}


def is_user_premium(user: "User") -> bool:
    if not user.is_premium:
        return False
    if user.premium_until:
        try:
            until = datetime.fromisoformat(user.premium_until)
            if until.tzinfo is None:
                until = until.replace(tzinfo=timezone.utc)
            if until < datetime.now(timezone.utc):
                return False
        except Exception:
            return False
    return True


async def check_and_increment_usage(user_id: str, feature: str, is_premium: bool) -> int:
    """Returns new usage count; raises HTTPException if free-tier limit exceeded."""
    today = date.today().isoformat()
    if is_premium:
        await db.usage_logs.update_one(
            {"user_id": user_id, "date": today, "feature": feature},
            {"$inc": {"count": 1}, "$setOnInsert": {"user_id": user_id, "date": today, "feature": feature}},
            upsert=True,
        )
        return 0
    doc = await db.usage_logs.find_one(
        {"user_id": user_id, "date": today, "feature": feature}, {"_id": 0}
    )
    current = doc.get("count", 0) if doc else 0
    limit = FREE_LIMITS.get(feature, 9999)
    if current >= limit:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "free_limit_reached",
                "feature": feature,
                "limit": limit,
                "message": f"You've reached your free daily limit for {feature}. Upgrade to Premium for unlimited access.",
            },
        )
    await db.usage_logs.update_one(
        {"user_id": user_id, "date": today, "feature": feature},
        {"$inc": {"count": 1}, "$setOnInsert": {"user_id": user_id, "date": today, "feature": feature}},
        upsert=True,
    )
    return current + 1


class ConversationRequest(BaseModel):
    session_id: str
    message: str
    scenario: Optional[str] = "general"


class GrammarRequest(BaseModel):
    text: str


class WritingRequest(BaseModel):
    text: str
    prompt: Optional[str] = None


class VocabularyRequest(BaseModel):
    level: Optional[str] = "Intermediate"
    count: int = 5


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "nova"


async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> User:
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


async def update_streak_and_xp(user_id: str, xp_gained: int = 10):
    today = date.today().isoformat()
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return
    last = user.get("last_active_date")
    streak = user.get("streak", 0)
    if last == today:
        pass
    elif last == (date.today() - timedelta(days=1)).isoformat():
        streak += 1
    else:
        streak = 1
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"last_active_date": today, "streak": streak},
         "$inc": {"xp": xp_gained}}
    )


def _parse_json(text: str):
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t
        if t.endswith("```"):
            t = t[:-3]
        t = t.strip()
        if t.lower().startswith("json"):
            t = t[4:].strip()
    return json.loads(t)


@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        data = r.json()

    email = data["email"]
    name = data["name"]
    picture = data.get("picture")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "level": "Beginner",
            "xp": 0,
            "streak": 0,
            "last_active_date": None,
            "completed_lesson_ids": [],
            "is_premium": False,
            "premium_until": None,
            "goal": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user_doc}


@api_router.get("/auth/me")
async def auth_me(request: Request,
                  session_token: Optional[str] = Cookie(None),
                  authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    return user.model_dump()


@api_router.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


def build_chat(session_id: str, system_message: str) -> LlmChat:
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("openai", "gpt-5.2")


SCENARIO_PROMPTS = {
    "general": "You are Coach Ada, a warm and encouraging English tutor. Have natural conversations with the learner. Keep replies to 1-3 sentences. Ask follow-up questions. Gently correct errors inline using (→ correction).",
    "restaurant": "You are a waiter at a cozy cafe. Role-play in English. 1-3 sentences. Gently correct grammar inline using (→ correction).",
    "job_interview": "You are a friendly hiring manager doing a mock interview. Ask one question at a time. Short replies. Correct grammar inline using (→ correction).",
    "travel": "You are a helpful travel agent. Role-play a booking conversation. 1-3 sentences. Correct grammar inline using (→ correction).",
    "small_talk": "You are a friendly neighbor making small talk. Casual and short. Correct grammar inline using (→ correction).",
}


def build_system_for_user(user: "User", scenario: str) -> str:
    base = SCENARIO_PROMPTS.get(scenario, SCENARIO_PROMPTS["general"])
    if scenario == "general" and user.goal and user.goal in GOALS:
        return GOALS[user.goal]["tutor_persona"]
    if user.goal and user.goal in GOALS:
        base += f" The learner's overall goal is: {GOALS[user.goal]['label']}. Subtly tailor examples and follow-up questions to that goal."
    base += f" Learner level: {user.level}."
    return base


@api_router.post("/conversation")
async def conversation(body: ConversationRequest, request: Request,
                       session_token: Optional[str] = Cookie(None),
                       authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    await check_and_increment_usage(user.user_id, "conversation", is_user_premium(user))
    scenario = body.scenario or "general"
    system_msg = build_system_for_user(user, scenario)
    chat = build_chat(f"{user.user_id}_{body.session_id}", system_msg)

    history = await db.conversations.find(
        {"user_id": user.user_id, "session_id": body.session_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(50)

    prior = ""
    if history:
        snippets = [f"{h['role'].upper()}: {h['content']}" for h in history[-10:]]
        prior = "Previous turns:\n" + "\n".join(snippets) + "\n\nLearner now says: "

    try:
        reply = await chat.send_message(UserMessage(text=prior + body.message))
    except Exception as e:
        logger.exception("conversation error")
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

    now = datetime.now(timezone.utc).isoformat()
    await db.conversations.insert_many([
        {"user_id": user.user_id, "session_id": body.session_id,
         "role": "user", "content": body.message, "created_at": now},
        {"user_id": user.user_id, "session_id": body.session_id,
         "role": "assistant", "content": reply, "created_at": now},
    ])
    await update_streak_and_xp(user.user_id, 5)
    return {"reply": reply}


@api_router.get("/conversation/history/{session_id}")
async def conversation_history(session_id: str, request: Request,
                               session_token: Optional[str] = Cookie(None),
                               authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    msgs = await db.conversations.find(
        {"user_id": user.user_id, "session_id": session_id},
        {"_id": 0, "role": 1, "content": 1, "created_at": 1},
    ).sort("created_at", 1).to_list(200)
    return {"messages": msgs}


@api_router.post("/grammar/check")
async def grammar_check(body: GrammarRequest, request: Request,
                        session_token: Optional[str] = Cookie(None),
                        authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    await check_and_increment_usage(user.user_id, "grammar", is_user_premium(user))
    system = (
        "You are an expert English grammar coach. Respond ONLY with valid JSON "
        "matching: {\"corrected\": str, \"issues\": [{\"original\": str, \"correction\": str, \"rule\": str, \"explanation\": str}], \"overall_feedback\": str, \"score\": int (0-100)}. "
        "No markdown, no extra text."
    )
    chat = build_chat(f"grammar_{user.user_id}_{uuid.uuid4().hex[:6]}", system)
    try:
        resp = await chat.send_message(UserMessage(text=f"Analyze this text: ```{body.text}```"))
        data = _parse_json(resp)
    except Exception as e:
        logger.exception("grammar parse error")
        raise HTTPException(status_code=500, detail=f"LLM parse error: {e}")
    await update_streak_and_xp(user.user_id, 10)
    return data


@api_router.post("/writing/feedback")
async def writing_feedback(body: WritingRequest, request: Request,
                           session_token: Optional[str] = Cookie(None),
                           authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    await check_and_increment_usage(user.user_id, "writing", is_user_premium(user))
    system = (
        "You are an expert English writing coach. Return ONLY valid JSON: "
        "{\"scores\": {\"grammar\": int, \"vocabulary\": int, \"coherence\": int, \"style\": int}, "
        "\"strengths\": [str], \"improvements\": [str], \"rewrite\": str, \"summary\": str}. "
        "All scores 0-100. No markdown."
    )
    chat = build_chat(f"writing_{user.user_id}_{uuid.uuid4().hex[:6]}", system)
    prompt_context = f"Prompt: {body.prompt}\n\n" if body.prompt else ""
    try:
        resp = await chat.send_message(UserMessage(text=f"{prompt_context}Text to review:\n\n{body.text}"))
        data = _parse_json(resp)
    except Exception as e:
        logger.exception("writing parse error")
        raise HTTPException(status_code=500, detail=f"LLM parse error: {e}")
    await update_streak_and_xp(user.user_id, 15)
    return data


@api_router.post("/vocabulary/daily")
async def vocabulary_daily(body: VocabularyRequest, request: Request,
                           session_token: Optional[str] = Cookie(None),
                           authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    today = date.today().isoformat()
    cached = await db.vocab_daily.find_one(
        {"user_id": user.user_id, "date": today, "level": body.level}, {"_id": 0},
    )
    if cached:
        return {"words": cached["words"]}

    system = (
        f"You are an English vocabulary coach. Generate {body.count} useful {body.level}-level English words. "
        "Return ONLY valid JSON: {\"words\": [{\"word\": str, \"pronunciation\": str (IPA), \"part_of_speech\": str, "
        "\"definition\": str, \"example\": str, \"synonyms\": [str]}]}. No markdown."
    )
    chat = build_chat(f"vocab_{user.user_id}_{today}", system)
    try:
        resp = await chat.send_message(UserMessage(text=f"Generate today's {body.count} words."))
        data = _parse_json(resp)
    except Exception as e:
        logger.exception("vocab error")
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

    await db.vocab_daily.insert_one({
        "user_id": user.user_id,
        "date": today,
        "level": body.level,
        "words": data["words"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"words": data["words"]}


@api_router.post("/vocabulary/quiz")
async def vocabulary_quiz(body: VocabularyRequest, request: Request,
                          session_token: Optional[str] = Cookie(None),
                          authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    system = (
        f"You are an English vocabulary quiz builder. Create {body.count} multiple choice questions at {body.level} level. "
        "Return ONLY valid JSON: {\"questions\": [{\"question\": str, \"options\": [str, str, str, str], \"correct_index\": int, \"explanation\": str}]}. "
        "No markdown."
    )
    chat = build_chat(f"quiz_{user.user_id}_{uuid.uuid4().hex[:6]}", system)
    try:
        resp = await chat.send_message(UserMessage(text="Generate the quiz now."))
        data = _parse_json(resp)
    except Exception as e:
        logger.exception("quiz error")
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")
    return data


@api_router.post("/pronunciation/sentence")
async def pronunciation_sentence(request: Request,
                                 session_token: Optional[str] = Cookie(None),
                                 authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    level = user.level or "Beginner"
    pool = {
        "Beginner": [
            "The weather is nice today.",
            "I would like a cup of coffee, please.",
            "She walks to school every morning.",
            "My favorite color is blue.",
            "He is reading an interesting book.",
        ],
        "Intermediate": [
            "Despite the rain, we decided to go for a walk.",
            "Could you explain how this machine works?",
            "I have been learning English for three years.",
            "The restaurant around the corner serves delicious pasta.",
            "She's looking forward to her upcoming vacation.",
        ],
        "Advanced": [
            "The entrepreneur's unwavering determination revolutionized the industry.",
            "Although the hypothesis was intriguing, it lacked empirical evidence.",
            "We must acknowledge the unprecedented challenges of climate change.",
            "The dichotomy between theory and practice often perplexes students.",
            "Her eloquent speech mesmerized the otherwise skeptical audience.",
        ],
    }
    return {"sentence": random.choice(pool.get(level, pool["Beginner"]))}


@api_router.post("/pronunciation/check")
async def pronunciation_check(
    request: Request,
    target: str = Form(...),
    audio: UploadFile = File(...),
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(request, session_token, authorization)
    await check_and_increment_usage(user.user_id, "pronunciation", is_user_premium(user))
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio")

    filename = audio.filename or "audio.webm"
    bio = io.BytesIO(audio_bytes)
    bio.name = filename

    stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
    try:
        stt_resp = await stt.transcribe(file=bio, model="whisper-1", response_format="json", language="en")
        transcription = stt_resp.text if hasattr(stt_resp, "text") else str(stt_resp)
    except Exception as e:
        logger.exception("stt error")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    system = (
        "You grade English pronunciation by comparing a target sentence to what the learner actually said (transcribed). "
        "Return ONLY valid JSON: {\"score\": int (0-100), \"accuracy\": str, \"missed_words\": [str], \"extra_words\": [str], \"tip\": str}. No markdown."
    )
    chat = build_chat(f"pron_{user.user_id}_{uuid.uuid4().hex[:6]}", system)
    try:
        resp = await chat.send_message(UserMessage(
            text=f"TARGET: {target}\nHEARD: {transcription}\n\nGrade the pronunciation."
        ))
        data = _parse_json(resp)
    except Exception:
        logger.exception("pron grade error")
        data = {"score": 50, "accuracy": "Unknown", "missed_words": [], "extra_words": [], "tip": "Could not grade, please try again."}

    await update_streak_and_xp(user.user_id, 10)
    return {"transcription": transcription, **data}


@api_router.post("/tts")
async def tts(body: TTSRequest, request: Request,
              session_token: Optional[str] = Cookie(None),
              authorization: Optional[str] = Header(None)):
    await get_current_user(request, session_token, authorization)
    tts_client = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
    try:
        audio_bytes = await tts_client.generate_speech(
            text=body.text[:4000],
            model="tts-1",
            voice=body.voice or "nova",
        )
    except Exception as e:
        logger.exception("tts error")
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")
    return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/mpeg")


LESSONS = [
    {"id": "b1", "level": "Beginner", "title": "Greetings & Introductions", "emoji": "wave",
     "description": "Say hello, introduce yourself, and ask basic questions.",
     "topics": ["Hello / Hi / Nice to meet you", "What's your name?", "Where are you from?"]},
    {"id": "b2", "level": "Beginner", "title": "Numbers, Days & Time", "emoji": "clock",
     "description": "Master counting, days of the week, and telling time.",
     "topics": ["Numbers 1-100", "Days & Months", "Telling time"]},
    {"id": "b3", "level": "Beginner", "title": "Present Simple Tense", "emoji": "book",
     "description": "Talk about routines and facts using present simple.",
     "topics": ["I / You / We / They work", "He / She / It works", "Negatives & questions"]},
    {"id": "b4", "level": "Beginner", "title": "Food & Ordering", "emoji": "fork",
     "description": "Order food and drinks politely.",
     "topics": ["Menu vocabulary", "Would like vs want", "At a cafe"]},
    {"id": "i1", "level": "Intermediate", "title": "Past Simple vs Present Perfect", "emoji": "clock-counter",
     "description": "Know when to use -ed vs have/has + past participle.",
     "topics": ["Finished time markers", "Experiences", "Since / For"]},
    {"id": "i2", "level": "Intermediate", "title": "Phrasal Verbs for Travel", "emoji": "airplane",
     "description": "Check in, pick up, drop off, take off, and more.",
     "topics": ["Airport phrasals", "Hotel phrasals", "Sightseeing"]},
    {"id": "i3", "level": "Intermediate", "title": "Conditionals (0, 1, 2)", "emoji": "lightbulb",
     "description": "If-clauses for facts, future, and imagination.",
     "topics": ["Zero conditional", "First conditional", "Second conditional"]},
    {"id": "i4", "level": "Intermediate", "title": "Business Email Writing", "emoji": "envelope",
     "description": "Write polite, clear professional emails.",
     "topics": ["Openings & closings", "Requests", "Follow-ups"]},
    {"id": "a1", "level": "Advanced", "title": "Nuance & Register", "emoji": "sparkle",
     "description": "Formal, neutral and informal English in context.",
     "topics": ["Hedging", "Softening requests", "Idioms with care"]},
    {"id": "a2", "level": "Advanced", "title": "Debating & Persuasion", "emoji": "microphone",
     "description": "Structure arguments and counter-arguments fluently.",
     "topics": ["Claim-evidence-warrant", "Rebuttals", "Rhetorical devices"]},
    {"id": "a3", "level": "Advanced", "title": "Idioms & Collocations", "emoji": "chats",
     "description": "Sound natural with native-like expressions.",
     "topics": ["Collocations", "Idioms in context", "Common mistakes"]},
    {"id": "a4", "level": "Advanced", "title": "Academic Writing", "emoji": "graduation",
     "description": "Craft clear, concise, and formal academic prose.",
     "topics": ["Thesis statements", "Cohesion", "Citations & paraphrasing"]},
]


@api_router.get("/lessons")
async def list_lessons(request: Request,
                       session_token: Optional[str] = Cookie(None),
                       authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    completed = set(user.completed_lesson_ids or [])
    premium = is_user_premium(user)
    items = [{
        **l,
        "completed": l["id"] in completed,
        "locked": (not premium) and l["level"] != "Beginner",
        "recommended": False,
    } for l in LESSONS]
    if user.goal and user.goal in GOALS:
        priority = GOALS[user.goal]["lesson_priority"]
        for it in items:
            if it["id"] in priority:
                it["recommended"] = True
    return {"lessons": items, "goal": user.goal}


@api_router.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: str, request: Request,
                     session_token: Optional[str] = Cookie(None),
                     authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    lesson = next((l for l in LESSONS if l["id"] == lesson_id), None)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if lesson["level"] != "Beginner" and not is_user_premium(user):
        raise HTTPException(
            status_code=402,
            detail={
                "code": "premium_required",
                "feature": "advanced_lessons",
                "message": "This lesson is part of Premium. Upgrade to unlock all Intermediate & Advanced lessons.",
            },
        )

    cached = await db.lesson_content.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if cached:
        content = cached["content"]
    else:
        system = (
            "You are an English curriculum designer. Return ONLY valid JSON: "
            "{\"intro\": str, \"key_points\": [str], \"examples\": [{\"english\": str, \"note\": str}], "
            "\"practice_questions\": [{\"question\": str, \"options\": [str, str, str, str], \"correct_index\": int, \"explanation\": str}]}. "
            "Provide 5 key points, 4 examples, 5 practice questions. No markdown."
        )
        chat = build_chat(f"lesson_{lesson_id}", system)
        try:
            resp = await chat.send_message(UserMessage(
                text=f"Level: {lesson['level']}. Lesson: {lesson['title']}. Topics: {', '.join(lesson['topics'])}."
            ))
            content = _parse_json(resp)
        except Exception as e:
            logger.exception("lesson gen error")
            raise HTTPException(status_code=500, detail=f"LLM error: {e}")
        await db.lesson_content.insert_one({
            "lesson_id": lesson_id,
            "content": content,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "lesson": {**lesson, "completed": lesson_id in (user.completed_lesson_ids or [])},
        "content": content,
    }


class CompleteLessonRequest(BaseModel):
    lesson_id: str
    score: int = 0


@api_router.post("/lessons/complete")
async def complete_lesson(body: CompleteLessonRequest, request: Request,
                          session_token: Optional[str] = Cookie(None),
                          authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    if body.lesson_id not in (user.completed_lesson_ids or []):
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$addToSet": {"completed_lesson_ids": body.lesson_id}},
        )
    await update_streak_and_xp(user.user_id, 25 + max(0, body.score // 5))
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return {"user": user_doc}


@api_router.get("/progress")
async def progress(request: Request,
                   session_token: Optional[str] = Cookie(None),
                   authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    completed = len(user.completed_lesson_ids or [])
    total = len(LESSONS)
    return {
        "xp": user.xp,
        "streak": user.streak,
        "level": user.level,
        "completed": completed,
        "total_lessons": total,
        "progress_pct": round(100 * completed / total) if total else 0,
    }


class SetLevelRequest(BaseModel):
    level: str


@api_router.post("/profile/level")
async def set_level(body: SetLevelRequest, request: Request,
                    session_token: Optional[str] = Cookie(None),
                    authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    if body.level not in ("Beginner", "Intermediate", "Advanced"):
        raise HTTPException(status_code=400, detail="Invalid level")
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"level": body.level}})
    return {"level": body.level}


class SetGoalRequest(BaseModel):
    goal: str


@api_router.post("/profile/goal")
async def set_goal(body: SetGoalRequest, request: Request,
                   session_token: Optional[str] = Cookie(None),
                   authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    if body.goal not in GOALS:
        raise HTTPException(status_code=400, detail="Invalid goal")
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"goal": body.goal}})
    return {"goal": body.goal, "label": GOALS[body.goal]["label"]}


@api_router.get("/profile/goals")
async def list_goals():
    return {"goals": [{"key": k, "label": v["label"]} for k, v in GOALS.items()]}


# ---------- Daily Goal Check-in ----------
CHECKIN_SEEDS = {
    "job_interview": [
        "Describe a recent work challenge and how you handled it (3 sentences).",
        "Tell me about a time you led a team or initiative.",
        "Walk me through your biggest professional accomplishment this year.",
        "Why are you a great fit for your dream role? Sell yourself in 3 sentences.",
        "Describe a time you received critical feedback and what you learned.",
    ],
    "travel": [
        "Describe the best meal you've ever had while traveling.",
        "Pretend you're at an airport and your flight is delayed — call hotel reception to extend your stay.",
        "What's a place you'd recommend a first-time visitor see in your city?",
        "Tell me about a time you got lost while traveling. What did you do?",
        "If money were no object, where would you fly tomorrow and why?",
    ],
    "ielts": [
        "Argue: Should universities offer online-only degrees? Give 3 reasons.",
        "Describe a piece of technology that changed your daily life. Use 'in addition' and 'consequently'.",
        "Compare living in a big city vs. a small town. Use complex sentences.",
        "Some people say homework is essential; others disagree. Take a side and defend it.",
        "Describe a memorable book or film. What makes it stand out?",
    ],
    "casual": [
        "What's the highlight of your day so far?",
        "Tell me one small thing you're grateful for today.",
        "If you could have any superpower for one day, what would it be?",
        "What's a song or playlist you've had on repeat lately?",
        "Describe your perfect lazy weekend.",
    ],
}


import hashlib

def _checkin_prompt_for(user: "User") -> str:
    today = date.today().isoformat()
    goal = user.goal or "casual"
    seeds = CHECKIN_SEEDS.get(goal, CHECKIN_SEEDS["casual"])
    digest = hashlib.sha256(f"{user.user_id}_{today}".encode()).hexdigest()
    h = int(digest, 16) % len(seeds)
    return seeds[h]


@api_router.get("/checkin/today")
async def checkin_today(request: Request,
                        session_token: Optional[str] = Cookie(None),
                        authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    today = date.today().isoformat()
    doc = await db.checkins.find_one(
        {"user_id": user.user_id, "date": today}, {"_id": 0}
    )
    prompt = doc["prompt"] if doc else _checkin_prompt_for(user)
    return {
        "date": today,
        "goal": user.goal,
        "goal_label": GOALS.get(user.goal, {}).get("label") if user.goal else None,
        "prompt": prompt,
        "completed": bool(doc and doc.get("completed")),
        "response": doc.get("response") if doc else None,
        "feedback": doc.get("feedback") if doc else None,
    }


class CheckinResponseRequest(BaseModel):
    response: str


@api_router.post("/checkin/respond")
async def checkin_respond(body: CheckinResponseRequest, request: Request,
                          session_token: Optional[str] = Cookie(None),
                          authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    text = (body.response or "").strip()
    if len(text) < 3:
        raise HTTPException(status_code=400, detail="Response too short")

    today = date.today().isoformat()
    existing = await db.checkins.find_one({"user_id": user.user_id, "date": today}, {"_id": 0})
    if existing and existing.get("completed"):
        return {
            "prompt": existing["prompt"],
            "response": existing["response"],
            "feedback": existing["feedback"],
            "already_completed": True,
        }
    prompt = existing["prompt"] if existing else _checkin_prompt_for(user)

    goal_label = GOALS.get(user.goal, {}).get("label") if user.goal else "casual English practice"
    system = (
        f"You are Coach Ada giving warm, concise feedback on a 60-second daily check-in for a learner whose goal is: {goal_label}. "
        "Return ONLY valid JSON: {\"reply\": str (2-3 sentences, encouraging, gently corrects 1 grammar issue inline using →), "
        "\"corrected\": str (cleaner version of learner's sentence), \"score\": int (0-100), \"highlight\": str (one specific thing they did well)}. No markdown."
    )
    chat = build_chat(f"checkin_{user.user_id}_{today}", system)
    try:
        resp = await chat.send_message(UserMessage(
            text=f"Prompt: {prompt}\n\nLearner's response: {text}"
        ))
        feedback = _parse_json(resp)
    except Exception as e:
        logger.exception("checkin error")
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

    await db.checkins.update_one(
        {"user_id": user.user_id, "date": today},
        {"$set": {
            "user_id": user.user_id,
            "date": today,
            "goal": user.goal,
            "prompt": prompt,
            "response": text,
            "feedback": feedback,
            "completed": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    await update_streak_and_xp(user.user_id, 15)
    return {"prompt": prompt, "response": text, "feedback": feedback, "already_completed": False}


# ---------- Billing (MOCKED — no real Razorpay payment) ----------
PREMIUM_PRICE_INR = 99


@api_router.get("/billing/status")
async def billing_status(request: Request,
                         session_token: Optional[str] = Cookie(None),
                         authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    today = date.today().isoformat()
    usage_docs = await db.usage_logs.find(
        {"user_id": user.user_id, "date": today}, {"_id": 0, "feature": 1, "count": 1}
    ).to_list(20)
    usage = {f: 0 for f in FREE_LIMITS}
    for d in usage_docs:
        if d.get("feature") in usage:
            usage[d["feature"]] = d.get("count", 0)
    return {
        "is_premium": is_user_premium(user),
        "premium_until": user.premium_until,
        "price_inr": PREMIUM_PRICE_INR,
        "limits": FREE_LIMITS,
        "usage": usage,
    }


@api_router.post("/billing/upgrade")
async def billing_upgrade(request: Request,
                          session_token: Optional[str] = Cookie(None),
                          authorization: Optional[str] = Header(None)):
    """MOCKED payment — instantly grants Premium for 30 days. Replace with Razorpay verify in production."""
    user = await get_current_user(request, session_token, authorization)
    until = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"is_premium": True, "premium_until": until}},
    )
    await db.payments.insert_one({
        "user_id": user.user_id,
        "amount_inr": PREMIUM_PRICE_INR,
        "method": "MOCK",
        "status": "success",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"is_premium": True, "premium_until": until, "mocked": True}


@api_router.post("/billing/cancel")
async def billing_cancel(request: Request,
                         session_token: Optional[str] = Cookie(None),
                         authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"is_premium": False, "premium_until": None}},
    )
    return {"is_premium": False}


# ---------- Share card ----------
@api_router.get("/share/streak")
async def share_streak(request: Request,
                       session_token: Optional[str] = Cookie(None),
                       authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, session_token, authorization)
    return {
        "name": user.name,
        "streak": user.streak,
        "xp": user.xp,
        "level": user.level,
        "completed_lessons": len(user.completed_lesson_ids or []),
        "share_text": (
            f"🔥 I just hit a {user.streak}-day English streak on FluentPro! "
            f"{user.xp} XP and counting. Join me — your AI English coach is free to start."
        ),
    }


@api_router.get("/")
async def root():
    return {"message": "FluentPro API", "status": "ok"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
