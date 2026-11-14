const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");

let currentMap = "town";

const DEFAULT_PLAYER = {
  x: 270,
  y: 120,
  size: 28,
  hp: 100,
  gold: 0,
  reputation: 0,
  // Guaranteed Slot Inventory (Can hold 1+ of each ingredient)
  rawMeat: 0,
  primeMeat: 0,
  herbs: 0,
  mushrooms: 0,
  // Cooked Dishes
  skewers: 0,
  steaks: 0,
  feasts: 0,
  salads: 0,
  tonics: 0,
  // 6 Core RPG Attributes
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10
};

let player = { ...DEFAULT_PLAYER };

// Monster Types: Slime, Goblin, Orc Boss
let enemies = [
  { name: "Green Slime", color: "#f38ba8", x: 420, y: 120, size: 30, hp: 25, maxHp: 25, atk: 10, dropType: "meat", alive: true, state: "idle", windupTimer: 0, maxWindup: 55, cooldownTimer: 0 },
  { name: "Wild Goblin", color: "#a6e3a1", x: 150, y: 200, size: 32, hp: 45, maxHp: 45, atk: 18, dropType: "meat", alive: false, state: "idle", windupTimer: 0, maxWindup: 45, cooldownTimer: 0 },
  { name: "Orc Boss", color: "#fab387", x: 300, y: 60, size: 40, hp: 90, maxHp: 90, atk: 28, dropType: "prime", alive: false, state: "idle", windupTimer: 0, maxWindup: 60, cooldownTimer: 0 }
];

let wildItems = [];
let customerOrders = [];

function spawnWildItems() {
  wildItems = [
    { type: "herb", icon: "🌿", color: "#a6e3a1", x: 100, y: 80, size: 22, active: true },
    { type: "herb", icon: "🌿", color: "#a6e3a1", x: 480, y: 200, size: 22, active: true },
    { type: "mushroom", icon: "🍄", color: "#fab387", x: 280, y: 220, size: 22, active: true },
    { type: "mushroom", icon: "🍄", color: "#fab387", x: 500, y: 70, size: 22, active: true }
  ];
}

function generateCustomerOrders() {
  const possibleDishes = [
    { key: "skewers", name: "🍖 Meat Skewer", baseGold: 25 },
    { key: "steaks", name: "🥗 Herb-Roasted Steak", baseGold: 50 },
    { key: "feasts", name: "🍖 Prime Beast Feast", baseGold: 110 },
    { key: "salads", name: "🌿 Forest Herbal Salad", baseGold: 75 },
    { key: "tonics", name: "🍵 Mystical Mushroom Tonic", baseGold: 85 }
  ];

  customerOrders = [];
  // Generate 3 random customer orders
  for (let i = 0; i < 3; i++) {
    const dish = possibleDishes[Math.floor(Math.random() * possibleDishes.length)];
    const qty = Math.floor(Math.random() * 2) + 1;
    const bonus = Math.floor(player.cha * 2);
    const reward = (dish.baseGold * qty) + bonus;
    customerOrders.push({ id: i, dishKey: dish.key, dishName: dish.name, qty: qty, reward: reward });
  }
}

// --- MAP SWITCHER ---
function switchMap() {
  if (currentMap === "town") {
    currentMap = "hunt";
    document.getElementById("map-toggle-btn").textContent = "🏠 Return to Town";
    document.getElementById("map-toggle-btn").style.backgroundColor = "#f9e2af";
    document.getElementById("mobile-controls").style.display = "flex";
    
    document.getElementById("action-panel").innerHTML = `
      <div style="text-align:center; font-size:12px; color: #a6e3a1; font-weight:bold; padding:4px;">
        🌲 HUNTING GROUNDS: Fight Slimes, Goblins & Orc Bosses for meat!
      </div>
    `;
    logEl.textContent = "Entered Hunting Grounds! Beware of strong monsters and grab wild herbs/mushrooms.";
    player.x = 60; 
    player.y = 120;
    spawnWildItems();
    respawnAllEnemies();
  } else {
    currentMap = "town";
    document.getElementById("map-toggle-btn").textContent = "🌲 Travel to Hunting Grounds";
    document.getElementById("map-toggle-btn").style.backgroundColor = "#a6e3a1";
    document.getElementById("mobile-controls").style.display = "none";

    document.getElementById("action-panel").innerHTML = `
      <div id="town-controls" class="action-group">
        <button id="kitchen-btn" onclick="openModal('kitchen-modal')">🍳 KITCHEN</button>
        <button id="npc-btn" onclick="openModal('npc-modal')" style="background-color: #fab387;">🗣️ CUSTOMERS</button>
        <button id="heal-btn" onclick="eatBestDish()" disabled>🍲 Eat Dish</button>
        <button id="shop-btn" onclick="openModal('shop-modal')">🛒 SHOP</button>
        <button id="char-btn" onclick="openModal('char-modal')">📜 STATS</button>
      </div>
    `;
    logEl.textContent = "Returned to Town! Check 🗣️ CUSTOMERS for special orders or visit the Kitchen.";
    player.x = 270; 
    player.y = 120;
    updateUI();
  }
}

