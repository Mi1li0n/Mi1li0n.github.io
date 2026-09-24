const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Million/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const html=process.env.GAME_HTML||process.env.MINE5_HTML||path.join(__dirname,'mine5.html');
for(const width of [1280,390])test('clue archive restores and survives save; wider camera retains click and control geometry at '+width,async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
 const p=await browser.newPage({viewport:{width,height:width<500?844:900},reducedMotion:'reduce'}),errors=[];p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{let E;Object.defineProperty(window,'EscapeEngine',{get(){return E},set(value){E=new Proxy(value,{construct(T,args){const g=Reflect.construct(T,args.length?args:[12345]);window.__testGame=g;return g;}});}});});
 await p.goto(pathToFileURL(html).href);await p.locator('#task-button').click();await p.locator('[data-expedition-start]').click();
 await p.evaluate(()=>{const g=__testGame,s=g.state;s.monsters=[];s.params.hazardStart=999999;g.note('archive-test','旧轨道记号','沿旧轨道回到营地。','home');});
 await p.locator('#journal-button').click();await p.locator('[data-journal-tab="clues"]').click();
 await p.locator('[data-focus="archive-test"]').click();assert.equal(await p.evaluate(()=>__testGame.state.focusPinned),true);
 const before=await p.evaluate(()=>{const s=__testGame.state;return{turn:s.turn,total:s.total,sites:JSON.stringify(s.sites),challenge:JSON.stringify(s.challenge),count:s.notes.length};});
 await p.locator('#journal-button').click();await p.locator('[data-journal-tab="clues"]').click();await p.locator('[data-clue-useless="archive-test"]').click();
 assert.equal(await p.locator('[data-focus="archive-test"]').count(),0);assert.equal(await p.locator('.clue-archive').getAttribute('open'),null);assert.equal(await p.locator('[data-clue-restore="archive-test"]').isVisible(),false);
 assert.deepEqual(await p.evaluate(()=>{const s=__testGame.state;return{turn:s.turn,total:s.total,sites:JSON.stringify(s.sites),challenge:JSON.stringify(s.challenge),count:s.notes.length};}),before);
 assert.equal(await p.evaluate(()=>__testGame.state.focusPinned),false);assert.equal(await p.evaluate(()=>__testGame.state.focus),null);
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mine5-card-expedition-v2')).state.notes.find(n=>n.id==='archive-test').useless),true);
 await p.reload();await p.locator('#journal-button').click();await p.locator('[data-journal-tab="clues"]').click();assert.equal(await p.locator('[data-focus="archive-test"]').count(),0);
 await p.locator('.clue-archive summary').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('[data-clue-restore="archive-test"]').isVisible(),true);
 await p.locator('[data-clue-restore="archive-test"]').click();assert.equal(await p.locator('[data-focus="archive-test"]').count(),1);assert.equal(await p.locator('.clue-archive').count(),0);
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mine5-card-expedition-v2')).state.notes.find(n=>n.id==='archive-test').useless),false);
 await p.locator('[data-clue-useless="chapter-challenge"]').click();assert.equal(await p.evaluate(()=>__testGame.state.challenge.version),2);await p.locator('[data-journal-tab="chapter"]').click();assert(await p.locator('.interaction-state strong').innerText());
 await p.keyboard.press('Escape');
 // Use a clear local arena while retaining the running expedition and its real UI handlers.
 await p.evaluate(()=>{const g=__testGame,s=g.state;s.player.x=30;s.player.y=30;s.player.facing=[1,0];s.monsters=[];s.sites=[];s.visualEvents=[];s.effect=null;s.noises=[];s.bombs=[];s.hazards=[];s.environment={version:1,clouds:[],cleared:[],exposure:0};for(let y=20;y<=40;y++)for(let x=20;x<=40;x++)Object.assign(g.tile(x,y),{kind:'floor',items:{},cards:[],equipment:[],seen:true,collapseAt:null,tidal:false,rail:null,fog:null,fixedLamp:null});s.lightCache=null;s.visionCache=null;});
 await p.locator('#equipment-button').click();await p.keyboard.press('Escape');await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const geometry=await p.locator('#world').evaluate(c=>{const r=c.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,cw:c.width,ch:c.height,tile:r.width/c.width*80};});
 const expected=width<500?38:44,old=width<500?48:56;assert(Math.abs(geometry.tile-expected)<.5,JSON.stringify(geometry));assert(geometry.cw/80>geometry.w/old*1.24);assert(geometry.ch/80>geometry.h/old*1.24);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 for(const selector of ['#journal-button','#task-button','.player-panel','#interact-button']){const loc=p.locator(selector);if(await loc.count()){const b=await loc.boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=844+(width>=500?56:0),selector+JSON.stringify(b));}}
 await p.evaluate(()=>{const g=__testGame;g.state.monsters=[g.createMonster('slime',31,30,991,[1,0])];const at=g.at;g.at=function(x,y){window.__clickedCell={x,y};return at.call(this,x,y);};});
 async function inspectAt(zoom=1){const b=await p.locator('#world').boundingBox();await p.mouse.click(b.x+b.width/2+geometry.tile*zoom,b.y+b.height/2);assert.deepEqual(await p.evaluate(()=>__clickedCell),{x:31,y:30});assert.equal(await p.locator('#dialog').getAttribute('data-kind'),'creature');await p.keyboard.press('Escape');}
 await inspectAt();await p.locator('#world').focus();await p.keyboard.press('z');await inspectAt(.5);await p.keyboard.press('z');await inspectAt();
 await p.evaluate(()=>__testGame.state.monsters=[]);await p.locator('#world').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.evaluate(()=>__testGame.state.player.x),31);await p.evaluate(()=>new Promise(r=>setTimeout(r,240)));if(width<500)await p.locator('[data-move="0,-1"]').click();else await p.keyboard.press('ArrowUp');assert.equal(await p.evaluate(()=>__testGame.state.player.y),29); await p.screenshot({path:path.join(process.env.TEMP,'mine5-journal-camera-'+width+'.png')});assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});


