/* npm install --prefix tests && npm run test:browser --prefix tests
 * Optional: DIDBAN_TEST_MODULES=/path/to/node_modules
 * Optional: DIDBAN_CHROMIUM_PATH=/path/to/chromium (headless shell supported)
 * Test artifacts are temporary and not added to the repository.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const modules=process.env.DIDBAN_TEST_MODULES||path.join(here,'node_modules');
const {chromium}=await import(pathToFileURL(path.join(modules,'playwright/index.mjs')));
const {default:AxeBuilder}=await import(pathToFileURL(path.join(modules,'@axe-core/playwright/dist/index.mjs')));
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'didban-browser-'));
const browser=await chromium.launch({headless:true,...(process.env.DIDBAN_CHROMIUM_PATH?{executablePath:process.env.DIDBAN_CHROMIUM_PATH,args:['--no-sandbox','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
 const page=await context.newPage(),errors=[],remoteRequests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remoteRequests.push(r.url())});
 await page.goto(pathToFileURL(path.join(here,'../docs/index.html')).href);
 assert.equal(await page.locator('.rolecard').count(),5);
 const a11y=async name=>{let results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(results.violations.map(x=>({id:x.id,targets:x.nodes.map(n=>n.target)})),[],name+' accessibility violations');};
 await a11y('login');
 assert.ok(!(await page.locator('#main').innerText()).includes('هلدینگ'));
 assert.match(await page.locator('h1').innerText(),/گروه سرمایه‌گذاری مسکن/);
 assert.equal(await page.locator('.rolecard img').count(),5);
 assert.ok(await page.locator('.rolecard img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0&&i.src.startsWith('data:image/webp;'))));
 await page.screenshot({path:path.join(dir,'entry-reference.png'),fullPage:true});
 // Inspector account admin belongs to consultant, not the infrastructure group.
 await page.locator('[data-action="login-group"][data-id="consultant"]').click();
 assert.equal(await page.locator('#consultant-access [data-id="admin1"]').count(),1);
 await page.locator('[data-action="login-account"][data-id="admin1"]').click();
 assert.equal(await page.locator('#login-form [name=username]').inputValue(),'admin1');
 await page.locator('#login-form button[type=submit]').click();
 assert.equal(await page.evaluate(()=>engine.user.managerRole),'consultant');assert.equal(await page.evaluate(()=>engine.listCases().length),0);
 await page.locator('[data-action="logout"]').click();
 await page.locator('[data-action="login-group"][data-id="technical"]').click();
 assert.deepEqual(await page.locator('#login-form [name=role] option').evaluateAll(xs=>xs.map(x=>x.value)),['cto','admin2']);
 await page.locator('[data-action="login-group"][data-id="technical"]').click();
 // Separate subsidiary form: no automatic login and no company-scope bypass.
 await page.locator('#company-login-form [name=companyUser]').selectOption('c03');
 assert.equal(await page.locator('#company-login-form [name=username]').inputValue(),'c03');assert.equal(await page.evaluate(()=>engine.user),null);
 await page.locator('#company-login-form [name=password]').fill('incorrect');await page.locator('#company-login-form button[type=submit]').click();
 assert.equal(await page.locator('#company-login-error').isVisible(),true);assert.equal(await page.evaluate(()=>engine.user),null);
 await page.locator('#company-login-form [name=password]').fill('demo123');await page.locator('#company-login-form button[type=submit]').click();
 assert.equal(await page.evaluate(()=>engine.user.role),'company');assert.deepEqual(await page.evaluate(()=>engine.listCases().map(c=>c.subsidiary)),['C03']);
 await page.locator('[data-action="logout"]').click();
 assert.equal(await page.locator('#login-form').count(),0);
 assert.match(await page.locator('[data-action="login-group"][data-id="technical"]').innerText(),/ادمین ساختار/);
 await page.locator('[data-action="login-group"][data-id="deputy"]').click();
 assert.equal(await page.locator('.manager-toggle').count(),4);
 assert.deepEqual(await page.locator('.manager-person').allTextContents(),['مهندس مهرنوش','خانم مهندس یگانه','مهندس گلبو','خانم مهندس رنجبر زاده']);
 assert.equal(await page.locator('[data-action="login-group"][data-id="deputy"]').getAttribute('aria-expanded'),'true');
 await page.locator('[data-action="login-manager"][data-id="construction"]').click();
 assert.equal(await page.locator('#team-construction .expert-children .access-leaf').count(),5);
 await page.locator('[data-action="login-account"][data-id="expert3"]').click();
 assert.equal(await page.locator('#login-form [name=username]').inputValue(),'expert3');
 assert.equal(await page.evaluate(()=>engine.user),null);
 await a11y('expanded access hierarchy');await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'hierarchy mobile overflow');await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(dir,'hierarchy.png'),fullPage:true});
 await page.locator('[data-action="login-manager"][data-id="pmo"]').click();
 assert.equal(await page.locator('#team-construction').isVisible(),false);
 assert.equal(await page.locator('#team-pmo .expert-children .access-leaf').count(),1);
 await page.locator('[data-action="login-account"][data-id="deputy"]').click();
 await page.locator('#login-form button[type=submit]').click();
 assert.equal(await page.locator('.chart').count(),5);await a11y('dashboard');
 await page.screenshot({path:path.join(dir,'dashboard.png'),fullPage:true});
 // Keyboard activation of an SVG filter, then clear it.
 await page.locator('[data-chart="severity"][data-value="critical"]').focus();await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>filters.severity),'critical');await page.locator('[data-action="clear-filters"]').click();
 // All role-visible screens must render without errors.
 for(const role of ['deputy','consultant','company','inspector','development','construction','expert','pmo','contracts','cto','admin1','admin2']){
  await page.evaluate(role=>{engine.logout();engine.login({company:'c01',expert:'expert1'}[role]||role,'demo123');view='dashboard';render()},role);
  const navs=await page.locator('.nav button').evaluateAll(bs=>bs.map(b=>b.dataset.id));
  for(const nav of navs){await page.locator(`.nav button[data-id="${nav}"]`).click();assert.equal(await page.locator('#main .error').count(),0,role+': '+nav)}
 }

 // Real UI round-trip: deputy → PMO → its expert → independent manager reply.
 await page.evaluate(()=>{engine.login('deputy','demo123');const c=engine.db.cases[0];engine.refer(c.id,c.findings[0].id,{to:'pmo',reason:'بررسی برنامه و منابع'});view='dashboard';render()});
 const enterTeam=async (manager,expert=null)=>{await page.locator('[data-action="logout"]').click();await page.locator('[data-action="login-group"][data-id="deputy"]').click();await page.locator(`[data-action="login-manager"][data-id="${manager}"]`).click();if(expert)await page.locator(`[data-action="login-account"][data-id="${expert}"]`).click();await page.locator('#login-form button[type=submit]').click();await page.locator('.nav [data-id="referrals"]').click()};
 await enterTeam('pmo');await page.locator('[data-action="delegate-referral"]').click();
 assert.equal(await page.locator('#modal [name=assignee] option').count(),1);
 await page.locator('#modal [name=reason]').fill('تحلیل انحراف برنامه توسط کارشناس');await page.locator('#modal-form button[type=submit]').click();
 await page.locator('[data-action="answer-referral"]').click();await page.locator('#modal [name=note]').fill('پاسخ زودهنگام مدیر');await page.locator('#modal-form button[type=submit]').click();assert.match(await page.locator('#form-error').innerText(),/پاسخ کارشناسان/);await page.locator('[data-action="close-modal"]').first().click();
 await enterTeam('pmo','expert-pmo');assert.equal(await page.locator('.nav [data-id="cases"]').count(),0);assert.equal(await page.locator('.nav [data-id="programs"]').count(),0);
 assert.match(await page.locator('#main').innerText(),/تحلیل انحراف برنامه توسط کارشناس/);assert.ok(!(await page.locator('#main').innerText()).includes('بررسی برنامه و منابع'));
 await page.locator('[data-action="answer-referral"]').click();await page.locator('#modal [name=note]').fill('نظر کارشناس درباره انحراف برنامه');await page.locator('#modal-form button[type=submit]').click();
 await enterTeam('pmo');assert.match(await page.locator('.subtask').innerText(),/نظر کارشناس درباره انحراف برنامه/);await page.locator('[data-action="answer-referral"]').click();await page.locator('#modal [name=note]').fill('جمع‌بندی مستقل مدیر کنترل پروژه');await page.locator('#modal-form button[type=submit]').click();
 assert.equal(await page.locator('[data-action="answer-referral"]').count(),0);
 await page.evaluate(()=>{engine.login('deputy','demo123');view='cases';render()});
 await page.locator('[data-action="open-case"]').first().click();await a11y('detail');
 const tabs=await page.locator('[data-action="detail-tab"]').evaluateAll(bs=>bs.map(b=>b.dataset.id));
 for(const tab of tabs){await page.locator(`[data-action="detail-tab"][data-id="${tab}"]`).click();assert.equal(await page.locator('#main .error').count(),0)}
 await page.locator('[data-action="advance"]').click();await page.locator('[name=decision]').fill('تصمیم آزمایشی مرورگر');await page.locator('[name=basis]').fill('بررسی شواهد مستقل');
 await page.locator('#modal-form button[type=submit]').click();assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
 await page.reload();await page.locator('[data-action="login-group"][data-id="deputy"]').click();await page.locator('#login-form button[type=submit]').click();
 assert.equal(await page.evaluate(()=>engine.db.cases[0].findings[0].deputyDecision.decision),'تصمیم آزمایشی مرورگر');
 // Persian CSV, proper extension and spreadsheet-injection escaping.
 const csvPromise=page.waitForEvent('download');await page.evaluate(()=>exportCsv());let dl=await csvPromise;
 assert.equal(dl.suggestedFilename(),'didban-cases.csv');await dl.saveAs(path.join(dir,'cases.csv'));assert.match(await fs.readFile(path.join(dir,'cases.csv'),'utf8'),/عنوان پرونده/);
 assert.match(await page.evaluate(()=>csvCell('=HYPERLINK("bad")')),/^"'/);
 await page.evaluate(()=>{engine.login('c01','demo123');view='cases';filters={};render()});
 const jsonPromise=page.waitForEvent('download');await page.evaluate(()=>exportJson());dl=await jsonPromise;await dl.saveAs(path.join(dir,'role.json'));
 const data=JSON.parse(await fs.readFile(path.join(dir,'role.json'),'utf8'));assert.equal(data.cases.length,1);assert.equal(data.cases[0].subsidiary,'C01');assert.ok(!JSON.stringify(data).includes('demo123'));
 // A newly created case must save successfully and preserve escaped user input.
 await page.evaluate(()=>{engine.login('consultant','demo123');view='dashboard';render()});await page.locator('[data-action="new-case"]').click();
 await page.locator('[name=title]').fill('<img src=x onerror=alert(1)>');await page.locator('#modal [name=project]').fill('آزمون ایجاد');await page.locator('[name=observation]').fill('واقعیت نمونه');await page.locator('#modal-form button[type=submit]').click();
 assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);assert.match(await page.locator('h1').innerText(),/<img/);assert.equal(await page.locator('#main img').count(),0);
 // Independent discipline reports: a filled presentation scenario, submission, and company read-only view.
 await page.locator('.nav [data-id="reports"]').click();await page.locator('[data-action="demo-reports"]').click();await page.locator('#modal-form button[type=submit]').click();
 assert.equal(await page.locator('.report-check').count(),3);assert.match(await page.locator('.report-origin').innerText(),/تطبیق با سه PDF ارسالی انجام نشده/);
 const reportId=await page.evaluate(()=>selectedReport);assert.equal(await page.evaluate(id=>engine.reports().find(r=>r.id===id).progress.actualProgress,reportId),58);
 await page.screenshot({path:path.join(dir,'discipline-report.png'),fullPage:true});
 await page.evaluate(id=>{engine.login('inspector','demo123');selectedReport=id;view='reports';render()},reportId);await page.locator('[data-action="edit-report"]').click();await page.locator('#modal [name=submit]').check();await page.locator('#modal-form button[type=submit]').click();
 assert.equal(await page.evaluate(id=>engine.reports().find(r=>r.id===id).status,reportId),'Submitted');assert.equal(await page.locator('[data-action="edit-report"]').count(),0);
 await page.evaluate(id=>{engine.login('c01','demo123');selectedReport=id;render()},reportId);assert.equal(await page.locator('.inspection-report').count(),1);assert.equal(await page.locator('[data-action="edit-report"]').count(),0);
 const reportDownload=page.waitForEvent('download');await page.locator('[data-action="export-report"]').click();dl=await reportDownload;await dl.saveAs(path.join(dir,'report.json'));
 const report=JSON.parse(await fs.readFile(path.join(dir,'report.json'),'utf8'));assert.equal(report.discipline,'سازه');assert.equal(report.subsidiary,'C01');assert.equal(report.demo,true);
 // Desktop, tablet and phone widths; no document overflow, navigation works.
 for(const width of [1440,820,390]){await page.setViewportSize({width,height:844});await page.evaluate(()=>{view='dashboard';render()});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow at '+width)}
 await page.locator('[data-action="menu"]').click();await page.locator('.nav [data-id="cases"]').click();assert.match(await page.locator('h1').innerText(),/پرونده/);
 await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});
 // Standalone download excludes current case data and stays usable under a new filename.
 await page.evaluate(()=>{view='help';render()});let standalonePromise=page.waitForEvent('download');await page.locator('[data-action="download-app"]').click();dl=await standalonePromise;
 assert.equal(dl.suggestedFilename(),'didban.html');const standalone=path.join(dir,'didban.html');await dl.saveAs(standalone);const saved=await fs.readFile(standalone,'utf8');assert.ok(!saved.includes('تصمیم آزمایشی مرورگر'));assert.ok(!saved.includes('آزمون ایجاد'));assert.match(saved,/<div id="app"><\/div>/);
 await context.setOffline(true);await page.goto(pathToFileURL(standalone).href);assert.equal(await page.locator('.rolecard').count(),5);await page.locator('[data-action="login-group"][data-id="deputy"]').click();await page.locator('#login-form button[type=submit]').click();assert.equal(await page.locator('.chart').count(),5);
 // Print styles keep content and hide navigation.
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('.sidebar').isVisible(),false);assert.equal(await page.locator('#main').isVisible(),true);
 assert.deepEqual(errors,[]);assert.deepEqual(remoteRequests,[]);
 console.log('PASS: role screens, forms, persistence, exports, SVG keyboard filters, offline self-download, responsive layout, print and a11y.');console.log('Temporary artifacts:',dir);
}finally{await browser.close()}
