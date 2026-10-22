'use strict';

// Demo-modus: nep-apparaten zodat je het dashboard zonder Homey kunt uitproberen.
const zones = [
  { id: 'z_home', name: 'Huis', parent: null },
  { id: 'z_living', name: 'Woonkamer', parent: 'z_home' },
  { id: 'z_kitchen', name: 'Keuken', parent: 'z_home' },
  { id: 'z_hall', name: 'Gang', parent: 'z_home' },
  { id: 'z_garden', name: 'Tuin', parent: 'z_home' },
  { id: 'z_meter', name: 'Meterkast', parent: 'z_home' },
  { id: 'z_bed', name: 'Slaapkamer', parent: 'z_home' },
];
const zn = id => zones.find(z => z.id === id)?.name || '';

const C = {
  onoff: { title: 'Aan/uit', type: 'boolean', setable: true },
  dim: { title: 'Helderheid', type: 'number', min: 0, max: 1, step: 0.01, setable: true },
  light_temperature: { title: 'Kleurtemperatuur', type: 'number', min: 0, max: 1, setable: true },
  light_hue: { title: 'Tint', type: 'number', min: 0, max: 1, setable: true },
  light_saturation: { title: 'Verzadiging', type: 'number', min: 0, max: 1, setable: true },
  light_mode: { title: 'Lichtmodus', type: 'enum', setable: true, values: [{ id: 'color', title: 'Kleur' }, { id: 'temperature', title: 'Temperatuur' }] },
  windowcoverings_set: { title: 'Positie', type: 'number', min: 0, max: 1, step: 0.01, setable: true },
  windowcoverings_state: { title: 'Status', type: 'enum', setable: true, values: [{ id: 'up', title: 'Omhoog' }, { id: 'idle', title: 'Stop' }, { id: 'down', title: 'Omlaag' }] },
  target_temperature: { title: 'Doeltemperatuur', type: 'number', min: 5, max: 30, step: 0.5, units: '°C', decimals: 1, setable: true },
  measure_temperature: { title: 'Temperatuur', type: 'number', units: '°C', decimals: 1 },
  measure_humidity: { title: 'Luchtvochtigheid', type: 'number', units: '%', decimals: 0 },
  measure_power: { title: 'Vermogen', type: 'number', units: 'W', decimals: 0 },
  meter_power: { title: 'Energie', type: 'number', units: 'kWh', decimals: 2 },
  measure_luminance: { title: 'Lichtsterkte', type: 'number', units: 'lx', decimals: 0 },
  measure_battery: { title: 'Batterij', type: 'number', units: '%', decimals: 0 },
  alarm_motion: { title: 'Beweging', type: 'boolean' },
  alarm_contact: { title: 'Contact', type: 'boolean' },
  volume_set: { title: 'Volume', type: 'number', min: 0, max: 1, setable: true },
  volume_mute: { title: 'Dempen', type: 'boolean', setable: true },
  volume_up: { title: 'Harder', type: 'boolean', setable: true }, volume_down: { title: 'Zachter', type: 'boolean', setable: true },
  channel_up: { title: 'Zender +', type: 'boolean', setable: true }, channel_down: { title: 'Zender -', type: 'boolean', setable: true },
  speaker_track: { title: 'Nummer', type: 'string' },
  vacuum_state: { title: 'Status', type: 'string' },
  command_start_clean: { title: 'Start', type: 'boolean', setable: true }, command_dock: { title: 'Dock', type: 'boolean', setable: true },
  command_pause: { title: 'Pauze', type: 'boolean', setable: true },
  'meter_power.imported_today': { title: 'Afgenomen vandaag', type: 'number', units: 'kWh', decimals: 3 },
  'meter_power.exported_today': { title: 'Teruggeleverd vandaag', type: 'number', units: 'kWh', decimals: 3 },
  'meter_gas.today': { title: 'Gas vandaag', type: 'number', units: 'm³', decimals: 3 },
  last_ring_at: { title: 'Laatst gebeld', type: 'number' },
};
const caps = list => Object.fromEntries(list.map(id => [id, { units: null, min: null, max: null, step: null, decimals: null, setable: false, getable: true, values: null, ...C[id] }]));

