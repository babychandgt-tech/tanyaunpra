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
- `lecturers` — data dosen (nidn, prodi, jabatan, expertise)
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

## API Routes (implemented)

### Auth (`/api/auth/`)
- `POST /auth/login` — login semua role
- `POST /auth/register` — registrasi mahasiswa/dosen
- `GET /auth/me` — profil user (requires JWT)
- `POST /auth/api-keys` — generate API key (admin only)
- `GET /auth/api-keys` — list API keys (admin only)
- `DELETE /auth/api-keys/:id` — revoke API key (admin only)

### Health
- `GET /healthz` — health check

## Pending Tasks

- Task #2: AI/NLP Chat Engine (Qwen Dashscope)
- Task #3: CRUD API endpoints data akademik
- Task #4: Admin Dashboard web (React)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
