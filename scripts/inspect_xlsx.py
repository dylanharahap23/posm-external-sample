#!/usr/bin/env python3
"""Dependency-free XLSX inventory and canonical preview for Panako source files."""
import csv, glob, json, os, re, zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

def col_ref(ref): return ''.join(c for c in ref if c.isalpha())

def read_sheet(z, target, shared):
    path = target if target.startswith('xl/') else 'xl/' + target
    root = ET.fromstring(z.read(path))
    rows = []
    for row in root.findall('.//m:sheetData/m:row', NS):
        values = {}
        for cell in row.findall('m:c', NS):
            value = cell.find('m:v', NS)
            text = '' if value is None else (value.text or '')
            if cell.attrib.get('t') == 's' and text:
                text = shared[int(text)]
            values[col_ref(cell.attrib['r'])] = text
        if values:
            rows.append((int(row.attrib['r']), values))
    return rows

def workbook_report(path):
    result = {'file': os.path.basename(path), 'sheets': [], 'canonical_preview': []}
    with zipfile.ZipFile(path) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            shared = [''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])) for si in root.findall('m:si', NS)]
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        rel_root = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rels = {x.attrib['Id']: x.attrib['Target'] for x in rel_root}
        for sheet in wb.find('m:sheets', NS):
            name = sheet.attrib['name']
            target = rels[sheet.attrib[f'{{{REL_NS}}}id']]
            rows = read_sheet(z, target, shared)
            header_idx = None
            headers = {}
            for idx, vals in rows[:15]:
                if 'Nama Toko' in vals.values() or 'STORE NAME' in vals.values() or 'ID Toko' in vals.values():
                    header_idx, headers = idx, vals
                    break
            records = []
            if header_idx is not None:
                for idx, vals in rows:
                    if idx > header_idx and any(v.strip() for v in vals.values()):
                        records.append({headers.get(k, k): v for k, v in vals.items() if v != ''})
            result['sheets'].append({
                'name': name,
                'rows_with_values': len(rows),
                'header_row': header_idx,
                'record_rows': len(records),
                'headers': list(headers.values()) if header_idx else [],
                'classification': 'record_sheet' if records else 'summary_or_template'
            })
            if records and len(result['canonical_preview']) < 8:
                for record in records[:8-len(result['canonical_preview'])]:
                    result['canonical_preview'].append({
                        'source_sheet': name,
                        'store_id': record.get('ID Toko', ''),
                        'store_name': record.get('STORE NAME', record.get('Nama Toko', '')),
                        'brand': record.get('BRAND', ''),
                        'tier': record.get('TIER', ''),
                        'channel': record.get('CHANNEL', ''),
                        'region': record.get('REGION', record.get('Region', '')),
                        'area': record.get('Area', ''),
                        'address': record.get('Alamat', record.get('Alamat Toko', '')),
                        'job_status': record.get('Job Status', record.get('Status Survey', '')),
                        'coordinates_raw': record.get('Long Lat', ''),
                    })
    return result

if __name__ == '__main__':
    reports = [workbook_report(p) for p in sorted(glob.glob('*.xlsx'))]
    with open('data_source_report.json', 'w', encoding='utf-8') as f:
        json.dump(reports, f, ensure_ascii=False, indent=2)
    print(json.dumps(reports, ensure_ascii=False, indent=2))
