'use strict';

// Weer via Open-Meteo (gratis, geen API-sleutel). Resultaat 15 minuten in de cache.
let cache = { key: null, at: 0, data: null };
const geoCache = {};

async function geocode(place) {
  if (geoCache[place]) return geoCache[place];
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=nl&name=${encodeURIComponent(place)}`);
  const j = await r.json();
  const hit = j.results?.[0];
  if (!hit) throw new Error(`Plaats "${place}" niet gevonden`);
  return (geoCache[place] = { lat: hit.latitude, lon: hit.longitude, name: hit.name });
}

function demo(place) {
  const today = new Date();
  return {
    place: place || 'Demo', current: { temp: 14.2, humidity: 78, code: 2, isDay: true, wind: 18 },
    daily: [0, 1, 2, 3, 4].map(i => ({ date: new Date(today.getTime() + i * 864e5).toISOString().slice(0, 10), code: [2, 61, 3, 1, 80][i], max: [16, 13, 14, 17, 15][i], min: [9, 8, 7, 10, 9][i] })),
  };
}

async function getWeather(place, mock) {
  if (!place) return null;
  if (cache.key === place && Date.now() - cache.at < 15 * 60 * 1000) return cache.data;
  try {
    const g = await geocode(place);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lon}`
      + '&current=temperature_2m,relative_humidity_2m,weather_code,is_day,wind_speed_10m'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5';
    const j = await (await fetch(url)).json();
    const data = {
      place: g.name,
      current: { temp: j.current.temperature_2m, humidity: j.current.relative_humidity_2m, code: j.current.weather_code, isDay: !!j.current.is_day, wind: j.current.wind_speed_10m },
      daily: j.daily.time.map((d, i) => ({ date: d, code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i] })),
    };
    cache = { key: place, at: Date.now(), data };
    return data;
  } catch (e) {
    if (mock) return demo(place);
    throw e;
  }
}

module.exports = { getWeather };
