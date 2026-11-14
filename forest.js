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
          activeQuests.forEach(q => { if (q.type === 'gather' && !q.completed) q.progress = Math.min(q.target, q.progress + 1); });
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
      const gained = Math.min(99, (Math.random()*100 < 30 ? 2 : 1));
      if (closest.dropType === "prime") {
        player.primeMeat = Math.min(99, player.primeMeat + gained);
        showAlert(`🏆 Defeated ${closest.name}! Got Prime Meat!`, "success");
      } else {
        player.rawMeat = Math.min(99, player.rawMeat + gained);
        showAlert(`⚔️ Defeated ${closest.name}! Got Meat!`, "success");
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

function updateForest() {
  let partyMembers = npcs.filter(n => n.inParty);
  partyMembers.forEach((n, idx) => {
    let angle = (idx / partyMembers.length) * Math.PI * 2;
    let targetX = player.x + Math.cos(angle) * 45;
    let targetY = player.y + Math.sin(angle) * 45;
    n.x += (targetX - n.x) * 0.1;
    n.y += (targetY - n.y) * 0.1;

    // Autonomous Foraging with Heart-Based Sharing Probability
    wildItems.forEach(item => {
      if (item.active && Math.sqrt(Math.pow((n.x+12)-(item.x+11), 2) + Math.pow((n.y+12)-(item.y+11), 2)) < 35) {
        item.active = false;
        // High hearts = higher chance to give item to player (e.g. hearts * 8% chance, max 90%)
        let giveChance = Math.min(90, n.hearts * 8);
        let sharedWithPlayer = Math.random() * 100 < giveChance;

        if (sharedWithPlayer) {
          player.herbs = Math.min(99, player.herbs + 1);
          showAlert(`🌿 ${n.name} foraged an herb and handed it to you (High Affection)!`, "success");
        } else {
          showAlert(`🌿 ${n.name} foraged an herb and kept it for themselves.`, "info");
        }

        setTimeout(() => { item.active = true; item.x = Math.random() * 450 + 50; item.y = Math.random() * 200 + 40; }, 4000);
      }
    });

    enemies.forEach(e => {
      if (e.alive && Math.sqrt(Math.pow((n.x+12)-(e.x+17), 2) + Math.pow((n.y+12)-(e.y+17), 2)) < 50) {
        e.hp -= 2;
        if (e.hp <= 0) {
          e.alive = false;
          let giveChance = Math.min(90, n.hearts * 8);
          let sharedWithPlayer = Math.random() * 100 < giveChance;
          if (sharedWithPlayer) {
            player.rawMeat++;
            showAlert(`⚔️ ${n.name} defeated ${e.name} and shared the loot with you!`, "success");
          } else {
            showAlert(`⚔️ ${n.name} defeated ${e.name} but kept the drop.`, "info");
          }
        }
      }
    });
  });

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

function drawForest() {
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
