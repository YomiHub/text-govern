'use strict';

const path = require('path');
const fs = require('fs');

const DEFAULTS = {
  // Empty means "let AI infer the system/industry from code and config".
  // Any custom string is accepted, e.g. "医药代理商商贷宝系统".
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
      'dist/**',
      '**/*.test.js',
      '**/*.spec.js',
      '**/scripts/text-govern/**',
    ],
    adapters: ['wxml', 'js', 'json'],
  },
  customRules: {
    dir: './text-govern-rules/custom',
  },
  builtinRules: {
    dir: './text-govern-rules/generated',
  },
  rules: {
    includeDefaults: false,
  },
  output: {
    dir: '.text-govern',
  },
  exclusions: {
    minChineseChars: 2,
    patterns: [
      '^https?://',
      '^\\.\\.',
      '^[A-Za-z0-9_\\-\\.]+$',
      '^#[0-9a-fA-F]{3,6}$',
    ],
  },
  severity: {
    failOn: '严重违禁',
  },
};

/**
 * Deep-merge two plain objects (b overrides a).
 * Arrays in b replace arrays in a entirely.
 */
function deepMerge(a, b) {
  if (!b || typeof b !== 'object') return a;
  const result = Object.assign({}, a);
  for (const key of Object.keys(b)) {
    if (
      b[key] !== null &&
      typeof b[key] === 'object' &&
      !Array.isArray(b[key]) &&
      typeof a[key] === 'object' &&
      !Array.isArray(a[key])
    ) {
      result[key] = deepMerge(a[key] || {}, b[key]);
    } else {
      result[key] = b[key];
    }
  }
  return result;
}

/**
 * Load and resolve config from project root.
 * @param {object} opts  { cwd, config }
 */
function loadConfig(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const configFile =
    opts.config ||
    path.join(cwd, 'text-govern.config.js');

  let userConfig = {};
  if (fs.existsSync(configFile)) {
    try {
      userConfig = require(path.resolve(configFile));
    } catch (e) {
      throw new Error(`配置文件加载失败: ${configFile}\n${e.message}`);
    }
  }

  const merged = deepMerge(DEFAULTS, userConfig);

  // Resolve paths relative to cwd
  merged.output.dir = path.resolve(cwd, merged.output.dir);

  if (!path.isAbsolute(merged.customRules.dir)) {
    merged.customRules.dir = path.resolve(cwd, merged.customRules.dir);
  }
  if (!path.isAbsolute(merged.builtinRules.dir)) {
    merged.builtinRules.dir = path.resolve(cwd, merged.builtinRules.dir);
  }

  // Compile exclusion regex patterns
  merged.exclusions._compiled = merged.exclusions.patterns.map((p) =>
    typeof p === 'string' ? new RegExp(p) : p
  );

  merged._cwd = cwd;
  return merged;
}

module.exports = { loadConfig, DEFAULTS };
