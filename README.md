# Codex Router

A Windows desktop control panel and local routing service for Codex. The router helps choose an enabled model and reasoning effort for each safe-to-route request, prioritizing task capability before allowance efficiency.

> **Early development:** the initial compatibility spike is still in progress. Do not point an active Codex installation at this service until the integration guide says the pinned Desktop and CLI versions have passed the real account, streaming, and tool-continuation checks.

## Project structure

- `apps/desktop` — Tauri 2 + React control panel.
- `services/router` — TypeScript control service, local Responses proxy, policy, and SQLite store.
- `services/jev-adapter` — private-line Python worker for TypeSafe Jev choices.
- `packages/contracts` — versioned cross-process request and response contracts.
- `docs` — architecture, integration and validation notes.

## Requirements for development

- Windows 11 x64, Node.js 24, pnpm 10, Python 3.13, and Rust stable/MSVC build tools.
- Codex CLI and Desktop for the compatibility spike.
- A TypeSafe key for live Jev decisions. Never add it to this repository or pass it on a command line.

For development only, set a key in the current user's environment. Windows credential storage and the production setup flow have not been implemented yet. The service sends only the bounded routing dossier to TypeSafe. It does not forward inference requests from Python.

## Development

```powershell
corepack enable
pnpm install
pnpm dev
```

Use `pnpm test` for fixture-backed tests, `pnpm typecheck` for TypeScript checks, and `pnpm desktop:dev` for the Tauri shell. Live account tests are separate because they use account allowance.

## Security boundary

Only bind local services to loopback or the current-user named pipe. Account token discovery and Windows user-scoped credential storage are not implemented yet; never store account credentials in plaintext. Never log request bodies, credentials, full source files, or private user prompts. A model must be explicitly enabled before it can be dispatched; Jev never authorizes a route.

## License

Original project source is MIT licensed. Third-party code retains its original notices. See `docs/architecture/compatibility-spike.md` before relying on any upstream transport code.
