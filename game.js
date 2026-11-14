const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");
const alertBanner = document.getElementById("alert-banner");

let currentMap = "town";
let dayCount = 1;
let timeOfDay = "Morning"; // Morning, Afternoon, Evening, Night

const DEFAULT_PLAYER = {
  x: 270,
  y: 120,
  size: 28,
  hp: 100,
  gold: 150,
  rawMeat: 0,
  primeMeat: 0,
  herbs: 0,
  mushrooms: 0,
  skewers: 0,
  steaks: 0,
  feasts: 0,
  salads: 0,
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  inventory: []
};

let player = { ...DEFAULT_PLAYER };

// Quests at Adventurer's Guild
let activeQuests = [
  { id: 1, title: "Slay 3 Slimes", type: "hunt", target: 3, progress: 0, rewardGold: 60, rewardRep: 25, completed: false },
  { id: 2, title: "Gather 2 Herbs", type: "gather", target: 2, progress: 0, rewardGold: 40, rewardRep: 15, completed: false }
];

function showAlert(text, type = "info") {
  alertBanner.textContent = text;
  if (type === "success") alertBanner.style.backgroundColor = "#a6e3a1";
  else if (type === "danger") alertBanner.style.backgroundColor = "#f38ba8";
  else alertBanner.style.backgroundColor = "#fab387";
  
  alertBanner.style.opacity = "1";
  setTimeout(() => { alertBanner.style.opacity = "0"; }, 3500);
}

function showCenterPopup(title, msg) {
  document.getElementById("popup-title").textContent = title;
  document.getElementById("popup-msg").textContent = msg;
  document.getElementById("center-popup-overlay").style.display = "flex";
}

function closeCenterPopup() {
  document.getElementById("center-popup-overlay").style.display = "none";
}

function advanceTime() {
  if (timeOfDay === "Morning") timeOfDay = "Afternoon";
  else if (timeOfDay === "Afternoon") timeOfDay = "Evening";
  else if (timeOfDay === "Evening") timeOfDay = "Night";
  else {
    timeOfDay = "Morning";
    dayCount++;
    npcs.forEach(n => { n.talkedToday = false; });
  }
}

// --- MAP SWITCHER ---
function switchMap() {
  if (currentMap === "town") {
    let choice = prompt("Choose Forest Difficulty:\n1. Easy (Slimes)\n2. Medium (Goblins)\n3. Hard (Orc Bosses)\nEnter 1, 2, or 3:", "1");
    if (!choice) return;

    currentMap = "hunt";
    document.getElementById("map-toggle-btn").textContent = "🏠 Flee to Town (Safe Zone)";
    document.getElementById("map-toggle-btn").style.backgroundColor = "#f9e2af";

    if (choice === "1") {
      enemies = [{ name: "Easy Slime", color: "#a6e3a1", x: 420, y: 120, size: 28, hp: 15, maxHp: 15, atk: 5, dropType: "meat", alive: true, state: "patrol", dirX: 1, dirY: 0, moveTimer: 0, windupTimer: 0, maxWindup: 70 }];
    } else if (choice === "3") {
      enemies = [{ name: "Hard Orc Warlord", color: "#f38ba8", x: 300, y: 60, size: 42, hp: 120, maxHp: 120, atk: 35, dropType: "prime", alive: true, state: "patrol", dirX: 0, dirY: -1, moveTimer: 0, windupTimer: 0, maxWindup: 35 }];
    } else {
      enemies = [{ name: "Medium Goblin", color: "#fab387", x: 150, y: 200, size: 32, hp: 45, maxHp: 45, atk: 18, dropType: "meat", alive: true, state: "patrol", dirX: -1, dirY: 1, moveTimer: 0, windupTimer: 0, maxWindup: 50 }];
    }

    player.x = 60; player.y = 120;
    spawnWildItems();
    showAlert("Entered Forest. Watch out for patrolling monsters!", "info");
  } else {
    currentMap = "town";
    document.getElementById("map-toggle-btn").textContent = "🌲 Travel to Hunting Grounds";
    document.getElementById("map-toggle-btn").style.backgroundColor = "#a6e3a1";
    showAlert("Safe in Town!", "success");
    player.x = 270; player.y = 120;
    updateUI();
  }
}

