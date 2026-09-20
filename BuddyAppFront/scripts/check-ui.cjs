const {spawn} = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '../.expo/ui-fixes-dist');
const artifacts = path.resolve(__dirname, '../.expo/ui-fixes-check');
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req,res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url));
  if (!file.startsWith(root) || !fs.existsSync(file)) {res.writeHead(404); return res.end();}
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const browser = spawn(process.env.UI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9333',`--user-data-dir=${path.join(artifacts,'browser')}`,'about:blank'], {windowsHide:true,stdio:'ignore'});
let ws;
(async () => {
  await new Promise(r => server.listen(8089,'127.0.0.1',r));
  let tabs;
  for(let n=0;n<40;n++){try{tabs=await (await fetch('http://127.0.0.1:9333/json')).json();break;}catch{await sleep(250);}}
  assert(tabs,'Browser did not start');
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map();
  const call=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
  const dives=[{id:1,country:'España',location:'Cala Caló',date:'2024-08-30T10:00:00Z',maxDepth:15,duration:50},{id:2,country:'Andorra',location:'Un punto de buceo con un nombre muy largo para comprobar el ajuste de texto',date:'2024-08-31T10:00:00Z',maxDepth:30,duration:45}];
  let posts=[], invitePosts=[], responses=[];
  let inviteMode='existing';
  let profileAgency='';
  const profilePatches=[];
  const invitations=Array.from({length:36},(_,i)=>({id:i+1,dive:{...dives[0],id:i+1,location:'Dive site '+(i+1)+' with a long descriptive name'},invitedByUser:{id:i<18?2:3,name:'Same buddy name',email:i<18?'one@test.com':'two@test.com'}}));
  ws.addEventListener('message',async event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}
    if(m.method==='Fetch.requestPaused'){
      const {request,requestId}=m.params;const url=new URL(request.url);let data=[];let status=200;
      if(url.pathname==='/auth/login')data={accessToken:`x.${Buffer.from('{"userId":1}').toString('base64url')}.x`};
      if(url.pathname==='/dives/my')data=dives;
      if(url.pathname==='/dives/invites/pending')data=invitations;
      if(url.pathname==='/dives/invite' && request.method==='POST'){
        invitePosts.push(JSON.parse(request.postData));
        if(inviteMode==='existing'){status=400;data={message:'El usuario ya está en la inmersión'};}
        else data={};
      }
      if(request.method==='POST' && (url.pathname==='/dives/invite/accept'||url.pathname==='/dives/invite/reject')){
        responses.push({path:url.pathname,...JSON.parse(request.postData)});data={};
      }
      if(url.pathname.endsWith('/buddies'))data=[{userId:1,name:'Yo'},{userId:2,name:'Mi buddy'}];
      if(url.pathname==='/users/me' || url.pathname==='/users/2')data={id:url.pathname==='/users/me'?1:2,name:url.pathname==='/users/me'?'Yo':'Mi buddy',email:'test@example.test',totalDives:2,certifications:[]};
      if(url.pathname==='/users/me' && request.method==='PATCH'){
        const body=JSON.parse(request.postData);profilePatches.push(body);profileAgency=body.agency;
      }
      if(url.pathname==='/users/me')data={...data,agency:profileAgency};
      if(url.pathname.endsWith('/shared-dives'))data={sharedDives:2};
      if(url.pathname==='/dives' && request.method==='POST'){posts.push(JSON.parse(request.postData));data={id:3};}
      await call('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET, POST, PATCH, OPTIONS'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
    }
  });
  await call('Page.enable');await call('Runtime.enable');
  await call('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3000/*'}]});
  const run=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const click=async label=>{assert(await run(`(()=>{const e=[...document.querySelectorAll('[role="button"]')].find(e=>e.getBoundingClientRect().width>0&&e.textContent.trim()===${JSON.stringify(label)});if(!e)return false;e.click();return true})()`),label);await sleep(400);};
  const resize=async(width,height=900)=>{await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(300);};
  const shot=async name=>{const r=await call('Page.captureScreenshot');fs.writeFileSync(path.join(artifacts,name+'.png'),Buffer.from(r.data,'base64'));};
  await resize(1440);await call('Page.navigate',{url:'http://127.0.0.1:8089'});await sleep(1200);
  const fill=async(label,value)=>run(`(()=>{const e=[...document.querySelectorAll('[aria-label='+JSON.stringify(${JSON.stringify(label)})+']')].find(e=>e.getBoundingClientRect().width>0);const setter=Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  const back=async()=>{assert(await run(`(()=>{const e=[...document.querySelectorAll('[role="button"],button,a')].find(e=>e.getBoundingClientRect().width>0&&e.getAttribute('aria-label')?.toLowerCase().includes('back'));if(!e)return false;e.click();return true})()`),'Back button');await sleep(450);};
  const reach=async label=>{
    const result=await run(`(()=>{const e=[...document.querySelectorAll('[role="button"]')].find(e=>e.getBoundingClientRect().width>0&&e.textContent.trim()===${JSON.stringify(label)});if(!e)return false;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()`);
    assert(result,'Reachable: '+label);
  };
  for(const [w,h] of [[1440,900],[720,400],[320,480],[568,260]]){
    await resize(w,h);await reach('Create account');await reach('Sign in');
    assert(await run('document.documentElement.scrollWidth <= innerWidth'));
  }
  await shot('login-short');
  await click('Create account');
  await fill('Full name','New Diver');await fill('Email','diver@example.test');await fill('Password','test-password');
  assert.equal(await run(`getComputedStyle(document.querySelector('[aria-label="Full name"]')).color`),'rgb(36, 50, 71)');
  await reach('Create account');await shot('register-short');
  await back();await resize(1440);await click('Sign in');await sleep(800);
  const rect=()=>run(`(()=>{const e=document.querySelector('[aria-label="Share dive at Cala Caló"]').parentElement;const r=e.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height}})()`);
  const before=await rect();await click('Group by country');const grouped=await rect();await click('Show all dives');
  assert.equal(before.width,grouped.width);assert.equal(before.height,grouped.height);await shot('dives-desktop');
  await call('Emulation.setPageScaleFactor',{pageScaleFactor:2});
  assert.equal(await run('visualViewport.scale'),2);
  await shot('dives-zoom-200');
  await call('Emulation.setPageScaleFactor',{pageScaleFactor:1});
  for(const width of [720,360,320]){await resize(width);const r=await rect();assert(r.x>=0&&r.x+r.width<=width);assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'),true);}
  await shot('dives-mobile');
  await click('Log a new dive');await sleep(400);
  for(const width of [1440,720,360,320]){await resize(width);const bounds=await run(`[...document.querySelectorAll('input,select,textarea')].filter(e=>e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,height:r.height}})`);assert(bounds.every(r=>r.x>=0&&r.right<=width&&r.height>=48));if(width===1440)await shot('form-desktop');}
  await shot('form-mobile');
  await click('Log dive');assert.equal(posts.length,0);assert(await run(`document.body.textContent.includes('Select a country')`));
  await fill('Country','España');await fill('Location','Prueba');await fill('Day','29');await fill('Month','02');await fill('Year','2023');await fill('Maximum depth in meters','30');await fill('Duration in minutes','45');
  await click('Log dive');assert.equal(posts.length,0);
  await fill('Year','2024');await click('Log dive');assert.equal(posts.length,1);assert.equal(posts[0].location,'Prueba');
  await click('Share');
  await resize(320,480);
  await fill('User ID','12oops');await click('Send invitation');assert.equal(invitePosts.length,0);
  await fill('User ID','2');await click('Send invitation');assert.equal(invitePosts.length,1);
  assert(await run(`document.body.textContent.includes('This user is already in the dive.')`));
  assert(await run(`(()=>{const input=document.querySelector('[aria-label="User ID"]').getBoundingClientRect();const err=document.querySelector('[role="alert"]').getBoundingClientRect();const button=[...document.querySelectorAll('[role="button"]')].find(e=>e.textContent==='Send invitation').getBoundingClientRect();return input.bottom<=err.top&&err.bottom<=button.top})()`));
  await shot('invite-error-mobile');
  inviteMode='success';await fill('User ID','3');await click('Send invitation');
  assert(await run(`document.body.textContent.includes('Invitation sent.')`));
  await back();await click('Pending invitations!');
  for(const width of [1440,720,320]){
    await resize(width,600);assert(await run('document.documentElement.scrollWidth <= innerWidth'));
  }
  await click('Group by buddy');
  assert(await run(`document.body.textContent.includes('18 invitations')&&!document.body.textContent.includes('36 invitations')`),'Different buddy IDs must not merge');
  assert(await run(`(()=>{const header=[...document.querySelectorAll('[role="heading"]')].find(e=>e.textContent==='Same buddy name');const card=[...document.querySelectorAll('div')].find(e=>e.textContent==='Dive site 1 with a long descriptive name · 30/08/2024');return header&&card&&header.getBoundingClientRect().bottom<card.getBoundingClientRect().top})()`),'Group header must precede cards');
  await shot('invitations-grouped-mobile');
  const scrollList=async()=>{
    await run(`(()=>{const e=[...document.querySelectorAll('div')].filter(e=>e.scrollHeight>e.clientHeight+20&&['auto','scroll'].includes(getComputedStyle(e).overflowY)).at(-1);if(e)e.scrollTop=e.scrollHeight})()`);
    await sleep(350);
  };
  for(let n=0;n<10;n++)await scrollList();
  assert(await run(`document.body.textContent.includes('Dive site 36')`),'Last invitation rendered');
  assert(await run(`[...document.querySelectorAll('div')].some(e=>e.textContent==='Dive site 36 with a long descriptive name · 30/08/2024'&&e.getBoundingClientRect().bottom<=innerHeight)`),'Last invitation reachable');
  await shot('invitations-last-mobile');
  await run(`[...document.querySelectorAll('div')].forEach(e=>{if(['auto','scroll'].includes(getComputedStyle(e).overflowY))e.scrollTop=0})`);await sleep(500);
  await click('Accept');assert.equal(responses[0].path,'/dives/invite/accept');
  await click('Reject');assert.equal(responses[1].path,'/dives/invite/reject');
  await resize(1440);await shot('invitations-grouped-desktop');
  await back();
  assert(await run(`(()=>{const e=document.querySelector('[aria-label="My profile"]');e.click();return true})()`));await sleep(500);
  await resize(320,480);
  assert(await run(`[...document.querySelectorAll('div')].some(e=>e.textContent==='test@example.test'&&getComputedStyle(e).color==='rgb(36, 50, 71)')`));
  await reach('Edit profile');await click('Edit profile');await fill('Agency','PADI');await reach('Save changes');await click('Save changes');assert.equal(profilePatches.length,1);assert.equal(profilePatches[0].agency,'PADI');assert(await run(`document.body.textContent.includes('Profile updated.')`));await shot('profile-mobile');
  console.log('PASS: login/register short-window scrolling; invitation validation, error spacing and success; 36 invitations with grouped scrolling and accept/reject; profile contrast/edit; ');
  console.log('PASS: equal grouped/ungrouped card dimensions; 1440/720/360/320px layouts; control bounds and touch sizes; required fields; leap-year validation; successful mocked submission.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();server.close();});
