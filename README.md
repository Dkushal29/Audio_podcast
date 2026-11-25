# EchoSpace

**Listen. Understand. Discuss. Create.**

EchoSpace is a full-stack audio collaboration platform built with a dual-mode architecture supporting **Study Mode** (for students, teachers, and study groups) and **Creator Mode** (for podcasters, interviewers, and audio production teams).

---

## What Has Been Achieved (Milestones 1 & 2)

### 1. Frontend Application (`src/`)
Built with **React 19**, **Vite**, **Tailwind CSS v4**, **React Router**, **Zustand**, **WaveSurfer.js**, **Axios**, and **Socket.IO Client** in a dark editorial interface (`#09090B` background, `#111114` surface, `#8B5CF6` & `#22D3EE` accents, `Inter` typography).

- **Public & Authentication Pages**:
  - **Landing Page (`/`)**: Hero section, interactive-style product preview, Study & Creator Mode introductions, core infrastructure highlights, Chrome extension preview, and footer.
  - **Auth Pages (`/login`, `/register`, `/forgot-password`)**: Client-side validated forms connected to `/api/auth/login` and `/api/auth/register` (with an optional offline demo fallback on the login page).
  - **Workspace Selection (`/workspaces`)**: Dual-mode workspace cards for **Study Mode** (*"Learn together."*) and **Creator Mode** (*"Create together."*).
- **Dual-Mode App & Audio Workspace (`/app/*`)**:
  - **Dashboard (`/app`)**, **Study Workspace (`/app/study`)**, and **Creator Workspace (`/app/creator`)**: Powered by a shared `modeConfig.js` architecture that adapts labels, annotation categories, status badges, and collections without duplicating views.
  - **Audio Workspace (`/app/recordings/:id`)**: Interactive **WaveSurfer.js** waveform rendered from real audio, clickable timeline markers, transport controls (play/pause, ±5s skip, 0.75x–2x speed, loop, mute), chapter timeline, inline annotation creation, status updates (`OPEN` / `RESOLVED`), threaded replies, highlight clip extraction modal, and live **Socket.IO** updates.
  - **Recordings (`/app/recordings`)**, **Discussions (`/app/discussions`)**, **Highlights (`/app/highlights`)**, **Playlists & Shows (`/app/playlists`)**, **Members (`/app/members`)**, and **Settings (`/app/settings`)**.
  - **Public Clip Sharing (`/clips/:id`)**: Dedicated clip page playing the exact `[startTime, endTime]` range from the source audio, displaying associated discussion threads, view count, share link copy, and a CTA to open the full recording.

### 2. Backend API, Database & Real-Time (`backend/`)
Built with **Node.js**, **Express.js**, **Prisma ORM**, **PostgreSQL**, **JWT**, **bcryptjs**, **Zod**, **Multer**, and **Socket.IO**.

- **PostgreSQL Schema (`backend/prisma/schema.prisma`)**:
  - UUID primary keys, foreign keys, unique constraints, indexes, and cascading deletes across 12 models: `User`, `Workspace`, `WorkspaceMember`, `Show`, `Episode`, `Annotation`, `AnnotationReply`, `Clip`, `Chapter`, `Playlist`, `PlaylistEpisode`, and `Bookmark`.
- **Authentication & Users**:
  - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/users/me`.
- **Workspaces & Role-Based Access Control**:
  - `POST /api/workspaces`, `GET /api/workspaces`, `GET /api/workspaces/:id`, `PATCH /api/workspaces/:id`, `POST /api/workspaces/:id/members`.
  - Backend-enforced roles: `OWNER`, `EDITOR`, `MEMBER`, `VIEWER`.
- **Audio Upload & HTTP Range Streaming**:
  - `POST /api/episodes/upload`, `GET /api/episodes/:id`, `GET /api/episodes/:id/audio`, `DELETE /api/episodes/:id`.
  - Validates both file extension and audio magic-byte signatures (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.flac`, `.webm`), enforces file size limits, stores via an S3/MinIO-compatible local storage abstraction (`backend/src/utils/storage.js`), and serves `206 Partial Content` HTTP Range requests for browser seeking.
- **Annotations, Replies & Socket.IO**:
  - `POST /api/episodes/:id/annotations`, `GET /api/episodes/:id/annotations`, `PATCH /api/annotations/:id`, `DELETE /api/annotations/:id`.
  - `POST /api/annotations/:id/replies`, `GET /api/annotations/:id/replies`.
  - Validates categories by workspace mode (`QUESTION`/`INSIGHT`/`REVISION` for `STUDY`; `FEEDBACK`/`CORRECTION`/`SUGGESTION` for `CREATOR`) and timestamps against episode duration.
  - Socket.IO episode rooms (`episode:join`, `episode:leave`) broadcasting `annotation:created`, `annotation:updated`, `annotation:deleted`, `reply:created`, and `clip:created` to authorized workspace members after PostgreSQL persistence.
