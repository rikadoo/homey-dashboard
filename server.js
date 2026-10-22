'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 8080);
const MOCK = process.env.MOCK === '1' || !process.env.HOMEY_TOKEN;
const EDIT_PIN = process.env.EDIT_PIN || '';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const LAYOUT_FILE = path.join(DATA_DIR, 'layout.json');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Homey adapter (echte Homey of demo-modus)
// ---------------------------------------------------------------------------
const homey = MOCK ? require('./lib/mock') : require('./lib/homey');

// ---------------------------------------------------------------------------
// Layout opslag
// ---------------------------------------------------------------------------
function defaultLayout() {
  const base = {
    version: 1,
    settings: {
      title: 'Thuis',
      theme: 'glass',
      background: 'ocean',
      cellSize: 130,
      gap: 12,
      returnHomeAfter: 60,
      nightDim: { enabled: false, from: '23:00', to: '06:30', opacity: 0.35 },
      showClock: true,
    },
    pages: [{ id: 'p_home', name: 'Thuis', icon: 'house', tiles: [] }],
  };
  if (MOCK) { base.pages = require('./lib/mock').demoPages(); base.settings.weatherPlace = 'Demo'; base.settings.background = 'aurora'; base.settings.doorbell = { deviceId: 'd_cam2', capability: 'last_ring_at' }; base.settings.screensaver = { mode: 'off', after: 5 }; }
  return base;
}

function loadLayout() {
  try {
    return JSON.parse(fs.readFileSync(LAYOUT_FILE, 'utf8'));
  } catch {
    const l = defaultLayout();
    saveLayout(l);
    return l;
  }
}

function saveLayout(layout) {
  const tmp = LAYOUT_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(layout, null, 2));
  fs.renameSync(tmp, LAYOUT_FILE);
  // Eenvoudige back-up: bewaar de laatste 20 versies
  const bdir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(bdir, { recursive: true });
  fs.writeFileSync(path.join(bdir, `layout-${Date.now()}.json`), JSON.stringify(layout));
  const files = fs.readdirSync(bdir).sort();
  while (files.length > 20) fs.unlinkSync(path.join(bdir, files.shift()));
}

let layout = loadLayout();

const history = require('./lib/history')({
  dataDir: DATA_DIR, getStates: () => homey.getStates(), getLayout: () => layout, mock: MOCK,
  getInsights: MOCK ? null : (d, c) => homey.getInsights(d, c),
});
const events = require('./lib/events')({
  dataDir: DATA_DIR, getLayout: () => layout, getStates: () => homey.getStates(),
  getCatalog: () => homey.getCatalog(), broadcast: msg => broadcast(msg),
});
const { getWeather } = require('./lib/weather');

// ---------------------------------------------------------------------------
// Bewerk-sessies (pincode)
// ---------------------------------------------------------------------------
const editTokens = new Set();
function requireEdit(req, res, next) {
  if (!EDIT_PIN) return next();
  if (editTokens.has(req.get('x-edit-token'))) return next();
  res.status(401).json({ error: 'Pincode nodig om te bewerken' });
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '2mb' }));

// ---------------------------------------------------------------------------
// Beveiliging (optioneel): alleen bepaalde netwerken en/of gebruikersnaam + wachtwoord
// ---------------------------------------------------------------------------
const security = require('./lib/security');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', true);

// Health-check voor monitoring (Uptime Kuma, Docker healthcheck): altijd zonder inloggen
app.get('/health', (req, res) => {
  const ok = homey.isConnected();
  res.status(ok ? 200 : 503).json({ ok, homey: ok ? 'verbonden' : 'niet verbonden', mock: MOCK, uptime: Math.round(process.uptime()), layoutVersion: layout.version });
});
app.use(security.middleware);
// no-cache: de tablet controleert bij elke start of er een nieuwe versie is
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: res => res.set('Cache-Control', 'no-cache') }));
app.use('/vendor/icons', express.static(path.join(__dirname, 'node_modules/lucide-static/icons'), { maxAge: '30d' }));
// Lijst van alle Lucide-iconen met hun (Engelse) zoekwoorden, voor de icoonkiezer
let iconIndex = null;
app.get('/api/icons', (req, res) => {
  if (!iconIndex) {
    const dir = path.join(__dirname, 'node_modules/lucide-static');
    const names = fs.readdirSync(path.join(dir, 'icons')).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4));
    let tags = {};
    try { tags = JSON.parse(fs.readFileSync(path.join(dir, 'tags.json'), 'utf8')); } catch { /* geen tags */ }
    iconIndex = names.map(n => [n, (tags[n] || []).join(' ')]);
  }
  res.set('Cache-Control', 'public, max-age=86400').json(iconIndex);
});
app.use('/vendor/sortable', express.static(path.join(__dirname, 'node_modules/sortablejs'), { maxAge: '30d' }));
app.use('/vendor/font', express.static(path.join(__dirname, 'node_modules/@fontsource-variable/figtree'), { maxAge: '30d' }));

