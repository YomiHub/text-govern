'use strict';

const fs = require('fs');
const { createFragment } = require('../extractor/fragment');

const HAS_CHINESE = /[\u4e00-\u9fff\u3400-\u4dbf]/;

function extract(filePath, relativeFile, config = {}) {
  let src;
  try {
    src = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return [];
  }

  const backend = (config.scan && config.scan.backend) || {};
  const opts = {
    includeComments: backend.includeComments === true,
    includeLogMessages: backend.includeLogMessages !== false,
    includeAnnotations: backend.includeAnnotations !== false,
  };

  return extractJavaLiterals(src, relativeFile, opts);
}

function extractJavaLiterals(src, relativeFile, opts) {
  const fragments = [];
  const lines = src.split('\n');
  const state = {
    inBlockComment: false,
    className: '',
    methodName: '',
    pendingAnnotation: '',
  };

  let i = 0;
  let line = 1;
  let column = 1;

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      updateContext(lines[line - 1] || '', state);
      line++;
      column = 1;
      i++;
      continue;
    }

    if (state.inBlockComment) {
      if (opts.includeComments && ch === '"' && src.slice(i, i + 3) !== '"""') {
        const parsed = readQuotedString(src, i, line, column);
        pushLiteral(fragments, parsed, relativeFile, lines, state, 'java-literal', 'comment');
        ({ i, line, column } = parsed.end);
        continue;
      }
      if (ch === '*' && next === '/') {
        state.inBlockComment = false;
        i += 2;
        column += 2;
      } else {
        i++;
        column++;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      if (opts.includeComments) {
        scanCommentText(src.slice(i + 2, end === -1 ? src.length : end), relativeFile, line, column + 2, lines, fragments);
      }
      if (end === -1) break;
      i = end;
      continue;
    }

    if (ch === '/' && next === '*') {
      state.inBlockComment = true;
      i += 2;
      column += 2;
      continue;
    }

    if (src.slice(i, i + 3) === '"""') {
      const parsed = readTextBlock(src, i, line, column);
      pushLiteral(fragments, parsed, relativeFile, lines, state, 'java-literal', classifyContext(lines[line - 1] || '', state));
      ({ i, line, column } = parsed.end);
      continue;
    }

    if (ch === '"') {
      const parsed = readQuotedString(src, i, line, column);
      const context = classifyContext(lines[line - 1] || '', state);
      if (
        (context !== 'annotation' || opts.includeAnnotations) &&
        (context !== 'log' || opts.includeLogMessages)
      ) {
        pushLiteral(fragments, parsed, relativeFile, lines, state, 'java-literal', context);
      }
      ({ i, line, column } = parsed.end);
      continue;
    }

    i++;
    column++;
  }

  return fragments;
}

function readQuotedString(src, start, line, column) {
  let value = '';
  let i = start + 1;
  let curLine = line;
  let curColumn = column + 1;
  let escaped = false;

  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') {
      curLine++;
      curColumn = 1;
      value += ch;
      escaped = false;
      i++;
      continue;
    }
    if (escaped) {
      value += decodeEscape(ch);
      escaped = false;
      i++;
      curColumn++;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      i++;
      curColumn++;
      continue;
    }
    if (ch === '"') {
      return {
        value,
        line,
        column,
        end: { i: i + 1, line: curLine, column: curColumn + 1 },
      };
    }
    value += ch;
    i++;
    curColumn++;
  }

  return { value, line, column, end: { i, line: curLine, column: curColumn } };
}

function readTextBlock(src, start, line, column) {
  const contentStart = start + 3;
  const endIndex = src.indexOf('"""', contentStart);
  const raw = endIndex === -1 ? src.slice(contentStart) : src.slice(contentStart, endIndex);
  const consumed = endIndex === -1 ? src.length : endIndex + 3;
  const beforeEnd = src.slice(start, consumed);
  const parts = beforeEnd.split('\n');
  const endLine = line + parts.length - 1;
  const endColumn = parts.length === 1 ? column + beforeEnd.length : parts[parts.length - 1].length + 1;

  return {
    value: raw.replace(/^\n/, '').replace(/\n\s*$/, '').trim(),
    line,
    column,
    end: { i: consumed, line: endLine, column: endColumn },
  };
}

