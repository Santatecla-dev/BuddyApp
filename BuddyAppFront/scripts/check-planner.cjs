const {spawn} = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '../.expo/planner-fixed-dist');
const artifacts = path.resolve(__dirname, '../.expo/planner-check');
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req,res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url));
  if (!file.startsWith(root) || !fs.existsSync(file)) {res.writeHead(404); return res.end();}
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const browser = spawn(process.env.UI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9357',`--user-data-dir=${path.join(artifacts,'browser')}`,'about:blank'], {windowsHide:true,stdio:'ignore'});
let ws;
(async () => {
  await new Promise(r => server.listen(8097,'127.0.0.1',r));
  let tabs;
  for(let n=0;n<40;n++){try{tabs=await (await fetch('http://127.0.0.1:9357/json')).json();break;}catch{await sleep(250);}}
  assert(tabs,'Browser did not start');
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map();
  const call=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
  const dives=[{id:1,country:'España',location:'Cala Caló',date:'2024-08-30T10:00:00Z',maxDepth:15,duration:50},{id:2,country:'Andorra',location:'Un punto de buceo con un nombre muy largo para comprobar el ajuste de texto',date:'2024-08-31T10:00:00Z',maxDepth:30,duration:45}];
  let posts=[], failSave=false, failStats=false;
  const plans=Array.from({length:8},(_,i)=>({id:i+1,location:i===0?'Manta Point':'Dive site '+(i+1),country:'Spain',buddy:'Buddy',date:'2027-02-12T12:00:00Z',maxDepth:25,duration:45,gas:'Nitrox 32',condition:'Good',shoreEntry:true,notes:'Full notes '.repeat(30),checklist:{mask:true,computer:true}}));
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
      let status=200;
      if(url.pathname==='/dives/my' && failStats)data={unexpected:true};
      if(url.pathname==='/planned-dives'){
        data=plans;
        if(request.method==='POST'){posts.push(JSON.parse(request.postData));data={id:9};if(failSave){status=500;data={message:'Temporary failure. Please try again.'};}}
      }
      if(/^\/planned-dives\/\d+$/.test(url.pathname))data=plans.find(p=>p.id===Number(url.pathname.split('/').pop()));
      if(url.pathname.endsWith('/log'))data={id:99};
      await call('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
    }
  });
  await call('Page.enable');await call('Runtime.enable');
  await call('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3000/*'}]});
  const run=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const click=async label=>{assert(await run(`(()=>{const e=[...document.querySelectorAll('[role="button"]')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)return false;e.click();return true})()`),label);await sleep(400);};
  const resize=async(width,height=900)=>{await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(300);};
  const shot=async name=>{const r=await call('Page.captureScreenshot');fs.writeFileSync(path.join(artifacts,name+'.png'),Buffer.from(r.data,'base64'));};

  const fill=async(label,value)=>run(`(()=>{const e=document.querySelector('[aria-label='+JSON.stringify(${JSON.stringify(label)})+']');const setter=Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  const back=async()=>{await run(`document.querySelector('[aria-label*="back"],[aria-label*="Back"]').click()`);await sleep(500);};
  const layout=async(label)=>{for(const width of [1440,768,390,320]){
    await resize(width);
    const overflow=await run(`[...document.querySelectorAll('input,select,textarea,button,[role="button"],[role="checkbox"]')].filter(e=>!e.closest('[aria-hidden="true"]')).filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left < -1 || r.right > innerWidth+1)}).map(e=>e.textContent||e.getAttribute('aria-label'))`);
    assert.deepEqual(overflow,[],label+' '+width);
    await shot(label+'-'+width);
  }};
  await resize(1440);await call('Page.navigate',{url:'http://127.0.0.1:8097'});await sleep(1200);
  await click('Log In');await click('View planned dives');
  assert.equal(await run('document.querySelectorAll("[aria-label^=\\"Open planned dive\\"]").length'),8);
  await layout('list');
  await fill('Search planned dives','Manta');await sleep(300);
  assert.equal(await run('document.querySelectorAll("[aria-label^=\\"Open planned dive\\"]").length'),1);
  assert.equal(await run('getComputedStyle(document.querySelector("[aria-label=\\"Search planned dives\\"]")).color'),'rgb(51, 65, 85)');
  await run('document.querySelector("[aria-label=\\"Open planned dive at Manta Point\\"]").click()');await sleep(500);
  assert(await run("document.body.textContent.includes('2/9')"));
  assert.equal(await run('document.querySelectorAll("[aria-label$=\\"ready\\"]").length'),7);
  await layout('detail');
  await click('Delete plan');assert(await run("document.body.textContent.includes('Confirm delete')"));await click('Keep plan');
  await back();await click('+ Plan a dive');await layout('form');
  assert.equal(await run('document.querySelectorAll("[role=checkbox]").length'),9);
  await run('document.querySelector("[role=checkbox]").scrollIntoView({block:"center"})');await sleep(200);await shot('form-checklist-mobile');
  assert(await run(`[...document.querySelectorAll('[role="checkbox"]')].every(e=>{const r=e.getBoundingClientRect();const p=e.parentElement.parentElement.parentElement.getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom})`));
  await run('document.querySelector("textarea").scrollIntoView({block:"center"})');await sleep(200);await shot('form-notes-mobile');
  await resize(1440);await run('document.querySelector("[role=checkbox]").scrollIntoView({block:"center"})');await sleep(200);await shot('form-checklist-desktop');
  await click('Save plan');assert.equal(posts.length,0);
  assert(await run("document.body.textContent.includes('Select a country.')"));
  await fill('Planned dive country','Spain');await fill('Dive site','Test reef');await fill('Planned date','31/02/2027');
  await click('Save plan');assert.equal(posts.length,0);
  await fill('Planned date','25/09/2027');await fill('Planned maximum depth','131');await click('Save plan');assert.equal(posts.length,0);
  await fill('Planned maximum depth','25');await fill('Planned duration','45');
  await run('document.querySelector("[role=checkbox]").click()');failSave=true;
  await click('Save plan');assert.equal(posts.length,1);assert(await run("document.body.textContent.includes('Temporary failure')"));
  failSave=false;await click('Save plan');assert.equal(posts.length,2);assert.equal(Object.keys(posts[1].checklist).length,9);assert.equal(posts[1].checklist.mask,true);assert.equal(posts[1].checklist.weights,false);
  await back();
  await click('View dive statistics');await layout('stats');await back();failStats=true;
  await click('View dive statistics');assert(await run("document.body.textContent.includes('Could not load your statistics')"));failStats=false;await click('Retry');
  assert(await run("document.body.textContent.includes('Dive statistics')"));
  await back();await click('View planned dives');await run('document.querySelector("[aria-label=\\"Open planned dive at Manta Point\\"]").click()');await sleep(500);
  await click('Log this dive');assert(await run("document.body.textContent.includes('View planned dives')"));
  await click('View planned dives');await run('document.querySelector("[aria-label=\\"Open planned dive at Manta Point\\"]").click()');await sleep(500);
  await click('Delete plan');await click('Confirm delete');assert(await run("document.body.textContent.includes('+ Plan a dive')"));
  console.log('PASS: eight plans, search, complete legacy checklist, responsive screens at 1440/768/390/320, delete cancellation, validation, failed save and retry, nine-item payload, Stats malformed-response recovery.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();server.close();});
