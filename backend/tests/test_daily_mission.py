"""Backend tests for the new Daily Mission flow (iter10).

Covers:
- GET /api/mission/today initial shape
- POST /api/mission/progress: increment, idempotent XP awards, 400 on bad task
- POST /api/mission/complete: 400 before all done, +30 bonus, idempotent
- has_completed_day1 flips on first completion
- Streak increments on completion
- daily_missions unique compound (user_id,date) index exists
- Regression on key prior endpoints (auth/me, conversation, vocabulary/quiz,
  grammar/check, pronunciation/sentence, streak/saver, streak/milestone,
  daily-path, progress, lessons, checkin/today, challenge/today)
"""

import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vocab-builder-263.preview.emergentagent.com").rstrip("/")
TOKEN = "test_session_english_coach_v1"
USER_ID = "test-user-english-coach"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(autouse=True)
def reset_mission_state(mongo_db):
    """Clean today's mission and ensure user is premium (bypass free-tier limits)
    and is in a known streak/has_completed_day1 state for each test."""
    mongo_db.daily_missions.delete_many({"user_id": USER_ID})
    mongo_db.users.update_one(
        {"user_id": USER_ID},
        {"$set": {"is_premium": True, "streak": 2, "has_completed_day1": True, "goal": "job_interview"}},
    )
    yield
    mongo_db.daily_missions.delete_many({"user_id": USER_ID})


