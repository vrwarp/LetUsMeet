const path = require('path');

const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
};


module.exports = nextConfig;



