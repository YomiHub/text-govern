'use strict';

const CHINESE_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef\u2e80-\u2eff\u31c0-\u31ef]/g;

/**
 * Count how many Chinese characters are in a string.
 */
function countChinese(str) {
  const matches = str.match(CHINESE_RE);
  return matches ? matches.length : 0;
}

/**
 * Check whether a fragment's normalized text should be kept.
 *
 * @param {string} text         - The normalized text
 * @param {object} exclusions   - Config exclusions { minChineseChars, _compiled }
 * @returns {boolean}
 */
function shouldKeep(text, exclusions) {
  if (!text || text.length === 0) return false;

  const minChinese = exclusions.minChineseChars || 2;
  if (countChinese(text) < minChinese) return false;

  const patterns = exclusions._compiled || [];
  for (const re of patterns) {
    if (re.test(text)) return false;
  }

  return true;
}

/**
 * Deduplicate fragments by their id.
 * @param {Array} fragments
 * @returns {Array}
 */
function deduplicate(fragments) {
  const seen = new Set();
  return fragments.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

/**
 * Normalize and filter an array of raw fragments.
 * @param {Array} fragments   - Raw TextFragment[]
 * @param {object} config     - Full config object
 * @returns {Array}           - Filtered & deduplicated fragments
 */
function normalizeFragments(fragments, config) {
  const { exclusions } = config;
  const filtered = fragments.filter((f) => shouldKeep(f.normalized, exclusions));
  return deduplicate(filtered);
}

module.exports = { normalizeFragments, shouldKeep, countChinese, deduplicate };
