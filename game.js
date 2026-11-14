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

// NPCs with Schedules, Unique Dialogue, Relationship Levels & Traits
let npcs = [
  { id: 1, name: "Chef Remy", x: 80, y: 100, size: 28, color: "#89dceb", trait: "Aggressive Cook", personality: "Passionate & strict about culinary art.", hearts: 0, inParty: false, talkedToday: false, giftPref: "Steak", schedule: { Morning: "Kitchen", Afternoon: "Town Square", Evening: "Inn", Night: "Home" } },
  { id: 2, name: "Aria the Ranger", x: 450, y: 100, size: 28, color: "#a6e3a1", trait: "Forager", personality: "Brave hunter who loves wild forest ingredients.", hearts: 0, inParty: false, talkedToday: false, giftPref: "Herb", schedule: { Morning: "Guild", Afternoon: "Town Square", Evening: "Shop", Night: "Home" } },
  { id: 3, name: "Merchant Leon", x: 270, y: 200, size: 28, color: "#f9e2af", trait: "Scavenger", personality: "Cunny trader looking for rare monster parts.", hearts: 0, inParty: false, talkedToday: false, giftPref: "Gold", schedule: { Morning: "Shop", Afternoon: "Guild", Evening: "Inn", Night: "Home" } }
];

// Quests at Adventurer's Guild
let activeQuests = [
  { id: 1, title: "Slay 3 Slimes", type: "hunt", target: 3, progress: 0, rewardGold: 60, rewardRep: 25, completed: false },
  { id: 2, title: "Gather 2 Herbs", type: "gather", target: 2, progress: 0, rewardGold: 40, rewardRep: 15, completed: false }
];

