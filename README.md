# Kairo API

Kairo is a job search companion: track applications, get prepared, and act on the right opportunity in time.
This repository is the API. The web app lives in `kairo-web`.

> **Status:** v0.4 Contacts. Accounts; every job posting tracked through its stages, with its history, the next
> follow-up, a comparison with the user's criteria and a warning about possible duplicates; tasks, optionally linked
> to a job; and contacts, linked to any number of jobs, with a log of conversations and a next follow-up. `GET /today`
> returns the open tasks and the follow-ups of jobs and contacts, for the user's Today screen.
> The product idea, modules and roadmap are in [`docs/IDEA.md`](docs/IDEA.md).

## Stack

- [NestJS 12](https://docs.nestjs.com) (ESM, Vitest, oxlint) on Node.js 22+
- PostgreSQL 18 in Docker, through [TypeORM 1.x](https://typeorm.io) with reviewed migrations
- [zod 4](https://zod.dev) for request validation, environment variables and the OpenAPI schemas
- [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication) (cookie sessions) and
  [`@nestjs/authorization`](https://docs.nestjs.com/security/authorization) (policies, deny by default)

Every choice and its alternatives are recorded in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Requirements

- Node.js 22 or later
- pnpm 10 or later (the only package manager this project uses)
- Docker, for PostgreSQL

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm migration:run
pnpm start:dev
```

- **Ports.** PostgreSQL is published on `DB_PORT` (5432 by default). If another project already uses it, set
  `DB_PORT` in `.env` to a free port and use the same port in `DATABASE_URL` and `TEST_DATABASE_URL`.
- **The API** listens on `http://localhost:4000`. Swagger UI is at
  [`/docs`](http://localhost:4000/docs), and the OpenAPI document at `/docs/openapi.json`.
- **The first account** becomes the admin. Until it exists, `GET /auth/setup` answers `{ "needsSetup": true }`, and
  `POST /auth/setup` creates it and signs it in:

  ```bash
  curl -X POST http://localhost:4000/auth/setup \
    -H 'Content-Type: application/json' \
    -d '{"name": "Ada Lovelace", "email": "ada@example.com", "password": "choose one"}'
  ```

  After that, the endpoint is closed for good, and only the admin creates accounts.

## Editor

`kairo.code-workspace` opens `kairo-api` and `kairo-web` together in VS Code or an editor built on it, such as
Antigravity, with both repositories cloned side by side. Its tasks (**Terminal → Run Task…**) start the database, the
API and the web app, run the tests and regenerate the web app's API types. **Kairo: start all** starts everything.

## Accounts and security

- **Sessions** live in PostgreSQL and travel in an `HttpOnly` cookie, `__Host-sid`. They last 14 days, or end after
  3 days without use.
- **Every route requires a session** unless it is explicitly public, and **every route declares who may call it**.
  A route without a declaration is denied.
- **The admin manages accounts** (`/admin/users`): creates them with a temporary password shown once, changes roles,
  deactivates and reactivates them, and resets forgotten passwords. The admin never sees what users keep in the app.
- **A temporary password must be changed** at the first sign-in. Until then, every route but `GET /auth/me`,
  `POST /auth/password` and `POST /auth/sign-out` answers 403 with `error: "password_change_required"`.
- **Browsers** may call the API only from `WEB_ORIGIN` (kairo-web, `http://localhost:3000` by default): CORS allows
  that origin alone, and state-changing requests from any other site are refused.

## Scripts

| Script | What it does |
|---|---|
| `pnpm start:dev` | Runs the API and restarts it on changes |
| `pnpm build` | Compiles to `dist/` |
| `pnpm lint` | oxlint, with type-aware rules |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | End-to-end tests against the `kairo_test` database (see below) |
| `pnpm db:up` / `pnpm db:down` | Starts or stops the PostgreSQL container |
| `pnpm migration:generate src/database/migrations/Name` | Generates a migration from the entity changes |
| `pnpm migration:run` / `pnpm migration:revert` | Applies the pending migrations, or reverts the last one |
| `pnpm migration:check` | Fails when the entities and the migrations disagree |

## Tests

```bash
pnpm test
pnpm test:e2e
```

End-to-end tests boot the real application against `kairo_test`, a second database in the same container. They
build the app and migrate that database first, and empty it before each test, so the database must be up
(`pnpm db:up`). The tests refuse any database whose name does not end in `_test`, so development data is never
touched.

`kairo_test` is created the first time the container starts with an empty volume. On a volume created before that,
create it once:

```bash
docker exec kairo-db createdb -U kairo -O kairo kairo_test
```

## Project layout

```
src/
  auth/        sign-in, sessions and the password-change rule
  users/       the User entity and the admin's account management
  jobs/        job postings, their stages and history, the criteria and duplicate detection
  tasks/       the user's tasks, optionally linked to a job
  contacts/    the user's contacts, their links to jobs and the conversation log
  today/       GET /today: open and recently done tasks, and the follow-ups of jobs and contacts
  config/      environment variables, validated at startup
  database/    TypeORM options, naming strategy and migrations
test/          end-to-end tests and their helpers
docs/          product idea, decisions and designs
```

## License

Copyright (c) 2026 Raymundo Sanchez. All rights reserved. The code is public to read, but it is not licensed
for reuse, copying or distribution.
