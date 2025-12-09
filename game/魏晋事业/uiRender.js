// ============ HUD / 侧栏 / 地图渲染 ============

function renderHUD() {
  document.getElementById("hud-day").textContent = gameState.day;
  document.getElementById("hud-turns").textContent = gameState.inDungeon ? gameState.turnsLeft : "-";
  document.getElementById("hud-ore").textContent = getTotalOre();

  const heartsEl = document.getElementById("hud-hearts");
  heartsEl.innerHTML = "";

  const hp = gameState.player.hp;
  const maxHp = gameState.player.maxHp;
  const tempHp = gameState.player.tempHp;

  // 可“覆盖”的临时生命数量：只盖在红心上，不盖黑心
  const visibleTemp = Math.min(tempHp, hp);

  for (let i = 0; i < maxHp; i++) {
    const span = document.createElement("span");

    if (i < visibleTemp) {
    // 护盾在上层，从左到右覆盖红心
      span.textContent = "💛";
    } else if (i < hp) {
    // 没被覆盖的红心
      span.textContent = "❤️";
    } else {
    // 空血
      span.textContent = "🖤";
    }

    heartsEl.appendChild(span);
  }

  const armorEl = document.getElementById("hud-armor");
  armorEl.innerHTML = "";
  for (let i = 0; i < gameState.player.maxArmor; i++) {
    const span = document.createElement("span");
    if (i < gameState.player.armor) {
      span.textContent = "🛡️";
    } else {
      span.textContent = "⬜";
    }
    armorEl.appendChild(span);
  }

  const pickaxe = gameState.player.pickaxe;
  const pickaxeEl = document.getElementById("hud-pickaxe");
  pickaxeEl.textContent = `${pickaxe.durability}/${pickaxe.maxDurability}`;
  if (pickaxe.durability <= 0) pickaxeEl.classList.add("text-danger");
  else pickaxeEl.classList.remove("text-danger");

  document.getElementById("tag-location").textContent =
    gameState.mode === GameMode.BASE ? "基地" : "矿洞";
  document.getElementById("stat-loc-text").textContent =
    gameState.mode === GameMode.BASE ? "临时基地" : "地底通道";
  document.getElementById("stat-temp-hp").textContent = gameState.player.tempHp;
  document.getElementById("stat-stun").textContent = gameState.player.stunned;
  document.getElementById("stat-monsters").textContent =
    gameState.monsters.filter(m => m.alive).length;
  document.getElementById("stat-charm").textContent = gameState.player.charmCharges;
  document.getElementById("stat-shield").textContent = gameState.player.shieldCharges;

  document.getElementById("stat-bread").textContent = getItemCount("bread");
  document.getElementById("stat-torch").textContent = getItemCount("torch");
  document.getElementById("stat-bomb").textContent = getItemCount("bomb");
  document.getElementById("stat-rope").textContent = getItemCount("rope");

  renderBackpackMini();
}

function renderBackpackMini() {
  const grid = document.getElementById("backpack-grid");
  grid.innerHTML = "";
  const slots = gameState.inventory.backpack;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const div = document.createElement("div");
    div.className = "inv-slot";
    if (!slot) {
      div.classList.add("inv-slot-empty");
      div.textContent = "";
    } else {
      const def = ITEM_DEFS[slot.type];
      div.textContent = def ? def.icon : "?";
      if (slot.count > 1) {
        const c = document.createElement("span");
        c.className = "inv-count";
        c.textContent = slot.count;
        div.appendChild(c);
      }
    }
    grid.appendChild(div);
  }
}

function renderLog() {
  const panel = document.getElementById("log-panel");
  panel.innerHTML = "";
  gameState.logLines.forEach(line => {
    const div = document.createElement("div");
    div.className = "log-line" + (line.important ? " important" : "");
    div.textContent = "· " + line.msg;
    panel.appendChild(div);
  });
}

