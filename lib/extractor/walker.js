'use strict';

const path = require('path');
const glob = require('fast-glob');

const ADAPTER_EXT_MAP = {
  wxml: ['.wxml'],
  js: ['.js', '.wxs'],
  json: ['.json'],
  vue: ['.vue'],
  jsx: ['.jsx', '.tsx'],
  html: ['.html', '.htm'],
  java: ['.java'],
  yaml: ['.yml', '.yaml'],
  properties: ['.properties'],
};

/**
 * Walk the project and collect files to scan, grouped by adapter type.
 *
 * @param {object} config  - Resolved config
 * @returns {Promise<Array<{file: string, adapter: string}>>}
 *   file: relative path from cwd
 *   adapter: adapter key
 */
async function walkFiles(config) {
  const { scan, _cwd } = config;
  const { include, exclude, adapters } = scan;

  // Build extension → adapter map from enabled adapters only
  const extAdapterMap = {};
  for (const adapter of adapters) {
    const exts = ADAPTER_EXT_MAP[adapter];
    if (!exts) continue;
    for (const ext of exts) {
      extAdapterMap[ext] = adapter;
    }
  }

  const patterns = include.map((p) => p.replace(/\\/g, '/'));
  const ignorePatterns = exclude.map((p) => p.replace(/\\/g, '/'));

  const files = await glob(patterns, {
    cwd: _cwd,
    ignore: ignorePatterns,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
  });

  const result = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const adapter = extAdapterMap[ext];
    if (!adapter) continue;
    result.push({ file, adapter });
  }

  return result;
}

module.exports = { walkFiles, ADAPTER_EXT_MAP };
