'use strict';

const path = require('path');
const fs = require('fs');
const logger = require('../logger');

const CONFIG_TEMPLATE = `/**
 * text-govern 配置文件
 * 文档：如果通过 npm link 使用，请查看 text-govern 包 README；
 * 当前仓库内置版本文档见 scripts/text-govern/README.md。
 */
'use strict';

module.exports = {
  /**
   * 系统行业/业务类型。
   *
   * - 留空：由 Cursor AI 根据源码、路由、页面文案自行判断
   * - 任意字符串：如 '医药系统中的代理商专用商贷宝系统'
   *
   * 该值只作为 AI 生成规则的业务上下文，不限制枚举。
   */
  industry: '',

  scan: {
    include: [
      'pages/**',
      'packageA/**',
      'packageB/**',
      'packageC/**',
      'components/**',
      'app.json',
    ],
    exclude: [
      'node_modules/**',
      'miniprogram_npm/**',
      '.text-govern/**',
      '**/scripts/text-govern/**',
      '**/*.test.js',
    ],
    adapters: ['wxml', 'js', 'json'],
  },

  customRules: { dir: './text-govern-rules/custom' },
  builtinRules: { dir: './text-govern-rules/generated' },
  rules: { includeDefaults: false },
  output: { dir: './.text-govern' },

  exclusions: {
    minChineseChars: 2,
    patterns: ['^https?://', '^\\\\.\\\\..', '^[A-Za-z0-9_\\\\-.]+$', '^#[0-9a-fA-F]{3,6}$'],
  },

  severity: { failOn: '严重违禁' },
};
`;

async function run(opts = {}) {
  const cwd = opts.cwd || process.cwd();

  logger.info('初始化 text-govern...');

  // 1. Create config file if missing
  const configPath = path.join(cwd, 'text-govern.config.js');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, CONFIG_TEMPLATE, 'utf8');
    logger.success(`配置文件已创建: text-govern.config.js`);
  } else {
    logger.dim(`配置文件已存在: text-govern.config.js`);
  }

  // 2. Create project-local directories. Do not write runtime project rules
  // into the package directory so the CLI stays npm-link friendly.
  const rulesRoot = path.join(cwd, 'text-govern-rules');
  const dirs = [
    path.join(rulesRoot, 'generated'),
    path.join(rulesRoot, 'custom'),
    path.join(cwd, '.text-govern'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
    logger.dim(`目录就绪: ${path.relative(cwd, dir)}`);
  }

  // 3. Generate .gitkeep in generated/ so it can be committed
  const gitkeep = path.join(rulesRoot, 'generated', '.gitkeep');
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, '', 'utf8');
  }

  // 4. Generate custom rule templates. Excel is the default business-facing format.
  const { run: templateRun } = require('./template');
  await templateRun({ cwd, config: configPath, xlsx: true });

  // 5. Instructions
  console.log('\n' + '='.repeat(60));
  logger.success('初始化完成！接下来：');
  console.log('');
  console.log('  1. 可选：编辑 text-govern.config.js 的 industry');
  console.log('     留空表示由 AI 根据系统源码自行判断；也可填写任意业务描述');
  console.log('');
  console.log('  2. 在 Cursor 中对 Agent 说：');
  console.log('     "使用 text-govern skill，初始化规则库"');
  console.log('     → Agent 会读取源码和 generate-rules.md，为你生成 Excel 规则包');
  console.log('');
  console.log('  3. 确认 AI 生成的规则内容后，提交到 git：');
  console.log('     git add text-govern-rules/ && git commit -m "feat: 初始化文案治理规则库"');
  console.log('');
  console.log('  4. 之后每次检查，对 Agent 说：');
  console.log('     "跑一下文案治理"');
  console.log('     → Agent 会自动完成扫描→规则分析→AI语义分析→报告');
  console.log('');
  console.log('  5. 可选：编辑 text-govern-rules/custom/ 下的 Excel 模板');
  console.log('     添加项目专属词汇（高优先级，覆盖 AI 生成规则）');
  console.log('='.repeat(60) + '\n');
}

module.exports = { run };
