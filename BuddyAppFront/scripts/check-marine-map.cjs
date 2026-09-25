const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const root = path.resolve(__dirname, '../.expo/marine-fixed-dist');
const evidence = path.resolve(__dirname, '../.expo/marine-fixed-evidence');
fs.mkdirSync(evidence, { recursive: true });

const species = [
  ['great-white-shark', 'Great white shark', 'Sharks'], ['tiger-shark', 'Tiger shark', 'Sharks'], ['bull-shark', 'Bull shark', 'Sharks'], ['whale-shark', 'Whale shark', 'Sharks'], ['basking-shark', 'Basking shark', 'Sharks'], ['thresher-shark', 'Thresher shark', 'Sharks'], ['nurse-shark', 'Nurse shark', 'Sharks'], ['leopard-shark', 'Leopard shark', 'Sharks'],
  ['manta-ray', 'Manta ray', 'Rays'], ['mobula-ray', 'Mobula ray', 'Rays'], ['spotted-eagle-ray', 'Spotted eagle ray', 'Rays'], ['common-stingray', 'Common stingray', 'Rays'], ['guitarfish', 'Guitarfish', 'Rays'],
  ['leafy-seadragon', 'Leafy seadragon', 'Macro'], ['nudibranch', 'Nudibranch', 'Macro'], ['frogfish', 'Frogfish', 'Macro'], ['seahorse', 'Seahorse', 'Macro'], ['pipefish', 'Pipefish', 'Macro'], ['blue-ringed-octopus', 'Blue-ringed octopus', 'Macro'],
  ['clownfish', 'Clownfish', 'Tropical fish'], ['grouper', 'Grouper', 'Tropical fish'], ['napoleon-wrasse', 'Napoleon wrasse', 'Tropical fish'], ['ocean-sunfish', 'Ocean sunfish', 'Pelagic'], ['bottlenose-dolphin', 'Bottlenose dolphin', 'Pelagic'],
].map(([key, name, category]) => ({ key, name, category, imageUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="%23d7f1f3"/></svg>' }));
const byKey = Object.fromEntries(species.map((item) => [item.key, item]));
const points = [
  { location: 'Panglao', country: 'Philippines', latitude: 9.578, longitude: 123.747, sightings: 18, dives: 9, species: [['whale-shark', 8], ['manta-ray', 6], ['nudibranch', 4]] },
  { location: 'Fuvahmulah', country: 'Maldives', latitude: .298, longitude: 73.424, sightings: 14, dives: 6, species: [['tiger-shark', 9], ['bull-shark', 5]] },
  { location: 'Tiger Zoo', country: 'Maldives', latitude: .3, longitude: 73.43, sightings: 11, dives: 4, species: [['tiger-shark', 11]] },
  { location: 'Balicasag', country: 'Philippines', latitude: 9.52, longitude: 123.69, sightings: 8, dives: 4, species: [['manta-ray', 4], ['clownfish', 4]] },
  { location: 'Red Sea', country: 'Egypt', latitude: 27.25, longitude: 34.25, sightings: 6, dives: 3, species: [['great-white-shark', 2], ['basking-shark', 2], ['nudibranch', 2]] },
  { location: 'Cala Brava', country: 'Spain', latitude: 41.7, longitude: 2.9, sightings: 5, dives: 3, species: [['grouper', 2], ['common-stingray', 3]] },
  { location: 'Great Barrier Reef', country: 'Australia', latitude: -18.29, longitude: 147.7, sightings: 4, dives: 2, species: [['whale-shark', 2], ['manta-ray', 2]] },
  { location: 'Blue Hole', country: 'Belize', latitude: 17.32, longitude: -87.53, sightings: 3, dives: 1, species: [['nurse-shark', 3]] },
];
const toPoint = (point, query) => {
  const selected = query ? point.species.filter(([key]) => key === query) : point.species;
  const list = selected.map(([key, count]) => ({ ...byKey[key], count }));
  return list.length ? { ...point, sightings: list.reduce((sum, item) => sum + item.count, 0), species: list, lastSeen: '2026-09-20T10:00:00.000Z', precision: 'location' } : null;
};

const server = http.createServer((request, response) => {
  const file = path.join(root, request.url === '/' ? 'index.html' : decodeURIComponent(request.url.split('?')[0]));
  if (!file.startsWith(root) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  response.end(fs.readFileSync(file));
});
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--remote-debugging-port=9398', `--user-data-dir=${path.join(__dirname, '../.expo/marine-fixed-browser')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const requests = [];

(async () => {
  await new Promise((resolve) => server.listen(8117, '127.0.0.1', resolve));
  let tabs;
  for (let attempt = 0; attempt < 40; attempt += 1) { try { tabs = await (await fetch('http://127.0.0.1:9398/json')).json(); break; } catch { await sleep(250); } }
  assert(tabs?.length, 'Chrome did not start');
  socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  socket.addEventListener('message', async (event) => {
    const message = JSON.parse(event.data);
    if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (item) message.error ? item.reject(message.error) : item.resolve(message.result); }
    if (message.method === 'Fetch.requestPaused') {
      const { request, requestId } = message.params;
      const url = new URL(request.url);
      let data = [];
      if (url.pathname === '/auth/login') data = { accessToken: `x.${Buffer.from('{"userId":1}').toString('base64url')}.x` };
      else if (url.pathname === '/pokedex/species' || url.pathname === '/pokedex') data = species;
      else if (url.pathname === '/pokedex/marine-map') {
        requests.push(url.searchParams.toString());
        const selected = url.searchParams.get('speciesKey') || '';
        const filtered = points.map((point) => toPoint(point, selected)).filter(Boolean);
        data = { period: url.searchParams.get('period') || 'all', speciesKey: selected || null, points: filtered, totalSightings: filtered.reduce((sum, item) => sum + item.sightings, 0), totalLocations: filtered.length, generatedAt: '2026-09-25T10:00:00.000Z' };
      }
      const body = Buffer.from(JSON.stringify(data)).toString('base64');
      await call('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' }], body });
    }
  });
  await call('Page.enable'); await call('Runtime.enable'); await call('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3000/*' }] });
  const evaluate = async (expression) => { const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const resize = async (width, height = 900) => { await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await sleep(500); };
  const clickText = async (text) => { assert(await evaluate(`(()=>{const e=[...document.querySelectorAll('button,[role="button"]')].find(n=>n.textContent.includes(${JSON.stringify(text)}));if(!e)return false;e.click();return true})()`), text); await sleep(850); };
  const clickSelector = async (selector) => { assert(await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.click();return true})()`), selector); await sleep(700); };
  const shot = async (name) => { const image = await call('Page.captureScreenshot'); fs.writeFileSync(path.join(evidence, `${name}.png`), Buffer.from(image.data, 'base64')); };
  const scrollToText = async (text) => { await evaluate(`(()=>{const e=[...document.querySelectorAll('*')].find(n=>n.textContent?.trim()===${JSON.stringify(text)});e?.scrollIntoView({block:'center'});})()`); await sleep(350); };

  await resize(1440); await call('Page.navigate', { url: 'http://127.0.0.1:8117' }); await sleep(1300); await clickText('Log In'); await clickText('Open marine Pokedex'); await clickText('Explore the community marine map');

  await sleep(1000);
  const viewBox = () => evaluate("document.querySelector('svg[viewBox]').getAttribute('viewBox')");
  const inBounds = (selector) => evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.width>0})()`);
  await shot('desktop');
  await clickSelector('[aria-label="Zoom in marine life map"]');
  assert.equal(await viewBox(), '235 119.25 470 238.5');
  await clickSelector('[aria-label="Pan map east"]');
  assert.equal(await viewBox(), '352.5 119.25 470 238.5');
  await clickSelector('[aria-label="Reset marine life map zoom"]');
  assert.equal(await viewBox(), '0 0 940 477');
  await clickText('Balicasag');
  assert(await evaluate("document.body.innerText.includes('Philippines · 8 sightings across 4 dives')"));
  assert(await evaluate(`(()=>{const e=[...document.querySelectorAll('*')].find(n=>n.textContent==='SELECTED ZONE');const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight})()`), 'selected detail automatically visible');
  await shot('selected-zone');
  await clickSelector('[aria-label="Close selected map zone"]');
  await clickText('Last month');
  assert(requests.at(-1).includes('period=month'));
  await clickText('Last year');
  assert(requests.at(-1).includes('period=year'));
  await clickText('All time');
  for (const width of [320, 360, 600, 768]) {
    await resize(width, 800);
    await scrollToText('Species');
    assert(await inBounds('[aria-label="Choose species filter"]'), 'species bounds '+width);
    assert(await inBounds('svg[viewBox]'), 'map bounds '+width);
    for (const label of ['Last week','Last month','Last 6 months','Last year','All time']) {
      assert(await evaluate(`(()=>{const e=[...document.querySelectorAll('[role="button"]')].find(n=>n.textContent===${JSON.stringify(label)});const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()`), label+' bounds '+width);
    }
    await shot('filters-'+width);
    await clickSelector('[aria-label="Choose species filter"]');
    assert(await inBounds('[aria-label="Close species filter"]'));
    assert(await evaluate(`(()=>{let e=document.querySelector('[role="radio"]').parentElement; while(e){if(/auto|scroll/.test(getComputedStyle(e).overflowY)){e.scrollTop=e.scrollHeight;return e.scrollTop>0}e=e.parentElement}return false})()`), 'list scrolls');
    await shot('modal-'+width);
    await clickSelector('[aria-label="Close species filter"]');
    assert.equal(await evaluate("!!document.querySelector('[aria-label=\"Close species filter\"]')"), false);
  }
  await resize(360, 800);
  await resize(360, 400);
  await clickSelector('[aria-label="Choose species filter"]');
  assert(await inBounds('[aria-label="Close species filter"]'));
  assert(await evaluate(`(()=>{let e=document.querySelector('[role="radio"]').parentElement;while(e){if(/auto|scroll/.test(getComputedStyle(e).overflowY)){const r=e.getBoundingClientRect();return r.height>0&&r.bottom<=innerHeight}e=e.parentElement}return false})()`), 'short viewport list remains visible');
  await shot('modal-short');
  await clickSelector('[aria-label="Close species filter"]');
  await resize(360, 800);
  await clickSelector('[aria-label="Choose species filter"]');
  await clickSelector('[role="radio"]:nth-of-type(2)');
  assert.equal(await evaluate("!!document.querySelector('[aria-label=\"Close species filter\"]')"), false);
  assert(requests.at(-1).includes('speciesKey=great-white-shark') && requests.at(-1).includes('period=all'));
  await clickSelector('[aria-label="Choose species filter"]');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(500);
  assert.equal(await evaluate("!!document.querySelector('[aria-label=\"Close species filter\"]')"), false);
  await scrollToText('Sightings heatmap');
  await shot('narrow-map');
  console.log('PASS: desktop zoom/pan/reset, correct zone, period/species requests, 320/360/600/768px bounds, modal scrolling/selection/close/Escape.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { socket?.close(); browser.kill(); server.close(); });
