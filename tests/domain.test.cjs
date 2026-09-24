/* Run with: node --test tests/domain.test.cjs — no dependencies. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../docs/index.html'),'utf8');
const code=html.match(/<script id="domain">([\s\S]*?)<\/script>/)[1];
const ctx=vm.createContext({console,Intl,Date,crypto:require('node:crypto').webcrypto});
vm.runInContext(code+';globalThis.API={Engine,seed,STATES,STEP_NAMES,PHASES,parseJalali,jalali,addDays,addPersianMonths,sla,clone,SOURCE_PROJECTS,SOURCE_CHECKLIST,sourceClassification,sourceTier,sourceEligibility,sourceQuality,createMissionReport,SOURCE_ITEMS,SOURCE_MANDATORY,SOURCE_REVISION,sourceMandatoryRules,sourceMandatoryPlan,sourcePlanSummary,sourceValidatePoints};',ctx);
const {Engine,seed,parseJalali,jalali,addDays,addPersianMonths,sla,clone}=ctx.API;
const make=()=>new Engine(seed());
const as=(e,u)=>e.login(u,'demo123');
const doc={name:'evidence.pdf',type:'application/pdf',data:'data:application/pdf;base64,JVBERi0=',size:5};
function completeUserReport(e,pid){
 const original=e.db.inspectionReports.find(r=>r.programId===pid),inspector=original.inspector;
 as(e,inspector);e.configureReportScope(original.id,{codes:original.mandatoryReferral?.points.length?[]:['4-4-1'],phase:'structure',reason:'دامنه فونداسیون در مأموریت؛ سایر بندها خارج از این بازدید'});
 const r=e.reports().find(x=>x.id===original.id),sections=clone(r.sections);
 Object.assign(sections.identity,{visitDate:jalali(new Date()),reportedDate:jalali(new Date()),startTime:'۰۹:۰۰',endTime:'۱۰:۰۰'});sections.scope.measurements='اندازه‌گیری نمونه آزمایشی ۲۰';
 const row={...r.rows[0],reviewed:true,code:'NC-MJ',actionCode:'ACT-C',documentScore:2,assessmentLevel:0.5,location:'فونداسیون',observation:'مشاهده آزمایشی',evidence:'تصویر پیوست',acceptance:'معیار ۲۵',inspectorAnalysis:'تحلیل آزمایشی بر مبنای شواهد',directCause:'علت مستقیم پیشنهادی',rootCause:'فرضیه فرایندی؛ نیازمند بررسی',causeEvidence:'شواهد فرضی و بررسی تکمیلی',recommendation:'اصلاح',assignee:'مسئول اجرا'};
 e.saveSourceReport(r.id,{rows:[row],sections,summary:'گزارش تکمیل کاربر در آزمون',location:'فونداسیون',documents:[doc],documentCategory:'reviewedDocuments',attestation:true,submit:true});
 as(e,'consultant');e.reviewReportReceipt(r.id,{verdict:'Accepted',note:'کنترل کامل‌بودن فرم؛ نه نظر کارشناسی'});as(e,inspector);e.linkInspectionReport(r.id);return r.id;
}


test('Single-file HTML embeds fonts and scripts, no remote resources',()=>{
 assert.match(html,/@font-face/); assert.match(html,/data:font\/woff2;base64/);
 assert.doesNotMatch(html,/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/);
 assert.equal(ctx.API.STEP_NAMES.length,24);
 assert.equal(ctx.API.PHASES.reduce((s,x)=>s+x.days,0),87);
});
test('Persian dates: round trips, leap boundaries and six-month review',()=>{
 for(const date of ['1405/06/25','1405/01/01','1403/12/30','1405/11/04'])assert.equal(jalali(parseJalali(date)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)),date);
 assert.throws(()=>parseJalali('1405/12/30'));assert.throws(()=>parseJalali('1405/07/31'));assert.throws(()=>parseJalali('2026-09-16'));
 assert.equal(jalali(addPersianMonths(parseJalali('1405/06/31'),6)),'۱۴۰۵/۱۲/۲۹');
 assert.equal(jalali(addPersianMonths(parseJalali('1405/06/05'),6)),'۱۴۰۵/۱۲/۰۵');
});
test('Company isolation: reads, exports and unauthorized writes',()=>{
 const e=make();as(e,'c01');assert.equal(e.listCases().length,1);assert.equal(e.listCases()[0].subsidiary,'C01');
 const other=e.db.cases[1],own=e.db.cases[0];assert.throws(()=>e.viewCase(other.id));
 assert.throws(()=>e.companyAnalysis(other.id,other.findings[0].id,{fiveWhys:['1','2','3','4','5'],additionalRootCauses:'x'}));
 assert.throws(()=>e.advance(own.id,own.findings[0].id,{decision:'bad'}));
 assert.ok(e.viewCase(own.id).findings[0].expertOpinion);assert.ok(e.viewCase(own.id).findings[0].observation);
 const data=e.exportData();assert.equal(data.cases.length,1);assert.equal(data.inspectorApplications.length,0);
 assert.ok(!JSON.stringify(data).includes('demo123'));
});
test('All five expert disciplines and inspector assignments are scoped',()=>{
 const e=make();for(let i=1;i<=5;i++){as(e,'expert'+i);for(const c of e.listCases())for(const f of c.findings){assert.equal(f.discipline,e.user.discipline);assert.ok(!('deputyDecision'in f));assert.ok(!('companyResponse'in f));assert.ok(!('history'in f))}}
 as(e,'inspector');for(const c of e.listCases())for(const f of c.findings){assert.equal(f.inspector,'inspector');assert.ok(!('deputyDecision'in f))}
 const other=e.db.cases.find(c=>c.findings[0].inspector!=='inspector');assert.throws(()=>e.viewCase(other.id));
});
test('Consultant responsibility, CTO closed-only, administrative boundaries',()=>{
 const e=make();as(e,'consultant');assert.equal(e.listCases().length,11);assert.throws(()=>e.viewCase(e.db.cases[11].id));as(e,'consultant2');assert.equal(e.listCases().length,1);
 as(e,'cto');assert.equal(e.listCases().length,1);assert.equal(e.listCases()[0].status,'Closed');assert.throws(()=>e.closeCase(e.db.cases[0].id,'bad'));
 for(const u of ['pmo','admin1','admin2']){as(e,u);assert.equal(e.listCases().length,0);assert.throws(()=>e.viewCase(e.db.cases[0].id));}
 as(e,'admin2');assert.equal(e.applications().length,0);assert.equal(e.controls().length,0);assert.equal(e.lessons().length,0);assert.ok(!('detail'in e.audit()[0]));
});
test('Deputy opinion is separate, timestamped, and cannot be supplied by consultant',()=>{
 const e=make(),c=e.db.cases[0],f=c.findings[0];const original=clone(f.expertOpinion);as(e,'consultant');assert.throws(()=>e.advance(c.id,f.id,{decision:'bad'}));
 as(e,'deputy');e.advance(c.id,f.id,{decision:'الزام اصلاح',basis:'بررسی گزارش',deadline:jalali(addDays(7))});
 let current=e.db.cases[0].findings[0];assert.deepEqual(current.expertOpinion,original);assert.equal(current.deputyDecision.by,'deputy');assert.ok(current.deputyDecision.at);assert.equal(current.nextStep,14);
 assert.equal(e.db.audit.at(-1).before.findings[0].deputyDecision,null);assert.equal(e.db.audit.at(-1).after.findings[0].deputyDecision.by,'deputy');
});
test('All five closure gates independently reject, including dispute and missing decision',()=>{
 for(let gate=0;gate<5;gate++){const e=make();as(e,'deputy');const c=e.db.cases[10],f=c.findings[0];c.status='PendingEffectiveness';f.severity='major';
 if(gate===0)f.status='Verified';if(gate===1)f.verifications=[];if(gate===2)f.effectiveness=null;if(gate===3)f.deputyDecision=null;if(gate===4)c.dispute=true;
 const rev=e.db.revision;assert.throws(()=>e.closeCase(c.id,'بستن'));assert.equal(e.db.revision,rev);assert.notEqual(e.db.cases[10].status,'Closed');}
 const e=make();as(e,'deputy');e.db.cases[10].status='PendingEffectiveness';e.closeCase(e.db.cases[10].id,'احراز شروط');assert.equal(e.db.cases[10].status,'Closed');assert.throws(()=>e.closeCase(e.db.cases[10].id,'مجدد'));
});
test('Atomic rollback on quota errors and validation failures',()=>{
 let d=seed(),e=new Engine(d,()=>{throw Error('quota')});as(e,'deputy');assert.throws(()=>e.flags(d.cases[0].id,{note:'test',crisis:true}),/quota/);assert.deepEqual(e.db,d);
 e=make();as(e,'consultant');let before=clone(e.db);assert.throws(()=>e.advance(e.db.cases[6].id,e.db.cases[6].findings[0].id,{probability:'9',impact:'2'}));assert.deepEqual(e.db,before);
});
test('Verification conditional/rejected return to correction; ineffective returns to root cause',()=>{
 for(const result of ['ConditionalApproval','Rejected']){const e=make();as(e,'consultant');let c=e.db.cases[3],f=c.findings[0];e.advance(c.id,f.id,{verdict:result,documentary:true,field:true,note:'بازکاری'});assert.equal(f.nextStep,16);assert.equal(f.verifications.at(-1).result,result);assert.equal(f.actions[0].status,'InProgress');}
 for(const result of ['Partial','Ineffective']){const e=make();as(e,'deputy');let c=e.db.cases[4],f=c.findings[0];e.advance(c.id,f.id,{verdict:result,note:'عدم اثربخشی کامل',cross:'تطبیق دو گزارش'});assert.equal(f.nextStep,result==='Partial'?16:11);assert.equal(f.actions[0].status,'Ineffective');if(result==='Ineffective')assert.equal(f.companyAnalysis.confirmed,false)}
});
test('Fast Track: critical risk alert, one-third SLA, parallel company action',()=>{
 const e=make();as(e,'consultant');let c=e.db.cases[6],f=c.findings[0];e.advance(c.id,f.id,{probability:5,impact:5});assert.equal(c.priority,'critical');assert.equal(f.risk.score,25);assert.ok(e.db.notifications.length);assert.equal(sla(c,f).total,29);assert.equal(sla(c,f).days,10/3);
 as(e,'c07');f.nextStep=13;e.addAction(c.id,f.id,{title:'ایمن‌سازی فوری',assignee:'سرپرست کارگاه',deadline:jalali(addDays(1))});assert.equal(f.actions.length,1);
});
test('SLA clock does not restart on every step within a phase',()=>{
 const e=make();as(e,'consultant');const c=e.db.cases[6],f=c.findings[0],phase=f.phaseStartedAt;e.advance(c.id,f.id,{probability:2,impact:2});assert.equal(f.phaseStartedAt,phase);e.advance(c.id,f.id,{directCause:'روش اجرای نادرست'});assert.equal(f.phaseStartedAt,phase);
});
test('Referrals share only addressed content and gate final deputy decision',()=>{
 const e=make();as(e,'deputy');let c=e.db.cases[0],f=c.findings[0];e.refer(c.id,f.id,{to:'contracts',reason:'بررسی ضمانت قراردادی'});let rid=f.referrals[0].id;
 assert.throws(()=>e.advance(c.id,f.id,{decision:'x',basis:'x',deadline:jalali(addDays(3))}));
 as(e,'contracts');assert.equal(e.listCases().length,1);let pf=e.listCases()[0].findings[0];assert.ok(!('observation'in pf));assert.equal(pf.referrals.length,1);e.answerReferral(c.id,f.id,rid,'نظر حقوقی ثبت شد');
 as(e,'pmo');assert.throws(()=>e.answerReferral(c.id,f.id,rid,'bad'));assert.equal(e.listCases().length,0);
});
test('Inspector qualification requires consultant → CM → deputy → account admin',()=>{
 const e=make();as(e,'inspector');assert.throws(()=>e.introduce({}));as(e,'consultant');e.introduce({name:'بازرس جدید',discipline:'برق',license:'L1',recommendation:'صلاحیت احراز شد',documents:[doc]});const id=e.db.inspectorApplications.at(-1).id;
 as(e,'admin1');assert.throws(()=>e.reviewApplication(id,{note:'bad',username:'new',password:'abcdefgh'}));as(e,'construction');e.reviewApplication(id,{note:'شروع بررسی'});e.reviewApplication(id,{note:'تأیید تخصص'});as(e,'deputy');e.reviewApplication(id,{note:'تصویب صلاحیت'});as(e,'admin1');e.reviewApplication(id,{note:'صدور حساب',username:'new-inspector',password:'abcdefgh'});let a=e.db.inspectorApplications.at(-1);assert.equal(a.status,'Active');assert.equal(a.auditTrail.length,5);e.login('new-inspector','abcdefgh');assert.equal(e.user.role,'inspector');
 as(e,'admin1');e.reviewApplication(id,{note:'تعلیق',status:'Suspended'});assert.throws(()=>e.login('new-inspector','abcdefgh'));
});
test('Full 24-step cycle, mission rejection, multi-finding case gate, automatic audits',()=>{
 const e=make();as(e,'consultant');let id=e.createCase({title:'چرخه تست',project:'آزمایشی',subsidiary:'C01',discipline:'سازه',severity:'major',observation:'نمونه'}).id;
 let find=()=>e.db.cases.find(c=>c.id===id).findings[0],f=find(),fid=f.id;
 const next=(user,p)=>{as(e,user);e.advance(id,fid,p||{})};
 next('consultant',{applicationId:'Q-1'});next('construction');next('construction');assert.equal(find().nextStep,4);
 const issue=()=>{as(e,'consultant');e.proposeProgram(id,fid,{plannedDate:jalali(addDays(1)),plannedTime:'۰۹:۰۰',purpose:'بازدید',type:'surprise'});let pr=e.db.inspectionPrograms.at(-1);e.assignMandatoryInspectionPoint(pr.id,{sourceCode:'4-4-1',location:'فونداسیون آزمون'});as(e,'construction');e.reviewProgram(pr.id,{note:'تأیید',verdict:'approve'});return pr.id};
 let pid=issue();assert.equal(e.db.inspectionPrograms.at(-1).registeredBy,'system');next('inspector',{verdict:'reject',note:'تداخل زمانی'});assert.equal(find().nextStep,4);assert.equal(e.db.inspectionPrograms.find(p=>p.id===pid).status,'Rejected');issue();
 next('inspector',{verdict:'accept'});next('inspector',{note:'بازدید انجام شد'});completeUserReport(e,e.db.inspectionPrograms.at(-1).id);next('inspector',{reportMatchesField:true,observation:'مشاهده',location:'طبقه سوم',measured:'۲۰',acceptanceCriteria:'۲۵',documents:[doc]});next('inspector',{nonconformity:'مغایرت',requirementViolated:'مشخصات فنی',severity:'major'});
 next('consultant',{probability:3,impact:3});next('consultant',{directCause:'نقص اجرا'});
 as(e,'consultant');assert.throws(()=>e.advance(id,fid,{rootCause:'نقص کنترل'}));as(e,'c01');assert.throws(()=>e.companyAnalysis(id,fid,{fiveWhys:['1','2'],additionalRootCauses:'x'}));e.companyAnalysis(id,fid,{fiveWhys:['الف','ب','ج','د','ه'],additionalRootCauses:'ضعف آموزش'});
 next('consultant',{rootCause:'نبود کنترل پیش از اجرا'});next('consultant',{summary:'نظر مستقل',recommendedAction:'اصلاح',formal:true,technical:true,managerial:true});next('deputy',{decision:'انجام اصلاحات',basis:'گزارش‌ها',deadline:jalali(addDays(10))});next('deputy',{no:'TEST-1',subject:'ابلاغ'});next('c01',{summary:'پاسخ شرکت',presentation:'تحلیل شرکت به معاونت'});
 as(e,'c01');e.addAction(id,fid,{title:'اصلاح کار',assignee:'سرپرست',deadline:jalali(addDays(5))});let aid=find().actions[0].id;for(let i=0;i<3;i++)e.transitionAction(id,fid,aid,{note:'اجرای مرحله',documents:[doc]});assert.equal(find().actions[0].status,'Submitted');
 next('c01',{note:'اصلاح انجام شد'});next('c01',{note:'رویه اصلاح و آموزش انجام شد'});assert.equal(find().nextStep,18);issue();next('inspector',{note:'بازدید رفع نقص'});completeUserReport(e,e.db.inspectionPrograms.at(-1).id);next('consultant',{verdict:'FullApproval',documentary:true,field:true,note:'تأیید مستند و میدان'});next('deputy',{verdict:'Effective',note:'مؤثر',cross:'دو گزارش تطبیق شد'});next('development',{note:'تعمیم'});next('deputy');assert.equal(find().status,'FindingClosed');
 as(e,'consultant');e.addFinding(id,{discipline:'سازه',severity:'minor',observation:'یافته دوم'});as(e,'deputy');assert.throws(()=>e.closeCase(id,'بستن زودهنگام'));
 // Finish second finding via a controlled fixture to test aggregate closure independently.
 const c=e.db.cases.find(c=>c.id===id);c.findings[1]={...clone(c.findings[0]),id:'SECOND'};e.closeCase(id,'احراز شروط همه یافته‌ها');assert.equal(c.status,'Closed');assert.ok(e.db.audit.filter(a=>a.entityId===id).length>=30);
 as(e,'cto');assert.ok(e.listCases().some(c=>c.id===id));
});
test('Lessons use closed sources, six-month review, and safe distribution',()=>{
 const e=make();as(e,'development');e.addLesson({title:'کنترل اجرا',rootCausePattern:'ضعف کنترل',sourceFindings:['F-111'],lesson:'یادگیری',preventiveAction:'تعمیم'});let l=e.db.lessonsLearned.at(-1);assert.equal(l.status,'Draft');assert.equal(l.frequency,1);e.lessonAction(l.id,{});as(e,'c01');let visible=e.lessons().find(x=>x.id===l.id);assert.ok(visible);assert.ok(!('sourceFindings'in visible));assert.ok(!('affectedSubsidiaries'in visible));as(e,'development');e.lessonAction(l.id,{note:'اثربخشی تأیید شد'});assert.equal(l.reviews.length,1);
});
test('PMO loop and company deactivation preserve records',()=>{
 const e=make();as(e,'pmo');e.addControl({project:'تست',subsidiary:'C01',period:'۱۴۰۵/۰۶',plannedProgress:'۷۰',actualProgress:'۶۰',resources:'نیرو',supervisorReport:'گزارش ناظر'});let x=e.db.projectControls.at(-1);assert.equal(x.deviation,-10);as(e,'consultant');assert.ok(!e.controls().some(p=>p.id===x.id));as(e,'pmo');e.recontrol(x.id,{note:'کنترل مجدد',shared:true});as(e,'consultant');assert.ok(e.controls().some(p=>p.id===x.id));
 as(e,'cto');let count=e.db.cases.length;e.companyStatus('C01',{note:'توقف همکاری'});assert.equal(e.db.cases.length,count);assert.throws(()=>e.login('c01','demo123'));e.companyStatus('C01',{note:'فعال‌سازی'});e.login('c01','demo123');assert.equal(e.listCases().length,1);
});

test('Organization upgrade is additive, idempotent and preserves existing accounts and history',()=>{
 const original=seed();original.organizationVersion=1;original.users=original.users.filter(u=>!u.id.startsWith('expert-'));for(const u of original.users)if(u.role==='expert')delete u.managerRole;
 original.users.find(u=>u.id==='expert1').password='keep-me';original.users.find(u=>u.id==='expert2').active=false;
 const beforeCases=clone(original.cases),beforeAudit=clone(original.audit);const e=new Engine(original);
 assert.equal(e.db.users.find(u=>u.id==='expert1').managerRole,'construction');assert.equal(e.db.users.find(u=>u.id==='expert1').password,'keep-me');assert.equal(e.db.users.find(u=>u.id==='expert2').active,false);
 assert.equal(e.db.users.filter(u=>u.role==='expert').length,8);assert.equal(e.db.organizationVersion,3);assert.deepEqual(e.db.cases,beforeCases);assert.deepEqual(e.db.audit,beforeAudit);
 const again=new Engine(e.db);assert.deepEqual(again.db,e.db);
});

test('Each manager delegates only to their own experts; subordinate replies do not replace manager decisions',()=>{
 for(const [manager,expert]of [['construction','expert1'],['development','expert-development'],['pmo','expert-pmo'],['contracts','expert-contracts']]){
  const e=make();let cid=e.db.cases[0].id,fid=e.db.cases[0].findings[0].id;
  as(e,'deputy');e.refer(cid,fid,{to:manager,reason:'درخواست نظر مدیر'});const rid=e.db.cases[0].findings[0].referrals.at(-1).id;
  as(e,manager);assert.ok(e.team().some(u=>u.id===expert));assert.ok(e.team().every(u=>u.managerRole===manager));
  assert.throws(()=>e.delegateReferral(cid,fid,rid,{assignee:manager==='pmo'?'expert-contracts':'expert-pmo',reason:'غیرمجاز'}));
  e.delegateReferral(cid,fid,rid,{assignee:expert,reason:'شرح مجاز برای کارشناس'});
  const child=e.db.cases[0].findings[0].referrals.at(-1);assert.equal(child.parentId,rid);assert.equal(child.assignee,expert);
  assert.throws(()=>e.delegateReferral(cid,fid,rid,{assignee:expert,reason:'تکراری'}));assert.throws(()=>e.answerReferral(cid,fid,rid,'جمع‌بندی پیش از پاسخ'));
  as(e,manager==='pmo'?'expert-contracts':'expert-pmo');assert.equal(e.referrals().length,0);assert.throws(()=>e.answerReferral(cid,fid,child.id,'پاسخ غیرمجاز'));
  as(e,expert);assert.equal(e.referrals().length,1);assert.equal(e.referrals()[0].reason,'شرح مجاز برای کارشناس');assert.equal(e.referrals()[0].delegations.length,0);
  if(manager!=='construction'){assert.equal(e.listCases().length,0);assert.equal(e.programs().length,0);assert.equal(e.controls().length,0);assert.throws(()=>e.viewCase(cid));assert.equal(e.exportData().referrals.length,1);assert.ok(!JSON.stringify(e.exportData()).includes('درخواست نظر مدیر'));}
  e.answerReferral(cid,fid,child.id,'نظر مستقل کارشناس');assert.equal(e.db.cases[0].findings[0].referrals.find(r=>r.id===rid).status,'Requested');
  as(e,manager);assert.equal(e.referrals()[0].delegations[0].managerOpinion.note,'نظر مستقل کارشناس');e.answerReferral(cid,fid,rid,'جمع‌بندی مستقل مدیر');
  const parent=e.db.cases[0].findings[0].referrals.find(r=>r.id===rid);assert.equal(parent.managerOpinion.by,manager);assert.equal(parent.subNote.by,expert);assert.equal(parent.status,'Answered');
  as(e,'deputy');assert.equal(e.db.cases[0].findings[0].deputyDecision,null);e.advance(cid,fid,{decision:'تصمیم نهایی مستقل',basis:'بررسی پاسخ مدیر',deadline:jalali(addDays(3))});assert.equal(e.db.cases[0].findings[0].deputyDecision.by,'deputy');
 }
});

test('Delegation blocks other managers, inactive users, wrong disciplines and closed cases',()=>{
 const e=make(),cid=e.db.cases[0].id,fid=e.db.cases[0].findings[0].id;as(e,'deputy');e.refer(cid,fid,{to:'construction',reason:'بازبینی فنی'});let rid=e.db.cases[0].findings[0].referrals.at(-1).id;
 as(e,'pmo');assert.throws(()=>e.delegateReferral(cid,fid,rid,{assignee:'expert-pmo',reason:'بدون اختیار'}));
 as(e,'construction');assert.throws(()=>e.delegateReferral(cid,fid,rid,{assignee:'expert2',reason:'رشته نامرتبط'}));
 e.db.users.find(u=>u.id==='expert1').active=false;assert.throws(()=>e.delegateReferral(cid,fid,rid,{assignee:'expert1',reason:'غیرفعال'}));e.db.users.find(u=>u.id==='expert1').active=true;
 e.db.cases[0].status='Closed';assert.throws(()=>e.delegateReferral(cid,fid,rid,{assignee:'expert1',reason:'پرونده بسته'}));
});

test('Construction tracks direct outgoing work and only the named expert can respond',()=>{
 const e=make(),c=e.db.cases[0],f=c.findings[0];as(e,'construction');e.refer(c.id,f.id,{to:'expert',assignee:'expert1',reason:'کنترل تخصصی سازه'});
 const rid=e.db.cases[0].findings[0].referrals.at(-1).id;assert.equal(e.referrals()[0].outgoing,true);assert.equal(e.viewCase(c.id).findings[0].referrals[0].assignee,'expert1');assert.throws(()=>e.answerReferral(c.id,f.id,rid,'پاسخ به جای کارشناس'));
 as(e,'expert2');assert.equal(e.referrals().length,0);assert.throws(()=>e.answerReferral(c.id,f.id,rid,'رشته غیرمجاز'));as(e,'expert1');e.answerReferral(c.id,f.id,rid,'کنترل انجام شد');as(e,'construction');assert.equal(e.referrals()[0].managerOpinion.by,'expert1');assert.equal(e.referrals()[0].status,'Answered');
});

test('Requested manager identities and consultant-admin ownership migrate without credential or history loss',()=>{
 const db=seed();db.organizationVersion=2;
 const names={construction:'مهندس مهرنوش',development:'خانم مهندس یگانه',pmo:'مهندس گلبو',contracts:'خانم مهندس رنجبر زاده'};
 for(const role of Object.keys(names)){const u=db.users.find(u=>u.id===role);u.name='نام پیشین';u.password='preserved-password';}
 const admin=db.users.find(u=>u.id==='admin1');delete admin.managerRole;admin.password='admin-preserved';admin.active=false;
 db.audit.push({id:'old-manager-event',at:new Date().toISOString(),actor:'construction',actorName:'نام پیشین',role:'construction',event:'رویداد پیشین',entityId:db.cases[0].id});
 const beforeCases=clone(db.cases),beforeAudit=clone(db.audit),e=new Engine(db);
 for(const [role,name]of Object.entries(names)){const u=e.db.users.find(u=>u.id===role);assert.equal(u.name,name);assert.equal(u.password,'preserved-password');e.login(role,'preserved-password');assert.equal(e.user.name,name);}
 const upgraded=e.db.users.find(u=>u.id==='admin1');assert.equal(upgraded.name,'ادمین بازرسان مشاور');assert.equal(upgraded.managerRole,'consultant');assert.equal(upgraded.password,'admin-preserved');assert.equal(upgraded.active,false);assert.equal(e.db.organizationVersion,3);
 assert.deepEqual(e.db.cases,beforeCases);assert.deepEqual(e.db.audit,beforeAudit);assert.deepEqual(new Engine(e.db).db,e.db);
 const fresh=make();as(fresh,'admin1');assert.equal(fresh.user.managerRole,'consultant');assert.equal(fresh.listCases().length,0);assert.throws(()=>fresh.closeCase(fresh.db.cases[0].id,'بدون اختیار'));as(fresh,'consultant');assert.throws(()=>fresh.reviewApplication(fresh.db.inspectorApplications[0].id,{note:'بدون اختیار',status:'Suspended'}));
});

test('Discipline reports are mission-specific, seeded explicitly as demo and role scoped',()=>{
 const e=make(),r=e.db.inspectionReports;assert.ok(r.length>=4);const seen=new Set();for(const x of r){assert.ok(!seen.has(x.programId));seen.add(x.programId);let p=e.db.inspectionPrograms.find(p=>p.id===x.programId),ins=e.db.inspectors.find(i=>i.id===x.inspector);assert.equal(x.discipline,ins.discipline);assert.equal(x.project,p.project);assert.equal(x.subsidiary,p.subsidiary);assert.ok(x.rows.every(row=>row.discipline===x.discipline));assert.equal(x.demo,true);assert.equal(x.source,'general-demo-not-pdf');}
 for(const account of ['inspector','inspector3','inspector4','inspector5']){as(e,account);assert.ok(e.reports().every(r=>r.inspector===e.user.id&&r.discipline===e.user.discipline));}
 as(e,'c01');assert.ok(e.reports().length);assert.ok(e.reports().every(r=>r.subsidiary==='C01'&&r.status==='Submitted'));for(const account of ['pmo','contracts','admin1','admin2','expert-pmo']){as(e,account);assert.equal(e.reports().length,0);assert.equal(e.exportData().inspectionReports.length,0)} as(e,'development');assert.ok(e.reports().every(r=>r.status==='Submitted'));as(e,'cto');assert.ok(e.reports().every(r=>e.db.cases.find(c=>c.id===r.caseId).status==='Closed'));
});
test('Four-discipline presentation creates filled independent reports with correct project-progress snapshot',()=>{
 const e=make();as(e,'consultant');const before=clone(e.db.cases),result=e.createDemoReports();assert.equal(result.ids.length,4);assert.deepEqual(e.db.cases.slice(0,before.length),before);
 const reports=e.reports().filter(r=>result.ids.includes(r.id));assert.equal(new Set(reports.map(r=>r.discipline)).size,4);assert.equal(new Set(reports.map(r=>r.programId)).size,4);assert.equal(new Set(reports.map(r=>r.project)).size,1);
 for(const r of reports){assert.equal(r.progress.actualProgress,58);assert.equal(r.progress.plannedProgress,65);assert.equal(r.rows.length,3);assert.ok(r.rows.every(x=>x.phase===1&&x.observation&&x.evidence&&x.recommendation));assert.equal(r.status,'Draft');assert.equal(r.demoScenarioOwner,'consultant');}
 assert.throws(()=>e.createDemoReports());as(e,'c01');assert.ok(!e.reports().some(r=>result.ids.includes(r.id)));as(e,'deputy');assert.throws(()=>e.createDemoReports());
});
test('Reports reject cross-inspector edits, preserve history, and lock a submitted version',()=>{
 const e=make();as(e,'consultant');const ids=e.createDemoReports().ids;const r=e.db.inspectionReports.find(r=>ids.includes(r.id)&&r.discipline==='سازه');as(e,'inspector4');assert.throws(()=>e.fillReportDemo(r.id));as(e,'inspector');e.fillReportDemo(r.id);let own=e.reports().find(x=>x.id===r.id);assert.ok(own.history.length);const p={location:own.location,summary:own.summary,rows:own.rows,documents:[],submit:true};e.saveReport(r.id,p);assert.equal(e.db.inspectionReports.find(x=>x.id===r.id).status,'Submitted');assert.throws(()=>e.saveReport(r.id,p));as(e,'c01');assert.ok(e.reports().some(x=>x.id===r.id));
});
test('New missions get fresh reports; missing progress is never guessed and mismatched discipline is rejected',()=>{
 const e=make();as(e,'consultant');const cid=e.createCase({title:'پروژه جدید',project:'پروژه بدون داده پیشرفت',subsidiary:'C01',discipline:'سازه',severity:'minor'}).id;let c=e.db.cases.find(x=>x.id===cid),f=c.findings[0];e.advance(cid,f.id,{applicationId:'Q-1'});as(e,'construction');e.advance(cid,f.id,{});e.advance(cid,f.id,{});as(e,'consultant');e.proposeProgram(cid,f.id,{plannedDate:jalali(addDays(1)),plannedTime:'۱۰:۰۰',purpose:'بازدید جدید',type:'planned'});const pid=e.db.inspectionPrograms.at(-1).id;e.assignMandatoryInspectionPoint(pid,{sourceCode:'4-4-1',location:'محل بازدید'});
 e.db.inspectionPrograms.at(-1).discipline='برق';as(e,'construction');assert.throws(()=>e.reviewProgram(pid,{note:'بررسی',verdict:'approve'}));e.db.inspectionPrograms.find(p=>p.id===pid).discipline='سازه';e.reviewProgram(pid,{note:'تأیید منطبق',verdict:'approve'});const r=e.db.inspectionReports.find(r=>r.programId===pid);assert.ok(r);assert.ok(r.rows.length>0);assert.equal(r.progress.actualProgress,null);assert.equal(r.suggestedPhase,null);assert.equal(r.phaseConfirmed,false);assert.ok(r.rows.every(x=>x.code==='Z'&&!x.reviewed));assert.equal(r.summary,'');as(e,'inspector');assert.throws(()=>e.fillReportDemo(r.id));
});

test('Source registry retains 69 rows and never fabricates missing plan, dates or areas',()=>{
 const {SOURCE_PROJECTS:ps,SOURCE_CHECKLIST:cs}=ctx.API;
 const artifact=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/source-data.json'),'utf8'));
 assert.deepEqual(JSON.parse(JSON.stringify(ps)),artifact.projects);
 assert.deepEqual(JSON.parse(JSON.stringify(cs)),artifact.checklist);
 assert.equal(ps.length,69);assert.equal(new Set(ps.map(p=>p.id)).size,69);
 assert.equal(ps.filter(p=>p.sourcePage===1).length,37);
 assert.equal(ps.filter(p=>p.plannedProgress!==null||p.verifiedProgress!==null).length,0);
 assert.equal(ps.filter(p=>p.reportedBuiltArea!==null).length,68);
 const sample=ps.find(p=>p.project==='ویلایی افتخار رویان');
 assert.equal(sample.actualProgress,47.51);assert.equal(sample.reportedBuiltArea,34517);assert.equal(sample.landArea,21867);assert.equal(sample.actualStart,'1394/11/20');assert.equal(sample.plannedFinish,'1407/02/13');
 const north=ps.find(p=>p.project==='باران بلوک شمالی');assert.equal(north.actualProgress,58.23);assert.equal(north.reportedBuiltArea,3824);assert.equal(north.landArea,17550);
 const ambiguous=ps.find(p=>p.project.includes('گلشهر'));assert.equal(ambiguous.actualProgress,94.56);assert.equal(ambiguous.rawAreaFragment,'۹,۰۶۷,۹۲۱');assert.equal(ambiguous.landArea,null);
 const dates=ps.find(p=>p.project==='اقدام ملی ۲ زین');assert.equal(dates.actualStart,dates.plannedFinish);assert.ok(dates.issues.length);
 assert.equal(cs.length,56);assert.ok(cs.some(c=>c.leafTextImported===true));assert.ok(cs.find(c=>c.code==='4-3').missing);assert.ok(cs.filter(c=>c.code.startsWith('7-')).every(c=>c.detailLevel==='heading-only'));
});
test('All nine supervision groups, boundaries and coverage follow the retained instruction',()=>{
 const {sourceClassification:calc,sourceTier}=ctx.API;
 const complexity=[{blocks:1,floors:4,area:4999,quality:1},{blocks:4,floors:5,area:5000,quality:3},{blocks:6,floors:11,area:10001,quality:5}];
 const expected=[[2,4,4],[2,2,3],[1,3,4]];
 for(let m=0;m<3;m++)for(let c=0;c<3;c++){const value=[1,3,5][m],r=calc({...complexity[c],qms:value,experience:value,pastQuality:value});assert.equal(r.group,expected[m][c]);assert.equal(r.safetyCoverage,100);assert.equal(r.safetyVisitsPerMonth,r.group===4?2:1);assert.equal(r.handoverCoverage,100);assert.match(r.method,/فرض/);}
 assert.equal(sourceTier(2.49),'low');assert.equal(sourceTier(2.5),'medium');assert.equal(sourceTier(4),'medium');assert.equal(sourceTier(4.01),'high');
 const p={...complexity[1],qms:3,experience:3,pastQuality:3};
 assert.equal(calc({...p,area:10000}).complexity,3);assert.equal(calc({...p,area:10001}).complexity,3.5);
 assert.throws(()=>calc({...p,area:''}));assert.throws(()=>calc({...p,qms:2}));assert.throws(()=>calc({...p,blocks:1.5}));
 assert.equal(ctx.API.sourceEligibility({education:'master',experienceYears:10,licenseGrade:'senior'}).meetsRecordedEducation,true);
 assert.equal(ctx.API.sourceEligibility({education:'bachelor',experienceYears:14,licenseGrade:'senior'}).meetsRecordedEducation,false);
});
test('Source scenario binds four inspectors to the source project and preserves all old data',()=>{
 const e=make();as(e,'consultant');const before=clone(e.db),project=e.sourceProjects().find(p=>p.project==='ویلایی افتخار رویان');
 const result=e.createSourceDemoReports(project.id),reports=e.reports().filter(r=>result.ids.includes(r.id));assert.equal(reports.length,4);
 assert.deepEqual(e.db.projectControls,before.projectControls);assert.deepEqual(e.db.cases.slice(0,before.cases.length),before.cases);assert.deepEqual(e.db.inspectionReports.slice(0,before.inspectionReports.length),before.inspectionReports);
 for(const r of reports){assert.equal(r.schemaVersion,3);assert.equal(r.sourceProjectId,project.id);assert.equal(r.subsidiary,'C03');assert.equal(r.progress.actualProgress,47.51);assert.equal(r.progress.plannedProgress,null);assert.equal(r.progress.deviation,null);assert.equal(r.progress.verifiedProgress,null);assert.equal(r.phaseConfirmed,false);assert.ok(r.demo&&r.classification.demo);assert.ok(r.rows.length>0);assert.ok(r.rows.every(x=>x.discipline===r.discipline&&['leaf','heading-only'].includes(x.sourceDetail)));assert.equal(r.inspectorProfile.discipline,r.discipline);assert.ok(Object.hasOwn(r.sections,'physical'));}
 assert.throws(()=>e.createSourceDemoReports(project.id));assert.throws(()=>e.createSourceDemoReports(e.sourceProjects().find(p=>p.executionStatus==='توقف اجرا').id));
 as(e,'consultant2');assert.equal(e.reports().filter(r=>r.schemaVersion>=2).length,0);
 for(const u of ['admin1','admin2','expert-pmo','contracts','development']){as(e,u);assert.equal(e.sourceProjects().length,0);assert.equal(e.exportData().sourceProjects.length,0)}
 as(e,'c03');assert.equal(e.sourceProjects().length,6);assert.equal(e.reports().filter(r=>r.schemaVersion>=2).length,0);
 as(e,'inspector');assert.equal(e.sourceProjects().length,1);assert.equal(e.reports().filter(r=>r.schemaVersion>=2).length,1);
});
test('Source report scores, reasons, history, submit locking and no fabricated approvals',()=>{
 const e=make();as(e,'consultant');const project=e.sourceProjects().find(p=>p.project==='ویلایی افتخار رویان');const result=e.createSourceDemoReports(project.id);as(e,'inspector');let r=e.reports().find(r=>result.ids.includes(r.id));
 const c=e.db.cases.find(c=>c.id===r.caseId),step=c.findings[0].nextStep;const payload=()=>({rows:clone(r.rows),location:r.location,summary:r.summary,sections:clone(r.sections)});
 as(e,'inspector3');assert.throws(()=>e.saveSourceReport(r.id,payload()));as(e,'inspector');assert.throws(()=>e.fillReportDemo(r.id));
 let p=payload();p.rows[0].code='Z';p.rows[0].documentScore=null;p.rows[0].assessmentLevel=null;p.rows[0].reason='';assert.throws(()=>e.saveSourceReport(r.id,p),/دلیل/);
 p.rows[0].reason='دسترسی فراهم نبود';p.rows[0].documentScore=1;assert.throws(()=>e.saveSourceReport(r.id,p),/امتیاز/);
 p.rows[0].documentScore=null;p.rows[1].code='NA';p.rows[1].documentScore=null;p.rows[1].assessmentLevel=null;p.rows[1].reason='خارج از دامنه این مأموریت';e.saveSourceReport(r.id,p);
 r=e.reports().find(x=>x.id===r.id);let quality=ctx.API.sourceQuality(r.rows);assert.equal(quality.unvisited,1);assert.equal(quality.notApplicable,1);assert.equal(r.history.length,1);
 p=payload();p.rows[2].documentScore=6;assert.throws(()=>e.saveSourceReport(r.id,p));p=payload();p.rows[2].assessmentLevel=0; e.saveSourceReport(r.id,p);r=e.reports().find(x=>x.id===r.id);assert.equal(r.rows[2].assessmentLevel,0);
 p=payload();p.rows[2].code='MF';p.submit=true;e.saveSourceReport(r.id,p);r=e.reports().find(x=>x.id===r.id);assert.equal(r.status,'Submitted');assert.equal(r.submittedBy,'inspector');assert.ok(r.criticalVerificationDueAt);assert.ok(e.db.notifications.some(x=>x.caseId===c.id&&x.to==='deputy'));
 const after=e.db.cases.find(x=>x.id===c.id);assert.equal(after.halt,false);assert.equal(after.findings[0].nextStep,step);assert.equal(after.findings[0].deputyDecision,null);assert.throws(()=>e.saveSourceReport(r.id,p));
 as(e,'c03');assert.equal(e.reports().filter(r=>r.schemaVersion>=2).length,1);as(e,'c10');assert.equal(e.reports().filter(r=>r.schemaVersion>=2).length,0);
});
test('New source cases create fresh draft templates, cannot claim official completion, and validate stable identity',()=>{
 const e=make();as(e,'consultant');const p=e.sourceProjects().find(p=>p.project==='باران بلوک شمالی');const id=e.createCase({sourceProjectId:p.id,title:'بازرسی جدید',discipline:'مکانیک',severity:'minor',observation:'بررسی مقدماتی'}).id;
 const c=e.db.cases.find(c=>c.id===id);assert.equal(c.sourceProjectId,p.id);assert.equal(c.subsidiary,'C10');assert.equal(c.stage,1);
 const f=c.findings[0];f.inspector='inspector5';const mission={id:'SOURCE-NEW-PR',caseId:id,findingId:f.id,project:p.project,subsidiary:p.subsidiary,discipline:'مکانیک',inspector:'inspector5',status:'Accepted',plannedDate:new Date().toISOString()};e.db.inspectionPrograms.push(mission);const r=ctx.API.createMissionReport(e.db,mission,{});
 assert.equal(r.demo,false);assert.equal(r.progress.actualProgress,58.23);assert.equal(r.classification,null);assert.ok(r.rows.every(r=>r.code==='Z'&&r.documentScore===null));as(e,'inspector5');
 assert.throws(()=>e.saveSourceReport(r.id,{rows:clone(r.rows),location:'محدوده',summary:'پیش‌نویس',submit:true}),/تیک|دامنه|بندهای/);
 e.db.inspectionReports.find(x=>x.id===r.id).sourceProjectId='SRC-INVALID';assert.throws(()=>e.reportForWrite(r.id),/شناسه/);
});

test('Full transcription imports every supplied clause, preserves exact text, fragments and irregular numbering',()=>{
 const {SOURCE_ITEMS:items,SOURCE_MANDATORY:mandatory}=ctx.API;
 const artifact=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/source-data.json'),'utf8'));
 assert.deepEqual(JSON.parse(JSON.stringify(items)),artifact.items);assert.deepEqual(JSON.parse(JSON.stringify(mandatory)),artifact.mandatoryPoints);
 assert.equal(items.length,529);assert.equal(items.filter(x=>x.detailLevel==='leaf').length,492);assert.equal(items.filter(x=>x.detailLevel==='fragment').length,6);assert.equal(items.filter(x=>x.detailLevel==='heading-only').length,30);
 assert.equal(items.find(x=>x.code==='5-1-3-3').title,'جداسازی و مهار دیوار مطابق ضوابط پیوست ۶ استاندارد ۲۸۰۰');
 assert.match(items.find(x=>x.code==='6-1-3-10').title,/ماشین لباسشویی/);
 assert.equal(items.find(x=>x.code==='5-6-4-8').parentCode,'5-6-3');assert.ok(items.find(x=>x.code==='5-6-4-8').numberingIssue);
 assert.equal(items.find(x=>x.code==='10-7-10').title,'ارزیابی');assert.equal(items.find(x=>x.code==='10-7-10').selectable,false);
 assert.equal(items.find(x=>x.code==='4-3').selectable,false);assert.ok(!items.some(x=>/^4-3-/.test(x.code)));
 assert.equal(items.find(x=>x.code==='7-3-3').detailLevel,'heading-only');assert.ok(!items.some(x=>/^7-3-3-/.test(x.code)));
 for(const [file,hash] of Object.entries(artifact.sourceFileHashes))assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../docs/sources',file))).digest('hex'),hash);
});
test('All project fields are loaded, unknown source marks stay null, and dates are not silently repaired',()=>{
 const ps=ctx.API.SOURCE_PROJECTS;
 assert.ok(ps.every(p=>p.projectType!=='وارد نشده'));
 assert.equal(ps.filter(p=>p.actualStart==null).length,4);assert.equal(ps.filter(p=>p.plannedFinish==null).length,1);assert.equal(ps.filter(p=>p.executionStatus==null).length,2);
 for(const p of ps)for(const key of ['actualStart','plannedFinish'])if(p[key])assert.equal(jalali(parseJalali(p[key])).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)),p[key]);
 const a=ps.find(p=>p.project==='مرکز شهر آدینه - A');assert.equal(a.reportedBuiltArea,92223);assert.equal(a.landArea,77378);
 const b=ps.find(p=>p.project==='پاسار');assert.equal(b.actualProgress,0);assert.equal(b.actualStart,'1402/06/01');assert.equal(b.plannedFinish,'1407/02/31');assert.equal(b.projectType,'مالکی');
 assert.equal(ps.find(p=>p.project==='فردیس').projectType,'مدیریت پیمان');assert.equal(ps.find(p=>p.project==='هجیبود').plannedFinish,null);
});
test('Mandatory tables preserve source grades, all four groups and two distinct appendix T tables',()=>{
 const {SOURCE_MANDATORY:ps,sourceMandatoryRules:rules}=ctx.API;
 assert.equal(ps.length,36);assert.equal(new Set(ps.map(p=>p.id)).size,36);
 for(const [d,counts]of Object.entries({'معماری':[3,6,9,9],'مکانیک':[3,6,6,6],'برق':[4,6,6,6]}))for(let g=1;g<=4;g++)assert.equal(rules(d,g).length,counts[g-1]);
 assert.equal(rules('سازه',2).length,0);assert.equal(rules('سازه',1,true).length,10);assert.equal(rules('سازه',2,true).length,15);
 assert.equal(ps.filter(p=>p.appendix==='ت (ایمنی)').length,8);assert.equal(ps.filter(p=>p.appendix==='ت (مدیریت کیفیت)').length,7);
 assert.equal(ps.find(p=>p.title==='سیستم اتصال به زمین و صاعقه‌گیر').grade,2);assert.equal(ps.find(p=>p.title==='سیستم اعلام حریق').grade,1);
});
test('Mandatory quantities are never inferred; edits validate identity, scope, revisit reasons and independent history',()=>{
 const {sourceMandatoryPlan:plan,sourcePlanSummary:summary,sourceValidatePoints:validate}=ctx.API;
 const old=plan('معماری',1);assert.equal(old.length,3);assert.equal(summary(old).coverage,null);assert.ok(old.every(p=>p.total==null&&p.visited==null));
 const input=clone(old);input[0]={...input[0],total:10,visited:11,unit:'دیوار',locations:'بلوک الف'};assert.throws(()=>validate(old,input),/بیش/);
 input[0].visited=3;input[0].evidence='شاهد فرضی';assert.throws(()=>validate(old,input),/علت/);input[0].reason='دسترسی محدود';assert.throws(()=>validate(old,input),/مجدد/);input[0].revisitPlan='بازدید تکمیلی فرضی';
 for(let i=1;i<input.length;i++)input[i]={...input[i],total:0,visited:0,unit:'محل',reason:'عدم شمول فرضی'};
 const result=validate(old,input);assert.equal(summary(result).total,10);assert.equal(summary(result).visited,3);assert.equal(summary(result).unvisited,7);assert.equal(summary(result).coverage,30);assert.equal(old[0].total,null);
 assert.throws(()=>validate(old,input.slice(1)));input[0].planId='tampered';assert.throws(()=>validate(old,input));
 const e=make();as(e,'consultant');const p=e.sourceProjects().find(p=>p.project==='ویلایی افتخار رویان');const ids=e.createSourceDemoReports(p.id).ids;as(e,'inspector3');let r=e.reports().find(r=>ids.includes(r.id));assert.equal(r.mandatoryPoints.length,6);
 const changes=clone(r.mandatoryPoints);changes[0]={...changes[0],total:2,visited:1,unit:'دیوار',locations:'بلوک فرضی',reason:'دسترسی محدود',revisitPlan:'بازدید بعدی فرضی',evidence:'شاهد ساختگی'};
 e.saveSourceReport(r.id,{rows:clone(r.rows),location:r.location,summary:r.summary,mandatoryPoints:changes});r=e.reports().find(x=>x.id===r.id);assert.equal(r.mandatoryPoints[0].visited,1);assert.equal(r.history.at(-1).before.mandatoryPoints[0].visited,null);
 as(e,'consultant');assert.throws(()=>e.saveSourceReport(r.id,{mandatoryPoints:changes}));
});
test('A new source revision leaves older report snapshots untouched and permits a separate new scenario',()=>{
 const e=make();as(e,'consultant');const p=e.sourceProjects().find(p=>p.project==='ویلایی افتخار رویان');const ids=e.createSourceDemoReports(p.id).ids;
 for(const r of e.db.inspectionReports.filter(r=>ids.includes(r.id))){r.schemaVersion=2;r.sourceRevision='old-headings';r.source='user-transcription-headings-v1';r.sourceNotice='نسخه قدیمی؛ ریزبند وارد نشده';r.sourceProjectSnapshot.reportedBuiltArea=null;r.history.push({event:'قدیمی',at:'2026-09-01',by:'inspector',before:[]})}
 const before=clone(e.db.inspectionReports.filter(r=>ids.includes(r.id)));const migrated=new Engine(e.db);as(migrated,'consultant');assert.deepEqual(migrated.reports().filter(r=>ids.includes(r.id)),before);
 const newIds=migrated.createSourceDemoReports(p.id).ids;assert.equal(newIds.length,4);assert.deepEqual(migrated.reports().filter(r=>ids.includes(r.id)),before);assert.ok(migrated.reports().filter(r=>newIds.includes(r.id)).every(r=>r.schemaVersion===3&&r.sourceRevision===ctx.API.SOURCE_REVISION));
});

test('Scope and ticking are inspector-owned, discipline-scoped, and removed rows remain in history',()=>{
 const e=make();as(e,'consultant');const p=e.sourceProjects().find(x=>x.project==='ویلایی افتخار رویان'),ids=e.createSourceDemoReports(p.id).ids;
 const r=e.db.inspectionReports.find(x=>ids.includes(x.id)&&x.discipline==='سازه'),before=clone(r.rows);
 assert.throws(()=>e.configureReportScope(r.id,{codes:['4-4-1'],phase:'structure',reason:'x'}));as(e,'inspector3');assert.throws(()=>e.configureReportScope(r.id,{codes:['4-4-1'],phase:'structure',reason:'x'}));
 as(e,'inspector');assert.throws(()=>e.configureReportScope(r.id,{codes:['6-1-3-1'],phase:'structure',reason:'x'}));assert.throws(()=>e.configureReportScope(r.id,{codes:['4-3'],phase:'structure',reason:'x'}));
 e.configureReportScope(r.id,{codes:['4-4-1'],phase:'structure',reason:'فونداسیون در محدوده؛ سایر بندها خارج از دامنه این بازدید'});let own=e.reports().find(x=>x.id===r.id);assert.equal(own.rows.length,1);assert.equal(own.phaseConfirmed,true);assert.equal(own.excludedRows.length,before.length-1);assert.deepEqual(own.history.at(-1).before.rows,before);
 let payload={rows:clone(own.rows),location:own.location,summary:own.summary};payload.rows[0].reviewed=false;assert.throws(()=>e.saveSourceReport(r.id,{...payload,submit:true}),/تیک/);
 payload.rows[0].code='C';payload.rows[0].documentScore=null;payload.rows[0].assessmentLevel=null;payload.location='';payload.summary='';e.saveSourceReport(r.id,payload);own=e.reports().find(x=>x.id===r.id);assert.equal(own.status,'Draft');assert.equal(own.summary,'');
});
test('Completeness review and revision preserve sent versions and never impersonate consultant opinion or deputy decision',()=>{
 const e=make();as(e,'consultant');const project=e.sourceProjects().find(x=>x.project==='ویلایی افتخار رویان'),ids=e.createSourceDemoReports(project.id).ids;as(e,'inspector');let r=e.reports().find(x=>ids.includes(x.id));
 e.saveSourceReport(r.id,{rows:r.rows,location:r.location,summary:r.summary,submit:true});const f=e.db.cases.find(c=>c.id===r.caseId).findings[0];assert.equal(f.nextStep,7);assert.equal(f.expertOpinion,null);assert.equal(f.deputyDecision,null);
 assert.throws(()=>e.linkInspectionReport(r.id));assert.throws(()=>e.reviewReportReceipt(r.id,{verdict:'Accepted',note:'x'}));as(e,'consultant2');assert.throws(()=>e.reviewReportReceipt(r.id,{verdict:'Accepted',note:'x'}));as(e,'consultant');e.reviewReportReceipt(r.id,{verdict:'NeedsCorrection',note:'نشانی دقیق تکمیل شود'});const old=clone(e.db.inspectionReports.find(x=>x.id===r.id));
 assert.throws(()=>e.reviewReportReceipt(r.id,{verdict:'Accepted',note:'x'}));as(e,'inspector3');assert.throws(()=>e.reviseInspectionReport(r.id));as(e,'inspector');const id=e.reviseInspectionReport(r.id).id;
 assert.deepEqual(e.db.inspectionReports.find(x=>x.id===r.id),old);r=e.reports().find(x=>x.id===id);assert.equal(r.revisionNumber,2);assert.ok(r.rows.every(x=>!x.reviewed));assert.equal(r.receiptReview,null);assert.throws(()=>e.reviseInspectionReport(old.id));assert.throws(()=>e.configureReportScope(old.id,{codes:['4-4-1'],phase:'structure',reason:'x'}));
 e.saveSourceReport(id,{rows:r.rows.map(x=>({...x,reviewed:true})),location:r.location,summary:r.summary,submit:true});as(e,'consultant');e.reviewReportReceipt(id,{verdict:'Accepted',note:'کامل‌بودن فرم کنترل شد'});as(e,'inspector');e.linkInspectionReport(id);
 const linked=e.db.cases.find(c=>c.id===r.caseId).findings[0];assert.equal(linked.nextStep,7);assert.equal(linked.reportInputSource.reportId,id);assert.equal(linked.expertOpinion,null);assert.equal(linked.deputyDecision,null);assert.throws(()=>e.linkInspectionReport(id));assert.throws(()=>e.advance(r.caseId,r.findingId,{observation:'x',location:'x',measured:'x',acceptanceCriteria:'x',documents:[doc]}),/تطابق/);
});
test('User-entry forms require visit, confirmed scope, checked results, dates, evidence and attestation before sending',()=>{
 const e=make();as(e,'consultant');const cid=e.createCase({title:'فرم کاربر',project:'پروژه مستقل',subsidiary:'C02',discipline:'سازه',severity:'minor'}).id;const c=e.db.cases.find(x=>x.id===cid),f=c.findings[0];f.inspector='inspector';f.nextStep=7;
 const mission={id:'USER-FORM-MISSION',caseId:cid,findingId:f.id,project:c.project,subsidiary:c.subsidiary,discipline:'سازه',inspector:'inspector',status:'Accepted',plannedDate:new Date().toISOString()};e.db.inspectionPrograms.push(mission);let r=ctx.API.createMissionReport(e.db,mission,{});e.assignMandatoryInspectionPoint(mission.id,{sourceCode:'4-4-1',location:'بلوک یک'});as(e,'inspector');
 assert.equal(r.demo,false);assert.equal(r.progress.actualProgress,null);assert.equal(r.rawTemplateVerified,false);assert.equal(r.projectRecordId,c.projectRecordId);
 e.configureReportScope(r.id,{codes:['4-4-1'],phase:'structure',reason:'دامنه واقعی مأموریت'});r=e.reports().find(x=>x.id===r.id);const sections=clone(r.sections);Object.assign(sections.identity,{visitDate:jalali(new Date()),reportedDate:jalali(new Date()),startTime:'09:00',endTime:'10:00'});sections.scope.measurements='مشاهده کیفی';
 const payload={rows:r.rows.map(x=>({...x,reviewed:true,code:'Z',reason:'دسترسی فراهم نشد',revisitPlan:'بازدید تکمیلی در مأموریت بعد'})),location:'بلوک یک',summary:'بازدید محدود',sections,submit:true,attestation:true,documents:[doc],documentCategory:'reviewedDocuments'};
 assert.throws(()=>e.saveSourceReport(r.id,{...payload,attestation:false}),/مسئولیت/);assert.throws(()=>e.saveSourceReport(r.id,{...payload,documents:[]}),/شواهد/);assert.throws(()=>e.saveSourceReport(r.id,{...payload,rows:payload.rows.map(x=>({...x,revisitPlan:''}))}),/مجدد/);
 e.saveSourceReport(r.id,payload);assert.equal(e.reports().find(x=>x.id===r.id).status,'Submitted');assert.ok(e.db.notifications.some(x=>x.caseId===cid&&x.to==='consultant'));as(e,'c01');assert.equal(e.reports().some(x=>x.id===r.id),false);as(e,'c02');assert.equal(e.reports().some(x=>x.id===r.id),true);
});

test('Every assigned inspector can prepare a blank checklist from legacy locked reports without changing old snapshots',()=>{
 const e=make();
 for(const [user,pid]of [['inspector','PR-12'],['inspector3','PR-4'],['inspector4','PR-7'],['inspector5','PR-3']]){
  as(e,user);const old=clone(e.reports().find(r=>r.programId===pid)),c=e.db.cases.find(c=>c.id===old.caseId),f=clone(c.findings.find(f=>f.id===old.findingId)),mission=clone(e.db.inspectionPrograms.find(p=>p.id===pid));assert.equal(old.status,'Submitted');
  const id=e.prepareInspectorReport(pid).id;assert.notEqual(id,old.id);let r=e.reports().find(r=>r.id===id);assert.equal(r.status,'Draft');assert.equal(r.previousReportId,old.id);assert.equal(r.inspector,user);assert.equal(r.project,old.project);assert.equal(r.subsidiary,old.subsidiary);assert.equal(r.rows.length,0);assert.ok(r.rows.every(x=>!x.reviewed&&x.code==='Z'&&!x.observation&&!x.rootCause));assert.equal(r.formPurpose,pid==='PR-12'?'initial':'supplementary');
  assert.equal(e.prepareInspectorReport(pid).id,id);e.configureReportScope(id,{codes:[ctx.API.SOURCE_ITEMS.find(x=>x.selectable&&x.discipline===r.discipline).code],reason:'بند صریح از منبع'});r=e.reports().find(x=>x.id===id);const rows=clone(r.rows);Object.assign(rows[0],{inspectorAnalysis:'تحلیل بازرس',directCause:'علت مستقیم',rootCause:'فرضیه ریشه‌ای',causeEvidence:'شواهد یا بررسی لازم'});e.saveSourceReport(id,{rows,summary:'',location:''});r=e.reports().find(r=>r.id===id);assert.equal(r.rows[0].rootCause,'فرضیه ریشه‌ای');assert.equal(r.rows[0].inspectorAnalysis,'تحلیل بازرس');
  assert.deepEqual(e.db.inspectionReports.find(r=>r.id===old.id),old);assert.deepEqual(e.db.cases.find(c=>c.id===old.caseId).findings.find(x=>x.id===f.id),f);assert.deepEqual(e.db.inspectionPrograms.find(p=>p.id===pid),mission);
 }
 as(e,'consultant');assert.throws(()=>e.prepareInspectorReport('PR-12'));as(e,'inspector3');assert.throws(()=>e.prepareInspectorReport('PR-12'));as(e,'inspector');assert.throws(()=>e.prepareInspectorReport('PR-11'),/بسته/);
});
test('Supplementary analysis is sent, corrected and appended without replacing facts, root cause, opinion, decision or step',()=>{
 const e=make();as(e,'consultant');e.assignMandatoryInspectionPoint('PR-1',{sourceCode:'4-4-1',location:'محل بازدید تکمیلی'});as(e,'inspector');const id=e.prepareInspectorReport('PR-1').id;let r=e.reports().find(x=>x.id===id);const before=clone(e.db.cases.find(c=>c.id===r.caseId).findings.find(f=>f.id===r.findingId));
 e.configureReportScope(id,{codes:['4-4-1'],phase:'structure',reason:'دامنه گزارش تکمیلی'});r=e.reports().find(x=>x.id===id);const sections=clone(r.sections);Object.assign(sections.identity,{visitDate:jalali(new Date()),reportedDate:jalali(new Date()),startTime:'09:00',endTime:'10:00'});sections.scope.measurements='کنترل کیفی';const payload={rows:r.rows.map(x=>({...x,code:'NC-M',reviewed:true,actionCode:'ACT-C',documentScore:3,assessmentLevel:0.5,location:'محل',observation:'مشاهده',evidence:'پیوست',recommendation:'اصلاح',assignee:'مسئول اجرا',acceptance:'معیار',inspectorAnalysis:'تحلیل مستند',directCause:'علت مستقیم',rootCause:'علت ریشه‌ای هنوز احراز نشده',causeEvidence:'نیاز به بررسی سوابق کنترل'})),summary:'تحلیل تکمیلی',location:'محل',sections,attestation:true,documents:[doc],documentCategory:'reviewedDocuments',submit:true};
 assert.throws(()=>e.saveSourceReport(id,{...payload,rows:payload.rows.map(x=>({...x,inspectorAnalysis:''}))}),/تحلیل بازرس/);e.saveSourceReport(id,payload);assert.throws(()=>e.saveSourceReport(id,payload));assert.throws(()=>e.prepareInspectorReport('PR-1'),/قفل/);as(e,'consultant');e.reviewReportReceipt(id,{verdict:'NeedsCorrection',note:'تکمیل شواهد تحلیل'});as(e,'inspector');const revision=e.prepareInspectorReport('PR-1').id;r=e.reports().find(x=>x.id===revision);e.saveSourceReport(revision,{...payload,rows:r.rows.map(x=>({...x,reviewed:true})),documents:[]});as(e,'consultant');e.reviewReportReceipt(revision,{verdict:'Accepted',note:'کنترل کامل‌بودن'});as(e,'inspector');e.linkInspectionReport(revision);
 const f=clone(e.db.cases.find(c=>c.id===r.caseId).findings.find(f=>f.id===r.findingId));assert.equal(f.supplementaryReportSources.length,1);assert.equal(f.supplementaryReportSources[0].reportId,revision);delete f.supplementaryReportSources;assert.deepEqual(f,before);assert.equal(e.reports().find(x=>x.id===revision).workflowLink.kind,'supplementary');assert.throws(()=>e.linkInspectionReport(revision));
});

test('Only the responsible consultant assigns immutable source checklist points, including the same clause at two locations',()=>{
 const e=make();as(e,'inspector');assert.throws(()=>e.assignMandatoryInspectionPoint('PR-1',{sourceCode:'4-4-1',location:'بلوک الف'}));as(e,'consultant2');assert.throws(()=>e.assignMandatoryInspectionPoint('PR-1',{sourceCode:'4-4-1',location:'بلوک الف'}));as(e,'consultant');
 for(const sourceCode of ['invented','4-3','6-1-3-1'])assert.throws(()=>e.assignMandatoryInspectionPoint('PR-1',{sourceCode,location:'بلوک الف'}));
 const first=e.assignMandatoryInspectionPoint('PR-1',{sourceCode:'4-4-1',location:'بلوک الف',title:'عنوان جعلی'}).id;assert.throws(()=>e.assignMandatoryInspectionPoint('PR-1',{sourceCode:'4-4-1',location:'بلوک الف'}));const second=e.assignMandatoryInspectionPoint('PR-1',{sourceCode:'4-4-1',location:'بلوک ب'}).id;
 as(e,'inspector');const id=e.prepareInspectorReport('PR-1').id;let r=e.reports().find(x=>x.id===id);assert.equal(r.rows.length,2);assert.deepEqual(Array.from(r.rows,x=>x.mandatoryPointId),[first,second]);assert.ok(r.rows.every(x=>x.title===ctx.API.SOURCE_ITEMS.find(i=>i.code==='4-4-1').title));
 e.configureReportScope(id,{codes:[],reason:'فقط دو نقطه ارجاع‌شده'});r=e.reports().find(x=>x.id===id);assert.equal(r.rows.length,2);assert.throws(()=>e.saveSourceReport(id,{rows:r.rows.slice(1)}),/هویت/);assert.throws(()=>e.saveSourceReport(id,{rows:r.rows.map(x=>({...x,code:'NA',reason:'حذف نقطه'}))}),/اجباری/);
 assert.throws(()=>e.saveSourceReport(id,{rows:r.rows,additionalChecklistCode:'INVENTED'}));assert.throws(()=>e.saveSourceReport(id,{rows:r.rows,additionalChecklistCode:'6-1-3-1'}));e.saveSourceReport(id,{rows:r.rows,additionalChecklistCode:'4-4-2'});r=e.reports().find(x=>x.id===id);assert.equal(r.rows.length,3);assert.equal(r.rows[2].title,ctx.API.SOURCE_ITEMS.find(i=>i.code==='4-4-2').title);assert.equal(r.rows[2].mandatoryPointId,undefined);
 e.configureReportScope(id,{codes:[],reason:'کنارگذاشتن بند اختیاری؛ نقاط مشاور باقی است'});r=e.reports().find(x=>x.id===id);assert.equal(r.rows.length,2);assert.ok(r.excludedRows.some(x=>x.row.sourceCode==='4-4-2'));as(e,'consultant');const third=e.assignMandatoryInspectionPoint('PR-1',{sourceCode:'4-4-2',location:'بلوک پ'}).id;r=e.reports().find(x=>x.id===id);assert.ok(r.rows.some(x=>x.mandatoryPointId===third));assert.equal(r.scopeConfirmed,false);
});
test('Per-clause evidence is normalized, survives history and reload, and cannot be attached to another row',()=>{
 const e=make();as(e,'inspector');const id=e.prepareInspectorReport('PR-12').id;let r=e.reports().find(x=>x.id===id);assert.equal(r.rows.length,0);e.saveSourceReport(id,{rows:[],additionalChecklistCode:'4-4-1'});r=e.reports().find(x=>x.id===id);const oldRow=r.rows[0].id;
 e.saveSourceReport(id,{rows:r.rows.map(x=>({...x,observation:'مشاهده آزمایشی',documents:[{...doc,rowId:'OTHER',sourceCode:'FAKE',by:'consultant'}]})),additionalChecklistCode:'4-4-2'});r=e.reports().find(x=>x.id===id);assert.equal(r.documents.length,1);assert.equal(r.documents[0].rowId,oldRow);assert.equal(r.documents[0].sourceCode,'4-4-1');assert.equal(r.documents[0].by,'inspector');assert.notEqual(r.documents[0].id,doc.id);assert.equal(r.rows[0].observation,'مشاهده آزمایشی');
 assert.throws(()=>e.saveSourceReport(id,{rows:r.rows.map(x=>({...x,documents:[{...doc,size:600*1024}]}))}),/۵۰۰/);assert.throws(()=>e.saveSourceReport(id,{rows:r.rows.map(x=>({...x,documents:[{...doc,type:'text/html'}]}))}),/پیوست/);
 const restored=new Engine(e.db);as(restored,'inspector');assert.deepEqual(restored.reports().find(x=>x.id===id).documents,r.documents);as(restored,'inspector3');assert.throws(()=>restored.saveSourceReport(id,{rows:r.rows}));
});
test('Approval of a new four-discipline mission requires actual consultant referral, not the source activity matrix',()=>{
 const e=make();as(e,'consultant');const cid=e.createCase({title:'آزمون ارجاع',project:'پروژه ارجاع',subsidiary:'C01',discipline:'سازه',severity:'minor'}).id;const c=e.db.cases.find(c=>c.id===cid),f=c.findings[0];f.inspector='inspector';f.nextStep=4;e.proposeProgram(cid,f.id,{plannedDate:jalali(addDays(1)),plannedTime:'09:00',purpose:'هدف مشاور'});const pid=e.db.inspectionPrograms.at(-1).id;as(e,'construction');assert.throws(()=>e.reviewProgram(pid,{verdict:'approve',note:'بررسی'}),/نقطه اجباری/);as(e,'consultant');e.assignMandatoryInspectionPoint(pid,{sourceCode:'4-4-1',location:'فونداسیون بلوک یک'});as(e,'construction');e.reviewProgram(pid,{verdict:'approve',note:'بررسی با نقطه ارجاع‌شده'});const r=e.db.inspectionReports.find(r=>r.programId===pid);assert.equal(r.rows.length,1);assert.equal(r.rows[0].assignedLocation,'فونداسیون بلوک یک');assert.equal(r.rows[0].code,'Z');assert.equal(r.rows[0].reviewed,false);assert.equal(r.suggestedPhase,null);
});

test('Linked original and revisit reports cannot create a second primary form at the same workflow step',()=>{
 for(const revisit of [false,true]){
  const e=make();as(e,'consultant');const ids=e.createSourceDemoReports(e.sourceProjects().find(x=>x.project==='ویلایی افتخار رویان').id).ids;
  as(e,'inspector');const r=e.reports().find(x=>ids.includes(x.id)),pr=e.db.inspectionPrograms.find(p=>p.id===r.programId),f=e.db.cases.find(c=>c.id===r.caseId).findings.find(f=>f.id===r.findingId);
  if(revisit){pr.revisit=true;pr.status='Completed';f.nextStep=20;}
  e.saveSourceReport(r.id,{rows:r.rows,location:r.location,summary:r.summary,submit:true});as(e,'consultant');e.reviewReportReceipt(r.id,{verdict:'Accepted',note:'کنترل کامل‌بودن فرم'});as(e,'inspector');e.linkInspectionReport(r.id);
  const before=clone(e.db);assert.throws(()=>e.prepareInspectorReport(pr.id),/متصل/);assert.deepEqual(e.db,before);
  e.db.cases.find(c=>c.id===r.caseId).findings.find(f=>f.id===r.findingId).nextStep++;
  const additional=e.prepareInspectorReport(pr.id).id;assert.equal(e.reports().find(x=>x.id===additional).formPurpose,'supplementary');assert.notEqual(additional,r.id);
 }
});

test('Demo photo assets and UI are removed without deleting user documents or lessons',()=>{
 assert.doesNotMatch(html,/DEMO_PHOTO|demoPhoto|demoFindingPhoto|demoReportPhoto|demo-photo|demo-reference|commons\.wikimedia\.org/);
 assert.equal(fs.existsSync(path.join(__dirname,'../docs/demo-photos')),false);
 const e=make(),db=clone(e.db),image={name:'user-photo.png',type:'image/png',size:3,data:'data:image/png;base64,YWJj'};
 db.cases[0].findings[0].documents.push(image);
 const report=db.inspectionReports.find(r=>r.rows.length);
 report.rows[0].documents=report.rows[0].documents||[];report.rows[0].documents.push(image);
 const saved=clone(db),restored=new Engine(db);
 assert.deepEqual(restored.db,saved);
 assert.equal(restored.db.lessonsLearned.length,10);
 assert.match(html,/function checklistDocument\(/);
});

test('Deputy display name is Mohseni in fresh and saved data, without changing credentials or history',()=>{
 const e=make();as(e,'deputy');assert.equal(e.user.name,'مهندس محسنی');const db=clone(e.db),u=db.users.find(u=>u.id==='deputy');u.name='دکتر رضایی';u.password='saved-password';delete db.deputyNameVersion;const before={cases:clone(db.cases),audit:clone(db.audit),others:clone(db.users.filter(u=>u.id!=='deputy'))};
 const restored=new Engine(db);restored.login('deputy','saved-password');assert.equal(restored.user.name,'مهندس محسنی');assert.equal(restored.user.username,'deputy');assert.equal(restored.user.role,'deputy');assert.deepEqual(restored.db.cases,before.cases);assert.deepEqual(restored.db.audit,before.audit);assert.deepEqual(restored.db.users.filter(u=>u.id!=='deputy'),before.others);
 restored.db.users.find(u=>u.id==='deputy').name='نام ویرایش‌شده بعدی';const again=new Engine(restored.db);assert.equal(again.db.users.find(u=>u.id==='deputy').name,'نام ویرایش‌شده بعدی');
});

test('The root-cause lesson bank starts with ten items without fabricating closed cases or observed frequencies',()=>{
 const e=make();as(e,'development');const lessons=e.lessons();assert.equal(lessons.length,10);assert.equal(e.db.cases.length,12);assert.equal(e.db.cases.flatMap(c=>c.findings).filter(f=>f.status==='FindingClosed').length,1);
 const learning=lessons.filter(l=>l.sourceType==='educational-root-cause');assert.equal(learning.length,9);assert.ok(learning.every(l=>l.demo&&l.createdBy==='system'&&l.frequency===null&&l.sourceFindings.length===0&&l.affectedProjects.length===0&&l.sourceRootCauses.length===0));assert.ok(lessons.every(l=>l.rootCausePattern&&l.lesson&&l.preventiveAction&&l.effectivenessCriterion));
 const linked=lessons.find(l=>l.id==='LL-1');assert.equal(linked.sourceRootCauses[0].findingId,'F-111');assert.equal(linked.sourceRootCauses[0].rootCause,e.db.cases.flatMap(c=>c.findings).find(f=>f.id==='F-111').rootCause);assert.equal(linked.rootCauseBasis,'closed-finding');as(e,'c01');assert.equal(e.lessons().length,10);assert.ok(e.lessons().every(l=>!Object.hasOwn(l,'sourceRootCauses')));as(e,'admin1');assert.equal(e.lessons().length,0);
});
test('Lesson upgrade fills to ten once, preserves custom lessons and all case, account and audit history',()=>{
 const db=seed();db.lessonsLearned=db.lessonsLearned.filter(l=>l.id==='LL-1');const custom=clone(db.lessonsLearned[0]);custom.id='USER-LESSON';custom.title='درس اختصاصی محفوظ';custom.reviews=[{at:new Date().toISOString(),note:'سابقه کاربر'}];db.lessonsLearned.push(custom);delete db.rootCauseLessonsVersion;db.users[0].password='preserve-password';const before=clone(db);let e=new Engine(db);
 assert.equal(e.db.lessonsLearned.length,10);assert.deepEqual(e.db.lessonsLearned.slice(0,2),before.lessonsLearned);assert.deepEqual(e.db.cases,before.cases);assert.deepEqual(e.db.users,before.users);assert.deepEqual(e.db.audit.slice(0,before.audit.length),before.audit);assert.equal(e.db.audit.length,before.audit.length+1);
 const once=clone(e.db);e=new Engine(e.db);assert.deepEqual(e.db,once);
 const full=clone(once);delete full.rootCauseLessonsVersion;full.lessonsLearned.push({...clone(custom),id:'USER-EXTRA'});const count=full.lessonsLearned.length;e=new Engine(full);assert.equal(e.db.lessonsLearned.length,count);assert.deepEqual(clone(e.db.lessonsLearned),clone(full.lessonsLearned));
});
test('Lessons snapshot exact root causes, reject partial/open/duplicate source selection, and keep source identities private',()=>{
 const e=make();as(e,'development');const f=e.db.cases.flatMap(c=>c.findings).find(f=>f.id==='F-111');f.rootCause='نبود کنترل نظام‌مند آموزش پیمانکار';f.directCause='علت مستقیم متفاوت';const roots=e.lessonSources();assert.equal(roots.length,1);assert.equal(roots[0].rootCause,f.rootCause);
 const p={title:'درس ریشه‌ای',rootCausePattern:'ضعف سازوکار عمومی آموزش',sourceFindings:['F-111'],lesson:'ارزیابی نیاز آموزش',preventiveAction:'کنترل مهارت پیش از اجرا',effectivenessCriterion:'پایش تکرار خطا پس از آموزش'};
 for(const ids of [[],['F-111','F-101'],['F-111','missing'],['F-111','F-111']])assert.throws(()=>e.addLesson({...p,sourceFindings:ids}));const id=e.addLesson(p).id;let l=e.db.lessonsLearned.find(l=>l.id===id),snapshot=clone(l.sourceRootCauses);assert.equal(snapshot[0].rootCause,'نبود کنترل نظام‌مند آموزش پیمانکار');assert.notEqual(snapshot[0].rootCause,f.directCause);
 e.db.cases.flatMap(c=>c.findings).find(f=>f.id==='F-111').rootCause='علت تازه';assert.deepEqual(clone(l.sourceRootCauses),snapshot);assert.throws(()=>e.lessonAction(id,{}),/تغییر/);e.db.cases.flatMap(c=>c.findings).find(f=>f.id==='F-111').rootCause=snapshot[0].rootCause;e.lessonAction(id,{});
 for(const role of ['c01','consultant','inspector','contracts','pmo','expert1']){as(e,role);const visible=e.lessons().find(l=>l.id===id);assert.equal(visible.rootCausePattern,p.rootCausePattern);for(const k of ['sourceRootCauses','sourceFindings','affectedProjects','affectedSubsidiaries'])assert.ok(!Object.hasOwn(visible,k));assert.throws(()=>e.lessonSources())}as(e,'deputy');assert.deepEqual(e.lessons().find(l=>l.id===id).sourceRootCauses,snapshot);
});