const devices = [
  { id: 'd_living_lamp', name: 'Lamp bank', class: 'light', zone: 'z_living', capabilities: caps(['onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode']) },
  { id: 'd_living_spots', name: 'Spots woonkamer', class: 'light', zone: 'z_living', capabilities: caps(['onoff', 'dim', 'light_temperature']) },
  { id: 'd_kitchen', name: 'Keukenverlichting', class: 'light', zone: 'z_kitchen', capabilities: caps(['onoff', 'dim']) },
  { id: 'd_hall', name: 'Ganglamp', class: 'light', zone: 'z_hall', capabilities: caps(['onoff']) },
  { id: 'd_blind', name: 'Zonwering woonkamer', class: 'blinds', zone: 'z_living', capabilities: caps(['windowcoverings_set', 'windowcoverings_state']) },
  { id: 'd_thermo', name: 'Thermostaat', class: 'thermostat', zone: 'z_living', capabilities: caps(['target_temperature', 'measure_temperature', 'measure_humidity']) },
  { id: 'd_p1', name: 'Energy Dongle', class: 'sensor', zone: 'z_meter', capabilities: caps(['measure_power', 'meter_power', 'meter_power.imported_today', 'meter_power.exported_today', 'meter_gas.today']) },
  { id: 'd_washer', name: 'Wasmachine', class: 'socket', zone: 'z_kitchen', capabilities: caps(['onoff', 'measure_power']) },
  { id: 'd_tv', name: 'TV Woonkamer', class: 'tv', zone: 'z_living', capabilities: caps(['onoff', 'volume_set', 'volume_mute', 'volume_up', 'volume_down', 'channel_up', 'channel_down', 'speaker_track']) },
  { id: 'd_roomba', name: 'Roomba', class: 'vacuumcleaner', zone: 'z_living', capabilities: caps(['vacuum_state', 'measure_battery', 'command_start_clean', 'command_pause', 'command_dock']) },
  { id: 'd_old', name: 'Sensor schuur', class: 'sensor', zone: 'z_garden', capabilities: caps(['alarm_contact', 'measure_battery']), available: false },
  { id: 'd_solar', name: 'Zonnepanelen', class: 'solarpanel', zone: 'z_garden', capabilities: caps(['measure_power', 'meter_power']) },
  { id: 'd_motion', name: 'Bewegingssensor gang', class: 'sensor', zone: 'z_hall', capabilities: caps(['alarm_motion', 'measure_luminance', 'measure_battery']) },
  { id: 'd_door', name: 'Voordeur', class: 'sensor', zone: 'z_hall', capabilities: caps(['alarm_contact', 'measure_battery']) },
  { id: 'd_battery', name: 'Thuisaccu', class: 'battery', zone: 'z_garden', capabilities: caps(['measure_battery', 'measure_power']) },
  { id: 'd_bed', name: 'Lamp slaapkamer', class: 'light', zone: 'z_bed', capabilities: caps(['onoff', 'dim', 'light_temperature']) },
  { id: 'd_bedtemp', name: 'Temperatuur slaapkamer', class: 'sensor', zone: 'z_bed', capabilities: caps(['measure_temperature', 'measure_humidity']) },
  { id: 'd_cam1', name: 'Camera voortuin', class: 'camera', zone: 'z_garden', capabilities: caps(['alarm_motion']), images: 1 },
  { id: 'd_cam2', name: 'Deurbel', class: 'doorbell', zone: 'z_hall', capabilities: caps(['alarm_motion', 'last_ring_at']), images: 1 },
  { id: 'd_plug', name: 'Koffiezetapparaat', class: 'socket', zone: 'z_kitchen', capabilities: caps(['onoff', 'measure_power']) },
];

