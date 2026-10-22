'use strict';
/* Grafische onderdelen: categoriekleuren, grafieken, meters, ruimte-overzicht,
   zijpaneel met klok/weer en de statusbalk. Gebruikt S, esc, icon, fmt, ... uit app.js. */

// ---------------------------------------------------------------------------
// Kleuren per soort tegel/waarde
// ---------------------------------------------------------------------------
const CAT = {
  light: '#ffb547', switch: '#ff8a5b', power: '#facc15', solar: '#fb923c', battery: '#34d399',
  temp: '#fb7185', humidity: '#60a5fa', climate: '#38bdf8', contact: '#a78bfa', motion: '#38bdf8',
  water: '#22d3ee', media: '#f472b6', flow: '#818cf8', blinds: '#2dd4bf', gas: '#f97316', other: '#94a3b8',
};

function tileColor(t) {
  if (t.iconColor) return t.iconColor;
  const cap = t.capability || '';
  const d = typeof device === 'function' ? device(t.deviceId) : null;
  switch (t.type) {
    case 'light': return CAT.light;
    case 'switch': return CAT.switch;
    case 'blinds': return CAT.blinds;
    case 'thermostat': return CAT.temp;
    case 'button': case 'mood': return CAT.media;
    case 'flow': return CAT.flow;
    case 'chart': return (t.series || [])[0]?.color || CAT.power;
    case 'rooms': return CAT.light;
    case 'camera': return CAT.contact;
    case 'appliance': return '#38bdf8';
    case 'group': return t.color || CAT.light;
    case 'remote': return CAT.media;
    case 'energyflow': case 'costs': return CAT.power;
    case 'timeline': return CAT.flow;
    case 'maintenance': return CAT.battery;
  }
  if (cap.includes('gas')) return CAT.gas;
  if (cap.includes('battery') && d?.class === 'battery') return CAT.battery;
  if (cap.includes('power') || cap.includes('generation')) return d?.class === 'solarpanel' ? CAT.solar : d?.class === 'battery' ? CAT.battery : CAT.power;
  if (cap.includes('battery')) return CAT.battery;
  if (cap.includes('temperature')) return CAT.temp;
  if (cap.includes('humidity')) return CAT.humidity;
  if (cap === 'alarm_contact') return CAT.contact;
  if (cap === 'alarm_motion') return CAT.motion;
  if (cap === 'alarm_water') return CAT.water;
  if (cap.includes('fan') || cap.includes('co2')) return CAT.climate;
  return CAT.other;
}

// ---------------------------------------------------------------------------
// Geschiedenis ophalen (voor grafieken)
// ---------------------------------------------------------------------------
const HIST = { data: {}, at: {}, pending: null };
const SERIES_COLORS = ['#facc15', '#fb923c', '#34d399', '#60a5fa'];
const histKey = (d, c) => `${d}|${c}`;

function historyKeysFor(tiles) {
  const keys = new Set();
  for (const t of tiles) {
    if (t.type === 'sensor' && wantsGraph(t)) keys.add(histKey(t.deviceId, t.capability));
    if (t.type === 'chart') (t.series || []).forEach(s => s.deviceId && s.capability && keys.add(histKey(s.deviceId, s.capability)));
  }
  for (const c of chipTiles()) if (c.type === 'sensor') keys.add(histKey(c.deviceId, c.capability));
  return [...keys];
}

async function loadHistory(keys, force) {
  const now = Date.now();
  const need = keys.filter(k => force || !HIST.at[k] || now - HIST.at[k] > 5 * 60 * 1000);
  if (!need.length) return false;
  try {
    const hours = Math.max(24, ...allTiles().filter(t => t.type === 'chart').map(t => +t.hours || 24));
    const res = await fetch(`/api/history?hours=${hours}&keys=${need.map(encodeURIComponent).join(',')}`);
    const data = await res.json();
    for (const k of need) { HIST.data[k] = data[k] || []; HIST.at[k] = now; }
    return true;
  } catch { return false; }
}

// Laatste punt vervangen door de live waarde, zodat de lijn tot "nu" doorloopt
function seriesWithLive(devId, cap, hours = 24) {
  const from = Date.now() - hours * 3600e3;
  const pts = (HIST.data[histKey(devId, cap)] || []).filter(p => p[0] >= from);
  const live = stateOf(devId)[cap];
  if (typeof live === 'number') pts.push([Date.now(), live]);
  return pts;
}

