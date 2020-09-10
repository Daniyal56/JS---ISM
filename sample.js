(function ($) {
  var map, // This is the Google map
    clientMarker, // The current marker when we are following a single client
    overlay, // Map Image Overlay
    clientUncertaintyCircle, // The circle describing that client's location uncertainty
    lastEvent, // The last scheduled polling task
    lastInfoWindowMac, // The last Mac displayed in a marker tooltip
    allMarkers = [], // The markers when we are in "View All" mode
    lastMac = "", // The last requested MAC to follow
    infoWindow = new google.maps.InfoWindow(), // The marker tooltip
    markerImage = new google.maps.MarkerImage(
      "/static/blue_circle.png",
      new google.maps.Size(15, 15),
      new google.maps.Point(0, 0),
      new google.maps.Point(4.5, 4.5)
    );



  var loc = [
    ["68:3a:1e:7f:53:e3", 24.8620257203337, 67.0635600807361],
    ["68:3a:1e:7f:a7:8f", 24.8620881834708, 67.0638155611448],
    ["e0:cb:bc:8f:95:9a", 24.8620478258066, 67.0636237832002],
  ];

  MerakiOverlay.prototype = new google.maps.OverlayView();

  // Removes all markers
  function clearAll() {
    clientMarker.setMap(null);
    clientUncertaintyCircle.setMap(null);
    lastInfoWindowMac = "";
    var m;
    while (allMarkers.length !== 0) {
      m = allMarkers.pop();
      if (infoWindow.anchor === m) {
        lastInfoWindowMac = m.mac;
      }
      m.setMap(null);
    }
  }

  // Looks up a single APMAC address
  function lookup(value) {
    $.getJSON("/clients/" + mac, function (response) {
      track(response);
      console.log('res', response);
      console.log('JSON', response.responseJSON) //dekhe clients se get kr ra ta run krun?, G
    });
  }

  // Plots the location and uncertainty for a single MAC address
  function track(data) { // is function ki bat kr rha hun, ye kahan se call hota hai? spell glt hua ta again run
    clearAll();
    let client = data.observations;
    console.log(client);
    if (
      client !== null &&
      client.location !== null &&
      !(typeof client.location === "undefined")
    ) {
      var pos = new google.maps.LatLng(
        client.location.lat,
        client.location.lng
      );
      if (client.manufacturer != null) {
        mfrStr = client.manufacturer + " ";
      } else {
        mfrStr = "";
      }
      if (client.os != null) {
        osStr = " running " + client.os;
      } else {
        osStr = "";
      }
      if (client.ssid != null) {
        ssidStr = " with SSID '" + client.ssid + "'";
      } else {
        ssidStr = "";
      }
      if (client.name != null && client.name !== "") {
        floorStr = " '" + client.name + "'";
      } else {
        floorStr = "";
      }
      $("#last-mac").text(
        mfrStr +
        "'" +
        lastMac +
        floorStr +
        "'" +
        osStr +
        ssidStr +
        " last seen on " +
        data.apMac + // is trha nhi hoga, wo variable to function ka local hai global nahi le skte?
        // kr skte hain. key word hai global lne ka js m?
        // ye btao k ye wala function kb chlta hai? Access point h yaha p number ae ga
        // track function kb chlta hai?
        client.seenString +
        " with uncertainty " +
        client.location.unc.toFixed(1) +
        " meters from Access Point"
      );
      map.setCenter(pos);
      clientMarker.setMap(map);
      clientMarker.setPosition(pos);
      clientUncertaintyCircle = new google.maps.Circle({
        map: map,
        center: pos,
        radius: client.location.unc,
        fillColor: "RoyalBlue",
        fillOpacity: 0.25,
        strokeColor: "RoyalBlue",
        strokeWeight: 1,
      });
    } else {
      $("#last-mac").text("Client '" + lastMac + "' could not be found");
    }
  }

  // Looks up a single MAC address
  function lookup(mac) {
    $.getJSON("/clients/" + mac, function (response) {
      track(response);
    });
  }

  // Adds a marker for a single client within the "view all" perspective
  function addMarker(client) {
    if (
      client !== null &&
      client.location !== null &&
      !(typeof client.location === "undefined")
    ) {
      var m = new google.maps.Marker({
        position: new google.maps.LatLng(
          client.location.lat,
          client.location.lng
        ),
        map: map,
        mac: client.clientMac,
        icon: markerImage,
        title: client.name,
      });
      google.maps.event.addListener(m, "click", function () {
        infoWindow.setContent(
          "<div>" +
          client.name +
          "<br></br>" +
          client.clientMac +
          "</div> (<a class='client-filter' href='#' data-mac='" +
          client.clientMac +
          "'>Follow this client)</a>"
        );
        infoWindow.open(map, m);
      });
      if (client.clientMac === lastInfoWindowMac) {
        infoWindow.open(map, m);
      }
      var pos = new google.maps.LatLng(
        client.location.lat,
        client.location.lng
      );
      map.setCenter(pos);
      clientMarker.setMap(map);
      clientMarker.setPosition(pos);
      allMarkers.push(m);
    }
  }

  // Displays markers for all clients
  function trackAll(clients) {
    clearAll();
    if (clients.length === 0) {
      $("#last-mac").text(
        "Found no clients (if you just started the web server, you may need to wait a few minutes to receive pushes from Meraki)"
      );
    } else {
      $("#last-mac").text("Found " + clients.length + " clients ");
    }
    clientUncertaintyCircle.setMap(null);
    for (var i = 0, len = clients.length; i < len; i++) {
      addMarker(clients[i]);
    }
  }

  // Looks up all MAC addresses
  function lookupAll() {
    $("#last-mac").text("Looking up all clients...");
    $.getJSON("/clients/", function (response) {
      trackAll(response); // tun ne apna getJSON kahan likha hai?
    });
  }

  // Begins a task timer to reload a single MAC every 20 seconds
  function startLookup() {
    lastMac = $("#mac-field").val().trim();
    if (lastEvent !== null) {
      window.clearInterval(lastEvent);
    }
    lookup(lastMac);
    lastEvent = window.setInterval(lookup, 20000, lastMac);
  }

  // Begins a task timer to reload all MACs every 20 seconds
  function startLookupAll() {
    if (lastEvent !== null) {
      window.clearInterval(lastEvent);
    }
    lastEvent = window.setInterval(lookupAll, 20000);
    lookupAll();
  }

  // This is called after the DOM is loaded, so we can safely bind all the
  // listeners here.
  function initialize() {
    var center = new google.maps.LatLng(24.8620631, 67.0615684);
    var mapOptions = {
      zoom: 18,
      center: center,
    };

    var bounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(24.861953167601648, 67.06351393),
      new google.maps.LatLng(24.8621200194344, 67.0638421067)
    );

    var srcImage = "/static/map.png";

    map = new google.maps.Map(
      document.getElementById("map-canvas"),
      mapOptions
    );

    var def_marker = new google.maps.Marker({
      position: new google.maps.LatLng(24.8620257203337, 67.0635600807361),
      title: loc[0][0],
    });
    def_marker.setMap(map);

    var def_marker_1 = new google.maps.Marker({
      position: new google.maps.LatLng(24.8620881834708, 67.0638155611448),
      title: loc[1][0],
    });
    def_marker_1.setMap(map);

    var def_marker_2 = new google.maps.Marker({
      position: new google.maps.LatLng(24.8620478258066, 67.0636237832002),
      title: loc[2][0],
    });
    def_marker_2.setMap(map);

    clientMarker = new google.maps.Marker({
      position: center,
      icon: markerImage,
    });

    clientUncertaintyCircle = new google.maps.Circle({
      position: center,
    });

    overlay = new MerakiOverlay(bounds, srcImage, map);

    $("#track").click(startLookup).bind("enterKey", startLookup);

    $("#all").click(startLookupAll);

    $(document).on("click", ".client-filter", function (e) {
      e.preventDefault();
      var mac = $(this).data("mac");
      $("#mac-field").val(mac);
      startLookup();
    });

    startLookupAll();
  }

  // Call the initialize function when the window loads
  $(window).load(initialize);
  //google.maps.event.addDomListener(window, 'load', initialize);
})(jQuery);

