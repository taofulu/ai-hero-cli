# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues at `taofulu/ai-hero-cli`.

## Conventions

> NOTE: `gh` CLI is not installed on this machine. All operations use the GitHub
> REST API via `curl`, authenticated with a fine-grained PAT supplied per-session
> through the `GITHUB_TOKEN` environment variable. The token must NEVER be
> committed, written to files, or stored in `.git/config`.

- **Create an issue**: `curl -s -X POST -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/repos/taofulu/ai-hero-cli/issues -d '{"title":"...","body":"...","labels":["ready-for-agent"]}'`
- **Read an issue** (with comments): `curl -s -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/repos/taofulu/ai-hero-cli/issues/<n>` plus `.../issues/<n>/comments`
- **List issues**: `curl -s -H "Authorization: Bearer $GITHUB_TOKEN" "https://api.github.com/repos/taofulu/ai-hero-cli/issues?state=open&per_page=100"` (filter out entries whose `pull_request` key exists)
- **Comment on an issue**: `curl -s -X POST -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/repos/taofulu/ai-hero-cli/issues/<n>/comments -d '{"body":"..."}'`
- **Apply / remove labels**: `POST .../issues/<n>/labels` with `{"labels":["..."]}` / `DELETE .../issues/<n>/labels/<name>`
- **Close**: `curl -s -X PATCH -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/repos/taofulu/ai-hero-cli/issues/<n> -d '{"state":"closed"}'`

The repo can also be inferred from `git remote -v`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests.)_

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Fetch `GET /repos/taofulu/ai-hero-cli/issues/<n>` and `GET /issues/<n>/comments`.

## Blocking edges

Use GitHub **native issue dependencies** where available:

- **Add edge**: `POST /repos/taofulu/ai-hero-cli/issues/<child>/dependencies/blocked_by` with `{"issue_id": <blocker-database-id>}` — `<blocker-database-id>` is the numeric database `id` from `GET /issues/<n>` (NOT the `#number`).
- **Read blockers**: check `issue_dependencies_summary.blocked_by` on the child issue.
- **Fallback**: a `Blocked by: #<n>, #<n>` line at the top of the child body.

A ticket is unblocked when every blocker is closed.
