#!/usr/bin/env python
# -*- coding: utf-8 -*-


import geojson
import sys, codecs

# usage: renameGeojson.py oldkey=newkey oldkey=fid filename > filename

file = sys.argv[-1]

trans = dict(map(lambda arg:arg.split("="),sys.argv[1:-1]))

def rename(feature):
  global trans

  for property in feature["properties"].keys():
    key = trans.get(property, None)
    if key=="fid":
      feature["fid"] = feature["properties"][property]
      del feature["properties"][property]
    elif key:
      feature["properties"][key] = feature["properties"][property]
      if property=="fid":
        del feature["fid"]
      else:
        del feature["properties"][property]
    else:
      del feature["properties"][property]

  return feature

fd = codecs.open(file, "r", "utf-8")
data = geojson.loads(fd.read())
fd.close()

#geodata = [rename(feature) for feature in data["features"] if feature["geometry"]["type"] == "Polygon"]
geodata = [rename(feature) for feature in data["features"]]

print geojson.dumps(geojson.FeatureCollection(geodata))
  