// Extra statusregels uit extras.js (bijvoorbeeld "Morgen: GFT")
const EXTRA_CHIPS = [];
const allTiles = () => (S.layout?.pages || []).flatMap(p => p.tiles);
const wantsGraph = t => t.type === 'sensor' && t.graph !== false && (t.graph === true || (t.w || 1) >= 2 || (t.h || 1) >= 2)
  && capInfo(t.deviceId, t.capability).type !== 'boolean' && typeof stateOf(t.deviceId)[t.capability] === 'number';

// ---------------------------------------------------------------------------
// SVG-bouwstenen
// ---------------------------------------------------------------------------
let gradId = 0;

// Kleine vlakgrafiek die onderin een tegel ligt
function sparkSVG(pts, color, { zero = false } = {}) {
  if (!pts || pts.length < 2) return '';
  const t0 = pts[0][0], t1 = pts[pts.length - 1][0] || t0 + 1;
  let lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1]));
  if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const X = ts => ((ts - t0) / (t1 - t0 || 1)) * 100, Y = v => 38 - ((v - lo) / (hi - lo)) * 34;
  const line = smoothPath(pts.map(p => [X(p[0]), Y(p[1])]));
  const id = `g${++gradId}`;
  return `<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${zero && lo < 0 ? `<line x1="0" x2="100" y1="${Y(0)}" y2="${Y(0)}" class="zero"/>` : ''}
    <path d="${line} L100,40 L0,40 Z" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
  </svg>`;
}

