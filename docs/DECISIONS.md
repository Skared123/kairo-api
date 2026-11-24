# Technical decisions

One entry per decision: the context, the options considered, what was chosen and why, and what it costs.
Entries are never rewritten; a decision that changes gets a new entry that supersedes the old one, and only the
old entry's status line changes to point at its replacement.

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
- **Status:** Superseded by 007.

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

---

## 006. Authentication: JWT access token with rotating refresh tokens, Argon2id passwords, role guards

- **Date:** 2026-11-18
- **Status:** Superseded by 008.

**Context.** v0.1 needs login, two roles (`admin` manages accounts, `user` uses the app) and accounts the admin
can deactivate. Kairo runs locally for now, but it is also a portfolio piece for roles where JWT, token storage,
revocation and RBAC come up in interviews.

**Options.**
- **Server-side sessions in Postgres** (random token in an `httpOnly` cookie, hashed in a `sessions` table).
  Simplest, with real logout and instant deactivation. Less common as a keyword in job postings.
- **JWT access token plus rotating refresh tokens.** The most common pattern in Node and NestJS roles. More moving
  parts: rotation, reuse detection, and an extra check so deactivation does not wait for the access token to expire.
- **Better Auth.** A complete library with roles and an admin plugin, but it owns its tables outside the TypeORM
  migrations and its NestJS integration is community-maintained.
- **Password hashing:** Argon2id (`argon2`), scrypt (`node:crypto`, no dependency), bcrypt (older, 72-byte limit).

**Decision.** JWT access token with rotating refresh tokens, using `@nestjs/passport` and `@nestjs/jwt`.
Passwords hashed with Argon2id.

- **Access token:** a JWT signed with a secret from `.env`, valid for 15 minutes, sent in an `httpOnly` cookie.
  Never stored in `localStorage` or readable by JavaScript.
- **Refresh token:** an opaque random value (not a JWT), valid for 30 days, in an `httpOnly` cookie scoped to the
  refresh endpoint. Only its SHA-256 hash is stored, in a `refresh_tokens` table with `user_id` and expiry. A fast
  hash is enough because the token is random and long, unlike a password.
- **Rotation and reuse detection:** every refresh issues a new refresh token and invalidates the old one. If an
  already used token comes back, every refresh token of that user is revoked.
- **Logout and deactivation** delete the user's refresh tokens. The access token check also confirms the account
  is still active, so deactivation takes effect on the next request instead of up to 15 minutes later.
- **Passwords:** Argon2id with at least OWASP's minimum parameters (`m=19456` KiB, `t=2`, `p=1`). Only the encoded
  hash (algorithm, parameters, salt, hash) is stored; passwords are never encrypted or recoverable.
- **Roles:** a `role` column (`admin` or `user`). A global auth guard protects every route except those marked
  `@Public()`. `@Roles('admin')` with a `RolesGuard` protects account management routes. Admins get no bypass in
  data queries: they only see their own data, like any user.

**Consequences.**
- New dependencies, each explained when installed: `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/jwt`,
  `cookie-parser`, `argon2`. `argon2` is native and may need `pnpm approve-builds`.
- Cookies are `SameSite=Lax`, the API only accepts JSON, and CORS allows only the web app's origin with
  credentials. Together they cover CSRF for this setup.
- JWT secrets live in `.env` and the API refuses to start if they are missing.
- Login rate limiting (`@nestjs/throttler`) is deferred because Kairo runs locally. It must be added before any
  deployment.

---

## 007. Validation: zod everywhere through Nest's Standard Schema pipe

- **Date:** 2026-11-19
- **Status:** Accepted. Supersedes 005.

**Context.** Decision 005 assumed zod at the API boundary needed `nestjs-zod`, which does not support NestJS 12.
The NestJS 12 docs show otherwise: `StandardSchemaValidationPipe` validates any Standard Schema library, zod
included, through `@Body({ schema })`, `@Query({ schema })` and `@Param('id', { schema })`, and `@nestjs/swagger`
turns those schemas into the OpenAPI document with no configuration for zod 4.2 or later. Decision 005 was made
from npm metadata without reading the NestJS 12 docs.

**Options.**
- **zod everywhere with `StandardSchemaValidationPipe`.** One schema per shape: validation, the TypeScript type and
  the OpenAPI schema come from it. The same library validates external data.
