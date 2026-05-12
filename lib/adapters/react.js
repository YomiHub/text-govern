'use strict';

const fs = require('fs');
const { createFragment } = require('../extractor/fragment');

const HAS_CHINESE = /[\u4e00-\u9fff\u3400-\u4dbf]/;

function extract(filePath, relativeFile) {
  let src;
  try {
    src = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return [];
  }

  let parser, traverse;
  try {
    parser = require('@babel/parser');
    traverse = require('@babel/traverse').default;
  } catch (e) {
    return [];
  }

  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: 'module',
      plugins: ['jsx', 'tsx', 'typescript', 'optionalChaining', 'nullishCoalescingOperator'],
      errorRecovery: true,
    });
  } catch (e) {
    return [];
  }

  const fragments = [];
  const lines = src.split('\n');

  try {
    traverse(ast, {
      JSXText(nodePath) {
        const value = (nodePath.node.value || '').trim();
        if (!HAS_CHINESE.test(value)) return;
        const loc = nodePath.node.loc && nodePath.node.loc.start;
        const line = loc ? loc.line : 0;
        const column = loc ? loc.column + 1 : 0;
        try {
          fragments.push(
            createFragment({
              file: relativeFile,
              line,
              column,
              raw: value,
              kind: 'jsx-text',
              surrounding: (lines[line - 1] || '').slice(0, 120),
            })
          );
        } catch (_) {}
      },

      StringLiteral(nodePath) {
        const value = nodePath.node.value || '';
        if (!HAS_CHINESE.test(value)) return;
        // Skip import paths
        const parentType = nodePath.parent && nodePath.parent.type;
        if (parentType === 'ImportDeclaration') return;
        const loc = nodePath.node.loc && nodePath.node.loc.start;
        const line = loc ? loc.line : 0;
        const column = loc ? loc.column + 1 : 0;
        try {
          fragments.push(
            createFragment({
              file: relativeFile,
              line,
              column,
              raw: value,
              kind: 'jsx-text',
              surrounding: (lines[line - 1] || '').slice(0, 120),
            })
          );
        } catch (_) {}
      },
    });
  } catch (e) {
    // partial result
  }

  return fragments;
}

module.exports = { extract };
