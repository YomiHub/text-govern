'use strict';

const fs = require('fs');
const { createFragment } = require('../extractor/fragment');

const HAS_CHINESE = /[\u4e00-\u9fff\u3400-\u4dbf]/;

/**
 * Walk a parsed JSON value recursively, extracting Chinese string values.
 * Tracks the JSON path (e.g. "window.navigationBarTitleText") for context.
 *
 * @param {any}    value        - Current JSON node value
 * @param {string} path         - Dot-notation path (for context)
 * @param {string} src          - Original source string (for line detection)
 * @param {string} relativeFile - Relative file path
 * @param {Array}  fragments    - Output array
 */
function walkJson(value, path, src, relativeFile, fragments) {
  if (typeof value === 'string') {
    if (HAS_CHINESE.test(value)) {
      // Best-effort line detection: search for the value in source
      const line = findLineOf(src, value);
      try {
        fragments.push(
          createFragment({
            file: relativeFile,
            line,
            column: 1,
            raw: value,
            kind: 'json-value',
            container: path,
            surrounding: path,
          })
        );
      } catch (_) {}
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => walkJson(item, `${path}[${i}]`, src, relativeFile, fragments));
  } else if (value && typeof value === 'object') {
    for (const [key, val] of Object.entries(value)) {
      walkJson(val, path ? `${path}.${key}` : key, src, relativeFile, fragments);
    }
  }
}

/**
 * Find approximate line number of a string value in JSON source.
 * Searches for the quoted value.
 */
function findLineOf(src, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`"${escaped}"`, 'm');
  const m = re.exec(src);
  if (!m) return 1;
  return src.slice(0, m.index).split('\n').length;
}

function extract(filePath, relativeFile) {
  let src;
  try {
    src = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return [];
  }

  let json;
  try {
    json = JSON.parse(src);
  } catch (e) {
    return [];
  }

  const fragments = [];
  walkJson(json, '', src, relativeFile, fragments);
  return fragments;
}

module.exports = { extract };
