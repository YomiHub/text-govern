'use strict';

/**
 * Parse an xlsx rule file.
 * Sheet names determine type: "banned" | "terminology" | "semantic"
 * Falls back to detecting by header content.
 */
function parseXlsxRules(filePath) {
  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch (e) {
    throw new Error(`xlsx 包未安装，请在 scripts/text-govern 目录运行 npm install: ${e.message}`);
  }

  const { parseMarkdownRules } = require('./parser-md');

  const workbook = XLSX.readFile(filePath);
  const result = { banned: [], terminology: [], semantic: [] };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert sheet to CSV-like markdown table
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 2) continue;

    // Build a fake markdown table and reuse parser
    const mdLines = rows.map((row) => '| ' + row.join(' | ') + ' |');
    // Insert separator row after header
    const sep = '| ' + rows[0].map(() => '---').join(' | ') + ' |';
    mdLines.splice(1, 0, sep);

    const parsed = parseMarkdownRules(mdLines.join('\n'));

    // Merge results; prefer sheet-name type hint
    const typeHint = sheetName.toLowerCase();
    if (typeHint.includes('term') || typeHint.includes('术语')) {
      result.terminology.push(...(parsed.terminology.length ? parsed.terminology : parsed.banned.map(b => ({
        canonical: b.suggestion || b.word,
        aliases: [b.word],
        note: b.legalRef,
      }))));
    } else if (typeHint.includes('seman') || typeHint.includes('语义')) {
      result.semantic.push(...(parsed.semantic.length ? parsed.semantic : []));
    } else {
      // Default: merge all
      result.banned.push(...parsed.banned);
      result.terminology.push(...parsed.terminology);
      result.semantic.push(...parsed.semantic);
    }
  }

  return result;
}

module.exports = { parseXlsxRules };
