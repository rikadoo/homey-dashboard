'use strict';
/* Uitbreidingen: energiestroom, apparaatkaarten, groepen, tijdlijn, onderhoud, afstandsbediening,
   kosten, deurbel-pop-up, schermbeveiliging, offline-melding en installeerbare app. */

S.appl = {};
S.events = [];

// ---------------------------------------------------------------------------
// Algemene hulpjes
// ---------------------------------------------------------------------------
const numv = v => typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
const fmtNum = (v, dec = 0) => isFinite(v) ? v.toLocaleString(LOCALE, { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '–';
const fmtW = w => !isFinite(w) ? '–' : Math.abs(w) >= 1000 ? `${fmtNum(w / 1000, 1)} kW` : `${fmtNum(w)} W`;
const euro = v => isFinite(v) ? `€ ${v.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '–';
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'zojuist';
  if (m < 60) return `${m} min geleden`;
  const d = new Date(ts), today = new Date().toDateString() === d.toDateString();
  return today ? hhmm(d) : `${d.toLocaleDateString(LOCALE, { weekday: 'short' })} ${hhmm(d)}`;
}
const capOpts = (devId, value, filter, allowEmpty = true) => {
  const caps = device(devId)?.capabilities || {};
  return `${allowEmpty ? '<option value="">Geen</option>' : ''}${Object.entries(caps).filter(([id, c]) => !filter || filter(id, c))
    .map(([id, c]) => `<option value="${id}" ${id === value ? 'selected' : ''}>${esc(c.title || id)}${c.units ? ` (${esc(c.units)})` : ''}</option>`).join('')}`;
};
// SVG-icoon via masker, zodat het binnen een SVG gekleurd kan worden
let maskSeq = 0;
function svgIcon(name, x, y, size, color) {
  const id = `m${++maskSeq}`;
  return `<mask id="${id}"><image href="/vendor/icons/${name}.svg" x="${x}" y="${y}" width="${size}" height="${size}" style="filter:invert(1)"/></mask>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}" mask="url(#${id})"/>`;
}

// ---------------------------------------------------------------------------
// 1. Energiestroom
// ---------------------------------------------------------------------------
function flowValues(t) {
  const f = t.flow || {};
  const g = f.gridDev ? numv(stateOf(f.gridDev)[f.gridCap || 'measure_power']) : NaN;
  const sol = f.solarDev ? Math.max(0, numv(stateOf(f.solarDev)[f.solarCap || 'measure_power'])) : 0;
  let b = f.batDev ? numv(stateOf(f.batDev)[f.batCap || 'measure_power']) : 0;
  if (f.batInvert) b = -b;                               // + = laden, - = ontladen
  const soc = f.batDev && f.socCap ? numv(stateOf(f.batDev)[f.socCap]) : NaN;
  const home = Math.max(0, (isFinite(g) ? g : 0) + (sol || 0) - (isFinite(b) ? b : 0));
  return { g, sol, b: isFinite(b) ? b : 0, soc, home, hasBat: !!f.batDev, hasSol: !!f.solarDev };
}

TYPES.energyflow = {
  name: 'Energiestroom', icon: 'workflow',
  addable: { desc: 'Geanimeerd schema: zon, net, accu en huis', make: () => ({ w: 3, h: 3, flow: {} }) },
  watches: (t, d) => Object.values(t.flow || {}).includes(d),
  render(t) {
    const v = flowValues(t);
    const C = { sun: '#fbbf24', imp: '#f87171', exp: '#34d399', bat: '#34d399', home: '#60a5fa' };
    const dur = p => `${Math.max(0.35, 2.6 - Math.log10(1 + Math.abs(p)) * 0.6).toFixed(2)}s`;
    const line = (x1, y1, x2, y2, p, col, reverse) => {
      const active = Math.abs(p) >= 10;
      return `<path d="M${x1},${y1} L${x2},${y2}" class="fl-base"/>
        ${active ? `<path d="M${x1},${y1} L${x2},${y2}" class="fl-flow${reverse ? ' rev' : ''}" style="stroke:${col};animation-duration:${dur(p)};filter:drop-shadow(0 0 4px ${col})"/>` : ''}`;
    };
    const node = (x, y, ic, col, val, label, sub) => `
      <circle cx="${x}" cy="${y}" r="25" fill="${col}" fill-opacity=".18" stroke="${col}" stroke-width="2.5" style="filter:drop-shadow(0 0 8px ${col}66)"/>
      ${svgIcon(ic, x - 11, y - 11, 22, col)}
      <text x="${x}" y="${y + 41}" class="fl-val">${val}</text>
      <text x="${x}" y="${y + 55}" class="fl-lbl">${label}${sub ? ` · ${sub}` : ''}</text>`;
    const gImp = v.g > 0;
    const svg = `<svg class="flow-svg" viewBox="0 0 300 236" preserveAspectRatio="xMidYMid meet">
      ${v.hasSol ? line(150, 50, 150, 98, v.sol, C.sun, false) : ''}
      ${isFinite(v.g) ? line(52, 128, 123, 128, v.g, gImp ? C.imp : C.exp, !gImp) : ''}
      ${v.hasBat ? line(248, 128, 177, 128, v.b, C.bat, v.b > 0) : ''}
      ${v.hasSol ? node(150, 26, 'sun', C.sun, fmtW(v.sol), 'Zon') : ''}
      ${isFinite(v.g) ? node(28, 128, 'zap', gImp ? C.imp : C.exp, fmtW(Math.abs(v.g)), gImp ? 'Afname' : 'Teruglevering') : ''}
      ${v.hasBat ? node(272, 128, 'battery-charging', C.bat, fmtW(Math.abs(v.b)), v.b > 10 ? 'Laden' : v.b < -10 ? 'Ontladen' : 'Accu', isFinite(v.soc) ? `${Math.round(v.soc)}%` : '') : ''}
      <circle cx="150" cy="128" r="30" fill="${C.home}" fill-opacity=".22" stroke="${C.home}" stroke-width="3" style="filter:drop-shadow(0 0 12px ${C.home}88)"/>
      ${svgIcon('house', 137, 115, 26, '#fff')}
      <text x="150" y="182" class="fl-val fl-home">${fmtW(v.home)}</text>
      <text x="150" y="197" class="fl-lbl">Verbruik huis</text>
    </svg>`;
    return { cls: 'flow-tile', html: `<div class="label">${esc(t.label)}</div>${svg}` };
  },
  settings(t) {
    const f = t.flow || {};
    const numDev = d => Object.values(d.capabilities).some(c => c.type === 'number');
    const block = (title, devKey, capKey, def, extra = '') => `<div class="field"><span class="flabel">${title}</span>
      ${deviceSelect(`fl_${devKey}`, f[devKey], numDev)}
      ${f[devKey] ? `<select name="fl_${capKey}">${capOpts(f[devKey], f[capKey] || def, (id, c) => c.type === 'number', false)}</select>` : ''}${extra}</div>`;
    return block('Net (positief = afname)', 'gridDev', 'gridCap', 'measure_power')
      + block('Zonnepanelen', 'solarDev', 'solarCap', 'measure_power')
      + block('Thuisaccu: vermogen', 'batDev', 'batCap', 'measure_power',
        f.batDev ? `<label class="flabel" style="margin-top:6px">Laadniveau</label><select name="fl_socCap">${capOpts(f.batDev, f.socCap || 'measure_battery', (id, c) => c.type === 'number')}</select>
          <label class="check"><input type="checkbox" name="fl_batInvert" ${f.batInvert ? 'checked' : ''}> Accu geeft negatief bij laden (omdraaien)</label>` : '');
  },
  onInput(t, e, n, rerender) {
    if (!n.startsWith('fl_')) return false;
    const k = n.slice(3);
    t.flow = { ...(t.flow || {}), [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value };
    if (k.endsWith('Dev')) { rerender(); openTileSettings(t); } else rerender();
    return true;
  },
};

// ---------------------------------------------------------------------------
// 2. Apparaatkaarten (wasmachine, droger, vaatwasser, printer)
// ---------------------------------------------------------------------------
function ringSVG(frac, color, spin) {
  const r = 40, c = 2 * Math.PI * r;
  return `<svg class="ring${spin ? ' spin' : ''}" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="${r}" fill="none" style="stroke:rgba(255,255,255,.14)" stroke-width="8"/>
    <circle cx="50" cy="50" r="${r}" fill="none" style="stroke:${color};filter:drop-shadow(0 0 5px ${color})" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${spin ? c * 0.28 : c * clamp(frac, 0, 1)} ${c}" transform="rotate(-90 50 50)"/></svg>`;
}

TYPES.appliance = {
  name: 'Apparaat', icon: 'washing-machine', device: true,
  render(t) {
    const a = S.appl[t.id] || { state: 'idle' };
    const st = stateOf(t.deviceId);
    const prog = t.progressCap ? numv(st[t.progressCap]) : NaN;
    const power = t.powerCap ? numv(st[t.powerCap]) : NaN;
    const rem = t.remainingCap ? st[t.remainingCap] : null;
    const col = a.state === 'done' ? '#34d399' : a.state === 'running' ? (t.iconColor || tileColor(t)) : 'rgba(255,255,255,.25)';
    const showProg = a.state === 'running' && isFinite(prog) && prog > 0;
    const stateTxt = a.state === 'done' ? 'Klaar!' : a.state === 'running' ? (showProg ? `${Math.round(prog)}%` : 'Bezig') : 'Uit';
    const details = [
      a.state === 'running' && rem && rem !== '0 min' && rem !== '0:00' ? `nog ${esc(rem)}` : '',
      a.state === 'running' && isFinite(power) ? fmtW(power) : '',
      a.state === 'done' ? `${ago(a.since)}${a.duration ? `, duurde ${Math.round(a.duration / 60000)} min` : ''}` : '',
    ].filter(Boolean).join(' · ');
    return {
      cls: `appliance-tile ${a.state}`, style: { '--act': col },
      html: `<div class="appl-ring">${ringSVG(showProg ? prog / 100 : a.state === 'done' ? 1 : 0, col, a.state === 'running' && !showProg)}
          <span class="t-icon${a.state !== 'idle' ? ' lit' : ''}">${icon(a.state === 'done' ? 'circle-check' : (t.icon || 'washing-machine'))}</span></div>
        <div class="appl-txt"><div class="label">${esc(t.label)}</div><div class="appl-state">${stateTxt}</div>
        ${details ? `<div class="sub">${details}</div>` : ''}</div>`,
    };
  },
  tap(t) {
    if ((S.appl[t.id] || {}).state === 'done') {
      api('POST', `/api/appliance/${encodeURIComponent(t.id)}/ack`).catch(() => {});
      toast(`${t.label} gemarkeerd als uitgeruimd`);
    } else openPopup(t, detailsPopup);
  },
  settings(t) {
    if (!t.deviceId) return '';
    return `<div class="field"><label>Vermogen (om te zien of hij draait)</label><select name="ap_powerCap">${capOpts(t.deviceId, t.powerCap, (id, c) => c.type === 'number')}</select></div>
      <div class="field"><label>Voortgang in procent (optioneel)</label><select name="ap_progressCap">${capOpts(t.deviceId, t.progressCap)}</select></div>
      <div class="field"><label>Resterende tijd (optioneel)</label><select name="ap_remainingCap">${capOpts(t.deviceId, t.remainingCap)}</select></div>
      <div class="row2"><div class="field"><label>Draait boven (W)</label><input type="number" name="ap_threshold" value="${t.threshold ?? 5}"></div>
      <div class="field"><label>Klaar na (minuten stil)</label><input type="number" name="ap_doneAfter" value="${t.doneAfter ?? 3}" step="0.5"></div></div>
      <span class="hint">Als hij klaar is, wordt de tegel groen en komt er een melding in de tijdlijn. Tik op de tegel om hem weer op "Uit" te zetten.</span>`;
  },
  onInput(t, e, n, rerender) {
    if (!n.startsWith('ap_')) return false;
    t[n.slice(3)] = e.target.value; rerender(); return true;
  },
};

// ---------------------------------------------------------------------------
// 3. Groepen (bijvoorbeeld alle traplampjes in één tegel)
// ---------------------------------------------------------------------------
const groupDevs = t => (t.devices || []).filter(id => device(id));
TYPES.group = {
  name: 'Groep', icon: 'layers',
  addable: { desc: 'Meerdere lampen of stekkers in één tegel', make: () => ({ icon: 'lightbulb', w: 2, h: 1, devices: [] }) },
  watches: (t, d) => (t.devices || []).includes(d),
  render(t) {
    const ids = groupDevs(t);
    const on = ids.filter(id => stateOf(id).onoff === true).length;
    const col = t.color || CAT.light;
    const dots = ids.slice(0, 24).map(id => `<i class="${stateOf(id).onoff ? 'on' : ''}"></i>`).join('');
    return {
      on: on > 0, style: on ? { '--tile-glow': col } : {},
      html: `<div class="top"><span class="t-icon">${icon(t.icon || 'lightbulb')}</span><div class="dots" style="--c:${col}">${dots}</div></div>
        <div><div class="label">${esc(t.label)}</div><div class="sub">${ids.length ? (on ? `${on} van ${ids.length} aan` : 'Alles uit') : 'Kies apparaten in de instellingen'}</div></div>`,
    };
  },
  tap(t) {
    const ids = groupDevs(t).filter(id => 'onoff' in stateOf(id));
    const anyOn = ids.some(id => stateOf(id).onoff);
    ids.forEach(id => setCap(id, 'onoff', !anyOn));
  },
  hold(t) {
    openPopup(t, () => `<h3>${esc(t.label)}</h3><div class="sub">Tik om los te schakelen</div>
      <div class="group-list">${groupDevs(t).map(id => `<button class="pick" data-gtoggle="${esc(id)}">${icon(stateOf(id).onoff ? 'lightbulb' : 'lightbulb-off')}
        <div class="meta"><div>${esc(device(id).name)}</div><div>${esc(device(id).zoneName)}</div></div><b>${stateOf(id).onoff ? 'Aan' : 'Uit'}</b></button>`).join('')}</div>
      <div class="actions"><button class="btn" data-close>Sluiten</button></div>`,
    root => root.querySelectorAll('[data-gtoggle]').forEach(b => b.onclick = () => {
      const id = b.dataset.gtoggle; setCap(id, 'onoff', !stateOf(id).onoff);
      setTimeout(() => TYPES.group.hold(t), 150);
    }));
  },
  settings(t) {
    const sel = new Set(t.devices || []);
    const byZone = {};
    (S.catalog?.devices || []).filter(d => 'onoff' in (d.capabilities || {})).forEach(d => (byZone[d.zoneName || 'Overig'] ||= []).push(d));
    return `<div class="field"><span class="flabel">Kleur als er iets aan is</span><input type="color" name="gr_color" value="${t.color || CAT.light}"></div>
      <div class="field"><span class="flabel">Apparaten (${sel.size} gekozen)</span>
      ${Object.keys(byZone).sort().map(z => `<div class="zone-title">${esc(z)} <button type="button" class="btn ghost" data-gzone="${esc(z)}" style="min-height:28px;padding:2px 8px">alles</button></div>
        ${byZone[z].map(d => `<label class="check"><input type="checkbox" name="gr_dev" value="${esc(d.id)}" ${sel.has(d.id) ? 'checked' : ''}> ${esc(d.name)}</label>`).join('')}`).join('')}</div>`;
  },
  onInput(t, e, n, rerender) {
    if (n === 'gr_color') { t.color = e.target.value; rerender(); return true; }
    if (n !== 'gr_dev') return false;
    const set = new Set(t.devices || []);
    e.target.checked ? set.add(e.target.value) : set.delete(e.target.value);
    t.devices = [...set]; rerender(); return true;
  },
  bind(t, body, rerender) {
    body.querySelectorAll('[data-gzone]').forEach(b => b.onclick = () => {
      const z = b.dataset.gzone;
      const ids = (S.catalog?.devices || []).filter(d => (d.zoneName || 'Overig') === z && 'onoff' in d.capabilities).map(d => d.id);
      t.devices = [...new Set([...(t.devices || []), ...ids])]; rerender(); openTileSettings(t);
    });
  },
};

// ---------------------------------------------------------------------------
// 4. Tijdlijn van gebeurtenissen
// ---------------------------------------------------------------------------
const EV_COLORS = { contact: '#a78bfa', motion: '#38bdf8', post: '#fbbf24', vibration: '#fbbf24', appliance: '#34d399', doorbell: '#f472b6', water: '#22d3ee', smoke: '#f87171' };
const EV_KINDS = [['contact', 'Deuren'], ['motion', 'Beweging'], ['post', 'Post'], ['appliance', 'Apparaten'], ['doorbell', 'Deurbel'], ['water', 'Waterlek']];
TYPES.timeline = {
  name: 'Tijdlijn', icon: 'history',
  addable: { desc: 'Wat er in huis gebeurde: deuren, post, apparaten, deurbel', make: () => ({ w: 2, h: 3, hideKinds: ['motion'] }) },
  render(t) {
    const hide = new Set(t.hideKinds || []);
    const evs = S.events.filter(e => !hide.has(e.kind === 'vibration' ? 'post' : e.kind)).slice(0, 40);
    const rows = evs.map(e => `<div class="ev${e.alert ? ' alert' : ''}" style="--c:${EV_COLORS[e.kind] || '#94a3b8'}">
      <span class="ev-ic">${icon(e.icon || 'circle')}</span><span class="ev-txt">${esc(e.text)}</span><span class="ev-time">${ago(e.ts)}</span></div>`).join('');
    return { cls: 'list-tile', html: `<div class="label">${esc(t.label)}</div><div class="list">${rows || '<span class="sub">Nog niets gebeurd</span>'}</div>` };
  },
  settings(t) {
    const hide = new Set(t.hideKinds || []);
    return `<div class="field"><span class="flabel">Tonen</span>${EV_KINDS.map(([k, l]) =>
      `<label class="check"><input type="checkbox" name="tl_kind" value="${k}" ${hide.has(k) ? '' : 'checked'}> ${l}</label>`).join('')}</div>`;
  },
  onInput(t, e, n, rerender) {
    if (n !== 'tl_kind') return false;
    const hide = new Set(t.hideKinds || []);
    e.target.checked ? hide.delete(e.target.value) : hide.add(e.target.value);
    t.hideKinds = [...hide]; rerender(); return true;
  },
};

// ---------------------------------------------------------------------------
// 5. Onderhoud: lege batterijen en offline apparaten
// ---------------------------------------------------------------------------
TYPES.maintenance = {
  name: 'Onderhoud', icon: 'wrench',
  addable: { desc: 'Batterijen die bijna leeg zijn en apparaten die offline zijn', make: () => ({ w: 2, h: 3, threshold: 40 }) },
  watches: (t, d) => 'measure_battery' in stateOf(d) || 'alarm_battery' in stateOf(d),
  render(t) {
    const thr = +t.threshold || 40;
    const items = [];
    for (const d of S.catalog?.devices || []) {
      const st = stateOf(d.id);
      if (!d.available) items.push({ d, kind: 'offline', sort: -1 });
      else if (typeof st.measure_battery === 'number' && st.measure_battery <= thr) items.push({ d, kind: 'bat', v: st.measure_battery, sort: st.measure_battery });
      else if (st.alarm_battery === true) items.push({ d, kind: 'bat', v: null, sort: 0 });
    }
    items.sort((a, b) => a.sort - b.sort);
    const rows = items.map(({ d, kind, v }) => {
      if (kind === 'offline') return `<div class="mt"><span class="mt-name">${esc(d.name)}<small>${esc(d.zoneName)}</small></span><span class="pill off">${icon('wifi-off')} offline</span></div>`;
      const col = v === null || v < 20 ? '#f87171' : v < 35 ? '#fb923c' : '#facc15';
      return `<div class="mt"><span class="mt-name">${esc(d.name)}<small>${esc(d.zoneName)}</small></span>
        <span class="batt" style="--c:${col}"><i style="width:${v === null ? 8 : Math.max(4, v)}%"></i></span><b>${v === null ? 'laag' : `${Math.round(v)}%`}</b></div>`;
    }).join('');
    return { cls: 'list-tile', html: `<div class="label">${esc(t.label)}</div><div class="list">${rows || `<span class="sub">${icon('circle-check')} Alles in orde</span>`}</div>` };
  },
  settings: t => `<div class="field"><label>Batterij tonen onder (%)</label><input type="number" name="mt_threshold" value="${t.threshold ?? 40}" min="5" max="100"></div>`,
  onInput(t, e, n, rerender) { if (n !== 'mt_threshold') return false; t.threshold = e.target.value; rerender(); return true; },
};

// ---------------------------------------------------------------------------
// 6. Afstandsbediening (TV, receiver, speakers, Roomba)
// ---------------------------------------------------------------------------
const REMOTE_BTNS = [
  ['speaker_prev', 'skip-back', 'Vorige'], ['speaker_playing', 'play', 'Afspelen/pauze'], ['speaker_next', 'skip-forward', 'Volgende'],
  ['volume_down', 'volume-1', 'Zachter'], ['volume_up', 'volume-2', 'Harder'], ['channel_down', 'chevron-down', 'Zender -'], ['channel_up', 'chevron-up', 'Zender +'],
  ['command_start_clean', 'play', 'Schoonmaken'], ['command_start_quick_clean', 'zap', 'Snel'], ['command_pause', 'pause', 'Pauze'],
  ['command_resume', 'play', 'Verder'], ['command_stop', 'square', 'Stop'], ['command_dock', 'house', 'Naar dock'], ['command_find', 'search', 'Zoeken'],
];
const VAC_STATE = { none_charge: 'Opgeladen', charge: 'Opladen', run: 'Bezig', stop: 'Gestopt', hmUsrDock: 'Terug naar dock', hmPostMsn: 'Terug naar dock', pause: 'Gepauzeerd', stuck: 'Vast!' };
TYPES.remote = {
  name: 'Afstandsbediening', icon: 'tv', device: true,
  render(t) {
    const st = stateOf(t.deviceId);
    const on = st.onoff === true || st.speaker_playing === true || st.vacuum_state === 'run';
    let sub = 'onoff' in st ? (st.onoff ? 'Aan' : 'Uit') : '';
    if (st.speaker_track && st.speaker_track !== 'Idle' && !/Default Media/.test(st.speaker_track)) sub = st.speaker_track;
    if (st.vacuum_state) sub = VAC_STATE[st.vacuum_state] || st.vacuum_state;
    const vol = typeof st.volume_set === 'number' ? `<div class="bar-meter" style="margin-top:8px"><i style="width:${Math.round(st.volume_set * 100)}%"></i></div>` : '';
    return {
      on, style: on ? { '--tile-glow': CAT.media } : {},
      html: `<div class="top"><span class="t-icon">${icon(t.icon || 'tv')}</span>${'measure_battery' in st ? `<span class="sub">${Math.round(st.measure_battery)}%</span>` : ''}</div>
        <div><div class="label">${esc(t.label)}</div><div class="sub">${esc(sub)}</div>${vol}</div>`,
    };
  },
  tap: t => openPopup(t, remotePopup, root => bindRemote(t, root)),
};
function bindRemote(t, root) {
  root.querySelectorAll('[data-rbtn]').forEach(b => b.onclick = () => {
    const c = b.dataset.rbtn, st = stateOf(t.deviceId);
    setCap(t.deviceId, c, c === 'speaker_playing' || c === 'onoff' || c === 'volume_mute' ? !st[c] : true);
    setTimeout(() => { if (S.popupTile === t) openPopup(t, remotePopup, r => bindRemote(t, r)); }, 400);
  });
}
function remotePopup(t) {
  const st = stateOf(t.deviceId), caps = device(t.deviceId)?.capabilities || {};
  const has = c => c in caps && caps[c].setable !== false;
  const btns = REMOTE_BTNS.filter(([c]) => has(c)).map(([c, ic, l]) =>
    `<button class="rbtn" data-rbtn="${c}" title="${l}">${icon(c === 'speaker_playing' && st.speaker_playing ? 'pause' : ic)}<span>${l}</span></button>`).join('');
  return `<h3>${esc(t.label)}</h3><div class="sub">${esc(st.speaker_track && st.speaker_track !== 'Idle' ? st.speaker_track : device(t.deviceId)?.zoneName || '')}</div>
    <div class="actions" style="margin-top:0">
      ${has('onoff') ? `<button class="btn ${st.onoff ? 'primary' : ''}" data-rbtn="onoff">${icon('power')} ${st.onoff ? 'Uitzetten' : 'Aanzetten'}</button>` : ''}
      ${has('volume_mute') ? `<button class="btn ${st.volume_mute ? 'primary' : ''}" data-rbtn="volume_mute">${icon(st.volume_mute ? 'volume-x' : 'volume-2')} Dempen</button>` : ''}
    </div>
    ${has('volume_set') ? slider('volume_set', 'Volume', st.volume_set) : ''}
    ${btns ? `<div class="rgrid">${btns}</div>` : ''}
    <div class="actions"><button class="btn" data-close>Sluiten</button></div>`;
}

// ---------------------------------------------------------------------------
// 7. Kosten vandaag
// ---------------------------------------------------------------------------
TYPES.costs = {
  name: 'Kosten vandaag', icon: 'euro', device: true,
  render(t) {
    const st = stateOf(t.deviceId);
    const imp = numv(st[t.importCap || 'meter_power.imported_today']);
    const exp = numv(st[t.exportCap || 'meter_power.exported_today']);
    const gas = t.gasCap === '' ? NaN : numv(st[t.gasCap || 'meter_gas.today']);
    const pi = numv(t.priceImport), pe = numv(t.priceExport), pg = numv(t.priceGas);
    if (!isFinite(pi)) return { html: `<div class="top"><span class="t-icon">${icon('euro')}</span></div><div><div class="label">${esc(t.label)}</div><div class="sub">Vul je tarieven in bij de instellingen van deze tegel</div></div>` };
    const ci = (imp || 0) * pi, ce = (exp || 0) * (isFinite(pe) ? pe : pi), cg = isFinite(gas) && isFinite(pg) ? gas * pg : 0;
    const net = ci - ce + cg;
    const max = Math.max(ci, ce, cg, 0.01);
    const row = (ic, label, amount, val, col, minus) => `<div class="cost"><span class="cost-ic" style="--c:${col}">${icon(ic)}</span>
      <span class="cost-l">${label}<small>${amount}</small></span><span class="cost-bar"><i style="width:${(val / max) * 100}%;background:${col}"></i></span>
      <b>${minus ? '−' : ''}${euro(val)}</b></div>`;
    return {
      cls: 'costs-tile',
      html: `<div class="cost-head"><div class="label">${esc(t.label)}</div><div class="cost-net ${net < 0 ? 'neg' : ''}">${euro(net)}</div></div>
        <div class="costs">${row('arrow-down-to-line', 'Stroom afgenomen', `${fmtNum(imp, 1)} kWh`, ci, '#f87171')}
        ${row('arrow-up-from-line', 'Teruggeleverd', `${fmtNum(exp, 1)} kWh`, ce, '#34d399', true)}
        ${isFinite(gas) && isFinite(pg) ? row('flame', 'Gas', `${fmtNum(gas, 2)} m³`, cg, '#fb923c') : ''}</div>`,
    };
  },
  settings(t) {
    if (!t.deviceId) return '';
    return `<div class="field"><label>Afgenomen vandaag (kWh)</label><select name="co_importCap">${capOpts(t.deviceId, t.importCap || 'meter_power.imported_today', null, false)}</select></div>
      <div class="field"><label>Teruggeleverd vandaag (kWh)</label><select name="co_exportCap">${capOpts(t.deviceId, t.exportCap || 'meter_power.exported_today', null, false)}</select></div>
      <div class="field"><label>Gas vandaag (m³)</label><select name="co_gasCap">${capOpts(t.deviceId, t.gasCap ?? 'meter_gas.today')}</select></div>
      <div class="row3"><div class="field"><label>€ per kWh</label><input type="text" inputmode="decimal" name="co_priceImport" value="${esc(t.priceImport ?? '')}" placeholder="0,27"></div>
      <div class="field"><label>€ terug</label><input type="text" inputmode="decimal" name="co_priceExport" value="${esc(t.priceExport ?? '')}" placeholder="0,27"></div>
      <div class="field"><label>€ per m³</label><input type="text" inputmode="decimal" name="co_priceGas" value="${esc(t.priceGas ?? '')}" placeholder="1,40"></div></div>
      <span class="hint">Tarieven inclusief belastingen en btw. Bij salderen is "terug" gelijk aan je stroomprijs.</span>`;
  },
  onInput(t, e, n, rerender) { if (!n.startsWith('co_')) return false; t[n.slice(3)] = e.target.value; rerender(); return true; },
};

// ---------------------------------------------------------------------------
// Live gegevens van de server
// ---------------------------------------------------------------------------
function rerenderTypes(types) {
  if (!S.layout) return;
  for (const t of page().tiles) if (types.includes(t.type)) { const el = grid.querySelector(`[data-id="${t.id}"]`); if (el) fillTile(el, t); }
}
EXTRA.msgHandlers.push(m => {
  if (m.type === 'snapshot' && m.appliances) S.appl = m.appliances;
  if (m.type === 'appliances') { S.appl = m.data; rerenderTypes(['appliance']); }
  if (m.type === 'event' && !m.event.test) { S.events.unshift(m.event); S.events.length = Math.min(S.events.length, 300); rerenderTypes(['timeline']); }
  if (m.type === 'event' && ALARM_KINDS[m.event.kind]) showAlarm(m.event);
  if (m.type === 'doorbell') showDoorbell(m.deviceId);
});
api('GET', '/api/events').then(ev => { S.events = ev; rerenderTypes(['timeline']); }).catch(() => {});
setInterval(() => rerenderTypes(['timeline', 'appliance']), 60 * 1000);   // "x min geleden" bijwerken

// ---------------------------------------------------------------------------
// 8. Deurbel: groot camerabeeld over alles heen, met belgeluid
// ---------------------------------------------------------------------------
function chime() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [[659, 0], [523, 0.45]].forEach(([f, at]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, ac.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.4, ac.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + 1.2);
      o.start(ac.currentTime + at); o.stop(ac.currentTime + at + 1.3);
    });
  } catch { /* geen geluid mogelijk */ }
}
let bellTimer, bellImgTimer;
function showDoorbell(deviceId) {
  const cam = deviceId || S.layout?.settings?.doorbell?.deviceId;
  hideScreensaver();
  lastTouch = Date.now(); nightDim();
  const el = $('#doorbell');
  el.hidden = false;
  el.innerHTML = `<div class="bell-box"><div class="bell-head"><span class="bell-ic">${icon('bell-ring')}</span><div><h2>Er wordt aangebeld</h2><div class="sub">${hhmm(new Date())}</div></div>
    <button class="btn" id="bellClose">Sluiten</button></div>
    ${cam ? `<img id="bellImg" src="/api/camera/${encodeURIComponent(cam)}?t=${Date.now()}" alt="Deurbel">` : '<div class="sub">Kies bij Instellingen welke camera bij de deurbel hoort.</div>'}</div>`;
  $('#bellClose').onclick = hideDoorbell;
  if (S.layout?.settings?.doorbell?.sound !== false) chime();
  clearInterval(bellImgTimer);
  if (cam) bellImgTimer = setInterval(() => {
    const img = $('#bellImg'); if (!img) return;
    const n = new Image(); n.onload = () => { img.src = n.src; }; n.src = `/api/camera/${encodeURIComponent(cam)}?t=${Date.now()}`;
  }, 1500);
  clearTimeout(bellTimer);
  bellTimer = setTimeout(hideDoorbell, 90 * 1000);
}
function hideDoorbell() { $('#doorbell').hidden = true; clearInterval(bellImgTimer); clearTimeout(bellTimer); }

