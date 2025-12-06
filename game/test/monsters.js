// ============ 怪物基础查找 ============

function monsterAt(x, y) {
  return gameState.monsters.find(m => m.alive && m.x === x && m.y === y);
}

// ============ 怪物回合更新 ============

function updateMonsters() {
  if (!gameState.playerPos || !gameState.dungeon) return;
  const d = gameState.dungeon;

  gameState.ghostTelegraphs = [];
  gameState.slimeTelegraphs = [];

  const px = gameState.playerPos.x;
  const py = gameState.playerPos.y;

  let anyMoved = false;

  function manhattan(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  for (const m of gameState.monsters) {
    if (!m.alive) continue;

    m.justMoved = false;

    const tileHere = d.tiles[m.y][m.x];

    if (m.type !== MON_GHOST && tileHere.type === TILE_ROCK) {
      m.buried = true;
    }
    if (m.buried && tileHere.type !== TILE_ROCK) {
      m.buried = false;
      m.wakeDelay = Math.max(m.wakeDelay || 0, 1);
    }
    if (m.buried) continue;

    if (m.wakeDelay && m.wakeDelay > 0) {
      m.wakeDelay -= 1;
      continue;
    }

    const dist = manhattan(m.x, m.y, px, py);

    if (m.charging && m.attackType === "dash" && m.type === MON_GHOST) {
      const oldX = m.x, oldY = m.y;
      performGhostDash(m);
      if (m.x !== oldX || m.y !== oldY) {
        m.justMoved = true;
        anyMoved = true;
      }
      continue;
    }
    if (m.charging && m.attackType === "jump" && m.type === MON_SLIME) {
      const oldX = m.x, oldY = m.y;
      performSlimeJump(m);
      if (m.x !== oldX || m.y !== oldY) {
        m.justMoved = true;
        anyMoved = true;
      }
      continue;
    }

    // 僵尸
    if (m.type === MON_ZOMBIE) {
      if (dist === 1) {
        monsterAttack(m, false);
        continue;
      }

      let aggro = false;
      if (dist <= PLAYER_LIGHT_RADIUS &&
        hasLineOfSight(m.x, m.y, px, py, false)) {
        aggro = true;
      }

      const oldX = m.x, oldY = m.y;

      if (aggro) {
        moveMonsterTowardsPlayer(m, 1, false, false);
      } else {
        const here = d.tiles[m.y][m.x];
        const wanderProb = (here.type === TILE_HOLE ? 0.7 : 0.25);
        if (gameState.rng() < wanderProb) {
          randomMonsterStep(m, false, false);
        }
      }

      if (m.x !== oldX || m.y !== oldY) {
        m.justMoved = true;
        anyMoved = true;
      }
      continue;
    }

    // 粘液怪
    if (m.type === MON_SLIME) {
      if (dist === 1 &&
        gameState.player.armor <= 0 &&
        m.attackCooldown <= 0) {
        monsterAttack(m, false);
        m.attackCooldown = 2;
        continue;
      }

      if (m.attackCooldown > 0) {
        const oldX = m.x, oldY = m.y;
        randomMonsterStep(m, false, false);
        if (m.x !== oldX || m.y !== oldY) {
          m.justMoved = true;
          anyMoved = true;
        }
        m.attackCooldown -= 1;
        continue;
      }

      const sameCol0 = (m.x === px && Math.abs(m.y - py) === 3);
      const sameRow0 = (m.y === py && Math.abs(m.x - px) === 3);
      if (sameCol0 || sameRow0) {
        startSlimeCharge(m);
        continue;
      }

      const dirs = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        { dx: 0, dy: 0 }
      ];

      let bestX = m.x;
      let bestY = m.y;
      let bestScore = Infinity;

      for (const dir of dirs) {
        const nx = m.x + dir.dx;
        const ny = m.y + dir.dy;

        if (nx === px && ny === py) continue;

        if (!canMonsterMoveTo(m, nx, ny, false, false)) continue;
        if (monsterAt(nx, ny) && !(nx === m.x && ny === m.y)) continue;

        const distNew = manhattan(nx, ny, px, py);
        let score = Math.abs(distNew - 3);
        if (!(nx === px || ny === py)) score += 1;

        if (score < bestScore) {
          bestScore = score;
          bestX = nx;
          bestY = ny;
        }
      }

      const oldX = m.x, oldY = m.y;
      if (bestX !== m.x || bestY !== m.y) {
        m.x = bestX;
        m.y = bestY;
        m.justMoved = true;
        anyMoved = true;
      }

      const newDist = manhattan(m.x, m.y, px, py);
      if (newDist === 3 && (m.x === px || m.y === py) && m.attackCooldown <= 0) {
        startSlimeCharge(m);
        continue;
      }

      continue;
    }

    // 幽灵
    if (m.type === MON_GHOST) {
      if (dist <= 3 && m.attackCooldown <= 0) {
        if (gameState.player.charmCharges > 0 && dist > 1) {
          // 有护符远距不冲
        } else {
          startGhostCharge(m);
          continue;
        }
      }
      let aggro = (dist <= 3);
      if (gameState.player.charmCharges > 0 && dist > 1 && dist <= 3) {
        aggro = false;
      }
      if (m.attackCooldown > 0) {
        aggro = false;
      }

      const oldX = m.x, oldY = m.y;

      if (aggro) {
        moveMonsterTowardsPlayer(m, 1, true, true);
      } else {
        randomMonsterStep(m, true, true);
      }

      if (m.x !== oldX || m.y !== oldY) {
        m.justMoved = true;
        anyMoved = true;
      }

      if (m.attackCooldown > 0) m.attackCooldown -= 1;
      continue;
    }
  }

  if (anyMoved) {
    if (gameState.monsterMoveAnimTimer) {
      clearTimeout(gameState.monsterMoveAnimTimer);
    }
    gameState.monsterMoveAnimTimer = setTimeout(() => {
      gameState.monsters.forEach(mm => {
        if (mm.alive) mm.justMoved = false;
      });
      gameState.monsterMoveAnimTimer = null;
      if (gameState.mode === GameMode.DUNGEON) {
        renderDungeon();
      }
    }, 1000);
  }
}