- **Clips, Chapters, Playlists & RSS 2.0 Export**:
  - `POST /api/episodes/:id/clips`, `GET /api/episodes/:id/clips`, `GET /api/clips/:token`, `GET /api/clips/:token/audio` (no physical MP3 trimming; uses timestamp metadata and `PUBLIC`/`WORKSPACE` visibility).
  - Chapter CRUD (`/api/episodes/:id/chapters`, `/api/chapters/:id`).
  - Playlist CRUD & episode reordering (`/api/workspaces/:id/playlists`, `/api/playlists/:id/episodes`, `/api/playlists/:id/reorder`).
  - Valid RSS 2.0 XML podcast feed at `GET /api/shows/:id/feed.xml`.

### 3. Verification Status
- Frontend production build (`npm run build`) passes cleanly.
- End-to-end test suite (`backend/tests/e2e.mjs`) passes all 12 workflow steps against a live Express + PostgreSQL + Socket.IO stack (both Study Mode and Creator Mode).

---

## Project Structure

```text
EchoSpace/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/          # env.js, prisma.js
│   │   ├── middleware/      # auth.js, validate.js, workspaceAuth.js, errorHandler.js
│   │   ├── modules/         # auth, users, workspaces, episodes, annotations, replies, clips, chapters, playlists, rss
│   │   ├── sockets/         # Socket.IO server & episode room broadcasts
│   │   ├── utils/           # errors.js, storage.js
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   │   └── e2e.mjs
│   ├── .env.example
│   └── package.json
├── public/
│   └── audio/sample-recording.wav
├── src/
│   ├── components/          # audio, annotations, discussions, clips, dashboard, layout, workspace, common, ui
│   ├── config/              # modeConfig.js
│   ├── data/                # mockData.js (offline demo fallback)
│   ├── layouts/             # AppLayout.jsx
│   ├── pages/               # Landing, Auth, Workspaces, Dashboard, AudioWorkspace, ClipShare, Playlists, Members, Settings
│   ├── services/            # api.js (Axios), socket.js (Socket.IO)
│   ├── store/               # useEchoStore.js (Zustand)
│   ├── styles/              # index.css
│   ├── utils/               # time.js
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── PROJECT_STATUS.md
└── package.json
```

---

## How to Run Everything

### Prerequisites
- **Node.js** v18+ (tested with Node v24.15.0)
- **PostgreSQL** (either a local PostgreSQL instance, Docker, or Prisma's built-in local Postgres via `npx prisma dev`)

### 1. Install Dependencies
From the project root (`EchoSpace/`):
```bash
npm install
npm --prefix backend install
```

### 2. Configure Environment Variables
Create the frontend `.env` (optional if using default `http://localhost:8080`):
```bash
cp .env.example .env
```

Create `backend/.env` from `backend/.env.example`:
```bash
cp backend/.env.example backend/.env
```
Update `DATABASE_URL` and `JWT_SECRET` in `backend/.env`.

### 3. Start PostgreSQL & Sync the Database Schema
If you already have PostgreSQL running locally, set `DATABASE_URL` in `backend/.env` and push the schema:
```bash
cd backend
npx prisma generate
npx prisma db push
```

**Or use Prisma's built-in local PostgreSQL server (no Docker or local Postgres install needed):**
1. In a terminal inside `backend/`, start the local Postgres server:
   ```bash
   cd backend
   npx prisma dev --name echospace
   ```
2. Copy the printed `DATABASE_URL` into `backend/.env` (if using connection pooling, append `&pgbouncer=true`).
3. In another terminal, push the schema:
   ```bash
   cd backend
   npx prisma generate
   npx prisma db push
   ```

### 4. Start the Backend Server
From `backend/`:
```bash
npm run dev
```
The API and Socket.IO server will listen on `http://localhost:8080` (`GET /api/health` to verify).

### 5. Start the Frontend Dev Server
From the project root (`EchoSpace/`):
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Running the End-to-End Test Suite

With PostgreSQL and the backend server running (`http://localhost:8080`), run from the project root:
```bash
node backend/tests/e2e.mjs
```
This runs the full 12-step verification covering:
1. User registration & login for two users
2. Study workspace creation & member invitation
3. MP3 upload with magic-byte validation & HTTP `206` Range streaming
4. Mode-specific `QUESTION` annotation + Socket.IO `annotation:created` broadcast
5. Threaded reply from the second user & resolving the annotation
6. Revision clip creation, public clip metadata fetch, and clip audio Range streaming
7. Full Creator Mode workflow (`FEEDBACK` & `CORRECTION` annotations, chapters, playlists, and RSS 2.0 XML feed validation)
