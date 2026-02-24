const guacClient = 'http://127.0.0.1:8080';
const expectedOrigin = 'http://10.36.133.178:8080';
const evidenceService = 'http://127.0.0.1:5000';

module.exports = {
  transpileDependencies: ['vuex-persist'],
  devServer: {
    proxy: {
      '/api/compliance': {
        target: evidenceService,
        changeOrigin: true
      },
      '/api': {
        target: guacClient,
        changeOrigin: true,
        onProxyReq: function (proxyReq) {
          proxyReq.setHeader('Origin', expectedOrigin);
        }
      },
      '/tunnel': {
        target: guacClient,
        changeOrigin: true,
        ws: false,
        onProxyReq: function (proxyReq) {
          proxyReq.setHeader('Origin', expectedOrigin);
        }
      },
      '/websocket-tunnel': {
        target: guacClient,
        changeOrigin: true,
        ws: true,
        onProxyReqWs: function (proxyReq) {
          proxyReq.setHeader('Origin', expectedOrigin);
        }
      },
      '/liderws': {
        target: guacClient,
        changeOrigin: true,
        ws: true,
        onProxyReq: function (proxyReq) {
          proxyReq.setHeader('Origin', expectedOrigin);
        },
        onProxyReqWs: function (proxyReq) {
          proxyReq.setHeader('Origin', expectedOrigin);
        }
      }
    }
  }
}