// --- SAVE & LOAD SYSTEM ---
function saveGame() {
  localStorage.setItem("RPGHuntCook_Save_v3", JSON.stringify(player));
  logEl.textContent = "💾 Game Saved successfully!";
}

function loadGame() {
  const saved = localStorage.getItem("RPGHuntCook_Save_v3");
  if (saved) {
    player = { ...DEFAULT_PLAYER, ...JSON.parse(saved) };
    logEl.textContent = "📂 Save file loaded!";
  }
  generateCustomerOrders();
}

function resetGame() {
  if (confirm("Reset all progress and start a new game?")) {
    localStorage.removeItem("RPGHuntCook_Save_v3");
    player = { ...DEFAULT_PLAYER };
    if (currentMap === "hunt") switchMap();
    generateCustomerOrders();
    updateUI();
    logEl.textContent = "🔄 Started a brand new game!";
  }
}

// --- RPG FORMULAS ---
function getAttackDmg() { return player.str; }
function getTotalDishes() { return player.skewers + player.steaks + player.feasts + player.salads + player.tonics; }
function getMoveSpeed() { return 3 + (player.dex * 0.1); }
function getDodgeChance() { return Math.min(70, (player.dex - 8) * 4); }
function getMaxHp() { return 50 + (player.con * 5); }
function getDamageReduction() { return Math.floor((player.con - 10) / 2); }
function getDoubleDropChance() { return Math.min(75, (player.wis - 8) * 4); }
function getUpgradeCost() {
  let discount = Math.floor((player.cha - 10) * 1.5);
  return Math.max(5, 20 - discount);
}

// --- CONTROLS ---
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === " " && currentMap === "hunt") triggerAttack();
  if (e.key.toLowerCase() === "e" && currentMap === "hunt") grabNearbyItem();
});
window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

let activePointerId = null;
let joystickMoveX = 0;
let joystickMoveY = 0;
const base = document.getElementById("joystick-base");
const knob = document.getElementById("joystick-knob");

base.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  activePointerId = e.pointerId;
  base.setPointerCapture(e.pointerId);
  updateJoystickPosition(e.clientX, e.clientY);
});

base.addEventListener("pointermove", (e) => {
  if (e.pointerId !== activePointerId) return;
  e.preventDefault();
  updateJoystickPosition(e.clientX, e.clientY);
});

base.addEventListener("pointerup", (e) => { if (e.pointerId === activePointerId) resetJoystick(e.pointerId); });
base.addEventListener("pointercancel", (e) => { if (e.pointerId === activePointerId) resetJoystick(e.pointerId); });

function updateJoystickPosition(clientX, clientY) {
  const rect = base.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxRadius = 35;
  const angle = Math.atan2(dy, dx);
  const pull = Math.min(distance, maxRadius);

  joystickMoveX = Math.cos(angle) * (pull / maxRadius);
  joystickMoveY = Math.sin(angle) * (pull / maxRadius);
  knob.style.transform = `translate(${Math.cos(angle) * pull}px, ${Math.sin(angle) * pull}px)`;
}

function resetJoystick(pointerId) {
  if (pointerId !== undefined && base.hasPointerCapture(pointerId)) {
    base.releasePointerCapture(pointerId);
  }
  activePointerId = null;
  joystickMoveX = 0;
  joystickMoveY = 0;
  knob.style.transform = `translate(0px, 0px)`;
}

