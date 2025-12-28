const elements = {
  authCard: document.getElementById('auth-card'),
  appContent: document.getElementById('app-content'),
  sessionState: document.getElementById('session-state'),
  authStatus: document.getElementById('auth-status'),
  researchStatus: document.getElementById('research-status'),
  loginForm: document.getElementById('login-form'),
  verifyForm: document.getElementById('verify-form'),
  emailInput: document.getElementById('email'),
  codeInput: document.getElementById('code'),
  tickerInput: document.getElementById('ticker'),
  tickerOptions: document.getElementById('ticker-options'),
  researchButton: document.getElementById('research-button'),
  tiles: document.getElementById('tiles'),
};

const state = {
  session: null,
  tiles: [],
};

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });

  if (res.status === 401) {
    showLoggedOut();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const message = detail.error || res.statusText;
    throw new Error(message);
  }

  return res.json();
}

function setStatus(target, message, tone = 'neutral') {
  if (!target) return;
  target.textContent = message || '';
  target.dataset.tone = tone;
}

function showLoggedIn(email) {
  elements.authCard.classList.add('hidden');
  elements.appContent.classList.remove('hidden');
  elements.sessionState.textContent = `Logged in as ${email}`;
}

function showLoggedOut() {
  elements.authCard.classList.remove('hidden');
  elements.appContent.classList.add('hidden');
  elements.sessionState.textContent = 'Not signed in';
  state.session = null;
  state.tiles = [];
  renderTiles();
}

function saveTiles() {
  if (!state.session?.email) return;
  const key = `stockresearch:tiles:${state.session.email}`;
  const tickers = state.tiles.filter((t) => !t.isStockOfDay).map((t) => t.symbol);
  localStorage.setItem(key, JSON.stringify(tickers));
}

function loadSavedTickers() {
  if (!state.session?.email) return [];
  const key = `stockresearch:tiles:${state.session.email}`;
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function renderTiles() {
  elements.tiles.innerHTML = '';
  state.tiles.forEach((tile) => {
    const card = document.createElement('article');
    card.className = 'tile';

    const header = document.createElement('div');
    header.className = 'tile-header';

    const left = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'ticker';
    title.textContent = `${tile.symbol} · ${tile.name}`;
    left.appendChild(title);

    const badges = document.createElement('div');
    badges.className = 'badges';
    const mood = document.createElement('span');
    mood.className = `badge ${tile.direction}`;
    mood.textContent = tile.direction === 'bullish' ? 'Bullish' : 'Bearish';
    badges.appendChild(mood);

    const tag = document.createElement('span');
    tag.className = 'badge';
    tag.textContent = tile.isStockOfDay ? 'Stock of the Day' : 'AI Research';
    badges.appendChild(tag);

    const date = document.createElement('span');
    date.className = 'badge';
    date.textContent = tile.displayDate;
    badges.appendChild(date);

    left.appendChild(badges);
    header.appendChild(left);

    if (!tile.isStockOfDay) {
      const del = document.createElement('button');
      del.className = 'delete-btn';
      del.textContent = 'Delete';
      del.addEventListener('click', () => removeTile(tile.symbol));
      header.appendChild(del);
    }

    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'tile-body';

    const summary = document.createElement('p');
    summary.textContent = tile.moveSummary;
    body.appendChild(summary);

    const thesis = document.createElement('ul');
    thesis.className = 'thesis';
    tile.thesis.forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      thesis.appendChild(li);
    });
    body.appendChild(thesis);

    const grid = document.createElement('div');
    grid.className = 'consensus-grid';
    tile.consensus.forEach((c) => {
      const card = document.createElement('div');
      card.className = 'consensus-card';
      const source = document.createElement('p');
      source.className = 'source';
      source.textContent = c.source;
      const bar = document.createElement('div');
      bar.className = 'bar';
      const span = document.createElement('span');
      span.style.width = `${Math.min(c.score, 10) * 10}%`;
      bar.appendChild(span);
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = `${c.score.toFixed(1)} / 10 · ${c.summary}`;
      card.append(source, bar, note);
      grid.appendChild(card);
    });
    body.appendChild(grid);

    const footer = document.createElement('div');
    footer.className = 'tile-footer';
    const timestamp = document.createElement('span');
    timestamp.textContent = tile.isStockOfDay ? 'Pinned daily idea' : 'Saved to your board';
    footer.appendChild(timestamp);

    card.append(body, footer);
    elements.tiles.appendChild(card);
  });
}