function renderBase() {
  const baseView = document.getElementById("base-view");
  const dungeonView = document.getElementById("dungeon-view");
  if (gameState.mode === GameMode.BASE) {
    baseView.classList.remove("hidden");
    dungeonView.classList.add("hidden");
  } else {
    baseView.classList.add("hidden");
    dungeonView.classList.remove("hidden");
    return;
  }

  baseView.innerHTML = "";
  const w = gameState.base.width;
  const h = gameState.base.height;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tile = document.createElement("div");
      tile.className = "tile base";

      let symbol = "";
      if (x === 0 && y === 1) {
        symbol = "📦";
        tile.classList.add("chest");
      }
      if (x === 2 && y === 1) {
        symbol = "🛏️";
        tile.classList.add("bed");
      }
      if (x === 1 && y === 2) {
        symbol = "⬇️";
        tile.classList.add("stairs");
      }
      if (gameState.base.merchant && x === 2 && y === 0) {
        symbol = "🧙‍♂️";
        tile.classList.add("merchant");
      }

      if (gameState.base.player.x === x && gameState.base.player.y === y) {
        tile.classList.add("player");
        symbol = "⛏️";
      }

      tile.textContent = symbol;
      baseView.appendChild(tile);
    }
  }
}

function renderDungeon() {
  if (gameState.mode !== GameMode.DUNGEON || !gameState.dungeon) return;
  const baseView = document.getElementById("base-view");
  const dungeonView = document.getElementById("dungeon-view");
  baseView.classList.add("hidden");
  dungeonView.classList.remove("hidden");
  dungeonView.innerHTML = "";

  const dungeon = gameState.dungeon;
  const width = dungeon.width;
  const height = dungeon.height;
  const spawn = gameState.dungeonSpawn;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tileData = dungeon.tiles[y][x];
      const tile = document.createElement("div");
      let classes = ["tile", "dungeon"];
      let symbol = "";

      if (!tileData.discovered && !tileData.visible) {
        classes.push("fog");
        tile.className = classes.join(" ");
        dungeonView.appendChild(tile);
        continue;
      }

      switch (tileData.type) {
        case TILE_ROCK:
          classes.push("rock");
          symbol = "🪨";
          break;
        case TILE_FLOOR:
          classes.push("floor");
          break;
        case TILE_ORE:
          classes.push("ore");
          symbol = "⛏️";
          break;
        case TILE_HOLE:
          classes.push("hole");
          break;
        case TILE_STAIR_UP:
          classes.push("stair-up");
          symbol = "⬆️";
          break;
        case TILE_CHEST:
          classes.push("chest");
          symbol = "💰";
          break;
      }

      if (!tileData.visible) {
        classes.push("dim");
      }

      if (spawn && x === spawn.x && y === spawn.y) {
        classes.push("spawn");
      }

      if (gameState.ghostTelegraphs.some(p => p.x === x && p.y === y)) {
        classes.push("ghost-tele");
      }
      if (gameState.slimeTelegraphs.some(p => p.x === x && p.y === y)) {
        classes.push("slime-tele");
      }

      let mon = null;
      let bombHere = null;

      if (tileData.visible) {
        mon = gameState.monsters.find(m => m.alive && !m.buried && m.x === x && m.y === y);
        if (mon) {
          classes.push("monster");
          if (mon.type === MON_ZOMBIE) {
            symbol = "🧟";
          } else if (mon.type === MON_SLIME) {
            symbol = "🟢";
          } else if (mon.type === MON_GHOST) {
            symbol = "👻";
          }
          if (mon.charging && mon.attackType === "dash" && mon.type === MON_GHOST) {
            classes.push("mon-ghost-charging");
          }
          if (mon.charging && mon.attackType === "jump" && mon.type === MON_SLIME) {
            classes.push("mon-slime-charging");
          }
          if (mon.justMoved) {
            classes.push("monster-moving");
          }
        }

        bombHere = gameState.bombs.find(b => b.x === x && b.y === y);
        if (bombHere) {
          classes.push("bomb");
          symbol = "💣";
        }

        if (gameState.playerPos &&
          gameState.playerPos.x === x &&
          gameState.playerPos.y === y) {
          classes.push("player");
          symbol = "⛏️";
        }
      }

      if (tileData.visible && !mon && !bombHere &&
        !(gameState.playerPos && gameState.playerPos.x === x && gameState.playerPos.y === y)) {
        if (gameState.ropeAnchor &&
          gameState.ropeAnchor.x === x &&
          gameState.ropeAnchor.y === y) {
          symbol = "🧵";
        } else if (tileData.hasTorch) {
          symbol = "🔥";
        }
      }

      tile.className = classes.join(" ");
      tile.textContent = symbol;
      dungeonView.appendChild(tile);
    }
  }
}