// --- FORAGING ---
function collectWildItem(item) {
  item.active = false;
  const isDouble = (Math.random() * 100) < getDoubleDropChance();
  const amount = isDouble ? 2 : 1;

  if (item.type === "herb") {
    player.herbs += amount;
    logEl.textContent = isDouble ? `👁️ WISDOM PROC! Gathered 2x 🌿 Wild Herbs!` : `🌿 Gathered 1x Wild Herb!`;
  } else if (item.type === "mushroom") {
    player.mushrooms += amount;
    logEl.textContent = isDouble ? `👁️ WISDOM PROC! Gathered 2x 🍄 Wild Mushrooms!` : `🍄 Gathered 1x Wild Mushroom!`;
  }

  updateUI();

  setTimeout(() => {
    item.x = Math.floor(Math.random() * (canvas.width - 80)) + 40;
    item.y = Math.floor(Math.random() * (canvas.height - 80)) + 40;
    item.active = true;
  }, 4000);
}

function grabNearbyItem() {
  if (currentMap !== "hunt") return;
  let grabbed = false;

  wildItems.forEach(item => {
    if (item.active) {
      const dx = (player.x + player.size / 2) - (item.x + item.size / 2);
      const dy = (player.y + player.size / 2) - (item.y + item.size / 2);
      if (Math.sqrt(dx * dx + dy * dy) < 55) {
        collectWildItem(item);
        grabbed = true;
      }
    }
  });

  if (!grabbed) {
    logEl.textContent = "Walk closer to a 🌿 Herb or 🍄 Mushroom to grab it!";
  }
}

// --- COOKING & ORDERS ---
function cookRecipe(type) {
  if (type === "skewer" && player.rawMeat >= 1) {
    player.rawMeat--; player.skewers++;
    logEl.textContent = "🍳 Cooked 🍖 Meat Skewer!";
  } else if (type === "steak" && player.rawMeat >= 1 && player.herbs >= 1) {
    player.rawMeat--; player.herbs--; player.steaks++;
    logEl.textContent = "🍳 Cooked 🥗 Herb-Roasted Steak!";
  } else if (type === "feast" && player.primeMeat >= 1 && player.mushrooms >= 1) {
    player.primeMeat--; player.mushrooms--; player.feasts++;
    logEl.textContent = "🍳 Cooked 🍖 Prime Beast Feast!";
  } else if (type === "salad" && player.herbs >= 2 && player.mushrooms >= 1) {
    player.herbs -= 2; player.mushrooms--; player.salads++;
    logEl.textContent = "🍳 Cooked 🌿 Forest Herbal Salad (Meat-Free)!";
  } else if (type === "tonic" && player.mushrooms >= 2 && player.herbs >= 1) {
    player.mushrooms -= 2; player.herbs--; player.tonics++;
    logEl.textContent = "🍳 Cooked 🍵 Mystical Mushroom Tonic (Meat-Free)!";
  } else {
    logEl.textContent = "❌ Not enough ingredients for this recipe!";
  }
  updateUI();
}

function fulfillOrder(orderId) {
  const order = customerOrders.find(o => o.id === orderId);
  if (!order) return;

  if (player[order.dishKey] >= order.qty) {
    player[order.dishKey] -= order.qty;
    player.gold += order.reward;
    player.reputation += 15;
    logEl.textContent = `🎉 Order fulfilled! Earned ${order.reward} Gold & +15 Reputation!`;
    
    // Remove completed order and generate a new one
    customerOrders = customerOrders.filter(o => o.id !== orderId);
    const possibleDishes = [
      { key: "skewers", name: "🍖 Meat Skewer", baseGold: 25 },
      { key: "steaks", name: "🥗 Herb-Roasted Steak", baseGold: 50 },
      { key: "feasts", name: "🍖 Prime Beast Feast", baseGold: 110 },
      { key: "salads", name: "🌿 Forest Herbal Salad", baseGold: 75 },
      { key: "tonics", name: "🍵 Mystical Mushroom Tonic", baseGold: 85 }
    ];
    const newDish = possibleDishes[Math.floor(Math.random() * possibleDishes.length)];
    const newQty = Math.floor(Math.random() * 2) + 1;
    const bonus = Math.floor(player.cha * 2);
    customerOrders.push({ id: Date.now(), dishKey: newDish.key, dishName: newDish.name, qty: newQty, reward: (newDish.baseGold * newQty) + bonus });
    
    updateUI();
    openModal('npc-modal');
  } else {
    logEl.textContent = `❌ You don't have enough of that dish in your bag!`;
  }
}

