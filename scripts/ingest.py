"""Reproducible, dependency-free private workbook -> privacy-filtered canonical JSON."""
import re
import json
import uuid
import hashlib
import zipfile
import posixpath
import argparse
from pathlib import Path
from collections import Counter, defaultdict
import xml.etree.ElementTree as ET
from inspect_xlsx import NS, REL_NS, col_ref
from datetime import date, timedelta


def parse_date(raw, date1904=False):
    text = str(raw or '').strip()
    result = {'raw': text, 'value': None, 'status': 'missing' if not text else 'unparsed'}
    try:
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}',text):
            value = date.fromisoformat(text)
        elif re.fullmatch(r'\d+(?:\.0+)?',text):
            serial = int(float(text))
            if not date1904 and serial <= 60:
                return result
            value = (date(1904,1,1) if date1904 else date(1899,12,30)) + timedelta(days=serial)
        else:
            return result
        result.update(value=value.isoformat(), status='valid')
    except (ValueError,OverflowError):
        pass
    return result




def _rows(path, wanted=None):
    rows_out=[]
    with zipfile.ZipFile(path) as z:
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            root=ET.fromstring(z.read('xl/sharedStrings.xml'))
            shared=[''.join(t.text or '' for t in si.iter('{%s}t'%NS['m'])) for si in root.findall('m:si',NS)]
        wb=ET.fromstring(z.read('xl/workbook.xml'))
        rels={x.attrib['Id']:x.attrib['Target'] for x in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        for sh in wb.find('m:sheets',NS):
            name=sh.attrib['name']
            if wanted and name not in wanted: continue
            target=rels[sh.attrib[f'{{{REL_NS}}}id']]
            if not target.startswith('xl/'): target='xl/'+target
            root=ET.fromstring(z.read(target))
            raw=[]
            for row in root.findall('.//m:sheetData/m:row',NS):
                vals={}
                for c in row.findall('m:c',NS):
                    v=c.find('m:v',NS); text='' if v is None else (v.text or '')
                    if c.attrib.get('t')=='s' and text: text=shared[int(text)]
                    vals[col_ref(c.attrib['r'])]=text
                if vals: raw.append((int(row.attrib['r']),vals))
            header=None; headers={}
            for n,vals in raw[:10]:
                if 'ID Toko' in vals.values() or 'Nama Toko' in vals.values() or 'STORE NAME' in vals.values(): header=n; headers=vals; break
            if header:
                for n,vals in raw:
                    if n>header and any(str(v).strip() for v in vals.values()): rows_out.append((name,n,{headers.get(k,k):v for k,v in vals.items() if v!=''}))
    return rows_out


def _id(value): return str(uuid.uuid5(uuid.NAMESPACE_URL,'panako-intelligence:'+value))
def _source(file,sheet,row): return {'file':file,'sheet':sheet,'row':row}
def _coordinate_inventory(rows):
    c=Counter(parse_coordinates(r.get('Long Lat',''))['status'] for _,_,r in rows)
    return [{'status':k,'count':c[k]} for k in sorted(c)]

def build(root):
    root=Path(root); tracker=next(root.glob('Tracker*.xlsx')); master=next(root.glob('MASTER*.xlsx'))
    base=[x for x in _rows(tracker,{'Data Base'})]; all_tracker=_rows(tracker)
    stores={}; projects=[]; quarantine=[]
    for sheet,row,r in base:
        sid=str(r.get('ID Toko','')); src=_source(tracker.name,sheet,row)
        if not sid.strip():
            quarantine.append({'reason':'missing_store_id','source':src,'raw_identity':{'store_name':r.get('Nama Toko',''),'request_date':r.get('Request Date','')}}); continue
        coord=parse_coordinates(r.get('Long Lat','')); store=stores.setdefault(sid,{'id':_id('store|'+sid),'store_id':sid,'name':r.get('Nama Toko','') or None,'address':r.get('Alamat','') or None,'region':r.get('Region','') or None,'latitude':coord['latitude'],'longitude':coord['longitude'],'sources':[src]})
        if src not in store['sources']: store['sources'].append(src)
        d=parse_date(r.get('Request Date','')); key='|'.join([sid,str(r.get('Kode Pengajuan','')),d['value'] or d['raw'],str(row)])
        projects.append({'id':_id(key),'store_id':sid,'request_code':r.get('Kode Pengajuan') or None,'request_date':d['value'],'request_date_raw':d['raw'],'installation_date':parse_date(r.get('Installation Date',''))['value'],'installation_date_raw':r.get('Installation Date',''),'coordinates':coord,'production_status':r.get('Production Status') or None,'approval_status':r.get('Approval for Prod') or None,'request_type':r.get('Jenis Pengajuan') or None,'channel':r.get('Channel') or None,'region':r.get('Region') or None,'job_status':r.get('Job Status') or None,'source':src})
    alloc=[]
    for sheet,row,r in _rows(master,{'TOKO BATCH 1','TOKO BATCH 2'}):
        alloc.append({'id':_id('|'.join([master.name,sheet,str(row)])),'store_id':None,'store_name':r.get('STORE NAME') or None,'area':r.get('Area') or None,'items':{k:v for k,v in r.items() if k in ['Header','Divider','Divider Lighted','Diorama','Diorama Lighted','Framing','Deposit','Cashier','Category Sign','Pilar','Branding Eskalator','TG','TG Lighted','Billboard','Shopsign','Door Sticker','Wall Branding','Gate Branding','HEADER \nTIER 2','DIVIDER  \nTIER 2','DIORAMA \nTIER 2']},'stage':sheet.replace('TOKO ','').lower(),'brand':r.get('BRAND') or None,'tier':r.get('TIER') or None,'channel':r.get('CHANNEL') or None,'region':r.get('REGION') or None,'status_survey':r.get('Status Survey') or None,'source':_source(master.name,sheet,row)})
    status=Counter(p['job_status'] or '(blank)' for p in projects)
    comparisons=[]
    baseline_by_id=defaultdict(list)
    for _,n,r in base:
        if r.get('ID Toko'): baseline_by_id[r['ID Toko']].append((n,r))
    for sheet in sorted({s for s,_,_ in all_tracker if s!='Data Base'}):
        entries=[x for x in all_tracker if x[0]==sheet]
        differences=[]; matched=0; missing=0
        fields=['Nama Toko','Region','Job Status','Request Date','Kode Pengajuan','Long Lat','Installation Date','Production Status']
        for _,row,r in entries:
            sid=r.get('ID Toko','')
            candidates=baseline_by_id.get(sid,[])
            if not candidates:
                missing+=1; differences.append({'source':_source(tracker.name,sheet,row),'store_id':sid or None,'kind':'not_in_baseline' if sid else 'missing_store_id'}); continue
            # Exact request/date first; nearest field-match only for discrepancy comparison, never merging.
            _,best=min(candidates,key=lambda x:sum(x[1].get(f,'')!=r.get(f,'') for f in fields))
            changed=[f for f in fields if best.get(f,'')!=r.get(f,'')]
            if changed: differences.append({'source':_source(tracker.name,sheet,row),'store_id':sid,'kind':'field_difference','fields':changed})
            else: matched+=1
        comparisons.append({'sheet':sheet,'record_rows':len(entries),'matching_rows':matched,'nonbaseline_or_missing_id_rows':missing,'differences':differences})
    canonical_rows=[x for x in base if x[2].get('ID Toko','').strip()]
    inventory=[]
    for p in [tracker,master]:
        # Existing inspector supplies full sheet inventory; no raw personal fields exported.
        from inspect_xlsx import workbook_report
        report=workbook_report(p)
        private_headers={'PIC','PIC2','Owner/PIC Area','No. Telp','No. PIC'}
        for sheet in report['sheets']:
            sheet['headers']=[h for h in sheet.get('headers',[]) if h not in private_headers]
        inventory.append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'role':'authoritative_baseline' if p==tracker else 'comparison_allocation','sheets':report['sheets']})
    duplicates=[{'store_id':sid,'project_count':n} for sid,n in sorted(Counter(p['store_id'] for p in projects).items()) if n>1]
    return {'stores':list(stores.values()),'projects':projects,'allocations':alloc,'quality':{'counts':{'baseline_rows':len(base),'canonical_stores':len(stores),'canonical_projects':len(projects),'allocation_rows':len(alloc),'quarantined_rows':len(quarantine)},'status_counts':dict(sorted(status.items())),'coordinate_inventory':_coordinate_inventory(canonical_rows),'baseline_coordinate_inventory':_coordinate_inventory(base),'date_inventory':{field:dict(Counter(parse_date(r.get(field,''))['status'] for _,_,r in canonical_rows)) for field in ['Request Date','Installation Date','Tanggal PO ','Tanggal JO']},'duplicate_store_projects':duplicates,'quarantine':quarantine,'comparisons':comparisons,'notes':['Data Base is authoritative baseline; other tracker sheets are comparison-only.','TOKO BATCH 1/2 allocations are staged separately and do not create stores.','No market metrics or personal PIC/phone fields are fabricated or included.']},'imports':inventory}


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',default=Path(__file__).resolve().parents[1]); ap.add_argument('--out',default=None); a=ap.parse_args()
    out=Path(a.out or Path(a.root)/'data/canonical.json'); out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(build(a.root),ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8'); print(out)

def parse_coordinates(raw):
    text = str(raw or '').strip()
    result = {'raw': text, 'latitude': None, 'longitude': None, 'status': 'missing' if not text else 'invalid'}
    if not text:
        return result
    if '://' in text:
        result['status'] = 'unresolved_url'
        return result
    number = r'([+-]?\d+(?:\.\d+)?)'
    match = re.fullmatch(number + r'\s*([NS]?)\s*(?:,\s*|\s+)' + number + r'\s*([EW]?)', text, re.I)
    if not match:
        return result
    a, ns, b, ew = match.groups()
    a, b = float(a), float(b)
    if ns or ew:
        if (ns and a < 0) or (ew and b < 0):
            return result
        a *= -1 if ns.upper() == 'S' else 1
        b *= -1 if ew.upper() == 'W' else 1
        candidates = [(a,b,'lat_lon')]
    else:
        candidates = [(a,b,'lat_lon'),(b,a,'lon_lat')]
    valid = [(lat,lon,axis) for lat,lon,axis in candidates if -11 <= lat <= 6 and 95 <= lon <= 141]
    if len(valid) == 1:
        lat,lon,axis = valid[0]
        result.update(latitude=lat, longitude=lon, status='valid', axis=axis)
    return result


if __name__ == '__main__':
    main()
