'use strict';

// Optionele beveiliging, in te stellen via .env:
//   ALLOWED_NETWORKS=192.168.1.0/24,10.10.10.0/24   alleen deze netwerken (IPv4)
//   DASH_USER / DASH_PASS                             inloggen met gebruikersnaam en wachtwoord
// Na één keer inloggen krijgt het apparaat een cookie die een jaar geldig is.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const NETS = (process.env.ALLOWED_NETWORKS || '').split(',').map(s => s.trim()).filter(Boolean);
const USER = process.env.DASH_USER || '';
const PASS = process.env.DASH_PASS || '';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SESS_FILE = path.join(DATA_DIR, 'sessions.json');

let sessions = new Set();
try { sessions = new Set(JSON.parse(fs.readFileSync(SESS_FILE, 'utf8'))); } catch { /* geen sessies */ }
const saveSessions = () => { try { fs.writeFileSync(SESS_FILE, JSON.stringify([...sessions].slice(-200))); } catch { /* */ } };

const ip2int = ip => ip.split('.').reduce((a, b) => (a << 8) + (+b), 0) >>> 0;
function inNets(ipRaw) {
  if (!NETS.length) return true;
  const ip = String(ipRaw || '').replace(/^::ffff:/, '');
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  return NETS.some(n => {
    const [base, bits = '32'] = n.split('/');
    const mask = +bits === 0 ? 0 : (~0 << (32 - +bits)) >>> 0;
    return (ip2int(ip) & mask) === (ip2int(base) & mask);
  });
}

function clientIp(req) {
  if (process.env.TRUST_PROXY === '1') {
    // Het laatste adres is wat Traefik zelf zag; eerdere adressen kan de bezoeker zelf meesturen
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress;
}

const cookie = req => (String(req.headers.cookie || '').match(/(?:^|;\s*)dash_session=([a-f0-9]+)/) || [])[1];
const safeEq = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function middleware(req, res, next) {
  if (!inNets(clientIp(req))) return res.status(403).send('Geen toegang vanaf dit netwerk');
  if (!USER) return next();
  if (sessions.has(cookie(req))) return next();
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Basic ')) {
    const [u, ...rest] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (safeEq(u, USER) && safeEq(rest.join(':'), PASS)) {
      const tok = crypto.randomBytes(24).toString('hex');
      sessions.add(tok); saveSessions();
      res.setHeader('Set-Cookie', `dash_session=${tok}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`);
      return next();
    }
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard", charset="UTF-8"');
  res.status(401).send('Inloggen vereist');
}

function allowWebSocket(req) {
  if (!inNets(clientIp(req))) return false;
  if (!USER) return true;
  return sessions.has(cookie(req));
}

const isOpen = () => !NETS.length && !USER;

module.exports = { middleware, allowWebSocket, clientIp, isOpen };
