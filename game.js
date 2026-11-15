const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");
const alertBanner = document.getElementById("alert-banner");

let currentMap = "town";
let dayCount = 1;
let timeOfDay = "Morning";
let isPaused = false;
let autoSaveFrame = 0;
const SAVE_KEY = "RPGHuntCook_Save_v11";

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
  inventory: [],
  level: 1,
  exp: 0,
  attributePoints: 0,
  weapon: "Sword",
  weaponProficiency: {},
  monstersDefeated: 0
};

const WEAPONS = {
  "Sword": { rarity: "Common", damage: 1.0, range: 75, crit: 0.05, speed: 1.0, description: "Balanced damage and reach." },
  "Greatsword": { rarity: "Uncommon", damage: 1.65, range: 82, crit: 0.03, speed: 0.75, description: "Heavy hits, slower combat." },
  "Dual Daggers": { rarity: "Rare", damage: 0.8, range: 58, crit: 0.22, speed: 1.35, description: "Fast attacks and critical hits." },
  "Bow": { rarity: "Rare", damage: 0.9, range: 165, crit: 0.12, speed: 0.9, description: "Long-range physical attacks." },
  "Staff": { rarity: "Epic", damage: 1.15, range: 135, crit: 0.08, speed: 0.9, description: "Intelligence-powered magic." },
  "Spear": { rarity: "Uncommon", damage: 1.1, range: 105, crit: 0.08, speed: 0.95, description: "Long reach and steady damage." },
  "Axe": { rarity: "Uncommon", damage: 1.4, range: 72, crit: 0.07, speed: 0.82, description: "Powerful chopping attacks." }
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
  else {
    timeOfDay = "Morning";
    dayCount++;
    if (typeof npcs !== 'undefined') {
      npcs.forEach(n => { n.talkedToday = false; n.giftGivenToday = false; });
    }
  }
}

// --- PLAYER PROGRESSION & WEAPON EQUIPMENT ---
function expToNextLevel() { return 100 + (player.level - 1) * 50; }

function gainExp(amount) {
  player.exp = (player.exp || 0) + amount;
  let leveled = false;
  while (player.exp >= expToNextLevel()) {
    player.exp -= expToNextLevel();
    player.level = (player.level || 1) + 1;
    player.attributePoints = (player.attributePoints || 0) + 3;
    leveled = true;
  }
  if (leveled) {
    player.hp = getMaxHp();
    showAlert(`🎉 Level up! You are now Lv.${player.level}. +3 attribute points!`, "success");
  }
}

function allocateAttribute(stat) {
  const valid = ["str", "dex", "con", "int", "wis", "cha"];
  if (!valid.includes(stat) || (player.attributePoints || 0) <= 0) return;
  player[stat] = (player[stat] || 10) + 1;
  player.attributePoints--;
  if (stat === "con") player.hp = getMaxHp();
  updateUI();
}

function equipWeapon(name) {
  if (!WEAPONS[name]) return;
  player.weapon = name;
  showAlert(`⚔️ Equipped ${name}! ${WEAPONS[name].description}`, "success");
  updateUI();
}

function getWeapon() { return WEAPONS[player.weapon] || WEAPONS.Sword; }
function getWeaponRange() { return getWeapon().range; }

function togglePause() {
  isPaused = !isPaused;
  const btn = document.getElementById("pause-btn");
  if (btn) btn.textContent = isPaused ? "▶️ Resume" : "⏸️ Pause";
  showAlert(isPaused ? "Game paused." : "Game resumed.", "info");
}

function exportSave() {
  const data = buildSaveData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "RPGHuntCook-save.json"; a.click();
  URL.revokeObjectURL(url);
  showAlert("📦 Save backup exported!", "success");
}

