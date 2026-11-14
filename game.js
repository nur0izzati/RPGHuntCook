const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");

// --- FUTURE IMAGE HOOKS (Uncomment when adding your own artwork) ---
// const heroImg = new Image(); heroImg.src = "hero.png";
// const slimeImg = new Image(); slimeImg.src = "slime.png";

const DEFAULT_PLAYER = {
  x: 100,
  y: 150,
  size: 28,
  hp: 100,
  gold: 0,
  rawMeat: 0,
  cookedDishes: 0,
  isDodging: false,
  dodgeTimer: 0,
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10
};

let player = { ...DEFAULT_PLAYER };

// Enemy with Telegraphed Attack State
let enemy = {
  x: 450,
  y: 150,
  size: 34,
  hp: 30,
  maxHp: 30,
  atk: 15,
  alive: true,
  state: "idle",       // "idle" | "windup" | "cooldown"
  windupTimer: 0,
  maxWindup: 55,       // ~0.9 seconds warning before strike!
  cooldownTimer: 0
};

// --- SAVE & LOAD SYSTEM ---
function saveGame() {
  const saveData = {
    hp: player.hp,
    gold: player.gold,
    rawMeat: player.rawMeat,
    cookedDishes: player.cookedDishes,
    str: player.str,
    dex: player.dex,
    con: player.con,
    int: player.int,
    wis: player.wis,
    cha: player.cha
  };
  localStorage.setItem("RPGHuntCook_Save", JSON.stringify(saveData));
  logEl.textContent = "💾 Game Saved! Your stats, gold, and items are safe.";
}

function loadGame() {
  const saved = localStorage.getItem("RPGHuntCook_Save");
  if (saved) {
    const parsed = JSON.parse(saved);
    player = { ...DEFAULT_PLAYER, ...parsed };
    logEl.textContent = "📂 Save file loaded! Welcome back.";
  }
}

function resetGame() {
  if (confirm("Reset all progress and start a new game?")) {
    localStorage.removeItem("RPGHuntCook_Save");
    player = { ...DEFAULT_PLAYER };
    respawnEnemy();
    updateUI();
    logEl.textContent = "🔄 Started a brand new game!";
  }
}

// --- RPG STAT FORMULAS ---
function getAttackDmg() { return player.str; }
function getMaxBagWeight() { return Math.floor(player.str / 2); }
function getMoveSpeed() { return 3 + (player.dex * 0.1); }
function getDodgeChance() { return Math.min(65, (player.dex - 8) * 4); }
function getMaxHp() { return 50 + (player.con * 5); }
function getDamageReduction() { return Math.floor((player.con - 10) / 2); }
function getDishSellPrice() { return 10 + Math.floor(player.int * 0.8) + Math.floor(player.cha * 0.5); }
function getDoubleDropChance() { return Math.min(75, (player.wis - 8) * 4); }
function getUpgradeCost() {
  let discount = Math.floor((player.cha - 10) * 1.5);
  return Math.max(5, 20 - discount);
}

// --- KEYBOARD & MULTI-TOUCH POINTER JOYSTICK ---
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === " ") triggerAttack();
  if (e.key.toLowerCase() === "shift") triggerDodge();
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

base.addEventListener("pointerup", (e) => {
  if (e.pointerId === activePointerId) resetJoystick(e.pointerId);
});

base.addEventListener("pointercancel", (e) => {
  if (e.pointerId === activePointerId) resetJoystick(e.pointerId);
});

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

