'use strict';

const fs = require('fs');
const { createFragment } = require('../extractor/fragment');
const { WXML_TEXT_ATTRS } = require('../constants');

// Chinese character range
const HAS_CHINESE = /[\u4e00-\u9fff\u3400-\u4dbf]/;

/**
 * Extract Chinese string literals from a Mustache expression.
 * e.g. {{ x ? "全部月份" : y }} → ["全部月份"]
 */
function extractMustacheLiterals(expr) {
  const results = [];
  // Double-quoted strings inside mustache
  const re = /["']([\u4e00-\u9fff\u3400-\u4dbf][^"']*?)["']/g;
  let m;
  while ((m = re.exec(expr)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

/**
 * Strip mustache expressions from text, return plain text portions.
 * e.g. "你好{{name}}世界" → "你好 世界"
 */
function stripMustache(text) {
  return text.replace(/\{\{[^}]*\}\}/g, ' ').trim();
}

/**
 * Parse WXML source and return TextFragment[].
 *
 * Strategy (no external parser dependency):
 * 1. Iterate line by line, track inside-tag state.
 * 2. Collect text node content between tags.
 * 3. For attributes matching WXML_TEXT_ATTRS, extract their value.
 * 4. For mustache {{ }} inside text nodes and attrs, extract string literals.
 */
function parse(src, relativeFile) {
  const fragments = [];
  const lines = src.split('\n');

  // Tag scanning state
  let inComment = false;
  let inScript = false;
  let currentTag = '';

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNo = lineIdx + 1;
    const line = lines[lineIdx];

    // Skip HTML comments
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      continue;
    }
    if (line.includes('<!--')) {
      if (!line.includes('-->')) inComment = true;
      continue;
    }

    // Skip wxs script blocks
    if (inScript) {
      if (/<\/wxs\s*>/.test(line)) inScript = false;
      continue;
    }
    if (/<wxs[\s>]/.test(line)) {
      if (!/<\/wxs\s*>/.test(line)) inScript = true;
      continue;
    }

    // --- Extract text node content (between > and <) ---
    const textNodeRe = />([^<]+)</g;
    let m;
    while ((m = textNodeRe.exec(line)) !== null) {
      const raw = m[1];
      const col = m.index + 1;

      // Plain Chinese text
      const plain = stripMustache(raw);
      if (HAS_CHINESE.test(plain)) {
        addFragment(fragments, relativeFile, lineNo, col, plain.trim(), 'wxml-text', '', raw);
      }

      // Mustache literal strings with Chinese
      const mustacheRe = /\{\{([^}]+)\}\}/g;
      let mm;
      while ((mm = mustacheRe.exec(raw)) !== null) {
        const literals = extractMustacheLiterals(mm[1]);
        for (const lit of literals) {
          if (HAS_CHINESE.test(lit)) {
            addFragment(
              fragments,
              relativeFile,
              lineNo,
              m.index + mm.index + 1,
              lit,
              'wxml-text',
              '{{}}',
              mm[0]
            );
          }
        }
      }
    }

    // --- Extract attribute values ---
    // Match: attrName="value" or attrName='value'
    const attrRe = /(\b[\w-]+)\s*=\s*(?:"([^"]*?)"|'([^']*?)')/g;
    while ((m = attrRe.exec(line)) !== null) {
      const attrName = m[1].toLowerCase();
      const value = (m[2] !== undefined ? m[2] : m[3]) || '';
      const col = m.index + 1;

      if (WXML_TEXT_ATTRS.includes(attrName) && HAS_CHINESE.test(value)) {
        const plain = stripMustache(value);
        if (HAS_CHINESE.test(plain)) {
          addFragment(
            fragments,
            relativeFile,
            lineNo,
            col,
            plain.trim(),
            'wxml-attr',
            attrName,
            value
          );
        }
        // Mustache literals inside attribute
        const mRe = /\{\{([^}]+)\}\}/g;
        let mm2;
        while ((mm2 = mRe.exec(value)) !== null) {
          const literals = extractMustacheLiterals(mm2[1]);
          for (const lit of literals) {
            if (HAS_CHINESE.test(lit)) {
              addFragment(
                fragments,
                relativeFile,
                lineNo,
                m.index + mm2.index + 1,
                lit,
                'wxml-attr',
                attrName,
                mm2[0]
              );
            }
          }
        }
      }
    }
  }

  return fragments;
}

function addFragment(fragments, file, line, column, text, kind, attrName, surrounding) {
  if (!text || text.length === 0) return;
  try {
    fragments.push(
      createFragment({
        file,
        line,
        column,
        raw: text,
        kind,
        attrName,
        surrounding: surrounding ? surrounding.slice(0, 120) : '',
        container: '',
      })
    );
  } catch (e) {
    // ignore malformed fragments
  }
}

/**
 * Adapter entry point.
 * @param {string} filePath     - Absolute file path
 * @param {string} relativeFile - Relative file path from cwd
 * @returns {Array<TextFragment>}
 */
function extract(filePath, relativeFile) {
  let src;
  try {
    src = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return [];
  }
  return parse(src, relativeFile);
}

module.exports = { extract, parse };
