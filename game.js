const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");
const alertBanner = document.getElementById("alert-banner");

let currentMap = "town";
let dayCount = 1;

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

// NPCs with Personality & Traits
let npcs = [
  { id: 1, name: "Chef Remy", x: 80, y: 100, size: 28, color: "#89dceb", trait: "Aggressive Cook", personality: "Passionate & strict about culinary art.", hearts: 0, inParty: false, talkedToday: false, giftPref: "Steak" },
  { id: 2, name: "Aria the Ranger", x: 450, y: 100, size: 28, color: "#a6e3a1", trait: "Forager", personality: "Brave hunter who loves wild forest ingredients.", hearts: 0, inParty: false, talkedToday: false, giftPref: "Herb" },
  { id: 3, name: "Merchant Leon", x: 270, y: 200, size: 28, color: "#f9e2af", trait: "Scavenger", personality: "Cunny trader looking for rare monster parts.", hearts: 0, inParty: false, talkedToday: false, giftPref: "Gold" }
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

function spawnWildItems() {
  wildItems = [
    { type: "herb", icon: "🌿", color: "#a6e3a1", x: 120, y: 90, size: 22, active: true },
    { type: "mushroom", icon: "🍄", color: "#fab387", x: 420, y: 210, size: 22, active: true }
  ];
}

// --- INN SLEEP SYSTEM (FREE days 1-3, then scales) ---
function sleepAtInn() {
  const cost = dayCount <= 3 ? 0 : (dayCount - 3) * 10;
  if (player.gold < cost) {
    showAlert(`Inn costs ${cost} Gold tonight!`, "danger");
    return;
  }
  player.gold -= cost;
  dayCount++;
  player.hp = getMaxHp(); // Fully restores HP!
  
  npcs.forEach(n => { n.talkedToday = false; });
  showAlert(`☀️ Day ${dayCount}! Slept at the Inn (${cost === 0 ? "FREE" : cost + " 🪙"}) & fully restored HP!`, "success");
  updateUI();
}

// --- MAP SWITCHER WITH DIFFICULTY CHOICE ---
function switchMap() {
  if (currentMap === "town") {
    let choice = prompt("Choose Forest Difficulty:\n1. Easy (Slimes - Weak, Easy Meat)\n2. Medium (Goblins - Balanced)\n3. Hard (Orc Bosses - Tough, High Rewards)\nEnter 1, 2, or 3:", "1");
    if (!choice) return;

    currentMap = "hunt";
    document.getElementById("map-toggle-btn").textContent = "🏠 Flee to Town (Safe Zone)";
    document.getElementById("map-toggle-btn").style.backgroundColor = "#f9e2af";

    if (choice === "1") {
      enemies = [
        { name: "Easy Slime", color: "#a6e3a1", x: 420, y: 120, size: 28, hp: 15, maxHp: 15, atk: 5, dropType: "meat", alive: true, state: "patrol", dirX: 1, dirY: 0, moveTimer: 0, windupTimer: 0, maxWindup: 70 }
      ];
      showAlert("Entered EASY Forest! Monsters are weak.", "success");
    } else if (choice === "3") {
      enemies = [
        { name: "Hard Orc Warlord", color: "#f38ba8", x: 300, y: 60, size: 42, hp: 120, maxHp: 120, atk: 35, dropType: "prime", alive: true, state: "patrol", dirX: 0, dirY: -1, moveTimer: 0, windupTimer: 0, maxWindup: 35 }
      ];
      showAlert("Entered HARD Forest! Dangerous boss monsters!", "danger");
    } else {
      enemies = [
        { name: "Medium Goblin", color: "#fab387", x: 150, y: 200, size: 32, hp: 45, maxHp: 45, atk: 18, dropType: "meat", alive: true, state: "patrol", dirX: -1, dirY: 1, moveTimer: 0, windupTimer: 0, maxWindup: 50 }
      ];
      showAlert("Entered MEDIUM Forest. Standard hunt.", "info");
    }

    player.x = 60; player.y = 120;
    spawnWildItems();
  } else {
    currentMap = "town";
    document.getElementById("map-toggle-btn").textContent = "🌲 Travel to Hunting Grounds";
    document.getElementById("map-toggle-btn").style.backgroundColor = "#a6e3a1";
    showAlert("Safe in Town! Monsters cannot enter here.", "success");
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
  let rewardName = "";
  let rarity = "";

  if (roll < 60) {
    rarity = "Common ⚪";
    const items = ["Silk Ribbon", "Bronze Ring", "Wild Berries", "Cloth Handkerchief"];
    rewardName = items[Math.floor(Math.random() * items.length)];
    player.rawMeat = Math.min(99, player.rawMeat + 2);
  } else if (roll < 85) {
    rarity = "Rare 🔵";
    const items = ["Silver Necklace", "Ranger Cape", "Sturdy Boots", "Mana Tome (+1 INT)"];
    rewardName = items[Math.floor(Math.random() * items.length)];
    if (rewardName.includes("INT")) player.int += 1;
    else player.herbs = Math.min(99, player.herbs + 3);
  } else if (roll < 97) {
    rarity = "Epic 🟣";
    const items = ["Gold Crown", "Knight's Gauntlets", "Warrior Tome (+2 STR)"];
    rewardName = items[Math.floor(Math.random() * items.length)];
    if (rewardName.includes("STR")) player.str += 2;
    else player.gold += 80;
  } else {
    rarity = "Legendary 🟡";
    const items = ["Celestial Diadem", "Dragon Scale Cloak", "Godly Tome (+3 All Stats)"];
    rewardName = items[Math.floor(Math.random() * items.length)];
    if (rewardName.includes("All Stats")) { player.str += 3; player.dex += 3; player.con += 3; }
    else player.primeMeat = Math.min(99, player.primeMeat + 2);
  }

  player.inventory.push({ name: rewardName, rarity: rarity });
  const resultMsg = `[${rarity}] You pulled: ${rewardName}!`;
  document.getElementById("gacha-result-box").textContent = resultMsg;
  showAlert(resultMsg, "success");
  updateUI();
}

// --- UNIQUE NPC DIALOGUE & DATING SYSTEM ---
let activeDlgNpc = null;

function openDialogue(npcId) {
  const npc = npcs.find(n => n.id === npcId);
  if (!npc) return;
  activeDlgNpc = npc;

  document.getElementById("dlg-npc-name").textContent = `Chatting with ${npc.name}`;
  
  let intro = "";
  if (npc.id === 1) intro = "Chef Remy: 'Hmph. Are you here to inspect my kitchen, or do you actually know good food?'";
  else if (npc.id === 2) intro = "Aria: 'The forest whispers of danger today... Have you brought any rare herbs?'";
  else intro = "Leon: 'Gold makes the world go round, traveler. Got any rare items to trade?'";

  document.getElementById("dlg-text").textContent = intro;

  let choicesHtml = `
    <button onclick="answerDialogue('compliment')">Compliment their craft (+Affection)</button>
    <button onclick="answerDialogue('quest')">Ask about local rumors</button>
    <button onclick="answerDialogue('tease')">Tease them playfully</button>
  `;
  document.getElementById("dlg-choices").innerHTML = choicesHtml;
  openModal('dialogue-modal');
}

function answerDialogue(type) {
  if (!activeDlgNpc) return;
  const npc = activeDlgNpc;

  if (type === 'compliment') {
    npc.hearts = Math.min(10, npc.hearts + 1);
    showAlert(`💖 ${npc.name} appreciated your kind words! (+1 ❤️)`, "success");
    document.getElementById("dlg-text").textContent = `"${npc.name}: Well... that's very sweet of you to notice."`;
  } else if (type === 'quest') {
    npc.hearts = Math.min(10, npc.hearts + 1);
    showAlert(`🗺️ ${npc.name} shared a helpful tip! (+1 ❤️)`, "success");
    document.getElementById("dlg-text").textContent = `"${npc.name}: Keep your eyes open for wild mushrooms near the thicket."`;
  } else {
    npc.hearts = Math.max(0, npc.hearts - 1);
    showAlert(`💢 ${npc.name} didn't like that joke. (-1 ❤️)`, "danger");
    document.getElementById("dlg-text").textContent = `"${npc.name}: Hah. Very funny. Not."`;
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
      showAlert(`You need at least 3 ❤️ Hearts of affection to invite ${npc.name}!`, "danger");
      return;
    }
    npc.inParty = true;
    showAlert(`🤝 ${npc.name} joined your party!`, "success");
  }
  updateUI();
  openModal('npc-modal');
}

function giftItemToNpc(npcId, itemIndex) {
  const npc = npcs.find(n => n.id === npcId);
  const item = player.inventory[itemIndex];
  if (!npc || !item) return;

  player.inventory.splice(itemIndex, 1);
  npc.hearts = Math.min(10, npc.hearts + 3);
  showAlert(`🎁 Gifted ${item.name} to ${npc.name}! (+3 ❤️)`, "success");
  updateUI();
  openModal('npc-modal');
}

// --- RPG FORMULAS ---
function getAttackDmg() { return player.str + (npcs.filter(n => n.inParty).length * 5); }
function getMaxHp() { return 50 + (player.con * 5); }
function getMoveSpeed() { return 3 + (player.dex * 0.1); }
function getDodgeChance() { return Math.min(70, (player.dex - 8) * 4); }
function getUpgradeCost() { return Math.max(5, 20 - Math.floor((player.cha - 10) * 1.5)); }

// --- MOBILE TOUCH JOYSTICK CONTROLS ---
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

// --- ACTIONS & COOKING ---
function triggerMainAction() {
  if (currentMap === "hunt") {
    wildItems.forEach(item => {
      if (item.active) {
        const dx = (player.x + 14) - (item.x + 11);
        const dy = (player.y + 14) - (item.y + 11);
        if (Math.sqrt(dx*dx + dy*dy) < 45) {
          item.active = false;
          if (item.type === "herb") { player.herbs = Math.min(99, player.herbs + 1); showAlert("🌿 Grabbed Wild Herb!", "success"); }
          else { player.mushrooms = Math.min(99, player.mushrooms + 1); showAlert("🍄 Grabbed Mushroom!", "success"); }
          setTimeout(() => { item.active = true; item.x = Math.random() * 450 + 50; item.y = Math.random() * 200 + 40; }, 4000);
        }
      }
    });
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

// --- SAVE / LOAD ---
function saveGame() {
  localStorage.setItem("RPGHuntCook_Save_v5", JSON.stringify({ player, npcs, dayCount }));
  showAlert("💾 Game Saved Successfully!", "success");
}

function loadGame() {
  const saved = localStorage.getItem("RPGHuntCook_Save_v5");
  if (saved) {
    const data = JSON.parse(saved);
    player = { ...DEFAULT_PLAYER, ...data.player };
    if (data.npcs) npcs = data.npcs;
    if (data.dayCount) dayCount = data.dayCount;
    showAlert("📂 Save file loaded!", "success");
  }
}

function resetGame() {
  if (confirm("Reset all progress?")) {
    localStorage.removeItem("RPGHuntCook_Save_v5");
    player = { ...DEFAULT_PLAYER };
    dayCount = 1;
    if (currentMap === "hunt") switchMap();
    updateUI();
    showAlert("🔄 New game started!", "info");
  }
}

// --- UI UPDATES ---
function updateUI() {
  const maxHp = getMaxHp();
  const cost = getUpgradeCost();

  document.getElementById("stat-day").textContent = `☀️ Day ${dayCount}`;
  document.getElementById("stat-gold").textContent = `🪙 ${player.gold}`;

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

  let npcHtml = "";
  npcs.forEach(n => {
    let giftsOptions = "";
    player.inventory.forEach((invItem, idx) => {
      giftsOptions += `<button onclick="giftItemToNpc(${n.id}, ${idx})" style="background:#f9e2af; font-size:9px;">Gift ${invItem.name}</button>`;
    });

    npcHtml += `
      <div class="shop-item" style="flex-direction:column; align-items:flex-start;">
        <div><strong>${n.name}</strong> (❤️ ${n.hearts}/10) | Party: ${n.inParty ? '🟢 Joined' : '⚪ Away'}</div>
        <div style="font-size:10px; color:#b4befe; margin:2px 0;">Trait: ${n.trait}</div>
        <div style="display:flex; gap:4px; width:100%; margin-top:5px; flex-wrap:wrap;">
          <button onclick="openDialogue(${n.id})">Chat</button>
          <button onclick="toggleParty(${n.id})" style="background:${n.inParty ? '#eba0ac' : '#a6e3a1'};">${n.inParty ? 'Dismiss' : 'Invite (Req 3 ❤️)'}</button>
          ${giftsOptions}
        </div>
      </div>
    `;
  });
  document.getElementById("npc-list-container").innerHTML = npcHtml;

  let wardrobeHtml = "<strong>🎒 Gacha Wardrobe & Collectibles:</strong><br>";
  if (player.inventory.length === 0) wardrobeHtml += "<small>Empty! Pull gacha items to gift NPCs.</small>";
  else player.inventory.forEach(i => { wardrobeHtml += `- ${i.name} (${i.rarity})<br>`; });
  document.getElementById("desc-wardrobe").innerHTML = wardrobeHtml;

  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(stat => {
    const btn = document.getElementById(`btn-${stat}`);
    if (btn) btn.textContent = `${cost} 🪙`;
  });
}

// --- COMBAT & MONSTER ATTACK FIX ---
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
        showAlert(`🏆 Defeated ${closest.name}! Got ${gained}x Prime Meat!`, "success");
      } else {
        player.rawMeat = Math.min(99, player.rawMeat + gained);
        showAlert(`⚔️ Defeated ${closest.name}! Got ${gained}x Meat!`, "success");
      }
      if (npcs.some(n => n.inParty && n.trait.includes("Scavenger"))) {
        player.gold += 15;
        showAlert("💰 Leon scavenged 15 bonus Gold!", "success");
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

  npcs.forEach(n => {
    if (n.inParty && currentMap === "hunt") {
      if (n.x < player.x) n.x += 1.2; else if (n.x > player.x) n.x -= 1.2;
      if (n.y < player.y) n.y += 1.2; else if (n.y > player.y) n.y -= 1.2;
    }
  });

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
          e.moveTimer++;
          if (e.moveTimer > 80) {
            e.dirX = (Math.random() - 0.5) * 2;
            e.dirY = (Math.random() - 0.5) * 2;
            e.moveTimer = 0;
          }
          e.x += e.dirX * 0.8;
          e.y += e.dirY * 0.8;
          e.x = Math.max(20, Math.min(canvas.width - 40, e.x));
          e.y = Math.max(20, Math.min(canvas.height - 40, e.y));
        }
      }
    });
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentMap === "town") {
    ctx.fillStyle = "#fab387";
    ctx.fillRect(40, 50, 140, 100);
    ctx.fillStyle = "#11111b"; ctx.font="12px sans-serif"; ctx.textAlign="center"; ctx.fillText("🛌 INN (Sleep)", 110, 105);

    npcs.forEach(n => {
      ctx.fillStyle = n.color;
      ctx.fillRect(n.x, n.y, n.size, n.size);
      ctx.fillStyle = "#ffffff"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`${n.name} (❤️${n.hearts})`, n.x + n.size/2, n.y - 6);
    });

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

    npcs.forEach(n => {
      if (n.inParty) {
        ctx.fillStyle = n.color;
        ctx.fillRect(n.x, n.y, 24, 24);
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
