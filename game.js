const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");
const alertBanner = document.getElementById("alert-banner");

let currentMap = "town";
let dayCount = 1;
let timeOfDay = "Morning";

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
  else { timeOfDay = "Morning"; dayCount++; npcs.forEach(n => { n.talkedToday = false; }); }
}

// --- CHEAT CODE FOR INFINITY GOLD ---
function activateCheatCode() {
  player.gold = 99999;
  showAlert("⚡ CHEAT ACTIVATED: Infinity Gold Unlocked (99,999 🪙)!", "success");
  updateUI();
}

// --- FOREST DIFFICULTY SELECTION MODAL ---
function promptForestDifficulty() {
  openModal('forest-modal');
}

function selectForestDifficulty(type) {
  closeModal('forest-modal');
  currentMap = "hunt";
  document.getElementById("map-toggle-btn").textContent = "🏠 Flee to Town (Safe Zone)";
  document.getElementById("map-toggle-btn").style.backgroundColor = "#f9e2af";

  if (type === "easy") {
    enemies = [{ name: "Easy Slime", color: "#a6e3a1", x: 420, y: 120, size: 28, hp: 15, maxHp: 15, atk: 5, dropType: "meat", alive: true, state: "patrol", windupTimer: 0, maxWindup: 70 }];
    showAlert("Entered EASY Forest!", "success");
  } else if (type === "hard") {
    enemies = [{ name: "Hard Orc Warlord", color: "#f38ba8", x: 300, y: 60, size: 42, hp: 120, maxHp: 120, atk: 35, dropType: "prime", alive: true, state: "patrol", windupTimer: 0, maxWindup: 35 }];
    showAlert("Entered HARD Forest!", "danger");
  } else {
    enemies = [{ name: "Medium Goblin", color: "#fab387", x: 150, y: 200, size: 32, hp: 45, maxHp: 45, atk: 18, dropType: "meat", alive: true, state: "patrol", windupTimer: 0, maxWindup: 50 }];
    showAlert("Entered MEDIUM Forest.", "info");
  }

  player.x = 60; player.y = 120;
  spawnWildItems();
}

function switchMap() {
  if (currentMap === "town") {
    promptForestDifficulty();
  } else {
    currentMap = "town";
    document.getElementById("map-toggle-btn").textContent = "🌲 Travel to Hunting Grounds";
    document.getElementById("map-toggle-btn").style.backgroundColor = "#a6e3a1";
    showAlert("Safe in Town!", "success");
    player.x = 270; player.y = 120;
    updateUI();
  }
}

// --- SELLING & EATING ITEMS IN INVENTORY ---
function sellItem(itemKey, price) {
  if (player[itemKey] > 0) {
    player[itemKey]--;
    player.gold += price;
    showAlert(`Sold item for ${price} Gold! 🪙`, "success");
    updateUI();
  } else {
    showAlert("You don't have any of that item to sell!", "danger");
  }
}

function eatFood(foodKey, restorePct) {
  if (player[foodKey] > 0) {
    player[foodKey]--;
    const maxHp = getMaxHp();
    const healAmount = Math.floor(maxHp * restorePct);
    player.hp = Math.min(maxHp, player.hp + healAmount);
    showAlert(`🍲 Ate food and restored ${healAmount} HP!`, "success");
    updateUI();
  } else {
    showAlert("You don't have that food cooked!", "danger");
  }
}

// --- WEIGHTED GACHA ---
function pullGacha() {
  const cost = 50;
  if (player.gold < cost) { showAlert("Need 50 🪙", "danger"); return; }
  player.gold -= cost;
  const roll = Math.random() * 100;
  let rewardName = "", rarity = "";
  if (roll < 60) { rarity = "Common ⚪"; rewardName = "Silk Ribbon"; player.rawMeat = Math.min(99, player.rawMeat + 2); }
  else if (roll < 85) { rarity = "Rare 🔵"; rewardName = "Silver Necklace"; player.herbs = Math.min(99, player.herbs + 3); }
  else if (roll < 97) { rarity = "Epic 🟣"; rewardName = "Gold Crown"; player.gold += 80; }
  else { rarity = "Legendary 🟡"; rewardName = "Celestial Diadem"; player.primeMeat = Math.min(99, player.primeMeat + 2); }

  player.inventory.push({ name: rewardName, rarity: rarity });
  showAlert(`[${rarity}] Pulled: ${rewardName}!`, "success");
  updateUI();
}

