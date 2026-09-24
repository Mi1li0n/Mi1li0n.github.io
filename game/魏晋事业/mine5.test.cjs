const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const file = process.env.GAME_HTML || path.join(__dirname, 'mine5.html');
const html = fs.readFileSync(file, 'utf8');
const context = vm.createContext({ console });
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
  new vm.Script(match[1]);
  if (!match[1].includes('canvas=$')) vm.runInContext(match[1], context);
}
const Engine = context.EscapeEngine;
function game(level=0, seed=12345) { const g=new Engine(seed); if(level)g.load(level);g.state.mode='playing';g.state.monsters=[];return g; }
function arena(g){const p=g.state.player;p.x=30;p.y=30;p.facing=[1,0];for(let y=26;y<36;y++)for(let x=26;x<38;x++){Object.assign(g.tile(x,y),{kind:'floor',torch:false,collapseAt:null,gate:null,tidal:false,iceUntil:null});}g.state.visionCache=null;}

test('each chapter has a reachable optional reward with a warning before entry',()=>{
 for(let n=0;n<3;n++){const g=game(n),s=g.state,a=s.sites.find(a=>a.id==='risk-cache');assert.ok(a,'missing optional reward');assert.ok(a.preview&&a.description);const entry=s.adventure.risk.entry;assert.ok(g.reachSet(s.player.x,s.player.y).has(entry.x+','+entry.y));assert.ok(g.reachSet(s.player.x,s.player.y,{dig:true}).has(a.x+','+a.y));assert.equal(s.adventure.risk.due,null);}
});
test('throwing ore consumes one ore and one turn and attracts an unseen enemy',()=>{
 const g=game();arena(g);g.state.player.hands=['pick','ore'];g.state.ore=4;g.state.monsters=[g.createMonster('undead',35,30,0,[1,0])];
 assert.equal(g.act({type:'use',item:'ore'}),true);assert.equal(g.state.ore,3);assert.equal(g.state.turn,1);assert.equal(g.state.monsters[0].state,'investigate');assert.equal(g.state.monsters[0].sound.x,34);
});
test('throwing into an adjacent solid wall does not consume ore or time',()=>{
 const g=game();arena(g);g.state.player.hands=['pick','ore'];g.tile(31,30).kind='hard';const before=g.state.ore;assert.equal(g.act({type:'use',item:'ore'}),false);assert.equal(g.state.turn,0);assert.equal(g.state.ore,before);
});
test('a frost rune freezes a short water crossing and permits actual movement',()=>{
 const g=game();arena(g);g.state.bag.rune=1;g.state.player.hands=['pick','rune'];g.tile(31,30).kind='water';g.tile(32,30).kind='water';
 assert.equal(g.act({type:'use',item:'rune'}),true);assert.equal(g.tile(31,30).kind,'ice');assert.equal(g.state.bag.rune,0);assert.equal(g.act({type:'move',dx:1,dy:0}),true);assert.equal(g.state.player.x,31);
});
test('melting ice never strands its occupant in impassable water',()=>{
 const g=game();arena(g);g.state.player.hands=['pick','rune'];g.state.bag.rune=1;g.tile(31,30).kind='water';g.act({type:'use',item:'rune'});g.act({type:'move',dx:1,dy:0});g.tick(12);assert.equal(g.tile(31,30).kind,'ice');g.act({type:'move',dx:1,dy:0});assert.equal(g.tile(31,30).kind,'water');
});
test('rope permanently secures an ice crossing through later thaw',()=>{
 const g=game();arena(g);g.tile(31,30).kind='water';g.state.bag.rune=1;g.state.player.hands=['rune','rope'];g.act({type:'use',item:'rune'});assert.equal(g.act({type:'use',item:'rope'}),true);g.tick(15);assert.equal(g.tile(31,30).kind,'bridge');
});
test('ruin mechanism opens a shortcut and will not close on any occupant',()=>{
 const g=game(1);const s=g.state,mechanism=s.sites.find(a=>a.id==='stone-switch');assert.ok(mechanism);s.player.x=mechanism.x;s.player.y=mechanism.y;mechanism.discovered=true;
 assert.equal(g.act({type:'choose',kind:'stone-switch'}),true);const gate=s.adventure.gates.find(a=>g.tile(a.x,a.y).kind==='floor');assert.ok(gate);s.companion={x:gate.x,y:gate.y,name:'test',role:1};const turn=s.turn;assert.equal(g.act({type:'choose',kind:'stone-switch'}),false);assert.equal(s.turn,turn);assert.equal(g.tile(gate.x,gate.y).kind,'floor');
});
test('river tide changes on turns and preserves occupied shallows and bridges',()=>{
 const g=game(2),s=g.state;assert.ok(s.adventure.tide.cells.length);const [x,y]=s.adventure.tide.cells[0];s.player.x=x;s.player.y=y;g.tick(8);assert.ok(g.passable(x,y));const last=s.adventure.tide.cells.at(-1);g.tile(...last).kind='bridge';g.tick(18);assert.equal(g.tile(...last).kind,'bridge');
});
test('nearby rescued miner can stabilize the risky branch only once',()=>{
 const g=game(),s=g.state,r=s.adventure?.risk;assert.ok(r);r.due=s.turn+5;s.player.x=r.entry.x;s.player.y=r.entry.y;s.companion={x:s.player.x,y:s.player.y,name:'埃文',role:0};
 assert.equal(g.act({type:'choose',kind:'companion-assist'}),true);assert.ok(r.due>6);assert.equal(s.companion.used,true);assert.equal(g.act({type:'choose',kind:'companion-assist'}),false);
});
test('mason opens sealed stone and ferryman creates a permanent crossing',()=>{
 const mason=game(1),ms=mason.state;const wall=ms.layout.shrineCells[0];assert.ok(wall);ms.player.x=wall[0]-1;ms.player.y=wall[1];mason.tile(ms.player.x,ms.player.y).kind='floor';ms.player.facing=[1,0];ms.companion={...ms.player,name:'朵拉',role:1};assert.equal(mason.act({type:'choose',kind:'companion-assist'}),true);assert.equal(mason.tile(...wall).kind,'floor');
 const boat=game(2);arena(boat);boat.tile(31,30).kind='water';boat.tile(32,30).kind='water';boat.state.companion={x:30,y:30,name:'萨恩',role:2};assert.equal(boat.act({type:'choose',kind:'companion-assist'}),true);assert.equal(boat.tile(32,30).kind,'bridge');
});
test('chapter migration clears transient hazards while retaining rescued allies',()=>{
 const g=game();g.state.companion={x:0,y:0,name:'埃文',role:0,used:false};g.shelterCompanion();g.load(1);assert.ok(g.state.allies.some(a=>a.role===0));assert.equal(g.state.adventure.risk.due,null);assert.equal(g.state.monsters.some(m=>m.type==='undefined'),false);
});

