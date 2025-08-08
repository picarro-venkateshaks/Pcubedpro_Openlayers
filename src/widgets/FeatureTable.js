import React from 'react';
import './FeatureTable.css';

const FeatureTable = ({
  isFeatureTableCollapsed,
  onToggleTable,
  filteredFeatures,
  layerResults,
  activeTab,
  onTabChange,
  availableLayers,
  selectedFeatures,
  onFeatureSelect,
  onZoomToSelected,
  currentPage,
  onPageChange,
  isLoadingPage,
  getTotalPages,
  getPageNumbers,
  getTotalFeatures
}) => {
  return (
    <div className={`feature-table-widget ${isFeatureTableCollapsed ? 'collapsed' : ''}`}>
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
                  onClick={() => onTabChange(layerId)}
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
              onClick={onZoomToSelected}
              title="Zoom to selected features"
            >
              🔍 Zoom to Selected ({selectedFeatures.length})
            </button>
          )}
          <button
            className="collapse-btn"
            onClick={onToggleTable}
          >
            {isFeatureTableCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Table Expand Arrow - Bottom Center */}
      <button
        className={`table-expand-arrow ${isFeatureTableCollapsed ? 'collapsed' : ''}`}
        onClick={onToggleTable}
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
                      checked={selectedFeatures.length === filteredFeatures.length && filteredFeatures.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onFeatureSelect(filteredFeatures.map(f => f.id || f.properties?.id), true);
                        } else {
                          onFeatureSelect([], false);
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
                {filteredFeatures.map((feature, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedFeatures.includes(feature.id || feature.properties?.id)}
                        onChange={(e) => onFeatureSelect(feature.id || feature.properties?.id, e.target.checked)}
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
                  onPageChange(newPage);
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
                        onPageChange(pageNum);
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
                  onPageChange(newPage);
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
  );
};

export default FeatureTable;
