"""
Tests for Day-1 onboarding completion and Daily Learning Path (iter8).
Covers:
  - POST /api/onboarding/day1/complete (idempotent, +10 XP first call)
  - GET /api/auth/me reflects has_completed_day1
  - GET /api/daily-path returns 3 tasks based on user.goal (job_interview/casual)
  - Baseline snapshot is taken once per day; activity bumps progress
  - POST /api/daily-path/claim (400 when incomplete, +30 XP once, idempotent)
  - Regression: existing endpoints still return 2xx
"""
import os
import subprocess
import pytest
import requests
from pathlib import Path


def _load_frontend_backend_url():
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_backend_url()).rstrip("/")
API = f"{BASE_URL}/api"

USER1_TOKEN = "test_session_english_coach_v1"   # job_interview, has_completed_day1=true
USER1_ID = "test-user-english-coach"
USER2_TOKEN = "test_session_referral_v2"        # goal=null -> casual
USER2_ID = "test-user-referral-2"


def _mongo(js: str):
    cmd = [
        "mongosh", "mongodb://localhost:27017/test_database",
        "--quiet", "--eval", js,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    return r.stdout.strip()


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def client1():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {USER1_TOKEN}",
                      "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def client2():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {USER2_TOKEN}",
                      "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def reset_state():
    """Clear today's daily_paths + usage_logs so tests can drive baseline → progress."""
    _mongo(
        'db.daily_paths.deleteMany({user_id:{$in:["%s","%s"]}});'
        'db.usage_logs.deleteMany({user_id:{$in:["%s","%s"]}});'
        % (USER1_ID, USER2_ID, USER1_ID, USER2_ID)
    )
    yield
    # No teardown — leave final state visible for next agent.


# ---------- Day-1 onboarding ----------
class TestOnboardingDay1:
    def test_first_call_on_fresh_user_awards_10xp(self, client2):
        # Reset user2 to has_completed_day1=false so we can test the fresh path.
        _mongo(
            'db.users.updateOne({user_id:"%s"},{$set:{has_completed_day1:false}});' % USER2_ID
        )
        before = client2.get(f"{API}/progress", timeout=15).json()
        xp_before = before.get("xp", 0)

        r = client2.post(f"{API}/onboarding/day1/complete", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data == {"already_completed": False, "xp_awarded": 10}

        # /auth/me reflects the flip
        me = client2.get(f"{API}/auth/me", timeout=15).json()
        assert me.get("has_completed_day1") is True

        # XP advanced by exactly 10
        after = client2.get(f"{API}/progress", timeout=15).json()
        assert after.get("xp", 0) - xp_before == 10

    def test_second_call_is_idempotent(self, client2):
        before = client2.get(f"{API}/progress", timeout=15).json().get("xp", 0)
        r = client2.post(f"{API}/onboarding/day1/complete", timeout=15)
        assert r.status_code == 200
        assert r.json() == {"already_completed": True, "xp_awarded": 0}
        after = client2.get(f"{API}/progress", timeout=15).json().get("xp", 0)
        assert after == before  # no XP awarded on repeat

    def test_user1_already_completed(self, client1):
        r = client1.post(f"{API}/onboarding/day1/complete", timeout=15)
        assert r.status_code == 200
        assert r.json() == {"already_completed": True, "xp_awarded": 0}


# ---------- Daily Path: shape & goal-based templates ----------
class TestDailyPathShape:
    def test_job_interview_template(self, client1):
        r = client1.get(f"{API}/daily-path", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tasks_total"] == 3
        assert data["reward_xp"] == 30
        assert data["claimed"] is False
        keys = [t["key"] for t in data["tasks"]]
        assert keys == ["chat", "writing", "grammar"]
        # Required fields per task
        for t in data["tasks"]:
            for field in ("key", "title", "metric", "target", "progress", "done", "to", "icon"):
                assert field in t, f"missing {field} in task {t}"
        # "to" links should match spec
        tos = {t["key"]: t["to"] for t in data["tasks"]}
        assert tos == {"chat": "/conversation", "writing": "/writing", "grammar": "/grammar"}

    def test_casual_fallback_for_null_goal(self, client2):
        r = client2.get(f"{API}/daily-path", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["goal_key"] == "casual"
        keys = [t["key"] for t in data["tasks"]]
        assert keys == ["chat", "vocab", "checkin"]

    def test_initial_state_zero_progress(self, client1):
        r = client1.get(f"{API}/daily-path", timeout=15).json()
        assert r["tasks_done"] == 0
        assert r["completed"] is False
        for t in r["tasks"]:
            assert t["progress"] == 0
            assert t["done"] is False


# ---------- Baseline snapshot: activity bumps progress ----------
class TestDailyPathBaseline:
    def test_grammar_activity_bumps_progress(self, client1):
        # Capture the pre-activity snapshot key (baseline was already taken).
        before = client1.get(f"{API}/daily-path", timeout=15).json()
        grammar_before = next(t for t in before["tasks"] if t["key"] == "grammar")
        assert grammar_before["progress"] == 0

        # Do a grammar check (limit 3/day free; we just cleared usage_logs).
        r = client1.post(
            f"{API}/grammar/check",
            json={"text": "He go to the store yesterday."},
            timeout=30,
        )
        assert r.status_code == 200, r.text

        after = client1.get(f"{API}/daily-path", timeout=15).json()
        grammar_after = next(t for t in after["tasks"] if t["key"] == "grammar")
        assert grammar_after["progress"] == 1
        assert grammar_after["done"] is True

    def test_baseline_is_stable_across_reads(self, client1):
        # Baseline in db should NOT mutate on subsequent calls.
        a = _mongo(
            'JSON.stringify(db.daily_paths.findOne({user_id:"%s"},{baseline:1,_id:0}))'
            % USER1_ID
        )
        client1.get(f"{API}/daily-path", timeout=15)
        client1.get(f"{API}/daily-path", timeout=15)
        b = _mongo(
            'JSON.stringify(db.daily_paths.findOne({user_id:"%s"},{baseline:1,_id:0}))'
            % USER1_ID
        )
        assert a == b


# ---------- Claim flow ----------
class TestDailyPathClaim:
    def test_claim_400_when_incomplete(self, client1):
        # Only grammar done so far → should 400
        r = client1.post(f"{API}/daily-path/claim", timeout=15)
        assert r.status_code == 400
        body = r.json()
        assert "not yet completed" in str(body).lower()

    def test_complete_all_and_claim(self, client1):
        # Drive the remaining tasks: chat (3 msgs) + writing (1 submit).
        for i in range(3):
            rc = client1.post(
                f"{API}/conversation",
                json={"scenario": "job_interview", "session_id": "iter8-test", "message": f"Hi, msg {i}"},
                timeout=45,
            )
            assert rc.status_code == 200, rc.text
        rw = client1.post(
            f"{API}/writing/feedback",
            json={"text": "Yesterday I go to the market and buyed some fruits."},
            timeout=45,
        )
        assert rw.status_code == 200, rw.text

        state = client1.get(f"{API}/daily-path", timeout=15).json()
        assert state["tasks_done"] == 3, state
        assert state["completed"] is True

        xp_before = client1.get(f"{API}/progress", timeout=15).json().get("xp", 0)
        r1 = client1.post(f"{API}/daily-path/claim", timeout=15)
        assert r1.status_code == 200, r1.text
        assert r1.json() == {"already_claimed": False, "xp_awarded": 30}
        xp_after = client1.get(f"{API}/progress", timeout=15).json().get("xp", 0)
        assert xp_after - xp_before == 30

        # Idempotent
        r2 = client1.post(f"{API}/daily-path/claim", timeout=15)
        assert r2.status_code == 200
        assert r2.json() == {"already_claimed": True, "xp_awarded": 0}


# ---------- Regression: existing endpoints still 2xx ----------
class TestRegression:
    @pytest.mark.parametrize("path", [
        "/auth/me",
        "/progress",
        "/lessons",
        "/checkin/today",
        "/challenge/today",
        "/onboarding/quest",
        "/referral/me",
    ])
    def test_get_endpoints(self, client1, path):
        r = client1.get(f"{API}{path}", timeout=20)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

    def test_post_vocabulary_daily(self, client1):
        r = client1.post(f"{API}/vocabulary/daily", json={"level": "beginner"}, timeout=30)
        assert r.status_code == 200, r.text

    def test_post_pronunciation_sentence(self, client1):
        r = client1.post(f"{API}/pronunciation/sentence", json={"level": "beginner"}, timeout=30)
        assert r.status_code == 200, r.text
