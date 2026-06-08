'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

const { run: init } = require('../lib/commands/init');
const { loadAllRules, loadBaselineRules } = require('../lib/rules/loader');
const { buildStats, normalizeSeverity, normalizeCategory } = require('../lib/severity');
const { generateHtmlReport, truncateSystemBackground } = require('../lib/reporters/html');
const { MAX_SYSTEM_BACKGROUND_LENGTH } = require('../lib/constants');

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
  assert.match(config, /systemBackground:\s*''/, 'init config should include empty systemBackground field');

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
    config: {
      industry: '医药系统',
      systemBackground: '面向医药代理商的 B 端小程序，提供订单与业绩管理。',
      severity: { failOn: '高风险' },
    },
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
  assert.ok(indexHtml.includes('system-background'), 'report header should include system background block');
  assert.ok(indexHtml.includes('./data/tableData.js'), 'report should load table data file');

  const config = readGlobalDataScript(
    path.join(outputDir, 'data', 'config.js'),
    'window.__TEXT_GOVERN_REPORT_CONFIG__'
  );
  assert.strictEqual(config.meta.industry, '医药系统');
  assert.strictEqual(
    config.meta.systemBackground,
    '面向医药代理商的 B 端小程序，提供订单与业绩管理。'
  );
  assert.strictEqual(config.meta.systemBackgroundSource, 'config');
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

  // banned.default.xlsx has been removed; BANNED_DEFAULTS no longer exists.
  assert.strictEqual(
    defaults.BANNED_DEFAULTS,
    undefined,
    'defaults.js 不应再导出 BANNED_DEFAULTS（banned 已由 Prompt 方式接管）'
  );

  assert.ok(defaults.TERMINOLOGY_DEFAULTS.length >= 5, '内置术语统一需要至少 5 条');

  assert.ok(
    fs.existsSync(path.join(defaults.CONFIG_DIR, 'terminology.default.xlsx')),
    'defaults.js 应当以 scripts/text-govern/config/terminology.default.xlsx 为数据源'
  );
  assert.ok(
    !fs.existsSync(path.join(defaults.CONFIG_DIR, 'banned.default.xlsx')),
    'banned.default.xlsx 应已被移除（基线改为 Prompt 方式）'
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

// ── baseline 通道测试（已更新为 Prompt 方案语义）────────────────────────────

function testLoadBaselineRulesReturnsEmptyWhenIncludeDefaultsFalse() {
  const baseline = loadBaselineRules({
    rules: { includeDefaults: false },
  });
  assert.deepStrictEqual(baseline.banned, [], 'includeDefaults=false: baseline.banned should always be empty');
  assert.deepStrictEqual(baseline.terminology, [], 'includeDefaults=false: baseline.terminology should be empty');
  assert.deepStrictEqual(baseline.semantic, [], 'includeDefaults=false: baseline.semantic should be empty');
}

function testLoadBaselineRulesAlwaysReturnEmptyBanned() {
  // banned is always [] regardless of includeDefaults since baseline has moved to Prompt approach
  const baselineOff = loadBaselineRules({ rules: { includeDefaults: false } });
  const baselineOn = loadBaselineRules({ rules: { includeDefaults: true } });
  assert.deepStrictEqual(baselineOff.banned, [], 'includeDefaults=false: banned always empty');
  assert.deepStrictEqual(baselineOn.banned, [], 'includeDefaults=true: banned always empty (Prompt-driven now)');
  // terminology should be populated when includeDefaults=true (from terminology.default.xlsx)
  assert.ok(baselineOn.terminology.length >= 5, 'includeDefaults=true: terminology defaults should have entries');
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
  });

  assert.ok(result.findings.length > 0, '应当命中项目规则中的"免费送"');
  for (const f of result.findings) {
    assert.strictEqual(f.source, 'project', `finding.source 应为 project, 实际: ${f.source}`);
  }
  // meta should not contain baseline fields
  assert.strictEqual(result.stats.bySource, undefined, 'bySource 字段已移除');
  assert.ok(typeof result.stats.bySeverity === 'object', 'stats.bySeverity 应存在');
}

async function testAnalyzeMetaHasNoBaselineFields() {
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
  });

  // baseline fields must be gone
  const meta = JSON.parse(
    fs.readFileSync(path.join(extractedDir, 'findings.rule.json'), 'utf8')
  ).meta;
  assert.strictEqual(meta.baselineEnabled, undefined, 'meta.baselineEnabled 已移除');
  assert.strictEqual(meta.baselineVersion, undefined, 'meta.baselineVersion 已移除');
  assert.strictEqual(meta.rulesLoaded && meta.rulesLoaded.baselineBanned, undefined, 'meta.rulesLoaded.baselineBanned 已移除');
  assert.ok('includeDefaults' in meta, 'meta.includeDefaults 应存在');
  assert.ok(typeof result.stats.bySeverity === 'object', 'stats.bySeverity 应存在');
  assert.strictEqual(result.stats.bySource, undefined, 'stats.bySource 已移除');
}

