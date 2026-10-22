'use strict';
/* Homey tablet-dashboard — alles in één bestand, geen build-stap nodig. */

// ---------------------------------------------------------------------------
// Staat
// ---------------------------------------------------------------------------
const S = {
  layout: null,
  states: {},
  catalog: null,
  status: {},
  pageIdx: 0,
  editing: false,
  token: null,
  undo: [],
  sortable: null,
  popupTile: null,
};

const $ = sel => document.querySelector(sel);
// Uitbreidingen (extras.js) haken hier in
const EXTRA = { msgHandlers: [], connHandlers: [], onMessage(m) { this.msgHandlers.forEach(f => f(m)); }, onConn(ok) { this.connHandlers.forEach(f => f(ok)); } };
const grid = $('#grid');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const icon = name => `<span class="ic" style="--icon:url(/vendor/icons/${esc(name || 'square')}.svg)"></span>`;
const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const page = () => S.layout.pages[S.pageIdx] || S.layout.pages[0];
const settings = () => S.layout.settings;

document.querySelectorAll('[data-icon]').forEach(e => e.style.setProperty('--icon', `url(/vendor/icons/${e.dataset.icon}.svg)`));

// Iconen per categorie voor de icoonkiezer. Via het zoekveld zijn alle ~2000 Lucide-iconen te vinden.
const ICON_GROUPS = [
  ['Ruimtes', ['house', 'sofa', 'armchair', 'tv', 'bed-double', 'bed-single', 'bed', 'baby', 'toy-brick', 'bath', 'shower-head',
    'toilet', 'cooking-pot', 'chef-hat', 'utensils', 'refrigerator', 'microwave', 'wine', 'washing-machine', 'shirt', 'laptop',
    'monitor', 'briefcase', 'book-open', 'gamepad-2', 'dumbbell', 'warehouse', 'car', 'door-open', 'door-closed', 'key-round',
    'tree-pine', 'flower-2', 'sprout', 'fence', 'tent', 'archive']],
  ['Verlichting', ['lightbulb', 'lightbulb-off', 'lamp', 'lamp-ceiling', 'lamp-desk', 'lamp-floor', 'lamp-wall-up', 'sun', 'sun-medium',
    'moon', 'sparkles', 'party-popper', 'flame']],
  ['Energie en klimaat', ['zap', 'plug', 'plug-zap', 'battery-medium', 'battery-charging', 'solar-panel', 'gauge', 'thermometer',
    'thermometer-sun', 'heater', 'fan', 'air-vent', 'droplet', 'droplets', 'wind', 'snowflake', 'sun-snow', 'cloud-sun', 'cloud-rain',
    'umbrella', 'waves', 'blinds']],
  ['Beveiliging', ['shield', 'shield-check', 'lock', 'lock-keyhole', 'cctv', 'camera', 'video', 'bell', 'bell-ring', 'siren',
    'alarm-smoke', 'footprints']],
  ['Media en apparaten', ['speaker', 'music', 'music-2', 'headphones', 'radio', 'popcorn', 'coffee', 'cup-soda', 'printer', 'router',
    'wifi', 'server']],
  ['Overig', ['power', 'play', 'clock', 'trash-2', 'recycle', 'package', 'wrench', 'hammer', 'drill', 'bike', 'scooter',
    'motorbike', 'dog', 'cat', 'fish', 'bird', 'paw-print', 'leaf', 'tree-deciduous']],
];
// Nederlandse zoekwoorden
const ICON_NL = {
  keuken: ['cooking-pot', 'chef-hat', 'utensils', 'utensils-crossed', 'refrigerator', 'microwave', 'coffee', 'cup-soda'],
  slaapkamer: ['bed-double', 'bed-single', 'bed', 'moon', 'lamp'], bed: ['bed-double', 'bed-single', 'bed'],
  badkamer: ['bath', 'shower-head', 'toilet', 'droplets'], toilet: ['toilet'], wc: ['toilet'], douche: ['shower-head'],
  woonkamer: ['sofa', 'armchair', 'tv', 'lamp-floor'], bank: ['sofa'], eetkamer: ['utensils', 'wine'],
  kinderkamer: ['baby', 'toy-brick', 'gamepad-2'], kind: ['baby', 'toy-brick'], speelkamer: ['gamepad-2', 'toy-brick'],
  kantoor: ['laptop', 'monitor', 'briefcase', 'printer'], werkkamer: ['laptop', 'monitor', 'briefcase'],
  wasruimte: ['washing-machine', 'shirt'], was: ['washing-machine', 'shirt'], zolder: ['archive', 'package', 'warehouse'],
  garage: ['warehouse', 'car', 'wrench'], schuur: ['warehouse', 'hammer', 'drill'], auto: ['car', 'car-front'], fiets: ['bike'],
  tuin: ['tree-pine', 'trees', 'flower-2', 'sprout', 'fence', 'tent'], gang: ['door-open', 'footprints'], hal: ['door-open', 'key-round'],
  trap: ['footprints'], deur: ['door-open', 'door-closed'], slot: ['lock', 'lock-keyhole', 'key-round'],
  lamp: ['lamp', 'lamp-ceiling', 'lamp-desk', 'lamp-floor', 'lamp-wall-up', 'lightbulb'], licht: ['lightbulb', 'lightbulb-off', 'sun'],
  verwarming: ['heater', 'thermometer', 'flame'], temperatuur: ['thermometer', 'thermometer-sun'], energie: ['zap', 'plug', 'gauge'],
  zon: ['sun', 'solar-panel', 'sun-medium'], zonnepanelen: ['solar-panel'], accu: ['battery-medium', 'battery-charging'],
  batterij: ['battery-medium', 'battery-charging'], water: ['droplet', 'droplets', 'waves'], regen: ['cloud-rain', 'umbrella'],
  beveiliging: ['shield', 'shield-check', 'lock', 'cctv', 'siren'], camera: ['cctv', 'camera', 'video'], deurbel: ['bell', 'bell-ring'],
  rook: ['alarm-smoke'], muziek: ['music', 'music-2', 'speaker', 'headphones'], huisdier: ['dog', 'cat', 'paw-print', 'fish'],
  hond: ['dog'], kat: ['cat'], afval: ['trash-2', 'recycle'], ventilatie: ['fan', 'air-vent', 'wind'], zonwering: ['blinds', 'sun'],
};
let iconIndex = null;
async function loadIconIndex() {
  if (!iconIndex) { try { iconIndex = await api('GET', '/api/icons'); } catch { iconIndex = []; } }
  return iconIndex;
}

// Herbruikbare icoonkiezer: zoekveld + categorieën. Geeft een element terug.
function iconPicker(current, onPick) {
  const root = document.createElement('div');
  root.className = 'icon-picker';
  root.innerHTML = `<input type="search" placeholder="Zoek een icoon, bijv. keuken, slaapkamer, auto" aria-label="Icoon zoeken"><div class="ip-body"></div>`;
  const body = root.querySelector('.ip-body');
  const btn = n => `<button type="button" data-ip="${esc(n)}" class="${n === current ? 'sel' : ''}" title="${esc(n)}">${icon(n)}</button>`;
  const draw = async q => {
    q = q.trim().toLowerCase();
    if (!q) {
      body.innerHTML = ICON_GROUPS.map(([title, list]) => `<div class="ip-title">${title}</div><div class="icon-grid">${list.map(btn).join('')}</div>`).join('');
      return;
    }
    const idx = await loadIconIndex();
    const hits = new Set();
    for (const [word, list] of Object.entries(ICON_NL)) if (word.startsWith(q) || q.startsWith(word)) list.forEach(n => hits.add(n));
    for (const [n] of idx) if (n.includes(q)) hits.add(n);
    for (const [n, tags] of idx) if (hits.size < 120 && tags.includes(q)) hits.add(n);
    const list = [...hits].slice(0, 120);
    body.innerHTML = list.length ? `<div class="icon-grid">${list.map(btn).join('')}</div>`
      : `<p class="hint">Niets gevonden voor "${esc(q)}". Probeer een ander woord, ook Engels werkt.</p>`;
  };
  root.querySelector('input').addEventListener('input', e => { e.stopPropagation(); draw(e.target.value); });
  body.addEventListener('click', e => {
    const b = e.target.closest('[data-ip]'); if (!b) return;
    body.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel'); current = b.dataset.ip;
    onPick(b.dataset.ip);
  });
  draw('');
  return root;
}

// ---------------------------------------------------------------------------
// Netwerk
// ---------------------------------------------------------------------------
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(S.token ? { 'x-edit-token': S.token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  // Server herstart: het bewerk-token is dan niet meer geldig. Vergeten, zodat het potlood opnieuw om de pincode vraagt.
  if (res.status === 401 && S.token && url !== '/api/auth') {
    S.token = null;
    throw new Error('Bewerksessie verlopen. Tik op Klaar en daarna op het potlood om de pincode opnieuw in te voeren');
  }
  if (!res.ok) throw new Error(data.error || `Fout ${res.status}`);
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

async function loadCatalog(force) {
  if (S.catalog && !force) return S.catalog;
  try { S.catalog = await api('GET', '/api/catalog'); }
  catch (e) { toast(e.message); S.catalog = S.catalog || { devices: [], zones: [], flows: [], moods: [] }; }
  return S.catalog;
}
const device = id => S.catalog?.devices.find(d => d.id === id);
const capInfo = (devId, capId) => device(devId)?.capabilities?.[capId] || {};
const stateOf = devId => S.states[devId] || {};

function connectWS() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => { $('#conn').classList.remove('off'); connectWS.delay = 1000; EXTRA.onConn(true); };
  ws.onclose = () => {
    $('#conn').classList.add('off');
    EXTRA.onConn(false);
    setTimeout(connectWS, connectWS.delay = Math.min((connectWS.delay || 1000) * 1.6, 15000));
  };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    EXTRA.onMessage(m);
    if (m.type === 'snapshot') {
      S.states = m.states;
      $('#conn').classList.toggle('off', m.connected === false);
      if (!S.editing || !S.layout) S.layout = m.layout;
      applySettings(); renderAll();
    } else if (m.type === 'cap') {
      (S.states[m.deviceId] ||= {})[m.capabilityId] = m.value;
      refreshDevice(m.deviceId);
    } else if (m.type === 'layout') {
      if (S.editing) return;   // dit scherm is zelf aan het bewerken
      if (!S.layout || m.layout.version > (S.layout.version || 0)) {
        S.layout = m.layout;
        S.pageIdx = Math.min(S.pageIdx, S.layout.pages.length - 1);
        applySettings(); renderAll();
      }
    } else if (m.type === 'catalog-changed') {
      loadCatalog(true).then(renderAll);
    } else if (m.type === 'connection') {
      $('#conn').classList.toggle('off', !m.connected);
    }
  };
}

