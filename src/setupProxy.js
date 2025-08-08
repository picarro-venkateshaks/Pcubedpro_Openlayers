const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy for WMS service (optional - for CORS issues)
  app.use(
    '/wms',
    createProxyMiddleware({
      target: 'http://20.20.152.180:8181',
      changeOrigin: true,
      pathRewrite: {
        '^/wms': '/geoserver/Picarro/wms',
      },
    })
  );

  // Legacy proxy for geoserver (keeping for backward compatibility)
  app.use(
    '/geoserver',
    createProxyMiddleware({
      target: 'http://localhost:8080',
      changeOrigin: true,
      pathRewrite: {
        '^/geoserver': '/geoserver',
      },
    })
  );
}; 