function eatBestDish() {
  const maxHp = getMaxHp();
  if (player.hp >= maxHp || getTotalDishes() < 1) return;

  let healAmt = 0;
  if (player.tonics > 0) { player.tonics--; healAmt = maxHp; }
  else if (player.salads > 0) { player.salads--; healAmt = Math.floor(maxHp * 0.8); }
  else if (player.feasts > 0) { player.feasts--; healAmt = maxHp; }
  else if (player.steaks > 0) { player.steaks--; healAmt = Math.floor(maxHp * 0.7); }
  else if (player.skewers > 0) { player.skewers--; healAmt = Math.floor(maxHp * 0.4); }

  player.hp = Math.min(maxHp, player.hp + healAmt);
  logEl.textContent = `🍲 Ate a cooked dish and restored ${healAmt} HP!`;
  updateUI();
}

// --- UI UPDATES ---
function updateUI() {
  const maxHp = getMaxHp();
  const cost = getUpgradeCost();

  document.getElementById("stat-gold").textContent = `🪙 ${player.gold}`;
  document.getElementById("stat-rep").textContent = `⭐ Rep: ${player.reputation}`;

  document.getElementById("inv-meat").textContent = `🥩 Meat: ${player.rawMeat}`;
  document.getElementById("inv-prime").textContent = `🍖 Prime: ${player.primeMeat}`;
  document.getElementById("inv-herb").textContent = `🌿 Herb: ${player.herbs}`;
  document.getElementById("inv-shroom").textContent = `🍄 Shroom: ${player.mushrooms}`;

  const hpEl = document.getElementById("stat-hp");
  hpEl.textContent = `HP: ${player.hp}/${maxHp}`;
  hpEl.style.color = player.hp <= (maxHp * 0.35) ? "#f38ba8" : "#a6e3a1";

  document.getElementById("disp-str").textContent = `💪 STR: ${player.str}`;
  document.getElementById("disp-dex").textContent = `⚡ DEX: ${player.dex}`;
  document.getElementById("disp-con").textContent = `🛡️ CON: ${player.con}`;
  document.getElementById("disp-int").textContent = `🧠 INT: ${player.int}`;
  document.getElementById("disp-wis").textContent = `👁️ WIS: ${player.wis}`;
  document.getElementById("disp-cha").textContent = `✨ CHA: ${player.cha}`;

  // Render Customer Orders in Modal
  let ordersHTML = "";
  customerOrders.forEach(order => {
    const hasEnough = player[order.dishKey] >= order.qty;
    ordersHTML += `
      <div class="shop-item">
        <span><strong>Order: ${order.qty}x ${order.dishName}</strong><br><small>Reward: ${order.reward} 🪙 & +15 Rep</small></span>
        <button onclick="fulfillOrder(${order.id})" ${hasEnough ? '' : 'disabled'}>${hasEnough ? 'Fulfill' : 'Need Dish'}</button>
      </div>
    `;
  });
  const ordersContainer = document.getElementById("customer-orders-container");
  if (ordersContainer) ordersContainer.innerHTML = ordersHTML;

  if (currentMap === "town") {
    document.getElementById("heal-btn").disabled = getTotalDishes() < 1 || player.hp >= maxHp;
  }

  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(stat => {
    const btn = document.getElementById(`btn-${stat}`);
    if (btn) btn.textContent = `${cost} 🪙`;
  });

  document.getElementById("desc-str").innerHTML = `<strong>💪 Strength (${player.str}):</strong> Carry weight & melee power.<br><em>Effect: ${getAttackDmg()} DMG</em>`;
  document.getElementById("desc-dex").innerHTML = `<strong>⚡ Dexterity (${player.dex}):</strong> Speed & auto-dodge.<br><em>Effect: Speed ${getMoveSpeed().toFixed(1)} | ${getDodgeChance()}% Dodge</em>`;
  document.getElementById("desc-con").innerHTML = `<strong>🛡️ Constitution (${player.con}):</strong> Health & defense.<br><em>Effect: ${maxHp} Max HP | -${getDamageReduction()} DMG Taken</em>`;
  document.getElementById("desc-int").innerHTML = `<strong>🧠 Intelligence (${player.int}):</strong> Logic & recipe mastery.`;
  document.getElementById("desc-wis").innerHTML = `<strong>👁️ Wisdom (${player.wis}):</strong> Foraging instinct.<br><em>Effect: ${getDoubleDropChance()}% double-harvest chance</em>`;
  document.getElementById("desc-cha").innerHTML = `<strong>✨ Charisma (${player.cha}):</strong> Social influence.<br><em>Effect: Shop discounts & customer order gold tips</em>`;
}

