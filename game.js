const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");
const alertBanner = document.getElementById("alert-banner");

let currentMap = "town";

const DEFAULT_PLAYER = {
  x: 270,
  y: 120,
  size: 28,
  hp: 100,
  gold: 100, // Starting bonus gold for gacha testing!
  reputation: 0,
  // 99 Max Stack per item
  rawMeat: 0,
  primeMeat: 0,
  herbs: 0,
  mushrooms: 0,
  skewers: 0,
  steaks: 0,
  feasts: 0,
  salads: 0,
  tonics: 0,
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10
};

let player = { ...DEFAULT_PLAYER };

// Town NPCs with Personalities & Hearts
let npcs = [
  { id: 1, name: "Chef Remy", x: 80, y: 100, size: 28, color: "#89dceb", personality: "Passionate & strict about culinary art.", favoriteDish: "steaks", hearts: 0, talkedToday: false },
  { id: 2, name: "Aria the Ranger", x: 450, y: 100, size: 28, color: "#a6e3a1", personality: "Brave hunter who loves wild forest ingredients.", favoriteDish: "salads", hearts: 0, talkedToday: false },
  { id: 3, name: "Merchant Leon", x: 270, y: 200, size: 28, color: "#f9e2af", personality: "Cunny trader always looking for rare monster parts.", favoriteDish: "feasts", hearts: 0, talkedToday: false }
];

let enemies = [
  { name: "Green Slime", color: "#f38ba8", x: 420, y: 120, size: 30, hp: 25, maxHp: 25, atk: 10, dropType: "meat", alive: true, state: "idle", windupTimer: 0, maxWindup: 55, cooldownTimer: 0 },
  { name: "Wild Goblin", color: "#a6e3a1", x: 150, y: 200, size: 32, hp: 45, maxHp: 45, atk: 18, dropType: "meat", alive: false, state: "idle", windupTimer: 0, maxWindup: 45, cooldownTimer: 0 },
  { name: "Orc Boss", color: "#fab387", x: 300, y: 60, size: 40, hp: 90, maxHp: 90, atk: 28, dropType: "prime", alive: false, state: "idle", windupTimer: 0, maxWindup: 60, cooldownTimer: 0 }
];

let wildItems = [];

function showAlert(text, type = "info") {
  alertBanner.textContent = text;
  if (type === "success") alertBanner.style.backgroundColor = "#a6e3a1";
  else if (type === "danger") alertBanner.style.backgroundColor = "#f38ba8";
  else alertBanner.style.backgroundColor = "#fab387";
  
  alertBanner.style.opacity = "1";
  setTimeout(() => { alertBanner.style.opacity = "0"; }, 3500);
}

function spawnWildItems() {
  wildItems = [
    { type: "herb", icon: "🌿", color: "#a6e3a1", x: 100, y: 80, size: 22, active: true },
    { type: "mushroom", icon: "🍄", color: "#fab387", x: 400, y: 200, size: 22, active: true }
  ];
}

// --- MAP SWITCHER ---
function switchMap() {
  if (currentMap === "town") {
    currentMap = "hunt";
    document.getElementById("map-toggle-btn").textContent = "🏠 Return to Town";
    document.getElementById("map-toggle-btn").style.backgroundColor = "#f9e2af";
    showAlert("Entered Hunting Grounds! Watch out for monster attacks!", "danger");
    player.x = 60; player.y = 120;
    spawnWildItems();
    respawnAllEnemies();
  } else {
    currentMap = "town";
    document.getElementById("map-toggle-btn").textContent = "🌲 Travel to Hunting Grounds";
    document.getElementById("map-toggle-btn").style.backgroundColor = "#a6e3a1";
    showAlert("Returned safely to Town!", "success");
    player.x = 270; player.y = 120;
    updateUI();
  }
}