function renderAll() {
  renderHUD();
  renderBase();
  renderDungeon();
  renderLog();
}

// ============ 商人 Modal ============

const modalMerchant = document.getElementById("modal-merchant");
const shopListEl = document.getElementById("shop-list");

function openMerchant() {
  buildShopForToday();
  document.getElementById("shop-ore").textContent = getTotalOre();
  modalMerchant.classList.remove("hidden");
}

function closeMerchant() {
  modalMerchant.classList.add("hidden");
  renderAll();
}

document.getElementById("btn-shop-close").addEventListener("click", closeMerchant);
modalMerchant.querySelector(".modal-backdrop").addEventListener("click", closeMerchant);

function buildShopForToday() {
  shopListEl.innerHTML = "";
  const day = gameState.day;
  const items = [];

  items.push({
    id: "bread",
    name: "面包 🍞",
    price: 1,
    desc: "吃掉后回复 1 点生命（优先真实生命）。",
    type: "consumable"
  });
  items.push({
    id: "armor",
    name: "护甲 4/4 🛡️",
    price: 5,
    desc: "替换当前护甲为 4/4，挡伤害优先消耗护甲。",
    type: "armor"
  });
  items.push({
    id: "pickaxe_basic",
    name: "普通稿子 40/40 ⛏️",
    price: 10,
    desc: "替换当前稿子为 40/40。",
    type: "pickaxe"
  });

  if (day >= 2) {
    items.push({
      id: "torch",
      name: "火把 🔥",
      price: 2,
      desc: "插在地面上提供额外光照。",
      type: "torch"
    });
  }

  if (day >= 5) {
    items.push({
      id: "pickaxe_light",
      name: "轻便稿子 30/30 🪓",
      price: 7,
      desc: "更轻便,也更便宜。",
      pickaxe: { type: "light", dur: 30 },
      type: "pickaxe"
    });
    items.push({
      id: "pickaxe_heavy",
      name: "重型稿子 55/55 ⚒️",
      price: 15,
      desc: "更耐用的重型工具。",
      pickaxe: { type: "heavy", dur: 55 },
      type: "pickaxe"
    });
    items.push({
      id: "helmet",
      name: "矿工头盔 ⛑️",
      price: 8,
      desc: "提供 +1 护甲耐久，护甲全部损坏时头盔会破碎。",
      type: "helmet"
    });
    items.push({
      id: "shield",
      name: "尖刺盾牌 🛡️",
      price: 6,
      desc: "首次被僵尸或粘液怪贴脸攻击时，直接反击秒杀对方并免疫这次伤害。",
      type: "shield"
    });
  }

  if (day >= 8) {
    items.push({
      id: "pickaxe_magic",
      name: "魔法稿子 50/50 ✨",
      price: 18,
      desc: "击杀怪物时有小概率额外掉矿石。",
      pickaxe: { type: "magic", dur: 50 },
      type: "pickaxe"
    });
    items.push({
      id: "bomb",
      name: "炸药包 💣",
      price: 5,
      desc: "三回合后在 3×3 区域爆炸，炸开岩石并伤害怪物。",
      type: "bomb"
    });
    items.push({
      id: "rope",
      name: "绳索 🧵",
      price: 4,
      desc: "可以设置一个锚点，再次使用时瞬移回锚点。",
      type: "rope"
    });
    items.push({
      id: "charm",
      name: "幽灵之眼护符 👁️",
      price: 7,
      desc: "幽灵在远处时不会主动靠近你，贴脸攻击时护符碎裂。",
      type: "charm"
    });
  }

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "shop-item";

    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "shop-name";
    name.textContent = item.name;
    const desc = document.createElement("div");
    desc.className = "shop-desc";
    desc.textContent = item.desc;
    left.appendChild(name);
    left.appendChild(desc);

    const right = document.createElement("div");
    const price = document.createElement("div");
    price.innerHTML = `<span class="text-good">${item.price}</span> 矿石`;
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.style.padding = "2px 8px";
    btn.style.fontSize = "11px";
    btn.textContent = "购买";
    btn.addEventListener("click", () => {
      buyShopItem(item);
    });
    right.appendChild(price);
    right.appendChild(btn);

    row.appendChild(left);
    row.appendChild(right);
    shopListEl.appendChild(row);
  });
}