- **Keep decision 005.** class-validator for request DTOs, zod for external data. Two validation tools and two
  extra dependencies (`class-validator`, `class-transformer`).

**Decision.** zod everywhere. The global `StandardSchemaValidationPipe` validates every request; model replies and
job feeds are parsed with zod when they are read.

**Consequences.**
- Request objects use `z.strictObject()`, so an unknown field is rejected instead of silently dropped (plain
  `z.object()` strips unknown keys).
- Types come from the schemas (`z.infer`); there are no DTO classes.
- `class-validator`, `class-transformer` and `nestjs-zod` are not used. Variants of a schema use zod (`.partial()`,
  `.pick()`) instead of `@nestjs/swagger` mapped types.
- The web app still generates its types from `openapi.json` with `openapi-typescript` (decision 003).
- Only zod is used, so no Standard Schema vendor detection or custom converter is needed.

---

## 008. Authentication: NestJS authentication module with server-side sessions

- **Date:** 2026-11-19
- **Status:** Accepted. Supersedes 006.

**Context.** Decision 006 designed a custom JWT setup on Passport before checking the NestJS 12 docs. NestJS 12
ships first-party `@nestjs/authentication` and `@nestjs/authorization`. The authentication module offers
server-side sessions in an `httpOnly` cookie, and JWT bearer tokens returned in JSON and sent in the
`Authorization` header. It is storage-agnostic: the app implements its store interfaces, and the docs include a
TypeORM implementation and a contract test suite. Both packages are at 0.1.x.

**Options.**
- **Official module, session mode.** The NestJS 12 standard for browser apps: `httpOnly` cookie, hashed session
  tokens, CSRF helper, instant revocation. Google sign-in (OpenID Connect), password reset and email verification
  are built in. Passwords use scrypt. Pre-1.0.
- **Official module, JWT mode.** Meant for API clients. In a browser, JavaScript would have to hold the access and
  refresh tokens, which exposes them to XSS.
- **Custom JWT in `httpOnly` cookies** (decision 006). Full control, but all the security code is ours while the
  framework's standard goes another way.

**Decision.** Official module in session mode, with `@nestjs/authorization` for permissions.

- **Sessions:** the `__Host-sid` cookie (`HttpOnly`, `Secure`, `SameSite=Lax`). Only the SHA-256 hash of the session
  token is stored, with absolute and idle lifetimes.
- **Storage:** a `TypeOrmAuthenticationStore` implementing the module's store interfaces, with its entities and
  migrations, verified with the package's contract test suite against PostgreSQL.
- **Users and roles are ours:** a `users` table with `role` (`admin` or `user`) and an active flag. Deactivating an
  account revokes its sessions.
- **Passwords:** the module's `PasswordHasher` (scrypt with OWASP parameters, `needsRehash()` for upgrades).
- **CSRF and origins:** the web app's origin goes in `session.trustedOrigins`, and the API calls
  `app.enableCsrfProtection()`.
- **Permissions:** policy classes enforced with `@Can()`. No `before()` bypass for admins: they manage accounts and
  see only their own data. Filtering every query by the current user stays our responsibility, with tests that
  prove one user cannot read another user's rows.

**Consequences.**
- New dependencies: `@nestjs/authentication` and `@nestjs/authorization`. Both are pinned to exact versions while
  they are 0.x, and their changelogs are read before every upgrade.
- The module's tables store `user_id` as text with no foreign key, so revoking sessions on deactivation or
  deletion is done explicitly in code.
- The session cookie is `Secure`. Whether browsers accept it on `http://localhost` is checked when the skeleton is
  built; if not, local development runs over HTTPS.
- Passport, `@nestjs/jwt` and `argon2` are not used. Argon2id is dropped in favor of the module's scrypt.
- Login rate limiting (`@nestjs/throttler`) is still deferred and must be added before any deployment.

---

## 009. Database naming: snake_case through a custom naming strategy

- **Date:** 2026-11-19
- **Status:** Accepted

**Context.** TypeORM 1.x names tables in snake_case but keeps columns as the property name (`createdAt`), which
PostgreSQL then needs quoted in every hand-written query. Constraint and index names are deterministic hashes.

**Options.** A naming strategy that extends `DefaultNamingStrategy` and snake-cases columns; an explicit
`name: 'created_at'` on every column; or camelCase columns.

**Decision.** A small `SnakeNamingStrategy` of our own, about 15 lines, with no dependency.

