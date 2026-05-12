'use strict';

const path = require('path');
const fs = require('fs');
const { loadConfig } = require('../config');
const { walkFiles } = require('../extractor/walker');
const { extractFile } = require('../adapters/index');
const { normalizeFragments } = require('../extractor/normalize');
const logger = require('../logger');
const { DEFAULT_OUTPUT_DIR, EXTRACTED_FILE } = require('../constants');

async function run(opts = {}) {
  const config = loadConfig(opts);
  const cwd = config._cwd;

  logger.step(1, 1, `扫描项目文案 (cwd: ${cwd})`);
  logger.info(`已启用适配器: ${config.scan.adapters.join(', ')}`);

  // Ensure output directory exists
  const outputDir = opts.out
    ? path.dirname(path.resolve(cwd, opts.out))
    : config.output.dir;
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = opts.out
    ? path.resolve(cwd, opts.out)
    : path.join(config.output.dir, EXTRACTED_FILE);

  // Walk and collect files
  const files = await walkFiles(config);
  logger.info(`共找到 ${files.length} 个文件待扫描`);

  const allFragments = [];
  let processedCount = 0;
  let errorCount = 0;

  for (const { file, adapter } of files) {
    const absolutePath = path.resolve(cwd, file);
    try {
      const fragments = extractFile(absolutePath, file, adapter);
      allFragments.push(...fragments);
      processedCount++;
    } catch (e) {
      errorCount++;
      logger.warn(`解析失败: ${file} — ${e.message}`);
    }

    // Progress every 50 files
    if (processedCount % 50 === 0) {
      logger.dim(`  已处理 ${processedCount}/${files.length} 个文件...`);
    }
  }

  // Normalize (filter + deduplicate)
  const normalized = normalizeFragments(allFragments, config);

  logger.success(
    `扫描完成: ${processedCount} 个文件，提取 ${allFragments.length} 条原始片段，过滤后 ${normalized.length} 条`
  );
  if (errorCount > 0) {
    logger.warn(`${errorCount} 个文件解析失败（已跳过）`);
  }

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      cwd,
      filesScanned: processedCount,
      adapters: config.scan.adapters,
      industry: config.industry,
      totalFragments: normalized.length,
    },
    fragments: normalized,
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
  logger.success(`提取结果已写入: ${path.relative(cwd, outputFile)}`);

  return { outputFile, fragments: normalized, meta: output.meta };
}

module.exports = { run };