// --- COMBAT & MONSTERS ---
function respawnAllEnemies() {
  enemies.forEach(e => {
    e.hp = e.maxHp;
    e.alive = true;
    e.state = "idle";
    e.windupTimer = 0;
    e.cooldownTimer = 0;
  });
}

function getClosestAliveEnemy() {
  let closest = null;
  let minDist = 9999;
  enemies.forEach(e => {
    if (e.alive) {
      const dx = (player.x + player.size / 2) - (e.x + e.size / 2);
      const dy = (player.y + player.size / 2) - (e.y + e.size / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closest = e;
      }
    }
  });
  return { enemy: closest, dist: minDist };
}

function triggerAttack() {
  if (currentMap !== "hunt" || player.hp <= 0) return;

  const { enemy, dist } = getClosestAliveEnemy();
  if (enemy && dist < 75) {
    const dmg = getAttackDmg();
    enemy.hp -= dmg;

    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.state = "idle";
      const isDouble = (Math.random() * 100) < getDoubleDropChance();
      const gained = isDouble ? 2 : 1;

      if (enemy.dropType === "prime") {
        player.primeMeat += gained;
        logEl.textContent = `🏆 DEFEATED ORC BOSS! Harvested ${gained}x 🍖 Prime Meat!`;
      } else {
        player.rawMeat += gained;
        logEl.textContent = `⚔️ Defeated ${enemy.name}! Harvested ${gained}x 🥩 Meat!`;
      }

      updateUI();
      
      // Check if all enemies are defeated, respawn after 3s
      if (enemies.every(e => !e.alive)) {
        setTimeout(respawnAllEnemies, 3000);
      }
    } else {
      if (enemy.state === "idle") {
        enemy.state = "windup";
        enemy.windupTimer = enemy.maxWindup;
        logEl.textContent = `Hit ${enemy.name} for ${dmg} DMG! ⚠️ It's winding up an attack!`;
      } else {
        logEl.textContent = `Hit ${enemy.name} for ${dmg} DMG!`;
      }
    }
    updateUI();
  } else {
    logEl.textContent = "Too far away from any monster!";
  }
}

function openModal(id) { updateUI(); document.getElementById(id).style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }

function buyUpgrade(stat) {
  const cost = getUpgradeCost();
  if (player.gold >= cost) {
    player.gold -= cost;
    player[stat] += 2;
    if (stat === 'con') player.hp = getMaxHp();
    logEl.textContent = `Trained ${stat.toUpperCase()} +2 in Town!`;
    updateUI();
  } else {
    logEl.textContent = `Not enough Gold! Need ${cost} 🪙.`;
  }
}