**Consequences.** Columns follow the PostgreSQL convention without per-column names, and a forgotten `name:` can no
longer leave a camelCase column behind. Decision 004 still applies: constraints and indexes we reference get
explicit, readable names.

---

## 010. First admin: a setup endpoint guarded by an advisory lock

- **Date:** 2026-11-19
- **Status:** Accepted

**Context.** `docs/IDEA.md` says the first account becomes admin. Two requests arriving at the same time must not
both create one.

**Options.** `POST /auth/setup`, open only while there are no users; or a terminal command (`pnpm create-admin`)
with no public endpoint, which gives someone who clones the repo no first-run screen.

**Decision.** `POST /auth/setup`. It takes `pg_advisory_xact_lock` inside a transaction, counts users, and creates
the admin only if there are none. A concurrent second request waits for the lock, finds a user and is rejected.

**Consequences.** Once any user exists, the endpoint is closed for good. `GET /auth/setup` tells the web app
whether to show the first-run screen.

---

## 011. Forced password change for accounts created by an admin

- **Date:** 2026-11-19
- **Status:** Superseded by 016

**Context.** The admin creates accounts with a temporary password. If it stayed valid, the admin could sign in as
that user and read their data, which breaks the rule that admins cannot see other users' data.

**Options.** Force a change on first sign-in, or trust the admin.

**Decision.** Accounts created by an admin start with `must_change_password = true`. Until the user changes it,
every route except `POST /auth/password` and `POST /auth/sign-out` returns 403.

**Consequences.** The admin rule holds in practice, not only in queries. The first admin, created through setup,
chooses their own password and starts with the flag off.

---

## 012. Password length: 15 to 128 characters, no composition rules

- **Date:** 2026-11-19
- **Status:** Superseded by 015

**Context.** Passwords are the only factor in v0.1.

**Options.** 15 characters, what NIST SP 800-63B asks for single-factor passwords; or 12, easier but below it.

**Decision.** 15 minimum, 128 maximum, no rules about uppercase letters, digits or symbols, following NIST.

**Consequences.** The maximum bounds the work scrypt does per request.

---

## 013. End-to-end tests run against a `kairo_test` database in the same container

- **Date:** 2026-11-19
- **Status:** Accepted

**Context.** Authentication and user isolation have to be tested against a real PostgreSQL, not mocks.

**Options.** A second database in the existing container; or Testcontainers, a fresh PostgreSQL per run, more
isolated but one more dependency and slower.

**Decision.** A `kairo_test` database in the `kairo-db` container, created by an init script, migrated before the
end-to-end suite runs and cleaned between tests.

**Consequences.** `pnpm db:up` is needed before `pnpm test:e2e`. Development data in `kairo` is never touched by tests.

---

## 014. Sessions last 14 days, or 3 days without use

- **Date:** 2026-11-19
- **Status:** Accepted

**Context.** `@nestjs/authentication` ends a session at an absolute lifetime, however active, and earlier after an
idle timeout. Its defaults are 7 days and 1 day. Kairo is a tool used almost every day on a personal machine.

**Options.** The defaults (7d / 1d: signed out after a single day off); 14d / 3d, the example in the official docs;
or 30d / 7d, fewer sign-ins but a stolen cookie stays useful for longer.

**Decision.** `absoluteTtl: '14d'` and `idleTtl: '3d'`.

**Consequences.** One sign-in every two weeks in daily use. Revisit before any public deployment. kairo-web's origin
comes from a new `WEB_ORIGIN` variable (default `http://localhost:3000`), shared by CORS, `enableCsrfProtection()` and
`session.trustedOrigins` through `src/app.setup.ts`.

---

## 015. Any password up to 128 characters, no minimum length

- **Date:** 2026-11-19
- **Status:** Accepted (supersedes 012)

**Context.** Decision 012 asked for 15 characters. For a personal tool that is a chore, and the author wants short
passwords such as `abc123` to work, now and after deployment.

**Options.** No minimum; a light minimum of 6; or keep 15 and bind the API to `127.0.0.1` only.

**Decision.** No minimum length and no composition rules: any non-empty password of up to 128 characters. Each
account owner chooses how strong their own password is.

**Consequences.** The maximum still bounds the work scrypt does per request, and hashing is unchanged. A short password
is easy to guess, so the sign-in throttler planned before deployment (decision 008) is what limits guessing.

---

## 016. Forced password change: a global guard, with `GET /auth/me` allowed