async function setCap(devId, capId, value) {
  (S.states[devId] ||= {})[capId] = value;   // direct tonen, Homey bevestigt via live update
  refreshDevice(devId);
  try { await api('POST', `/api/device/${encodeURIComponent(devId)}/${encodeURIComponent(capId)}`, { value }); }
  catch (e) { toast(`Niet gelukt: ${e.message}`); }
}

// Opslaan met vertraging, zodat snel achter elkaar wijzigen één keer opslaat
let saveTimer;
function save(immediate) {
  clearTimeout(saveTimer);
  const run = async () => {
    try {
      const r = await api('PUT', '/api/layout', S.layout);
      S.layout.version = r.version;
    } catch (e) { toast(`Opslaan mislukt: ${e.message}`); }
  };
  if (immediate) return run();
  saveTimer = setTimeout(run, 500);
}
function pushUndo() {
  S.undo.push(JSON.stringify(S.layout));
  if (S.undo.length > 50) S.undo.shift();
}

// ---------------------------------------------------------------------------
// Waarden opmaken
// ---------------------------------------------------------------------------
const BOOL_TEXT = {
  alarm_contact: ['Open', 'Dicht'], alarm_motion: ['Beweging', 'Rustig'], alarm_smoke: ['Rook!', 'OK'],
  alarm_water: ['Lek!', 'Droog'], alarm_tamper: ['Sabotage', 'OK'], alarm_battery: ['Batterij laag', 'OK'],
  alarm_vibration: ['Trilling', 'Rustig'], onoff: ['Aan', 'Uit'],
};
const PERCENT_CAPS = ['dim', 'windowcoverings_set', 'volume_set', 'light_saturation'];

function fmt(tile, capId, v) {
  const cap = capInfo(tile.deviceId, capId);
  if (v === null || v === undefined) return { v: '–', u: '' };
  if (typeof v === 'boolean') {
    const pair = BOOL_TEXT[capId] || (capId.startsWith('alarm_') ? ['Alarm', 'OK'] : ['Aan', 'Uit']);
    const isMain = capId === tile.capability;
    return { v: v ? ((isMain && tile.trueText) || pair[0]) : ((isMain && tile.falseText) || pair[1]), u: '' };
  }
  if (cap.type === 'enum' && cap.values) return { v: cap.values.find(x => x.id === v)?.title || v, u: '' };
  if (typeof v === 'number') {
    if (PERCENT_CAPS.includes(capId) && !cap.units) return { v: Math.round(v * 100), u: '%' };
    const isMain = capId === tile.capability;
    const unit = (isMain && tile.unit) || cap.units || '';
    let dec;
    if (isMain && tile.decimals !== undefined && tile.decimals !== '') dec = +tile.decimals;
    else {
      // Automatisch: grote getallen zonder decimalen, wattages en procenten altijd heel
      const a = Math.abs(v);
      dec = ['W', '%', 'lx', 'ppm', 'rpm', 'dB'].includes(unit) ? 0 : a >= 100 ? 0 : a >= 10 ? 1 : 2;
      if (cap.decimals !== null && cap.decimals !== undefined) dec = Math.min(dec, cap.decimals);
    }
    const minDec = unit === '°C' || unit === '°' ? Math.min(1, dec) : 0;
    return { v: v.toLocaleString('nl-NL', { minimumFractionDigits: minDec, maximumFractionDigits: dec }), u: unit };
  }
  return { v: String(v), u: '' };
}

function compare(v, op, ref) {
  if (typeof v === 'boolean') {
    const r = ['true', 'aan', '1', 'ja', 'open'].includes(String(ref).toLowerCase());
    return op === '!=' ? v !== r : v === r;
  }
  const a = Number(v), b = Number(String(ref).replace(',', '.'));
  if (op === '>') return a > b;
  if (op === '<') return a < b;
  if (op === '!=') return String(v) !== String(ref);
  return String(v) === String(ref) || a === b;
}

function thresholdColor(tile, v) {
  let color = null;
  for (const t of tile.thresholds || []) if (t.value !== '' && compare(v, t.op || '>', t.value)) color = t.color;
  return color;
}

function isVisible(tile) {
  const c = tile.visible;
  if (!c || !c.deviceId || !c.capability) return true;
  return compare(stateOf(c.deviceId)[c.capability], c.op || '=', c.value);
}

