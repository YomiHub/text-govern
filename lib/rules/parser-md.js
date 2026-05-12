'use strict';

/**
 * Parse a Markdown file containing rule tables.
 *
 * Supported table schemas:
 *
 * banned.md:
 *   | 词 | 替换建议 | 风险等级 | 分类 | 法规来源 |
 *
 * terminology.md:
 *   | 标准词 | 别名（逗号分隔） | 备注 |
 *
 * semantic.md:
 *   | 页面/路径 glob | 字段含义 | 禁用替代词 | 推荐词 |
 */

const HEADER_ALIASES = {
  word: ['词', '违禁词', '违规词', '关键词', '词汇', 'word'],
  suggestion: ['替换建议', '建议', '推荐替换', '推荐词', 'suggestion'],
  severity: ['风险等级', '等级', '严重程度', 'severity'],
  category: ['分类', '类别', '类型', 'category'],
  legalRef: ['法规来源', '法规', '参考', 'legalRef'],
  canonical: ['标准词', '规范词', '正确词', 'canonical'],
  aliases: ['别名', '别名（逗号分隔）', '同义词', 'aliases'],
  note: ['备注', '说明', 'note'],
  pageGlob: ['页面/路径 glob', '路径', '页面', 'pageGlob'],
  fieldMeaning: ['字段含义', '含义', '意义', 'fieldMeaning'],
  forbidden: ['禁用替代词', '禁用词', '禁止词', 'forbidden'],
};

function normalizeHeader(h) {
  return (h || '').trim().toLowerCase().replace(/[\s（(）)]/g, '');
}

function resolveColumn(headers, key) {
  const aliases = HEADER_ALIASES[key] || [key];
  for (let i = 0; i < headers.length; i++) {
    const norm = normalizeHeader(headers[i]);
    for (const alias of aliases) {
      if (norm === normalizeHeader(alias)) return i;
    }
  }
  return -1;
}

/**
 * Parse a markdown table block (array of raw lines).
 * Returns [{col0, col1, ...}] with header keys resolved.
 */
function parseTable(tableLines) {
  if (tableLines.length < 2) return [];

  const parseRow = (line) =>
    line
      .split('|')
      .map((c) => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1); // trim leading/trailing empty cells

  const headers = parseRow(tableLines[0]);
  // Skip separator row (---|---|...)
  const dataLines = tableLines.slice(2);

  return dataLines
    .map((line) => {
      const cells = parseRow(line);
      const row = {};
      headers.forEach((h, i) => {
        row[h] = cells[i] || '';
      });
      return row;
    })
    .filter((row) => Object.values(row).some((v) => v.trim()));
}

/**
 * Detect the rule type from header keywords.
 */
function detectType(headers) {
  const norm = headers.map(normalizeHeader).join(',');
  if (norm.includes('标准词') || norm.includes('别名')) return 'terminology';
  if (norm.includes('页面') || norm.includes('pageglob')) return 'semantic';
  if (norm.includes('词') || norm.includes('违禁')) return 'banned';
  return 'unknown';
}

/**
 * Parse a Markdown file and return { banned: [], terminology: [], semantic: [] }.
 */
function parseMarkdownRules(src) {
  const result = { banned: [], terminology: [], semantic: [] };

  const lines = src.split('\n');
  let tableLines = [];

  const flushTable = () => {
    if (tableLines.length < 2) {
      tableLines = [];
      return;
    }

    const parseRow = (line) =>
      line
        .split('|')
        .map((c) => c.trim())
        .filter((_, i, arr) => i > 0 && i < arr.length - 1);

    const headers = parseRow(tableLines[0]);
    const type = detectType(headers);
    const rows = parseTable(tableLines);

    for (const row of rows) {
      if (type === 'banned') {
        const wordIdx = resolveColumn(headers, 'word');
        const word = (wordIdx >= 0 ? Object.values(row)[wordIdx] : '').trim();
        if (!word) continue;
        result.banned.push({
          word,
          suggestion: getCellByKey(row, headers, 'suggestion'),
          severity: getCellByKey(row, headers, 'severity') || '高风险',
          category: getCellByKey(row, headers, 'category') || '违规治理',
          legalRef: getCellByKey(row, headers, 'legalRef'),
          note: getCellByKey(row, headers, 'note'),
        });
      } else if (type === 'terminology') {
        const canonical = getCellByKey(row, headers, 'canonical').trim();
        if (!canonical) continue;
        const aliasStr = getCellByKey(row, headers, 'aliases');
        const aliases = aliasStr
          ? aliasStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
          : [];
        result.terminology.push({ canonical, aliases, note: getCellByKey(row, headers, 'note') });
      } else if (type === 'semantic') {
        const pageGlob = getCellByKey(row, headers, 'pageGlob').trim();
        if (!pageGlob) continue;
        const forbiddenStr = getCellByKey(row, headers, 'forbidden');
        const forbidden = forbiddenStr
          ? forbiddenStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
          : [];
        result.semantic.push({
          pageGlob,
          fieldMeaning: getCellByKey(row, headers, 'fieldMeaning'),
          forbidden,
          suggestion: getCellByKey(row, headers, 'suggestion'),
          note: getCellByKey(row, headers, 'note'),
        });
      }
    }

    tableLines = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      tableLines.push(line);
    } else {
      if (tableLines.length > 0) flushTable();
    }
  }
  if (tableLines.length > 0) flushTable();

  return result;
}

function getCellByKey(row, headers, key) {
  const idx = resolveColumn(headers, key);
  if (idx < 0) return '';
  return Object.values(row)[idx] || '';
}

module.exports = { parseMarkdownRules };