- **Date:** 2026-11-19
- **Status:** Accepted (supersedes 011)

**Context.** Decision 011 stands: the admin creates accounts with a temporary password, and if it stayed valid the
admin could sign in as that user and read their data. Two things were open: where the rule lives, and which routes
stay reachable. With only `POST /auth/password` and `POST /auth/sign-out`, a web app reloaded on the change-password
screen cannot even read who is signed in.

**Options.** For the rule: a global guard of our own; a check in every `@nestjs/authorization` policy, repeated in each
module and easy to forget; or the library's `mfa: 'pending'` session state, which exists for a second factor. For the
routes: 011's two, or those two plus `GET /auth/me`, which only reads the caller's own profile.

**Decision.** Accounts created by an admin start with `must_change_password = true`. A global `PasswordChangeGuard`,
after the authentication guard, answers 403 with `error: 'password_change_required'` while the flag is true, on every
route except those marked `@AllowPendingPasswordChange()`: `POST /auth/password`, `POST /auth/sign-out` and
`GET /auth/me`.

**Consequences.** The rule lives in one place and closes new routes by default. The first admin, created through
setup, chooses their own password and starts with the flag off. Changing the password clears the flag, rotates the
current session and ends the account's other sessions.

---

## 017. Admin accounts: generated temporary passwords, a lock for the last admin, and password resets

- **Date:** 2026-11-19
- **Status:** Accepted

**Context.** Step 5 of v0.1 adds the admin endpoints. Three things had more than one reasonable answer: who picks the
temporary password of a new account, how two concurrent changes are kept from leaving no active admin, and what
happens when a user forgets their password, since Kairo sends no email.

**Options.**
- Temporary password: generated by the API and shown once; or typed by the admin, who tends to reuse something simple.
- Last admin: an advisory lock, as in decision 010; a `SERIALIZABLE` transaction with retries; or `SELECT … FOR
  UPDATE` on the admin rows. A single conditional `UPDATE` is not enough: with two admins demoting each other at the
  same time, each still sees the other as an admin, and both pass.
- Forgotten passwords: an admin reset endpoint now; or the backlog, which leaves only a manual database fix.

**Decision.** The API generates the temporary password (12 random characters from an alphabet without look-alikes,
grouped as `xxxx-xxxx-xxxx`) and returns it once; only its hash is stored. Role and status changes run in a
transaction that takes `pg_advisory_xact_lock`, counts the other active admins and refuses with 409 when none would be
left. `POST /admin/users/:id/password` gives the account a new temporary password, turns the forced change on and ends
its sessions.

**Consequences.** The admin never chooses a user's password, and still cannot use one for long: the forced change
(decision 016) replaces it at the first sign-in. The lock serializes admin changes, which are rare.


---

## 018. kairo-web reaches the API through Next.js rewrites

- **Date:** 2026-11-20
- **Status:** Accepted

**Context.** kairo-web runs on `localhost:3000` and the API on `localhost:4000`: two origins for the browser, which
matters for the session cookie, CORS and the CSRF check.

**Options.** Rewrites in `next.config.ts` that forward `/api/*` to the API; direct browser calls to the API with
`credentials: 'include'`; or a Backend for Frontend with a route handler per endpoint.

**Decision.** Rewrites. The browser only ever talks to kairo-web's origin, so the cookie is first-party and requests
are same-origin. Server Components call the API directly (`API_URL`) and forward only the session cookie, never every
incoming header, as the Next.js Backend for Frontend guide asks.

**Consequences.** One origin in deployment too. CORS and `WEB_ORIGIN` on the API stay as a second line, for direct
calls.

---

## 019. kairo-web reads in Server Components and writes from the client

- **Date:** 2026-11-20
- **Status:** Accepted

**Context.** Next.js 16 renders Server Components by default; interactive parts are Client Components.

**Options.** Reads in Server Components, mutations from Client Components through `/api` and then `router.refresh()`;
everything client-side with TanStack Query; or Server Actions for mutations, which receive the API's `Set-Cookie`
on the Next.js server and would have to copy it to the browser by hand.

**Decision.** Reads in Server Components, mutations from the client. No data-fetching library for now.

**Consequences.** No extra dependency, and the patterns of the official docs. TanStack Query can be added later where a
screen needs client-side caching.

---

## 020. API types and client generated from OpenAPI

- **Date:** 2026-11-20
- **Status:** Accepted

