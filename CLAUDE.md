# Kairo API

Kairo is a job search companion: track applications, get prepared, and act on the right opportunity in time.
It is the author's daily tool and a portfolio project.

- Product vision, modules, scope rule and roadmap: `docs/IDEA.md`
- Technical decisions, with alternatives and reasons: `docs/DECISIONS.md` (one entry per decision)

## Repositories

Two repos, cloned side by side under the same parent folder (see decision 003):

| Repo | Contents |
|---|---|
| `kairo-api` (this one) | NestJS API, PostgreSQL, and the product-wide docs in `docs/` |
| `kairo-web` | Next.js web app, UI only. Its `CLAUDE.md` points back to the docs here |

Local layout: a plain parent folder (not a git repo) groups both clones.

```
~/Developer/kairo/
  kairo-api/
  kairo-web/
```

## Language

- Code, names, comments, docs, commit messages: English.
- Explanations and conversation with Raymundo: Spanish (Mexico).

## How we work

- **One step at a time.** Before a step, say what you will do and why. Do only that step, show how to verify it,
  then propose the commit message.
- **Decisions with alternatives come first.** When something has more than one reasonable option, present the
  options with trade-offs and a recommendation, and wait for Raymundo's choice. Record it in `docs/DECISIONS.md`.
- **Check the current official docs before a technical decision**, not only npm versions and peer dependencies.
  Libraries here may be newer than what you know (decisions 005 and 006 were superseded for this reason).
- **Simple and standard over clever.** Do not add a dependency without explaining why it is needed.
- **Tasks marked for Raymundo** (`TODO(Raymundo)`) are his to implement. Do not write the solution: give hints
  when asked, and review his code and tests the way a senior engineer would in a code review.
- **New ideas go to the "Ideas backlog" in `docs/IDEA.md`.** They never interrupt the version in progress.

## Git

- Raymundo commits by default. Propose a Conventional Commits message in English.
- Commit or push only when Raymundo asks for it at that moment; an earlier yes does not carry over.
- Before every commit, check `git status`: `.env` and `*.local.json` must not appear, and `pnpm-lock.yaml` must
  be committed once it exists.

## Tooling

- Package manager: **pnpm only** (10 or later). Never use npm or yarn, and never create `package-lock.json` or
  `yarn.lock`.
- pnpm blocks dependency install scripts. If one needs `pnpm approve-builds`, explain which package it is and
  what the script does before approving it.
- NestJS 12 is ESM only: relative imports end in `.js`, there is no `__dirname` (use `import.meta.dirname`), and
  tests run on Vitest (`vi.fn()`, not `jest.fn()`). Lint is oxlint. The docs index is
  https://docs.nestjs.com/llms.txt, with a markdown page per chapter.
- Prefer first-party `@nestjs/*` packages when one exists for the job, and check its docs page first.

## Privacy

- Personal data (CV, target companies, salary goal, current employer, anything about Raymundo's situation) never
  goes into the repo, commits, issues or public text. It lives in git-ignored local files and in the database.
- Public-facing text (README, docs, UI copy) stays neutral about personal circumstances.
- The repo ships demo data with fictional companies and postings.

## Hard rules

- No scraping or automation of LinkedIn, in any form.
- Every record belongs to a user; no query may return another user's data. The admin role manages accounts but
  cannot read other users' data. Every module that stores user data has an end-to-end test built on
  `createTwoUsers()` (`test/two-users.ts`) proving one user cannot list, read, change or delete another's records.
- Every route requires a session unless it is listed in `PUBLIC_ROUTES` (`test/authorization.e2e-spec.ts`), and
  every route declares its authorization (`@Can()`, `@Can.Anyone()` or `@Public()`).
- Model output is untrusted input and is validated before anything is saved.
