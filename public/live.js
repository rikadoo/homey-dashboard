'use strict';
/* Live camerabeeld via go2rtc. Losse uitbreiding: laden na app.js en extras.js.
   - Per camera-tegel een streamnaam (zoals in go2rtc.yaml).
   - Tik op de camera: groot live beeld. Optioneel ook live in de tegel zelf.
   - De deurbel-pop-up toont live beeld als de deurbelcamera een stream heeft. */
(function () {
  if (typeof TYPES === 'undefined' || !TYPES.camera) return;

  const liveBase = () => (S.layout?.settings?.liveBase || `${location.protocol}//${location.hostname}:1984`).replace(/\/$/, '');
  const liveSrc = stream => `${liveBase()}/stream.html?src=${encodeURIComponent(stream)}&mode=mse,hls,mjpeg`;
  const streamFor = deviceId => {
    for (const p of S.layout?.pages || []) for (const t of p.tiles) if (t.type === 'camera' && t.deviceId === deviceId && t.stream) return t.stream;
    return null;
  };

  const cam = TYPES.camera;
  const origRender = cam.render, origTap = cam.tap, origSettings = cam.settings, origInput = cam.onInput;

  // Tegel: live beeld in plaats van momentopname (alleen als aangevinkt)
  cam.render = t => {
    if (!(t.stream && t.liveInTile) || S.editing) return origRender(t);
    const motion = stateOf(t.deviceId).alarm_motion === true;
    return {
      cls: 'camera-tile live',
      html: `<iframe class="cam-live" src="${liveSrc(t.stream)}" allow="autoplay; fullscreen" loading="lazy"></iframe>
        <div class="cam-bar"><span class="t-icon">${icon(t.icon || 'cctv')}</span><span class="label">${esc(t.label)}</span>
        <span class="cam-motion"${motion ? '' : ' hidden'}>Beweging</span><span class="cam-livebadge">LIVE</span></div>
        <div class="cam-tap"></div>`,
    };
  };

  // Niet bij elke bewegingsmelding het live beeld opnieuw starten: alleen het label bijwerken
  const origFill = window.fillTile;
  window.fillTile = function (el, t) {
    if (t.type === 'camera' && t.stream && t.liveInTile && !S.editing && el.querySelector('iframe.cam-live')) {
      el.querySelector('.cam-motion')?.toggleAttribute('hidden', stateOf(t.deviceId).alarm_motion !== true);
      return;
    }
    return origFill(el, t);
  };

  // Tikken: groot live beeld
  const livePopup = t => `<div class="cam-pop live"><iframe src="${liveSrc(t.stream)}" allow="autoplay; fullscreen"></iframe></div>
    <div class="cam-pop-bar"><h3>${esc(t.label)} <span class="cam-livebadge">LIVE</span></h3><button class="btn" data-close>Sluiten</button></div>`;
  cam.tap = t => t.stream ? openPopup(t, livePopup, root => root.classList.add('wide')) : origTap(t);

  // Pop-up sluiten: stream echt stoppen
  const origClose = window.closePopup;
  window.closePopup = function () {
    const live = document.querySelector('#popup iframe');
    origClose();
    if (live) document.querySelector('#popup').innerHTML = '';
  };

  // Deurbel: live beeld als die camera een stream heeft
  if (typeof window.showDoorbell === 'function') {
    const origShow = window.showDoorbell, origHide = window.hideDoorbell;
    window.showDoorbell = function (deviceId) {
      origShow(deviceId);
      const camId = deviceId || S.layout?.settings?.doorbell?.deviceId;
      const stream = S.layout?.settings?.doorbell?.stream || streamFor(camId);
      const img = document.getElementById('bellImg');
      if (stream && img) {
        const f = document.createElement('iframe');
        f.className = 'bell-live'; f.src = liveSrc(stream); f.allow = 'autoplay; fullscreen';
        img.replaceWith(f);
      }
    };
    if (typeof origHide === 'function') {
      window.hideDoorbell = function () { origHide(); const el = document.getElementById('doorbell'); if (el?.querySelector('iframe')) el.innerHTML = ''; };
      document.addEventListener('click', e => { if (e.target.id === 'bellClose') window.hideDoorbell(); }, true);
    }
  }

  // Instellingen per camera-tegel
  cam.settings = t => (origSettings ? origSettings(t) : '') + `
    <div class="field"><label>Live-stream (naam in go2rtc)</label>
      <input type="text" name="lv_stream" value="${esc(t.stream || '')}" placeholder="bijvoorbeeld deurbel">
      <label class="check"><input type="checkbox" name="lv_tile" ${t.liveInTile ? 'checked' : ''}> Ook live in de tegel (kost meer van de tablet)</label>
      <span class="hint">Leeg laten: alleen momentopnames. Ingevuld: tikken opent live beeld.</span></div>`;
  cam.onInput = (t, e, n, rerender) => {
    if (n === 'lv_stream') { t.stream = e.target.value.trim(); rerender(); return true; }
    if (n === 'lv_tile') { t.liveInTile = e.target.checked; rerender(); return true; }
    return origInput ? origInput(t, e, n, rerender) : false;
  };

  // Algemene instelling: adres van go2rtc
  if (typeof EXTRA !== 'undefined') {
    const og = EXTRA.globalSettingsHtml, oi = EXTRA.onGlobalInput;
    EXTRA.globalSettingsHtml = s => (og ? og(s) : '') + `<div class="field"><label>Adres van go2rtc (live camerabeeld)</label>
      <input type="text" name="lv_base" value="${esc(s.liveBase || '')}" placeholder="${location.protocol}//${location.hostname}:1984">
      <span class="hint">Leeg laten is goed als je het dashboard via het IP-adres van de server opent. Via https (Traefik)? Vul dan het https-adres van go2rtc in.</span></div>`;
    EXTRA.onGlobalInput = (e, n, s) => {
      if (n === 'lv_base') { s.liveBase = e.target.value.trim(); return true; }
      return oi ? oi(e, n, s) : false;
    };
  }
})();
