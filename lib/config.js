"use strict"

const path = require("path")
const fs = require("fs")

const DEFAULTS = {
  // Empty means "let AI infer the system/industry from code and config".
  industry: "",
  scan: {
    // '**/*' matches all files; actual files processed are determined by
    // the enabled adapters' extensions (.wxml/.js/.json/.vue/.jsx/.tsx/.html).
    // Covers: React/Next.js (jsx/tsx), Vue, 微信小程序 (wxml/wxs), HTML.
    include: ["**/*"],
    exclude: [
      "node_modules/**",
      "miniprogram_npm/**",
      ".text-govern/**",
      "**/scripts/text-govern/**",
      "dist/**",
      "build/**",
      "out/**",
      "lib/**",
      ".next/**",
      ".nuxt/**",
      ".output/**",
      ".turbo/**",
      ".cache/**",
      ".vercel/**",
      "coverage/**",
      ".git/**",
      ".idea/**",
      ".vscode/**",
      "**/*.min.js",
      "**/*.min.css",
      "**/*.map",
      "**/*.test.js",
      "**/*.test.ts",
      "**/*.spec.js",
      "**/*.spec.ts",
      "**/__tests__/**",
      "**/__mocks__/**",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
    ],
    // Adapters: wxml=微信小程序, js=JS/TS/WXS, json=配置文件,
    //           vue=Vue SFC, jsx=React/Next.js (jsx+tsx), html=通用 HTML
    adapters: ["wxml", "js", "json", "vue", "jsx", "html"],
  },
  customRules: {
    dir: "./text-govern-rules/custom",
  },
  builtinRules: {
    dir: "./text-govern-rules/generated",
  },
  rules: {
    includeDefaults: false,
  },
  output: {
    dir: ".text-govern",
  },
  exclusions: {
    minChineseChars: 2,
    patterns: ["^https?://", "^\\.\\.", "^[A-Za-z0-9_\\-\\.]+$", "^#[0-9a-fA-F]{3,6}$"],
  },
  severity: {
    failOn: "严重违禁",
  },
}

/**
 * Deep-merge two plain objects (b overrides a).
 * Arrays in b replace arrays in a entirely.
 */
function deepMerge(a, b) {
  if (!b || typeof b !== "object") return a
  const result = clonePlain(a)
  for (const key of Object.keys(b)) {
    if (
      b[key] !== null &&
      typeof b[key] === "object" &&
      !Array.isArray(b[key]) &&
      typeof a[key] === "object" &&
      !Array.isArray(a[key])
    ) {
      result[key] = deepMerge(a[key] || {}, b[key])
    } else {
      result[key] = b[key]
    }
  }
  return result
}

function clonePlain(value) {
  if (Array.isArray(value)) return value.map((item) => clonePlain(item))
  if (!value || typeof value !== "object") return value
  const result = {}
  for (const key of Object.keys(value)) {
    result[key] = clonePlain(value[key])
  }
  return result
}

/**
 * Load and resolve config from project root.
 * @param {object} opts  { cwd, config }
 */
function loadConfig(opts = {}) {
  const cwd = opts.cwd || process.cwd()
  const configFile = opts.config || path.join(cwd, "text-govern.config.js")

  let userConfig = {}
  if (fs.existsSync(configFile)) {
    try {
      userConfig = require(path.resolve(configFile))
    } catch (e) {
      throw new Error(`配置文件加载失败: ${configFile}\n${e.message}`)
    }
  }

  const merged = deepMerge(DEFAULTS, userConfig)

  // Resolve paths relative to cwd
  merged.output.dir = path.resolve(cwd, merged.output.dir)

  if (!path.isAbsolute(merged.customRules.dir)) {
    merged.customRules.dir = path.resolve(cwd, merged.customRules.dir)
  }
  if (!path.isAbsolute(merged.builtinRules.dir)) {
    merged.builtinRules.dir = path.resolve(cwd, merged.builtinRules.dir)
  }

  // Compile exclusion regex patterns
  merged.exclusions._compiled = merged.exclusions.patterns.map((p) =>
    typeof p === "string" ? new RegExp(p) : p,
  )

  merged._cwd = cwd
  return merged
}

module.exports = { loadConfig, DEFAULTS }
