const path = require('path');

const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  output: "standalone",
  experimental: {
    outputFileTracingRoot: path.join(__dirname, ".."),
    turbopack: {
      root: path.join(__dirname, ".."),
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/functions/:function",
        destination: "https://:function-wu3h4frdia-uc.a.run.app",
      },

    ];
  },
};





module.exports = nextConfig;
