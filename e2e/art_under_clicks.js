/* Центры зон food, ice, micro не перекрыты на 1280x720 и 1024x600 (этап 12.3(2), 24б). node e2e/art_under_clicks.js out/s5/after.dbg.html */
const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs'); const PW=require('./pw');
(async()=>{const src=fs.readFileSync('out/s5/after.html','utf8');const b=await chromium.launch();
for(const [w,h] of [[1280,720],[1024,600]]){const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();await p.route(/fonts\.googleapis\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:PW.css}));
await p.goto('about:blank');await p.goto(PW.url(path.resolve(process.argv[2]||'out/s5/after.dbg.html'))+'#dev-nopixi-lowfx');await p.waitForSelector('[data-sandbox]',{timeout:60000});await p.waitForTimeout(400);
await p.evaluate(()=>window.__sandbox.start({day:10,profile:'medium'}));await p.waitForSelector('#screen',{state:'hidden',timeout:20000});
await p.evaluate(()=>{const d=__dbg;d.D.nextArr=1e9;d.spawn();d.D.customers.forEach(c=>{c.pat=c.max=1e9});d.G.tutOff=true;});
await p.waitForFunction(()=>__dbg.D.customers[0]&&__dbg.D.customers[0].arrived,null,{timeout:90000});
await p.evaluate(()=>{__dbg.barOpen(__dbg.D.customers[0]);});await p.waitForTimeout(900);await PW.dismissCard(p);
await p.evaluate(()=>{const G=__dbg.G;['case_snacks','microwave','ice','tea','matcha','powders','boba','shaker'].forEach(k=>{G['eq_'+k]=true});__dbg.applyUpgrades();});await p.waitForTimeout(500);
const r=await p.evaluate(()=>['food','ice','micro'].map(z=>{const e=document.querySelector('rect[data-z="'+z+'"]');const q=e.getBoundingClientRect();const x=q.x+q.width/2,y=q.y+q.height/2;const t=document.elementFromPoint(x,y);return z+':'+(t===e?'ok':'BLOCKED '+(t&&(t.id||t.className)));}));
console.log(w,r.join(' '));await ctx.close();}await b.close();})();
