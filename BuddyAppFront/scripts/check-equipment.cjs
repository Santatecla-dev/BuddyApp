// Browser regression checks against an exported app; all API traffic is mocked.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '../.expo/equipment-fixed-dist');
const artifacts = path.resolve(__dirname, '../.expo/equipment-check');
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url === '/' ? '/index.html' : req.url));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const browser = spawn(process.env.UI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9378', `--user-data-dir=${path.join(artifacts, 'browser')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, closeBrowser;
(async () => {
  await new Promise(r => server.listen(8118, '127.0.0.1', r));
  let tabs;
  for (let n = 0; n < 40; n++) { try { tabs = await (await fetch('http://127.0.0.1:9378/json')).json(); break; } catch { await sleep(250); } }
  assert(tabs, 'Browser did not start');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  closeBrowser = () => call('Browser.close');
  const categories = ['Regulator', 'BCD', 'Exposure', 'Computer', 'Camera', 'Accessories'];
  const items = Array.from({ length: 18 }, (_, i) => ({ id: i + 1, name: i === 0 ? 'Go PRO' : `Equipment ${i + 1}`, category: categories[i % 6], condition: i === 2 ? 'service_due' : i === 3 ? 'retired' : 'good', nextServiceDate: i === 0 || i === 3 ? new Date(Date.now() + 10 * 86400000).toISOString() : null, brand: 'Brand', model: 'Model', notes: 'Original notes', packed: false }));
  const trips = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Trip ${i + 1} with a long destination name`, destination: 'Indonesia', startDate: '2027-01-01' }));
  const plans = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, location: `Dive ${i + 1}`, country: 'Spain', date: '2027-01-01', status: 'upcoming' }));
  const writes = [], packs = [], errors = [];
  let failSave = false;
  ws.addEventListener('message', async event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.method === 'Fetch.requestPaused') {
      const { request, requestId } = m.params, url = new URL(request.url);
      let data = [], code = 200;
      if (url.pathname === '/auth/login') data = { accessToken: `x.${Buffer.from('{"userId":1}').toString('base64url')}.x` };
      if (url.pathname === '/users/me') data = { id: 1, name: 'Equipment tester', email: 'test@example.test', totalDives: 0, certifications: [] };
      if (url.pathname === '/equipment') data = items;
      if (/^\/equipment\/\d+$/.test(url.pathname)) {
        data = items.find(x => x.id === Number(url.pathname.split('/').pop()));
        if (request.method === 'PATCH') { writes.push(JSON.parse(request.postData)); if (failSave) code = 500; else Object.assign(data, writes.at(-1)); }
      }
      if (url.pathname === '/equipment' && request.method === 'POST') { const value = JSON.parse(request.postData); writes.push(value); data = { ...value, id: items.length + 1 }; items.push(data); }
      if (url.pathname === '/dive-trips') data = trips;
      if (url.pathname === '/planned-dives') data = plans;
      if (url.pathname === '/equipment/packing') { data = packs; if (request.method === 'POST') { data = { ...JSON.parse(request.postData), id: packs.length + 1, packed: false }; packs.push(data); } }
      if (/^\/equipment\/packing\/\d+$/.test(url.pathname) && request.method === 'PATCH') { data = packs.find(x => x.id === Number(url.pathname.split('/').pop())); Object.assign(data, JSON.parse(request.postData)); }
      await call('Fetch.fulfillRequest', { requestId, responseCode: code, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' }], body: Buffer.from(JSON.stringify(data)).toString('base64') });
    }
  });
  await call('Page.enable'); await call('Runtime.enable');
  await call('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3000/*' }] });
  const run = async expression => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const click = async label => { assert(await run(`(()=>{const e=[...document.querySelectorAll('[role="button"],[role="radio"],[role="checkbox"]')].find(e=>e.getClientRects().length && (e.textContent.trim()===${JSON.stringify(label)} || e.getAttribute('aria-label')===${JSON.stringify(label)}));if(!e)return false;e.click();return true})()`), label); await sleep(350); };
  const fill = async (label, value) => { await run(`(()=>{const e=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); await sleep(100); };
  const resize = async width => { await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(200); };
  const shot = async name => { const r = await call('Page.captureScreenshot'); fs.writeFileSync(path.join(artifacts, name + '.png'), Buffer.from(r.data, 'base64')); };
  const bounds = async () => assert.deepEqual(await run(`Array.from(document.querySelectorAll('[role="button"],[role="checkbox"],[role="radio"],input,textarea')).filter(e=>e.getClientRects().length && !e.closest('[aria-hidden="true"]')).filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth + 1}).map(e=>e.textContent || e.getAttribute('aria-label'))`), [], 'Controls must fit viewport');
  const cardCount = () => run(`document.querySelectorAll('[aria-label^="Open details for"]').length`);
  await resize(1440); await call('Page.navigate', { url: 'http://127.0.0.1:8118' }); await sleep(1200);
  await click('Log In'); await click('My profile'); await click('Manage my equipment');
  assert.equal(await cardCount(), 18);
  for (const width of [1440, 768, 390, 320]) {
    await resize(width); await bounds(); await shot('equipment-' + width);
    assert.equal(await run(`document.querySelectorAll('[role="checkbox"]').length`), 22);
    assert(await run(`(()=>{const cards=[...document.querySelectorAll('[aria-label^="Open details for"]')].map(e=>e.parentElement.parentElement.parentElement.getBoundingClientRect());return cards.every((a,i)=>cards.slice(i+1).every(b=>a.right<=b.left || b.right<=a.left || a.bottom<=b.top || b.bottom<=a.top))})()`), 'Cards must not overlap');
    assert(await run(`(()=>{const checks=[...document.querySelectorAll('[role="checkbox"]')].slice(0,4);const list=checks[0].parentElement.getBoundingClientRect();return checks.every(e=>{const r=e.getBoundingClientRect();return r.top>=list.top && r.bottom<=list.bottom})})()`), 'Every checklist row fits its container');
    await run(`document.querySelectorAll('[role="checkbox"]')[2].scrollIntoView({block:'center'})`); await shot('readiness-' + width);
    await run(`document.querySelector('[aria-label="Open details for Equipment 18"]').scrollIntoView({block:'center'})`); await shot('cards-' + width);
    await click('+ Add equipment'); await bounds(); await shot('form-' + width); await click('Cancel');
  }
  await run(`document.querySelectorAll('[role="checkbox"]')[2].click()`); await sleep(100);
  assert.equal(await run(`document.querySelectorAll('[role="checkbox"]')[2].getAttribute('aria-checked')`), 'true');
  assert.equal(await run(`document.querySelectorAll('[role="checkbox"]')[3].getAttribute('aria-checked')`), 'false');
  await click('Service due'); assert.equal(await cardCount(), 2);
  assert(await run(`!!document.querySelector('[aria-label="Open details for Go PRO"]')`));
  await click('Ready'); assert.equal(await cardCount(), 15);
  await click('Retired'); assert.equal(await cardCount(), 1);
  await click('Any status'); await click('Camera'); assert.equal(await cardCount(), 3); await click('All');
  await fill('Search equipment', 'Go PRO'); assert.equal(await cardCount(), 1); await fill('Search equipment', '');
  await click('Open details for Go PRO'); await click('Packing list');
  for (const width of [1440, 768, 390, 320]) { await resize(width); await bounds(); await shot('packing-' + width); }
  await click('Dive 8Spain · 1/1/2027');
  await click('Add to packing list'); assert.equal(packs.at(-1).plannedDiveId, 8);
  await click('Mark as packed'); assert.equal(packs.at(-1).packed, true);
  await click('Edit item'); await fill('Equipment name', 'Go PRO edited');
  await click('Camera'); await click('Service due');
  await fill('Equipment brand', ''); await fill('Equipment notes', ''); await fill('Next service date', '2026-02-30');
  await click('Save changes'); assert(await run(`document.body.textContent.includes('Enter a valid service date')`));
  await fill('Next service date', ''); failSave = true; await click('Save changes');
  assert(await run(`document.body.textContent.includes('We could not save this equipment.')`));
  failSave = false; await click('Save changes');
  assert.equal(writes.at(-1).category, 'Camera'); assert.equal(writes.at(-1).condition, 'service_due');
  assert.equal(writes.at(-1).brand, null); assert.equal(writes.at(-1).notes, null); assert.equal(writes.at(-1).nextServiceDate, null);
  assert(await run(`document.body.textContent.includes('Edit item') && document.body.textContent.includes('Go PRO edited')`));
  await click('Maintenance'); await click('+ Add service'); await fill('Service date', ''); await click('Save record');
  assert(await run(`document.body.textContent.includes('Enter a service type and valid dates')`)); await click('Cancel');
  assert.deepEqual(errors, []);
  console.log('PASS: responsive equipment/forms/packing at 1440, 768, 390, 320; independent checklist; date/status/category/search filters; all packing contexts; detail editing and category/condition persistence; clearing fields; validation and failed-save recovery; no browser exceptions.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { if (closeBrowser) await closeBrowser().catch(() => {}); ws?.close(); browser.kill(); server.close(); });
