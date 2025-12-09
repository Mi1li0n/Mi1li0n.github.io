// ============ 故事开场 ============

const storyTexts = [
  "这是一个剑与魔法的时代，也是矿石和黄金的时代。\n你，是一名普通到不能再普通的矿工。",
  "一次普通的挖掘任务中，地底的岩壁突然塌陷。\n塌方、尘土、尖叫，最后只剩下黑暗和耳鸣。",
  "当你醒来时，你被困在一处临时搭建的小型基地里。\n上方的通道已经被完全掩埋，唯一的出路——\n只有继续向更深处挖掘。",
  "在洞穴深处，潜伏着矿脉、宝物，还有饥饿的怪物。\n活下去，挖到足够的资源，也许还能等来救援……\n或是，遇到更可怕的东西。"
];

let storyIndex = 0;
const storyTextEl = document.getElementById("story-text");
const storyStepEl = document.getElementById("story-step");
const startScreenEl = document.getElementById("start-screen");
const gameRootEl = document.getElementById("game-root");

function renderStory() {
  storyTextEl.innerText = storyTexts[storyIndex];
  storyStepEl.textContent = `段落 ${storyIndex + 1} / ${storyTexts.length}`;
  const nextBtn = document.getElementById("btn-next");
  nextBtn.textContent = storyIndex === storyTexts.length - 1 ? "开始游戏" : "下一段";
}

document.getElementById("btn-next").addEventListener("click", () => {
  if (storyIndex < storyTexts.length - 1) {
    storyIndex++;
    renderStory();
  } else {
    startScreenEl.classList.add("hidden");
    gameRootEl.classList.remove("hidden");
    startNewRun();
  }
});

document.getElementById("btn-skip").addEventListener("click", () => {
  startScreenEl.classList.add("hidden");
  gameRootEl.classList.remove("hidden");
  startNewRun();
});

renderStory();

// ============ 工具函数 ============