// --- SAVE & LOAD ---
function saveGame() {
  localStorage.setItem("RPGHuntCook_Save_v4", JSON.stringify({ player, npcs }));
  showAlert("💾 Game Saved Successfully!", "success");
}

function loadGame() {
  const saved = localStorage.getItem("RPGHuntCook_Save_v4");
  if (saved) {
    const data = JSON.parse(saved);
    player = { ...DEFAULT_PLAYER, ...data.player };
    if (data.npcs) npcs = data.npcs;
    showAlert("📂 Save file loaded!", "success");
  }
}

function resetGame() {
  if (confirm("Reset all progress?")) {
    localStorage.removeItem("RPGHuntCook_Save_v4");
    player = { ...DEFAULT_PLAYER };
    if (currentMap === "hunt") switchMap();
    updateUI();
    showAlert("🔄 New game started!", "info");
  }
}

// --- RPG STATS ---
function getAttackDmg() { return player.str; }
function getTotalDishes() { return player.skewers + player.steaks + player.feasts + player.salads + player.tonics; }
function getMoveSpeed() { return 3 + (player.dex * 0.1); }
function getDodgeChance() { return Math.min(70, (player.dex - 8) * 4); }
function getMaxHp() { return 50 + (player.con * 5); }
function getDamageReduction() { return Math.floor((player.con - 10) / 2); }
function getDoubleDropChance() { return Math.min(75, (player.wis - 8) * 4); }
function getUpgradeCost() { return Math.max(5, 20 - Math.floor((player.cha - 10) * 1.5)); }

// --- CONTROLS ---
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === " " && currentMap === "hunt") triggerAttack();
  if (e.key.toLowerCase() === "e") triggerMainAction();
});
window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

let activePointerId = null;
let joystickMoveX = 0;
let joystickMoveY = 0;
const base = document.getElementById("joystick-base");
const knob = document.getElementById("joystick-knob");

base.addEventListener("pointerdown", (e) => { e.preventDefault(); activePointerId = e.pointerId; base.setPointerCapture(e.pointerId); updateJoystickPosition(e.clientX, e.clientY); });
base.addEventListener("pointermove", (e) => { if (e.pointerId !== activePointerId) return; e.preventDefault(); updateJoystickPosition(e.clientX, e.clientY); });
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
  if (pointerId !== undefined && base.hasPointerCapture(pointerId)) base.releasePointerCapture(pointerId);
  activePointerId = null; joystickMoveX = 0; joystickMoveY = 0;
  knob.style.transform = `translate(0px, 0px)`;
}

// --- GACHA SYSTEM ---
function pullGacha() {
  if (player.gold < 50) {
    showAlert("Not enough Gold for Gacha! Need 50 🪙", "danger");
    return;
  }
  player.gold -= 50;

  const roll = Math.random();
  let rewardText = "";

  if (roll < 0.40) {
    // Ingredient bundle
    player.rawMeat = Math.min(99, player.rawMeat + 5);
    player.herbs = Math.min(99, player.herbs + 3);
    rewardText = "🎉 Gacha Win! Received 5x Meat & 3x Herbs!";
  } else if (roll < 0.70) {
    // Bonus Gold jackpot
    player.gold += 120;
    rewardText = "💎 JACKPOT! Won 120 Gold coins!";
  } else if (roll < 0.90) {
    // Rare Pre-cooked Feasts
    player.feasts = Math.min(99, player.feasts + 2);
    rewardText = "🍖 Rare Pull! Received 2x Prime Beast Feasts!";
  } else {
    // Legendary Stat boost!
    player.str += 2;
    player.dex += 2;
    rewardText = "🌟 LEGENDARY PULL! +2 Strength & +2 Dexterity permanently!";
  }

  document.getElementById("gacha-result-box").textContent = rewardText;
  showAlert(rewardText, "success");
  updateUI();
}

