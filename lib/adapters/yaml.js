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
  const pathStack = [];
  const lines = src.split('\n');

  lines.forEach((lineText, index) => {
    const line = index + 1;
    const withoutComment = stripYamlComment(lineText);
    if (!withoutComment.trim()) return;

    const indent = (withoutComment.match(/^\s*/) || [''])[0].length;
    while (pathStack.length && indent <= pathStack[pathStack.length - 1].indent) {
      pathStack.pop();
    }

    const listMatch = withoutComment.match(/^\s*-\s*(.+)$/);
    if (listMatch) {
      const value = unquote(listMatch[1].trim());
      pushYamlFragment(fragments, relativeFile, line, lineText, value, pathStack.map((item) => item.key).join('.'));
      return;
    }

    const keyValue = withoutComment.match(/^\s*([^:#][^:]*):(?:\s*(.*))?$/);
    if (!keyValue) return;

    const key = keyValue[1].trim();
    const value = (keyValue[2] || '').trim();
    if (!value) {
      pathStack.push({ indent, key });
      return;
    }

    const container = [...pathStack.map((item) => item.key), key].join('.');
    pushYamlFragment(fragments, relativeFile, line, lineText, unquote(value), container);
  });

  return fragments;
}

function pushYamlFragment(fragments, relativeFile, line, lineText, value, container) {
  const raw = String(value || '').trim();
  if (!shouldKeep(raw)) return;
  try {
    fragments.push(
      createFragment({
        file: relativeFile,
        line,
        column: Math.max(1, lineText.indexOf(value) + 1),
        raw,
        kind: 'yaml-value',
        container,
        context: 'config',
        surrounding: lineText.slice(0, 160),
      })
    );
  } catch (_) {}
}

function stripYamlComment(line) {
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if ((ch === '"' || ch === "'") && line[i - 1] !== '\\') {
      quote = quote === ch ? '' : quote || ch;
    }
    if (ch === '#' && !quote && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function shouldKeep(value) {
  if (!value || !HAS_CHINESE.test(value)) return false;
  if (/^(https?:|jdbc:|classpath:|file:)/i.test(value)) return false;
  return true;
}

module.exports = { extract };