function makeRng(seed) {
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return function () {
    x = x * 16807 % 2147483647;
    return (x - 1) / 2147483646;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function hasLineOfSight(sx, sy, tx, ty, ignoreRock = false) {
  const d = gameState.dungeon;
  if (!d) return false;
  if (sx === tx && sy === ty) return true;

  let x0 = sx, y0 = sy;
  let x1 = tx, y1 = ty;
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sxStep = x0 < x1 ? 1 : -1;
  let syStep = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0, y = y0;
  while (!(x === x1 && y === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sxStep; }
    if (e2 < dx) { err += dx; y += syStep; }
    if (x === x1 && y === y1) break;

    if (!ignoreRock && d.tiles[y][x].type === TILE_ROCK) {
      return false;
    }
  }
  return true;
}

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ============ 常量 ============

const TILE_ROCK = "rock";
const TILE_FLOOR = "floor";
const TILE_ORE = "ore";
const TILE_HOLE = "hole";
const TILE_STAIR_UP = "stair_up";
const TILE_CHEST = "chest";
const PLAYER_LIGHT_RADIUS = 4;

const MON_ZOMBIE = "zombie";
const MON_SLIME = "slime";
const MON_GHOST = "ghost";

const GameMode = {
  BASE: "base",
  DUNGEON: "dungeon"
};

const INV_BACKPACK_W = 2;
const INV_BACKPACK_H = 2;
const INV_CHEST_W = 5;
const INV_CHEST_H = 5;

const ITEM_DEFS = {
  ore: { icon: "💎", name: "矿石", maxStack: 32 },
  bread: { icon: "🍞", name: "面包", maxStack: 1 },
  torch: { icon: "🔥", name: "火把", maxStack: 4 },
  bomb: { icon: "💣", name: "炸药包", maxStack: 4 },
  rope: { icon: "🧵", name: "绳索", maxStack: 4 }
};

// ============ 游戏状态 ============

const gameState = {
  day: 1,
  lanternRadius: PLAYER_LIGHT_RADIUS,
  lanternDimmed: false,
  nextMonsterId: 1,
  turnsLeft: -1,
  maxTurnsPerDay: 200,
  inDungeon: false,
  mode: GameMode.BASE,
  rng: null,
  dungeonTurn: 0,
  darknessTurn: null,
  base: {
    width: 3,
    height: 3,
    player: { x: 1, y: 1 },
    merchant: false
  },
  dungeon: null,
  dungeonSpawn: { x: 0, y: 0 },
  playerPos: null,
  player: {
    hp: 4,
    maxHp: 5,
    tempHp: 0,
    armor: 2,
    maxArmor: 5,
    stunned: 0,
    facing: { dx: 0, dy: -1 },
    pickaxe: {
      type: "basic",
      durability: 40,
      maxDurability: 40
    },
    charmCharges: 0,
    shieldCharges: 0
  },
  ropeAnchor: null,
  ghostTelegraphs: [],
  slimeTelegraphs: [],
  hasEnteredDungeonThisDay: false,
  monsterMoveAnimTimer: null,
  monsters: [],
  ghostMoveCounter: 0,
  bombs: [],
  runSeedBase: 0,
  logLines: [],
  inventory: {
    backpack: [],
    chest: []
  }
};

function pushLog(msg, important = false) {
  gameState.logLines.push({ msg, important });
  if (gameState.logLines.length > 4) {
    gameState.logLines.shift();
  }
  renderLog();
}

// ============ 运行 / 新一轮 ============

function computeTodaySeed(dayOffset = 0) {
  const d = new Date();
  const base = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return base + dayOffset;
}

function resetPlayerFull() {
  gameState.player.hp = 4;
  gameState.player.maxHp = 5;
  gameState.player.tempHp = 0;
  gameState.player.armor = 2;
  gameState.player.maxArmor = 5;
  gameState.player.stunned = 0;
  gameState.player.pickaxe = {
    type: "basic",
    durability: 40,
    maxDurability: 40
  };
  gameState.player.charmCharges = 0;
  gameState.player.shieldCharges = 0;
}

function rebuildRngForDay() {
  const seed = gameState.runSeedBase + gameState.day * 37;
  gameState.rng = makeRng(seed);
}

function updateMerchantForDay() {
  gameState.base.merchant = (gameState.day === 2 || gameState.day === 5 || gameState.day === 8);
}

function startNewRun() {
  gameState.runSeedBase = computeTodaySeed();
  gameState.day = 1;
  resetPlayerFull();
  gameState.hasEnteredDungeonThisDay = false;

  gameState.inventory.backpack = makeEmptyInv(INV_BACKPACK_W, INV_BACKPACK_H);
  gameState.inventory.chest = makeEmptyInv(INV_CHEST_W, INV_CHEST_H);
  addItemToSlots(gameState.inventory.chest, "bread", 2);

  gameState.base.player = { x: 1, y: 1 };
  gameState.mode = GameMode.BASE;
  gameState.inDungeon = false;
  gameState.turnsLeft = -1;
  gameState.logLines = [];
  gameState.bombs = [];
  gameState.ropeAnchor = null;
  pushLog("你在临时基地中醒来。");
  rebuildRngForDay();
  updateMerchantForDay();
  renderAll();
}

function startNewDay() {
  gameState.day += 1;
  if (gameState.day >= 10) {
    showDemoEnd();
    return;
  }
  gameState.hasEnteredDungeonThisDay = false;

  if (gameState.player.hp < gameState.player.maxHp) {
    gameState.player.hp += 1;
  } else {
    gameState.player.tempHp += 1;
  }

  gameState.base.player = { x: 1, y: 1 };
  gameState.mode = GameMode.BASE;
  gameState.inDungeon = false;
  gameState.turnsLeft = -1;
  gameState.logLines = [];
  gameState.bombs = [];
  gameState.ropeAnchor = null;
  rebuildRngForDay();
  updateMerchantForDay();
  pushLog("新的一天开始了。");
  renderAll();
}

// ============ 战斗 / 伤害 ============

function eatBread() {
  if (!consumeItem("bread", 1, true)) {
    pushLog("没有面包了。", true);
    renderHUD();
    return;
  }
  if (gameState.player.hp < gameState.player.maxHp) {
    gameState.player.hp += 1;
    pushLog("吃掉一个面包，恢复 1 点生命。");
  } else {
    gameState.player.tempHp += 1;
    pushLog("吃掉一个面包，获得 1 点临时生命。");
  }
  renderAll();
}

function applyDamage(amount, ignoreArmor = false) {
  let dmg = amount;
  if (!ignoreArmor && gameState.player.armor > 0) {
    const used = Math.min(gameState.player.armor, dmg);
    gameState.player.armor -= used;
    dmg -= used;
  }
  if (dmg > 0) {
    if (gameState.player.tempHp > 0) {
      const used = Math.min(gameState.player.tempHp, dmg);
      gameState.player.tempHp -= used;
      dmg -= used;
    }
    if (dmg > 0) {
      gameState.player.hp -= dmg;
    }
  }

  if (gameState.player.hp <= 0) {
    pushLog("你倒在了地底的黑暗中……", true);
    renderAll();
    showGameOver();
  } else {
    renderAll();
  }
}

function isWalkable(x, y, ignoreWalls = false) {
  const d = gameState.dungeon;
  if (!d) return false;
  if (x < 0 || x >= d.width || y < 0 || y >= d.height) return false;
  const t = d.tiles[y][x].type;
  if (ignoreWalls) return true;
  return (t === TILE_FLOOR || t === TILE_STAIR_UP || t === TILE_CHEST || t === TILE_HOLE);
}

// ============ 玩家行动（矿洞） ============

function mineOrMove(dx, dy) {
  if (gameState.player.stunned > 0) {
    gameState.player.stunned -= 1;
    pushLog("你被粘液怪定身，无法行动这一回合。");
    endPlayerTurn();
    return;
  }
  const d = gameState.dungeon;
  if (!d || !gameState.playerPos) return;

  const px = gameState.playerPos.x;
  const py = gameState.playerPos.y;
  const nx = px + dx;
  const ny = py + dy;
  gameState.player.facing = { dx, dy };

  if (nx < 0 || nx >= d.width || ny < 0 || ny >= d.height) {
    pushLog("前方是坚硬的岩壁。");
    endPlayerTurn();
    return;
  }

  const tile = d.tiles[ny][nx];

  // 1. 岩石 / 矿石 => 挖掘
  if (tile.type === TILE_ROCK || tile.type === TILE_ORE) {
    if (gameState.player.pickaxe.durability <= 0) {
      pushLog("稿子已经完全损坏，无法挖掘！", true);
      endPlayerTurn();
      return;
    }

    gameState.player.pickaxe.durability =
      Math.max(0, gameState.player.pickaxe.durability - 1);

    const buriedMon = gameState.monsters.find(
      m => m.alive && m.buried && m.x === nx && m.y === ny
    );

    if (tile.type === TILE_ORE) {
      addItem("ore", 1, true);
      pushLog("挖到了一块矿石。");
    } else {
      pushLog("你在岩壁上凿出了一条裂缝。");
    }

    tile.type = TILE_FLOOR;

    if (buriedMon) {
      buriedMon.buried = false;
      buriedMon.wakeDelay = 1;
      pushLog("你挖开岩石，一只怪物露出了身影……", true);
    } else {
      gameState.playerPos = { x: nx, y: ny };
    }

    updateVisibility();
    endPlayerTurn();
    return;
  }

  // 2. 有怪 => 攻击
  const mon = monsterAt(nx, ny);
  if (mon && !mon.buried) {
    if (gameState.player.pickaxe.durability <= 0) {
      pushLog("稿子已经完全损坏，无法攻击！", true);
      endPlayerTurn();
      return;
    }
    gameState.player.pickaxe.durability =
      Math.max(0, gameState.player.pickaxe.durability - 3);
    mon.alive = false;
    pushLog("你挥动稿子，击碎了面前的怪物。");
    if (gameState.player.pickaxe.type === "magic" && gameState.rng() < 0.4) {
      addItem("ore", 1, true);
      pushLog("魔法残光凝结成了一块额外的矿石。");
    }
    updateVisibility();
    endPlayerTurn();
    return;
  }

  // 3. 移动
  if (isWalkable(nx, ny, false)) {
    gameState.playerPos = { x: nx, y: ny };
    if (tile.type === TILE_CHEST) {
      openDungeonChest();
    }
    if (tile.type === TILE_STAIR_UP) {
      pushLog("回到出生点，按 E 可以返回基地。");
    }
  } else {
    pushLog("这里走不过去。");
  }

  updateVisibility();
  endPlayerTurn();
}

// ============ 回合结束 / 炸药 / 坍塌 ============

function endPlayerTurn() {
  if (!gameState.inDungeon) {
    renderAll();
    return;
  }

  if (gameState.dungeonTurn == null) gameState.dungeonTurn = 0;
  gameState.dungeonTurn += 1;

  gameState.turnsLeft -= 1;

  const turnsUsed = gameState.maxTurnsPerDay - gameState.turnsLeft;

  if (!gameState.lanternDimmed) {
    if (turnsUsed === 100) {
      gameState.lanternDimmed = true;
      gameState.lanternRadius = 2;
      gameState.darknessTurn = gameState.dungeonTurn;

      pushLog("提灯的灯油将尽，你的视野骤然缩小，黑暗中有什么开始蠢蠢欲动……", true);

      updateVisibility();
      spawnMonstersOutsidePlayerVision();
    }
  } else {
    if (gameState.darknessTurn != null) {
      const sinceDark = gameState.dungeonTurn - gameState.darknessTurn;
      if (sinceDark > 0 && sinceDark % 20 === 0) {
        spawnMonstersOutsidePlayerVision();
      }
    }
  }

  if (turnsUsed >= 150) {
    applyFallingRocks();
  }

  if (gameState.turnsLeft <= 0) {
    gameState.turnsLeft = 0;
    pushLog("矿洞坍塌，你幸运的找到路撤回了基地。", true);
    returnToBaseFromDungeon();
    return;
  }
  updateBombs();
  updateMonsters();
  updateVisibility();
  renderAll();
}

function updateBombs() {
  const d = gameState.dungeon;
  if (!d) return;
  const newBombs = [];
  for (const b of gameState.bombs) {
    b.timer -= 1;
    if (b.timer <= 0) {
      pushLog("炸药包炸响了！", true);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = b.x + dx;
          const y = b.y + dy;
          if (x < 0 || x >= d.width || y < 0 || y >= d.height) continue;
          const tile = d.tiles[y][x];
          if (tile.type === TILE_ROCK || tile.type === TILE_ORE || tile.type === TILE_HOLE) {
            if (tile.type === TILE_ORE) {
              if (gameState.rng() < 0.5) {
                addItem("ore", 1, true);
              }
            }
            tile.type = TILE_FLOOR;
          }
          const mon = monsterAt(x, y);
          if (mon) mon.alive = false;
          if (gameState.playerPos && gameState.playerPos.x === x && gameState.playerPos.y === y) {
            applyDamage(2, false);
          }
        }
      }
    } else {
      newBombs.push(b);
    }
  }
  gameState.bombs = newBombs;
}

