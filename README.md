# Grievance Bridge · श्रमिक सहायता पोर्टल

Voice-first grievance and information portal for IIT Roorkee contract workers, in Hindi and English.

A voice-first, icon-first web app for IIT Roorkee contract workers (sanitation, horticulture, construction,
security, maintenance), plus an admin console for the Estate Office / Works Department.

- **Worker portal** (mobile web, Hindi + English): mobile number + 4-digit PIN login on a big keypad (SMS OTP can be switched on later), voice sign-up, sticky mic,
  the whole site in Hindi or English (text and speech; the Bhojpuri / Garhwali / Kumaoni dialects are defined but switched off until reviewed translations exist), grievances by voice or icon tap,
  an optional photo of the problem, anonymous whistleblower mode, audio receipt + QR, "My History", voice feedback, emergency helplines.
- **Admin console** (desktop, English): realtime Kanban, audio + transcript + English summary,
  AI duplicate clustering, emergency red-flags, contractor compliance scores, campus heatmap,
  complaint photos, content manager, CSV/PDF audit exports, worker PIN-reset desk, role-based access (Dean / Estate Officer / Contractor).

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + pgvector, Storage, Realtime, Auth for admins)
· Sarvam AI (Saaras v4 STT, Bulbul v3 TTS) · Groq (openai/gpt-oss-120b, with qwen/qwen3.8-27b as automatic backup) · Gemini embeddings · Tavily · Fast2SMS (optional).

---

## Design

Theme **"Teal & Marigold"** (tokens in `src/app/globals.css`):

- **Colours:** teal `#0f766e` for everyday actions and headers (soft gradients), marigold `#f59e0b` accents,
  warm off-white `#f6f4ef` pages, deep navy `#0b2230` footer. **Red `#dc2626` is reserved for emergencies and errors**,
  so it keeps its meaning. The IIT Roorkee banner keeps the institute blue `#1c4682`.
- **Fonts and icons:** Noto Sans and Noto Sans Devanagari, with lucide line icons (teal outline, or white on teal tiles).
- **Layout:** an IIT Roorkee banner, then a sticky toolbar with the अ/A language button, the emergency button and a tricolour menu. The home page is built from bands:
  - complaint recorder (top)
  - my complaints
  - information categories
  - photo cards
  - helplines
  - deep-ocean help band
  - footer
- **Help assistant:** a chat button sits at the bottom-right of every worker and login page (`/api/assistant`). It answers "how do I…" questions with short Hindi or English replies and buttons that open the right page. It accepts typed or spoken questions and works before login. If `GROQ_API_KEY` is missing it falls back to built-in keyword answers.
- **Images** (`public/images/`): the IIT Roorkee logo and building silhouette (from the supplied banner), a government-schemes illustration (`government-schemes.svg`: ID card, ₹ savings, insurance, health) and the IITR hospital photo (health). Replace them with official high-resolution files if available.

## 1. Quick start

**Prerequisites:** Node.js 20.9+ and a free Supabase project.

```bash
npm install
cp .env.example .env.local      # then fill in the values (see §2)
```

**Database (Supabase → SQL Editor):** run, in order,

1. `supabase/migrations/0001_init.sql` — tables, RLS, pgvector search function, private audio bucket, Realtime.
2. `supabase/migrations/0002_pin_auth.sql` — worker PIN credentials.
3. `supabase/migrations/0003_english.sql` — lets workers pick English as their language.
4. `supabase/migrations/0004_photos.sql` — optional photo with a complaint (private `worker-photo-vault` bucket).
5. `supabase/migrations/0005_english_content.sql` — English copies of articles and helplines.
6. `supabase/seed.sql` — placeholder agencies, helplines and the Hindi knowledge base.

Then:

```bash
npm run embed:knowledge          # creates vector embeddings for the knowledge base (needs GEMINI_API_KEY)
npm run translate:content        # English copies of articles + helplines for the English site (needs GROQ_API_KEY)
npm run create-admin -- --email dean@iitr.ac.in --name "Dean of Infrastructure" --password "choose-a-strong-one" --role dean
npm run dev                      # http://localhost:3000  (worker)  ·  http://localhost:3000/admin  (console)
```

Workers log in with their mobile number and a 4-digit PIN they create the first time (`AUTH_MODE=pin`, the
default) — no SMS provider is needed. See §5 for how PIN login works and how to switch to SMS OTP later.

> Microphone access requires HTTPS (or `localhost`). Test on a phone via the deployed URL or an HTTPS tunnel.

**Tests:** `npm test` (unit tests: campus-name auto-correction, emergency keywords, PIN rules + hashing, OTP,
token parsing, compliance scoring, WAV encoding, CSV safety, RBAC, photo checks, English/Hindi messages, keyword
fallbacks, Groq backup model). `npm run typecheck` for TypeScript.

