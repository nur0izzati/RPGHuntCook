/* RPGHuntCook Expansion Pack
 * Adds progression, equipment, skills, cooking buffs, relationships, party commands,
 * world activities, gacha pity, achievements, encyclopedia and backup utilities.
 * All data is local/offline. Designed to extend the original v10 game.
 */
(() => {
  'use strict';
  const KEY = 'RPGHuntCook_Expansion_v1';
  const $ = id => document.getElementById(id);
  const clone = x => JSON.parse(JSON.stringify(x));
  const state = {
    level: 1, exp: 0, expNext: 100, attributePoints: 0,
    weapon: 'Sword', weaponLevel: {}, proficiency: {},
    equipment: { helmet:null, chest:null, gloves:null, boots:null, accessory:null },
    skills: [], passive: [], titles: ['New Adventurer'], title: 'New Adventurer', achievements: [],
    cookingLevel: 1, cookingExp: 0, recipes: ['skewer','steak','salad','feast','soup','dragonSteak'],
    buffs: {}, weather: 'Clear', fish: 0, vegetables: 0, seeds: 3, farm: [],
    furniture: [], houseLevel: 0, pity: 0, pulls: 0, banner: 'Equipment',
    monsterBook: {}, journal: [], partyCommand: 'Follow', paused: false,
    bossKills: 0, rareKills: 0, fishingLevel: 1, fishingExp: 0,
    lastSave: 0, settings: { volume: 0.5, textSpeed: 1, joystick: 1 }
  };
  const weapons = {
    Sword:{type:'Melee',atk:5,crit:5,speed:1,range:78}, Greatsword:{type:'Melee',atk:12,crit:3,speed:.65,range:82},
    'Dual Daggers':{type:'Melee',atk:3,crit:20,speed:1.45,range:60}, Bow:{type:'Ranged',atk:6,crit:12,speed:.9,range:180},
    Staff:{type:'Magic',atk:7,crit:8,speed:.85,range:145}, Spear:{type:'Melee',atk:7,crit:8,speed:1,range:110}, Axe:{type:'Melee',atk:10,crit:7,speed:.75,range:75}
  };
  const rarities = ['Common','Uncommon','Rare','Epic','Legendary','Mythical'];
  const recipes = {
    skewer:{name:'Meat Skewers',needs:{rawMeat:1},buff:{atk:10,duration:1800},xp:10},
    steak:{name:'Herb-Roasted Steak',needs:{rawMeat:1,herbs:1},buff:{atk:15,duration:2400},xp:15},
    salad:{name:'Herbal Salad',needs:{herbs:2,mushrooms:1},buff:{def:10,duration:2400},xp:15},
    feast:{name:'Beast Feast',needs:{primeMeat:1,mushrooms:1},buff:{maxHp:20,duration:3000},xp:25},
    soup:{name:'Forest Soup',needs:{mushrooms:2,herbs:1},buff:{regen:2,duration:3000},xp:20},
    dragonSteak:{name:'Dragon Steak',needs:{dragonMeat:1,herbs:2},buff:{atk:25,duration:3600},xp:50}
  };
  const personalities = {shy:'Shy',cheerful:'Cheerful',tsundere:'Tsundere',serious:'Serious',adventurous:'Adventurous',romantic:'Romantic'};
  const ensure = () => {
    Object.keys(state).forEach(k => { if (state[k] === undefined) state[k] = null; });
    player.level = state.level;
  };
  function notify(msg, kind='success') { if (typeof showAlert==='function') showAlert(msg,kind); else alert(msg); }
  function gainExp(amount, reason='Adventure') {
    state.exp += amount;
    let levels = 0;
    while (state.exp >= state.expNext) {
      state.exp -= state.expNext; state.level++; levels++;
      state.expNext = Math.floor(state.expNext * 1.22 + 25);
      state.attributePoints += 3; player.hp = getMaxHp();
    }
    if (levels) notify(`Level up! You are now Lv.${state.level}. +${levels*3} attribute points!`);
    player.level = state.level; saveExpansion(); renderPanel();
  }
  function allocate(stat) {
    if (!['str','dex','con','int','wis','cha'].includes(stat) || state.attributePoints<1) return notify('No attribute points available.','danger');
    player[stat] = (player[stat]||10)+1; state.attributePoints--;
    if(stat==='con') player.hp=getMaxHp(); notify(`${stat.toUpperCase()} increased!`); renderPanel(); updateUI();
  }
  function addAchievement(id, label, reward=50) {
    if(state.achievements.includes(id)) return;
    state.achievements.push(id); player.gold += reward; state.journal.unshift(`Achievement: ${label}`); notify(`Achievement unlocked: ${label} (+${reward} gold)`);
  }
  function getWeapon(){ return weapons[state.weapon] || weapons.Sword; }
  function equipWeapon(name) {
    if(!weapons[name]) return;
    const owns = state.weapon===name || player.inventory.some(i=>i.name===name || i.name.includes(name));
    if(!owns && name!=='Sword') return notify(`Find or craft a ${name} first.`,'danger');
    state.weapon=name; notify(`${name} equipped.`); renderPanel();
  }
  function rewardDrop(enemy) {
    const roll=Math.random();
    const rarity=roll<.45?'Common':roll<.7?'Uncommon':roll<.86?'Rare':roll<.95?'Epic':roll<.99?'Legendary':'Mythical';
    const slot=['helmet','chest','gloves','boots','accessory'][Math.floor(Math.random()*5)];
    const item={name:`${rarity} ${slot}`,rarity,slot,bonus:Math.ceil(rarities.indexOf(rarity)*2+2)};
    player.inventory.push(item); return item;
  }
  function equipArmor(index) {
    const item=player.inventory[index]; if(!item || !item.slot) return;
    state.equipment[item.slot]=item; player.inventory.splice(index,1); notify(`${item.name} equipped.`); renderPanel();
  }
  function learnSkill(name) {
    const skills={PowerStrike:{cost:1,desc:'+25% weapon damage'},QuickStep:{cost:1,desc:'+10% dodge'},BattleFocus:{cost:2,desc:'+10% critical chance'},FieldMedic:{cost:2,desc:'Heal 15% max HP after victory'},ElementalBurst:{cost:3,desc:'Magic damage bonus'}};
    const s=skills[name]; if(!s||state.skills.includes(name)||state.attributePoints<s.cost) return notify('Not enough points or already learned.','danger');
    state.attributePoints-=s.cost;state.skills.push(name);notify(`${name} learned!`);renderPanel();
  }
  function getGearBonus(){return Object.values(state.equipment).filter(Boolean).reduce((a,x)=>a+(x.bonus||0),0);}
  function cookPlus(type) {
    const r=recipes[type]; if(!r) return;
    for(const [k,v] of Object.entries(r.needs)) if((player[k]||0)<v) return notify(`Need ${v} ${k}.`,'danger');
    Object.entries(r.needs).forEach(([k,v])=>player[k]-=v);
    const perfect=Math.random()<Math.min(.75,.15+state.cookingLevel*.035);
    const quality=perfect?'Perfect':Math.random()<.55?'Good':'Normal';
    const foodKey=type==='skewer'?'skewers':type==='steak'?'steaks':type==='salad'?'salads':type==='feast'?'feasts':type==='soup'?'soups':'dragonSteaks';
    player[foodKey]=(player[foodKey]||0)+(perfect?2:1);
    state.buffs=r.buff; state.cookingExp+=r.xp*(perfect?2:1);
    while(state.cookingExp>=state.cookingLevel*50){state.cookingExp-=state.cookingLevel*50;state.cookingLevel++;}
    notify(`${quality} ${r.name} cooked! Temporary buff activated.`);gainExp(5,'Cooking');updateUI();renderPanel();
  }
  function giveFavoriteMeal(npcId) {
    const npc=npcs.find(n=>n.id===npcId); if(!npc) return;
    const meal=npc.id===1?'steaks':npc.id===2?'salads':'feasts';
    if((player[meal]||0)<1) return notify(`They would love ${meal}, but you don't have any.`,'danger');
    player[meal]--; npc.hearts=Math.min(15,(npc.hearts||0)+3); state.journal.unshift(`Shared a favorite meal with ${npc.name}`);notify(`${npc.name} loved the meal! +3 hearts.`);updateUI();
  }
  function relationshipEvent(npcId, kind) {
    const npc=npcs.find(n=>n.id===npcId);if(!npc)return;
    if(kind==='date'&&player.gold<30)return notify('A date costs 30 gold.','danger');
    if(kind==='date')player.gold-=30;
    if(kind==='birthday'||kind==='date'||kind==='quest')npc.hearts=Math.min(15,(npc.hearts||0)+(kind==='quest'?4:2));
    state.journal.unshift(`${kind[0].toUpperCase()+kind.slice(1)} with ${npc.name} — Day ${dayCount}`);
    notify(`${kind} completed with ${npc.name}!`);renderPanel();updateUI();
  }
  function partyCommand(command) { state.partyCommand=command; notify(`Party command: ${command}`); }
  function gachaPull(count=1) {
    const cost=50*count;if(player.gold<cost)return notify(`Need ${cost} gold.`,'danger');player.gold-=cost;
    let results=[];
    for(let i=0;i<count;i++){
      state.pulls++;state.pity++;
      let rarity=state.pity>=50?'Epic':Math.random()<.55?'Common':Math.random()<.75?'Uncommon':Math.random()<.9?'Rare':Math.random()<.97?'Epic':'Legendary';
      if(rarity==='Epic'||rarity==='Legendary')state.pity=0;
      const reward=state.banner==='Equipment'?{name:`${rarity} ${['Sword','Bow','Staff','Greatsword'][Math.floor(Math.random()*4)]}`,rarity}:state.banner==='Gift'?{name:`${rarity} Gift Box`,rarity}:state.banner==='Material'?{name:`${rarity} Material Cache`,rarity}: {name:`${rarity} Companion Token`,rarity};
      player.inventory.push(reward);results.push(reward.name);
    }
    $('rpg-gacha-result').textContent=results.join(' • ');notify(`${count} pull${count>1?'s':''} complete.`);updateUI();renderPanel();
  }
  function fish() { if(currentMap!=='town')return notify('Fishing is available at the town dock.','danger'); if(Math.random()<.18){player.inventory.push({name:'Moonfin',rarity:'Rare'});state.fishingExp+=20;notify('Rare Moonfin caught!');}else{player.fish=(player.fish||0)+1;state.fishingExp+=10;notify('Caught a fish!');} if(state.fishingExp>=state.fishingLevel*60){state.fishingExp=0;state.fishingLevel++;notify('Fishing proficiency increased!');}gainExp(5,'Fishing');renderPanel();}
  function plant() { if(state.seeds<1)return notify('No seeds. Buy seeds from the market.','danger');state.seeds--;state.farm.push({planted:dayCount,ready:dayCount+2});notify('Seeds planted. Harvest after two days.');renderPanel();}
  function harvest() {const ready=state.farm.filter(f=>f.ready<=dayCount).length;if(!ready)return notify('Nothing is ready to harvest.','danger');state.farm=state.farm.filter(f=>f.ready>dayCount);player.herbs+=ready;player.vegetables+=ready;notify(`Harvested ${ready} crops.`);gainExp(ready*8,'Farming');renderPanel();updateUI();}
  function houseUpgrade(){if(player.gold<250)return notify('House upgrade costs 250 gold.','danger');player.gold-=250;state.houseLevel++;state.furniture.push('Cozy furniture');notify('Your home has been upgraded!');renderPanel();}
  function setTitle(t){if(!state.titles.includes(t))return;state.title=t;notify(`Title equipped: ${t}`);renderPanel();}
  function journalEntry(s){state.journal.unshift(s);state.journal=state.journal.slice(0,100);}
  function saveExpansion(){try{state.lastSave=Date.now();localStorage.setItem(KEY,JSON.stringify(state));}catch(e){console.warn('Save failed',e);}}
  function loadExpansion(){try{const raw=localStorage.getItem(KEY);if(raw)Object.assign(state,JSON.parse(raw));}catch(e){console.warn('Expansion save invalid',e);}}
  function exportSave(){const data={base:localStorage.getItem('RPGHuntCook_Save_v10'),expansion:JSON.stringify(state)};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='RPGHuntCook-save-backup.json';a.click();URL.revokeObjectURL(a.href);}
  function importSave(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=()=>{const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(d.base)localStorage.setItem('RPGHuntCook_Save_v10',d.base);if(d.expansion){Object.assign(state,JSON.parse(d.expansion));saveExpansion();}location.reload();}catch(e){notify('Invalid save backup.','danger');}};r.readAsText(f);};input.click();}
  function renderPanel(){
    const el=$('rpg-expansion-content');if(!el)return;
    const statNames=['str','dex','con','int','wis','cha'];
    const attr=statNames.map(s=>`<button onclick="RPGX.allocate('${s}')">${s.toUpperCase()} +1</button>`).join(' ');
    const weapon=Object.keys(weapons).map(w=>`<button onclick="RPGX.equipWeapon('${w}')" ${state.weapon===w?'disabled':''}>${w} (${weapons[w].atk} ATK)</button>`).join(' ');
    const skills=['PowerStrike','QuickStep','BattleFocus','FieldMedic','ElementalBurst'].map(s=>`<button onclick="RPGX.learnSkill('${s}')">${s}</button>`).join(' ');
    const recipe=Object.entries(recipes).map(([k,r])=>`<div class="rpgx-row"><span>${r.name}<small> (${Object.entries(r.needs).map(([a,b])=>`${b} ${a}`).join(', ')})</small></span><button onclick="RPGX.cook('${k}')">Cook</button></div>`).join('');
    const npc=npcs.map(n=>`<div class="rpgx-row"><span>${n.name} — ❤️${n.hearts||0}/15</span><span><button onclick="RPGX.relation(${n.id},'date')">Date</button><button onclick="RPGX.meal(${n.id})">Favorite meal</button><button onclick="RPGX.relation(${n.id},'quest')">Personal quest</button></span></div>`).join('');
    const inv=player.inventory.map((it,i)=>`<div class="rpgx-row"><span>${it.name} (${it.rarity||'Common'})</span>${it.slot?`<button onclick="RPGX.equipArmor(${i})">Equip</button>`:''}</div>`).join('')||'<small>Inventory is empty.</small>';
    const achievements=['FirstBlood','CookNovice','SocialButterfly','Fisher','Explorer'];
    el.innerHTML=`<div class="rpgx-grid">
      <section><h4>⭐ Character progression</h4><b>Lv.${state.level}</b> · ${state.exp}/${state.expNext} EXP · ${state.attributePoints} points<div class="rpgx-bar"><i style="width:${Math.min(100,state.exp/state.expNext*100)}%"></i></div><p>Title: ${state.title}</p>${attr}<p>Gear bonus: +${getGearBonus()} · Skills: ${state.skills.join(', ')||'None'}</p>${skills}</section>
      <section><h4>⚔️ Weapons & equipment</h4><p>Equipped: <b>${state.weapon}</b> · ATK ${getWeapon().atk} · Crit ${getWeapon().crit}% · Range ${getWeapon().range}</p>${weapon}<p>Armor: ${Object.entries(state.equipment).map(([k,v])=>`${k}: ${v?v.name:'Empty'}`).join(' · ')}</p>${inv}</section>
      <section><h4>🍳 Cooking mastery</h4><p>Cooking Lv.${state.cookingLevel} · ${state.cookingExp} EXP · Buff: ${Object.keys(state.buffs).join(', ')||'None'}</p>${recipe}</section>
      <section><h4>💗 Relationships & journal</h4>${npc}<details><summary>Relationship journal (${state.journal.length})</summary>${state.journal.slice(0,30).map(x=>`<p>${x}</p>`).join('')}</details></section>
      <section><h4>🤝 Party tactics</h4><p>Party members: ${npcs.filter(n=>n.inParty).length}/4 · Command: ${state.partyCommand}</p>${['Follow','Attack','Defend','Heal','Retreat'].map(c=>`<button onclick="RPGX.command('${c}')">${c}</button>`).join(' ')}</section>
      <section><h4>🌦️ World activities</h4><p>Weather: ${state.weather} · Fish: ${player.fish||0} · Fishing Lv.${state.fishingLevel} · Seeds: ${state.seeds} · Crops growing: ${state.farm.length}</p><button onclick="RPGX.fish()">🎣 Fish</button><button onclick="RPGX.plant()">🌱 Plant</button><button onclick="RPGX.harvest()">🌾 Harvest</button><button onclick="RPGX.house()">🏡 Upgrade house (250g)</button><button onclick="RPGX.buySeeds()">Buy seeds (15g)</button></section>
      <section><h4>🎁 Gacha & collection</h4><p>Banner: ${state.banner} · Pity: ${state.pity}/50 · Pulls: ${state.pulls}</p>${['Equipment','Companion','Gift','Material'].map(b=>`<button onclick="RPGX.banner('${b}')">${b}</button>`).join(' ')}<button onclick="RPGX.pull(1)">Single (50g)</button><button onclick="RPGX.pull(10)">10-pull (500g)</button></section>
      <section><h4>🏆 Achievements & bestiary</h4><p>Unlocked: ${state.achievements.length} · Monsters recorded: ${Object.keys(state.monsterBook).length}</p><button onclick="RPGX.achievement('FirstBlood','First Blood')">First Blood</button><button onclick="RPGX.achievement('CookNovice','Apprentice Chef')">Apprentice Chef</button><button onclick="RPGX.achievement('Explorer','Explorer')">Explorer</button><details><summary>Monster encyclopedia</summary>${Object.entries(state.monsterBook).map(([n,c])=>`<p>${n}: ${c} encounters</p>`).join('')||'No monsters recorded yet.'}</details></section>
      <section><h4>💾 Save & settings</h4><button onclick="saveGame()">Save now</button><button onclick="RPGX.exportSave()">Export backup</button><button onclick="RPGX.importSave()">Import backup</button><button onclick="RPGX.pause()">${state.paused?'Resume':'Pause'} game</button><p><small>Offline local save · Autosaves every 30 seconds</small></p></section>
    </div>`;
  }
  function addUI(){
    const host=$('action-panel');if(!host||$('rpg-expansion-open'))return;
    const b=document.createElement('button');b.id='rpg-expansion-open';b.textContent='🌟 RPG Systems';b.onclick=()=>{$('rpg-expansion-modal').style.display='flex';renderPanel();};host.appendChild(b);
    const modal=document.createElement('div');modal.id='rpg-expansion-modal';modal.className='modal';modal.innerHTML=`<div class="modal-content rpgx-modal"><h3>🌟 RPGHuntCook — Adventure Journal</h3><div id="rpg-expansion-content"></div><button class="close-btn" onclick="document.getElementById('rpg-expansion-modal').style.display='none'">Close</button></div>`;document.body.appendChild(modal);
    const style=document.createElement('style');style.textContent=`#rpg-expansion-open{background:#cba6f7;color:#111} .rpgx-modal{width:min(900px,96vw);max-height:88vh;overflow:auto}.rpgx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}.rpgx-grid section{background:#181825;border:1px solid #45475a;border-radius:8px;padding:10px;color:#cdd6f4;font-size:12px}.rpgx-grid h4{color:#f9e2af;margin:0 0 8px}.rpgx-grid button{margin:3px;padding:6px 8px;font-size:11px}.rpgx-row{display:flex;justify-content:space-between;align-items:center;gap:5px;border-bottom:1px solid #45475a;padding:5px 0}.rpgx-row small{color:#a6adc8}.rpgx-bar{height:7px;background:#45475a;border-radius:5px;overflow:hidden}.rpgx-bar i{display:block;height:100%;background:#a6e3a1}.rpgx-grid details{margin-top:8px}`;document.head.appendChild(style);
  }
  // Extend existing combat, cooking, time and save behavior without removing original systems.
  const oldAttack=window.triggerAttack;
  window.triggerAttack=function(){const before=enemies.filter(e=>e.alive).length;oldAttack();const after=enemies.filter(e=>e.alive).length;state.weaponLevel[state.weapon]=(state.weaponLevel[state.weapon]||0)+1;state.proficiency[state.weapon]=(state.proficiency[state.weapon]||0)+1;if(after<before){gainExp(35,'Hunting');const dead=enemies.find(e=>!e.alive);if(dead){addAchievement('FirstBlood','First Blood',40);state.monsterBook[dead.name]=(state.monsterBook[dead.name]||0)+1;if(dead.name.toLowerCase().includes('orc')){state.bossKills++;addAchievement('BossSlayer','Boss Slayer',150);}if(dead.name.toLowerCase().includes('rare'))state.rareKills++;const drop=rewardDrop(dead);journalEntry(`Defeated ${dead.name}; found ${drop.name}`);}}renderPanel();};
  const oldCook=window.cookRecipe;
  window.cookRecipe=function(type){oldCook(type);gainExp(5,'Cooking');};
  const oldAdvance=window.advanceTime;
  window.advanceTime=function(){oldAdvance();state.weather=['Clear','Rain','Cloudy','Storm'][Math.floor(Math.random()*4)];if(timeOfDay==='Night'&&Math.random()<.25&&currentMap==='hunt'){enemies.push({name:'Rare Moonstalker',color:'#cba6f7',x:440,y:100,size:38,hp:90,maxHp:90,atk:24,dropType:'prime',alive:true,state:'patrol',windupTimer:0,maxWindup:30});notify('A rare Moonstalker appeared in the night!','danger');}saveExpansion();};
  const oldSave=window.saveGame;
  window.saveGame=function(){oldSave();saveExpansion();};
  const oldReset=window.resetGame;
  window.resetGame=function(){oldReset();Object.assign(state,clone({level:1,exp:0,expNext:100,attributePoints:0,weapon:'Sword',weaponLevel:{},proficiency:{},equipment:{helmet:null,chest:null,gloves:null,boots:null,accessory:null},skills:[],passive:[],titles:['New Adventurer'],title:'New Adventurer',achievements:[],cookingLevel:1,cookingExp:0,recipes:['skewer','steak','salad','feast','soup','dragonSteak'],buffs:{},weather:'Clear',fish:0,vegetables:0,seeds:3,farm:[],furniture:[],houseLevel:0,pity:0,pulls:0,banner:'Equipment',monsterBook:{},journal:[],partyCommand:'Follow',paused:false,bossKills:0,rareKills:0,fishingLevel:1,fishingExp:0,lastSave:0,settings:{volume:.5,textSpeed:1,joystick:1}}));saveExpansion();};
  // Add lightweight companion tactics to the original follower AI.
  const oldForestUpdate=window.updateForest;
  let companionTick=0;
  window.updateForest=function(){oldForestUpdate();if(currentMap!=='hunt')return;const mates=npcs.filter(n=>n.inParty);if(!mates.length)return;companionTick++;if(state.partyCommand==='Heal'&&companionTick%90===0&&player.hp<getMaxHp()){player.hp=Math.min(getMaxHp(),player.hp+Math.max(5,mates.length*4));notify('Your companions healed you.');updateUI();}if(state.partyCommand==='Attack'&&companionTick%35===0){const target=enemies.find(e=>e.alive);if(target){const damage=mates.length*3;target.hp-=damage;notify(`Your party dealt ${damage} damage!`);if(target.hp<=0){target.alive=false;player.rawMeat=(player.rawMeat||0)+1;gainExp(20,'Companion combat');}}}};
  const oldDodge=window.getDodgeChance;
  window.getDodgeChance=function(){return Math.min(85,oldDodge()+(state.partyCommand==='Defend'?15:0));};
  // Use weapon values in the existing damage calculation.
  const oldDamage=window.getAttackDmg;
  window.getAttackDmg=function(){let base=oldDamage()+getWeapon().atk+getGearBonus();if(state.skills.includes('PowerStrike'))base*=1.25;if(state.buffs.atk)base*=1+state.buffs.atk/100;return Math.floor(base);};
  window.RPGX={allocate,equipWeapon,equipArmor,learnSkill,cook:cookPlus,meal:giveFavoriteMeal,relation:relationshipEvent,command:partyCommand,pull:gachaPull,banner:b=>{state.banner=b;renderPanel();},fish,plant,harvest,house:houseUpgrade,buySeeds:()=>{if(player.gold>=15){player.gold-=15;state.seeds++;renderPanel();}else notify('Need 15 gold.','danger');},achievement:addAchievement,exportSave,importSave,pause:()=>{state.paused=!state.paused;notify(state.paused?'Game paused.':'Game resumed.');},render:renderPanel};
  // Party limit and character progression initialization.
  const oldToggle=window.toggleParty;
  window.toggleParty=function(id){const npc=npcs.find(n=>n.id===id);if(npc&&!npc.inParty&&npcs.filter(n=>n.inParty).length>=4)return notify('Your active party is full (4/4).','danger');oldToggle(id);};
  loadExpansion();ensure();
  // Add basic monster drops and food inventory fields compatibly.
  ['dragonMeat','soups','dragonSteaks','fish','vegetables'].forEach(k=>{if(player[k]===undefined)player[k]=0;});
  addUI();renderPanel();
  setInterval(()=>{if(!state.paused){saveExpansion();try{localStorage.setItem('RPGHuntCook_Save_v10',JSON.stringify({player,npcs,dayCount,timeOfDay,activeQuests}));}catch(e){}}},30000);
  // Wrap update so pause freezes movement, enemy AI and game timers.
  const originalUpdate=window.update;
  window.update=function(){if(state.paused)return;originalUpdate();};
  // Initial autosave after browser storage has loaded.
  saveExpansion();
})();
