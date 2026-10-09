/* Visitor weather: IPWHOIS / IP.SB + Open-Meteo, with bundled city search. */
(() => {
  'use strict';
  const card = document.getElementById('local-weather-card');
  if (!card) return;
  const byId = name => document.getElementById(`local-weather-${name}`);
  const locationKey = 'blog-weather-location-v1';
  const cacheKey = 'blog-weather-cache-v1';
  const oneHour = 60 * 60 * 1000;
  const sixHours = 6 * 60 * 60 * 1000;
  const state = window.BlogWeatherState;
  if (!state) return;
  const { recent, validLocation, sameLocation, conditions, validWeather, validCache, freshCache, periodAt } = state;
  const ipProviders = [
    { id: 'ipwhois', name: 'IPWHOIS', href: 'https://ipwhois.io/', url: 'https://ipwho.is/?lang=zh-CN&fields=success,message,city,latitude,longitude' },
    { id: 'ipsb', name: 'IP.SB', href: 'https://ip.sb/', url: 'https://api.ip.sb/geoip' }
  ];
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  async function fetchJSON(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('Service unavailable');
      const value = await response.json();
      if (!value || value.error || value.success === false) throw new Error('Invalid response');
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

  async function locate(request) {
    for (const provider of ipProviders) {
      if (request !== requestNumber) return null;
      try {
        const result = await fetchJSON(provider.url);
        const value = { city: result.city, latitude: result.latitude, longitude: result.longitude,
          source: 'ip', provider: provider.id, savedAt: Date.now() };
        if (validLocation(value)) return value;
      } catch (_) { /* A failed provider must not block the next one or manual selection. */ }
    }
    throw new Error('Location unavailable');
  }

  function publish(value) {
    document.dispatchEvent(new CustomEvent('blog:local-weather', { detail: value || { scene: null, period: null } }));
  }
  function showLocation(value) {
    byId('city').textContent = value ? value.city : '尚未确定城市';
    byId('location-label').textContent = value ? '详情与设置' : '选择城市';
    const provider = value?.source === 'manual'
      ? { name: 'GeoNames', href: 'https://www.geonames.org/' }
      : ipProviders.find(provider => provider.id === value?.provider) || (value
        ? { name: 'ipapi', href: 'https://ipapi.co/' } : ipProviders[0]);
    byId('provider').textContent = provider.name;
    byId('provider').href = provider.href;
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
    const weather = conditions(data.weather_code, stale ? data.is_day : periodAt(snapshot) === 'day');
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
    publish(stale ? null : state.background(snapshot, location));
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
    let usingSavedLocation = false;
    try {
      let nextLocation = location;
      if (useIP || !nextLocation || (nextLocation.source === 'ip' && !recent(nextLocation.savedAt, sixHours))) {
        try { nextLocation = await locate(request); }
        catch (error) {
          // Keep a known city usable when refreshing its IP lookup fails.
          if (!nextLocation) throw error;
          usingSavedLocation = true;
        }
      }
      if (request !== requestNumber) return;
      if (!sameLocation(location, nextLocation)) clearConditions();
      location = nextLocation;
      write(locationKey, location); // Only city/coordinates/source; never persist the visitor IP.
      showLocation(location);
      if (!force && freshCache(cached) && sameLocation(cached.location, location)) {
        render({ ...cached, location });
        if (usingSavedLocation) byId('status').textContent = '定位暂不可用，沿用上次城市 · ' + byId('status').textContent;
        return;
      }
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({ latitude: location.latitude, longitude: location.longitude,
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day', daily: 'sunrise,sunset', timezone: 'auto', timeformat: 'unixtime', forecast_days: '2' });
      const result = await fetchJSON(url);
      if (request !== requestNumber) return;
      if (!validWeather(result.current) || !recent(result.current.time * 1000, oneHour)) throw new Error('Invalid or outdated weather');
      cached = { location: { ...location }, data: result.current, daily: result.daily, timezone: result.timezone, fetchedAt: Date.now() };
      write(cacheKey, cached);
      render(cached);
      if (usingSavedLocation) byId('status').textContent = '定位暂不可用，沿用上次城市 · ' + byId('status').textContent;
    } catch (_) {
      if (request !== requestNumber) return;
      const hasCache = showCached();
      if (hasCache) byId('status').textContent = '暂时无法更新 · ' + byId('status').textContent.replace('当地时间', '缓存');
      else {
        clearConditions();
        byId('description').textContent = '天气暂不可用';
        byId('status').textContent = location
          ? '天气暂时无法获取，请稍后刷新。'
          : '暂时无法定位，请在“选择城市”中手动搜索。';
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
  function searchText(value) {
    return value.normalize('NFKD').replace(/[\u0300-\u036f\s'’_-]/g, '').toLowerCase().replace(/市$/, '');
  }
  function localCities(query) {
    const term = searchText(query);
    if (!term) return [];
    return (window.BlogWeatherCities || []).map(city => {
      const names = [city.name, ...city.aliases].map(searchText);
      const rank = names.includes(term) ? 0 : names.some(name => name.startsWith(term)) ? 1 : names.some(name => name.includes(term)) ? 2 : 3;
      return { city, rank };
    }).filter(item => item.rank < 3).sort((a, b) => a.rank - b.rank).slice(0, 5).map(item => item.city);
  }
  function showCities(cities) {
    byId('search-status').textContent = cities.length ? '请选择城市' : '未找到城市，试试拼音或附近城市。';
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
        // Starting a new load discards any earlier city's in-flight response.
        load({ force: true });
      });
      item.append(button);
      byId('results').append(item);
    }
  }
  byId('search').addEventListener('submit', async event => {
    event.preventDefault();
    const query = byId('query').value.trim();
    if (query.length < 2) return;
    const search = ++searchNumber;
    byId('results').replaceChildren();
    const matches = localCities(query);
    if (matches.length) { showCities(matches); return; }
    byId('search-status').textContent = '正在查找城市…';
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({ name: query, count: '5', language: 'zh', format: 'json' });
    try {
      const result = await fetchJSON(url);
      if (search !== searchNumber) return;
      const cities = (Array.isArray(result.results) ? result.results : []).slice(0, 5).filter(city =>
        validLocation({ city: city.name, latitude: city.latitude, longitude: city.longitude, source: 'manual' }));
      showCities(cities);
    } catch (_) {
      if (search === searchNumber) byId('search-status').textContent = '未找到内置城市，在线搜索暂不可用。请试试附近城市。';
    }
  });

  function refreshIfNeeded() {
    if (document.hidden) return;
    // Recompute daylight locally even during the request cooldown or a slow refresh.
    const local = state.background(cached, location);
    publish(local);
    if (local) byId('icon').textContent = conditions(cached.data.weather_code, local.period === 'day').icon;
    if (busy || Date.now() - lastAttempt < 5 * 60 * 1000) return;
    if (!local || (location.source === 'ip' && !recent(location.savedAt, sixHours))) load();
  }
  document.addEventListener('visibilitychange', refreshIfNeeded);
  window.addEventListener('pageshow', event => { if (event.persisted) refreshIfNeeded(); });
  window.addEventListener('online', refreshIfNeeded);
  // Check cheaply once a minute; request only after TTL expiry, including a slow first response.
  setInterval(refreshIfNeeded, 60 * 1000);
  load();
})();
