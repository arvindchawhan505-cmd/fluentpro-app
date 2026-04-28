"""Retention suite — Smart Streak Saver + Streak Milestones.

Covers:
  GET  /api/streak/saver        (eligibility matrix)
  POST /api/streak/saver/claim  (idempotency per user/day)
  GET  /api/streak/milestone    (pending / next computation across 6 tiers)
  POST /api/streak/milestone/claim  (XP award + idempotency per user/days + error paths)

Uses direct mongosh via pymongo to manipulate user.streak / clear collections
between tests. Backend URL comes from REACT_APP_BACKEND_URL.
"""
import os
import time
import pytest
import requests
from datetime import date, datetime, timezone
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).resolve().parents[2] / "backend" / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
TOKEN = "test_session_english_coach_v1"
USER_ID = "test-user-english-coach"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    db = c[DB_NAME]
    yield db
    c.close()


@pytest.fixture(autouse=True)
def _reset_state(mongo):
    """Before each test: ensure day1=true, streak=2, no saves/milestones today,
    and today's daily_path starts empty so tasks_done=0."""
    today = date.today().isoformat()
    mongo.users.update_one(
        {"user_id": USER_ID},
        {"$set": {"has_completed_day1": True, "streak": 2}},
    )
    mongo.streak_saves.delete_many({"user_id": USER_ID})
    mongo.streak_milestones.delete_many({"user_id": USER_ID})
    mongo.daily_paths.delete_many({"user_id": USER_ID, "date": today})
    mongo.usage_logs.delete_many({"user_id": USER_ID})
    yield
    # leave DB in a neutral state
    mongo.streak_saves.delete_many({"user_id": USER_ID})
    mongo.streak_milestones.delete_many({"user_id": USER_ID})


# -------- Indexes --------
class TestIndexes:
    def test_conversations_compound_index_exists(self, mongo):
        idx = mongo.conversations.index_information()
        assert "user_id_1_session_id_1_created_at_1" in idx
        key = idx["user_id_1_session_id_1_created_at_1"]["key"]
        assert key == [("user_id", 1), ("session_id", 1), ("created_at", 1)]

    def test_streak_saves_unique_compound_index(self, mongo):
        idx = mongo.streak_saves.index_information()
        assert "user_id_1_date_1" in idx
        assert idx["user_id_1_date_1"].get("unique") is True

    def test_streak_milestones_unique_compound_index(self, mongo):
        idx = mongo.streak_milestones.index_information()
        assert "user_id_1_days_1" in idx
        assert idx["user_id_1_days_1"].get("unique") is True


