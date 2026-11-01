'use strict';
/* Elektrische auto (bijvoorbeeld een Hyundai KONA via de Bluelink-app in Homey).
   Tegel met accu, bereik, laadstatus, slot en klimaat; tikken opent bediening, kaart en details. */
(function () {
  if (typeof TYPES === 'undefined') return;

  const num = v => typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  const capsOf = t => device(t.deviceId)?.capabilities || Object.fromEntries(Object.keys(stateOf(t.deviceId)).map(k => [k, {}]));
  const canSet = (t, c) => !!c && c in capsOf(t) && capsOf(t)[c]?.setable !== false;

  // Onderdelen van een auto en de namen die verschillende Homey-apps ervoor gebruiken.
  // Eerst exacte namen, daarna een zoekpatroon. Per tegel is elk onderdeel ook handmatig te kiezen.
  const ROLES = [
    ['soc', 'Laadniveau (%)', ['measure_battery', 'ev_battery_level', 'measure_battery.ev', 'battery_level', 'measure_soc', 'soc'], /soc|battery_level|state_of_charge/i, 'number'],
    ['range', 'Bereik (km)', ['measure_range', 'ev_range', 'measure_range.ev', 'battery_range', 'range', 'measure_distance.range'], /range/i, 'number'],
    ['chargingState', 'Laadstatus', ['ev_charging_state', 'charging_state', 'charge_state', 'ev_charge_state', 'charging_status'], /charg\w*_(state|status)/i],
    ['chargePower', 'Laadvermogen', ['measure_power', 'measure_power.charging', 'charging_power', 'measure_charge_power'], /charg\w*power/i, 'number'],
    ['charge', 'Laden starten/stoppen', ['charge', 'charging', 'ev_charging', 'onoff.charging', 'charge_control'], /^(start_)?charg(e|ing)$|onoff\.charg/i, 'boolean'],
    ['locked', 'Slot', ['locked', 'lock', 'door_locked', 'doors_locked', 'closed_locked'], /lock/i, 'boolean'],
    ['climate', 'Klimaat aan/uit', ['climate_control', 'climate', 'climate_on', 'preconditioning', 'hvac', 'onoff.climate', 'aircon'], /climat|precondition|hvac|aircon/i, 'boolean'],
    ['targetTemp', 'Klimaattemperatuur', ['target_temperature', 'climate_target_temperature', 'target_temperature.climate'], /target\w*temp/i, 'number'],
    ['defrost', 'Ontdooien', ['defrost', 'window_heating', 'defrost_max', 'onoff.defrost'], /defrost|window_heat/i, 'boolean'],
    ['engine', 'Rijdt / motor aan', ['engine', 'driving', 'ignition', 'engine_on'], /engine|driving|ignition/i, 'boolean'],
    ['odo', 'Kilometerstand', ['measure_odo', 'odometer', 'measure_odometer', 'measure_mileage', 'mileage'], /odo|mileage/i, 'number'],
    ['battery12v', '12V-accu', ['measure_battery.12V', 'measure_battery.12v', 'battery_12v', 'measure_battery_12v'], /12v/i, 'number'],
    ['chargeLimit', 'Laadlimiet', ['charge_target_slow', 'charge_limit', 'charge_limit_soc', 'target_soc', 'charge_target'], /charge\w*(limit|target)|target_soc/i],
    ['departure', 'Vertrektijd', ['departure_time', 'next_departure'], /departure/i],
    ['tire', 'Bandenspanning-alarm', ['alarm_tire_pressure', 'alarm_tyre_pressure', 'alarm_tires'], /tire|tyre/i, 'boolean'],
    ['location', 'Locatie (tekst)', ['location', 'address', 'measure_location', 'location_address'], /location|address/i, 'string'],
    ['lat', 'Breedtegraad', ['latitude', 'measure_latitude', 'location_latitude', 'lat'], /latitude|^lat$/i, 'number'],
    ['lon', 'Lengtegraad', ['longitude', 'measure_longitude', 'location_longitude', 'lon', 'lng'], /longitude|^lo?ng?$/i, 'number'],
    ['lastUpdate', 'Laatst bijgewerkt', ['last_refresh', 'last_update', 'last_updated', 'last_seen'], /last_(refresh|update|seen)/i],
    ['refresh', 'Knop vernieuwen', ['refresh_status', 'refresh', 'wake_up', 'button.refresh'], /refresh|wake/i],
    ['flash', 'Knop knipperen', ['flash_lights', 'flash', 'button.flash'], /flash(?!.*honk)/i],
    ['honk', 'Knop toeteren', ['flash_lights_and_honk', 'honk', 'horn', 'button.honk'], /honk|horn/i],
  ];
  const typeOk = (c, want) => !want || !c?.type || c.type === want;

  // Welke capability hoort bij welk onderdeel: eigen keuze, anders automatisch herkend
  function roleCaps(t) {
    const caps = capsOf(t), used = new Set(), out = {};
    for (const [role, , names, re, want] of ROLES) {
      const own = t.map?.[role];
      if (own === '-') { out[role] = null; continue; }
      if (own && own in caps) { out[role] = own; used.add(own); continue; }
      let hit = names.find(n => n in caps && !used.has(n) && typeOk(caps[n], want));
      if (!hit && re) hit = Object.keys(caps).find(k => re.test(k) && !used.has(k) && typeOk(caps[k], want));
      out[role] = hit || null;
      if (hit) used.add(hit);
    }
    return out;
  }

  function plugState(st, r) {
    const raw = r.chargingState ? st[r.chargingState] : undefined;
    const v = String(raw ?? '').toLowerCase();
    if ((r.charge && st[r.charge] === true) || raw === true || /charging|in_progress|laden|bezig|^on$/.test(v) && !/not|niet|stop|complete/.test(v)) return 'charging';
    if (/complete|finished|full|vol\b|done|klaar/.test(v)) return 'full';
    if (/plugged_in|connected|aangesloten|plugged$|ready|waiting|stopped|paused/.test(v) && !/out|disconnect|unplug|niet/.test(v)) return 'plugged';
    if (r.chargePower && num(st[r.chargePower]) > 50) return 'charging';
    return 'unplugged';
  }
  const PLUG = {
    charging: ['plug-zap', 'Laden', '#22d3ee'],
    full: ['battery-full', 'Vol', '#34d399'],
    plugged: ['plug', 'Aangesloten', '#a78bfa'],
    unplugged: ['unplug', 'Niet aangesloten', 'rgba(255,255,255,.45)'],
  };
  const socColor = p => p < 20 ? '#f87171' : p < 40 ? '#fbbf24' : '#34d399';

  function batteryBar(soc, charging, target) {
    const p = Math.max(0, Math.min(100, soc || 0));
    return `<div class="ev-batt${charging ? ' charging' : ''}" style="--soc:${p}%;--c:${socColor(p)}">
      <i></i>${target && target < 100 ? `<b class="ev-target" style="left:${target}%" title="Laadlimiet"></b>` : ''}</div>`;
  }

  TYPES.car = {
    name: 'Auto', icon: 'car-front', device: true,
    watches: (t, d) => d === t.deviceId,
    render(t) {
      const st = stateOf(t.deviceId), r = roleCaps(t);
      const val = role => r[role] ? st[r[role]] : undefined;
      const soc = num(val('soc'));
      const range = num(val('range'));
      const plug = plugState(st, r);
      const [pIc, pTxt, pCol] = PLUG[plug];
      const target = num(val('chargeLimit'));
      const lockKnown = !!r.locked;
      const locked = val('locked') !== false;
      const power = num(val('chargePower'));
      const big = (t.h || 1) >= 2;
      const pills = [
        (r.chargingState || r.charge || r.chargePower) ? `<span class="ev-pill" style="--c:${pCol}">${icon(pIc)}${pTxt}${plug === 'charging' && power > 50 ? ` · ${(power / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} kW` : ''}</span>` : '',
        val('climate') === true ? `<span class="ev-pill" style="--c:#60a5fa">${icon('fan')}${isFinite(num(val('targetTemp'))) ? `${num(val('targetTemp'))}°` : tr('Klimaat')}</span>` : '',
        val('defrost') === true ? `<span class="ev-pill" style="--c:#93c5fd">${icon('snowflake')}${tr('Ontdooien')}</span>` : '',
        val('engine') === true ? `<span class="ev-pill" style="--c:#fbbf24">${icon('gauge')}${tr('Rijdt')}</span>` : '',
        val('tire') === true ? `<span class="ev-pill" style="--c:#f87171">${icon('circle-alert')}${tr('Banden')}</span>` : '',
        isFinite(num(val('battery12v'))) && num(val('battery12v')) < 40 ? `<span class="ev-pill" style="--c:#f87171">${icon('battery-warning')}12V</span>` : '',
      ].filter(Boolean).join('');
      const where = val('location') || (isFinite(num(val('lat'))) ? `${num(val('lat')).toFixed(3)}, ${num(val('lon')).toFixed(3)}` : '');
      const upd = val('lastUpdate');
      return {
        cls: `car-tile${plug === 'charging' ? ' charging' : ''}`,
        style: { '--act': socColor(soc) },
        html: `<div class="top"><span class="t-icon${plug === 'charging' ? ' lit' : ''}" style="--act:#22d3ee">${icon(t.icon || 'car-front')}</span>
            ${lockKnown ? `<span class="ev-lock ${locked ? '' : 'open'}">${icon(locked ? 'lock' : 'lock-open')}${locked ? 'Op slot' : 'Open'}</span>` : ''}</div>
          <div class="ev-main">
            <div class="ev-nums"><div class="big">${isFinite(soc) ? Math.round(soc) : '–'}<small>%</small></div>
              ${isFinite(range) ? `<div class="ev-range">${icon('route')}${Math.round(range)} km</div>` : ''}</div>
            ${batteryBar(soc, plug === 'charging', target)}
            ${big && pills ? `<div class="ev-pills">${pills}</div>` : ''}
            <div class="label">${esc(t.label)}</div>
            ${big && (where || upd) ? `<div class="sub" data-noi18n>${where ? `${icon('map-pin')} ${esc(where)}` : ''}${where && upd ? ' · ' : ''}${upd ? esc(typeof upd === 'number' ? new Date(upd).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : upd) : ''}</div>` : ''}
          </div>`,
      };
    },
    tap: t => openPopup(t, carPopup, root => bindCar(t, root)),

    // Instellingen: per onderdeel kiezen welke waarde van de auto erbij hoort
    settings(t) {
      if (!t.deviceId) return '';
      const caps = capsOf(t), auto = roleCaps({ ...t, map: {} }), cur = roleCaps(t);
      const rows = ROLES.map(([role, label]) => {
        const own = t.map?.[role] || '';
        const opts = Object.entries(caps).map(([id, c]) => `<option value="${esc(id)}" ${own === id ? 'selected' : ''}>${esc(c.title || id)} (${esc(id)})</option>`).join('');
        return `<div class="car-map-row"><span>${tr(label)}</span>
          <select name="car_${role}"><option value="" ${!own ? 'selected' : ''}>${tr('Automatisch')}: ${auto[role] ? esc(caps[auto[role]]?.title || auto[role]) : tr('niet gevonden')}</option>
            <option value="-" ${own === '-' ? 'selected' : ''}>${tr('Niet tonen')}</option>${opts}</select>
          ${cur[role] ? '<i class="ok"></i>' : '<i></i>'}</div>`;
      }).join('');
      return `<div class="field"><span class="flabel">${tr('Onderdelen van de auto')}</span>
        <span class="hint">${tr('Het dashboard herkent de meeste auto-apps zelf. Klopt iets niet of ontbreekt er iets, kies dan hier welke waarde van je auto erbij hoort.')}</span>
        <div class="car-map">${rows}</div></div>`;
    },
    onInput(t, e, n, rerender) {
      if (!n.startsWith('car_')) return false;
      t.map = { ...(t.map || {}), [n.slice(4)]: e.target.value };
      if (!e.target.value) delete t.map[n.slice(4)];
      rerender(); openTileSettings(t);
      return true;
    },
  };

  function carPopup(t) {
    const st = stateOf(t.deviceId), r = roleCaps(t);
    const val = role => r[role] ? st[r[role]] : undefined;
    const soc = num(val('soc')), range = num(val('range'));
    const plug = plugState(st, r), [pIc, pTxt, pCol] = PLUG[plug];
    const locked = val('locked') !== false;
    const btn = (role, ic, label, on) => canSet(t, r[role])
      ? `<button class="rbtn${on ? ' on' : ''}" data-role="${role}">${icon(ic)}<span>${label}</span></button>` : '';
    const lat = num(val('lat')), lon = num(val('lon'));
    const map = isFinite(lat) && isFinite(lon)
      ? `<iframe class="ev-map" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.006},${lat - 0.003},${lon + 0.006},${lat + 0.003}&layer=mapnik&marker=${lat},${lon}"></iframe>` : '';
    const limit = val('chargeLimit');
    const upd = val('lastUpdate');
    const info = [
      ['route', 'Bereik', r.range, isFinite(range) ? `${Math.round(range)} km` : '–'],
      [pIc, 'Laadstatus', r.chargingState || r.charge, pTxt],
      ['zap', 'Laadvermogen', r.chargePower, isFinite(num(val('chargePower'))) ? `${(num(val('chargePower')) / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} kW` : '–'],
      ['battery', 'Laadlimiet', r.chargeLimit, limit != null && limit !== '' ? `${limit}%` : '–'],
      ['battery-warning', '12V-accu', r.battery12v, isFinite(num(val('battery12v'))) ? `${Math.round(num(val('battery12v')))}%` : '–'],
      ['gauge', 'Kilometerstand', r.odo, isFinite(num(val('odo'))) ? `${Math.round(num(val('odo'))).toLocaleString(LOCALE)} km` : '–'],
      ['calendar-clock', 'Vertrek', r.departure, val('departure') || '–'],
      ['circle-alert', 'Bandenspanning', r.tire, val('tire') ? 'Te laag' : 'OK'],
      ['map-pin', 'Locatie', r.location, val('location') || '–'],
    ].filter(x => x[2]).map(([ic, l, , v]) => `<div class="ev-info">${icon(ic)}<span>${l}</span><b${ic === 'map-pin' || ic === 'calendar-clock' ? ' data-noi18n' : ''}>${esc(v)}</b></div>`).join('');
    return `<div class="ev-pop-head"><div><h3>${esc(t.label)}</h3><div class="sub">${upd ? `Bijgewerkt ${esc(typeof upd === 'number' ? new Date(upd).toLocaleString(LOCALE) : upd)}` : ''}</div></div>
        ${btn('refresh', 'refresh-cw', 'Vernieuwen', false).replace('rbtn', 'btn')}</div>
      <div class="ev-pop-soc"><div class="big">${isFinite(soc) ? Math.round(soc) : '–'}<small>%</small></div>
        ${(r.chargingState || r.charge) ? `<span class="ev-pill" style="--c:${pCol}">${icon(pIc)}${pTxt}</span>` : ''}</div>
      ${batteryBar(soc, plug === 'charging', num(limit))}
      <div class="rgrid">
        ${btn('locked', locked ? 'lock-open' : 'lock', locked ? 'Ontgrendelen' : 'Vergrendelen', !locked)}
        ${btn('climate', 'fan', val('climate') ? 'Klimaat uit' : 'Klimaat aan', val('climate') === true)}
        ${btn('defrost', 'snowflake', val('defrost') ? 'Ontdooien uit' : 'Ontdooien', val('defrost') === true)}
        ${plug !== 'unplugged' ? btn('charge', plug === 'charging' ? 'battery' : 'plug-zap', plug === 'charging' ? 'Laden stoppen' : 'Laden starten', plug === 'charging') : ''}
        ${btn('flash', 'lightbulb', 'Knipperen', false)}
        ${btn('honk', 'megaphone', 'Knipperen + toeteren', false)}
      </div>
      ${canSet(t, r.targetTemp) ? slider(r.targetTemp, 'Temperatuur klimaat', num(val('targetTemp')) || 21,
        { min: capsOf(t)[r.targetTemp]?.min ?? 16, max: capsOf(t)[r.targetTemp]?.max ?? 28, step: capsOf(t)[r.targetTemp]?.step ?? 0.5, fmt: v => `${v}°` }) : ''}
      ${info ? `<div class="ev-infos">${info}</div>` : ''}
      ${map}
      <div class="actions"><button class="btn" data-close>Sluiten</button></div>`;
  }

  function bindCar(t, root) {
    root.classList.add('wide');
    const r = roleCaps(t);
    root.querySelectorAll('[data-role]').forEach(b => b.onclick = () => {
      const role = b.dataset.role, cap = r[role], st = stateOf(t.deviceId);
      if (!cap) return;
      const toggles = ['locked', 'climate', 'defrost', 'charge'];
      const value = role === 'locked' ? !(st[cap] !== false) : toggles.includes(role) ? !st[cap] : true;
      const run = () => {
        setCap(t.deviceId, cap, value);
        toast(tr('Opdracht verstuurd naar de auto. Het kan even duren voordat de status bijwerkt.'));
        setTimeout(() => { if (S.popupTile === t) openPopup(t, carPopup, x => bindCar(t, x)); }, 600);
      };
      // Ontgrendelen altijd eerst bevestigen
      if (role === 'locked' && value === false) {
        if (confirm(tr(`${t.label} ontgrendelen?`))) run();
      } else run();
    });
  }

  // Engelse teksten
  if (typeof I18N !== 'undefined' && I18N.add) {
    I18N.add({
      'Auto': 'Car', 'Op slot': 'Locked', 'Niet aangesloten': 'Not plugged in', 'Aangesloten': 'Plugged in', 'Vol': 'Full',
      'Klimaat': 'Climate', 'Ontdooien': 'Defrost', 'Rijdt': 'Driving', 'Banden': 'Tyres', 'Laadlimiet': 'Charge limit',
      'Bereik': 'Range', 'Laadstatus': 'Charging status', '12V-accu': '12V battery', 'Kilometerstand': 'Odometer', 'Vertrek': 'Departure',
      'Bandenspanning': 'Tyre pressure', 'Te laag': 'Too low', 'Locatie': 'Location', 'Vernieuwen': 'Refresh', 'Ontgrendelen': 'Unlock',
      'Vergrendelen': 'Lock', 'Klimaat aan': 'Climate on', 'Klimaat uit': 'Climate off', 'Ontdooien uit': 'Defrost off',
      'Laden starten': 'Start charging', 'Laden stoppen': 'Stop charging', 'Knipperen': 'Flash lights', 'Knipperen + toeteren': 'Flash + horn',
      'Temperatuur klimaat': 'Climate temperature', 'Laadvermogen': 'Charging power',
      'Onderdelen van de auto': 'Car features', 'Niet tonen': "Don't show", 'niet gevonden': 'not found',
      'Het dashboard herkent de meeste auto-apps zelf. Klopt iets niet of ontbreekt er iets, kies dan hier welke waarde van je auto erbij hoort.': 'The dashboard recognises most car apps by itself. If something is wrong or missing, choose here which value of your car belongs to it.',
      'Laadniveau (%)': 'Charge level (%)', 'Bereik (km)': 'Range (km)', 'Laden starten/stoppen': 'Start/stop charging', 'Slot': 'Lock',
      'Klimaat aan/uit': 'Climate on/off', 'Klimaattemperatuur': 'Climate temperature', 'Rijdt / motor aan': 'Driving / engine on',
      'Vertrektijd': 'Departure time', 'Bandenspanning-alarm': 'Tyre pressure alarm', 'Locatie (tekst)': 'Location (text)',
      'Breedtegraad': 'Latitude', 'Lengtegraad': 'Longitude', 'Laatst bijgewerkt': 'Last updated', 'Knop vernieuwen': 'Refresh button',
      'Knop knipperen': 'Flash lights button', 'Knop toeteren': 'Horn button',
      'Opdracht verstuurd naar de auto. Het kan even duren voordat de status bijwerkt.': 'Command sent to the car. It may take a moment for the status to update.',
    }, [
      [/^Bijgewerkt (.+)$/, (m, a) => `Updated ${a}`],
      [/^(.+) ontgrendelen\?$/, (m, a) => `Unlock ${a}?`],
      [/^(.+) is begonnen met laden$/, (m, a) => `${a} started charging`],
      [/^(.+) is gestopt met laden \((\d+)%\)$/, (m, a, b) => `${a} stopped charging (${b}%)`],
      [/^(.+) is ontgrendeld$/, (m, a) => `${a} was unlocked`],
      [/^Bandenspanning (.+) te laag$/, (m, a) => `Low tyre pressure on ${a}`],
      [/^(\d+) km$/, (m, a) => `${a} km`],
    ]);
  }
})();
