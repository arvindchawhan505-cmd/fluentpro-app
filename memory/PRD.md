# English Coach — PRD

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
- `GET /api/lessons` (12 lessons, B/I/A), `GET /api/lessons/{id}` (LLM-generated content cached), `POST /api/lessons/complete`
- `GET /api/progress`, `POST /api/profile/level`
- Streak + XP automatically updated on every practice action

### Frontend Pages
- Landing (hero + features grid + Google login)
- AuthCallback (synchronous hash detection, race-safe)
- Dashboard (welcome card, streak/XP/level, 4 quick actions, lessons path with progress bar)
- Lessons list (filter by level)
- Lesson detail (intro, key points, examples with TTS, MCQ practice, complete)
- Conversation (5 scenarios, chat UI, listen-to-reply via TTS)
- Grammar (text input, score + per-issue corrections + rewrite)
- Vocabulary (daily flashcards + quiz, level switcher, TTS)
- Pronunciation (record via MediaRecorder → Whisper → score + tip)
- Writing (prompt + textarea → 4-axis scores + strengths/improvements + rewrite)
- Profile (avatar, level switcher, sign out)

### Test results
- Backend: 100% (18/18 endpoints) via `/app/backend/tests/test_english_coach_api.py`
- Frontend: smoke screenshots — landing + dashboard verified

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
