'use strict';

const fs = require('fs');
const { createFragment } = require('../extractor/fragment');

const HAS_CHINESE = /[\u4e00-\u9fff\u3400-\u4dbf]/;

// Paths to skip (import/require, URL-like, etc.)
const SKIP_PARENT_TYPES = new Set([
  'ImportDeclaration',
  'ExportAllDeclaration',
  'ExportNamedDeclaration',
]);

/**
 * Use @babel/parser + @babel/traverse to extract Chinese string literals.
 */
function extractWithBabel(src, relativeFile) {
  let parser, traverse;
  try {
    parser = require('@babel/parser');
    traverse = require('@babel/traverse').default;
  } catch (e) {
    return extractWithRegex(src, relativeFile);
  }

  const fragments = [];
  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: 'module',
      allowUndeclaredExports: true,
      plugins: ['jsx', 'optionalChaining', 'nullishCoalescingOperator'],
      errorRecovery: true,
    });
  } catch (e) {
    // Fallback to regex on parse error
    return extractWithRegex(src, relativeFile);
  }

  try {
    traverse(ast, {
      StringLiteral(nodePath) {
        const { node } = nodePath;
        const value = node.value || '';
        if (!HAS_CHINESE.test(value)) return;

        // Skip import paths, require paths
        const parentType = nodePath.parent && nodePath.parent.type;
        if (SKIP_PARENT_TYPES.has(parentType)) return;
        if (parentType === 'CallExpression') {
          const callee = nodePath.parent.callee;
          if (callee && callee.name === 'require') return;
        }

        const loc = node.loc && node.loc.start;
        const line = loc ? loc.line : 0;
        const column = loc ? loc.column + 1 : 0;
        const surrounding = src.split('\n')[line - 1] || '';

        try {
          fragments.push(
            createFragment({
              file: relativeFile,
              line,
              column,
              raw: value,
              kind: 'js-literal',
              surrounding: surrounding.slice(0, 120),
            })
          );
        } catch (_) {}
      },

      TemplateLiteral(nodePath) {
        const { node } = nodePath;
        // Extract quasis (static parts of template strings)
        for (const quasi of node.quasis || []) {
          const value = quasi.value && quasi.value.cooked;
          if (!value || !HAS_CHINESE.test(value)) continue;
          const loc = quasi.loc && quasi.loc.start;
          const line = loc ? loc.line : 0;
          const column = loc ? loc.column + 1 : 0;
          const surrounding = src.split('\n')[line - 1] || '';
          try {
            fragments.push(
              createFragment({
                file: relativeFile,
                line,
                column,
                raw: value.trim(),
                kind: 'js-literal',
                surrounding: surrounding.slice(0, 120),
              })
            );
          } catch (_) {}
        }
      },
    });
  } catch (e) {
    // Traverse error — return what we have
  }

  return fragments;
}

/**
 * Regex-based fallback for environments without @babel/parser.
 */
function extractWithRegex(src, relativeFile) {
  const fragments = [];
  const lines = src.split('\n');

  // Match single/double quoted strings and template literal quasis
  const re = /(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const value = (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]) || '';
    if (!HAS_CHINESE.test(value)) continue;

    // Compute line number from character offset
    const before = src.slice(0, m.index);
    const line = before.split('\n').length;
    const lineStart = before.lastIndexOf('\n') + 1;
    const column = m.index - lineStart + 1;
    const surrounding = lines[line - 1] || '';

    try {
      fragments.push(
        createFragment({
          file: relativeFile,
          line,
          column,
          raw: value.trim(),
          kind: 'js-literal',
          surrounding: surrounding.slice(0, 120),
        })
      );
    } catch (_) {}
  }

  return fragments;
}

/**
 * @param {string|null} filePath     - Absolute path (null if src provided directly)
 * @param {string}      relativeFile - Relative path (for fragment id)
 * @param {string}      [srcOverride] - Source code if already loaded (e.g. from Vue adapter)
 */
function extract(filePath, relativeFile, srcOverride) {
  let src = srcOverride;
  if (!src) {
    try {
      src = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      return [];
    }
  }
  return extractWithBabel(src, relativeFile);
}

module.exports = { extract };