**Context.** The API publishes `/docs/openapi.json` (decision 007). The web app should stop compiling when the API
changes, not fail in front of the user.

**Options.** `openapi-typescript` for the types plus `openapi-fetch` as a small typed `fetch`; Orval or hey-api, which
generate whole clients and React Query hooks; or hand-written types.

**Decision.** `openapi-typescript` and `openapi-fetch`. `pnpm api:types` regenerates the types from the running API,
and the generated file is committed.

**Consequences.** Routes, bodies and responses are checked at compile time with a few KB of runtime code.

---

## 021. UI with Tailwind CSS 4 and shadcn/ui

- **Date:** 2026-11-20
- **Status:** Accepted

**Options.** Tailwind with shadcn/ui, whose components (built on Radix) are copied into the repo; Tailwind alone, with
every component and its accessibility built by hand; or a full library such as Mantine or MUI.

**Decision.** Tailwind CSS 4 and shadcn/ui.

**Consequences.** The component code lives in kairo-web and can be changed freely; accessibility comes from Radix.

---

## 022. kairo-web starts from the `create-next-app` defaults

- **Date:** 2026-11-20
- **Status:** Accepted

**Context.** Next.js 16.4 asks for TypeScript, linter, React Compiler, Tailwind, `src/`, App Router, Cache Components,
import alias and `AGENTS.md`.

**Decision.** The recommended defaults: TypeScript, ESLint (with the Next.js rules), no React Compiler, Tailwind, no
`src/`, App Router, Turbopack, Cache Components, `@/*`, and `AGENTS.md`. Agent feedback off. A web app manifest
(`app/manifest.ts`) makes it installable with Safari's "Add to Dock".

**Consequences.** With Cache Components, anything that reads the session sits behind `<Suspense>` and the rest of a
page prerenders, following the "Authentication with Cache Components" guide. kairo-web lints with ESLint while the API
uses oxlint.

---

## 023. Spanish and English with next-intl, the locale in the URL

- **Date:** 2026-11-20
- **Status:** Accepted

**Context.** Kairo is used daily in Spanish and shown in English as a portfolio piece. Adding languages later means
hunting every hard-coded string across every screen.

**Options.** One language now and translations later; both now with `next-intl`, the locale in the URL (`/es/...`,
`/en/...`); or both with the locale in a cookie only. With Cache Components (decision 022), reading a cookie outside
`<Suspense>` is a build error, and every translated string depends on the locale, so the cookie-only option would put
the whole app behind a boundary and lose the prerendered pages.

**Decision.** `next-intl` with prefix routing: a `[locale]` segment, `es` and `en`, Spanish by default. `proxy.ts`
picks the first locale from the path, then the `NEXT_LOCALE` cookie, then the browser's languages. The locale reaches
`i18n/request.ts` through `next/root-params`. Every UI string lives in `messages/es.json` and `messages/en.json`, typed
so a missing or misspelled key does not compile.

**Consequences.** Pages prerender once per locale. A screen writes `t('key')` instead of literal text. The language
switcher keeps the current path and changes only its prefix.

---

## 024. Forms with React Hook Form and zod

- **Date:** 2026-11-20
- **Status:** Accepted

**Options.** React 19's `useActionState` with no library, the API's 400 answers as the only validation; React Hook
Form with zod through `@hookform/resolvers`; or TanStack Form.

**Decision.** React Hook Form and zod 4, with shadcn/ui's `Field` components. Form schemas mirror the API's rules to
give feedback while typing; their messages are translation keys.

**Consequences.** The API still decides: its 400 and 409 answers are shown on the form too. The web app's schemas are
written by hand and kept in line with the API's.

---

## 025. Light and dark theme with next-themes and a Switch

- **Date:** 2026-11-20
- **Status:** Accepted

**Options.** Follow the operating system only, with CSS; or `next-themes`, which the shadcn/ui guide uses.

**Decision.** `next-themes` with the `class` attribute, following the system until the user flips a shadcn/ui
`Switch` between light and dark; the choice is remembered in the browser.

**Consequences.** No flash of the wrong theme on load. The root `<html>` needs `suppressHydrationWarning`, because
`next-themes` sets its class before React hydrates.

---

## 026. Temporary passwords expire after 72 hours

- **Date:** 2026-11-23
- **Status:** Accepted