// --- NPC DATING & HEARTS ---
function talkToNpc(npcId) {
  const npc = npcs.find(n => n.id === npcId);
  if (!npc) return;

  if (npc.talkedToday) {
    showAlert(`${npc.name}: "You already talked to me today! Come back later."`, "info");
    return;
  }

  npc.talkedToday = true;
  npc.hearts = Math.min(10, npc.hearts + 1);
  showAlert(`🗣️ Talked to ${npc.name}. Hearts increased to ❤️ ${npc.hearts}!`, "success");
  updateUI();
  openModal('npc-modal');
}

function giftNpc(npcId, dishKey) {
  const npc = npcs.find(n => n.id === npcId);
  if (!npc) return;

  if (player[dishKey] <= 0) {
    showAlert(`You don't have any of that dish to gift!`, "danger");
    return;
  }

  player[dishKey]--;
  const isFavorite = (dishKey === npc.favoriteDish);
  const heartGain = isFavorite ? 3 : 1;
  npc.hearts = Math.min(10, npc.hearts + heartGain);

  showAlert(`🎁 Gifted to ${npc.name}! ${isFavorite ? "They LOVED it! (+3 ❤️)" : "They appreciated it! (+1 ❤️)"}`, "success");
  updateUI();
  openModal('npc-modal');
}

// --- MAIN ACTION BUTTON (GRAB OR TALK) ---
function triggerMainAction() {
  if (currentMap === "hunt") {
    let grabbed = false;
    wildItems.forEach(item => {
      if (item.active) {
        const dx = (player.x + player.size/2) - (item.x + item.size/2);
        const dy = (player.y + player.size/2) - (item.y + item.size/2);
        if (Math.sqrt(dx*dx + dy*dy) < 45) {
          item.active = false;
          if (item.type === "herb") { player.herbs = Math.min(99, player.herbs + 1); showAlert("🌿 Grabbed Wild Herb!", "success"); }
          else { player.mushrooms = Math.min(99, player.mushrooms + 1); showAlert("🍄 Grabbed Mushroom!", "success"); }
          grabbed = true;
          setTimeout(() => { item.active = true; item.x = Math.random() * 450 + 50; item.y = Math.random() * 200 + 40; }, 4000);
        }
      }
    });
    if (!grabbed) showAlert("Nothing nearby to grab!", "info");
  } else {
    npcs.forEach(npc => {
      const dx = (player.x + player.size/2) - (npc.x + npc.size/2);
      const dy = (player.y + player.size/2) - (npc.y + npc.size/2);
      if (Math.sqrt(dx*dx + dy*dy) < 55) {
        openModal('npc-modal');
      }
    });
  }
  updateUI();
}

// --- COOKING ---
function cookRecipe(type) {
  if (type === "skewer" && player.rawMeat >= 1) { player.rawMeat--; player.skewers = Math.min(99, player.skewers + 1); showAlert("🍳 Successfully cooked Meat Skewer!", "success"); }
  else if (type === "steak" && player.rawMeat >= 1 && player.herbs >= 1) { player.rawMeat--; player.herbs--; player.steaks = Math.min(99, player.steaks + 1); showAlert("🍳 Successfully cooked Herb-Roasted Steak!", "success"); }
  else if (type === "feast" && player.primeMeat >= 1 && player.mushrooms >= 1) { player.primeMeat--; player.mushrooms--; player.feasts = Math.min(99, player.feasts + 1); showAlert("🍳 Successfully cooked Prime Beast Feast!", "success"); }
  else if (type === "salad" && player.herbs >= 2 && player.mushrooms >= 1) { player.herbs -= 2; player.mushrooms--; player.salads = Math.min(99, player.salads + 1); showAlert("🍳 Successfully cooked Forest Salad!", "success"); }
  else if (type === "tonic" && player.mushrooms >= 2 && player.herbs >= 1) { player.mushrooms -= 2; player.herbs--; player.tonics = Math.min(99, player.tonics + 1); showAlert("🍳 Successfully cooked Mushroom Tonic!", "success"); }
  else {
    showAlert("❌ Not enough ingredients to cook this!", "danger");
  }
  updateUI();
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
  showAlert(`🍲 Ate cooked dish and restored ${healAmt} HP!`, "success");
  updateUI();
}

