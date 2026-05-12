'use strict';

const fs = require('fs');
const path = require('path');
const { BANNED_DEFAULTS, TERMINOLOGY_DEFAULTS, SEMANTIC_DEFAULTS } = require('./defaults');
const { parseMarkdownRules } = require('./parser-md');

/**
 * Load and merge all rule sets in priority order:
 *   builtin defaults  <  AI-generated (rules/)  <  user custom (custom/)
 *
 * @param {object} config - Resolved config
 * @returns {{ banned: Array, terminology: Array, semantic: Array }}
 */
function loadAllRules(config) {
  const merged = {
    banned: config.rules && config.rules.includeDefaults ? [...BANNED_DEFAULTS] : [],
    terminology: config.rules && config.rules.includeDefaults ? [...TERMINOLOGY_DEFAULTS] : [],
    semantic: config.rules && config.rules.includeDefaults ? [...SEMANTIC_DEFAULTS] : [],
  };

  // Load AI-generated rules (Excel first, JSON compatible)
  loadGeneratedRulesDir(config.builtinRules.dir, merged);

  // Load user custom rules (md + xlsx), highest priority
  loadCustomRulesDir(config.customRules.dir, merged);

  return merged;
}

/**
 * Load AI-generated rule files from generated rules directory.
 * Prefer Excel (.xlsx/.xls) because business users can edit it, while keeping
 * JSON backward-compatible for existing projects.
 */
function loadGeneratedRulesDir(dir, merged) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir).sort((a, b) => {
    const ax = a.endsWith('.xlsx') || a.endsWith('.xls') ? 0 : 1;
    const bx = b.endsWith('.xlsx') || b.endsWith('.xls') ? 0 : 1;
    return ax - bx || a.localeCompare(b);
  });
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
      try {
        const { parseXlsxRules } = require('./parser-xlsx');
        const parsed = parseXlsxRules(fullPath);
        mergeBanned(merged.banned, parsed.banned);
        mergeTerminology(merged.terminology, parsed.terminology);
        mergeSemantic(merged.semantic, parsed.semantic);
      } catch (e) {
        // Skip malformed xlsx
      }
    } else if (file.endsWith('.json')) {
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (file.startsWith('terminology')) {
          mergeTerminology(merged.terminology, data.terminology || data || []);
        } else if (file.startsWith('semantic')) {
          mergeSemantic(merged.semantic, data.semantic || data || []);
        } else {
          mergeBanned(merged.banned, data.banned || data || []);
        }
      } catch (e) {
        // Skip malformed json
      }
    }
  }
}

/**
 * Load Markdown + xlsx custom rule files from custom dir.
 */
function loadCustomRulesDir(dir, merged) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    // Skip template files (template.* files that haven't been edited yet)
    if (file.includes('.template.')) continue;

    if (file.endsWith('.md')) {
      try {
        const src = fs.readFileSync(fullPath, 'utf8');
        const parsed = parseMarkdownRules(src);
        mergeBanned(merged.banned, parsed.banned);
        mergeTerminology(merged.terminology, parsed.terminology);
        mergeSemantic(merged.semantic, parsed.semantic);
      } catch (e) {
        // Skip
      }
    } else if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
      try {
        const { parseXlsxRules } = require('./parser-xlsx');
        const parsed = parseXlsxRules(fullPath);
        mergeBanned(merged.banned, parsed.banned);
        mergeTerminology(merged.terminology, parsed.terminology);
        mergeSemantic(merged.semantic, parsed.semantic);
      } catch (e) {
        // Skip if xlsx not installed
      }
    }
  }
}

/**
 * Merge banned rules — newer entries override by word.
 */
function mergeBanned(base, incoming) {
  const map = new Map(base.map((r) => [r.word, r]));
  for (const r of incoming) {
    if (r.word) map.set(r.word, r);
  }
  base.length = 0;
  base.push(...map.values());
}

/**
 * Merge terminology — newer entries override by canonical.
 */
function mergeTerminology(base, incoming) {
  const map = new Map(base.map((r) => [r.canonical, r]));
  for (const r of incoming) {
    if (r.canonical) map.set(r.canonical, r);
  }
  base.length = 0;
  base.push(...map.values());
}

/**
 * Merge semantic rules — newer entries override by pageGlob.
 */
function mergeSemantic(base, incoming) {
  const map = new Map(base.map((r) => [r.pageGlob, r]));
  for (const r of incoming) {
    if (r.pageGlob) map.set(r.pageGlob, r);
  }
  base.length = 0;
  base.push(...map.values());
}

module.exports = { loadAllRules };
