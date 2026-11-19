# Technical decisions

One entry per decision: the context, the options considered, what was chosen and why, and what it costs.
Entries are never rewritten; a decision that changes gets a new entry that supersedes the old one.

---

## 001. Stack: PostgreSQL, NestJS, Next.js

- **Date:** 2026-11-18
- **Status:** Accepted

**Context.** Kairo needs relational data (users → jobs → contacts → messages), a long-running backend for
scheduled jobs (the Radar), and a web UI. It is also a portfolio piece for fullstack TypeScript roles.

**Options.**
- PostgreSQL vs. SQLite. SQLite needs no server, but Postgres offers real constraints, `jsonb` for AI output
  whose shape evolves, and `pg_trgm` for fuzzy duplicate detection.
- NestJS vs. Next.js alone (Route Handlers, Server Actions). Next alone is enough for a small app, but keeps
  backend logic inside the frontend framework and is a poor fit for scheduled jobs.
- Next.js vs. React with Vite. Vite is simpler for a private dashboard; Next is what fullstack roles ask for.

**Decision.** PostgreSQL, NestJS for the API, Next.js for the UI.

**Consequences.**
- Two applications to run and, later, to deploy.
- Next.js is UI only: all business logic and data access live in the API. No Server Actions or Route Handlers
  that touch the database.
- Database rules (constraints, foreign keys, checks) are enforced in Postgres, not only in application code.

---

## 002. Repository visibility: private until v0.2

- **Date:** 2026-11-18
- **Status:** Accepted

**Context.** v0.1 only ships accounts and login; the first version worth showing is v0.2 (accounts and jobs).

**Options.** Public from the first commit, so the whole process is visible; or private until there is something
usable to show.

**Decision.** Private until v0.2 ships, then public. The full commit history stays when visibility changes.

**Consequences.** Security does not depend on the code being private: secrets live in `.env`, which is never
committed.

---

## 003. Separate repositories for the API and the web app

- **Date:** 2026-11-18
- **Status:** Accepted

**Context.** The API and the web app could live in one monorepo (pnpm workspaces with a shared package) or in
separate repositories.

**Options.**
- Monorepo: shared types and schemas through a workspace package, one change and one commit across both sides.
- Separate repositories: independent history, CI and deployment for each side, clear boundaries.
- With separate repositories, product-wide docs either live in a third "hub" repo or in the API repo. A hub is a
  neutral home for docs, but it is one more repo to maintain and every session in a code repo has to read files
  from outside it.

**Decision.** Separate repositories, always, and only two:

| Repo | Contents |
|---|---|
| `kairo-api` | NestJS API, PostgreSQL (Docker Compose for local development), migrations, and the product-wide docs (`docs/IDEA.md`, `docs/DECISIONS.md`) |
| `kairo-web` | Next.js web app. Its README links to the docs in `kairo-api` |

The two are cloned side by side under the same parent folder.

**Consequences.**
- Types cannot be imported across repos. The API publishes an OpenAPI spec and the web app generates its types
  from it (for example with `openapi-typescript`). This shapes the validation decision.
- A change that touches both sides takes two coordinated commits: API first, then regenerate types in the web app.
- Each repo has its own CI and its own `dev` command.

---

## 004. ORM: TypeORM 1.x

- **Date:** 2026-11-18
- **Status:** Accepted

**Context.** The API needs an ORM for PostgreSQL that works well with NestJS, keeps database rules in Postgres
(decision 001), and makes it easy to scope every query to its user.

**Options.**
- **TypeORM 1.x.** Official NestJS integration (`@nestjs/typeorm`), entities as decorated classes, generated
  migrations, already well known to the author. Weak point: query result types do not reflect partial selects or
  loaded relations.
- **Prisma.** Excellent types and developer experience, very common in TypeScript job postings. `CHECK`
  constraints and `pg_trgm` indexes cannot be declared in the schema, and at decision time its `latest` npm tag
  pointed to a release candidate, so its stable line was unclear.
- **Drizzle.** Schema in TypeScript, strong inferred types, close to SQL, `CHECK` and `pg_trgm` indexes in the
  schema. No official NestJS integration, and still 0.x with 1.0 in beta.

**Decision.** TypeORM 1.x. It is the NestJS standard, it is actively maintained (1.0 shipped in May 2026 with
frequent releases since), and the author knows it well enough to explain every line.

**Consequences.**
- Read the v1.0 release notes and upgrade guide before writing code: most examples online are still for 0.3.
- `synchronize` is always off. Every schema change is a reviewed migration.
- Indexes, foreign keys and checks get explicit names in the entities, so generated migrations match the
  entities and a dry run of `migration:generate` reports no changes.
- Controllers never return entities directly; services map them to response DTOs. This covers the weak query
  types and keeps internal columns out of the API.
- Every user-owned table has a non-null `user_id` foreign key, and every query on it filters by the current user.
  The exact mechanism is designed in v0.1, with tests that prove one user cannot read another user's rows.

---

## 005. Validation: class-validator at the API boundary, zod for external data

- **Date:** 2026-11-18
- **Status:** Accepted

**Context.** With separate repositories (decision 003), schemas cannot be shared as code between the API and the
web app; the contract between them is the OpenAPI spec the API publishes. Separately, some data comes from
sources Kairo does not control: the model's replies (v0.6) and public job feeds (v0.8).

**Options.**
- **class-validator + `@nestjs/swagger` for request DTOs, zod for external data.** The NestJS standard; the
  OpenAPI spec is generated from the DTOs. Two validation tools, each with its own boundary.
- **zod everywhere through `nestjs-zod`.** One schema language. At decision time `nestjs-zod` 5.6.0 only declared
  support for NestJS 10 and 11, so it would mean staying off NestJS 12 or forcing peer dependencies.
- **zod everywhere with a hand-written pipe.** No extra dependency, but no generated OpenAPI spec, which the web
  app needs for its types.

**Decision.** class-validator for everything that enters through the HTTP API, zod for external data at the moment
it is read. The web app generates its types from `openapi.json` with `openapi-typescript`.

**Consequences.**
- The global `ValidationPipe` runs with `whitelist: true` and `forbidNonWhitelisted: true`: an unknown field is
  rejected with a 400 that names it, never silently dropped.
- The `@nestjs/swagger` CLI plugin infers schema metadata from TypeScript types, to keep decorators to a minimum.
- A decorator can still disagree with its TypeScript type (`@IsString()` on a `number`); tests on each endpoint
  catch it.
- `class-transformer` has had no release since 2022. It is stable and still used in the NestJS docs, but it is a
  dependency to watch.
- A change to a DTO means regenerating the types in `kairo-web` (see decision 003).
