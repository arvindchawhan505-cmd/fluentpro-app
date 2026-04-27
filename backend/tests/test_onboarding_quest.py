"""Iteration 6: Tests for 3-day Onboarding Quest endpoints.

Covers:
- GET /api/onboarding/quest shape + day groupings
- POST /api/onboarding/quest/claim before completion -> 400
- Organic metric increment (grammar_check) flips task.done
- Simulated completion via direct user_metrics doc -> completed:true, claim flow
- /api/progress XP increased by 200 after claim
- Regression: /api/challenge/today, /api/lessons
"""
import os
import pytest
import requests
from pathlib import Path
from pymongo import MongoClient

# Load env vars from /app/frontend/.env and /app/backend/.env if not present
def _load_env():
    for envfile in ["/app/frontend/.env", "/app/backend/.env"]:
        p = Path(envfile)
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
_load_env()

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
TOKEN = "test_session_english_coach_v1"
USER_ID = "test-user-english-coach"
AUTH = {"Authorization": f"Bearer {TOKEN}"}

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def mdb():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module", autouse=True)
def reset_user_state(mdb):
    """Clean slate for onboarding quest + related metric docs."""
    mdb.user_metrics.delete_many({"user_id": USER_ID})
    mdb.onboarding_quests.delete_many({"user_id": USER_ID})
    mdb.challenges.delete_many({"user_id": USER_ID})
    mdb.usage_logs.delete_many({"user_id": USER_ID})
    yield


