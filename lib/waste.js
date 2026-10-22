'use strict';

// Afvalkalender uit een iCal-link (de "toevoegen aan agenda"-link van je gemeente of afvalkalender).
// Wordt 6 uur in de cache gehouden.
let cache = { url: null, at: 0, data: null };

// Datum uit DTSTART halen als JJJJ-MM-DD (lokale dag)
function icsDate(v) {
  const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  if (!m[4] || !m[7]) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseIcs(text) {
  // Doorlopende regels (beginnen met een spatie) samenvoegen
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const out = [];
  let ev = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') ev = {};
    else if (line === 'END:VEVENT') { if (ev?.date && ev.type) out.push(ev); ev = null; }
    else if (ev) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i).split(';')[0], val = line.slice(i + 1);
      if (key === 'DTSTART') ev.date = icsDate(val);
      if (key === 'SUMMARY') ev.type = val.replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
    }
  }
  return out;
}

function demo() {
  const d = n => { const x = new Date(Date.now() + n * 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  return [{ date: d(1), type: 'GFT' }, { date: d(4), type: 'Papier' }, { date: d(8), type: 'PMD' }, { date: d(15), type: 'GFT' }];
}

// Namen van de afvalsoorten uit Trashcan Reminder
const TC_NAMES = { GFT: 'GFT', GLAS: 'Glas', GROF: 'Grofvuil', KCA: 'Klein chemisch afval', PAPIER: 'Papier', PLASTIC: 'Plastic',
  PMD: 'PMD', REST: 'Restafval', SNOEI: 'Snoeiafval', TEXTIEL: 'Textiel', KERSTBOOM: 'Kerstbomen' };
const localDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Bron: de iCal-link als die is ingevuld, anders de Homey-app Trashcan Reminder
async function getWaste(url, mock, fromHomey) {
  if (!url && mock) return demo();
  if (!url && !fromHomey) return null;
  if (!url) {
    if (cache.url !== 'homey' || Date.now() - cache.at > 3600e3) {
      const list = await fromHomey();
      const data = (Array.isArray(list) ? list : []).flatMap(a => (a.dates || []).map(d => ({
        date: localDay(new Date(d)), type: a.localText || TC_NAMES[a.type] || a.type,
      })));
      cache = { url: 'homey', at: Date.now(), data };
    }
  } else if (cache.url !== url || Date.now() - cache.at > 6 * 3600e3) {
    const r = await fetch(url.replace(/^webcal:/i, 'https:'), { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`Afvalkalender niet bereikbaar (${r.status})`);
    cache = { url, at: Date.now(), data: parseIcs(await r.text()) };
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const from = icsDate(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`);
  return cache.data.filter(e => e.date >= from).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 20);
}

module.exports = { getWaste };
