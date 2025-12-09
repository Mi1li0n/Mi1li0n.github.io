// ============ 地下生成（空洞 + 矿物 + 怪物） ============

function generateDungeon() {
  const width = 28, height = 28;
  const tiles = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({
        type: TILE_ROCK,
        discovered: false,
        visible: false,
        hasTorch: false,
        lastSeenTurn: null
      });
    }
    tiles.push(row);
  }

  const rng = gameState.rng;

  const spawnX = Math.floor(width / 2);
  const spawnY = Math.floor(height / 2);
  gameState.dungeonSpawn = { x: spawnX, y: spawnY };
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = spawnX + dx;
      const y = spawnY + dy;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      tiles[y][x].type = TILE_FLOOR;
    }
  }
  tiles[spawnY][spawnX].type = TILE_STAIR_UP;

  function chebDist(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
  }
  function manhattan(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  // 洞窟
  const caves = [];
  const caveCount = 5;
  const minCaveDistFromSpawn = 8;

  for (let ci = 0; ci < caveCount; ci++) {
    let cx = 0, cy = 0;
    let attempts = 0;
    let foundCenter = false;

    while (attempts < 80 && !foundCenter) {
      cx = randInt(rng, 2, width - 3);
      cy = randInt(rng, 2, height - 3);
      const radius = randInt(rng, 1, 3);

      if (chebDist(cx, cy, spawnX, spawnY) < minCaveDistFromSpawn + radius) {
        attempts++;
        continue;
      }
      foundCenter = true;
    }

    if (!foundCenter) continue;

    const radius = randInt(rng, 1, 3);
    const candidates = [];
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (chebDist(x, y, spawnX, spawnY) < minCaveDistFromSpawn) continue;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radius * radius + 1 &&
          tiles[y][x].type === TILE_ROCK) {
          candidates.push({ x, y });
        }
      }
    }
    if (!candidates.length) continue;

    shuffle(rng, candidates);
    const desiredSize = randInt(rng, 10, 20);
    const actualSize = Math.min(desiredSize, candidates.length);
    const caveCells = [];
    for (let i = 0; i < actualSize; i++) {
      const { x, y } = candidates[i];
      tiles[y][x].type = TILE_HOLE;
      caveCells.push({ x, y });
    }
    if (caveCells.length > 0) {
      caves.push({ cells: caveCells });
    }
  }

  // 旧矿道
  function carveOldMinesFromSpawn() {
    const pathCount = randInt(rng, 2, 3);
    const baseDirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];

    for (let i = 0; i < pathCount; i++) {
      let x = spawnX;
      let y = spawnY;

      let mainDir = baseDirs[randInt(rng, 0, baseDirs.length - 1)];
      const steps = randInt(rng, 7, 13);

      for (let s = 0; s < steps; s++) {
        if (rng() < 0.25) {
          mainDir = baseDirs[randInt(rng, 0, baseDirs.length - 1)];
        }
        const nx = x + mainDir.dx;
        const ny = y + mainDir.dy;
        if (nx < 1 || nx >= width - 1 || ny < 1 || ny >= height - 1) break;

        x = nx;
        y = ny;

        if (tiles[y][x].type === TILE_HOLE) continue;

        if (tiles[y][x].type === TILE_ROCK || tiles[y][x].type === TILE_ORE) {
          tiles[y][x].type = TILE_FLOOR;
        }
      }
    }
  }
  carveOldMinesFromSpawn();

  // 矿脉 & 散矿
  const oreForbidden = [];
  for (let y = 0; y < height; y++) {
    const row = new Array(width).fill(false);
    oreForbidden.push(row);
  }
  function markOreForbiddenAround(cells) {
    for (const c of cells) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          oreForbidden[ny][nx] = true;
        }
      }
    }
  }

  const minOreDistFromSpawn = 6;

  const veinCount = randInt(rng, 3, 5);
  for (let v = 0; v < veinCount; v++) {
    let tries = 0;
    let start = null;

    while (tries < 80 && !start) {
      const x = randInt(rng, 0, width - 1);
      const y = randInt(rng, 0, height - 1);
      const t = tiles[y][x].type;
      if (t !== TILE_ROCK) { tries++; continue; }
      if (oreForbidden[y][x]) { tries++; continue; }
      if (chebDist(x, y, spawnX, spawnY) < minOreDistFromSpawn) { tries++; continue; }
      start = { x, y };
    }
    if (!start) continue;

    const targetSize = randInt(rng, 8, 12);
    const frontier = [start];
    const veinCells = [];
    const used = new Set();
    used.add(`${start.x},${start.y}`);

    while (frontier.length && veinCells.length < targetSize) {
      const idx = randInt(rng, 0, frontier.length - 1);
      const { x, y } = frontier[idx];

      if (!oreForbidden[y][x] &&
        tiles[y][x].type === TILE_ROCK &&
        chebDist(x, y, spawnX, spawnY) >= minOreDistFromSpawn) {
        veinCells.push({ x, y });
      }

      const dirs = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
      ];
      shuffle(rng, dirs);
      let expanded = false;

      for (const dDir of dirs) {
        const nx = x + dDir.dx;
        const ny = y + dDir.dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const key = `${nx},${ny}`;
        if (used.has(key)) continue;
        if (tiles[ny][nx].type !== TILE_ROCK) continue;
        if (oreForbidden[ny][nx]) continue;
        if (chebDist(nx, ny, spawnX, spawnY) < minOreDistFromSpawn) continue;
        used.add(key);
        frontier.push({ x: nx, y: ny });
        expanded = true;
        if (veinCells.length >= targetSize) break;
      }

      if (!expanded) {
        frontier.splice(idx, 1);
      }
    }

    if (veinCells.length < 6) continue;

    for (const c of veinCells) {
      tiles[c.y][c.x].type = TILE_ORE;
    }
    markOreForbiddenAround(veinCells);
  }

  let singleOres = randInt(rng, 10, 20);
  let guard = 0;
  while (singleOres > 0 && guard < 300) {
    guard++;
    const x = randInt(rng, 0, width - 1);
    const y = randInt(rng, 0, height - 1);
    if (tiles[y][x].type !== TILE_ROCK) continue;
    if (oreForbidden[y][x]) continue;
    if (chebDist(x, y, spawnX, spawnY) < minOreDistFromSpawn) continue;

    tiles[y][x].type = TILE_ORE;
    markOreForbiddenAround([{ x, y }]);
    singleOres--;
  }

  // 宝箱
  const openCells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y][x].type;
      if ((t === TILE_FLOOR || t === TILE_HOLE) &&
        !(Math.abs(x - spawnX) <= 1 && Math.abs(y - spawnY) <= 1)) {
        openCells.push({ x, y });
      }
    }
  }
  shuffle(rng, openCells);
  const chestCount = 2;
  for (let i = 0; i < chestCount && i < openCells.length; i++) {
    const pos = openCells[i];
    tiles[pos.y][pos.x].type = TILE_CHEST;
  }

  caves.forEach(cave => {
    if (!cave.cells.length) return;
    const candidates = cave.cells.filter(c =>
      !(Math.abs(c.x - spawnX) <= 1 && Math.abs(c.y - spawnY) <= 1)
    );
    if (!candidates.length) return;
    const pick = candidates[randInt(rng, 0, candidates.length - 1)];
    tiles[pick.y][pick.x].type = TILE_CHEST;
  });

  // 怪物生成
  const caveZombieSpawns = [];
  caves.forEach(cave => {
    const candidates = cave.cells.filter(c => {
      const t = tiles[c.y][c.x].type;
      if (t === TILE_CHEST) return false;
      if (Math.abs(c.x - spawnX) <= 1 && Math.abs(c.y - spawnY) <= 1) return false;
      return true;
    });
    shuffle(rng, candidates);
    for (let i = 0; i < 2 && i < candidates.length; i++) {
      caveZombieSpawns.push(candidates[i]);
    }
  });

  const rockCells = [];
  const walkCells = [];
  const occupied = new Set(
    caveZombieSpawns.map(p => `${p.x},${p.y}`)
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y][x].type;

      if (Math.abs(x - spawnX) <= 1 && Math.abs(y - spawnY) <= 1) continue;
      if (occupied.has(`${x},${y}`)) continue;
      if (t === TILE_CHEST) continue;

      const distFromSpawn = manhattan(x, y, spawnX, spawnY);

      if (t === TILE_ROCK) {
        rockCells.push({ x, y });
      } else if (t === TILE_HOLE) {
        walkCells.push({ x, y });
      } else if (t === TILE_FLOOR) {
        if (distFromSpawn >= 6) {
          walkCells.push({ x, y });
        }
      }
    }
  }
  shuffle(rng, rockCells);
  shuffle(rng, walkCells);

  const ghostSpots = [];
  const otherWalkSpots = [];
  for (const p of walkCells) {
    const dist = manhattan(p.x, p.y, spawnX, spawnY);
    if (dist >= 8) ghostSpots.push(p);
    else otherWalkSpots.push(p);
  }
  shuffle(rng, ghostSpots);
  shuffle(rng, otherWalkSpots);

  const monsters = [];
  let nextId = 1;

  for (const pos of caveZombieSpawns) {
    monsters.push({
      id: nextId++,
      type: MON_ZOMBIE,
      x: pos.x,
      y: pos.y,
      alive: true,
      buried: false,
      wakeDelay: 0,
      homeX: pos.x,
      homeY: pos.y,
      roamRadius: 0,
      attackCooldown: 0,
      charging: false,
      attackType: null,
      chargePath: null,
      chargeDir: null,
      chargeTarget: null
    });
  }

  const maxSpots = rockCells.length + ghostSpots.length + otherWalkSpots.length;
  const extraCount = Math.min(randInt(rng, 18, 28), maxSpots);
  let ghostCount = 0;
  const maxGhosts = 4;

  for (let i = 0; i < extraCount; i++) {
    let roll = rng();
    let type;

    if (roll < 0.5) type = MON_ZOMBIE;
    else if (roll < 0.8) type = MON_SLIME;
    else type = MON_GHOST;

    if (type === MON_GHOST && ghostCount >= maxGhosts) {
      type = (roll < 0.65 ? MON_ZOMBIE : MON_SLIME);
    }

    let pos;
    if (type === MON_GHOST) {
      if (ghostSpots.length) {
        pos = ghostSpots.pop();
      } else if (otherWalkSpots.length) {
        pos = otherWalkSpots.pop();
      } else if (rockCells.length) {
        pos = rockCells.pop();
      }
    } else {
      if (rockCells.length) {
        pos = rockCells.pop();
      } else if (otherWalkSpots.length) {
        pos = otherWalkSpots.pop();
      } else if (ghostSpots.length) {
        pos = ghostSpots.pop();
      }
    }

    if (!pos) {
      if (rockCells.length && rng() < 0.6) {
        pos = rockCells.pop();
      } else if (otherWalkSpots.length) {
        pos = otherWalkSpots.pop();
      } else if (ghostSpots.length) {
        pos = ghostSpots.pop();
      } else if (rockCells.length) {
        pos = rockCells.pop();
      }
    }

    if (!pos) break;

    const tileType = tiles[pos.y][pos.x].type;
    const buried = (tileType === TILE_ROCK && type !== MON_GHOST);

    monsters.push({
      id: nextId++,
      type,
      x: pos.x,
      y: pos.y,
      alive: true,
      buried,
      wakeDelay: 0,
      homeX: pos.x,
      homeY: pos.y,
      roamRadius: type === MON_GHOST ? 2 : 0,
      attackCooldown: (type === MON_SLIME || type === MON_GHOST)
        ? randInt(rng, 0, 6)
        : 0,
      charging: false,
      attackType: null,
      chargePath: null,
      chargeDir: null,
      chargeTarget: null
    });

    if (type === MON_GHOST) ghostCount++;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles[y][x].discovered = false;
      tiles[y][x].visible = false;
      tiles[y][x].hasTorch = false;
      tiles[y][x].lastSeenTurn = null;
    }
  }

  gameState.dungeon = { width, height, tiles };
  gameState.monsters = monsters;
  gameState.nextMonsterId = monsters.reduce(
    (max, m) => m.id > max ? m.id : max,
    0
  ) + 1;
  gameState.bombs = [];
  gameState.ropeAnchor = null;
  gameState.ghostMoveCounter = 0;
  gameState.ghostTelegraphs = [];
  gameState.slimeTelegraphs = [];
}

