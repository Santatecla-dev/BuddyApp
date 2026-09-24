const {spawn} = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '../.expo/achievements-fixed-dist');
const artifacts = path.resolve(__dirname, '../.expo/achievements-check');
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req,res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url));
  if (!file.startsWith(root) || !fs.existsSync(file)) {res.writeHead(404); return res.end();}
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const browser = spawn(process.env.UI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9367',`--user-data-dir=${path.join(artifacts,'browser')}`,'about:blank'], {windowsHide:true,stdio:'ignore'});
let ws;
(async () => {
  await new Promise(r => server.listen(8107,'127.0.0.1',r));
  let tabs;
  for(let n=0;n<40;n++){try{tabs=await (await fetch('http://127.0.0.1:9367/json')).json();break;}catch{await sleep(250);}}
  assert(tabs,'Browser did not start');
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map();
  const call=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
  const dives=[{id:1,country:'España',location:'Cala Caló',date:'2024-08-30T10:00:00Z',maxDepth:15,duration:50},{id:2,country:'Andorra',location:'Un punto de buceo con un nombre muy largo para comprobar el ajuste de texto',date:'2024-08-31T10:00:00Z',maxDepth:30,duration:45}];
  let posts=[], failPins=false;
  const fixtures=Array.from({length:15},(_,i)=>({
    id:'achievement-'+i,title:['First splash','Getting serious','Century diver','Deep routine','Ocean legend','Species spotter'][i] || 'Achievement '+i,
    description:'A detailed description of this diving milestone and the evidence needed to unlock it.',
    icon:'🐠',category:i<5?'dives':i<14?'wildlife':'exploration',tier:'bronze',
    target: i<2?1:10,progress:i<2?1:i===4?0:5,unlocked:i<2,everUnlocked:i<2,pinned:i<3,
    unlockedAt:i<2?'2026-09-24T12:00:00Z':null,
    evidence:Array.from({length:20},(_,j)=>({kind:'dive',id:1,label:'Dive evidence '+j+' with a long location name'}))
  }));

  ws.addEventListener('message',async event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}
    if(m.method==='Fetch.requestPaused'){
      const {request,requestId}=m.params;const url=new URL(request.url);let data=[];
      if(url.pathname==='/auth/login')data={accessToken:`x.${Buffer.from('{"userId":1}').toString('base64url')}.x`};
      if(url.pathname==='/dives/my')data=dives;
      if(url.pathname.endsWith('/buddies'))data=[{userId:1,name:'Yo'},{userId:2,name:'Mi buddy'}];
      if(url.pathname==='/users/me' || url.pathname==='/users/2')data={id:url.pathname==='/users/me'?1:2,name:url.pathname==='/users/me'?'Yo':'Mi buddy',email:'test@example.test',totalDives:2,certifications:[]};
      if(url.pathname.endsWith('/shared-dives'))data={sharedDives:2};
      if(url.pathname==='/dives' && request.method==='POST'){posts.push(JSON.parse(request.postData));data={id:3};}
      if(url.pathname==='/achievements')data=fixtures;
      if(url.pathname==='/achievements/history')data=fixtures.filter(a=>a.everUnlocked);
      if(url.pathname==='/achievements/pins' && request.method==='PUT'){
        posts.push(JSON.parse(request.postData));
        if(!failPins) fixtures.forEach(a=>a.pinned=posts.at(-1).achievementIds.includes(a.id));
      }
      await call('Fetch.fulfillRequest',{requestId,responseCode:failPins && request.method==='PUT' && url.pathname==='/achievements/pins'?500:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PUT,OPTIONS'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
    }
  });
  await call('Page.enable');await call('Runtime.enable');
  await call('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3000/*'}]});
  const run=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const click=async label=>{assert(await run(`(()=>{const e=[...document.querySelectorAll('[role="button"]')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)return false;e.click();return true})()`),label);await sleep(400);};
  const resize=async(width,height=900)=>{await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(300);};
  const shot=async name=>{const r=await call('Page.captureScreenshot');fs.writeFileSync(path.join(artifacts,name+'.png'),Buffer.from(r.data,'base64'));};
  await resize(1440);await call('Page.navigate',{url:'http://127.0.0.1:8107'});await sleep(1200);
  await click('Log In');await sleep(800);

  const labelClick=async label=>{assert(await run(`(()=>{const e=document.querySelector('[aria-label="${label}"]');if(!e)return false;e.click();return true})()`),label);await sleep(250)};
  const cardCount=()=>run(`[...document.querySelectorAll('[aria-label]')].filter(e=>/^(Unpin|Pin) /.test(e.getAttribute('aria-label'))).length`);
  const fill=async value=>{await run(`(()=>{const e=document.querySelector('[aria-label="Search achievements"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(250)};
  await click('View achievements'); await sleep(600);
  assert.equal(await cardCount(),15);
  await click('Wildlife'); assert.equal(await cardCount(),9);
  await click('Locked'); assert.equal(await cardCount(),9);
  await click('Every category'); assert.equal(await cardCount(),13);
  await click('Unlocked'); assert.equal(await cardCount(),2);
  await click('All');await fill('Ocean legend');assert.equal(await cardCount(),1);
  await fill('no match here');assert.equal(await cardCount(),0);
  assert(await run("document.body.textContent.includes('No achievements match')"));
  await fill('');
  for(const width of [1440,1024,768,520,390,320]){
    await resize(width);
    const rects=await run(`[...document.querySelectorAll('[aria-label]')].filter(e=>/^(Unpin|Pin) /.test(e.getAttribute('aria-label'))).map(e=>{const c=e.parentElement.parentElement,r=c.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,h:r.height,opacity:getComputedStyle(c).opacity}})`);
    assert(rects.every(r=>r.x>=0&&r.right<=width+1&&r.h>150&&+r.opacity>0.5),JSON.stringify({width,rects}));
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert(!(a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1),'overlap')}
    assert(await run('document.documentElement.scrollWidth<=innerWidth'));
    const calendar=await run(`(()=>{const one=document.querySelector('[aria-label^="1 "]');const grid=one.parentElement;const labels=grid.previousElementSibling.children;return [...grid.children].map((c,i)=>{const r=c.getBoundingClientRect(),h=labels[i%7].getBoundingClientRect();return Math.abs(r.x+r.width/2-h.x-h.width/2)<1})})()`);
    assert(calendar.every(Boolean),'calendar alignment');
    await shot('overview-'+width);
    await run(`document.querySelector('[aria-label="View First splash details"]').click()`);await sleep(300);
    const close=await run(`(()=>{const r=document.querySelector('[aria-label="Close achievement details"]').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}})()`);
    assert(close.x>=0&&close.right<=width&&close.y>=0&&close.bottom<=900);
    assert(await run(`document.activeElement.getAttribute('aria-label')==='Close achievement details'`),'modal focus');
    await shot('details-'+width);
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(250);
    assert.equal(await run(`!!document.querySelector('[aria-label="Close achievement details"]')`),false);
  }
  await labelClick('Pin Deep routine');
  assert(await run("document.body.textContent.includes('You can pin up to three')"));
  assert.equal(await run(`!!document.querySelector('[aria-label="Close achievement details"]')`),false,'pin must not open details');
  await shot('pin-limit-mobile');await sleep(5200);
  assert.equal(await run("document.body.textContent.includes('You can pin up to three')"),false);
  await labelClick('Unpin First splash');assert.equal(posts.length,1);
  failPins=true;await labelClick('Pin First splash');await sleep(300);
  assert(await run(`!!document.querySelector('[aria-label="Pin First splash"]')`),'rollback');
  assert(await run("document.body.textContent.includes('Could not save your pinned')"));
  await labelClick('Dismiss pin message');failPins=false;
  await labelClick('Pin First splash');await sleep(300);
  await run(`document.querySelector('[aria-label="View Deep routine details"]').click()`);await sleep(300);
  await click('☆ Pin achievement');
  assert(await run(`document.querySelector('[aria-label="Close achievement details"]').parentElement.parentElement.textContent.includes('You can pin up to three')`));
  await resize(640,360);await shot('details-short-height');
  const closeFits=await run(`(()=>{const r=document.querySelector('[aria-label="Close achievement details"]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`);
  assert(closeFits);await labelClick('Close achievement details');
  // Inject the same route parameters supplied by CreateDive/Pokedex after an unlock.
  const celebrate=async()=>run(`(()=>{const node=document.querySelector('[aria-label="Search achievements"]');let fiber=node[Object.keys(node).find(k=>k.startsWith('__reactFiber'))];while(fiber){if(fiber.memoizedProps?.navigation&&fiber.memoizedProps?.route?.name==='Achievements'){fiber.memoizedProps.navigation.setParams({celebrateIds:['achievement-0','achievement-1'],celebrationKey:String(Date.now())});return true;}fiber=fiber.return;}return false;})()`);
  for(const width of [1440,320]){
    await resize(width);assert(await celebrate());await sleep(350);
    const fits=await run(`(()=>{const e=document.querySelector('[aria-label="Dismiss achievement notification"]').parentElement;const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&r.right>innerWidth-40})()`);
    assert(fits);await shot('toast-'+width);
    await labelClick('Dismiss achievement notification');
    assert(await run(`document.querySelector('[aria-label="Dismiss achievement notification"]').parentElement.textContent.includes('Getting serious')`));
    await labelClick('Dismiss achievement notification');
    assert.equal(await run(`!!document.querySelector('[aria-label="Dismiss achievement notification"]')`),false);
  }
  assert(await celebrate());await sleep(8300);
  assert(await run(`document.querySelector('[aria-label="Dismiss achievement notification"]').parentElement.textContent.includes('Getting serious')`));
  await sleep(8300);assert.equal(await run(`!!document.querySelector('[aria-label="Dismiss achievement notification"]')`),false);
  console.log('PASS: notification bounds, queued dismissal and expiry; filters, title search, zero-progress cards, non-overlapping layouts at six widths, calendar columns, modal bounds/focus/Escape, pin limit expiry, no pin click propagation, pin rollback and modal warnings.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();server.close();});
