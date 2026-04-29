// Game Changers per Commander RC rules — update this list as the RC revises it
const GAME_CHANGERS = new Set([
  'Cyclonic Rift',
  'Demonic Tutor',
  'Dockside Extortionist',
  'Fierce Guardianship',
  'Jeweled Lotus',
  'Mana Crypt',
  'Mana Drain',
  'Mox Diamond',
  'Rhystic Study',
  'Smothering Tithe',
  "Thassa's Oracle",
  'Underworld Breach',
  'Chrome Mox',
  'Grim Monolith',
  'Imperial Seal',
  'Mana Vault',
  'Vampiric Tutor',
]);

const BRACKET_INFO = {
  casual:    { label: 'Casual (1–2)',    color: '#4caf81', desc: 'No game changers detected in the average deck and no known infinite combos. Typical precon or lightly upgraded territory.' },
  upgraded:  { label: 'Upgraded (3)',    color: '#e6a838', desc: 'Game changers or known infinite combos present in the average deck.' },
  optimized: { label: 'Optimized (4–5)', color: '#d96868', desc: 'Multiple game changers or a combination of game changers and heavy combo presence. High-powered or cEDH territory.' },
};

let commanders = [];

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function toEdhrecSlug(name) {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function loadCommanders() {
  const resp = await fetch('../data/commanders.json');
  commanders = await resp.json();
}

// ── Autocomplete ───────────────────────────────────────────────

function initAutocomplete() {
  const input = document.getElementById('commander-search');
  const dropdown = document.getElementById('search-dropdown');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { dropdown.classList.add('hidden'); return; }

    const matches = commanders
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, 15);

    if (matches.length === 0) { dropdown.classList.add('hidden'); return; }

    dropdown.innerHTML = matches
      .map(c => `<li data-name="${escapeHtml(c.name)}">${escapeHtml(c.name)}</li>`)
      .join('');
    dropdown.classList.remove('hidden');
  });

  dropdown.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    input.value = li.dataset.name;
    dropdown.classList.add('hidden');
    analyze(li.dataset.name);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) dropdown.classList.add('hidden');
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      dropdown.classList.add('hidden');
      const name = input.value.trim();
      if (name) analyze(name);
    }
  });
}

// ── API fetches ─────────────────────────────────────────────────

async function fetchEdhrecDeck(slug) {
  const resp = await fetch(`https://json.edhrec.com/pages/commanders/${slug}.json`);
  if (!resp.ok) throw new Error(`EDHREC returned ${resp.status}`);
  return resp.json();
}

function extractCardNames(data) {
  const json_dict = data?.container?.json_dict ?? data;
  const cardlists = json_dict?.cardlists ?? [];
  const names = new Set();
  for (const list of cardlists) {
    for (const card of (list.cardviews ?? [])) {
      if (card.name) names.add(card.name);
    }
  }
  return names;
}

async function fetchCombos(commanderName) {
  const q = encodeURIComponent(`card:"${commanderName}"`);
  const resp = await fetch(
    `https://backend.commanderspellbook.com/variants/?q=${q}&page_size=10`
  );
  if (!resp.ok) throw new Error(`Spellbook returned ${resp.status}`);
  const data = await resp.json();
  const results = data.results ?? [];
  return {
    count: data.count ?? results.length,
    hasTwoCardCombo: results.some(v => (v.uses ?? []).length === 2),
    samples: results.slice(0, 5).map(v => ({
      produces: (v.produces ?? [])
        .map(p => p.feature?.name ?? '')
        .filter(Boolean)
        .join(', '),
    })),
  };
}

// ── Bracket logic ───────────────────────────────────────────────

function calculateBracket(gcCount, comboCount, hasTwoCardCombo) {
  if (gcCount >= 3 || hasTwoCardCombo) return 'optimized';
  if (gcCount >= 1 || comboCount >= 3) return 'upgraded';
  return 'casual';
}

// ── Analysis ────────────────────────────────────────────────────