function lightColor(st) {
  if ('light_hue' in st && (st.light_mode === 'color' || !('light_temperature' in st))) {
    return `hsl(${Math.round(st.light_hue * 360)} ${Math.round((st.light_saturation ?? 1) * 85)}% 64%)`;
  }
  if ('light_temperature' in st) {
    const t = clamp(st.light_temperature ?? 0.5, 0, 1); // 0 = koel, 1 = warm
    return `color-mix(in srgb, #ffa94d ${Math.round(t * 100)}%, #dcebff)`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tegeltypes
// ---------------------------------------------------------------------------
const TYPES = {
  light: {
    name: 'Lamp', icon: 'lightbulb', device: true,
    render(t) {
      const st = stateOf(t.deviceId), on = !!st.onoff;
      const sub = !on ? 'Uit' : ('dim' in st ? `${Math.round(st.dim * 100)}%` : 'Aan');
      if ((t.h || 1) >= 2 && 'dim' in st) {
        const col = t.color || lightColor(st) || CAT.light;
        return {
          cls: 'gauge-tile light-gauge', html: `<div class="gauge-wrap">${gaugeSVG(on ? st.dim : 0, on ? col : 'rgba(255,255,255,.3)')}
            <div class="gauge-val"><span class="t-icon lamp-ic ${on ? 'lit' : ''}" style="--tile-glow:${col}">${icon(t.icon || 'lightbulb')}</span></div></div>
            <div class="label center">${esc(t.label)}</div><div class="sub center">${sub}</div>`,
        };
      }
      return {
        on, html: `<div class="top"><span class="t-icon">${icon(t.icon || 'lightbulb')}</span></div>
          <div><div class="label">${esc(t.label)}</div><div class="sub">${sub}</div></div>`,
        style: on ? { '--tile-glow': t.color || lightColor(st) || 'var(--glow)', '--glow-mix': `${Math.round(62 + ('dim' in st ? st.dim : 1) * 38)}%`, '--glow-px': Math.round(6 + ('dim' in st ? st.dim : 1) * 22) } : {},
      };
    },
    tap: t => doAction(t, t.tapAction || 'toggle'),
    hold: t => doAction(t, t.holdAction || 'popup'),
    popup: lightPopup,
  },
  switch: {
    name: 'Schakelaar', icon: 'power', device: true,
    render(t) {
      const st = stateOf(t.deviceId), on = !!st.onoff;
      const sub = 'measure_power' in st && on ? `${fmt(t, 'measure_power', st.measure_power).v} W` : (on ? 'Aan' : 'Uit');
      return {
        on, html: `<div class="top"><span class="t-icon">${icon(t.icon || 'power')}</span></div>
          <div><div class="label">${esc(t.label)}</div><div class="sub">${sub}</div></div>`,
        style: on ? { '--tile-glow': t.color || 'var(--glow)' } : {},
      };
    },
    tap: t => doAction(t, t.tapAction || 'toggle'),
    hold: t => doAction(t, t.holdAction || 'details'),
  },
  sensor: {
    name: 'Waarde', icon: 'gauge', device: true,
    render(t) {
      const st = stateOf(t.deviceId), raw = st[t.capability];
      const main = fmt(t, t.capability, raw);
      const sec = t.secondary ? fmt(t, t.secondary, st[t.secondary]) : null;
      const color = thresholdColor(t, raw);
      const col = color || tileColor(t);
      const num = v => (v === undefined || v === null || v === '') ? undefined : Number(String(v).replace(',', '.'));
      if (typeof raw === 'boolean') {
        // Aan/uit-waarden (deur, beweging, lek): naam groot, toestand klein, icoon licht op bij actief
        const active = raw === true;
        return {
          cls: `status-tile${active ? ' active' : ''}`, style: { '--act': col },
          html: `<div class="top"><span class="t-icon${active ? ' lit' : ''}">${icon(t.icon || 'gauge')}</span>${active ? '<span class="pulse"></span>' : ''}</div>
            <div><div class="label">${esc(t.label)}</div><div class="sub state">${esc(main.v)}</div></div>`,
        };
      }
      if (t.display === 'gauge' && typeof raw === 'number') {
        const cap = capInfo(t.deviceId, t.capability);
        const min = num(t.min) ?? cap.min ?? 0, max = num(t.max) ?? cap.max ?? 100;
        return {
          cls: 'gauge-tile', accent: color,
          html: `<div class="gauge-wrap">${gaugeSVG((raw - min) / (max - min || 1), col)}
              <div class="gauge-val"><span class="t-icon">${icon(t.icon || 'gauge')}</span>
              <div class="big">${esc(main.v)}<small>${esc(main.u)}</small></div>
              ${sec ? `<div class="sub">${esc(sec.v)} ${esc(sec.u)}</div>` : ''}</div></div>
            <div class="label center">${esc(t.label)}</div>`,
        };
      }
      const spark = wantsGraph(t) ? sparkSVG(seriesWithLive(t.deviceId, t.capability, 24), col, { zero: (t.capability || '').includes('power') }) : '';
      return {
        accent: color,
        html: `${spark}<div class="top"><span class="t-icon">${icon(t.icon || 'gauge')}</span>
            ${sec ? `<span class="sub">${esc(sec.v)} ${esc(sec.u)}</span>` : ''}</div>
          <div><div class="big${String(main.v).length > 6 ? ' long' : ''}">${esc(main.v)}<small>${esc(main.u)}</small></div>
          <div class="label">${esc(t.label)}</div></div>`,
      };
    },
    tap: t => doAction(t, t.tapAction || 'details'),
  },
  thermostat: {
    name: 'Thermostaat', icon: 'thermometer', device: true,
    render(t) {
      const st = stateOf(t.deviceId);
      const cur = fmt(t, 'measure_temperature', st.measure_temperature);
      const tgt = st.target_temperature;
      return {
        html: `<div class="top"><span class="t-icon">${icon(t.icon || 'thermometer')}</span>
            <div class="ctl-row"><button class="round" data-act="down">${icon('chevron-down')}</button>
            <button class="round" data-act="up">${icon('chevron-up')}</button></div></div>
          <div><div class="big">${esc(cur.v)}<small>°C</small></div>
          <div class="label">${esc(t.label)}</div><div class="sub">Ingesteld op ${tgt == null ? '–' : tgt.toLocaleString('nl-NL')}°</div></div>`,
      };
    },
    act(t, a) {
      const st = stateOf(t.deviceId), cap = capInfo(t.deviceId, 'target_temperature');
      const step = +(t.step || cap.step || 0.5);
      const v = clamp((st.target_temperature ?? 20) + (a === 'up' ? step : -step), cap.min ?? 5, cap.max ?? 30);
      setCap(t.deviceId, 'target_temperature', Math.round(v * 10) / 10);
    },
    tap: t => openPopup(t, thermoPopup),
  },
  blinds: {
    name: 'Zonwering', icon: 'blinds', device: true,
    render(t) {
      const st = stateOf(t.deviceId);
      const pos = st.windowcoverings_set;
      const hasState = 'windowcoverings_state' in st;
      return {
        html: `<div class="top"><span class="t-icon">${icon(t.icon || 'blinds')}</span>
            ${hasState ? `<div class="ctl-row"><button class="round" data-act="up">${icon('chevron-up')}</button>
            <button class="round" data-act="idle">${icon('square')}</button>
            <button class="round" data-act="down">${icon('chevron-down')}</button></div>` : ''}</div>
          <div><div class="label">${esc(t.label)}</div>
          <div class="sub">${pos == null ? '–' : `${Math.round(pos * 100)}% open`}</div>
          <div class="bar-meter" style="margin-top:8px"><i style="width:${Math.round((pos ?? 0) * 100)}%"></i></div></div>`,
      };
    },
    act: (t, a) => setCap(t.deviceId, 'windowcoverings_state', a),
    tap: t => openPopup(t, blindsPopup),
  },
  button: {
    name: 'Knop', icon: 'circle-play', device: true,
    render: t => ({ html: `<div class="top"><span class="t-icon">${icon(t.icon || 'circle-play')}</span></div><div class="label">${esc(t.label)}</div>` }),
    // Virtuele knop in Homey indrukken; de flow die eraan hangt doet de rest
    tap: t => confirmThen(t, async () => {
      await api('POST', `/api/device/${encodeURIComponent(t.deviceId)}/button`, { value: true });
      flash(t); toast(`${t.label} ingedrukt`);
    }),
  },
  flow: {
    name: 'Flow starten', icon: 'play',
    render: t => ({ html: `<div class="top"><span class="t-icon">${icon(t.icon || 'play')}</span></div><div class="label">${esc(t.label)}</div>` }),
    tap: t => confirmThen(t, async () => {
      await api('POST', `/api/flow/${t.flowKind || 'flow'}/${encodeURIComponent(t.flowId)}`);
      flash(t); toast(`${t.label} gestart`);
    }),
  },
  mood: {
    name: 'Mood', icon: 'sparkles',
    render: t => ({ html: `<div class="top"><span class="t-icon">${icon(t.icon || 'sparkles')}</span></div><div class="label">${esc(t.label)}</div>` }),
    tap: t => confirmThen(t, async () => {
      await api('POST', `/api/mood/${encodeURIComponent(t.moodId)}`);
      flash(t); toast(`${t.label} ingesteld`);
    }),
  },
  camera: {
    name: 'Camera', icon: 'cctv', device: true,
    render(t) {
      const motion = stateOf(t.deviceId).alarm_motion === true;
      return {
        cls: 'camera-tile',
        html: `<img class="cam-img" data-cam="${esc(t.deviceId)}" alt="" src="${camUrl(t)}" onerror="this.classList.add('err')">
          <div class="cam-err">${icon('cctv')}<span>Geen beeld</span></div>
          <div class="cam-bar"><span class="t-icon">${icon(t.icon || 'cctv')}</span><span class="label">${esc(t.label)}</span>
          ${motion ? '<span class="cam-motion">Beweging</span>' : ''}<span class="cam-time" data-camtime></span></div>`,
      };
    },
    tap: t => openPopup(t, camPopup, startCamPopup),
  },
  chart: {
    name: 'Grafiek', icon: 'chart-spline',
    render: t => chartRender(t),
  },
  rooms: {
    name: 'Ruimtes', icon: 'layout-list',
    render: t => roomsRender(t),
  },
  header: {
    name: 'Kop', icon: 'heading',
    render: t => ({ cls: 'header-tile', html: `<div class="label">${esc(t.label)}</div>` }),
  },
  clock: {
    name: 'Klok', icon: 'clock',
    render(t) {
      const d = new Date();
      return {
        cls: 'clock-tile', html: `<div class="big">${hhmm(d)}</div>
          ${t.showDate !== false ? `<div class="label">${d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</div>` : ''}`,
      };
    },
  },
};

function suggestTile(d) {
  const c = d.capabilities;
  const base = { id: uid('t'), deviceId: d.id, label: d.name, w: 1, h: 1 };
  if (d.images && ['camera', 'doorbell'].includes(d.class)) return { ...base, type: 'camera', icon: 'cctv', w: 2, h: 2 };
  if (c.windowcoverings_set || c.windowcoverings_state) return { ...base, type: 'blinds', icon: 'blinds', w: 2 };
  if (c.target_temperature) return { ...base, type: 'thermostat', icon: 'thermometer', w: 2 };
  if (c.onoff && (c.dim || d.class === 'light' || d.virtualClass === 'light')) return { ...base, type: 'light', icon: 'lightbulb' };
  if (c.button && !c.onoff) return { ...base, type: 'button', icon: 'circle-play' };
  if (c.onoff) return { ...base, type: 'switch', icon: d.class === 'socket' ? 'plug' : 'power' };
  const order = ['measure_power', 'measure_temperature', 'alarm_contact', 'alarm_motion', 'measure_humidity'];
  const cap = order.find(x => c[x]) || Object.keys(c).find(x => /^(measure_|alarm_|meter_)/.test(x)) || Object.keys(c)[0];
  const ic = { measure_power: 'zap', measure_temperature: 'thermometer', alarm_contact: 'door-closed', alarm_motion: 'footprints', measure_humidity: 'droplets' }[cap] || 'gauge';
  return { ...base, type: 'sensor', capability: cap, icon: ic };
}

// ---------------------------------------------------------------------------
// Acties
// ---------------------------------------------------------------------------
function doAction(t, action) {
  if (action === 'toggle') setCap(t.deviceId, 'onoff', !stateOf(t.deviceId).onoff);
  else if (action === 'popup') openPopup(t, TYPES[t.type].popup || detailsPopup);
  else if (action === 'details') openPopup(t, detailsPopup);
}

function confirmThen(t, fn) {
  const run = () => fn().catch(e => toast(`Niet gelukt: ${e.message}`));
  if (!t.confirm) return run();
  openPopup(t, () => `<h3>${esc(t.label)}</h3><div class="sub">Weet je het zeker?</div>
    <div class="actions"><button class="btn" data-close>Annuleren</button><button class="btn primary" data-ok>Uitvoeren</button></div>`,
  root => root.querySelector('[data-ok]').onclick = () => { closePopup(); run(); });
}

function flash(t) {
  const el = grid.querySelector(`[data-id="${t.id}"]`);
  if (!el) return;
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

// ---------------------------------------------------------------------------
// Pop-ups
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Camera's: beeld via de server, ververst zolang de pagina zichtbaar is
// ---------------------------------------------------------------------------
const camUrl = (t, ts = Date.now()) => `/api/camera/${encodeURIComponent(t.deviceId)}?t=${ts}`;
const camLast = {};
function refreshCams(force) {
  if (document.visibilityState !== 'visible' || !S.layout) return;
  const now = Date.now();
  for (const t of page().tiles.filter(x => x.type === 'camera')) {
    if (!force && now - (camLast[t.id] || 0) < (+t.refresh || 10) * 1000) continue;
    camLast[t.id] = now;
    const img = grid.querySelector(`[data-id="${t.id}"] .cam-img`);
    if (!img) continue;
    const next = new Image();   // eerst laden, dan wisselen: geen flikkering
    next.onload = () => {
      img.src = next.src; img.classList.remove('err');
      const tm = img.parentElement.querySelector('[data-camtime]');
      if (tm) tm.textContent = hhmm(new Date()) + ':' + String(new Date().getSeconds()).padStart(2, '0');
    };
    next.onerror = () => img.classList.add('err');
    next.src = camUrl(t, now);
  }
}
setInterval(refreshCams, 1000);

function camPopup(t) {
  return `<div class="cam-pop"><img id="camBig" src="${camUrl(t)}" alt="${esc(t.label)}"></div>
    <div class="cam-pop-bar"><h3>${esc(t.label)}</h3><button class="btn" data-close>Sluiten</button></div>`;
}
function startCamPopup(root) {
  const t = S.popupTile;
  root.classList.add('wide');
  clearInterval(S.camTimer);
  S.camTimer = setInterval(() => {
    const big = document.getElementById('camBig');
    if (!big || $('#popupWrap').hidden) { clearInterval(S.camTimer); return; }
    const n = new Image(); n.onload = () => { big.src = n.src; }; n.src = camUrl(t);
  }, 2000);
}

function openPopup(t, builder, after) {
  S.popupTile = t;
  const root = $('#popup');
  root.classList.remove('wide');
  root.innerHTML = builder(t);
  $('#popupWrap').hidden = false;
  root.querySelectorAll('[data-close]').forEach(b => b.onclick = closePopup);
  wireSliders(root, t);
  after?.(root);
}
function closePopup() { $('#popupWrap').hidden = true; S.popupTile = null; clearInterval(S.camTimer); $('#popup').classList.remove('wide'); }
$('#popupWrap').addEventListener('click', e => { if (e.target.id === 'popupWrap') closePopup(); });

function slider(capId, label, value, opts = {}) {
  const min = opts.min ?? 0, max = opts.max ?? 1, step = opts.step ?? 0.01;
  const shown = opts.fmt ? opts.fmt(value) : `${Math.round((value ?? 0) * 100)}%`;
  return `<div class="slider"><div class="sl-head"><span>${label}</span><span data-out="${capId}">${shown}</span></div>
    <input type="range" data-cap="${capId}" min="${min}" max="${max}" step="${step}" value="${value ?? min}"
      style="${opts.track ? `--track:${opts.track}` : ''}"></div>`;
}

function wireSliders(root, t) {
  root.querySelectorAll('input[type=range][data-cap]').forEach(inp => {
    let last = 0, timer;
    const cap = inp.dataset.cap;
    const out = root.querySelector(`[data-out="${cap}"]`);
    const send = () => setCap(t.deviceId, cap, Number(inp.value));
    inp.addEventListener('input', () => {
      if (out) out.textContent = cap === 'target_temperature' ? `${Number(inp.value).toLocaleString('nl-NL')}°` : `${Math.round(inp.value * 100)}%`;
      const now = Date.now();
      clearTimeout(timer);
      if (now - last > 300) { last = now; send(); } else timer = setTimeout(send, 300);
    });
    inp.addEventListener('change', () => { clearTimeout(timer); send(); });
  });
  root.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => {
    const [cap, val] = b.dataset.cmd.split(':');
    setCap(t.deviceId, cap, val === 'toggle' ? !stateOf(t.deviceId)[cap] : val);
    if (cap === 'onoff') setTimeout(() => openPopup(t, TYPES[t.type].popup || detailsPopup), 50);
  });
}

function lightPopup(t) {
  const st = stateOf(t.deviceId);
  let h = `<h3>${esc(t.label)}</h3><div class="sub">${esc(device(t.deviceId)?.zoneName || '')}</div>
    <button class="btn ${st.onoff ? 'primary' : ''}" style="width:100%" data-cmd="onoff:toggle">${icon('power')} ${st.onoff ? 'Uitzetten' : 'Aanzetten'}</button>`;
  if ('dim' in st) h += slider('dim', 'Helderheid', st.dim, { track: 'linear-gradient(90deg,#2a2f3a,#ffe7b0)' });
  if ('light_temperature' in st) h += slider('light_temperature', 'Kleurtemperatuur', st.light_temperature, { track: 'linear-gradient(90deg,#dcebff,#ffb35c)', fmt: v => `${Math.round(v * 100)}% warm` });
  if ('light_hue' in st) h += slider('light_hue', 'Kleur', st.light_hue, { track: 'linear-gradient(90deg,hsl(0 80% 60%),hsl(60 80% 60%),hsl(120 80% 60%),hsl(180 80% 60%),hsl(240 80% 60%),hsl(300 80% 60%),hsl(360 80% 60%))' });
  if ('light_saturation' in st) h += slider('light_saturation', 'Verzadiging', st.light_saturation, { track: 'linear-gradient(90deg,#ddd,hsl(30 90% 60%))' });
  return h + `<div class="actions"><button class="btn" data-close>Sluiten</button></div>`;
}

function thermoPopup(t) {
  const st = stateOf(t.deviceId), cap = capInfo(t.deviceId, 'target_temperature');
  return `<h3>${esc(t.label)}</h3><div class="sub">Nu ${fmt(t, 'measure_temperature', st.measure_temperature).v}°C</div>
    ${slider('target_temperature', 'Doeltemperatuur', st.target_temperature, { min: cap.min ?? 5, max: cap.max ?? 30, step: t.step || cap.step || 0.5, fmt: v => `${(v ?? 0).toLocaleString('nl-NL')}°` })}
    <div class="actions"><button class="btn" data-close>Sluiten</button></div>`;
}

function blindsPopup(t) {
  const st = stateOf(t.deviceId);
  return `<h3>${esc(t.label)}</h3><div class="sub">${esc(device(t.deviceId)?.zoneName || '')}</div>
    ${'windowcoverings_set' in st ? slider('windowcoverings_set', 'Positie', st.windowcoverings_set) : ''}
    ${'windowcoverings_state' in st ? `<div class="actions">
      <button class="btn" data-cmd="windowcoverings_state:up">${icon('chevron-up')} Omhoog</button>
      <button class="btn" data-cmd="windowcoverings_state:idle">${icon('square')} Stop</button>
      <button class="btn" data-cmd="windowcoverings_state:down">${icon('chevron-down')} Omlaag</button></div>` : ''}
    <div class="actions"><button class="btn" data-close>Sluiten</button></div>`;
}

function detailsPopup(t) {
  const d = device(t.deviceId), st = stateOf(t.deviceId);
  const rows = Object.keys(d?.capabilities || st).map(c => {
    const f = fmt({ deviceId: t.deviceId }, c, st[c]);
    return `<div class="pick" style="cursor:default"><div class="meta"><div>${esc(d?.capabilities?.[c]?.title || c)}</div></div><strong>${esc(f.v)} ${esc(f.u)}</strong></div>`;
  }).join('');
  return `<h3>${esc(t.label)}</h3><div class="sub">${esc(d?.name || '')}${d?.zoneName ? `, ${esc(d.zoneName)}` : ''}</div>${rows}
    <div class="actions"><button class="btn" data-close>Sluiten</button></div>`;
}

// ---------------------------------------------------------------------------
// Renderen
// ---------------------------------------------------------------------------
function applySettings() {
  const s = settings();
  const root = document.documentElement;
  root.dataset.theme = s.theme || 'auto';
  root.dataset.bg = s.background || 'ocean';
  root.dataset.blur = s.lowEffects ? 'off' : 'on';
  root.dataset.bgimg = s.bgImage ? '1' : '0';
  root.style.setProperty('--bg-image', s.bgImage ? `url("${s.bgImage.replace(/"/g, '')}")` : 'none');
  document.documentElement.style.setProperty('--gap', `${s.gap ?? 12}px`);
  document.title = s.title || 'Thuis';
  $('#dashTitle').textContent = s.title || '';
  $('#dashTitle').hidden = !s.title || s.showTitle !== true;
  $('#clock').hidden = s.showClock === false;
  relayout();
}

function relayout() {
  if (!S.layout) return;
  const s = settings();
  const W = grid.clientWidth || window.innerWidth;
  const gap = s.gap ?? 12, cell = s.cellSize || 130;
  const cols = Math.max(2, Math.floor((W + gap) / (cell + gap)));
  const colW = (W - gap * (cols - 1)) / cols;
  const row = Math.round(clamp(colW * 0.95, cell * 0.85, cell * 1.2));
  const half = (row - gap) / 2;
  grid.style.setProperty('--cols', cols);
  grid.style.setProperty('--row', `${half}px`);
  S.cols = cols;
  grid.querySelectorAll('.tile[data-id]').forEach(el => {
    el.style.setProperty('--w', Math.min(+el.dataset.w || 1, cols));
  });
}

function renderPages() {
  const nav = $('#pages');
  nav.innerHTML = S.layout.pages.map((p, i) =>
    `<button class="page-tab ${i === S.pageIdx ? 'active' : ''}" data-page="${i}">${icon(p.icon || 'house')}<span>${esc(p.name)}</span></button>`
  ).join('') + (S.editing ? `<button class="page-tab add" data-addpage>${icon('plus')}<span>Pagina</span></button>` : '');
  nav.querySelectorAll('[data-page]').forEach(b => b.onclick = () => goPage(+b.dataset.page));
  nav.querySelector('[data-addpage]')?.addEventListener('click', addPage);
}

function tileElement(t) {
  const el = document.createElement('div');
  el.dataset.id = t.id;
  fillTile(el, t);
  return el;
}

function fillTile(el, t) {
  const type = TYPES[t.type];
  if (!type) { el.className = 'tile'; el.innerHTML = `<div class="label">Onbekend type</div>`; return; }
  const missing = type.device && S.catalog?.devices.length && !device(t.deviceId);
  const r = missing ? { html: `<div class="top"><span class="t-icon">${icon(t.icon)}</span></div><div><div class="label">${esc(t.label)}</div><div class="sub">Apparaat niet gevonden</div></div>` } : type.render(t);
  const full = t.w === 'full' || t.type === 'header';
  el.className = ['tile', r.cls, (t.h || 1) > 1 && 'tall', r.on && 'on', r.accent && 'accented', full && 'full', missing && 'unavailable',
    !S.editing && !isVisible(t) && 'hidden-tile'].filter(Boolean).join(' ');
  el.style.cssText = '';
  el.style.setProperty('--cat', tileColor(t));
  el.dataset.w = full ? 1 : t.w || 1;
  el.style.setProperty('--w', Math.min(+el.dataset.w, S.cols || 4));
  el.style.setProperty('--h', t.h || 1);
  el.style.setProperty('--hs', full && t.type === 'header' ? 1 : (t.h || 1) * 2);   // raster werkt in halve rijen
  if (r.accent) el.style.setProperty('--tile-accent', r.accent);
  for (const [k, v] of Object.entries(r.style || {})) el.style.setProperty(k, v);
  if (!S.editing && !isVisible(t)) el.style.display = 'none';
  else if (S.editing && !isVisible(t)) el.style.opacity = '.5';
  el.innerHTML = r.html + `<span class="edit-badge">${icon('settings')}</span>`;
}

function renderGrid() {
  const p = page();
  grid.innerHTML = '';
  for (const t of p.tiles) grid.appendChild(tileElement(t));
  if (S.editing) {
    const add = document.createElement('button');
    add.className = 'tile add-tile';
    add.innerHTML = `${icon('plus')}<span>Tegel toevoegen</span>`;
    add.onclick = openAddPanel;
    grid.appendChild(add);
  } else if (!p.tiles.length) {
    grid.innerHTML = `<div class="empty"><strong>Deze pagina is nog leeg</strong>Tik op het potlood rechtsboven om lampen, sensoren en flows toe te voegen.</div>`;
  }
  relayout();
}

function renderAll() {
  if (!S.layout) return;
  renderPages();
  renderSide();
  renderChips();
  renderGrid();
  tickClock();
  refreshHistory();
}

// Grafiekgegevens ophalen voor de huidige pagina en de statusregels
async function refreshHistory(force) {
  if (!S.layout) return;
  const changed = await loadHistory(historyKeysFor(page().tiles), force);
  if (!changed) return;
  for (const t of page().tiles) {
    if (t.type === 'chart' || wantsGraph(t)) { const el = grid.querySelector(`[data-id="${t.id}"]`); if (el) fillTile(el, t); }
  }
  renderSide();
}
setInterval(() => refreshHistory(true), 5 * 60 * 1000);

// Statusbalk/zijpaneel niet bij elke meting opnieuw tekenen, maar hooguit elke seconde
let statusTimer = null;
function scheduleStatus() {
  if (statusTimer) return;
  statusTimer = setTimeout(() => { statusTimer = null; renderSide(); renderChips(); }, 1000);
}

function refreshDevice(devId) {
  scheduleStatus();
  for (const t of page().tiles) {
    if (t.deviceId === devId || t.visible?.deviceId === devId || t.type === 'rooms' || TYPES[t.type]?.watches?.(t, devId)
      || (t.type === 'chart' && (t.series || []).some(x => x.deviceId === devId))) {
      const el = grid.querySelector(`[data-id="${t.id}"]`);
      if (el) fillTile(el, t);
    }
  }
  if (S.popupTile?.deviceId === devId) {
    // Alleen de getoonde waarden bijwerken, niet de schuifregelaar waar je mee bezig bent
    const st = stateOf(devId);
    document.querySelectorAll('#popup input[type=range][data-cap]').forEach(inp => {
      if (document.activeElement !== inp && st[inp.dataset.cap] !== undefined) inp.value = st[inp.dataset.cap];
    });
  }
}

function goPage(i) {
  S.pageIdx = clamp(i, 0, S.layout.pages.length - 1);
  renderPages(); renderGrid(); refreshHistory();
  $('#pages').children[S.pageIdx]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}

let lastMinute = -1;
// ---------------------------------------------------------------------------
// Lucht achter het glasthema: kleuren volgen het tijdstip, de zon/maan beweegt mee
// ---------------------------------------------------------------------------
const SKY = [ // [uur, kleur boven, kleur linksboven, kleur rechtsonder, gloed, gloed-sterkte]
  [0,    '#0b1033', '#1d2266', '#3b2a72', '#9fb4ff', 0.28],
  [5,    '#121640', '#2a2c70', '#5a3577', '#b8b4ff', 0.25],
  [7,    '#2a3172', '#c0607a', '#f2a65a', '#ffc58a', 0.60],
  [10,   '#1b4aa3', '#2f86c9', '#2fa59a', '#fff1c2', 0.50],
  [16,   '#1d4699', '#3a7cc4', '#3aa889', '#ffe3a3', 0.50],
  [19,   '#2a2466', '#8a3f86', '#ee8150', '#ffa86b', 0.65],
  [21.5, '#141a4a', '#2b2f7c', '#5d3a8e', '#c7b8ff', 0.30],
  [24,   '#0b1033', '#1d2266', '#3b2a72', '#9fb4ff', 0.28],
];
const mixHex = (a, b, f) => '#' + [0, 2, 4].map(i => Math.round(parseInt(a.substr(1 + i, 2), 16) * (1 - f) + parseInt(b.substr(1 + i, 2), 16) * f).toString(16).padStart(2, '0')).join('');
const PALETTES = { // boven, linksboven, rechtsonder, gloed, gloedsterkte, gloed x/y
  aurora: ['#3b1a78', '#e0306f', '#2f7cf6', '#ff8a5c', 0.55, 80, 15],
  ocean: ['#0b2a5b', '#0e7490', '#14b8a6', '#a5f3fc', 0.35, 20, 85],
  sunset: ['#3a1c5c', '#d9466f', '#f59e0b', '#ffc073', 0.6, 75, 80],
  forest: ['#0f2a24', '#166a4f', '#65a30d', '#d9f99d', 0.3, 85, 20],
  midnight: ['#070b1f', '#1e1b4b', '#6d28d9', '#a5b4fc', 0.3, 70, 10],
};
function updateSky() {
  const pal = PALETTES[S.layout?.settings?.background];
  if (pal) {
    const r = document.documentElement.style;
    ['--sky1', '--sky2', '--sky3', '--orb'].forEach((k, n) => r.setProperty(k, pal[n]));
    r.setProperty('--orb-o', pal[4]); r.setProperty('--orb-x', pal[5]); r.setProperty('--orb-y', pal[6]);
    return;
  }
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  let i = SKY.findIndex(k => k[0] > h) - 1;
  if (i < 0) i = SKY.length - 2;
  const a = SKY[i], b = SKY[i + 1], f = (h - a[0]) / (b[0] - a[0]);
  const r = document.documentElement.style;
  ['--sky1', '--sky2', '--sky3', '--orb'].forEach((k, n) => r.setProperty(k, mixHex(a[n + 1], b[n + 1], f)));
  r.setProperty('--orb-o', (a[5] + (b[5] - a[5]) * f).toFixed(2));
  // Overdag loopt de zon van links naar rechts in een boog, 's nachts doet de maan hetzelfde
  const day = h >= 6.5 && h < 20.5;
  const p = day ? (h - 6.5) / 14 : ((h - 20.5 + 24) % 24) / 10;
  r.setProperty('--orb-x', (8 + p * 84).toFixed(1));
  r.setProperty('--orb-y', (62 - Math.sin(p * Math.PI) * 52).toFixed(1));
}

function tickClock() {
  updateSky();
  const d = new Date();
  $('#clock').innerHTML = `${hhmm(d)}<span class="clock-date">${d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>`;
  if (!S.layout || d.getMinutes() === lastMinute) return;
  lastMinute = d.getMinutes();
  renderSide();
  page().tiles.filter(t => t.type === 'clock').forEach(t => {
    const el = grid.querySelector(`[data-id="${t.id}"]`); if (el) fillTile(el, t);
  });
  nightDim();
}
setInterval(tickClock, 1000);

// ---------------------------------------------------------------------------
// Aanraken: tikken, lang indrukken, vegen tussen pagina's
// ---------------------------------------------------------------------------
let press = null;
grid.addEventListener('pointerdown', e => {
  const el = e.target.closest('.tile[data-id]');
  if (!el || S.editing || e.target.closest('[data-act]')) return;
  const t = page().tiles.find(x => x.id === el.dataset.id);
  press = { t, x: e.clientX, y: e.clientY, fired: false };
  press.timer = setTimeout(() => {
    press.fired = true;
    navigator.vibrate?.(15);
    TYPES[t.type]?.hold?.(t);
  }, 480);
});
grid.addEventListener('pointermove', e => {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) { clearTimeout(press.timer); press.moved = true; }
});
grid.addEventListener('pointerup', () => {
  if (!press) return;
  clearTimeout(press.timer);
  if (!press.fired && !press.moved) TYPES[press.t.type]?.tap?.(press.t);
  press = null;
});
grid.addEventListener('pointercancel', () => { if (press) clearTimeout(press.timer); press = null; });

grid.addEventListener('click', e => {
  const act = e.target.closest('[data-act]');
  const el = e.target.closest('.tile[data-id]');
  if (!el) return;
  const t = page().tiles.find(x => x.id === el.dataset.id);
  if (S.editing) return;
  if (act) { e.stopPropagation(); TYPES[t.type]?.act?.(t, act.dataset.act); }
});

// In bewerkmodus: kort tikken op een tegel opent de instellingen, slepen verplaatst hem
let editPress = null;
grid.addEventListener('pointerdown', e => {
  const el = e.target.closest('.tile[data-id]');
  editPress = S.editing && el ? { id: el.dataset.id, x: e.clientX, y: e.clientY, at: Date.now() } : null;
}, true);
document.addEventListener('pointerup', e => {
  const p = editPress; editPress = null;
  if (!p || !S.editing) return;
  if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8 || Date.now() - p.at > 600) return;
  const t = page().tiles.find(x => x.id === p.id);
  if (t) openTileSettings(t);
}, true);

let swipe = null;
$('#viewport').addEventListener('pointerdown', e => { if (!S.editing) swipe = { x: e.clientX, y: e.clientY }; });
$('#viewport').addEventListener('pointerup', e => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 90 && Math.abs(dy) < 60) goPage(S.pageIdx + (dx < 0 ? 1 : -1));
});