// ---------------------------------------------------------------------------
// 9. Schermbeveiliging: klok of fotolijst als niemand het scherm gebruikt
// ---------------------------------------------------------------------------
let ssPhotos = [], ssIdx = 0, ssTimer = null;
function ssSettings() { return S.layout?.settings?.screensaver || { mode: 'off' }; }
function inNightWindow() {
  const nd = S.layout?.settings?.nightDim || {};
  const toMin = s => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + m; };
  const n = new Date(), m = n.getHours() * 60 + n.getMinutes(), f = toMin(nd.from || '23:00'), to = toMin(nd.to || '06:30');
  return f < to ? m >= f && m < to : m >= f || m < to;
}
async function showScreensaver() {
  const ss = ssSettings(), el = $('#screensaver');
  if (!el.hidden) return;
  if (ss.mode === 'photos' && !ssPhotos.length) {
    try { ssPhotos = (await api('GET', '/api/photos')).sort(() => Math.random() - 0.5); } catch { ssPhotos = []; }
  }
  el.hidden = false;
  el.className = `ss ${ss.mode === 'photos' && ssPhotos.length ? 'photos' : ss.mode === 'info' ? 'clock info' : 'clock'}`;
  delete el.dataset.ph;   // direct een foto tonen
  delete el.dataset.info;
  el.innerHTML = `<div class="ss-photo a"></div><div class="ss-photo b"></div><div class="ss-clock"><div class="ss-time"></div><div class="ss-date"></div><div class="ss-weather"></div><div class="ss-info"></div></div>`;
  if (ss.mode === 'info') loadEnergy();
  tickScreensaver();
  clearInterval(ssTimer);
  ssTimer = setInterval(tickScreensaver, 1000);
}
function tickScreensaver() {
  const el = $('#screensaver'); if (el.hidden) return;
  const d = new Date();
  el.querySelector('.ss-time').textContent = hhmm(d);
  el.querySelector('.ss-date').textContent = cap1(d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }));
  const w = WEATHER.data;
  el.querySelector('.ss-weather').innerHTML = w ? `${icon(wmo(w.current.code, w.current.isDay).icon)} ${Math.round(w.current.temp)}° ${wmo(w.current.code).text.toLowerCase()}` : '';
  // Elke minuut een beetje verschuiven tegen inbranden
  if (d.getSeconds() === 0 || !el.dataset.pos) {
    el.dataset.pos = '1';
    const c = el.querySelector('.ss-clock');
    c.style.transform = `translate(${Math.round((Math.random() - 0.5) * 30)}vw, ${Math.round((Math.random() - 0.5) * 30)}vh)`;
  }
  if (el.classList.contains('info') && Date.now() - (+el.dataset.info || 0) >= 10 * 1000) {
    el.dataset.info = Date.now();
    el.querySelector('.ss-info').innerHTML = ssInfoHtml();
  }
  if (el.classList.contains('photos') && Date.now() - (+el.dataset.ph || 0) >= (+ssSettings().photoSeconds || 20) * 1000) {
    el.dataset.ph = Date.now();
    const layers = el.querySelectorAll('.ss-photo');
    const next = layers[ssIdx % 2], prev = layers[(ssIdx + 1) % 2];
    const url = ssPhotos[ssIdx % ssPhotos.length];
    const img = new Image();
    img.onload = () => { next.style.backgroundImage = `url("${url}")`; next.classList.add('show'); prev.classList.remove('show'); };
    img.src = url; ssIdx++;
  }
}
function hideScreensaver() { const el = $('#screensaver'); if (el && !el.hidden) { el.hidden = true; clearInterval(ssTimer); } }
document.addEventListener('pointerdown', e => {
  if (!$('#screensaver').hidden) { e.stopPropagation(); e.preventDefault(); hideScreensaver(); lastTouch = Date.now(); }
}, true);
setInterval(() => {
  const ss = ssSettings();
  if (!S.layout || S.editing || ss.mode === 'off' || !ss.mode || !$('#doorbell').hidden || !$('#alarm').hidden) return;
  if (ss.onlyNight && !inNightWindow()) return;
  if (Date.now() - lastTouch > (+ss.after || 5) * 60 * 1000) showScreensaver();
}, 5000);

