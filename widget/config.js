/**
 * Widget configuration
 */
module.exports = {
  /** Build marker shown in diagnostics to distinguish stale windows */
  build: 'local-service-2026-05-30',

  /** Data service endpoint */
  serviceUrl: 'http://127.0.0.1:19220/api/credits',

  /** Auto-refresh interval in milliseconds */
  refreshInterval: 30000,

  /** Request timeout in milliseconds */
  requestTimeout: 10000,

  /** Window dimensions */
  window: {
    width: 268,
    height: 176,
    yOffset: 0,
  },
};
