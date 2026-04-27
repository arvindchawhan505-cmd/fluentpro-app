"""
Backend tests for English Coach Premium tier + Share feature (iteration 2).
Covers: /api/billing/status, free-tier limit gating on /api/grammar/check,
/api/lessons locked flag, /api/lessons/{id} premium gating, /api/billing/upgrade,
/api/billing/cancel, /api/share/streak, and regression checks.

Resets usage_logs + premium flag before + after the suite so test user ends clean.
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
        f"{{$set: {{is_premium: false, premium_until: null}}}});"
    )


@pytest.fixture(scope="module", autouse=True)
def reset_user_state():
    _reset_state()
    yield
    # cleanup: leave user as non-premium with empty usage_logs
    _reset_state()


# ---------- 1. Billing status (non-premium) ----------
def test_billing_status_non_premium():
    r = requests.get(f"{BASE_URL}/api/billing/status", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["is_premium"] is False
    assert d["price_inr"] == 99
    assert set(d["limits"].keys()) >= {"conversation", "grammar", "writing", "pronunciation"}
    assert d["limits"]["grammar"] == 3
    assert "usage" in d and isinstance(d["usage"], dict)
    # baseline usage is 0 (we just reset)
    assert d["usage"].get("grammar", 0) == 0


# ---------- 2. Free-tier limit enforcement: grammar 3/day ----------
def test_grammar_free_limit_enforced():
    # Ensure clean slate
    _reset_state()
    url = f"{BASE_URL}/api/grammar/check"
    payload = {"text": "This are a sample sentence with an mistake."}

    # First 3 succeed
    for i in range(3):
        r = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200, f"call {i+1} failed: {r.status_code} {r.text}"
        assert "corrected" in r.json()

    # 4th blocked with 402 / free_limit_reached
    r4 = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT)
    assert r4.status_code == 402, f"expected 402, got {r4.status_code}: {r4.text}"
    detail = r4.json().get("detail", {})
    assert isinstance(detail, dict), f"detail should be object: {detail}"
    assert detail.get("code") == "free_limit_reached"
    assert detail.get("feature") == "grammar"
    assert detail.get("limit") == 3


# ---------- 3. Lessons list contains locked flag; int/adv locked for free ----------
def test_lessons_list_locked_flag():
    r = requests.get(f"{BASE_URL}/api/lessons", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    lessons = r.json()["lessons"]
    assert len(lessons) == 12
    for l in lessons:
        assert "locked" in l, f"missing locked on {l['id']}"
        if l["level"] == "Beginner":
            assert l["locked"] is False, f"Beginner {l['id']} should not be locked"
        else:
            assert l["locked"] is True, f"{l['level']} {l['id']} should be locked for free"


# ---------- 4. Intermediate lesson blocked for non-premium ----------
def test_intermediate_lesson_blocked_non_premium():
    r = requests.get(f"{BASE_URL}/api/lessons/i1", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 402, r.text
    detail = r.json().get("detail", {})
    assert detail.get("code") == "premium_required"


# ---------- 5. Upgrade (MOCKED) ----------
def test_upgrade_grants_premium():
    r = requests.post(f"{BASE_URL}/api/billing/upgrade", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["is_premium"] is True
    assert d.get("mocked") is True
    assert d.get("premium_until")


# ---------- 6. After upgrade: /api/lessons/i1 -> 200 with content ----------
def test_intermediate_lesson_accessible_after_upgrade():
    r = requests.get(f"{BASE_URL}/api/lessons/i1", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "lesson" in d and "content" in d
    assert d["lesson"]["id"] == "i1"
    c = d["content"]
    for k in ("intro", "key_points", "examples", "practice_questions"):
        assert k in c, f"missing {k} in content"


# ---------- 7. Billing status reflects premium ----------
def test_billing_status_premium():
    r = requests.get(f"{BASE_URL}/api/billing/status", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["is_premium"] is True
    assert d.get("premium_until")


# ---------- 8. Premium bypasses free limit ----------
def test_premium_bypasses_grammar_limit():
    # Non-premium would already be at limit (3 calls earlier). Premium should still succeed.
    url = f"{BASE_URL}/api/grammar/check"
    payload = {"text": "I has been waiting for the bus."}
    r = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, f"premium grammar failed: {r.status_code} {r.text}"
    assert "corrected" in r.json()


# ---------- 9. Share streak endpoint ----------
def test_share_streak():
    r = requests.get(f"{BASE_URL}/api/share/streak", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("name", "streak", "xp", "level", "completed_lessons", "share_text"):
        assert k in d, f"missing {k}: {d}"
    assert isinstance(d["streak"], int)
    assert isinstance(d["xp"], int)
    assert isinstance(d["completed_lessons"], int)
    assert isinstance(d["share_text"], str) and len(d["share_text"]) > 10


# ---------- 10. Cancel -> non-premium; intermediate lesson blocked again ----------
def test_cancel_premium_blocks_intermediate_again():
    r = requests.post(f"{BASE_URL}/api/billing/cancel", headers=HEADERS, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    assert r.json()["is_premium"] is False

    r2 = requests.get(f"{BASE_URL}/api/lessons/i1", headers=HEADERS, timeout=TIMEOUT)
    assert r2.status_code == 402, r2.text
    assert r2.json().get("detail", {}).get("code") == "premium_required"


# ---------- 11. Regression: core existing endpoints still work ----------
class TestRegression:
    def test_auth_me(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user_id"] == USER_ID
        # is_premium field exposed
        assert "is_premium" in d

    def test_beginner_lesson_still_free(self):
        r = requests.get(f"{BASE_URL}/api/lessons/b1", headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert "content" in r.json()

    def test_vocabulary_daily(self):
        r = requests.post(
            f"{BASE_URL}/api/vocabulary/daily",
            json={"level": "Intermediate", "count": 3},
            headers=HEADERS, timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        assert len(r.json().get("words", [])) >= 1

    def test_progress(self):
        r = requests.get(f"{BASE_URL}/api/progress", headers=HEADERS, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total_lessons"] == 12
        assert "xp" in d and "streak" in d

    def test_conversation(self):
        # After cancel, need a fresh usage slot — reset conversation counter only
        _mongo(
            f"db.usage_logs.deleteMany({{user_id: '{USER_ID}', feature: 'conversation'}});"
        )
        r = requests.post(
            f"{BASE_URL}/api/conversation",
            json={"session_id": "regression1", "message": "Hello coach!", "scenario": "general"},
            headers=HEADERS, timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json().get("reply"), str)