let enemies = [
  { name: "Easy Slime", color: "#a6e3a1", x: 420, y: 120, size: 28, hp: 15, maxHp: 15, atk: 5, dropType: "meat", alive: true, state: "patrol", dirX: 1, dirY: 0, moveTimer: 0, windupTimer: 0, maxWindup: 70 }
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

function showCenterPopup(title, msg) {
  document.getElementById("popup-title").textContent = title;
  document.getElementById("popup-msg").textContent = msg;
  document.getElementById("center-popup-overlay").style.display = "flex";
}

function closeCenterPopup() {
  document.getElementById("center-popup-overlay").style.display = "none";
}

function spawnWildItems() {
  wildItems = [
    { type: "herb", icon: "🌿", color: "#a6e3a1", x: 120, y: 90, size: 22, active: true },
    { type: "mushroom", icon: "🍄", color: "#fab387", x: 420, y: 210, size: 22, active: true }
  ];
}

// --- ADVANCE TIME & INN/CAMP RESTING ---
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

function sleepAtInn() {
  const cost = 25;
  if (player.gold < cost) {
    showAlert(`Inn costs ${cost} Gold for lodging and food!`, "danger");
    return;
  }
  player.gold -= cost;
  player.hp = getMaxHp(); // Full HP restoration
  advanceTime();

  showCenterPopup("🛌 Slept at the Inn", `Paid ${cost} Gold. You rested comfortably, ate a warm meal, and fully restored your HP to maximum! (Current: Day ${dayCount} - ${timeOfDay})`);
  updateUI();
}

function restAtCamp() {
  advanceTime();
  showCenterPopup("⛺ Rested at Camp", `You set up a campfire in the wild for free. Time advanced to ${timeOfDay}, but HP was not fully restored.`);
  updateUI();
}

// --- MAP SWITCHER (TOWN BUILDINGS & EXPLORATION) ---
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

// --- RELATIONSHIP STAGE HELPER ---
function getRelationshipStatus(hearts) {
  if (hearts >= 10) return "💍 Married";
  if (hearts >= 7) return "💖 Lover";
  if (hearts >= 4) return "💕 Dating";
  return "🤝 Friend";
}

// --- UNIQUE NPC DIALOGUE & DATING ---
let activeDlgNpc = null;

function openDialogue(npcId) {
  const npc = npcs.find(n => n.id === npcId);
  if (!npc) return;
  activeDlgNpc = npc;

  document.getElementById("dlg-npc-name").textContent = `Chatting with ${npc.name} (${getRelationshipStatus(npc.hearts)})`;
  
  let intro = "";
  if (npc.id === 1) intro = `Chef Remy (${npc.schedule[timeOfDay]}): 'Hmph. Are you here to inspect my kitchen?'`;
  else if (npc.id === 2) intro = `Aria (${npc.schedule[timeOfDay]}): 'The forest whispers of danger today...'`;
  else intro = `Leon (${npc.schedule[timeOfDay]}): 'Gold makes the world go round, traveler.'`;

  document.getElementById("dlg-text").textContent = intro;

  let choicesHtml = `
    <button onclick="answerDialogue('compliment')">Compliment their craft (+Affection)</button>
    <button onclick="answerDialogue('quest')">Ask about local rumors</button>
  `;
  document.getElementById("dlg-choices").innerHTML = choicesHtml;
  openModal('dialogue-modal');
}

function answerDialogue(type) {
  if (!activeDlgNpc) return;
  const npc = activeDlgNpc;

  if (type === 'compliment') {
    npc.hearts = Math.min(15, npc.hearts + 1);
    showAlert(`💖 ${npc.name} appreciated your words! Status: ${getRelationshipStatus(npc.hearts)}`, "success");
    document.getElementById("dlg-text").textContent = `"${npc.name}: Well... that's very sweet of you."`;
  } else {
    npc.hearts = Math.min(15, npc.hearts + 1);
    showAlert(`🗺️ ${npc.name} shared a helpful tip!`, "success");
    document.getElementById("dlg-text").textContent = `"${npc.name}: Keep your eyes open near the thicket."`;
  }
  updateUI();
}

function toggleParty(npcId) {
  const npc = npcs.find(n => n.id === npcId);
  if (!npc) return;

  if (npc.inParty) {
    npc.inParty = false;
    showAlert(`${npc.name} left your party.`, "info");
  } else {
    if (npc.hearts < 3) {
      showAlert(`You need at least 3 ❤️ Hearts to invite ${npc.name}!`, "danger");
      return;
    }
    npc.inParty = true;
    showAlert(`🤝 ${npc.name} joined your party from the Guild!`, "success");
  }
  updateUI();
  openModal('npc-modal');
}

function giftItemToNpc(npcId, itemIndex) {
  const npc = npcs.find(n => n.id === npcId);
  const item = player.inventory[itemIndex];
  if (!npc || !item) return;

  player.inventory.splice(itemIndex, 1);
  npc.hearts = Math.min(15, npc.hearts + 3);
  showAlert(`🎁 Gifted ${item.name} to ${npc.name}! (+3 ❤️)`, "success");
  updateUI();
  openModal('npc-modal');
}

// --- ADVENTURER'S GUILD & QUESTS ---
function completeQuest(questId) {
  const q = activeQuests.find(quest => quest.id === questId);
  if (!q || q.completed) return;

  if (q.progress >= q.target) {
    q.completed = true;
    player.gold += q.rewardGold;
    player.reputation += q.rewardRep;
    showAlert(`🏆 Quest Completed! Earned ${q.rewardGold} Gold & Reputation!`, "success");
    updateUI();
    openModal('guild-modal');
  } else {
    showAlert(`Quest requirements not met yet (${q.progress}/${q.target})`, "danger");
  }
}

// --- GACHA SYSTEM ---
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
    rarity = "Common ⚪";
    rewardName = "Silk Ribbon";
    player.rawMeat = Math.min(99, player.rawMeat + 2);
  } else if (roll < 85) {
    rarity = "Rare 🔵";
    rewardName = "Silver Necklace";
    player.herbs = Math.min(99, player.herbs + 3);
  } else if (roll < 97) {
    rarity = "Epic 🟣";
    rewardName = "Gold Crown";
    player.gold += 80;
  } else {
    rarity = "Legendary 🟡";
    rewardName = "Celestial Diadem";
    player.primeMeat = Math.min(99, player.primeMeat + 2);
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

// --- ACTIONS & KITCHEN WITH REMAINING INGREDIENTS COUNTS ---
function triggerMainAction() {
  if (currentMap === "hunt") {
    wildItems.forEach(item => {
      if (item.active) {
        const dx = (player.x + 14) - (item.x + 11);
        const dy = (player.y + 14) - (item.y + 11);
        if (Math.sqrt(dx*dx + dy*dy) < 45) {
          item.active = false;
          if (item.type === "herb") {
            player.herbs = Math.min(99, player.herbs + 1);
            showAlert("🌿 Grabbed Wild Herb!", "success");
            // Check quest progress
            activeQuests.forEach(q => { if (q.type === 'gather' && !q.completed) q.progress = Math.min(q.target, q.progress + 1); });
          } else {
            player.mushrooms = Math.min(99, player.mushrooms + 1);
            showAlert("🍄 Grabbed Mushroom!", "success");
          }
          setTimeout(() => { item.active = true; item.x = Math.random() * 450 + 50; item.y = Math.random() * 200 + 40; }, 4000);
        }
      }
    });
  } else {
    // Interact with Town buildings/NPCs based on proximity
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

// --- SAVE / LOAD ---
function saveGame() {
  localStorage.setItem("RPGHuntCook_Save_v6", JSON.stringify({ player, npcs, dayCount, timeOfDay, activeQuests }));
  showAlert("💾 Game Saved Successfully!", "success");
}

function loadGame() {
  const saved = localStorage.getItem("RPGHuntCook_Save_v6");
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
    localStorage.removeItem("RPGHuntCook_Save_v6");
    player = { ...DEFAULT_PLAYER };
    dayCount = 1; timeOfDay = "Morning";
    if (currentMap === "hunt") switchMap();
    updateUI();
    showAlert("🔄 New game started!", "info");
  }
}

// --- UI UPDATES WITH DYNAMIC INGREDIENT COUNTS ---
function updateUI() {
  const maxHp = getMaxHp();
  const cost = getUpgradeCost();

  document.getElementById("stat-daytime").textContent = `☀️ Day ${dayCount} (${timeOfDay})`;
  document.getElementById("stat-gold").textContent = `🪙 ${player.gold}`;

  document.getElementById("inv-meat").textContent = `🥩: ${player.rawMeat}/99`;
  document.getElementById("inv-prime").textContent = `🍖: ${player.primeMeat}/99`;
  document.getElementById("inv-herb").textContent = `🌿: ${player.herbs}/99`;
  document.getElementById("inv-shroom").textContent = `🍄: ${player.mushrooms}/99`;

  // Real-time ingredient remaining display in Kitchen modal
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

  // Guild Quests HTML
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

  let npcHtml = "";
  npcs.forEach(n => {
    let giftsOptions = "";
    player.inventory.forEach((invItem, idx) => {
      giftsOptions += `<button onclick="giftItemToNpc(${n.id}, ${idx})" style="background:#f9e2af; font-size:9px;">Gift ${invItem.name}</button>`;
    });

    npcHtml += `
      <div class="shop-item" style="flex-direction:column; align-items:flex-start;">
        <div><strong>${n.name}</strong> (${getRelationshipStatus(n.hearts)} - ❤️ ${n.hearts}/15)</div>
        <div style="font-size:10px; color:#b4befe; margin:2px 0;">Location (${timeOfDay}): ${n.schedule[timeOfDay]} | Party: ${n.inParty ? '🟢 Joined' : '⚪ Away'}</div>
        <div style="display:flex; gap:4px; width:100%; margin-top:5px; flex-wrap:wrap;">
          <button onclick="openDialogue(${n.id})">Chat</button>
          <button onclick="toggleParty(${n.id})" style="background:${n.inParty ? '#eba0ac' : '#a6e3a1'};">${n.inParty ? 'Dismiss' : 'Invite (Req 3 ❤️)'}</button>
          ${giftsOptions}
        </div>
      </div>
    `;
  });
  document.getElementById("npc-list-container").innerHTML = npcHtml;

  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(stat => {
    const btn = document.getElementById(`btn-${stat}`);
    if (btn) btn.textContent = `${cost} 🪙`;
  });
}

// --- COMBAT & QUEST PROGRESSION ---
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
      const gained = Math.min(99, (Math.random()*100 < 30 ? 2 : 1));
      if (closest.dropType === "prime") {
        player.primeMeat = Math.min(99, player.primeMeat + gained);
        showAlert(`🏆 Defeated ${closest.name}! Got Prime Meat!`, "success");
      } else {
        player.rawMeat = Math.min(99, player.rawMeat + gained);
        showAlert(`⚔️ Defeated ${closest.name}! Got Meat!`, "success");
        // Update hunt quest
        activeQuests.forEach(q => { if (q.type === 'hunt' && !q.completed) q.progress = Math.min(q.target, q.progress + 1); });
      }
      updateUI();
      setTimeout(() => { closest.hp = closest.maxHp; closest.alive = true; closest.x = Math.random()*400+50; closest.y = Math.random()*200+40; }, 4000);
    } else {
      showAlert(`Hit ${closest.name} for ${dmg} DMG!`, "info");
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

// --- MAIN LOOP WITH JOYSTICK TOWN EXPLORATION ---
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

  if (currentMap === "hunt") {
    enemies.forEach(e => {
      if (e.alive) {
        const dist = Math.sqrt(Math.pow((player.x+14)-(e.x+17), 2) + Math.pow((player.y+14)-(e.y+17), 2));

        if (dist < 130) {
          if (e.state === "patrol") {
            e.state = "windup";
            e.windupTimer = e.maxWindup;
            showAlert(`⚠️ ${e.name} spots you and winds up an attack!`, "danger");
          }

          if (e.state === "windup") {
            e.windupTimer--;
            if (e.windupTimer <= 0) {
              e.state = "patrol";
              if (dist < 65) {
                if (Math.random() * 100 < getDodgeChance()) {
                  showAlert(`⚡ Auto-dodged the ${e.name}'s strike!`, "success");
                } else {
                  const taken = Math.max(1, e.atk - (Math.floor((player.con - 10) / 2)));
                  player.hp = Math.max(0, player.hp - taken);
                  showAlert(`💥 ${e.name} struck you for ${taken} DMG!`, "danger");
                }
                updateUI();
              }
            }
          }

          if (e.x < player.x) e.x += 0.8; else e.x -= 0.8;
          if (e.y < player.y) e.y += 0.8; else e.y -= 0.8;
        } else {
          e.state = "patrol";
        }
      }
    });
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentMap === "town") {
    // Draw Town Buildings (Inn, Guild, Shop, Kitchen)
    ctx.fillStyle = "#fab387"; ctx.fillRect(30, 40, 110, 80);
    ctx.fillStyle = "#111"; ctx.font="11px sans-serif"; ctx.textAlign="center"; ctx.fillText("🛌 Inn", 85, 85);

    ctx.fillStyle = "#89dceb"; ctx.fillRect(160, 40, 110, 80);
    ctx.fillStyle = "#111"; ctx.fillText("⚔️ Guild", 215, 85);

    ctx.fillStyle = "#f9e2af"; ctx.fillRect(290, 40, 110, 80);
    ctx.fillStyle = "#111"; ctx.fillText("🛒 Shop", 345, 85);

    // Draw NPCs at their schedule locations in Town
    npcs.forEach(n => {
      ctx.fillStyle = n.color;
      ctx.fillRect(n.x, n.y, n.size, n.size);
      ctx.fillStyle = "#ffffff"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`${n.name} (❤️${n.hearts})`, n.x + n.size/2, n.y - 6);
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
        ctx.fillStyle = e.color;
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