function buyShopItem(item) {
  if (!spendOre(item.price)) {
    pushLog("矿石不够。", true);
    document.getElementById("shop-ore").textContent = getTotalOre();
    return;
  }
  document.getElementById("shop-ore").textContent = getTotalOre();

  switch (item.type) {
    case "consumable":
      addItem("bread", 1, true);
      pushLog("买到了面包。");
      break;
    case "armor":
      gameState.player.maxArmor = 4;
      gameState.player.armor = 4;
      pushLog("换上了新的护甲。");
      break;
    case "pickaxe":
      if (item.pickaxe) {
        gameState.player.pickaxe.type = item.pickaxe.type;
        gameState.player.pickaxe.maxDurability = item.pickaxe.dur;
        gameState.player.pickaxe.durability = item.pickaxe.dur;
      } else {
        gameState.player.pickaxe.type = "basic";
        gameState.player.pickaxe.maxDurability = 40;
        gameState.player.pickaxe.durability = 40;
      }
      pushLog("换上了新的稿子。");
      break;
    case "torch":
      addItem("torch", 1, true);
      pushLog("拿到了一支火把。");
      break;
    case "helmet":
      gameState.player.maxArmor += 1;
      gameState.player.armor += 1;
      pushLog("戴上了矿工头盔。");
      break;
    case "shield":
      gameState.player.shieldCharges += 1;
      pushLog("拿到了尖刺盾牌。");
      break;
    case "bomb":
      addItem("bomb", 1, true);
      pushLog("买了一个炸药包。");
      break;
    case "rope":
      addItem("rope", 1, true);
      pushLog("收下了一根绳索。");
      break;
    case "charm":
      gameState.player.charmCharges += 1;
      pushLog("佩戴了幽灵之眼护符。");
      break;
  }
  renderHUD();
}

// ============ Game Over / Demo End ============

const modalGameover = document.getElementById("modal-gameover");
const modalDemoEnd = document.getElementById("modal-demoend");

document.getElementById("btn-restart-run").addEventListener("click", () => {
  modalGameover.classList.add("hidden");
  startNewRun();
});

document.getElementById("btn-demo-restart").addEventListener("click", () => {
  modalDemoEnd.classList.add("hidden");
  startNewRun();
});

// 遮罩点击不做事，用原来的行为
modalGameover.querySelector(".modal-backdrop").addEventListener("click", () => { });
modalDemoEnd.querySelector(".modal-backdrop").addEventListener("click", () => { });

function showGameOver() {
  modalGameover.classList.remove("hidden");
}

function showDemoEnd() {
  modalDemoEnd.classList.remove("hidden");
}
