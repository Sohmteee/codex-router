"""Read one JSON request per line and return a strictly bounded Jev recommendation."""

from __future__ import annotations

import json
import os
import sys
from typing import Any


def _answer_to_dict(answer: Any) -> dict[str, Any]:
    if isinstance(answer, dict):
        return answer
    return {
        "choice": getattr(answer, "choice", None),
        "confidence": getattr(answer, "confidence", None),
        "probabilities": getattr(answer, "probabilities", None),
    }


def _valid_probability(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not 0 <= float(value) <= 1:
        return None
    return float(value)


def recommend(payload: dict[str, Any]) -> dict[str, Any]:
    """Ask Jev to choose a model, per-model supported effort, and bounded lease."""
    request = payload["request"]
    request_id = request["requestId"]
    candidates = request["candidates"]
    if not candidates:
        return {"ok": False, "requestId": request_id, "errorCode": "invalid_request"}
    if not os.environ.get("TYPESAFE_API_KEY"):
        return {"ok": False, "requestId": request_id, "errorCode": "unavailable"}

    from typesafe_sdk import Choice, TypeSafeClient

    model_options = {
        candidate["id"]: (
            f'{candidate["displayName"]}: {candidate["capabilitySummary"]}; '
            f"context {candidate['contextTokens']} tokens"
        )
        for candidate in candidates
    }
    questions: dict[str, Any] = {
        "stage": Choice(
            instructions="Classify the work required for the next model call.",
            criteria={
                "discovery": "Explore unknowns and gather evidence.",
                "planning": "Design or sequence upcoming work.",
                "implementation": "Make an established change.",
                "debugging": "Diagnose or correct a failure.",
                "tests": "Validate behavior or review test output.",
                "review": "Evaluate a completed result.",
            },
        ),
        "model": Choice(
            instructions=(
                "Choose the highest-quality eligible model sufficient for this next call. "
                "When capability is sufficient, prefer the more efficient candidate. "
                "Select only a provided candidate ID."
            ),
            criteria=model_options,
        ),
        "lease": Choice(
            instructions="Choose the longest lease safe for this stable phase. Reassess after errors or changed work.",
            criteria={
                "one_call": "Reassess after every model response.",
                "tool_chain": "Reuse for clean continuations of the same tool chain.",
                "user_turn": "Reuse through clean continuations for this uniform user turn.",
            },
        ),
    }
    for index, candidate in enumerate(candidates):
        questions[f"effort_{index}"] = Choice(
            instructions=(
                f"Choose a sufficient reasoning effort for candidate {candidate['id']} and this next call. "
                "Use only a listed effort."
            ),
            criteria={effort: f"Supported effort value: {effort}" for effort in candidate["supportedEfforts"]},
        )

    dossier = {
        "stage": request["task"]["stage"],
        "objective": request["task"]["objective"][:8_000],
        "recentIntent": request["task"]["recentIntent"],
        "toolErrorSummary": request["task"]["toolErrorSummary"],
        "requirements": request["requirements"],
        "quota": request["quota"],
        "recoveryAttempt": request["task"]["recoveryAttempt"],
        "previousModelId": request["previousModelId"],
    }

    with TypeSafeClient() as client:
        response = client.system_one(state=json.dumps(dossier, ensure_ascii=True), questions=questions)

    answers = response.choices
    model_answer = _answer_to_dict(answers["model"])
    lease_answer = _answer_to_dict(answers["lease"])
    selected_id = model_answer.get("choice")
    selected_index = next((i for i, candidate in enumerate(candidates) if candidate["id"] == selected_id), None)
    if selected_index is None:
        return {"ok": False, "requestId": request_id, "errorCode": "invalid_response"}
    effort_answer = _answer_to_dict(answers[f"effort_{selected_index}"])
    effort = effort_answer.get("choice")
    candidate_efforts = candidates[selected_index]["supportedEfforts"]
    lease = lease_answer.get("choice")
    if effort not in candidate_efforts or lease not in {"one_call", "tool_chain", "user_turn"}:
        return {"ok": False, "requestId": request_id, "errorCode": "invalid_response"}

    confidence = _valid_probability(model_answer.get("confidence"))
    if confidence is None:
        return {"ok": False, "requestId": request_id, "errorCode": "invalid_response"}
    return {
        "ok": True,
        "requestId": request_id,
        "modelId": selected_id,
        "reasoningEffort": effort,
        "lease": lease,
        "confidence": confidence,
    }


def main() -> None:
    """Keep stdout machine-readable and never print credentials or request content."""
    for line in sys.stdin:
        request_id = "00000000-0000-4000-8000-000000000000"
        try:
            payload = json.loads(line)
            request_id = payload.get("request", {}).get("requestId", request_id)
            if payload.get("protocolVersion") != 1:
                raise ValueError("unsupported protocol")
            result = recommend(payload)
        except Exception:
            print("[jev-adapter] request failed", file=sys.stderr, flush=True)
            result = {"ok": False, "requestId": request_id, "errorCode": "unavailable"}
        print(json.dumps(result, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
