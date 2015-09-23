"use strict";

// prep all the data so that it can be displayed/hidden on the fly
var sfCityNeighborhood = null, sfCityArteries = null, sfCityStreets = null;

d3.json("data/neighborhoods.json", function(err, sfc){
  if (err) throw err;
  sfCityNeighborhood = sfc;
});

d3.json("data/arteries.json", function(err, sfa){
  if (err) throw err;
  sfCityArteries = sfa;
});

d3.json("data/streets.json", function(err, sfs){
  if (err) throw err;
  sfCityStreets = sfs;
});

// prep the svg element to draw on
var height = 500,
    width = $("#sf-svg-map").width();

// prep a projection
var projection = d3.geo.mercator().scale(1).translate([0, 0]);

// create a var to capture and update each path
var path = d3.geo.path().projection(projection);

// create the SVG holder for the map
var svg = d3.select("#sf-svg-map").append("svg").attr("height", height).attr("width", width).call(d3.behavior.zoom().scaleExtent([1, 4]).on("zoom", zoomed));
// create a rectangle with sea color
svg.append("rect").attr("height", height).attr("width", width).attr("fill", "#BADDFF");
// layer for neighborhoods
var gNeigh = svg.append("g").attr("height", height).attr("width", width);
// layer for arteries
var gArter = svg.append("g").attr("height", height).attr("width", width);
// layer for streets
var gStree = svg.append("g").attr("height", height).attr("width", width);
// layer for labels
var gLabels = svg.append("g").attr("height", height).attr("width", width);
// SVG for drawing the buses
var gBuses = svg.append("g").attr("height", height).attr("width", width);

// Supporting variables
var neighEnabled = false; // track whether the neighborhoods are displayed
var arteriesEnabled = false; // track whether the arteries were already turned on
var streetsEnabled = false; // track whether the streets are already visible

// check if the map data are ready. Once they are, move forward with rest of
// the processing
var neighChecker = window.setInterval(function(){
  if(sfCityNeighborhood) {
    window.clearInterval(neighChecker);
    // set up the neighborhoods on map
    setupNeighborhoods();
  }
}, 200);

// a simple updater to resize the sea and the viewport. Rest of the work is
// done by zoomed() anyways.
$(window).on("resize", function(){

  width = $("#sf-svg-map").width();
  // update size of the SVG
  svg.attr("width", width);
  // update size of sea
  svg.select("rect").attr("width", width).style("fill", "#BADDFF");
});

// FUNCTIONS //

/**
 * Draw the neighborhood on the SVG element
 */
function setupNeighborhoods() {
  // compute bounds of foi, then derive scale etc.
  var nBbst = getBoundsAndScale(sfCityNeighborhood);

  // re-project the projection with new scale
  projection.scale(nBbst[1]).translate(nBbst[2]);

  // draw the polygons
  gNeigh.selectAll(".neigh-path")
     .data(sfCityNeighborhood.features)
     .enter()
     .append("svg:path")
     .attr("class", "neigh-path")
     .attr("d", path)
     .attr("fill", "#F0EDE5")
     .attr("stroke", "#AABBCC")
     .attr("stroke-width", 1);

  // draw the text
  setupLabelsOfNeighborhoods();

  // indicate that the neighborhoods are visible now
  neighEnabled = true;
}

/**
 * Draw the names of the neighborhoods as shape labels
 */
function setupLabelsOfNeighborhoods() {
  if(!sfCityNeighborhood){
    // keep checking if neighborhoods are enabled
    // and escape once they are
    throw "Neighbhorhoods data unavailable. Can't draw labels."
  } else {
    // show the names of the neighborhoods
    gLabels.selectAll(".neigh-label")
       .data(sfCityNeighborhood.features)
       .enter()
       .append("svg:text")
       .attr("class", "neigh-label")
       .attr("x", function(t){ return path.centroid(t)[0]; })
       .attr("y", function(t){ return path.centroid(t)[1]; })
       .attr("dy", "0.35em")
       .attr("text-anchor", "middle")
       .attr("font-size", "0.8em")
       .attr("font-family", "sans-serif")
       .attr("fill", "#AABBCC")
       .attr("stroke", "#000000")
       .attr("stroke-width", "0.02em")
       .attr("opacity", 0.9)
       .text(function(t){ return t.properties.neighborho; });
  }
}

/**
 * Draw the arterial roads on the SVG map
 */
