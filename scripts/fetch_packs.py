#!/usr/bin/env python3
"""
Pre-generates data/sets/index.json and data/sets/{CODE}.json for the pack cracker.
Uses Scryfall's search API to fetch booster-eligible cards per set.

Resumes from where it left off if interrupted.

Run: python scripts/fetch_packs.py
"""
import json
import ssl
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path
from collections import defaultdict

# Set types that have real draft/play boosters
PACKABLE_SET_TYPES = {'expansion', 'core', 'masters', 'draft_innovation', 'starter', 'funny'}

# Excluded despite packable type — Jumpstart is theme-based and can't be simulated
EXCLUDED_SETS = {'jmp', 'j22', 'j25', 'fbb', 'sum', '4bb'}

SETS_DIR = Path('data/sets')
DELAY    = 0.12   # stay under Scryfall's 10 req/sec limit


_SSL_CTX = ssl.create_default_context()

def api_get(url: str) -> dict:
    req = urllib.request.Request(url, headers={
        'User-Agent': 'oklahomies-edh/1.0 (macmecoy@gmail.com)',
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(req, context=_SSL_CTX) as r:
        return json.load(r)


def fetch_set_list() -> list:
    print('Fetching set list…')
    return api_get('https://api.scryfall.com/sets')['data']


def fetch_set_cards(code: str) -> list:
    """Fetch all booster-eligible cards for a set, handling pagination."""
    q = urllib.parse.quote(f'e:{code} is:booster')
    url = f'https://api.scryfall.com/cards/search?order=set&q={q}&unique=prints'
    cards = []
    while url:
        try:
            data = api_get(url)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return []
            raise
        cards.extend(data['data'])
        url = data.get('next_page') if data.get('has_more') else None
        if url:
            time.sleep(DELAY)
    return cards


def minimal_card(card: dict) -> dict:
    image_uri = ''
    if 'image_uris' in card:
        image_uri = card['image_uris'].get('normal') or card['image_uris'].get('large', '')
    elif 'card_faces' in card:
        face = card['card_faces'][0]
        if 'image_uris' in face:
            image_uri = face['image_uris'].get('normal') or face['image_uris'].get('large', '')
    return {
        'name': card['name'],
        'collector_number': card.get('collector_number', ''),
        'rarity': card['rarity'],
        'mana_cost': card.get('mana_cost', ''),
        'type_line': card.get('type_line', ''),
        'image_uri': image_uri,
    }


def bucket_cards(cards: list) -> dict:
    """Sort cards into rarity buckets, pulling basics and conspiracies into own buckets."""
    buckets = defaultdict(list)
    for card in cards:
        mc = minimal_card(card)
        tl = mc['type_line']
        if 'Conspiracy' in tl:
            buckets['conspiracies'].append(mc)
        elif 'Basic Land' in tl:
            buckets['basics'].append(mc)
        else:
            buckets[card['rarity']].append(mc)
    return buckets


def main():
    SETS_DIR.mkdir(parents=True, exist_ok=True)

    all_sets = fetch_set_list()
    packable = [
        s for s in all_sets
        if s['set_type'] in PACKABLE_SET_TYPES
        and s['code'].lower() not in EXCLUDED_SETS
        and s.get('card_count', 0) > 0
    ]
    packable.sort(key=lambda s: s.get('released_at', ''), reverse=True)
    print(f'Found {len(packable)} packable sets\n')

    # Resume support
    index_path = SETS_DIR / 'index.json'
    index = []
    done = set()
    if index_path.exists():
        with open(index_path, encoding='utf-8') as f:
            index = json.load(f)
        done = {e['code'].lower() for e in index}
        print(f'Resuming — {len(done)} sets already done, {len(packable) - len(done)} remaining\n')

    todo = [s for s in packable if s['code'].lower() not in done]

    for i, s in enumerate(todo, 1):
        code_lower = s['code'].lower()
        code_upper = s['code'].upper()
        overall    = len(done) + i
        print(f'  [{overall:>3}/{len(packable)}]  {code_upper}  {s["name"]}')

        try:
            cards = fetch_set_cards(code_lower)
        except Exception as e:
            print(f'    ERROR: {e}')
            time.sleep(DELAY)
            continue

        if not cards:
            print(f'    → no booster cards, skipping')
            time.sleep(DELAY)
            continue

        buckets = bucket_cards(cards)

        if not buckets.get('common') and not buckets.get('rare'):
            print(f'    → no commons or rares, skipping')
            time.sleep(DELAY)
            continue

        set_file = {
            'code':        code_upper,
            'name':        s['name'],
            'released_at': s.get('released_at', ''),
            'set_type':    s['set_type'],
            'commons':     buckets.get('common',      []),
            'uncommons':   buckets.get('uncommon',    []),
            'rares':       buckets.get('rare',        []),
            'mythics':     buckets.get('mythic',      []),
            'basics':      buckets.get('basics',      []),
            'conspiracies': buckets.get('conspiracies', []),
        }

        out = SETS_DIR / f'{code_upper}.json'
        with open(out, 'w', encoding='utf-8') as f:
            json.dump(set_file, f, separators=(',', ':'))

        index.append({
            'code':         code_upper,
            'name':         s['name'],
            'released_at':  s.get('released_at', ''),
            'set_type':     s['set_type'],
            'icon_svg_uri': s.get('icon_svg_uri', ''),
        })
        index.sort(key=lambda x: x.get('released_at', ''), reverse=True)

        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(index, f, separators=(',', ':'))

        total = sum(len(v) for v in buckets.values())
        breakdown = {k: len(v) for k, v in buckets.items() if v}
        print(f'    → {total} cards: {breakdown}')

        time.sleep(DELAY)

    print(f'\nDone. {len(index)} sets saved to {SETS_DIR}')


if __name__ == '__main__':
    main()
