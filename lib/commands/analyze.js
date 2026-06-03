'use strict';

const path = require('path');
const fs = require('fs');
const { loadConfig } = require('../config');
const { loadAllRules, loadBaselineRules } = require('../rules/loader');
const { analyzeBanned } = require('../analyzers/banned');
const { analyzeTerminology } = require('../analyzers/terminology');
const { analyzeSemantic } = require('../analyzers/semantic');
const { normalizeSeverity, normalizeCategory, sortFindings, buildStats } = require('../severity');
const logger = require('../logger');
const { EXTRACTED_FILE, RULE_FINDINGS_FILE } = require('../constants');
const { BANNED_DEFAULTS } = require('../rules/defaults');

async function run(opts = {}) {
  const config = loadConfig(opts);
  const cwd = config._cwd;

  // --no-baseline flag: commander sets opts.baseline = false when --no-baseline is passed.
  // We also honour opts.noBaseline for programmatic callers.
  const noBaseline = opts.baseline === false || opts.noBaseline === true;

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

  logger.step(1, 5, '加载文案片段...');
  let extracted;
  try {
    extracted = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  } catch (e) {
    logger.error(`读取 extracted.json 失败: ${e.message}`);
    process.exit(1);
  }

  const fragments = extracted.fragments || [];
  logger.info(`共 ${fragments.length} 条文案片段`);

  // ── 步骤 2a：公开基线扫描 ─────────────────────────────────────────────────
  const useBaseline = !noBaseline && config.rules && config.rules.includeDefaults;
  let baselineFindings = [];

  logger.step(2, 5, '加载规则包...');
  if (useBaseline) {
    const baseline = loadBaselineRules(config);
    logger.info(
      `  基线词库 (konsheng/Sensitive-lexicon 等): ${baseline.banned.length} 条违禁词`
    );
    if (baseline.banned.length > 0) {
      const raw = analyzeBanned(fragments, baseline.banned);
      baselineFindings = raw.map((f) => ({ ...f, source: 'baseline' }));
      logger.info(`  公开基线命中: ${baselineFindings.length} 处`);
    }
  } else if (noBaseline) {
    logger.info('  --no-baseline: 跳过公开基线扫描');
  } else {
    logger.info('  公开基线扫描已关闭 (rules.includeDefaults = false)');
  }

  // ── 步骤 2b：项目规则扫描 ─────────────────────────────────────────────────
  const rules = loadAllRules(config);
  logger.info(
    `  项目规则: 违禁词 ${rules.banned.length} 条 / 术语 ${rules.terminology.length} 条 / 语义 ${rules.semantic.length} 条`
  );

  logger.step(3, 5, '执行规则匹配...');
  const bannedFindings = analyzeBanned(fragments, rules.banned).map((f) => ({
    ...f,
    source: 'project',
  }));
  logger.info(`  违禁/行业词 (项目规则): ${bannedFindings.length} 处`);

  const termFindings = analyzeTerminology(fragments, rules.terminology).map((f) => ({
    ...f,
    source: 'project',
  }));
  logger.info(`  术语不统一: ${termFindings.length} 处`);

  const semFindings = analyzeSemantic(fragments, rules.semantic).map((f) => ({
    ...f,
    source: 'project',
  }));
  logger.info(`  语义歧义: ${semFindings.length} 处`);

  // ── 步骤 3：合并、去重、排序 ─────────────────────────────────────────────
  const allFindings = [
    ...baselineFindings,
    ...bannedFindings,
    ...termFindings,
    ...semFindings,
  ].map((f) => ({
    ...f,
    severity: normalizeSeverity(f.severity),
    category: normalizeCategory(f.category),
    source: f.source || 'project',
  }));

  const deduped = deduplicateFindings(allFindings);
  const sorted = sortFindings(deduped);
  const stats = buildStats(sorted);

  // bySource breakdown
  const bySource = { baseline: 0, project: 0 };
  for (const f of sorted) {
    const src = f.source === 'baseline' ? 'baseline' : 'project';
    bySource[src] = (bySource[src] || 0) + 1;
  }
  stats.bySource = bySource;

  logger.step(4, 5, '输出结果...');
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });

  const baselineVersion = (() => {
    try {
      const noticesPath = path.join(
        __dirname, '..', '..', 'config', 'THIRD_PARTY_NOTICES.md'
      );
      if (!fs.existsSync(noticesPath)) return null;
      const content = fs.readFileSync(noticesPath, 'utf8');
      const shaMatch = content.match(/锁定 SHA[`*\s]*[：:]\s*`([0-9a-f]{40})`/);
      return shaMatch ? shaMatch[1].slice(0, 8) : null;
    } catch {
      return null;
    }
  })();

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      extractedFrom: inputFile,
      rulesLoaded: {
        baselineBanned: useBaseline ? BANNED_DEFAULTS.length : 0,
        banned: rules.banned.length,
        terminology: rules.terminology.length,
        semantic: rules.semantic.length,
      },
      baselineEnabled: useBaseline,
      baselineVersion,
      industry: config.industry,
    },
    stats,
    findings: sorted,
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');

  logger.step(5, 5, '汇报结果...');

  if (useBaseline && bySource.baseline > 0) {
    const sha = baselineVersion ? ` @ ${baselineVersion}` : '';
    logger.info(`公开基线命中: ${bySource.baseline} 处 (来自 konsheng/Sensitive-lexicon${sha})`);
  }

  const severitySummary = Object.entries(stats.bySeverity)
    .filter(([, count]) => count > 0)
    .map(([severity, count]) => `${severity}=${count}`)
    .join(' ');

  logger.success(
    `规则分析完成: 共 ${sorted.length} 处问题 (${severitySummary || '无问题'})`
  );
  if (bySource.baseline > 0 || bySource.project > 0) {
    logger.info(
      `  来源分布 — 公开基线: ${bySource.baseline} / 项目规则: ${bySource.project}`
    );
  }
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