**Context.** A temporary password (decision 017) stays pending until the user changes it (decision 016), and until now
it never stopped working. One handed out over a chat and never used stayed valid for months. Reviewing this also
showed a limit decision 016 does not state: the admin knows each temporary password and can reset any account, so the
admin can always change a user's password and sign in as them. The forced change keeps the admin from using a
temporary password unnoticed for long, not from taking an account over.

**Options.** Temporary passwords that expire; telling the user when the admin reset their password, so a takeover is
noticed; or documenting the limit only.

**Decision.** A temporary password expires 72 hours after the admin creates or resets the account
(`users.temporary_password_expires_at`). After that, sign-in with it answers 403 `temporary_password_expired`, and any
session it opened ends, so a new one has to come from the admin. Changing the password clears the expiry. Telling
the user about resets goes to the ideas backlog, before any public deployment.

**Consequences.** A forgotten temporary password stops working on its own. The admin sees each account's expiry in
`GET /admin/users` and resets it when needed.

---

## 027. kairo-web tests: Playwright for flows, Vitest for logic

- **Date:** 2026-11-23
- **Status:** Accepted

**Context.** Every web step so far was checked by hand in a browser. Vitest does not support async Server Components
yet, which most kairo-web pages are, so the Next.js testing guide recommends end-to-end tests for them.

**Options.** For flows: Playwright, Cypress, or manual checks. For logic: Vitest on pure functions, Vitest with
Testing Library on components, or nothing. For browsers: Chromium only, or Chromium, Firefox and WebKit.

**Decision.** Playwright (Chromium only for now) for the user flows, and Vitest for pure logic such as the form
schemas. `pnpm test:e2e` starts the API from `../kairo-api` on port 4100 against `kairo_test` and a production build
of the web app on port 3100, built into `.next-e2e` so it never touches a running `pnpm dev`. Before each test it
empties `kairo_test` with `pg`, refusing any database whose name does not end in `_test`, as the API's tests do
(decision 013).

**Consequences.** The web end-to-end tests need the API repository cloned next to this one and the database up.
WebKit (Safari) can be added later as another Playwright project.

---

## 028. Job stages, with "rejected" apart from "discarded", and their history

- **Date:** 2026-11-23
- **Status:** Accepted

**Context.** `docs/IDEA.md` listed six stages: to review, to apply, applied, interview, offer, discarded. Metrics
(v0.9) will need the response rate and the time between stages.

**Options.** The six stages, with only the current one stored; or the stages with "rejected" (the company said no)
apart from "discarded" (the user dropped it), "accepted" as the happy ending, and every stage change kept with its date.

**Decision.** Eight stages: `to_review`, `to_apply`, `applied`, `interviewing`, `offer`, `accepted`, `rejected` and
`discarded`. Every change is recorded in `job_stage_changes` (from, to, when), in the same transaction as the change.

**Consequences.** A job can move between any two stages; the history keeps the path. Metrics can tell "the company
said no" from "I dropped it" and measure time in each stage, data that could not be rebuilt later.

---

## 029. Salaries as integer ranges, compared only in the same currency and period

- **Date:** 2026-11-23
- **Status:** Accepted

**Context.** Postings state salaries in different currencies (MXN, USD…) and periods (monthly, yearly), and each
user has a target (the criteria).

**Options.** Store a free-text salary; or integer minimum and maximum with a currency and a period, compared with the
target only when both match; or convert currencies through an exchange-rate service.

**Decision.** `salary_min` and `salary_max` as integers in whole units, `salary_currency` (ISO 4217, such as `MXN`)
and `salary_period` (`month` or `year`). A job meets the salary criterion when its maximum reaches the target in the
same currency and period; a different currency or period answers "not comparable", with no conversion.

**Consequences.** No external service and no stale exchange rates. A posting in another currency is shown as not
comparable instead of being guessed. The target lives only in the database, never in the repository.

---

## 030. The jobs list is a table with stage tabs; a board comes later

- **Date:** 2026-11-23
- **Status:** Accepted

**Options.** A table with a tab per stage, search and sorting; or a kanban board with drag and drop, which needs a
library such as dnd-kit and much more work.

**Decision.** A table with stage tabs, search by company or title, and sorting by next follow-up. The board goes to
the ideas backlog.

**Consequences.** v0.2 ships sooner with a view that scales to many jobs. The board can be added on top of the same API.

---

## 031. Duplicate detection with pg_trgm

- **Date:** 2026-11-23
- **Status:** Accepted

