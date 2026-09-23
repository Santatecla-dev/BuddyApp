const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const root = path.resolve(__dirname, '../.expo/map-repair-dist');
const evidence = path.resolve(__dirname, '../.expo/map-repair-evidence');
fs.mkdirSync(evidence, { recursive: true });

const server = http.createServer((request, response) => {
  const file = path.join(root, request.url === '/' ? 'index.html' : decodeURIComponent(request.url));
  if (!file.startsWith(root) || !fs.existsSync(file)) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  response.end(fs.readFileSync(file));
});

const browser = spawn(process.env.UI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9357',
  `--user-data-dir=${path.join(evidence, 'browser')}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });

let socket;
(async () => {
  await new Promise((resolve) => server.listen(8097, '127.0.0.1', resolve));
  let tabs;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      tabs = await (await fetch('http://127.0.0.1:9357/json')).json();
      break;
    } catch {
      await sleep(250);
    }
  }
  assert(tabs);
  socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });

  let fail = false;
  let dives = [
    { id: 1, country: 'España', location: 'Cala Caló', date: '2024-08-30', maxDepth: 15, duration: 50 },
    { id: 2, country: 'Spain', location: 'A long dive site name that should wrap on a narrow device', date: '2025-07-20', maxDepth: 30, duration: 45 },
    { id: 3, country: 'Portugal', location: 'Berlengas', date: '2024-06-14', maxDepth: 22, duration: 70 },
    { id: 4, country: 'Jordan', location: 'Petra', date: '2024-05-18', maxDepth: 41, duration: 35 },
    { id: 5, country: 'Israel', location: 'Mar Rojo', date: '2024-04-11', maxDepth: 18, duration: 80 },
    { id: 6, country: 'México', location: 'Cala Caló', date: '2024-03-04', maxDepth: 28, duration: 55 },
  ];

  socket.addEventListener('message', async (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (entry) message.error ? entry.reject(message.error) : entry.resolve(message.result);
    }
    if (message.method === 'Fetch.requestPaused') {
      const request = message.params.request;
      const url = new URL(request.url);
      const data = url.pathname === '/auth/login'
        ? { accessToken: `x.${Buffer.from('{"userId":1}').toString('base64url')}.x` }
        : url.pathname === '/dives/my' ? dives : [];
      await call('Fetch.fulfillRequest', {
        requestId: message.params.requestId,
        responseCode: fail && url.pathname === '/dives/my' ? 500 : 200,
        responseHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Access-Control-Allow-Origin', value: '*' },
          { name: 'Access-Control-Allow-Headers', value: '*' },
        ],
        body: Buffer.from(JSON.stringify(data)).toString('base64'),
      });
    }
  });

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3000/*' }] });
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const resize = async (width, height) => {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await sleep(350);
  };
  const screenshot = async (name) => {
    const result = await call('Page.captureScreenshot');
    fs.writeFileSync(path.join(evidence, name), Buffer.from(result.data, 'base64'));
  };
  const clickText = async (text) => {
    const clicked = await evaluate(`(() => { const node = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === ${JSON.stringify(text)}); if (!node) return false; node.click(); return true; })()`);
    assert(clicked, `Missing button: ${text}`);
    await sleep(500);
  };


  const clickLabel = async label => {
    assert(await evaluate(`(() => { const e = document.querySelector('button[aria-label="' + ${JSON.stringify(label)} + '"]'); if (!e) return false; e.click(); return true; })()`), label);
    await sleep(250);
  };
  const fillSearch = async value => {
    await evaluate(`(() => { const e = document.querySelector('input[aria-label="Search dive sites"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await sleep(250);
  };
  const circles = () => evaluate('document.querySelectorAll("svg circle").length');
  const viewBox = () => evaluate('document.querySelector("svg[viewBox]").getAttribute("viewBox")');
  const back = async () => { await evaluate(`document.querySelector('[aria-label*="back"], [aria-label*="Back"]').click()`); await sleep(500); };
  const checkLayout = async () => evaluate(`(() => {
    const content = document.querySelector('[aria-label="Search dive sites"]').parentElement.parentElement;
    return [...content.querySelectorAll('div,input,button')].filter(e => {
      const r = e.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1 || e.scrollWidth > e.clientWidth + 2);
    }).map(e => ({text:e.textContent.slice(0,60), width:e.clientWidth, scroll:e.scrollWidth}));
  })()`);
  await resize(1440, 1000);
  await call('Page.navigate', { url: 'http://127.0.0.1:8097' });
  await sleep(1300);
  await clickText('Log In');
  await clickText('Explore dive map');
  assert.equal(await circles(), 5);
  await clickText('Spain');
  assert.equal(await circles(), 1);
  assert(await evaluate('document.body.textContent.includes("2 shown")'));
  assert(await evaluate('[...document.querySelectorAll("button")].find(e => e.textContent==="Spain").getAttribute("aria-pressed")==="true"'));
  await clickText('All sites');
  await fillSearch('Spain');
  assert(await evaluate('document.body.textContent.includes("2 shown")'));
  await fillSearch('España');
  assert(await evaluate('document.body.textContent.includes("2 shown")'));
  await clickLabel('Clear search');
  await clickLabel('Save Cala Caló');
  await clickText('Saved');
  assert.equal(await circles(), 1);
  assert(await evaluate('document.body.textContent.includes("1 shown")'));
  await clickLabel('Remove Cala Caló from saved sites');
  assert.equal(await circles(), 0);
  assert(await evaluate('document.body.textContent.includes("No sites to show")'));
  await clickText('All sites');
  await clickLabel('Jordan, 1 dives');
  await clickText('Spain');
  assert(!await evaluate('document.body.textContent.includes("View latest dive")'));
  await clickText('All sites');
  const initialBox = await viewBox();
  const initialRadius = await evaluate('Number(document.querySelector("svg circle").getAttribute("r"))');
  await clickLabel('Zoom in');
  assert.notEqual(await viewBox(), initialBox);
  assert(await evaluate('Number(document.querySelector("svg circle").getAttribute("r"))') < initialRadius);
  const zoomBox = await viewBox();
  await evaluate(`document.querySelector('[aria-label^="World dive map"]').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight',bubbles:true}))`);
  assert.notEqual(await viewBox(), zoomBox);
  const mapBounds = async () => {
    await evaluate(`document.querySelector('[aria-label^="World dive map"]').scrollIntoView({block:'center'})`);
    await sleep(200);
    return evaluate(`(() => {const r=document.querySelector('[aria-label^="World dive map"]').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  };
  const point = await mapBounds();
  const beforeDrag = await viewBox();
  await call('Input.dispatchMouseEvent', {type:'mousePressed', ...point, button:'left', clickCount:1});
  await call('Input.dispatchMouseEvent', {type:'mouseMoved', x:point.x+80, y:point.y+40, button:'left', buttons:1});
  await call('Input.dispatchMouseEvent', {type:'mouseReleased', x:point.x+80, y:point.y+40, button:'left', clickCount:1});
  await sleep(250);
  assert.notEqual(await viewBox(), beforeDrag, 'Pointer drag must pan the map');
  const beforeWheel = await viewBox();
  await call('Input.dispatchMouseEvent', {type:'mouseWheel', ...point, deltaX:0, deltaY:-120, modifiers:2});
  await sleep(250);
  assert.notEqual(await viewBox(), beforeWheel, 'Ctrl wheel must zoom');
  await call('Emulation.setTouchEmulationEnabled', {enabled:true});
  const beforeTouch = await viewBox();
  await call('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[point]});
  await call('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:point.x-60,y:point.y-30}]});
  await call('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  await sleep(250);
  assert.notEqual(await viewBox(), beforeTouch, 'Touch drag must pan the map');
  await call('Emulation.setTouchEmulationEnabled', {enabled:false});
  await clickLabel('Reset map view');
  assert.equal(await viewBox(), initialBox);
  for(let n=0;n<5;n++) await clickLabel('Zoom in');
  assert(await evaluate(`document.querySelector('[aria-label="Zoom in"]').disabled`));
  for(let n=0;n<5;n++) await clickLabel('Zoom out');
  assert.equal(await viewBox(), initialBox);
  for (const width of [1440, 768, 390, 320]) {
    await resize(width, 1000);
    await clickLabel('Select dive at A long dive site name that should wrap on a narrow device, Spain');
    assert.deepEqual(await checkLayout(), [], 'Overflow at ' + width);
    await mapBounds();
    await screenshot('map-' + width + '.png');
  }
  await clickText('List');
  assert.equal(await circles(), 0);
  assert.deepEqual(await checkLayout(), []);
  await clickLabel('Sort dives: Most recent');
  await clickText('Deepest first');
  assert.equal(await evaluate(`document.querySelector('[aria-label^="Select dive at"]').getAttribute("aria-label")`), 'Select dive at Petra, Jordan');
  await clickText('Map');
  await evaluate(`document.querySelector('[aria-label="Close selected dive"]').scrollIntoView({block:'center'})`);
  await sleep(250);
  await screenshot('map-mobile-selection.png');
  await back();
  fail = true;
  await clickText('Explore dive map');
  assert(await evaluate('document.body.textContent.includes("Could not load your dive sites")'));
  fail = false;
  await clickText('Retry');
  assert.equal(await circles(), 5);
  await back();
  await clickText('View dive statistics');
  assert(await evaluate(`document.querySelector('[aria-label="España: 2 dives"]') !== null`));
  for (const width of [1440, 768, 390, 320]) {
    await resize(width, 1000);
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
    await screenshot('stats-' + width + '.png');
  }
  await clickText('Last month');
  assert(await evaluate('document.body.textContent.includes("No dives in this period")'));
  await back();
  fail = true;
  await clickText('View dive statistics');
  assert(await evaluate('document.body.textContent.includes("Could not load your statistics")'));
  fail = false;
  await clickText('Retry');
  console.log('PASS: map and Stats responsive layouts; aliases; shared saved filtering; unique site identity; stale selection; zoom limits and reset; keyboard pan; list sort; loading failure/retry; Stats country grouping.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  socket?.close(); browser.kill(); server.close();
});
