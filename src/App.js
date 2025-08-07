import React, { useState, useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import ImageWMS from 'ol/source/ImageWMS';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import Draw from 'ol/interaction/Draw';
import { Fill, Stroke, Style } from 'ol/style';
import { transform } from 'ol/proj';
import './App.css';

function App() {
  const mapRef = useRef();
  const [map, setMap] = useState(null);
  const [currentBasemap, setCurrentBasemap] = useState('osm');
  const [reportAreaVisible, setReportAreaVisible] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingSource, setDrawingSource] = useState(null);
  const [drawingLayer, setDrawingLayer] = useState(null);
  const [drawingInteraction, setDrawingInteraction] = useState(null);
  const [filteredFeatures, setFilteredFeatures] = useState([]);
  const [isFeatureTableCollapsed, setIsFeatureTableCollapsed] = useState(false); // Show by default
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState('Picarro:Boundary');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [originalReportAreaSource, setOriginalReportAreaSource] = useState(null);
  const [filteredReportAreaSource, setFilteredReportAreaSource] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState({});
  const [activeTab, setActiveTab] = useState('Picarro:Boundary');
  const [layerResults, setLayerResults] = useState({});

  const RECORDS_PER_PAGE = 10;

  // Available layers for filtering
  const availableLayers = [
    { id: 'Picarro:Boundary', name: 'Boundary', visible: true },
    { id: 'Picarro:OtherLayer', name: 'Other Layer', visible: false },
    // Add more layers here as needed
  ];

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create drawing source and layer
    const drawingSourceInstance = new VectorSource();
    const drawingLayerInstance = new VectorLayer({
      source: drawingSourceInstance,
      style: new Style({
        fill: new Fill({ color: 'rgba(255, 0, 0, 0.3)' }),
        stroke: new Stroke({ color: '#ff0000', width: 3 })
      }),
      visible: true,
      zIndex: 1000
    });

    // Create Report Area layer
    const reportAreaLayer = new ImageLayer({
      source: new ImageWMS({
        url: 'http://20.20.152.180:8181/geoserver/Picarro/wms',
        params: {
          'LAYERS': 'Picarro:Boundary',
          'TILED': true
        },
        serverType: 'geoserver'
      }),
      title: 'Report Area ATCO',
      visible: true
    });

    // Create map
    const mapInstance = new Map({
      target: mapRef.current,
      layers: [
        // Base layers
        new TileLayer({
          source: new OSM(),
          title: 'OpenStreetMap'
        }),
        new TileLayer({
          source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          }),
          title: 'Satellite',
          visible: false
        }),
        new TileLayer({
          source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
          }),
          title: 'Streets',
          visible: false
        }),
        // Overlay layers
        reportAreaLayer
      ],
      view: new View({
        center: transform([-122.1430, 37.4419], 'EPSG:4326', 'EPSG:3857'),
        zoom: 10
      })
    });

    // Add drawing layer
    mapInstance.addLayer(drawingLayerInstance);

    // Set up click handler for GetFeatureInfo
    mapInstance.on('singleclick', (evt) => {
      if (isDrawing) return; // Don't show popup when drawing

      const viewResolution = mapInstance.getView().getResolution();
      const url = reportAreaLayer.getSource().getFeatureInfoUrl(
        evt.coordinate,
        viewResolution,
        'EPSG:3857',
        { 'INFO_FORMAT': 'application/json' }
      );

      if (url) {
        fetch(url)
          .then(response => response.json())
          .then(data => {
            if (data.features && data.features.length > 0) {
              const feature = data.features[0];
              const properties = feature.properties;
              let content = '<div style="font-size: 12px;">';
              for (const [key, value] of Object.entries(properties)) {
                content += `<strong>${key}:</strong> ${value}<br>`;
              }
              content += '</div>';
              
              // Show popup (you can implement a popup component)
              console.log('Feature info:', content);
            }
          })
          .catch(error => console.error('GetFeatureInfo error:', error));
      }
    });

    setMap(mapInstance);
    setDrawingSource(drawingSourceInstance);
    setDrawingLayer(drawingLayerInstance);

    return () => {
      if (mapInstance) {
        mapInstance.setTarget(undefined);
      }
    };
  }, []);

  // Change basemap
  const changeBasemap = (basemapType) => {
    if (!map) return;

    const layers = map.getLayers();
    layers.forEach(layer => {
      if (layer.get('title') === 'OpenStreetMap' || 
          layer.get('title') === 'Satellite' || 
          layer.get('title') === 'Streets') {
        layer.setVisible(layer.get('title').toLowerCase().includes(basemapType));
      }
    });
    setCurrentBasemap(basemapType);
  };

  // Toggle Report Area layer
  const toggleReportArea = (e) => {
    if (!map) return;
    
    const layers = map.getLayers();
    layers.forEach(layer => {
      if (layer.get('title') === 'Report Area ATCO') {
        layer.setVisible(e.target.checked);
      }
    });
    setReportAreaVisible(e.target.checked);
  };

  // Start drawing
  const startDrawing = () => {
    if (!map || !drawingSource) return;

    // Clear previous drawings
    drawingSource.clear();

    // Create draw interaction
    const drawInteraction = new Draw({
      source: drawingSource,
      type: 'Polygon'
    });

    drawInteraction.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      const extent = geometry.getExtent();
      
      // Convert extent to bbox string
      const bbox = extent.join(',');
      
      // Perform spatial query
      performSpatialQuery(bbox, geometry);
      
      // Remove drawing interaction
      map.removeInteraction(drawInteraction);
      setIsDrawing(false);
      setDrawingInteraction(null);
    });

    map.addInteraction(drawInteraction);
    setIsDrawing(true);
    setDrawingInteraction(drawInteraction);
  };

  // Stop drawing
  const stopDrawing = () => {
    if (drawingInteraction && map) {
      map.removeInteraction(drawingInteraction);
      setIsDrawing(false);
      setDrawingInteraction(null);
    }
  };

  // Clear drawings
  const clearDrawing = () => {
    if (drawingSource) {
      drawingSource.clear();
    }
    setFilteredFeatures([]);
    setIsFeatureTableCollapsed(false);
    setQueryResult(null);
    setSelectedFeatures([]);
    setCurrentPage(1);
    setLayerResults({});
    
    // Restore original Report Area layer
    if (map && originalReportAreaSource) {
      const layers = map.getLayers();
      layers.forEach(layer => {
        if (layer.get('title') === 'Report Area ATCO') {
          layer.setSource(originalReportAreaSource);
        }
      });
      setOriginalReportAreaSource(null);
      setFilteredReportAreaSource(null);
    }
  };

  // Perform spatial query
  const performSpatialQuery = async (bbox, geometry) => {
    const startTime = performance.now();
    setIsQuerying(true);
    setQueryResult(null);
    setFilteredFeatures([]);
    setSelectedFeatures([]);
    setCurrentPage(1);
    setLayerResults({});

    try {
      // Convert geometry to WKT
      const coordinates = geometry.getCoordinates()[0];
      const wktCoords = coordinates.map(coord => {
        const transformed = transform(coord, map.getView().getProjection(), 'EPSG:4326');
        return `${transformed[0]} ${transformed[1]}`;
      }).join(',');
      const wkt = `POLYGON((${wktCoords}))`;

      console.log('Performing spatial query:', { bbox, wkt });

      // Store original source if not already stored
      if (!originalReportAreaSource) {
        const layers = map.getLayers();
        layers.forEach(layer => {
          if (layer.get('title') === 'Report Area ATCO') {
            setOriginalReportAreaSource(layer.getSource());
          }
        });
      }

      // Create filtered WMS source
      const filteredSource = new ImageWMS({
        url: 'http://20.20.152.180:8181/geoserver/Picarro/wms',
        params: {
          'LAYERS': selectedLayer,
          'TILED': true,
          'CQL_FILTER': `INTERSECTS(the_geom, ${wkt})`
        },
        serverType: 'geoserver'
      });

      setFilteredReportAreaSource(filteredSource);

      // Update the Report Area layer with filtered source
      const layers = map.getLayers();
      layers.forEach(layer => {
        if (layer.get('title') === 'Report Area ATCO') {
          layer.setSource(filteredSource);
        }
      });

      // Query all available layers
      const layerQueryPromises = availableLayers.map(async (layer) => {
        const layerStartTime = performance.now();
        
        try {
          const wfsUrl = 'http://20.20.152.180:8181/geoserver/Picarro/wfs';
          const wfsParams = new URLSearchParams({
            service: 'WFS',
            version: '1.0.0',
            request: 'GetFeature',
            typeName: layer.id,
            outputFormat: 'application/json',
            maxFeatures: '1000',
            CQL_FILTER: `INTERSECTS(the_geom, ${wkt})`
          });

          const fullUrl = `${wfsUrl}?${wfsParams.toString()}`;
          console.log(`Querying layer ${layer.id}:`, fullUrl);

          const response = await fetch(fullUrl);
          const layerEndTime = performance.now();
          
          if (response.ok) {
            const geoJson = await response.json();
            const features = geoJson.features || [];
            
            return {
              layerId: layer.id,
              layerName: layer.name,
              features: features,
              loadTime: layerEndTime - layerStartTime,
              success: true
            };
          } else {
            return {
              layerId: layer.id,
              layerName: layer.name,
              features: [],
              loadTime: layerEndTime - layerStartTime,
              success: false,
              error: `HTTP ${response.status}`
            };
          }
        } catch (error) {
          const layerEndTime = performance.now();
          return {
            layerId: layer.id,
            layerName: layer.name,
            features: [],
            loadTime: layerEndTime - layerStartTime,
            success: false,
            error: error.message
          };
        }
      });

      const layerResults = await Promise.all(layerQueryPromises);
      const totalEndTime = performance.now();
      
      // Store results for each layer
      const resultsMap = {};
      layerResults.forEach(result => {
        resultsMap[result.layerId] = result;
      });
      setLayerResults(resultsMap);

      // Set active layer results
      const activeResult = resultsMap[selectedLayer];
      if (activeResult && activeResult.success) {
        setFilteredFeatures(activeResult.features);
        setIsFeatureTableCollapsed(false);
        
        setQueryResult({
          type: 'success',
          message: `Found ${activeResult.features.length} features in the selected area`,
          bbox: bbox
        });
      } else {
        setQueryResult({
          type: 'error',
          message: activeResult?.error || 'Failed to fetch filtered features'
        });
      }

      // Update performance metrics
      setPerformanceMetrics({
        totalTime: totalEndTime - startTime,
        layerResults: resultsMap,
        queryTime: new Date().toLocaleTimeString()
      });

      // Zoom to the drawn area
      const extent = geometry.getExtent();
      map.getView().fit(extent, {
        padding: [20, 20, 20, 20],
        duration: 1000
      });
    } catch (error) {
      console.error('Spatial query error:', error);
      setQueryResult({
        type: 'error',
        message: error.message || 'Network error'
      });
    } finally {
      setIsQuerying(false);
    }
  };

  // Handle feature selection
  const handleFeatureSelect = (featureId, isSelected) => {
    if (isSelected) {
      setSelectedFeatures(prev => [...prev, featureId]);
    } else {
      setSelectedFeatures(prev => prev.filter(id => id !== featureId));
    }
  };

  // Zoom to selected features
  const zoomToSelectedFeatures = (e) => {
    e.stopPropagation(); // Prevent table collapse
    if (selectedFeatures.length === 0) return;

    const selectedFeaturesData = filteredFeatures.filter(feature => 
      selectedFeatures.includes(feature.id || feature.properties?.id)
    );

    if (selectedFeaturesData.length > 0) {
      // Create a simple extent from the selected features
      const coordinates = selectedFeaturesData.map(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
          return feature.geometry.coordinates[0]; // First coordinate of polygon
        }
        return [0, 0]; // Fallback
      }).flat();

      if (coordinates.length > 0) {
        const minX = Math.min(...coordinates.map(c => c[0]));
        const minY = Math.min(...coordinates.map(c => c[1]));
        const maxX = Math.max(...coordinates.map(c => c[0]));
        const maxY = Math.max(...coordinates.map(c => c[1]));

        const extent = [minX, minY, maxX, maxY];
        
        // Transform coordinates to map projection if needed
        const mapProjection = map.getView().getProjection();
        const transformedExtent = [
          transform([minX, minY], 'EPSG:4326', mapProjection),
          transform([maxX, maxY], 'EPSG:4326', mapProjection)
        ].flat();
        
        map.getView().fit(transformedExtent, {
          padding: [50, 50, 50, 50],
          duration: 1000
        });
      }
    }
  };

  // Get paginated features
  const getPaginatedFeatures = () => {
    const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
    const endIndex = startIndex + RECORDS_PER_PAGE;
    return filteredFeatures.slice(startIndex, endIndex);
  };

  // Calculate total pages
  const totalPages = Math.ceil(filteredFeatures.length / RECORDS_PER_PAGE);

  // Handle tab change
  const handleTabChange = (layerId) => {
    setActiveTab(layerId);
    const layerResult = layerResults[layerId];
    if (layerResult && layerResult.success) {
      setFilteredFeatures(layerResult.features);
      setCurrentPage(1);
      setSelectedFeatures([]);
    }
  };

  return (
    <div className="App">
      <div ref={mapRef} className="map-container" />

      {/* Performance Metrics */}
      <div className="performance-metrics styled-panel">
        <h3>Performance Metrics</h3>
        {performanceMetrics.queryTime && (
          <div className="metric-item">
            <strong>Last Query:</strong> {performanceMetrics.queryTime}
          </div>
        )}
        {performanceMetrics.totalTime && (
          <div className="metric-item">
            <strong>Total Time:</strong> {performanceMetrics.totalTime.toFixed(2)}ms
          </div>
        )}
        {performanceMetrics.layerResults && Object.keys(performanceMetrics.layerResults).map(layerId => {
          const result = performanceMetrics.layerResults[layerId];
          return (
            <div key={layerId} className="metric-item">
              <strong>{result.layerName}:</strong> {result.success ? 
                `${result.features.length} features (${result.loadTime.toFixed(2)}ms)` : 
                `Failed (${result.loadTime.toFixed(2)}ms)`
              }
            </div>
          );
        })}
      </div>

      {/* Base Map Gallery - Bottom Right */}
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

      {/* Layers Panel - Top Right */}
      <div className="layers-panel styled-panel">
        <h3>Layers</h3>
        <label>
          <input
            type="checkbox"
            checked={reportAreaVisible}
            onChange={toggleReportArea}
          />
          Report Area ATCO
        </label>
      </div>

      {/* Spatial Query Panel - Bottom Left (with dynamic positioning) */}
      <div className={`spatial-query-panel styled-panel ${!isFeatureTableCollapsed ? 'with-table' : ''}`}>
        <div className="panel-header">
          <h3>Spatial Query</h3>
          <button
            className="collapse-btn"
            onClick={() => setIsFeatureTableCollapsed(!isFeatureTableCollapsed)}
          >
            {isFeatureTableCollapsed ? '▼' : '▲'}
          </button>
        </div>

        <div className="query-controls">
          <div className="layer-selector">
            <label>Layer:</label>
            <select
              value={selectedLayer}
              onChange={(e) => setSelectedLayer(e.target.value)}
            >
              {availableLayers.map(layer => (
                <option key={layer.id} value={layer.id}>
                  {layer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="drawing-buttons">
            <button
              onClick={startDrawing}
              disabled={isDrawing}
              className="primary-btn"
            >
              {isDrawing ? 'Drawing...' : 'Draw Box'}
            </button>
            <button
              onClick={stopDrawing}
              disabled={!isDrawing}
              className="secondary-btn"
            >
              Stop Drawing
            </button>
            <button
              onClick={clearDrawing}
              className="clear-btn"
            >
              Clear
            </button>
          </div>

          {isDrawing && (
            <div className="drawing-status">
              <span>🎯 Drawing Mode Active - Click and drag to draw a box</span>
            </div>
          )}

          {isQuerying && (
            <div className="query-status">
              <span>Querying...</span>
            </div>
          )}

          {queryResult && (
            <div className="query-result">
              <div className={`result-message ${queryResult.type}`}>
                {queryResult.message}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feature Table */}
      <div className={`feature-table-container ${isFeatureTableCollapsed ? 'collapsed' : ''}`}>
          <div className="feature-table-header">
            <div className="table-tabs">
              {Object.keys(layerResults).length > 0 ? (
                Object.keys(layerResults).map(layerId => {
                  const result = layerResults[layerId];
                  const layer = availableLayers.find(l => l.id === layerId);
                  return (
                    <button
                      key={layerId}
                      className={`tab-button ${activeTab === layerId ? 'active' : ''}`}
                      onClick={() => handleTabChange(layerId)}
                      disabled={!result.success}
                    >
                      {layer?.name || layerId} ({result.features.length})
                    </button>
                  );
                })
              ) : (
                <div style={{ color: '#666', fontSize: '12px' }}>
                  No query results yet
                </div>
              )}
            </div>
            <div className="table-controls">
              {selectedFeatures.length > 0 && (
                <button 
                  className="zoom-btn"
                  onClick={zoomToSelectedFeatures}
                  title="Zoom to selected features"
                >
                  🔍 Zoom to Selected ({selectedFeatures.length})
                </button>
              )}
              <button
                className="collapse-btn"
                onClick={() => setIsFeatureTableCollapsed(!isFeatureTableCollapsed)}
              >
                {isFeatureTableCollapsed ? '▼' : '▲'}
              </button>
            </div>
          </div>
          
          {/* Table Expand Arrow - Bottom Center */}
          <button
            className={`table-expand-arrow ${isFeatureTableCollapsed ? 'collapsed' : ''}`}
            onClick={() => setIsFeatureTableCollapsed(!isFeatureTableCollapsed)}
            title={isFeatureTableCollapsed ? 'Expand table' : 'Collapse table'}
          >
          </button>
          
          {!isFeatureTableCollapsed && filteredFeatures.length > 0 && (
            <>
              <div className="feature-table-content">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={selectedFeatures.length === getPaginatedFeatures().length && getPaginatedFeatures().length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFeatures(getPaginatedFeatures().map(f => f.id || f.properties?.id));
                            } else {
                              setSelectedFeatures([]);
                            }
                          }}
                        />
                      </th>
                      <th>Feature ID</th>
                      {filteredFeatures.length > 0 && Object.keys(filteredFeatures[0].properties || {}).map(key => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getPaginatedFeatures().map((feature, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedFeatures.includes(feature.id || feature.properties?.id)}
                            onChange={(e) => handleFeatureSelect(feature.id || feature.properties?.id, e.target.checked)}
                          />
                        </td>
                        <td>{feature.id || `Feature ${index + 1}`}</td>
                        {Object.entries(feature.properties || {}).map(([key, value]) => (
                          <td key={key} title={String(value)}>
                            <div className="cell-content">{String(value)}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
          
          {!isFeatureTableCollapsed && filteredFeatures.length === 0 && (
            <div className="feature-table-content">
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                No features found. Draw a box to query features.
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

export default App; 