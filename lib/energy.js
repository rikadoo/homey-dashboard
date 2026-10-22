'use strict';

// Gegevens uit het eigen energiedashboard (ENERGY_URL, bijvoorbeeld http://energie-dashboard:8080).
// Live waarden 10 seconden in de cache, dag- en jaarcijfers 5 minuten.
const BASE = (process.env.ENERGY_URL || '').replace(/\/+$/, '');
const cache = {};

async function get(path, maxAge) {
  const c = cache[path];
  if (c && Date.now() - c.at < maxAge) return c.data;
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Energiedashboard gaf ${r.status} op ${path}`);
  const data = await r.json();
  cache[path] = { at: Date.now(), data };
  return data;
}

function demo() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const sun = Math.max(0, Math.sin((h - 7) / 13 * Math.PI));
  return {
    live: { solar_w: Math.round(2400 * sun), grid_w: Math.round(400 - 1800 * sun), battery_w: Math.round(600 * sun - 200), battery_soc: 64, house_w: 520 },
    today: { solar: 9.4 * sun + 2, house: 7.8, imp: 3.1, exp: 4.6, gas: 1.2, selfSufficiency: 0.61, costs: 1.84 },
    month: { solar: 182, house: 241, costs: 48.2 },
    jaarnota: { ok: true, total: 1412, termijnen: 1560, saldo: 148, elapsedDays: 204, totalDays: 365 },
  };
}

async function getEnergy(mock) {
  if (!BASE) return mock ? demo() : null;
  const [live, day, month, jn] = await Promise.all([
    get('/api/live', 10e3),
    get('/api/summary?period=dag', 5 * 60e3),
    get('/api/summary?period=maand', 5 * 60e3).catch(() => null),
    get('/api/jaarnota', 5 * 60e3).catch(() => null),
  ]);
  const pick = s => s && { solar: s.totals.solar, house: s.totals.house, imp: s.totals.imp, exp: s.totals.exp, gas: s.totals.gas, selfSufficiency: s.selfSufficiency, costs: s.costs.totaal };
  return {
    live: live?.values || null,
    today: pick(day),
    month: pick(month),
    jaarnota: jn && (jn.ok
      ? { ok: true, total: jn.total, termijnen: jn.termijnen, saldo: jn.saldo, elapsedDays: jn.elapsedDays, totalDays: jn.totalDays }
      : { ok: false, reason: jn.reason }),
  };
}

module.exports = { getEnergy, configured: () => !!BASE };