// ---------------------------------------------------------------------------
// Instellingen voor deurbel en schermbeveiliging (in het algemene instellingenpaneel)
// ---------------------------------------------------------------------------
EXTRA.globalSettingsHtml = s => {
  const db = s.doorbell || {}, ss = s.screensaver || {};
  return `<div class="field"><span class="flabel">Deurbel</span>
      ${deviceSelect('x_db_deviceId', db.deviceId, d => d.images || ['camera', 'doorbell'].includes(d.class))}
      ${db.deviceId ? `<label class="flabel" style="margin-top:6px">Waaraan zie je dat er gebeld is</label><select name="x_db_capability">${capOpts(db.deviceId, db.capability || 'last_ring_at', null, false)}</select>` : ''}
      <label class="check"><input type="checkbox" name="x_db_sound" ${db.sound !== false ? 'checked' : ''}> Belgeluid op de tablet</label>
      <button type="button" class="btn" id="bellTest">${icon('bell-ring')} Test de pop-up</button></div>
    <div class="field"><span class="flabel">Alarm (waterlek, rook, koolmonoxide)</span>
      <label class="check"><input type="checkbox" name="x_alarmScreen" ${s.alarmScreen !== false ? 'checked' : ''}> Groot rood scherm op de tablet</label>
      <label class="check"><input type="checkbox" name="x_alarmSound" ${s.alarmSound !== false ? 'checked' : ''}> Met alarmgeluid</label>
      <button type="button" class="btn" id="alarmTest">${icon('siren')} Test het alarm</button></div>
    <div class="field"><label>Afvalkalender (iCal-link, optioneel)</label>
      <input type="text" name="x_wasteIcs" value="${esc(s.wasteIcs || '')}" placeholder="https://... of webcal://...">
      <span class="hint">Leeg laten: de ophaaldagen komen uit de Homey-app Trashcan Reminder. Een iCal-link van je gemeente gaat daar voor.${DATA.wasteErr ? ` <b>${esc(DATA.wasteErr)}</b>` : ''}</span></div>
    <div class="field"><span class="flabel">Schermbeveiliging</span>${seg('x_ss_mode', [['off', 'Uit'], ['clock', 'Klok'], ['info', 'Overzicht'], ['photos', "Foto's"]], ss.mode || 'off')}
      <div class="row2"><div class="field"><label>Na (minuten)</label><input type="number" name="x_ss_after" value="${ss.after ?? 5}" min="1"></div>
      <div class="field"><label>Foto wisselen (sec)</label><input type="number" name="x_ss_photoSeconds" value="${ss.photoSeconds ?? 20}" min="5"></div></div>
      <label class="check"><input type="checkbox" name="x_ss_onlyNight" ${ss.onlyNight ? 'checked' : ''}> Alleen tijdens de nachttijden van het dimmen</label>
      <span class="hint">Foto's komen uit de map die je in docker-compose koppelt aan /app/photos.</span></div>`;
};
EXTRA.onGlobalInput = (e, n, s) => {
  if (!n.startsWith('x_')) return false;
  if (n === 'x_wasteIcs') {
    s.wasteIcs = e.target.value.trim();
    clearTimeout(EXTRA.wasteTimer); EXTRA.wasteTimer = setTimeout(loadWaste, 1500);
    return true;
  }
  if (n === 'x_alarmScreen' || n === 'x_alarmSound') { s[n.slice(2)] = e.target.checked; return true; }
  const [, grp, key] = n.match(/^x_(db|ss)_(.+)$/) || [];
  if (!grp) return false;
  const obj = grp === 'db' ? (s.doorbell ||= {}) : (s.screensaver ||= {});
  obj[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (key === 'deviceId') openGlobalSettings();
  return true;
};
EXTRA.bindGlobal = (body, s) => {
  body.querySelector('#bellTest')?.addEventListener('click', () => { save(true); setTimeout(() => api('POST', '/api/doorbell/test'), 300); });
  body.querySelector('#alarmTest')?.addEventListener('click', () => { save(true); setTimeout(() => api('POST', '/api/alarm/test'), 300); });
  body.querySelector('[data-seg="x_ss_mode"]')?.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    e.stopImmediatePropagation();
    body.querySelectorAll('[data-seg="x_ss_mode"] button').forEach(x => x.classList.toggle('sel', x === b));
    (s.screensaver ||= {}).mode = b.dataset.v; save();
  }, true);
};

