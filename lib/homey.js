'use strict';

// Verbinding met een echte Homey Pro via de lokale Web API.
const { HomeyAPI } = require('homey-api');

const ADDRESS = process.env.HOMEY_ADDRESS;
const TOKEN = process.env.HOMEY_TOKEN;

let api = null;
let handlers = {};
const states = {};            // { deviceId: { capabilityId: value } }
const instances = new Map();  // deviceId -> [capability instances]
let lastCatalog = null;
let lastCatalogAt = 0;

let online = false;           // bereikbaar volgens de laatste controle
function isConnected() { return !!api && online; }

// Elke minuut controleren of de Homey nog antwoordt. homey-api zelf meldt het niet als hij wegvalt.
async function checkOnline() {
  if (!api) return;
  let ok = false;
  try {
    const base = ADDRESS.endsWith('/') ? ADDRESS.slice(0, -1) : ADDRESS;
    const r = await fetch(`${base}/api/manager/zones/zone/`, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(8000) });
    ok = r.ok;
  } catch { ok = false; }
  if (ok === online) return;
  online = ok;
  console.log(ok ? 'Homey weer bereikbaar' : 'Homey reageert niet meer');
  handlers.onConnection?.(ok);
  if (ok) refreshDevices().catch(e => console.error(e.message));
}
function getStates() { return states; }

function summarizeDevice(d, zones) {
  const caps = {};
  for (const [id, c] of Object.entries(d.capabilitiesObj || {})) {
    caps[id] = {
      title: c.title, type: c.type, units: c.units ?? null,
      min: c.min ?? null, max: c.max ?? null, step: c.step ?? null,
      decimals: c.decimals ?? null, setable: !!c.setable, getable: c.getable !== false,
      values: c.values ?? null,
    };
  }
  return {
    id: d.id, name: d.name, class: d.class, virtualClass: d.virtualClass || null,
    zone: d.zone, zoneName: zones[d.zone]?.name || '',
    available: d.available !== false, capabilities: caps,
    images: (d.images || []).length,
  };
}

async function watchDevice(device) {
  if (instances.has(device.id)) return;
  const list = [];
  states[device.id] = states[device.id] || {};
  for (const [capId, c] of Object.entries(device.capabilitiesObj || {})) {
    states[device.id][capId] = c.value;
    if (c.getable === false) continue;
    const inst = device.makeCapabilityInstance(capId, value => {
      states[device.id][capId] = value;
      handlers.onCapability?.(device.id, capId, value);
    });
    list.push(inst);
  }
  instances.set(device.id, list);
}

async function refreshDevices() {
  const devices = await api.devices.getDevices();
  let changed = false;
  for (const d of Object.values(devices)) {
    if (!instances.has(d.id)) { await watchDevice(d); changed = true; }
  }
  for (const id of [...instances.keys()]) {
    if (!devices[id]) {
      instances.get(id).forEach(i => i.destroy());
      instances.delete(id);
      delete states[id];
      changed = true;
    }
  }
  if (changed) { lastCatalogAt = 0; handlers.onDevicesChanged?.(); }
  return devices;
}

async function connect() {
  console.log(`Verbinden met Homey op ${ADDRESS} ...`);
  api = await HomeyAPI.createLocalAPI({ address: ADDRESS, token: TOKEN });
  await refreshDevices();
  console.log(`Verbonden, ${instances.size} apparaten gevolgd`);
  online = true;
  handlers.onConnection?.(true);
}

async function init(h) {
  handlers = h;
  if (!ADDRESS || !TOKEN) throw new Error('HOMEY_ADDRESS en HOMEY_TOKEN zijn verplicht');
  const tryConnect = async () => {
    try { await connect(); }
    catch (err) {
      api = null;
      console.error('Homey niet bereikbaar, nieuwe poging over 30 s:', err.message);
      setTimeout(tryConnect, 30000);
    }
  };
  await tryConnect();
  // Nieuwe of verwijderde apparaten oppikken
  setInterval(() => { if (api) refreshDevices().catch(e => console.error(e.message)); }, 5 * 60 * 1000);
  setInterval(checkOnline, 60 * 1000);
}

async function safe(fn, fallback) {
  try { return await fn(); } catch (e) { console.warn(e.message); return fallback; }
}