**Context.** The same posting is easy to save twice, from LinkedIn and from the company's site. It was first left to
the author as a `TODO(Raymundo)`; later the author chose to have it implemented and explained instead.

**Decision.** When a job is created, the API warns about the user's jobs with the same URL, or with both a company and
a title similar enough according to PostgreSQL's `pg_trgm`. It warns, never blocks.

- **Company:** `word_similarity` in both directions, so a shorter name matches a longer one ("Acme" and "Acme
  Robotics Inc.").
- **Title:** `similarity`, which weighs the whole text, so "Senior Full-Stack Engineer" matches "Senior Fullstack
  Engineer" (0.86) but "Senior Backend Engineer" does not (0.52).
- **Threshold:** 0.6 for both, chosen from examples like these. Requiring both keeps another role at the same company,
  or the same role elsewhere, from being flagged. A wrong warning costs little; a missed one means a posting saved
  twice.
- **Order:** same URL first, then the most similar; at most five.
- **No trigram index:** only the user's own jobs are compared (found through `jobs_user_id_idx`), and a GIN index
  only serves pg_trgm's operators (`%`, `<%`), not these function calls.

**Consequences.** The check only ever looks at the current user's jobs. Tests prove it, as for every module, and each
rule (user, the job itself, URL, threshold, order) has a test that fails without it. URLs are compared exactly:
stripping query strings would break job boards that put the posting's id there.

---

## 032. License when the repositories go public: all rights reserved

- **Date:** 2026-11-23
- **Status:** Accepted

**Context.** Both repositories go public with v0.2 (decision 002), so their license has to be stated.

**Options.** All rights reserved, so the code can be read but not reused; or MIT, so anyone can use, copy and modify
it, commercially too, keeping the copyright notice.

**Decision.** All rights reserved, stated in each README. There is no `LICENSE` file.

**Consequences.** The projects work as a portfolio without granting reuse. A more permissive license can be adopted
later; a permission granted under MIT could not be taken back.

**Also decided.** The history goes public as it is, with the commit author's email, and the demo seed is set aside
to the ideas backlog.

---

## 033. Tasks: optionally linked to a job, kept when done

- **Date:** 2026-11-23
- **Status:** Accepted

**Context.** v0.3 adds manual tasks ("prepare the Acme interview", "write a LinkedIn post"). Many belong to a posting,
some do not.

**Options.**
- **Link:** standalone tasks only; or tasks with an optional job.
- **When the job is deleted:** delete its tasks with it (and say so in the confirmation); or keep them without the job.
- **When a task is done:** delete it; or keep it with the moment it was done.

**Decision.** A task has a title, optional notes, an optional due day and an optional job. Deleting the job keeps its
tasks, unlinked (`ON DELETE SET NULL`). A done task is kept, with `done_at`, and can be opened again.

**Consequences.** A task is never lost without the user noticing, a mistaken "done" can be undone, and Metrics (v0.9)
can count finished work. The service has to check that a task's job is the same user's.

---

## 034. The Today screen: four sections and actions on follow-ups

- **Date:** 2026-11-23
- **Status:** Accepted

**Options.** Only what is overdue or due today; or also the next seven days and the tasks without a day. For
follow-ups, only a link to the job; or acting on them from Today.

**Decision.** Today replaces the home page with **Overdue**, **Today**, **Next 7 days** and **No date**, and **Done
today** collapsed at the end. Follow-ups get **Done** (clears the follow-up) and **Postpone** (a new day) besides the
link to the job. Jobs in a closed stage (`accepted`, `rejected`, `discarded`) are left out.

**Consequences.** One screen for the day's work, without surprises from what is coming. The follow-up actions reuse
`PATCH /jobs/:id`, so there is no new endpoint for them.

---

## 035. "Today" is the browser's day

- **Date:** 2026-11-23
- **Status:** Accepted

**Context.** Which section an item goes in depends on the user's calendar day, which depends on their time zone.
Cache Components refuses the current time on the server, and the server's time zone need not be the user's.

**Options.** The browser groups the items with its own date; or the user's time zone is stored in their account and
the API filters by day, which needs a settings screen.

**Decision.** `GET /today` answers every open item, not filtered by day, and the browser groups them with its own
date (`lib/today.ts`). Done tasks come from the last 48 hours, enough for any time zone's "done today".

**Consequences.** Today is always the user's real day, travel included, with nothing to configure. The answer grows
with the open items, which stay few for one person.