function decodeEscape(ch) {
  switch (ch) {
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    case '"':
      return '"';
    case '\\':
      return '\\';
    default:
      return ch;
  }
}

function pushLiteral(fragments, parsed, relativeFile, lines, state, defaultKind, contextOverride) {
  const raw = cleanupValue(parsed.value);
  if (!shouldKeepRaw(raw)) return;

  const surrounding = lines[parsed.line - 1] || '';
  const context = contextOverride || classifyContext(surrounding, state);
  const kind = context === 'annotation' ? 'java-annotation' : defaultKind;

  try {
    fragments.push(
      createFragment({
        file: relativeFile,
        line: parsed.line,
        column: parsed.column,
        raw,
        kind,
        container: inferContainer(state, context, surrounding),
        context,
        surrounding: surrounding.slice(0, 160),
      })
    );
  } catch (_) {}
}

function scanCommentText(comment, relativeFile, line, column, lines, fragments) {
  const value = cleanupValue(comment.replace(/^\s*\*+/gm, ''));
  if (!shouldKeepRaw(value)) return;
  try {
    fragments.push(
      createFragment({
        file: relativeFile,
        line,
        column,
        raw: value,
        kind: 'java-comment',
        container: 'comment',
        context: 'comment',
        surrounding: lines[line - 1] || '',
      })
    );
  } catch (_) {}
}

function cleanupValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function shouldKeepRaw(value) {
  if (!value || !HAS_CHINESE.test(value)) return false;
  if (/^(https?:|jdbc:|classpath:|file:)/i.test(value)) return false;
  if (/^\s*(select|insert|update|delete)\s+/i.test(value)) return false;
  return true;
}

function updateContext(line, state) {
  const stripped = stripLineComment(line).trim();
  if (!stripped) return;

  const classMatch = stripped.match(/\b(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/);
  if (classMatch) {
    state.className = classMatch[1];
  }

  const methodMatch = stripped.match(
    /\b(?:public|protected|private|static|final|synchronized|abstract|native|\s)+[\w<>\[\], ?]+\s+([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*(?:throws [^{]+)?\{?\s*$/
  );
  if (methodMatch && !['if', 'for', 'while', 'switch', 'catch'].includes(methodMatch[1])) {
    state.methodName = methodMatch[1];
  }

  const annotationMatch = stripped.match(/@([A-Za-z_$][\w$.]*)/);
  state.pendingAnnotation = annotationMatch ? annotationMatch[1] : '';
}

function classifyContext(line, state) {
  const trimmed = stripLineComment(line).trim();
  if (trimmed.includes('@') || state.pendingAnnotation) return 'annotation';
  if (/\b(log|logger)\s*\.\s*(trace|debug|info|warn|error)\s*\(/i.test(trimmed)) return 'log';
  if (/\bnew\s+[A-Za-z_$][\w$]*(Exception|Error)\s*\(/.test(trimmed) || /\bthrow\s+new\b/.test(trimmed)) {
    return 'exception';
  }
  if (/\breturn\b/.test(trimmed)) return 'return';
  if (/\b(mail|email|subject|content|message)\b/i.test(trimmed)) return 'mail';
  return 'literal';
}

function inferContainer(state, context, line) {
  const parts = [];
  if (state.className) parts.push(state.className);
  if (state.methodName) parts.push(state.methodName);
  if (context === 'annotation') {
    const inlineAnnotation = (line || '').match(/@([A-Za-z_$][\w$.]*)/);
    const annotation = inlineAnnotation ? inlineAnnotation[1] : state.pendingAnnotation;
    if (annotation) parts.push(`@${annotation}`);
  }
  return parts.join('.') || context;
}

function stripLineComment(line) {
  const idx = line.indexOf('//');
  return idx === -1 ? line : line.slice(0, idx);
}

module.exports = { extract, extractJavaLiterals };