async function getCatalog() {
  if (!api) throw new Error('Homey is (nog) niet verbonden');
  if (lastCatalog && Date.now() - lastCatalogAt < 60000) return lastCatalog;
  const [devices, zones, flows, aflows, moods] = await Promise.all([
    refreshDevices(),
    api.zones.getZones(),
    safe(() => api.flow.getFlows(), {}),
    safe(() => api.flow.getAdvancedFlows(), {}),
    safe(() => api.moods.getMoods(), {}),
  ]);
  const flowList = [
    ...Object.values(flows).map(f => ({ id: f.id, name: f.name, kind: 'flow', triggerable: f.triggerable !== false, enabled: f.enabled !== false })),
    ...Object.values(aflows).map(f => ({ id: f.id, name: f.name, kind: 'advanced', triggerable: f.triggerable !== false, enabled: f.enabled !== false })),
  ].filter(f => f.triggerable && f.enabled).sort((a, b) => a.name.localeCompare(b.name));

  lastCatalog = {
    zones: Object.values(zones).map(z => ({ id: z.id, name: z.name, parent: z.parent })),
    devices: Object.values(devices).map(d => summarizeDevice(d, zones)).sort((a, b) => a.name.localeCompare(b.name)),
    flows: flowList,
    moods: Object.values(moods).map(m => ({ id: m.id, name: m.name, zone: m.zone, zoneName: zones[m.zone]?.name || '' })),
  };
  lastCatalogAt = Date.now();
  return lastCatalog;
}

// Camerabeeld ophalen via de Homey (met de API-sleutel), zodat de tablet geen toegang tot Homey nodig heeft
async function getCameraImage(deviceId, idx = 0) {
  if (!api) throw new Error('Homey is niet verbonden');
  const d = await api.devices.getDevice({ id: deviceId });
  const imgs = d.images || [];
  const im = imgs[idx] || imgs[0];
  if (!im) throw new Error('Dit apparaat heeft geen camerabeeld');
  let url = im.imageObj?.url || im.url;
  if (!url) {
    const all = await api.images.getImages();
    url = all[im.imageId || im.id]?.url;
  }
  if (!url) throw new Error('Geen beeld-URL gevonden');
  const base = ADDRESS.endsWith('/') ? ADDRESS.slice(0, -1) : ADDRESS;
  const full = url.startsWith('http') ? url : base + url;
  const r = await fetch(full, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) throw new Error(`Camerabeeld niet beschikbaar (${r.status})`);
  return { type: r.headers.get('content-type') || 'image/jpeg', buf: Buffer.from(await r.arrayBuffer()) };
}

// Geschiedenis uit Homey Insights, zodat grafieken direct gevuld zijn
let insightLogs = null, insightLogsAt = 0;
async function getInsights(deviceId, cap, resolution = 'last24Hours') {
  if (!api) return null;
  if (!insightLogs || Date.now() - insightLogsAt > 3600e3) {
    insightLogs = Object.values(await api.insights.getLogs());
    insightLogsAt = Date.now();
  }
  const log = insightLogs.find(l => {
    const owner = l.ownerUri || l.uri || '';
    const id = l.ownerId || l.id || '';
    return owner === `homey:device:${deviceId}` && (id === cap || id.endsWith(`:${cap}`));
  });
  if (!log) return null;
  const res = await api.insights.getLogEntries({ uri: log.ownerUri || log.uri, id: log.ownerId || log.id, resolution });
  return (res.values || []).filter(x => typeof x.v === 'number').map(x => [new Date(x.t).getTime(), x.v]);
}

async function setCapability(deviceId, capabilityId, value) {
  if (!api) throw new Error('Homey is niet verbonden');
  await api.devices.setCapabilityValue({ deviceId, capabilityId, value });
}

async function triggerFlow(kind, id) {
  if (!api) throw new Error('Homey is niet verbonden');
  if (kind === 'advanced') await api.flow.triggerAdvancedFlow({ id });
  else await api.flow.triggerFlow({ id });
}

async function setMood(id) {
  if (!api) throw new Error('Homey is niet verbonden');
  await api.moods.setMood({ id });
}

// Ophaaldagen uit de Homey-app Trashcan Reminder (com.trashchecker), via de web-API van die app
async function getTrashDates() {
  if (!api) throw new Error('Homey is niet verbonden');
  const base = ADDRESS.endsWith('/') ? ADDRESS.slice(0, -1) : ADDRESS;
  const r = await fetch(`${base}/api/app/com.trashchecker/trashcollectiondays`, {
    headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(15000),
  });
  if (r.status === 404) throw new Error('De app Trashcan Reminder is niet gevonden op de Homey');
  if (r.status === 401 || r.status === 403) throw new Error('De API-sleutel mag de app Trashcan Reminder niet lezen. Maak een sleutel met toegang tot apps');
  if (!r.ok) throw new Error(`Trashcan Reminder gaf fout ${r.status}`);
  return r.json();
}

// Wie is er thuis: de gebruikers van de Homey (aanwezigheid via de Homey-app op de telefoon)
async function getPresence() {
  if (!api) throw new Error('Homey is niet verbonden');
  const users = await api.users.getUsers();
  return Object.values(users)
    .filter(u => u.enabled !== false && u.role !== 'guest')
    .map(u => ({ id: u.id, name: u.name, present: u.present === true, asleep: u.asleep === true }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { init, isConnected, getStates, getCatalog, setCapability, triggerFlow, setMood, getCameraImage, getInsights, getPresence, getTrashDates };
