# FluentPro — PRD (formerly "English Coach")

## Original Problem Statement
> Welcome to the English Coach

## User Choices
- **Core features**: Grammar, Vocabulary, Conversation, Pronunciation, Writing, Lesson Plans (Beginner → Advanced)
- **AI**: GPT-5.2 via Emergent Universal LLM key
- **Voice**: Whisper-1 (STT) + OpenAI TTS (`tts-1`, voice: nova)
- **Auth**: Emergent-managed Google OAuth
- **Design vibe**: Modern + clean (Duolingo-like)

## Tech Stack
- **Backend**: FastAPI + Motor (async MongoDB) + emergentintegrations (LlmChat / OpenAISpeechToText / OpenAITextToSpeech)
- **Frontend**: React 19 + React Router 7 + Tailwind + Phosphor Icons (duotone) + Framer Motion
- **Fonts**: Nunito (headings) + Manrope (body)

## User Personas
- **Self-learner Sara** (Intermediate): wants quick daily practice, vocab + conversation
- **Job-seeker Jay** (Advanced): wants writing feedback + interview role-play
- **Beginner Bina**: needs structured lessons + pronunciation help

## Architecture
- All API routes prefixed with `/api`
- Auth: cookie `session_token` (httponly, secure, sameSite=None) OR `Authorization: Bearer <token>`
- MongoDB collections: `users`, `user_sessions`, `conversations`, `vocab_daily`, `lesson_content`
- Custom `user_id` (UUID) field; `_id` excluded from all queries
- LLM responses are JSON-validated server-side before returning to clients

## Implemented (2026-04-27)
### Backend (`/app/backend/server.py`)
- `GET /api/` health
- `POST /api/auth/session`, `GET /api/auth/me`, `POST /api/auth/logout`
- `POST /api/conversation`, `GET /api/conversation/history/{session_id}` (5 scenarios)
- `POST /api/grammar/check` (corrected text + per-issue rule + score)
- `POST /api/writing/feedback` (4-axis scores + rewrite + summary)
- `POST /api/vocabulary/daily` (cached per user/day/level), `POST /api/vocabulary/quiz`
- `POST /api/pronunciation/sentence`, `POST /api/pronunciation/check` (multipart audio → Whisper + LLM scoring)
- `POST /api/tts` (OpenAI tts-1, voice=nova, mp3 stream)
- `GET /api/lessons` (12 lessons, B/I/A, with `locked` flag), `GET /api/lessons/{id}` (LLM-generated content cached, gated by Premium for I/A), `POST /api/lessons/complete`
- `GET /api/progress`, `POST /api/profile/level`
- Streak + XP automatically updated on every practice action

### Premium tier (added 2026-04-27)
- `GET /api/billing/status` → returns is_premium, price_inr=99, daily limits + usage
- `POST /api/billing/upgrade` (**MOCKED Razorpay** — instantly grants 30 days Premium; replace with real `razorpay.utility.verify_payment_signature` call to go live)
- `POST /api/billing/cancel`
- Free-tier daily limits (per user, reset daily): 5 conversation msgs, 3 grammar, 3 writing, 5 pronunciation. Vocabulary + Beginner lessons unlimited.
- 402 responses with `{code: free_limit_reached | premium_required}` trigger an in-app upgrade prompt modal on the frontend.

### Streak share cards (added 2026-04-27)
- `GET /api/share/streak` → returns name, streak, xp, level, completed_lessons, share_text
- Frontend `<ShareStreakModal>` renders a 1080×1080 canvas card with 3 themes (sunrise/ocean/mint), supports:
  - Native Web Share API (image + text on mobile)
  - WhatsApp deep link (`wa.me?text=...`)
  - Instagram (saves image, prompts user to attach in app)
  - Direct PNG download

### Frontend Pages
- Landing, AuthCallback, Dashboard (now with **Share my streak** + **Go Premium ₹99/mo** buttons + premium badge in header), Lessons (lock icons + Premium label on I/A), LessonDetail, Conversation, Grammar, Vocabulary, Pronunciation, Writing, Profile, **Premium** (plan compare table + MOCK Razorpay-style checkout modal + cancel)

### Test results
- Backend iteration 1: 18/18 endpoints (100%)
- Backend iteration 2: 15/15 premium + share + gating tests (100%)
- Frontend: smoke screenshots — landing, dashboard (with share + premium CTAs), premium page all rendering correctly

### Branding (added 2026-04-27)
- **App renamed to "FluentPro"** across all surfaces
- Browser tab title: `FluentPro - Speak English Confidently`
- **Custom-rendered SVG logo** (`/logo.svg`) — chat bubble + stylized white "F" + two sparkles in blue→indigo→violet gradient. Built from scratch matching the brand sheet style.
- Generated raster assets: `/logo.png`, `/logo-512.png`, `/apple-touch-icon.png` (180×180), and multi-size `/favicon.ico` (16/32/48/64/128/256)
- New shared `<Logo>` component renders the PNG icon + the "Fluent**Pro**" wordmark (Fluent = slate-900, Pro = blue→violet gradient)
- Logo placement: AppShell header (top-left, 36px), Landing login card (centered, 64px above "Continue with Google"), Profile gradient hero (decorative bottom-right, 112px @ 20% opacity), favicon
- Color theme refresh: brand CTAs and primary surfaces use `from-blue-500 to-violet-500` gradient. Active nav, Continue button, progress bar, FluentPro wordmark all gradient
- Backend root message + streak share text updated to "FluentPro"