# ---------- Shape + grouping ----------
class TestQuestShape:
    def test_auth_required(self):
        r = requests.get(f"{BASE_URL}/api/onboarding/quest", timeout=30)
        assert r.status_code == 401, r.text

    def test_initial_quest_shape(self):
        r = requests.get(f"{BASE_URL}/api/onboarding/quest", headers=AUTH, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # top-level
        for k in ["tasks", "completed", "claimed", "tasks_done", "tasks_total", "reward_xp", "badge", "days_since_signup"]:
            assert k in data, f"missing {k}: {data}"
        assert data["tasks_total"] == 6
        assert data["reward_xp"] == 200
        assert data["badge"] == "Welcome Streak"
        assert data["completed"] is False
        assert data["claimed"] is False
        assert isinstance(data["days_since_signup"], int)
        assert data["days_since_signup"] >= 0
        assert data["tasks_done"] == 0
        # tasks
        assert len(data["tasks"]) == 6
        for t in data["tasks"]:
            for k in ["day", "key", "label", "metric", "done"]:
                assert k in t, f"task missing {k}: {t}"
            assert isinstance(t["done"], bool)
            assert t["done"] is False

    def test_day_groupings(self):
        r = requests.get(f"{BASE_URL}/api/onboarding/quest", headers=AUTH, timeout=30)
        data = r.json()
        by_day = {}
        for t in data["tasks"]:
            by_day.setdefault(t["day"], []).append(t["key"])
        assert set(by_day[1]) == {"day1_chat", "day1_lesson"}
        assert set(by_day[2]) == {"day2_pron", "day2_vocab"}
        assert set(by_day[3]) == {"day3_writing", "day3_grammar"}


# ---------- Claim-before-completion ----------
class TestClaimBeforeCompletion:
    def test_claim_returns_400_when_incomplete(self):
        r = requests.post(f"{BASE_URL}/api/onboarding/quest/claim", headers=AUTH, timeout=30)
        assert r.status_code == 400, r.text


# ---------- Organic metric flip (grammar_check) ----------
class TestOrganicMetricFlip:
    def test_grammar_check_flips_day3_grammar_done(self, mdb):
        # sanity: currently done=False
        r0 = requests.get(f"{BASE_URL}/api/onboarding/quest", headers=AUTH, timeout=30).json()
        grammar_task0 = next(t for t in r0["tasks"] if t["key"] == "day3_grammar")
        assert grammar_task0["done"] is False

        # Trigger grammar check once (free-tier allows 3/day)
        r1 = requests.post(
            f"{BASE_URL}/api/grammar/check",
            headers=AUTH,
            json={"text": "She go to school every day."},
            timeout=60,
        )
        assert r1.status_code == 200, r1.text

        r2 = requests.get(f"{BASE_URL}/api/onboarding/quest", headers=AUTH, timeout=30).json()
        grammar_task1 = next(t for t in r2["tasks"] if t["key"] == "day3_grammar")
        assert grammar_task1["done"] is True, f"expected grammar task done: {r2}"
        assert r2["tasks_done"] >= 1
        assert r2["completed"] is False

        # Also verify user_metrics doc was created/updated
        um = mdb.user_metrics.find_one({"user_id": USER_ID})
        assert um is not None
        assert um.get("grammar_checks", 0) >= 1


# ---------- Simulated completion + claim flow ----------
class TestCompleteAndClaim:
    def test_complete_all_then_claim(self, mdb):
        # Directly set metrics to simulate all 6 tasks done
        mdb.user_metrics.update_one(
            {"user_id": USER_ID},
            {"$set": {
                "pronunciation_good": 1,
                "conversation_messages": 1,
                "lessons_completed": 1,
                "vocab_words_seen": 5,
                "writing_submitted": 1,
                "grammar_checks": 2,
            }, "$setOnInsert": {"user_id": USER_ID}},
            upsert=True,
        )

        # GET quest -> completed:true, claimed:false
        r = requests.get(f"{BASE_URL}/api/onboarding/quest", headers=AUTH, timeout=30).json()
        assert r["completed"] is True, r
        assert r["claimed"] is False
        assert r["tasks_done"] == 6
        for t in r["tasks"]:
            assert t["done"] is True, f"task not done after simulation: {t}"

        # Capture XP before
        p_before = requests.get(f"{BASE_URL}/api/progress", headers=AUTH, timeout=30).json()
        xp_before = p_before.get("xp", 0)

        # First claim -> 200 with reward
        c1 = requests.post(f"{BASE_URL}/api/onboarding/quest/claim", headers=AUTH, timeout=30)
        assert c1.status_code == 200, c1.text
        d1 = c1.json()
        assert d1["xp_awarded"] == 200
        assert d1["badge"] == "Welcome Streak"
        assert d1.get("already_claimed") is False

        # Verify XP went up by exactly 200
        p_after = requests.get(f"{BASE_URL}/api/progress", headers=AUTH, timeout=30).json()
        xp_after = p_after.get("xp", 0)
        assert xp_after - xp_before == 200, f"xp delta {xp_after - xp_before}"

        # Second claim -> already_claimed:true, xp_awarded:0
        c2 = requests.post(f"{BASE_URL}/api/onboarding/quest/claim", headers=AUTH, timeout=30)
        assert c2.status_code == 200, c2.text
        d2 = c2.json()
        assert d2["already_claimed"] is True
        assert d2["xp_awarded"] == 0

        # GET quest reflects claimed:true
        r2 = requests.get(f"{BASE_URL}/api/onboarding/quest", headers=AUTH, timeout=30).json()
        assert r2["completed"] is True
        assert r2["claimed"] is True

        # And XP unchanged on second claim
        p_after2 = requests.get(f"{BASE_URL}/api/progress", headers=AUTH, timeout=30).json()
        assert p_after2.get("xp", 0) == xp_after


# ---------- Regression ----------
class TestRegression:
    def test_challenge_today_still_works(self):
        r = requests.get(f"{BASE_URL}/api/challenge/today", headers=AUTH, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "challenge" in data
        for k in ["key", "title", "target", "metric", "reward_xp"]:
            assert k in data["challenge"], data
        assert "progress" in data
        assert "completed" in data
        assert "claimed" in data
        assert isinstance(data.get("seconds_until_reset"), int)

    def test_lessons_still_works(self):
        r = requests.get(f"{BASE_URL}/api/lessons", headers=AUTH, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # Spec: 12 lessons. Accept list or object with lessons key.
        lessons = data if isinstance(data, list) else data.get("lessons", [])
        assert isinstance(lessons, list)
        assert len(lessons) >= 1
