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

  const fragments = [];
  const lines = src.split('\n');
  lines.forEach((lineText, index) => {
    const line = index + 1;
    const trimmed = lineText.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) return;

    const splitAt = findSeparator(lineText);
    if (splitAt === -1) return;

    const key = lineText.slice(0, splitAt).trim();
    const value = lineText.slice(splitAt + 1).trim();
    if (!HAS_CHINESE.test(value)) return;
    if (/^(https?:|jdbc:|classpath:|file:)/i.test(value)) return;

    try {
      fragments.push(
        createFragment({
          file: relativeFile,
          line,
          column: Math.max(1, lineText.indexOf(value) + 1),
          raw: value,
          kind: 'properties-value',
          container: key,
          context: 'config',
          surrounding: lineText.slice(0, 160),
        })
      );
    } catch (_) {}
  });

  return fragments;
}

function findSeparator(line) {
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if ((ch === '=' || ch === ':') && line[i - 1] !== '\\') return i;
  }
  return -1;
}

module.exports = { extract };