// --- MAIN LOOP ---
function update() {
  if (player.hp <= 0) return;

  let moveX = joystickMoveX;
  let moveY = joystickMoveY;

  if (keys["w"] || keys["arrowup"]) moveY = -1;
  if (keys["s"] || keys["arrowdown"]) moveY = 1;
  if (keys["a"] || keys["arrowleft"]) moveX = -1;
  if (keys["d"] || keys["arrowright"]) moveX = 1;

  const spd = getMoveSpeed();
  if (moveX !== 0 || moveY !== 0) {
    player.x += moveX * spd;
    player.y += moveY * spd;
  }

  player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(20, Math.min(canvas.height - player.size, player.y));

  // Foraging herbs/mushrooms
  if (currentMap === "hunt") {
    wildItems.forEach(item => {
      if (item.active) {
        const dx = (player.x + player.size / 2) - (item.x + item.size / 2);
        const dy = (player.y + player.size / 2) - (item.y + item.size / 2);
        if (Math.sqrt(dx * dx + dy * dy) < 30) {
          collectWildItem(item);
        }
      }
    });

    // Monster AI update
    enemies.forEach(e => {
      if (e.alive) {
        const dx = (player.x + player.size / 2) - (e.x + e.size / 2);
        const dy = (player.y + player.size / 2) - (e.y + e.size / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (e.state === "idle") {
          if (dist < 65 && e.cooldownTimer === 0) {
            e.state = "windup";
            e.windupTimer = e.maxWindup;
          }
          if (e.cooldownTimer > 0) e.cooldownTimer--;
        } 
        else if (e.state === "windup") {
          e.windupTimer--;

          if (e.windupTimer <= 0) {
            e.state = "idle";
            e.cooldownTimer = 60;

            if (dist < 80) {
              const autoDodged = (Math.random() * 100) < getDodgeChance();

              if (autoDodged) {
                logEl.textContent = `⚡ AUTO-DODGE! Your DEX evaded the ${e.name}'s attack!`;
              } else {
                const taken = Math.max(1, e.atk - getDamageReduction());
                player.hp = Math.max(0, player.hp - taken);
                logEl.textContent = `💥 ${e.name} hit you for ${taken} DMG!`;
                if (player.hp === 0) logEl.textContent = "💀 You fainted! Return to Town or reset.";
              }
              updateUI();
            }
          }
        }
      }
    });
  }
}

// --- RENDER ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentMap === "town") {
    // Kitchen Building
    ctx.fillStyle = "#313244";
    ctx.fillRect(30, 50, 160, 140);
    ctx.strokeStyle = "#89dceb";
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 50, 160, 140);
    
    ctx.fillStyle = "#89dceb";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🍳 KITCHEN", 110, 85);

    // Customer Board Building (Middle)
    ctx.fillStyle = "#313244";
    ctx.fillRect(220, 50, 160, 140);
    ctx.strokeStyle = "#fab387";
    ctx.strokeRect(220, 50, 160, 140);

    ctx.fillStyle = "#fab387";
    ctx.fillText("🗣️ ORDERS BOARD", 300, 85);

    // Shop Building (Right)
    ctx.fillStyle = "#313244";
    ctx.fillRect(410, 50, 160, 140);
    ctx.strokeStyle = "#f9e2af";
    ctx.strokeRect(410, 50, 160, 140);

    ctx.fillStyle = "#f9e2af";
    ctx.fillText("🛒 VILLAGE SHOP", 490, 85);

    // Hero
    ctx.fillStyle = "#89b4fa";
    ctx.fillRect(player.x, player.y, player.size, player.size);
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px sans-serif";
    ctx.fillText("Hero", player.x + player.size / 2, player.y - 6);

  } else {
    // Hunting Grounds grid
    ctx.strokeStyle = "#24273a";
    ctx.lineWidth = 1;
    for (let i = 50; i < canvas.width; i += 100) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }

    // Wild Items
    wildItems.forEach(item => {
      if (item.active) {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(item.x + item.size / 2, item.y + item.size / 2, item.size / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#cdd6f4";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(item.icon, item.x + item.size / 2, item.y - 4);
      }
    });

    // Draw Monsters
    enemies.forEach(e => {
      if (e.alive) {
        if (e.state === "windup") {
          ctx.beginPath();
          ctx.arc(e.x + e.size / 2, e.y + e.size / 2, 70, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(249, 226, 175, 0.1)";
          ctx.fill();
        }

        let shakeX = 0;
        if (e.state === "windup") {
          shakeX = (Math.random() - 0.5) * 6;
          ctx.fillStyle = "#f9e2af";
        } else {
          ctx.fillStyle = e.color;
        }

        ctx.fillRect(e.x + shakeX, e.y, e.size, e.size);

        // Monster HP bar
        ctx.fillStyle = "#45475a";
        ctx.fillRect(e.x, e.y - 8, e.size, 5);
        ctx.fillStyle = "#fab387";
        ctx.fillRect(e.x, e.y - 8, e.size * (e.hp / e.maxHp), 5);

        if (e.state === "windup") {
          ctx.fillStyle = "#f9e2af";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("⚠️ !", e.x + e.size / 2, e.y - 22);

          const chargeRatio = e.windupTimer / e.maxWindup;
          ctx.fillStyle = "#f38ba8";
          ctx.fillRect(e.x, e.y - 16, e.size * chargeRatio, 4);
        }
      }
    });

    // Hero
    ctx.fillStyle = "#89b4fa";
    ctx.fillRect(player.x, player.y, player.size, player.size);

    // Hero HP Bar
    const maxHp = getMaxHp();
    const hpRatio = player.hp / maxHp;
    ctx.fillStyle = "#45475a";
    ctx.fillRect(player.x - 4, player.y - 8, player.size + 8, 5);
    ctx.fillStyle = hpRatio <= 0.35 ? "#f38ba8" : "#a6e3a1";
    ctx.fillRect(player.x - 4, player.y - 8, (player.size + 8) * hpRatio, 5);
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

document.getElementById("mobile-controls").style.display = "none";

loadGame();
updateUI();
gameLoop();
