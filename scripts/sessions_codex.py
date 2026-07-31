"""Codex rollout JSONL access for the sessions CLI."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def read_metadata(path: Path) -> dict | None:
    try:
        with path.open() as file:
            for line in file:
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if event.get("type") == "session_meta":
                    payload = event.get("payload", {})
                    if isinstance(payload, dict):
                        return payload
    except OSError:
        return None
    return None


def read_session(
    path: str | Path,
    role_filter: str | None = None,
    include_tools: bool = True,
) -> list[dict]:
    messages = []
    try:
        with Path(path).open() as file:
            for line in file:
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue

                payload = event.get("payload", {})
                if not isinstance(payload, dict):
                    continue
                payload_type = payload.get("type")
                timestamp = event.get("timestamp", "")

                if event.get("type") == "event_msg" and payload_type in (
                    "user_message",
                    "agent_message",
                ):
                    role = "user" if payload_type == "user_message" else "assistant"
                    text = payload.get("message", "")
                    if (not role_filter or role_filter == role) and isinstance(text, str) and text.strip():
                        messages.append(
                            {"role": role, "type": "text", "text": text.strip(), "ts": timestamp}
                        )
                elif event.get("type") == "response_item" and include_tools and not role_filter:
                    if payload_type in ("function_call", "custom_tool_call"):
                        name = payload.get("name", "unknown")
                        raw_input = payload.get("arguments", payload.get("input", ""))
                        if not isinstance(raw_input, str):
                            raw_input = json.dumps(raw_input)
                        messages.append(
                            {
                                "role": "assistant",
                                "type": "tool",
                                "tool": name,
                                "input_summary": raw_input[:200],
                                "ts": timestamp,
                            }
                        )
    except OSError:
        return []
    return messages


def list_sessions(
    root: Path,
    since: datetime | None = None,
    limit: int = 20,
    project: str | None = None,
) -> list[dict]:
    if not root.exists():
        return []

    sessions = []
    for jsonl in root.rglob("*.jsonl"):
        meta = read_metadata(jsonl)
        if not meta:
            continue
        created = parse_timestamp(meta.get("timestamp"))
        if not created:
            created = datetime.fromtimestamp(jsonl.stat().st_mtime, tz=timezone.utc)
        if since and created < since:
            continue

        cwd = meta.get("cwd", "")
        project_name = Path(cwd).name if cwd else "unknown"
        if project and project.lower() not in project_name.lower():
            continue

        messages = read_session(jsonl, include_tools=False)
        title = next(
            (message["text"][:80] for message in messages if message["role"] == "user"),
            "Codex session",
        )
        session_id = meta.get("id") or meta.get("session_id") or jsonl.stem
        parent_id = meta.get("parent_thread_id")
        sessions.append(
            {
                "id": session_id,
                "title": title,
                "directory": cwd,
                "time_created": int(created.timestamp() * 1000),
                "time_updated": int(jsonl.stat().st_mtime * 1000),
                "parent_id": parent_id,
                "source_file": str(jsonl),
                "is_subagent": bool(parent_id or meta.get("agent_role")),
                "model": meta.get("model", ""),
            }
        )

    sessions.sort(key=lambda session: session["time_created"], reverse=True)
    return sessions[:limit]


def session_to_markdown(path: str | Path) -> str | None:
    path = Path(path)
    meta = read_metadata(path)
    messages = read_session(path, include_tools=False)
    if not meta or not messages:
        return None

    session_id = meta.get("id") or meta.get("session_id") or path.stem
    cwd = meta.get("cwd", "")
    project = Path(cwd).name if cwd else "unknown"
    title = next(
        (message["text"][:80] for message in messages if message["role"] == "user"),
        "Codex session",
    )
    parent_id = meta.get("parent_thread_id")
    model = meta.get("model_provider", "unknown")

    lines = [
        "---",
        f"session_id: {session_id}",
        "source: codex",
        f'title: {json.dumps(title)}',
        f"project: {project}",
        f"directory: {cwd}",
        f"created: {meta.get('timestamp', '')}",
        f"model: {model}",
        f"is_subagent: {bool(parent_id or meta.get('agent_role'))}",
        f"source_file: {path}",
    ]
    if parent_id:
        lines.append(f"parent_session: {parent_id}")
    lines.extend(["---", ""])

    current_role = None
    for message in messages:
        if message["role"] != current_role:
            current_role = message["role"]
            lines.extend([f"## {'User' if current_role == 'user' else 'Assistant'}", ""])
        lines.extend([message["text"], ""])
    return "\n".join(lines)