// --- WEIGHTED GACHA SYSTEM ---
function pullGacha() {
  const cost = 50;
  if (player.gold < cost) {
    showAlert("Not enough Gold for Gacha! Need 50 🪙", "danger");
    return;
  }
  player.gold -= cost;

  const roll = Math.random() * 100;
  let rewardName = "", rarity = "";

  if (roll < 60) {
    rarity = "Common ⚪"; rewardName = "Silk Ribbon"; player.rawMeat = Math.min(99, player.rawMeat + 2);
  } else if (roll < 85) {
    rarity = "Rare 🔵"; rewardName = "Silver Necklace"; player.herbs = Math.min(99, player.herbs + 3);
  } else if (roll < 97) {
    rarity = "Epic 🟣"; rewardName = "Gold Crown"; player.gold += 80;
  } else {
    rarity = "Legendary 🟡"; rewardName = "Celestial Diadem"; player.primeMeat = Math.min(99, player.primeMeat + 2);
  }

  player.inventory.push({ name: rewardName, rarity: rarity });
  const resultMsg = `[${rarity}] You pulled: ${rewardName}!`;
  document.getElementById("gacha-result-box").textContent = resultMsg;
  showAlert(resultMsg, "success");
  updateUI();
}

// --- RPG FORMULAS ---
function getAttackDmg() { return player.str + (npcs.filter(n => n.inParty).length * 5); }
function getMaxHp() { return 50 + (player.con * 5); }
function getMoveSpeed() { return 3 + (player.dex * 0.1); }
function getDodgeChance() { return Math.min(70, (player.dex - 8) * 4); }
function getUpgradeCost() { return Math.max(5, 20 - Math.floor((player.cha - 10) * 1.5)); }

// --- TOUCH JOYSTICK CONTROLS ---
let activePointerId = null;
let joystickMoveX = 0;
let joystickMoveY = 0;
const base = document.getElementById("joystick-base");
const knob = document.getElementById("joystick-knob");

base.addEventListener("pointerdown", (e) => { e.preventDefault(); activePointerId = e.pointerId; base.setPointerCapture(e.pointerId); updateJoystickPosition(e.clientX, e.clientY); });
base.addEventListener("pointermove", (e) => { if (e.pointerId !== activePointerId) return; e.preventDefault(); updateJoystickPosition(e.clientX, e.clientY); });
base.addEventListener("pointerup", (e) => { if (e.pointerId === activePointerId) resetJoystick(e.pointerId); });

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
  if (pointerId !== undefined && base.hasPointerCapture(pointerId)) base.releasePointerCapture(pointerId);
  activePointerId = null; joystickMoveX = 0; joystickMoveY = 0;
  knob.style.transform = `translate(0px, 0px)`;
}

// --- MAIN ACTION BUTTON ---
function triggerMainAction() {
  if (currentMap === "hunt") {
    collectWildItems();
  } else {
    npcs.forEach(n => {
      const dx = (player.x + 14) - (n.x + 14);
      const dy = (player.y + 14) - (n.y + 14);
      if (Math.sqrt(dx*dx + dy*dy) < 55) openDialogue(n.id);
    });
  }
}

function cookRecipe(type) {
  if (type === "skewer" && player.rawMeat >= 1) { player.rawMeat--; player.skewers++; showAlert("🍳 Cooked Meat Skewer successfully!", "success"); }
  else if (type === "steak" && player.rawMeat >= 1 && player.herbs >= 1) { player.rawMeat--; player.herbs--; player.steaks++; showAlert("🍳 Cooked Herb Steak successfully!", "success"); }
  else if (type === "feast" && player.primeMeat >= 1 && player.mushrooms >= 1) { player.primeMeat--; player.mushrooms--; player.feasts++; showAlert("🍳 Cooked Beast Feast successfully!", "success"); }
  else if (type === "salad" && player.herbs >= 2 && player.mushrooms >= 1) { player.herbs -= 2; player.mushrooms--; player.salads++; showAlert("🍳 Cooked Herbal Salad successfully!", "success"); }
  else { showAlert("❌ Not enough ingredients!", "danger"); }
  updateUI();
}

// --- SAVE & LOAD ---
function saveGame() {
  localStorage.setItem("RPGHuntCook_Save_v7", JSON.stringify({ player, npcs, dayCount, timeOfDay, activeQuests }));
  showAlert("💾 Game Saved Successfully!", "success");
}

function loadGame() {
  const saved = localStorage.getItem("RPGHuntCook_Save_v7");
  if (saved) {
    const data = JSON.parse(saved);
    player = { ...DEFAULT_PLAYER, ...data.player };
    if (data.npcs) npcs = data.npcs;
    if (data.dayCount) dayCount = data.dayCount;
    if (data.timeOfDay) timeOfDay = data.timeOfDay;
    if (data.activeQuests) activeQuests = data.activeQuests;
    showAlert("📂 Save file loaded!", "success");
  }
}

function resetGame() {
  if (confirm("Reset all progress?")) {
    localStorage.removeItem("RPGHuntCook_Save_v7");
    player = { ...DEFAULT_PLAYER };
    dayCount = 1; timeOfDay = "Morning";
    if (currentMap === "hunt") switchMap();
    updateUI();
    showAlert("🔄 New game started!", "info");
  }
}