const states = {
  d_living_lamp: { onoff: true, dim: 0.65, light_hue: 0.08, light_saturation: 0.7, light_temperature: 0.6, light_mode: 'temperature' },
  d_living_spots: { onoff: false, dim: 0.4, light_temperature: 0.3 },
  d_kitchen: { onoff: true, dim: 1 },
  d_hall: { onoff: false },
  d_blind: { windowcoverings_set: 0.3, windowcoverings_state: 'idle' },
  d_thermo: { target_temperature: 20.5, measure_temperature: 19.8, measure_humidity: 54 },
  d_p1: { measure_power: 420, meter_power: 4231.12, 'meter_power.imported_today': 6.84, 'meter_power.exported_today': 4.21, 'meter_gas.today': 1.37 },
  d_washer: { onoff: true, measure_power: 0 },
  d_tv: { onoff: true, volume_set: 0.35, volume_mute: false, speaker_track: 'NPO 1' },
  d_roomba: { vacuum_state: 'none_charge', measure_battery: 100 },
  d_old: { alarm_contact: false, measure_battery: 11 },
  d_solar: { measure_power: 1830, meter_power: 2840.5 },
  d_motion: { alarm_motion: false, measure_luminance: 120, measure_battery: 82 },
  d_door: { alarm_contact: false, measure_battery: 23 },
  d_plug: { onoff: false, measure_power: 0 },
  d_cam1: { alarm_motion: false },
  d_cam2: { alarm_motion: true, last_ring_at: 0 },
  d_battery: { measure_battery: 68, measure_power: 640 },
  d_bed: { onoff: false, dim: 0.5, light_temperature: 0.8 },
  d_bedtemp: { measure_temperature: 18.4, measure_humidity: 61 },
};

let h = {};
const emit = (d, c, v) => { states[d][c] = v; h.onCapability?.(d, c, v); };

async function init(handlers) {
  h = handlers;
  setInterval(() => {
    emit('d_p1', 'measure_power', Math.round(250 + Math.random() * 900 - (Math.random() > 0.6 ? 900 : 0)));
    emit('d_solar', 'measure_power', Math.round(1500 + Math.random() * 600));
    if (Math.random() > 0.8) emit('d_motion', 'alarm_motion', !states.d_motion.alarm_motion);
    emit('d_battery', 'measure_power', Math.round(500 + Math.random() * 300));
    // Wasmachine draait 60 seconden per 2,5 minuut; voordeur gaat af en toe open
    const cyc = (Date.now() / 1000) % 150;
    emit('d_washer', 'measure_power', cyc < 60 ? Math.round(1700 + Math.random() * 300) : 0);
    if (Math.random() > 0.93) emit('d_door', 'alarm_contact', !states.d_door.alarm_contact);
  }, 3000);
}

async function getCatalog() {
  return {
    zones,
    devices: devices.map(d => ({ ...d, zoneName: zn(d.zone), available: d.available !== false, virtualClass: null })),
    flows: [
      { id: 'f_alloff', name: 'Alles uit', kind: 'advanced' },
      { id: 'f_movie', name: 'Filmavond', kind: 'flow' },
      { id: 'f_leave', name: 'Ik ga weg', kind: 'advanced' },
    ],
    moods: [
      { id: 'm_cozy', name: 'Gezellig', zone: 'z_living', zoneName: 'Woonkamer' },
      { id: 'm_bright', name: 'Helder', zone: 'z_living', zoneName: 'Woonkamer' },
    ],
  };
}

async function setCapability(d, c, v) {
  if (!states[d]) throw new Error('Onbekend apparaat');
  emit(d, c, v);
  if (c === 'dim' && 'onoff' in states[d]) emit(d, 'onoff', v > 0);
  if (c === 'windowcoverings_state' && v !== 'idle') {
    const target = v === 'up' ? 1 : 0;
    const t = setInterval(() => {
      const cur = states[d].windowcoverings_set;
      if (states[d].windowcoverings_state === 'idle' || Math.abs(cur - target) < 0.05) {
        clearInterval(t); emit(d, 'windowcoverings_set', states[d].windowcoverings_state === 'idle' ? cur : target);
        emit(d, 'windowcoverings_state', 'idle'); return;
      }
      emit(d, 'windowcoverings_set', +(cur + (target > cur ? 0.1 : -0.1)).toFixed(2));
    }, 400);
  }
}