// ---------------------------------------------------------------------------
// Bewerkmodus
// ---------------------------------------------------------------------------
$('#btnEdit').onclick = async () => {
  if (S.status.pinRequired && !S.token) {
    openPopup({}, () => `<h3>Bewerken</h3><div class="sub">Voer de pincode in</div>
      <input type="password" inputmode="numeric" id="pinInput" autocomplete="off">
      <div class="actions"><button class="btn" data-close>Annuleren</button><button class="btn primary" id="pinOk">Ontgrendelen</button></div>`,
    root => {
      const inp = root.querySelector('#pinInput'); inp.focus();
      const go = async () => {
        try { S.token = (await api('POST', '/api/auth', { pin: inp.value })).token; closePopup(); startEdit(); }
        catch (e) { toast(e.message); inp.value = ''; }
      };
      root.querySelector('#pinOk').onclick = go;
      inp.onkeydown = e => { if (e.key === 'Enter') go(); };
    });
    return;
  }
  startEdit();
};

async function startEdit() {
  await loadCatalog(true);
  S.editing = true;
  S.undo = [];
  document.body.classList.add('editing');
  $('#editActions').hidden = false;
  renderAll();
  S.sortable = new Sortable(grid, {
    animation: 160,
    draggable: '.tile[data-id]',
    delay: 150, delayOnTouchOnly: true,
    forceFallback: true, fallbackTolerance: 8,
    ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
    onEnd() {
      pushUndo();
      const order = [...grid.querySelectorAll('.tile[data-id]')].map(e => e.dataset.id);
      page().tiles.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      save();
    },
  });
}

