/* Background rendering and preferences. Real weather is supplied by local-weather.js. */
(() => {
  'use strict';

  const root = document.documentElement;
  const state = window.BlogWeatherState;
  if (!state) return;
  const modes = state.scenes;
  const labels = state.labels;
  let weather = modes.includes(root.dataset.weather)
    ? root.dataset.weather
    : modes[Math.floor(Math.random() * modes.length)];
  let following = root.dataset.weatherMode === 'auto';
  let period = root.dataset.weatherPeriod || (weather === 'night' ? 'night' : 'day');
  let source = root.dataset.weatherSource || 'fallback';
  const fallbackScene = modes.includes(root.dataset.weatherFallback) ? root.dataset.weatherFallback : weather;
  let localWeather = null;
  const followButton = document.getElementById('weather-follow');

  function saveChoice() {
    root.dataset.weatherMode = following ? 'auto' : 'manual';
    try {
      localStorage.setItem('blog-weather-preferences-v1', JSON.stringify({ version: 2, scene: weather, period, mode: root.dataset.weatherMode, fallbackScene }));
    } catch (_) { /* The background remains usable with storage disabled. */ }
    if (followButton) {
      followButton.setAttribute('aria-pressed', String(following));
      followButton.textContent = following ? '跟随天气与日夜：开' : '跟随天气与日夜：关';
    }
  }

  const canvas = document.getElementById('blog-rain');
  const controls = document.querySelector('.weather-controls');
  if (!canvas || !controls) return;
  const context = canvas.getContext('2d');
  const weatherSwitch = document.getElementById('weather-switch');
  const weatherLabel = document.getElementById('weather-label');
  const motionButton = document.getElementById('weather-motion');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let manualMotion = false;
  let moving = !reducedMotion.matches;
  let width = 0;
  let height = 0;
  let drops = [];
  let frame = 0;
  let lastTime = 0;

  function hasPrecipitation() {
    return ['rain', 'storm', 'snow', 'hail'].includes(weather);
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    if (!context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const storm = weather === 'storm';
    const snow = weather === 'snow';
    const count = Math.min(storm ? 190 : snow ? 90 : 125, Math.max(35, Math.round(width / (storm ? 8 : snow ? 18 : 11))));
    drops = Array.from({ length: count }, () => ({
      x: Math.random() * (width + 80),
      y: Math.random() * height,
      length: 12 + Math.random() * (storm ? 24 : 16),
      speed: snow ? 15 + Math.random() * 25 : (storm ? 590 : 340) + Math.random() * 310,
      radius: (weather === 'hail' ? 1.7 : 0.8) + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,
      alpha: (snow || weather === 'hail' ? 0.4 : storm ? 0.26 : 0.19) + Math.random() * 0.2
    }));
  }

  function drawParticles(elapsed, time) {
    const storm = weather === 'storm';
    const snow = weather === 'snow';
    const hail = weather === 'hail';
    const wind = storm ? 0.23 : 0.15;
    context.clearRect(0, 0, width, height);
    context.lineWidth = storm ? 1.1 : 0.9;
    context.strokeStyle = period === 'night' ? '#a3bbd3' : storm ? '#55728f' : '#7394ac';
    context.fillStyle = snow ? (period === 'night' ? '#edf5ff' : '#ffffff') : '#d2e5f4';
    for (const drop of drops) {
      drop.y += drop.speed * elapsed;
      drop.x += snow ? Math.sin(time / 1600 + drop.phase) * 12 * elapsed : -drop.speed * wind * elapsed;
      if (drop.y > height + drop.length) {
        drop.y = -drop.length;
        drop.x = Math.random() * (width + 80);
      }
      if (drop.x < -30) drop.x = width + 30;
      context.globalAlpha = drop.alpha;
      context.beginPath();
      if (snow || hail) {
        context.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
        context.fill();
      } else {
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x - drop.length * wind, drop.y + drop.length);
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  function paint(time) {
    frame = 0;
    if (!moving || document.hidden || !hasPrecipitation() || !context) return;
    const elapsed = lastTime ? Math.min((time - lastTime) / 1000, 0.04) : 0.016;
    lastTime = time;
    drawParticles(elapsed, time);
    frame = requestAnimationFrame(paint);
  }

  function update() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    root.dataset.weather = weather;
    root.dataset.weatherPeriod = period;
    root.dataset.weatherSource = source;
    root.dataset.motion = moving && !document.hidden ? 'running' : 'paused';
    const index = modes.indexOf(weather);
    const nextLabel = labels[(index + 1) % modes.length];
    const label = labels[index] + (period === 'night' && weather !== 'night' ? ' · 夜' : '');
    weatherLabel.textContent = (following && source === 'fallback' ? '随机 · ' : '') + label;
    weatherSwitch.setAttribute('aria-label', `当前背景：${weatherLabel.textContent}，切换到${nextLabel}并固定背景`);
    weatherSwitch.title = `切换到${nextLabel}`;
    motionButton.setAttribute('aria-label', moving ? '暂停动效' : '继续动效');
    motionButton.setAttribute('aria-pressed', String(!moving));
    motionButton.title = moving ? '暂停动效' : '继续动效';
    if (context) {
      context.clearRect(0, 0, width, height);
      if (hasPrecipitation()) {
        drawParticles(0, 0);
        if (moving && !document.hidden) frame = requestAnimationFrame(paint);
      }
    }
  }

  function cycle(direction) {
    following = false;
    weather = modes[(modes.indexOf(weather) + direction + modes.length) % modes.length];
    period = weather === 'night' ? 'night' : 'day';
    source = 'manual';
    saveChoice();
    resize();
    update();
  }

  function followLocalWeather() {
    if (!following) return;
    const selected = localWeather?.scene ? localWeather : state.fallback(fallbackScene, localWeather?.period);
    const nextSource = localWeather?.scene ? 'local' : 'fallback';
    if (weather === selected.scene && period === selected.period && source === nextSource) return;
    weather = selected.scene;
    period = selected.period;
    source = nextSource;
    saveChoice();
    resize();
    update();
  }

  document.addEventListener('blog:local-weather', event => {
    localWeather = { scene: modes.includes(event.detail?.scene) ? event.detail.scene : null,
      period: ['day', 'night'].includes(event.detail?.period) ? event.detail.period : null };
    followLocalWeather();
  });
  if (followButton) followButton.addEventListener('click', () => {
    following = !following;
    if (!following) source = 'manual';
    saveChoice();
    followLocalWeather();
    update();
  });

  weatherSwitch.addEventListener('click', () => cycle(1));
  weatherSwitch.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      cycle(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  motionButton.addEventListener('click', () => {
    moving = !moving;
    manualMotion = true;
    update();
  });
  reducedMotion.addEventListener('change', () => {
    if (!manualMotion) {
      moving = !reducedMotion.matches;
      update();
    }
  });
  document.addEventListener('visibilitychange', update);
  window.addEventListener('resize', () => { resize(); update(); }, { passive: true });
  window.addEventListener('pagehide', () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) update();
  });

  saveChoice();
  resize();
  update();
  controls.hidden = false;
})();
