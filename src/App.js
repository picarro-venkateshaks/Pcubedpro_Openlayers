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
  const [isFeatureTableCollapsed, setIsFeatureTableCollapsed] = useState(false);
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
  const [availableLayers, setAvailableLayers] = useState([]);
  const [apiConnectionStatus, setApiConnectionStatus] = useState('checking');
  const [isLoadingPage, setIsLoadingPage] = useState(false);

  const RECORDS_PER_PAGE = 100; // Server-side pagination

  // API Base URL
  const API_BASE_URL = 'http://localhost:5000/api';

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
        serverType: 'geoserver',
        // Add debugging to see WMS requests
        tileLoadFunction: function (imageTile, src) {
          console.log('WMS Tile Request:', src);
          imageTile.getImage().src = src;
        }
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
      if (isDrawing) return;

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

  // Load available layers from backend and load all records by default
  useEffect(() => {
    const loadLayers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/layers`);
        if (response.ok) {
          const data = await response.json();
          setAvailableLayers(data.layers || []);
          if (data.layers && data.layers.length > 0) {
            setSelectedLayer(data.layers[0].id);
            setActiveTab(data.layers[0].id);
            // Load all records for the first layer by default
            loadAllRecords(data.layers[0].id);
          }
        } else {
          console.error('Failed to load layers from backend');
          // Fallback to default layers
          const defaultLayers = [
            { id: 'Picarro:Boundary', name: 'Boundary', visible: true },
            { id: 'Picarro:OtherLayer', name: 'Other Layer', visible: false }
          ];
          setAvailableLayers(defaultLayers);
          loadAllRecords(defaultLayers[0].id);
        }
      } catch (error) {
        console.error('Error loading layers:', error);
        // Fallback to default layers
        const defaultLayers = [
          { id: 'Picarro:Boundary', name: 'Boundary', visible: true },
          { id: 'Picarro:OtherLayer', name: 'Other Layer', visible: false }
        ];
        setAvailableLayers(defaultLayers);
        loadAllRecords(defaultLayers[0].id);
      }
    };

    loadLayers();
  }, []);

  // Function to load records for a layer with pagination
  const loadRecords = async (layerId, page = 1) => {
    setIsLoadingPage(true);
    try {
      // Get total count on first page load or if we don't have pagination info
      const currentLayerResult = layerResults[layerId];
      const hasPaginationInfo = currentLayerResult && currentLayerResult.pagination && currentLayerResult.pagination.totalFeatures;
      const getTotalCount = page === 1 || !hasPaginationInfo;
      
      const response = await fetch(`${API_BASE_URL}/features?layer=${layerId}&page=${page}&pageSize=${RECORDS_PER_PAGE}&getTotalCount=${getTotalCount}`);
      if (response.ok) {
        const data = await response.json();
        if (data.features) {
          console.log('loadRecords - received data:', data);
          setFilteredFeatures(data.features);
          
          // Preserve existing pagination info if not provided in response
          const existingPagination = currentLayerResult?.pagination;
          const paginationInfo = data.pagination || existingPagination;
          
          setLayerResults({
            [layerId]: {
              success: true,
              features: data.features,
              count: data.features.length,
              layerName: availableLayers.find(l => l.id === layerId)?.name || layerId,
              pagination: paginationInfo
            }
          });
          setCurrentPage(page);
          setIsFeatureTableCollapsed(false);
        }
      } else {
        console.error('Failed to load records for layer:', layerId);
      }
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setIsLoadingPage(false);
    }
  };

  // Function to load all records for a layer (first page)
  const loadAllRecords = async (layerId) => {
    await loadRecords(layerId, 1);
  };

  // Test API connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        const response = await fetch(`${API_BASE_URL.replace('/api', '')}/`);
        if (response.ok) {
          setApiConnectionStatus('connected');
        } else {
          setApiConnectionStatus('failed');
        }
      } catch (error) {
        console.error('API connection test failed:', error);
        setApiConnectionStatus('failed');
      }
    };

    testConnection();
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

    drawingSource.clear();

    const drawInteraction = new Draw({
      source: drawingSource,
      type: 'Polygon'
    });

    drawInteraction.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      const extent = geometry.getExtent();

      const bbox = extent.join(',');
      performSpatialQuery(bbox, geometry);

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

  // Perform spatial query using backend API
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
        serverType: 'geoserver',
        // Add debugging to see filtered WMS requests
        tileLoadFunction: function (imageTile, src) {
          console.log('Filtered WMS Tile Request:', src);
          imageTile.getImage().src = src;
        }
      });

      setFilteredReportAreaSource(filteredSource);

      // Update the Report Area layer with filtered source
      const layers = map.getLayers();
      layers.forEach(layer => {
        if (layer.get('title') === 'Report Area ATCO') {
          layer.setSource(filteredSource);
        }
      });

      // Query all available layers using backend API
      const layerIds = availableLayers.map(layer => layer.id);

      const response = await fetch(`${API_BASE_URL}/spatial-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          geometry: wkt,
          layers: layerIds
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const totalEndTime = performance.now();

      if (data.success) {
        setLayerResults(data.results);

        // Set active layer results
        const activeResult = data.results[selectedLayer];
        if (activeResult && activeResult.success) {
          setFilteredFeatures(activeResult.features);
          setCurrentPage(1); // Reset to first page for spatial query results
          setIsFeatureTableCollapsed(false);

          // Update layer results with pagination info
          setLayerResults(prev => ({
            ...prev,
            [selectedLayer]: {
              ...activeResult,
              pagination: {
                page: 1,
                pageSize: RECORDS_PER_PAGE,
                totalFeatures: activeResult.features.length,
                totalPages: Math.ceil(activeResult.features.length / RECORDS_PER_PAGE),
                hasMore: activeResult.features.length > RECORDS_PER_PAGE
              }
            }
          }));

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
          totalTime: data.totalTime,
          layerResults: data.results,
          queryTime: data.queryTime
        });

        // Zoom to the drawn area
        const extent = geometry.getExtent();
        map.getView().fit(extent, {
          padding: [20, 20, 20, 20],
          duration: 1000
        });
      } else {
        throw new Error(data.error || 'Spatial query failed');
      }
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
    e.stopPropagation();
    if (selectedFeatures.length === 0) return;

    const selectedFeaturesData = filteredFeatures.filter(feature =>
      selectedFeatures.includes(feature.id || feature.properties?.id)
    );

    if (selectedFeaturesData.length > 0) {
      const coordinates = selectedFeaturesData.map(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
          return feature.geometry.coordinates[0];
        }
        return [0, 0];
      }).flat();

      if (coordinates.length > 0) {
        const minX = Math.min(...coordinates.map(c => c[0]));
        const minY = Math.min(...coordinates.map(c => c[1]));
        const maxX = Math.max(...coordinates.map(c => c[0]));
        const maxY = Math.max(...coordinates.map(c => c[1]));

        const extent = [minX, minY, maxX, maxY];

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

  // Get current page features (already paginated from server)
  const getCurrentPageFeatures = () => {
    return filteredFeatures;
  };

  // Calculate total pages from layer results
  const getTotalPages = () => {
    const activeResult = layerResults[activeTab];
    console.log('getTotalPages - activeResult:', activeResult);
    if (activeResult && activeResult.pagination) {
      const totalPages = activeResult.pagination.totalPages || 1;
      console.log('getTotalPages - totalPages:', totalPages);
      return totalPages;
    }
    console.log('getTotalPages - no pagination data, returning 1');
    return 1;
  };

  // Get total features count
  const getTotalFeatures = () => {
    const activeResult = layerResults[activeTab];
    if (activeResult && activeResult.pagination) {
      return activeResult.pagination.totalFeatures || 0;
    }
    return 0;
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const totalPages = getTotalPages();
    const current = currentPage;
    const pages = [];

    // Always show first page
    pages.push(1);

    // Show pages around current page
    const start = Math.max(2, current - 2);
    const end = Math.min(totalPages - 1, current + 2);

    if (start > 2) {
      pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      if (i > 1 && i < totalPages) {
        pages.push(i);
      }
    }

    if (end < totalPages - 1) {
      pages.push('...');
    }

    // Always show last page if more than 1 page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  // Handle tab change
  const handleTabChange = (layerId) => {
    setActiveTab(layerId);
    const layerResult = layerResults[layerId];
    if (layerResult && layerResult.success) {
      setFilteredFeatures(layerResult.features);
      setCurrentPage(layerResult.pagination?.page || 1);
      setSelectedFeatures([]);
    }
  };

  return (
    <div className="App">
      <div ref={mapRef} className="map-container" />

      {/* API Connection Status */}
      <div className="api-status styled-panel">
        <div className={`status-indicator ${apiConnectionStatus}`}>
          API: {apiConnectionStatus === 'connected' ? '✅ Connected' :
            apiConnectionStatus === 'failed' ? '❌ Failed' : '⏳ Checking...'}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="performance-metrics styled-panel">
        <h3>Performance Metrics</h3>
        {performanceMetrics.queryTime && (
          <div className="metric-item">
            <strong>Last Query:</strong> {new Date(performanceMetrics.queryTime).toLocaleTimeString()}
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
                `${result.count} features (${result.loadTime.toFixed(2)}ms)` :
                `Failed (${result.loadTime.toFixed(2)}ms)`
              }
            </div>
          );
        })}
      </div>

      {/* Base Map Gallery - Top Right */}
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

      {/* Spatial Query Panel - Bottom Left */}
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
                    {layer?.name || layerId} ({result.count || 0} features)
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
                        checked={selectedFeatures.length === getCurrentPageFeatures().length && getCurrentPageFeatures().length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFeatures(getCurrentPageFeatures().map(f => f.id || f.properties?.id));
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
                  {getCurrentPageFeatures().map((feature, index) => (
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
            {getTotalPages() >= 1 && (
              <div className="pagination">
                {/* Previous Button */}
                <button
                  onClick={() => {
                    const newPage = Math.max(1, currentPage - 1);
                    setCurrentPage(newPage);
                    loadRecords(activeTab, newPage);
                  }}
                  disabled={currentPage === 1 || isLoadingPage || getTotalPages() <= 1}
                  className="pagination-btn"
                >
                  {isLoadingPage ? '⏳' : '◀'}
                </button>

                {/* Page Numbers */}
                <div className="page-numbers">
                  {getPageNumbers().map((pageNum, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        if (typeof pageNum === 'number') {
                          setCurrentPage(pageNum);
                          loadRecords(activeTab, pageNum);
                        }
                      }}
                      disabled={isLoadingPage || pageNum === '...'}
                      className={`page-number ${pageNum === currentPage ? 'active' : ''} ${pageNum === '...' ? 'ellipsis' : ''}`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => {
                    const newPage = currentPage + 1;
                    setCurrentPage(newPage);
                    loadRecords(activeTab, newPage);
                  }}
                  disabled={currentPage >= getTotalPages() || isLoadingPage || getTotalPages() <= 1}
                  className="pagination-btn"
                >
                  {isLoadingPage ? '⏳' : '▶'}
                </button>

                {/* Info Display */}
                <div className="pagination-info">
                  <span>
                    {getTotalPages() > 1 ? `Page ${currentPage} of ${getTotalPages()}` : 'All Features'}
                  </span>
                  <span style={{ marginLeft: '8px', color: '#666', fontSize: '11px' }}>
                    ({filteredFeatures.length} of {getTotalFeatures()} features)
                  </span>
                  {isLoadingPage && <span style={{ marginLeft: '8px', color: '#007bff' }}>⏳ Loading...</span>}
                </div>
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