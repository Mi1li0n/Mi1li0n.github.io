/* Shared by the pre-paint initializer and live weather updates. */
(() => {
  'use strict';
  const scenes = ['rain', 'storm', 'sunny', 'cloudy', 'night', 'overcast', 'snow', 'fog', 'hail'];
  const labels = ['雨', '雷雨', '晴天', '多云', '夜晚', '阴天', '雪', '雾', '冰雹'];
  const halfHour = 30 * 60 * 1000;
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

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
  // Open-Meteo WMO codes: https://open-meteo.com/en/docs
  function conditions(code, day) {
    if (code === 0 || code === 1) return { text: code === 0 ? '晴' : '晴间多云', icon: day ? '☀' : '☾', scene: day ? 'sunny' : 'night' };
    if (code === 2 || code === 3) return { text: code === 2 ? '多云' : '阴', icon: '☁', scene: code === 2 ? 'cloudy' : 'overcast' };
    if ([45, 48].includes(code)) return { text: code === 45 ? '雾' : '雾凇', icon: '🌫', scene: 'fog' };
    if ([51, 53, 55].includes(code)) return { text: '毛毛雨', icon: '🌧', scene: 'rain' };
    if ([56, 57].includes(code)) return { text: '冻毛毛雨', icon: '🌧', scene: 'rain' };
    if ([66, 67].includes(code)) return { text: '冻雨', icon: '🌧', scene: 'rain' };
    if ([61, 63, 65].includes(code)) return { text: { 61: '小雨', 63: '中雨', 65: '大雨' }[code], icon: '🌧', scene: 'rain' };
    if ([80, 81, 82].includes(code)) return { text: code === 82 ? '强阵雨' : '阵雨', icon: '🌦', scene: 'rain' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { text: { 71: '小雪', 73: '中雪', 75: '大雪', 77: '米雪', 85: '阵雪', 86: '强阵雪' }[code], icon: '❄', scene: 'snow' };
    if ([95, 97].includes(code)) return { text: code === 97 ? '强雷雨' : '雷雨', icon: '⛈', scene: 'storm' };
    if ([96, 99].includes(code)) return { text: '雷雨伴冰雹', icon: '⛈', scene: 'hail' };
    return { text: '未知天气', icon: '◇', scene: null };
  }
  function validWeather(data) {
    return data && Number.isFinite(data.temperature_2m) && data.temperature_2m >= -100 && data.temperature_2m <= 70 &&
      (data.is_day === 0 || data.is_day === 1) && Number.isInteger(data.weather_code) && data.weather_code >= 0 && recent(data.time * 1000, oneDay);
  }
  function validCache(value) {
    return value && validLocation(value.location) && validWeather(value.data) && recent(value.fetchedAt, oneDay);
  }
  function freshCache(value) {
    return validCache(value) && recent(value.fetchedAt, halfHour) && recent(value.data.time * 1000, oneHour);
  }
  function periodAt(snapshot, now = Date.now()) {
    const { sunrise, sunset } = snapshot.daily || {};
    if (Array.isArray(sunrise) && Array.isArray(sunset) && typeof snapshot.timezone === 'string') {
      try {
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: snapshot.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
        for (let i = 0; i < sunrise.length; i++) {
          const rise = sunrise[i] * 1000;
          const set = sunset[i] * 1000;
          if (!Number.isFinite(sunrise[i]) || !Number.isFinite(sunset[i]) || rise <= 0 || set <= rise || set - rise > oneDay) continue;
          if (date.format(rise) === date.format(now)) return now >= rise && now < set ? 'day' : 'night';
        }
      } catch (_) { /* Missing solar data, polar conditions or an invalid timezone: use current.is_day. */ }
    }
    return snapshot.data.is_day === 1 ? 'day' : 'night';
  }
  function background(snapshot, location) {
    if (!freshCache(snapshot) || !sameLocation(snapshot.location, location)) return null;
    const period = periodAt(snapshot);
    return { scene: conditions(snapshot.data.weather_code, period === 'day').scene, period };
  }
  function fallback(scene, period) {
    period = ['day', 'night'].includes(period) ? period : scene === 'night' ? 'night' : 'day';
    if (scene === 'night' && period === 'day') scene = 'sunny';
    if (scene === 'sunny' && period === 'night') scene = 'night';
    return { scene, period };
  }
  window.BlogWeatherState = { scenes, labels, recent, validLocation, sameLocation, conditions, validWeather, validCache, freshCache, periodAt, background, fallback };
})();
