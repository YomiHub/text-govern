'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

const { run: init } = require('../lib/commands/init');
const { loadAllRules, loadBaselineRules } = require('../lib/rules/loader');
const { buildStats, normalizeSeverity, normalizeCategory } = require('../lib/severity');
const { generateHtmlReport } = require('../lib/reporters/html');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'text-govern-'));
}

function readWorkbookRows(filePath, sheetName) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

async function testInitCreatesReusableEmptyExcelTemplates() {
  const cwd = tempProject();

  await init({ cwd });

  const config = fs.readFileSync(path.join(cwd, 'text-govern.config.js'), 'utf8');
  assert.match(config, /industry:\s*''/, 'init config should allow empty industry for AI inference');

  const customDir = path.join(cwd, 'text-govern-rules', 'custom');
  for (const file of ['banned.xlsx', 'terminology.xlsx', 'semantic.xlsx']) {
    assert.ok(fs.existsSync(path.join(customDir, file)), `${file} should be generated`);
  }

  assert.ok(!fs.existsSync(path.join(customDir, 'banned.md')), 'init should prefer Excel and not generate markdown by default');

  const bannedRows = readWorkbookRows(path.join(customDir, 'banned.xlsx'), '违禁违规词');
  assert.deepStrictEqual(bannedRows[0], ['词', '替换建议', '风险等级', '分类', '法规来源', '备注']);
  assert.strictEqual(bannedRows.length, 1, 'business-facing Excel templates should be empty except headers');
}

function testPackageIsReusableCliPackage() {
  const pkg = require('../package.json');
  assert.notStrictEqual(pkg.private, true, 'package should not be private so it can be published or npm linked');
  const binPath = pkg.bin && pkg.bin['text-govern'];
  assert.ok(
    binPath === 'bin/text-govern.js' || binPath === './bin/text-govern.js',
    `bin entry should point to bin/text-govern.js, got: ${binPath}`
  );
}

function testChineseSeverityAndCategoryArePreserved() {
  assert.strictEqual(normalizeSeverity('严重违禁'), '严重违禁');
  assert.strictEqual(normalizeSeverity('高风险'), '高风险');

  const stats = buildStats([
    { severity: '严重违禁', category: '医疗合规' },
    { severity: '推荐修改', category: '优化类' },
  ]);

  assert.strictEqual(stats.bySeverity['严重违禁'], 1);
  assert.strictEqual(stats.bySeverity['推荐修改'], 1);
  assert.strictEqual(stats.byCategory['医疗合规'], 1);
  assert.strictEqual(stats.byCategory['优化类'], 1);
}

function testNormalizeCategoryMapsLegacyValues() {
  assert.strictEqual(normalizeCategory('推荐修改类'), '优化类', '推荐修改类 should map to 优化类');
  assert.strictEqual(normalizeCategory('其他类'), '优化类', '其他类 should map to 优化类');
  assert.strictEqual(normalizeCategory('词义统一类'), '词义统一类', '枚举内的标准值应原样保留');
  assert.strictEqual(normalizeCategory('业务语义统一类'), '业务语义统一类', '枚举内的标准值应原样保留');
  assert.strictEqual(normalizeCategory('医疗合规'), '医疗合规', '规则表行业合规子类自定义值应原样保留');
  assert.strictEqual(normalizeCategory(''), '未分类', '空字符串应归为未分类');
  assert.strictEqual(normalizeCategory(null), '未分类', 'null 应归为未分类');
  assert.strictEqual(normalizeCategory(undefined), '未分类', 'undefined 应归为未分类');
}

function readGlobalDataScript(filePath, globalName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const prefix = `${globalName} = `;
  assert.ok(content.startsWith(prefix), `${path.basename(filePath)} should assign ${globalName}`);
  return JSON.parse(content.slice(prefix.length).replace(/;\s*$/, ''));
}

