"""Turn grade strings ("5.10b", "5.11-", "V4") into sortable numbers, and back into pyramid buckets.

Ropes use the Yosemite Decimal System (YDS); boulders use the V scale. The two scales are kept
apart (grade_system) because they measure different things, so an index is only comparable
within its own system.
"""

import re

YDS = "yds"
V = "v"

_LETTERS = "abcd"
_YDS_RE = re.compile(r"^5\.(\d{1,2})([abcd](?:/[abcd])?)?([+-])?")
_V_RE = re.compile(r"^V(\d{1,2}|B|-?easy)(?:-(\d{1,2}))?([+-])?", re.IGNORECASE)

V_BASE = 1000


def parse_grade(text: str) -> tuple[str, int, str]:
    """Return (system, index, cleaned_grade). Raises ValueError for unknown formats."""
    raw = text.strip()
    m = _YDS_RE.match(raw)
    if m:
        number = int(m.group(1))
        letters, sign = m.group(2), m.group(3)
        if number < 10:
            index = number * 10 + {"+": 3, "-": -3, None: 0}[sign]
        else:
            base = 100 + (number - 10) * 40
            if letters:
                offset = _LETTERS.index(letters[0]) * 10
                if "/" in letters:
                    offset += 5
            else:
                offset = {"-": 5, "+": 25, None: 15}[sign]
            index = base + offset
        return YDS, index, raw

    m = _V_RE.match(raw)
    if m:
        top = m.group(1).lower()
        number = 0 if top in ("b", "easy", "-easy") else int(top) + 1
        index = V_BASE + number * 10
        if m.group(2):  # range like V3-4: use the midpoint
            index += 5
        index += {"+": 3, "-": -3, None: 0}[m.group(3)]
        return V, index, raw

    raise ValueError(f"Unrecognized grade: {text!r}")


def bucket(system: str, index: int) -> str:
    """Pyramid bucket for an index: 5.9, 5.10a, 5.11c, V4 ..."""
    if system == V:
        number = (index - V_BASE + 3) // 10
        return "VB" if number <= 0 else f"V{number - 1}"
    if index < 100:
        return f"5.{max(0, (index + 3) // 10)}"
    number, rest = divmod(index - 100, 40)
    return f"5.{number + 10}{_LETTERS[min(3, rest // 10)]}"


def bucket_index(system: str, label: str) -> int:
    return parse_grade(label)[1]


def grade_options() -> dict[str, list[str]]:
    """Grades offered in the UI pickers."""
    yds = [f"5.{n}" for n in range(4, 10)] + [f"5.{n}{c}" for n in range(10, 16) for c in _LETTERS]
    v = ["VB"] + [f"V{n}" for n in range(0, 18)]
    return {YDS: yds, V: v}