---

## 2. API keys (`.env.local`)

| Variable | Where to get it | Required for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | everything |
| `WORKER_SESSION_SECRET` | You generate it — no website issues it: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Set once; changing it logs everyone out and invalidates all PINs. | worker login, PINs |
| `SUPABASE_AUDIO_BUCKET` | Not a key — the bucket name created by the migration. Leave it as `worker-audio-vault`. | voice recordings |
| `AUTH_MODE` | `pin` (default) or `otp` | worker login method |
| `SARVAM_API_KEY` | dashboard.sarvam.ai | speech-to-text, text-to-speech |
| `GROQ_API_KEY` | console.groq.com | intent classification, answers, dialect rewriting, de-duplication |
| `GEMINI_API_KEY` | aistudio.google.com → API keys | knowledge-base embeddings (RAG) |
| `TAVILY_API_KEY` | app.tavily.com | live web-search fallback |
| `FAST2SMS_API_KEY` | fast2sms.com → Dev API (needs DLT registration) | only when `AUTH_MODE=otp` |

Graceful degradation: if Sarvam TTS is unavailable the app reads answers with the phone's built-in Hindi voice;
if Gemini/Tavily are missing, answers fall back to whatever context is available.

---

## 3. Decisions taken (beyond / different from the PRD)

| PRD said | What was built | Why |
|---|---|---|
| `saaras:v1`, `bulbul:v1` "meera" | `saaras:v4` STT, `bulbul:v3` TTS (configurable via env) | v1 models are superseded; set `SARVAM_TTS_SPEAKER` to the voice you prefer after listening to samples. |
| Embeddings not specified (VECTOR(1536)) | Gemini `gemini-embedding-001`, 1536-dim, L2-normalised | Free tier, handles Hindi, keeps the schema as written. |
| Bhojpuri / Garhwali / Kumaoni voices | Groq rewrites each spoken reply into the dialect (Devanagari); Sarvam's Hindi voice reads it | Sarvam has no voices for these dialects. Quality for Garhwali/Kumaoni will be imperfect — review with native speakers. |
| Phone OTP login (Fast2SMS / Supabase Auth) | **Default: mobile + 4-digit PIN** with Estate Office reset (§5). Custom 4-digit SMS OTP is built in and can be switched on with `AUTH_MODE=otp`. Admins use Supabase email/password. | Indian SMS providers require DLT registration, which isn't available yet. |
| Public audio bucket | **Private** bucket; admins get 10-minute signed URLs | Conflicted with "encrypted vault" and whistleblower safety. |
| `ticket_number SERIAL` as the 4-digit token | Separate random `ticket_token` (4 digits, 5 when crowded); serial kept for internal use | Sequential tokens are guessable and exceed 4 digits after #9999. |
| Anonymous mode | `worker_id` is NULL on the ticket; the link to the worker lives in `grievance_owners`, which no admin role can read. **The voice recording of an anonymous complaint is deleted** — only the transcript is kept. Contractors never see anonymous tickets or any worker identity. | A voice can identify a person. |
| Voice grievance saved immediately | Voice grievance → signed **draft** → worker confirms category/location and anonymity → filed | Prevents accidental filings and lets the worker choose anonymity before anything is stored permanently. |
| Contractor role | Sees only their own agency's named tickets; may set "In Progress" and add notes; cannot resolve, export or see analytics | Avoids conflicts of interest. |
| Schema | Added `contractor_id`, `campus_zone`/lat/lng, `resolution_note_hindi`, `resolved_at`, `emergency_keywords`, `source`, `dialect`, plus tables `grievance_owners`, `grievance_events` (audit trail), `helplines`, `voice_queries`, `admin_users`, `otp_codes` | Needed for analytics, heatmap, spoken notes, RBAC and audits. |
| Duplicate clustering | Groq compares new reports to open tickets in the same zone + category from the last 7 days. Wage and harassment complaints are never merged (they are personal); emergencies are never merged. Admins can merge/unmerge manually. Resolving a master ticket updates all duplicates. | |
| Heatmap | Leaflet + OpenStreetMap (no key), zone circles sized by volume | Zone coordinates in `src/lib/campus.ts` are **approximate** — verify them. |

---

## 4. Placeholders you must replace before launch

Everything below is editable in **Admin → Content Manager** (no code), except zone coordinates.

- [ ] **Emergency helplines** — Campus Security, IITR Hospital, Women's Cell numbers (seeded as `0000000000`; the call button stays hidden until you untick "placeholder"). 112 / 108 / 181 are real national numbers.
- [ ] **Minimum wage rates** and the **salary payment date** (Wage Rules section).
- [ ] **Health camp schedule**, IITR hospital OPD timings, Civil Hospital Roorkee details.
- [ ] **Construction-worker welfare board** benefits and registration centre.
- [ ] **Women's Cell / Internal Committee** contact.
- [ ] **Contractor agencies** (seeded "Sample … (PLACEHOLDER)").
- [ ] **Campus zones & coordinates** in `src/lib/campus.ts` (names, Hindi spellings, lat/lng).
- [ ] Have the Estate Office confirm the general scheme texts (e-Shram, Ayushman, PM-SYM, PMSBY).