// --- UI UPDATES ---
function updateUI() {
  const maxHp = getMaxHp();
  const cost = getUpgradeCost();

  document.getElementById("stat-gold").textContent = `🪙 ${player.gold}`;
  document.getElementById("stat-rep").textContent = `⭐ Rep: ${player.reputation}`;

  document.getElementById("inv-meat").textContent = `🥩: ${player.rawMeat}/99`;
  document.getElementById("inv-prime").textContent = `🍖: ${player.primeMeat}/99`;
  document.getElementById("inv-herb").textContent = `🌿: ${player.herbs}/99`;
  document.getElementById("inv-shroom").textContent = `🍄: ${player.mushrooms}/99`;

  const hpEl = document.getElementById("stat-hp");
  hpEl.textContent = `HP: ${player.hp}/${maxHp}`;
  hpEl.style.color = player.hp <= (maxHp * 0.35) ? "#f38ba8" : "#a6e3a1";

  document.getElementById("disp-str").textContent = `💪 STR: ${player.str}`;
  document.getElementById("disp-dex").textContent = `⚡ DEX: ${player.dex}`;
  document.getElementById("disp-con").textContent = `🛡️ CON: ${player.con}`;
  document.getElementById("disp-int").textContent = `🧠 INT: ${player.int}`;
  document.getElementById("disp-wis").textContent = `👁️ WIS: ${player.wis}`;
  document.getElementById("disp-cha").textContent = `✨ CHA: ${player.cha}`;

  // Render NPC Dating modal
  let npcHtml = "";
  npcs.forEach(n => {
    npcHtml += `
      <div class="shop-item" style="flex-direction:column; align-items:flex-start;">
        <div><strong>${n.name}</strong> (❤️ ${n.hearts}/10)</div>
        <div style="font-size:10px; color:#b4befe; margin:3px 0;">"${n.personality}"</div>
        <div style="display:flex; gap:5px; width:100%; margin-top:5px;">
          <button onclick="talkToNpc(${n.id})">${n.talkedToday ? 'Talked Today' : 'Talk'}</button>
          <button onclick="giftNpc(${n.id}, 'skewers')" style="background:#a6e3a1;">Gift Skewer</button>
          <button onclick="giftNpc(${n.id}, 'steaks')" style="background:#89dceb;">Gift Steak</button>
        </div>
      </div>
    `;
  });
  document.getElementById("npc-list-container").innerHTML = npcHtml;

  if (currentMap === "town") {
    document.getElementById("heal-btn").disabled = getTotalDishes() < 1 || player.hp >= maxHp;
  }

  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(stat => {
    const btn = document.getElementById(`btn-${stat}`);
    if (btn) btn.textContent = `${cost} 🪙`;
  });
}

// --- COMBAT ---
function respawnAllEnemies() {
  enemies.forEach(e => { e.hp = e.maxHp; e.alive = true; e.state = "idle"; e.windupTimer = 0; e.cooldownTimer = 0; });
}

