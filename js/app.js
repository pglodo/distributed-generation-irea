(function() {

  var map = L.map('map', {
    zoomSnap: .1,
    center: [39.4, -105],
    zoom: 10,
    minZoom: 8,
    maxZoom: 13,
    maxBounds: L.latLngBounds([37.8, -107.5], [40.9, -102.0])
  });

  // easy to find colors
  var subPrimColor = '#7a5596', //#5067af #7a5596
    subSecColor = '#919191',
    locSolarColor = '#ff7800',
    locBmColor = '#5cb572',
    locWindColor = '#65cece'; //#b383c4

  // add basemap
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // AJAX requests for the json data
  // load distributed generation data
  $.getJSON("data/distributed_generation.json", function(distGen) {
      // once complete, load substation data
      $.getJSON("data/substations.json", function(substation) {
          // use data to draw the map
          processData(distGen, substation);
        })
        .fail(function() {
          console.log("Substation data failed to load.");
        });
    })
    .fail(function() {
      console.log("Distributed generation data failed to load.");
    });

  // calculating radius of location points
  function locationRadius(val) {

    var radius = Math.sqrt(val / Math.PI);
    return radius * 2.7; // adjust the scale

  } // end of locationRadius()

  // calculating radius of substation points
  function substationRadius(val) {
    if (val > 0) {
      var radius = Math.sqrt(val / Math.PI);
      return radius * 1.4;
    } else {
      var radius = 3;
      return radius;
    }


  } // end of substationRadius()

  function processData(locationData, substationData) {

    // loop through each substation record
    for (var i = 0; i < substationData.features.length; i++) {

      var props = substationData.features[i].properties;

      // calculate sum of array
      var sum = 0;

      // loop through each location record
      for (var j = 0; j < locationData.features.length; j++) {

        if (+props.FACILITYID === +locationData.features[j].properties.SUB) {
          var num = +locationData.features[j].properties.DISTGENSIZ;
          sum += num;
        }

      } // end of location loop

      // create new attribute to store sum
      props.totalGeneration = sum;

    } // end of substation loop

    drawMap(locationData, substationData);
    drawLegend(locationData, substationData);

  } // end of processData()

  // function to add tooltips
  function addTooltips(feature, layer) {
    var tooltip = "<b>Capacity: " + feature.properties.DISTGENSIZ + " kW</b>";
    layer.bindTooltip(tooltip);
  }


  // Draw the map
  function drawMap(layer1, layer2) {

    var commonOptions = {
      weight: 0.5,
      stroke: false,
      fillOpacity: 0.8
    }

    // add solar generation locations as layer
    var solarLayer = L.geoJSON(layer1, {
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, commonOptions);
      },
      filter: function(feature) {
        if (feature.properties.DISTGENTYP === "Solar" || feature.properties.DISTGENTYP === "Dual-S_W") {
          return feature;
        }
      },
      style: function(feature) {
        return {
          radius: locationRadius(+feature.properties.DISTGENSIZ),
          color: locSolarColor
        }
      },
      onEachFeature: function(feature, layer) {
        var tooltip = "<b>Capacity:</b> " + feature.properties.DISTGENSIZ + " kW";
        layer.bindTooltip(tooltip);
      }
    }).addTo(map);

    // add biomass generation locations as layer
    var bmLayer = L.geoJSON(layer1, {
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, commonOptions);
      },
      filter: function(feature) {
        if (feature.properties.DISTGENTYP === "BioMass") {
          return feature;
        }
      },
      style: function(feature) {
        return {
          radius: locationRadius(+feature.properties.DISTGENSIZ),
          color: locBmColor
        }
      },
      onEachFeature: function(feature, layer) {
        var tooltip = "<b>Capacity: " + feature.properties.DISTGENSIZ + " kW</b>";
        layer.bindTooltip(tooltip);
      }
    }).addTo(map);

    // add wind generation locations as layer
    var windLayer = L.geoJSON(layer1, {
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, commonOptions);
      },
      filter: function(feature) {
        if (feature.properties.DISTGENTYP === "Wind") {
          return feature;
        }
      },
      style: function(feature) {
        return {
          radius: locationRadius(feature.properties.DISTGENSIZ),
          color: locWindColor
        }
      },
      onEachFeature: function(feature, layer) {
        var tooltip = "<b>Capacity: " + feature.properties.DISTGENSIZ + " kW</b>";
        layer.bindTooltip(tooltip);
      }
    }).addTo(map);

    function colorSub(val) {

      if (val > 0) {
        return subPrimColor;
      } else {
        return subSecColor;
      }
    }

    // add substations as a layer
    var substationLayer = L.geoJSON(layer2, {
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, {
          radius: substationRadius(+feature.properties.totalGeneration),
          color: colorSub(+feature.properties.totalGeneration),
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        })
      }
    }).addTo(map);

    // array to pass leaflet layers
    var distGenArray = [bmLayer, solarLayer, windLayer];

    // layers for leaflet layer control
    var layersObject = {
      "<b style='color: #5cb572'>Bio Mass</b>": bmLayer,
      "<b style='color: #ff7800'>Solar</b>": solarLayer,
      "<b style='color: #65cece'>Wind</b>": windLayer,
    };

    L.control.layers(null, layersObject, {
      collapsed: false
    }).addTo(map);

    // bring substations to front
    map.on("overlayadd", function(event) {
      substationLayer.bringToFront();
    });

    retrieveInfo(substationLayer, distGenArray);


  } // end drawMap

  function retrieveInfo(substationLayer, distGenArray) {
    // select the element and reference with variable
    // and hide it from view initially
    var info = $('#info').hide();

    substationLayer.on('mouseover', function(e) {

      // remove the none class to display and show
      info.show();

      // access properties of target layer
      var props = e.layer.feature.properties;

      // populate HTML elements with relevant info
      $('.subName').css({
        'color': subPrimColor,
        'font-weight': 'bold'
      });
      $('.subTotal').css({
        'color': locSolarColor,
        'font-weight': 'bold'
      });
      $('.subName span').html(props.NAME).css({
        'color': 'black',
        'font-weight': 'normal'
      });
      $(".subTotal span").html(props.totalGeneration.toLocaleString() + " kW").css({
        'color': 'black',
        'font-weight': 'normal'
      });

      // raise opacity level as visual affordance
      e.layer.setStyle({
        fillOpacity: .4
      });

      // apply filter for only this substation's locations
      for (var i = 0; i < distGenArray.length; i++) {
        distGenArray[i].eachLayer(function(layer1) {
          if (layer1.feature.properties.SUB === props.FACILITYID) {
            layer1.setStyle({
              fillOpacity: .8
            })
          } else {
            layer1.setStyle({
              fillOpacity: 0,
              stroke: true,
              opacity: 1,
              weight: 0.2
            })
          }
        })
      }

    });

    substationLayer.on('mouseout', function(e) {

      info.hide();

      e.layer.setStyle({
        fillOpacity: 0.8
      });

      // restore locations
      for (var i = 0; i < distGenArray.length; i++) {
        distGenArray[i].eachLayer(function(layer1) {
          layer1.setStyle({
            fillOpacity: .8,
            stroke: false
          })
        })
      }

    });

  } // end retrieveInfo()

  function drawLegend(locationData, substationData) {
    // create leaflet control for the legend
    var legendControl = L.control({
      position: 'bottomright'
    });

    // when the control is added to the map
    legendControl.onAdd = function(map) {

      // select the legend using id attribute of legend
      var legend = L.DomUtil.get("legend");

      // disable scroll and click functionality
      L.DomEvent.disableScrollPropagation(legend);
      L.DomEvent.disableClickPropagation(legend);

      // return the selection
      return legend;

    }

    legendControl.addTo(map);

    // loop through all location features
    var locationValues = locationData.features.map(function(location) {
      // for each
      for (var kw in location.properties) {
        return location.properties.DISTGENSIZ;
      }
    });

    // sort the array
    var sortedLocValues = locationValues.sort(function(a, b) {
      return b - a;
    });

    // round the highest number and use as large circle diameter
    var maxLocValue = Math.round((sortedLocValues[0] / 1000) * 1000);

    // calculate diameters
    var locLargeDiameter = locationRadius(maxLocValue) * 2,
      locSmallDiameter = locLargeDiameter / 2;

    // loop through all substation features
    var substationValues = substationData.features.map(function(substation) {
      // for each
      for (var kw in substation.properties) {
        return substation.properties.totalGeneration;
      }
    });

    // sort the array
    var sortedSubValues = substationValues.sort(function(a, b) {
      return b - a;
    });

    // round the highest number and use as large circle diameter
    var maxSubValue = Math.round(sortedSubValues[0] / 1000) * 1000;

    // calculate diameters
    var subLargeDiameter = substationRadius(maxSubValue) * 2,
      subSmallDiameter = subLargeDiameter / 2;

    // select the sub circles container and set the height
    $(".legend-sub-circles").css('height', subLargeDiameter.toFixed());

    // set width and height for large sub circle
    $(".legend-large-sub").css({
      'width': subLargeDiameter.toFixed(),
      'height': subLargeDiameter.toFixed(),
      'color': subPrimColor,
      'border-width': 2
    });

    // set width and height for small sub circle and position
    $(".legend-small-sub").css({
      'width': subSmallDiameter.toFixed(),
      'height': subSmallDiameter.toFixed(),
      'top': (subLargeDiameter - subSmallDiameter) - 2,
      'left': (subSmallDiameter / 2) - 2,
      'border-color': subPrimColor,
      'border-width': 2
    });

    // label the max and median value
    $(".legend-large-sub-label").html(maxSubValue.toLocaleString());
    $(".legend-small-sub-label").html((maxSubValue / 2).toLocaleString());
    $(".legend-sub-title").html("Substations");

    // adjust position of title
    $(".legend-sub-title").css({
      'top': 36,
      'left': 20,
    });

    // adjust the postion of the large based on size of circle
    $(".legend-large-sub-label").css({
      'top': 59,
      'left': subLargeDiameter + 20,
    });

    // adjust the position of the small based on size of circle
    $(".legend-small-sub-label").css({
      'top': 100,
      'left': subLargeDiameter + 20,
    });

    // select the location circles container and set the height
    $(".legend-loc-circles").css({
      'height': locLargeDiameter.toFixed(),
      'padding-top': 15,
      'padding-left': 30
    });

    // set width and height for large loc circle
    $(".legend-large-loc").css({
      'width': locLargeDiameter.toFixed(),
      'height': locLargeDiameter.toFixed(),
      'border-color': locSolarColor,
      'border-width': 2
    });

    // set width and height for small loc circle and position
    $(".legend-small-loc").css({
      'width': locSmallDiameter.toFixed(),
      'height': locSmallDiameter.toFixed(),
      'top': (locLargeDiameter - locSmallDiameter) - 3,
      'left': (locSmallDiameter / 2) - 2,
      'border-color': locSolarColor,
      'border-width': 2
    });

    // label the max and median value, and title
    $(".legend-large-loc-label").html(maxLocValue.toLocaleString());
    $(".legend-small-loc-label").html((maxLocValue / 2).toLocaleString());
    $(".legend-loc-title").html("Locations");

    // adjust the position of the title
    $(".legend-loc-title").css({
      'top': 36,
      'right': 35
    });

    // adjust the postion of the large based on size of circle
    $(".legend-large-loc-label").css({
      'top': 66,
      'right': locLargeDiameter - 17,
    });

    // adjust the position of the small based on size of circle
    $(".legend-small-loc-label").css({
      'top': 95,
      'right': locLargeDiameter - 27,
    });

  } // end drawLegend()

  // visual affordance on locate button
  $("#locate").on('mouseover', function() {
    $("#locate").css({
      'background-color': '#9d7bb7'
    });
  });

  // remove visual affordance
  $("#locate").on('mouseout', function() {
    $("#locate").css({
      'background-color': '#7a5596'
    });
  });

  // create empty variable for theLocation
  var theLocation = {};

  // click locate button, get location
  $("#locate").on('click', function() {
    map.locate({
      setView: true,
      maxZoom: 19
    });
  });

  // update theLocation with marker
  map.on('locationfound', function(e) {
    theLocation = L.marker(e.latlng).addTo(map).bindPopup("This is your location").openPopup();
  });

  // report error if locate failed
  map.on('locationerror', function() {
    console.log("Error finding location");
  });

  // remove location marker with click
  map.on('click', function() {
    map.removeLayer(theLocation);
  });


})(); // end app.js
