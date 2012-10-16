TileShaver
==========

A tiny script to generate GeoJSON map tiles in arbitrary projections from PostGIS.
This generates static, pre-generated GeoJSON files in a z/x/y.geojoson naming scheme. 
Serve them from your favourite web server. 

The tiling scheme should be understood by PolyMaps by default.

A TFS strategy for OpenLayers is provided in the sweets/ directory. This should complement  
OpenLayers v.2.12 and possibly beyond. A working build configuration is also included.

```
usage: python shaver.py host user pass database table geom,id,properties epsg res0 extent zooms destdir
where:
       host   = database host
       user   = database user
       pass   = database password
       table  = table to convert to tiled GeoJSON (full query support pending)
       geom   = name of the geometry column
       id     = name of the id property column
       properties = other columns to include as property. Can be written as property=alias to assign aliases.
       epsg   = used projection
       res0   = resolution at minimum zoom level (in units per pixel)
       extent = coordinates for the left,bottom,right,top of the map (e.g. 0,0,90,90)
                this determines the entire tiling scheme.
                currently, if you need to invert any axes, you''ll have to change the script.
       zooms  = minzoom,maxzoom (e.g. 0,5) 
       destdir= base output directory for tile files
```

An actual config file is next on the todo list.