function triggerAttack() {
  if (currentMap !== "hunt" || player.hp <= 0) return;

  let closest = null, minDist = 9999;
  enemies.forEach(e => {
    if (e.alive) {
      const dist = Math.sqrt(Math.pow((player.x+14)-(e.x+17), 2) + Math.pow((player.y+14)-(e.y+17), 2));
      if (dist < minDist) { minDist = dist; closest = e; }
    }
  });

  if (closest && minDist < 75) {
    const dmg = getAttackDmg();
    closest.hp -= dmg;

    if (closest.hp <= 0) {
      closest.alive = false;
      const gained = Math.min(99, (Math.random()*100 < getDoubleDropChance() ? 2 : 1));
      if (closest.dropType === "prime") {
        player.primeMeat = Math.min(99, player.primeMeat + gained);
        showAlert(`🏆 Defeated Orc Boss! Got ${gained}x Prime Meat!`, "success");
      } else {
        player.rawMeat = Math.min(99, player.rawMeat + gained);
        showAlert(`⚔️ Defeated ${closest.name}! Got ${gained}x Meat!`, "success");
      }
      updateUI();
      if (enemies.every(e => !e.alive)) setTimeout(respawnAllEnemies, 3000);
    } else {
      if (closest.state === "idle") { closest.state = "windup"; closest.windupTimer = closest.maxWindup; }
      showAlert(`Hit ${closest.name} for ${dmg} DMG! ⚠️ Watch out!`, "info");
    }
    updateUI();
  } else {
    showAlert("Too far away from any monster!", "danger");
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

// --- LOOP ---
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

  if (currentMap === "hunt") {
    enemies.forEach(e => {
      if (e.alive) {
        const dist = Math.sqrt(Math.pow((player.x+14)-(e.x+17), 2) + Math.pow((player.y+14)-(e.y+17), 2));
        if (e.state === "idle") {
          if (dist < 65 && e.cooldownTimer === 0) { e.state = "windup"; e.windupTimer = e.maxWindup; }
          if (e.cooldownTimer > 0) e.cooldownTimer--;
        } else if (e.state === "windup") {
          e.windupTimer--;
          if (e.windupTimer <= 0) {
            e.state = "idle"; e.cooldownTimer = 60;
            if (dist < 80) {
              if (Math.random()*100 < getDodgeChance()) {
                showAlert(`⚡ Auto-dodged the ${e.name}'s attack!`, "success");
              } else {
                const taken = Math.max(1, e.atk - getDamageReduction());
                player.hp = Math.max(0, player.hp - taken);
                showAlert(`💥 ATTACKED! ${e.name} hit you for ${taken} DMG!`, "danger");
                if (player.hp === 0) showAlert("💀 You fainted!", "danger");
              }
              updateUI();
            }
          }
        }
      }
    });
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentMap === "town") {
    // Draw Town Square & NPC positions
    npcs.forEach(n => {
      ctx.fillStyle = n.color;
      ctx.fillRect(n.x, n.y, n.size, n.size);
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(n.name, n.x + n.size/2, n.y - 6);
    });

    // Hero
    ctx.fillStyle = "#89b4fa";
    ctx.fillRect(player.x, player.y, player.size, player.size);
  } else {
    wildItems.forEach(i => {
      if (i.active) {
        ctx.fillStyle = i.color;
        ctx.beginPath(); ctx.arc(i.x+11, i.y+11, 11, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font="10px sans-serif"; ctx.textAlign="center"; ctx.fillText(i.icon, i.x+11, i.y+4);
      }
    });

    enemies.forEach(e => {
      if (e.alive) {
        ctx.fillStyle = e.state === "windup" ? "#f9e2af" : e.color;
        ctx.fillRect(e.x, e.y, e.size, e.size);
        ctx.fillStyle = "#45475a"; ctx.fillRect(e.x, e.y-8, e.size, 5);
        ctx.fillStyle = "#fab387"; ctx.fillRect(e.x, e.y-8, e.size*(e.hp/e.maxHp), 5);
      }
    });

    ctx.fillStyle = "#89b4fa";
    ctx.fillRect(player.x, player.y, player.size, player.size);
    const maxHp = getMaxHp();
    const hpRatio = player.hp / maxHp;
    ctx.fillStyle = "#45475a"; ctx.fillRect(player.x-4, player.y-8, player.size+8, 5);
    ctx.fillStyle = hpRatio <= 0.35 ? "#f38ba8" : "#a6e3a1";
    ctx.fillRect(player.x-4, player.y-8, (player.size+8)*hpRatio, 5);
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
          
