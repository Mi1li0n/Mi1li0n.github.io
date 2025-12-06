// ============ 背包 / 箱子逻辑 ============

function makeEmptyInv(w, h) {
  const arr = [];
  for (let i = 0; i < w * h; i++) arr.push(null);
  return arr;
}

function addItemToSlots(slots, type, count) {
  const def = ITEM_DEFS[type];
  if (!def || count <= 0) return 0;
  let remain = count;

  // 先往已有同类堆叠
  for (let i = 0; i < slots.length && remain > 0; i++) {
    const slot = slots[i];
    if (slot && slot.type === type && slot.count < def.maxStack) {
      const add = Math.min(def.maxStack - slot.count, remain);
      slot.count += add;
      remain -= add;
    }
  }
  // 再找空格
  for (let i = 0; i < slots.length && remain > 0; i++) {
    const slot = slots[i];
    if (!slot) {
      const add = Math.min(def.maxStack, remain);
      slots[i] = { type, count: add };
      remain -= add;
    }
  }
  return remain;
}

function addItem(type, count = 1, preferBackpack = true) {
  let remain = count;
  if (preferBackpack) {
    remain = addItemToSlots(gameState.inventory.backpack, type, remain);
    if (remain > 0) remain = addItemToSlots(gameState.inventory.chest, type, remain);
  } else {
    remain = addItemToSlots(gameState.inventory.chest, type, remain);
    if (remain > 0) remain = addItemToSlots(gameState.inventory.backpack, type, remain);
  }
  if (remain > 0) {
    const def = ITEM_DEFS[type];
    pushLog(`背包和箱子都放不下 ${def ? def.name : type}，有 ${remain} 个留在了地上。`, true);
  }
}

function consumeItemFromSlots(slots, type, count = 1) {
  let remain = count;
  for (let i = 0; i < slots.length && remain > 0; i++) {
    const slot = slots[i];
    if (slot && slot.type === type) {
      const use = Math.min(slot.count, remain);
      slot.count -= use;
      remain -= use;
      if (slot.count <= 0) slots[i] = null;
    }
  }
  return remain === 0;
}

function getItemCountInSlots(slots, type) {
  let n = 0;
  for (const s of slots) {
    if (s && s.type === type) n += s.count;
  }
  return n;
}

function consumeItem(type, count = 1, backpackOnly = false) {
  if (backpackOnly) {
    return consumeItemFromSlots(gameState.inventory.backpack, type, count);
  }

  let need = count;

  const beforeBackpack = getItemCountInSlots(gameState.inventory.backpack, type);
  consumeItemFromSlots(gameState.inventory.backpack, type, need);
  const afterBackpack = getItemCountInSlots(gameState.inventory.backpack, type);
  const usedFromBackpack = Math.min(need, beforeBackpack - afterBackpack);
  need -= usedFromBackpack;

  if (need <= 0) return true;

  const beforeChest = getItemCountInSlots(gameState.inventory.chest, type);
  const okChest = consumeItemFromSlots(gameState.inventory.chest, type, need);
  if (!okChest) return false;
  const afterChest = getItemCountInSlots(gameState.inventory.chest, type);
  const usedFromChest = beforeChest - afterChest;

  return usedFromChest === need;
}

function getItemCount(type) {
  let n = 0;
  for (const slot of [...gameState.inventory.backpack, ...gameState.inventory.chest]) {
    if (slot && slot.type === type) n += slot.count;
  }
  return n;
}

function getTotalOre() {
  return getItemCount("ore");
}

function spendOre(amount) {
  let total = getTotalOre();
  if (total < amount) return false;
  let remain = amount;
  const lists = [gameState.inventory.backpack, gameState.inventory.chest];
  for (const slots of lists) {
    for (let i = 0; i < slots.length && remain > 0; i++) {
      const slot = slots[i];
      if (slot && slot.type === "ore") {
        const use = Math.min(slot.count, remain);
        slot.count -= use;
        remain -= use;
        if (slot.count <= 0) slots[i] = null;
      }
    }
  }
  return true;
}

// ============ 箱子 Modal ============

const modalChest = document.getElementById("modal-chest");
const chestGridEl = document.getElementById("chest-grid");
const bpGridModalEl = document.getElementById("bp-grid-modal");

function openChest() {
  renderChestModal();
  modalChest.classList.remove("hidden");
}

function closeChest() {
  modalChest.classList.add("hidden");
  renderAll();
}

document.getElementById("btn-chest-close").addEventListener("click", closeChest);
modalChest.querySelector(".modal-backdrop").addEventListener("click", closeChest);

function renderChestModal() {
  const chestSlots = gameState.inventory.chest;
  const bpSlots = gameState.inventory.backpack;

  chestGridEl.innerHTML = "";
  for (let i = 0; i < chestSlots.length; i++) {
    const slot = chestSlots[i];
    const div = document.createElement("div");
    div.className = "inv-slot";
    if (!slot) {
      div.classList.add("inv-slot-empty");
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
    div.addEventListener("click", () => {
      if (!slot) return;
      const remain = addItemToSlots(gameState.inventory.backpack, slot.type, slot.count);
      if (remain === 0) {
        chestSlots[i] = null;
      } else {
        chestSlots[i].count = remain;
      }
      renderChestModal();
      renderHUD();
    });
    chestGridEl.appendChild(div);
  }

  bpGridModalEl.innerHTML = "";
  for (let i = 0; i < bpSlots.length; i++) {
    const slot = bpSlots[i];
    const div = document.createElement("div");
    div.className = "inv-slot";
    if (!slot) {
      div.classList.add("inv-slot-empty");
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
    div.addEventListener("click", () => {
      if (!slot) return;
      const remain = addItemToSlots(gameState.inventory.chest, slot.type, slot.count);
      if (remain === 0) {
        bpSlots[i] = null;
      } else {
        bpSlots[i].count = remain;
      }
      renderChestModal();
      renderHUD();
    });
    bpGridModalEl.appendChild(div);
  }
}
