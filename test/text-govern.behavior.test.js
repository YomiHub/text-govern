'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

const { run: init } = require('../lib/commands/init');
const { loadAllRules, loadBaselineRules } = require('../lib/rules/loader');
const { buildStats, normalizeSeverity } = require('../lib/severity');

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
    { severity: '严重违禁', category: '广告法极限词' },
    { severity: '推荐修改', category: '推荐修改类' },
  ]);

  assert.strictEqual(stats.bySeverity['严重违禁'], 1);
  assert.strictEqual(stats.bySeverity['推荐修改'], 1);
  assert.strictEqual(stats.byCategory['广告法极限词'], 1);
  assert.strictEqual(stats.byCategory['推荐修改类'], 1);
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
  const rulesDir = path.join(cwd, 'text-govern-rules', 'generated');
  fs.mkdirSync(rulesDir, { recursive: true });
  const customDir = path.join(cwd, 'text-govern-rules', 'custom');
  fs.mkdirSync(customDir, { recursive: true });

  // Write a minimal project rule
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['词', '替换建议', '风险等级', '分类', '法规来源', '备注'],
      ['免费送', '限时优惠', '高风险', '广告法极限词', '广告法', ''],
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
  const rulesDir = path.join(cwd, 'text-govern-rules', 'generated');
  const customDir = path.join(cwd, 'text-govern-rules', 'custom');
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.mkdirSync(customDir, { recursive: true });

  const extractedDir = path.join(cwd, '.text-govern');
  fs.mkdirSync(extractedDir, { recursive: true });
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
  const rulesDir = path.join(cwd, 'text-govern-rules', 'generated');
  const customDir = path.join(cwd, 'text-govern-rules', 'custom');
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.mkdirSync(customDir, { recursive: true });

  const extractedDir = path.join(cwd, '.text-govern');
  fs.mkdirSync(extractedDir, { recursive: true });
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
