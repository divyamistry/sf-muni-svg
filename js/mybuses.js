"use strict";

// First set parameters for the nextBus feed base URL
var nBUrlBase = "http://webservices.nextbus.com/service/publicXMLFeed";
var nBUrlAgency = "sf-muni";

// Bus route objects
var nBRoutes = [];

// Route related messages. These are computed only after a set of routes have been received.
var nBAllMessages = null;
// Route message priority. This is matched against the Bootstrap coloring
var nBMessagePriority = {"Low":"info", "Normal":"warning", "High":"danger"};
// Bus status should be updated this many seconds later
var statusDelayTimer = 5;
// Buses are shows using circles, and this is the radius of those circles.
//   It'll be updated as needed.
var busRadius = 5;

// get all the routes and give them additional data members as needed
var url = nBUrlBase + "?command=" + "routeList" + "&a=" + nBUrlAgency;
$.get(url).done(function(xmld){
  nBRoutes = $.xml2json(xmld);
  if (nBRoutes.Error) { // If an Error was reported from nextBus, show it.
    throw nBRoutes.Error;
  } else {
    // get the route info
    nBRoutes = nBRoutes.route;
    $.each(nBRoutes, function(i,d){
      // for each route, we add the lastTime its routes were updated
      // and the list of running tracked buses right now.
      d.lastTime = 0; //initialize to 0, update when buses get tracked
      d.buses = []; // no buses being tracked right now. updated as needed.
      d.tracked = false; // whether the bus is showing on map.
      d.runnerid = null; // id returned from the setInterval updates
      d.color = "black"; // default color will be black
    });

    // pick the correct color for each route from nextBus
    var colorsFetched = 0;
    $.each(nBRoutes, function(i,d){
      var url2 = nBUrlBase + "?command=routeConfig" + "&a=" + nBUrlAgency + "&r=" + d.tag + "&terse";
      $.get(url2).done(function(rd){
         nBRoutes[i].color = "#" + $(rd).find('route').attr('color');
         colorsFetched++;
       });
    });
    // once all the colors are available populate the route picker
    var colorWaitRunnerId = window.setInterval(function(){
      if(colorsFetched === nBRoutes.length) {
        window.clearInterval(colorWaitRunnerId);
        populateRoutePicker();
      }
    }, 200);

    // grab the messages and prepare them for displayed
    getAllMessages();
  }
});

// FUNCTIONS

/**
* funciton to load the bus status every 15 seconds
* @param busObj object for which status is to be updated
**/
function updateBusStatus(busObj){
  var nBurl = nBUrlBase + "?command=" + "vehicleLocations" + "&a=" + nBUrlAgency +
              "&r=" + busObj.data("tag") + "&t=" + busObj.data("lastTime");
  // console.log(nBurl);
  $.get(nBurl).done(function(xmld){
    // grab the xml into a json
    var buses = $.xml2json(xmld);
    // If there was an error from api, send out that error
    if(buses.Error) {
      throw buses.Error;
    } else {
      var busTagClassName = "bus-" + busObj.data("tag"); // name of the class for this bus on the map
      busObj.data("lastTime", buses.lastTime.time); // update the last checked time of this route

      // If any changed data was provided, we'll use that, otherwise skip all the computation
      if(buses.vehicle) {
        // Remove buses from plot for which location has changed
        svg.selectAll("." + busTagClassName).data(buses.vehicle, function(d){ return d.id; }).remove();

        // if vehicles have statuses since last time, then show the updated bus loc.
        svg.selectAll("." + busTagClassName).data(buses.vehicle, function(d){ return d.id; })
           .enter().append("ellipse")
           .attr("class", busTagClassName)
           .attr("cx", function(d){ return projection([d.lon,])[0]; })
           .attr("cy", function(d){ return projection([,d.lat])[1]; })
           .attr("rx", busRadius)
           .attr("ry", busRadius)
           .attr("opacity",0.20).attr("fill",busObj.data("color"));
      } else {
        // console.log('no change in the bus status from lastTime');
      }
      updateBusSize(busRadius * svg.select(".neigh-path").style("stroke-width"));
    }
  });
}

/**
 * A function to populate the list of routes on the route picker
 *
 */
