import React, { useState, useEffect } from 'react';
import './LegendWidget.css';

const LegendWidget = ({ map }) => {
  const [legendItems, setLegendItems] = useState([]);

  useEffect(() => {
    if (!map) return;

    const updateLegend = () => {
      const layers = map.getLayers();
      const visibleLayers = layers.getArray().filter(layer => layer.getVisible());
      
      const items = visibleLayers.map(layer => {
        const title = layer.get('title') || 'Unknown Layer';
        const source = layer.getSource();
        
        // Generate legend items based on layer type and source
        let legendItem = {
          name: title,
          type: 'layer',
          visible: layer.getVisible(),
          source: source,
          legendUrl: null
        };

        // Get legend URL for WMS layers (excluding basemaps)
        if (source && source.getLegendUrl && !title.toLowerCase().includes('openstreetmap') && 
            !title.toLowerCase().includes('satellite') && !title.toLowerCase().includes('streets')) {
          try {
            const resolution = map.getView().getResolution();
            legendItem.legendUrl = source.getLegendUrl(resolution);
          } catch (e) {
            console.log('Could not get legend URL for layer:', title);
          }
        }

        // Add specific styling for different layer types
        if (title === 'Report Area ATCO') {
          legendItem.style = {
            backgroundColor: '#007bff',
            border: '2px solid #0056b3'
          };
          legendItem.description = 'Boundary Area';
          legendItem.icon = '🗺️';
        } else if (title === 'OpenStreetMap') {
          legendItem.style = {
            backgroundColor: '#28a745',
            border: '2px solid #1e7e34'
          };
          legendItem.description = 'Base Map';
          legendItem.icon = '🌍';
        } else if (title === 'Satellite') {
          legendItem.style = {
            backgroundColor: '#6f42c1',
            border: '2px solid #5a2d91'
          };
          legendItem.description = 'Satellite Imagery';
          legendItem.icon = '🛰️';
        } else if (title === 'Streets') {
          legendItem.style = {
            backgroundColor: '#fd7e14',
            border: '2px solid #e55a00'
          };
          legendItem.description = 'Street Map';
          legendItem.icon = '🛣️';
        } else {
          // Default styling for other layers
          legendItem.style = {
            backgroundColor: '#6c757d',
            border: '2px solid #495057'
          };
          legendItem.description = 'Data Layer';
          legendItem.icon = '📊';
        }

        return legendItem;
      });

      setLegendItems(items);
    };

    // Initial update
    updateLegend();

    // Listen for layer changes
    const layerChangeListener = () => {
      updateLegend();
    };

    map.on('change:layers', layerChangeListener);
    
    // Listen for individual layer visibility changes
    const layers = map.getLayers();
    layers.forEach(layer => {
      layer.on('change:visible', layerChangeListener);
    });

    // Listen for resolution changes to update legend
    map.getView().on('change:resolution', layerChangeListener);

    return () => {
      map.un('change:layers', layerChangeListener);
      map.getView().un('change:resolution', layerChangeListener);
      layers.forEach(layer => {
        layer.un('change:visible', layerChangeListener);
      });
    };
  }, [map]);

  return (
    <div className="legend-widget">
      <h3>Legend</h3>
      <div className="legend-content">
        {legendItems.length > 0 ? (
          <div className="legend-list">
            {legendItems.map((item, index) => (
              <div key={index} className="legend-item">
                {item.legendUrl ? (
                  // Use actual legend image from GeoServer
                  <div className="legend-symbol">
                    <img 
                      src={item.legendUrl} 
                      alt={`Legend for ${item.name}`}
                      onError={(e) => {
                        // Fallback to icon if image fails to load
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="legend-fallback" style={{ display: 'none' }}>
                      {item.icon}
                    </div>
                  </div>
                ) : (
                  // Use custom icon for non-WMS layers
                  <div className="legend-symbol" style={item.style}>
                    {item.icon}
                  </div>
                )}
                <div className="legend-info">
                  <div className="legend-name">{item.name}</div>
                  {item.description && (
                    <div className="legend-description">{item.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="legend-empty">
            <p>No visible layers</p>
            <p className="legend-hint">Toggle layers to see legend items</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LegendWidget;
