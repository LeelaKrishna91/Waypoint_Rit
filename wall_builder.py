import json
from shapely.geometry import Polygon, LineString, Point
import shapely.ops as ops
from functools import partial
import pyproj

raw_coords = [
    [80.04517942787868, 13.03747050944169],
    [80.04543346131385, 13.037396519025336],
    [80.04543869911623, 13.037427135752111],
    [80.04557130278579, 13.03752731734356],
    [80.04568235446357, 13.037657482254133],
    [80.04578646541194, 13.03787893149142],
    [80.04587541220235, 13.038261871883037],
    [80.04597611642913, 13.038524661118132],
    [80.0459617301101, 13.038745403859934],
    [80.04621529361657, 13.039232203222852],
    [80.04617403819765, 13.03994359494736],
    [80.0462400468682, 13.040232974047413],
    [80.0461462501471, 13.040932560732585],
    [80.04554107095794, 13.04136698114526],
    [80.04426700950825, 13.041273891121037],
    [80.0436936818553, 13.041273891121037],
    [80.04329553765149, 13.041118741002833],
    [80.04343886956559, 13.04048262449976],
    [80.04372763100929, 13.040403555114011],
    [80.04366460218915, 13.039886011785597],
    [80.04433090685399, 13.039675485376378],
    [80.04428588626797, 13.039140396612567],
    [80.04436692332229, 13.038964957421925],
    [80.04422285744909, 13.03854390285548],
    [80.04406332760226, 13.038202280046647],
    [80.04413175948304, 13.038062277844304],
    [80.0442275641156, 13.037935609116772],
    [80.04517942787868, 13.03747050944169]
]

entrance_point = Point(80.04520562488239, 13.037528246529249)

# Transform to meters (EPSG:3857) to perform accurate metric buffering
project = pyproj.Transformer.from_crs(pyproj.CRS('EPSG:4326'), pyproj.CRS('EPSG:3857'), always_xy=True).transform
project_back = pyproj.Transformer.from_crs(pyproj.CRS('EPSG:3857'), pyproj.CRS('EPSG:4326'), always_xy=True).transform

# Convert to shapely line
line = LineString(raw_coords)
line_meters = ops.transform(project, line)

# Entrance logic
entrance_meters = ops.transform(project, entrance_point)
entrance_proj_on_line = line_meters.project(entrance_meters)

# We want a hole. We can buffer a small point around entrance and subtract it from the wall
# 15 meter gap for the entrance
gap_circle = line_meters.interpolate(entrance_proj_on_line).buffer(15.0)

# Create the wall buffer (1.5 meters thick)
wall_polygon = line_meters.buffer(1.5, cap_style=2) # flat caps

# Subtract the gap
wall_with_gap = wall_polygon.difference(gap_circle)

# Convert back to WGS84 (Lat/Lng)
final_wall = ops.transform(project_back, wall_with_gap)

import json
from shapely.geometry import mapping
output = mapping(final_wall)
with open('wall_data.json', 'w') as f:
    json.dump(output, f)

print("Wall data generated successfully.")