function populateRoutePicker(){
  if (nBRoutes){
    // empty the current route picker
    $('#sf-route-picker .checkbox').remove();
    // for each of the routes, create an option
    $.each(nBRoutes, function(i, d){
      $('#sf-route-picker').append("<div class='checkbox'>"
                                 + "<label>"
                                 + "<input type='checkbox'><span class='route-tag-label'>" + d.tag + "</span></input>"
                                 + "</label>"
                                 + "<span class='badge route-msg-counter' style='background-color:" + d.color + "'>" + getNumberOfMessages(d.tag) + "</span>"
                                 + "</div>");
    });

    //assign data to each element
    $.each($("#sf-route-picker input[type='checkbox']"), function(i,d){ $(this).data(nBRoutes[i]);});

    // Based on all the click selection, add or remove the buses from map
    $("#sf-route-picker").on('change', 'input[type="checkbox"]', function(){
      if(true === $(this).prop("checked")){ // when the checkbox is checked
        // update the map with bus routes
        $(this).data("runnerid",window.setInterval(updateBusStatus, statusDelayTimer*1000, $(this)));
        // update the messages table with route messages if any
        showRelevantMessages($(this).data("tag"));
      } else {
        window.clearInterval($(this).data("runnerid")); // stop the previous updates
        svg.selectAll(".bus-" + $(this).data("tag")).remove(); // remove the older buses from map
        $(".route-msg-" + $(this).data("tag")).remove() // remove the info from messages table
        $(this).data("lastTime", 0); // reset lastTime for next look up
      }
      $(this).data("tracked", !$(this).data("tracked")); // for future use. //TODO: Angular control
    });
  } else {
    console.log("Route list wasn't populated, so no route options are available.");
  }
}

/**
 * Get all the messages currently available for the sf-muni agency.
 * The resulting messages are parsed into JSON object, and stored in
 * nBAllMessages variable.
 */
function getAllMessages() {
  // instead of requesting messages all the time, we'll get them once and store
  // the result. The messages are updated less frequently than a typical user
  // session.
  var nBurl = nBUrlBase + "?command=messages" + "&a=" + nBUrlAgency;
  $.get(nBurl).done(function(xmld){
    // get JSON of the messages
    nBAllMessages = $.xml2json(xmld);
    nBAllMessages = nBAllMessages.route;
    // show the messages relevant at the moment.
    showRelevantMessages("all");
  });
}

/**
 * Get number of messages for the given route tag
 * @param busRoute is the nextBus route tag for which to return the message count
 * @return number of messages for the given route tag
 */
function getNumberOfMessages(busRoute) {
  // check if there is any message for given route
  var routeMsgFoundAt = $.map(nBAllMessages, function(d, i){
    return (busRoute === d.tag) ? i : null;
  })[0];
  // if the messages exist for the route, return the count of messages, else 0.
  if(null != routeMsgFoundAt) {
    if(null != nBAllMessages[routeMsgFoundAt].message.length) { // JSON for just 1 message, creates a single object instead of an array of single object.
      return nBAllMessages[routeMsgFoundAt].message.length;
    } else {
      return 1;
    }
  } else {
    return 0;
  }
}
/**
 * At the launch, show the messages for "all" route Tag. This is generally "twitter follow" etc.
 * When the list of routes are selected for bus tracking, the list of visible messages get updated
 * accordingly.
 * @param busRoute is the nextBus route tag for which to display the messages. If no route-specific
 *                 message exists, then the common "all routes" messages are displayed.
 */
function showRelevantMessages(busRoute) {
  if (arguments.length < 1) {
    throw "showRelevantMessages needs a route tag as parameter.";
  }

  // if busRoute is not provided, the default "all" is assumed
  busRoute = (null != busRoute) ? busRoute : "all"; // left the loose comparison to accommodate null and undefined both.

  // find the index where the messages for given busRoute exist in nBAllMessages
  var foundMessagesAt = null;

  // look for busRoute in the messages list if that list is available
  if(null != nBAllMessages) { // messages have been populated
    foundMessagesAt = $.map(nBAllMessages, function(d, i){ return (d.tag === busRoute) ? i : null; });
  }

  // if the messages exist for busRoute, fetch them and show them.
  if ((null != foundMessagesAt) && (0 < foundMessagesAt.length)) { // messages were found for the busRoute.
    // if there's only one message, it has to be Array'd because xml2json makes it non-array single object
    if(null == nBAllMessages[foundMessagesAt].message.length) {
      nBAllMessages[foundMessagesAt].message = [nBAllMessages[foundMessagesAt].message]
    }
    // if there are more messages, no loop through them
    $.each(nBAllMessages[foundMessagesAt].message, function(i, d){
      var stopName = null;
      try {
        if(d.routeConfiguredForMessage.stop.length == null) {
          stopName = d.routeConfiguredForMessage.stop.title;
        } else {
          stopName = d.routeConfiguredForMessage.stop[0].title;
        }
      }
      catch(e) { stopName = "-"; } // if message is not for a specific stop.
      // once stopName is figure out, create the table entry
      $("#route-messages").prepend("<tr class='route-msg-" + busRoute + " " + nBMessagePriority[d.priority] + "'>"
                                  + "<td>" + busRoute + "</td>"
                                  + "<td>" + stopName
                                  + "<td>" + d.text[0] + "</td>"
                                  + "</tr>");
    });
  }
}
