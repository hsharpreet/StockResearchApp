const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

const loginTokens = new Map();
const tickers = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'NFLX', name: 'Netflix, Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'IBM', name: 'International Business Machines Corporation' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.' },
  { symbol: 'BABA', name: 'Alibaba Group Holding Limited' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'BAC', name: 'Bank of America Corporation' },
];

const stockOfDay = {
  date: new Date().toISOString(),
  symbol: 'NVDA',
  name: 'NVIDIA Corporation',
  direction: 'bullish',
  moveSummary: 'AI hardware demand remains strong with fresh enterprise orders.',
  thesis: [
    'Data center revenue momentum persists as generative AI adoption accelerates.',
    'Gaming GPU refresh cycle benefits from improving consumer spending.',
    'Margin profile remains resilient despite supply-chain normalization.',
  ],
  consensus: [
    { source: 'Reddit', score: 8.6, summary: 'Retail momentum and chatter about new GPU drops.' },
    { source: 'Analysts', score: 9.1, summary: 'Target hikes tied to robust data center growth.' },
    { source: 'Bloggers', score: 8.4, summary: 'AI leadership narrative remains intact.' },
    { source: 'YouTube', score: 8.8, summary: 'Creator community bullish on product roadmap.' },
    { source: 'TikTok', score: 7.9, summary: 'Trending clips on AI PC builds and GPU demand.' },
  ],
};

function generateLoginCode() {
  return crypto.randomInt(100000, 999999).toString();
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function pseudoScore(ticker, seed) {
  const hash = crypto.createHash('sha256').update(`${ticker}-${seed}`).digest('hex');
  const int = parseInt(hash.slice(0, 6), 16);
  return 6 + (int % 40) / 10; // score between 6 and 9.9
}

function buildResearch(tickerSymbol) {
  const base = tickers.find((t) => t.symbol.toLowerCase() === tickerSymbol.toLowerCase());
  if (!base) return null;

  const sentiment = pseudoScore(base.symbol, 'sentiment');
  const isBullish = sentiment >= 7.5;

  const thesis = [
    `${base.name} shows ${isBullish ? 'expanding' : 'moderating'} demand across core segments`,
    'Liquidity and balance sheet flexibility support ongoing investment pace',
    `Alt data points to ${isBullish ? 'upward' : 'mixed'} revisions in near-term estimates`,
  ];

  const consensus = [
    { source: 'Reddit', score: pseudoScore(base.symbol, 'reddit'), summary: 'Retail investor chatter and watchlists.' },
    { source: 'Analysts', score: pseudoScore(base.symbol, 'analysts'), summary: 'Street estimate revisions and PT changes.' },
    { source: 'Bloggers', score: pseudoScore(base.symbol, 'bloggers'), summary: 'Independent research and newsletter picks.' },
    { source: 'YouTube', score: pseudoScore(base.symbol, 'youtube'), summary: 'Creator breakdowns of catalysts and risks.' },
    { source: 'TikTok', score: pseudoScore(base.symbol, 'tiktok'), summary: 'Short-form buzz and momentum clips.' },
  ];

  return {
    symbol: base.symbol,
    name: base.name,
    retrievedAt: new Date().toISOString(),
    direction: isBullish ? 'bullish' : 'bearish',
    moveSummary: isBullish
      ? 'Momentum supported by improving demand signals and positive revisions.'
      : 'Caution around slowing indicators and profit-taking after a strong run.',
    thesis,
    consensus,
  };
}

function ensureAuthenticated(req, res, next) {
  if (req.session?.user?.email) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

app.post('/api/login', (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const code = generateLoginCode();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  loginTokens.set(email, { code, expiresAt });

  console.log(`Login code for ${email}: ${code}`);
  return res.json({ message: 'One-time login code sent. Check your email inbox.' });
});

app.post('/api/verify', (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  const code = (req.body?.code || '').trim();
  const record = loginTokens.get(email);

  if (!record) {
    return res.status(400).json({ error: 'No pending login found for that email' });
  }

  if (record.expiresAt < Date.now()) {
    loginTokens.delete(email);
    return res.status(400).json({ error: 'The login code has expired. Please request a new one.' });
  }

  if (record.code !== code) {
    return res.status(400).json({ error: 'Invalid code. Please try again.' });
  }

  loginTokens.delete(email);
  req.session.user = { email };
  return res.json({ email });
});

app.get('/api/session', (req, res) => {
  if (req.session?.user?.email) {
    return res.json({ authenticated: true, email: req.session.user.email });
  }
  return res.json({ authenticated: false });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/api/stock-of-day', ensureAuthenticated, (req, res) => {
  res.json({ ...stockOfDay, displayDate: formatDate(stockOfDay.date) });
});

app.get('/api/search', ensureAuthenticated, (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  if (!query) return res.json([]);
  const matches = tickers
    .filter(
      (t) => t.symbol.toLowerCase().includes(query) || t.name.toLowerCase().includes(query)
    )
    .slice(0, 10);
  res.json(matches);
});

app.get('/api/research/:ticker', ensureAuthenticated, (req, res) => {
  const ticker = req.params.ticker;
  const research = buildResearch(ticker);
  if (!research) return res.status(404).json({ error: 'Ticker not found' });

  res.json({ ...research, displayDate: formatDate(research.retrievedAt) });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
