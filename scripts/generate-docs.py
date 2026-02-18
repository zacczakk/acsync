#!/usr/bin/env python3
"""Walk docs/ and print a catalog with summary + read_when hints from front-matter."""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = REPO_ROOT / "docs"
EXCLUDED_DIRS = {"archive", "research"}


def parse_doc_frontmatter(text: str) -> tuple[str | None, list[str], str | None]:
    """Extract summary and read_when from YAML-style front-matter.

    Returns (summary, read_when_list, error).
    """
    if not text.startswith("---"):
        return None, [], "missing front matter"

    end = text.find("\n---", 3)
    if end == -1:
        return None, [], "unterminated front matter"

    fm = text[3:end].strip()
    summary: str | None = None
    read_when: list[str] = []
    collecting_rw = False

    for line in fm.splitlines():
        stripped = line.strip()

        if stripped.startswith("summary:"):
            value = stripped[len("summary:") :].strip().strip("\"'")
            summary = value if value else None
            collecting_rw = False
            continue

        if stripped.startswith("read_when:"):
            collecting_rw = True
            inline = stripped[len("read_when:") :].strip()
            if inline.startswith("[") and inline.endswith("]"):
                items = [
                    s.strip().strip("\"'") for s in inline[1:-1].split(",") if s.strip()
                ]
                read_when.extend(items)
            continue

        if collecting_rw:
            if stripped.startswith("- "):
                hint = stripped[2:].strip().strip("\"'")
                if hint:
                    read_when.append(hint)
            elif stripped == "":
                pass
            else:
                collecting_rw = False

    if summary is None:
        return None, read_when, "summary key missing"
    return summary, read_when, None


def walk_docs(base: Path) -> list[Path]:
    """Recursively collect .md files, excluding certain dirs."""
    files: list[Path] = []
    if not base.exists():
        return files
    for item in sorted(base.iterdir()):
        if item.name.startswith("."):
            continue
        if item.is_dir():
            if item.name in EXCLUDED_DIRS:
                continue
            files.extend(walk_docs(item))
        elif item.suffix == ".md":
            files.append(item)
    return files


def main() -> None:
    md_files = walk_docs(DOCS_DIR)
    if not md_files:
        print("No docs found.")
        return

    print("Docs catalog:")
    errors = 0

    for path in md_files:
        rel = path.relative_to(DOCS_DIR)
        summary, read_when, error = parse_doc_frontmatter(path.read_text())

        if summary:
            print(f"  {rel} — {summary}")
            if read_when:
                print(f"    Read when: {'; '.join(read_when)}")
        else:
            errors += 1
            reason = f" [{error}]" if error else ""
            print(f"  {rel}{reason}")

    print(
        "\nReminder: keep docs up to date as behavior changes. "
        "When your task matches a 'Read when' hint above, read that doc before coding."
    )
    if errors:
        print(f"\n{errors} file(s) with front-matter issues.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
