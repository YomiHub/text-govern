'use strict';

const fs = require('fs');
const path = require('path');
const { buildStats, sortFindings } = require('../severity');

const TEMPLATE_PATH = path.resolve(__dirname, '../../templates/report.template.html');

/**
 * Generate the self-contained HTML report.
 *
 * @param {object} opts
 * @param {Array}  opts.ruleFindings   - Findings from rule analysis
 * @param {Array}  opts.aiFindings     - Findings from AI analysis (may be empty)
 * @param {object} opts.scanMeta       - Meta from extracted.json
 * @param {object} opts.config         - Resolved config
 * @param {string} opts.outputPath     - Absolute path to write HTML to
 */
function generateHtmlReport(opts) {
  const { ruleFindings = [], aiFindings = [], scanMeta = {}, config = {}, outputPath } = opts;

  const allFindings = sortFindings([...ruleFindings, ...aiFindings]);
  const stats = buildStats(allFindings);

  const reportData = {
    meta: {
      generatedAt: new Date().toISOString(),
      industry: config.industry || 'AI 自主识别',
      filesScanned: scanMeta.filesScanned || 0,
      totalFragments: scanMeta.totalFragments || 0,
      failOn: (config.severity && config.severity.failOn) || '严重违禁',
    },
    stats,
    findings: ruleFindings,
    aiFindings,
  };

  let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const dataScript = JSON.stringify(reportData);
  template = template.replace('__DATA__', dataScript);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, template, 'utf8');

  return { outputPath, stats, totalFindings: allFindings.length };
}

module.exports = { generateHtmlReport };
