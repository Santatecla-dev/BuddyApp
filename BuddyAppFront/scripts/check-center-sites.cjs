// Browser regression checks against an exported app; all API traffic is mocked.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '../.expo/center-sites-repair-dist');
const artifacts = path.resolve(__dirname, '../.expo/center-sites-check');
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url === '/' ? '/index.html' : req.url));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const browser = spawn(process.env.UI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9391', `--user-data-dir=${path.join(artifacts, 'browser')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, closeBrowser;
(async () => {
  await new Promise(r => server.listen(8131, '127.0.0.1', r));
  let tabs;
  for (let n = 0; n < 40; n++) { try { tabs = await (await fetch('http://127.0.0.1:9391/json')).json(); break; } catch { await sleep(250); } }
  assert(tabs, 'Browser did not start');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  closeBrowser = () => call('Browser.close');

  const center = {id:1,name:'Test dive center'};
  const map = {key:'panglao-bohol',name:'Panglao & Bohol',country:'Philippines',bounds:{north:10.2,south:9.45,east:124.55,west:123.55},attribution:'GeoJSON boundaries'};
  let sites = [{id:1,name:'Balicasag Cathedral',latitude:9.6,longitude:123.8,minDepth:10,maxDepth:25,typicalSightings:['turtle','Legacy sighting'],routes:[{name:'First route',points:[{latitude:0,longitude:0}]},{name:'Second route',points:[]}]}];
  const species = [{key:'turtle',name:'Green turtle',category:'Turtles'},{key:'shark',name:'Whale shark',category:'Sharks'}];
  let failSpecies = false;
  const writes = [], errors = [];
  ws.addEventListener('message', async event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.method === 'Fetch.requestPaused') {
      const { request, requestId } = m.params, url = new URL(request.url);
      let data = [], code = 200;
      if (url.pathname === '/auth/login') data = { accessToken: 'test', accountType: 'center' };
      if (url.pathname === '/center/dashboard') data = { center, dives: [], plannedDives: [], inventory: [], clients: [], linkRequests: [], counts: {dives: 0, plannedDives: 0, inventory: 0, clients: 0} };
      if (url.pathname === '/center/operation-map') data = {map,catalog:[map],selectedMapKey:map.key,sites};
      if (url.pathname === '/pokedex/species') {data=species;if(failSpecies)code=500;}
      if (url.pathname.startsWith('/center/dive-sites') && request.method==='GET') data=sites.find(s=>s.id===Number(url.pathname.split('/').pop()));
      if (url.pathname.startsWith('/center/dive-sites') && ['POST','PATCH'].includes(request.method)) {
        const payload=JSON.parse(request.postData); writes.push(payload);
        const id=request.method==='POST'?sites.length+1:Number(url.pathname.split('/').pop());
        data={...payload,id}; sites=sites.filter(s=>s.id!==id).concat(data);
      }
      await call('Fetch.fulfillRequest', { requestId, responseCode: code, responseHeaders: [{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PATCH,OPTIONS'}], body: Buffer.from(JSON.stringify(data)).toString('base64') });
    }
  });
  await call('Page.enable'); await call('Runtime.enable');
  await call('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3000/*' }] });
  const run = async expression => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const click = async label => { assert(await run(`(()=>{const e=[...document.querySelectorAll('button,[role="button"]')].find(e=>e.getClientRects().length && (e.textContent.trim()===${JSON.stringify(label)} || e.getAttribute('aria-label')===${JSON.stringify(label)}));if(!e)return false;e.click();return true})()`), label); await sleep(200); };
  const fill = async (label, value) => {
    await run(`(()=>{const e=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); await sleep(60);
  };
  const resize = async width => { await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(200); };
  const shot = async name => { const r = await call('Page.captureScreenshot'); fs.writeFileSync(path.join(artifacts, name + '.png'), Buffer.from(r.data, 'base64')); };
  const scrollTo = async text => { assert(await run(`(()=>{const e=[...document.querySelectorAll('*')].find(e=>e.childElementCount===0 && e.textContent===${JSON.stringify(text)});if(!e)return false;e.scrollIntoView({block:'start'});return true})()`), text); await sleep(150); };
  const bounds = async () => {
    const overflow = await run(`[...document.querySelectorAll('div,input,textarea,select,svg')].filter(e=>e.getClientRects().length && !e.closest('[aria-hidden="true"]')).filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left < -1 || r.right > innerWidth+1)}).map(e=>(e.getAttribute('aria-label')||e.textContent).slice(0,80)).slice(0,10)`);
    assert.deepEqual(overflow, [], 'Content must fit viewport');
  };
  const open = async () => { await call('Page.navigate', { url: 'http://127.0.0.1:8131' }); await sleep(900); await click('Log In'); await click('Dive sites map'); await sleep(300); };
  await resize(1440); await open();
  const svg = 'document.querySelector("svg[viewBox]")';
  const box = () => run(svg+'.getAttribute("viewBox")');
  for (const width of [1440,768,390,320]) {
    await resize(width); await bounds(); await scrollTo('Dive zones'); await shot('map-'+width);
    await click('Add details');
    assert.equal(await run('document.querySelectorAll("[role=checkbox]").length'),0);
    await bounds(); await shot('form-'+width); await click('Close dive site form');
  }
  await resize(1440);
  await click('Zoom in');
  const before=await box();
  await run(svg+'.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}))');
  await sleep(100); assert.notEqual(await box(),before);
  await run(svg+'.scrollIntoView({block:"center"})'); await sleep(100);
  const point=await run('(()=>{const r='+svg+'.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  const dragBefore=await box();
  await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+70,y:point.y+30,buttons:1,button:'left'});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+70,y:point.y+30,button:'left',clickCount:1});
  await sleep(150);assert.notEqual(await box(),dragBefore);
  const wheelBefore=await box();
  await call('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:-100,modifiers:2});
  await sleep(150);assert.notEqual(await box(),wheelBefore);
  await call('Emulation.setTouchEmulationEnabled',{enabled:true});
  const touchBefore=await box();
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-35,y:point.y-20}]});
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(150);assert.notEqual(await box(),touchBefore);
  await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await click('+ Place pin');
  const target={x:point.x-110,y:point.y+40};
  const expected=await run('(()=>{const s='+svg+',p=s.createSVGPoint();p.x='+target.x+';p.y='+target.y+';const q=p.matrixTransform(s.getScreenCTM().inverse());return {latitude:10.2-q.y/470*.75,longitude:123.55+q.x/900}})()');
  await call('Input.dispatchMouseEvent',{type:'mousePressed',...target,button:'left',clickCount:1});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',...target,button:'left',clickCount:1});
  await sleep(200);
  const actual=await run('({latitude:Number(document.querySelector("[aria-label=\\\"Dive site latitude\\\"]").value),longitude:Number(document.querySelector("[aria-label=\\\"Dive site longitude\\\"]").value)})');
  assert(Math.abs(actual.latitude-expected.latitude)<0.00001);assert(Math.abs(actual.longitude-expected.longitude)<0.00001);
  await fill('Dive site name','Exact placement');
  await click('Choose typical sightings');
  await run('document.querySelector("[role=checkbox]").click()');await sleep(100);
  await click('Done · 1 selected');
  assert(await run('!!document.querySelector("[aria-label=\\\"Remove Green turtle\\\"]")'));
  await click('Create dive site');
  assert.deepEqual(writes.at(-1).typicalSightings,['turtle']);
  const delta=await run('(()=>{const s='+svg+',c=s.querySelector("[data-site-id=\\\"2\\\"] circle"),p=s.createSVGPoint();p.x=Number(c.getAttribute("cx"));p.y=Number(c.getAttribute("cy"));const q=p.matrixTransform(s.getScreenCTM());return {x:q.x,y:q.y}})()');
  assert(Math.hypot(delta.x-target.x,delta.y-target.y)<1,'Saved pin must match click within one pixel');
  await click('Reset map zoom');
  await run('document.querySelector("[data-site-id=\\\"1\\\"]").dispatchEvent(new Event("noop"))');
  await run('[...document.querySelectorAll("button")].find(e=>e.textContent.includes("Balicasag Cathedral")&&e.textContent.includes("typical sightings")).click()');await sleep(100);
  await click('Edit');await fill('Minimum depth','');await fill('Maximum depth','');await click('Save changes');
  assert.equal(writes.at(-1).minDepth,null);assert.equal(writes.at(-1).maxDepth,null);
  assert.equal(writes.at(-1).routes.length,2);assert.deepEqual(writes.at(-1).typicalSightings,['turtle','Legacy sighting']);
  failSpecies=true;
  await click('Open site profile');
  for(const width of [1440,768,390,320]) {await resize(width);await bounds();await shot('detail-'+width);}
  assert(await run('document.body.textContent.includes("Balicasag Cathedral")'));
  await click('Back to dive sites map');
  assert.deepEqual(errors,[]);
  console.log('PASS: responsive layouts at 1440/768/390/320; keyboard and pointer pan; exact zoomed pin placement; on-demand sightings and saved selection; preservation of legacy sightings and extra routes; profile survives species API failure; no browser exceptions.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(closeBrowser)await closeBrowser().catch(()=>{});ws?.close();browser.kill();server.close();});
