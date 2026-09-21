#!/usr/bin/env python3
"""把 johan/world.geo.json 光栅化为等经纬度网格点，生成 assets/world-cells.json。
用法: python3 build_world_cells.py /tmp/countries.geo.json assets/world-cells.json
"""
import json, math, sys

src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/countries.geo.json'
dst = sys.argv[2] if len(sys.argv) > 2 else 'assets/world-cells.json'

gj = json.load(open(src))

iso3to2 = {
    "USA": "US", "CHN": "CN", "JPN": "JP", "SGP": "SG", "KOR": "KR", "DEU": "DE",
    "GBR": "GB", "NLD": "NL", "FRA": "FR", "CAN": "CA", "AUS": "AU", "IND": "IN",
    "BRA": "BR", "RUS": "RU", "ZAF": "ZA", "TWN": "TW", "ITA": "IT", "SWE": "SE",
    "CHE": "CH", "ESP": "ES", "POL": "PL", "FIN": "FI", "NOR": "NO", "DNK": "DK",
    "IRL": "IE", "AUT": "AT", "TUR": "TR", "ARE": "AE", "MYS": "MY", "THA": "TH",
    "VNM": "VN", "PHL": "PH", "IDN": "ID", "NZL": "NZ", "MEX": "MX", "ARG": "AR",
    "CHL": "CL", "COL": "CO", "PER": "PE", "EGY": "EG", "ISR": "IL", "SAU": "SA",
    "PRT": "PT", "GRC": "GR", "BEL": "BE", "CZE": "CZ", "HUN": "HU", "ROU": "RO",
    "UKR": "UA", "KAZ": "KZ", "PAK": "PK", "IRN": "IR", "IRQ": "IQ", "BGD": "BD",
    "LKA": "LK", "MMR": "MM", "KHM": "KH", "LAO": "LA", "NPL": "NP", "MNG": "MN",
    "PRK": "KP",
}

STEP = 1.25


def point_in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def point_in_feature(x, y, geom):
    t = geom['type']
    polys = [geom['coordinates']] if t == 'Polygon' else (geom['coordinates'] if t == 'MultiPolygon' else [])
    for poly in polys:
        if not point_in_ring(x, y, poly[0]):
            continue
        if any(point_in_ring(x, y, h) for h in poly[1:]):
            continue
        return True
    return False


cells = {}
for f in gj['features']:
    iso2 = iso3to2.get(f.get('id'))
    if not iso2:
        continue
    geom = f['geometry']
    if not geom:
        continue
    t = geom['type']
    if t == 'Polygon':
        polys = [geom['coordinates']]
    elif t == 'MultiPolygon':
        polys = geom['coordinates']
    else:
        continue
    flat = [pt for p in polys for pt in p[0]]
    minx = min(p[0] for p in flat); maxx = max(p[0] for p in flat)
    miny = min(p[1] for p in flat); maxy = max(p[1] for p in flat)
    for gy in range(int(math.floor(miny / STEP)), int(math.ceil(maxy / STEP)) + 1):
        y = gy * STEP + STEP / 2
        if y > 84 or y < -60:
            continue
        for gx in range(int(math.floor(minx / STEP)), int(math.ceil(maxx / STEP)) + 1):
            x = gx * STEP + STEP / 2
            if x > 180:
                x -= 360
            if x < -180:
                continue
            if (gx, gy) in cells:
                continue
            if point_in_feature(x, y, geom):
                cells[(gx, gy)] = iso2

# 网格抓不到的小区域，手动补点
extra = {'HK': [[114.17, 22.32]], 'MO': [[113.55, 22.20]], 'SG': [[103.85, 1.35]]}

out = {}
for (gx, gy), iso2 in cells.items():
    out.setdefault(iso2, []).append([gx, gy])
for iso2, pts in extra.items():
    for lon, lat in pts:
        gx = int(math.floor(lon / STEP)); gy = int(math.floor(lat / STEP))
        lst = out.setdefault(iso2, [])
        if [gx, gy] not in lst:
            lst.append([gx, gy])

for k in out:
    out[k].sort()

print('countries:', len(out), 'cells:', sum(len(v) for v in out.values()))
print('HK:', out.get('HK'), 'SG:', out.get('SG'), 'MO:', out.get('MO'))
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print('size bytes:', len(open(dst).read()))