// ============ 视野 / 探索 ============

function updateVisibility() {
  if (!gameState.inDungeon || !gameState.dungeon || !gameState.playerPos) return;
  const d = gameState.dungeon;
  const w = d.width, h = d.height;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      d.tiles[y][x].visible = false;
    }
  }

  const sources = [];
  const playerLight = gameState.lanternRadius || PLAYER_LIGHT_RADIUS;
  sources.push({
    x: gameState.playerPos.x,
    y: gameState.playerPos.y,
    r: playerLight
  });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d.tiles[y][x].hasTorch) {
        sources.push({ x, y, r: 3 });
      }
    }
  }

  for (const src of sources) {
    const minX = Math.max(0, src.x - src.r - 1);
    const maxX = Math.min(w - 1, src.x + src.r + 1);
    const minY = Math.max(0, src.y - src.r - 1);
    const maxY = Math.min(h - 1, src.y + src.r + 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cheb = Math.max(Math.abs(x - src.x), Math.abs(y - src.y));
        if (cheb > src.r) continue;
        if (!hasLineOfSight(src.x, src.y, x, y, false)) continue;
        const tile = d.tiles[y][x];
        tile.visible = true;
        tile.discovered = true;
        tile.lastSeenTurn = gameState.dungeonTurn;
      }
    }
  }

  if (gameState.dungeonTurn != null) {
    const spawn = gameState.dungeonSpawn;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = d.tiles[y][x];
        if (!tile.discovered || tile.visible) continue;
        if (spawn && x === spawn.x && y === spawn.y) continue;
        const last = tile.lastSeenTurn;
        if (last != null && gameState.dungeonTurn - last >= 8) {
          tile.discovered = false;
        }
      }
    }
  }
}

