const MANA_COLORS = {
  W: { bg: '#f5f0cc', text: '#333' },
  U: { bg: '#1a6bbf', text: '#fff' },
  B: { bg: '#2a2a2a', text: '#ccc' },
  R: { bg: '#c93030', text: '#fff' },
  G: { bg: '#1e7a3e', text: '#fff' },
  C: { bg: '#c0b5a8', text: '#333' },
};

const COLOR_COMBOS = {
  1: [
    { label: 'White',     colors: ['W'] },
    { label: 'Blue',      colors: ['U'] },
    { label: 'Black',     colors: ['B'] },
    { label: 'Red',       colors: ['R'] },
    { label: 'Green',     colors: ['G'] },
  ],
  2: [
    { label: 'Azorius',   colors: ['W', 'U'] },
    { label: 'Orzhov',    colors: ['W', 'B'] },
    { label: 'Boros',     colors: ['W', 'R'] },
    { label: 'Selesnya',  colors: ['W', 'G'] },
    { label: 'Dimir',     colors: ['U', 'B'] },
    { label: 'Izzet',     colors: ['U', 'R'] },
    { label: 'Simic',     colors: ['U', 'G'] },
    { label: 'Rakdos',    colors: ['B', 'R'] },
    { label: 'Golgari',   colors: ['B', 'G'] },
    { label: 'Gruul',     colors: ['R', 'G'] },
  ],
  3: [
    { label: 'Esper',     colors: ['W', 'U', 'B'] },
    { label: 'Jeskai',    colors: ['W', 'U', 'R'] },
    { label: 'Bant',      colors: ['W', 'U', 'G'] },
    { label: 'Mardu',     colors: ['W', 'B', 'R'] },
    { label: 'Abzan',     colors: ['W', 'B', 'G'] },
    { label: 'Naya',      colors: ['W', 'R', 'G'] },
    { label: 'Grixis',    colors: ['U', 'B', 'R'] },
    { label: 'Sultai',    colors: ['U', 'B', 'G'] },
    { label: 'Temur',     colors: ['U', 'R', 'G'] },
    { label: 'Jund',      colors: ['B', 'R', 'G'] },
  ],
  4: [
    { label: 'Non-Green', colors: ['W', 'U', 'B', 'R'] },
    { label: 'Non-Red',   colors: ['W', 'U', 'B', 'G'] },
    { label: 'Non-Black', colors: ['W', 'U', 'R', 'G'] },
    { label: 'Non-Blue',  colors: ['W', 'B', 'R', 'G'] },
    { label: 'Non-White', colors: ['U', 'B', 'R', 'G'] },
  ],
  5: [
    { label: 'Five-Color', colors: ['W', 'U', 'B', 'R', 'G'] },
  ],
};

let allCommanders = [];
let filteredCommanders = [];
let selectedColorCount = null;
let selectedColorCombo = null;
let pauperOnly = false;

