"""Compile the user's supplied transcription into JSON and the offline HTML.
Idempotent: updates static source constants only, never LocalStorage/report snapshots.
Run from any directory: python3 tools/build-source-data.py
"""
from pathlib import Path
import csv, json, re, hashlib
ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT/'docs/sources'
REV='transcription-1405-03-v2'

def tsv(path):return list(csv.DictReader(path.open(),delimiter='\t'))
def dumps(obj):return json.dumps(obj,ensure_ascii=False,separators=(',',':'))
old=tsv(ROOT/'tools/source-projects.tsv')
details=tsv(SRC/'project-details.tsv')
assert len(old)==len(details)==69
companies=['البرز','الوند','پردیس','تهران','جنوب','زاینده رود','شمال','شمال شرق','شمال غرب','گیلان','منطقه غرب','نوین پایدار']
projects=[]
for index,(r,d) in enumerate(zip(old,details),1):
 assert r['project']==d['project'] and index==int(d['row']), (index,r,d)
 for key in ['built','land','type','start','end']:r[key]=d[key]
 sub='C'+str(companies.index(r['company'])+1).zfill(2)
 p=dict(id=f'SRC-{sub}-{index:03}',subsidiary=sub,project=r['project'],executionStatus=None if r['status']=='-' else r['status'],projectType=r['type'],reportedBuiltArea=None if r['built']=='?' else int(r['built']),landArea=None if r['land']=='?' else int(r['land']),actualProgress=float(r['progress']),plannedProgress=None,verifiedProgress=None,actualStart=None if r['start']=='-' else r['start'],plannedFinish=None if r['end']=='-' else r['end'],source='user-transcription',sourceRevision=REV,sourcePage=int(r['page']),sourceRow=index if index<=37 else index-37,sourcePeriod='1405/03',fieldCoverage='تمام ستون‌های ارائه‌شده؛ فقط علامت نامشخص و مساحت مبهم خالی مانده‌اند.',areaParseMethod='manual-column-split-user-transcription',issues=[])
 if index==55:
  p['rawAreaFragment']='۹,۰۶۷,۹۲۱';p['issues'].append('دو مساحت از عبارت ۹,۰۶۷,۹۲۱ قابل تفکیک مطمئن نیست؛ هر دو خالی مانده‌اند.')
 if p['actualStart'] and p['actualStart']==p['plannedFinish']:p['issues'].append('شروع و پایان یکسان با پیشرفت ۹۹٫۲۲٪؛ نیازمند تطبیق، بدون اصلاح خودکار.')
 if p['executionStatus'] is None:p['issues'].append('وضعیت با علامت - در متن ثبت شده است.')
 if p['actualStart'] is None:p['issues'].append('تاریخ شروع با علامت - در متن ثبت شده است.')
 if p['plannedFinish'] is None:p['issues'].append('تاریخ پایان با علامت - در متن ثبت شده است.')
 projects.append(p)