// ============ 黑暗刷怪 / 坍塌 ============

function spawnMonstersOutsidePlayerVision() {
  const d = gameState.dungeon;
  if (!d || !gameState.playerPos || !gameState.rng) return;

  const px = gameState.playerPos.x;
  const py = gameState.playerPos.y;
  const candidates = [];

  for (let y = 0; y < d.height; y++) {
    for (let x = 0; x < d.width; x++) {
      const tile = d.tiles[y][x];

      if (tile.visible) continue;

      if (!(tile.type === TILE_FLOOR ||
        tile.type === TILE_HOLE ||
        tile.type === TILE_ROCK)) continue;

      if (monsterAt(x, y)) continue;

      const cheb = Math.max(Math.abs(x - px), Math.abs(y - py));
      if (cheb <= (gameState.lanternRadius || PLAYER_LIGHT_RADIUS) + 1) continue;

      candidates.push({ x, y });
    }
  }

  if (!candidates.length) return;

  const rng = gameState.rng;
  shuffle(rng, candidates);
  const spawnCount = randInt(rng, 2, 4);

  for (let i = 0; i < spawnCount && i < candidates.length; i++) {
    const pos = candidates[i];
    const roll = rng();

    let type;
    if (roll < 0.6) type = MON_ZOMBIE;
    else if (roll < 0.9) type = MON_SLIME;
    else type = MON_GHOST;

    const tileType = d.tiles[pos.y][pos.x].type;
    const buried = (tileType === TILE_ROCK && type !== MON_GHOST);

    const mon = {
      id: gameState.nextMonsterId++,
      type,
      x: pos.x,
      y: pos.y,
      alive: true,
      buried,
      wakeDelay: buried ? 1 : 0,
      homeX: pos.x,
      homeY: pos.y,
      roamRadius: type === MON_GHOST ? 2 : 0,
      attackCooldown: (type === MON_SLIME || type === MON_GHOST)
        ? randInt(rng, 0, 3)
        : 0,
      charging: false,
      attackType: null,
      chargePath: null,
      chargeDir: null,
      chargeTarget: null
    };

    gameState.monsters.push(mon);
  }

  pushLog("黑暗深处响起了新的怪物声响……", true);
}

