const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");

let currentMap = "town";

const DEFAULT_PLAYER = {
  x: 270,
  y: 130,
  size: 28,
  hp: 100,
  gold: 0,
  // Ingredients
  rawMeat: 0,
  herbs: 0,
  mushrooms: 0,
  // Cooked Dishes
  skewers: 0,
  steaks: 0,
  stews: 0,
  // Unlocked Recipes
  unlockedSteak: false,
  unlockedStew: false,
  // 6 Core RPG Attributes
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10
};

let player = { ...DEFAULT_PLAYER };

let enemy = {
  x: 450,
  y: 130,
  size: 34,
  hp: 30,
  maxHp: 30,
  atk: 15,
  alive: true,
  state: "idle",
  windupTimer: 0,
  maxWindup: 55,
  cooldownTimer: 0
};

// Wild Foraging Items on the Hunting Grounds Map
let wildItems = [];

function spawnWildItems() {
  wildItems = [
    { type: "herb", icon: "🌿", color: "#a6e3a1", x: 180, y: 70, size: 22, active: true },
    { type: "herb", icon: "🌿", color: "#a6e3a1", x: 340, y: 220, size: 22, active: true },
    { type: "mushroom", icon: "🍄", color: "#fab387", x: 480, y: 65, size: 22, active: true }
  ];
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
        🌲 HUNTING GROUNDS: Walk over 🌿/🍄 or tap GRAB, and hunt Slimes!
      </div>
    `;
    logEl.textContent = "Entered Hunting Grounds! Grab 🌿 Herbs & 🍄 Mushrooms to unlock new recipes!";
    player.x = 60; 
    player.y = 130;
    spawnWildItems();
  } else {
    currentMap = "town";
    document.getElementById("map-toggle-btn").textContent = "🌲 Travel to Hunting Grounds";
    document.getElementById("map-toggle-btn").style.backgroundColor = "#a6e3a1";
    document.getElementById("mobile-controls").style.display = "none";

    document.getElementById("action-panel").innerHTML = `
      <div id="town-controls" class="action-group">
        <button id="kitchen-btn" onclick="openModal('kitchen-modal')">🍳 KITCHEN</button>
        <button id="heal-btn" onclick="eatBestDish()" disabled>🍲 Eat Dish</button>
        <button id="sell-btn" onclick="sellAllDishes()" disabled>Sell All</button>
        <button id="shop-btn" onclick="openModal('shop-modal')">🛒 SHOP</button>
        <button id="char-btn" onclick="openModal('char-modal')">📜 STATS</button>
      </div>
    `;
    logEl.textContent = "Returned safely to Town! Open 🍳 KITCHEN to cook your ingredients.";
    player.x = 270; 
    player.y = 130;
    updateUI();
  }
}

// --- SAVE & LOAD SYSTEM ---
function saveGame() {
  const saveData = { ...player };
  localStorage.setItem("RPGHuntCook_Save_v2", JSON.stringify(saveData));
  logEl.textContent = "💾 Game Saved! Recipes, ingredients, and stats are safe.";
}

function loadGame() {
  const saved = localStorage.getItem("RPGHuntCook_Save_v2");
  if (saved) {
    const parsed = JSON.parse(saved);
    player = { ...DEFAULT_PLAYER, ...parsed };
    logEl.textContent = "📂 Save file loaded!";
  }
}

function resetGame() {
  if (confirm("Reset all progress and start a new game?")) {
    localStorage.removeItem("RPGHuntCook_Save_v2");
    player = { ...DEFAULT_PLAYER };
    if (currentMap === "hunt") switchMap();
    respawnEnemy();
    updateUI();
    logEl.textContent = "🔄 Started a brand new game!";
  }
}

// --- RPG FORMULAS ---
function getAttackDmg() { return player.str; }
function getMaxBagWeight() { return Math.floor(player.str * 0.6); } // 10 STR = 6 total items
function getCurrentBagWeight() { return player.rawMeat + player.herbs + player.mushrooms; }
function getTotalDishes() { return player.skewers + player.steaks + player.stews; }
function getMoveSpeed() { return 3 + (player.dex * 0.1); }
function getDodgeChance() { return Math.min(70, (player.dex - 8) * 4); }
function getMaxHp() { return 50 + (player.con * 5); }
function getDamageReduction() { return Math.floor((player.con - 10) / 2); }
function getDoubleDropChance() { return Math.min(75, (player.wis - 8) * 4); }
function getUpgradeCost() {
  let discount = Math.floor((player.cha - 10) * 1.5);
  return Math.max(5, 20 - discount);
}

// Dish Prices boosted by Intelligence & Charisma
function getDishValues() {
  const bonus = Math.floor(player.int * 0.8) + Math.floor(player.cha * 0.5);
  return {
    skewer: 12 + bonus,
    steak: 28 + (bonus * 2),
    stew: 55 + (bonus * 3)
  };
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

// --- FORAGING / GRABBING INGREDIENTS ---
function collectWildItem(item) {
  if (getCurrentBagWeight() >= getMaxBagWeight()) {
    logEl.textContent = "🎒 Bag is FULL! Return to Town to cook or upgrade STR!";
    return;
  }

  item.active = false;
  const isDouble = (Math.random() * 100) < getDoubleDropChance();
  const spaceLeft = getMaxBagWeight() - getCurrentBagWeight();
  const amount = Math.min(spaceLeft, isDouble ? 2 : 1);

  if (item.type === "herb") {
    player.herbs += amount;
    if (!player.unlockedSteak) {
      player.unlockedSteak = true;
      logEl.textContent = `🎉 NEW RECIPE UNLOCKED! Grabbed 🌿 Herb -> Unlocked Herb-Roasted Steak!`;
    } else {
      logEl.textContent = isDouble
        ? `👁️ WISDOM PROC! Gathered 2x 🌿 Wild Herbs!`
        : `🌿 Grabbed 1x Wild Herb!`;
    }
  } else if (item.type === "mushroom") {
    player.mushrooms += amount;
    if (!player.unlockedStew) {
      player.unlockedStew = true;
      logEl.textContent = `🎉 NEW RECIPE UNLOCKED! Grabbed 🍄 Mushroom -> Unlocked Royal Mushroom Stew!`;
    } else {
      logEl.textContent = isDouble
        ? `👁️ WISDOM PROC! Gathered 2x 🍄 Wild Mushrooms!`
        : `🍄 Grabbed 1x Wild Mushroom!`;
    }
  }

  updateUI();

  // Respawn this wild plant in a new random spot after 4 seconds
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

// --- COOKING & SELLING RECIPES ---
function cookRecipe(type) {
  const vals = getDishValues();

  if (type === "skewer" && player.rawMeat >= 1) {
    player.rawMeat--;
    player.skewers++;
    logEl.textContent = `🍳 Cooked 🍖 Meat Skewer! (Worth ${vals.skewer} 🪙)`;
  } 
  else if (type === "steak" && player.unlockedSteak && player.rawMeat >= 1 && player.herbs >= 1) {
    player.rawMeat--;
    player.herbs--;
    player.steaks++;
    logEl.textContent = `🍳 Cooked 🥗 Herb-Roasted Steak! (Worth ${vals.steak} 🪙)`;
  } 
  else if (type === "stew" && player.unlockedStew && player.rawMeat >= 1 && player.herbs >= 1 && player.mushrooms >= 1) {
    player.rawMeat--;
    player.herbs--;
    player.mushrooms--;
    player.stews++;
    logEl.textContent = `🍳 Cooked 🍲 Royal Mushroom Stew! (Worth ${vals.stew} 🪙)`;
  }
  updateUI();
}

function eatBestDish() {
  const maxHp = getMaxHp();
  if (player.hp >= maxHp || getTotalDishes() < 1) return;

  let healAmt = 0;
  let dishName = "";

  if (player.skewers > 0) {
    player.skewers--;
    healAmt = Math.floor(maxHp * 0.4);
    dishName = "🍖 Meat Skewer";
  } else if (player.steaks > 0) {
    player.steaks--;
    healAmt = Math.floor(maxHp * 0.75);
    dishName = "🥗 Herb-Roasted Steak";
  } else if (player.stews > 0) {
    player.stews--;
    healAmt = maxHp;
    dishName = "🍲 Royal Mushroom Stew";
  }

  player.hp = Math.min(maxHp, player.hp + healAmt);
  logEl.textContent = `Ate ${dishName} and restored ${healAmt} HP!`;
  updateUI();
}

function sellAllDishes() {
  if (getTotalDishes() < 1) return;
  const vals = getDishValues();
  const totalEarned = (player.skewers * vals.skewer) + (player.steaks * vals.steak) + (player.stews * vals.stew);
  const count = getTotalDishes();

  player.skewers = 0;
  player.steaks = 0;
  player.stews = 0;
  player.gold += totalEarned;

  logEl.textContent = `🪙 Sold ${count} cooked dish(es) to hungry villagers for ${totalEarned} Gold!`;
  updateUI();
}

// --- UI UPDATES ---
function updateUI() {
  const maxHp = getMaxHp();
  const maxBag = getMaxBagWeight();
  const curBag = getCurrentBagWeight();
  const cost = getUpgradeCost();
  const vals = getDishValues();

  document.getElementById("stat-gold").textContent = `🪙 ${player.gold}`;
  document.getElementById("stat-bag").textContent = `🎒 ${curBag}/${maxBag}`;
  document.getElementById("stat-dish").textContent = `🍽️ ${getTotalDishes()}`;

  document.getElementById("inv-meat").textContent = `🥩 Meat: ${player.rawMeat}`;
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

  // Update Kitchen Modal Recipes
  document.getElementById("val-skewer").textContent = vals.skewer;
  document.getElementById("cook-skewer").disabled = player.rawMeat < 1;

  if (player.unlockedSteak) {
    document.getElementById("recipe-info-steak").innerHTML = `
      <strong>🥗 Herb-Roasted Steak</strong><br>
      <small>Requires: 1 🥩 + 1 🌿 | Value: ${vals.steak} 🪙</small>
    `;
    const btnSteak = document.getElementById("cook-steak");
    btnSteak.textContent = "Cook";
    btnSteak.disabled = !(player.rawMeat >= 1 && player.herbs >= 1);
  }

  if (player.unlockedStew) {
    document.getElementById("recipe-info-stew").innerHTML = `
      <strong>🍲 Royal Mushroom Stew</strong><br>
      <small>Requires: 1 🥩 + 1 🌿 + 1 🍄 | Value: ${vals.stew} 🪙</small>
    `;
    const btnStew = document.getElementById("cook-stew");
    btnStew.textContent = "Cook";
    btnStew.disabled = !(player.rawMeat >= 1 && player.herbs >= 1 && player.mushrooms >= 1);
  }

  // Town Bar Buttons
  if (currentMap === "town") {
    const totalDishes = getTotalDishes();
    document.getElementById("heal-btn").disabled = totalDishes < 1 || player.hp >= maxHp;
    const sellBtn = document.getElementById("sell-btn");
    sellBtn.disabled = totalDishes < 1;
    const potentialGold = (player.skewers * vals.skewer) + (player.steaks * vals.steak) + (player.stews * vals.stew);
    sellBtn.textContent = totalDishes > 0 ? `Sell (+${potentialGold} 🪙)` : "Sell All";
  }

  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(stat => {
    const btn = document.getElementById(`btn-${stat}`);
    if (btn) btn.textContent = `${cost} 🪙`;
  });

  document.getElementById("desc-str").innerHTML = `<strong>💪 Strength (${player.str}):</strong> Carry weight & melee power.<br><em>Effect: ${getAttackDmg()} DMG | Max Bag: ${maxBag} Ingredients</em>`;
  document.getElementById("desc-dex").innerHTML = `<strong>⚡ Dexterity (${player.dex}):</strong> Speed & auto-dodge.<br><em>Effect: Speed ${getMoveSpeed().toFixed(1)} | ${getDodgeChance()}% Auto-Dodge Chance</em>`;
  document.getElementById("desc-con").innerHTML = `<strong>🛡️ Constitution (${player.con}):</strong> Health & defense.<br><em>Effect: ${maxHp} Max HP | -${getDamageReduction()} DMG Taken</em>`;
  document.getElementById("desc-int").innerHTML = `<strong>🧠 Intelligence (${player.int}):</strong> Logic & recipe mastery.<br><em>Effect: Boosts all cooked recipe gold values</em>`;
  document.getElementById("desc-wis").innerHTML = `<strong>👁️ Wisdom (${player.wis}):</strong> Perception & foraging.<br><em>Effect: ${getDoubleDropChance()}% chance for 2x Meat/Herbs</em>`;
  document.getElementById("desc-cha").innerHTML = `<strong>✨ Charisma (${player.cha}):</strong> Social influence.<br><em>Effect: Shop upgrades cost ${cost} 🪙 + extra sell tips</em>`;
}

// --- COMBAT ---
function respawnEnemy() {
  enemy.hp = enemy.maxHp;
  enemy.alive = true;
  enemy.state = "idle";
  enemy.windupTimer = 0;
  enemy.cooldownTimer = 0;
  enemy.x = Math.floor(Math.random() * (canvas.width - 100)) + 50;
  enemy.y = Math.floor(Math.random() * (canvas.height - 100)) + 50;
}

function getDistanceToEnemy() {
  const dx = (player.x + player.size / 2) - (enemy.x + enemy.size / 2);
  const dy = (player.y + player.size / 2) - (enemy.y + enemy.size / 2);
  return Math.sqrt(dx * dx + dy * dy);
}

function triggerAttack() {
  if (currentMap !== "hunt" || !enemy.alive || player.hp <= 0) return;

  if (getDistanceToEnemy() < 75) {
    if (getCurrentBagWeight() >= getMaxBagWeight()) {
      logEl.textContent = "🎒 Bag is FULL! Return to Town to cook or upgrade STR!";
      return;
    }

    const dmg = getAttackDmg();
    enemy.hp -= dmg;

    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.state = "idle";
      const isDouble = (Math.random() * 100) < getDoubleDropChance();
      const spaceLeft = getMaxBagWeight() - getCurrentBagWeight();
      const gained = Math.min(spaceLeft, isDouble ? 2 : 1);
      player.rawMeat += gained;

      logEl.textContent = isDouble && gained === 2
        ? `👁️ WISDOM PROC! Slain Slime & harvested 2x Raw Meat! (🥩)`
        : `Defeated Slime! Harvested ${gained}x Raw Meat (🥩).`;

      updateUI();
      setTimeout(respawnEnemy, 1500);
    } else {
      if (enemy.state === "idle") {
        enemy.state = "windup";
        enemy.windupTimer = enemy.maxWindup;
        logEl.textContent = `Hit Slime for ${dmg} DMG! ⚠️ Slime is preparing to strike!`;
      } else {
        logEl.textContent = `Hit Slime for ${dmg} DMG!`;
      }
    }
    updateUI();
  } else {
    logEl.textContent = "Too far away from the slime!";
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
    logEl.textContent = `Trained ${stat.toUpperCase()} +2 in Town! Check 📜 STATS.`;
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

  // Auto-grab wild herbs/mushrooms when walking right over them!
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
  }

  // Enemy AI in Hunting Map
  if (currentMap === "hunt" && enemy.alive) {
    const dist = getDistanceToEnemy();

    if (enemy.state === "idle") {
      if (dist < 60 && enemy.cooldownTimer === 0) {
        enemy.state = "windup";
        enemy.windupTimer = enemy.maxWindup;
        logEl.textContent = "⚠️ Slime is charging! Your DEX will attempt to auto-dodge!";
      }
      if (enemy.cooldownTimer > 0) enemy.cooldownTimer--;
    } 
    else if (enemy.state === "windup") {
      enemy.windupTimer--;

      if (enemy.windupTimer <= 0) {
        enemy.state = "idle";
        enemy.cooldownTimer = 60;

        if (dist < 75) {
          const autoDodged = (Math.random() * 100) < getDodgeChance();

          if (autoDodged) {
            logEl.textContent = `⚡ AUTO-DODGE! Your DEX (${player.dex}) evaded the Slime's attack!`;
          } else {
            const taken = Math.max(1, enemy.atk - getDamageReduction());
            player.hp = Math.max(0, player.hp - taken);
            logEl.textContent = `💥 Slime hit you for ${taken} DMG!`;
            if (player.hp === 0) {
              logEl.textContent = "💀 You fainted! Return to Town or reset game.";
            }
          }
          updateUI();
        } else {
          logEl.textContent = "💨 Slime swung and missed you!";
        }
      }
    }
  }
}

