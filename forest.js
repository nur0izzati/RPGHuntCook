let enemies = [
  { name: "Easy Slime", color: "#a6e3a1", x: 420, y: 120, size: 28, hp: 15, maxHp: 15, atk: 5, dropType: "meat", alive: true, state: "patrol", windupTimer: 0, maxWindup: 70 }
];
let wildItems = [];

function spawnWildItems() {
  wildItems = [
    { type: "herb", icon: "🌿", color: "#a6e3a1", x: 120, y: 90, size: 22, active: true },
    { type: "mushroom", icon: "🍄", color: "#fab387", x: 420, y: 210, size: 22, active: true }
  ];
}

function collectWildItems() {
  wildItems.forEach(item => {
    if (item.active) {
      const dx = (player.x + 14) - (item.x + 11);
      const dy = (player.y + 14) - (item.y + 11);
      if (Math.sqrt(dx*dx + dy*dy) < 45) {
        item.active = false;
        if (item.type === "herb") {
          player.herbs = Math.min(99, player.herbs + 1);
          showAlert("🌿 Grabbed Wild Herb!", "success");
        } else {
          player.mushrooms = Math.min(99, player.mushrooms + 1);
          showAlert("🍄 Grabbed Mushroom!", "success");
        }
        setTimeout(() => { item.active = true; item.x = Math.random() * 450 + 50; item.y = Math.random() * 200 + 40; }, 4000);
      }
    }
  });
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
      player.rawMeat = Math.min(99, player.rawMeat + 1);
      showAlert(`⚔️ Defeated ${closest.name}! Got Meat!`, "success");
      updateUI();
      setTimeout(() => { closest.hp = closest.maxHp; closest.alive = true; closest.x = Math.random()*400+50; closest.y = Math.random()*200+40; }, 4000);
    } else {
      showAlert(`Hit ${closest.name} for ${dmg} DMG!`, "info");
    }
    updateUI();
  }
}

function updateForest() {
  // Non-overlapping party formation spacing
  let partyMembers = npcs.filter(n => n.inParty);
  partyMembers.forEach((n, idx) => {
    let angle = (idx / partyMembers.length) * Math.PI * 2;
    let targetX = player.x + Math.cos(angle) * 45;
    let targetY = player.y + Math.sin(angle) * 45;
    n.x += (targetX - n.x) * 0.1;
    n.y += (targetY - n.y) * 0.1;

    // AUTONOMOUS PARTY AI: Forage herbs or attack monsters automatically!
    wildItems.forEach(item => {
      if (item.active && Math.sqrt(Math.pow((n.x+12)-(item.x+11), 2) + Math.pow((n.y+12)-(item.y+11), 2)) < 35) {
        item.active = false;
        player.herbs = Math.min(99, player.herbs + 1);
        showAlert(`🌿 ${n.name} autonomously foraged an herb for you!`, "success");
        setTimeout(() => { item.active = true; item.x = Math.random() * 450 + 50; item.y = Math.random() * 200 + 40; }, 4000);
      }
    });

    enemies.forEach(e => {
      if (e.alive && Math.sqrt(Math.pow((n.x+12)-(e.x+17), 2) + Math.pow((n.y+12)-(e.y+17), 2)) < 50) {
        e.hp -= 2; // Companion autonomous attack
        if (e.hp <= 0) { e.alive = false; player.rawMeat++; showAlert(`⚔️ ${n.name} defeated ${e.name}!`, "success"); }
      }
    });
  });

  enemies.forEach(e => {
    if (e.alive) {
      const dist = Math.sqrt(Math.pow((player.x+14)-(e.x+17), 2) + Math.pow((player.y+14)-(e.y+17), 2));
      if (dist < 130) {
        if (e.x < player.x) e.x += 0.8; else e.x -= 0.8;
        if (e.y < player.y) e.y += 0.8; else e.y -= 0.8;
      }
    }
  });
}

function drawForest() {
  wildItems.forEach(i => {
    if (i.active) {
      ctx.fillStyle = i.color; ctx.beginPath(); ctx.arc(i.x+11, i.y+11, 11, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font="10px sans-serif"; ctx.textAlign="center"; ctx.fillText(i.icon, i.x+11, i.y+4);
    }
  });

  enemies.forEach(e => {
    if (e.alive) {
      ctx.fillStyle = e.color; ctx.fillRect(e.x, e.y, e.size, e.size);
      ctx.fillStyle = "#45475a"; ctx.fillRect(e.x, e.y-8, e.size, 5);
      ctx.fillStyle = "#fab387"; ctx.fillRect(e.x, e.y-8, e.size*(e.hp/e.maxHp), 5);
    }
  });

  npcs.forEach(n => {
    if (n.inParty) { ctx.fillStyle = n.color; ctx.fillRect(n.x, n.y, 24, 24); }
  });

  ctx.fillStyle = "#89b4fa"; ctx.fillRect(player.x, player.y, player.size, player.size);
}