# -------- Streak Saver --------
class TestStreakSaver:
    def test_saver_state_eligible_when_streak_and_no_tasks(self):
        r = requests.get(f"{BASE_URL}/api/streak/saver", headers=HEADERS)
        assert r.status_code == 200, r.text
        data = r.json()
        # shape
        for k in ("eligible", "streak", "claimed_today", "reward_xp", "prompt"):
            assert k in data, f"missing {k} in {data}"
        assert data["streak"] == 2
        assert data["claimed_today"] is False
        assert data["reward_xp"] == 5
        assert isinstance(data["prompt"], str) and len(data["prompt"]) > 0
        assert data["eligible"] is True  # streak>=2, tasks_done=0, no save today

    def test_saver_state_not_eligible_when_streak_below_2(self, mongo):
        mongo.users.update_one({"user_id": USER_ID}, {"$set": {"streak": 1}})
        r = requests.get(f"{BASE_URL}/api/streak/saver", headers=HEADERS)
        assert r.status_code == 200
        assert r.json()["eligible"] is False

    def test_saver_claim_first_then_idempotent(self, mongo):
        r1 = requests.post(f"{BASE_URL}/api/streak/saver/claim", headers=HEADERS)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["already_claimed"] is False

        # db row written
        today = date.today().isoformat()
        doc = mongo.streak_saves.find_one({"user_id": USER_ID, "date": today})
        assert doc is not None
        assert doc.get("claimed") is True

        # second call idempotent
        r2 = requests.post(f"{BASE_URL}/api/streak/saver/claim", headers=HEADERS)
        assert r2.status_code == 200
        assert r2.json()["already_claimed"] is True

    def test_saver_state_after_claim_shows_claimed_today(self):
        requests.post(f"{BASE_URL}/api/streak/saver/claim", headers=HEADERS)
        r = requests.get(f"{BASE_URL}/api/streak/saver", headers=HEADERS)
        data = r.json()
        assert data["claimed_today"] is True
        assert data["eligible"] is False  # claimed disqualifies

    def test_saver_not_eligible_when_tasks_started(self, mongo):
        """Simulate tasks_done>0 by first snapshotting today's baseline via
        GET /api/daily-path, then bumping grammar_checks via an activity."""
        # snapshot baseline first so subsequent activity counts as progress
        r0 = requests.get(f"{BASE_URL}/api/daily-path", headers=HEADERS)
        assert r0.status_code == 200

        r = requests.post(
            f"{BASE_URL}/api/grammar/check",
            headers=HEADERS,
            json={"text": "I has a apple"},
        )
        if r.status_code not in (200, 402):
            pytest.skip(f"grammar endpoint returned {r.status_code}: {r.text}")
        if r.status_code == 402:
            pytest.skip("grammar rate-limited; skipping task-started check")

        # confirm tasks_done > 0
        rdp = requests.get(f"{BASE_URL}/api/daily-path", headers=HEADERS).json()
        if rdp.get("tasks_done", 0) == 0:
            pytest.skip("grammar didn't register progress against job_interview template")

        rs = requests.get(f"{BASE_URL}/api/streak/saver", headers=HEADERS)
        assert rs.status_code == 200
        assert rs.json()["eligible"] is False

    def test_lessons(self):
        r = requests.get(f"{BASE_URL}/api/lessons", headers=HEADERS)
        assert r.status_code == 200
        d = r.json()
        # Endpoint returns {goal, lessons:[...]} dict shape
        assert isinstance(d, dict)
        assert "lessons" in d and isinstance(d["lessons"], list)


