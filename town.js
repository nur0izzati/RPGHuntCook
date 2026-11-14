let npcs = [
  { id: 1, name: "Chef Remy", x: 80, y: 100, size: 28, color: "#89dceb", trait: "Aggressive Cook", personality: "Passionate & strict about culinary art.", hearts: 0, inParty: false, talkedToday: false, schedule: { Morning: "Kitchen", Afternoon: "Town Square", Evening: "Inn", Night: "Home" } },
  { id: 2, name: "Aria the Ranger", x: 450, y: 100, size: 28, color: "#a6e3a1", trait: "Forager", personality: "Brave hunter who loves wild forest ingredients.", hearts: 0, inParty: false, talkedToday: false, schedule: { Morning: "Guild", Afternoon: "Town Square", Evening: "Shop", Night: "Home" } },
  { id: 3, name: "Merchant Leon", x: 270, y: 200, size: 28, color: "#f9e2af", trait: "Scavenger", personality: "Cunny trader looking for rare monster parts.", hearts: 0, inParty: false, talkedToday: false, schedule: { Morning: "Shop", Afternoon: "Guild", Evening: "Inn", Night: "Home" } }
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
  if (player.gold < cost) { showAlert(`Inn costs ${cost} Gold!`, "danger"); return; }
  player.gold -= cost; player.hp = getMaxHp(); advanceTime();
  showCenterPopup("🛌 Slept at Inn", `Paid ${cost} Gold. Fully restored HP!`);
  updateUI();
}

function restAtCamp() {
  advanceTime();
  showCenterPopup("⛺ Rested at Camp", `Free camp rest. Time advanced to ${timeOfDay}.`);
  updateUI();
}

function openDialogue(npcId) {
  const npc = npcs.find(n => n.id === npcId);
  if (!npc) return;
  activeDlgNpc = npc;
  document.getElementById("dlg-npc-name").textContent = `Chatting with ${npc.name} (${getRelationshipStatus(npc.hearts)})`;
  document.getElementById("dlg-text").textContent = `"${npc.personality}"`;
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
  if (npc.inParty) { npc.inParty = false; showAlert(`${npc.name} left party.`, "info"); }
  else {
    if (npc.hearts < 3) { showAlert(`Need 3 ❤️ Hearts!`, "danger"); return; }
    npc.inParty = true; showAlert(`🤝 ${npc.name} joined party!`, "success");
  }
  updateUI(); openModal('npc-modal');
}

function updateTown() {
  // Non-overlapping party formation spacing around player
  let partyMembers = npcs.filter(n => n.inParty);
  partyMembers.forEach((n, idx) => {
    let angle = (idx / partyMembers.length) * Math.PI * 2;
    let targetX = player.x + Math.cos(angle) * 45;
    let targetY = player.y + Math.sin(angle) * 45;
    n.x += (targetX - n.x) * 0.1;
    n.y += (targetY - n.y) * 0.1;
  });
}

function updateNpcUI() {
  let npcHtml = "";
  npcs.forEach(n => {
    npcHtml += `
      <div class="shop-item" style="flex-direction:column; align-items:flex-start;">
        <div><strong>${n.name}</strong> (${getRelationshipStatus(n.hearts)} - ❤️ ${n.hearts}/15)</div>
        <div style="display:flex; gap:4px; margin-top:5px;">
          <button onclick="openDialogue(${n.id})">Chat</button>
          <button onclick="toggleParty(${n.id})" style="background:${n.inParty ? '#eba0ac' : '#a6e3a1'};">${n.inParty ? 'Dismiss' : 'Invite'}</button>
        </div>
      </div>
    `;
  });
  document.getElementById("npc-list-container").innerHTML = npcHtml;
}

function drawTown() {
  ctx.fillStyle = "#fab387"; ctx.fillRect(30, 40, 110, 80); ctx.fillStyle = "#111"; ctx.fillText("🛌 Inn", 85, 85);
  ctx.fillStyle = "#89dceb"; ctx.fillRect(160, 40, 110, 80); ctx.fillStyle = "#111"; ctx.fillText("⚔️ Guild", 215, 85);
  ctx.fillStyle = "#f9e2af"; ctx.fillRect(290, 40, 110, 80); ctx.fillStyle = "#111"; ctx.fillText("🛒 Shop", 345, 85);

  npcs.forEach(n => {
    ctx.fillStyle = n.color; ctx.fillRect(n.x, n.y, n.size, n.size);
    ctx.fillStyle = "#fff"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`${n.name} (❤️${n.hearts})`, n.x + n.size/2, n.y - 6);
  });

  ctx.fillStyle = "#89b4fa"; ctx.fillRect(player.x, player.y, player.size, player.size);
}
