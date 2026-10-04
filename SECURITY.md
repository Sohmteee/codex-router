# Security policy

Report suspected vulnerabilities privately through GitHub Security Advisories. Do not publish credentials or private user request data in issues.

## Local data

Account tokens, router credentials, and Jev keys belong in Windows user-protected storage. Redacted diagnostics may include versions, timestamps, route decisions, and error codes; they must not include tokens, request bodies, source text, or user prompts.

## Routing invariant

Jev is advisory. The TypeScript service must authorize the selected model against the current account, capability requirements, user allowlist, and policy revision immediately before forwarding an inference request.
