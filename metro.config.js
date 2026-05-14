const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Workaround for bundling warning with victory-native@41.x
config.resolver.unstable_enablePackageExports = false;

module.exports = config;