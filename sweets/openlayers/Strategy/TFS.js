/* Copyright (c) 2006-2010 by OpenLayers Contributors (see authors.txt for 
 * full list of contributors). Published under the Clear BSD license.  
 * See http://svn.openlayers.org/trunk/openlayers/license.txt for the
 * full text of the license. */

/**
 * @requires OpenLayers/Strategy.js
 * @requires OpenLayers/Filter/Spatial.js
 */

/**
 * Class: OpenLayers.Strategy.BBOX
 * A simple strategy that reads new features when the viewport invalidates
 *     some bounds.
 *
 * Inherits from:
 *  - <OpenLayers.Strategy>
 */
OpenLayers.Strategy.TFS = OpenLayers.Class(OpenLayers.Strategy, {
    
    /**
     * Property: bounds
     * {<OpenLayers.Bounds>} The current data bounds (in the same projection
     *     as the layer - not always the same projection as the map).
     */
    bounds: null,
    
    /** 
     * Property: resolution 
     * {Float} The current data resolution. 
     */ 
    resolution: null, 
          
	/**
	 * Property: zoom
	 */
	zoom: 0, 
    /**
     * APIProperty: ratio
     * {Float} The ratio of the data bounds to the viewport bounds (in each
     *     dimension).  Default is 2.
     */
    ratio: 2,

    /** 
     * Property: resFactor 
     * {Float} Optional factor used to determine when previously requested 
     *     features are invalid.  If set, the resFactor will be compared to the
     *     resolution of the previous request to the current map resolution.
     *     If resFactor > (old / new) and 1/resFactor < (old / new).  If you
     *     set a resFactor of 1, data will be requested every time the
     *     resolution changes.  If you set a resFactor of 3, data will be
     *     requested if the old resolution is 3 times the new, or if the new is
     *     3 times the old.  If the old bounds do not contain the new bounds
     *     new data will always be requested (with or without considering
     *     resFactor). 
     */ 
    resFactor: null, 
    
    /**
     * Property: response
     * {<OpenLayers.Protocol.Response>} The protocol response object returned
     *      by the layer protocol.
     */
    response: null,
	
	/**
	 * Property: visitedTiles
	 * Hash of visitedTiles
	 */
	visitedTiles: {}, 

    /**
     * Constructor: OpenLayers.Strategy.BBOX
     * Create a new BBOX strategy.
     *
     * Parameters:
     * options - {Object} Optional object whose properties will be set on the
     *     instance.
     */
    initialize: function(options) {
		options = options ? options : {};
		this.tileWidth = options.tileWidth ? options.tileWidth : 256;
		this.tileHeight = options.tileHeight ? options.tileHeight : 256;
		this.mapBounds = options.mapBounds ? options.mapBounds : new OpenLayers.Bounds(-180,-90,180,90);
		this.url = options.url ? options.url : null;
		this.format = options.format ? options.format : null;
        OpenLayers.Strategy.prototype.initialize.apply(this, [options]);
		//this.layer.visitedTiles = {};
		this.lastZoom = options.lastZoom? options.lastZoom : 8;
		this.visitedTiles = {};	
    },
    
    /**
     * Method: activate
     * Set up strategy with regard to reading new batches of remote data.
     * 
     * Returns:
     * {Boolean} The strategy was successfully activated.
     */
    activate: function() {
        var activated = OpenLayers.Strategy.prototype.activate.call(this);
        if(activated) {
            this.layer.events.on({
                "moveend": this.update,
                scope: this
            });
            this.layer.events.on({
                "refresh": this.update,
                scope: this
            });
            if(this.layer.visibility == true) {
                this.update();
            }

			this.layer.events.addEventType("beforedataread");	
        }
        return activated;
    },
    
    /**
     * Method: deactivate
     * Tear down strategy with regard to reading new batches of remote data.
     * 
     * Returns:
     * {Boolean} The strategy was successfully deactivated.
     */
    deactivate: function() {
        var deactivated = OpenLayers.Strategy.prototype.deactivate.call(this);
        if(deactivated) {
            this.layer.events.un({
                "moveend": this.update,
                scope: this
            });
            this.layer.events.un({
                "refresh": this.update,
                scope: this
            });
			//TODO: remove event type "beforedataread"
        }
        return deactivated;
    },

    /**
     * Method: update
     * Callback function called on "moveend" or "refresh" layer events.
     *
     * Parameters:
     * options - {Object} An object with a property named "force", this
     *      property references a boolean value indicating if new data
     *      must be incondtionally read.
     */
    update: function(options) {
		this.layer.events.triggerEvent("beforedataread");
	//	console.log("Strategy_TFS.update");
        var mapBounds = this.getMapBounds();
        if (mapBounds !== null && this.invalidBounds(mapBounds)) {
            this.calculateBounds(mapBounds);
            this.resolution = this.layer.map.getResolution(); 
			this.zoom = this.layer.map.getZoom();
			if (options){
				this.zoomChanged = options.zoomChanged ? options.zoomChanged: false;
			}
            this.triggerRead();
        }
    },
    
    /**
     * Method: getMapBounds
     * Get the map bounds expressed in the same projection as this layer.
     *
     * Returns:
     * {<OpenLayers.Bounds>} Map bounds in the projection of the layer.
     */
    getMapBounds: function() {
        if (this.layer.maps === null) {
            return null;
        }
        var bounds = this.layer.map.getExtent();
        if(bounds && !this.layer.projection.equals(this.layer.map.getProjectionObject())) {
            bounds = bounds.clone().transform(
                this.layer.map.getProjectionObject(), this.layer.projection
            );
        }
        return bounds;
    },

    /**
     * Method: invalidBounds
     * Determine whether the previously requested set of features is invalid. 
     *     This occurs when the new map bounds do not contain the previously 
     *     requested bounds.  In addition, if <resFactor> is set, it will be 
     *     considered.
     *
     * Parameters:
     * mapBounds - {<OpenLayers.Bounds>} the current map extent, will be
     *      retrieved from the map object if not provided
     *
     * Returns:
     * {Boolean} 
     */
    invalidBounds: function(mapBounds) {
        if(!mapBounds) {
            mapBounds = this.getMapBounds();
        }
        var invalid = !this.bounds || !this.bounds.containsBounds(mapBounds);
        if(!invalid && this.resFactor) {
            var ratio = this.resolution / this.layer.map.getResolution();
            invalid = (ratio >= this.resFactor || ratio <= (1 / this.resFactor));
        }
        return invalid;
    },
 
    /**
     * Method: calculateBounds
     *
     * Parameters:
     * mapBounds - {<OpenLayers.Bounds>} the current map extent, will be
     *      retrieved from the map object if not provided
     */
    calculateBounds: function(mapBounds) {
        if(!mapBounds) {
            mapBounds = this.getMapBounds();
        }
        var center = mapBounds.getCenterLonLat();
        var dataWidth = mapBounds.getWidth() * this.ratio;
        var dataHeight = mapBounds.getHeight() * this.ratio;
        this.bounds = new OpenLayers.Bounds(
            center.lon - (dataWidth / 2),
            center.lat - (dataHeight / 2),
            center.lon + (dataWidth / 2),
            center.lat + (dataHeight / 2)
        );
    },
    
    /**
     * Method: triggerRead
     *
     * Returns:
     * {<OpenLayers.Protocol.Response>} The protocol response object
     *      returned by the layer protocol.
     */
    triggerRead: function() {
	//	console.log("reading all tiles upto zoom: " + this.zoom);
		if (this.zoomChanged) {
			//console.log("removing the old features");
			this.layer.destroyFeatures();
			this.visitedTiles = {};
			this.zoomChanged = false;
		}
		var featureTiles = this.boundsToTiles(this.bounds);
		var reqTiles = [];
		for (var i=0;i< featureTiles.length;i++) {
			if ( !(featureTiles[i].id in this.visitedTiles) ) {
				reqTiles.push(featureTiles[i]);
			}
		}

		/*if (this.response) {
      		this.layer.protocol.abort(this.response);
        	this.layer.events.triggerEvent("loadend");
        }*/
        this.layer.events.triggerEvent("loadstart");
/*		var me = new Object();
		me = this;
		for(var i=0; i<reqTiles.length; i++) {
			var req =this.url+"/"+reqTiles[i].z+"/"+reqTiles[i].x+"/"+reqTiles[i].y+"?callback=locationFeaturesHandle";
			bObj = new JSONscriptRequest(req); 
			bObj.buildScriptTag(  ); 
			bObj.addScriptTag(  );	
            // tileId : reqTiles[i].id
        }
*/		
		this.response = this.layer.protocol.readTiles(reqTiles,{
            callback: this.merge,
	        scope: this
        });
    },

	/**
	 * Method: boundsToTiles
	 * calculate the tiles of given bounds
	 * Parameters: {<OpenLayers.Bounds>} 
	 * Returns: Array of tiles object (tile.z,tile.y,tile.z)
	 */
	boundsToTiles: function(bounds){
		var tiles = [];
		var resolution = this.resolution;
		var left = Math.floor((bounds.left - this.mapBounds.left) / (resolution * this.tileWidth ));
		var bottom = Math.floor((bounds.bottom - this.mapBounds.bottom) / (resolution * this.tileHeight));
		var right = Math.floor((bounds.right - this.mapBounds.left) / (resolution * this.tileWidth )); 
		var top = Math.floor((bounds.top - this.mapBounds.bottom) / (resolution * this.tileHeight ));
		for ( var i=top; i>=bottom ;i--) {
			var row = [];
			for( var j=left; j<=right;j++) {
				var tile = {};
				tile.id = this.zoom+ "-" +j + "-" + i;			
				tile.z = this.zoom ;	
				tile.x = j ;
				tile.y = i ;
				row.push(tile);
			}
			tiles.push(row);
		}
		return this.spiral(tiles);
	},

	/**
	 * Method: spiral
	 * Order the two dimensional array in spiral way outward
	 * Paramaeters: Array of Array
	 * Returns: Array
	 */
	spiral: function(matrix) {
	    var top=0, left=0, bottom=matrix.length-1, right=matrix[0].length-1;
        var output=[];
        while(top < bottom && left < right){
            //picking top row
            for(var i=right; i>=left; i--){
                output.push(matrix[top][i]);
            }
            top+=1;
            //picking left colum
            for(var i=top; i<=bottom; i++){
                output.push(matrix[i][left]);
            }
            left+=1;
            //picking bottom row
            for(var i=left; i<=right; i++){
                output.push(matrix[bottom][i]);
            }
            bottom -= 1;
            //picking right colum
            for(var i=bottom; i >=top; i--){
                output.push(matrix[i][right]);
            }
            right-=1;
        }
        if(top==bottom){
            for(var i=right; i>=left; i--){
                output.push(matrix[top][i]);
            }
            top+=1;
        }
        if(left==right){
            for(var i=top; i<=bottom; i++){
                output.push(matrix[i][left]);
            }
        }
        return output.reverse();
	},
    /**
     * Method: createFilter
     * Creates a spatial BBOX filter. If the layer that this strategy belongs
     * to has a filter property, this filter will be combined with the BBOX 
     * filter.
     * 
     * Returns
     * {<OpenLayers.Filter>} The filter object.
     */
/*    createFilter: function() {
        var filter = new OpenLayers.Filter.Spatial({
            type: OpenLayers.Filter.Spatial.BBOX,
            value: this.bounds,
            projection: this.layer.projection
        });
        if (this.layer.filter) {
            filter = new OpenLayers.Filter.Logical({
                type: OpenLayers.Filter.Logical.AND,
                filters: [this.layer.filter, filter]
            });
        }
        return filter;
    },
*/
   
    /**
     * Method: merge
     * Given a list of features, determine which ones to add to the layer.
     *     If the layer projection differs from the map projection, features
     *     will be transformed from the layer projection to the map projection.
     *
     * Parameters:
     * resp - {<OpenLayers.Protocol.Response>} The response object passed
     *      by the protocol.
     */
    merge: function(resp) {
        //this.layer.destroyFeatures();
		var tileid = resp.id;
		this.visitedTiles[resp.tileId] = true;
		//this.format.read(resp);
        var features = resp.features;
        if(features && features.length > 0) {
            var remote = this.layer.projection;
            var local = this.layer.map.getProjectionObject();
            if(!local.equals(remote)) {
                var geom;
                for(var i=0, len=features.length; i<len; ++i) {
                    geom = features[i].geometry;
                    if(geom) {
                        geom.transform(remote, local);
                    }
                }
            }
            this.layer.addFeatures(features);
        }
        this.response = null;
        this.layer.events.triggerEvent("loadend");
    },
   
    CLASS_NAME: "OpenLayers.Strategy.TFS" 
});
function locationFeaturesHandle(resp){
	var tileid = resp.params.x + "-" + resp.params.y; 
		
	//this.format.read(resp);
	var format = new OpenLayers.Format.GeoJSON();
	var layer = mapobj.map.getLayersByName("locations")[0];
	for(var i=0;i<layer.strategies.length;i++){
		if(layer.strategies[i].CLASS_NAME == "OpenLayers.Strategy.TFS"){
			var strategy = layer.strategies[i];
		}
	}
	strategy.visitedTiles[resp.params.z][tileid] = true;
    var features = format.read(resp);
    if(features && features.length > 0) {
        var remote = layer.projection;
        var local = layer.map.getProjectionObject();
        if(!local.equals(remote)) {
            var geom;
            for(var i=0, len=features.length; i<len; ++i) {
                geom = features[i].geometry;
                if(geom) {
                    geom.transform(remote, local);
                }
            }
        }
		if(!(layer.zoomFeatures)) {
			layer.zoomFeatures = {};
			for (var i=0;i<=strategy.lastZoom; i++){
				layer.zoomFeatures[i] = [];
			}
		}
		//Setting minimum zoom level for features
		for(var i=0;i<features.length;i++){
			features[i].minzoom = resp.params.z;
		}
		layer.zoomFeatures[resp.params.z] = layer.zoomFeatures[resp.params.z].concat(features);
			
		layer.addFeatures(features);
	}
    //this.response = null;
	layer.events.triggerEvent("loadend");
}
