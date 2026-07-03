"""Generate SkyQuest's compact municipal lighting index from the Cerema GeoPackage.

Dataset:
https://www.data.gouv.fr/datasets/cartographie-nationale-des-pratiques-declairage-nocturne

Usage:
    python scripts/generate-cerema-lighting-index.py path/to/source.gpkg
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
from pathlib import Path

SOURCE_TABLE = "vecteur_extinction_communes"
OUTPUT_PATH = (
    Path(__file__).resolve().parents[1]
    / "lib"
    / "data"
    / "cerema-lighting-practices-2026.json"
)
DATE_PATTERN = re.compile(r"20\d\d-(?:0[1-9]|1[0-2])")

CATEGORY_CODES = {
    "probable_extinction": "E",
    "probable_reduction": "R",
    "abandoned_reduction": "A",
    "lighting_extension": "D",
    "outside_light_footprint": "HT",
}


def latest_date(value: str | None) -> str:
    return max(DATE_PATTERN.findall(value or ""), default="")


def select_latest_category(row: sqlite3.Row) -> tuple[str, str] | None:
    if row["changes_EP"] == "HT":
        return CATEGORY_CODES["outside_light_footprint"], ""

    # On equal dates, adverse signals win so the app remains conservative.
    candidates = [
        (latest_date(row["d_extinct"]), "probable_extinction", 1),
        (latest_date(row["d_renov"]), "probable_reduction", 2),
        (latest_date(row["d_abandon"]), "abandoned_reduction", 4),
        (latest_date(row["d_extens"]), "lighting_extension", 3),
    ]
    detected_at, category, _priority = max(candidates, key=lambda item: (item[0], item[2]))
    if not detected_at:
        return None
    return CATEGORY_CODES[category], detected_at


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Expected the source GeoPackage path as the only argument.")

    source_path = Path(sys.argv[1]).resolve()
    if not source_path.is_file():
        raise SystemExit(f"GeoPackage not found: {source_path}")

    connection = sqlite3.connect(source_path)
    connection.row_factory = sqlite3.Row
    query = f"""
        SELECT code_insee, changes_EP, d_extinct, d_renov, d_abandon, d_extens
        FROM {SOURCE_TABLE}
        ORDER BY code_insee
    """
    municipalities: dict[str, list[str]] = {}
    try:
        for row in connection.execute(query):
            selected = select_latest_category(row)
            if selected is None:
                continue
            category_code, detected_at = selected
            municipalities[row["code_insee"]] = [category_code, detected_at]
    finally:
        connection.close()

    payload = {
        "version": "2026-06-16",
        "source": "Cerema — Cartographie nationale des pratiques d'éclairage nocturne",
        "municipalities": municipalities,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True),
        encoding="utf-8",
    )
    print(f"Generated {len(municipalities)} municipal signals in {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