test('risk timer starts only after opening the entrance and warns before expiry',()=>{
 const g=game(),s=g.state,r=s.adventure.risk;g.tick(3);assert.equal(r.due,null);g.tile(r.neck.x,r.neck.y).kind='floor';g.tick();assert.equal(r.due-s.turn,16);g.tick(11);assert.ok(s.logs.some(a=>a.text.includes('只剩5回合')));g.tick(5);assert.equal(r.collapsed,true);assert.equal(s.sites.find(a=>a.id==='risk-cache').equipment.length,0);assert.equal(s.mode,'playing');
});
test('claiming the promised equipment stops risk expiry and retains remaining supplies',()=>{
 const g=game(),s=g.state,r=s.adventure.risk,c=s.sites.find(a=>a.id==='risk-cache');g.tile(r.neck.x,r.neck.y).kind='floor';g.tick();s.player.x=c.x;s.player.y=c.y;c.discovered=true;g.act({type:'interact'});assert.equal(s.lootId,c.id);assert.equal(g.act({type:'loot',item:'equipment:anchor',to:'bag'}),true);g.tick(20);assert.equal(r.secured,true);assert.equal(r.collapsed,false);assert.equal(g.ownsGear('anchor'),true);assert.equal(s.player.gear.anchor,false);assert.ok(c.container.rune>0);
});
test('a frost rune freezes monsters and water with a single charge and action',()=>{
 const g=game();arena(g);g.state.player.hands=['pick','rune'];g.state.bag.rune=1;g.tile(31,30).kind='water';g.state.monsters=[g.createMonster('undead',30,31,0,[0,-1])];assert.equal(g.act({type:'use',item:'rune'}),true);assert.equal(g.tile(31,30).kind,'ice');assert.ok(g.state.monsters[0].freeze>0);assert.equal(g.state.bag.rune,0);assert.equal(g.state.turn,1);
});
test('invalid frost use spends neither charge nor action',()=>{
 const g=game();arena(g);g.state.player.hands=['pick','rune'];g.state.bag.rune=1;assert.equal(g.act({type:'use',item:'rune'}),false);assert.equal(g.state.bag.rune,1);assert.equal(g.state.turn,0);
});
test('stone gates cannot be bypassed with a pick or a bomb',()=>{
 const g=game(1),s=g.state,gate=s.adventure.gates[0];assert.ok(gate);s.player.x=gate.x-1;s.player.y=gate.y;g.tile(s.player.x,s.player.y).kind='floor';const dur=s.player.dur;assert.equal(g.act({type:'move',dx:1,dy:0}),false);assert.equal(s.player.dur,dur);assert.equal(s.turn,0);s.player.gear.anchor=true;g.explode(gate);assert.equal(g.tile(gate.x,gate.y).kind,'hard');
});
test('rising tide does not delete monsters or strand an escort',()=>{
 const g=game(2),s=g.state,[x,y]=s.adventure.tide.cells[0];s.companion={x,y,name:'萨恩',role:2};s.player.x=x;s.player.y=y;g.tick(8);assert.ok(g.passable(s.companion.x,s.companion.y));assert.ok(g.passable(s.player.x,s.player.y));
});
test('stun consumes the attempted support action without using the support',()=>{
 const g=game(),s=g.state,r=s.adventure.risk;r.due=10;s.player.x=r.entry.x;s.player.y=r.entry.y;s.player.stun=1;s.companion={x:s.player.x,y:s.player.y,name:'埃文',role:0};assert.equal(g.act({type:'choose',kind:'companion-assist'}),true);assert.equal(s.player.stun,0);assert.equal(!!s.companion.used,false);assert.equal(r.due,10);
});
test('chapter features never disconnect required routes across 60 seeded maps',()=>{
 for(let seed=1;seed<=20;seed++)for(let n=0;n<3;n++){
  const g=game(n,seed),s=g.state;assert.ok(s.adventure.risk,'missing branch '+seed+'/'+n);if(n===0)assert.ok(s.map.tiles.some(t=>t.blastSeam),'missing blast shortcut '+seed);if(n===1)assert.equal(s.adventure.gates.length,2,'missing gates '+seed);if(n===2)assert.ok(s.adventure.tide?.cells.length,'missing tide '+seed);
  for(let phase=0;phase<2;phase++){
   for(const [i,gate]of s.adventure.gates.entries())g.tile(gate.x,gate.y).kind=i===phase?'floor':'hard';if(s.adventure.tide)for(const cell of s.adventure.tide.cells)g.tile(...cell).kind=phase?'water':'floor';
   const seen=g.reachSet(s.player.x,s.player.y);for(const id of ['home','miner','mechanical','water','workshop','pump','shrine']){const site=s.sites.find(a=>a.id===id);assert.ok(g.standingNear(seen,site),'unreachable '+id+' seed '+seed+' chapter '+n);}
  }
 }
});
test('offhand equipment survives migration while ore remains a consumable',()=>{
 const g=game();g.acquireEquipment('sword');assert.equal(g.act({type:'equip',slot:1,item:'sword'}),true);assert.equal(g.state.player.equipped.off,'sword');assert.equal(g.state.turn,0);g.load(1);assert.equal(g.state.player.equipped.off,'sword');assert.equal(g.act({type:'equip',slot:1,item:'ore'}),false);
});

