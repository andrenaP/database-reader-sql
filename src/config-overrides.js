const webpack = require('webpack');

module.exports = function override(config, env) {
  // Ignore Node.js modules like fs and path in browser bundle
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    path: false,
  };

  // Optional: If you see other Node.js module errors later, add them here (e.g., crypto: false)

  return config;
};
