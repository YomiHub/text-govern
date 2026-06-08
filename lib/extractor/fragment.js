'use strict';

const crypto = require('crypto');

/**
 * Create a TextFragment — the minimal unit of extracted text.
 *
 * @param {object} params
 * @param {string} params.file        - Relative file path from project root
 * @param {number} params.line        - 1-based line number
 * @param {number} params.column      - 1-based column number
 * @param {string} params.raw         - Raw text as it appears in source
 * @param {string} params.kind        - wxml-text|wxml-attr|js-literal|json-value|vue-text|jsx-text|html-text
 * @param {string} [params.container] - CSS-like selector or context path (e.g. "view.total_name")
 * @param {string} [params.surrounding] - A short snippet of surrounding code for context
 * @param {string} [params.attrName]  - Attribute name if kind === 'wxml-attr'
 * @param {string} [params.context]   - Optional scenario tag (e.g. "annotation", "log", "exception")
 */
function createFragment(params) {
  const {
    file,
    line,
    column,
    raw,
    kind,
    container = '',
    surrounding = '',
    attrName = '',
    context = '',
  } = params;

  if (!file || !raw || !kind) {
    throw new Error(`Fragment missing required fields: ${JSON.stringify(params)}`);
  }

  const normalized = raw.trim().replace(/\s+/g, ' ');

  // pageHint: infer page context from file path (e.g. "more/integral" from "packageA/pages/more/integral/index.wxml")
  const pageHint = inferPageHint(file);

  const id = buildId(file, line, column, normalized);

  return {
    id,
    file,
    line,
    column,
    raw,
    normalized,
    kind,
    container,
    attrName,
    context,
    surrounding,
    pageHint,
  };
}

function buildId(file, line, column, normalized) {
  const hash = crypto
    .createHash('md5')
    .update(`${file}:${line}:${column}:${normalized}`)
    .digest('hex')
    .slice(0, 8);
  return `${file}:${line}:${column}:${hash}`;
}

function inferPageHint(file) {
  // Match patterns like: pages/more/integral/index.wxml → more/integral
  //   or packageA/pages/more/integral/index.wxml → more/integral
  const m = file.match(/pages\/(.+?)\/(?:index|[^/]+)\.[^/]+$/);
  if (m) return m[1];
  // Fallback: return the directory path minus extension
  return file.replace(/\.[^/]+$/, '');
}

module.exports = { createFragment, buildId, inferPageHint };