$('#btnDone').onclick = () => {
  S.editing = false;
  document.body.classList.remove('editing');
  $('#editActions').hidden = true;
  S.sortable?.destroy(); S.sortable = null;
  closePanel();
  save(true);
  renderAll();
};

$('#btnUndo').onclick = () => {
  const prev = S.undo.pop();
  if (!prev) return toast('Niets meer om ongedaan te maken');
  const v = S.layout.version;
  S.layout = JSON.parse(prev); S.layout.version = v;
  S.pageIdx = Math.min(S.pageIdx, S.layout.pages.length - 1);
  closePanel(); applySettings(); renderAll(); save();
};
$('#btnSettings').onclick = openGlobalSettings;

function addPage() {
  pushUndo();
  S.layout.pages.push({ id: uid('p'), name: `Pagina ${S.layout.pages.length + 1}`, icon: 'layout-grid', tiles: [] });
  save(); goPage(S.layout.pages.length - 1);
}

// ---------------------------------------------------------------------------
// Paneel
// ---------------------------------------------------------------------------
function openPanel(title, body, foot = '') {
  $('#panelTitle').textContent = title;
  $('#panelBody').innerHTML = body;
  $('#panelFoot').innerHTML = foot;
  $('#panel').classList.add('show');
  $('#scrim').classList.add('show');
  $('#panel').setAttribute('aria-hidden', 'false');
}
function closePanel() {
  $('#panel').classList.remove('show');
  $('#scrim').classList.remove('show');
  $('#panel').setAttribute('aria-hidden', 'true');
}
$('#panelClose').onclick = closePanel;
$('#scrim').onclick = closePanel;

