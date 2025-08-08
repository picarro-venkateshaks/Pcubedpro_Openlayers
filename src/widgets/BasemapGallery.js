import React from 'react';
import './BasemapGallery.css';

const BasemapGallery = ({ currentBasemap, onBasemapChange }) => {
  const basemaps = [
    { id: 'osm', name: 'OpenStreetMap', icon: '🗺️' },
    { id: 'satellite', name: 'Satellite', icon: '🛰️' },
    { id: 'streets', name: 'Streets', icon: '🛣️' }
  ];

  return (
    <div className="basemap-gallery-widget">
      <h3>Base Maps</h3>
      <div className="basemap-list">
        {basemaps.map(basemap => (
          <button
            key={basemap.id}
            className={`basemap-option ${currentBasemap === basemap.id ? 'active' : ''}`}
            onClick={() => onBasemapChange(basemap.id)}
          >
            <span className="basemap-icon">{basemap.icon}</span>
            <span className="basemap-name">{basemap.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BasemapGallery;