function testBuildStandardRulesGeneratesJson() {
  const { main } = require('../scripts/build-standard-rules');
  main();

  const productPath = path.join(__dirname, '..', 'config', 'standard-product.json');
  const sloganPath = path.join(__dirname, '..', 'config', 'standard-slogan.json');

  assert.ok(fs.existsSync(productPath), 'standard-product.json 应已生成');
  assert.ok(fs.existsSync(sloganPath), 'standard-slogan.json 应已生成');

  const products = JSON.parse(fs.readFileSync(productPath, 'utf8'));
  assert.ok(Array.isArray(products) && products.length > 0, 'standard-product.json 应包含产品数据');
  const first = products[0];
  assert.ok('name' in first, '产品对象应包含 name 字段');
  assert.ok('genericName' in first, '产品对象应包含 genericName 字段');
  assert.ok('brand' in first, '产品对象应包含 brand 字段');
  assert.ok('trademark' in first, '产品对象应包含 trademark 字段');

  const slogans = JSON.parse(fs.readFileSync(sloganPath, 'utf8'));
  assert.ok(Array.isArray(slogans) && slogans.length > 0, 'standard-slogan.json 应包含宣传语数据');
  assert.ok('type' in slogans[0], '宣传语对象应包含 type 字段');
  assert.ok('slogan' in slogans[0], '宣传语对象应包含 slogan 字段');
}

function testConfigDefaultsIncludeStandardWordsFalse() {
  const { loadConfig } = require('../lib/config');
  const config = loadConfig({ cwd: path.join(__dirname, '..') });
  assert.strictEqual(
    config.rules.includeStandardWords,
    false,
    'rules.includeStandardWords 默认应为 false'
  );
}

function testConfigDefaultsSystemBackgroundEmpty() {
  const { loadConfig } = require('../lib/config');
  const config = loadConfig({ cwd: path.join(__dirname, '..') });
  assert.strictEqual(config.systemBackground, '', 'systemBackground 默认应为空字符串');
}

function testReportUsesAiSystemBackgroundWhenConfigEmpty() {
  const cwd = tempProject();
  const outputDir = path.join(cwd, '.text-govern', 'report');
  const aiBackground = '面向 C 端用户的医药电商 H5，提供产品浏览与在线下单。';

  generateHtmlReport({
    ruleFindings: [],
    aiFindings: [],
    aiMeta: { systemBackground: aiBackground },
    scanMeta: { filesScanned: 5, totalFragments: 20 },
    config: { industry: '', systemBackground: '', severity: { failOn: '严重违禁' } },
    outputDir,
  });

  const config = readGlobalDataScript(
    path.join(outputDir, 'data', 'config.js'),
    'window.__TEXT_GOVERN_REPORT_CONFIG__'
  );
  assert.strictEqual(config.meta.systemBackground, aiBackground);
  assert.strictEqual(config.meta.systemBackgroundSource, 'ai');
}

function testReportPrefersConfigSystemBackgroundOverAiMeta() {
  const cwd = tempProject();
  const outputDir = path.join(cwd, '.text-govern', 'report');

  generateHtmlReport({
    ruleFindings: [],
    aiFindings: [],
    aiMeta: { systemBackground: 'AI 生成的背景不应覆盖配置值' },
    config: { systemBackground: '配置中的系统背景优先', severity: { failOn: '严重违禁' } },
    outputDir,
  });

  const config = readGlobalDataScript(
    path.join(outputDir, 'data', 'config.js'),
    'window.__TEXT_GOVERN_REPORT_CONFIG__'
  );
  assert.strictEqual(config.meta.systemBackground, '配置中的系统背景优先');
  assert.strictEqual(config.meta.systemBackgroundSource, 'config');
}

function testReportTruncatesSystemBackgroundTo200Chars() {
  const longText = '背'.repeat(250);
  const truncated = truncateSystemBackground(longText);
  assert.strictEqual(truncated.length, MAX_SYSTEM_BACKGROUND_LENGTH);
  assert.strictEqual(truncated, longText.slice(0, MAX_SYSTEM_BACKGROUND_LENGTH));

  const cwd = tempProject();
  const outputDir = path.join(cwd, '.text-govern', 'report');
  generateHtmlReport({
    ruleFindings: [],
    aiFindings: [],
    config: { systemBackground: longText, severity: { failOn: '严重违禁' } },
    outputDir,
  });

  const config = readGlobalDataScript(
    path.join(outputDir, 'data', 'config.js'),
    'window.__TEXT_GOVERN_REPORT_CONFIG__'
  );
  assert.strictEqual(config.meta.systemBackground.length, MAX_SYSTEM_BACKGROUND_LENGTH);
}