// --- Tegel toevoegen ---
async function openAddPanel() {
  const cat = await loadCatalog();
  let tab = 'devices', q = '';
  const draw = () => {
    const match = s => s.toLowerCase().includes(q.toLowerCase());
    let list = '';
    if (tab === 'devices') {
      const byZone = {};
      cat.devices.filter(d => match(d.name) || match(d.zoneName)).forEach(d => (byZone[d.zoneName || 'Overig'] ||= []).push(d));
      list = Object.keys(byZone).sort().map(z => `<div class="zone-title">${esc(z)}</div>` + byZone[z].map(d => {
        const sug = suggestTile(d);
        return `<button class="pick" data-dev="${esc(d.id)}">${icon(sug.icon)}<div class="meta"><div>${esc(d.name)}</div>
          <div>${TYPES[sug.type].name}, ${Object.keys(d.capabilities).length} eigenschappen</div></div>${icon('plus')}</button>`;
      }).join('')).join('') || '<p class="hint">Geen apparaten gevonden.</p>';
    } else if (tab === 'flows') {
      list = cat.flows.filter(f => match(f.name)).map(f => `<button class="pick" data-flow="${esc(f.id)}" data-kind="${f.kind}">${icon('play')}
        <div class="meta"><div>${esc(f.name)}</div><div>${f.kind === 'advanced' ? 'Advanced flow' : 'Flow'}</div></div>${icon('plus')}</button>`).join('')
        || '<p class="hint">Geen startbare flows. Een flow verschijnt hier als hij een "Deze flow is gestart"-kaart heeft.</p>';
    } else if (tab === 'moods') {
      list = cat.moods.filter(m => match(m.name)).map(m => `<button class="pick" data-mood="${esc(m.id)}">${icon('sparkles')}
        <div class="meta"><div>${esc(m.name)}</div><div>${esc(m.zoneName)}</div></div>${icon('plus')}</button>`).join('') || '<p class="hint">Geen moods gevonden.</p>';
    } else {
      list = `<button class="pick" data-extra="header">${icon('heading')}<div class="meta"><div>Kop</div><div>Tekst over de volle breedte om tegels te groeperen</div></div>${icon('plus')}</button>
        ${Object.entries(TYPES).filter(([, v]) => v.addable).map(([k, v]) => `<button class="pick" data-extra="${k}">${icon(v.icon)}<div class="meta"><div>${v.name}</div><div>${v.addable.desc}</div></div>${icon('plus')}</button>`).join('')}
        <button class="pick" data-extra="chart">${icon('chart-spline')}<div class="meta"><div>Grafiek</div><div>Verloop van één of meer waarden, bijvoorbeeld net en zon</div></div>${icon('plus')}</button>
        <button class="pick" data-extra="rooms">${icon('layout-list')}<div class="meta"><div>Ruimtes</div><div>Overzicht per ruimte: lampen aan en temperatuur</div></div>${icon('plus')}</button>
        <button class="pick" data-extra="clock">${icon('clock')}<div class="meta"><div>Klok</div><div>Tijd en datum</div></div>${icon('plus')}</button>`;
    }
    $('#panelBody').querySelector('.list').innerHTML = list;
    $('#panelBody').querySelectorAll('.tabs button').forEach(b => b.classList.toggle('sel', b.dataset.tab === tab));
  };
  openPanel('Tegel toevoegen', `<div class="tabs">
      <button data-tab="devices">Apparaten</button><button data-tab="flows">Flows</button>
      <button data-tab="moods">Moods</button><button data-tab="extra">Overig</button></div>
    <input type="search" placeholder="Zoeken" id="addSearch"><div class="list"></div>`);
  $('#panelBody').querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
  $('#addSearch').oninput = e => { q = e.target.value; draw(); };
  $('#panelBody').querySelector('.list').onclick = e => {
    const b = e.target.closest('.pick'); if (!b) return;
    let t;
    if (b.dataset.dev) t = suggestTile(device(b.dataset.dev));
    else if (b.dataset.flow) { const f = cat.flows.find(x => x.id === b.dataset.flow); t = { id: uid('t'), type: 'flow', flowId: f.id, flowKind: f.kind, label: f.name, icon: 'play', w: 1, h: 1 }; }
    else if (b.dataset.mood) { const m = cat.moods.find(x => x.id === b.dataset.mood); t = { id: uid('t'), type: 'mood', moodId: m.id, label: m.name, icon: 'sparkles', w: 1, h: 1 }; }
    else if (b.dataset.extra === 'header') t = { id: uid('t'), type: 'header', label: 'Nieuwe kop', w: 'full', h: 1 };
    else if (TYPES[b.dataset.extra]?.addable) t = { id: uid('t'), type: b.dataset.extra, label: TYPES[b.dataset.extra].name, icon: TYPES[b.dataset.extra].icon, ...TYPES[b.dataset.extra].addable.make() };
    else if (b.dataset.extra === 'chart') t = { id: uid('t'), type: 'chart', label: 'Grafiek', icon: 'chart-spline', w: 4, h: 2, hours: 24, series: [] };
    else if (b.dataset.extra === 'rooms') t = { id: uid('t'), type: 'rooms', label: 'Ruimtes', icon: 'layout-list', w: 2, h: 3 };
    else if (b.dataset.extra === 'clock') t = { id: uid('t'), type: 'clock', label: 'Klok', w: 2, h: 1, showDate: true };
    pushUndo();
    page().tiles.push(t);
    save(); renderGrid();
    openTileSettings(t);
  };
  draw();
}

