import React, { useRef, useEffect, useState, useMemo } from 'react';
import './App.css';
import mapboxgl from 'mapbox-gl';
import Papa from "papaparse";
import shipDataCsv from './data/geo_stats_data_7_days.csv';
import portDataCsv from './data/port_geo_location.csv';
import portimgssrc from './images/port.png';
import shipimagesrc from './images/ship.png';

mapboxgl.accessToken = 'pk.eyJ1IjoiZXNwYWNlc2VydmljZSIsImEiOiJjbHZ1dHZjdTQwMDhrMm1uMnoxdWRibzQ4In0.NaprcMBbdX07f4eXXdr-lw';

const MapComponent = React.memo(({ portData, shipData }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(82);
  const [lat, setLat] = useState(21);
  const [zoom, setZoom] = useState(2.5);
  const [shipTime, setShipTime] = useState(''); // State variable to store ship times

  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: zoom,
    });

    map.current.on('move', () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(1));
    });

    // Wait for the map's style to load before adding sources and layers
    map.current.on('style.load', () => {
      addPortsLayer();
      addShipsLayer();
    });

    return () => map.current.remove();
  }, []);

  const addPortsLayer = () => {
    const portsSource = map.current.getSource('ports');

    if (!portsSource) {
      map.current.addSource('ports', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: portData.map(port => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [parseFloat(port.geo_location_longitude), parseFloat(port.geo_location_latitude)],
            },
            properties: {
              name: port.port_name,
            },
          })),
        },
      });

      map.current.addLayer({
        id: 'ports',
        type: 'symbol',
        source: 'ports',
        layout: {
          'icon-image': 'port-icon',
          'icon-allow-overlap': true,
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 1],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#007cbf',
        },
      });

      map.current.loadImage(portimgssrc, (error, image) => {
        if (error) throw error;
        map.current.addImage('port-icon', image, { width: 25, height: 25 });
      });
    }
  };

  const addShipsLayer = () => {
    if (Object.keys(shipData).length === 0) return;

    // Iterate through each ship
    Object.keys(shipData).forEach(shipId => {
      const dataPoints = shipData[shipId];
      let currentIndex = 0;

      // Function to move the ship and update ship time
      const moveShip = () => {
        const currentPoint = dataPoints[currentIndex];
        if (currentPoint) {
          console.log(`Moving ship ${shipId} to point ${currentIndex + 1}/${dataPoints.length}`);
          console.log(`New coordinates: [${currentPoint.location_longitude}, ${currentPoint.location_latitude}]`);

          // Update ship time
          setShipTime(currentPoint.ec_timestamp.toString());

          const shipFeature = {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [currentPoint.location_longitude, currentPoint.location_latitude],
            },
            properties: {
              name: shipId,
            },
          };

          const source = map.current.getSource(shipId);
          if (source) {
            source.setData({
              type: 'FeatureCollection',
              features: [shipFeature],
            });
          } else {
            map.current.addSource(shipId, {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: [shipFeature],
              },
            });

            map.current.addLayer({
              id: shipId,
              type: 'symbol',
              source: shipId,
              layout: {
                'icon-image': 'ship-icon',
                'icon-allow-overlap': true,
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                'text-offset': [0, 1],
                'text-anchor': 'top',
              },
              paint: {
                'text-color': '#ff0000',
              },
            });

            map.current.loadImage(shipimagesrc, (error, image) => {
              if (error) throw error;
              map.current.addImage('ship-icon', image);
            });
          }

          currentIndex++;
          if (currentIndex < 1440) {
            setTimeout(moveShip, 1); // Move to the next point after 1 ms
          } else {
            console.log(`Ship ${shipId} reached its final destination.`);
          }
        }
      };

      // Start moving the ship
      moveShip();
    });
  };

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <div className="sidebar">
        Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
      </div>
      <div ref={mapContainer} style={{ height: '100%' }} />
      {/* Display ship times */}
      <div style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgb(35 55 75 / 90%)', color: '#fff', padding: '6px 12px', fontFamily: 'monospace', borderRadius: 4 }}>
        <div>Time: {shipTime}</div>
      </div>
    </div>
  );
});

function App() {
  const [portData, setPortData] = useState([]);
  const [shipData, setShipData] = useState({});

  const memoizedParseCsv = useMemo(() => {
    return (csvData, options) => {
      return new Promise((resolve) => {
        Papa.parse(csvData, {
          ...options,
          complete: (result) => resolve(result.data),
        });
      });
    };
  }, []);

  useEffect(() => {
    const parsePortData = async () => {
      const parsedPortData = await memoizedParseCsv(portDataCsv, { header: true, download: true });
      setPortData(parsedPortData);
    };

    parsePortData();
  }, [memoizedParseCsv]);

  useEffect(() => {
    const parseShipData = async () => {
      const parsedShipData = await memoizedParseCsv(shipDataCsv, { header: true, download: true });

      const shipData = {};
      parsedShipData.forEach((row) => {
        const shipId = row.site_name;
        if (!shipData[shipId]) {
          shipData[shipId] = [];
        }
        shipData[shipId].push({
          location_latitude: parseFloat(row.location_latitude),
          location_longitude: parseFloat(row.location_longitude),
          heading: parseFloat(row.heading),
          ec_timestamp: new Date(row.ec_timestamp),
        });
      });

      Object.keys(shipData).forEach((shipId) => {
        shipData[shipId].sort((a, b) => a.ec_timestamp - b.ec_timestamp);
      });

      setShipData(shipData);
    };

    parseShipData();
  }, [memoizedParseCsv]);

  return portData.length > 0 && Object.keys(shipData).length > 0 ? (
    <MapComponent portData={portData} shipData={shipData} />
  ) : (
    <div>Loading...</div>
  );
}

export default App;