/** @constructor */

function MerakiOverlay(bounds, image, map) {
  // Initialize all properties.
  this.bounds_ = bounds;
  this.image_ = image;
  this.map_ = map;

  // Define a property to hold the image's div. We'll
  // actually create this div upon receipt of the onAdd()
  // method so we'll leave it null for now.
  this.div_ = null;

  // Explicitly call setMap on this overlay.
  this.setMap(map);
}

/**
 * onAdd is called when the map's panes are ready and the overlay has been
 * added to the map.
 */
MerakiOverlay.prototype.onAdd = function () {
  var div = document.createElement("div");
  div.style.borderStyle = "none";
  div.style.borderWidth = "0px";
  div.style.position = "absolute";
  div.style.transform = "rotate3d(0, 0, 1, -14.9314deg)";

  // Create the img element and attach it to the div.
  var img = document.createElement("img");
  img.src = this.image_;
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.position = "absolute";
  img.style.opacity = "0.9";
  div.appendChild(img);

  this.div_ = div;

  // Add the element to the "overlayLayer" pane.
  var panes = this.getPanes();
  panes.overlayLayer.appendChild(div);
};

MerakiOverlay.prototype.draw = function () {
  // We use the south-west and north-east
  // coordinates of the overlay to peg it to the correct position and size.
  // To do this, we need to retrieve the projection from the overlay.
  var overlayProjection = this.getProjection();

  // Retrieve the south-west and north-east coordinates of this overlay
  // in LatLngs and convert them to pixel coordinates.
  // We'll use these coordinates to resize the div.
  var sw = overlayProjection.fromLatLngToDivPixel(this.bounds_.getSouthWest());
  var ne = overlayProjection.fromLatLngToDivPixel(this.bounds_.getNorthEast());

  // Resize the image's div to fit the indicated dimensions.
  var div = this.div_;
  div.style.left = sw.x + "";
  div.style.top = ne.y + "";
  div.style.width = ne.x - sw.x + "";
  div.style.height = sw.y - ne.y + "";
};

// The onRemove() method will be called automatically from the API if
// we ever set the overlay's map property to 'null'.
MerakiOverlay.prototype.onRemove = function () {
  this.div_.parentNode.removeChild(this.div_);
  this.div_ = null;
};
