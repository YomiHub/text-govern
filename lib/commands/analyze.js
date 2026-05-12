'use strict';

const path = require('path');
const fs = require('fs');
const { loadConfig } = require('../config');
const { loadAllRules } = require('../rules/loader');
const { analyzeBanned } = require('../analyzers/banned');
const { analyzeTerminology } = require('../analyzers/terminology');
const { analyzeSemantic } = require('../analyzers/semantic');
const { normalizeSeverity, sortFindings, buildStats } = require('../severity');
const logger = require('../logger');
const { EXTRACTED_FILE, RULE_FINDINGS_FILE } = require('../constants');

async function run(opts = {}) {
  const config = loadConfig(opts);
  const cwd = config._cwd;

  const inputFile = opts.input
    ? path.resolve(cwd, opts.input)
    : path.join(config.output.dir, EXTRACTED_FILE);

  const outputFile = opts.out
    ? path.resolve(cwd, opts.out)
    : path.join(config.output.dir, RULE_FINDINGS_FILE);

  if (!fs.existsSync(inputFile)) {
    logger.error(`未找到 extracted.json，请先运行: npm run text-govern:scan`);
    process.exit(1);
  }

  logger.step(1, 4, '加载文案片段...');
  let extracted;
  try {
    extracted = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  } catch (e) {
    logger.error(`读取 extracted.json 失败: ${e.message}`);
    process.exit(1);
  }

  const fragments = extracted.fragments || [];
  logger.info(`共 ${fragments.length} 条文案片段`);

  logger.step(2, 4, '加载规则包...');
  const rules = loadAllRules(config);
  logger.info(`违禁词 ${rules.banned.length} 条 / 术语 ${rules.terminology.length} 条 / 语义 ${rules.semantic.length} 条`);

  logger.step(3, 4, '执行规则匹配...');
  const bannedFindings = analyzeBanned(fragments, rules.banned);
  logger.info(`  违禁/行业词: ${bannedFindings.length} 处`);

  const termFindings = analyzeTerminology(fragments, rules.terminology);
  logger.info(`  术语不统一: ${termFindings.length} 处`);

  const semFindings = analyzeSemantic(fragments, rules.semantic);
  logger.info(`  语义歧义: ${semFindings.length} 处`);

  // Normalize severity values
  const allFindings = [...bannedFindings, ...termFindings, ...semFindings].map((f) => ({
    ...f,
    severity: normalizeSeverity(f.severity),
  }));

  // Deduplicate by id
  const deduped = deduplicateFindings(allFindings);
  const sorted = sortFindings(deduped);
  const stats = buildStats(sorted);

  logger.step(4, 4, '输出结果...');
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      extractedFrom: inputFile,
      rulesLoaded: {
        banned: rules.banned.length,
        terminology: rules.terminology.length,
        semantic: rules.semantic.length,
      },
      industry: config.industry,
    },
    stats,
    findings: sorted,
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');

  const severitySummary = Object.entries(stats.bySeverity)
    .filter(([, count]) => count > 0)
    .map(([severity, count]) => `${severity}=${count}`)
    .join(' ');

  logger.success(
    `规则分析完成: 共 ${sorted.length} 处问题 (${severitySummary || '无问题'})`
  );
  logger.success(`结果已写入: ${path.relative(cwd, outputFile)}`);

  return { outputFile, findings: sorted, stats };
}

function deduplicateFindings(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

module.exports = { run };