test('each chapter blocks the near exit until its own challenge is completed',()=>{
 for(let n=0;n<3;n++){const g=game(n),s=g.state;s.local.part=true;for(const id of ['mechanical']){const exit=s.sites.find(a=>a.id===id);exit.discovered=true;s.player.x=exit.x;s.player.y=exit.y;s.routeChoice=id;assert.equal(g.act({type:'choose',kind:'depart'}),false);assert.equal(g.act({type:'choose',kind:'force'}),false);assert.equal(s.level,n);assert.equal(s.turn,0);}}
});

test('priority enemy attacks still resolve before throwing ore and cancel use on death',()=>{
 const g=game();arena(g);const s=g.state;s.player.hands=['pick','ore'];s.player.hp=1;s.player.armor=0;const m=g.createMonster('bat',31,30,0,[-1,0]);s.monsters=[m];g.planMelee(m);const before=s.ore;g.act({type:'use',item:'ore'});assert.equal(s.mode,'dead');assert.equal(s.ore,before);assert.equal(s.turn,1);
});
test('melt waits for the whole occupied ice bridge, then clears it after departure',()=>{
 const g=game();arena(g);const s=g.state;s.bag.rune=1;s.player.hands=['pick','rune'];for(const x of [31,32,33])g.tile(x,30).kind='water';g.act({type:'use',item:'rune'});g.act({type:'move',dx:1,dy:0});g.act({type:'move',dx:1,dy:0});g.tick(10);for(const x of [31,32,33])assert.equal(g.tile(x,30).kind,'ice');g.act({type:'move',dx:1,dy:0});g.act({type:'move',dx:1,dy:0});for(const x of [31,32,33])assert.equal(g.tile(x,30).kind,'water');
});
test('bread is consumed directly from the pack without equipping',()=>{const g=game();g.state.player.hands=['empty','empty'];g.state.player.hp=3;const count=g.amount('bread');assert.equal(g.act({type:'use',item:'bread'}),true);assert.equal(g.amount('bread'),count-1);assert.equal(g.state.player.hp,5);assert.equal(g.state.turn,1);});
test('walking into rock uses the pick automatically',()=>{const g=game();arena(g);g.state.player.hands=['empty','empty'];g.tile(31,30).kind='rock';assert.equal(g.act({type:'move',dx:1,dy:0}),true);assert.equal(g.tile(31,30).kind,'floor');assert.equal(g.state.player.x,31);});
test('only the equipped offhand is active and stored weapons preserve durability',()=>{const g=game();arena(g);g.acquireEquipment('sword');g.state.bag.torch=2;assert.equal(g.hasHand('sword'),false);assert.equal(g.hasHand('torch'),true);g.equipGear('off','sword');assert.equal(g.hasHand('torch'),false);g.state.monsters=[g.createMonster('skeleton',31,30,0)];const dur=g.state.player.dur;g.act({type:'move',dx:1,dy:0});assert.equal(g.state.monsters.length,1);assert.equal(g.state.monsters[0].hp,1);assert.equal(g.state.player.dur,dur);assert.equal(g.state.player.swordDur,44);});

