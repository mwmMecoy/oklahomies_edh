// ── Pack configuration ──────────────────────────────────────────
//
// Mythic rate: 15 mythics / (15 + 53) rares = ~22% of rare slot
const MYTHIC_RATE = 15 / 68;

// Era cutoffs (ISO date strings for simple string comparison)
const PLAY_BOOSTER_FROM = '2024-02-09'; // Murders at Karlov Manor onwards
const MYTHIC_FROM       = '2008-10-03'; // Shards of Alara onwards

// Per-set overrides for non-standard pack structures
const SET_CONFIGS = {
  // Double Masters: 2 rares, 2 foils, no basics
  '2XM': { totalCards: 15, rares: 2, foils: 2, uncommons: 3, commons: 8, basics: 0 },
  // Double Masters 2022: same structure, Cryptic Spires replaces land slot
  '2X2': { totalCards: 15, rares: 2, foils: 2, uncommons: 3, commons: 7, basics: 0, crypticSpires: 1 },
  // Commander Legends: 20-card draft booster, 2 guaranteed legendaries, 1 foil
  'CMR': { totalCards: 20, rares: 1, foils: 1, legendarySlots: 2, uncommons: 3, commons: 13, basics: 0 },
  // Commander Legends: Battle for Baldur's Gate: same structure as CMR
  'CLB': { totalCards: 20, rares: 1, foils: 1, legendarySlots: 2, uncommons: 3, commons: 13, basics: 0 },
  // Conspiracy: draft-matters card replaces basic land slot
  'CNS': { totalCards: 15, rares: 1, uncommons: 3, commons: 10, basics: 0, conspiracySlot: true },
  'CN2': { totalCards: 15, rares: 1, uncommons: 3, commons: 10, basics: 0, conspiracySlot: true },
  // Battlebond: standard structure (partner rules handled naturally by random pick)
  'BBD': { totalCards: 15, rares: 1, uncommons: 3, commons: 10, basics: 1 },
};

function getPackConfig(setMeta) {
  if (SET_CONFIGS[setMeta.code]) return { ...SET_CONFIGS[setMeta.code] };

  // Masters sets: no basics, 1 guaranteed foil
  if (setMeta.set_type === 'masters') {
    return { totalCards: 15, rares: 1, foils: 1, uncommons: 3, commons: 10, basics: 0 };
  }

  // Play Booster era (MKM Feb 2024+): 14 cards, wildcard slots
  if (setMeta.released_at >= PLAY_BOOSTER_FROM) {
    return { totalCards: 14, rares: 1, uncommons: 3, commons: 6, basics: 1, wildcards: 2 };
  }

  // Mythic era (Shards of Alara Oct 2008 – Jan 2024): standard 15-card pack
  if (setMeta.released_at >= MYTHIC_FROM) {
    return { totalCards: 15, rares: 1, uncommons: 3, commons: 10, basics: 1 };
  }

  // Pre-mythic (all sets before Shards of Alara): no mythics in rare slot
  return { totalCards: 15, rares: 1, uncommons: 3, commons: 10, basics: 1, noMythics: true };
}

function packDescription(config) {
  const parts = [];
  if ((config.rares || 1) > 1) parts.push(`${config.rares} Rare/Mythic`);
  else parts.push('1 Rare/Mythic');
  if (config.legendarySlots) parts.push(`${config.legendarySlots} Legendary`);
  if (config.foils) parts.push(`${config.foils} Foil`);
  if (config.wildcards) parts.push(`${config.wildcards} Wildcard`);
  parts.push(`${config.uncommons} Uncommon`);
  parts.push(`${config.commons} Common`);
  if (config.conspiracySlot) parts.push('1 Conspiracy');
  if (config.crypticSpires) parts.push('1 Cryptic Spires');
  if (config.basics) parts.push('1 Basic Land');
  return `${config.totalCards} cards — ${parts.join(' · ')}`;
}

// ── Randomization helpers ───────────────────────────────────────