function getAttackDmg() { return player.str + (npcs.filter(n => n.inParty).length * 5); }
function getMaxHp() { return 50 + (player.con * 5); }
function getMoveSpeed() { return 3 + (player.dex * 0.1); }
function getDodgeChance() { return Math.min(70, (player.dex - 8) * 4); }
function getUpgradeCost() { return Math.max(5, 20 - Math.floor((player.cha - 10) * 1.5)); }

// Touch Joystick
let activePointerId = null, joystickMoveX = 0, joystickMoveY = 0;
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

function triggerMainAction() {
  if (currentMap === "hunt") collectWildItems();
  else npcs.forEach(n => { if (Math.sqrt(Math.pow((player.x+14)-(n.x+14), 2) + Math.pow((player.y+14)-(n.y+14), 2)) < 55) openDialogue(n.id); });
}

function cookRecipe(type) {
  if (type === "skewer" && player.rawMeat >= 1) { player.rawMeat--; player.skewers++; showAlert("🍳 Cooked Meat Skewer!", "success"); }
  else if (type === "steak" && player.rawMeat >= 1 && player.herbs >= 1) { player.rawMeat--; player.herbs--; player.steaks++; showAlert("🍳 Cooked Herb Steak!", "success"); }
  else if (type === "feast" && player.primeMeat >= 1 && player.mushrooms >= 1) { player.primeMeat--; player.mushrooms--; player.feasts++; showAlert("🍳 Cooked Beast Feast!", "success"); }
  else if (type === "salad" && player.herbs >= 2 && player.mushrooms >= 1) { player.herbs -= 2; player.mushrooms--; player.salads++; showAlert("🍳 Cooked Herbal Salad!", "success"); }
  else { showAlert("❌ Not enough ingredients!", "danger"); }
  updateUI();
}

function saveGame() {
  localStorage.setItem("RPGHuntCook_Save_v8", JSON.stringify({ player, npcs, dayCount, timeOfDay, activeQuests }));
  showAlert("💾 Game Saved!", "success");
}

function loadGame() {
  const saved = localStorage.getItem("RPGHuntCook_Save_v8");
  if (saved) {
    const data = JSON.parse(saved);
    player = { ...DEFAULT_PLAYER, ...data.player };
    if (data.npcs) npcs = data.npcs;
    if (data.dayCount) dayCount = data.dayCount;
    if (data.timeOfDay) timeOfDay = data.timeOfDay;
    if (data.activeQuests) activeQuests = data.activeQuests;
    showAlert("📂 Save loaded!", "success");
  }
}

function resetGame() {
  if (confirm("Reset all progress?")) {
    localStorage.removeItem("RPGHuntCook_Save_v8");
    player = { ...DEFAULT_PLAYER };
    dayCount = 1; timeOfDay = "Morning";
    if (currentMap === "hunt") switchMap();
    updateUI();
    showAlert("🔄 New game started!", "info");
  }
}

