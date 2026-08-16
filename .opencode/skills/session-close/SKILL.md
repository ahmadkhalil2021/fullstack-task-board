---
name: session-close
description: Use when the user wants to close the session and shut down ("Session schließen", "Rechner herunterfahren", "save state for tomorrow", "good night", "bis morgen"). Captures git state, updates PROJECT_STATUS.md as the canonical handoff doc, runs lint/build/test to verify clean state, commits locally (NEVER push), and surfaces followups for the next session.
---

# Session-Close Skill

When the user signals they're ending the session, your job is to
leave the project in a state where the next session can resume
without losing context. This is *not* a code change — it's a
session-handoff ritual.

## When to use

Trigger phrases (German + English + mixed):
- "Session schließen", "Rechner herunterfahren", "bis morgen"
- "save state for tomorrow", "close session"
- "good night", "end of day", "EOF"

If the user explicitly says "commit and push" or "force commit"
etc., the strict "no push" rule below still holds — push is a
separate decision they should make themselves when online.

## Workflow

Run these steps in order. Skip steps that don't apply (e.g. no
PROJECT_STATUS.md → skip step 2's read).

### 1. Capture git state (parallel probe)

```bash
cd <project_root>
git status --short | wc -l                              # uncommitted count
git status --porcelain                                  # uncommitted list
git branch --show-current                               # current branch
git log --oneline -n 5                                  # last 5 commits
git diff --shortstat                                    # diff stat
git config user.name && git config user.email           # git identity check
```

Why: tells you how much there is to commit, the branch name,
whether git can commit at all (user.name/email must be set),
and a sense of commit history depth.

### 2. Read existing PROJECT_STATUS.md

```bash
test -f PROJECT_STATUS.md && cat PROJECT_STATUS.md
```

Why: preserves any useful context from prior handoffs. The new
doc is an *update*, not a fresh write — project conventions,
test-logins, env-var reference, etc. often already live there.

If PROJECT_STATUS.md does NOT exist, create it (skip the read).

### 3. Validate clean state

Run the project's standard validation trio in parallel:

```bash
npm run lint 2>&1 | tail -10
npm run build 2>&1 | tail -25
npm run test:run 2>&1 | tail -50   # or `npm test` if no test:run script
```

Capture pass/fail counts, runtime, and any warnings. **Do NOT
fix errors here** — if lint/build/test fails, surface that in the
handoff doc as a Pedantic Ticket instead. The session-close ritual
must not turn into a debugging session.

### 4. Update PROJECT_STATUS.md

Write (or overwrite) `PROJECT_STATUS.md` at the repo root with
this canonical structure. **All sections required**, in this order:

```markdown
# <Project Name> — Projekt-Status (Session-Handoff)

> **Stand: <date>.** Lint <status>, Build <status>, Tests <pass/fail>.
> Branch: `<branch>`, <N> uncommitted files committed this session.

## Was in DIESER Session dazugekommen ist
<chronological bullets: features + bug fixes>

## Was davor schon stand (Fundament)
<bullets: earlier major work preserved from prior handoff>

## Status-Check
<verbatim of last `npm run lint/build/test:run` exit codes>

## Test-Logins / Credentials
<if applicable — passwords / API keys never in plaintext>

## Architektur-Conventions (kritische Gotchas)
<numbered list of "do this, not that" rules — preserve from prior handoffs>

## Pedantische Tickets / Bekannte Edge-Cases
<table: # | ticket | status (offen / done / wontfix)>

## Was als Nächstes ansteht (priorisiert)
<table: prio | task | aufwand>

## Morgen weiterarbeiten
1. Dev-Server command
2. Browser URL
3. Hard-Refresh hint (font caches etc.)
4. Test-Pfad (login + click-through)
5. DB inspection command (drizzle studio etc.)

### Wenn morgen Probleme auftreten
<symptom → fix mappings>

### Env-Var Quick-Reference
<env var names only, NEVER values — values live in .env.local>

---

*Erledigt (historisch):* <comma-separated list of past achievements>
```

Rules:
- **NEVER put secrets in PROJECT_STATUS.md** — env var NAMES only.
- **Preserve prior handoffs** — don't delete info that's still
  useful (test logins, conventions).
- **Use present tense** for "Was davor schon stand", past tense
  for "Was in DIESER Session dazugekommen ist".

### 5. Local commit (NEVER push)

```bash
cd <project_root>
git add -A
git commit -m "<subject>

<bulleted breakdown of all changes>

Updated PROJECT_STATUS.md with full session handoff."
```

Subject style: `chore: session handoff — <one-line summary>` for
admin-only sessions, or `feat: <feature>` / `fix: <bug>` when the
session shipped a discrete feature.

Body: bullet-point breakdown of all changes, grouped by concern
(feat, fix, chore, docs). Include the PROJECT_STATUS.md update
as the last item.

**NEVER `git push`** — user pushes themselves when online.

### 6. Verify clean state

```bash
git status              # should show "nothing to commit, working tree clean"
git log --oneline -n 3  # should show the new commit on top
```

### 7. Surface followups via suggest_followups

The 3 followups should be:
1. **Remote safety** — `git push origin <branch>` (addresses the
   single-point-of-failure risk of a local-only commit).
2. **Resume plan** — the top item from "Was als Nächstes ansteht"
   with concrete next-step commands.
3. **One Pedantic Ticket** — the highest-priority open ticket from
   the handoff doc.

## Common pitfalls

- **Don't run `npm install` or package-add during session-close.**
  Adding deps mid-handoff complicates the commit and surprises
  the next session. If the session added new packages, that
  should be a discrete commit BEFORE the handoff.
- **Don't run `npm run db:migrate` or schema-changing commands.**
  Surface pending migrations as Pedantic Tickets instead.
- **Don't push.** Not even with `--force-with-lease`. The user
  decides when to push.
- **Don't fix bugs found during validation.** Surface them. If
  the user wanted them fixed, they would have asked before saying
  "close session".
- **Don't include actual env-var values in the handoff doc.**
  `.env.local` is gitignored — values live on disk only.
- **Don't trim the handoff doc too aggressively.** Future-you
  appreciates detail. 100+ lines is fine; 30 is suspicious.

## Example (compressed)

User: "Session schließen, bis morgen."

You:
1. Probe git → 41 uncommitted files, branch `master`, last commit
   `26aa48c`.
2. Read existing PROJECT_STATUS.md → 200 lines of context to preserve.
3. Run lint+build+test → all green, 17/17 tests pass in 2.78s.
4. Rewrite PROJECT_STATUS.md preserving prior context + adding this
   session's Mux/admin/tests/fixes.
5. `git add -A && git commit -m "feat: Mux video end-to-end + admin
   moderation + first Vitest test suite ..."`.
6. Confirm `git status` clean, new commit `8f19d56` on top.
7. suggest_followups:
   - `git push origin master` (when online)
   - Resume plan: dev server + next top-prio ticket
   - One open Pedantic Ticket
