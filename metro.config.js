const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundling
config.resolver.unstable_enablePackageExports = false;

// Workers
config.maxWorkers = 1;

module.exports = config;