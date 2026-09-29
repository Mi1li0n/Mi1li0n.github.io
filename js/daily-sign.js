/* Daily silliness and meal suggestions. All content and state stay in the browser. */
(() => {
  'use strict';
  const card = document.getElementById('daily-sign-card');
  const foods = window.DailySignData?.foods;
  if (!card || !Array.isArray(foods) || !foods.length) return;
  const fortunes = window.DailySignData.fortunes;
  if (!Array.isArray(fortunes) || !fortunes.length) return;
  const fortuneById = new Map(fortunes.map(item => [item.id, item]));
  const foodById = new Map(foods.map(item => [item.id, item]));
  const slots = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', lateNight: '夜宵' };
  const key = 'blog-daily-sign-v1';
  const byId = id => document.getElementById(id);
  const draw = byId('daily-sign-draw');
  const foodDraw = byId('daily-food-draw');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let storageWorks = true;
  let drawing = false;
  let animationTimer = 0;

  function dayKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function mealSlot(date) {
    const hour = date.getHours();
    return hour >= 5 && hour < 11 ? 'breakfast' : hour >= 11 && hour < 16 ? 'lunch' : hour >= 16 && hour < 21 ? 'dinner' : 'lateNight';
  }
  function available(food, slot) {
    if (food.always) return true;
    return food.slots?.length ? food.slots.includes(slot) : slot === 'lunch' || slot === 'dinner';
  }
  function normalize(value, today) {
    const next = { date: today, fortuneId: null, meals: {} };
    if (!value || value.date !== today) return next;
    if (fortuneById.has(value.fortuneId)) next.fortuneId = value.fortuneId;
    for (const slot of Object.keys(slots)) {
      const food = foodById.get(value.meals?.[slot]);
      if (food && available(food, slot)) next.meals[slot] = food.id;
    }
    return next;
  }
  function read() {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch (_) { storageWorks = false; return null; }
  }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); storageWorks = true; }
    catch (_) { storageWorks = false; }
  }
  let state = normalize(read(), dayKey(new Date()));
  let slot = mealSlot(new Date());

  function render() {
    const fortune = fortuneById.get(state.fortuneId);
    const food = foodById.get(state.meals[slot]);
    const date = byId('daily-sign-date');
    date.dateTime = state.date;
    date.textContent = state.date.slice(5).replace('-', ' / ');
    byId('daily-sign-ritual').hidden = !!fortune && !drawing;
    byId('daily-sign-result').hidden = !fortune || drawing;
    card.dataset.drawing = String(drawing);
    card.dataset.drawn = String(!!fortune && !drawing);
    card.setAttribute('aria-busy', String(drawing));
    draw.disabled = !!fortune || drawing;
    draw.textContent = drawing ? '抽签中…' : fortune ? '明日再抽' : '抽签';
    if (fortune) {
      byId('daily-sign-grade').textContent = fortune.grade;
      byId('daily-sign-name').textContent = fortune.name;
      byId('daily-sign-line').textContent = fortune.line;
    }
    byId('daily-sign-note').hidden = storageWorks;
    byId('daily-sign-note').textContent = storageWorks ? '' : '无法保存，下次打开会重置。';
    byId('daily-food-slot').textContent = slots[slot];
    byId('daily-food-preview').hidden = !food;
    byId('daily-food-preview').textContent = food ? food.name : '';
    byId('daily-food-preview').title = food ? food.name : '';
    byId('daily-food-result').hidden = !food;
    foodDraw.textContent = food ? '换一道' : '选一个';
    if (food) {
      byId('daily-food-emoji').textContent = food.emoji || '🍽️';
      byId('daily-food-name').textContent = food.name;
      byId('daily-food-description').textContent = food.description;
    }
  }
  function sync() {
    const now = new Date();
    const today = dayKey(now);
    if (state.date !== today) {
      clearTimeout(animationTimer);
      drawing = false;
      state = normalize(read(), today);
    } else {
      // Another tab may already have drawn today's fortune.
      const saved = read();
      if (saved?.date === today) {
        const restored = normalize(saved, today);
        if (restored.fortuneId) state.fortuneId = restored.fortuneId;
        state.meals = { ...state.meals, ...restored.meals };
      }
    }
    slot = mealSlot(now);
    render();
  }
  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }
  draw.addEventListener('click', () => {
    sync();
    if (state.fortuneId || drawing) return;
    state.fortuneId = pick(fortunes).id;
    save(); // Commit before animating so reloads cannot redraw the same day.
    drawing = !reducedMotion.matches;
    render();
    if (drawing) animationTimer = setTimeout(() => { drawing = false; sync(); }, 850);
  });
  foodDraw.addEventListener('click', () => {
    sync();
    const previous = foodById.get(state.meals[slot]);
    // The original menu includes two small-steamed-bun entries with different IDs.
    // A reroll should visibly change the dish, including those legacy duplicates.
    const pool = foods.filter(food => available(food, slot) && food.name !== previous?.name);
    const food = pick(pool.length ? pool : foods.filter(food => available(food, slot)));
    state.meals[slot] = food.id;
    save();
    render();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && drawing) {
      clearTimeout(animationTimer);
      drawing = false;
      sync();
    }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('pageshow', sync);
  window.addEventListener('storage', event => { if (event.key === key) sync(); });
  setInterval(() => { if (!document.hidden) sync(); }, 60000);
  render();
})();