// ---------------------------------------------------------------------------
// 10. Offline-melding en installeerbare app
// ---------------------------------------------------------------------------
let offTimer;
EXTRA.connHandlers.push(ok => {
  clearTimeout(offTimer);
  if (ok) $('#offline').hidden = true;
  else offTimer = setTimeout(() => { $('#offline').hidden = false; }, 4000);
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

// ---------------------------------------------------------------------------
// 11. Gegevens van buiten: afvalkalender, energiedashboard, aanwezigheid
// ---------------------------------------------------------------------------
const DATA = { waste: null, wasteErr: null, wasteAt: 0, energy: null, energyErr: null, energyAt: 0, presence: null, presenceErr: null, presenceAt: 0 };
const usesType = type => allTiles().some(t => t.type === type);

async function loadWaste() {
  DATA.wasteAt = Date.now();
  try { DATA.waste = await api('GET', '/api/waste'); DATA.wasteErr = null; }
  catch (e) { DATA.wasteErr = e.message; }
  rerenderTypes(['waste']); scheduleStatus();
}
async function loadEnergy() {
  if (!S.status.energy || (!usesType('energy') && $('#screensaver').hidden)) return;
  DATA.energyAt = Date.now();
  try { DATA.energy = await api('GET', '/api/energy'); DATA.energyErr = null; }
  catch (e) { DATA.energyErr = e.message; }
  rerenderTypes(['energy']);
}
async function loadPresence() {
  if (!usesType('presence')) return;
  DATA.presenceAt = Date.now();
  try { DATA.presence = await api('GET', '/api/presence'); DATA.presenceErr = null; }
  catch (e) { DATA.presenceErr = e.message; }
  rerenderTypes(['presence']);
}
// Een net toegevoegde tegel haalt zijn gegevens meteen op, niet pas bij de volgende ronde
const ensureLoaded = (at, fn) => { if (!DATA[at]) { DATA[at] = Date.now(); setTimeout(fn, 0); } };

EXTRA.onReady = () => { loadWaste(); loadEnergy(); loadPresence(); };
setInterval(loadWaste, 30 * 60 * 1000);
setInterval(loadEnergy, 30 * 1000);
setInterval(loadPresence, 60 * 1000);
const tileMsg = (t, ic, msg) => ({ html: `<div class="top"><span class="t-icon">${icon(t.icon || ic)}</span></div><div><div class="label">${esc(t.label)}</div><div class="sub">${esc(msg)}</div></div>` });

// ---------------------------------------------------------------------------
// 12. Afvalkalender
// ---------------------------------------------------------------------------
const WASTE_STYLE = [[/gft|groen|bio/i, '#34d399', 'leaf'], [/papier|karton/i, '#60a5fa', 'newspaper'], [/pmd|plastic|pbd|blik|drankkarton/i, '#fb923c', 'recycle'],
  [/glas/i, '#2dd4bf', 'wine'], [/textiel|kleding/i, '#f472b6', 'shirt'], [/kerst/i, '#22c55e', 'tree-pine'], [/rest/i, '#94a3b8', 'trash-2']];
const wasteStyle = type => { const m = WASTE_STYLE.find(([re]) => re.test(type)); return { color: m?.[1] || '#94a3b8', icon: m?.[2] || 'trash-2' }; };
function daysFromToday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - t) / 864e5);
}
function dayText(n) {
  if (n === 0) return 'Vandaag';
  if (n === 1) return 'Morgen';
  const d = new Date(); d.setDate(d.getDate() + n);
  return n < 7 ? cap1(d.toLocaleDateString(LOCALE, { weekday: 'long' })) : d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
}
// Korte namen voor lange omschrijvingen van de afvalkalender, zoals "Groente-, fruit en tuinafval"
const WASTE_SHORT = [[/gft|groente|tuinafval|bio/i, 'GFT'], [/papier|karton/i, 'Papier'], [/pmd|plastic|blik|drinkpak|drankkarton|pbd/i, 'PMD'],
  [/glas/i, 'Glas'], [/textiel|kleding/i, 'Textiel'], [/kerst/i, 'Kerstboom'], [/snoei/i, 'Snoeiafval'], [/grof/i, 'Grofvuil'],
  [/chemisch|kca/i, 'Chemisch afval'], [/rest/i, 'Restafval']];
