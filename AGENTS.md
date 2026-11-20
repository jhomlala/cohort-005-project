## Verification checks

Do these checks in this order before you report a change to `app/` as complete:

1. `npm run typecheck`
2. `npm run lint:boundaries`
3. `npm run test`
4. `npm run test:mutation`

Or run the first three with `npm run check`.

`npm run lint:oxlint` lints the whole repository with oxlint (`.oxlintrc.json`).

Modules are deep modules: see [app/modules/README.md](./app/modules/README.md) before adding or importing one.

## Before you commit

- Keep every file under 5000 tokens (about 20 KB). The pre-commit hook rejects bigger files. Split at a seam before you commit: see "Keep files under 5000 tokens" in [CODING_STANDARDS.md](./CODING_STANDARDS.md).
- Behaviour goes in a module under `app/modules/`, never inline in a loader or action.
- An `oxlint-disable` comment needs a reason after `--`, and the hook rejects one without. Fix the code first. A disable is the last resort.
- The reviewer fixes what it finds, including code you moved and tests you did not write. Write the missing test and fix moved code before you commit.

### About agent-browser

agent-browser lets you drive a real browser through the app from the
terminal: open a page, click, and read the DOM back. Use it to check a change
that `typecheck` and `test` cannot see, and to answer a question about the
page yourself rather than asking the person you are working for. See
`docs/agents/agent-browser.md`.

## When something breaks

| Symptom                                         | Cause                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 401 "Select a user from the DevUI panel"        | No user in the session — switch users and country in the floating panel (`app/components/dev-ui.tsx`). |
| `tsc` reports every `./+types/*` import missing | Typegen has not run. Use `npm run typecheck`, which runs `react-router typegen` first.                 |

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues on your own copy of this repo (the `origin` remote), never on `ai-hero-dev/cohort-005-project`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.
