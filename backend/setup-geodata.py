#!/usr/bin/env python3
"""Build compact GeoNames location data for the local demo backend."""
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile
import csv
import io
import json

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
DATA.mkdir(exist_ok=True)
SOURCES = {
    'countryInfo.txt': 'https://download.geonames.org/export/dump/countryInfo.txt',
    'admin1CodesASCII.txt': 'https://download.geonames.org/export/dump/admin1CodesASCII.txt',
    'admin2Codes.txt': 'https://download.geonames.org/export/dump/admin2Codes.txt',
    'cities500.zip': 'https://download.geonames.org/export/dump/cities500.zip',
    'postal.zip': 'https://download.geonames.org/export/zip/allCountries.zip',
    'barangays.json': 'https://raw.githubusercontent.com/aivangogh/ph-address/main/src/data/barangays.json',
    'municipalities.json': 'https://raw.githubusercontent.com/aivangogh/ph-address/main/src/data/municipalities.json',
}

def download(name, url):
    target = DATA / name
    if not target.exists():
        print(f'Downloading {name}...')
        target.write_bytes(urlopen(url, timeout=120).read())
    return target

def lines_from_zip(path):
    with ZipFile(path) as archive:
        member = archive.namelist()[0]
        return io.StringIO(archive.read(member).decode('utf-8', errors='replace'))

def main():
    country_path = download('countryInfo.txt', SOURCES['countryInfo.txt'])
    admin_path = download('admin1CodesASCII.txt', SOURCES['admin1CodesASCII.txt'])
    admin2_path = download('admin2Codes.txt', SOURCES['admin2Codes.txt'])
    cities_path = download('cities500.zip', SOURCES['cities500.zip'])
    postal_path = download('postal.zip', SOURCES['postal.zip'])
    barangay_path = download('barangays.json', SOURCES['barangays.json'])
    municipality_path = download('municipalities.json', SOURCES['municipalities.json'])

    countries = {}
    for row in csv.reader(country_path.read_text(encoding='utf-8').splitlines(), delimiter='\t'):
        if not row or row[0].startswith('#') or len(row) < 5: continue
        countries[row[0]] = row[4]

    regions = {}
    for row in csv.reader(admin_path.read_text(encoding='utf-8').splitlines(), delimiter='\t'):
        if len(row) >= 2 and '.' in row[0]:
            cc, code = row[0].split('.', 1)
            regions[f'{cc}.{code}'] = row[1]

    provinces = {}
    for row in csv.reader(admin2_path.read_text(encoding='utf-8').splitlines(), delimiter='\t'):
        if len(row) >= 2 and row[0].count('.') >= 2:
            cc, admin1, admin2 = row[0].split('.', 2)
            if cc == 'PH': provinces.setdefault(cc, []).append({'code': f'{admin1}.{admin2}', 'name': row[1].removeprefix('Province of ')})

    cities = {}
    with lines_from_zip(cities_path) as handle:
        for row in csv.reader(handle, delimiter='\t'):
            if len(row) < 15: continue
            cc, admin1, name = row[8], row[10], row[1]
            if cc not in countries: continue
            key = f'{cc}.{admin1}'
            cities.setdefault(key, {})[name] = int(row[14] or 0)

    postal = {}
    with lines_from_zip(postal_path) as handle:
        for row in csv.reader(handle, delimiter='\t'):
            if len(row) < 5: continue
            cc, code, place, admin1 = row[0], row[1], row[2], row[4]
            if cc in countries and code and place:
                key = f'{cc}.{admin1}.{place.casefold()}'
                postal.setdefault(key, []).append(code)

    municipalities = json.loads(municipality_path.read_text(encoding='utf-8'))
    barangays_by_city = {}
    city_names = {item['psgcCode']: item['name'] for item in municipalities}
    for item in json.loads(barangay_path.read_text(encoding='utf-8')):
        city = city_names.get(item['municipalCityCode'])
        if city: barangays_by_city.setdefault(city.casefold(), set()).add(item['name'])

    target = 'PH'
    output = {'countries': [{'code': target, 'name': countries[target]}], 'regions': {}, 'provinces': {target: provinces.get(target, [])}, 'cities': {}, 'postal': {}, 'barangays': {key: sorted(values, key=str.casefold) for key, values in barangays_by_city.items()}}
    for key, name in regions.items():
        if not key.startswith(f'{target}.'): continue
        output['regions'].setdefault(key.split('.')[0], []).append({'code': key.split('.', 1)[1], 'name': name})
    for cc in output['regions']:
        output['regions'][cc].sort(key=lambda item: item['name'])
    for key, values in cities.items():
        if not key.startswith(f'{target}.'): continue
        output['cities'][key] = [{'name': name, 'population': population} for name, population in sorted(values.items(), key=lambda item: (-item[1], item[0]))]
    for key, codes in postal.items():
        if not key.startswith(f'{target}.'): continue
        output['postal'][key] = sorted(set(codes))[:25]

    target = DATA / 'geodata.json'
    target.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Built {target} ({target.stat().st_size:,} bytes)')
    print(f"Countries: {len(output['countries'])}; regions: {sum(len(v) for v in output['regions'].values())}; city groups: {len(output['cities'])}; postal groups: {len(output['postal'])}")

if __name__ == '__main__': main()
