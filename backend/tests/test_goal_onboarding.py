"""
Iteration 3 — Goal-based onboarding for FluentPro Coach Ada.
Covers: GET /api/profile/goals, POST /api/profile/goal (valid/invalid),
/api/auth/me reflection, /api/lessons recommended flag per goal,
/api/conversation with goal-personalized system prompt for ielts/casual,
and regression on /api/billing/status, /api/share/streak, /api/lessons/b1.

Resets goal=null & usage_logs before/after to leave user clean.
"""
import os
import subprocess
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://vocab-builder-263.preview.emergentagent.com"
).rstrip("/")
TOKEN = "test_session_english_coach_v1"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
TIMEOUT = 90
USER_ID = "test-user-english-coach"


def _mongo(script: str):
    subprocess.run(
        ["mongosh", "--quiet", "--eval", f"use('test_database'); {script}"],
        check=True, capture_output=True, text=True,
    )


def _reset_state():
    _mongo(
        f"db.usage_logs.deleteMany({{user_id: '{USER_ID}'}}); "
        f"db.users.updateOne({{user_id:'{USER_ID}'}}, "
        f"{{$set: {{goal: null, is_premium: false, premium_until: null}}}});"
    )


@pytest.fixture(scope="module", autouse=True)
def reset_user_state():
    _reset_state()
    yield
    _reset_state()


def _set_goal(goal: str):
    """Helper to set goal via API and assert success."""
    r = requests.post(
        f"{BASE_URL}/api/profile/goal",
        json={"goal": goal}, headers=HEADERS, timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    return r.json()


# ---------- 1. List goals ----------
def test_list_goals():
    r = requests.get(f"{BASE_URL}/api/profile/goals", timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "goals" in data
    keys = {g["key"] for g in data["goals"]}
    assert keys == {"job_interview", "travel", "ielts", "casual"}, f"got: {keys}"
    for g in data["goals"]:
        assert isinstance(g["label"], str) and len(g["label"]) > 0


# ---------- 2. Invalid goal -> 400 ----------
def test_set_goal_invalid():
    r = requests.post(
        f"{BASE_URL}/api/profile/goal",
        json={"goal": "become_president"}, headers=HEADERS, timeout=TIMEOUT,
    )
    assert r.status_code == 400, r.text


# ---------- 3. Valid goal -> 200 ----------
def test_set_goal_job_interview():
    d = _set_goal("job_interview")
    assert d["goal"] == "job_interview"
    assert d["label"] == "Ace job interviews"


# ---------- 4. /api/auth/me reflects goal ----------
def test_auth_me_reflects_goal():
    _set_goal("job_interview")
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["user_id"] == USER_ID
    assert me["goal"] == "job_interview"


# ---------- 5. /api/lessons recommended flag for job_interview ----------
def test_lessons_recommended_job_interview():
    _set_goal("job_interview")
    r = requests.get(f"{BASE_URL}/api/lessons", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("goal") == "job_interview"
    lessons = body["lessons"]
    expected = {"i4", "a2", "i1", "a1", "a4", "i3"}
    by_id = {l["id"]: l for l in lessons}
    for lid in expected:
        assert by_id[lid]["recommended"] is True, f"{lid} should be recommended"
    # Lessons NOT in priority should not be recommended
    not_recommended = {l["id"] for l in lessons if l["id"] not in expected}
    for lid in not_recommended:
        assert by_id[lid]["recommended"] is False, f"{lid} should NOT be recommended"


# ---------- 6. /api/lessons recommended flag for travel ----------
def test_lessons_recommended_travel():
    _set_goal("travel")
    r = requests.get(f"{BASE_URL}/api/lessons", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("goal") == "travel"
    lessons = body["lessons"]
    expected = {"b4", "b1", "i2", "b2", "i1"}
    by_id = {l["id"]: l for l in lessons}
    for lid in expected:
        assert by_id[lid]["recommended"] is True, f"{lid} should be recommended for travel"
    # i1 is Intermediate -> for free user it should still be locked but recommended
    assert by_id["i1"]["locked"] is True
    assert by_id["i1"]["recommended"] is True
    # b4/b1/b2 are Beginner so unlocked + recommended
    for lid in ("b4", "b1", "b2"):
        assert by_id[lid]["locked"] is False
        assert by_id[lid]["recommended"] is True


# ---------- 7. ielts goal -> conversation general should reply ----------
def test_conversation_ielts_general():
    _set_goal("ielts")
    # ensure at least one slot
    _mongo(f"db.usage_logs.deleteMany({{user_id: '{USER_ID}', feature: 'conversation'}});")
    r = requests.post(
        f"{BASE_URL}/api/conversation",
        json={"session_id": "goal_ielts_general", "message": "Hi, I want to improve my speaking.", "scenario": "general"},
        headers=HEADERS, timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    reply = r.json().get("reply")
    assert isinstance(reply, str) and len(reply) > 0


# ---------- 8. casual goal -> conversation restaurant scenario should work ----------
def test_conversation_casual_restaurant():
    _set_goal("casual")
    _mongo(f"db.usage_logs.deleteMany({{user_id: '{USER_ID}', feature: 'conversation'}});")
    r = requests.post(
        f"{BASE_URL}/api/conversation",
        json={"session_id": "goal_casual_resto", "message": "Hello, I'd like to order a coffee please.", "scenario": "restaurant"},
        headers=HEADERS, timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    reply = r.json().get("reply")
    assert isinstance(reply, str) and len(reply) > 0


# ---------- 9. Regression ----------
class TestRegression:
    def test_billing_status(self):
        r = requests.get(f"{BASE_URL}/api/billing/status", headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "is_premium" in d
        assert "limits" in d and "usage" in d

    def test_share_streak(self):
        r = requests.get(f"{BASE_URL}/api/share/streak", headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("name", "streak", "xp", "level", "completed_lessons", "share_text"):
            assert k in d

    def test_lesson_b1(self):
        r = requests.get(f"{BASE_URL}/api/lessons/b1", headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "lesson" in body and "content" in body
        assert body["lesson"]["id"] == "b1"


# ---------- 10. Lessons list with no goal -> all recommended=False ----------
def test_lessons_no_goal_no_recommendations():
    _reset_state()
    r = requests.get(f"{BASE_URL}/api/lessons", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("goal") is None
    for l in body["lessons"]:
        assert l["recommended"] is False, f"{l['id']} should not be recommended without goal"
