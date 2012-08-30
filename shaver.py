#!/usr/bin/env python

import psycopg2 as db
import re
import os
import sys
import simplejson
from geojson import *
from math import pow

usage = """
usage: python shaver.py host user pass database table geom,id,properties epsg res0 extent zooms destdir
where:
       extent = left,bottom,right,top (e.g. 0,0,90,90)
       zooms  = minzoom,maxzoom (e.g. 0,5) 
       res0   = resolution at minimum zoom level (in units per pixel)
"""

try:
  # FIXME this should totalyl go into a config file.
  noop, dbhost, dbuser, dbpass, dbdb, dbtable, dbcolumns, epsg, res0, extent, zooms, destdir = sys.argv
except:
  print usage
  sys.exit(1)

def sqr(a):
  return a*a

conn = db.connect(host=dbhost, user=dbuser, password=dbpass, database=dbdb)
cur  = conn.cursor()

minz, maxz                   = map(int, zooms.split(","))
eleft, ebottom, eright, etop = map(float, extent.split(","))
sx, sy = eright - eleft, etop - ebottom
res0   = float(res0)

columns = dbcolumns.split(",")
geom    = columns[0]
idcol   = len(columns)>1 and columns[1] or None
props   = columns[1:]

for z in xrange(minz, maxz+1):
  num = int(pow(2,z))
  stx, sty = sx / num, sy / num
  for x in range(0, num):
    for y in range(0, num): 
      left   = eleft + x * stx
      right  = left + stx
      bottom = ebottom + y * sty
      top    = bottom + sty

      bbox = "st_geomfromtext('POLYGON((%s %s, %s %s, %s %s, %s %s, %s %s))', %s)" % (left, bottom, right, bottom, right, top, left, top, left, bottom, epsg)

      query =  "select st_asgeojson(st_simplify(st_intersection(%s, %s), %.2f)) as geom" % (geom, bbox, res0/num) # simplify deviations of less than one pixel
      for p in props:
        query += ", %s as %s" % (p,p)
      query += " FROM %s" % (dbtable,)
      query += " WHERE st_intersects(%s, %s)" % (geom, bbox)
      query += " AND st_area(%s) > %i" % (geom, sqr(res0 / num)) # ignore geometries smaller than one pixel 

      cur.execute(query)
      features = []

      for row in cur.fetchall():
        geometry = None
        properties = [] 
        id       = None
        for i,col in enumerate(row):
          if not col:
            continue
          elif isinstance(col, str) and '{"type"' in col: 
            geometry = loads(col)
          else: 
            colname = cur.description[i][0] 
            if colname == idcol:
              id = col
            else:
              properties.append({colname: col}) 
        features.append(Feature(geometry=geometry, properties=properties, id=id))

      try:
        print ("building %s/%i/%i" % (destdir, z, x))
        os.makedirs("%s/%i/%i" % (destdir, z, x))
      except:
        pass
      fd = open("%s/%i/%i/%i.geojson" % (destdir, z, x, y), "w")
      fd.write( re.sub("\.\d+","",dumps(FeatureCollection(features), separators=(",",":"))) )
      fd.close()

conn.close()