function updateUI() {
  const maxHp = getMaxHp();
  document.getElementById("stat-daytime").textContent = `☀️ Day ${dayCount} (${timeOfDay})`;
  document.getElementById("stat-gold").textContent = `🪙 ${player.gold}`;

  document.getElementById("inv-meat").textContent = `🥩: ${player.rawMeat}/99`;
  document.getElementById("inv-prime").textContent = `🍖: ${player.primeMeat}/99`;
  document.getElementById("inv-herb").textContent = `🌿: ${player.herbs}/99`;
  document.getElementById("inv-shroom").textContent = `🍄: ${player.mushrooms}/99`;

  // Kitchen ingredient counts
  document.getElementById("recipe-skewer").innerHTML = `<strong>🍖 Skewer</strong><br><small>1 🥩 (Have: ${player.rawMeat})</small> <button onclick="cookRecipe('skewer')">Cook</button>`;
  document.getElementById("recipe-steak").innerHTML = `<strong>🥗 Steak</strong><br><small>1 🥩+1 🌿 (Meat:${player.rawMeat}, Herb:${player.herbs})</small> <button onclick="cookRecipe('steak')">Cook</button>`;
  document.getElementById("recipe-salad").innerHTML = `<strong>🌿 Salad</strong><br><small>2 🌿+1 🍄 (Herb:${player.herbs}, Shroom:${player.mushrooms})</small> <button onclick="cookRecipe('salad')">Cook</button>`;

  // Sell & Eat Inventory HTML in Shop/Kitchen modals
  let sellHtml = `
    <div class="shop-item"><span>Raw Meat (${player.rawMeat})</span> <button onclick="sellItem('rawMeat', 10)">Sell (+10🪙)</button></div>
    <div class="shop-item"><span>Wild Herb (${player.herbs})</span> <button onclick="sellItem('herbs', 8)">Sell (+8🪙)</button></div>
    <div class="shop-item"><span>Meat Skewer (${player.skewers})</span> <button onclick="sellItem('skewers', 20)">Sell (+20🪙)</button> <button onclick="eatFood('skewers', 0.4)" style="background:#a6e3a1;">Eat</button></div>
    <div class="shop-item"><span>Herb Steak (${player.steaks})</span> <button onclick="sellItem('steaks', 40)">Sell (+40🪙)</button> <button onclick="eatFood('steaks', 0.7)" style="background:#a6e3a1;">Eat</button></div>
  `;
  document.getElementById("sell-inventory-container").innerHTML = sellHtml;

  const hpEl = document.getElementById("stat-hp");
  hpEl.textContent = `HP: ${player.hp}/${maxHp}`;
  hpEl.style.color = player.hp <= (maxHp * 0.35) ? "#f38ba8" : "#a6e3a1";

  document.getElementById("disp-str").textContent = `💪 STR: ${player.str}`;
  document.getElementById("disp-dex").textContent = `⚡ DEX: ${player.dex}`;
  document.getElementById("disp-con").textContent = `🛡️ CON: ${player.con}`;
  document.getElementById("disp-int").textContent = `🧠 INT: ${player.int}`;
  document.getElementById("disp-wis").textContent = `👁️ WIS: ${player.wis}`;
  document.getElementById("disp-cha").textContent = `✨ CHA: ${player.cha}`;

  updateNpcUI();
}

function completeQuest(questId) {
  const q = activeQuests.find(quest => quest.id === questId);
  if (!q || q.completed) return;
  if (q.progress >= q.target) {
    q.completed = true;
    player.gold += q.rewardGold;
    showAlert(`🏆 Quest Completed! Earned ${q.rewardGold} Gold!`, "success");
    updateUI();
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
    showAlert(`Trained ${stat.toUpperCase()} +2!`, "success");
    updateUI();
  } else {
    showAlert(`Need ${cost} 🪙`, "danger");
  }
}

function update() {
  if (player.hp <= 0) return;
  let moveX = joystickMoveX, moveY = joystickMoveY;
  if (moveX !== 0 || moveY !== 0) { player.x += moveX * getMoveSpeed(); player.y += moveY * getMoveSpeed(); }
  player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(20, Math.min(canvas.height - player.size, player.y));

  if (currentMap === "hunt") updateForest();
  else updateTown();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (currentMap === "town") drawTown();
  else drawForest();
}

function gameLoop() {
  update(); draw(); requestAnimationFrame(gameLoop);
}

loadGame(); updateUI(); gameLoop();
