# Contributing

This project is public from its first commit. Treat every pushed commit as public and do not include credentials, private account data, local databases, request bodies, or private screenshots.

## Development rules

- Keep authorization in the TypeScript policy engine. Every route, including fallback and leased routes, must pass the same final eligibility check.
- Treat model discovery, account availability, capability metadata, and user enablement as distinct facts.
- Never commit secrets. Use protected Windows storage or process stdin for local credentials.
- Keep the Jev payload small, bounded, redacted, and advisory. Never include full prompts or image data by default.
- Add fixture-backed tests for protocol and policy invariants. Do not make live calls in CI.
- Record tested Codex versions and differences between CLI and Desktop.

## Pull requests

Run `pnpm check` before submitting. Document any integration behavior that is mocked, account-gated, or unverified.