function applyFallingRocks() {
  const d = gameState.dungeon;
  if (!d || !gameState.rng) return;

  const num = randInt(gameState.rng, 1, 3);
  let placed = 0;
  let guard = 0;

  const spawn = gameState.dungeonSpawn;

  while (placed < num && guard < 500) {
    guard++;
    const x = randInt(gameState.rng, 0, d.width - 1);
    const y = randInt(gameState.rng, 0, d.height - 1);
    const tile = d.tiles[y][x];

    if (tile.type === TILE_ROCK) continue;

    if (spawn && x === spawn.x && y === spawn.y) continue;

    if (gameState.playerPos &&
      gameState.playerPos.x === x &&
      gameState.playerPos.y === y) {
      continue;
    }

    gameState.bombs = gameState.bombs.filter(b => !(b.x === x && b.y === y));

    const mon = monsterAt(x, y);
    if (mon && mon.type !== MON_GHOST) {
      mon.buried = true;
      mon.wakeDelay = 0;
    }

    tile.type = TILE_ROCK;
    placed++;
  }

  if (placed > 0) {
    pushLog(`洞顶落下碎石，封住了 ${placed} 处通路。`, true);
  }
}

// ============ 地下宝箱 ============

function openDungeonChest() {
  const d = gameState.dungeon;
  const { x, y } = gameState.playerPos;
  const tile = d.tiles[y][x];
  if (tile.type !== TILE_CHEST) return;

  tile.type = TILE_FLOOR;

  pushLog("你打开了一个古老的木箱。", true);

  const rng = gameState.rng;
  const lootCount = randInt(rng, 1, 3);

  const lootTable = [
    { type: "bread", weight: 25, min: 1, max: 1 },
    { type: "ore", weight: 20, min: 2, max: 5 },
    { type: "torch", weight: 18, min: 1, max: 3 },
    { type: "bomb", weight: 16, min: 1, max: 2 },
    { type: "rope", weight: 10, min: 1, max: 1 }
  ];

  function weightedPick(table) {
    let total = 0;
    for (const e of table) total += e.weight;
    let r = rng() * total;
    for (const e of table) {
      if (r < e.weight) return e;
      r -= e.weight;
    }
    return table[table.length - 1];
  }

  const gained = {};

  for (let i = 0; i < lootCount; i++) {
    const entry = weightedPick(lootTable);
    const count = randInt(rng, entry.min, entry.max);
    addItem(entry.type, count, true);
    gained[entry.type] = (gained[entry.type] || 0) + count;
  }

  const parts = [];
  for (const [type, cnt] of Object.entries(gained)) {
    const def = ITEM_DEFS[type];
    const name = def ? def.name : type;
    parts.push(`${name}×${cnt}`);
  }
  if (parts.length > 0) {
    pushLog(`你从宝箱里找到了：${parts.join("，")}。`, true);
  }
}
