(function () {
  'use strict';

  function initEarthquakes() {
    var mapContainer = document.getElementById('earthquake-map');
    if (!mapContainer || typeof L === 'undefined') return;

    var stationLat = parseFloat(mapContainer.dataset.lat) || 0;
    var stationLon = parseFloat(mapContainer.dataset.lon) || 0;
    var radiusKm = parseFloat(mapContainer.dataset.radius) || 300;
    var minMag = parseFloat(mapContainer.dataset.minmag) || 2.5;
    var timespanDays = parseInt(mapContainer.dataset.timespan, 10) || 7;
    var basemap = (mapContainer.dataset.basemap || 'osm').toLowerCase();
    var customTileUrl = mapContainer.dataset.tileUrl || '';

    // Detect dark theme
    var isDark = document.body.classList.contains('dark-theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    var map = L.map('earthquake-map', {
      center: [stationLat, stationLon],
      zoom: 6,
      minZoom: 3,
      maxZoom: 14,
      scrollWheelZoom: false
    });

    if (basemap === 'vector') {
      // 100% offline bundled vector basemap (no external tile requests)
      if (window.NEOWX_WORLD_LAND) {
        L.geoJSON(window.NEOWX_WORLD_LAND, {
          style: function () {
            return {
              fillColor: isDark ? '#2e3951' : '#e0e4eb',
              fillOpacity: 1,
              color: isDark ? '#3f4f6e' : '#b0b8c5',
              weight: 1.2
            };
          }
        }).addTo(map);
      }
    } else {
      // OpenStreetMap - completely open data, zero API keys, no registration required
      var tileUrl = customTileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

      L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map);
    }

    var themeColorName = (mapContainer.dataset.themeColor || 'indigo').toLowerCase();
    var themeColors = {
      'red': '#f44336', 'pink': '#e91e63', 'purple': '#9c27b0', 'deep-purple': '#673ab7',
      'indigo': '#3f51b5', 'blue': '#2196f3', 'light-blue': '#03a9f4', 'cyan': '#00bcd4',
      'teal': '#009688', 'green': '#4caf50', 'light-green': '#8bc34a', 'lime': '#cddc39',
      'yellow': '#ffeb3b', 'amber': '#ffc107', 'orange': '#ff9800', 'deep-orange': '#ff5722',
      'brown': '#795548', 'grey': '#9e9e9e', 'blue-grey': '#607d8b'
    };
    var primaryHex = themeColors[themeColorName] || '#3f51b5';

    // Station marker
    var stationIcon = L.divIcon({
      className: 'station-pin-marker',
      html: '<div style="background-color:' + primaryHex + ';color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.4);border:2px solid #fff;"><i class="fas fa-broadcast-tower" style="font-size:11px;"></i></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    L.marker([stationLat, stationLon], { icon: stationIcon })
      .addTo(map)
      .bindPopup('<strong>' + (mapContainer.dataset.stationName || 'Weather Station') + '</strong><br>Lat: ' + stationLat.toFixed(4) + ', Lon: ' + stationLon.toFixed(4));

    // Coverage radius circle
    var coverageCircle = L.circle([stationLat, stationLon], {
      radius: radiusKm * 1000,
      color: primaryHex,
      weight: 1.5,
      dashArray: '4, 4',
      fillColor: primaryHex,
      fillOpacity: 0.05
    }).addTo(map);

    // Fit map bounds neatly to the station coverage area
    map.fitBounds(coverageCircle.getBounds(), { padding: [15, 15] });
    setTimeout(function () {
      map.invalidateSize();
    }, 150);

    function getMagColor(mag) {
      if (mag >= 5.0) return '#d32f2f'; // red
      if (mag >= 4.0) return '#f57c00'; // dark orange
      if (mag >= 3.0) return '#ffa000'; // amber
      return '#388e3c';                // green
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
      var R = 6371; // km
      var dLat = (lat2 - lat1) * Math.PI / 180;
      var dLon = (lon2 - lon1) * Math.PI / 180;
      var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    // Build USGS API URL
    var startTime = new Date(Date.now() - timespanDays * 86400 * 1000).toISOString();
    var apiUrl = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
      '&latitude=' + stationLat +
      '&longitude=' + stationLon +
      '&maxradiuskm=' + radiusKm +
      '&minmagnitude=' + minMag +
      '&starttime=' + startTime +
      '&orderby=time';

    var cacheKey = 'neowx_earthquakes_cache_' + stationLat + '_' + stationLon + '_' + radiusKm + '_' + minMag;
    var cached = null;
    try {
      var item = localStorage.getItem(cacheKey);
      if (item) {
        var parsed = JSON.parse(item);
        if (Date.now() - parsed.timestamp < 15 * 60 * 1000) { // 15 min TTL
          cached = parsed.data;
        }
      }
    } catch (e) {}

    if (cached) {
      renderData(cached);
    } else {
      fetch(apiUrl)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              timestamp: Date.now(),
              data: data
            }));
          } catch (e) {}
          renderData(data);
        })
        .catch(function (err) {
          var listEl = document.getElementById('earthquake-list');
          if (listEl) {
            listEl.innerHTML = '<div class="alert alert-warning font-small m-3">Could not load earthquake data: ' + err.message + '</div>';
          }
        });
    }

    function renderData(data) {
      var features = (data && data.features) ? data.features : [];
      var listEl = document.getElementById('earthquake-list');
      var countEl = document.getElementById('quake-total-count');
      var maxMagEl = document.getElementById('quake-max-mag');
      var latestEl = document.getElementById('quake-latest-time');

      if (countEl) countEl.innerText = features.length;

      var maxMag = 0;
      var latestTime = null;
      var markersMap = {};

      if (features.length === 0) {
        if (listEl) {
          listEl.innerHTML = '<div class="p-3 text-muted font-small text-center">No earthquakes &ge; M' + minMag + ' recorded within ' + radiusKm + ' km in the past ' + timespanDays + ' days.</div>';
        }
        if (maxMagEl) maxMagEl.innerText = '-';
        if (latestEl) latestEl.innerText = '-';
        return;
      }

      var html = '<div class="list-group list-group-flush">';

      features.forEach(function (feat, idx) {
        var props = feat.properties;
        var coords = feat.geometry.coordinates; // [lon, lat, depth]
        var qLon = coords[0];
        var qLat = coords[1];
        var qDepth = coords[2];
        var mag = props.mag !== null ? props.mag.toFixed(1) : '?';
        var magNum = props.mag || 0;
        if (magNum > maxMag) maxMag = magNum;
        if (!latestTime || props.time > latestTime) latestTime = props.time;

        var distKm = calculateDistance(stationLat, stationLon, qLat, qLon);
        var distMiles = distKm * 0.621371;
        var color = getMagColor(magNum);
        var radius = Math.max(5, Math.min(22, (magNum * 3.5)));
        var dateStr = new Date(props.time).toLocaleString();

        var marker = L.circleMarker([qLat, qLon], {
          radius: radius,
          fillColor: color,
          color: '#ffffff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.75
        }).addTo(map);

        var popupContent = '<div class="font-small"><strong>M ' + mag + ' - ' + props.place + '</strong><br>' +
          'Depth: ' + qDepth.toFixed(1) + ' km<br>' +
          'Distance: ' + distMiles.toFixed(1) + ' mi (' + distKm.toFixed(1) + ' km)<br>' +
          'Time: ' + dateStr + '<br>' +
          '<a href="' + props.url + '" target="_blank" rel="noopener" class="font-weight-bold mt-1 d-inline-block">View on USGS &rarr;</a></div>';

        marker.bindPopup(popupContent);
        markersMap[props.url || idx] = marker;

        html += '<a href="javascript:void(0)" class="list-group-item list-group-item-action p-2 quake-item" data-id="' + (props.url || idx) + '" data-lat="' + qLat + '" data-lon="' + qLon + '">' +
          '<div class="d-flex w-100 justify-content-between align-items-center">' +
          '<span class="badge badge-pill text-white mr-2" style="background-color:' + color + ';font-size:0.9rem;min-width:44px;">M ' + mag + '</span>' +
          '<div class="flex-grow-1 text-truncate font-small">' +
          '<div class="text-truncate font-weight-bold">' + props.place + '</div>' +
          '<div class="text-muted font-small">' + distMiles.toFixed(1) + ' mi away &bull; depth ' + qDepth.toFixed(1) + ' km</div>' +
          '</div>' +
          '<span class="text-muted font-small ml-2 text-nowrap">' + new Date(props.time).toLocaleDateString([], { month: 'short', day: 'numeric' }) + '</span>' +
          '</div>' +
          '</a>';
      });

      html += '</div>';

      if (listEl) {
        listEl.innerHTML = html;

        listEl.querySelectorAll('.quake-item').forEach(function (itemEl) {
          itemEl.addEventListener('click', function () {
            var id = this.dataset.id;
            var lat = parseFloat(this.dataset.lat);
            var lon = parseFloat(this.dataset.lon);
            map.flyTo([lat, lon], Math.max(map.getZoom(), 8), { duration: 0.8 });
            if (markersMap[id]) {
              markersMap[id].openPopup();
            }
          });
        });
      }

      if (maxMagEl) maxMagEl.innerText = 'M ' + maxMag.toFixed(1);
      if (latestEl && latestTime) {
        latestEl.innerText = new Date(latestTime).toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEarthquakes);
  } else {
    initEarthquakes();
  }
})();
