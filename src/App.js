import React, { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import Overlay from 'ol/Overlay';
import { defaults as defaultControls, ScaleLine, ZoomSlider } from 'ol/control';
import { get as getProjection } from 'ol/proj';
import './App.css';

function App() {
  const mapRef = useRef();
  const [map, setMap] = useState(null);
  // Removed statesLayer and countriesLayer as requested
  const [currentBasemap, setCurrentBasemap] = useState('osm');
  const [reportAreaAtcoLayer, setReportAreaAtcoLayer] = useState(null);
  const [reportAreaAtcoVisible, setReportAreaAtcoVisible] = useState(false);
  const [breadcrumbAtcoLayer, setBreadcrumbAtcoLayer] = useState(null);
  const [breadcrumbAtcoVisible, setBreadcrumbAtcoVisible] = useState(false);
  const [breadcrumbSummitLayer, setBreadcrumbSummitLayer] = useState(null);
  const [breadcrumbSummitVisible, setBreadcrumbSummitVisible] = useState(false);
  const [popupContent, setPopupContent] = useState('');
  const [popupCoord, setPopupCoord] = useState(null);
  const popupRef = useRef();

  useEffect(() => {
    if (!mapRef.current) return;

    // BBOX for pcubedgis:breadcrumbsummit (EPSG:3857)
    // Example: bbox from your URL: -105.5372543334961,33.014366149902344,-69.63994598388672,44.532230377197266
    // But these are still in 4326, so let's use a typical Web Mercator bbox for the US
    // For best results, you should use the actual extent of your data in 3857
    const bbox = [-11705274, 2810331, -7453304, 5635547]; // approx US in EPSG:3857
    const center = [
      (bbox[0] + bbox[2]) / 2,
      (bbox[1] + bbox[3]) / 2
    ];

    // Removed statesLayer and countriesLayer creation as requested
    // WMS layer for Report Area ATCO (EPSG:3857)
    const reportAreaSource = new ImageWMS({
      url: 'http://localhost:8080/geoserver/pcubedgis/wms',
      params: {
        'LAYERS': 'pcubedgis:reportarea_atco',
        'VERSION': '1.1.0',
        'FORMAT': 'image/png',
        'TRANSPARENT': true,
        'SRS': 'EPSG:3857',
        'STYLES': ''
      },
      serverType: 'geoserver',
      crossOrigin: 'anonymous'
    });
    const reportAreaLayerInstance = new ImageLayer({
      source: reportAreaSource,
      visible: false
    });

    // WMS layer for Breadcrumb ATCO (EPSG:3857)
    const breadcrumbSource = new ImageWMS({
      url: 'http://localhost:8080/geoserver/pcubedgis/wms',
      params: {
        'LAYERS': 'pcubedgis:breadcrumb_atco',
        'VERSION': '1.1.0',
        'FORMAT': 'image/png',
        'TRANSPARENT': true,
        'SRS': 'EPSG:3857',
        'STYLES': ''
      },
      serverType: 'geoserver',
      crossOrigin: 'anonymous'
    });
    const breadcrumbLayerInstance = new ImageLayer({
      source: breadcrumbSource,
      visible: false
    });


    // WMS layer for Breadcrumb Summit (EPSG:3857)
    const breadcrumbSourceSummit = new ImageWMS({
      url: 'http://localhost:8080/geoserver/pcubedgis/wms',
      params: {
        'LAYERS': 'pcubedgis:breadcrumbsummit',
        'VERSION': '1.1.0',
        'FORMAT': 'image/png',
        'TRANSPARENT': true,
        'SRS': 'EPSG:3857',
        'STYLES': ''
      },
      serverType: 'geoserver',
      crossOrigin: 'anonymous'
    });
    const breadcrumbLayerInstanceSummit = new ImageLayer({
      source: breadcrumbSourceSummit,
      visible: false
    });

    setReportAreaAtcoLayer(reportAreaLayerInstance);
    setBreadcrumbAtcoLayer(breadcrumbLayerInstance);
    setBreadcrumbSummitLayer(breadcrumbLayerInstanceSummit);

    // Base layers
    const osmLayer = new TileLayer({
      source: new OSM(),
      visible: true
    });
    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        crossOrigin: 'anonymous'
      }),
      visible: false
    });
    const streetsLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        crossOrigin: 'anonymous'
      }),
      visible: false
    });


    // Create map
    const mapInstance = new Map({
      target: mapRef.current,
      layers: [
        osmLayer,
        satelliteLayer,
        streetsLayer,
        reportAreaLayerInstance,
        breadcrumbLayerInstance,
        breadcrumbLayerInstanceSummit
      ],
      view: new View({
        projection: getProjection('EPSG:3857'),
        center: center,
        zoom: 4,
        maxZoom: 18,
        minZoom: 2
      }),
      controls: defaultControls().extend([
        new ScaleLine(),
        new ZoomSlider()
      ])
    });

    setMap(mapInstance);

    // Fit the view to the BBOX
    mapInstance.getView().fit(bbox, { size: mapInstance.getSize(), projection: getProjection('EPSG:3857') });

    // Add popup overlay
    const popupOverlay = new Overlay({
      element: popupRef.current,
      autoPan: true,
      autoPanAnimation: { duration: 250 }
    });
    mapInstance.addOverlay(popupOverlay);

    // Map click handler for GetFeatureInfo
    mapInstance.on('singleclick', async (evt) => {
      let activeSource, url;
      if (reportAreaLayerInstance.getVisible()) {
        activeSource = reportAreaSource;
      } else if (breadcrumbLayerInstance.getVisible()) {
        activeSource = breadcrumbSource;
      } else if (breadcrumbLayerInstanceSummit.getVisible()) {
        activeSource = breadcrumbSourceSummit;
      } else {
        setPopupContent('');
        setPopupCoord(null);
        popupOverlay.setPosition(undefined);
        return;
      }
      url = activeSource.getFeatureInfoUrl(
        evt.coordinate,
        mapInstance.getView().getResolution(),
        mapInstance.getView().getProjection(),
        { 'INFO_FORMAT': 'text/html', 'FEATURE_COUNT': 1 }
      );
      if (url) {
        const response = await fetch(url);
        const data = await response.text();
        setPopupContent(data);
        setPopupCoord(evt.coordinate);
        popupOverlay.setPosition(evt.coordinate);
      } else {
        setPopupContent('');
        setPopupCoord(null);
        popupOverlay.setPosition(undefined);
      }
    });

    return () => {
      if (mapInstance) {
        mapInstance.setTarget(undefined);
      }
    };
  }, []);

  // Basemap switching
  const changeBasemap = (basemapType) => {
    if (!map) return;
    const layers = map.getLayers();
    layers.getArray().forEach((layer, index) => {
      if (index < 3) {
        layer.setVisible(false);
      }
    });
    switch (basemapType) {
      case 'osm':
        layers.getArray()[0].setVisible(true);
        break;
      case 'satellite':
        layers.getArray()[1].setVisible(true);
        break;
      case 'streets':
        layers.getArray()[2].setVisible(true);
        break;
      default:
        layers.getArray()[0].setVisible(true);
    }
    setCurrentBasemap(basemapType);
  };

  // Removed handleStatesLayerChange and handleCountriesLayerChange as requested


  const handleReportAreaAtcoLayerChange = (e) => {
    if (reportAreaAtcoLayer && breadcrumbAtcoLayer && breadcrumbSummitLayer) {
      if (e.target.checked) {
        reportAreaAtcoLayer.setVisible(true);
        setReportAreaAtcoVisible(true);
        breadcrumbAtcoLayer.setVisible(false);
        setBreadcrumbAtcoVisible(false);
        breadcrumbSummitLayer.setVisible(false);
        setBreadcrumbSummitVisible(false);
      } else {
        reportAreaAtcoLayer.setVisible(false);
        setReportAreaAtcoVisible(false);
      }
    }
  };

  const handleBreadcrumbAtcoLayerChange = (e) => {
    if (breadcrumbAtcoLayer && reportAreaAtcoLayer && breadcrumbSummitLayer) {
      if (e.target.checked) {
        breadcrumbAtcoLayer.setVisible(true);
        setBreadcrumbAtcoVisible(true);
        reportAreaAtcoLayer.setVisible(false);
        setReportAreaAtcoVisible(false);
        breadcrumbSummitLayer.setVisible(false);
        setBreadcrumbSummitVisible(false);
      } else {
        breadcrumbAtcoLayer.setVisible(false);
        setBreadcrumbAtcoVisible(false);
      }
    }
  };

  const handleBreadcrumbSummitLayerChange = (e) => {
    if (breadcrumbSummitLayer && reportAreaAtcoLayer && breadcrumbAtcoLayer) {
      if (e.target.checked) {
        breadcrumbSummitLayer.setVisible(true);
        setBreadcrumbSummitVisible(true);
        reportAreaAtcoLayer.setVisible(false);
        setReportAreaAtcoVisible(false);
        breadcrumbAtcoLayer.setVisible(false);
        setBreadcrumbAtcoVisible(false);
      } else {
        breadcrumbSummitLayer.setVisible(false);
        setBreadcrumbSummitVisible(false);
      }
    }
  };

  return (
    <div className="App">
      <div ref={mapRef} className="map-container" />

      {/* Base Map Gallery */}
      <div className="basemap-gallery styled-panel">
        <h3>Base Maps</h3>
        <button
          className={currentBasemap === 'osm' ? 'active' : ''}
          onClick={() => changeBasemap('osm')}
        >
          OpenStreetMap
        </button>
        <button
          className={currentBasemap === 'satellite' ? 'active' : ''}
          onClick={() => changeBasemap('satellite')}
        >
          Satellite
        </button>
        <button
          className={currentBasemap === 'streets' ? 'active' : ''}
          onClick={() => changeBasemap('streets')}
        >
          Streets
        </button>
      </div>

      {/* Layer Controls */}
      <div className="layer-controls styled-panel">
        <h3>Layers</h3>
        {/* Removed States Layer and Countries Layer controls as requested */}
        <label>
          <input
            type="checkbox"
            checked={reportAreaAtcoVisible}
            onChange={handleReportAreaAtcoLayerChange}
          />
          Report Area ATCO
        </label>
        <label>
          <input
            type="checkbox"
            checked={breadcrumbAtcoVisible}
            onChange={handleBreadcrumbAtcoLayerChange}
          />
          Breadcrumb ATCO
        </label>
        <label>
          <input
            type="checkbox"
            checked={breadcrumbSummitVisible}
            onChange={handleBreadcrumbSummitLayerChange}
          />
          Breadcrumb Summit
        </label>
      </div>
     {/* Popup Overlay */}
     <div
       ref={popupRef}
       className={`ol-popup modern-popup${popupCoord ? '' : ' hidden'}`}
     >
       <div className="popup-titlebar">
         <span className="popup-title">Feature Info</span>
         <button
           className="popup-close"
           onClick={e => { e.preventDefault(); setPopupCoord(null); setPopupContent(''); }}
           aria-label="Close popup"
         >×</button>
       </div>
       <div className="popup-content">
         <div dangerouslySetInnerHTML={{ __html: popupContent }} />
       </div>
       <div className="popup-pointer" />
     </div>
    </div>
  );
}

export default App; 