// --- Tegelinstellingen ---
function deviceSelect(name, value, filter) {
  const byZone = {};
  (S.catalog?.devices || []).filter(filter || (() => true)).forEach(d => (byZone[d.zoneName || 'Overig'] ||= []).push(d));
  return `<select name="${name}"><option value="">Kies een apparaat</option>` + Object.keys(byZone).sort().map(z =>
    `<optgroup label="${esc(z)}">${byZone[z].map(d => `<option value="${esc(d.id)}" ${d.id === value ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</optgroup>`).join('') + '</select>';
}
function capSelect(name, devId, value, allowEmpty) {
  const caps = device(devId)?.capabilities || {};
  return `<select name="${name}">${allowEmpty ? '<option value="">Geen</option>' : ''}${Object.entries(caps).map(([id, c]) =>
    `<option value="${id}" ${id === value ? 'selected' : ''}>${esc(c.title || id)}${c.units ? ` (${esc(c.units)})` : ''}</option>`).join('')}</select>`;
}
const seg = (name, options, value) => `<div class="seg" data-seg="${name}">${options.map(([v, l]) =>
  `<button type="button" data-v="${v}" class="${String(v) === String(value) ? 'sel' : ''}">${l}</button>`).join('')}</div>`;

function openTileSettings(t) {
  const type = TYPES[t.type];
  const isDev = type.device;
  const capIsBool = isDev && t.capability && capInfo(t.deviceId, t.capability).type === 'boolean';
  const actions = [['toggle', 'Aan/uit'], ['popup', 'Bediening'], ['details', 'Details'], ['none', 'Niets']];

  let h = `<div class="field"><label>Naam</label><input type="text" name="label" value="${esc(t.label)}"></div>`;
  if (t.type !== 'header') {
    h += `<div class="field"><span class="flabel">Icoon</span><div id="tileIconPicker"></div></div>`;
    h += `<div class="field"><span class="flabel">Breedte</span>${seg('w', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], ['full', 'Volle rij']], t.w || 1)}</div>
      <div class="field"><span class="flabel">Hoogte</span>${seg('h', [[1, '1'], [2, '2'], [3, '3']], t.h || 1)}</div>`;
  }
  if (isDev) {
    h += `<div class="field"><label>Apparaat</label>${deviceSelect('deviceId', t.deviceId)}</div>
      <div class="field"><span class="flabel">Soort tegel</span>${seg('type', Object.entries(TYPES).filter(([, v]) => v.device).map(([k, v]) => [k, v.name]), t.type)}</div>`;
  }
  if (t.type === 'light' || t.type === 'switch') {
    h += `<div class="field"><span class="flabel">Bij tikken</span>${seg('tapAction', actions, t.tapAction || 'toggle')}</div>
      <div class="field"><span class="flabel">Bij lang indrukken</span>${seg('holdAction', actions, t.holdAction || (t.type === 'light' ? 'popup' : 'details'))}</div>
      <div class="field"><span class="flabel">Kleur als hij aan is</span>
        <label class="check"><input type="checkbox" name="useColor" ${t.color ? 'checked' : ''}> Vaste kleur gebruiken in plaats van de lichtkleur</label>
        <input type="color" name="color" value="${t.color || '#f4c46b'}"></div>`;
  }
  if (t.type === 'sensor') {
    h += `<div class="field"><label>Waarde</label>${capSelect('capability', t.deviceId, t.capability)}</div>
      <div class="field"><label>Tweede waarde (klein, rechtsboven)</label>${capSelect('secondary', t.deviceId, t.secondary, true)}</div>
      <div class="field"><span class="flabel">Bij tikken</span>${seg('tapAction', [['details', 'Details'], ['none', 'Niets']], t.tapAction || 'details')}</div>`;
    if (!capIsBool) {
      h += `<div class="field"><span class="flabel">Weergave</span>${seg('display', [['number', 'Getal'], ['gauge', 'Meter (boog)']], t.display || 'number')}</div>`;
      if (t.display === 'gauge') {
        const ci = capInfo(t.deviceId, t.capability);
        h += `<div class="row2"><div class="field"><label>Meter van</label><input type="number" name="min" value="${t.min ?? ''}" placeholder="${ci.min ?? 0}"></div>
          <div class="field"><label>Meter tot</label><input type="number" name="max" value="${t.max ?? ''}" placeholder="${ci.max ?? 100}"></div></div>`;
      } else {
        h += `<label class="check"><input type="checkbox" name="graph" ${wantsGraph(t) || t.graph === true ? 'checked' : ''}> Grafiek van de afgelopen 24 uur tonen</label>`;
      }
    }
    if (capIsBool) {
      h += `<div class="row2"><div class="field"><label>Tekst bij waar</label><input type="text" name="trueText" value="${esc(t.trueText || '')}" placeholder="Standaard"></div>
        <div class="field"><label>Tekst bij onwaar</label><input type="text" name="falseText" value="${esc(t.falseText || '')}" placeholder="Standaard"></div></div>`;
    } else {
      h += `<div class="row2"><div class="field"><label>Decimalen</label><input type="number" name="decimals" min="0" max="4" value="${t.decimals ?? ''}" placeholder="Auto"></div>
        <div class="field"><label>Eenheid</label><input type="text" name="unit" value="${esc(t.unit || '')}" placeholder="${esc(capInfo(t.deviceId, t.capability).units || '')}"></div></div>`;
    }
    h += `<div class="field"><span class="flabel">Kleuren bij drempels</span><div id="thr">${(t.thresholds || []).map((x, i) => thrRow(x, i)).join('')}</div>
      <button type="button" class="btn" id="addThr">${icon('plus')} Drempel toevoegen</button>
      <span class="hint">De laatste drempel die klopt bepaalt de kleur. Voor aan/uit-waarden gebruik je "=" met aan of uit.</span></div>`;
  }
  if (t.type === 'thermostat') {
    h += `<div class="field"><label>Stapgrootte</label><input type="number" name="step" step="0.1" min="0.1" value="${t.step || 0.5}"></div>`;
  }
  if (t.type === 'flow') {
    h += `<div class="field"><label>Flow</label><select name="flowId">${(S.catalog?.flows || []).map(f =>
      `<option value="${esc(f.id)}" data-kind="${f.kind}" ${f.id === t.flowId ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div>`;
  }
  if (t.type === 'mood') {
    h += `<div class="field"><label>Mood</label><select name="moodId">${(S.catalog?.moods || []).map(m =>
      `<option value="${esc(m.id)}" ${m.id === t.moodId ? 'selected' : ''}>${esc(m.name)} (${esc(m.zoneName)})</option>`).join('')}</select></div>`;
  }
  if (t.type === 'flow' || t.type === 'mood' || t.type === 'button') {
    h += `<label class="check"><input type="checkbox" name="confirm" ${t.confirm ? 'checked' : ''}> Eerst om bevestiging vragen</label>`;
  }
  if (t.type === 'clock') {
    h += `<label class="check"><input type="checkbox" name="showDate" ${t.showDate !== false ? 'checked' : ''}> Datum tonen</label>`;
  }
  if (t.type === 'camera') {
    h += `<div class="field"><span class="flabel">Beeld verversen elke</span>${seg('refresh', [[5, '5 s'], [10, '10 s'], [30, '30 s'], [60, '1 min']], t.refresh || 10)}</div>`;
  }
  if (t.type === 'chart') {
    h += `<div class="field"><span class="flabel">Periode</span>${seg('hours', [[6, '6 uur'], [12, '12 uur'], [24, '24 uur'], [48, '48 uur'], [168, '7 dagen'], [720, '30 dagen']], t.hours || 24)}</div>
      <div class="field"><span class="flabel">Stijl</span>${seg('style', [['area', 'Vlak'], ['line', 'Lijn']], t.style || 'area')}</div>
      <div class="field"><span class="flabel">Lijnen</span>${(t.series || []).map((x, i) => `<div class="series-row" data-si="${i}">
        <div class="row2">${deviceSelect(`s_deviceId`, x.deviceId, d => Object.values(d.capabilities).some(c => c.type === 'number'))}
        ${x.deviceId ? capSelect('s_capability', x.deviceId, x.capability) : '<span></span>'}</div>
        <div class="series-meta"><input type="text" name="s_label" value="${esc(x.label || '')}" placeholder="Naam in de legenda">
        <input type="color" name="s_color" value="${x.color || SERIES_COLORS[i % 4]}">
        <button type="button" class="btn icon-only ghost" data-sdel="${i}">${icon('trash-2')}</button></div></div>`).join('')}
        ${(t.series || []).length < 4 ? `<button type="button" class="btn" id="addSeries">${icon('plus')} Lijn toevoegen</button>` : ''}</div>
      <div class="field"><label>Eenheid op de as</label><input type="text" name="unit" value="${esc(t.unit || '')}" placeholder="Automatisch"></div>`;
  }
  if (t.type === 'rooms') {
    const zones = roomsData({}).map(z => `<label class="check"><input type="checkbox" name="hz_${esc(z.id)}" ${(t.hideZones || []).includes(z.id) ? '' : 'checked'}> ${esc(z.name)}</label>`).join('');
    h += `<div class="field"><span class="flabel">Welke ruimtes tonen</span>${zones || '<span class="hint">Geen ruimtes gevonden</span>'}</div>`;
  }
  if (!['header', 'clock', 'chart', 'rooms'].includes(t.type)) {
    h += `<div class="field"><span class="flabel">Kleur van het icoon</span>
      <label class="check"><input type="checkbox" name="useIconColor" ${t.iconColor ? 'checked' : ''}> Eigen kleur in plaats van automatisch</label>
      <input type="color" name="iconColor" value="${t.iconColor || tileColor(t)}"></div>`;
  }
  if (isDev) {
    h += `<label class="check"><input type="checkbox" name="chip" ${t.chip ? 'checked' : ''}> Ook tonen in de statusbalk en het zijpaneel</label>`;
  }
  if (type.settings) h += type.settings(t);
  const v = t.visible || {};
  h += `<div class="field"><span class="flabel">Alleen tonen als</span>
    ${deviceSelect('vis_deviceId', v.deviceId)}
    ${v.deviceId ? `<div class="row3">${capSelect('vis_capability', v.deviceId, v.capability)}
      <select name="vis_op">${['=', '!=', '>', '<'].map(o => `<option ${o === (v.op || '=') ? 'selected' : ''}>${o}</option>`).join('')}</select>
      <input type="text" name="vis_value" value="${esc(v.value ?? '')}" placeholder="aan, 20, ..."></div>` : ''}
    <span class="hint">Laat leeg om de tegel altijd te tonen. Verborgen tegels zie je in bewerkmodus doorschijnend.</span></div>`;

  openPanel('Tegel instellen', h, `<button class="btn danger" id="tDel">${icon('trash-2')} Verwijderen</button>
    <span class="spacer"></span><button class="btn" id="tDup">${icon('copy')} Dupliceren</button>
    <button class="btn primary" id="tOk">Klaar</button>`);

  pushUndo();
  const body = $('#panelBody');
  const rerenderTile = () => {
    const el = grid.querySelector(`[data-id="${t.id}"]`);
    if (el) fillTile(el, t);
    save();
  };
  const set = (k, val) => { t[k] = val; rerenderTile(); };

  body.querySelector('#tileIconPicker')?.appendChild(iconPicker(t.icon, n => set('icon', n)));
  body.querySelectorAll('[data-seg]').forEach(sg => sg.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    sg.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
    const key = sg.dataset.seg, raw = b.dataset.v;
    const val = raw === 'full' || isNaN(raw) ? raw : +raw;
    set(key, val);
    if (key === 'display') { openTileSettings(t); refreshHistory(true); }
    if (key === 'type') {
      if (val === 'sensor' && !t.capability) t.capability = Object.keys(device(t.deviceId)?.capabilities || {})[0];
      openTileSettings(t);
    }
  });
  body.oninput = e => {
    const n = e.target.name; if (!n) return;
    if (type.onInput && type.onInput(t, e, n, rerenderTile)) return;
    if (n === 'useIconColor' || n === 'iconColor') {
      set('iconColor', body.querySelector('[name=useIconColor]').checked ? body.querySelector('[name=iconColor]').value : null);
    } else if (n.startsWith('s_')) {
      const i = +e.target.closest('[data-si]').dataset.si;
      const ser = t.series[i], key = n.slice(2);
      ser[key] = e.target.value;
      if (key === 'deviceId') {
        const caps = device(e.target.value)?.capabilities || {};
        ser.capability = ['measure_power', 'measure_temperature'].find(c => caps[c]) || Object.keys(caps).find(c => caps[c].type === 'number');
        if (!ser.label) ser.label = device(e.target.value)?.name || '';
        rerenderTile(); openTileSettings(t); refreshHistory(true);
      } else { rerenderTile(); if (key === 'capability') refreshHistory(true); }
    } else if (n.startsWith('hz_')) {
      const id = n.slice(3), hide = new Set(t.hideZones || []);
      e.target.checked ? hide.delete(id) : hide.add(id);
      t.hideZones = [...hide]; rerenderTile();
    } else if (n === 'useColor' || n === 'color') {
      set('color', body.querySelector('[name=useColor]').checked ? body.querySelector('[name=color]').value : null);
    } else if (n.startsWith('vis_')) {
      const vis = t.visible || {};
      vis[n.slice(4)] = e.target.value;
      if (n === 'vis_deviceId') vis.capability = Object.keys(device(e.target.value)?.capabilities || {})[0];
      t.visible = vis.deviceId ? vis : null;
      rerenderTile();
      if (n === 'vis_deviceId') openTileSettings(t);
    } else if (n.startsWith('thr_')) {
      t.thresholds = [...body.querySelectorAll('.thr-row')].map(r => ({
        op: r.querySelector('[name=thr_op]').value, value: r.querySelector('[name=thr_value]').value, color: r.querySelector('[name=thr_color]').value,
      }));
      rerenderTile();
    } else if (e.target.type === 'checkbox') {
      set(n, e.target.checked);
      if (n === 'graph' || n === 'chip') { refreshHistory(true); scheduleStatus(); }
    } else if (n === 'flowId') {
      t.flowKind = e.target.selectedOptions[0].dataset.kind; set('flowId', e.target.value);
    } else {
      set(n, e.target.value);
      if (n === 'deviceId' || n === 'capability') {
        if (n === 'deviceId' && e.target.value) { const sug = suggestTile(device(e.target.value)); t.capability = sug.capability || t.capability; }
        openTileSettings(t);
      }
    }
  };
  type.bind?.(t, body, rerenderTile);
  body.querySelector('#addSeries')?.addEventListener('click', () => {
    t.series = [...(t.series || []), { deviceId: '', capability: '', label: '', color: SERIES_COLORS[(t.series || []).length % 4] }];
    openTileSettings(t);
  });
  body.querySelectorAll('[data-sdel]').forEach(b => b.onclick = () => {
    t.series.splice(+b.dataset.sdel, 1); rerenderTile(); openTileSettings(t);
  });
  body.querySelector('#addThr')?.addEventListener('click', () => {
    t.thresholds = [...(t.thresholds || []), { op: '>', value: '', color: '#e0745a' }];
    openTileSettings(t);
  });
  body.querySelectorAll('[data-thr-del]').forEach(b => b.onclick = () => {
    t.thresholds.splice(+b.dataset.thrDel, 1); rerenderTile(); openTileSettings(t);
  });

  $('#tOk').onclick = () => { closePanel(); renderGrid(); };
  $('#tDel').onclick = () => {
    page().tiles = page().tiles.filter(x => x.id !== t.id);
    save(); closePanel(); renderGrid(); toast('Tegel verwijderd');
  };
  $('#tDup').onclick = () => {
    const copy = { ...JSON.parse(JSON.stringify(t)), id: uid('t') };
    const tiles = page().tiles;
    tiles.splice(tiles.indexOf(t) + 1, 0, copy);
    save(); renderGrid(); openTileSettings(copy);
  };
}

function thrRow(x, i) {
  return `<div class="thr-row"><select name="thr_op">${['>', '<', '=', '!='].map(o => `<option ${o === x.op ? 'selected' : ''}>${o}</option>`).join('')}</select>
    <input type="text" name="thr_value" value="${esc(x.value)}" placeholder="Waarde">
    <input type="color" name="thr_color" value="${x.color || '#e0745a'}">
    <button type="button" class="btn icon-only ghost" data-thr-del="${i}">${icon('x')}</button></div>`;
}

