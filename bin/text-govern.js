#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const path = require('path');
const pkg = require('../package.json');

program
  .name('text-govern')
  .description('自动化文案治理 CLI')
  .version(pkg.version);

program
  .command('init')
  .description('初始化配置文件、自定义规则模板和空规则目录')
  .option('--cwd <dir>', '工作目录', process.cwd())
  .action(async (opts) => {
    const { run } = require('../lib/commands/init');
    await run(opts);
  });

program
  .command('scan')
  .description('静态扫描源码，提取所有中文文案片段 → .text-govern/extracted.json')
  .option('--cwd <dir>', '工作目录', process.cwd())
  .option('--config <file>', '配置文件路径')
  .option('--out <file>', '输出文件路径')
  .action(async (opts) => {
    const { run } = require('../lib/commands/scan');
    await run(opts);
  });

program
  .command('analyze')
  .description('读取 extracted.json，执行规则匹配 → .text-govern/findings.rule.json')
  .option('--cwd <dir>', '工作目录', process.cwd())
  .option('--config <file>', '配置文件路径')
  .option('--input <file>', 'extracted.json 路径')
  .option('--out <file>', '输出 findings.rule.json 路径')
  .option('--no-baseline', '跳过公开基线扫描（即使 rules.includeDefaults = true）')
  .action(async (opts) => {
    const { run } = require('../lib/commands/analyze');
    await run(opts);
  });

program
  .command('report')
  .description('合并 rule + ai findings，生成自包含 HTML 整改报告')
  .option('--cwd <dir>', '工作目录', process.cwd())
  .option('--config <file>', '配置文件路径')
  .option('--rule-findings <file>', 'findings.rule.json 路径')
  .option('--ai-findings <file>', 'findings.ai.json 路径（可选）')
  .option('--out <file>', '输出 HTML 路径')
  .option('--no-fail', '即使存在阻断等级问题也以 0 退出')
  .action(async (opts) => {
    const { run } = require('../lib/commands/report');
    await run(opts);
  });

program
  .command('template')
  .description('生成自定义规则模板（Markdown + xlsx）到 custom/ 目录')
  .option('--cwd <dir>', '工作目录', process.cwd())
  .option('--md', '仅生成 Markdown 模板')
  .option('--xlsx', '仅生成 Excel 模板')
  .action(async (opts) => {
    const { run } = require('../lib/commands/template');
    await run(opts);
  });

program
  .command('rules:verify')
  .description('严格校验 text-govern-rules/generated/ 是否符合 scan/analyze 消费契约')
  .option('--cwd <dir>', '工作目录', process.cwd())
  .option('--config <file>', '配置文件路径')
  .option('--dir <dir>', '自定义校验目录（默认使用 config.builtinRules.dir）')
  .action(async (opts) => {
    const { run } = require('../lib/commands/rules-verify');
    await run(opts);
  });

program
  .command('install')
  .description('把 text-govern Skill + Slash 命令部署到 Cursor / Claude Code / Codex')
  .option('--editor <list>', '编辑器列表（逗号分隔：cursor,claude,codex）；默认自动探测')
  .option('--scope <scope>', 'project（项目本地）或 global（用户全局）', 'project')
  .option('--force', '覆盖已有资产')
  .option('--dry-run', '仅打印计划，不实际写入')
  .option('--cwd <dir>', '工作目录（project scope 有效）', process.cwd())
  .action(async (opts) => {
    const { run } = require('./install');
    await run(opts);
  });

program.parseAsync(process.argv).catch((err) => {
  const chalk = require('chalk');
  console.error(chalk.red(`\n[text-govern] 执行失败: ${err.message}`));
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
