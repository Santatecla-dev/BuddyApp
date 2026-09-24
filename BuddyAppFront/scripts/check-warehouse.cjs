// Browser regression checks against an exported app; all API traffic is mocked.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '../.expo/warehouse-fixed-dist');
const artifacts = path.resolve(__dirname, '../.expo/warehouse-check');
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url === '/' ? '/index.html' : req.url));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const browser = spawn(process.env.UI_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9388', `--user-data-dir=${path.join(artifacts, 'browser')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws, closeBrowser;
(async () => {
  await new Promise(r => server.listen(8128, '127.0.0.1', r));
  let tabs;
  for (let n = 0; n < 40; n++) { try { tabs = await (await fetch('http://127.0.0.1:9388/json')).json(); break; } catch { await sleep(250); } }
  assert(tabs, 'Browser did not start');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  closeBrowser = () => call('Browser.close');


  let warehouse = {map:{id:1,name:'Main warehouse',width:24,height:16},objects:[],inventory:[
    {id:1,name:'BCD',category:'BCD',quantity:10,warehouseObjectId:null},
    {id:2,name:'Fins',category:'Fins',quantity:10,warehouseObjectId:null},
    {id:3,name:'Masks',category:'Masks',quantity:4,warehouseObjectId:null},
  ]};
  const writes=[], errors=[];
  let nextId=1, acceptDialog=false, dialogs=0, failSave=false;
  ws.addEventListener('message', async event => {
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}
    if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if(m.method==='Page.javascriptDialogOpening'){dialogs++;await call('Page.handleJavaScriptDialog',{accept:acceptDialog});}
    if(m.method==='Fetch.requestPaused'){
      const {request,requestId}=m.params, url=new URL(request.url);
      let data=[],code=200;
      const body=request.postData?JSON.parse(request.postData):{};
      if(request.method!=='GET'&&request.method!=='OPTIONS')writes.push({url:url.pathname,body});
      if(url.pathname==='/auth/login')data={accessToken:'test',accountType:'center'};
      if(url.pathname==='/center/dashboard')data={center:{id:1,name:'Test Center'},dives:[],plannedDives:[],inventory:[],clients:[],linkRequests:[],counts:{dives:0,plannedDives:0,inventory:0,clients:0}};
      if(url.pathname==='/center/warehouse'){
        if(request.method==='PATCH')warehouse.map={...warehouse.map,...body};
        data=request.method==='PATCH'?warehouse.map:warehouse;
      }
      if(url.pathname==='/center/warehouse/objects'&&request.method==='POST'){
        data={id:nextId++,mapId:1,...body};warehouse.objects.push(data);
      }
      if(url.pathname.match(/\/objects\/\d+$/)&&request.method==='PATCH'){
        const id=Number(url.pathname.split('/').at(-1)),index=warehouse.objects.findIndex(o=>o.id===id);
        if(failSave){code=500;data={message:'Test save failure'};}
        else {warehouse.objects[index]={...warehouse.objects[index],...body};data=warehouse.objects[index];}
      }
      if(url.pathname.startsWith('/center/inventory/')&&request.method==='PATCH'){
        const item=warehouse.inventory.find(i=>i.id===Number(url.pathname.split('/').at(-1)));
        Object.assign(item,body);data=item;
      }
      await call('Fetch.fulfillRequest',{requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PATCH,DELETE,OPTIONS'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
    }
  });
  await call('Page.enable'); await call('Runtime.enable');
  await call('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:3000/*' }] });
  const run = async expression => { const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const click = async label => { assert(await run(`(()=>{const e=[...document.querySelectorAll('button,[role="button"],[role="switch"]')].find(e=>e.getClientRects().length && (e.textContent.trim()===${JSON.stringify(label)} || e.getAttribute('aria-label')===${JSON.stringify(label)}));if(!e)return false;e.click();return true})()`), label); await sleep(200); };
  const fill = async (label, value) => {
    await run(`(()=>{const e=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); await sleep(60);
  };
  const resize = async width => { await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(200); };
  const shot = async name => { const r = await call('Page.captureScreenshot'); fs.writeFileSync(path.join(artifacts, name + '.png'), Buffer.from(r.data, 'base64')); };
  const scrollTo = async text => { assert(await run(`(()=>{const e=[...document.querySelectorAll('*')].find(e=>e.childElementCount===0 && e.textContent===${JSON.stringify(text)});if(!e)return false;e.scrollIntoView({block:'start'});return true})()`), text); await sleep(150); };

  const text = () => run('document.body.textContent');
  const checkItem = async name => { assert(await run(`(()=>{const e=[...document.querySelectorAll('[role="checkbox"]')].find(e=>e.textContent.includes(${JSON.stringify(name)}));if(!e)return false;e.click();return true})()`));await sleep(250);};
  await resize(1440);
  await call('Page.navigate',{url:'http://127.0.0.1:8128'});
  await sleep(900);await click('Log In');await click('Warehouse layout');await sleep(300);
  await click('+ Rack');await click('+ Rack');
  assert.deepEqual(warehouse.objects.map(o=>[o.x,o.y,o.width,o.height]),[[0,0,4,2],[4,0,4,2]]);
  await click('Rack 1');
  let before=writes.length;
  await click('Move left');await click('+ width');await click('Rotate 45°');
  assert.equal(writes.length,before,'Reject bounds, resize and rotation collisions before API');
  await click('Manage assigned inventory (0 units)');
  await checkItem('BCD');await checkItem('Fins');
  await click('Done');assert((await text()).includes('Manage assigned inventory (20 units)'));
  await click('Rack 2');await click('Manage assigned inventory (0 units)');
  before=writes.length;await checkItem('BCD');
  assert.equal(dialogs,1);assert.equal(writes.length,before,'Cancelled transfer does not write');
  acceptDialog=true;await checkItem('BCD');
  assert.equal(warehouse.inventory[0].warehouseObjectId,2);
  await click('Filter unassigned inventory');
  assert.equal(await run("document.querySelectorAll('[role=checkbox]').length"),1);
  await fill('Search warehouse inventory','nothing');
  assert((await text()).includes('No inventory matches'));
  await click('Done');
  await click('+ Free zone');
  assert(!(await text()).includes('Manage assigned inventory'));
  await click('+ Compressor');
  assert(!(await text()).includes('Manage assigned inventory'));
  await click('Rack 1');
  for(const width of [1440,390,360,320]){
    await resize(width);
    await scrollTo('Add to the map');
    for(const label of ['+ Rack','+ Shelf','+ Workbench','+ Free zone','+ Compressor','Edit map']){
      const rect=await run(`(()=>{const e=[...document.querySelectorAll('[role="button"]')].find(e=>e.textContent===${JSON.stringify(label)});const r=e.getBoundingClientRect();return {left:r.left,right:r.right}})()`);
      assert(rect.left>=0&&rect.right<=width,label+' fits '+width);
    }
    assert(await run(`(()=>{const e=[...document.querySelectorAll('div')].find(e=>getComputedStyle(e).overflowX==='auto'&&e.scrollWidth>e.clientWidth+100);if(!e)return innerWidth>1000;e.scrollLeft=9999;return e.scrollLeft>0;})()`),'Canvas scrolls horizontally');
    await shot('toolbar-'+width);
    await scrollTo('Size & orientation');await shot('editor-'+width);
    const rect=await run(`(()=>{const e=[...document.querySelectorAll('[role="button"]')].find(e=>e.textContent==='+ height');return e.getBoundingClientRect().right})()`);
    assert(rect<=width,'Size controls fit');
    const overflow=await run(`[...document.querySelectorAll('[role="button"]')].filter(e=>e.getClientRects().length&&!e.getAttribute('aria-label')?.includes('units')).filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).map(e=>e.textContent)`);
    assert.deepEqual(overflow,[],'No offscreen editor or page controls');
  }
  await resize(1440);
  await click('Edit map');await fill('Warehouse map width','6');before=writes.length;
  await click('Save canvas');assert.equal(writes.length,before);assert((await text()).includes('cut off placed objects'));
  await fill('Warehouse map width','81');await click('Save canvas');assert.equal(writes.length,before);
  await click('Close map settings');
  before=writes.length;await fill('Warehouse object label','Renamed rack');assert.equal(writes.length,before,'Typing does not save');
  failSave=true;await click('Save label');assert((await text()).includes('Test save failure'));
  failSave=false;await click('Save label');assert.equal(warehouse.objects[0].label,'Renamed rack');
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('Warehouse browser regressions passed: placement, blocked edits, unit counts, transfer cancel/confirm, non-storage objects, filters, responsive toolbar/canvas/editor, map bounds and save failure.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{try{await closeBrowser?.();}catch{}ws?.close();server.close();browser.kill();});
