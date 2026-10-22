'use strict';

// Houdt een geschiedenis bij van getallen die in het dashboard gebruikt worden,
// zodat tegels grafieken kunnen tonen. Per 5 minuten wordt het gemiddelde bewaard (48 uur)
// en per uur (30 dagen). Wordt periodiek naar data/history.json geschreven.
const fs = require('fs');
const path = require('path');

const BUCKET = 5 * 60 * 1000;
const KEEP = 48 * 60 * 60 * 1000;
const HOUR = 3600 * 1000;
const KEEP_HOURLY = 30 * 24 * HOUR;

module.exports = function createHistory({ dataDir, getStates, getLayout, mock, getInsights }) {
  const file = path.join(dataDir, 'history.json');
  let series = {};             // "deviceId|cap" -> [[ts, value], ...] per 5 minuten
  let hourly = {};             // "deviceId|cap" -> [[ts, value], ...] per uur
  const acc = {};              // lopende som per sleutel binnen de huidige 5 minuten
  const hourAcc = {};          // lopende som per sleutel binnen het huidige uur
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved && saved.series && saved.hourly) { series = saved.series; hourly = saved.hourly; }
    else series = saved || {};   // oud formaat: alleen 5-minutenwaarden
  } catch { /* nog geen geschiedenis */ }

  // Welke waarden zijn interessant: alles waar een tegel of statusregel naar verwijst
  function wanted() {
    const keys = new Set();
    const add = (d, c) => { if (d && c) keys.add(`${d}|${c}`); };
    for (const p of getLayout().pages || []) {
      for (const t of p.tiles || []) {
        if (t.type === 'sensor') { add(t.deviceId, t.capability); add(t.deviceId, t.secondary); }
        if (t.type === 'thermostat') add(t.deviceId, 'measure_temperature');
        if (t.type === 'chart') for (const s of t.series || []) add(s.deviceId, s.capability);
      }
    }
    return keys;
  }

  function record(deviceId, cap, value) {
    if (typeof value !== 'number' || !isFinite(value)) return;
    const k = `${deviceId}|${cap}`;
    const a = acc[k] || (acc[k] = { sum: 0, n: 0 });
    a.sum += value; a.n += 1;
  }

  function sample() {
    const now = Date.now();
    const states = getStates();
    const cut = now - KEEP, cutH = now - KEEP_HOURLY;
    const hour = Math.floor(now / HOUR);
    for (const k of wanted()) {
      const [d, c] = k.split('|');
      const a = acc[k];
      const v = a && a.n ? a.sum / a.n : states[d]?.[c];
      delete acc[k];
      if (typeof v !== 'number' || !isFinite(v)) continue;
      const arr = series[k] || (series[k] = []);
      arr.push([now, Math.round(v * 1000) / 1000]);
      while (arr.length && arr[0][0] < cut) arr.shift();
      // Uurgemiddelde: als er een nieuw uur begint, het vorige uur wegschrijven
      const h = hourAcc[k] || (hourAcc[k] = { h: hour, sum: 0, n: 0 });
      if (h.h !== hour) {
        if (h.n) {
          const harr = hourly[k] || (hourly[k] = []);
          harr.push([h.h * HOUR + HOUR / 2, Math.round(h.sum / h.n * 1000) / 1000]);
          while (harr.length && harr[0][0] < cutH) harr.shift();
        }
        hourAcc[k] = { h: hour, sum: 0, n: 0 };
      }
      hourAcc[k].sum += v; hourAcc[k].n += 1;
    }
  }

  function persist() {
    try { fs.writeFileSync(file + '.tmp', JSON.stringify({ series, hourly })); fs.renameSync(file + '.tmp', file); }
    catch (e) { console.warn('Geschiedenis opslaan mislukt:', e.message); }
  }

  // Demo-modus: vul een plausibele maand zodat je de grafieken direct ziet
  function demoValue(d, c, cur, ts) {
    const h = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
    const day = Math.floor(ts / 864e5);
    const cloud = 0.55 + 0.45 * Math.abs(Math.sin(day * 1.7));
    const sun = Math.max(0, Math.sin((h - 7) / 13 * Math.PI)) * cloud;
    if (c === 'measure_power' && d === 'd_solar') return 2400 * sun * (0.92 + 0.08 * Math.sin(h * 5));
    if (c === 'measure_power' && d === 'd_battery') return sun > 0.2 ? 900 * sun : -400 - 150 * Math.sin(h);
    if (c === 'measure_power') return 380 + 160 * Math.sin(h * 2.3) + 70 * Math.random() + (h > 17 && h < 21 ? 700 : 0) - 1700 * sun;
    if (c.includes('temperature')) return cur - 1.2 + Math.sin((h - 9) / 24 * 2 * Math.PI) * 1.4 + Math.sin(day / 3) * 0.8 + Math.random() * 0.2;
    if (c.includes('humidity')) return cur + Math.sin(h / 4) * 4 + Math.sin(day) * 3;
    if (c === 'measure_battery') return Math.min(100, Math.max(5, 30 + 60 * sun + (h > 18 ? 40 - (h - 18) * 6 : 0)));
    return cur * (0.8 + Math.random() * 0.4);
  }
  function seedDemo() {
    const states = getStates(), now = Date.now();
    for (const k of wanted()) {
      const [d, c] = k.split('|');
      const cur = states[d]?.[c];
      if (typeof cur !== 'number') continue;
      if (!series[k]?.length) {
        series[k] = [];
        for (let i = 576; i > 0; i--) { const ts = now - i * BUCKET; series[k].push([ts, Math.round(demoValue(d, c, cur, ts) * 100) / 100]); }
      }
      if (!hourly[k]?.length) {
        hourly[k] = [];
        for (let i = 720; i > 0; i--) { const ts = (Math.floor(now / HOUR) - i) * HOUR + HOUR / 2; hourly[k].push([ts, Math.round(demoValue(d, c, cur, ts) * 100) / 100]); }
      }
    }
  }

  // Ontbrekende geschiedenis aanvullen uit Homey Insights (hooguit eens per uur per waarde)
  const tried = {}, triedH = {};
  async function backfill() {
    if (!getInsights) return;
    for (const k of wanted()) {
      const [d, c] = k.split('|');
      const arr = series[k] || [];
      const oldest = arr.length ? arr[0][0] : Date.now();
      if (Date.now() - oldest < 20 * 3600e3 && !(tried[k] && Date.now() - tried[k] < 3600e3)) {
        tried[k] = Date.now();
        try {
          const pts = await getInsights(d, c);
          if (pts?.length) series[k] = pts.filter(p => p[0] < oldest - 60e3).concat(arr).slice(-1000);
        } catch (e) { console.warn(`Insights voor ${k} niet beschikbaar:`, e.message); }
      }
      // Uurwaarden voor de afgelopen maand
      const harr = hourly[k] || [];
      const oldestH = harr.length ? harr[0][0] : Date.now();
      if (Date.now() - oldestH < 20 * 24 * HOUR && !(triedH[k] && Date.now() - triedH[k] < 6 * HOUR)) {
        triedH[k] = Date.now();
        try {
          const pts = await getInsights(d, c, 'last31Days');
          if (pts?.length) hourly[k] = pts.filter(p => p[0] < oldestH - HOUR / 2 && p[0] >= Date.now() - KEEP_HOURLY).concat(harr);
        } catch (e) { console.warn(`Insights (maand) voor ${k} niet beschikbaar:`, e.message); }
      }
    }
  }

  setTimeout(() => { if (mock) seedDemo(); sample(); backfill(); }, 3000);
  setInterval(backfill, 30 * 60 * 1000);
  setInterval(sample, BUCKET);
  setInterval(persist, 10 * 60 * 1000);
  process.on('SIGTERM', () => { persist(); process.exit(0); });
  process.on('SIGINT', () => { persist(); process.exit(0); });

  return {
    record,
    // Tot 48 uur: 5-minutenwaarden. Langer: uurwaarden voor het oudere deel, 5-minutenwaarden voor de laatste 48 uur.
    get(keys, hours = 24) {
      const now = Date.now(), from = now - hours * HOUR;
      const out = {};
      for (const k of keys) {
        const fine = (series[k] || []).filter(p => p[0] >= from);
        if (hours <= 48) { out[k] = fine; continue; }
        const until = fine.length ? fine[0][0] : now;
        out[k] = (hourly[k] || []).filter(p => p[0] >= from && p[0] < until).concat(fine);
      }
      return out;
    },
    refresh() { if (mock) seedDemo(); setTimeout(backfill, 2000); },
  };
};
