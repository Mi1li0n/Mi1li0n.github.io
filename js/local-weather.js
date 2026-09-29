/* Visitor weather: ipapi location + Open-Meteo. No API keys or server required. */
(() => {
  'use strict';
  const card = document.getElementById('local-weather-card');
  if (!card) return;
  const byId = name => document.getElementById(`local-weather-${name}`);
  const locationKey = 'blog-weather-location-v1';
  const cacheKey = 'blog-weather-cache-v1';
  const halfHour = 30 * 60 * 1000;
  const oneHour = 60 * 60 * 1000;
  const sixHours = 6 * 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function recent(time, age) {
    return Number.isFinite(time) && time <= Date.now() + 60000 && Date.now() - time < age;
  }
  function validLocation(value) {
    return value && typeof value.city === 'string' && value.city.trim().length > 0 && value.city.length <= 120 &&
      Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
      Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180 &&
      (value.source === 'ip' || value.source === 'manual');
  }
  function sameLocation(a, b) {
    return a && b && a.latitude === b.latitude && a.longitude === b.longitude && a.city === b.city;
  }
  // WMO codes; snow and fog retain their real labels while using the cloudy artwork.
  function conditions(code, day) {
    if (code === 0) return { text: '晴', icon: day ? '☀' : '☾', scene: day ? 'sunny' : 'night' };
    if (code === 1) return { text: '晴间多云', icon: day ? '🌤' : '☾', scene: day ? 'sunny' : 'night' };
    if (code === 2 || code === 3) return { text: code === 2 ? '多云' : '阴', icon: '☁', scene: 'cloudy' };
    if ([45, 48].includes(code)) return { text: '雾', icon: '🌫', scene: 'cloudy' };
    if ([51, 53, 55].includes(code)) return { text: '毛毛雨', icon: '🌧', scene: 'rain' };
    if ([56, 57, 66, 67].includes(code)) return { text: '冻雨', icon: '🌧', scene: 'rain' };
    if ([61, 63, 65].includes(code)) return { text: { 61: '小雨', 63: '中雨', 65: '大雨' }[code], icon: '🌧', scene: 'rain' };
    if ([80, 81, 82].includes(code)) return { text: '阵雨', icon: '🌦', scene: 'rain' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { text: '雪', icon: '❄', scene: 'cloudy' };
    if ([95, 96, 99].includes(code)) return { text: code === 95 ? '雷雨' : '雷雨伴冰雹', icon: '⛈', scene: 'storm' };
    return null;
  }
  function validWeather(data) {
    return data && Number.isFinite(data.temperature_2m) && data.temperature_2m >= -100 && data.temperature_2m <= 70 &&
      (data.is_day === 0 || data.is_day === 1) && recent(data.time * 1000, oneDay) && conditions(data.weather_code, data.is_day);
  }
  function validCache(value) {
    return value && validLocation(value.location) && validWeather(value.data) && recent(value.fetchedAt, oneDay);
  }
  function freshCache(value) {
    return validCache(value) && recent(value.fetchedAt, halfHour) && recent(value.data.time * 1000, oneHour);
  }
  async function fetchJSON(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('Service unavailable');
      const value = await response.json();
      if (!value || value.error) throw new Error('Invalid response');
      return value;
    } finally { clearTimeout(timeout); }
  }

  let location = read(locationKey);
  if (!validLocation(location)) location = null;
  let cached = read(cacheKey);
  if (!validCache(cached)) cached = null;
  let requestNumber = 0;
  let searchNumber = 0;
  let busy = false;
  let lastAttempt = 0;

  function publish(scene) {
    document.dispatchEvent(new CustomEvent('blog:local-weather', { detail: { scene } }));
  }
  function showLocation(value) {
    byId('city').textContent = value ? value.city : '尚未确定城市';
    byId('location-label').textContent = value ? '详情与设置' : '选择城市';
    const manual = value?.source === 'manual';
    byId('provider').textContent = manual ? 'GeoNames' : 'ipapi';
    byId('provider').href = manual ? 'https://www.geonames.org/' : 'https://ipapi.co/';
  }
  function clearConditions() {
    byId('reading').hidden = true;
    byId('description').hidden = true;
    byId('temperature').textContent = '—';
    byId('description').textContent = '等待天气';
    byId('icon').textContent = '☁';
    byId('detail').textContent = '';
    publish(null);
  }
  function render(snapshot, stale = false) {
    const data = snapshot.data;
    const weather = conditions(data.weather_code, data.is_day);
    showLocation(snapshot.location);
    byId('reading').hidden = false;
    byId('description').hidden = false;
    byId('temperature').textContent = `${Math.round(data.temperature_2m)}°`;
    byId('description').textContent = weather.text;
    byId('icon').textContent = weather.icon;
    const details = [];
    if (Number.isFinite(data.apparent_temperature)) details.push(`体感 ${Math.round(data.apparent_temperature)}°`);
    if (Number.isFinite(data.relative_humidity_2m)) details.push(`湿度 ${Math.round(data.relative_humidity_2m)}%`);
    byId('detail').textContent = details.join(' · ');
    const date = new Date(data.time * 1000);
    let time;
    try {
      time = new Intl.DateTimeFormat('zh-CN', { timeZone: snapshot.timezone || 'UTC', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
    } catch (_) { time = date.toISOString().slice(5, 16).replace('T', ' ') + ' UTC'; }
    byId('status').textContent = `${stale ? '缓存' : '当地时间'} ${time}`;
    if (!stale) publish(weather.scene);
  }
  function showCached() {
    if (!cached || !validCache(cached) || !sameLocation(cached.location, location)) return false;
    // Display using the current location source, even if coordinates did not change.
    render({ ...cached, location }, !freshCache(cached));
    return true;
  }
  async function load({ force = false, useIP = false } = {}) {
    if (busy && !useIP && !force) return;
    const request = ++requestNumber;
    busy = true;
    lastAttempt = Date.now();
    byId('refresh').disabled = true;
    card.setAttribute('aria-busy', 'true');
    if (!showCached()) { clearConditions(); showLocation(location); }
    byId('status').textContent = useIP || !location ? '正在定位城市…' : '正在更新天气…';
    try {
      let nextLocation = location;
      if (useIP || !nextLocation || (nextLocation.source === 'ip' && !recent(nextLocation.savedAt, sixHours))) {
        const result = await fetchJSON('https://ipapi.co/json/');
        nextLocation = { city: result.city, latitude: result.latitude, longitude: result.longitude, source: 'ip', savedAt: Date.now() };
        if (!validLocation(nextLocation)) throw new Error('Invalid location');
      }
      if (request !== requestNumber) return;
      if (!sameLocation(location, nextLocation)) clearConditions();
      location = nextLocation;
      write(locationKey, location); // Only city/coordinates/source; never persist the visitor IP.
      showLocation(location);
      if (!force && freshCache(cached) && sameLocation(cached.location, location)) {
        render({ ...cached, location });
        return;
      }
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({ latitude: location.latitude, longitude: location.longitude,
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day', timezone: 'auto', timeformat: 'unixtime', forecast_days: '1' });
      const result = await fetchJSON(url);
      if (request !== requestNumber) return;
      if (!validWeather(result.current) || !recent(result.current.time * 1000, oneHour)) throw new Error('Invalid or outdated weather');
      cached = { location: { ...location }, data: result.current, timezone: result.timezone, fetchedAt: Date.now() };
      write(cacheKey, cached);
      render(cached);
    } catch (_) {
      if (request !== requestNumber) return;
      const hasCache = showCached();
      if (hasCache) byId('status').textContent = '暂时无法更新 · ' + byId('status').textContent.replace('当地时间', '缓存');
      else {
        clearConditions();
        byId('description').textContent = '天气暂不可用';
        byId('status').textContent = '暂时无法获取，可稍后刷新或切换城市。';
      }
    } finally {
      if (request === requestNumber) {
        busy = false;
        byId('refresh').disabled = false;
        card.setAttribute('aria-busy', 'false');
      }
    }
  }

  byId('refresh').addEventListener('click', () => load({ force: true }));
  byId('ip').addEventListener('click', () => {
    ++searchNumber;
    byId('results').replaceChildren();
    byId('search-status').textContent = '';
    load({ useIP: true, force: true });
  });
  byId('query').addEventListener('input', () => {
    ++searchNumber;
    byId('results').replaceChildren();
    byId('search-status').textContent = '';
  });
  byId('search').addEventListener('submit', async event => {
    event.preventDefault();
    const query = byId('query').value.trim();
    if (query.length < 2) return;
    const search = ++searchNumber;
    byId('results').replaceChildren();
    byId('search-status').textContent = '正在查找城市…';
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({ name: query, count: '5', language: 'zh', format: 'json' });
    try {
      const result = await fetchJSON(url);
      if (search !== searchNumber) return;
      const cities = (Array.isArray(result.results) ? result.results : []).slice(0, 5).filter(city =>
        validLocation({ city: city.name, latitude: city.latitude, longitude: city.longitude, source: 'manual' }));
      byId('search-status').textContent = cities.length ? '请选择城市' : '未找到城市，试试拼音或英文名称。';
      for (const city of cities) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = [...new Set([city.name, city.admin1, city.country].filter(Boolean))].join(' · ');
        button.addEventListener('click', () => {
          ++searchNumber;
          location = { city: city.name, latitude: city.latitude, longitude: city.longitude, source: 'manual', savedAt: Date.now() };
          write(locationKey, location);
          byId('location').open = false;
          byId('results').replaceChildren();
          byId('search-status').textContent = '';
          // Incrementing the load generation discards an earlier city's in-flight response.
          load({ force: true });
        });
        item.append(button);
        byId('results').append(item);
      }
    } catch (_) {
      if (search === searchNumber) byId('search-status').textContent = '暂时无法搜索，请稍后再试。';
    }
  });

  function refreshIfNeeded() {
    if (document.hidden || busy || Date.now() - lastAttempt < 5 * 60 * 1000) return;
    if (!freshCache(cached) || !sameLocation(cached.location, location)) load();
  }
  document.addEventListener('visibilitychange', refreshIfNeeded);
  window.addEventListener('pageshow', event => { if (event.persisted) refreshIfNeeded(); });
  // Check cheaply once a minute; request only after TTL expiry, including a slow first response.
  setInterval(refreshIfNeeded, 60 * 1000);
  load();
})();