function pickRandom(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

// Pick a card not already in the pack by name (falls back to any if pool exhausted)
function pickUnique(pool, pack) {
  const used = new Set(pack.map(c => c.name));
  const fresh = pool.filter(c => !used.has(c.name));
  return fresh.length > 0 ? pickRandom(fresh) : pickRandom(pool);
}

// Wildcard slot for Play Boosters: weighted toward common, chance of uncommon or rare
function pickWildcard(setData, pack) {
  const roll = Math.random();
  if (roll < 1 / 30 && setData.rares.length > 0) {
    const isMythic = setData.mythics.length > 0 && Math.random() < MYTHIC_RATE;
    const pool = isMythic ? setData.mythics : setData.rares;
    return { ...pickUnique(pool, pack), slot: 'wildcard', wildcardRarity: isMythic ? 'mythic' : 'rare' };
  }
  if (roll < 1 / 5 && setData.uncommons.length > 0) {
    return { ...pickUnique(setData.uncommons, pack), slot: 'wildcard', wildcardRarity: 'uncommon' };
  }
  return { ...pickUnique(setData.commons, pack), slot: 'wildcard', wildcardRarity: 'common' };
}

// ── Pack simulation ─────────────────────────────────────────────

function crackPack(setData, setMeta) {
  const config = getPackConfig(setMeta);
  const pack = [];

  // Rare / Mythic slot(s)
  const hasMythics = !config.noMythics && setData.mythics.length > 0;
  for (let i = 0; i < (config.rares || 1); i++) {
    const isMythic = hasMythics && Math.random() < MYTHIC_RATE;
    const pool = isMythic ? setData.mythics : setData.rares;
    pack.push({ ...pickUnique(pool, pack), slot: 'rare', isMythic });
  }

  // Foil slot (masters, Double Masters, Commander Legends)
  if (config.foils) {
    const allCards = [
      ...setData.commons,
      ...setData.uncommons,
      ...setData.rares,
      ...(setData.mythics || []),
    ];
    for (let i = 0; i < config.foils; i++) {
      pack.push({ ...pickRandom(allCards), slot: 'foil', isFoil: true });
    }
  }

  // Legendary slots (Commander Legends)
  if (config.legendarySlots) {
    const legendaryPool = [
      ...setData.commons,
      ...setData.uncommons,
      ...setData.rares,
      ...(setData.mythics || []),
    ].filter(c => c.type_line && c.type_line.includes('Legendary'));

    const fallback = [...setData.uncommons, ...setData.rares];
    for (let i = 0; i < config.legendarySlots; i++) {
      const pool = legendaryPool.length > 0 ? legendaryPool : fallback;
      pack.push({ ...pickUnique(pool, pack), slot: 'legendary' });
    }
  }

  // Conspiracy slot (Conspiracy sets)
  if (config.conspiracySlot && setData.conspiracies && setData.conspiracies.length > 0) {
    pack.push({ ...pickUnique(setData.conspiracies, pack), slot: 'special' });
  }

  // Wildcard slots (Play Boosters)
  if (config.wildcards) {
    for (let i = 0; i < config.wildcards; i++) {
      pack.push(pickWildcard(setData, pack));
    }
  }

  // Uncommons
  for (let i = 0; i < config.uncommons; i++) {
    pack.push({ ...pickUnique(setData.uncommons, pack), slot: 'uncommon' });
  }

  // Commons
  for (let i = 0; i < config.commons; i++) {
    pack.push({ ...pickUnique(setData.commons, pack), slot: 'common' });
  }

  // Basic land
  if (config.basics > 0 && setData.basics && setData.basics.length > 0) {
    pack.push({ ...pickRandom(setData.basics), slot: 'land' });
  }

  // Cryptic Spires (2X2 special dual land)
  if (config.crypticSpires && setData.basics && setData.basics.length > 0) {
    const spires = setData.basics.filter(c => c.name === 'Cryptic Spires');
    if (spires.length > 0) pack.push({ ...spires[0], slot: 'land' });
  }

  return pack;
}

// ── Data loading ────────────────────────────────────────────────

let setsIndex = [];
let currentSetData = null;
let currentSetMeta = null;

async function loadIndex() {
  const el = document.getElementById('set-select');
  el.disabled = true;
  try {
    const resp = await fetch('../data/sets/index.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    setsIndex = await resp.json();
    buildSetSelector(setsIndex);
    el.disabled = false;
  } catch {
    el.innerHTML = '<option>Run scripts/fetch_packs.py first</option>';
  }
}

async function loadSet(code) {
  currentSetMeta = setsIndex.find(s => s.code === code);
  if (!currentSetMeta) return;

  document.getElementById('crack-btn').disabled = true;
  document.getElementById('pack-info').textContent = 'Loading…';

  try {
    const resp = await fetch(`../data/sets/${code}.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    currentSetData = await resp.json();
    const config = getPackConfig(currentSetMeta);
    document.getElementById('pack-info').textContent = packDescription(config);
    document.getElementById('crack-btn').disabled = false;
  } catch {
    document.getElementById('pack-info').textContent = 'Failed to load set data.';
  }
}

// ── Set selector ────────────────────────────────────────────────

function buildSetSelector(sets) {
  const select = document.getElementById('set-select');
  const byYear = {};

  sets.forEach(s => {
    const year = s.released_at ? s.released_at.slice(0, 4) : 'Unknown';
    (byYear[year] = byYear[year] || []).push(s);
  });

  const years = Object.keys(byYear).sort().reverse();
  select.innerHTML = '<option value="">— Select a set —</option>';

  years.forEach(year => {
    const og = document.createElement('optgroup');
    og.label = year;
    byYear[year].forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.code;
      opt.textContent = s.name;
      og.appendChild(opt);
    });
    select.appendChild(og);
  });
}

// ── Display ─────────────────────────────────────────────────────

const SLOT_ORDER = { rare: 0, foil: 1, legendary: 2, special: 3, wildcard: 4, uncommon: 5, common: 6, land: 7 };

function displayPack(pack) {
  const container = document.getElementById('pack-display');
  container.innerHTML = '';
  container.classList.remove('hidden');

  const sorted = [...pack].sort(
    (a, b) => (SLOT_ORDER[a.slot] ?? 5) - (SLOT_ORDER[b.slot] ?? 5)
  );

  sorted.forEach((card, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'pack-card';
    wrapper.style.animationDelay = `${i * 40}ms`;

    if (card.isMythic) wrapper.classList.add('mythic');
    else if (card.slot === 'rare') wrapper.classList.add('rare');
    if (card.isFoil) wrapper.classList.add('foil');
    if (card.slot === 'legendary') wrapper.classList.add('legendary');
    if (card.slot === 'wildcard' && (card.wildcardRarity === 'rare' || card.wildcardRarity === 'mythic')) {
      wrapper.classList.add(card.wildcardRarity === 'mythic' ? 'mythic' : 'rare');
    }

    if (card.image_uri) {
      const img = document.createElement('img');
      img.src = card.image_uri;
      img.alt = card.name;
      img.loading = 'lazy';
      wrapper.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'card-placeholder';
      placeholder.textContent = card.name;
      wrapper.appendChild(placeholder);
    }

    const label = document.createElement('div');
    label.className = 'card-label';
    const badges = [];
    if (card.isMythic) badges.push('<span class="badge badge-mythic">Mythic</span>');
    else if (card.slot === 'rare') badges.push('<span class="badge badge-rare">Rare</span>');
    if (card.isFoil) badges.push('<span class="badge badge-foil">Foil</span>');
    if (card.slot === 'legendary') badges.push('<span class="badge badge-legendary">Legendary</span>');
    if (card.slot === 'wildcard') badges.push('<span class="badge badge-wild">Wild</span>');
    if (badges.length) label.innerHTML = badges.join('');
    wrapper.appendChild(label);

    container.appendChild(wrapper);
  });
}

// ── Init ────────────────────────────────────────────────────────

document.getElementById('set-select').addEventListener('change', function () {
  document.getElementById('pack-display').classList.add('hidden');
  document.getElementById('crack-btn').disabled = true;
  document.getElementById('pack-info').textContent = '';
  if (this.value) loadSet(this.value);
});

document.getElementById('crack-btn').addEventListener('click', () => {
  if (!currentSetData || !currentSetMeta) return;
  const pack = crackPack(currentSetData, currentSetMeta);
  displayPack(pack);
});

loadIndex();