// ============ 火把 / 炸药 / 绳索 ============

function placeTorch() {
  if (!gameState.inDungeon) {
    pushLog("只有在矿洞里才能插火把。");
    return;
  }
  if (!consumeItem("torch", 1, true)) {
    pushLog("你没有火把。", true);
    renderHUD();
    return;
  }
  const d = gameState.dungeon;
  if (!d || !gameState.playerPos) return;
  const t = d.tiles[gameState.playerPos.y][gameState.playerPos.x];
  t.hasTorch = true;
  pushLog("你在脚边插下一支火把。");
  updateVisibility();
  endPlayerTurn();
}

function placeBomb() {
  if (!gameState.inDungeon) {
    pushLog("只有在矿洞里才能放置炸药包。");
    return;
  }
  if (!consumeItem("bomb", 1, true)) {
    pushLog("你没有炸药包。", true);
    renderHUD();
    return;
  }
  if (!gameState.playerPos) return;
  gameState.bombs.push({ x: gameState.playerPos.x, y: gameState.playerPos.y, timer: 3 });
  pushLog("你放下了一个炸药包，三回合后会爆炸。");
  endPlayerTurn();
}

function useRope() {
  if (!gameState.inDungeon) {
    pushLog("绳索只能在矿洞里使用。");
    return;
  }
  const d = gameState.dungeon;
  if (!d || !gameState.playerPos) return;

  if (!gameState.ropeAnchor) {
    if (!consumeItem("rope", 1, true)) {
      pushLog("你没有绳索。", true);
      renderHUD();
      return;
    }
    gameState.ropeAnchor = { x: gameState.playerPos.x, y: gameState.playerPos.y };
    pushLog("你在这里设置了一个绳索锚点。");
    endPlayerTurn();
  } else {
    gameState.playerPos = { ...gameState.ropeAnchor };
    gameState.ropeAnchor = null;
    pushLog("你沿着绳索回到了锚点位置。");
    updateVisibility();
    endPlayerTurn();
  }
}