// Vloeiende lijn door punten (Catmull-Rom naar Bézier)
function smoothPath(p) {
  if (p.length > 160) { const step = p.length / 160; p = Array.from({ length: 160 }, (_, i) => p[Math.floor(i * step)]).concat([p[p.length - 1]]); }
  let d = `M${p[0][0].toFixed(2)},${p[0][1].toFixed(2)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

// Boogmeter van 270 graden
function gaugeSVG(frac, color, { track = 'rgba(255,255,255,.16)', width = 9, dot = true } = {}) {
  frac = clamp(isFinite(frac) ? frac : 0, 0, 1);
  const r = 42, c = 2 * Math.PI * r, arc = c * 0.75;
  const ang = (135 + 270 * frac) * Math.PI / 180;
  const dx = 50 + r * Math.cos(ang), dy = 50 + r * Math.sin(ang);
  return `<svg class="gauge" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="${r}" fill="none" style="stroke:${track}" stroke-width="${width}" stroke-linecap="round"
      stroke-dasharray="${arc} ${c}" transform="rotate(135 50 50)"/>
    ${frac > 0.001 ? `<circle cx="50" cy="50" r="${r}" fill="none" style="stroke:${color};filter:drop-shadow(0 0 5px ${color})" stroke-width="${width}" stroke-linecap="round"
      stroke-dasharray="${arc * frac} ${c}" transform="rotate(135 50 50)"/>` : ''}
    ${dot ? `<circle cx="${dx.toFixed(2)}" cy="${dy.toFixed(2)}" r="${width / 2 + 1.5}" fill="#fff" style="stroke:${color}" stroke-width="2.5"/>` : ''}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Grafiektegel
// ---------------------------------------------------------------------------
function chartRender(t) {
  const hours = +t.hours || 24;
  const series = (t.series || []).filter(s => s.deviceId && s.capability);
  if (!series.length) return { html: `<div class="label">${esc(t.label || 'Grafiek')}</div><div class="sub">Kies in de instellingen wat je wilt zien</div>` };
  const data = series.map(s => ({ ...s, pts: seriesWithLive(s.deviceId, s.capability, hours) }));
  const all = data.flatMap(s => s.pts.map(p => p[1]));
  const now = Date.now(), t0 = now - hours * 3600e3;
  let lo = all.length ? Math.min(...all) : 0, hi = all.length ? Math.max(...all) : 1;
  if (t.zero !== false) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi - lo < 1e-9) hi = lo + 1;
  const pad = (hi - lo) * 0.08; hi += pad; if (lo < 0) lo -= pad;
  const X = ts => ((ts - t0) / (now - t0)) * 100, Y = v => 96 - ((v - lo) / (hi - lo)) * 92;
  const area = t.style !== 'line';
  const paths = data.map((s, i) => {
    if (s.pts.length < 2) return '';
    const col = s.color || SERIES_COLORS[i % 4];
    const line = smoothPath(s.pts.map(p => [X(p[0]), Y(p[1])]));
    const id = `cg${++gradId}`;
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="${area ? 0.38 : 0}"/>
      <stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      ${area ? `<path d="${line} L${X(s.pts[s.pts.length - 1][0]).toFixed(2)},${Y(Math.max(lo, Math.min(0, hi)))} L${X(s.pts[0][0]).toFixed(2)},${Y(Math.max(lo, Math.min(0, hi)))} Z" fill="url(#${id})"/>` : ''}
      <path d="${line}" fill="none" stroke="${col}" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px ${col}88)"/>`;
  }).join('');
  const grid = [0.25, 0.5, 0.75].map(f => `<line x1="0" x2="100" y1="${4 + 92 * f}" y2="${4 + 92 * f}" class="gridline"/>`).join('')
    + (lo < 0 && hi > 0 ? `<line x1="0" x2="100" y1="${Y(0)}" y2="${Y(0)}" class="zero"/>` : '');
  const unit = t.unit || capInfo(series[0].deviceId, series[0].capability).units || '';
  const f = v => Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}k` : Math.round(v).toLocaleString('nl-NL');
  const hh = hours > 48
    ? ts => new Date(ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
    : ts => `${String(new Date(ts).getHours()).padStart(2, '0')}:00`;
  const legend = data.map((s, i) => {
    const v = fmt({ deviceId: s.deviceId, capability: s.capability }, s.capability, stateOf(s.deviceId)[s.capability]);
    return `<span class="lg"><i style="background:${s.color || SERIES_COLORS[i % 4]}"></i>${esc(s.label || capInfo(s.deviceId, s.capability).title || s.capability)}
      <b>${esc(v.v)}<small>${esc(v.u)}</small></b></span>`;
  }).join('');
  return {
    cls: 'chart-tile',
    html: `<div class="chart-head"><div class="label">${esc(t.label || '')}</div><div class="legend">${legend}</div></div>
      <div class="chart-body">
        <div class="yax"><span>${f(hi)}${unit ? ` ${esc(unit)}` : ''}</span><span>${f(lo)}</span></div>
        <svg class="chart" viewBox="0 0 100 100" preserveAspectRatio="none">${grid}${paths}</svg>
      </div>
      <div class="xax"><span>${hh(t0)}</span><span>${hh(t0 + (now - t0) / 2)}</span><span>nu</span></div>`,
  };
}

// ---------------------------------------------------------------------------
// Ruimtes: per zone hoeveel lampen aan en de temperatuur
// ---------------------------------------------------------------------------
const ROOM_ICONS = [['keuken', 'cooking-pot'], ['slaap', 'bed-double'], ['bad', 'bath'], ['woon', 'sofa'], ['toilet', 'toilet'],
  ['zolder', 'archive'], ['computer', 'monitor'], ['kantoor', 'monitor'], ['logeer', 'bed-single'], ['gang', 'door-open'],
  ['hal', 'door-open'], ['tuin', 'tree-pine'], ['garage', 'warehouse'], ['kind', 'baby'], ['camera', 'cctv'], ['meter', 'zap']];
const ROOM_COLORS = ['#f472b6', '#a78bfa', '#34d399', '#fb923c', '#60a5fa', '#facc15', '#2dd4bf', '#f87171', '#818cf8'];

function roomsData(t) {
  const devs = S.catalog?.devices || [];
  const byZone = {};
  for (const d of devs) {
    const z = byZone[d.zone] || (byZone[d.zone] = { id: d.zone, name: d.zoneName, lights: 0, lightsOn: 0, temp: null, motion: false });
    const st = stateOf(d.id);
    if (d.class === 'light' && 'onoff' in st) { z.lights++; if (st.onoff) z.lightsOn++; }
    if (z.temp === null && typeof st.measure_temperature === 'number' && d.class !== 'other' && d.class !== 'fan') z.temp = st.measure_temperature;
    if (st.alarm_motion) z.motion = true;
  }
  // Twee zones met dezelfde naam (bijv. Gang beneden en boven): verdieping erbij zetten
  const zones = S.catalog?.zones || [];
  const count = {};
  Object.values(byZone).forEach(z => { count[z.name] = (count[z.name] || 0) + 1; });
  Object.values(byZone).forEach(z => {
    if (count[z.name] > 1) {
      const parent = zones.find(x => x.id === zones.find(y => y.id === z.id)?.parent);
      if (parent) z.name = `${z.name} · ${parent.name.toLowerCase()}`;
    }
  });
  const hidden = new Set(t.hideZones || []);
  return Object.values(byZone).filter(z => (z.lights || z.temp !== null) && z.name && !hidden.has(z.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function roomsRender(t) {
  const rooms = roomsData(t);
  const rows = rooms.map((z, i) => {
    const ic = ROOM_ICONS.find(([k]) => z.name.toLowerCase().includes(k))?.[1] || 'house';
    const col = ROOM_COLORS[i % ROOM_COLORS.length];
    return `<div class="room" data-zone="${esc(z.id)}">
      <span class="room-ic" style="--c:${col}">${icon(ic)}</span>
      <span class="room-name">${esc(z.name)}</span>
      ${z.motion ? `<span class="pill motion" title="Beweging">${icon('footprints')}</span>` : ''}
      ${z.lights ? `<span class="pill ${z.lightsOn ? 'lit' : ''}">${icon('lightbulb')}${z.lightsOn}</span>` : ''}
      ${z.temp !== null ? `<span class="pill">${z.temp.toLocaleString('nl-NL', { maximumFractionDigits: 1 })}°</span>` : ''}
    </div>`;
  }).join('');
  return { cls: 'rooms-tile', html: `<div class="label">${esc(t.label || 'Ruimtes')}</div><div class="rooms">${rows || '<span class="sub">Nog geen ruimtes gevonden</span>'}</div>` };
}

// ---------------------------------------------------------------------------
// Statusregels: tegels met "ook in statusbalk", plus automatisch het aantal lampen
// ---------------------------------------------------------------------------
function chipTiles() {
  const seen = new Set();
  return allTiles().filter(t => t.chip && t.deviceId && !seen.has(t.deviceId + t.capability) && seen.add(t.deviceId + t.capability));
}

function lightsOnCount() {
  return (S.catalog?.devices || []).filter(d => d.class === 'light' && stateOf(d.id).onoff === true).length;
}

function chipItems() {
  const items = [];
  const n = lightsOnCount();
  items.push({ icon: 'lightbulb', color: CAT.light, label: n === 1 ? 'Lamp aan' : 'Lampen aan', value: String(n), lit: n > 0 });
  for (const t of chipTiles()) {
    const st = stateOf(t.deviceId);
    const v = fmt(t, t.capability || 'onoff', st[t.capability || 'onoff']);
    const alert = t.type === 'sensor' ? thresholdColor(t, st[t.capability]) : null;
    items.push({ icon: t.icon, color: alert || tileColor(t), label: t.label, value: `${v.v}${v.u ? ` ${v.u}` : ''}`, t, alert: !!alert });
  }
  for (const f of EXTRA_CHIPS) items.push(...(f() || []));
  return items;
}

function renderChips() {
  const bar = $('#chips');
  const side = sideVisible();
  const items = S.layout ? chipItems() : [];
  bar.hidden = side || !S.layout || S.layout.settings.statusBar === false;
  if (bar.hidden) { bar.innerHTML = ''; return; }
  bar.innerHTML = items.map(c => `<span class="chip ${c.alert ? 'alert' : ''}" style="--c:${c.color}">
    <span class="chip-ic">${icon(c.icon)}</span><span><b>${esc(c.value)}</b> ${esc(c.label)}</span></span>`).join('');
}

// ---------------------------------------------------------------------------
// Zijpaneel: klok, datum, weer, statusregels met minigrafiek
// ---------------------------------------------------------------------------
const WMO = { 0: ['Helder', 'sun', 'moon'], 1: ['Overwegend helder', 'sun', 'moon'], 2: ['Half bewolkt', 'cloud-sun', 'cloud-moon'],
  3: ['Bewolkt', 'cloud', 'cloud'], 45: ['Mist', 'cloud-fog', 'cloud-fog'], 48: ['Mist', 'cloud-fog', 'cloud-fog'],
  51: ['Motregen', 'cloud-drizzle', 'cloud-drizzle'], 53: ['Motregen', 'cloud-drizzle', 'cloud-drizzle'], 55: ['Motregen', 'cloud-drizzle', 'cloud-drizzle'],
  61: ['Lichte regen', 'cloud-rain', 'cloud-rain'], 63: ['Regen', 'cloud-rain', 'cloud-rain'], 65: ['Zware regen', 'cloud-rain', 'cloud-rain'],
  71: ['Lichte sneeuw', 'cloud-snow', 'cloud-snow'], 73: ['Sneeuw', 'cloud-snow', 'cloud-snow'], 75: ['Zware sneeuw', 'cloud-snow', 'cloud-snow'],
  80: ['Buien', 'cloud-rain', 'cloud-rain'], 81: ['Buien', 'cloud-rain', 'cloud-rain'], 82: ['Zware buien', 'cloud-rain', 'cloud-rain'],
  95: ['Onweer', 'cloud-lightning', 'cloud-lightning'], 96: ['Onweer', 'cloud-lightning', 'cloud-lightning'], 99: ['Onweer', 'cloud-lightning', 'cloud-lightning'] };
const wmo = (code, day = true) => { const w = WMO[code] || WMO[3]; return { text: w[0], icon: day ? w[1] : w[2] }; };
const WEATHER = { data: null, at: 0, err: null };

async function loadWeather(force) {
  if (!S.layout?.settings?.weatherPlace) { WEATHER.data = null; WEATHER.err = null; renderSide(); return; }
  if (!force && Date.now() - WEATHER.at < 15 * 60 * 1000) return;
  WEATHER.at = Date.now();
  try { WEATHER.data = await api('GET', '/api/weather'); WEATHER.err = null; }
  catch (e) { WEATHER.err = e.message; }
  renderSide();
}

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 864e5 + 1) / 7);
}
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const greeting = h => h < 6 ? 'Goedenacht' : h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
const sideVisible = () => !!S.layout && S.layout.settings.sidePanel !== false && window.innerWidth >= 900;

function renderSide() {
  const side = $('#side');
  const show = sideVisible();
  document.body.classList.toggle('has-side', show);
  side.hidden = !show;
  if (!show) return;
  const d = new Date();
  const w = WEATHER.data;
  const weather = w ? (() => {
    const cur = wmo(w.current.code, w.current.isDay);
    const days = w.daily.slice(1, 5).map(x => {
      const ww = wmo(x.code);
      return `<div class="fc"><span>${new Date(x.date).toLocaleDateString('nl-NL', { weekday: 'short' })}</span>${icon(ww.icon)}
        <b>${Math.round(x.max)}°</b><small>${Math.round(x.min)}°</small></div>`;
    }).join('');
    return `<div class="side-card weather">
      <div class="w-now"><span class="w-ic">${icon(cur.icon)}</span><div><div class="w-temp">${Math.round(w.current.temp)}°</div>
      <div class="w-desc">${cur.text}</div></div>
      <div class="w-extra">${icon('droplets')} ${Math.round(w.current.humidity)}%<br>${icon('wind')} ${Math.round(w.current.wind)} km/u</div></div>
      <div class="forecast">${days}</div></div>`;
  })() : (S.layout.settings.weatherPlace && WEATHER.err ? `<div class="side-card sub">Weer niet beschikbaar: ${esc(WEATHER.err)}</div>` : '');

  const items = chipItems().map(c => {
    const pts = c.t && c.t.type === 'sensor' ? seriesWithLive(c.t.deviceId, c.t.capability, 24) : [];
    return `<div class="stat ${c.alert ? 'alert' : ''}" style="--c:${c.color}">
      <span class="stat-ic">${icon(c.icon)}</span>
      <div class="stat-txt"><span>${esc(c.label)}</span><b>${esc(c.value)}</b></div>
      ${pts.length > 2 ? `<div class="stat-spark">${sparkSVG(pts, c.color, { zero: true })}</div>` : ''}
    </div>`;
  }).join('');

  side.innerHTML = `
    <div class="side-clock">${hhmm(d)}</div>
    <div class="side-date">${cap1(d.toLocaleDateString('nl-NL', { weekday: 'long' }))}<br>${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</div>
    <div class="side-week">Week ${isoWeek(d)}</div>
    <div class="side-greet">${greeting(d.getHours())}</div>
    ${weather}
    <div class="side-stats">${items}</div>`;
}