// --- UI UPDATES ---
function updateUI() {
  const maxHp = getMaxHp();
  const cost = getUpgradeCost();

  document.getElementById("stat-daytime").textContent = `☀️ Day ${dayCount} (${timeOfDay})`;
  document.getElementById("stat-gold").textContent = `🪙 ${player.gold}`;

  document.getElementById("inv-meat").textContent = `🥩: ${player.rawMeat}/99`;
  document.getElementById("inv-prime").textContent = `🍖: ${player.primeMeat}/99`;
  document.getElementById("inv-herb").textContent = `🌿: ${player.herbs}/99`;
  document.getElementById("inv-shroom").textContent = `🍄: ${player.mushrooms}/99`;

  // Real-time ingredient remaining display in Kitchen
  document.getElementById("recipe-skewer").innerHTML = `<strong>🍖 Meat Skewer</strong><br><small>1 🥩 Meat (Left: ${player.rawMeat})</small>`;
  document.getElementById("recipe-steak").innerHTML = `<strong>🥗 Herb-Roasted Steak</strong><br><small>1 🥩 + 1 🌿 (Meat: ${player.rawMeat}, Herb: ${player.herbs})</small>`;
  document.getElementById("recipe-feast").innerHTML = `<strong>🍖 Beast Feast</strong><br><small>1 🍖 + 1 🍄 (Prime: ${player.primeMeat}, Shroom: ${player.mushrooms})</small>`;
  document.getElementById("recipe-salad").innerHTML = `<strong>🌿 Herbal Salad</strong><br><small>2 🌿 + 1 🍄 (Herb: ${player.herbs}, Shroom: ${player.mushrooms})</small>`;

  const hpEl = document.getElementById("stat-hp");
  hpEl.textContent = `HP: ${player.hp}/${maxHp}`;
  hpEl.style.color = player.hp <= (maxHp * 0.35) ? "#f38ba8" : "#a6e3a1";

  document.getElementById("disp-str").textContent = `💪 STR: ${player.str}`;
  document.getElementById("disp-dex").textContent = `⚡ DEX: ${player.dex}`;
  document.getElementById("disp-con").textContent = `🛡️ CON: ${player.con}`;
  document.getElementById("disp-int").textContent = `🧠 INT: ${player.int}`;
  document.getElementById("disp-wis").textContent = `👁️ WIS: ${player.wis}`;
  document.getElementById("disp-cha").textContent = `✨ CHA: ${player.cha}`;

  // Guild Quests
  let questHtml = "";
  activeQuests.forEach(q => {
    questHtml += `
      <div class="shop-item" style="flex-direction:column; align-items:flex-start;">
        <div><strong>${q.title}</strong></div>
        <div style="font-size:10px; color:#b4befe; margin:2px 0;">Progress: ${q.progress}/${q.target} | Reward: ${q.rewardGold} 🪙</div>
        <button onclick="completeQuest(${q.id})" ${q.completed || q.progress < q.target ? 'disabled' : ''} style="background:${q.completed ? '#45475a' : '#a6e3a1'}; margin-top:5px;">${q.completed ? 'Completed' : 'Claim Reward'}</button>
      </div>
    `;
  });
  document.getElementById("quest-board-container").innerHTML = questHtml;

  updateNpcUI();

  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(stat => {
    const btn = document.getElementById(`btn-${stat}`);
    if (btn) btn.textContent = `${cost} 🪙`;
  });
}

function completeQuest(questId) {
  const q = activeQuests.find(quest => quest.id === questId);
  if (!q || q.completed) return;
  if (q.progress >= q.target) {
    q.completed = true;
    player.gold += q.rewardGold;
    showAlert(`🏆 Quest Completed! Earned ${q.rewardGold} Gold!`, "success");
    updateUI();
    openModal('guild-modal');
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
    showAlert(`Successfully trained ${stat.toUpperCase()} +2!`, "success");
    updateUI();
  } else {
    showAlert(`Not enough Gold! Need ${cost} 🪙`, "danger");
  }
}

// --- MAIN GAME LOOP ---
function update() {
  if (player.hp <= 0) return;

  let moveX = joystickMoveX;
  let moveY = joystickMoveY;

  if (moveX !== 0 || moveY !== 0) {
    player.x += moveX * getMoveSpeed();
    player.y += moveY * getMoveSpeed();
  }

  player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(20, Math.min(canvas.height - player.size, player.y));

  // Update Forest mechanics if in hunting map
  if (currentMap === "hunt") {
    updateForest();
  } else {
    updateTown();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentMap === "town") {
    drawTown();
  } else {
    drawForest();
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

loadGame();
updateUI();
gameLoop();
      