function wasteName(type) {
  const m = WASTE_SHORT.find(([re]) => re.test(type));
  if (!m) return type;
  return /avond/i.test(type) ? `${m[1]} (avond)` : m[1];
}

// Ophaalmomenten per dag samenvoegen: [{ n: dagen vanaf vandaag, types: [...] }]
function wasteDays() {
  const byDate = new Map();
  for (const e of DATA.waste || []) {
    const n = daysFromToday(e.date);
    if (n < 0) continue;
    if (!byDate.has(e.date)) byDate.set(e.date, { n, types: [] });
    const name = wasteName(e.type);
    if (!byDate.get(e.date).types.includes(name)) byDate.get(e.date).types.push(name);
  }
  return [...byDate.values()].sort((a, b) => a.n - b.n);
}

TYPES.waste = {
  name: 'Afvalkalender', icon: 'trash-2',
  addable: { desc: 'Wanneer welke container aan de straat moet', make: () => ({ w: 2, h: 2, count: 4 }) },
  render(t) {
    ensureLoaded('wasteAt', loadWaste);
    if (!DATA.waste) return tileMsg(t, 'trash-2', DATA.wasteErr || 'Laden…');
    const days = wasteDays().slice(0, +t.count || 4);
    if (!days.length) return tileMsg(t, 'trash-2', 'Geen ophaaldagen gevonden');
    const soon = days[0].n <= 1;
    const rows = days.map(d => {
      const st = wasteStyle(d.types[0]);
      return `<div class="ev waste${d.n <= 1 ? ' alert' : ''}" style="--c:${st.color}"><span class="ev-ic">${icon(st.icon)}</span>
        <span class="ev-txt">${esc(d.types.join(', '))}</span><span class="ev-time">${esc(dayText(d.n))}</span></div>`;
    }).join('');
    return { cls: 'list-tile', accent: soon ? wasteStyle(days[0].types[0]).color : null, html: `<div class="label">${esc(t.label)}</div><div class="list">${rows}</div>` };
  },
  settings: t => `<div class="field"><label>Aantal ophaaldagen</label><input type="number" name="ws_count" min="1" max="10" value="${t.count ?? 4}"></div>`,
  onInput(t, e, n, rerender) { if (n !== 'ws_count') return false; t.count = e.target.value; rerender(); return true; },
};

