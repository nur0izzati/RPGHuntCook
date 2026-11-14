let npcs = [
  { id: 1, name: "Chef Remy", x: 80, y: 160, size: 28, color: "#89dceb", trait: "Aggressive Cook", personality: "Passionate & strict about culinary art.", hearts: 0, inParty: false, talkedToday: false, giftGivenToday: false, wanderTimer: 0, dirX: 1, dirY: 0, schedule: { Morning: "Kitchen", Afternoon: "Town Square", Evening: "Inn", Night: "Home" } },
  { id: 2, name: "Aria the Ranger", x: 450, y: 160, size: 28, color: "#a6e3a1", trait: "Forager", personality: "Brave hunter who loves wild forest ingredients.", hearts: 0, inParty: false, talkedToday: false, giftGivenToday: false, wanderTimer: 0, dirX: -1, dirY: 1, schedule: { Morning: "Guild", Afternoon: "Town Square", Evening: "Shop", Night: "Home" } },
  { id: 3, name: "Merchant Leon", x: 270, y: 180, size: 28, color: "#f9e2af", trait: "Scavenger", personality: "Cunny trader looking for rare monster parts.", hearts: 0, inParty: false, talkedToday: false, giftGivenToday: false, wanderTimer: 0, dirX: 0, dirY: -1, schedule: { Morning: "Shop", Afternoon: "Guild", Evening: "Inn", Night: "Home" } }
];

let activeDlgNpc = null;

function getRelationshipStatus(hearts) {
  if (hearts >= 10) return "💍 Married";
  if (hearts >= 7) return "💖 Lover";
  if (hearts >= 4) return "💕 Dating";
  return "🤝 Friend";
}

function sleepAtInn() {
  const cost = 25;
  if (player.gold < cost) {
    showAlert(`Inn costs ${cost} Gold for lodging and food!`, "danger");
    return;
  }
  player.gold -= cost;
  player.hp = getMaxHp();
  advanceTime();
  showCenterPopup("🛌 Slept at the Inn", `Paid ${cost} Gold. Rested comfortably, ate a warm meal, and fully restored HP! (Day ${dayCount} - ${timeOfDay})`);
  updateUI();
}

function restAtCamp() {
  advanceTime();
  showCenterPopup("⛺ Rested at Camp", `Set up a campfire in the wild for free. Time advanced to ${timeOfDay}, but HP was not restored.`);
  updateUI();
}

function openDialogue(npcId) {
  if (typeof playSound === 'function') playSound('npcTalk');
  const npc = npcs.find(n => n.id === npcId);
  if (!npc) return;
  activeDlgNpc = npc;

  document.getElementById("dlg-npc-name").textContent = `Chatting with ${npc.name} (${getRelationshipStatus(npc.hearts)})`;
  
  let intro = `"${npc.personality}"`;
  if (npc.hearts >= 5 && !npc.giftGivenToday) {
    npc.giftGivenToday = true;
    player.gold += 30;
    showAlert(`🎁 ${npc.name} handed you a free daily gift of 30 Gold!`, "success");
    intro += `\n\n(Received 30 Free Gold!)`;
  }

  document.getElementById("dlg-text").textContent = intro;
  document.getElementById("dlg-choices").innerHTML = `<button onclick="answerDialogue()">Compliment (+1 ❤️)</button>`;
  openModal('dialogue-modal');
}

function answerDialogue() {
  if (!activeDlgNpc) return;
  activeDlgNpc.hearts = Math.min(15, activeDlgNpc.hearts + 1);
  showAlert(`💖 Affection increased! Status: ${getRelationshipStatus(activeDlgNpc.hearts)}`, "success");
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
      showAlert(`Need at least 3 ❤️ Hearts to invite ${npc.name}!`, "danger");
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
  npc.hearts = Math.min(15, npc.hearts + 3);
  showAlert(`🎁 Gifted ${item.name} to ${npc.name}! (+3 ❤️)`, "success");
  updateUI();
  openModal('npc-modal');
}

function updateNpcUI() {
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
  const npcContainer = document.getElementById("npc-list-container");
  if (npcContainer) npcContainer.innerHTML = npcHtml;

  let wardrobeHtml = "<strong>🎒 Gacha Wardrobe & Collectibles:</strong><br>";
  if (player.inventory.length === 0) wardrobeHtml += "<small>Empty!</small>";
  else player.inventory.forEach(i => { wardrobeHtml += `- ${i.name} (${i.rarity})<br>`; });
  const wardrobeContainer = document.getElementById("desc-wardrobe");
  if (wardrobeContainer) wardrobeContainer.innerHTML = wardrobeHtml;
}

// --- AUTONOMOUS TOWN NPC MOVEMENT ---
function updateTown() {
  npcs.forEach(n => {
    // If in combat party, they follow player with spacing. Otherwise, they wander around town by themselves!
    if (n.inParty) {
      let partyMembers = npcs.filter(member => member.inParty);
      let idx = partyMembers.indexOf(n);
      let angle = (idx / partyMembers.length) * Math.PI * 2;
      let targetX = player.x + Math.cos(angle) * 45;
      let targetY = player.y + Math.sin(angle) * 45;
      n.x += (targetX - n.x) * 0.1;
      n.y += (targetY - n.y) * 0.1;
    } else {
      n.wanderTimer++;
      if (n.wanderTimer > 120) {
        n.dirX = (Math.random() - 0.5) * 1.5;
        n.dirY = (Math.random() - 0.5) * 1.5;
        n.wanderTimer = 0;
      }
      n.x += n.dirX * 0.5;
      n.y += n.dirY * 0.5;
      n.x = Math.max(30, Math.min(550, n.x));
      n.y = Math.max(50, Math.min(240, n.y));
    }
  });
}

function drawTown() {
  // Draw Town Buildings for Proximity Interaction
  ctx.fillStyle = "#fab387"; ctx.fillRect(30, 40, 110, 80);
  ctx.fillStyle = "#111"; ctx.font="11px sans-serif"; ctx.textAlign="center"; ctx.fillText("🛌 Inn", 85, 85);

  ctx.fillStyle = "#89dceb"; ctx.fillRect(160, 40, 110, 80);
  ctx.fillStyle = "#111"; ctx.fillText("⚔️ Guild", 215, 85);

  ctx.fillStyle = "#f9e2af"; ctx.fillRect(290, 40, 110, 80);
  ctx.fillStyle = "#111"; ctx.fillText("🛒 Shop", 345, 85);

  // Draw NPCs walking around town
  npcs.forEach(n => {
    ctx.fillStyle = n.color;
    ctx.fillRect(n.x, n.y, n.size, n.size);
    ctx.fillStyle = "#ffffff"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`${n.name} (❤️${n.hearts})`, n.x + n.size/2, n.y - 6);
  });

  // Hero
  ctx.fillStyle = "#89b4fa";
  ctx.fillRect(player.x, player.y, player.size, player.size);
}
