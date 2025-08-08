import React, { useState } from 'react';
import './LeftPanel.css';
import BasemapGallery from './BasemapGallery';
import LayersPanel from './LayersPanel';
import LegendWidget from './LegendWidget';
import MeasureWidget from './MeasureWidget';
import SpatialQueryPanel from './SpatialQueryPanel';

const LeftPanel = ({ 
  currentBasemap, 
  onBasemapChange, 
  reportAreaVisible, 
  onReportAreaToggle,
  map,
  availableLayers,
  // Spatial query props
  selectedLayer,
  onLayerChange,
  isDrawing,
  onStartDrawing,
  onStopDrawing,
  onClearDrawing,
  isQuerying,
  queryResult,
  isFeatureTableCollapsed,
  onToggleTable
}) => {
  const [expandedWidget, setExpandedWidget] = useState('basemap'); // Default expanded
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const toggleWidget = (widgetName) => {
    if (expandedWidget === widgetName) {
      setExpandedWidget(null);
    } else {
      setExpandedWidget(widgetName);
    }
  };

  const togglePanel = () => {
    setIsPanelCollapsed(!isPanelCollapsed);
  };

  return (
    <div className={`left-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-content">
        {/* Widget Icons */}
        <div className="widget-icons">
          <button
            className={`widget-icon ${expandedWidget === 'basemap' ? 'active' : ''}`}
            onClick={() => toggleWidget('basemap')}
            title="Basemap Gallery"
          >
            🗺️
          </button>
          <button
            className={`widget-icon ${expandedWidget === 'layers' ? 'active' : ''}`}
            onClick={() => toggleWidget('layers')}
            title="Layers"
          >
            📋
          </button>
          <button
            className={`widget-icon ${expandedWidget === 'spatial-query' ? 'active' : ''}`}
            onClick={() => toggleWidget('spatial-query')}
            title="Spatial Query"
          >
            🔍
          </button>
          <button
            className={`widget-icon ${expandedWidget === 'legend' ? 'active' : ''}`}
            onClick={() => toggleWidget('legend')}
            title="Legend"
          >
            🎨
          </button>
          <button
            className={`widget-icon ${expandedWidget === 'measure' ? 'active' : ''}`}
            onClick={() => toggleWidget('measure')}
            title="Measure Tool"
          >
            📏
          </button>
          {/* Panel Toggle Button - now part of widget icons */}
          <button
            className="widget-icon panel-toggle-btn"
            onClick={togglePanel}
            title={isPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
            style={{ marginTop: 'auto' }}
          >
            {isPanelCollapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Widget Content */}
        <div className="widget-content">
          {expandedWidget === 'basemap' && (
            <BasemapGallery
              currentBasemap={currentBasemap}
              onBasemapChange={onBasemapChange}
            />
          )}
          
          {expandedWidget === 'layers' && (
            <LayersPanel
              reportAreaVisible={reportAreaVisible}
              onReportAreaToggle={onReportAreaToggle}
              availableLayers={availableLayers}
            />
          )}
          
          {expandedWidget === 'spatial-query' && (
            <SpatialQueryPanel
              selectedLayer={selectedLayer}
              onLayerChange={onLayerChange}
              availableLayers={availableLayers}
              isDrawing={isDrawing}
              onStartDrawing={onStartDrawing}
              onStopDrawing={onStopDrawing}
              onClearDrawing={onClearDrawing}
              isQuerying={isQuerying}
              queryResult={queryResult}
              isFeatureTableCollapsed={isFeatureTableCollapsed}
              onToggleTable={onToggleTable}
            />
          )}
          
          {expandedWidget === 'legend' && (
            <LegendWidget map={map} />
          )}
          
          {expandedWidget === 'measure' && (
            <MeasureWidget map={map} />
          )}
        </div>
      </div>
    </div>
  );
};

export default LeftPanel;
