const {spawn} = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '../dist');
const artifacts = path.resolve(__dirname, '../.expo/ui-check');
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
  let posts=[];
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
      await call('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
    }
  });
  await call('Page.enable');await call('Runtime.enable');
  await call('Fetch.enable',{patterns:[{urlPattern:'http://localhost:3000/*'}]});
  const run=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const click=async label=>{assert(await run(`(()=>{const e=[...document.querySelectorAll('[role="button"]')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)return false;e.click();return true})()`),label);await sleep(400);};
  const resize=async(width,height=900)=>{await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(300);};
  const shot=async name=>{const r=await call('Page.captureScreenshot');fs.writeFileSync(path.join(artifacts,name+'.png'),Buffer.from(r.data,'base64'));};
  await resize(1440);await call('Page.navigate',{url:'http://127.0.0.1:8089'});await sleep(1200);
  await run(`(()=>{const e=[...document.querySelectorAll('div')].find(e=>e.textContent==='Login'&&e.tabIndex===0);e.click()})()`);await sleep(800);
  const rect=()=>run(`(()=>{const e=document.querySelector('[aria-label="Compartir inmersión en Cala Caló"]').parentElement;const r=e.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height}})()`);
  const before=await rect();await click('Agrupar por país');const grouped=await rect();await click('Mostrar sin agrupar');
  assert.equal(before.width,grouped.width);assert.equal(before.height,grouped.height);await shot('dives-desktop');
  await call('Emulation.setPageScaleFactor',{pageScaleFactor:2});
  assert.equal(await run('visualViewport.scale'),2);
  await shot('dives-zoom-200');
  await call('Emulation.setPageScaleFactor',{pageScaleFactor:1});
  for(const width of [720,360,320]){await resize(width);const r=await rect();assert(r.x>=0&&r.x+r.width<=width);assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'),true);}
  await shot('dives-mobile');
  await click('Crear nueva inmersión');await sleep(400);
  for(const width of [1440,720,360,320]){await resize(width);const bounds=await run(`[...document.querySelectorAll('input,select,textarea')].filter(e=>e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,height:r.height}})`);assert(bounds.every(r=>r.x>=0&&r.right<=width&&r.height>=48));if(width===1440)await shot('form-desktop');}
  await shot('form-mobile');
  await click('Crear inmersión');assert.equal(posts.length,0);assert(await run(`document.body.textContent.includes('Debes seleccionar')`));
  const fill=async(label,value)=>run(`(()=>{const e=document.querySelector('[aria-label=${JSON.stringify(label)}]');const setter=Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  await fill('País','España');await fill('Lugar','Prueba');await fill('Día','29');await fill('Mes','02');await fill('Año','2023');await fill('Profundidad máxima en metros','30');await fill('Duración en minutos','45');
  await click('Crear inmersión');assert.equal(posts.length,0);
  await fill('Año','2024');await click('Crear inmersión');assert.equal(posts.length,1);assert.equal(posts[0].location,'Prueba');
  console.log('PASS: equal grouped/ungrouped card dimensions; 1440/720/360/320px layouts; control bounds and touch sizes; required fields; leap-year validation; successful mocked submission.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();server.close();});