// In de statusbalk en het zijpaneel: de avond ervoor en de ochtend zelf
EXTRA_CHIPS.push(() => {
  const d = wasteDays()[0];
  const h = new Date().getHours();
  if (!d || !((d.n === 1 && h >= 16) || (d.n === 0 && h < 10))) return [];
  const st = wasteStyle(d.types[0]);
  return [{ icon: st.icon, color: st.color, label: tr(d.n === 1 ? 'morgen aan de straat' : 'vandaag aan de straat'), value: d.types.map(x => tr(x)).join(', '), alert: true }];
});

// ---------------------------------------------------------------------------
// 13. Aanwezigheid
// ---------------------------------------------------------------------------
const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const presText = u => !u.present ? 'Weg' : u.asleep ? 'Slaapt' : 'Thuis';
TYPES.presence = {
  name: 'Aanwezigheid', icon: 'users',
  addable: { desc: 'Wie er thuis is, met een knop voor als iedereen weggaat', make: () => ({ w: 2, h: 1 }) },
  render(t) {
    ensureLoaded('presenceAt', loadPresence);
    const users = DATA.presence;
    if (!users) return tileMsg(t, 'users', DATA.presenceErr || 'Laden…');
    const home = users.filter(u => u.present).length;
    const sub = home === 0 ? 'Niemand thuis' : home === users.length ? 'Iedereen thuis' : `${home} van ${users.length} thuis`;
    const people = users.map(u => `<span class="pp${u.present ? ' home' : ''}${u.asleep ? ' sleep' : ''}" title="${esc(u.name)}: ${presText(u)}">
      <b>${esc(initials(u.name))}</b><small>${esc(u.name.split(' ')[0])}</small></span>`).join('');
    const away = t.awayFlowId ? `<button class="btn pp-away" data-act="away">${icon('door-open')} ${esc(t.awayLabel || 'Iedereen weg')}</button>` : '';
    return {
      cls: 'presence-tile',
      html: `<div class="top"><span class="t-icon">${icon(t.icon || 'users')}</span><div class="pp-row">${people}</div></div>
        <div class="pp-foot"><div><div class="label">${esc(t.label)}</div><div class="sub">${sub}</div></div>${away}</div>`,
    };
  },
  act(t, a) {
    if (a !== 'away' || !t.awayFlowId) return;
    const label = t.awayLabel || 'Iedereen weg';
    confirmThen({ ...t, label, confirm: true }, async () => {
      await api('POST', `/api/flow/${t.awayFlowKind || 'flow'}/${encodeURIComponent(t.awayFlowId)}`);
      flash(t); toast(`${label} gestart`);
    });
  },
  tap: t => openPopup(t, () => `<h3>${esc(t.label)}</h3>${(DATA.presence || []).map(u => `<div class="pick" style="cursor:default">
      <span class="pp${u.present ? ' home' : ''}${u.asleep ? ' sleep' : ''}"><b>${esc(initials(u.name))}</b></span>
      <div class="meta"><div>${esc(u.name)}</div></div><strong>${presText(u)}</strong></div>`).join('') || `<div class="sub">${esc(DATA.presenceErr || 'Geen gebruikers')}</div>`}
    <div class="actions"><button class="btn" data-close>Sluiten</button></div>`),
  settings(t) {
    return `<div class="field"><label>Flow onder de knop (bijvoorbeeld alles uit en alarm aan)</label><select name="pr_flow">
        <option value="">Geen knop</option>${(S.catalog?.flows || []).map(f => `<option value="${esc(f.id)}" data-kind="${f.kind}" ${f.id === t.awayFlowId ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div>
      ${t.awayFlowId ? `<div class="field"><label>Tekst op de knop</label><input type="text" name="pr_label" value="${esc(t.awayLabel || '')}" placeholder="Iedereen weg"></div>` : ''}
      <span class="hint">Aanwezigheid komt van de Homey-app op de telefoons. De API-sleutel moet het recht hebben om gebruikers te bekijken.</span>`;
  },
  onInput(t, e, n, rerender) {
    if (n === 'pr_flow') { t.awayFlowId = e.target.value || null; t.awayFlowKind = e.target.selectedOptions[0]?.dataset.kind || 'flow'; rerender(); openTileSettings(t); return true; }
    if (n === 'pr_label') { t.awayLabel = e.target.value; rerender(); return true; }
    return false;
  },
};

// ---------------------------------------------------------------------------
// 14. Energie uit het energiedashboard
// ---------------------------------------------------------------------------
TYPES.energy = {
  name: 'Energie vandaag', icon: 'zap',
  addable: { desc: 'Opwek, verbruik, kosten en de jaarnota uit je energiedashboard', make: () => ({ w: 3, h: 2, showYear: true }) },
  render(t) {
    if (!S.status.energy) return tileMsg(t, 'zap', 'Koppel je energiedashboard met ENERGY_URL in .env');
    ensureLoaded('energyAt', loadEnergy);
    const e = DATA.energy;
    if (!e) return tileMsg(t, 'zap', DATA.energyErr || 'Laden…');
    const d = e.today || {}, l = e.live || {}, jn = e.jaarnota;
    const stat = (ic, col, v, u, lbl) => `<div class="en-stat" style="--c:${col}"><span class="en-ic">${icon(ic)}</span><b>${v}<small>${u}</small></b><span>${lbl}</span></div>`;
    const grid = numv(l.grid_w);
    const live = [
      isFinite(numv(l.solar_w)) ? `${icon('sun')} ${fmtW(numv(l.solar_w))}` : '',
      isFinite(grid) ? `${icon(grid >= 0 ? 'arrow-down-to-line' : 'arrow-up-from-line')} ${fmtW(Math.abs(grid))} ${grid >= 0 ? 'afname' : 'terug'}` : '',
      isFinite(numv(l.battery_soc)) ? `${icon('battery-charging')} ${Math.round(l.battery_soc)}%` : '',
    ].filter(Boolean).map(x => `<span>${x}</span>`).join('');
    let year = '';
    if (t.showYear !== false && jn) {
      year = jn.ok
        ? `<div class="en-year ${jn.saldo >= 0 ? 'good' : 'bad'}">${icon('receipt')} Jaarnota: ${euro(Math.abs(jn.saldo))} ${jn.saldo >= 0 ? 'terug' : 'bijbetalen'}
            <small>verwacht, dag ${jn.elapsedDays} van ${jn.totalDays}</small></div>`
        : `<div class="en-year">${icon('receipt')} <small>${esc(jn.reason || '')}</small></div>`;
    }
    return {
      cls: 'energy-tile',
      html: `<div class="cost-head"><div class="label">${esc(t.label)}</div><div class="en-live">${live}</div></div>
        <div class="en-stats">
          ${stat('sun', '#fbbf24', fmtNum(d.solar, 1), ' kWh', 'Opwek')}
          ${stat('house', '#60a5fa', fmtNum(d.house, 1), ' kWh', 'Verbruik')}
          ${stat('leaf', '#34d399', d.selfSufficiency == null ? '–' : Math.round(d.selfSufficiency * 100), '%', 'Zelfvoorzienend')}
          ${stat('euro', '#f87171', euro(d.costs), '', 'Kosten vandaag')}
        </div>${year}`,
    };
  },
  settings: t => `<label class="check"><input type="checkbox" name="showYear" ${t.showYear !== false ? 'checked' : ''}> Verwachte jaarnota tonen</label>
    <span class="hint">Alle cijfers komen uit je energiedashboard, dus met jouw contract en tarieven.</span>`,
};

// ---------------------------------------------------------------------------
// 15. Alarmscherm bij waterlek, rook en koolmonoxide
// ---------------------------------------------------------------------------
const ALARM_KINDS = { water: 'droplet', smoke: 'alarm-smoke', co: 'triangle-alert' };
let alarmSoundTimer, alarmStopTimer;
function siren() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 6; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), at = ac.currentTime + i * 0.3;
      o.type = 'square'; o.frequency.value = i % 2 ? 660 : 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.15, at); g.gain.setValueAtTime(0.0001, at + 0.25);
      o.start(at); o.stop(at + 0.26);
    }
    setTimeout(() => ac.close(), 2500);
  } catch { /* geen geluid mogelijk */ }
}
function showAlarm(ev) {
  if (S.layout?.settings?.alarmScreen === false) return;
  hideScreensaver();
  lastTouch = Date.now(); nightDim();
  const el = $('#alarm');
  el.hidden = false;
  el.innerHTML = `<div class="alarm-box"><span class="alarm-ic">${icon(ev.icon || ALARM_KINDS[ev.kind] || 'siren')}</span>
    <h2>${esc(ev.text)}</h2><div class="sub">${hhmm(new Date(ev.ts || Date.now()))}${ev.test ? ', dit is een test' : ''}</div>
    <button class="btn" id="alarmOk">Gezien</button></div>`;
  $('#alarmOk').onclick = hideAlarm;
  clearInterval(alarmSoundTimer); clearTimeout(alarmStopTimer);
  if (S.layout?.settings?.alarmSound !== false) {
    siren();
    alarmSoundTimer = setInterval(siren, 4000);
    alarmStopTimer = setTimeout(() => clearInterval(alarmSoundTimer), 2 * 60 * 1000);   // geluid stopt na 2 minuten, het scherm blijft
  }
}
function hideAlarm() { $('#alarm').hidden = true; clearInterval(alarmSoundTimer); clearTimeout(alarmStopTimer); }

// ---------------------------------------------------------------------------
// 16. Schermbeveiliging "Overzicht": de dag in een paar kaarten
// ---------------------------------------------------------------------------
function ssInfoHtml() {
  const card = (ic, col, big, small) => `<div class="ss-card" style="--c:${col}"><span class="ss-card-ic">${icon(ic)}</span><b>${esc(big)}</b><small>${esc(small)}</small></div>`;
  const cards = [];
  const e = DATA.energy?.today;
  if (e) {
    cards.push(card('sun', '#fbbf24', `${fmtNum(e.solar, 1)} kWh`, 'opgewekt vandaag'));
    cards.push(card('house', '#60a5fa', `${fmtNum(e.house, 1)} kWh`, 'verbruikt vandaag'));
    if (e.selfSufficiency != null) cards.push(card('leaf', '#34d399', `${Math.round(e.selfSufficiency * 100)}%`, 'zelfvoorzienend'));
  }
  const tm = WEATHER.data?.daily?.[1];
  if (tm) cards.push(card(wmo(tm.code).icon, '#a5b4fc', `${Math.round(tm.max)}° / ${Math.round(tm.min)}°`, `morgen: ${wmo(tm.code).text.toLowerCase()}`));
  const w = wasteDays()[0];
  if (w && w.n <= 6) cards.push(card(wasteStyle(w.types[0]).icon, wasteStyle(w.types[0]).color, w.types.join(', '), dayText(w.n).toLowerCase()));
  return cards.join('');
}
