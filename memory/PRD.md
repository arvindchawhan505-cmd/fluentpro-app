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
- Custom SVG logo (`/logo.svg`) + favicon (`/favicon.svg`) — speech-bubble + sparkle in blue→indigo→violet gradient
- New shared `<Logo>` component used in AppShell + Landing
- Color theme refresh: brand CTAs and primary surfaces now use `from-blue-500 to-violet-500` gradient (replaced sky-400 single-tone). Active nav, Continue button, progress bar, FluentPro wordmark all gradient
- Backend root message + streak share text updated to "FluentPro"

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
