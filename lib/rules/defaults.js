'use strict';

/**
 * Built-in baseline rules shipped with the tool.
 *
 * Data source: `scripts/text-govern/config/*.default.xlsx`
 * Edit those Excel files (or run `node scripts/text-govern/scripts/build-default-rules.js`)
 * to maintain defaults. They are the lowest-priority rules; AI-generated and
 * project-local custom rules override them.
 */

const path = require('path');
const fs = require('fs');

const CONFIG_DIR = path.join(__dirname, '..', '..', 'config');

const DEFAULT_FILES = {
  banned: 'banned.default.xlsx',
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

const _bannedSrc = loadFromXlsx(DEFAULT_FILES.banned);
const _terminologySrc = loadFromXlsx(DEFAULT_FILES.terminology);
const _semanticSrc = loadFromXlsx(DEFAULT_FILES.semantic);

const BANNED_DEFAULTS = _bannedSrc.banned || [];
const TERMINOLOGY_DEFAULTS = _terminologySrc.terminology || [];
const SEMANTIC_DEFAULTS = _semanticSrc.semantic || [];

module.exports = {
  BANNED_DEFAULTS,
  TERMINOLOGY_DEFAULTS,
  SEMANTIC_DEFAULTS,
  CONFIG_DIR,
};
