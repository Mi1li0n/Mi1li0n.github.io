// Browser regressions. Set PLAYWRIGHT_MODULE when Playwright is supplied by an external runtime.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
test.before(async()=>{browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});});
test.after(async()=>{await browser?.close();});
async function pageFor(t,options={}){
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce',...options});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 t.after(async()=>{await page.close();assert.deepEqual(errors,[],'browser must not throw');});
 page.setDefaultTimeout(5000);
 // Capture the normal engine instance for deterministic test fixtures; production has no test hook.
 await page.addInitScript(()=>{let Engine;Object.defineProperty(window,'EscapeEngine',{get(){return Engine;},set(E){Engine=new Proxy(E,{construct(T){const g=Reflect.construct(T,[12345]);window.__testGame=g;return g;}});}});});
 await page.goto(pathToFileURL(path.join(__dirname,'mine5.html')).href);
 await page.evaluate(()=>{const g=__testGame;const ids=['kit','bread','bomb','rope','quiet'].map(id=>{let c=g.campaign.stock.find(c=>c.id===id);if(!c){c=g.makeCard(id);g.campaign.stock.push(c);}return c.uid;});g.startExpedition(ids,0,0);g.unpackKit(g.state.expedition.cards.find(c=>c.id==='kit').uid);});await page.keyboard.press('z');await page.evaluate(()=>{const g=__testGame;g.equipGear('head',null);g.setAmount('bread',2);g.state.expedition.cards=g.state.expedition.cards.filter(c=>c.id!=='quiet');});return page;
}
async function arena(page){await page.evaluate(()=>{const g=__testGame,s=g.state;s.mode='playing';s.monsters=[];s.player.x=30;s.player.y=30;g.setAmount('bomb',2);for(let y=25;y<=35;y++)for(let x=25;x<=35;x++)Object.assign(g.tile(x,y),{kind:'floor',gate:null,tidal:false,collapseAt:null,items:{}});s.visionCache=null;});await page.keyboard.press('z');}
for(const viewport of [{width:768,height:1024},{width:1024,height:768},{width:390,height:844},{width:844,height:390}])test('touch controls move the player at '+viewport.width+'x'+viewport.height,async t=>{
 const page=await pageFor(t,{viewport,isMobile:true,hasTouch:true});await arena(page);
 assert.equal(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches),true);
 for(const direction of ['0,-1','-1,0','0,1','1,0'])assert.equal(await page.locator('[data-move="'+direction+'"]').isVisible(),true,'visible '+direction);
 await page.locator('[data-move="1,0"]').tap();
 assert.deepEqual(await page.evaluate(()=>({x:__testGame.state.player.x,y:__testGame.state.player.y,turn:__testGame.state.turn})),{x:31,y:30,turn:1});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
});
test('space activates a focused equipment button without resting at the bed',async t=>{
 const page=await pageFor(t);await page.evaluate(()=>{const s=__testGame.state;s.home={x:0,y:0,rested:false};s.player.hp=2;});
 await page.locator('#equipment-button').focus();await page.keyboard.press('Space');
 assert.deepEqual(await page.evaluate(()=>({turn:__testGame.state.turn,hp:__testGame.state.player.hp,bread:__testGame.amount('bread')})),{turn:0,hp:2,bread:2});
 assert.equal(await page.locator('#dialog').evaluate(e=>e.open),true);assert.equal(await page.locator('#dialog').getAttribute('data-kind'),'equipment');
});
test('space on Cancel cancels bomb aiming instead of throwing it',async t=>{
 const page=await pageFor(t);await arena(page);await page.locator('#bag-button').click();await page.locator('[data-card-select]').filter({hasText:'炸药'}).first().click();await page.locator('[data-card-use]').click();await page.locator('#cancel-aim').focus();await page.keyboard.press('Space');
 assert.deepEqual(await page.evaluate(()=>({turn:__testGame.state.turn,bombs:__testGame.state.bombs.length,stock:__testGame.amount('bomb')})),{turn:0,bombs:0,stock:2});
 assert.equal(await page.locator('#aim-bar').isVisible(),false);
});
test('space on the game canvas still performs the world interaction',async t=>{
 const page=await pageFor(t);await page.evaluate(()=>{const s=__testGame.state;s.home={x:0,y:0,rested:false};s.player.hp=2;});await page.locator('#world').focus();await page.keyboard.press('Space');
 assert.deepEqual(await page.evaluate(()=>({turn:__testGame.state.turn,hp:__testGame.state.player.hp,bread:__testGame.amount('bread')})),{turn:8,hp:6,bread:1});
});
test('a carried-over miner keeps the miner description in the next chapter',async t=>{
 const page=await pageFor(t);await page.evaluate(()=>{const g=__testGame,s=g.state;s.companion={x:s.player.x,y:s.player.y,name:'埃文',role:0,used:false};g.shelterCompanion();g.load(1);});await page.keyboard.press('z');await page.keyboard.press('j');await page.locator('[data-journal-tab="crew"]').click();
 const text=await page.locator('.journal-page').innerText();assert.match(text,/埃文/);assert.match(text,/矿工稳住支架/);assert.doesNotMatch(text,/石匠凿开封岩/);
});
test('crew panel describes all actual roles, including a following companion',async t=>{
 const page=await pageFor(t);await page.evaluate(()=>{const g=__testGame,s=g.state;for(const [level,name]of [[0,'埃文'],[1,'朵拉']]){if(level)g.load(level);s.companion={x:s.player.x,y:s.player.y,name,role:level,used:false};g.shelterCompanion();}g.load(2);s.mode='playing';s.companion={x:s.player.x,y:s.player.y,name:'萨恩',role:2,used:true};});await page.keyboard.press('z');await page.keyboard.press('j');await page.locator('[data-journal-tab="crew"]').click();
 const text=await page.locator('.journal-page').innerText();for(const phrase of ['埃文','朵拉','萨恩','矿工稳住支架','石匠凿开封岩','渡工搭起','本章已援助'])assert.ok(text.includes(phrase),phrase);
});
test('empty crew does not promise an unowned profession',async t=>{
 const page=await pageFor(t);await page.keyboard.press('j');await page.locator('[data-journal-tab="crew"]').click();const text=await page.locator('.journal-page').innerText();assert.doesNotMatch(text,/矿工稳住支架|石匠凿开封岩|渡工搭起/);
});
for(const [seen,total,want]of [[5,10,'50%'],[10,10,'100%'],[0,10,'0%'],[0,0,'0%']])test('ending excludes seen walls from exploration: '+seen+'/'+total,async t=>{
 const page=await pageFor(t);await page.evaluate(({seen,total})=>{const s=__testGame.state;s.map.tiles.forEach((tile,i)=>{tile.kind=i<total?'floor':'wall';tile.seen=i<seen||i>=total;});s.player.hp=0;__testGame.fail('结算回归检查');},{seen,total});await page.keyboard.press('z');
 assert.equal(await page.locator('.end-stats b').last().innerText(),want);
});