### Goal-based onboarding & polish (added 2026-04-27)
- **First-visit onboarding modal** asks for goal: Job interview / Travel / IELTS / Casual speaking. Persists `user.goal` in MongoDB.
- Goal **personalizes Coach Ada's system prompt** (custom persona per goal in `GOALS` dict + `build_system_for_user()`).
- Goal **reorders/recommends lessons** — `/api/lessons` returns `recommended` flag per lesson; UI shows a gradient "For your goal" badge.
- New backend endpoints: `GET /api/profile/goals`, `POST /api/profile/goal`.
- Profile page: new gradient hero, level pills with gradient on active, **goal selector** with 4 colorful gradient cards.
- Lessons page: header icon now uses violet→fuchsia gradient; recommended cards have soft blue→violet gradient background and a "For your goal" badge.
- **Animated streak flame** (`<StreakFlame>` component): when streak ≥ 7 days, the flame icon gets an orange→rose glow, ping animation, and "On fire" label on Streak stats.

### Daily Goal Check-in (added 2026-04-27)
- Dashboard card **"Daily check-in · 60 sec"** with a goal-tailored prompt + textarea + Submit
- Backend: `GET /api/checkin/today`, `POST /api/checkin/respond`
- Deterministic prompt per user/day via SHA-256 hash → seed pool selection (5 prompts × 4 goals = 20 prompts, looping by user/date)
- Coach Ada returns `{reply, corrected, score, highlight}` JSON; awards +15 XP and increments streak on first completion
- One submit per day (idempotent — second submit returns same feedback)
- Confetti celebration on successful submit (small intensity)
- Backend tests: 13/13 PASS ✅

### Confetti celebrations (added 2026-04-27)
- `canvas-confetti` library with branded colors (blue/indigo/violet/amber)
- Triggers: lesson complete (intensity scales with score: small→medium→big), daily check-in submit (small), Premium upgrade (big), challenge claim (big)
- Lesson completion banner upgraded to gradient (emerald-blue) with gradient Continue button

### Daily Challenge System (added 2026-04-27)
- Today's Challenge card on Dashboard with **24h countdown timer**, animated **progress bar**, gradient amber→orange→rose theme, +XP reward badge, urgency dot for ready-to-claim
- 7 randomly-rotating challenges (deterministic per user/day): vocab, conversation, lesson, pronunciation, writing, grammar, check-in
- Backend endpoints: `GET /api/challenge/today`, `POST /api/challenge/claim`
- Auto-incremented metrics from existing endpoints (conversation, grammar, writing, vocab, pronunciation, lessons, check-in)
- Confetti + XP award on claim

### Level/XP system (added 2026-04-27)
- 7 tiers: Sprout 🌱 → Learner 📘 → Speaker 🎙️ → Storyteller 🎬 → Polyglot 🌍 → Maven 💎 → Legend 👑
- `level_from_xp()` returns level number, name, emoji, progress to next tier, and unlock perks (4 unlockable perks at L2/L3/L4/L5)
- `<LevelBadge>` component with gradient circle, level emoji, level number tag, mini progress bar to next tier
- Visible on Dashboard sidebar (small) + Profile page (large with full perks list showing locked/unlocked state)
- Returned in `/api/progress.level_info`

### Premium page conversion polish (added 2026-04-27)
- "**LIMITED LAUNCH OFFER**" banner: ₹199 → ~~₹199~~ ₹99/month, "7-day free trial", **SAVE 50%** badge in amber→rose gradient
- "**LAUNCH PRICE**" red badge next to ₹99 price
- "**Start 7-day free trial**" CTA with continuous animated pulse halo
- Subtitle: "7-day free trial, then ₹99/month"
- Subtle "Then ₹99/month · cancel anytime" caption under button

### Conversation upgrades (added 2026-04-27)
- `/api/conversation` now returns structured `{reply, corrections:[{original,correction,note}], suggestion}` JSON (best-effort parse with text fallback)
- UI renders **per-message correction chips** (red strikethrough → green) in an amber callout box
- UI renders **"💡 Better way to say it"** indigo callout below each Coach Ada reply when suggestion present
- Voice reply via existing TTS Listen button (gradient styling, indigo on hover)
- All conversation chrome (scenario picker, send button, focus rings) repainted to brand gradient

### Test results
- Backend iter-1: 18/18 ✅ · iter-2: 15/15 ✅ · iter-3: 12/12 ✅ · iter-4: 13/13 ✅ · iter-5: 14/14 ✅
- **Total: 72/72 backend tests passing**
- 1 critical fix during iter-5: `/api/writing/feedback` now correctly increments `writing_submitted` metric for daily challenge progress

### Test results
- Backend iter-1: 18/18 ✅ · iter-2: 15/15 ✅ · iter-3 (goal onboarding): 12/12 ✅

## Backlog / P1
- [ ] Word streak audio drills (per-word phoneme-level scoring)
- [ ] Lesson series unlocking (gate i/a behind earlier completions)
- [ ] Personal vocab notebook (save words, spaced repetition)
- [ ] Writing essay history & comparison
- [ ] Email summary of weekly progress

## P2
- [ ] Leaderboard
- [ ] Native mobile shell (PWA)
- [ ] Multilingual prompts for translation tutor

## Deferred
- Rate-limiting on LLM endpoints
- Robust JSON extraction for malformed model output (currently defensive parse only)
