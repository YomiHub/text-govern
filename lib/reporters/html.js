'use strict';

const fs = require('fs');
const path = require('path');
const {
  CATEGORY_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  MAX_SYSTEM_BACKGROUND_LENGTH,
} = require('../constants');
const { buildStats, normalizeSeverity, sortFindings } = require('../severity');

const TEMPLATE_DIR = path.resolve(__dirname, '../../templates/report');
const SOURCE_LABELS = {
  ai: 'AI 语义分析',
  project: '项目规则',
  rule: '规则匹配',
};
const SEVERITY_CLASSES = {
  严重违禁: 'critical',
  高风险: 'high',
  需关注: 'medium',
  推荐修改: 'low',
};
/**
 * Generate a Vue CDN report directory.
 *
 * @param {object} opts
 * @param {Array}  opts.ruleFindings   - Findings from rule analysis
 * @param {Array}  opts.aiFindings     - Findings from AI analysis (may be empty)
 * @param {object} opts.scanMeta       - Meta from extracted.json
 * @param {object} opts.config         - Resolved config
 * @param {object} opts.aiMeta         - Meta from findings.ai.json (optional)
 * @param {string} opts.outputDir      - Absolute directory to write the report to
 */
function generateHtmlReport(opts) {
  const {
    ruleFindings = [],
    aiFindings = [],
    scanMeta = {},
    config = {},
    aiMeta = {},
    outputDir,
  } = opts;
  if (!outputDir) throw new Error('generateHtmlReport requires outputDir');

  const allFindings = sortFindings([...ruleFindings, ...aiFindings]);
  const stats = buildStats(allFindings);
  const rows = allFindings.map((finding, index) => toTableRow(finding, index));
  const outputPath = path.join(outputDir, 'index.html');

  copyDir(TEMPLATE_DIR, outputDir);
  fs.mkdirSync(path.join(outputDir, 'data'), { recursive: true });
  writeDataFile(
    path.join(outputDir, 'data', 'config.js'),
    'window.__TEXT_GOVERN_REPORT_CONFIG__',
    buildReportConfig({ config, scanMeta, aiMeta, stats, rows })
  );
  writeDataFile(
    path.join(outputDir, 'data', 'tableData.js'),
    'window.__TEXT_GOVERN_TABLE_DATA__',
    rows
  );

  return { outputDir, outputPath, stats, totalFindings: allFindings.length };
}

function buildReportConfig({ config, scanMeta, aiMeta = {}, stats, rows }) {
  const categoryValues = [...new Set(rows.map((row) => row.category).filter(Boolean))];
  const { text: systemBackground, source: systemBackgroundSource } = resolveSystemBackground(
    config,
    aiMeta
  );
  return {
    title: '审计报告',
    remark: '由 text-govern 自动生成',
    meta: {
      generatedAt: new Date().toISOString(),
      industry: config.industry || 'AI 自主识别',
      systemBackground,
      systemBackgroundSource,
      filesScanned: scanMeta.filesScanned || 0,
      totalFragments: scanMeta.totalFragments || 0,
      failOn: (config.severity && config.severity.failOn) || '严重违禁',
    },
    stats,
    filters: {
      severities: SEVERITIES.map((value) => ({
        value,
        label: SEVERITY_LABELS[value] || value,
        className: SEVERITY_CLASSES[value] || 'low',
      })),
      categories: categoryValues.map((value) => ({
        value,
        label: CATEGORY_LABELS[value] || value,
      })),
      sources: [
        { value: 'rule', label: '规则匹配' },
        { value: 'ai', label: 'AI 语义分析' },
      ],
    },
  };
}

function toTableRow(finding, index) {
  const severity = normalizeSeverity(finding.severity);
  const source = normalizeSource(finding.source);
  const category = finding.category || '未分类';
  const fallbackId = [
    source,
    finding.file || 'unknown-file',
    finding.line || 0,
    finding.matched || finding.rawText || index,
  ].join(':');

  return {
    id: finding.id || `finding_${index + 1}_${hash(fallbackId)}`,
    severity,
    severityLabel: SEVERITY_LABELS[severity] || severity,
    severityClass: SEVERITY_CLASSES[severity] || 'low',
    category,
    categoryLabel: CATEGORY_LABELS[category] || category,
    source,
    sourceLabel: SOURCE_LABELS[finding.source] || SOURCE_LABELS[source] || '规则匹配',
    file: finding.file || '',
    line: finding.line || 0,
    column: finding.column || 0,
    matched: finding.matched || '',
    suggestion: finding.suggestion || '',
    reason: finding.reason || '',
    rawText: finding.rawText || '',
    surrounding: finding.surrounding || '',
    legalRef: finding.legalRef || '',
    rulePack: finding.rulePack || '',
    pageHint: finding.pageHint || '',
  };
}

function normalizeSource(source) {
  return source === 'ai' ? 'ai' : 'rule';
}

/**
 * Resolve system background for report header.
 * Priority: config.systemBackground > aiMeta.systemBackground > empty.
 */
function resolveSystemBackground(config, aiMeta) {
  const fromConfig = String((config && config.systemBackground) || '').trim();
  if (fromConfig) {
    return {
      text: truncateSystemBackground(fromConfig),
      source: 'config',
    };
  }

  const fromAi = String((aiMeta && aiMeta.systemBackground) || '').trim();
  if (fromAi) {
    return {
      text: truncateSystemBackground(fromAi),
      source: 'ai',
    };
  }

  return { text: '', source: 'none' };
}

function truncateSystemBackground(text) {
  const value = String(text || '').trim();
  if (value.length <= MAX_SYSTEM_BACKGROUND_LENGTH) return value;
  return value.slice(0, MAX_SYSTEM_BACKGROUND_LENGTH);
}

function writeDataFile(filePath, globalName, data) {
  fs.writeFileSync(
    filePath,
    `${globalName} = ${JSON.stringify(data, null, 2)};\n`,
    'utf8'
  );
}

function copyDir(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(source, target);
    } else {
      fs.copyFileSync(source, target);
    }
  }
}

function hash(value) {
  let h = 0;
  const str = String(value);
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

module.exports = { generateHtmlReport, resolveSystemBackground, truncateSystemBackground };