test('loot shows named equipment separately from the single quest component',async t=>{const page=await pageFor(t);await page.evaluate(()=>{const g=__testGame,s=g.state,a=s.sites.find(a=>a.id==='workshop');s.mode='playing';s.monsters=[];s.player.x=a.x;s.player.y=a.y;a.searched=true;s.visionCache=null;g.reveal();});await page.locator('#world').focus();await page.keyboard.press('Space');const gear=page.locator('[data-loot="equipment:heavy"]');await gear.waitFor();assert.match(await gear.innerText(),/重型镐/);assert.equal(await page.locator('[data-loot="quest"]').count(),1);await page.locator('[data-loot="quest"]').click();assert.equal(await page.locator('[data-loot="quest"]').count(),0);assert.equal(await gear.isVisible(),true);});
test('workbench repairs an unequipped sword directly',async t=>{const page=await pageFor(t);await page.evaluate(()=>{const g=__testGame,s=g.state;g.acquireEquipment('sword');s.player.swordDur=5;s.player.inventoryGear.sword.dur=5;s.ore=20;s.home={x:2,y:0,rested:false};});await page.locator('#world').focus();await page.keyboard.press('Space');await page.locator('[data-buy="repair:sword"]').click();assert.deepEqual(await page.evaluate(()=>({dur:__testGame.state.player.swordDur,off:__testGame.state.player.equipped.off,turn:__testGame.state.turn})),{dur:25,off:'torch',turn:2});});
test('equipment comparisons use the actual combination without changing game state',async t=>{const page=await pageFor(t);await page.evaluate(()=>{const g=__testGame;g.state.params.vision=0;g.state.params.digNoise=0;g.acquireEquipment('bellows');g.acquireEquipment('lamp');});await page.locator('#equipment-button').click();await page.locator('[data-equipment-slot="body"]').click();const card=page.locator('.gear-option').filter({has:page.locator('[data-wear="bellows"]')});assert.match(await card.innerText(),/护甲 3→2/);assert.match(await card.innerText(),/照明 4→3/);assert.match(await card.innerText(),/普通岩石噪声 6→2/);assert.equal(await page.evaluate(()=>__testGame.state.turn),0);await page.keyboard.press('Escape');await page.evaluate(()=>__testGame.equipGear('off','lamp'));await page.locator('#equipment-button').click();await page.locator('[data-equipment-slot="body"]').click();assert.match(await card.innerText(),/照明 5→5/);assert.equal(await page.evaluate(()=>__testGame.state.player.equipped.body),'clothes');});