function importSave(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.player || typeof data.player !== "object") throw new Error("Invalid save");
      applySaveData(data);
      saveGame(false);
      updateUI();
      showAlert("📂 Backup imported successfully!", "success");
    } catch (err) {
      showAlert("❌ Could not import this save file.", "danger");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

function buildSaveData() {
  return { version: 11, player, npcs: typeof npcs !== "undefined" ? npcs : [], dayCount, timeOfDay, activeQuests };
}

function applySaveData(data) {
  player = { ...DEFAULT_PLAYER, ...(data.player || {}) };
  if (data.npcs && typeof npcs !== "undefined") npcs = data.npcs;
  if (data.dayCount) dayCount = data.dayCount;
  if (data.timeOfDay) timeOfDay = data.timeOfDay;
  if (data.activeQuests) activeQuests = data.activeQuests;
}

// --- CHEAT CODE & REWARD CODE REDEMPTION SYSTEM ---
function openCheatPrompt() {
  let code = prompt("Enter Reward / Cheat Code:\n\nAvailable Cheats:\n- 'INFINITYGOLD' (99,999 Gold)\n- 'FREEGACHA' (5 Free Items)\n- 'MAXSTATS' (All Stats +20)", "");
  if (!code) return;
  code = code.trim().toUpperCase();

  if (code === "INFINITYGOLD") {
    player.gold = 99999;
    showAlert("⚡ CHEAT: Infinity Gold Unlocked!", "success");
  } else if (code === "FREEGACHA") {
    for (let i = 0; i < 5; i++) {
      player.inventory.push({ name: "Promo Gemstone", rarity: "Epic 🟣" });
    }
    showAlert("⚡ CHEAT: Added 5 Promo Gacha Items!", "success");
  } else if (code === "MAXSTATS") {
    player.str += 20; player.dex += 20; player.con += 20;
    player.int += 20; player.wis += 20; player.cha += 20;
    player.hp = getMaxHp();
    showAlert("⚡ CHEAT: All stats maxed out +20!", "success");
  } else {
    showAlert("❌ Invalid Cheat Code!", "danger");
  }
  updateUI();
}

// --- FOREST DIFFICULTY MODAL ---
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
  if (typeof spawnWildItems === 'function') spawnWildItems();
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

// --- SELLING & EATING ---
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

// --- GACHA ---
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

function getAttackDmg() {
  const partyBonus = typeof npcs !== "undefined" ? npcs.filter(n => n.inParty).length * 5 : 0;
  const stat = player.weapon === "Staff" ? player.int : player.str;
  return Math.max(1, Math.floor((stat + partyBonus) * getWeapon().damage));
}
function getMaxHp() { return 50 + (player.con * 5); }
function getMoveSpeed() { return 3 + (player.dex * 0.1); }
function getDodgeChance() { return Math.min(70, (player.dex - 8) * 4); }
function getUpgradeCost() { return Math.max(5, 20 - Math.floor((player.cha - 10) * 1.5)); }

// Touch Joystick Setup & Footstep Sound Trigger
let activePointerId = null, joystickMoveX = 0, joystickMoveY = 0;
let footstepTimer = 0;
const base = document.getElementById("joystick-base");
const knob = document.getElementById("joystick-knob");

if (base) {
  base.addEventListener("pointerdown", (e) => { e.preventDefault(); activePointerId = e.pointerId; base.setPointerCapture(e.pointerId); updateJoystickPosition(e.clientX, e.clientY); });
  base.addEventListener("pointermove", (e) => { if (e.pointerId !== activePointerId) return; e.preventDefault(); updateJoystickPosition(e.clientX, e.clientY); });
  base.addEventListener("pointerup", (e) => { if (e.pointerId === activePointerId) resetJoystick(e.pointerId); });
}

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
  if (pointerId !== undefined && base && base.hasPointerCapture(pointerId)) base.releasePointerCapture(pointerId);
  activePointerId = null; joystickMoveX = 0; joystickMoveY = 0;
  if (knob) knob.style.transform = `translate(0px, 0px)`;
}