with (ROOT/'tools/source-projects.tsv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(old[0]),delimiter='\t',lineterminator='\n');w.writeheader();w.writerows(old)
# Root section index is stable; source leaf text is stored separately and verbatim.
sections=[]
for line in (ROOT/'tools/source-checklist.txt').read_text().splitlines():
 if not line or line.startswith('#'):continue
 code,title,discipline,phase,count=line.split('|')
 sections.append(dict(code=code,title=title,discipline=discipline,phase=phase,knownLeafCount=int(count) if count else None,missing=code=='4-3'))
for code,title in [('6-1-1','تأسیسات الکتریکی؛ مستندات، آزمایش و تست'),('6-1-2','تأسیسات الکتریکی؛ منابع و تجهیزات')]:
 sections.append(dict(code=code,title=title,discipline='برق',phase='services',knownLeafCount=None,missing=False))
sections.sort(key=lambda x:list(map(int,x['code'].split('-'))))
items=[]
for path in [SRC/'checklist-transcription.txt',SRC/'checklist-architecture.txt',SRC/'checklist-services-management.txt']:
 parent=None;counter=0
 for line_no,line in enumerate(path.read_text().splitlines(),1):
  if not line or line.startswith('#'):continue
  if line.startswith('@'):
   parent,parent_title=line[1:].split('|',1);counter=0;continue
  if line.startswith('!'):
   code,title=line[1:].split('|',1);detail='missing' if code=='4-3' else 'heading-only';declared_parent=code.rsplit('-',1)[0];section_title=title
  else:
   assert parent
   counter+=1;code=parent+'-'+str(counter);title=line;detail='fragment' if parent=='10-7' and counter in [4,5,6,8,9,10] else 'leaf';declared_parent='5-6-3' if parent=='5-6-4' else parent;section_title=parent_title
  ancestors=[s for s in sections if code==s['code'] or code.startswith(s['code']+'-')]
  assert ancestors,code
  sec=max(ancestors,key=lambda s:len(s['code']))
  items.append(dict(code=code,title=title,sectionCode=sec['code'],parentCode=declared_parent,sectionTitle=section_title,discipline=sec['discipline'],phase=sec['phase'],detailLevel=detail,selectable=detail not in ['missing','fragment'],numberingIssue=code.startswith('5-6-4-'),sourceFile=path.name,sourceLine=line_no,sourceRevision=REV))
assert len({x['code'] for x in items})==len(items)
for sec in sections:
 xs=[x for x in items if x['sectionCode']==sec['code']]
 sec['importedLeafCount']=sum(x['detailLevel'] in ['leaf','fragment'] for x in xs)
 sec['leafTextImported']=sec['importedLeafCount']>0
 sec['hasGaps']=any(x['detailLevel']!='leaf' for x in xs)
 sec['detailLevel']='mixed' if sec['hasGaps'] and sec['leafTextImported'] else 'leaf' if sec['leafTextImported'] else 'heading-only'
 if sec['knownLeafCount'] is not None:assert sec['knownLeafCount']==sec['importedLeafCount'],sec
mandatory=[]
for i,r in enumerate(tsv(SRC/'mandatory-points.tsv'),1):
 mandatory.append(dict(id=f'MAND-{i:03}',idOrigin='internal-not-source-code',appendix=r['appendix'],discipline=r['discipline'],title=r['title'],grade=int(r['grade']),groups=list(map(int,r['groups'].split(','))),sourceRevision=REV))
assert len(mandatory)==36
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(SRC.iterdir()) if p.is_file()}
data=dict(revision=REV,provenance='User-supplied transcription; original PDFs not independently checked. Checklist text preserved with normalized heading/number encoding; no invented missing clauses.',projects=projects,checklist=sections,items=items,mandatoryPoints=mandatory,sourceFileHashes=manifest)
(ROOT/'docs/source-data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
path=ROOT/'docs/index.html';html=path.read_text()
constants={'SOURCE_PROJECTS':projects,'SOURCE_CHECKLIST':sections,'SOURCE_ITEMS':items,'SOURCE_MANDATORY':mandatory,'SOURCE_REVISION':REV}
for name,value in constants.items():
 line=f'const {name}='+dumps(value)+';'
 pattern=r'^const '+name+r'=.*;$'
 if re.search(pattern,html,re.M):html=re.sub(pattern,lambda _:line,html,count=1,flags=re.M)
 else:html=html.replace('const SOURCE_NOTICE=',line+'\nconst SOURCE_NOTICE=',1)
path.write_text(html)
print('Projects',len(projects),'sections',len(sections),'items',len(items),'detailed',sum(x['detailLevel']=='leaf' for x in items),'fragments',sum(x['detailLevel']=='fragment' for x in items),'heading-only',sum(x['detailLevel']=='heading-only' for x in items),'mandatory',len(mandatory))
