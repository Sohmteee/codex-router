# System boundaries

```text
Codex Desktop / CLI
  └─ loopback Responses provider
       └─ TypeScript router
            ├─ registry + account/quota adapter
            ├─ deterministic policy (final dispatch authority)
            ├─ SQLite persistence
            ├─ Python Jev worker (recommendations only)
            └─ HTTPS Responses upstream

Tauri control panel ── current-user named pipe ── router control API
```

## Responsibilities

- The React renderer never reads credentials or opens the inference proxy directly.
- Tauri owns process lifetime and sends typed control messages to the service.
- Node owns discovery, account association, SQLite, request streaming, session leases, and final route authorization.
- Python reads one bounded JSON request on stdin and returns one typed result on stdout. It never receives an OpenAI token or forwards a Responses request.
- Jev's model ID, effort, and lease are recommendations; the service validates them against current registry and policy revisions.

## Core dispatch rule

Immediately before dispatch, verify the active account, required capabilities, model status, user-enabled selection, supported effort, lease validity, and policy/catalog revision. If any check fails, reassess from a current snapshot or stop with an actionable error. There is no hard-coded named-model emergency route.
