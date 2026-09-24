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
 await page.goto(process.env.DIDBAN_TEST_URL||pathToFileURL(path.join(here,'../docs/index.html')).href);
 for(const [user,pid]of [['inspector','PR-12'],['inspector3','PR-4'],['inspector4','PR-7'],['inspector5','PR-3']]){
  if(await page.locator('[data-action=logout]').count())await page.locator('[data-action=logout]').click();
  await page.locator('[data-action=login-group][data-id=inspector]').click();await page.locator('#login-form [name=username]').fill(user);await page.locator('#login-form [name=password]').fill('demo123');await page.locator('#login-form button[type=submit]').click();
  await page.locator(`[data-action=start-inspector-report][data-id="${pid}"]`).click();
  const id=await page.evaluate(()=>selectedReport);const first=await page.locator('#modal-form [name=additionalChecklistCode] option').nth(1).getAttribute('value');await page.locator('#modal-form [name=additionalChecklistCode]').selectOption(first);await page.locator('[data-action=add-checklist-item]').click();await page.waitForFunction(()=>document.querySelector('#modal-form [name=rootCause0]'));assert.ok(await page.locator('#modal-form [name=rootCause0]').isVisible());assert.ok(await page.locator('#modal-form [name=inspectorAnalysis0]').isVisible());
  await page.locator('#modal-form [name=code0][value=NC-M]').check();await page.locator('#modal-form [name=score0]').selectOption('3');await page.locator('#modal-form [name=level0]').selectOption('0.5');await page.locator('#modal-form [name=observation0]').fill('مشاهده آزمایشی برای کنترل قابلیت تکمیل فرم؛ نتیجه واقعی نیست');
  await page.locator('#modal-form [name=inspectorAnalysis0]').fill('تحلیل آزمایشی بازرس: بررسی رابطه مشاهده، الزام و پیامد');await page.locator('#modal-form [name=directCause0]').fill('علت مستقیم پیشنهادی برای آزمون');await page.locator('#modal-form [name=contributingCause0]').fill('عامل مشارکت‌کننده آزمایشی');await page.locator('#modal-form [name=rootCause0]').fill('فرضیه ریشه‌ای بازرس؛ نیازمند تأیید مستقل شرکت');await page.locator('#modal-form [name=causeEvidence0]').fill('سوابق کنترل باید بررسی شود؛ علت قطعی ادعا نشده است');
  if(user==='inspector'){
   await page.locator('.inspector-analysis').first().evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(dir,'inspector-analysis-preview.png')});
   const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(x=>({id:x.id,targets:x.nodes.map(n=>n.target)})),[]);
  }
  // The fields that used to prevent saving a partial form remain blank on purpose.
  assert.equal(await page.locator('#modal-form [name=location]').inputValue(),'');assert.equal(await page.locator('#modal-form [name=summary]').inputValue(),'');
  await page.locator('#modal-form button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
  const result=await page.evaluate(id=>{const r=engine.reports().find(r=>r.id===id);return {status:r.status,analysis:r.rows[0].inspectorAnalysis,root:r.rows[0].rootCause,old:engine.reports().find(x=>x.id===r.previousReportId).status}},id);assert.equal(result.status,'Draft');assert.match(result.root,/فرضیه/);assert.match(result.analysis,/تحلیل/);assert.equal(result.old,'Submitted');
  await page.reload();assert.equal(await page.evaluate(id=>engine.db.inspectionReports.find(x=>x.id===id).rows[0].rootCause,id),result.root);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));await page.setViewportSize({width:1440,height:1100});
 }
 assert.deepEqual(errors,[]);console.log('PASS: actual default logins in all four disciplines can directly open assigned forms, tick results, type analysis and root causes, save incomplete drafts and reload without unlocking old reports; mobile and axe.');console.log('Artifacts: '+dir);
}finally{await browser.close()}
