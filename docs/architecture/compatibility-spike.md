# Compatibility spike

**Status: partial, not yet proven.** The proxy must not be used as an active Codex provider until the gates below pass on a recorded CLI and Desktop version.

## Read-only probe (2026-10-04)

The installed app-server identified itself as `Codex Desktop/0.159.0-alpha.12.1 (Windows 10.0.26200; x86_64)`. Under the Windows user's existing ChatGPT login, the generated protocol and live read-only calls confirmed:

- `model/list` returned 10 catalog entries.
- `account/rateLimits/read` returned an account identifier, a `codex` bucket, and both primary and secondary windows.
- `account/usage/read` returned a usage summary and daily-bucket field.
- `account/read` reported a ChatGPT account.

The probe did not issue inference, alter Codex configuration, or save account identifiers, usage amounts, emails, or credentials. This proves the installed app-server can read account and quota metadata under the current login; it does not prove the model catalog is an entitlement list or that a routed inference request uses that same account.

The generated protocol types exposed `model/list`, `account/rateLimits/read`, and `account/usage/read`. These are version-specific app-server methods, so the baseline version above is part of the test record.

## Required evidence

1. Account/catalog identity uses the same signed-in user/workspace for discovery and inference.
2. Usage reads return real account windows and timestamps; missing data stays unavailable.
3. A Responses request can pass through the local proxy with the provider's supported account authentication.
4. SSE output, cancellation, tools, and a continuation reach completion without dropping items or duplicating tool calls.
5. A switch between two account-visible, user-enabled models succeeds at a safe boundary.
6. The same behavior works in the Windows Codex Desktop version under test; a CLI result alone is insufficient.

## Planned native account path

Use a Codex custom Responses provider with OpenAI authentication and a loopback `base_url`. The service forwards the bearer credential only in memory to the public Responses API. A separate app-server child launched with the built-in OpenAI provider reads account and rate-limit state using the user's existing Codex login. Do not scrape `auth.json`, reuse private backend endpoints, or write the bearer token to service state.

The account catalog must be fetched using the same request credential where that operation is supported. A bundled catalog is metadata only, not proof of account availability. Verify a model by completing an inference call before labeling it verified.

## Sign in with ChatGPT alternative

OpenAI documents a Codex app-server path using an OAuth access token authorized for ChatGPT plan usage. In that mode the app owns token acquisition and refresh; the app-server model list may be a bundled catalog and does not establish entitlement. HTTP requests require `store: false` and `stream: true`; continuation history must be sent in the input. Local shell/MCP tools, local history, resume, and child agents are supported, while hosted file search, Code Interpreter, native computer use, hosted MCP/connectors, and Responses `tool_search` are unsupported. Compare this exact path against the existing Codex Desktop provider before selecting it.

References: [Codex app-server with Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server), [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), and [Codex custom model providers](https://developers.openai.com/codex/config-advanced#custom-model-providers).

## Alternative and stop condition

The documented Sign in with ChatGPT plan-usage OAuth is a possible path only if the exact Windows Desktop request features are supported. Record the preview tool/history limits and test tool continuations. If neither path passes all six gates, stop feature implementation and publish the specific compatibility blocker in this document.