// ============ 视图切换 & 进入矿洞 / 返回基地 ============

function enterDungeon() {
  if (gameState.hasEnteredDungeonThisDay) {
    pushLog("今天你已经下过矿洞了，太疲惫，还是回去休息吧。", true);
    return;
  }
  gameState.hasEnteredDungeonThisDay = true;
  generateDungeon();
  gameState.inDungeon = true;
  gameState.mode = GameMode.DUNGEON;
  gameState.playerPos = { ...gameState.dungeonSpawn };
  gameState.turnsLeft = gameState.maxTurnsPerDay;
  gameState.player.stunned = 0;
  gameState.lanternRadius = PLAYER_LIGHT_RADIUS;
  gameState.lanternDimmed = false;
  gameState.dungeonTurn = 0;
  gameState.darknessTurn = null;

  pushLog("你走下了通往更深处的通道，提灯照亮了前方。");
  pushLog("每一次行动都会消耗 1 回合，100 回合后提灯会变暗。");
  updateVisibility();
  renderAll();
}

function returnToBaseFromDungeon() {
  gameState.mode = GameMode.BASE;
  gameState.inDungeon = false;
  gameState.turnsLeft = -1;
  gameState.playerPos = null;
  gameState.bombs = [];
  gameState.ropeAnchor = null;
  gameState.player.tempHp = 0;
  pushLog("你回到了临时基地。");
  renderAll();
}