function testVueReportDirectoryIsGeneratedWithDataFiles() {
  const cwd = tempProject();
  const outputDir = path.join(cwd, '.text-govern', 'report');
  const ruleFindings = [
    {
      file: 'pages/index/index.wxml',
      line: 8,
      column: 2,
      severity: '高风险',
      category: '行业合规',
      matched: '免费送',
      suggestion: '限时优惠',
      reason: '含营销承诺文案',
      rawText: '立即免费送',
      surrounding: '<view>立即免费送</view>',
      legalRef: '',
      rulePack: 'generated',
      pageHint: 'pages/index',
      source: 'project',
    },
  ];
  const aiFindings = [
    {
      file: 'pages/order/detail.wxml',
      line: 3,
      severity: '需关注',
      category: '业务语义统一类',
      matched: '业绩',
      suggestion: '确认字段含义',
      reason: '上下文语义不一致',
      rawText: '累计业绩',
      source: 'ai',
    },
  ];

  const result = generateHtmlReport({
    ruleFindings,
    aiFindings,
    scanMeta: { filesScanned: 12, totalFragments: 88 },
    config: { industry: '医药系统', severity: { failOn: '高风险' } },
    outputDir,
  });

  assert.strictEqual(result.outputPath, path.join(outputDir, 'index.html'));
  assert.ok(fs.existsSync(path.join(outputDir, 'index.html')), 'report index.html should be copied');
  assert.ok(fs.existsSync(path.join(outputDir, 'css', 'report.css')), 'report css should be copied');
  assert.ok(fs.existsSync(path.join(outputDir, 'data', 'config.js')), 'config data should be generated');
  assert.ok(fs.existsSync(path.join(outputDir, 'data', 'tableData.js')), 'table data should be generated');

  const indexHtml = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
  assert.ok(!indexHtml.includes('__DATA__'), 'Vue template should not contain old inline data placeholder');
  assert.ok(indexHtml.includes('https://unpkg.com/vue@3/dist/vue.global.prod.js'), 'report should use Vue CDN');
  assert.ok(indexHtml.includes('./data/config.js'), 'report should load config data file');
  assert.ok(indexHtml.includes('./data/tableData.js'), 'report should load table data file');

  const config = readGlobalDataScript(
    path.join(outputDir, 'data', 'config.js'),
    'window.__TEXT_GOVERN_REPORT_CONFIG__'
  );
  assert.strictEqual(config.meta.industry, '医药系统');
  assert.strictEqual(config.meta.filesScanned, 12);
  assert.deepStrictEqual(config.stats, buildStats([...ruleFindings, ...aiFindings]));

  const rows = readGlobalDataScript(
    path.join(outputDir, 'data', 'tableData.js'),
    'window.__TEXT_GOVERN_TABLE_DATA__'
  );
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].source, 'rule');
  assert.strictEqual(rows[0].sourceLabel, '项目规则');
  assert.strictEqual(rows[1].source, 'ai');
  assert.strictEqual(rows[1].sourceLabel, 'AI 语义分析');
  assert.ok(rows[0].id, 'table rows should have stable display ids');
}

function testVueReportDirectorySupportsEmptyFindings() {
  const cwd = tempProject();
  const outputDir = path.join(cwd, '.text-govern', 'report');

  const result = generateHtmlReport({
    ruleFindings: [],
    aiFindings: [],
    scanMeta: {},
    config: {},
    outputDir,
  });

  assert.strictEqual(result.totalFindings, 0);
  assert.ok(fs.existsSync(path.join(outputDir, 'index.html')));
  const rows = readGlobalDataScript(
    path.join(outputDir, 'data', 'tableData.js'),
    'window.__TEXT_GOVERN_TABLE_DATA__'
  );
  assert.deepStrictEqual(rows, []);
}

