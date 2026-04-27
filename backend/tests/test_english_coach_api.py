"""
Backend tests for English Coach app.
Covers: health, auth, conversation, grammar, writing, vocabulary, pronunciation,
TTS, lessons, progress, profile.
Auth uses pre-seeded session token.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vocab-builder-263.preview.emergentagent.com").rstrip("/")
SESSION_TOKEN = "test_session_english_coach_v1"
TIMEOUT = 90  # LLM calls can be slow


@pytest.fixture(scope="module")
def auth_headers():
    return {
        "Authorization": f"Bearer {SESSION_TOKEN}",
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="module")
def shared_state():
    return {}


# ---------- Health ----------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "message" in d and "status" in d
        assert d["status"] == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_me_no_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert r.status_code == 401, r.text

    def test_me_with_token(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("user_id", "email", "name", "level", "xp", "streak"):
            assert k in d, f"missing key {k}: {d}"
        assert d["user_id"] == "test-user-english-coach"

    def test_session_missing_id(self):
        r = requests.post(f"{BASE_URL}/api/auth/session", json={}, timeout=TIMEOUT)
        assert r.status_code == 400, r.text

    def test_session_invalid_id(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/session",
            json={"session_id": "definitely-not-valid-xyz"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401, r.text


# ---------- Conversation ----------
class TestConversation:
    def test_conversation(self, auth_headers):
        body = {"session_id": "test1", "message": "Yesterday I go to park.", "scenario": "general"}
        r = requests.post(f"{BASE_URL}/api/conversation", json=body, headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "reply" in d
        assert isinstance(d["reply"], str) and len(d["reply"]) > 0

    def test_conversation_history(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/conversation/history/test1", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "messages" in d
        assert isinstance(d["messages"], list)
        assert len(d["messages"]) >= 2  # user + assistant from previous test


# ---------- Grammar ----------
class TestGrammar:
    def test_grammar_check(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/grammar/check",
            json={"text": "Me and my friend goes to school."},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("corrected", "issues", "overall_feedback", "score"):
            assert k in d, f"missing {k}: {d}"
        assert isinstance(d["score"], int)
        assert isinstance(d["issues"], list)


# ---------- Writing ----------
class TestWriting:
    def test_writing_feedback(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/writing/feedback",
            json={"text": "I going to store yesterday.", "prompt": "Write a sentence"},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("scores", "strengths", "improvements", "rewrite", "summary"):
            assert k in d, f"missing {k}: {d}"
        assert isinstance(d["scores"], dict)
        for sk in ("grammar", "vocabulary", "coherence", "style"):
            assert sk in d["scores"]


# ---------- Vocabulary ----------
class TestVocabulary:
    def test_daily(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/vocabulary/daily",
            json={"level": "Intermediate", "count": 3},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "words" in d and isinstance(d["words"], list)
        assert len(d["words"]) >= 1
        w = d["words"][0]
        for k in ("word", "pronunciation", "part_of_speech", "definition", "example", "synonyms"):
            assert k in w, f"missing {k} in word: {w}"

    def test_quiz(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/vocabulary/quiz",
            json={"level": "Intermediate", "count": 3},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "questions" in d and isinstance(d["questions"], list)
        assert len(d["questions"]) >= 1
        q = d["questions"][0]
        assert "question" in q and "options" in q and "correct_index" in q


# ---------- Pronunciation ----------
class TestPronunciation:
    def test_sentence(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/pronunciation/sentence", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "sentence" in d and isinstance(d["sentence"], str) and len(d["sentence"]) > 0


# ---------- TTS ----------
class TestTTS:
    def test_tts(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/tts",
            json={"text": "hello world"},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert ct.startswith("audio/"), f"unexpected content-type: {ct}"
        assert len(r.content) > 100, "tts body too small"


# ---------- Lessons ----------
class TestLessons:
    def test_list(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/lessons", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "lessons" in d
        assert len(d["lessons"]) == 12, f"expected 12 lessons, got {len(d['lessons'])}"

    def test_get_lesson(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/lessons/b1", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "lesson" in d and "content" in d
        c = d["content"]
        for k in ("intro", "key_points", "examples", "practice_questions"):
            assert k in c, f"missing {k} in content"

    def test_complete_lesson_and_progress(self, auth_headers, shared_state):
        # snapshot xp before
        me_before = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=TIMEOUT).json()
        xp_before = me_before.get("xp", 0)

        r = requests.post(
            f"{BASE_URL}/api/lessons/complete",
            json={"lesson_id": "b1", "score": 80},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text

        # progress reflects completion
        p = requests.get(f"{BASE_URL}/api/progress", headers=auth_headers, timeout=TIMEOUT)
        assert p.status_code == 200, p.text
        pdata = p.json()
        assert pdata["completed"] >= 1
        assert pdata["xp"] > xp_before
        assert pdata["total_lessons"] == 12


# ---------- Profile ----------
class TestProfile:
    def test_set_level(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/profile/level",
            json={"level": "Advanced"},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        # verify reflected
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=TIMEOUT).json()
        assert me["level"] == "Advanced"

        # restore to Intermediate so retests are stable
        requests.post(
            f"{BASE_URL}/api/profile/level",
            json={"level": "Intermediate"},
            headers=auth_headers,
            timeout=TIMEOUT,
        )


# ---------- Logout (run last via zzz prefix) ----------
class TestZZZLogout:
    def test_logout_last(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/auth/logout", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
