#!/usr/bin/env node
'use strict';

/**
 * text-govern install
 *
 * 探测项目（或全局）AI 编辑器目录，把 Skill + Slash 命令资产铺设到对应位置。
 *
 * 支持的编辑器：
 *   - cursor:  .cursor/skills/text-govern/   + .cursor/commands/text-govern*.md
 *   - claude:  .claude/skills/text-govern/   + .claude/commands/text-govern*.md
 *   - codex:   .codex/skills/text-govern/    （Codex 已弃用 custom prompts，不铺 commands）
 */

const fs = require('fs');
const path = require('path');

const PKG_DIR = path.join(__dirname, '..');
const SKILLS_SRC = path.join(PKG_DIR, 'skills', 'text-govern');
const COMMANDS_SRC = path.join(PKG_DIR, 'commands');

const EDITOR_CONFIGS = {
  cursor: {
    detect: ['.cursor'],
    skillDst: path.join('.cursor', 'skills', 'text-govern'),
    commandDst: path.join('.cursor', 'commands'),
    supportsCommands: true,
  },
  claude: {
    detect: ['.claude'],
    skillDst: path.join('.claude', 'skills', 'text-govern'),
    commandDst: path.join('.claude', 'commands'),
    supportsCommands: true,
  },
  codex: {
    detect: ['.codex'],
    skillDst: path.join('.codex', 'skills', 'text-govern'),
    commandDst: null,
    supportsCommands: false,
  },
};

function log(msg) {
  console.log(`[text-govern install] ${msg}`);
}

function logDry(msg) {
  console.log(`[dry-run] ${msg}`);
}

/**
 * Recursively copy srcDir → dstDir.
 * Skips existing files unless force=true.
 */
function copyDir(srcDir, dstDir, opts) {
  const { force, dryRun } = opts;

  if (!fs.existsSync(srcDir)) return;

  if (dryRun) {
    logDry(`mkdir -p ${dstDir}`);
  } else {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dst, opts);
    } else {
      if (!force && fs.existsSync(dst)) {
        log(`跳过（已存在，使用 --force 覆盖）: ${dst}`);
        continue;
      }
      if (dryRun) {
        logDry(`cp ${src} → ${dst}`);
      } else {
        fs.copyFileSync(src, dst);
        log(`已写入: ${dst}`);
      }
    }
  }
}

/**
 * Copy all text-govern*.md from commands/ dir.
 */
function copyCommands(dstDir, opts) {
  const { force, dryRun } = opts;

  if (!fs.existsSync(COMMANDS_SRC)) return;

  if (dryRun) {
    logDry(`mkdir -p ${dstDir}`);
  } else {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  const files = fs.readdirSync(COMMANDS_SRC).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const src = path.join(COMMANDS_SRC, file);
    const dst = path.join(dstDir, file);
    if (!force && fs.existsSync(dst)) {
      log(`跳过（已存在，使用 --force 覆盖）: ${dst}`);
      continue;
    }
    if (dryRun) {
      logDry(`cp ${src} → ${dst}`);
    } else {
      fs.copyFileSync(src, dst);
      log(`已写入: ${dst}`);
    }
  }
}

/**
 * Detect which editors are present in rootDir.
 */
function detectEditors(rootDir) {
  const found = [];
  for (const [name, cfg] of Object.entries(EDITOR_CONFIGS)) {
    for (const marker of cfg.detect) {
      const markerPath = path.join(rootDir, marker);
      if (fs.existsSync(markerPath)) {
        found.push(name);
        break;
      }
    }
  }
  return found;
}

/**
 * Resolve global editor directories based on scope.
 */
function resolveRootDir(scope, cwd) {
  if (scope === 'global') {
    return require('os').homedir();
  }
  return cwd || process.cwd();
}

/**
 * Main install function.
 *
 * @param {object} opts
 * @param {string} [opts.editor]   - comma-separated list: cursor,claude,codex (default: auto-detect)
 * @param {string} [opts.scope]    - 'project' | 'global' (default: 'project')
 * @param {boolean} [opts.force]   - overwrite existing files
 * @param {boolean} [opts.dryRun]  - print plan without writing
 * @param {string} [opts.cwd]      - working directory override
 */
async function run(opts = {}) {
  const scope = opts.scope || 'project';
  const force = Boolean(opts.force);
  const dryRun = Boolean(opts.dryRun);
  const rootDir = resolveRootDir(scope, opts.cwd);
  const copyOpts = { force, dryRun };

  if (dryRun) {
    log('DRY RUN — 不会实际写入任何文件');
  }

  // Resolve target editors
  let targetEditors;
  if (opts.editor) {
    targetEditors = opts.editor.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const unknown = targetEditors.filter((e) => !EDITOR_CONFIGS[e]);
    if (unknown.length) {
      log(`警告：未知编辑器 ${unknown.join(', ')}，已跳过`);
      targetEditors = targetEditors.filter((e) => EDITOR_CONFIGS[e]);
    }
  } else {
    targetEditors = detectEditors(rootDir);
    if (targetEditors.length === 0) {
      log('未检测到 .cursor / .claude / .codex 目录，将安装全部三家（project scope）');
      targetEditors = Object.keys(EDITOR_CONFIGS);
    } else {
      log(`检测到编辑器：${targetEditors.join(', ')}`);
    }
  }

  if (targetEditors.length === 0) {
    log('没有可安装的目标，退出。');
    return;
  }

  log(`目标目录：${rootDir}  scope：${scope}`);
  log(`安装到：${targetEditors.join(', ')}`);
  log('');

  let installed = 0;

  for (const editor of targetEditors) {
    const cfg = EDITOR_CONFIGS[editor];
    const skillDst = path.join(rootDir, cfg.skillDst);

    log(`[${editor}] 铺设 Skill → ${skillDst}`);
    copyDir(SKILLS_SRC, skillDst, copyOpts);

    if (cfg.supportsCommands && cfg.commandDst) {
      const cmdDst = path.join(rootDir, cfg.commandDst);
      log(`[${editor}] 铺设 Slash Commands → ${cmdDst}`);
      copyCommands(cmdDst, copyOpts);
    } else if (!cfg.supportsCommands) {
      log(`[${editor}] Codex 已弃用 custom prompts，跳过 slash 命令铺设（Skill 即入口）`);
    }

    installed++;
    log('');
  }

  if (!dryRun) {
    console.log('='.repeat(60));
    log(`安装完成！${installed} 个编辑器已就绪。`);
    console.log('');
    console.log('接下来：');
    console.log('  1. 在项目根运行 CLI 初始化（任选其一，与 README「方式一」一致时可不装全局）：');
    console.log('     `text-govern init` 或 `npx -y text-govern init` 或 `node scripts/text-govern/bin/text-govern.js init`');
    console.log('  2. 在 IDE 中输入 `/text-govern-rules` 让 AI 生成项目规则库');
    console.log('  3. 确认规则后输入 `/text-govern` 跑完整文案治理流程');
    console.log('='.repeat(60));
  }
}

module.exports = { run };
