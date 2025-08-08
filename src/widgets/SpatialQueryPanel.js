import React from 'react';
import './SpatialQueryPanel.css';

const SpatialQueryPanel = ({
  selectedLayer,
  onLayerChange,
  availableLayers,
  isDrawing,
  onStartDrawing,
  onStopDrawing,
  onClearDrawing,
  isQuerying,
  queryResult,
  isFeatureTableCollapsed,
  onToggleTable
}) => {
  return (
    <div className="spatial-query-panel-widget">
      <div className="panel-header">
        <h3>Spatial Query</h3>
        <button
          className="collapse-btn"
          onClick={onToggleTable}
          title={isFeatureTableCollapsed ? 'Expand table' : 'Collapse table'}
        >
          {isFeatureTableCollapsed ? '▼' : '▲'}
        </button>
      </div>

      <div className="query-controls">
        <div className="layer-selector">
          <label>Layer:</label>
          <select
            value={selectedLayer}
            onChange={(e) => onLayerChange(e.target.value)}
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
            onClick={onStartDrawing}
            disabled={isDrawing}
            className="primary-btn"
          >
            {isDrawing ? 'Drawing...' : 'Draw Box'}
          </button>
          <button
            onClick={onStopDrawing}
            disabled={!isDrawing}
            className="secondary-btn"
          >
            Stop Drawing
          </button>
          <button
            onClick={onClearDrawing}
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
  );
};

export default SpatialQueryPanel;
