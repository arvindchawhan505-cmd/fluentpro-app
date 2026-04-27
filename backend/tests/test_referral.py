"""
Iteration 7 — Referral system tests for FluentPro.

Covers:
- GET /api/referral/me (auth required, code shape, deterministic)
- POST /api/referral/apply (validation, self-code, invalid, valid path)
- Cross-user XP awards (referrer +100, invitee +50)
- Idempotency (already_redeemed:true on second apply)
- Regression: /api/onboarding/quest, /api/challenge/today, /api/lessons
"""
import os
import re
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vocab-builder-263.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

USER1_TOKEN = "test_session_english_coach_v1"
USER1_ID = "test-user-english-coach"
USER2_TOKEN = "test_session_referral_v2"
USER2_ID = "test-user-referral-2"

CODE_RE = re.compile(r"^FP-[0-9A-F]{6}$")


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def mongo():
    # Mongo is always local in this env per backend/.env
    client = MongoClient("mongodb://localhost:27017")
    db = client["test_database"]
    return db


@pytest.fixture(scope="module", autouse=True)
def reset_state(mongo):
    # Ensure second user exists & sessions present, referrals empty
    mongo.referrals.delete_many({})
    yield
    # Cleanup at end
    mongo.referrals.delete_many({})


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- /api/referral/me ----------
class TestReferralMe:
    def test_me_requires_auth(self):
        r = requests.get(f"{API}/referral/me")
        assert r.status_code in (401, 403), r.text

    def test_me_shape_and_code_format_user1(self):
        r = requests.get(f"{API}/referral/me", headers=_h(USER1_TOKEN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert CODE_RE.match(data["code"]), f"bad code: {data['code']}"
        assert "link" in data and data["code"] in data["link"]
        assert data["redemptions"] == 0
        assert data["xp_earned"] == 0
        assert data["referrer_reward"] == 100
        assert data["invitee_reward"] == 50
        assert "share_text" in data and data["code"] in data["share_text"]

    def test_me_deterministic(self):
        r1 = requests.get(f"{API}/referral/me", headers=_h(USER1_TOKEN)).json()
        r2 = requests.get(f"{API}/referral/me", headers=_h(USER1_TOKEN)).json()
        assert r1["code"] == r2["code"]

    def test_me_user2_code_format(self):
        r = requests.get(f"{API}/referral/me", headers=_h(USER2_TOKEN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert CODE_RE.match(data["code"])
        # Different users -> different codes
        r1_code = requests.get(f"{API}/referral/me", headers=_h(USER1_TOKEN)).json()["code"]
        assert data["code"] != r1_code


# ---------- /api/referral/apply validation ----------
class TestReferralApplyValidation:
    def test_apply_empty_code(self, mongo):
        mongo.referrals.delete_many({})
        r = requests.post(f"{API}/referral/apply", headers=_h(USER1_TOKEN), json={"code": ""})
        assert r.status_code == 400, r.text

    def test_apply_missing_code_field(self, mongo):
        mongo.referrals.delete_many({})
        r = requests.post(f"{API}/referral/apply", headers=_h(USER1_TOKEN), json={})
        assert r.status_code in (400, 422), r.text

    def test_apply_own_code(self, mongo):
        mongo.referrals.delete_many({})
        own = requests.get(f"{API}/referral/me", headers=_h(USER1_TOKEN)).json()["code"]
        r = requests.post(f"{API}/referral/apply", headers=_h(USER1_TOKEN), json={"code": own})
        assert r.status_code == 400, r.text
        assert "own" in r.json().get("detail", "").lower()

    def test_apply_invalid_code(self, mongo):
        mongo.referrals.delete_many({})
        r = requests.post(f"{API}/referral/apply", headers=_h(USER1_TOKEN), json={"code": "FP-NOPE12"})
        assert r.status_code == 404, r.text


# ---------- Happy path: cross-user XP ----------
class TestReferralApplyHappyPath:
    def test_apply_happy_path_and_xp_awards(self, mongo):
        # Reset
        mongo.referrals.delete_many({})

        # Snapshot XP via /api/progress for both users
        p1_before = requests.get(f"{API}/progress", headers=_h(USER1_TOKEN)).json()
        p2_before = requests.get(f"{API}/progress", headers=_h(USER2_TOKEN)).json()
        xp1_before = p1_before["xp"]
        xp2_before = p2_before["xp"]

        # Get user2's code
        u2_code = requests.get(f"{API}/referral/me", headers=_h(USER2_TOKEN)).json()["code"]

        # User1 applies user2's code
        r = requests.post(f"{API}/referral/apply", headers=_h(USER1_TOKEN), json={"code": u2_code})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["already_redeemed"] is False
        assert data["xp_awarded"] == 50
        assert data["referrer_reward"] == 100

        # XP deltas: user1 (invitee) +50, user2 (referrer) +100
        p1_after = requests.get(f"{API}/progress", headers=_h(USER1_TOKEN)).json()
        p2_after = requests.get(f"{API}/progress", headers=_h(USER2_TOKEN)).json()
        assert p1_after["xp"] - xp1_before == 50, f"user1 xp delta {p1_after['xp']-xp1_before}, expected 50"
        assert p2_after["xp"] - xp2_before == 100, f"user2 xp delta {p2_after['xp']-xp2_before}, expected 100"

        # Persist for the next test
        pytest.user2_code = u2_code

    def test_apply_again_idempotent(self, mongo):
        # User1 already redeemed in previous test — applying ANY code again should
        # return already_redeemed:true with xp_awarded:0 (no further XP change)
        u2_code = getattr(pytest, "user2_code", None)
        assert u2_code, "previous test must run first"

        p1_before = requests.get(f"{API}/progress", headers=_h(USER1_TOKEN)).json()["xp"]
        r = requests.post(f"{API}/referral/apply", headers=_h(USER1_TOKEN), json={"code": u2_code})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["already_redeemed"] is True
        assert data["xp_awarded"] == 0

        p1_after = requests.get(f"{API}/progress", headers=_h(USER1_TOKEN)).json()["xp"]
        assert p1_after == p1_before, "idempotent apply must not change XP"

    def test_user2_me_reflects_redemption(self):
        # Second user's GET /api/referral/me now shows redemptions:1, xp_earned:100
        r = requests.get(f"{API}/referral/me", headers=_h(USER2_TOKEN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["redemptions"] == 1
        assert data["xp_earned"] == 100


# ---------- Regression ----------
class TestRegression:
    def test_onboarding_quest_still_works(self):
        r = requests.get(f"{API}/onboarding/quest", headers=_h(USER1_TOKEN))
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("tasks", "completed", "claimed", "tasks_done", "tasks_total", "reward_xp", "badge"):
            assert key in d, f"missing {key}"
        assert isinstance(d["tasks"], list) and len(d["tasks"]) == 6

    def test_challenge_today_still_works(self):
        r = requests.get(f"{API}/challenge/today", headers=_h(USER1_TOKEN))
        assert r.status_code == 200, r.text

    def test_lessons_still_works(self):
        r = requests.get(f"{API}/lessons", headers=_h(USER1_TOKEN))
        assert r.status_code == 200, r.text
        body = r.json()
        # Endpoint may return list or {goal, lessons:[...]} — accept both
        if isinstance(body, dict):
            assert "lessons" in body and isinstance(body["lessons"], list)
        else:
            assert isinstance(body, list)
