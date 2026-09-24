// Browser regression checks against an exported app; all API traffic is mocked.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '../.expo/center-profile-fixed-dist');
const artifacts = path.resolve(__dirname, '../.expo/center-profile-check');
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url === '/' ? '/index.html' : req.url));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const browser = spawn(process.env.UI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9387', `--user-data-dir=${path.join(artifacts, 'browser')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, closeBrowser;
(async () => {
  await new Promise(r => server.listen(8127, '127.0.0.1', r));
  let tabs;
  for (let n = 0; n < 40; n++) { try { tabs = await (await fetch('http://127.0.0.1:9387/json')).json(); break; } catch { await sleep(250); } }
  assert(tabs, 'Browser did not start');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  closeBrowser = () => call('Browser.close');

  const largeStats = { loggedDives: 240, plannedDives: 38, clients: 117, inventoryUnits: 620, availableUnits: 280, assetTypes: 28 };
  let stats = { ...largeStats };
  let center = { id: 1, name: 'North Reef Professional Dive Center', email: 'operations@northreef.test', country: 'Spain', phone: '+34 600 123 456', website: 'https://northreef.test', instagram: '@northreef', facebook: 'northreef-diving', description: 'A diving center for everyone.', updatedAt: '2026-09-24T10:00:00Z' };
  let clients = Array.from({length: 10}, (_, i) => ({ id: i + 1, name: 'Client ' + (i + 1) + ' with an intentionally long diver name', email: 'diver' + (i + 1) + '@example.test', dives: 42 - i * 3 }));
  let failLoad = false, failSave = false, delaySave = false;
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
      if (url.pathname === '/center/profile' && request.method === 'GET') {
        data = {center, stats, clientRanking: clients, clientsPreview: [], createdAt: center.updatedAt, updatedAt: center.updatedAt};
        if (failLoad) { code = 500; data = {message: {bad: 'object'}}; }
      }
      if (url.pathname === '/center/profile' && request.method === 'PATCH') {
        const payload = JSON.parse(request.postData);
        writes.push(payload);
        if (delaySave) await sleep(700);
        if (failSave) {code = 500; data = {message: {bad: 'object'}};}
        else {center = {...center, ...payload}; data = center;}
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
  const open = async () => { await call('Page.navigate', { url: 'http://127.0.0.1:8127' }); await sleep(900); await click('Log In'); await click('Center profile'); await sleep(300); };
  await resize(1440); await open();
  for (const width of [1440, 768, 390, 320]) {
    await resize(width); await bounds(); await scrollTo('CENTER ADMINISTRATION'); await shot('large-' + width);
    await scrollTo('Operations at a glance'); await shot('insights-' + width);
    const ratios = await run(`[...document.querySelectorAll('[data-testid^="bar-"]')].map(e=>e.getBoundingClientRect().width/e.parentElement.getBoundingClientRect().width)`);
    Object.values(largeStats).forEach((value,i)=>assert(Math.abs(ratios[i]-value/620)<0.002));
    await click('Show all 18 items');
    assert.equal(await run(`document.querySelectorAll('[aria-label$=": complete"],[aria-label$=": incomplete"]').length`),18);
    await bounds(); await scrollTo('Profile readiness'); await shot('checklist-' + width);
    await click('Show fewer items');
    await scrollTo('Top diver clients'); await shot('clients-' + width);
    await scrollTo('Company and contact'); await bounds(); await shot('form-' + width);
  }
  const circles = await run(`[...document.querySelectorAll('circle[stroke-dasharray]')].map(e=>({dash:parseFloat(e.getAttribute('stroke-dasharray')),offset:parseFloat(e.getAttribute('stroke-dashoffset'))}))`);
  assert.equal(circles.length,2);
  assert(Math.abs(circles[0].dash/(2*Math.PI*42)-280/620)<0.0001);
  assert(Math.abs(circles[1].offset+circles[0].dash)<0.0001);
  await fill('Center phone', '+34 999 123 456');
  await fill('Center website', 'https://new.example.test/path');
  await fill('Instagram profile', '@newinstagram'); await fill('Facebook profile','newfacebook');
  await fill('Center name','A'); await scrollTo('Save profile'); await click('Save profile');
  assert.equal(writes.length,0); assert.equal(await run('document.activeElement.getAttribute("aria-label")'),'Center name');
  await shot('validation');
  await fill('Center name','AB'); await fill('Center email','bad');
  await click('Save profile'); assert.equal(writes.length,0);
  await fill('Center email','operations@northreef.test');
  failSave=true; await scrollTo('Save profile'); await click('Save profile');
  assert(await run('document.body.textContent.includes("Your changes are still here")'));
  await shot('save-error');
  assert.equal(await run(`document.querySelector('[aria-label="Center phone"]').value`),'+34 999 123 456');
  failSave=false; delaySave=true;
  await click('Save profile');
  assert.equal(await run(`document.querySelector('[aria-label="Center phone"]').readOnly`),true);
  assert.equal(await run(`[...document.querySelectorAll('[role="button"]')].find(e=>e.textContent==="Saving…").getAttribute("aria-disabled")`),'true');
  await sleep(800);
  assert.equal(writes.at(-1).phone,'+34 999 123 456');
  assert.equal(writes.at(-1).website,'https://new.example.test/path');
  assert.equal(writes.at(-1).instagram,'@newinstagram'); assert.equal(writes.at(-1).facebook,'newfacebook');
  assert(await run('document.body.textContent.includes("Profile saved successfully.")'));
  await shot('saved');
  await fill('Center phone','draft phone');
  await run('window.confirm=()=>false');
  const back = async () => { assert(await run(`(()=>{const e=[...document.querySelectorAll('[aria-label]')].find(e=>/back/i.test(e.getAttribute('aria-label')) && e.getClientRects().length);if(!e)return false;e.click();return true})()`), 'Back navigation'); await sleep(300); };
  await back();
  assert.equal(await run(`document.querySelector('[aria-label="Center phone"]').value`),'draft phone');
  await run('window.confirm=()=>true'); await back();
  await click('Center profile');
  assert.equal(await run(`document.querySelector('[aria-label="Center phone"]').value`),'+34 999 123 456');
  stats = {loggedDives:2, plannedDives:1, clients:2, inventoryUnits:8, availableUnits:4, assetTypes:3}; clients=clients.slice(0,2);
  await open(); await resize(1440); await shot('small-data');
  stats = Object.fromEntries(Object.keys(stats).map(key=>[key,0])); clients=[]; center={id:1,name:'',email:'',country:'',updatedAt:'invalid'};
  await open();
  for (const width of [1440,390,320]) {await resize(width); await bounds(); await shot('empty-'+width);}
  assert(await run('document.body.textContent.includes("No inventory units yet.")'));
  assert(await run('document.body.textContent.includes("No linked diver activity yet.")'));
  assert.equal(await run('document.querySelectorAll("circle[stroke-dasharray]").length'),0);
  assert(await run(`[...document.querySelectorAll('[data-testid^="bar-"]')].every(e=>e.getBoundingClientRect().width===0)`));
  failLoad=true; await open();
  assert(await run('document.body.textContent.includes("Could not load the center profile")'));
  failLoad=false; await click('Retry'); assert(await run('document.body.textContent.includes("Profile readiness")'));
  assert.deepEqual(errors,[]);
  console.log('PASS: responsive content at 1440/768/390/320; chart ratios and zero states; checklist expansion; large/small/empty data; phone, URL and social persistence; validation; save failure/retry; pending-save locking; navigation guard; load retry; no browser exceptions.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(closeBrowser)await closeBrowser().catch(()=>{});ws?.close();browser.kill();server.close();});
