'use strict';

const path = require('path');
const fs = require('fs');
const { loadConfig } = require('../config');
const { generateHtmlReport } = require('../reporters/html');
const { exitCode, sortFindings, normalizeCategory } = require('../severity');
const logger = require('../logger');
const { RULE_FINDINGS_FILE, AI_FINDINGS_FILE, REPORT_DIR, EXTRACTED_FILE } = require('../constants');

async function run(opts = {}) {
  const config = loadConfig(opts);
  const cwd = config._cwd;

  const ruleFindingsFile = opts.ruleFindings
    ? path.resolve(cwd, opts.ruleFindings)
    : path.join(config.output.dir, RULE_FINDINGS_FILE);

  const aiFindingsFile = opts.aiFindings
    ? path.resolve(cwd, opts.aiFindings)
    : path.join(config.output.dir, AI_FINDINGS_FILE);

  const extractedFile = path.join(config.output.dir, EXTRACTED_FILE);

  const outputDir = opts.out
    ? path.resolve(cwd, opts.out)
    : path.join(config.output.dir, REPORT_DIR);

  if (path.extname(outputDir).toLowerCase() === '.html') {
    logger.error('report --out 现在需要传入目录路径，例如: --out .text-govern/report');
    process.exit(1);
  }

  logger.step(1, 3, '加载分析结果...');

  // Load rule findings (required)
  if (!fs.existsSync(ruleFindingsFile)) {
    logger.error(`未找到 findings.rule.json，请先运行: npm run text-govern:analyze`);
    process.exit(1);
  }

  let ruleFindingsData;
  try {
    ruleFindingsData = JSON.parse(fs.readFileSync(ruleFindingsFile, 'utf8'));
  } catch (e) {
    logger.error(`读取 findings.rule.json 失败: ${e.message}`);
    process.exit(1);
  }

  // Load AI findings (optional)
  let aiFindings = [];
  let aiMeta = {};
  if (fs.existsSync(aiFindingsFile)) {
    try {
      const aiData = JSON.parse(fs.readFileSync(aiFindingsFile, 'utf8'));
      aiFindings = (aiData.findings || []).map((f) => ({
        ...f,
        category: normalizeCategory(f.category),
      }));
      aiMeta = aiData.meta || {};
      logger.info(`AI 语义分析: ${aiFindings.length} 条`);
    } catch (e) {
      logger.warn(`读取 findings.ai.json 失败，跳过 AI 分析结果: ${e.message}`);
    }
  } else {
    logger.dim('未找到 findings.ai.json，跳过 AI 分析结果（如需要，请在 Cursor 中运行 text-govern skill）');
  }

  // Load scan meta
  let scanMeta = {};
  if (fs.existsSync(extractedFile)) {
    try {
      const ext = JSON.parse(fs.readFileSync(extractedFile, 'utf8'));
      scanMeta = ext.meta || {};
    } catch (_) {}
  }

  const ruleFindings = ruleFindingsData.findings || [];
  logger.info(`规则分析: ${ruleFindings.length} 条`);

  logger.step(2, 3, '生成 HTML 报告...');

  const { outputPath, stats, totalFindings } = generateHtmlReport({
    ruleFindings,
    aiFindings,
    aiMeta,
    scanMeta,
    config,
    outputDir,
  });

  logger.step(3, 3, '生成完成');
  logger.success(`报告已生成: ${path.relative(cwd, outputPath)}`);
  const severitySummary = Object.entries(stats.bySeverity)
    .filter(([, count]) => count > 0)
    .map(([severity, count]) => `${severity}:${count}`)
    .join(' ');
  logger.info(`共 ${totalFindings} 处问题 — ${severitySummary || '无问题'}`);

  if (stats.bySeverity['严重违禁'] > 0) {
    logger.warn(`⚠ 存在 ${stats.bySeverity['严重违禁']} 处严重违禁问题，必须修复后才能发布！`);
  }

  // Exit code
  const allFindings = sortFindings([...ruleFindings, ...aiFindings]);
  const code = exitCode(allFindings, config, opts.noFail || opts['no-fail']);
  if (code !== 0) {
    logger.error(`存在 ${config.severity.failOn} 级别以上的问题，退出码为 1`);
    process.exitCode = 1;
  }

  return { outputDir, outputPath, stats };
}

module.exports = { run };
