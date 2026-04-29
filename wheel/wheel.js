const DEFAULTS = [
  'Group Hug',
  'Group Slug',
  'Companion',
  'Partners',
  'Mill',
  'Lifegain',
  'Tokens',
  'Mono-color',
  'Matching Colors',
  'True Kindred',
  'Hidden Commander',
  'Energy Management',
  'Voltron',
  'Aristocrats',
  'Spellslinger',
];

const COLORS = [
  '#c084fc',
  '#2266cc',
  '#cc3333',
  '#22884a',
  '#9944cc',
  '#dd7722',
  '#228899',
  '#cc4488',
  '#5588dd',
  '#885533',
  '#669922',
  '#ddcc22',
  '#336699',
  '#993355',
  '#33aa77',
];

// Each item: { label, active, color }
let items = DEFAULTS.map((label, i) => ({ label, active: true, color: COLORS[i % COLORS.length] }));

const canvas = document.getElementById('wheel-canvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spin-btn');
const resultDisplay = document.getElementById('result-display');
const resultText = document.getElementById('result-text');

const CX = canvas.width / 2;
const CY = canvas.height / 2;
const RADIUS = Math.min(CX, CY) - 30;

let rotation = 0;
let velocity = 0;
let spinning = false;

function activeItems() {
  return items.filter(item => item.active);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function truncateText(text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

// ── Wheel drawing ──────────────────────────────────────────────

function drawWheel() {
  const active = activeItems();
  const n = active.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (n === 0) return;

  const arc = (2 * Math.PI) / n;

  for (let i = 0; i < n; i++) {
    const start = rotation + i * arc;
    const end = start + arc;

    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, RADIUS, start, end);
    ctx.closePath();
    ctx.fillStyle = active[i].color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(start + arc / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 11.5px Georgia, serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;
    ctx.fillText(truncateText(active[i].label, RADIUS - 28), RADIUS - 14, 4);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(CX, CY, RADIUS, 0, 2 * Math.PI);
  ctx.strokeStyle = '#5b9fd6';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CX, CY, 16, 0, 2 * Math.PI);
  ctx.fillStyle = '#1e2338';
  ctx.fill();
  ctx.strokeStyle = '#5b9fd6';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawPointer();
}

function drawPointer() {
  const tipY = CY - RADIUS + 4;
  const baseY = CY - RADIUS - 24;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(CX, tipY);
  ctx.lineTo(CX - 13, baseY);
  ctx.lineTo(CX + 13, baseY);
  ctx.closePath();
  ctx.fillStyle = '#5b9fd6';
  ctx.shadowColor = 'rgba(91,159,214,0.7)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.strokeStyle = '#1e2338';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}

// ── Spin logic ─────────────────────────────────────────────────

function getWinnerIndex() {
  const n = activeItems().length;
  if (n === 0) return -1;
  const arc = (2 * Math.PI) / n;
  const angle = ((-Math.PI / 2 - rotation) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return Math.floor(angle / arc) % n;
}

function animate() {
  velocity *= 0.987;
  rotation += velocity;
  drawWheel();

  if (velocity > 0.002) {
    requestAnimationFrame(animate);
  } else {
    velocity = 0;
    spinning = false;
    spinBtn.textContent = 'Spin';
    spinBtn.disabled = false;
    showResult(getWinnerIndex());
  }
}

function spin() {
  if (spinning || activeItems().length === 0) return;
  spinning = true;
  spinBtn.textContent = 'Spinning…';
  spinBtn.disabled = true;
  resultDisplay.classList.add('hidden');
  clearWinnerHighlight();
  velocity = 0.22 + Math.random() * 0.18;
  requestAnimationFrame(animate);
}

// ── Result display ─────────────────────────────────────────────

function showResult(activeIdx) {
  if (activeIdx === -1) return;
  const active = activeItems();
  const winner = active[activeIdx];
  resultText.textContent = winner.label;
  resultText.style.color = winner.color;
  resultText.style.textShadow = `0 0 14px ${winner.color}`;
  resultDisplay.classList.remove('hidden');
  highlightWinner(items.indexOf(winner));
}

function highlightWinner(itemIdx) {
  document.querySelectorAll('#options-list li').forEach(li =>
    li.classList.toggle('winner', parseInt(li.dataset.index) === itemIdx)
  );
}

function clearWinnerHighlight() {
  document.querySelectorAll('#options-list li').forEach(li => li.classList.remove('winner'));
}

// ── Options list ───────────────────────────────────────────────

function renderList() {
  const ul = document.getElementById('options-list');
  const onlyOneActive = activeItems().length === 1;

  ul.innerHTML = items.map((item, i) => {
    const isLastActive = onlyOneActive && item.active;
    return `<li data-index="${i}" class="${item.active ? '' : 'inactive'}">
      <span class="option-dot" style="background:${item.active ? item.color : '#3a3a5a'}"></span>
      <span class="option-label">${escapeHtml(item.label)}</span>
      <button class="option-toggle" data-index="${i}"
        title="${item.active ? 'Remove from wheel' : 'Add to wheel'}"
        ${isLastActive ? 'disabled' : ''}>
        ${item.active ? '×' : '+'}
      </button>
    </li>`;
  }).join('');
}

function initListEvents() {
  document.getElementById('options-list').addEventListener('click', e => {
    const btn = e.target.closest('.option-toggle');
    if (!btn || btn.disabled) return;
    const idx = parseInt(btn.dataset.index);
    items[idx].active = !items[idx].active;
    clearWinnerHighlight();
    resultDisplay.classList.add('hidden');
    renderList();
    drawWheel();
  });
}

function initAddOption() {
  const input = document.getElementById('new-option-input');
  const btn = document.getElementById('add-option-btn');

  function addOption() {
    const label = input.value.trim();
    if (!label) return;
    items.push({ label, active: true, color: COLORS[items.length % COLORS.length] });
    input.value = '';
    clearWinnerHighlight();
    resultDisplay.classList.add('hidden');
    renderList();
    drawWheel();
  }

  btn.addEventListener('click', addOption);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') addOption(); });
}

// ── Init ───────────────────────────────────────────────────────

spinBtn.addEventListener('click', spin);
initListEvents();
initAddOption();
renderList();
drawWheel();
