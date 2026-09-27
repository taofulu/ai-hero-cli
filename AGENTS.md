# AGENTS.md

## Agent skills

### Issue tracker

GitHub Issues at `taofulu/ai-hero-cli`; operations use the REST API via `curl` with a per-session `GITHUB_TOKEN` (no `gh` CLI on this machine). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