const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(err => {
  console.error(err);
  res.status(500).json({ error: err.message || String(err) });
});

app.get('/api/status', (req, res) => res.json({ mock: MOCK, pinRequired: !!EDIT_PIN, connected: homey.isConnected(), energy: MOCK || require('./lib/energy').configured() }));

app.get('/api/layout', (req, res) => res.json(layout));

app.put('/api/layout', requireEdit, (req, res) => {
  const next = req.body;
  if (!next || !Array.isArray(next.pages) || !next.settings) {
    return res.status(400).json({ error: 'Ongeldige indeling' });
  }
  next.version = (layout.version || 0) + 1;
  layout = next;
  saveLayout(layout);
  history.refresh();
  broadcast({ type: 'layout', layout });
  res.json({ ok: true, version: layout.version });
});

// Geschiedenis voor grafieken: /api/history?keys=dev|cap,dev|cap&hours=24
app.get('/api/history', (req, res) => {
  const keys = String(req.query.keys || '').split(',').filter(Boolean).slice(0, 60);
  res.json(history.get(keys, clamp(Number(req.query.hours) || 24, 1, 720)));
});

app.get('/api/weather', wrap(async (req, res) => {
  res.json(await getWeather(layout.settings?.weatherPlace, MOCK));
}));

const { getWaste } = require('./lib/waste');
const energy = require('./lib/energy');
app.get('/api/waste', wrap(async (req, res) => res.json(await getWaste(layout.settings?.wasteIcs, MOCK, () => homey.getTrashDates()))));
app.get('/api/energy', wrap(async (req, res) => {
  if (!MOCK && !energy.configured()) return res.status(503).json({ error: 'ENERGY_URL is niet ingesteld. Zet hem in .env naast docker-compose.yml en start de container opnieuw.' });
  res.json(await energy.getEnergy(MOCK));
}));
app.get('/api/presence', wrap(async (req, res) => {
  try { res.json(await homey.getPresence()); }
  catch (e) { res.status(503).json({ error: `Aanwezigheid niet beschikbaar: ${e.message}. Geef de API-sleutel het recht om gebruikers te bekijken.` }); }
}));

// Na 5 foute pogingen een minuut wachten, zodat een pincode van 4 cijfers niet te raden is
const pinFails = new Map();   // ip -> { n, until }
app.post('/api/auth', (req, res) => {
  if (!EDIT_PIN) return res.json({ token: 'open' });
  const ip = security.clientIp(req), f = pinFails.get(ip) || { n: 0, until: 0 };
  if (Date.now() < f.until) return res.status(429).json({ error: 'Te vaak fout, probeer het over een minuut opnieuw' });
  if (String(req.body?.pin || '') !== EDIT_PIN) {
    f.n += 1;
    if (f.n >= 5) { f.n = 0; f.until = Date.now() + 60 * 1000; }
    pinFails.set(ip, f);
    return res.status(401).json({ error: 'Onjuiste pincode' });
  }
  pinFails.delete(ip);
  const token = crypto.randomBytes(16).toString('hex');
  editTokens.add(token);
  res.json({ token });
});

// Alles wat in Homey beschikbaar is: apparaten, zones, flows, moods
app.get('/api/catalog', wrap(async (req, res) => res.json(await homey.getCatalog())));

app.post('/api/device/:deviceId/:capabilityId', wrap(async (req, res) => {
  await homey.setCapability(req.params.deviceId, req.params.capabilityId, req.body.value);
  res.json({ ok: true });
}));

