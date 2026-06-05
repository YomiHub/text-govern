'use strict';

/**
 * Built-in baseline rules shipped with the tool.
 *
 * Data source: `scripts/text-govern/config/terminology.default.xlsx` and
 * `scripts/text-govern/config/semantic.default.xlsx`.
 *
 * NOTE: The former `banned.default.xlsx` (konsheng/Sensitive-lexicon public
 * word list) has been removed. When `rules.includeDefaults = true` the AI is
 * instead instructed via `skills/prompts/generate-rules.md` to scan the
 * codebase for words that fall into the baseline categories (色情违规, 政治敏感,
 * 暴恐违禁, 涉枪涉爆, 广告违规) and write only the project-specific hits into
 * the generated banned.xlsx.  This avoids loading a large static word list at
 * runtime while still covering the baseline compliance categories intelligently.
 */

const path = require('path');
const fs = require('fs');

const CONFIG_DIR = path.join(__dirname, '..', '..', 'config');

const DEFAULT_FILES = {
  terminology: 'terminology.default.xlsx',
  semantic: 'semantic.default.xlsx',
};

function loadFromXlsx(filename) {
  const filePath = path.join(CONFIG_DIR, filename);
  if (!fs.existsSync(filePath)) return { banned: [], terminology: [], semantic: [] };
  try {
    const { parseXlsxRules } = require('./parser-xlsx');
    return parseXlsxRules(filePath);
  } catch (e) {
    return { banned: [], terminology: [], semantic: [] };
  }
}

const _terminologySrc = loadFromXlsx(DEFAULT_FILES.terminology);
const _semanticSrc = loadFromXlsx(DEFAULT_FILES.semantic);

const TERMINOLOGY_DEFAULTS = _terminologySrc.terminology || [];
const SEMANTIC_DEFAULTS = _semanticSrc.semantic || [];

module.exports = {
  TERMINOLOGY_DEFAULTS,
  SEMANTIC_DEFAULTS,
  CONFIG_DIR,
};