# -------- Streak Milestones --------
class TestStreakMilestone:
    def test_milestone_pending_null_when_streak_below_first_tier(self, mongo):
        # streak=2, below first tier (3)
        r = requests.get(f"{BASE_URL}/api/streak/milestone", headers=HEADERS)
        assert r.status_code == 200
        data = r.json()
        assert data["streak"] == 2
        assert data["pending"] is None
        assert data["next"] is not None
        assert data["next"]["days"] == 3
        assert data["next"]["reward_xp"] == 25

    def test_milestone_pending_for_reached_tier_7(self, mongo):
        mongo.users.update_one({"user_id": USER_ID}, {"$set": {"streak": 7}})
        r = requests.get(f"{BASE_URL}/api/streak/milestone", headers=HEADERS)
        data = r.json()
        assert data["streak"] == 7
        # With no claimed milestones, highest reached is 7
        assert data["pending"] is not None
        assert data["pending"]["days"] == 7
        assert data["pending"]["reward_xp"] == 75
        assert data["next"] is not None and data["next"]["days"] == 14

    def test_milestone_claim_awards_xp_and_idempotent(self, mongo):
        mongo.users.update_one({"user_id": USER_ID}, {"$set": {"streak": 7}})
        before = requests.get(f"{BASE_URL}/api/auth/me", headers=HEADERS).json()
        xp_before = before["xp"]

        r1 = requests.post(
            f"{BASE_URL}/api/streak/milestone/claim",
            headers=HEADERS, json={"days": 7},
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["already_claimed"] is False
        assert d1["xp_awarded"] == 75
        assert d1["badge"] == "weekwarrior"

        after = requests.get(f"{BASE_URL}/api/auth/me", headers=HEADERS).json()
        assert after["xp"] == xp_before + 75

        # db write
        doc = mongo.streak_milestones.find_one({"user_id": USER_ID, "days": 7})
        assert doc is not None
        assert doc["badge"] == "weekwarrior"

        # idempotent
        r2 = requests.post(
            f"{BASE_URL}/api/streak/milestone/claim",
            headers=HEADERS, json={"days": 7},
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["already_claimed"] is True
        assert d2["xp_awarded"] == 0

        # xp didn't double
        after2 = requests.get(f"{BASE_URL}/api/auth/me", headers=HEADERS).json()
        assert after2["xp"] == xp_before + 75

    def test_milestone_get_skips_claimed_tier(self, mongo):
        mongo.users.update_one({"user_id": USER_ID}, {"$set": {"streak": 7}})
        # Mark day 3 claimed
        mongo.streak_milestones.insert_one({
            "user_id": USER_ID, "days": 3, "badge": "sprout",
            "claimed_at": datetime.now(timezone.utc).isoformat(),
        })
        r = requests.get(f"{BASE_URL}/api/streak/milestone", headers=HEADERS)
        data = r.json()
        # Highest unclaimed reached tier is 7
        assert data["pending"]["days"] == 7

    def test_milestone_claim_rejects_unreached_tier(self, mongo):
        # streak=2, try to claim 7
        r = requests.post(
            f"{BASE_URL}/api/streak/milestone/claim",
            headers=HEADERS, json={"days": 7},
        )
        assert r.status_code == 400
        assert "not yet reached" in r.text.lower()

    def test_milestone_claim_rejects_unknown_tier(self):
        r = requests.post(
            f"{BASE_URL}/api/streak/milestone/claim",
            headers=HEADERS, json={"days": 5},
        )
        assert r.status_code == 400
        assert "unknown" in r.text.lower()

    def test_milestone_rewards_match_spec(self, mongo):
        """Verify each tier awards the documented XP."""
        expected = {3: 25, 7: 75, 14: 150, 30: 300, 60: 600, 100: 1000}
        for days, xp in expected.items():
            mongo.users.update_one({"user_id": USER_ID}, {"$set": {"streak": days}})
            mongo.streak_milestones.delete_many({"user_id": USER_ID})
            r = requests.post(
                f"{BASE_URL}/api/streak/milestone/claim",
                headers=HEADERS, json={"days": days},
            )
            assert r.status_code == 200, f"days={days}: {r.text}"
            d = r.json()
            assert d["already_claimed"] is False
            assert d["xp_awarded"] == xp, f"days={days} expected {xp} got {d['xp_awarded']}"


# -------- Regression smoke on untouched endpoints --------
class TestRegression:
    def test_auth_me(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=HEADERS)
        assert r.status_code == 200
        assert r.json()["user_id"] == USER_ID

    def test_progress(self):
        r = requests.get(f"{BASE_URL}/api/progress", headers=HEADERS)
        assert r.status_code == 200
        d = r.json()
        for k in ("xp", "level", "streak"):
            assert k in d

    def test_checkin_today(self):
        r = requests.get(f"{BASE_URL}/api/checkin/today", headers=HEADERS)
        assert r.status_code == 200

    def test_challenge_today(self):
        r = requests.get(f"{BASE_URL}/api/challenge/today", headers=HEADERS)
        assert r.status_code == 200

    def test_onboarding_quest(self):
        r = requests.get(f"{BASE_URL}/api/onboarding/quest", headers=HEADERS)
        assert r.status_code == 200

    def test_referral_me(self):
        r = requests.get(f"{BASE_URL}/api/referral/me", headers=HEADERS)
        assert r.status_code == 200
        assert r.json()["code"].startswith("FP-")

    def test_daily_path(self):
        r = requests.get(f"{BASE_URL}/api/daily-path", headers=HEADERS)
        assert r.status_code == 200
        d = r.json()
        assert "tasks" in d and isinstance(d["tasks"], list)
        assert len(d["tasks"]) == 3

    def test_manifest_served(self):
        r = requests.get(f"{BASE_URL}/manifest.json")
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["short_name"] == "FluentPro"
        assert m["display"] == "standalone"
        assert m["theme_color"] == "#6366F1"
        sizes = {icon["sizes"] for icon in m["icons"]}
        assert any("192x192" in s for s in sizes)
        assert any("512x512" in s for s in sizes)
        assert len(m["shortcuts"]) == 2
        urls = [s["url"] for s in m["shortcuts"]]
        assert "/dashboard" in urls and "/conversation" in urls
