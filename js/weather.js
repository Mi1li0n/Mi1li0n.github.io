/* Five decorative weather modes for the NexT blog. No network or storage needed. */
(() => {
  'use strict';

  const root = document.documentElement;
  const modes = ['rain', 'storm', 'sunny', 'cloudy', 'night'];
  const labels = ['雨', '雷雨', '晴天', '多云', '夜晚'];
  let weather = modes.includes(root.dataset.weather)
    ? root.dataset.weather
    : modes[Math.floor(Math.random() * modes.length)];

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

  function isRainy() {
    return weather === 'rain' || weather === 'storm';
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
    const count = Math.min(storm ? 190 : 125, Math.max(40, Math.round(width / (storm ? 8 : 11))));
    drops = Array.from({ length: count }, () => ({
      x: Math.random() * (width + 80),
      y: Math.random() * height,
      length: 12 + Math.random() * (storm ? 24 : 16),
      speed: (storm ? 590 : 340) + Math.random() * 310,
      alpha: (storm ? 0.26 : 0.19) + Math.random() * 0.2
    }));
  }

  function paint(time) {
    frame = 0;
    if (!moving || document.hidden || !isRainy() || !context) return;
    const elapsed = lastTime ? Math.min((time - lastTime) / 1000, 0.04) : 0.016;
    lastTime = time;
    const storm = weather === 'storm';
    const wind = storm ? 0.23 : 0.15;
    context.clearRect(0, 0, width, height);
    context.lineWidth = storm ? 1.1 : 0.9;
    context.strokeStyle = storm ? '#55728f' : '#7394ac';
    for (const drop of drops) {
      drop.y += drop.speed * elapsed;
      drop.x -= drop.speed * wind * elapsed;
      if (drop.y > height + drop.length) {
        drop.y = -drop.length;
        drop.x = Math.random() * (width + 80);
      }
      if (drop.x < -30) drop.x = width + 30;
      context.globalAlpha = drop.alpha;
      context.beginPath();
      context.moveTo(drop.x, drop.y);
      context.lineTo(drop.x - drop.length * wind, drop.y + drop.length);
      context.stroke();
    }
    frame = requestAnimationFrame(paint);
  }

  function update() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    root.dataset.weather = weather;
    root.dataset.motion = moving && !document.hidden ? 'running' : 'paused';
    const index = modes.indexOf(weather);
    const nextLabel = labels[(index + 1) % modes.length];
    weatherLabel.textContent = labels[index];
    weatherSwitch.setAttribute('aria-label', `当前天气：${labels[index]}，切换到${nextLabel}`);
    weatherSwitch.title = `切换到${nextLabel}`;
    motionButton.setAttribute('aria-label', moving ? '暂停动效' : '继续动效');
    motionButton.setAttribute('aria-pressed', String(!moving));
    motionButton.title = moving ? '暂停动效' : '继续动效';
    if (context) {
      context.clearRect(0, 0, width, height);
      if (moving && !document.hidden && isRainy()) frame = requestAnimationFrame(paint);
    }
  }

  function cycle(direction) {
    weather = modes[(modes.indexOf(weather) + direction + modes.length) % modes.length];
    resize();
    update();
  }

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
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pagehide', () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) update();
  });

  resize();
  update();
  controls.hidden = false;
})();