test('target discovery changes neither time, resources nor facing',()=>{const g=game();arena(g);g.state.bag.rune=1;g.tile(31,30).kind='water';const before=JSON.stringify({turn:g.state.turn,bag:g.state.bag,ore:g.state.ore,facing:g.state.player.facing});assert.equal(typeof g.itemTargets,'function');assert.ok(g.itemTargets('rune').some(t=>t.x===31&&t.y===30));assert.equal(JSON.stringify({turn:g.state.turn,bag:g.state.bag,ore:g.state.ore,facing:g.state.player.facing}),before);});
test('an explicit rope target chooses the correct bank without a move or equipment action',()=>{const g=game();arena(g);g.tile(30,29).kind='water';g.tile(31,30).kind='water';g.state.player.facing=[1,0];g.state.player.hands=['empty','empty'];assert.equal(g.act({type:'use',item:'rope',target:{x:30,y:29}}),true);assert.equal(g.tile(30,29).kind,'bridge');assert.equal(g.tile(31,30).kind,'water');assert.equal(g.state.turn,1);});
test('invalid target coordinates consume neither time nor supplies',()=>{const g=game();arena(g);g.state.player.hands=['pick','ore'];const ore=g.state.ore;assert.equal(g.act({type:'use',item:'ore',target:{x:60,y:60}}),false);assert.equal(g.state.ore,ore);assert.equal(g.state.turn,0);});
test('an ore target may be chosen short of maximum range',()=>{const g=game();arena(g);const ore=g.state.ore;assert.equal(g.act({type:'use',item:'ore',target:{x:32,y:30}}),true);assert.equal(g.tile(32,30).items.ore,1);assert.equal(g.state.ore,ore-1);assert.equal(g.state.turn,1);});
test('bomb preview exposes the danger area without deploying a bomb',()=>{const g=game();arena(g);assert.equal(typeof g.itemTargets,'function');const targets=g.itemTargets('bomb');assert.ok(targets.length>1,'throwing permits multiple landing positions');for(const t of targets){const distance=Math.abs(t.x-g.state.player.x)+Math.abs(t.y-g.state.player.y);assert.ok(distance>=1&&distance<=5);assert.equal(t.cells.length,9);assert.ok(t.cells.some(([x,y])=>x===t.x&&y===t.y));}assert.equal(g.amount('bomb'),1);assert.equal(g.state.bombs.length,0);assert.equal(g.state.turn,0);assert.equal(g.act({type:'use',item:'bomb',target:{x:30,y:30}}),false);assert.equal(g.state.turn,0);assert.equal(g.amount('bomb'),1);assert.equal(g.act({type:'use',item:'bomb',target:{x:32,y:30}}),true);assert.equal(g.state.bombs[0].due-g.state.turn,2);});