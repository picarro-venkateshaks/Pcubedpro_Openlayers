import React, { useState, useEffect, useRef } from 'react';
import Draw from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style';
import { unByKey } from 'ol/Observable';
import { getLength, getArea } from 'ol/sphere';
import { transform } from 'ol/proj';
import './MeasureWidget.css';

const MeasureWidget = ({ map }) => {
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measureType, setMeasureType] = useState('distance');
  const [measurements, setMeasurements] = useState([]);
  const [currentMeasurement, setCurrentMeasurement] = useState(null);
  
  const measureSourceRef = useRef(null);
  const measureLayerRef = useRef(null);
  const drawInteractionRef = useRef(null);
  const listenerRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    // Create measure layer and source
    const measureSource = new VectorSource();
    const measureLayer = new VectorLayer({
      source: measureSource,
      style: new Style({
        fill: new Fill({
          color: 'rgba(255, 0, 0, 0.2)'
        }),
        stroke: new Stroke({
          color: '#ff0000',
          width: 2
        }),
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({
            color: '#ff0000'
          })
        })
      }),
      zIndex: 1000
    });

    measureSourceRef.current = measureSource;
    measureLayerRef.current = measureLayer;
    map.addLayer(measureLayer);

    return () => {
      if (measureLayer && map) {
        map.removeLayer(measureLayer);
      }
      if (listenerRef.current) {
        unByKey(listenerRef.current);
      }
    };
  }, [map]);

  const startMeasuring = (type) => {
    if (!map || !measureSourceRef.current) return;

    // Stop any existing measurement
    stopMeasuring();

    setMeasureType(type);
    setIsMeasuring(true);
    setCurrentMeasurement({
      type: type,
      points: [],
      distance: 0,
      area: 0
    });

    // Create draw interaction
    const drawInteraction = new Draw({
      source: measureSourceRef.current,
      type: type === 'distance' ? 'LineString' : 'Polygon',
      style: new Style({
        fill: new Fill({
          color: 'rgba(255, 0, 0, 0.2)'
        }),
        stroke: new Stroke({
          color: '#ff0000',
          width: 2
        }),
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({
            color: '#ff0000'
          })
        })
      })
    });

    drawInteractionRef.current = drawInteraction;
    map.addInteraction(drawInteraction);

    // Add listener for draw end
    listenerRef.current = drawInteraction.on('drawend', (event) => {
      const feature = event.feature;
      const geometry = feature.getGeometry();
      
      let measurement = {
        type: type,
        feature: feature,
        points: geometry.getCoordinates(),
        distance: 0,
        area: 0
      };

      if (type === 'distance') {
        const length = getLength(geometry);
        measurement.distance = length;
        measurement.formatted = formatDistance(length);
      } else {
        const area = getArea(geometry);
        measurement.area = area;
        measurement.formatted = formatArea(area);
      }

      setCurrentMeasurement(measurement);
      setMeasurements(prev => [...prev, measurement]);
      stopMeasuring();
    });
  };

  const stopMeasuring = () => {
    if (drawInteractionRef.current && map) {
      map.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    if (listenerRef.current) {
      unByKey(listenerRef.current);
      listenerRef.current = null;
    }
    setIsMeasuring(false);
    setCurrentMeasurement(null);
  };

  const clearMeasurements = () => {
    if (measureSourceRef.current) {
      measureSourceRef.current.clear();
    }
    setMeasurements([]);
    setCurrentMeasurement(null);
  };

  const formatDistance = (distance) => {
    if (distance < 1000) {
      return `${distance.toFixed(2)} m`;
    } else {
      return `${(distance / 1000).toFixed(2)} km`;
    }
  };

  const formatArea = (area) => {
    if (area < 1000000) {
      return `${area.toFixed(2)} m²`;
    } else {
      return `${(area / 1000000).toFixed(2)} km²`;
    }
  };

  const removeMeasurement = (index) => {
    const measurement = measurements[index];
    if (measurement.feature && measureSourceRef.current) {
      measureSourceRef.current.removeFeature(measurement.feature);
    }
    setMeasurements(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="measure-widget">
      <h3>Measure Tool</h3>
      <div className="measure-controls">
        <div className="measure-buttons">
          <button
            className={`measure-btn ${isMeasuring && measureType === 'distance' ? 'active' : ''}`}
            onClick={() => startMeasuring('distance')}
            disabled={isMeasuring}
          >
            📏 Distance
          </button>
          <button
            className={`measure-btn ${isMeasuring && measureType === 'area' ? 'active' : ''}`}
            onClick={() => startMeasuring('area')}
            disabled={isMeasuring}
          >
            📐 Area
          </button>
        </div>
        
        {isMeasuring && (
          <div className="measure-status">
            <span>🎯 Measuring {measureType} - Click to add points</span>
            <button
              className="stop-measure-btn"
              onClick={stopMeasuring}
            >
              Stop
            </button>
          </div>
        )}
        
        {measurements.length > 0 && (
          <div className="measure-results">
            <h4>Measurements</h4>
            {measurements.map((measurement, index) => (
              <div key={index} className="measurement-item">
                <span className="measurement-type">
                  {measurement.type === 'distance' ? '📏' : '📐'} 
                  {measurement.type === 'distance' ? 'Distance' : 'Area'}
                </span>
                <span className="measurement-value">
                  {measurement.formatted}
                </span>
                <button
                  className="remove-measurement-btn"
                  onClick={() => removeMeasurement(index)}
                  title="Remove measurement"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="clear-measurements-btn"
              onClick={clearMeasurements}
            >
              Clear All
            </button>
          </div>
        )}
        
        {!isMeasuring && measurements.length === 0 && (
          <div className="measure-hint">
            <p>Select a measurement tool to start</p>
            <p className="hint-text">Click on the map to add measurement points</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeasureWidget;