function setupArteries() {
  if(!sfCityArteries) {
    // keep checking if arteries are enabled
    // and escape once they are.
    throw "Arteries data is not available yet."
  } else {
    gArter.selectAll(".arter-path")
       .data(sfCityArteries.features)
       .enter()
       .append("svg:path")
       .attr("class", "arter-path")
       .attr("d", path)
       .attr("fill", "none")
       .attr("stroke", "#FFFFFF")
       .attr("stroke-width", 2);

    // indicate that arteries are visible
    arteriesEnabled = true;
  }
}

/**
 * Draw the streets on the SVG
 */
function setupStreets() {
  if(!sfCityStreets){
    // keep checking if streets are enabled
    // and escape once they are.
  } else {
    // draw the streets
    gStree.selectAll(".street-path")
       .data(sfCityStreets.features)
       .enter()
       .append("svg:path")
       .attr("class", "street-path")
       .attr("d", path)
       .attr("fill", "none")
       .attr("stroke", "#FFFFFF")
       .attr("stroke-width", 1);

    // indicate that streets are visisble
    streetsEnabled = true;
  }
}

/**
 * Function to calculate the FoI bounds, scale, and translate coordiantes
 * @param aFeature the feature based on which the bounds are to be calculated
 * @returns a 3 member array with [ bounds, scale, translate ], where
 *          bounds is [[x0, y0], [x1, y1]] two point vector,
 *          scale is a real number, and
 *          translate is a [horizontalTranslate, verticalTranslate] vector
 */
function getBoundsAndScale(aFeature) {
  var nB = path.bounds(aFeature),
      nS = .95 / Math.max((nB[1][0] - nB[0][0]) / width, (nB[1][1] - nB[0][1]) / height),
      nT = [(width - nS * (nB[1][0] + nB[0][0])) / 2, (height - nS * (nB[1][1] + nB[0][1])) / 2];
  return [nB, nS, nT];
}

/**
 * Zoom and translate the map
 */
function zoomed() {
  // translate and scale the map with correct transform values
  gNeigh.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
  gArter.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
  gStree.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
  gLabels.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
  gBuses.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");

  // if zoomed in enough, then show the arterial roads
  if (d3.event.scale > 2 && !arteriesEnabled) {
    setupArteries();
  } else if (d3.event.scale < 2) {
    svg.selectAll(".arter-path").remove();
    arteriesEnabled = false;
  }

  // if zoomed in far enough, show the streets
  if (d3.event.scale > 3 && !streetsEnabled) {
    setupStreets();
    svg.selectAll(".arter-path").style("stroke", "black");
  } else if (d3.event.scale < 3) {
    svg.selectAll(".street-path").remove();
    svg.selectAll(".arter-path").style("stroke", "#FFFFFF");
    streetsEnabled = false;
  }
  // console.log("zoomed to scale: " + d3.event.scale);
  // All visuals are relative to one another. I first set the basic ratio
  var neighBorderWidth = 1/d3.event.scale; // stroke width of neighborhoods.
  // update the neighborhoods first
  svg.selectAll(".neigh-path").style("stroke-width", neighBorderWidth);
  // update street thickness based on zoom
  svg.selectAll(".street-path").style("stroke-width", 2 * neighBorderWidth);
  // update arteries based on zoom
  svg.selectAll(".arter-path").style("stroke-width", 4 * neighBorderWidth);
  // update the bus circle size.
  updateBusSize(busRadius * neighBorderWidth); // this is a separate function because it's also used in other places.
  // update text labels based on zoom
  svg.selectAll(".neigh-label").style("font-size", (10 * neighBorderWidth) + "px");
}

/**
 * This functions helps with redraws of the bus circles during zooms and
 * auto-updates that happen every few seconds.
 * @param bSize radius of the circle representing the buses on the map
 */
function updateBusSize(bSize) {
  svg.selectAll("circle[class|='bus']").attr("r", bSize);
}

/**
 * Run setInterval on a callback function for a given number of repetitions
 * @param callback the function to call repetitively
 * @param delay the number of milliseconds to wait before repeating callback
 * @param reps number of times the callback should be run.
 * @param [param1, param2, ... ] arguments for the callback function (Optional)
 */
function mySetInterval(callback, delay, reps) {
  if (arguments.length < 3) {
    throw "mySetInterval needs at least 3 arguments."
  }

  var X = 0;
  var intervalId = window.setInterval(function(d){
    callback(d);
    if(++X === reps) {
      window.clearInterval(intervalId);
    }
  }, delay, Array.prototype.slice.call(arguments, 3));
}