async function testReportCommandRejectsHtmlOutPath() {
  const cwd = tempProject();
  const outputDir = path.join(cwd, '.text-govern');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'findings.rule.json'),
    JSON.stringify({ findings: [] }),
    'utf8'
  );

  const { run: reportRun } = require('../lib/commands/report');
  const originalExit = process.exit;
  let exitCode;
  process.exit = (code) => {
    exitCode = code;
    throw new Error('process.exit');
  };

  try {
    await assert.rejects(
      () => reportRun({ cwd, out: path.join(outputDir, 'report.html'), noFail: true }),
      /process\.exit/
    );
    assert.strictEqual(exitCode, 1, 'HTML out path should be rejected with exit code 1');
  } finally {
    process.exit = originalExit;
  }
}

async function testReportCommandWritesDefaultDirectoryReport() {
  const cwd = tempProject();
  const outputDir = path.join(cwd, '.text-govern');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'findings.rule.json'),
    JSON.stringify({
      findings: [
        {
          file: 'pages/index/index.wxml',
          line: 1,
          severity: '推荐修改',
          category: '优化类',
          matched: '点击',
          suggestion: '查看',
          source: 'project',
        },
      ],
    }),
    'utf8'
  );

  const { run: reportRun } = require('../lib/commands/report');
  const result = await reportRun({ cwd, noFail: true });

  assert.strictEqual(result.outputPath, path.join(outputDir, 'report', 'index.html'));
  assert.ok(fs.existsSync(result.outputPath), 'report command should write .text-govern/report/index.html');
  assert.ok(fs.existsSync(path.join(outputDir, 'report', 'data', 'config.js')));
  assert.ok(fs.existsSync(path.join(outputDir, 'report', 'data', 'tableData.js')));
}

function testAiGeneratedRulesCanBeExcel() {
  const cwd = tempProject();
  const rulesDir = path.join(cwd, 'text-govern-rules', 'generated');
  fs.mkdirSync(rulesDir, { recursive: true });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['词', '替换建议', '风险等级', '分类', '法规来源', '备注'],
      ['包治百病', '请咨询专业人员', '严重违禁', '医疗合规', '医疗广告管理办法', 'AI 生成后业务可调整'],
    ]),
    '违禁违规词'
  );
  XLSX.writeFile(workbook, path.join(rulesDir, 'ai-generated.xlsx'));

  const rules = loadAllRules({
    builtinRules: { dir: rulesDir },
    customRules: { dir: path.join(cwd, 'text-govern-rules', 'custom') },
    rules: { includeDefaults: false },
  });

  assert.deepStrictEqual(rules.banned, [
    {
      word: '包治百病',
      suggestion: '请咨询专业人员',
      severity: '严重违禁',
      category: '医疗合规',
      legalRef: '医疗广告管理办法',
      note: 'AI 生成后业务可调整',
    },
  ]);
}

function testDefaultsAreLoadedFromExcelConfig() {
  const defaults = require('../lib/rules/defaults');

  assert.ok(defaults.BANNED_DEFAULTS.length > 30, '内置违禁词需覆盖公开敏感词基线，至少 30+ 条');
  assert.ok(defaults.TERMINOLOGY_DEFAULTS.length >= 5, '内置术语统一需要至少 5 条');

  // Check categories from public baseline lexicons (not the old hardcoded list)
  const categories = new Set(defaults.BANNED_DEFAULTS.map((r) => r.category));
  for (const required of ['色情违规', '政治敏感', '广告违规']) {
    assert.ok(categories.has(required), `内置默认违禁词需要覆盖分类: ${required}`);
  }

  assert.ok(
    fs.existsSync(path.join(defaults.CONFIG_DIR, 'banned.default.xlsx')),
    'defaults.js 应当以 scripts/text-govern/config/banned.default.xlsx 为数据源'
  );
}

function testInitGeneratesMarkdownReadmeForCustomDir() {
  const cwd = tempProject();
  const { run: init } = require('../lib/commands/init');
  return init({ cwd }).then(() => {
    const customDir = path.join(cwd, 'text-govern-rules', 'custom');
    assert.ok(
      fs.existsSync(path.join(customDir, 'README.md')),
      '自定义规则目录应提供 README.md（Markdown 更易读）'
    );
    assert.ok(
      !fs.existsSync(path.join(customDir, 'README.xlsx')),
      '不应再生成 README.xlsx'
    );
  });
}