app.get('/api/events', (req, res) => res.json(events.list()));
app.post('/api/appliance/:tileId/ack', (req, res) => { events.ack(req.params.tileId); res.json({ ok: true }); });
app.post('/api/doorbell/test', (req, res) => { events.ring(layout.settings?.doorbell?.deviceId || null); res.json({ ok: true }); });
app.post('/api/alarm/test', (req, res) => { broadcast({ type: 'event', event: { kind: 'water', icon: 'droplet', text: 'Test: waterlek bij de wasmachine', alert: true, test: true, ts: Date.now(), id: `test-${Date.now()}` } }); res.json({ ok: true }); });

// Foto's voor de schermbeveiliging (map koppelen via docker-compose, bijvoorbeeld vanaf de NAS)
const PHOTOS_DIR = process.env.PHOTOS_DIR || path.join(__dirname, 'photos');
app.use('/photos', express.static(PHOTOS_DIR, { maxAge: '1d' }));
app.get('/api/photos', (req, res) => {
  const out = [];
  const walk = (dir, rel = '') => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= 2000) return;
      if (e.isDirectory()) walk(path.join(dir, e.name), `${rel}${e.name}/`);
      else if (/\.(jpe?g|png|webp)$/i.test(e.name)) out.push(`/photos/${rel}${e.name}`.split('/').map(encodeURIComponent).join('/').replace(/%2F/g, '/'));
    }
  };
  walk(PHOTOS_DIR);
  res.json(out);
});

app.get('/api/camera/:deviceId', wrap(async (req, res) => {
  const img = await homey.getCameraImage(req.params.deviceId, Number(req.query.i) || 0);
  res.set('Content-Type', img.type).set('Cache-Control', 'no-store').send(img.buf);
}));

app.post('/api/flow/:kind/:id', wrap(async (req, res) => {
  await homey.triggerFlow(req.params.kind, req.params.id);
  res.json({ ok: true });
}));

app.post('/api/mood/:id', wrap(async (req, res) => {
  await homey.setMood(req.params.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// WebSocket: live waarden en indeling naar alle schermen
// ---------------------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', verifyClient: ({ req }) => security.allowWebSocket(req) });

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === 1) c.send(data);
}

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'snapshot', states: homey.getStates(), layout, appliances: events.appliances(), connected: homey.isConnected() }));
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

homey.init({
  onCapability: (deviceId, capabilityId, value) => {
    history.record(deviceId, capabilityId, value);
    events.onCapability(deviceId, capabilityId, value);
    broadcast({ type: 'cap', deviceId, capabilityId, value });
  },
  onDevicesChanged: () => broadcast({ type: 'catalog-changed' }),
  onConnection: connected => { if (connected) events.seed(); broadcast({ type: 'connection', connected }); },
}).catch(err => console.error('Homey verbinding mislukt:', err.message));

// Dagelijkse back-up van de indeling naar BACKUP_DIR (bijvoorbeeld een map op de NAS)
if (process.env.BACKUP_DIR) {
  const backup = () => {
    try {
      fs.mkdirSync(process.env.BACKUP_DIR, { recursive: true });
      const day = new Date().toISOString().slice(0, 10);
      fs.copyFileSync(LAYOUT_FILE, path.join(process.env.BACKUP_DIR, `layout-${day}.json`));
      const files = fs.readdirSync(process.env.BACKUP_DIR).filter(f => /^layout-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
      while (files.length > 30) fs.unlinkSync(path.join(process.env.BACKUP_DIR, files.shift()));
    } catch (e) { console.warn('Back-up mislukt:', e.message); }
  };
  setTimeout(backup, 60 * 1000);
  setInterval(backup, 24 * 3600 * 1000);
}

server.listen(PORT, () => {
  console.log(`Dashboard draait op http://0.0.0.0:${PORT} ${MOCK ? '(demo-modus, geen Homey)' : ''}`);
  if (!MOCK && security.isOpen()) console.warn('Let op: ALLOWED_NETWORKS en DASH_USER zijn leeg. Iedereen die de server bereikt kan je apparaten bedienen en camerabeelden zien.');
});
