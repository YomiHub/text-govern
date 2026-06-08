'use strict';

const path = require('path');

const ADAPTERS = {
  wxml: () => require('./wxml'),
  js: () => require('./js'),
  json: () => require('./json'),
  vue: () => require('./vue'),
  jsx: () => require('./react'),
  html: () => require('./html'),
  java: () => require('./java'),
  yaml: () => require('./yaml'),
  properties: () => require('./properties'),
};

const EXT_ADAPTER_MAP = {
  '.wxml': 'wxml',
  '.wxs': 'js',
  '.js': 'js',
  '.json': 'json',
  '.vue': 'vue',
  '.jsx': 'jsx',
  '.tsx': 'jsx',
  '.html': 'html',
  '.htm': 'html',
  '.java': 'java',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.properties': 'properties',
};

/**
 * Get the adapter key for a given file path.
 */
function getAdapterKey(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_ADAPTER_MAP[ext] || null;
}

/**
 * Extract TextFragments from a file.
 *
 * @param {string} absolutePath  - Absolute path to file
 * @param {string} relativeFile  - Relative path from cwd
 * @param {string} adapterKey    - Adapter to use (wxml/js/json/vue/jsx/html/java/yaml/properties)
 * @param {object} [config]      - Resolved text-govern config
 * @returns {Array<TextFragment>}
 */
function extractFile(absolutePath, relativeFile, adapterKey, config) {
  const factory = ADAPTERS[adapterKey];
  if (!factory) return [];
  try {
    const adapter = factory();
    return adapter.extract(absolutePath, relativeFile, config) || [];
  } catch (e) {
    return [];
  }
}

module.exports = { extractFile, getAdapterKey, ADAPTERS, EXT_ADAPTER_MAP };
