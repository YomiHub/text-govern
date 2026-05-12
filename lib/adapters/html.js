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

  let parse5;
  try {
    parse5 = require('parse5');
  } catch (e) {
    return extractWithRegex(src, relativeFile);
  }

  const document = parse5.parse(src);
  const fragments = [];
  walkNode(document, src, relativeFile, fragments);
  return fragments;
}

const SKIP_TAGS = new Set(['script', 'style', 'meta', 'link', 'head']);

function walkNode(node, src, relativeFile, fragments) {
  if (!node) return;

  if (node.nodeName === '#text') {
    const value = (node.value || '').trim();
    if (HAS_CHINESE.test(value)) {
      const line = getLineFromOffset(src, node.sourceCodeLocation && node.sourceCodeLocation.startOffset || 0);
      try {
        fragments.push(
          createFragment({
            file: relativeFile,
            line,
            column: 1,
            raw: value,
            kind: 'html-text',
            surrounding: src.split('\n')[line - 1] || '',
          })
        );
      } catch (_) {}
    }
  }

  if (node.attrs) {
    const TEXT_ATTRS = new Set(['placeholder', 'title', 'alt', 'aria-label', 'label', 'value']);
    for (const attr of node.attrs) {
      if (TEXT_ATTRS.has(attr.name) && HAS_CHINESE.test(attr.value)) {
        const line = getLineFromOffset(src, node.sourceCodeLocation && node.sourceCodeLocation.startOffset || 0);
        try {
          fragments.push(
            createFragment({
              file: relativeFile,
              line,
              column: 1,
              raw: attr.value.trim(),
              kind: 'html-text',
              attrName: attr.name,
              surrounding: src.split('\n')[line - 1] || '',
            })
          );
        } catch (_) {}
      }
    }
  }

  // Skip script/style
  if (node.tagName && SKIP_TAGS.has(node.tagName.toLowerCase())) return;

  if (node.childNodes) {
    for (const child of node.childNodes) {
      walkNode(child, src, relativeFile, fragments);
    }
  }
}

function getLineFromOffset(src, offset) {
  return src.slice(0, offset).split('\n').length;
}

function extractWithRegex(src, relativeFile) {
  const { parse: parseWxml } = require('./wxml');
  return parseWxml(src, relativeFile);
}

module.exports = { extract };
