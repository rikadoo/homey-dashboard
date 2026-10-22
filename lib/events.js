'use strict';

// Gebeurtenissen (tijdlijn), status van apparaten zoals wasmachine en droger, en de deurbel.
const fs = require('fs');
const path = require('path');

module.exports = function createEvents({ dataDir, getLayout, getStates, getCatalog, broadcast }) {
  const file = path.join(dataDir, 'events.json');
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* nieuw */ }
  let log = saved.log || [];
  const appl = saved.appliances || {};       // tegel-id -> { state, since, startedAt, lowSince }
  const last = {};                           // vorige waarde per apparaat|capability
  const motionAt = {};
  let names = {};
  let dirty = false;

  async function refreshNames() {
    try {
      const cat = await getCatalog();
      names = Object.fromEntries(cat.devices.map(d => [d.id, { name: d.name, zone: d.zoneName }]));
    } catch { /* later opnieuw */ }
  }
  refreshNames();
  setInterval(refreshNames, 5 * 60 * 1000);

  // Startwaarden onthouden, zodat de eerste melding na een herstart geen nep-gebeurtenis geeft.
  // Ook aangeroepen zodra de Homey verbonden is: dat duurt vaak langer dan 2 seconden, en zonder
  // startwaarde werd de eerste echte gebeurtenis (deur open, aanbellen) overgeslagen.
  function seed() {
    for (const [d, caps] of Object.entries(getStates())) for (const [c, v] of Object.entries(caps)) {
      if (!(`${d}|${c}` in last)) last[`${d}|${c}`] = v;
    }
  }
  setTimeout(seed, 2000);

  function add(ev) {
    ev.ts = Date.now();
    ev.id = `${ev.ts}-${Math.random().toString(36).slice(2, 6)}`;
    log.unshift(ev);
    if (log.length > 300) log.length = 300;
    dirty = true;
    broadcast({ type: 'event', event: ev });
  }
  const nm = d => names[d]?.name || 'Apparaat';

  function onCapability(d, c, v) {
    const k = `${d}|${c}`;
    const prev = last[k];
    last[k] = v;
    if (prev === undefined || prev === v) return;
    const now = Date.now();
    if (c === 'alarm_contact') add({ kind: 'contact', deviceId: d, icon: v ? 'door-open' : 'door-closed', text: `${nm(d)} ${v ? 'open' : 'dicht'}`, alert: v });
    if (c === 'alarm_motion' && v === true && now - (motionAt[d] || 0) > 10 * 60 * 1000) {
      motionAt[d] = now;
      add({ kind: 'motion', deviceId: d, icon: 'footprints', text: `Beweging: ${nm(d)}` });
    }
    if (c === 'alarm_water' && v === true) add({ kind: 'water', deviceId: d, icon: 'droplet', text: `Waterlek bij ${nm(d)}!`, alert: true });
    if (c === 'alarm_smoke' && v === true) add({ kind: 'smoke', deviceId: d, icon: 'alarm-smoke', text: `Rookmelder ${nm(d)}!`, alert: true });
    if (c === 'alarm_co' && v === true) add({ kind: 'co', deviceId: d, icon: 'triangle-alert', text: `Koolmonoxide bij ${nm(d)}!`, alert: true });
    if (c === 'alarm_vibration' && v === true) {
      const post = /brievenbus|post/i.test(nm(d));
      add({ kind: post ? 'post' : 'vibration', deviceId: d, icon: post ? 'mailbox' : 'activity', text: post ? 'Post in de brievenbus' : `Trilling: ${nm(d)}` });
    }
    const db = getLayout().settings?.doorbell;
    if (db?.deviceId === d && (db.capability || 'last_ring_at') === c && v) ring(d);
    checkAppliances();
  }

  function ring(deviceId) {
    add({ kind: 'doorbell', deviceId, icon: 'bell-ring', text: 'Er werd aangebeld', alert: true });
    broadcast({ type: 'doorbell', deviceId });
  }

  // ---- Apparaten zoals wasmachine, droger, vaatwasser, 3D-printer ----
  const num = v => typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  function checkAppliances() {
    const states = getStates(), now = Date.now();
    let changed = false;
    for (const p of getLayout().pages || []) for (const t of p.tiles || []) {
      if (t.type !== 'appliance' || !t.deviceId) continue;
      const st = states[t.deviceId] || {};
      const a = appl[t.id] || (appl[t.id] = { state: 'idle', since: now });
      const power = t.powerCap ? num(st[t.powerCap]) : NaN;
      const prog = t.progressCap ? num(st[t.progressCap]) : NaN;
      const busy = (isFinite(power) && power > (+t.threshold || 5)) || (isFinite(prog) && prog > 0 && prog < 100);
      const before = a.state;
      if (busy) {
        if (a.state !== 'running') { a.state = 'running'; a.startedAt = now; a.since = now; }
        a.lowSince = null;
      } else if (a.state === 'running') {
        a.lowSince = a.lowSince || now;
        if (now - a.lowSince >= (+t.doneAfter || 3) * 60 * 1000 || prog >= 100) {
          a.state = 'done'; a.since = now; a.duration = now - (a.startedAt || now);
          add({ kind: 'appliance', deviceId: t.deviceId, icon: 'circle-check', text: `${t.label || nm(t.deviceId)} is klaar`, alert: false });
        }
      } else if (a.state === 'done' && now - a.since > 12 * 3600e3) { a.state = 'idle'; a.since = now; }
      if (a.state !== before) changed = true;
    }
    if (changed) { dirty = true; broadcast({ type: 'appliances', data: appl }); }
  }
  setInterval(checkAppliances, 20 * 1000);

  function persist() {
    if (!dirty) return;
    dirty = false;
    try { fs.writeFileSync(file, JSON.stringify({ log, appliances: appl })); } catch (e) { console.warn(e.message); }
  }
  setInterval(persist, 60 * 1000);
  process.on('exit', persist);

  return {
    onCapability,
    ring,
    seed,
    list: () => log,
    appliances: () => appl,
    ack(tileId) { if (appl[tileId]) { appl[tileId] = { state: 'idle', since: Date.now() }; dirty = true; broadcast({ type: 'appliances', data: appl }); } },
  };
};
