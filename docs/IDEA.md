# Kairo: product idea

## The name

*Kairos* is Greek for "the right moment", as opposed to *chronos*, clock time. Luck is being prepared when the
opportunity arrives: Kairo keeps me prepared (Learning, AI analysis, CV) and makes sure I notice the opportunity
and act on it in time (Radar, Jobs, Today).

## Problem

Looking for a well-paid remote job means applying to many postings at once, and it is easy to lose track:
which stage each application is in, who I talked to at each company, when to follow up, what each role asks for,
how to prepare if I move forward, and what to study to close the gaps. On top of that, new postings at the
companies I care about show up and get filled before I notice them.

## Who it is for

Me first: Kairo is the tool I use every day for my own job search, and it is also a portfolio project.
It supports several accounts, so I can lend it to a friend and see if it helps them too.
Anyone looking at the project sees it with demo data; real data never leaves the machine it runs on.

## Core idea

Every screen answers one question: **what should I do today to get closer to my goal?**

The goal is concrete: a role that meets my criteria (salary target, fully remote, working hours and time zone
that fit my current commitments, contract type). Each posting is measured against those criteria.

## Modules

| Module | What it does | How it connects |
|---|---|---|
| **Accounts** | Login and two roles: `admin` manages accounts, `user` uses the app. The first account to register becomes admin; after that, only the admin creates accounts | Every other module reads the current user. The admin manages accounts but cannot see anyone's data |
| **Jobs** | Track every posting through stages (to review, to apply, applied, interview, offer, discarded) and compare it with my criteria | The center: every other module feeds from it |
| **Today** | What I have to do today | Pulls in due follow-ups, upcoming interviews and their prep, manual tasks and one study item |
| **Contacts** | Who I talked to at each company and when to write again | Follow-up reminders show up in Today |
| **Learning** | Videos, courses, articles and side projects to work on, with status and the skill each one trains | Later, skill gaps found in postings become study items |
| **AI analysis** | What a posting asks for, how my CV compares, how to prepare | Feeds Learning and interview prep in Today |
| **CV** | A version tailored to each posting, Harvard format, exportable to PDF | Uses each posting's analysis |
| **Radar** | Daily check of target companies' public job feeds (Greenhouse, Lever, Ashby) | New postings land in Jobs as "to review" |
| **Metrics** | Applications per week, response rate, results by source, with vs. without a contact | Shows what is working |

## Scope rule

> If it does not help me get a job or grow professionally, it does not go in.

Professional growth includes personal branding (for example, a LinkedIn post to write or a pitch to practice).
Personal life (exercise, habits, errands) stays in other tools.

## Principles

- **Each version is usable end to end.** No half-built features.
- **Every record belongs to a user.** Jobs, tasks, contacts, learning items, everything is scoped to its owner,
  and no query returns another user's data.
- **The core works without AI.** AI adds value on top of a tracker that already works.
- **Model output is untrusted input.** It is validated before anything is saved.
- **Personal data stays out of the repo.** The repo ships a demo seed with fictional companies and postings.
- **Installable.** It can be added to the macOS Dock (Safari "Add to Dock") and used like a desktop app.

## Non-goals

- Public deployment, for now. Kairo runs locally.
- Scraping or automating LinkedIn, in any form.
- Applying to jobs automatically.
- Tracking personal life outside work and professional growth.

## Roadmap

| Version | Scope |
|---|---|
| v0.1 | Accounts: login, roles, admin creates accounts |
| v0.2 | Jobs: capture, stages, next follow-up, criteria |
| v0.3 | Today: manual tasks and due follow-ups |
| v0.4 | Contacts per job and follow-up reminders |
| v0.5 | Learning: videos, courses and projects, entered by hand |
| v0.6 | AI analysis of a pasted posting against the CV |
| v0.7 | Tailored CV in Harvard format, PDF export |
| v0.8 | Radar over public job feeds |
| v0.9 | Weekly metrics |

The roadmap is a living document. New modules are welcome when they pass the scope rule.

## Ideas backlog

New ideas land here first, so they never interrupt the version in progress. When a version ships, the backlog
is reviewed and each idea is either scheduled into the roadmap or dropped.

- _(empty)_
