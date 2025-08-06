# React OpenLayers WMS Application

A modern React application that integrates OpenLayers to display WMS (Web Map Service) layers from GeoServer. This application demonstrates basic GIS functionality including map navigation, layer management, and base map switching.

## Features

- **Interactive Map**: Full-screen OpenLayers map with zoom, pan, and navigation controls
- **WMS Layer Integration**: Displays a sample WMS layer from GeoServer (US States)
- **Base Map Gallery**: Switch between different base maps:
  - OpenStreetMap
  - Satellite Imagery
  - Street Map
- **Layer Controls**: Toggle WMS layer visibility
- **Scale Display**: Shows current map scale
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn package manager

## Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

## Running the Application

Start the development server:

```bash
npm start
```

The application will open in your browser at `http://localhost:3000`

## Building for Production

To create a production build:

```bash
npm run build
```

## Project Structure

```
src/
├── App.js          # Main application component
├── App.css         # Application-specific styles
├── index.js        # React entry point
└── index.css       # Global styles and OpenLayers CSS

public/
└── index.html      # HTML template

package.json        # Dependencies and scripts
README.md          # This file
```

## Key Components

### Map Configuration
- Uses OpenLayers 8.2.0
- Centers on the United States (longitude: -98.5795, latitude: 39.8283)
- Zoom levels: 2-18
- Includes scale line and zoom slider controls

### WMS Layer
- Source: GeoServer demo server
- Layer: `topp:states` (US States boundaries)
- Format: PNG with transparency
- Version: WMS 1.1.1
- Layer Type: ImageLayer (not TileLayer for WMS)

### Base Maps
- **OpenStreetMap**: Default open-source street map
- **Satellite**: High-resolution satellite imagery from ArcGIS
- **Streets**: Detailed street map from ArcGIS

## Customization

### Changing the WMS Layer
To use a different WMS layer, modify the `wmsSource` configuration in `App.js`:

```javascript
const wmsSource = new ImageWMS({
  url: 'YOUR_GEOSERVER_URL/wms',
  params: {
    'LAYERS': 'YOUR_WORKSPACE:YOUR_LAYER',
    'TILED': true,
    'VERSION': '1.1.1',
    'FORMAT': 'image/png',
    'TRANSPARENT': true
  },
  serverType: 'geoserver',
  crossOrigin: 'anonymous'
});
```

### Adding More Layers
To add additional layers, create new layer instances and add them to the map:

```javascript
// For WMS layers, use ImageLayer
const wmsLayer = new ImageLayer({
  source: new ImageWMS({
    url: 'YOUR_WMS_URL',
    params: { 'LAYERS': 'YOUR_LAYER' }
  })
});

// For tile layers, use TileLayer
const tileLayer = new TileLayer({
  source: new XYZ({
    url: 'YOUR_TILE_URL'
  })
});

map.addLayer(wmsLayer);
map.addLayer(tileLayer);
```

## Dependencies

- **React**: 18.2.0 - UI framework
- **OpenLayers**: 8.2.0 - Mapping library
- **ol-ext**: 4.0.0 - OpenLayers extensions
- **react-scripts**: 5.0.1 - Development tools

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Troubleshooting

### CORS Issues
If you encounter CORS errors with WMS layers, ensure your GeoServer is configured to allow cross-origin requests.

### Layer Not Displaying
- Check the WMS URL and layer name
- Verify the layer is published in GeoServer
- Check browser console for error messages
- Ensure you're using `ImageLayer` for WMS layers, not `TileLayer`
- Verify CORS settings on your GeoServer

### Performance Issues
- Use tiled WMS layers for better performance
- Consider using vector layers for interactive features
- Optimize layer styling and symbology

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues and enhancement requests! 