async function analyze(rawName) {
  const commander = commanders.find(
    c => c.name.toLowerCase() === rawName.toLowerCase()
  );
  if (!commander) {
    showError(`"${escapeHtml(rawName)}" not found in the commander dataset.`);
    return;
  }

  showLoading(commander.name);

  const slug = toEdhrecSlug(commander.name);
  const [deckResult, comboResult] = await Promise.allSettled([
    fetchEdhrecDeck(slug),
    fetchCombos(commander.name),
  ]);

  let gcInDeck = [];
  let deckError = null;
  if (deckResult.status === 'fulfilled') {
    const names = extractCardNames(deckResult.value);
    gcInDeck = [...GAME_CHANGERS].filter(gc => names.has(gc));
  } else {
    deckError = 'Could not fetch EDHREC average deck data.';
  }

  let comboData = { count: 0, hasTwoCardCombo: false, samples: [] };
  let comboError = null;
  if (comboResult.status === 'fulfilled') {
    comboData = comboResult.value;
  } else {
    comboError = 'Could not fetch Commander Spellbook combo data.';
  }

  const commanderIsGC = GAME_CHANGERS.has(commander.name);
  const totalGC = gcInDeck.length + (commanderIsGC ? 1 : 0);
  const bracket = calculateBracket(totalGC, comboData.count, comboData.hasTwoCardCombo);

  showResult({ commander, bracket, gcInDeck, commanderIsGC, comboData, deckError, comboError });
}

// ── Display ─────────────────────────────────────────────────────

function showLoading(name) {
  const el = document.getElementById('bracket-result');
  el.classList.remove('hidden');
  el.innerHTML = `<div class="br-loading">Analyzing <strong>${escapeHtml(name)}</strong>…</div>`;
}

function showError(msg) {
  const el = document.getElementById('bracket-result');
  el.classList.remove('hidden');
  el.innerHTML = `<div class="br-error">${msg}</div>`;
}

function showResult({ commander, bracket, gcInDeck, commanderIsGC, comboData, deckError, comboError }) {
  const info = BRACKET_INFO[bracket];

  let gcBody;
  if (deckError) {
    gcBody = `<p class="br-fetch-error">${escapeHtml(deckError)}</p>`;
  } else if (gcInDeck.length === 0 && !commanderIsGC) {
    gcBody = '<p class="br-none">None detected in average deck.</p>';
  } else {
    const rows = [];
    if (commanderIsGC) {
      rows.push(`<li class="gc-commander">${escapeHtml(commander.name)} <span class="gc-tag">commander</span></li>`);
    }
    gcInDeck.forEach(gc => rows.push(`<li>${escapeHtml(gc)}</li>`));
    gcBody = `<ul class="br-list">${rows.join('')}</ul>`;
  }

  let comboBody;
  if (comboError) {
    comboBody = `<p class="br-fetch-error">${escapeHtml(comboError)}</p>`;
  } else if (comboData.count === 0) {
    comboBody = '<p class="br-none">No known infinite combos as commander.</p>';
  } else {
    const samples = comboData.samples
      .filter(c => c.produces)
      .map(c => `<li>${escapeHtml(c.produces)}</li>`)
      .join('');
    const more = comboData.count > 5
      ? `<p class="br-more">…and ${comboData.count - 5} more</p>` : '';
    comboBody = `
      <p class="br-combo-count">${comboData.count} known combo${comboData.count !== 1 ? 's' : ''} found</p>
      ${samples ? `<ul class="br-list">${samples}</ul>` : ''}
      ${more}`;
  }

  document.getElementById('bracket-result').innerHTML = `
    <div class="br-card">
      ${commander.image_uri ? `<div class="br-img"><img src="${escapeHtml(commander.image_uri)}" alt="${escapeHtml(commander.name)}"></div>` : ''}
      <div class="br-details">
        <div class="br-header">
          <h2>${escapeHtml(commander.name)}</h2>
          <span class="br-badge" style="background:${info.color}">${info.label}</span>
        </div>
        <p class="br-desc">${info.desc}</p>
        <div class="br-section">
          <h3>Game Changers in Average Deck</h3>
          ${gcBody}
        </div>
        <div class="br-section">
          <h3>Known Combos (as Commander)</h3>
          ${comboBody}
        </div>
      </div>
    </div>`;
}

// ── Browse mode ─────────────────────────────────────────────────

