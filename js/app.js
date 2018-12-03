(function() {

  var map = L.map('map', {
    zoomSnap: .1,
    center: [39.4, -105],
    zoom: 9,
    minZoom: 8,
    maxZoom: 13,
    maxBounds: L.latLngBounds([37.8, -107.5], [40.9, -102.0])
  });

  // add basemap
  var tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
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
    return radius * 1.7; // adjust the scale

  } // end of locationRadius()

  // calculating radius of substation points
  function substationRadius(val) {

    var radius = Math.sqrt(val / Math.PI);
    return radius * 0.8;

  } // end of substationRadius()

  function processData(locationData, substationData) {

    // loop through each substation record
    for (var i = 0; i < substationData.features.length; i++) {

      var props = substationData.features[i].properties;
      var locationArray = [0];

      // loop through each location record
      for (var j = 0; j < locationData.features.length; j++) {

        if (Number(props.FACILITYID) === Number(locationData.features[j].properties.SUB)) {

          locationArray.push(Number(locationData.features[j].properties.DISTGENSIZ));
        }

      } // end of location loop

      // calculate sum of array
      var sum = 0;

      for (k = 0; k < locationArray.length; k++) {
        sum = sum + Number(locationArray[k]);
      }

      // create new attribute to store sum
      props.totalGeneration = Number(sum);

    } // end of substation loop

    drawMap(locationData, substationData);
    drawLegend(locationData, substationData);

  } // end of processData()


  // Draw the map
  function drawMap(layer1, layer2) {

    // starter options
    var locationOptions = {
      radius: 4,
      fillColor: '#ff7800',
      color: '#000',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    };

    var substationOptions = {
      radius: 8,
      fillColor: '#4790F9',
      color: '#000',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    };

    // add distributed generation as a layer
    var distGenLayer = L.geoJSON(layer1, {
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, locationOptions)
      }
    }).addTo(map);

    // add substations as a layer
    var substationLayer = L.geoJSON(layer2, {
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, substationOptions)
      }
    }).addTo(map);

    resizeCircles(distGenLayer, substationLayer);

  } // end drawMap

  // RESIZING CIRCLES
  function resizeCircles(distGenLayer, substationLayer) {

    distGenLayer.eachLayer(function(layer) {
      var radius = locationRadius(Number(layer.feature.properties.DISTGENSIZ));
      layer.setRadius(radius);
    });
    substationLayer.eachLayer(function(layer) {
      if (Number(layer.feature.properties.totalGeneration > 0)) {
        var radius = substationRadius(Number(layer.feature.properties.totalGeneration));
        layer.setRadius(radius);
      } else {
        layer.setStyle({
          fillColor: '#DFDFDF',
          radius: 3
        });
      }

    });

    retrieveInfo(substationLayer, distGenLayer);

  } // end resizeCircles()

  function retrieveInfo(substationLayer, distGenLayer) {
    // select the element and reference with variable
    // and hide it from view initially
    var info = $('#info').hide();

    // since boysLayer is on top, use to detect mouseover events
    substationLayer.on('mouseover', function(e) {

      // remove the none class to display and show
      info.show();

      // access properties of target layer
      var props = e.layer.feature.properties;

      // populate HTML elements with relevant info
      $('.subName span').html(props.NAME);
      $(".subTotal span").html(props.totalGeneration.toLocaleString());

      // raise opacity level as visual affordance
      e.layer.setStyle({
        fillOpacity: .6
      });

      // apply filter for only this substation's locations
      distGenLayer.eachLayer(function(layer1) {
        if (layer1.feature.properties.SUB === props.FACILITYID) {
          layer1.setStyle({
            fillOpacity: .8
          })
        } else {
          layer1.setStyle({
            fillOpacity: 0,
            opacity: 0
          })
        }
      })

    });

    substationLayer.on('mouseout', function(e) {

      info.hide();

      e.layer.setStyle({
        fillOpacity: 0.8
      });

      // restore locations
      distGenLayer.eachLayer(function(layer1) {
        layer1.setStyle({
          fillOpacity: .8,
          opacity: 1
        })
      })

    });

    // $(document).mousemove(function(e) {
    //   // first offset from the mouse position of the info window
    //   info.css({
    //     "left": e.pageX + 6,
    //     "top": e.pageY - info.height() - 25
    //   });
    //
    //   // if it crashes into the top, flip it lower right
    //   if (info.offset().top < 4) {
    //     info.css({
    //       "top": e.pageY + 15
    //     });
    //   }
    //   // if it crashes into the right, flip it to the left
    //   if (info.offset().left + info.width() >= $(document).width() - 40) {
    //     info.css({
    //       "left": e.pageX - info.width() - 80
    //     });
    //   }
    // });

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
    var locationValues = locationData.features.map(function (location) {
      // for each
      for (var kw in location.properties) {
        return location.properties.DISTGENSIZ;
      }

    });
    console.log(locationValues);

    // loop through all substation features
    var substationValues = substationData.features.map(function (substation) {
      // for each
      for (var kw in substation.properties) {
        return substation.properties.totalGeneration;
      }

    });
    console.log(substationValues);

  } // end drawLegend()

})(); // end app.js