// ============ 幽灵冲刺 ============

function startGhostCharge(m) {
  if (!gameState.playerPos || !gameState.dungeon) return;
  const px = gameState.playerPos.x;
  const py = gameState.playerPos.y;

  let dx = px - m.x;
  let dy = py - m.y;
  let dir = { dx: 0, dy: 0 };

  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
    dir.dx = dx > 0 ? 1 : -1;
  } else if (dy !== 0) {
    dir.dy = dy > 0 ? 1 : -1;
  } else {
    return;
  }

  const d = gameState.dungeon;
  const path = [];
  let cx = m.x;
  let cy = m.y;

  for (let i = 0; i < 4; i++) {
    const nx = cx + dir.dx;
    const ny = cy + dir.dy;
    if (nx < 0 || nx >= d.width || ny < 0 || ny >= d.height) break;
    path.push({ x: nx, y: ny });
    cx = nx;
    cy = ny;
  }

  if (path.length === 0) return;

  m.charging = true;
  m.attackType = "dash";
  m.chargePath = path;
  m.chargeDir = dir;
  gameState.ghostTelegraphs.push(...path);

  pushLog("幽灵发出刺耳的低鸣，前方泛起血红的光芒……", true);
}

function performGhostDash(m) {
  const d = gameState.dungeon;
  if (!d || !m.chargePath || !m.chargePath.length) {
    m.charging = false;
    m.attackType = null;
    return;
  }
  gameState.ghostTelegraphs = [];
  let lastPos = { x: m.x, y: m.y };
  const dir = m.chargeDir || { dx: 0, dy: 0 };

  for (const step of m.chargePath) {
    const nx = step.x;
    const ny = step.y;
    if (nx < 0 || nx >= d.width || ny < 0 || ny >= d.height) break;

    lastPos = { x: nx, y: ny };

    if (gameState.playerPos &&
      gameState.playerPos.x === nx &&
      gameState.playerPos.y === ny) {

      if (gameState.player.charmCharges > 0) {
        gameState.player.charmCharges = 0;
        pushLog("幽灵冲刺时，你的护符啪地一声碎裂！", true);
      }
      pushLog("幽灵的冲刺穿过了你的身体。", true);
      applyDamage(1, true);
    }
  }

  m.x = lastPos.x;
  m.y = lastPos.y;

  if (gameState.playerPos &&
    gameState.playerPos.x === m.x &&
    gameState.playerPos.y === m.y &&
    dir && (dir.dx !== 0 || dir.dy !== 0)) {
    const ex = m.x + dir.dx;
    const ey = m.y + dir.dy;
    if (ex >= 0 && ex < d.width && ey >= 0 && ey < d.height) {
      m.x = ex;
      m.y = ey;
    }
  }

  m.charging = false;
  m.attackType = null;
  m.chargePath = null;
  m.chargeDir = null;
  m.attackCooldown = 3;
}