const COLOR_STYLE = {
  W: 'background:#f0ede0;color:#333',
  U: 'background:#0e68ab;color:#fff',
  B: 'background:#2a1f1d;color:#ddd',
  R: 'background:#d3202a;color:#fff',
  G: 'background:#00733e;color:#fff',
  C: 'background:#6e6e6e;color:#fff',
};

let bracketListData = null;
let activeBracket = 'optimized';

async function loadBracketList() {
  if (bracketListData) { renderBracketList(activeBracket); return; }

  document.getElementById('bracket-list-container').innerHTML =
    '<div class="br-loading">Loading bracket data…</div>';

  try {
    const resp = await fetch('../data/brackets_list.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    bracketListData = await resp.json();
    updateTabCounts();
    renderBracketList(activeBracket);
  } catch {
    document.getElementById('bracket-list-container').innerHTML =
      '<div class="br-error">Bracket list not found — run <code>scripts/fetch_brackets.py</code> to generate it.</div>';
  }
}

function updateTabCounts() {
  const counts = {};
  bracketListData.forEach(c => { counts[c.bracket] = (counts[c.bracket] || 0) + 1; });
  document.querySelectorAll('.bracket-tab').forEach(btn => {
    const n = counts[btn.dataset.bracket] || 0;
    btn.innerHTML = `${btn.textContent.split('(')[0].trim()} <span class="tab-label">${btn.dataset.bracket === 'optimized' ? '(4–5)' : btn.dataset.bracket === 'upgraded' ? '(3)' : '(1–2)'}</span> <span class="tab-count">${n}</span>`;
  });
}

function renderBracketList(bracket) {
  const container = document.getElementById('bracket-list-container');
  const list = bracketListData.filter(c => c.bracket === bracket);

  if (list.length === 0) {
    container.innerHTML = '<p class="br-none" style="padding:1rem">No commanders in this bracket.</p>';
    return;
  }

  const rows = list.map(c => {
    const pips = (c.color_identity.length ? c.color_identity : ['C'])
      .map(ci => `<span class="bl-pip" style="${COLOR_STYLE[ci] || COLOR_STYLE.C}">${ci}</span>`)
      .join('');

    const badges = [
      c.has_two_card_combo ? '<span class="bl-badge bl-badge-combo">2-card</span>' : '',
      c.is_gc             ? '<span class="bl-badge bl-badge-gc">GC</span>'     : '',
    ].join('');

    return `<div class="bl-row">
      <img class="bl-thumb" src="${escapeHtml(c.image_uri)}" alt="" loading="lazy">
      <div class="bl-info">
        <span class="bl-name">${escapeHtml(c.name)}</span>
        <span class="bl-meta">
          <span class="bl-pips">${pips}</span>
          ${c.combo_count > 0 ? `<span class="bl-combos">${c.combo_count} combo${c.combo_count !== 1 ? 's' : ''}</span>` : ''}
          ${badges}
        </span>
      </div>
      <span class="bl-rank">#${c.edhrec_rank.toLocaleString()}</span>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="bl-list">${rows}</div>`;
}

function initBrowse() {
  document.querySelectorAll('.bracket-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bracket-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeBracket = btn.dataset.bracket;
      if (bracketListData) renderBracketList(activeBracket);
    });
  });
}

function initModeTabs() {
  const searchMode = document.getElementById('search-mode');
  const browseMode = document.getElementById('browse-mode');

  document.getElementById('mode-search').addEventListener('click', function () {
    document.querySelectorAll('.br-mode-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    searchMode.classList.remove('hidden');
    browseMode.classList.add('hidden');
  });

  document.getElementById('mode-browse').addEventListener('click', function () {
    document.querySelectorAll('.br-mode-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    searchMode.classList.add('hidden');
    browseMode.classList.remove('hidden');
    loadBracketList();
  });
}

// ── Init ────────────────────────────────────────────────────────

document.getElementById('analyze-btn').addEventListener('click', () => {
  const name = document.getElementById('commander-search').value.trim();
  if (name) analyze(name);
});

loadCommanders().then(() => initAutocomplete());
initModeTabs();
initBrowse();