async function triggerFlow(kind, id) {
  if (id === 'f_alloff') for (const d of ['d_living_lamp', 'd_living_spots', 'd_kitchen', 'd_hall']) emit(d, 'onoff', false);
}
async function setMood(id) {
  emit('d_living_lamp', 'onoff', true);
  emit('d_living_lamp', 'dim', id === 'm_cozy' ? 0.35 : 1);
}

// Demo-camerabeeld: een getekende tuin met de huidige tijd
async function getCameraImage(id) {
  const now = new Date().toLocaleTimeString('nl-NL');
  const name = devices.find(d => d.id === id)?.name || 'Camera';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#87a9c9"/><stop offset="1" stop-color="#d9e4ea"/></linearGradient></defs>
    <rect width="640" height="360" fill="url(#s)"/><rect y="230" width="640" height="130" fill="#5f8a4c"/>
    <rect x="80" y="120" width="220" height="140" fill="#b9805a"/><polygon points="70,125 190,50 310,125" fill="#7a4b3a"/>
    <rect x="170" y="190" width="40" height="70" fill="#4a3428"/><rect x="380" y="200" width="200" height="12" fill="#8a6a4a"/>
    <circle cx="520" cy="150" r="46" fill="#3f6d38"/><rect x="514" y="190" width="12" height="45" fill="#5b4330"/>
    <text x="16" y="28" font-family="sans-serif" font-size="18" fill="#fff">${name}  ${now}</text></svg>`;
  return { type: 'image/svg+xml', buf: Buffer.from(svg) };
}

function demoPages() {
  const t = (id, type, extra) => ({ id, type, w: 1, h: 1, ...extra });
  return [
    { id: 'p_home', name: 'Thuis', icon: 'house', tiles: [
      t('h1', 'header', { label: 'Woonkamer', w: 'full' }),
      t('t1', 'light', { deviceId: 'd_living_lamp', label: 'Lamp bank', icon: 'lamp', w: 2, h: 2 }),
      t('t2', 'light', { deviceId: 'd_living_spots', label: 'Spots', icon: 'lightbulb' }),
      t('t3', 'light', { deviceId: 'd_kitchen', label: 'Keuken', icon: 'cooking-pot' }),
      t('t8', 'blinds', { deviceId: 'd_blind', label: 'Zonwering', icon: 'blinds', w: 2 }),
      t('t4', 'light', { deviceId: 'd_hall', label: 'Gang', icon: 'lamp-ceiling' }),
      t('t11', 'flow', { flowId: 'f_alloff', flowKind: 'advanced', label: 'Alles uit', icon: 'power', confirm: true }),
      t('t12', 'mood', { moodId: 'm_cozy', label: 'Gezellig', icon: 'sofa' }),
      t('t13', 'switch', { deviceId: 'd_plug', label: 'Koffie', icon: 'coffee' }),
      t('h2', 'header', { label: 'Energie', w: 'full' }),
      t('c1', 'chart', { label: 'Vandaag', w: 4, h: 2, hours: 24, series: [
        { deviceId: 'd_p1', capability: 'measure_power', label: 'Net', color: '#facc15' },
        { deviceId: 'd_solar', capability: 'measure_power', label: 'Zon', color: '#fb923c' }] }),
      t('t6', 'sensor', { deviceId: 'd_p1', capability: 'measure_power', label: 'Net', icon: 'zap', w: 2, chip: true,
        thresholds: [{ op: '<', value: '0', color: '#34d399' }, { op: '>', value: '1500', color: '#f87171' }] }),
      t('t7', 'sensor', { deviceId: 'd_solar', capability: 'measure_power', secondary: 'meter_power', label: 'Zon', icon: 'sun', w: 2, chip: true }),
      t('t14', 'sensor', { deviceId: 'd_battery', capability: 'measure_battery', secondary: 'measure_power', label: 'Thuisaccu', icon: 'battery-charging', display: 'gauge', w: 2, h: 2, chip: true }),
      t('r1', 'rooms', { label: 'Ruimtes', w: 2, h: 2 }),
      t('h3', 'header', { label: 'Klimaat en veiligheid', w: 'full' }),
      t('t5', 'thermostat', { deviceId: 'd_thermo', label: 'Woonkamer', icon: 'thermometer', w: 2 }),
      t('t15', 'sensor', { deviceId: 'd_bedtemp', capability: 'measure_temperature', secondary: 'measure_humidity', label: 'Slaapkamer', icon: 'bed-double', w: 2, chip: true }),
      t('t9', 'sensor', { deviceId: 'd_door', capability: 'alarm_contact', label: 'Voordeur', icon: 'door-closed' }),
      t('t10', 'sensor', { deviceId: 'd_motion', capability: 'alarm_motion', label: 'Gang', icon: 'footprints' }),
      t('t16', 'sensor', { deviceId: 'd_door', capability: 'alarm_contact', label: 'Achterdeur', icon: 'door-open' }),
      t('t17', 'sensor', { deviceId: 'd_cam2', capability: 'alarm_motion', label: 'Deurbel', icon: 'bell' }),
      t('cam1', 'camera', { deviceId: 'd_cam1', label: 'Voortuin', icon: 'cctv', w: 2, h: 2 }),
      t('cam2', 'camera', { deviceId: 'd_cam2', label: 'Deurbel', icon: 'bell', w: 2, h: 2, refresh: 5 }),
    ] },
    { id: 'p_extra', name: 'Overzicht', icon: 'layout-grid', tiles: [
      t('e1', 'energyflow', { label: 'Energiestroom', w: 3, h: 3, flow: { gridDev: 'd_p1', gridCap: 'measure_power', solarDev: 'd_solar', solarCap: 'measure_power', batDev: 'd_battery', batCap: 'measure_power', socCap: 'measure_battery' } }),
      t('e2', 'costs', { label: 'Kosten vandaag', deviceId: 'd_p1', w: 3, h: 2, priceImport: '0,27', priceExport: '0,27', priceGas: '1,42' }),
      t('e3', 'appliance', { label: 'Wasmachine', deviceId: 'd_washer', icon: 'washing-machine', powerCap: 'measure_power', threshold: 5, doneAfter: 0.5, w: 3, h: 1 }),
      t('e4', 'group', { label: 'Alle lampen beneden', icon: 'lightbulb', w: 2, devices: ['d_living_lamp', 'd_living_spots', 'd_kitchen', 'd_hall'] }),
      t('e5', 'remote', { label: 'TV', deviceId: 'd_tv', icon: 'tv' }),
      t('e6', 'remote', { label: 'Roomba', deviceId: 'd_roomba', icon: 'bot' }),
      t('e7', 'timeline', { label: 'Tijdlijn', w: 2, h: 3, hideKinds: [] }),
      t('e8', 'maintenance', { label: 'Onderhoud', w: 2, h: 3, threshold: 40 }),
    ] },
    { id: 'p_kitchen', name: 'Keuken', icon: 'cooking-pot', tiles: [
      t('k1', 'light', { deviceId: 'd_kitchen', label: 'Verlichting', icon: 'lightbulb', w: 2, h: 2 }),
      t('k2', 'switch', { deviceId: 'd_plug', label: 'Koffie', icon: 'coffee', w: 2 }),
    ] },
  ];
}

async function getPresence() {
  const h = new Date().getHours();
  return [
    { id: 'u1', name: 'Bewoner 1', present: true, asleep: h < 7 },
    { id: 'u2', name: 'Bewoner 2', present: h >= 17 || h < 8, asleep: h < 7 },
  ];
}

module.exports = { getPresence, getCameraImage, init, isConnected: () => true, getStates: () => states, getCatalog, setCapability, triggerFlow, setMood, demoPages };