// --- Algemene instellingen ---
function openGlobalSettings() {
  const s = settings(), nd = s.nightDim || {};
  let iconOpen = -1;   // van welke pagina de iconenkeuze open staat
  const pagesHtml = () => S.layout.pages.map((p, i) => `<div class="page-card" data-pi="${i}">
      <div class="page-row">
        <button type="button" class="page-icon-btn ${iconOpen === i ? 'open' : ''}" data-pm="icon" title="Icoon kiezen">${icon(p.icon || 'house')}</button>
        <input type="text" name="p_name" value="${esc(p.name)}" placeholder="Naam van de pagina" aria-label="Naam van pagina ${i + 1}">
        <button type="button" class="btn icon-only ghost" data-pm="up" title="Naar voren" ${i === 0 ? 'disabled' : ''}>${icon('chevron-up')}</button>
        <button type="button" class="btn icon-only ghost" data-pm="del" title="Pagina verwijderen">${icon('trash-2')}</button>
      </div>
      <div class="page-time"><span class="hint">Startpagina van</span><input type="time" name="p_from" value="${esc(p.from || '')}" aria-label="Startpagina vanaf">
        <span class="hint">tot</span><input type="time" name="p_to" value="${esc(p.to || '')}" aria-label="Startpagina tot"></div>
      ${iconOpen === i ? '<div class="page-icons"></div>' : ''}
    </div>`).join('');

  openPanel('Instellingen', `
    <div class="field"><label>Titel van het dashboard</label><input type="text" name="title" value="${esc(s.title || '')}">
      <label class="check"><input type="checkbox" name="showTitle" ${s.showTitle === true ? 'checked' : ''}> Linksboven tonen</label>
      <span class="hint">Pagina's hernoem je verderop onder Pagina's.</span></div>
    <div class="field"><span class="flabel">Thema</span>${seg('theme', [['glass', 'Glas'], ['auto', 'Volgt apparaat'], ['dark', 'Donker'], ['light', 'Licht']], s.theme || 'auto')}</div>
    <div class="field"><span class="flabel">Achtergrond (bij Glas)</span>${seg('background', [['day', 'Dagverloop'], ['aurora', 'Aurora'], ['ocean', 'Oceaan'], ['sunset', 'Zonsondergang'], ['forest', 'Bos'], ['midnight', 'Middernacht']], s.background || 'ocean')}
      <input type="text" name="bgImage" value="${esc(s.bgImage || '')}" placeholder="Of een eigen afbeelding: https://...">
      <label class="check"><input type="checkbox" name="lowEffects" ${s.lowEffects ? 'checked' : ''}> Minder vervaging (sneller op eenvoudige tablets)</label></div>
    <div class="field"><label>Tegelgrootte: <span id="csOut">${s.cellSize}</span> px</label>
      <input type="range" name="cellSize" min="90" max="240" step="5" value="${s.cellSize}" style="height:32px">
      <span class="hint">Het aantal kolommen past zich automatisch aan de schermbreedte aan. Grotere tegels betekent minder kolommen.</span></div>
    <div class="field"><label>Ruimte tussen tegels: <span id="gapOut">${s.gap ?? 12}</span> px</label>
      <input type="range" name="gap" min="4" max="28" step="1" value="${s.gap ?? 12}" style="height:32px"></div>
    <label class="check"><input type="checkbox" name="showClock" ${s.showClock !== false ? 'checked' : ''}> Klok in de bovenbalk</label>
    <label class="check"><input type="checkbox" name="sidePanel" ${s.sidePanel !== false ? 'checked' : ''}> Zijpaneel op brede schermen</label>
    <label class="check"><input type="checkbox" name="statusBar" ${s.statusBar !== false ? 'checked' : ''}> Statusbalk op smalle schermen</label>
    <div class="field"><label>Plaats voor het weer</label><input type="text" name="weatherPlace" value="${esc(s.weatherPlace || '')}" placeholder="Bijvoorbeeld Utrecht (leeg = geen weer)"></div>
    <div class="field"><label>Terug naar eerste pagina na (seconden, 0 = nooit)</label>
      <input type="number" name="returnHomeAfter" min="0" value="${s.returnHomeAfter ?? 60}"></div>
    <div class="field"><span class="flabel">Scherm 's nachts dimmen</span>
      <label class="check"><input type="checkbox" name="nd_enabled" ${nd.enabled ? 'checked' : ''}> Aan</label>
      <div class="row3"><input type="time" name="nd_from" value="${nd.from || '23:00'}"><input type="time" name="nd_to" value="${nd.to || '06:30'}">
      <input type="number" name="nd_opacity" min="0" max="0.95" step="0.05" value="${nd.opacity ?? 0.35}" title="Hoeveel donkerder (0 tot 0,95)"></div>
      <span class="hint">Van, tot, en hoeveel donkerder. Aanraken maakt het scherm een minuut helder.</span></div>
    ${EXTRA.globalSettingsHtml ? EXTRA.globalSettingsHtml(s) : ''}
    <div class="field"><span class="flabel">Pagina's</span><div id="pageList">${pagesHtml()}</div>
      <span class="hint">Met "Startpagina van ... tot" wordt een pagina in die uren de startpagina, bijvoorbeeld 's avonds een pagina met lampen en tv. Zonder tijden is de eerste pagina de startpagina.</span>
      <button type="button" class="btn" id="gAddPage">${icon('plus')} Pagina toevoegen</button></div>
    <div class="field"><span class="flabel">Back-up</span>
      <div class="ctl-row"><button type="button" class="btn" id="gExport">Exporteren</button>
      <label class="btn">Importeren<input type="file" accept=".json" id="gImport" hidden></label></div></div>`,
  `<span class="spacer"></span><button class="btn primary" id="gOk">Klaar</button>`);

  pushUndo();
  const body = $('#panelBody');
  const changed = () => { applySettings(); renderAll(); save(); };
  EXTRA.bindGlobal?.(body, s);
  body.querySelectorAll('[data-seg]').forEach(sg => sg.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    sg.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
    s[sg.dataset.seg] = b.dataset.v; changed();
  });
  body.oninput = e => {
    const n = e.target.name; if (!n) return;
    if (EXTRA.onGlobalInput?.(e, n, s)) { save(); return; }
    const val = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'range' || e.target.type === 'number') ? +e.target.value : e.target.value;
    if (n.startsWith('nd_')) { s.nightDim = { ...(s.nightDim || {}), [n.slice(3)]: val }; nightDim(true); save(); return; }
    if (n.startsWith('p_')) {
      const p = S.layout.pages[+e.target.closest('[data-pi]').dataset.pi];
      p[n.slice(2)] = val; renderPages(); save(); return;
    }
    s[n] = val;
    if (n === 'weatherPlace') { clearTimeout(openGlobalSettings.wt); openGlobalSettings.wt = setTimeout(() => loadWeather(true), 1500); }
    if (n === 'cellSize') $('#csOut').textContent = val;
    if (n === 'gap') $('#gapOut').textContent = val;
    changed();
  };
  function renderPageList() {
    body.querySelector('#pageList').innerHTML = pagesHtml();
    const mount = body.querySelector('.page-icons');
    if (mount) mount.appendChild(iconPicker(S.layout.pages[iconOpen].icon, n => {
      S.layout.pages[iconOpen].icon = n;
      iconOpen = -1;
      renderPageList(); renderPages(); save();
    }));
  }
  body.querySelector('#pageList').onclick = e => {
    const b = e.target.closest('[data-pm]'); if (!b) return;
    const i = +b.closest('[data-pi]').dataset.pi, P = S.layout.pages;
    if (b.dataset.pm === 'icon') {
      iconOpen = iconOpen === i ? -1 : i;
      renderPageList();
      return;
    }
    iconOpen = -1;
    if (b.dataset.pm === 'up' && i > 0) [P[i - 1], P[i]] = [P[i], P[i - 1]];
    if (b.dataset.pm === 'del') {
      if (P.length === 1) return toast('Er moet minstens één pagina blijven');
      if (P[i].tiles.length && !confirm(`"${P[i].name}" en de ${P[i].tiles.length} tegels erop verwijderen?`)) return;
      P.splice(i, 1);
    }
    S.pageIdx = Math.min(S.pageIdx, P.length - 1);
    renderPageList();
    renderAll(); save();
  };
  body.querySelector('#gAddPage').onclick = () => { addPage(); renderPageList(); };
  body.querySelector('#gExport').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S.layout, null, 2)], { type: 'application/json' }));
    a.download = `dashboard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  body.querySelector('#gImport').onchange = async e => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(data.pages)) throw new Error('Dit is geen dashboard-bestand');
      pushUndo();
      data.version = S.layout.version;
      S.layout = data; S.pageIdx = 0;
      closePanel(); applySettings(); renderAll(); save(); toast('Indeling geïmporteerd');
    } catch (err) { toast(err.message); }
  };
  $('#gOk').onclick = closePanel;
}

// ---------------------------------------------------------------------------
// Tablet-gemakken: terug naar startpagina, nachtdimmen, scherm aan houden
// ---------------------------------------------------------------------------
let lastTouch = Date.now();
document.addEventListener('pointerdown', () => { lastTouch = Date.now(); nightDim(); }, true);
setInterval(() => {
  if (!S.layout || S.editing) return;
  const secs = settings().returnHomeAfter;
  if (!secs) return;
  if (Date.now() - lastTouch > secs * 1000) {
    if (!$('#popupWrap').hidden) closePopup();
    const home = homePageIdx();
    if (S.pageIdx !== home) goPage(home);
  }
}, 2000);

// Startpagina volgens het tijdstip: de eerste pagina waarvan de tijden nu gelden, anders de eerste pagina
const toMinutes = s => { const [h, mm] = String(s || '').split(':').map(Number); return isFinite(h) ? h * 60 + (mm || 0) : null; };
function inTimeWindow(from, to, now = new Date()) {
  const f = toMinutes(from), t = toMinutes(to);
  if (f === null || t === null || f === t) return false;
  const m = now.getHours() * 60 + now.getMinutes();
  return f < t ? m >= f && m < t : m >= f || m < t;
}
function homePageIdx() {
  const i = S.layout.pages.findIndex(p => inTimeWindow(p.from, p.to));
  return i < 0 ? 0 : i;
}

function nightDim() {
  const nd = S.layout?.settings?.nightDim;
  const el = $('#nightDim');
  if (!nd?.enabled || S.editing) { el.style.opacity = 0; return; }
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
  const toMin = s => { const [h, mm] = (s || '0:0').split(':').map(Number); return h * 60 + mm; };
  const f = toMin(nd.from), t = toMin(nd.to);
  const inNight = f < t ? (m >= f && m < t) : (m >= f || m < t);
  const awake = Date.now() - lastTouch < 60000;
  el.style.opacity = inNight && !awake ? nd.opacity ?? 0.35 : 0;
}

async function keepAwake() {
  try { await navigator.wakeLock?.request('screen'); } catch { /* niet ondersteund of geen https */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

new ResizeObserver(() => relayout()).observe($('#viewport'));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
(async function start() {
  try { S.status = await api('GET', '/api/status'); } catch { S.status = {}; }
  S.layout = await api('GET', '/api/layout');
  S.pageIdx = homePageIdx();
  applySettings();
  await loadCatalog();
  renderAll();
  EXTRA.onReady?.();
  connectWS();
  keepAwake();
  loadWeather(true);
  setInterval(() => loadWeather(), 15 * 60 * 1000);
  window.addEventListener('resize', () => { renderSide(); renderChips(); });
  if (S.status.mock) toast('Demo-modus: er is nog geen Homey gekoppeld');
})();