// ============ 输入处理 ============

document.addEventListener("keydown", (e) => {
  if (!modalGameover.classList.contains("hidden") ||
    !modalDemoEnd.classList.contains("hidden") ||
    !modalMerchant.classList.contains("hidden") ||
    !modalChest.classList.contains("hidden")) {
    return;
  }

  const key = e.key;

  if (key === "b" || key === "B") {
    eatBread();
    return;
  }
  if (key === "t" || key === "T") {
    placeTorch();
    return;
  }
  if (key === "f" || key === "F") {
    placeBomb();
    return;
  }
  if (key === "r" || key === "R") {
    useRope();
    return;
  }

  if (gameState.mode === GameMode.BASE) {
    handleBaseKey(e);
  } else if (gameState.mode === GameMode.DUNGEON) {
    handleDungeonKey(e);
  }
});

function handleBaseKey(e) {
  const key = e.key;
  let dx = 0, dy = 0;
  if (key === "ArrowUp" || key === "w" || key === "W") dy = -1;
  else if (key === "ArrowDown" || key === "s" || key === "S") dy = 1;
  else if (key === "ArrowLeft" || key === "a" || key === "A") dx = -1;
  else if (key === "ArrowRight" || key === "d" || key === "D") dx = 1;

  if (dx !== 0 || dy !== 0) {
    const nx = clamp(gameState.base.player.x + dx, 0, gameState.base.width - 1);
    const ny = clamp(gameState.base.player.y + dy, 0, gameState.base.height - 1);
    gameState.base.player = { x: nx, y: ny };
    renderBase();
    return;
  }

  if (key === " " || key === "Enter" || key === "e" || key === "E") {
    const x = gameState.base.player.x;
    const y = gameState.base.player.y;

    if (x === 2 && y === 1) {
      pushLog("你躺上床，结束这一天。", true);
      startNewDay();
      return;
    }
    if (x === 0 && y === 1) {
      openChest();
      return;
    }
    if (x === 1 && y === 2) {
      enterDungeon();
      return;
    }
    if (gameState.base.merchant && x === 2 && y === 0) {
      openMerchant();
      return;
    }

    pushLog("这里没有可以互动的东西。");
  }
}

function handleDungeonKey(e) {
  const key = e.key;
  let dx = 0, dy = 0;
  if (key === "ArrowUp" || key === "w" || key === "W") dy = -1;
  else if (key === "ArrowDown" || key === "s" || key === "S") dy = 1;
  else if (key === "ArrowLeft" || key === "a" || key === "A") dx = -1;
  else if (key === "ArrowRight" || key === "d" || key === "D") dx = 1;

  if (dx !== 0 || dy !== 0) {
    mineOrMove(dx, dy);
    return;
  }

  if (key === " " || key === "Enter" || key === "e" || key === "E") {
    if (gameState.playerPos &&
      gameState.playerPos.x === gameState.dungeonSpawn.x &&
      gameState.playerPos.y === gameState.dungeonSpawn.y) {
      returnToBaseFromDungeon();
      return;
    } else {
      pushLog("只有回到出生点才能沿着梯子爬回基地。");
    }
  }
}
