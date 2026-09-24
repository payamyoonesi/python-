"""One-time integration of source metadata and version-2 sample reporting.
The saved TSV and checklist are limited retained fields, not full PDF extractions.
Do not rerun on an integrated file; the guard fails before modifying it.
"""
import csv,json,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
path=root/'docs/index.html';html=path.read_text()
assert 'const SOURCE_PROJECTS=' not in html, 'Already integrated; edit embedded source blocks directly.'
companies=['البرز','الوند','پردیس','تهران','جنوب','زاینده رود','شمال','شمال شرق','شمال غرب','گیلان','منطقه غرب','نوین پایدار']
projects=[]
for i,r in enumerate(csv.DictReader((root/'tools/source-projects.tsv').open(),delimiter='\t'),1):
 sub='C'+str(companies.index(r['company'])+1).zfill(2)
 full=r['project'] in ['ویلایی افتخار رویان','باران بلوک شمالی']
 p=dict(id=f'SRC-{sub}-{i:03}',subsidiary=sub,project=r['project'],executionStatus=None if r['status']=='-' else r['status'],projectType=r['type'] if full else 'وارد نشده',reportedBuiltArea=int(r['built']) if full else None,landArea=int(r['land']) if full else None,actualProgress=float(r['progress']),plannedProgress=None,verifiedProgress=None,actualStart=None if r['start']=='-' else r['start'],plannedFinish=None if r['end']=='-' else r['end'],source='user-transcription-retained-fields',sourcePage=int(r['page']),sourcePeriod='1405/03',fieldCoverage='نام، وضعیت و درصد؛ سایر جزئیات فقط در صورت حفظ‌شدن',issues=[])
 if not full:p['issues'].append('مساحت و سایر جزئیات کامل این ردیف در این ورود داده وارد نشده‌اند؛ صفر فرض نشده است.')
 if 'گلشهر' in r['project']:p['rawAreaFragment']='۹,۰۶۷,۹۲۱';p['issues'].append('عبارت مساحت ۹,۰۶۷,۹۲۱ قابل تفکیک مطمئن نیست.')
 if r['project']=='اقدام ملی ۲ زین':p['issues'].append('شروع و پایان هر دو ۱۴۰۴/۱۲/۰۵ با پیشرفت ۹۹٫۲۲٪؛ نیازمند بررسی، بدون اصلاح خودکار.')
 if not p['executionStatus']:p['issues'].append('وضعیت در متن نامشخص است.')
 projects.append(p)
checklist=[]
for line in (root/'tools/source-checklist.txt').read_text().splitlines():
 if not line or line.startswith('#'):continue
 code,title,discipline,phase,count=line.split('|')
 checklist.append(dict(code=code,title=title,discipline=discipline,phase=phase,knownLeafCount=int(count) if count else None,detailLevel='heading-only',leafTextImported=False,missing=code=='4-3'))