async function testInstallerCopiesAssetsToCursor() {
  const cwd = tempProject();
  fs.mkdirSync(path.join(cwd, '.cursor'), { recursive: true });

  const { run: install } = require('../bin/install');
  await install({ editor: 'cursor', cwd, scope: 'project' });

  const skillFile = path.join(cwd, '.cursor', 'skills', 'text-govern', 'SKILL.md');
  assert.ok(fs.existsSync(skillFile), 'Cursor skill SKILL.md should be installed');

  const commandFiles = fs.readdirSync(path.join(cwd, '.cursor', 'commands'));
  assert.ok(
    commandFiles.some((f) => f.startsWith('text-govern') && f.endsWith('.md')),
    'Cursor commands directory should contain text-govern*.md files'
  );
  assert.ok(commandFiles.includes('text-govern-rules.md'), 'text-govern-rules.md should be installed');
  assert.ok(commandFiles.includes('text-govern-scan.md'), 'text-govern-scan.md should be installed');
}

async function testInstallerCopiesAssetsToClaude() {
  const cwd = tempProject();
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });

  const { run: install } = require('../bin/install');
  await install({ editor: 'claude', cwd, scope: 'project' });

  const skillFile = path.join(cwd, '.claude', 'skills', 'text-govern', 'SKILL.md');
  assert.ok(fs.existsSync(skillFile), 'Claude skill SKILL.md should be installed');

  const commandFiles = fs.readdirSync(path.join(cwd, '.claude', 'commands'));
  assert.ok(
    commandFiles.some((f) => f.startsWith('text-govern') && f.endsWith('.md')),
    'Claude commands directory should contain text-govern*.md files'
  );
}

async function testInstallerIsIdempotent() {
  const cwd = tempProject();
  fs.mkdirSync(path.join(cwd, '.cursor'), { recursive: true });

  const { run: install } = require('../bin/install');
  await install({ editor: 'cursor', cwd, scope: 'project' });
  // Second run should not throw
  await install({ editor: 'cursor', cwd, scope: 'project' });

  const skillFile = path.join(cwd, '.cursor', 'skills', 'text-govern', 'SKILL.md');
  assert.ok(fs.existsSync(skillFile), 'SKILL.md should still exist after second install');
}

async function testInstallerDryRunWritesNothing() {
  const cwd = tempProject();

  const { run: install } = require('../bin/install');
  await install({ editor: 'cursor,claude', cwd, scope: 'project', dryRun: true });

  assert.ok(
    !fs.existsSync(path.join(cwd, '.cursor', 'skills')),
    '--dry-run should not create any directories or files'
  );
  assert.ok(
    !fs.existsSync(path.join(cwd, '.claude', 'skills')),
    '--dry-run should not create any directories or files'
  );
}

// ── 新增：baseline 通道测试 ──────────────────────────────────────────────────

function testLoadBaselineRulesReturnsEmptyWhenIncludeDefaultsFalse() {
  const baseline = loadBaselineRules({
    rules: { includeDefaults: false },
  });
  assert.deepStrictEqual(baseline.banned, [], 'includeDefaults=false: baseline.banned should be empty');
  assert.deepStrictEqual(baseline.terminology, [], 'includeDefaults=false: baseline.terminology should be empty');
  assert.deepStrictEqual(baseline.semantic, [], 'includeDefaults=false: baseline.semantic should be empty');
}

