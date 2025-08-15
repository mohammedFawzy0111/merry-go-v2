// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Make sure TS extensions are included
config.resolver.sourceExts.push('ts', 'tsx');

module.exports = config;