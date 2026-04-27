"""
Backend tests for FluentPro Daily Goal Check-in feature (iter 4).
Endpoints: GET /api/checkin/today, POST /api/checkin/respond.
Auth uses pre-seeded session token. Test user: test-user-english-coach.

Order matters: pytest runs in file order. Each test uses ordering markers via name.
"""
import os
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vocab-builder-263.preview.emergentagent.com").rstrip("/")
SESSION_TOKEN = "test_session_english_coach_v1"
TEST_USER_ID = "test-user-english-coach"
TIMEOUT = 60  # LLM call inside /checkin/respond can take 5-15s


def _mongo_eval(js: str) -> str:
    r = subprocess.run(
        ["mongosh", "--quiet", "--eval", f"db = db.getSiblingDB('test_database'); {js}"],
        capture_output=True, text=True, timeout=15,
    )
    return r.stdout.strip()


@pytest.fixture(scope="module")
def auth_headers():
    return {
        "Authorization": f"Bearer {SESSION_TOKEN}",
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="module", autouse=True)
def reset_checkin_state():
    # Pre: clear today's checkin so we can test the full create flow.
    _mongo_eval(f"db.checkins.deleteMany({{user_id:'{TEST_USER_ID}'}});")
    # Set goal to casual so prompt comes from casual seeds (deterministic).
    _mongo_eval(f"db.users.updateOne({{user_id:'{TEST_USER_ID}'}}, {{$set:{{goal:'casual'}}}});")
    yield
    # Post: leave checkin doc as-is per request, but reset goal back to null for downstream tests.
    _mongo_eval(f"db.users.updateOne({{user_id:'{TEST_USER_ID}'}}, {{$set:{{goal:null}}}});")