function testLoadBaselineRulesReturnsDataWhenIncludeDefaultsTrue() {
  const defaults = require('../lib/rules/defaults');
  // Only run if banned.default.xlsx exists (offline/CI may not have it yet until fetch:baseline runs)
  if (defaults.BANNED_DEFAULTS.length === 0) {
    console.log('  skip: banned.default.xlsx 不存在或为空，请先运行 npm run fetch:baseline');
    return;
  }

  const baseline = loadBaselineRules({
    rules: { includeDefaults: true },
  });
  assert.ok(baseline.banned.length > 0, 'includeDefaults=true: baseline.banned should have entries');
}

function testLoadAllRulesDoesNotIncludeBaselineWhenExcluded() {
  const cwd = tempProject();
  const generatedDir = path.join(cwd, 'text-govern-rules', 'generated');
  fs.mkdirSync(generatedDir, { recursive: true });

  // loadAllRules should return only project rules, never baseline defaults
  const rules = loadAllRules({
    builtinRules: { dir: generatedDir },
    customRules: { dir: path.join(cwd, 'text-govern-rules', 'custom') },
    rules: { includeDefaults: true }, // even when true, loadAllRules should not include defaults
  });
  // Empty generated dir → empty project rules
  assert.deepStrictEqual(rules.banned, [], 'loadAllRules should not include baseline defaults (use loadBaselineRules for that)');
}

async function testAnalyzeFindings_HaveSourceField() {
  const cwd = tempProject();
  await init({ cwd });
  const rulesDir = path.join(cwd, 'text-govern-rules', 'generated');

  // Write a minimal project rule
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['词', '替换建议', '风险等级', '分类', '法规来源', '备注'],
      ['免费送', '限时优惠', '高风险', '行业合规', '', ''],
    ]),
    '违禁违规词'
  );
  XLSX.writeFile(wb, path.join(rulesDir, 'banned.xlsx'));

  // Write a minimal extracted.json
  const extractedDir = path.join(cwd, '.text-govern');
  fs.mkdirSync(extractedDir, { recursive: true });
  const fragments = [
    {
      id: 'frag_001',
      file: 'pages/index/index.wxml',
      line: 1,
      column: 0,
      raw: '立即领取免费送好礼',
      normalized: '立即领取免费送好礼',
      kind: 'wxml-text',
      pageHint: 'pages/index',
      surrounding: '',
    },
  ];
  fs.writeFileSync(
    path.join(extractedDir, 'extracted.json'),
    JSON.stringify({ fragments }),
    'utf8'
  );

  const { run: analyzeRun } = require('../lib/commands/analyze');
  const result = await analyzeRun({
    cwd,
    input: path.join(extractedDir, 'extracted.json'),
    out: path.join(extractedDir, 'findings.rule.json'),
    // Disable baseline so we only see project rule findings in this test
    noBaseline: true,
  });

  assert.ok(result.findings.length > 0, '应当命中项目规则中的"免费送"');
  for (const f of result.findings) {
    assert.ok(f.source === 'project' || f.source === 'baseline', `finding.source 应为 project 或 baseline, 实际: ${f.source}`);
  }
  assert.ok(result.stats.bySource, 'stats 应当包含 bySource 字段');
  assert.ok('baseline' in result.stats.bySource, 'bySource 应包含 baseline 键');
  assert.ok('project' in result.stats.bySource, 'bySource 应包含 project 键');
}

async function testAnalyzeNoBaselineFlag_SkipsBaselineScan() {
  const cwd = tempProject();
  await init({ cwd });

  const extractedDir = path.join(cwd, '.text-govern');
  fs.writeFileSync(
    path.join(extractedDir, 'extracted.json'),
    JSON.stringify({ fragments: [] }),
    'utf8'
  );

  const { run: analyzeRun } = require('../lib/commands/analyze');

  // With includeDefaults=true but noBaseline=true, baseline should be skipped
  const result = await analyzeRun({
    cwd,
    input: path.join(extractedDir, 'extracted.json'),
    out: path.join(extractedDir, 'findings.rule.json'),
    noBaseline: true,
  });

  assert.strictEqual(result.stats.bySource.baseline, 0, '--no-baseline 时 bySource.baseline 应为 0');
  assert.strictEqual(result.findings.filter((f) => f.source === 'baseline').length, 0, '--no-baseline 时不应有 baseline findings');
}

