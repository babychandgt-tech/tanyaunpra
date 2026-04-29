# Workspace — Sistem Informasi Akademik Tanya UNPRA

## Overview

Web backend sistem informasi akademik berbasis AI untuk Universitas UNPRA. Menyediakan REST API untuk aplikasi Android dan web admin dashboard.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Supabase (PostgreSQL) + Drizzle ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Architecture

```
Aplikasi Android  ←→  Backend API Server  ←→  Supabase PostgreSQL
                              ↑
                    Web Admin Dashboard (React)
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes to Supabase
- `pnpm --filter @workspace/scripts run seed-admin` — seed akun admin awal

## Database Schema (Supabase)

Tables:
- `users` — akun semua role (mahasiswa, dosen, admin)
- `students` — data mahasiswa (nim, prodi, fakultas, semester, angkatan)
- `lecturers` — data dosen (nidn, prodi, jabatan, phone/WA, expertise, photoUrl)
- `courses` — mata kuliah (kode, nama, sks, semester, prodi)
- `schedules` — jadwal kuliah (hari, jam, ruangan, semester)
- `academic_calendar` — kalender akademik (UTS, UAS, Libur, dll)
- `announcements` — pengumuman kampus
- `intents` — training data AI (pertanyaan + jawaban FAQ)
- `chat_sessions` — sesi percakapan dari Android
- `chat_messages` — pesan individual per sesi
- `api_keys` — API key untuk autentikasi Android app

## RBAC Roles

- **admin** — akses penuh ke semua fitur
- **dosen** — kelola jadwal, pengumuman, lihat mahasiswa
- **mahasiswa** — read-only untuk data akademik

## Auth

- JWT Bearer token (access token 1 hari, refresh token 30 hari) untuk web/admin dashboard
- API Key (`X-API-Key` header) untuk Android app
- Akun admin awal dibuat via `pnpm --filter @workspace/scripts run seed-admin`
  (kredensial di-generate oleh script dan ditampilkan di console satu kali)

## Environment Variables / Secrets Required

- `SUPABASE_DATABASE_URL` — Supabase PostgreSQL connection string
- `JWT_SECRET` — secret key untuk JWT signing
- `DASHSCOPE_API_KEY` — Alibaba Dashscope API key untuk Qwen AI (task #2)

## AI Chat Engine

- **Qwen AI via Dashscope** (OpenAI-compatible endpoint): `qwen-turbo` model
- **Hybrid matching**: intent DB lookup dulu (containment + keyword + tag, threshold 0.45), fallback ke Qwen + DB context
- **System prompt**: dikonfigurasi sebagai "Tanya UNPRA" dengan **aturan mutlak anti-halusinasi** — dilarang mengarang nama orang/NIDN/NIM/jabatan/matkul. Jika data tidak ada di DB context, AI wajib jawab "informasi belum tersedia di sistem".
- **Low confidence threshold**: < 0.4 → `needsReview: true`
- Qwen service: `artifacts/api-server/src/lib/qwen.ts`
- Intent matcher: `artifacts/api-server/src/lib/intentMatcher.ts`
- Context retriever: `artifacts/api-server/src/lib/contextRetriever.ts`
  - Topic detection berdasarkan keyword: `jadwal`, `pengumuman`, `kalender`, `matkul`, `dosen`, `mahasiswa`, `prodi`.
  - Topik **dosen** mendeteksi jabatan spesifik di pertanyaan (`kaprodi`, `dekan`, `wakil dekan`, `rektor`, `wakil rektor`, `kasubag`, `ketua penelitian`) — `rektor` & `dekan` di-exclude `wakil` agar tidak salah label.
  - Topik **dosen/matkul** juga mendeteksi nama prodi (Informatika, SI, dll.) & fakultas dari pertanyaan untuk filter SQL — hasil di-narrow agar AI tidak bingung memilih.
  - Topik **prodi** menarik struktur lengkap fakultas+prodi dari tabel `fakultas`/`prodi`.
  - Jika filter spesifik gagal cocok di DB → injeksi instruksi eksplisit ke context: "Jangan mengarang…sampaikan belum tersedia."
  - Jadwal di-filter `prodi+semester+kelas` user, sesuai profil mahasiswa yang login.

## API Routes (implemented)

### Auth (`/api/auth/`)
- `POST /auth/login` — login semua role
- `POST /auth/register` — registrasi mahasiswa/dosen
- `POST /auth/refresh` — refresh access token
- `GET /auth/me` — profil user (requires JWT)
- `POST /auth/api-keys` — generate API key (admin only)
- `GET /auth/api-keys` — list API keys (admin only)
- `DELETE /auth/api-keys/:id` — revoke API key (admin only)

### Chat (`/api/chat/`) — Android: API key auth; Admin: JWT auth
- `POST /chat/ask` — kirim pertanyaan (X-API-Key)
- `GET /chat/sessions` — list sesi percakapan (admin only)
- `GET /chat/sessions/:id` — detail sesi + semua pesan (admin only)
- `PATCH /chat/messages/:id/flag` — tandai untuk review (admin only)
- `GET /chat/stats` — statistik hari ini/minggu (admin only)

### Intents (`/api/intents/`) — JWT auth
- `GET /intents` — list dengan filter (admin & dosen)
- `POST /intents` — tambah intent baru (admin only)
- `GET /intents/:id` — detail intent (admin & dosen)
- `PUT /intents/:id` — update intent (admin only)
- `DELETE /intents/:id` — hapus intent (admin only)

### Courses (`/api/courses/`) — JWT auth
- `GET /courses` — list dengan filter prodi/fakultas/semester/search (semua role)
- `POST /courses` — tambah mata kuliah (admin & dosen)
- `GET /courses/:id` — detail mata kuliah (semua role)
- `PUT /courses/:id` — update mata kuliah (admin & dosen)
- `DELETE /courses/:id` — hapus mata kuliah (admin only)

### Schedules (`/api/schedules/`) — JWT auth
- `GET /schedules` — list dengan filter prodi/fakultas/semester/hari/lecturerId (semua role). Response Schedule juga membawa `courseProdi` untuk auto-fill form edit.
- `GET /schedules/today` — jadwal hari ini untuk mahasiswa login (auto-detect hari, prodi, semester, TA aktif). Response sudah di-sort by jamMulai.
- `POST /schedules` — tambah jadwal (admin & dosen). Validasi: `semester` wajib `"1"`–`"8"`, `tahunAjaran` format `YYYY/YYYY`.
- `GET /schedules/:id` — detail jadwal (semua role)
- `PUT /schedules/:id` — update jadwal (admin & dosen)
- `DELETE /schedules/:id` — hapus jadwal (admin & dosen)

### Lecturers (`/api/lecturers/`) — JWT auth
- `GET /lecturers` — list dengan filter prodi/fakultas/search (semua role)
- `GET /lecturers/:id` — detail dosen (semua role)
- `PUT /lecturers/:id` — update dosen (dosen edit sendiri, admin edit semua)
- `DELETE /lecturers/:id` — hapus dosen (admin only)

### Students (`/api/students/`) — JWT auth
- `GET /students` — list mahasiswa dengan filter (admin & dosen)
- `GET /students/me` — profil mahasiswa yang sedang login (mahasiswa only)
- `PUT /students/me` — update phone & address sendiri (mahasiswa only)
- `GET /students/:id` — detail mahasiswa (admin & dosen)
- `PUT /students/:id` — update mahasiswa (admin only)
- `DELETE /students/:id` — hapus mahasiswa (admin only)

### Announcements (`/api/announcements/`) — JWT auth
- `GET /announcements` — list dengan filter kategori/isActive/search (semua role)
- `POST /announcements` — buat pengumuman (admin & dosen)
- `GET /announcements/:id` — detail pengumuman (semua role)
- `PUT /announcements/:id` — update (admin edit semua, dosen edit milik sendiri)
- `DELETE /announcements/:id` — hapus (admin edit semua, dosen hapus milik sendiri)

### Academic Calendar (`/api/academic-calendar/`) — JWT auth
- `GET /academic-calendar` — list dengan filter tahunAjaran/tipe/from/to (semua role)
- `GET /academic-calendar/active` — TA & semester aktif berdasarkan tanggal server (Aug–Jan = Ganjil, Feb–Jul = Genap)
- `POST /academic-calendar` — tambah event (admin only)
- `GET /academic-calendar/:id` — detail event (semua role)
- `PUT /academic-calendar/:id` — update event (admin only)
- `DELETE /academic-calendar/:id` — hapus event (admin only)

### Dashboard (`/api/dashboard/`) — JWT auth (admin only)
- `GET /dashboard/summary` — statistik mahasiswa/dosen/matkul/pengumuman + upcoming events
- `GET /dashboard/activity` — aktivitas terbaru: pesan chat, user baru, pesan butuh review

### Health
- `GET /healthz` — health check

## Admin Dashboard (React + Vite)

Artifact: `artifacts/tanya-unpra-dashboard/` — served at `/` (port assigned dynamically)

### Dashboard Pages
- `/login` — form login email/password untuk semua role
- `/dashboard` — stats cards, recent announcements, upcoming calendar events, chat activity
- `/chat-logs` — tabel sesi percakapan Android dengan pagination, detail view + flag/unflag messages
- `/intents` — CRUD knowledge base FAQ AI (admin only)
- `/jadwal` — CRUD jadwal kuliah dengan filter prodi/semester
- `/kalender` — CRUD kalender akademik (UTS, UAS, Libur, dll)
- `/pengumuman` — CRUD pengumuman kampus, toggle aktif/nonaktif
- `/mahasiswa` — tabel mahasiswa dengan search, detail view (admin & dosen)
- `/dosen` — tabel dosen dengan detail view (admin only)
- `/matkul` — CRUD mata kuliah dengan search (admin & dosen)
- `/settings/api-keys` — generate & revoke API keys Android (admin only)
- `/users` — daftar user sistem (admin only)

### Frontend Stack
- React + Vite, Tailwind CSS, shadcn/ui components
- Wouter (routing), TanStack Query, react-hook-form + zod
- Generated API hooks from `@workspace/api-client-react`
- JWT stored in localStorage; `setAuthTokenGetter` injects token to all API calls
- Role-based sidebar: admin=all pages, dosen=jadwal/mahasiswa/pengumuman, mahasiswa=dashboard only

### Key Files
- `artifacts/tanya-unpra-dashboard/src/App.tsx` — routes + auth guards
- `artifacts/tanya-unpra-dashboard/src/hooks/use-auth.tsx` — AuthContext with JWT logic
- `artifacts/tanya-unpra-dashboard/src/pages/` — all page components
- `artifacts/tanya-unpra-dashboard/src/components/layout/` — MainLayout + Sidebar

## Pending Tasks

None (all 4 tasks complete).

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
