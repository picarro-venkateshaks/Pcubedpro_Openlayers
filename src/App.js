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
import { GeoJSON } from 'ol/format';
import Feature from 'ol/Feature';
import './App.css';

// Import widgets
import { LeftPanel, SpatialQueryPanel, FeatureTable } from './widgets';

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
  const [activeTab, setActiveTab] = useState('Picarro:Boundary');
  const [layerResults, setLayerResults] = useState({});
  const [availableLayers, setAvailableLayers] = useState([]);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [highlightLayer, setHighlightLayer] = useState(null);
  const [highlightSource, setHighlightSource] = useState(null);
  const [currentSpatialQueryGeometry, setCurrentSpatialQueryGeometry] = useState(null);

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

    // Create highlight source and layer for selected features
    const highlightSourceInstance = new VectorSource();
    const highlightLayerInstance = new VectorLayer({
      source: highlightSourceInstance,
      style: new Style({
        fill: new Fill({ color: 'rgba(0, 255, 255, 0.4)' }), // Cyan fill
        stroke: new Stroke({ color: '#00ffff', width: 3 }) // Cyan stroke
      }),
      visible: true,
      zIndex: 1001 // Higher than drawing layer
    });

    // Create Report Area layer
    const reportAreaLayer = new ImageLayer({
      source: new ImageWMS({
        url: 'http://20.20.152.180:8181/geoserver/Picarro/wms',
        params: {
          'LAYERS': 'Picarro:Boundary',
          'TILED': true,
          'CQL_FILTER': '1=1'  // Default filter to show all features
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
        zoom: 10,
        extent: [-13663855.396075286, 4441876.305861524, -13487744.482906241, 4532683.495464313]
      })
    });

    // Add drawing layer
    mapInstance.addLayer(drawingLayerInstance);
    
    // Add highlight layer
    mapInstance.addLayer(highlightLayerInstance);

    // Set the highlight layer and source in state
    setHighlightLayer(highlightLayerInstance);
    setHighlightSource(highlightSourceInstance);

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
    setHighlightLayer(highlightLayerInstance);
    setHighlightSource(highlightSourceInstance);
    setOriginalReportAreaSource(reportAreaLayer.getSource()); // Store original source

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
          } else {
            // No layers available from backend, use default
            console.log('No layers available from backend, using default');
            setSelectedLayer('Picarro:Boundary');
            setActiveTab('Picarro:Boundary');
            loadAllRecords('Picarro:Boundary');
          }
        } else {
          console.error('Failed to load layers from backend');
          // Fallback to default layer
          setSelectedLayer('Picarro:Boundary');
          setActiveTab('Picarro:Boundary');
          loadAllRecords('Picarro:Boundary');
        }
      } catch (error) {
        console.error('Error loading layers:', error);
        // Fallback to default layer
        setSelectedLayer('Picarro:Boundary');
        setActiveTab('Picarro:Boundary');
        loadAllRecords('Picarro:Boundary');
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

  // Clear drawing
  const clearDrawing = () => {
    if (drawingSource) {
      drawingSource.clear();
    }
    if (highlightSource) {
      highlightSource.clear();
    }
    
    // Restore original WMS source
    if (map && originalReportAreaSource) {
      const layers = map.getLayers();
      layers.forEach(layer => {
        if (layer.get('title') === 'Report Area ATCO') {
          layer.setSource(originalReportAreaSource);
        }
      });
      setOriginalReportAreaSource(null);
    }
    
    // Reset table to show all features with pagination
    setFilteredFeatures([]);
    setCurrentPage(1);
    setIsFeatureTableCollapsed(false);
    setQueryResult(null);
    setCurrentSpatialQueryGeometry(null); // Clear stored spatial query geometry
    
    // Reload all records for the current layer
    if (selectedLayer) {
      loadAllRecords(selectedLayer);
    }
  };

  // Perform spatial query
  const performSpatialQuery = async (bbox, geometry) => {
    if (!geometry) {
      setQueryResult({ type: 'error', message: 'No geometry drawn' });
      return;
    }

    setIsQuerying(true);
    setQueryResult(null);

    try {
      // Convert OpenLayers geometry to WKT format
      let wktGeometry = '';
      
      if (geometry.getType() === 'Polygon') {
        const coordinates = geometry.getCoordinates()[0]; // Get outer ring
        const coordStrings = coordinates.map(coord => {
          // Transform from map projection to EPSG:4326
          const transformed = transform(coord, map.getView().getProjection(), 'EPSG:4326');
          return `${transformed[0].toFixed(6)} ${transformed[1].toFixed(6)}`;
        });
        wktGeometry = `POLYGON((${coordStrings.join(',')}))`;
      } else {
        setQueryResult({ type: 'error', message: 'Only polygon geometry is supported' });
        setIsQuerying(false);
        return;
      }

      console.log('Transformed WKT geometry:', wktGeometry);

      // Get layer IDs for spatial query
      const layerIds = availableLayers.map(layer => layer.id);

      // If no layers from backend, use the selected layer
      if (layerIds.length === 0) {
        layerIds.push(selectedLayer);
      }

      const response = await fetch(`${API_BASE_URL}/spatial-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          geometry: wktGeometry,
          layers: layerIds
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Spatial query response:', data);

        // Also filter the map using WMS
        try {
          // Store original source if not already stored
          if (!originalReportAreaSource) {
            const layers = map.getLayers();
            layers.forEach(layer => {
              if (layer.get('title') === 'Report Area ATCO') {
                setOriginalReportAreaSource(layer.getSource());
              }
            });
          }

          // Create filtered WMS source for map visualization
          const filteredSource = new ImageWMS({
            url: 'http://20.20.152.180:8181/geoserver/Picarro/wms',
            params: {
              'LAYERS': selectedLayer,
              'TILED': true,
              'CQL_FILTER': `INTERSECTS(the_geom, ${wktGeometry})`
            },
            serverType: 'geoserver'
          });

          // Update the Report Area layer with filtered source
          const layers = map.getLayers();
          layers.forEach(layer => {
            if (layer.get('title') === 'Report Area ATCO') {
              layer.setSource(filteredSource);
            }
          });

          console.log('Updated map with WMS filter');
        } catch (error) {
          console.error('Error updating map filter:', error);
        }

        // Find the first successful result
        const activeResult = Object.values(data.results).find(result => result.success);

        if (activeResult && activeResult.features.length > 0) {
          // Check if we have more than 100 features and need pagination
          if (activeResult.count > 100) {
            // Store the spatial query geometry for pagination
            setCurrentSpatialQueryGeometry(wktGeometry);
            // Use paginated spatial query for the first page to get correct total count
            await loadSpatialQueryPaginated(wktGeometry, layerIds, 1);
          } else {
            // Clear any stored spatial query geometry for small results
            setCurrentSpatialQueryGeometry(null);
            // Update filtered features and table for small result sets
            setFilteredFeatures(activeResult.features);
            setCurrentPage(1);
            setIsFeatureTableCollapsed(false);
            
            // Update layer results for pagination
            const layerId = Object.keys(data.results).find(key => data.results[key].success);
            if (layerId) {
              // For spatial query results, use the actual count from the query
              const totalFeatures = activeResult.count;
              const totalPages = Math.ceil(totalFeatures / 100);
              
              setLayerResults({
                [layerId]: {
                  success: true,
                  features: activeResult.features,
                  count: activeResult.count,
                  layerName: activeResult.layerName,
                  pagination: {
                    page: 1,
                    pageSize: 100,
                    totalFeatures: totalFeatures,
                    totalPages: totalPages,
                    hasMore: totalFeatures > 100,
                    startIndex: 0,
                    endIndex: Math.min(totalFeatures - 1, 99)
                  }
                }
              });
              setActiveTab(layerId);
            }
          }

          setQueryResult({ 
            type: 'success', 
            message: `Found ${activeResult.count} features in ${activeResult.layerName}` 
          });
        } else {
          // No features found
          setFilteredFeatures([]);
          setCurrentPage(1);
          setIsFeatureTableCollapsed(false);
          
          // Update layer results to show no features
          const layerId = Object.keys(data.results)[0];
          if (layerId) {
            setLayerResults({
              [layerId]: {
                success: false,
                features: [],
                count: 0,
                layerName: data.results[layerId].layerName,
                pagination: {
                  page: 1,
                  pageSize: 100,
                  totalFeatures: 0,
                  totalPages: 1,
                  hasMore: false,
                  startIndex: 0,
                  endIndex: 0
                }
              }
            });
            setActiveTab(layerId);
          }

          setQueryResult({ 
            type: 'info', 
            message: 'No features found in the selected area' 
          });
        }

        // Clear drawing
        if (drawingSource) {
          drawingSource.clear();
        }
        if (highlightSource) {
          highlightSource.clear();
        }
      } else {
        const errorData = await response.json();
        setQueryResult({ 
          type: 'error', 
          message: `Spatial query failed: ${errorData.error || 'Unknown error'}` 
        });
      }
    } catch (error) {
      console.error('Error performing spatial query:', error);
      setQueryResult({ 
        type: 'error', 
        message: `Error performing spatial query: ${error.message}` 
      });
    } finally {
      setIsQuerying(false);
    }
  };

  // Load paginated spatial query results
  const loadSpatialQueryPaginated = async (geometry, layerIds, page = 1) => {
    setIsLoadingPage(true);
    try {
      const response = await fetch(`${API_BASE_URL}/spatial-query-paginated`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          geometry: geometry,
          layers: layerIds,
          page: page,
          pageSize: 100
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Paginated spatial query response:', data);

        // Find the first successful result
        const activeResult = Object.values(data.results).find(result => result.success);

        if (activeResult && activeResult.features.length > 0) {
          setFilteredFeatures(activeResult.features);
          setCurrentPage(page);
          setIsFeatureTableCollapsed(false);
          
          // Update layer results for pagination
          const layerId = Object.keys(data.results).find(key => data.results[key].success);
          if (layerId) {
            setLayerResults({
              [layerId]: {
                success: true,
                features: activeResult.features,
                count: activeResult.count,
                layerName: activeResult.layerName,
                pagination: {
                  page: activeResult.currentPage,
                  pageSize: activeResult.pageSize,
                  totalFeatures: activeResult.totalFeatures,
                  totalPages: activeResult.totalPages,
                  hasMore: activeResult.currentPage < activeResult.totalPages,
                  startIndex: (activeResult.currentPage - 1) * activeResult.pageSize,
                  endIndex: Math.min(activeResult.totalFeatures - 1, (activeResult.currentPage * activeResult.pageSize) - 1)
                }
              }
            });
            setActiveTab(layerId);
          }
        }
      } else {
        console.error('Failed to load paginated spatial query results');
      }
    } catch (error) {
      console.error('Error loading paginated spatial query results:', error);
    } finally {
      setIsLoadingPage(false);
    }
  };

  // Handle feature selection
  const handleFeatureSelect = (featureId, isSelected) => {
    if (Array.isArray(featureId)) {
      // Handle bulk selection
      setSelectedFeatures(isSelected ? featureId : []);
      updateHighlightLayer(isSelected ? featureId : []);
    } else {
      // Handle single selection
      if (isSelected) {
        setSelectedFeatures(prev => {
          const newSelection = [...prev, featureId];
          updateHighlightLayer(newSelection);
          return newSelection;
        });
      } else {
        setSelectedFeatures(prev => {
          const newSelection = prev.filter(id => id !== featureId);
          updateHighlightLayer(newSelection);
          return newSelection;
        });
      }
    }
  };

  // Update highlight layer with selected features
  const updateHighlightLayer = (selectedIds) => {
    if (!highlightSource) {
      console.log('Highlight source not available');
      return;
    }
    
    console.log('Updating highlight layer with selected IDs:', selectedIds);
    console.log('Available filtered features:', filteredFeatures.length);
    
    // Clear existing highlights
    highlightSource.clear();
    
    // Add selected features to highlight layer
    selectedIds.forEach(id => {
      const feature = filteredFeatures.find(f => f.id === id || f.properties?.id === id);
      console.log(`Looking for feature with ID ${id}:`, feature ? 'Found' : 'Not found');
      
      if (feature && feature.geometry) {
        try {
          const olFeature = new GeoJSON().readFeature(feature);
          highlightSource.addFeature(olFeature);
          console.log('Added feature to highlight layer:', feature.id || feature.properties?.id);
        } catch (error) {
          console.error('Error creating highlight feature:', error);
        }
      } else {
        console.log('Feature not found or no geometry:', id);
      }
    });
    
    console.log('Highlight source features count:', highlightSource.getFeatures().length);
  };

  // Zoom to selected features
  const zoomToSelectedFeatures = (e) => {
    e.stopPropagation();
    if (selectedFeatures.length === 0) return;

    const selectedFeaturesData = filteredFeatures.filter(feature =>
      selectedFeatures.includes(feature.id || feature.properties?.id)
    );

    if (selectedFeaturesData.length > 0) {
      try {
        // Collect all coordinates from selected features
        const allCoordinates = [];
        
        selectedFeaturesData.forEach(feature => {
          if (feature.geometry && feature.geometry.coordinates) {
            // Handle different geometry types
            if (feature.geometry.type === 'Point') {
              allCoordinates.push(feature.geometry.coordinates);
            } else if (feature.geometry.type === 'LineString') {
              allCoordinates.push(...feature.geometry.coordinates);
            } else if (feature.geometry.type === 'Polygon') {
              // For polygons, use the first ring (exterior)
              allCoordinates.push(...feature.geometry.coordinates[0]);
            } else if (feature.geometry.type === 'MultiPolygon') {
              // For multipolygons, use all rings
              feature.geometry.coordinates.forEach(polygon => {
                allCoordinates.push(...polygon[0]);
              });
            }
          }
        });

        if (allCoordinates.length > 0) {
          // Find the extent of all coordinates
          const minX = Math.min(...allCoordinates.map(c => c[0]));
          const minY = Math.min(...allCoordinates.map(c => c[1]));
          const maxX = Math.max(...allCoordinates.map(c => c[0]));
          const maxY = Math.max(...allCoordinates.map(c => c[1]));

          // Create extent in the coordinate system of the features
          const extent = [minX, minY, maxX, maxY];
          
          // Transform extent to map projection if needed
          const mapProjection = map.getView().getProjection();
          let transformedExtent;
          
          try {
            // Try to transform from EPSG:4326 to map projection
            transformedExtent = [
              transform([minX, minY], 'EPSG:4326', mapProjection),
              transform([maxX, maxY], 'EPSG:4326', mapProjection)
            ].flat();
          } catch (e) {
            // If transformation fails, assume coordinates are already in map projection
            console.log('Using coordinates as-is (assuming they are in map projection)');
            transformedExtent = extent;
          }

          // Add some padding to the extent
          const padding = 0.1; // 10% padding
          const width = transformedExtent[2] - transformedExtent[0];
          const height = transformedExtent[3] - transformedExtent[1];
          
          transformedExtent[0] -= width * padding;
          transformedExtent[1] -= height * padding;
          transformedExtent[2] += width * padding;
          transformedExtent[3] += height * padding;

          map.getView().fit(transformedExtent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
            maxZoom: 18
          });
        }
      } catch (error) {
        console.error('Error zooming to selected features:', error);
        // Fallback: zoom to a reasonable area
        const center = map.getView().getCenter();
        const resolution = map.getView().getResolution();
        map.getView().animate({
          center: center,
          resolution: resolution * 0.5,
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

  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    
    // Check if we're in a spatial query context
    const activeResult = layerResults[activeTab];
    if (activeResult && activeResult.success && activeResult.pagination && activeResult.pagination.totalFeatures > 100 && currentSpatialQueryGeometry) {
      // This is a spatial query result with pagination
      // Use the stored spatial query geometry for pagination
      const layerIds = availableLayers.map(layer => layer.id);
      if (layerIds.length === 0) {
        layerIds.push(selectedLayer);
      }
      loadSpatialQueryPaginated(currentSpatialQueryGeometry, layerIds, newPage);
    } else {
      // Regular layer pagination
      loadRecords(activeTab, newPage);
    }
  };

  return (
    <div className="App">
      <div ref={mapRef} className="map-container" />

      {/* Left Panel with Widgets */}
      <LeftPanel
        currentBasemap={currentBasemap}
        onBasemapChange={changeBasemap}
        reportAreaVisible={reportAreaVisible}
        onReportAreaToggle={toggleReportArea}
        map={map}
        availableLayers={availableLayers}
        selectedLayer={selectedLayer}
        onLayerChange={setSelectedLayer}
        isDrawing={isDrawing}
        onStartDrawing={startDrawing}
        onStopDrawing={stopDrawing}
        onClearDrawing={clearDrawing}
        isQuerying={isQuerying}
        queryResult={queryResult}
        isFeatureTableCollapsed={isFeatureTableCollapsed}
        onToggleTable={() => setIsFeatureTableCollapsed(!isFeatureTableCollapsed)}
      />

      {/* Feature Table */}
      <FeatureTable
        isFeatureTableCollapsed={isFeatureTableCollapsed}
        onToggleTable={() => setIsFeatureTableCollapsed(!isFeatureTableCollapsed)}
        filteredFeatures={filteredFeatures}
        layerResults={layerResults}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        availableLayers={availableLayers}
        selectedFeatures={selectedFeatures}
        onFeatureSelect={handleFeatureSelect}
        onZoomToSelected={zoomToSelectedFeatures}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        isLoadingPage={isLoadingPage}
        getTotalPages={getTotalPages}
        getPageNumbers={getPageNumbers}
        getTotalFeatures={getTotalFeatures}
      />
    </div>
  );
}

export default App; 