function testPackageJsonHasBuildDefaultsScript() {
  const pkg = require('../package.json');
  assert.ok(
    pkg.scripts && pkg.scripts['build:defaults'],
    'package.json 应定义 build:defaults 脚本'
  );
  assert.ok(
    !pkg.scripts['fetch:baseline'],
    'package.json 不应再有 fetch:baseline 脚本（已移除）'
  );
  assert.ok(
    pkg.scripts['build:defaults'].includes('build-default-rules'),
    'build:defaults 应调用 build-default-rules.js'
  );
  assert.ok(
    !pkg.scripts['build:defaults'].includes('fetch-public-baseline'),
    'build:defaults 不应再调用 fetch-public-baseline.js（已移除）'
  );
}

async function testBackendJavaYamlPropertiesScan() {
  const cwd = tempProject();
  const srcDir = path.join(cwd, 'order-service', 'src', 'main');
  fs.mkdirSync(path.join(srcDir, 'java', 'com', 'example'), { recursive: true });
  fs.mkdirSync(path.join(srcDir, 'resources'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'order-service', 'target'), { recursive: true });

  fs.writeFileSync(
    path.join(srcDir, 'java', 'com', 'example', 'OrderController.java'),
    [
      'package com.example;',
      '',
      'import io.swagger.annotations.ApiOperation;',
      '',
      'public class OrderController {',
      '  // 注释里的中文不应默认扫描',
      '  @ApiOperation("产品列表")',
      '  public String list() {',
      '    logger.info("发送邮件");',
      '    if (true) { throw new RuntimeException("邮件发送失败"); }',
      '    String content = """',
      '      不良反应呈报',
      '      姓名：张三',
      '      """;',
      '    return "提交成功";',
      '  }',
      '}',
      '',
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(srcDir, 'resources', 'application.yml'),
    [
      '# YAML 注释里的中文不应默认扫描',
      'spring:',
      '  application:',
      '    name: 官网服务',
      'messages:',
      '  - "提交成功"',
      '',
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(srcDir, 'resources', 'messages.properties'),
    [
      '# properties 注释里的中文不应默认扫描',
      'message.success=提交成功',
      'message.failure: 邮件发送失败',
      '',
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(cwd, 'order-service', 'target', 'Generated.java'),
    'class Generated { String v = "构建产物不应扫描"; }',
    'utf8'
  );

  const { run: scanRun } = require('../lib/commands/scan');
  const result = await scanRun({ cwd });
  const fragments = result.fragments;
  const texts = fragments.map((f) => f.normalized);

  assert.ok(texts.includes('产品列表'), 'Java annotation text should be extracted');
  assert.ok(texts.includes('发送邮件'), 'Java log text should be extracted');
  assert.ok(texts.includes('邮件发送失败'), 'Java exception/properties text should be extracted');
  assert.ok(texts.includes('提交成功'), 'Java return/properties/yaml text should be extracted');
  assert.ok(texts.some((text) => text.includes('不良反应呈报')), 'Java text block should be extracted');
  assert.ok(texts.includes('官网服务'), 'YAML scalar value should be extracted');
  assert.ok(!texts.some((text) => text.includes('注释里的中文')), 'Comments should not be extracted by default');
  assert.ok(!texts.some((text) => text.includes('构建产物不应扫描')), 'target directory should be excluded');

  const annotation = fragments.find((f) => f.normalized === '产品列表');
  assert.strictEqual(annotation.kind, 'java-annotation');
  assert.strictEqual(annotation.context, 'annotation');
  assert.ok(annotation.container.includes('@ApiOperation'));

  const yamlValue = fragments.find((f) => f.normalized === '官网服务');
  assert.strictEqual(yamlValue.kind, 'yaml-value');
  assert.strictEqual(yamlValue.context, 'config');

  const propertiesValue = fragments.find((f) => f.file.endsWith('messages.properties'));
  assert.strictEqual(propertiesValue.kind, 'properties-value');
  assert.strictEqual(propertiesValue.context, 'config');
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
    // Baseline channel tests (updated for Prompt-driven approach)
    testLoadBaselineRulesReturnsEmptyWhenIncludeDefaultsFalse,
    testLoadBaselineRulesAlwaysReturnEmptyBanned,
    testLoadAllRulesDoesNotIncludeBaselineWhenExcluded,
    testAnalyzeFindings_HaveSourceField,
    testAnalyzeMetaHasNoBaselineFields,
    // New: standard words + config defaults
    testBuildStandardRulesGeneratesJson,
    testConfigDefaultsIncludeStandardWordsFalse,
    testConfigDefaultsSystemBackgroundEmpty,
    testReportUsesAiSystemBackgroundWhenConfigEmpty,
    testReportPrefersConfigSystemBackgroundOverAiMeta,
    testReportTruncatesSystemBackgroundTo200Chars,
    testPackageJsonHasBuildDefaultsScript,
    testBackendJavaYamlPropertiesScan,
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
