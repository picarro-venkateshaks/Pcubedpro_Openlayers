import React from 'react';
import './LayersPanel.css';

const LayersPanel = ({ reportAreaVisible, onReportAreaToggle, availableLayers }) => {
  return (
    <div className="layers-panel-widget">
      <h3>Layers</h3>
      <div className="layers-list">
        <div className="layer-item">
          <label className="layer-checkbox">
            <input
              type="checkbox"
              checked={reportAreaVisible}
              onChange={onReportAreaToggle}
            />
            <span className="checkbox-custom"></span>
            <span className="layer-name">Report Area ATCO</span>
          </label>
        </div>

        {availableLayers && availableLayers.map(layer => (
          <div key={layer.id} className="layer-item">
            <label className="layer-checkbox">
              <input
                type="checkbox"
                checked={layer.visible || false}
                onChange={() => {
                  // Handle layer visibility toggle
                  console.log('Toggle layer:', layer.id);
                }}
              />
              <span className="checkbox-custom"></span>
              <span className="layer-name">{layer.name}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LayersPanel;
