# EchoSpace

**Listen. Understand. Discuss. Create.**

EchoSpace is a full-stack, PostgreSQL-backed audio collaboration platform with a Manifest V3 Chrome Extension, supporting **Study Mode** (for students, teachers, and study groups) and **Creator Mode** (for podcasters, interviewers, and audio teams).

---

## Architecture & Implemented Features

### 1. Frontend Web Application (`src/`)
Built with **React 19**, **Vite**, **Tailwind CSS v4**, **React Router**, **Zustand**, **WaveSurfer.js**, **Axios**, and **Socket.IO Client**.

- **Authentication & RBAC Workspaces**: Real registration/login, JWT persistence, protected `/app/*` routes ([AppLayout.jsx](file:///c:/Users/sumit/EchoSpace/src/layouts/AppLayout.jsx)), and dual-mode workspace switching (**Study Mode** & **Creator Mode**) driven by [modeConfig.js](file:///c:/Users/sumit/EchoSpace/src/config/modeConfig.js).
- **Unified Audio Workspace (`/app/recordings/:id`)**:
  - Single authoritative [AudioPlayer.jsx](file:///c:/Users/sumit/EchoSpace/src/components/audio/AudioPlayer.jsx) + [Waveform.jsx](file:///c:/Users/sumit/EchoSpace/src/components/audio/Waveform.jsx) rendering real WaveSurfer.js waveforms (with React StrictMode cleanup guard, pending pre-ready seek queue, and live JWT stream URLs).
  - **Study Mode**: Timestamped **Questions** and unified **Notes** (legacy `INSIGHT`/`REVISION` migrated/normalized to `NOTE`); clicking any question/note card or notification navigates directly to its exact timestamp.
  - **Creator Mode**: Timestamped **Feedback**, **Corrections**, and **Suggestions** with `OPEN`/`RESOLVED` status tracking, chapters, playlists, and RSS 2.0 feeds.
  - **Manual Highlight Recording & Clips**: **Start Highlight / Stop Highlight / Cancel** during playback to capture exact intervals, preview intervals in [ClipModal.jsx](file:///c:/Users/sumit/EchoSpace/src/components/clips/ClipModal.jsx), play `[startTime, endTime]` intervals (stopping or looping at `endTime`), delete clips, and share via `/clips/:token` ([ClipSharePage.jsx](file:///c:/Users/sumit/EchoSpace/src/pages/ClipSharePage.jsx)).
  - **Notifications**: Persistent + real-time Socket.IO notification bell in [Navbar.jsx](file:///c:/Users/sumit/EchoSpace/src/components/layout/Navbar.jsx) when someone answers your question, with unread count, mark-as-read, and deep-linking to the exact recording and timestamp.
  - **Upload, External Import & Deletion**: Upload audio files, import direct audio URLs or Podcast RSS episodes via [UploadRecordingModal.jsx](file:///c:/Users/sumit/EchoSpace/src/components/dashboard/UploadRecordingModal.jsx), link external media, and securely delete recordings with confirmation.

### 2. Backend API, Database & Worker (`backend/`)
Built with **Node.js**, **Express.js**, **Prisma ORM**, **PostgreSQL**, **JWT**, **bcryptjs**, **Zod**, **Multer**, **Socket.IO**, `@aws-sdk/client-s3`, and `fast-xml-parser`.

- **PostgreSQL Schema & Migrations (`backend/prisma/schema.prisma`, `backend/prisma/migrations/0001_init/migration.sql`, `backend/prisma/upgrade_legacy_notes.sql`)**:
  - UUID models: `User`, `Workspace`, `WorkspaceMember`, `Show`, `Episode` (with `deletedAt` staged soft-delete), `Annotation`, `AnnotationReply`, `Clip`, `Chapter`, `Playlist`, `PlaylistEpisode`, `Bookmark`, `Notification`, and `ImportJob`.
- **Auth & Workspaces**: `/api/auth/*`, `/api/users/me`, `/api/workspaces/*` with rate limiting and `OWNER`/`EDITOR`/`MEMBER`/`VIEWER` RBAC.
- **Audio Upload, Streaming & Storage (`backend/src/utils/storage.js`)**:
  - Supports `STORAGE_DRIVER=local` (dev/persistent disk, `EXDEV`-safe) and `STORAGE_DRIVER=s3` (S3-compatible object storage with range reads).
  - `POST /api/episodes/upload` (extension + magic-byte validation, orphan cleanup), `POST /api/episodes/external`, `GET /api/episodes/:id/audio` (`206 Partial Content` Range streaming), `DELETE /api/episodes/:id` (atomic `deletedAt` soft-delete → storage removal → hard-delete, with startup pending-delete recovery).
- **External Audio & RSS Import Queue (`backend/src/modules/imports/`, `backend/src/utils/ssrf.js`)**:
  - `POST /api/imports`, `POST /api/imports/rss/preview`, `POST /api/imports/rss/episode`, `GET /api/imports/:id`, `POST /api/imports/:id/retry`, `POST /api/imports/:id/cancel`.
  - DB-backed persistent queue (`QUEUED` → `PROCESSING` → `COMPLETED` / `FAILED` / `CANCELLED`) with atomic job claiming, duplicate active-job prevention, startup recovery, DNS-pinned SSRF protection (blocks localhost/loopback/private/link-local/metadata IPs, validates redirects, pins resolved IP on TCP socket to prevent DNS rebinding), safe XML parsing (`processEntities: false`), and optional `ffprobe` duration detection via `execFile`.
- **Notifications & Socket.IO**:
  - `/api/notifications`, `/api/notifications/:id/read`, `/api/notifications/read-all`.
  - JWT-authenticated Socket.IO rooms (`user:<id>` and `episode:<id>`) for live annotations, replies, clips, and notifications, plus graceful shutdown on `SIGTERM`/`SIGINT`.

### 3. Chrome Extension (`extension/`)
Manifest V3 extension ([manifest.json](file:///c:/Users/sumit/EchoSpace/extension/manifest.json)) with `activeTab`, `storage`, `scripting`:
- Signs in with your EchoSpace account, selects Study (`QUESTION`/`NOTE`) or Creator (`FEEDBACK`/`CORRECTION`/`SUGGESTION`) mode and workspace, captures accessible HTML5 `<audio>`/`<video>` timestamps, saves `EXTERNAL_LINK` recordings + annotations to the backend, and links directly to EchoSpace.

---

## How to Run Locally

```bash
# 1. Install dependencies
npm install
npm --prefix backend install

# 2. Configure environment variables
cp .env.example .env
cp backend/.env.example backend/.env
# Update DATABASE_URL and JWT_SECRET in backend/.env

# 3. Start PostgreSQL & sync schema (using Prisma local Postgres or your Postgres)
cd backend
npx prisma dev --name echospace
# In another terminal (from backend/):
npx prisma generate
npx prisma db push

# 4. Start backend & frontend
# Terminal 1 (from backend/): npm run dev
# Terminal 2 (from root):     npm run dev
```

## Production Deployment (Vercel + Render + S3)
- **Frontend (Vercel)**: [vercel.json](file:///c:/Users/sumit/EchoSpace/vercel.json) provides SPA routing rewrites. Set `VITE_API_URL` and `VITE_SOCKET_URL` to your Render backend URL (`https://...` / `wss://...`).
- **Backend & PostgreSQL (Render)**: [render.yaml](file:///c:/Users/sumit/EchoSpace/render.yaml) defines the Node web service (`npm start`, `npx prisma migrate deploy`, `/api/health`) and Render PostgreSQL. Set `CORS_ORIGIN`, `PUBLIC_BASE_URL`, and `S3_*` credentials in the Render dashboard.

## Running Tests & Builds
```bash
npm run build
node backend/tests/e2e.mjs
node backend/tests/audit.mjs
```