data={'provenance':'Retained user transcription, original PDFs not independently verified; incomplete import, not a verbatim archive.','projects':projects,'checklist':checklist}
(root/'docs/source-data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
constants='const SOURCE_PROJECTS='+json.dumps(projects,ensure_ascii=False,separators=(',',':'))+';\nconst SOURCE_CHECKLIST='+json.dumps(checklist,ensure_ascii=False,separators=(',',':'))+';\n'
html=html.replace('class Engine{',constants+(root/'tools/source-domain.js').read_text()+'\nclass Engine{',1)
# Hook new reports only. Existing report contents and old provenance stay untouched.
needle='const{c,ins}=reportContext(db,p),progress=reportProgress(db,p);'
html=html.replace(needle,"if(db.cases.find(c=>c.id===p.caseId)?.sourceProjectId)return makeSourceReport(db,p,{filled,submitted});"+needle,1)
html=html.replace("saveReport(id,p){const x=", "saveReport(id,p){if(this.db.inspectionReports.find(r=>r.id===id)?.schemaVersion===2)return this.saveSourceReport(id,p);const x=",1)
html=html.replace("fillReportDemo(id){const x=this.reportForWrite(id);", "fillReportDemo(id){const x=this.reportForWrite(id);if(x.r.schemaVersion===2)throw Error('گزارش منبع را با نمونه عمومی جایگزین نکنید.');",1)
html=html.replace("if(r.findingId!==p.findingId||", "if(r.schemaVersion===2&&(r.sourceProjectId!==c.sourceProjectId||!SOURCE_PROJECTS.some(x=>x.id===r.sourceProjectId&&x.subsidiary===r.subsidiary&&x.project===r.project)))throw Error('مغایرت شناسه پروژه منبع.');if(r.findingId!==p.findingId||",1)
# Derive a separate, isolated demo builder; never rewrite generic reports.
start=html.index('createDemoReports(){');end=html.index('\n',start)
demo=html[start:end]
demo=demo.replace('createDemoReports(){','createSourceDemoReports(projectId){')
demo=demo.replace("'demo-inspection-reports'", "'demo-source-reports'")
demo=demo.replace("r.demoScenarioOwner===this.user.id", "r.sourceScenarioOwner===this.user.id&&r.sourceProjectId===projectId")
demo=demo.replace("const company=this.db.companies.find(c=>c.status==='Active');", "const sourceProject=this.sourceProjects().find(p=>p.id===projectId&&p.executionStatus==='در حال اجرا');if(!sourceProject)throw Error('پروژه فعال منبع را انتخاب کنید.');const company=this.db.companies.find(c=>c.code===sourceProject.subsidiary&&c.status==='Active');")
demo=demo.replace("const project='پروژه نمایشی چهاررشته‌ای — '+this.user.name;", "const project=sourceProject.project;")
a=demo.index('this.db.projectControls.push(');b=demo.index('const ids=[];',a)
demo=demo[:a]+demo[b:]
demo=demo.replace("title:'سناریوی نمایشی '+d,project", "title:'نمونه منبع '+d,sourceProjectId:sourceProject.id,project")
demo=demo.replace("pmData:'پیشرفت واقعی نمایشی ۵۸٪ در برابر برنامه ۶۵٪'", "pmData:'درصد اعلامی متن ارسالی: '+sourceProject.actualProgress+'؛ فاقد برنامه'")
demo=demo.replace("lessonsLearned:'چک‌لیست عمومی؛ تطبیق PDF انجام نشده'", "lessonsLearned:'سرفصل‌های متن کاربر؛ ریزمتن بندها وارد نشده'")
demo=demo.replace('r.demoScenarioOwner=this.user.id','r.sourceScenarioOwner=this.user.id')
methods=(root/'tools/source-methods.js').read_text()+demo+'\n'
html=html.replace('exportData(){return{',methods+'\nexportData(){return{sourceProjects:this.sourceProjects(),',1)
# Optional source ID in a new case; original free-entry flow still works.
needle="return this.transaction('ایجاد پرونده',id,()=>{"
html=html.replace(needle,needle+"let sourceProject=null;if(p.sourceProjectId){sourceProject=this.sourceProjects().find(x=>x.id===p.sourceProjectId&&x.executionStatus==='در حال اجرا');if(!sourceProject)throw Error('پروژه منبع مجاز و فعال نیست.');p={...p,project:sourceProject.project,subsidiary:sourceProject.subsidiary};}",1)
html=html.replace("let c={id,title:needed(p.title,'عنوان'),project:","let c={id,...(sourceProject?{sourceProjectId:sourceProject.id}:{}),title:needed(p.title,'عنوان'),project:",1)
# Screens and controls.
ui=(root/'tools/source-ui.js').read_text()
html=html.replace('function reportsPage(){',ui+'\nfunction reportsPage(){',1)
html=html.replace("const reports=engine.reports(),r=reports.find(r=>r.id===selectedReport);const note=", "const reports=engine.reports(),r=reports.find(r=>r.id===selectedReport);if(r?.schemaVersion===2)return sourceReportPage(r);const note=",1)
html=html.replace('این بخش با نمونه‌های عمومی تکمیل شده است؛ تطبیق با سه PDF ارسالی انجام نشده.', 'گزارش‌های قدیمی این بخش عمومی‌اند؛ تطبیق با سه PDF ارسالی انجام نشده. گزارش‌های جدید با نشان نسخه عملیاتی، از اطلاعات متن کاربر استفاده می‌کنند.',1)
html=html.replace("btn('ساخت سناریوی ارائه چهاررشته‌ای','demo-reports','','')", "btn('نمونه از پروژه‌های خرداد ۱۴۰۵','source-demo','','')+btn('سناریوی عمومی قبلی','demo-reports','','light')",1)
html=html.replace("${r.demoScenarioOwner?'سناریوی ارائه جدید':'مأموریت موجود'}", "${r.schemaVersion===2?'نسخه عملیاتی — سرفصل منبع':r.demoScenarioOwner?'سناریوی ارائه جدید':'مأموریت موجود'}",1)
html=html.replace("if(!r)throw Error('گزارش در محدوده شما نیست.');modal('ویرایش", "if(!r)throw Error('گزارش در محدوده شما نیست.');if(r.schemaVersion===2)return editSourceReportModal(r);modal('ویرایش",1)
html=html.replace("const NAV=[", "const NAV=[['source-projects','پروژه‌های خرداد ۱۴۰۵','building'],['source-reference','منابع و ضوابط','book'],",1)
html=html.replace("if(['dashboard','workflow','help'].includes(v))", "if(v==='source-projects')return ['deputy','consultant','construction','pmo','company','cto','inspector'].includes(r)||isTechnicalExpert(engine.user);if(v==='source-reference')return !['admin1','admin2'].includes(r);if(['dashboard','workflow','help'].includes(v))",1)
html=html.replace('({dashboard:dashboard,', "({'source-projects':sourceProjectPage,'source-reference':sourceReferencePage,dashboard:dashboard,",1)
html=html.replace("const ACTIONS={", "const ACTIONS={\n'source-demo':el=>sourceDemoModal(el?.dataset?.id),'source-classify':classificationModal,'source-case':el=>{const p=engine.sourceProjects().find(x=>x.id===el.dataset.id);if(!p)throw Error('پروژه مجاز نیست.');modal('پرونده مستقل — '+esc(p.project),field('عنوان پرونده','title')+select('رشته','discipline',REPORT_DISCIPLINES)+select('شدت اولیه','severity',[['minor','جزئی'],['major','مهم'],['critical','بحرانی']])+area('شرح اولیه','observation'),v=>{const result=engine.createCase({...v,sourceProjectId:p.id});selectedCase=result.id;selectedFinding=null;view='detail';detailTab='flow'})},\n",1)
html=html.replace("txt(value||'ثبت نشده')", "txt(value==null||value===''?'ثبت نشده':value)",1)
# Delegated search handler, no network dependencies.
html=html.replace('function sourceProjectPage(){', "document.addEventListener('submit',e=>{if(e.target.id==='source-search'){e.preventDefault();sourceQuery=new FormData(e.target).get('query')||'';render()}});\nfunction sourceProjectPage(){",1)
css='''\n.source-report-head{display:flex;justify-content:space-between;gap:20px;background:#173f54;color:#fff;border-radius:16px;padding:26px;margin-bottom:20px}.source-report-head h2{color:#fff;font-size:26px;margin:10px 0}.source-report-head b{font-size:32px}.source-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.source-stat-grid>div{background:#f0f6f5;border:1px solid #d6e4df;border-radius:12px;padding:18px}.source-stat-grid strong{display:block;color:#204f4b;font-size:21px;margin-top:10px}.source-stat-grid small{font-size:11px}.source-meter{width:110px;height:5px;border-radius:5px;background:#e5ece9;margin:8px 0}.source-meter i{display:block;height:100%;border-radius:5px;background:#468476}.source-report details{margin:16px 0}.source-report summary{cursor:pointer;font-weight:600;color:#315165}.source-report li{margin:7px 0}.source-report .report-check{border-right:4px solid #619c8e}.source-report dd{overflow-wrap:anywhere}#source-search label{flex:1}.source-report .keygrid{grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:700px){.source-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.source-report-head{padding:16px}.source-report-head h2{font-size:20px}.source-report .keygrid{grid-template-columns:1fr}.source-stat-grid strong{font-size:16px}}@media print{.source-report-head{background:#eaf1f3!important;color:#163e50!important}.source-report-head h2{color:#163e50!important}.source-report details> *{display:block}.source-report .report-check{break-inside:avoid}.source-stat-grid{grid-template-columns:repeat(4,1fr)}}\n'''
html=html.replace('</style>',css+'</style>',1)
path.write_text(html)
print(f'Integrated {len(projects)} project names/status/progress, {len(checklist)} headings and version-2 sample R-O reports.')
