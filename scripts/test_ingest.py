import unittest
import importlib.util
from pathlib import Path

class CoordinateTests(unittest.TestCase):
    def test_coordinate_parser(self):
        spec = importlib.util.find_spec('ingest')
        self.assertIsNotNone(spec, 'canonical ingestion module must exist')
        import ingest
        for raw, expected in [('98.6031841 3.4924546',(3.4924546,98.6031841)),('3.628068,98.662602',(3.628068,98.662602)),('-6.2,106.8',(-6.2,106.8)),('6.1721511S 106.4726214',(-6.1721511,106.4726214))]:
            with self.subTest(raw=raw):
                p=ingest.parse_coordinates(raw)
                self.assertEqual((p['latitude'],p['longitude']),expected)
        for raw in ['106.8--6.2','101.511499-1.499371','104781957, -2.971586','https://maps.app.goo.gl/abcd','0,0','NaN,106','-12,106','6.5,106','-6,142','1,2,3','`-6.2,106.8']:
            with self.subTest(raw=raw):
                self.assertIsNone(ingest.parse_coordinates(raw)['latitude'])

class DateTests(unittest.TestCase):
    def test_strict_dates(self):
        import ingest
        self.assertTrue(hasattr(ingest,'parse_date'), 'strict date parser required')
        for raw, expected in [('46290','2026-09-25'),('2026-10-01','2026-10-01'),('19-Aug',None),('1-Oct-26',None),('01/02/2026',None),('2026-02-30',None),('60',None),('',None)]:
            with self.subTest(raw=raw):
                p=ingest.parse_date(raw)
                self.assertEqual(p['value'],expected)
                self.assertEqual(p['raw'],raw)

class PipelineTests(unittest.TestCase):
    def test_real_workbooks_integrity_and_determinism(self):
        import ingest, json
        from collections import Counter
        self.assertTrue(hasattr(ingest,'build'), 'end-to-end canonical builder required')
        root=Path(__file__).resolve().parents[1]
        result=ingest.build(root)
        self.assertEqual(set(result),{'stores','projects','allocations','quality','imports'})
        self.assertEqual(result,ingest.build(root))
        self.assertTrue(all('id' in s and 'sources' in s for s in result['stores']))
        self.assertEqual(len(result['stores']),249)
        self.assertEqual(len(result['projects']),262)
        self.assertEqual(len({p['id'] for p in result['projects']}),262)
        self.assertEqual(len({s['store_id'] for s in result['stores']}),249)
        self.assertIn('102-0002682',{s['store_id'] for s in result['stores']})
        self.assertEqual(result['quality']['counts']['baseline_rows'],263)
        self.assertEqual(len(result['quality']['quarantine']),1)
        self.assertEqual(result['quality']['quarantine'][0]['source']['row'],260)
        self.assertGreater(len(result['allocations']),400)
        self.assertEqual({a['source']['sheet'] for a in result['allocations']},{'TOKO BATCH 1','TOKO BATCH 2'})
        self.assertTrue(all(a['store_id'] is None for a in result['allocations']))
        self.assertTrue(all('store_name' in a and 'items' in a for a in result['allocations']))
        self.assertTrue(all('installation_date_raw' in p and 'coordinates' in p and 'request_code' in p for p in result['projects']))
        self.assertEqual(sum(x['count'] for x in result['quality']['coordinate_inventory']),262)
        self.assertEqual(len(result['imports']),2)
        for p in result['projects']:
            self.assertEqual(p['source']['sheet'],'Data Base')
            self.assertIn(p['store_id'],{s['store_id'] for s in result['stores']})
        self.assertTrue(all(-11<=s['latitude']<=6 and 95<=s['longitude']<=141 for s in result['stores'] if s['latitude'] is not None))
        for forbidden in ['Owner/PIC Area','No. Telp','No. PIC','PIC2','phone','contact_name']:
            self.assertNotIn('"'+forbidden+'":',json.dumps(result))
        self.assertEqual(sum(result['quality']['status_counts'].values()),262)
        self.assertGreater(len(result['quality']['comparisons']),5)

if __name__=='__main__': unittest.main()