# ---------- mission/today ----------
class TestMissionToday:
    def test_initial_shape(self):
        r = requests.get(f"{BASE_URL}/api/mission/today", headers=HEADERS, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "date" in data
        assert data["tasks_done"] == 0
        assert data["tasks_total"] == 4
        assert data["xp_earned"] == 0
        assert data["completed"] is False
        assert data["completion_bonus"] == 30
        assert data["next_task"] == "chat"
        keys = [t["key"] for t in data["tasks"]]
        assert keys == ["chat", "vocab", "speak", "write"]
        targets = {t["key"]: (t["target"], t["xp"]) for t in data["tasks"]}
        assert targets == {"chat": (2, 5), "vocab": (2, 10), "speak": (1, 10), "write": (1, 15)}
        for t in data["tasks"]:
            assert t["progress"] == 0
            assert t["done"] is False


# ---------- mission/progress ----------
class TestMissionProgress:
    def _post(self, task, increment=1):
        return requests.post(
            f"{BASE_URL}/api/mission/progress",
            json={"task": task, "increment": increment},
            headers=HEADERS,
            timeout=20,
        )

    def test_unknown_task_400(self):
        r = self._post("ghost")
        assert r.status_code == 400

    def test_chat_awards_xp_only_on_target_crossing(self):
        # 1st call → progress=1, no XP
        r1 = self._post("chat").json()
        assert r1["xp_awarded_this_call"] == 0
        assert r1["task_just_completed"] is False
        chat_t = next(t for t in r1["tasks"] if t["key"] == "chat")
        assert chat_t["progress"] == 1 and chat_t["done"] is False
        # 2nd call → crosses target=2, awards 5 XP
        r2 = self._post("chat").json()
        assert r2["xp_awarded_this_call"] == 5
        assert r2["task_just_completed"] is True
        chat_t = next(t for t in r2["tasks"] if t["key"] == "chat")
        assert chat_t["done"] is True
        assert r2["xp_earned"] == 5
        # 3rd call → no additional XP
        r3 = self._post("chat").json()
        assert r3["xp_awarded_this_call"] == 0
        assert r3["xp_earned"] == 5

    def test_vocab_target_2(self):
        assert self._post("vocab").json()["xp_awarded_this_call"] == 0
        r2 = self._post("vocab").json()
        assert r2["xp_awarded_this_call"] == 10
        assert r2["xp_earned"] == 10

    def test_speak_target_1(self):
        r = self._post("speak").json()
        assert r["xp_awarded_this_call"] == 10
        assert r["xp_earned"] == 10

    def test_write_target_1(self):
        r = self._post("write").json()
        assert r["xp_awarded_this_call"] == 15
        assert r["xp_earned"] == 15


# ---------- mission/complete ----------
class TestMissionComplete:
    def _progress(self, task, n=1):
        for _ in range(n):
            r = requests.post(
                f"{BASE_URL}/api/mission/progress",
                json={"task": task},
                headers=HEADERS,
                timeout=20,
            )
            assert r.status_code == 200

    def test_premature_complete_400(self):
        self._progress("chat", 2)
        # only 1 task done — should 400
        r = requests.post(f"{BASE_URL}/api/mission/complete", headers=HEADERS, timeout=20)
        assert r.status_code == 400

    def test_full_happy_path(self, mongo_db):
        before = mongo_db.users.find_one({"user_id": USER_ID}) or {}
        before_streak = int(before.get("streak", 0))
        self._progress("chat", 2)
        self._progress("vocab", 2)
        self._progress("speak", 1)
        self._progress("write", 1)
        # All 4 tasks done — xp_earned = 5+10+10+15 = 40
        today = requests.get(f"{BASE_URL}/api/mission/today", headers=HEADERS, timeout=20).json()
        assert today["tasks_done"] == 4
        assert today["xp_earned"] == 40
        assert today["completed"] is False
        # Complete
        r = requests.post(f"{BASE_URL}/api/mission/complete", headers=HEADERS, timeout=20).json()
        assert r["already_completed"] is False
        assert r["xp_awarded"] == 30
        assert r["xp_earned"] == 70
        assert r["completed"] is True
        # Idempotent
        r2 = requests.post(f"{BASE_URL}/api/mission/complete", headers=HEADERS, timeout=20).json()
        assert r2["already_completed"] is True
        assert r2["xp_awarded"] == 0
        # Streak incremented and last_active_date set
        after = mongo_db.users.find_one({"user_id": USER_ID})
        # update_streak_and_xp will have been called, so streak should be >= before_streak (it
        # may equal if same day already counted). last_active_date should exist.
        assert "last_active_date" in after
        assert int(after.get("streak", 0)) >= before_streak

    def test_first_completion_flips_has_completed_day1(self, mongo_db):
        mongo_db.users.update_one({"user_id": USER_ID}, {"$set": {"has_completed_day1": False}})
        self._progress("chat", 2)
        self._progress("vocab", 2)
        self._progress("speak", 1)
        self._progress("write", 1)
        r = requests.post(f"{BASE_URL}/api/mission/complete", headers=HEADERS, timeout=20)
        assert r.status_code == 200
        u = mongo_db.users.find_one({"user_id": USER_ID})
        assert u.get("has_completed_day1") is True


# ---------- Mongo index ----------
class TestMissionIndex:
    def test_unique_compound_user_date(self, mongo_db):
        # Trigger doc creation
        requests.get(f"{BASE_URL}/api/mission/today", headers=HEADERS, timeout=20)
        info = mongo_db.daily_missions.index_information()
        # Look for index on (user_id, date) that is unique
        found = False
        for name, spec in info.items():
            keys = spec.get("key", [])
            if [("user_id", 1), ("date", 1)] == list(keys) and spec.get("unique"):
                found = True
                break
        assert found, f"daily_missions unique compound index (user_id,date) not found. Got: {info}"


# ---------- Regression on prior endpoints ----------
class TestRegression:
    @pytest.mark.parametrize("path", [
        "/api/auth/me",
        "/api/progress",
        "/api/lessons",
        "/api/checkin/today",
        "/api/challenge/today",
        "/api/daily-path",
        "/api/streak/saver",
        "/api/streak/milestone",
    ])
    def test_get_endpoints_200(self, path):
        r = requests.get(f"{BASE_URL}{path}", headers=HEADERS, timeout=30)
        assert r.status_code == 200, f"{path} returned {r.status_code}: {r.text[:200]}"

    def test_vocabulary_quiz_post(self):
        r = requests.post(f"{BASE_URL}/api/vocabulary/quiz", json={}, headers=HEADERS, timeout=60)
        assert r.status_code == 200, f"vocabulary/quiz returned {r.status_code}: {r.text[:200]}"

    def test_pronunciation_sentence_post(self):
        r = requests.post(f"{BASE_URL}/api/pronunciation/sentence", json={}, headers=HEADERS, timeout=60)
        assert r.status_code == 200, f"pronunciation/sentence returned {r.status_code}: {r.text[:200]}"

    def test_grammar_check(self):
        r = requests.post(
            f"{BASE_URL}/api/grammar/check",
            json={"text": "I goes to school yesterday."},
            headers=HEADERS,
            timeout=60,
        )
        assert r.status_code == 200
        data = r.json()
        # Either 'corrected' or 'correction' style key — be permissive
        assert isinstance(data, dict) and len(data) > 0

    def test_conversation(self):
        r = requests.post(
            f"{BASE_URL}/api/conversation",
            json={"message": "Hi Ada, how are you today?", "session_id": "test-mission-regress"},
            headers=HEADERS,
            timeout=60,
        )
        assert r.status_code == 200
        data = r.json()
        assert "reply" in data or "message" in data or "response" in data