// ============ 粘液怪跳跃 ============

function startSlimeCharge(m) {
  if (!gameState.playerPos || !gameState.dungeon) return;
  const px = gameState.playerPos.x;
  const py = gameState.playerPos.y;
  let dx = px - m.x;
  let dy = py - m.y;
  let dir = { dx: 0, dy: 0 };

  if (dx === 0) {
    dir.dy = dy > 0 ? 1 : -1;
  } else if (dy === 0) {
    dir.dx = dx > 0 ? 1 : -1;
  } else {
    return;
  }

  const d = gameState.dungeon;
  const target = { x: m.x + dir.dx * 2, y: m.y + dir.dy * 2 };
  if (target.x < 0 || target.x >= d.width || target.y < 0 || target.y >= d.height) return;

  m.charging = true;
  m.attackType = "jump";
  m.chargeTarget = target;

  gameState.slimeTelegraphs.push(target);
  pushLog("粘液怪开始鼓胀，前方的地面泛起诡异的蓝光……", true);
}

function performSlimeJump(m) {
  const d = gameState.dungeon;
  if (!d || !m.chargeTarget) {
    m.charging = false;
    m.attackType = null;
    return;
  }
  gameState.slimeTelegraphs = [];
  const tx = m.chargeTarget.x;
  const ty = m.chargeTarget.y;

  const dir = {
    dx: Math.sign(tx - m.x),
    dy: Math.sign(ty - m.y)
  };

  let landingX = tx;
  let landingY = ty;

  if (!canMonsterMoveTo(m, landingX, landingY, false, false)) {
    m.charging = false;
    m.attackType = null;
    m.chargeTarget = null;
    m.attackCooldown = 2;
    return;
  }

  let hit = false;

  if (gameState.playerPos &&
    gameState.playerPos.x === landingX &&
    gameState.playerPos.y === landingY) {

    if (gameState.player.armor > 0) {
      gameState.player.armor -= 1;
      pushLog("粘液怪跨格扑击，撞碎了你的一点护甲！", true);
    } else {
      pushLog("粘液怪扑到你脚边，但你身上已经没有护甲了。", true);
    }
    hit = true;
  }

  if (hit) {
    const bx = landingX - dir.dx;
    const by = landingY - dir.dy;
    if (canMonsterMoveTo(m, bx, by, false, false) && !monsterAt(bx, by)) {
      m.x = bx;
      m.y = by;
    } else {
      m.x = landingX;
      m.y = landingY;
    }
  } else {
    m.x = landingX;
    m.y = landingY;
  }

  m.charging = false;
  m.attackType = null;
  m.chargeTarget = null;
  m.attackCooldown = 2;
}