After editing content the item is re-embedded automatically; "Index N items" re-embeds anything missing.

---

## 5. Worker login

### PIN mode (default, `AUTH_MODE=pin`)

- **First visit:** the worker types their mobile number, then creates a 4-digit PIN on a large on-screen keypad and
  enters it twice. Each screen has a "सुनें" button that reads the instructions aloud. Easy PINs (1111, 1234, 4321 …) are refused.
- **Next visits:** mobile number → PIN. After 5 wrong tries the number is locked for 15 minutes.
- **Forgot PIN / locked out:** the worker goes to the Estate Office. An Estate Officer or the Dean opens
  **Admin → Worker PIN Reset**, looks up the number, checks the person's ID, and clicks *Reset*. A one-time 6-digit
  code (valid 48 h) is shown once. The worker's old PIN stops working; at next login they enter the code and choose
  a new PIN. Contractors cannot reset PINs.
- **Storage:** PINs and reset codes are stored only as salted scrypt hashes, peppered with `WORKER_SESSION_SECRET`,
  in `worker_credentials` — a table no admin role can read.

**Known limitation:** without SMS there is no proof that the person creating a PIN owns that mobile number. Someone
could create a PIN for a number before its real owner does. If a worker reports this, the Estate Office reset
gives the account back to them. Switch to OTP once DLT registration is done if this becomes a concern.

### Switching to SMS OTP later (`AUTH_MODE=otp`)

Set `AUTH_MODE=otp` and the `FAST2SMS_*` values, and redeploy. While `AUTH_MODE=pin`, both OTP endpoints are
disabled, so the test-mode on-screen OTP can never be used to bypass PIN login.

`FAST2SMS_ROUTE` options:

- `q` (Quick SMS, default) — custom text ending with `@your-domain #1234`, so Chrome on Android auto-fills the code. Costs more per SMS.
- `dlt` — your own DLT-approved template. For auto-fill, the approved template must end with `@your-domain #{#var#}`.
- `otp` — Fast2SMS's fixed template. Works, but auto-fill will not (workers type the code).

Set `NEXT_PUBLIC_APP_DOMAIN` to the bare production domain (e.g. `shramik.iitr.ac.in`). `OTP_DEV_MODE=true` shows the
code on screen instead of sending it (testing only).

---

## 5a. Troubleshooting

Run **`npm run check:setup`** first. It checks your `.env.local` values, the Supabase URL format, DNS, HTTPS
reachability, the service-role key, that both migrations were run, and that the audio bucket exists. It also
prints a fix for each problem it finds.

| Error in the terminal | Meaning | Fix |
|---|---|---|
| `TypeError: fetch failed` / "Cannot reach Supabase" | The Next.js server cannot connect to Supabase at all | Usually a wrong `NEXT_PUBLIC_SUPABASE_URL` (must be `https://<ref>.supabase.co`: no quotes, no `/rest/v1`, not the dashboard link), a **paused** free-tier project (open the Supabase dashboard and click *Restore*), or a campus/office network blocking or proxying outbound HTTPS (try a mobile hotspot to confirm). Restart `npm run dev` after editing `.env.local`. |
| `ENETUNREACH` / long timeouts on Windows | IPv6 routing problem | Set `NODE_OPTIONS=--dns-result-order=ipv4first`, then restart. |
| `SELF_SIGNED_CERT_IN_CHAIN` | A network proxy is intercepting HTTPS | Set `NODE_EXTRA_CA_CERTS` to the proxy's root certificate, or use another network. |
| `relation "worker_credentials" does not exist` | Migration 0002 not run | Run `supabase/migrations/0002_pin_auth.sql` in the SQL Editor. |
| `Invalid API key` / 401 | Wrong key | Re-copy the keys from Project Settings → API. |

## 6. Deploying to Vercel

1. Push this folder to a **private** GitHub repo (`.env.local` is git-ignored, so keys never leave your machine).
2. In Vercel: **Add New → Project**, import the repo. Framework is detected as Next.js; keep the defaults.
3. **Environment Variables:** copy every line of your `.env.local` into Vercel (Settings → Environment Variables), except:
   - `NEXT_PUBLIC_APP_URL` = your Vercel URL, e.g. `https://shramik-iitr.vercel.app`
   - `WORKER_SESSION_SECRET` **must be exactly the same** as locally — it peppers the PIN hashes, so a different value
     makes every existing worker PIN stop working.
   - If you use `AUTH_MODE=otp`, also `OTP_DEV_MODE=false` and `NEXT_PUBLIC_APP_DOMAIN`.