// --- RENDER ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentMap === "town") {
    // Kitchen Building
    ctx.fillStyle = "#313244";
    ctx.fillRect(40, 60, 180, 140);
    ctx.strokeStyle = "#89dceb";
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 60, 180, 140);
    
    ctx.fillStyle = "#89dceb";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🍳 TOWN KITCHEN", 130, 100);
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#cdd6f4";
    ctx.fillText("(Tap KITCHEN for Recipes)", 130, 120);

    // Shop Building
    ctx.fillStyle = "#313244";
    ctx.fillRect(380, 60, 180, 140);
    ctx.strokeStyle = "#f9e2af";
    ctx.lineWidth = 2;
    ctx.strokeRect(380, 60, 180, 140);

    ctx.fillStyle = "#f9e2af";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("🛒 VILLAGE SHOP", 470, 100);
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#cdd6f4";
    ctx.fillText("(Sell Food & Buy Stats)", 470, 120);

    // Hero
    ctx.fillStyle = "#89b4fa";
    ctx.fillRect(player.x, player.y, player.size, player.size);
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px sans-serif";
    ctx.fillText("Hero", player.x + player.size / 2, player.y - 6);

  } else {
    // Hunting Grounds Grid
    ctx.strokeStyle = "#24273a";
    ctx.lineWidth = 1;
    for (let i = 50; i < canvas.width; i += 100) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }

    // Draw Wild Herbs & Mushrooms
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

    // Enemy Attack Danger Ring
    if (enemy.state === "windup") {
      ctx.beginPath();
      ctx.arc(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, 75, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(249, 226, 175, 0.1)";
      ctx.fill();
    }

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

    // Enemy
    if (enemy.alive) {
      let shakeX = 0;
      if (enemy.state === "windup") {
        shakeX = (Math.random() - 0.5) * 6;
        ctx.fillStyle = "#f9e2af";
      } else {
        ctx.fillStyle = "#f38ba8";
      }

      ctx.fillRect(enemy.x + shakeX, enemy.y, enemy.size, enemy.size);

      ctx.fillStyle = "#45475a";
      ctx.fillRect(enemy.x, enemy.y - 8, enemy.size, 5);
      ctx.fillStyle = "#fab387";
      ctx.fillRect(enemy.x, enemy.y - 8, enemy.size * (enemy.hp / enemy.maxHp), 5);

      if (enemy.state === "windup") {
        ctx.fillStyle = "#f9e2af";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("⚠️ !", enemy.x + enemy.size / 2, enemy.y - 22);

        const chargeRatio = enemy.windupTimer / enemy.maxWindup;
        ctx.fillStyle = "#f38ba8";
        ctx.fillRect(enemy.x, enemy.y - 16, enemy.size * chargeRatio, 4);
      }
    }
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
