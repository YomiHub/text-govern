'use strict';

const path = require('path');

const ADAPTERS = {
  wxml: () => require('./wxml'),
  js: () => require('./js'),
  json: () => require('./json'),
  vue: () => require('./vue'),
  jsx: () => require('./react'),
  html: () => require('./html'),
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
 * @param {string} adapterKey    - Adapter to use (wxml/js/json/vue/jsx/html)
 * @returns {Array<TextFragment>}
 */
function extractFile(absolutePath, relativeFile, adapterKey) {
  const factory = ADAPTERS[adapterKey];
  if (!factory) return [];
  try {
    const adapter = factory();
    return adapter.extract(absolutePath, relativeFile) || [];
  } catch (e) {
    return [];
  }
}

module.exports = { extractFile, getAdapterKey, ADAPTERS, EXT_ADAPTER_MAP };
