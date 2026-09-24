import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),modules=process.env.DIDBAN_TEST_MODULES||path.join(here,'node_modules');
const {chromium}=await import(pathToFileURL(path.join(modules,'playwright/index.mjs')));
const {default:AxeBuilder}=await import(pathToFileURL(path.join(modules,'@axe-core/playwright/dist/index.mjs')));
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'didban-form-'));
const browser=await chromium.launch({headless:true,...(process.env.DIDBAN_CHROMIUM_PATH?{executablePath:process.env.DIDBAN_CHROMIUM_PATH,args:['--no-sandbox','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});await page.route('https://**',route=>route.abort());
 await page.goto(pathToFileURL(path.join(here,'../docs/index.html')).href);
 await page.evaluate(()=>{engine.login('deputy','demo123');view='dashboard';render()});
 const before=await page.evaluate(()=>JSON.stringify(engine.db));
 assert.equal(await page.locator('[data-id="demo-photos"], [data-action="demo-photo-open"]').count(),0);
 const ids=await page.evaluate(()=>engine.listCases().map(c=>c.id));assert.equal(ids.length,12);
 for(const id of ids){
  await page.evaluate(id=>{selectedCase=id;view='cases';render()},id);
  // Use the actual case action so the detail renderer is exercised.
  await page.locator(`[data-action="open-case"][data-id="${id}"]`).first().click();
  assert.equal(await page.locator('#main img,.demo-reference,.demo-photo-section').count(),0);
 }
 await page.screenshot({path:path.join(dir,'reports-without-demo-photos.png')});
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(x=>({id:x.id,targets:x.nodes.map(n=>n.target)})),[]);
 const reports=await page.evaluate(()=>engine.reports().map(r=>r.id));assert.ok(reports.length);
 for(const id of reports){await page.evaluate(id=>{selectedReport=id;view='reports';render()},id);assert.equal(await page.locator('#main img,.demo-reference,.demo-photo-section').count(),0)}
 assert.equal(await page.evaluate(()=>JSON.stringify(engine.db)),before);
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('#main img').count(),0);await page.pdf({path:path.join(dir,'report-without-demo-photos.pdf'),format:'A4'});await page.emulateMedia({media:'screen'});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Saved user evidence must survive the new HTML; no destructive migration.
 const stored=await page.evaluate(()=>{
  engine.db.cases[0].findings[0].documents.push({name:'saved-user-photo.png',type:'image/png',size:3,data:'data:image/png;base64,YWJj'});
  const saved=JSON.stringify(engine.db);localStorage.setItem('didban.holding.v1',saved);return saved;
 });
 await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(engine.db)),stored);
 for(const role of ['deputy','consultant','inspector','c01','development','admin1','admin2']){
  await page.evaluate(role=>{engine.login(role,'demo123');view='dashboard';render()},role);
  assert.equal(await page.locator('[data-id="demo-photos"], [data-action="demo-photo-open"],.demo-reference').count(),0);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 console.log('PASS: no sample photos/gallery in cases, reports or print; preserved database and saved personal evidence; offline, mobile and axe.');console.log('Artifacts: '+dir);
} finally {await browser.close()}