// --- MAIN ACTION BUTTON (PROXIMITY CHECK FOR BUILDINGS & NPCS) ---
function triggerMainAction() {
  if (typeof playSound === 'function') playSound('npcTalk');

  if (currentMap === "hunt") {
    if (typeof collectWildItems === 'function') collectWildItems();
  } else {
    // Check proximity to Town Buildings (Inn, Guild, Shop)
    // Inn building box: x:30->140, y:40->120
    if (player.x >= 20 && player.x <= 150 && player.y >= 30 && player.y <= 130) {
      sleepAtInn();
      return;
    }
    // Guild building box: x:160->270, y:40->120
    if (player.x >= 150 && player.x <= 280 && player.y >= 30 && player.y <= 130) {
      openModal('guild-modal');
      showAlert("Entered Adventurer's Guild!", "success");
      return;
    }
    // Shop building box: x:290->400, y:40->120
    if (player.x >= 280 && player.x <= 410 && player.y >= 30 && player.y <= 130) {
      openModal('shop-modal');
      showAlert("Entered Village Training Shop!", "success");
      return;
    }

    // Check proximity to NPCs
    if (typeof npcs !== 'undefined') {
      let foundNpc = false;
      npcs.forEach(n => {
        if (Math.sqrt(Math.pow((player.x+14)-(n.x+14), 2) + Math.pow((player.y+14)-(n.y+14), 2)) < 55) {
          if (typeof openDialogue === 'function') openDialogue(n.id);
          foundNpc = true;
        }
      });
      if (!foundNpc) {
        showAlert("Walk closer to a building (Inn, Guild, Shop) or NPC and press Act!", "info");
      }
    }
  }
}

function cookRecipe(type) {
  if (type === "skewer" && player.rawMeat >= 1) { player.rawMeat--; player.skewers++; showAlert("🍳 Cooked Meat Skewer!", "success"); }
  else if (type === "steak" && player.rawMeat >= 1 && player.herbs >= 1) { player.rawMeat--; player.herbs--; player.steaks++; showAlert("🍳 Cooked Herb Steak!", "success"); }
  else if (type === "feast" && player.primeMeat >= 1 && player.mushrooms >= 1) { player.primeMeat--; player.mushrooms--; player.feasts++; showAlert("🍳 Cooked Beast Feast!", "success"); }
  else if (type === "salad" && player.herbs >= 2 && player.mushrooms >= 1) { player.herbs -= 2; player.mushrooms--; player.salads++; showAlert("🍳 Cooked Herbal Salad!", "success"); }
  else { showAlert("❌ Not enough ingredients!", "danger"); }
  updateUI();
}

function saveGame(showMessage = true) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveData()));
  if (showMessage) showAlert("💾 Game Saved!", "success");
}

function loadGame() {
  const saved = localStorage.getItem(SAVE_KEY) || localStorage.getItem("RPGHuntCook_Save_v10");
  if (saved) {
    try {
      applySaveData(JSON.parse(saved));
      showAlert("📂 Save loaded!", "success");
    } catch (err) {
      showAlert("⚠️ Save file could not be loaded.", "danger");
    }
  }
}

