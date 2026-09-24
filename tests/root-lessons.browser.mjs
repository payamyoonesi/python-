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
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(here,'../docs/index.html')).href);
 // Simulate an existing browser profile with only the old lesson; migration must persist once.
 const original=await page.evaluate(()=>{const db=clone(engine.db);db.lessonsLearned=db.lessonsLearned.filter(l=>l.id==='LL-1');delete db.rootCauseLessonsVersion;localStorage.setItem(STORAGE_KEY,JSON.stringify(db));return JSON.stringify(db.cases)});
 await page.reload();assert.equal(await page.evaluate(()=>engine.db.lessonsLearned.length),10);assert.equal(await page.evaluate(()=>JSON.stringify(engine.db.cases)),original);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).rootCauseLessonsVersion),1);
 const stored=await page.evaluate(()=>JSON.stringify(engine.db.lessonsLearned));await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(engine.db.lessonsLearned)),stored);
 await page.locator('[data-action=login-group][data-id=deputy]').click();await page.locator('[data-action=login-manager][data-id=development]').click();await page.locator('#login-form button[type=submit]').click();await page.locator('.nav [data-id=lessons]').click();
 assert.equal(await page.locator('.lesson-card').count(),10);assert.equal(await page.locator('.lesson-root').count(),10);assert.equal(await page.locator('.lesson-card').filter({hasText:'نمونه آموزشی'}).count(),9);assert.equal(await page.locator('.lesson-sources').count(),1);
 await page.screenshot({path:path.join(dir,'root-lessons-preview.png')});
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(x=>({id:x.id,targets:x.nodes.map(n=>n.target)})),[]);
 await page.locator('[data-action=new-lesson]').click();await page.locator('#modal-form [name=sourceFindings]').selectOption(['F-111']);const root=await page.evaluate(()=>engine.lessonSources().find(x=>x.findingId==='F-111').rootCause);assert.ok((await page.locator('#lesson-root-preview').innerText()).includes(root));assert.ok(!(await page.locator('#modal-form [name=sourceFindings]').innerText()).includes('undefined'));
 await page.locator('#modal-form [name=title]').fill('درس آزمایشی متصل به علت مرجع');await page.locator('#modal-form [name=rootCausePattern]').fill('ضعف کنترل پیش از اجرا و آموزش');await page.locator('#modal-form [name=lesson]').fill('آمادگی تیم پیش از شروع فعالیت احراز شود');await page.locator('#modal-form [name=preventiveAction]').fill('کنترل مهارت و تأیید آمادگی تیم');await page.locator('#modal-form [name=effectivenessCriterion]').fill('روند تکرار خطا پس از آموزش');await page.screenshot({path:path.join(dir,'root-lesson-source-preview.png')});await page.locator('#modal-form button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
 const id=await page.evaluate(()=>engine.db.lessonsLearned.at(-1).id);assert.equal(await page.locator('.lesson-card').count(),11);const source=await page.evaluate(id=>engine.lessons().find(x=>x.id===id).sourceRootCauses[0],id);assert.equal(source.rootCause,root);assert.equal(source.findingId,'F-111');
 await page.locator(`[data-action=lesson-action][data-id="${id}"]`).click();await page.locator('#modal-form button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);await page.locator(`[data-action=lesson-action][data-id="${id}"]`).click();await page.locator('#modal-form [name=note]').fill('بازبینی آزمایشی؛ نتیجه واقعی ادعا نمی‌شود');await page.locator('#modal-form button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal(await page.evaluate(id=>engine.lessons().find(x=>x.id===id).reviews.length,id),1);
 await page.evaluate(()=>{engine.login('c01','demo123');view='lessons';render()});assert.equal(await page.locator('.lesson-card').count(),11);assert.equal(await page.locator('.lesson-sources').count(),0);assert.equal(await page.locator('[data-action=new-lesson]').count(),0);assert.ok(await page.evaluate(()=>engine.lessons().every(l=>!Object.hasOwn(l,'sourceRootCauses')&&!Object.hasOwn(l,'sourceFindings'))));
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.emulateMedia({media:'print'});assert.equal(await page.locator('.lesson-root').count(),11);await page.emulateMedia({media:'screen'});assert.deepEqual(errors,[]);
 console.log('PASS: ten root-based lessons, marked educational scenarios, persisted additive migration, source root preview/snapshot, publication/review, privacy, mobile, print and axe.');console.log('Artifacts: '+dir);
}finally{await browser.close()}