async function testAnalyzeStats_ContainsBySource() {
  const cwd = tempProject();
  await init({ cwd });

  const extractedDir = path.join(cwd, '.text-govern');
  fs.writeFileSync(
    path.join(extractedDir, 'extracted.json'),
    JSON.stringify({ fragments: [] }),
    'utf8'
  );

  const { run: analyzeRun } = require('../lib/commands/analyze');
  const result = await analyzeRun({
    cwd,
    input: path.join(extractedDir, 'extracted.json'),
    out: path.join(extractedDir, 'findings.rule.json'),
    noBaseline: true,
  });

  assert.ok(result.stats.bySource !== undefined, 'stats.bySource should always be present');
  assert.ok(typeof result.stats.bySource.baseline === 'number', 'bySource.baseline should be a number');
  assert.ok(typeof result.stats.bySource.project === 'number', 'bySource.project should be a number');
}

function testFetchBaselineScriptExists() {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'fetch-public-baseline.js');
  assert.ok(fs.existsSync(scriptPath), 'scripts/fetch-public-baseline.js should exist');
  // Verify key constants are defined
  const src = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(src.includes('KONSHENG_SHA'), 'fetch script should pin konsheng SHA');
  assert.ok(src.includes('FWWDN_SHA'), 'fetch script should pin fwwdn SHA');
  assert.ok(src.includes('banned.default.xlsx'), 'fetch script should reference output xlsx');
  assert.ok(src.includes('THIRD_PARTY_NOTICES.md'), 'fetch script should write THIRD_PARTY_NOTICES.md');
}

function testPackageJsonHasFetchBaselineScript() {
  const pkg = require('../package.json');
  assert.ok(
    pkg.scripts && pkg.scripts['fetch:baseline'],
    'package.json should define scripts["fetch:baseline"]'
  );
  assert.ok(
    pkg.scripts['build:defaults'] && pkg.scripts['build:defaults'].includes('fetch-public-baseline'),
    'build:defaults should invoke fetch-public-baseline.js'
  );
  assert.ok(
    pkg.scripts['prepublishOnly'] && pkg.scripts['prepublishOnly'].includes('fetch-public-baseline'),
    'prepublishOnly should invoke fetch-public-baseline.js to ensure baseline is fresh before publish'
  );
}

async function run() {
  const tests = [
    testInitCreatesReusableEmptyExcelTemplates,
    testPackageIsReusableCliPackage,
    testChineseSeverityAndCategoryArePreserved,
    testNormalizeCategoryMapsLegacyValues,
    testVueReportDirectoryIsGeneratedWithDataFiles,
    testVueReportDirectorySupportsEmptyFindings,
    testReportCommandRejectsHtmlOutPath,
    testReportCommandWritesDefaultDirectoryReport,
    testAiGeneratedRulesCanBeExcel,
    testDefaultsAreLoadedFromExcelConfig,
    testInitGeneratesMarkdownReadmeForCustomDir,
    testInstallerCopiesAssetsToCursor,
    testInstallerCopiesAssetsToClaude,
    testInstallerIsIdempotent,
    testInstallerDryRunWritesNothing,
    // Baseline channel tests
    testLoadBaselineRulesReturnsEmptyWhenIncludeDefaultsFalse,
    testLoadBaselineRulesReturnsDataWhenIncludeDefaultsTrue,
    testLoadAllRulesDoesNotIncludeBaselineWhenExcluded,
    testAnalyzeFindings_HaveSourceField,
    testAnalyzeNoBaselineFlag_SkipsBaselineScan,
    testAnalyzeStats_ContainsBySource,
    testFetchBaselineScriptExists,
    testPackageJsonHasFetchBaselineScript,
  ];

  for (const test of tests) {
    await test();
    console.log(`PASS ${test.name}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
