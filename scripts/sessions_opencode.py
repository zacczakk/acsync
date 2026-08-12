"""OpenCode V2 session database access for the sessions CLI."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_DB = Path.home() / ".local" / "share" / "opencode-v2" / "opencode" / "opencode.db"


def open_db(db_path: Path = DEFAULT_DB) -> sqlite3.Connection:
    if not db_path.exists():
        raise FileNotFoundError(f"OpenCode V2 DB not found at {db_path}")
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def list_sessions(
    db_path: Path = DEFAULT_DB,
    since: datetime | None = None,
    limit: int = 20,
    project: str | None = None,
) -> list[dict]:
    conn = open_db(db_path)
    query = """
        SELECT id, title, directory, time_created, time_updated, parent_id
        FROM session_v2
    """
    conditions: list[str] = []
    params: list[object] = []
    if since:
        conditions.append("time_created >= ?")
        params.append(int(since.timestamp() * 1000))
    if project:
        conditions.append("directory LIKE ?")
        params.append(f"%/{project}%")
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY time_created DESC LIMIT ?"
    params.append(limit)
    try:
        rows = conn.execute(query, params).fetchall()
    finally:
        conn.close()
    return [dict(row) for row in rows]


def _decode(value: str) -> dict:
    try:
        decoded = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return {}
    return decoded if isinstance(decoded, dict) else {}


def _input_summary(value: object) -> str:
    if isinstance(value, dict):
        return json.dumps(value)[:200]
    return str(value)[:200]


def _message_items(
    record_type: str,
    raw_data: str,
    time_created: int,
    role_filter: str | None = None,
    include_tools: bool = True,
) -> list[dict]:
    data = _decode(raw_data)
    role = "user" if record_type == "user" else "assistant" if record_type == "assistant" else None
    if role is None or (role_filter and role_filter != role):
        return []

    if role == "user":
        text = data.get("text", "")
        if isinstance(text, str) and text.strip():
            return [{"role": role, "type": "text", "text": text.strip(), "ts": time_created}]
        return []

    content = data.get("content", [])
    if not isinstance(content, list):
        content = []
    messages = []
    for item in content:
        if not isinstance(item, dict):
            continue
        item_type = item.get("type")
        if item_type == "text":
            text = item.get("text", "")
            if isinstance(text, str) and text.strip():
                messages.append({"role": role, "type": "text", "text": text.strip(), "ts": time_created})
        elif item_type == "tool" and include_tools:
            state = item.get("state", {})
            state = state if isinstance(state, dict) else {}
            tool_name = item.get("name", "unknown")
            input_value = state.get("input", item.get("input", {}))
            messages.append(
                {
                    "role": role,
                    "type": "tool",
                    "tool": tool_name,
                    "input_summary": _input_summary(input_value),
                    "ts": time_created,
                }
            )
    return messages


def read_session(
    db_path: Path,
    session_id: str,
    role_filter: str | None = None,
    include_tools: bool = True,
) -> list[dict]:
    conn = open_db(db_path)
    rows = conn.execute(
        """
        SELECT type, time_created, data
        FROM session_message
        WHERE session_id = ?
        ORDER BY seq
        """,
        (session_id,),
    ).fetchall()
    conn.close()

    messages = []
    for row in rows:
        messages.extend(
            _message_items(
                row["type"],
                row["data"],
                row["time_created"],
                role_filter=role_filter,
                include_tools=include_tools,
            )
        )
    return messages


def text_blocks_since(db_path: Path, since_ts: int = 0) -> list[tuple[str, str, str, int]]:
    """Return visible text blocks newer than a timestamp."""
    conn = open_db(db_path)
    rows = conn.execute(
        """
        SELECT session_id, type, time_created, seq, data
        FROM session_message
        WHERE time_created > ?
        ORDER BY time_created, session_id, seq
        """,
        (since_ts,),
    ).fetchall()
    conn.close()

    blocks = []
    for row in rows:
        for message in _message_items(
            row["type"], row["data"], row["time_created"], include_tools=False
        ):
            if message["type"] == "text":
                blocks.append(
                    (row["session_id"], message["role"], message["text"], row["time_created"])
                )
    return blocks


def _model_label(value: object) -> str:
    if not value:
        return "unknown"
    decoded = value
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
        except json.JSONDecodeError:
            return value
    if isinstance(decoded, dict):
        model_id = decoded.get("id")
        provider_id = decoded.get("providerID")
        if model_id and provider_id:
            return f"{provider_id}/{model_id}"
        if model_id:
            return str(model_id)
    return str(value)


def session_to_markdown(db_path: Path, session_id: str) -> str | None:
    conn = open_db(db_path)
    row = conn.execute(
        """
        SELECT id, title, directory, time_created, parent_id, model
        FROM session_v2
        WHERE id = ?
        """,
        (session_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None

    messages = read_session(db_path, session_id, include_tools=False)
    if not messages:
        return None

    title = row["title"] or "OpenCode V2 session"
    directory = row["directory"]
    project = Path(directory).name if directory else "unknown"
    created = datetime.fromtimestamp(row["time_created"] / 1000, tz=timezone.utc)
    lines = [
        "---",
        f"session_id: {session_id}",
        "source: opencode2",
        f"title: {json.dumps(title)}",
        f"project: {project}",
        f"directory: {directory}",
        f"created: {created.strftime('%Y-%m-%dT%H:%M:%SZ')}",
        f"model: {_model_label(row['model'])}",
    ]
    if row["parent_id"]:
        lines.append(f"parent_session: {row['parent_id']}")
    lines.extend(["---", ""])

    current_role = None
    for message in messages:
        if message["role"] != current_role:
            current_role = message["role"]
            lines.extend([f"## {'User' if current_role == 'user' else 'Assistant'}", ""])
        lines.extend([message["text"], ""])
    return "\n".join(lines)


def stats(db_path: Path) -> dict:
    conn = open_db(db_path)
    try:
        total = conn.execute("SELECT count(*) FROM session_v2").fetchone()[0]
        top_level = conn.execute(
            "SELECT count(*) FROM session_v2 WHERE parent_id IS NULL"
        ).fetchone()[0]
        messages = conn.execute("SELECT count(*) FROM session_message").fetchone()[0]
        user_text = conn.execute(
            """
            SELECT count(*)
            FROM session_message
            WHERE type = 'user' AND trim(json_extract(data, '$.text')) <> ''
            """
        ).fetchone()[0]
        assistant_text = conn.execute(
            """
            SELECT count(*)
            FROM session_message, json_each(session_message.data, '$.content')
            WHERE session_message.type = 'assistant'
              AND json_extract(json_each.value, '$.type') = 'text'
              AND trim(json_extract(json_each.value, '$.text')) <> ''
            """
        ).fetchone()[0]
    finally:
        conn.close()
    return {
        "sessions_total": total,
        "sessions_top_level": top_level,
        "sessions_subagent": total - top_level,
        "messages": messages,
        "text_parts": user_text + assistant_text,
    }