# ---------- 1. GET /api/checkin/today (initial, no doc) ----------
class TestCheckinTodayInitial:
    def test_auth_required(self):
        r = requests.get(f"{BASE_URL}/api/checkin/today", timeout=TIMEOUT)
        assert r.status_code == 401, r.text

    def test_initial_response_shape(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/checkin/today", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("date", "goal", "goal_label", "prompt", "completed", "response", "feedback"):
            assert k in d, f"missing key {k}: {d}"
        assert d["completed"] is False
        assert d["response"] is None
        assert d["feedback"] is None
        assert d["goal"] == "casual"
        assert d["goal_label"] == "Casual speaking"
        assert isinstance(d["prompt"], str) and len(d["prompt"]) > 0

        # Prompt must come from CHECKIN_SEEDS["casual"]
        casual_seeds = [
            "What's the highlight of your day so far?",
            "Tell me one small thing you're grateful for today.",
            "If you could have any superpower for one day, what would it be?",
            "What's a song or playlist you've had on repeat lately?",
            "Describe your perfect lazy weekend.",
        ]
        assert d["prompt"] in casual_seeds, f"prompt not in casual seeds: {d['prompt']}"

    def test_deterministic_same_user_same_day(self, auth_headers):
        r1 = requests.get(f"{BASE_URL}/api/checkin/today", headers=auth_headers, timeout=TIMEOUT)
        r2 = requests.get(f"{BASE_URL}/api/checkin/today", headers=auth_headers, timeout=TIMEOUT)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["prompt"] == r2.json()["prompt"], "prompt must be deterministic per user/day"


# ---------- 2. POST /api/checkin/respond — validation ----------
class TestCheckinRespondValidation:
    def test_short_response_400(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/checkin/respond",
            json={"response": "a"},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, r.text

    def test_empty_response_400(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/checkin/respond",
            json={"response": "   "},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, r.text


# ---------- 3. POST /api/checkin/respond — happy path ----------
class TestCheckinRespondFlow:
    def test_respond_success_and_xp_increase(self, auth_headers):
        # XP before
        me_before = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=TIMEOUT).json()
        xp_before = me_before.get("xp", 0)

        r = requests.post(
            f"{BASE_URL}/api/checkin/respond",
            json={"response": "I love sunny weekends with friends and a good book."},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("already_completed") is False
        assert "feedback" in d and isinstance(d["feedback"], dict)
        fb = d["feedback"]
        for k in ("reply", "corrected", "score", "highlight"):
            assert k in fb, f"missing feedback key {k}: {fb}"
        assert isinstance(fb["score"], int)
        assert isinstance(fb["reply"], str) and len(fb["reply"]) > 0
        assert isinstance(fb["corrected"], str)
        assert isinstance(fb["highlight"], str)
        assert d.get("response") == "I love sunny weekends with friends and a good book."
        assert isinstance(d.get("prompt"), str) and len(d["prompt"]) > 0

        # XP should have increased by 15
        me_after = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=TIMEOUT).json()
        assert me_after["xp"] >= xp_before + 15, f"xp should increase by >=15: {xp_before} -> {me_after['xp']}"

    def test_today_after_respond_shows_completed(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/checkin/today", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["completed"] is True
        assert d["response"] == "I love sunny weekends with friends and a good book."
        assert isinstance(d["feedback"], dict)
        for k in ("reply", "corrected", "score", "highlight"):
            assert k in d["feedback"]

    def test_second_respond_returns_already_completed(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/checkin/respond",
            json={"response": "Another attempt at the same prompt today."},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("already_completed") is True, d
        # original response retained
        assert d.get("response") == "I love sunny weekends with friends and a good book."
        assert "feedback" in d and isinstance(d["feedback"], dict)


# ---------- 4. Goal-pool selection (no checkin doc, change goal) ----------
class TestCheckinGoalPool:
    """Verify prompt comes from the right pool when no checkin doc exists.

    To do this without polluting today's checkin, we delete checkins for the
    user, switch goal to job_interview, and assert the returned prompt is
    from CHECKIN_SEEDS['job_interview'].
    """
    def test_job_interview_pool(self, auth_headers):
        _mongo_eval(f"db.checkins.deleteMany({{user_id:'{TEST_USER_ID}'}});")
        # Set goal to job_interview
        r = requests.post(
            f"{BASE_URL}/api/profile/goal",
            json={"goal": "job_interview"},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text

        r2 = requests.get(f"{BASE_URL}/api/checkin/today", headers=auth_headers, timeout=TIMEOUT)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        ji_seeds = [
            "Describe a recent work challenge and how you handled it (3 sentences).",
            "Tell me about a time you led a team or initiative.",
            "Walk me through your biggest professional accomplishment this year.",
            "Why are you a great fit for your dream role? Sell yourself in 3 sentences.",
            "Describe a time you received critical feedback and what you learned.",
        ]
        assert d["goal"] == "job_interview"
        assert d["goal_label"] == "Ace job interviews"
        assert d["prompt"] in ji_seeds, f"prompt not in job_interview seeds: {d['prompt']}"

    def test_ielts_pool(self, auth_headers):
        _mongo_eval(f"db.checkins.deleteMany({{user_id:'{TEST_USER_ID}'}});")
        r = requests.post(
            f"{BASE_URL}/api/profile/goal",
            json={"goal": "ielts"},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text

        r2 = requests.get(f"{BASE_URL}/api/checkin/today", headers=auth_headers, timeout=TIMEOUT)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        ielts_seeds = [
            "Argue: Should universities offer online-only degrees? Give 3 reasons.",
            "Describe a piece of technology that changed your daily life. Use 'in addition' and 'consequently'.",
            "Compare living in a big city vs. a small town. Use complex sentences.",
            "Some people say homework is essential; others disagree. Take a side and defend it.",
            "Describe a memorable book or film. What makes it stand out?",
        ]
        assert d["goal"] == "ielts"
        assert d["prompt"] in ielts_seeds, f"prompt not in ielts seeds: {d['prompt']}"


# ---------- 5. Regression on previously passing endpoints ----------
class TestRegression:
    def test_billing_status(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/billing/status", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("is_premium", "price_inr", "limits", "usage"):
            assert k in d

    def test_share_streak(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/share/streak", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("name", "streak", "xp", "level", "completed_lessons", "share_text"):
            assert k in d

    def test_lessons_b1(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/lessons/b1", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "lesson" in d and "content" in d
