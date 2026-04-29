"""
Fetches all MTG commanders from Scryfall's bulk data and writes data/commanders.json.

Usage:
    pip install requests
    python scripts/fetch_commanders.py
"""

import json
import os
import sys

import requests

BULK_DATA_URL = "https://api.scryfall.com/bulk-data"
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "commanders.json")
HEADERS = {"User-Agent": "oklahomies-edh/1.0"}

SKIP_LAYOUTS = {"token", "double_faced_token", "art_series", "emblem"}


def is_commander(card: dict) -> bool:
    if card.get("layout") in SKIP_LAYOUTS:
        return False
    type_line = card.get("type_line", "")
    oracle = card.get("oracle_text", "")
    return "Legendary Creature" in type_line or "can be your commander" in oracle


def get_image_uri(card: dict) -> str | None:
    def pick(uris: dict) -> str | None:
        return uris.get("normal") or uris.get("large") or uris.get("small")

    if "image_uris" in card:
        return pick(card["image_uris"])
    for face in card.get("card_faces", []):
        uri = pick(face.get("image_uris", {}))
        if uri:
            return uri
    return None


def fetch_oracle_cards() -> list[dict]:
    print("Fetching bulk data index...")
    resp = requests.get(BULK_DATA_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()

    entry = next((d for d in resp.json()["data"] if d["type"] == "oracle_cards"), None)
    if not entry:
        print("Error: oracle_cards not found in Scryfall bulk data.", file=sys.stderr)
        sys.exit(1)

    size_mb = entry.get("size", 0) / 1_000_000
    print(f"Downloading oracle cards ({size_mb:.0f} MB)...")
    data_resp = requests.get(entry["download_uri"], headers=HEADERS, timeout=300)
    data_resp.raise_for_status()
    return data_resp.json()


def main() -> None:
    all_cards = fetch_oracle_cards()
    print(f"Processing {len(all_cards):,} cards...")

    commanders = []
    for card in all_cards:
        if not is_commander(card):
            continue
        image_uri = get_image_uri(card)
        if not image_uri:
            continue
        commanders.append({
            "name": card["name"],
            "image_uri": image_uri,
            "oracle_text": card.get("oracle_text", ""),
            "edhrec_rank": card.get("edhrec_rank"),
            "mana_cost": card.get("mana_cost", ""),
            "type_line": card.get("type_line", ""),
            "color_identity": card.get("color_identity", []),
            "power": card.get("power"),
            "toughness": card.get("toughness"),
            "cmc": card.get("cmc"),
            "scryfall_uri": card.get("scryfall_uri", ""),
            "set_name": card.get("set_name", ""),
        })

    out = os.path.abspath(OUTPUT)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(commanders, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Done. Saved {len(commanders):,} commanders to {out}")


if __name__ == "__main__":
    main()