// --- UI & CHARACTER SHEET UPDATES ---
function updateUI() {
  const maxHp = getMaxHp();
  const maxBag = getMaxBagWeight();
  const cost = getUpgradeCost();

  document.getElementById("stat-gold").textContent = `🪙 ${player.gold}`;
  document.getElementById("stat-meat").textContent = `🥩 ${player.rawMeat}/${maxBag}`;
  document.getElementById("stat-dish").textContent = `🍖 ${player.cookedDishes}`;

  const hpEl = document.getElementById("stat-hp");
  hpEl.textContent = `HP: ${player.hp}/${maxHp}`;
  hpEl.style.color = player.hp <= (maxHp * 0.35) ? "#f38ba8" : "#a6e3a1";

  document.getElementById("disp-str").textContent = `💪 STR: ${player.str}`;
  document.getElementById("disp-dex").textContent = `⚡ DEX: ${player.dex}`;
  document.getElementById("disp-con").textContent = `🛡️ CON: ${player.con}`;
  document.getElementById("disp-int").textContent = `🧠 INT: ${player.int}`;
  document.getElementById("disp-wis").textContent = `👁️ WIS: ${player.wis}`;
  document.getElementById("disp-cha").textContent = `✨ CHA: ${player.cha}`;

  document.getElementById("cook-btn").disabled = player.rawMeat < 1;

  const healBtn = document.getElementById("heal-btn");
  healBtn.disabled = player.cookedDishes < 1 || player.hp >= maxHp;

  const sellBtn = document.getElementById("sell-btn");
  sellBtn.disabled = player.cookedDishes < 1;
  sellBtn.textContent = `Sell (+${getDishSellPrice()} 🪙)`;

  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(stat => {
    document.getElementById(`btn-${stat}`).textContent = `${cost} 🪙`;
  });

  document.getElementById("desc-str").innerHTML = `<strong>💪 Strength (${player.str}):</strong> Carry weight & melee power.<br><em>Effect: ${getAttackDmg()} DMG | Max Carry: ${maxBag} Meat</em>`;
  document.getElementById("desc-dex").innerHTML = `<strong>⚡ Dexterity (${player.dex}):</strong> Speed & reflex.<br><em>Effect: Speed ${getMoveSpeed().toFixed(1)} | ${getDodgeChance()}% Passive Dodge</em>`;
  document.getElementById("desc-con").innerHTML = `<strong>🛡️ Constitution (${player.con}):</strong> Health & defense.<br><em>Effect: ${maxHp} Max HP | -${getDamageReduction()} DMG Taken</em>`;
  document.getElementById("desc-int").innerHTML = `<strong>🧠 Intelligence (${player.int}):</strong> Logic & recipe mastery.<br><em>Effect: Boosts dish gold value</em>`;
  document.getElementById("desc-wis").innerHTML = `<strong>👁️ Wisdom (${player.wis}):</strong> Perception & instinct.<br><em>Effect: ${getDoubleDropChance()}% chance for 2x meat</em>`;
  document.getElementById("desc-cha").innerHTML = `<strong>✨ Charisma (${player.cha}):</strong> Social influence.<br><em>Effect: Shop upgrades cost ${cost} 🪙</em>`;
}

// --- GAMEPLAY ACTIONS ---
function respawnEnemy() {
  enemy.hp = enemy.maxHp;
  enemy.alive = true;
  enemy.state = "idle";
  enemy.windupTimer = 0;
  enemy.cooldownTimer = 0;
  enemy.x = Math.floor(Math.random() * (canvas.width - 100)) + 50;
  enemy.y = Math.floor(Math.random() * (canvas.height - 100)) + 50;
}

function cookDish() {
  if (player.rawMeat >= 1) {
    player.rawMeat--;
    player.cookedDishes++;
    logEl.textContent = "Cooked 1 Raw Meat into a hearty dish! 🍖";
    updateUI();
  }
}

function healPlayer() {
  const maxHp = getMaxHp();
  if (player.cookedDishes >= 1 && player.hp < maxHp) {
    player.cookedDishes--;
    const healAmount = Math.floor(maxHp * 0.5);
    player.hp = Math.min(maxHp, player.hp + healAmount);
    logEl.textContent = `🍲 Ate a hot stew and restored ${healAmount} HP!`;
    updateUI();
  }
}

function sellDish() {
  if (player.cookedDishes >= 1) {
    player.cookedDishes--;
    const earned = getDishSellPrice();
    player.gold += earned;
    logEl.textContent = `Sold dish for ${earned} Gold! 🪙`;
    updateUI();
  }
}

function triggerDodge() {
  if (player.dodgeTimer > 0 || player.hp <= 0) return;
  player.isDodging = true;
  player.dodgeTimer = 45;
  logEl.textContent = "🏃‍♂️ DODGE ROLL! Invulnerable for a split second!";
  setTimeout(() => { player.isDodging = false; }, 450);
}

function getDistanceToEnemy() {
  const dx = (player.x + player.size / 2) - (enemy.x + enemy.size / 2);
  const dy = (player.y + player.size / 2) - (enemy.y + enemy.size / 2);
  return Math.sqrt(dx * dx + dy * dy);
}

