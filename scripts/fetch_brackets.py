#!/usr/bin/env python3
"""
Pre-generates data/brackets_list.json with bracket estimates for the top 500
commanders by EDHREC rank. Uses Commander Spellbook for combo detection.

Bracket logic (simplified — no EDHREC avg deck fetch):
  optimized  : has a 2-card combo
  upgraded   : is a Game Changer itself, OR has 3+ combos
  casual     : everything else

Run: python scripts/fetch_brackets.py
Re-running resumes from where it left off — already-processed commanders are skipped.
"""
import json
import sys
import time
from pathlib import Path

import requests

# Keep in sync with GAME_CHANGERS in brackets.js
GAME_CHANGERS = {
    'Cyclonic Rift', 'Demonic Tutor', 'Dockside Extortionist',
    'Fierce Guardianship', 'Jeweled Lotus', 'Mana Crypt', 'Mana Drain',
    'Mox Diamond', 'Rhystic Study', 'Smothering Tithe', "Thassa's Oracle",
    'Underworld Breach', 'Chrome Mox', 'Grim Monolith', 'Imperial Seal',
    'Mana Vault', 'Vampiric Tutor',
}

TOP_N        = 500
DELAY        = 0.75   # seconds between requests
RETRY_DELAYS = [10, 30, 60]  # backoff on 429
TIMEOUT      = 15
SAVE_EVERY   = 25     # write partial results to disk this often


def fetch_combos(name: str) -> dict:
    q = f'card:"{name}"'
    for attempt, wait in enumerate([0] + RETRY_DELAYS):
        if wait:
            print(f'    rate limited — waiting {wait}s before retry {attempt}…')
            time.sleep(wait)
        try:
            r = requests.get(
                'https://backend.commanderspellbook.com/variants/',
                params={'q': q, 'page_size': 20},
                timeout=TIMEOUT,
            )
            if r.status_code == 429:
                continue  # try next backoff
            r.raise_for_status()
            data = r.json()
            results = data.get('results') or []
            return {
                'count': data.get('count') or len(results),
                'has_two_card': any(len(v.get('uses', [])) == 2 for v in results),
            }
        except requests.exceptions.RequestException as e:
            if attempt == len(RETRY_DELAYS):
                raise
            print(f'    request error: {e}')
    raise RuntimeError(f'All retries exhausted for {name!r}')


def assign_bracket(is_gc: bool, combo_count: int, has_two_card: bool) -> str:
    if has_two_card:
        return 'optimized'
    if is_gc or combo_count >= 3:
        return 'upgraded'
    return 'casual'


def save(dest: Path, out: list):
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))


def main():
    src = Path('data/commanders.json')
    if not src.exists():
        print('data/commanders.json not found — run scripts/fetch_commanders.py first.')
        sys.exit(1)

    with open(src, encoding='utf-8') as f:
        all_cmds = json.load(f)

    ranked = sorted(
        (c for c in all_cmds if c.get('edhrec_rank')),
        key=lambda c: c['edhrec_rank'],
    )[:TOP_N]

    dest = Path('data/brackets_list.json')

    # Resume: load any existing results and skip already-processed names
    out = []
    done = set()
    if dest.exists():
        with open(dest, encoding='utf-8') as f:
            out = json.load(f)
        done = {entry['name'] for entry in out}
        print(f'Resuming — {len(done)} commanders already processed, {len(ranked) - len(done)} remaining.\n')
    else:
        print(f'Processing top {len(ranked)} commanders…\n')

    todo = [c for c in ranked if c['name'] not in done]
    total = len(ranked)

    for i, cmd in enumerate(todo, 1):
        name = cmd['name']
        is_gc = name in GAME_CHANGERS
        overall = len(done) + i

        try:
            combos = fetch_combos(name)
        except Exception as e:
            print(f'  [{overall:>3}/{total}] ERROR  {name}: {e}')
            combos = {'count': 0, 'has_two_card': False}

        bracket = assign_bracket(is_gc, combos['count'], combos['has_two_card'])

        out.append({
            'name': name,
            'image_uri': cmd.get('image_uri', ''),
            'edhrec_rank': cmd['edhrec_rank'],
            'color_identity': cmd.get('color_identity', []),
            'combo_count': combos['count'],
            'has_two_card_combo': combos['has_two_card'],
            'is_gc': is_gc,
            'bracket': bracket,
        })

        print(f'  [{overall:>3}/{total}] {bracket:<10}  {name}')

        if i % SAVE_EVERY == 0:
            save(dest, out)
            print(f'    ↳ saved progress ({len(out)} total)')

        time.sleep(DELAY)

    save(dest, out)

    counts = {}
    for entry in out:
        counts[entry['bracket']] = counts.get(entry['bracket'], 0) + 1

    print(f'\nDone. Saved {len(out)} commanders to {dest}')
    for b in ('optimized', 'upgraded', 'casual'):
        print(f'  {b}: {counts.get(b, 0)}')


if __name__ == '__main__':
    main()
