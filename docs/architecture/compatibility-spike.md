# Compatibility spike

**Status: not yet proven.** The proxy must not be used as an active Codex provider until the gates below pass on a recorded CLI and Desktop version.

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

## Alternative and stop condition

The documented Sign in with ChatGPT plan-usage OAuth is a possible path only if the exact Windows Desktop request features are supported. Record the preview tool/history limits and test tool continuations. If neither path passes all six gates, stop feature implementation and publish the specific compatibility blocker in this document.
