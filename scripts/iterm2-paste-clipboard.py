#!/usr/bin/env python3
"""iTerm2 RPC: paste clipboard images as temporary file paths."""

import asyncio
import os
import subprocess
import tempfile
from typing import Optional

import iterm2


BRACKETED_PASTE_START = "\x1b[200~"
BRACKETED_PASTE_END = "\x1b[201~"


def clipboard_image_path() -> Optional[str]:
    fd, path = tempfile.mkstemp(prefix="opencode-clipboard-", suffix=".png")
    os.close(fd)

    escaped_path = path.replace("\\", "\\\\").replace('"', '\\"')
    expressions = [
        'set imageData to the clipboard as "PNGf"',
        f'set fileRef to open for access POSIX file "{escaped_path}" with write permission',
        "set eof fileRef to 0",
        "write imageData to fileRef",
        "close access fileRef",
    ]
    args = ["/usr/bin/osascript"]
    for expression in expressions:
        args.extend(["-e", expression])

    try:
        result = subprocess.run(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if result.returncode == 0 and os.path.getsize(path) > 0:
            return path
    except (OSError, subprocess.SubprocessError):
        pass

    try:
        os.unlink(path)
    except OSError:
        pass
    return None


def clipboard_text() -> Optional[str]:
    try:
        result = subprocess.run(
            ["/usr/bin/pbpaste"],
            capture_output=True,
            check=False,
        )
    except OSError:
        return None
    if result.returncode != 0 or not result.stdout:
        return None
    return result.stdout.decode("utf-8", errors="replace")


def clipboard_payload() -> Optional[str]:
    return clipboard_image_path() or clipboard_text()


async def main(connection):
    app = await iterm2.async_get_app(connection)

    @iterm2.RPC
    async def paste_clipboard(session_id=iterm2.Reference("id")):
        session = app.get_session_by_id(session_id)
        if session is None:
            return

        loop = asyncio.get_running_loop()
        payload = await loop.run_in_executor(None, clipboard_payload)
        if not payload:
            return

        await session.async_send_text(
            BRACKETED_PASTE_START + payload + BRACKETED_PASTE_END,
            suppress_broadcast=True,
        )

    await paste_clipboard.async_register(connection)


iterm2.run_forever(main)
