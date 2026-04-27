"""
Iteration 5 backend tests for FluentPro:
- Daily Challenge system (GET /api/challenge/today, POST /api/challenge/claim, determinism, increment via endpoint)
- Level/XP system (level_info in /api/progress)
- Structured conversation reply (corrections + suggestion)
- Regression: /api/checkin/today, /api/billing/status, /api/lessons, /api/share/streak
"""
import os
import time
from datetime import date, datetime, timezone

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).resolve().parents[2] / "backend" / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
SESSION_TOKEN = "test_session_english_coach_v1"
USER_ID = "test-user-english-coach"
TIMEOUT = 60
AUTH = {"Authorization": f"Bearer {SESSION_TOKEN}", "Content-Type": "application/json"}

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module", autouse=True)
def reset_state(mongo_db):
    """Clean challenge + usage logs for the test user at start of module."""
    today = date.today().isoformat()
    mongo_db.challenges.delete_many({"user_id": USER_ID})
    mongo_db.usage_logs.delete_many({"user_id": USER_ID, "date": today})
    yield
    # leave state as-is for other suites; caller can reset per instructions


# ---------- Daily Challenge ----------
class TestChallengeToday:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/challenge/today", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_shape_and_initial_state(self):
        r = requests.get(f"{BASE_URL}/api/challenge/today", headers=AUTH, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        # top-level keys
        for k in ("challenge", "progress", "target", "completed", "claimed", "seconds_until_reset"):
            assert k in d, f"missing {k}"
        # challenge keys
        ch = d["challenge"]
        for k in ("key", "title", "description", "target", "metric", "reward_xp"):
            assert k in ch, f"missing challenge.{k}"
        assert isinstance(ch["reward_xp"], int) and ch["reward_xp"] > 0
        assert isinstance(ch["target"], int) and ch["target"] > 0
        assert d["progress"] == 0
        assert d["target"] == ch["target"]
        assert d["completed"] is False
        assert d["claimed"] is False
        assert isinstance(d["seconds_until_reset"], int) and d["seconds_until_reset"] > 0
        assert d["seconds_until_reset"] <= 24 * 3600

    def test_deterministic_per_user_day(self):
        r1 = requests.get(f"{BASE_URL}/api/challenge/today", headers=AUTH, timeout=TIMEOUT).json()
        r2 = requests.get(f"{BASE_URL}/api/challenge/today", headers=AUTH, timeout=TIMEOUT).json()
        assert r1["challenge"]["key"] == r2["challenge"]["key"], "challenge key must be deterministic per user/day"


class TestChallengeClaimBeforeComplete:
    def test_claim_before_complete_400(self):
        r = requests.post(f"{BASE_URL}/api/challenge/claim", headers=AUTH, timeout=TIMEOUT)
        assert r.status_code == 400, r.text


# ---------- Bug repro: writing_submitted metric is not incremented by /api/writing/feedback ----------
class TestWritingSubmittedMetricBug:
    """If today's challenge is writing_1 (metric=writing_submitted), the endpoint
    /api/writing/feedback must call increment_challenge_metric; otherwise it is
    impossible to complete the challenge organically."""

    def test_writing_feedback_does_not_increment_writing_submitted(self, mongo_db):
        state = requests.get(f"{BASE_URL}/api/challenge/today", headers=AUTH, timeout=TIMEOUT).json()
        if state["challenge"]["metric"] != "writing_submitted":
            pytest.skip("Today's challenge is not writing_submitted; bug repro not applicable")
        # submit a writing piece
        r = requests.post(
            f"{BASE_URL}/api/writing/feedback",
            json={"text": "Today I go to school and I learning lot of thing.", "prompt": "Short note"},
            headers=AUTH, timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        after = requests.get(f"{BASE_URL}/api/challenge/today", headers=AUTH, timeout=TIMEOUT).json()
        # BUG: progress should have advanced to target=1 but it stays at 0
        assert after["progress"] == 0, (
            "If this assertion FAILS the bug is fixed. Currently, "
            "/api/writing/feedback does not increment the writing_submitted metric."
        )
        assert after["completed"] is False


# ---------- Challenge increment + claim (uses grammar_checks route regardless of today's key) ----------
class TestChallengeCompleteAndClaim:
    """Force challenge to grammar_2 so we can exercise increment + claim + already_claimed flow
    without depending on today's deterministic pick."""

    @pytest.fixture(autouse=True)
    def seed_grammar_challenge(self, mongo_db):
        today = date.today().isoformat()
        mongo_db.challenges.delete_many({"user_id": USER_ID})
        mongo_db.challenges.insert_one({
            "user_id": USER_ID,
            "date": today,
            "challenge_key": "grammar_2",
            "progress": 0,
            "target": 2,
            "completed": False,
            "claimed": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # also clear today's grammar usage so we don't hit free-tier limit of 3
        mongo_db.usage_logs.delete_many({"user_id": USER_ID, "date": today, "feature": "grammar"})
        yield

    def test_full_claim_flow(self):
        # 1. initial state: incomplete, progress=0
        d0 = requests.get(f"{BASE_URL}/api/challenge/today", headers=AUTH, timeout=TIMEOUT).json()
        assert d0["challenge"]["key"] == "grammar_2"
        assert d0["progress"] == 0 and d0["completed"] is False

        # 2. claim before complete -> 400
        r_bad = requests.post(f"{BASE_URL}/api/challenge/claim", headers=AUTH, timeout=TIMEOUT)
        assert r_bad.status_code == 400

        # 3. trigger grammar_checks x2 (target=2)
        for i in range(2):
            r = requests.post(
                f"{BASE_URL}/api/grammar/check",
                json={"text": f"Me and him {('goes' if i == 0 else 'runs')} fast."},
                headers=AUTH, timeout=TIMEOUT,
            )
            assert r.status_code == 200, r.text

        # 4. completed=true
        d1 = requests.get(f"{BASE_URL}/api/challenge/today", headers=AUTH, timeout=TIMEOUT).json()
        assert d1["progress"] == 2
        assert d1["completed"] is True
        assert d1["claimed"] is False

        # 5. snapshot xp
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=AUTH, timeout=TIMEOUT).json()
        xp_before = me["xp"]

        # 6. claim -> xp_awarded > 0
        r_claim = requests.post(f"{BASE_URL}/api/challenge/claim", headers=AUTH, timeout=TIMEOUT)
        assert r_claim.status_code == 200, r_claim.text
        cdata = r_claim.json()
        assert cdata["already_claimed"] is False
        assert cdata["xp_awarded"] == 40  # grammar_2 reward_xp

        # 7. claim again -> already_claimed:true xp_awarded:0
        r_claim2 = requests.post(f"{BASE_URL}/api/challenge/claim", headers=AUTH, timeout=TIMEOUT)
        assert r_claim2.status_code == 200
        c2 = r_claim2.json()
        assert c2["already_claimed"] is True
        assert c2["xp_awarded"] == 0

        # 8. xp increased by the reward
        prog = requests.get(f"{BASE_URL}/api/progress", headers=AUTH, timeout=TIMEOUT).json()
        assert prog["xp"] >= xp_before + 40

        # 9. challenge today reports claimed:true
        d2 = requests.get(f"{BASE_URL}/api/challenge/today", headers=AUTH, timeout=TIMEOUT).json()
        assert d2["claimed"] is True


# ---------- Level / XP system ----------
class TestLevelInfo:
    def test_progress_includes_level_info(self):
        r = requests.get(f"{BASE_URL}/api/progress", headers=AUTH, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert "level_info" in d
        li = d["level_info"]
        for k in ("level_number", "level_name", "level_emoji", "current_threshold",
                  "next_threshold", "next_name", "progress_pct", "perks"):
            assert k in li, f"missing level_info.{k}"
        assert isinstance(li["level_number"], int) and li["level_number"] >= 1
        assert isinstance(li["level_name"], str) and li["level_name"]
        assert isinstance(li["current_threshold"], int)
        assert isinstance(li["next_threshold"], int)
        assert isinstance(li["progress_pct"], int)
        assert 0 <= li["progress_pct"] <= 100
        # perks: array of 4 items with unlocked booleans
        assert isinstance(li["perks"], list) and len(li["perks"]) == 4
        for p in li["perks"]:
            assert "label" in p and "unlocked" in p and "level" in p
            assert isinstance(p["unlocked"], bool)

    def test_level_sane_for_current_xp(self):
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=AUTH, timeout=TIMEOUT).json()
        xp = me["xp"]
        li = requests.get(f"{BASE_URL}/api/progress", headers=AUTH, timeout=TIMEOUT).json()["level_info"]
        # xp must be within [current_threshold, next_threshold] (or >= current when no next)
        assert xp >= li["current_threshold"]
        if li["next_name"] is not None:
            assert xp < li["next_threshold"]


# ---------- Structured conversation ----------
class TestStructuredConversation:
    def test_clean_text_returns_reply_shape(self):
        r = requests.post(
            f"{BASE_URL}/api/conversation",
            json={"session_id": "iter5_clean", "message": "Hello Ada, how are you today?", "scenario": "general"},
            headers=AUTH, timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("reply", "corrections", "suggestion"):
            assert k in d, f"missing {k}"
        assert isinstance(d["reply"], str) and len(d["reply"]) > 0
        assert isinstance(d["corrections"], list)
        assert isinstance(d["suggestion"], str)

    def test_grammar_wrong_text_produces_corrections(self):
        r = requests.post(
            f"{BASE_URL}/api/conversation",
            json={"session_id": "iter5_wrong", "message": "Yesterday I go to park and I eat apple.", "scenario": "general"},
            headers=AUTH, timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "reply" in d and "corrections" in d and "suggestion" in d
        # Corrections is best-effort parse; per spec, don't fail if empty, but prefer >=1
        if len(d["corrections"]) >= 1:
            first = d["corrections"][0]
            assert "original" in first and "correction" in first and "note" in first
        else:
            pytest.skip("LLM returned no structured corrections for known-wrong text (best-effort parse)")


# ---------- Regression ----------
class TestRegression:
    def test_checkin_today(self):
        r = requests.get(f"{BASE_URL}/api/checkin/today", headers=AUTH, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("date", "goal", "prompt", "completed"):
            assert k in d

    def test_billing_status(self):
        r = requests.get(f"{BASE_URL}/api/billing/status", headers=AUTH, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("is_premium", "price_inr", "limits", "usage"):
            assert k in d

    def test_lessons_list(self):
        r = requests.get(f"{BASE_URL}/api/lessons", headers=AUTH, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert "lessons" in d and len(d["lessons"]) == 12

    def test_share_streak(self):
        r = requests.get(f"{BASE_URL}/api/share/streak", headers=AUTH, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        for k in ("name", "streak", "xp", "level", "share_text"):
            assert k in d
