// Local UI regression check. Export to .expo/feed-fixed-dist before running.
// All API responses are fixtures; no accounts or server data are changed.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '../.expo/feed-fixed-dist');
const artifacts = path.resolve(__dirname, '../.expo/feed-check');
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + (req.url === '/' ? '/index.html' : decodeURIComponent(req.url)));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const browser = spawn(process.env.UI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9369', `--user-data-dir=${path.join(artifacts, 'browser')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws;
(async () => {
  await new Promise(r => server.listen(8109, '127.0.0.1', r));
  let tabs;
  for (let n = 0; n < 40; n++) { try { tabs = await (await fetch('http://127.0.0.1:9369/json')).json(); break; } catch { await sleep(250); } }
  assert(tabs, 'Browser did not start');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const comments = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, body: `Comment ${i + 1}: Wonderful dive and a great sighting!`, user: { id: 2, name: 'Enrique Santatecla' }, createdAt: new Date().toISOString() }));
  const buddies = [{ id: 2, name: 'Enrique Santatecla' }, { id: 3, name: 'Enrique2' }, { id: 4, name: 'Tami' }, ...Array.from({ length: 12 }, (_, i) => ({ id: i + 5, name: `Dive buddy ${i + 5}` }))];
  const dive = { id: 1, country: 'Bahamas', location: 'Shark Point with a long descriptive location name', maxDepth: 20, duration: 55, date: new Date().toISOString() };
  const fixtures = ['achievement', 'sighting', 'dive'].map((type, i) => ({ id: `${type}-${i + 1}`, type, actor: buddies[2], createdAt: new Date().toISOString(), commentsCount: 8, commentsPreview: comments.slice(0, 3), reactionsCount: 0, reactedByMe: false, canOpenDive: true, ...(type === 'achievement' ? { achievement: { title: 'Shark encounter', description: 'Record any shark species in your Pokedex.', icon: '🐟', category: 'wildlife', evidence: ['Great white shark'] } } : { dive }), ...(type === 'sighting' ? { species: { name: 'Great white shark', category: 'Sharks' } } : {}) }));
  const requests = [], posts = [], errors = [];
  let failComment = false, failFeed = false;
  ws.addEventListener('message', async event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (p) m.error ? p.reject(m.error) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.method !== 'Fetch.requestPaused') return;
    const { request, requestId } = m.params, url = new URL(request.url);
    let data = [], status = 200;
    if (url.pathname === '/auth/login') data = { accessToken: `x.${Buffer.from('{"userId":1}').toString('base64url')}.x` };
    if (url.pathname === '/users/me') data = { id: 1, name: 'Test diver', certifications: [] };
    if (url.pathname === '/dives/my') data = [dive];
    if (url.pathname.endsWith('/buddies')) data = buddies;
    if (url.pathname === '/activity-feed') {
      requests.push(Object.fromEntries(url.searchParams));
      const type = url.searchParams.get('type') === 'mine' ? url.searchParams.get('mineType') : url.searchParams.get('type');
      const actor = url.searchParams.get('buddyId');
      data = { items: fixtures.filter(i => (!actor || i.actor.id === +actor) && (type === 'all' || i.type === ({ dives: 'dive', wildlife: 'sighting', achievements: 'achievement' })[type])), nextCursor: null, hasMore: false };
      if (failFeed) status = 500;
    }
    if (url.pathname.endsWith('/comments')) {
      data = comments;
      if (request.method === 'POST') {
        posts.push(JSON.parse(request.postData));
        if (failComment) status = 500;
        else { data = { ...comments[0], id: comments.length + 1, body: posts.at(-1).body }; comments.push(data); }
      }
    }
    if (url.pathname.endsWith('/like')) data = { reacted: true };
    await call('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,OPTIONS' }], body: Buffer.from(JSON.stringify(data)).toString('base64') });
  });
  const run = async expression => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const click = async label => { assert(await run(`(()=>{const e=[...document.querySelectorAll('[role="button"]')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)return false;e.click();return true})()`), label); await sleep(250); };
  const label = async value => { assert(await run(`(()=>{const e=[...document.querySelectorAll('[aria-label]')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(value)});if(!e)return false;e.click();return true})()`), value); await sleep(250); };
  const fill = async value => { await run(`(()=>{const e=document.querySelector('[aria-label="Comment"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); await sleep(100); };
  const shot = async name => { const r = await call('Page.captureScreenshot'); fs.writeFileSync(path.join(artifacts, name + '.png'), Buffer.from(r.data, 'base64')); };
  await call('Page.enable'); await call('Runtime.enable');
  await call('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3000/*' }] });
  await call('Page.navigate', { url: 'http://127.0.0.1:8109' }); await sleep(1000);
  await click('Log In'); await sleep(500); await click('Open buddy activity'); await sleep(500);
  assert.equal(requests.at(-1).type, 'all');
  assert(await run("document.body.textContent.includes('Comment 1:') && document.body.textContent.includes('Comment 3:')"));
  await label('Choose a buddy'); await shot('buddy-picker'); await click('Tami');
  assert.equal(requests.at(-1).buddyId, '4');
  await label('Choose a buddy'); await click('Enrique Santatecla');
  assert.equal(requests.at(-1).buddyId, '2');
  assert(await run("document.body.textContent.includes('Your feed is quiet')"));
  await label('Choose a buddy'); await click('All buddies');
  await click('Marine life'); assert.equal(requests.at(-1).type, 'wildlife');
  assert(await run("document.body.textContent.includes('Open Pokedex') && !document.body.textContent.includes('Unlocked Shark')"));
  await click('My activity').catch(() => click('★ My activity'));
  await run("[...document.querySelectorAll('[role=button]')].filter(e=>e.textContent.trim()==='Achievements').at(-1).click()"); await sleep(250); assert.equal(requests.at(-1).mineType, 'achievements');
  await click('Everything');
  for (const width of [1440, 768, 520, 390, 320]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(300);
    assert(await run('document.documentElement.scrollWidth <= innerWidth'), `overflow at ${width}`);
    const bounds = await run(`[...document.querySelectorAll('[aria-label^="Open 8 comments"]')].map(e=>{const r=e.parentElement.parentElement.getBoundingClientRect();return {x:r.x,right:r.right,h:r.height}})`);
    assert(bounds.length === 3 && bounds.every(r => r.x >= 0 && r.right <= width && r.h > 280), JSON.stringify({ width, bounds }));
    await shot(`feed-${width}`);
  }
  await label('Open 8 comments for activity by Tami');
  assert(await run("document.body.textContent.includes('Comment 8:')"));
  const body = 'Amazing dive! '.repeat(9);
  await fill(body); await label('Send comment'); assert.equal(posts.at(-1).body, body.trim());
  failComment = true; await fill('Please keep this draft!'); await label('Send comment');
  assert.equal(await run("document.querySelector('[aria-label=\"Comment\"]').value"), 'Please keep this draft!');
  await shot('comments-320');
  failComment = false; await label('Send comment'); await label('Close comments');
  failFeed = true; await click('Dives');
  assert(await run("document.body.textContent.includes('Could not load the buddy feed.')"));
  failFeed = false; await click('Retry'); assert.equal(requests.at(-1).type, 'dives');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ requests, posts, errors, result: 'passed' }, null, 2));
  console.log('Activity feed UI checks passed; screenshots in .expo/feed-check');
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => { ws?.close(); browser.kill(); server.close(); });