function triggerAttack() {
  if (!enemy.alive || player.hp <= 0) return;

  if (getDistanceToEnemy() < 75) {
    if (player.rawMeat >= getMaxBagWeight()) {
      logEl.textContent = "Bag is FULL! Cook your meat or upgrade STR! 🎒";
      return;
    }

    const dmg = getAttackDmg();
    enemy.hp -= dmg;

    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.state = "idle";
      const isDouble = (Math.random() * 100) < getDoubleDropChance();
      const gained = isDouble ? 2 : 1;
      player.rawMeat = Math.min(getMaxBagWeight(), player.rawMeat + gained);

      logEl.textContent = isDouble
        ? `👁️ WISDOM PROC! Slain Slime & harvested 2x Raw Meat! (🥩)`
        : `Defeated Slime! Harvested 1x Raw Meat (🥩).`;

      updateUI();
      setTimeout(respawnEnemy, 1500);
    } else {
      // Trigger the Slime's telegraphed counter-attack if it isn't already winding up!
      if (enemy.state === "idle") {
        enemy.state = "windup";
        enemy.windupTimer = enemy.maxWindup;
        logEl.textContent = `Hit Slime for ${dmg} DMG! ⚠️ WATCH OUT—Slime is preparing to strike!`;
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
    logEl.textContent = `Trained ${stat.toUpperCase()} +2! Check 📜 STATS.`;
    updateUI();
  } else {
    logEl.textContent = `Not enough Gold! Need ${cost} 🪙.`;
  }
}

// --- MAIN UPDATE LOOP ---
function update() {
  if (player.hp <= 0) return;
  if (player.dodgeTimer > 0) player.dodgeTimer--;

  // 1. Player Movement
  let moveX = joystickMoveX;
  let moveY = joystickMoveY;

  if (keys["w"] || keys["arrowup"]) moveY = -1;
  if (keys["s"] || keys["arrowdown"]) moveY = 1;
  if (keys["a"] || keys["arrowleft"]) moveX = -1;
  if (keys["d"] || keys["arrowright"]) moveX = 1;

  const spd = getMoveSpeed() * (player.isDodging ? 1.8 : 1.0);
  if (moveX !== 0 || moveY !== 0) {
    player.x += moveX * spd;
    player.y += moveY * spd;
  }

  player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(20, Math.min(canvas.height - player.size, player.y));

  // 2. Enemy AI & Telegraphed Attack System
  if (enemy.alive) {
    const dist = getDistanceToEnemy();

    if (enemy.state === "idle") {
      // Automatically start attack windup if player gets very close
      if (dist < 60 && enemy.cooldownTimer === 0) {
        enemy.state = "windup";
        enemy.windupTimer = enemy.maxWindup;
        logEl.textContent = "⚠️ Slime is charging an attack! Tap 🏃‍♂️ DODGE or run back!";
      }
      if (enemy.cooldownTimer > 0) enemy.cooldownTimer--;
    } 
    else if (enemy.state === "windup") {
      enemy.windupTimer--;

      // When timer hits 0, the Slime strikes!
      if (enemy.windupTimer <= 0) {
        enemy.state = "idle";
        enemy.cooldownTimer = 60; // 1 second rest before next attack

        // Check if player is still in strike range (75px)
        if (dist < 75) {
          if (player.isDodging) {
            logEl.textContent = "⚡ PERFECT DODGE! You rolled right through the Slime's attack!";
          } else if ((Math.random() * 100) < getDodgeChance()) {
            logEl.textContent = "⚡ AGILITY DODGE! Your high DEX evaded the Slime's strike!";
          } else {
            const taken = Math.max(1, enemy.atk - getDamageReduction());
            player.hp = Math.max(0, player.hp - taken);
            logEl.textContent = `💥 Slime slammed you for ${taken} DMG!`;
            if (player.hp === 0) {
              logEl.textContent = "💀 You fainted! Tap 🔄 NEW GAME or refresh to restart.";
            }
          }
          updateUI();
        } else {
          logEl.textContent = "💨 Slime swung and missed because you backed away!";
        }
      }
    }
  }
}

// --- MAIN DRAW LOOP ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw Danger Range Ring around Slime when winding up an attack
  if (enemy.alive && enemy.state === "windup") {
    ctx.beginPath();
    ctx.arc(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, 75, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(249, 226, 175, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "#f9e2af";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Draw Player
  ctx.fillStyle = player.isDodging ? "rgba(137, 180, 250, 0.45)" : "#89b4fa";
  ctx.fillRect(player.x, player.y, player.size, player.size);

  // Draw Player HP Bar directly above head
  const maxHp = getMaxHp();
  const hpRatio = player.hp / maxHp;
  ctx.fillStyle = "#45475a";
  ctx.fillRect(player.x - 4, player.y - 8, player.size + 8, 5);
  ctx.fillStyle = hpRatio <= 0.35 ? "#f38ba8" : "#a6e3a1";
  ctx.fillRect(player.x - 4, player.y - 8, (player.size + 8) * hpRatio, 5);

  // Draw Enemy
  if (enemy.alive) {
    // Shake slightly & flash bright yellow during attack windup!
    let shakeX = 0;
    if (enemy.state === "windup") {
      shakeX = (Math.random() - 0.5) * 6;
      ctx.fillStyle = "#f9e2af"; // Bright yellow warning color
    } else {
      ctx.fillStyle = "#f38ba8"; // Normal red slime color
    }

    ctx.fillRect(enemy.x + shakeX, enemy.y, enemy.size, enemy.size);

    // Enemy HP bar
    ctx.fillStyle = "#45475a";
    ctx.fillRect(enemy.x, enemy.y - 8, enemy.size, 5);
    ctx.fillStyle = "#fab387";
    ctx.fillRect(enemy.x, enemy.y - 8, enemy.size * (enemy.hp / enemy.maxHp), 5);

    // Draw ⚠️ Warning Text & Countdown Bar above Slime when attacking!
    if (enemy.state === "windup") {
      ctx.fillStyle = "#f9e2af";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚠️ !", enemy.x + enemy.size / 2, enemy.y - 22);

      // Shrinking attack timer bar
      const chargeRatio = enemy.windupTimer / enemy.maxWindup;
      ctx.fillStyle = "#f38ba8";
      ctx.fillRect(enemy.x, enemy.y - 16, enemy.size * chargeRatio, 4);
    }
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Initialize
loadGame();
updateUI();
gameLoop();
    