// ============ 通用怪物移动 / 攻击 ============

function isWithinHome(m, x, y) {
  if (!m.roamRadius || typeof m.homeX !== "number") return true;
  return (Math.abs(x - m.homeX) <= m.roamRadius &&
    Math.abs(y - m.homeY) <= m.roamRadius);
}

function canMonsterMoveTo(m, x, y, ignoreWalls, restrictHome) {
  const d = gameState.dungeon;
  if (!d) return false;
  if (x < 0 || x >= d.width || y < 0 || y >= d.height) return false;
  if (restrictHome && !isWithinHome(m, x, y)) return false;
  if (ignoreWalls) return true;
  const t = d.tiles[y][x].type;
  return (t === TILE_FLOOR || t === TILE_HOLE || t === TILE_STAIR_UP || t === TILE_CHEST);
}

function randomMonsterStep(m, ignoreWalls, restrictHome) {
  const d = gameState.dungeon;
  if (!d) return;
  const dirs = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
  ];
  shuffle(gameState.rng, dirs);
  for (const dir of dirs) {
    const nx = m.x + dir.dx;
    const ny = m.y + dir.dy;
    if (!canMonsterMoveTo(m, nx, ny, ignoreWalls, restrictHome)) continue;
    if (monsterAt(nx, ny)) continue;
    m.x = nx;
    m.y = ny;
    break;
  }
}

function moveMonsterTowardsPlayer(m, stepCount, ignoreWalls, restrictHome) {
  if (!gameState.playerPos || !gameState.dungeon) return;
  const px = gameState.playerPos.x;
  const py = gameState.playerPos.y;

  for (let step = 0; step < stepCount; step++) {
    let dx = px - m.x;
    let dy = py - m.y;
    if (dx === 0 && dy === 0) return;
    const ax = Math.abs(dx), ay = Math.abs(dy);

    const dirs = [];
    if (ax >= ay && dx !== 0) {
      dirs.push({ dx: Math.sign(dx), dy: 0 });
      if (dy !== 0) dirs.push({ dx: 0, dy: Math.sign(dy) });
    } else if (ay > ax && dy !== 0) {
      dirs.push({ dx: 0, dy: Math.sign(dy) });
      if (dx !== 0) dirs.push({ dx: Math.sign(dx), dy: 0 });
    } else {
      dirs.push(
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
      );
    }

    let moved = false;
    for (const dir of dirs) {
      const nx = m.x + dir.dx;
      const ny = m.y + dir.dy;
      if (!canMonsterMoveTo(m, nx, ny, ignoreWalls, restrictHome)) continue;
      if (monsterAt(nx, ny)) continue;
      m.x = nx;
      m.y = ny;
      moved = true;
      break;
    }
    if (!moved) return;
  }
}

function monsterAttack(m, ghostIgnoreArmor = false) {
  if (m.type === MON_ZOMBIE) {
    if (gameState.player.shieldCharges > 0) {
      gameState.player.shieldCharges -= 1;
      m.alive = false;
      pushLog("尖刺盾牌发力，僵尸被反击击碎！", true);
      return;
    }
    pushLog("僵尸咬了你一口。", true);
    applyDamage(1, false);

  } else if (m.type === MON_SLIME) {
    if (gameState.player.shieldCharges > 0) {
      gameState.player.shieldCharges -= 1;
      m.alive = false;
      pushLog("尖刺盾牌反击，将粘液怪戳成一滩。", true);
      return;
    }
    pushLog("粘液怪附着在你身上，你被定住一回合。", true);
    gameState.player.stunned = 1;
    m.alive = false;

  } else if (m.type === MON_GHOST) {
    if (gameState.player.charmCharges > 0) {
      gameState.player.charmCharges = 0;
      pushLog("幽灵贴近时，你的护符碎裂了。", true);
    }
    pushLog("幽灵的爪子掠过你的心脏。", true);
    applyDamage(1, true);
  }
}