function resetGame() {
  if (confirm("Reset all progress?")) {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem("RPGHuntCook_Save_v10");
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

  const skewerEl = document.getElementById("recipe-skewer");
  if (skewerEl) skewerEl.innerHTML = `<strong>🍖 Skewer</strong><br><small>1 🥩 (Have: ${player.rawMeat})</small> <button onclick="cookRecipe('skewer')">Cook</button>`;
  
  const steakEl = document.getElementById("recipe-steak");
  if (steakEl) steakEl.innerHTML = `<strong>🥗 Steak</strong><br><small>1 🥩+1 🌿 (Meat:${player.rawMeat}, Herb:${player.herbs})</small> <button onclick="cookRecipe('steak')">Cook</button>`;
  
  const saladEl = document.getElementById("recipe-salad");
  if (saladEl) saladEl.innerHTML = `<strong>🌿 Salad</strong><br><small>2 🌿+1 🍄 (Herb:${player.herbs}, Shroom:${player.mushrooms})</small> <button onclick="cookRecipe('salad')">Cook</button>`;

  const sellContainer = document.getElementById("sell-inventory-container");
  if (sellContainer) {
    sellContainer.innerHTML = `
      <div class="shop-item"><span>Raw Meat (${player.rawMeat})</span> <button onclick="sellItem('rawMeat', 10)">Sell (+10🪙)</button></div>
      <div class="shop-item"><span>Wild Herb (${player.herbs})</span> <button onclick="sellItem('herbs', 8)">Sell (+8🪙)</button></div>
      <div class="shop-item"><span>Meat Skewer (${player.skewers})</span> <button onclick="sellItem('skewers', 20)">Sell (+20🪙)</button> <button onclick="eatFood('skewers', 0.4)" style="background:#a6e3a1;">Eat</button></div>
      <div class="shop-item"><span>Herb Steak (${player.steaks})</span> <button onclick="sellItem('steaks', 40)">Sell (+40🪙)</button> <button onclick="eatFood('steaks', 0.7)" style="background:#a6e3a1;">Eat</button></div>
    `;
  }

  const hpEl = document.getElementById("stat-hp");
  if (hpEl) {
    hpEl.textContent = `HP: ${player.hp}/${maxHp}`;
    hpEl.style.color = player.hp <= (maxHp * 0.35) ? "#f38ba8" : "#a6e3a1";
  }

  document.getElementById("disp-str").textContent = `💪 STR: ${player.str}`;
  document.getElementById("disp-dex").textContent = `⚡ DEX: ${player.dex}`;
  document.getElementById("disp-con").textContent = `🛡️ CON: ${player.con}`;
  document.getElementById("disp-int").textContent = `🧠 INT: ${player.int}`;
  document.getElementById("disp-wis").textContent = `👁️ WIS: ${player.wis}`;
  document.getElementById("disp-cha").textContent = `✨ CHA: ${player.cha}`;

  const levelEl = document.getElementById("desc-level");
  if (levelEl) {
    const need = expToNextLevel();
    levelEl.innerHTML = `<strong>⭐ Level ${player.level || 1}</strong><br>EXP: ${player.exp || 0}/${need} · Attribute points: ${player.attributePoints || 0}<div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, ((player.exp || 0) / need) * 100)}%"></div></div>`;
  }
  const equipEl = document.getElementById("desc-equipment");
  if (equipEl) {
    const weaponOptions = Object.keys(WEAPONS).map(name => `<option value="${name}" ${player.weapon === name ? "selected" : ""}>${name} (${WEAPONS[name].rarity})</option>`).join("");
    const w = getWeapon();
    equipEl.innerHTML = `<strong>⚔️ Weapon: ${player.weapon || "Sword"}</strong><br>${w.description}<br>Damage x${w.damage} · Range ${w.range} · Crit ${Math.round(w.crit*100)}%<br>Proficiency: ${(player.weaponProficiency || {})[player.weapon] || 0}<br><select onchange="equipWeapon(this.value)">${weaponOptions}</select>`;
  }
  const pointsEl = document.getElementById("attribute-allocation");
  if (pointsEl) {
    const labels = {str:"STR",dex:"DEX",con:"CON",int:"INT",wis:"WIS",cha:"CHA"};
    pointsEl.innerHTML = `<strong>Spend Attribute Points (${player.attributePoints || 0})</strong><div class="attribute-grid">${Object.keys(labels).map(k => `<button onclick="allocateAttribute('${k}')" ${!(player.attributePoints > 0) ? "disabled" : ""}>+1 ${labels[k]}</button>`).join("")}</div>`;
  }
  if (typeof updateNpcUI === 'function') updateNpcUI();
}

function completeQuest(questId) {
  const q = activeQuests.find(quest => quest.id === questId);
  if (!q || q.completed) return;
  if (q.progress >= q.target) {
    q.completed = true;
    player.gold += q.rewardGold;
    showAlert(`🏆 Quest Completed! Earned ${q.rewardGold} Gold!`, "success");
    gainExp(40);
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
  if (isPaused || player.hp <= 0) return;
  let moveX = joystickMoveX, moveY = joystickMoveY;
  if (moveX !== 0 || moveY !== 0) {
    player.x += moveX * getMoveSpeed();
    player.y += moveY * getMoveSpeed();
    
    // Play footstep sound
    footstepTimer++;
    if (footstepTimer > 20) {
      if (typeof playSound === 'function') playSound('walk');
      footstepTimer = 0;
    }
  }
  player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(20, Math.min(canvas.height - player.size, player.y));

  if (currentMap === "hunt") {
    if (typeof updateForest === 'function') updateForest();
  } else {
    if (typeof updateTown === 'function') updateTown();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (currentMap === "town") {
    if (typeof drawTown === 'function') drawTown();
  } else {
    if (typeof drawForest === 'function') drawForest();
  }
}

function gameLoop() {
  update(); draw();
  autoSaveFrame++;
  if (autoSaveFrame >= 1800) {
    saveGame(false);
    autoSaveFrame = 0;
  }
  requestAnimationFrame(gameLoop);
}

loadGame(); updateUI(); gameLoop();