async function init() {
  initColorFilters();
  try {
    const resp = await fetch('../data/commanders.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    allCommanders = await resp.json();
    assignPoolRanks(allCommanders);
    applyFilters();
    document.getElementById('generate-btn').disabled = false;
  } catch (err) {
    const el = document.getElementById('pool-count');
    el.textContent = 'Failed to load data — run scripts/fetch_commanders.py first.';
    el.closest('.filter-footer').classList.add('error');
    console.error(err);
  }
}

function assignPoolRanks(commanders) {
  commanders.sort((a, b) => {
    if (a.edhrec_rank == null && b.edhrec_rank == null) return 0;
    if (a.edhrec_rank == null) return 1;
    if (b.edhrec_rank == null) return -1;
    return a.edhrec_rank - b.edhrec_rank;
  });
  commanders.forEach((c, i) => { c.pool_rank = i + 1; });
}

function applyFilters() {
  const minRank = parseOptInt(document.getElementById('min-rank').value);
  const maxRank = parseOptInt(document.getElementById('max-rank').value);
  const minCmc  = parseOptFloat(document.getElementById('min-cmc').value);
  const maxCmc  = parseOptFloat(document.getElementById('max-cmc').value);

  filteredCommanders = allCommanders.filter(c => {
    if (minRank !== null || maxRank !== null) {
      if (minRank !== null && c.pool_rank < minRank) return false;
      if (maxRank !== null && c.pool_rank > maxRank) return false;
    }

    if (minCmc !== null || maxCmc !== null) {
      if (c.cmc == null) return false;
      if (minCmc !== null && c.cmc < minCmc) return false;
      if (maxCmc !== null && c.cmc > maxCmc) return false;
    }

    if (pauperOnly && c.rarity !== 'uncommon') return false;

    if (selectedColorCount !== null) {
      const ci = c.color_identity || [];
      if (ci.length !== selectedColorCount) return false;
      if (selectedColorCombo !== null) {
        const cardSet = new Set(ci.map(x => x.toUpperCase()));
        if (!selectedColorCombo.every(x => cardSet.has(x))) return false;
      }
    }

    return true;
  });

  const n = filteredCommanders.length;
  document.getElementById('pool-count').textContent =
    `${n.toLocaleString()} commander${n !== 1 ? 's' : ''} in pool`;
  document.getElementById('generate-btn').disabled = n === 0;
}

function parseOptInt(val) {
  const s = val.trim();
  return s === '' ? null : parseInt(s, 10);
}

function parseOptFloat(val) {
  const s = val.trim();
  return s === '' ? null : parseFloat(s);
}

function initColorFilters() {
  document.getElementById('color-count-btns').addEventListener('click', e => {
    const btn = e.target.closest('.count-btn');
    if (!btn) return;
    document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const raw = btn.dataset.count;
    selectedColorCount = raw === '' ? null : parseInt(raw, 10);
    selectedColorCombo = null;
    updateComboBtns();
    applyFilters();
  });

  document.getElementById('color-combo-btns').addEventListener('click', e => {
    const btn = e.target.closest('.combo-btn');
    if (!btn) return;
    const wasActive = btn.classList.contains('active');
    document.querySelectorAll('.combo-btn').forEach(b => b.classList.remove('active'));
    selectedColorCombo = wasActive ? null : btn.dataset.colors.split(',');
    if (!wasActive) btn.classList.add('active');
    applyFilters();
  });
}

function updateComboBtns() {
  const row = document.getElementById('color-combo-row');
  const container = document.getElementById('color-combo-btns');

  if (selectedColorCount === null) {
    row.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  const combos = COLOR_COMBOS[selectedColorCount] || [];
  container.innerHTML = combos.map(combo => {
    const pips = combo.colors.map(c => {
      const col = MANA_COLORS[c];
      return `<span class="mini-pip" style="background:${col.bg}"></span>`;
    }).join('');
    return `<button class="filter-btn combo-btn" data-colors="${combo.colors.join(',')}">${pips}${combo.label}</button>`;
  }).join('');

  row.classList.remove('hidden');

  if (combos.length === 1) {
    container.querySelector('.combo-btn').classList.add('active');
    selectedColorCombo = combos[0].colors;
  }
}

function rollCommander() {
  if (filteredCommanders.length === 0) return;
  displayCommander(filteredCommanders[Math.floor(Math.random() * filteredCommanders.length)]);
}

function renderMana(manaCost) {
  if (!manaCost) return '';
  return [...manaCost.matchAll(/\{([^}]+)\}/g)]
    .map(([, token]) => {
      const col = MANA_COLORS[token.toUpperCase()];
      if (col) return `<span class="mana-pip" style="background:${col.bg};color:${col.text}">${token.toUpperCase()}</span>`;
      return `<span class="mana-pip mana-generic">${token}</span>`;
    }).join('');
}

function renderColorIdentity(colors) {
  if (!colors || colors.length === 0) {
    const c = MANA_COLORS.C;
    return `<span class="mana-pip" style="background:${c.bg};color:${c.text}">C</span>`;
  }
  return colors.map(key => {
    const col = MANA_COLORS[key.toUpperCase()];
    if (col) return `<span class="mana-pip" style="background:${col.bg};color:${col.text}">${key.toUpperCase()}</span>`;
    return `<span class="mana-pip mana-generic">${key}</span>`;
  }).join('');
}

function edhrecSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
}

function displayCommander(card) {
  document.getElementById('card-name').textContent = card.name;
  document.getElementById('card-type').textContent = card.type_line;
  document.getElementById('card-oracle').innerHTML = card.oracle_text.replace(/\n/g, '<br>');
  document.getElementById('card-mana-cost').innerHTML = renderMana(card.mana_cost);
  document.getElementById('card-colors').innerHTML = renderColorIdentity(card.color_identity);

  const img = document.getElementById('card-image');
  img.src = card.image_uri;
  img.alt = card.name;

  const pt = document.getElementById('card-pt');
  if (card.power != null && card.toughness != null) {
    pt.textContent = `${card.power}/${card.toughness}`;
    pt.style.display = '';
  } else {
    pt.style.display = 'none';
  }

  const rankEl = document.getElementById('card-edhrec-rank');
  rankEl.textContent = `Card rank amongst commanders #${card.pool_rank}`;

  document.getElementById('card-scryfall-link').href = card.scryfall_uri;
  document.getElementById('card-edhrec-link').href =
    `https://edhrec.com/commanders/${edhrecSlug(card.name)}`;

  const section = document.getElementById('card-display');
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('generate-btn').addEventListener('click', rollCommander);
['min-rank', 'max-rank', 'min-cmc', 'max-cmc'].forEach(id =>
  document.getElementById(id).addEventListener('input', applyFilters)
);
document.getElementById('pauper-toggle').addEventListener('click', function () {
  pauperOnly = !pauperOnly;
  this.dataset.active = pauperOnly;
  this.classList.toggle('active', pauperOnly);
  applyFilters();
});

init();
