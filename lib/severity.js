'use strict';

const { SEVERITIES, SEVERITY_ORDER } = require('./constants');

/**
 * Map legacy / ambiguous category strings to the canonical category.
 * Rules-table custom values (e.g. "医疗合规", "金融合规") pass through unchanged.
 * Actual sub-category names are determined by AI based on the project's industry.
 */
const CATEGORY_ALIASES = {
  推荐修改类: '优化类',
  其他类: '优化类',
};

const SEVERITY_ALIASES = {
  critical: '严重违禁',
  error: '严重违禁',
  fatal: '严重违禁',
  blocker: '严重违禁',
  严重: '严重违禁',
  极高: '严重违禁',
  high: '高风险',
  warning: '高风险',
  warn: '高风险',
  高: '高风险',
  medium: '需关注',
  info: '需关注',
  notice: '需关注',
  中: '需关注',
  low: '推荐修改',
  hint: '推荐修改',
  低: '推荐修改',
  建议: '推荐修改',
  建议优化: '推荐修改',
  推荐: '推荐修改',
  优化: '推荐修改',
};

/**
 * Normalise a severity string to one of our four levels.
 * Accepts variant spellings from rule files.
 */
function normalizeSeverity(raw) {
  const value = String(raw || '需关注').trim();
  if (SEVERITY_ORDER[value] !== undefined) return value;
  const alias = SEVERITY_ALIASES[value.toLowerCase()] || SEVERITY_ALIASES[value];
  return alias || value;
}

/**
 * Compare two severity strings.
 * Returns negative if a < b (a is less severe than b).
 */
function compareSeverity(a, b) {
  return severityRank(a) - severityRank(b);
}

/**
 * Return true if `severity` is >= `threshold`.
 */
function meetsThreshold(severity, threshold) {
  if (!threshold || threshold === 'none') return false;
  return severityRank(severity) <= severityRank(threshold);
}

/**
 * Determine the process exit code based on findings and config.
 * @param {Array}  findings  - Finding[]
 * @param {object} config    - Full config
 * @param {boolean} noFail   - Override from CLI flag
 */
function exitCode(findings, config, noFail) {
  if (noFail) return 0;
  const threshold = config.severity && config.severity.failOn;
  if (!threshold || threshold === 'none') return 0;
  const hasBlocker = findings.some((f) => meetsThreshold(f.severity, threshold));
  return hasBlocker ? 1 : 0;
}

/**
 * Sort findings by severity DESC, then file, then line.
 */
function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    const sv = compareSeverity(normalizeSeverity(a.severity), normalizeSeverity(b.severity));
    if (sv !== 0) return sv;
    if (a.file < b.file) return -1;
    if (a.file > b.file) return 1;
    return (a.line || 0) - (b.line || 0);
  });
}

/**
 * Build a summary stats object from findings.
 */
function buildStats(findings) {
  const stats = { total: findings.length, bySeverity: {}, byCategory: {} };
  for (const s of SEVERITIES) stats.bySeverity[s] = 0;
  for (const f of findings) {
    const sev = normalizeSeverity(f.severity);
    stats.bySeverity[sev] = (stats.bySeverity[sev] || 0) + 1;
    stats.byCategory[f.category] = (stats.byCategory[f.category] || 0) + 1;
  }
  return stats;
}

/**
 * Normalise a category string to a canonical value.
 * - Known legacy aliases (推荐修改类, 其他类) are mapped to their replacement.
 * - Custom values from rules tables (e.g. "医疗合规", "金融合规") are returned as-is.
 *   Sub-category names are AI-generated per project industry and are never hardcoded here.
 * - Empty/null → "未分类".
 */
function normalizeCategory(raw) {
  const value = String(raw || '').trim();
  if (!value) return '未分类';
  return CATEGORY_ALIASES[value] || value;
}

function severityRank(raw) {
  const severity = normalizeSeverity(raw);
  if (SEVERITY_ORDER[severity] !== undefined) return SEVERITY_ORDER[severity];
  // Unknown user-defined severities should be shown but not outrank known blockers.
  return SEVERITIES.length + 1;
}

module.exports = {
  normalizeSeverity,
  normalizeCategory,
  compareSeverity,
  meetsThreshold,
  exitCode,
  sortFindings,
  buildStats,
  severityRank,
};