function removeTile(symbol) {
  state.tiles = state.tiles.filter((t) => t.symbol !== symbol || t.isStockOfDay);
  saveTiles();
  renderTiles();
}

async function checkSession() {
  try {
    const data = await fetchJson('/api/session');
    if (data.authenticated) {
      state.session = { email: data.email };
      showLoggedIn(data.email);
      await bootstrapTiles();
    } else {
      showLoggedOut();
    }
  } catch (err) {
    setStatus(elements.authStatus, err.message, 'error');
  }
}

async function bootstrapTiles() {
  state.tiles = [];
  renderTiles();
  await loadStockOfDay();
  const saved = loadSavedTickers();
  for (const ticker of saved) {
    await fetchResearch(ticker, { silentStatus: true });
  }
}

async function loadStockOfDay() {
  try {
    const data = await fetchJson('/api/stock-of-day');
    const tile = { ...data, isStockOfDay: true };
    // Always keep daily pick at the bottom of the stack
    state.tiles = [...state.tiles.filter((t) => !t.isStockOfDay), tile];
    renderTiles();
  } catch (err) {
    setStatus(elements.researchStatus, err.message, 'error');
  }
}

async function fetchResearch(ticker, options = {}) {
  if (!ticker) return;
  const { silentStatus = false } = options;
  try {
    if (!silentStatus) setStatus(elements.researchStatus, 'Researching...');
    const data = await fetchJson(`/api/research/${encodeURIComponent(ticker)}`);
    const tile = { ...data, isStockOfDay: false };
    const withoutDaily = state.tiles.filter((t) => !t.isStockOfDay && t.symbol !== tile.symbol);
    const daily = state.tiles.find((t) => t.isStockOfDay);
    state.tiles = [tile, ...withoutDaily, ...(daily ? [daily] : [])];
    saveTiles();
    renderTiles();
    setStatus(elements.researchStatus, '');
  } catch (err) {
    setStatus(elements.researchStatus, err.message, 'error');
  }
}

async function populateSuggestions(term) {
  if (!term) {
    elements.tickerOptions.innerHTML = '';
    return;
  }
  try {
    const results = await fetchJson(`/api/search?q=${encodeURIComponent(term)}`);
    elements.tickerOptions.innerHTML = results
      .map((r) => `<option value="${r.symbol}">${r.name}</option>`)
      .join('');
  } catch (err) {
    // silent
  }
}

function wireEvents() {
  elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = elements.emailInput.value.trim();
    if (!email) return;
    setStatus(elements.authStatus, 'Sending code...');
    try {
      await fetchJson('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStatus(elements.authStatus, 'Code sent. Check the server logs in this demo.', 'success');
      elements.verifyForm.classList.remove('hidden');
      elements.codeInput.focus();
    } catch (err) {
      setStatus(elements.authStatus, err.message, 'error');
    }
  });

  elements.verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = elements.emailInput.value.trim();
    const code = elements.codeInput.value.trim();
    if (!email || !code) return;
    setStatus(elements.authStatus, 'Verifying...');
    try {
      const data = await fetchJson('/api/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      state.session = { email: data.email };
      showLoggedIn(data.email);
      await bootstrapTiles();
      setStatus(elements.authStatus, '');
    } catch (err) {
      setStatus(elements.authStatus, err.message, 'error');
    }
  });

  elements.researchButton.addEventListener('click', async () => {
    const ticker = elements.tickerInput.value.trim().toUpperCase();
    if (!ticker) return;
    await fetchResearch(ticker);
    elements.tickerInput.value = '';
  });

  elements.tickerInput.addEventListener('input', (e) => {
    const term = e.target.value.trim();
    populateSuggestions(term);
  });
}

wireEvents();
checkSession();