4. **Region:** `vercel.json` pins the functions to Mumbai (`bom1`). Keep it in the same region as your Supabase project
   (Supabase → Project Settings → General → Region); otherwise every page pays an intercontinental round trip.
5. Deploy. HTTPS is automatic, which phones need for the microphone and camera.
6. Free-tier notes: functions are capped at 60 s (`maxDuration = 60`); recordings at 30 s (Sarvam's synchronous limit)
   and 4 MB; photos at 3 MB. A free Supabase project pauses after a week without use — open the dashboard before a demo.

**Updating later:** every `git push` to the main branch redeploys automatically; pushes to other branches get their own
preview URL. Database changes are not automatic: run any new file in `supabase/migrations/` in the SQL Editor
**before** pushing code that needs it.

Housekeeping: voice grievances that are recorded but never confirmed leave a file in `worker-audio-vault/drafts/`.
Clean these periodically (e.g. a Supabase scheduled function that deletes `drafts/` objects older than 1 day).

---

## 7. How it works

```
Worker taps mic → MediaRecorder + Web Audio filters (high-pass 120 Hz, low-pass 7 kHz, compressor,
browser noise suppression) → 16 kHz mono WAV → POST /api/voice-agent
  → Sarvam STT (with campus key-terms) → campus-name auto-correction (fuzzy, src/lib/campus.ts)
  → Groq intent classifier (+ keyword emergency red-flag)
      information  → Gemini query embedding → pgvector match_knowledge()
                     similarity ≥ 0.70 → local RAG answer   |   < 0.70 → Tavily web search
      grievance    → signed draft → worker confirms → /api/grievances (dedupe, emergency, contractor link)
      status_check → token lookup
  → Groq dialect rewrite → Sarvam TTS (MP3) → card on screen + auto-played audio
Admin board ← Supabase Realtime (RLS-filtered) → refetch via RBAC-filtered API
```

```
src/
  app/(public)/        login (PIN keypad, or OTP + WebOTP), onboarding (voice name/age, work type, agency, language)
  app/(worker)/        home, section/[slug], grievance, ticket/[token], status, history
  app/admin/           login, (console)/ board, analytics, heatmap, content, reports, workers (PIN reset), users
  app/api/             worker + admin route handlers (see file headers)
  components/
    shared/            language + speech providers, chat assistant, PIN pad, header/footer
    worker/            worker-site screens: recorder, complaint form, photo picker, receipt, emergency sheet …
    admin/             admin console: shell, ticket detail, campus map
  hooks/               useRecorder (noise-filtered capture → WAV), useVoiceAgent
  lib/
    ai/                Sarvam (speech), Groq (+ backup model), Gemini embeddings, Tavily, RAG, classifier,
                       keyword fallbacks, help-assistant rules, knowledge-base indexing
    auth/              worker sessions, PIN + OTP login, Fast2SMS, admin sign-in, roles (RBAC)
    grievances/        filing + duplicate clustering, voice drafts, receipts/status speech, emergency keywords, photos
    admin/             admin ticket views, analytics + compliance scores, CSV export, form schemas
    i18n/              Hindi/English helpers, spoken prompts, English server messages, content translation
    supabase/          service-role / browser / server clients, storage helpers, pagination
    client/            browser-only helpers: API calls, photo compression, WAV encoding
    campus.ts, constants.ts, types.ts, env.ts, http.ts, text.ts, rate-limit.ts, worker-context.ts
  middleware.ts        page guard (worker session / admin sign-in)
supabase/migrations/   0001 schema · 0002 PIN login · 0003 English · 0004 photos · 0005 English content
supabase/seed.sql      agencies, helplines, Hindi knowledge base
scripts/               create-admin, embed-knowledge, translate-content, check-setup
tests/                 vitest unit tests
```

---

## 8. Verification status

Verified against the live services (Supabase, Sarvam, Groq, Gemini, Tavily):

- `next build` and `npm run typecheck` pass; all unit tests pass (`npm test`)
- PIN login, onboarding, admin sign-in and the realtime ticket board
- speech-to-text (spoken token numbers, Hindi and English questions) and text-to-speech in both languages
- voice and chat answers from the knowledge base (RAG) and from web search, in Hindi and English
- complaints by icon tap, with an optional photo (private storage, 10-minute admin links, non-images rejected)
- the Groq backup model on the app's real prompts
- English copies of all articles and helplines

**Not yet verified:**

- real phone microphones and cameras on Android/iOS (needs the HTTPS deployment)
- the PDF export and the Leaflet heatmap with real data
- SMS OTP via Fast2SMS (`AUTH_MODE=otp`)
- noisy-environment audio and cross-browser runs (the PRD's Phase 5 testing)
