"use strict"

const path = require("path")
const fs = require("fs")
const logger = require("../logger")

const CONFIG_TEMPLATE = `// text-govern 配置文件
// 文档：如果通过 npm link 使用，请查看 text-govern 包 README；
// 当前仓库内置版本文档见 scripts/text-govern/README.md。
//
// 通用说明：
// - scan.include 使用 "**/*" 覆盖整个项目，工具只处理 adapters 列表对应后缀的文件
// - 支持项目类型：React/Next.js、Vue、微信小程序、HTML、Java 后端、YAML/Properties 配置
// - 如需只扫描特定目录，可改为 ['src/**', 'pages/**']、['*/src/main/**'] 或 ['bfcn-core/src/main/**'] 等
'use strict';

module.exports = {
  // 系统行业/业务类型。
  // - 留空：由 AI 根据源码、路由、页面文案自行判断
  // - 任意字符串：如 "医院信息系统"
  // 该值只作为 AI 生成规则的业务上下文，不限制枚举。
  industry: '',

  // 系统背景资料（报告 header 展示用，建议 200 字以内）。
  // 留空时由 /text-govern-report AI 语义阶段根据源码自动识别并写入 findings.ai.json。
  systemBackground: '',

  scan: {
    // "**/*" 匹配全项目文件，实际扫描范围由 adapters 的文件后缀决定。
    // 覆盖：前端项目 + Java 后端项目；多模块后端可保持默认，也可收窄到 ['*/src/main/**']。
    include: ['**/*'],
    exclude: [
      'node_modules/**',
      'miniprogram_npm/**',
      '.text-govern/**',
      '**/scripts/text-govern/**',
      'dist/**',
      'build/**',
      '**/build/**',
      'target/**',
      '**/target/**',
      'out/**',
      'lib/**',
      '.gradle/**',
      '**/.gradle/**',
      '.next/**',
      '.nuxt/**',
      '.output/**',
      '.turbo/**',
      '.cache/**',
      '.vercel/**',
      'coverage/**',
      '.git/**',
      '.idea/**',
      '.vscode/**',
      '**/*.min.js',
      '**/*.min.css',
      '**/*.map',
      '**/*.test.js',
      '**/*.test.ts',
      '**/*.spec.js',
      '**/*.spec.ts',
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/generated/**',
      '**/generated-sources/**',
      '**/*.class',
      '**/*.jar',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
    ],
    // adapters 说明：
    //   wxml  = 微信小程序 .wxml 模板
    //   js    = .js / .ts / .wxs
    //   json  = .json 配置
    //   vue   = Vue SFC .vue
    //   jsx   = React/Next.js .jsx / .tsx
    //   html  = 通用 .html / .htm
    //   java  = Java 后端 .java（运行时字符串、注解、日志/异常/返回文案）
    //   yaml  = .yml / .yaml 配置值
    //   properties = .properties 配置值
    adapters: ['wxml', 'js', 'json', 'vue', 'jsx', 'html', 'java', 'yaml', 'properties'],
    backend: {
      // 默认只治理运行时文案；开启后才扫描注释/Javadoc。
      includeComments: false,
      // 日志、异常、返回值、邮件等运行时文案默认纳入治理。
      includeLogMessages: true,
      // Spring MVC / Swagger / Validation 等注解里的 API 文案默认纳入治理。
      includeAnnotations: true,
    },
  },

  customRules: { dir: './text-govern-rules/custom' },
  builtinRules: { dir: './text-govern-rules/generated' },
  rules: {
    // 是否启用基线合规类目（色情/政治/暴恐/广告/涉枪涉爆）的 Prompt 限定范围扫描。
    // 开启后 /text-govern-rules 阶段 AI 会扫代码库命中的具体词写入 banned.xlsx，
    // 而不是加载大词库文件——识别更智能，且只输出项目实际存在的问题。
    includeDefaults: true,
    // 是否启用标准产品名 / 宣传语识别。
    // 开启后 /text-govern-report AI 语义阶段会对照 scripts/text-govern/config/standard-*.json，
    // 识别代码库中是否存在拼写错误、谐音、缩写篡改等非标准写法（多语言不计错误）。
    includeStandardWords: true,
    // 是否启用项目 terminology.xlsx 规则匹配（词义统一类）。
    // 设为 false 时 analyze 阶段跳过 text-govern-rules/ 中的术语统一规则；
    // 不影响内置默认术语（includeDefaults）、semantic.xlsx 及 AI 语义分析结果。
    includeProjectTerminology: true,
  },
  output: { dir: './.text-govern' },

  exclusions: {
    minChineseChars: 2,
    patterns: ['^https?://', '^\\\\.\\\\..', '^[A-Za-z0-9_\\\\-.]+$', '^#[0-9a-fA-F]{3,6}$'],
  },

  severity: { failOn: '严重违禁' },
};
`

/**
 * Lightweight header check: parse the first row of a xlsx sheet and verify
 * at least one cell matches a known HEADER_ALIASES key.
 */
function assertXlsxShape(filePath, expectedType) {
  let XLSX
  try {
    XLSX = require("xlsx")
  } catch (e) {
    throw new Error(`xlsx 包未安装，请在 scripts/text-govern 目录运行 npm install: ${e.message}`)
  }

  const HEADER_ALIASES = {
    word: ["词", "违禁词", "违规词", "关键词", "词汇", "word"],
    suggestion: ["替换建议", "建议", "推荐替换", "推荐词", "suggestion"],
    severity: ["风险等级", "等级", "严重程度", "severity"],
    category: ["分类", "类别", "类型", "category"],
    legalRef: ["法规来源", "法规", "参考", "legalRef"],
    canonical: ["标准词", "规范词", "正确词", "canonical"],
    aliases: ["别名", "别名（逗号分隔）", "同义词", "aliases"],
    note: ["备注", "说明", "note"],
    pageGlob: ["页面/路径 glob", "路径", "页面", "pageGlob"],
    fieldMeaning: ["字段含义", "含义", "意义", "fieldMeaning"],
    forbidden: ["禁用替代词", "禁用词", "禁止词", "forbidden"],
  }

  const allKnownAliases = new Set(
    Object.values(HEADER_ALIASES)
      .flat()
      .map((v) => v.trim().toLowerCase().replace(/[\s（(）)]/g, ""))
  )

  const workbook = XLSX.readFile(filePath)
  if (!workbook.SheetNames.length) {
    throw new Error(`${path.basename(filePath)} 没有任何 Sheet`)
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
  if (!rows.length || !rows[0].length) {
    throw new Error(`${path.basename(filePath)} 第一个 Sheet 为空或没有表头行`)
  }

  const headers = rows[0].map((h) =>
    String(h || "")
      .trim()
      .toLowerCase()
      .replace(/[\s（(）)]/g, "")
  )
  const matched = headers.filter((h) => allKnownAliases.has(h))
  if (!matched.length) {
    throw new Error(
      `${path.basename(filePath)} 表头未识别到任何已知列名（期望类型: ${expectedType}）。` +
        `\n  当前表头: [${rows[0].join(", ")}]` +
        `\n  修复：请确认 xlsx 模板包含正确的列名（见 text-govern-rules/custom/README.md）`
    )
  }
}

async function run(opts = {}) {
  const cwd = opts.cwd || process.cwd()

  logger.info("初始化 text-govern...")

  // 1. Create config file if missing
  const configPath = path.join(cwd, "text-govern.config.js")
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, CONFIG_TEMPLATE, "utf8")
    logger.success(`配置文件已创建: text-govern.config.js`)
  } else {
    logger.dim(`配置文件已存在: text-govern.config.js`)
  }

  // 2. Create project-local directories. Do not write runtime project rules
  // into the package directory so the CLI stays npm-link friendly.
  const rulesRoot = path.join(cwd, "text-govern-rules")
  const dirs = [
    path.join(rulesRoot, "generated"),
    path.join(rulesRoot, "custom"),
    path.join(cwd, ".text-govern"),
  ]
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true })
    logger.dim(`目录就绪: ${path.relative(cwd, dir)}`)
  }

  // 3. Generate .gitkeep in generated/ so it can be committed
  const gitkeep = path.join(rulesRoot, "generated", ".gitkeep")
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, "", "utf8")
  }

  // 4. Generate custom rule templates. Excel is the default business-facing format.
  const { run: templateRun } = require("./template")
  await templateRun({ cwd, config: configPath, xlsx: true })

  // 5. Integrity self-check — fail fast with actionable error message
  const failures = []

  if (!fs.existsSync(configPath)) {
    failures.push("text-govern.config.js 未生成")
  }
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      failures.push(`目录缺失: ${path.relative(cwd, dir)}`)
    }
  }
  if (!fs.existsSync(gitkeep)) {
    failures.push("text-govern-rules/generated/.gitkeep 未生成")
  }

  const customDir = path.join(rulesRoot, "custom")
  const requiredCustomFiles = [
    { name: "banned.xlsx", type: "banned" },
    { name: "terminology.xlsx", type: "terminology" },
    { name: "semantic.xlsx", type: "semantic" },
    { name: "README.md", type: "markdown" },
  ]
  for (const { name, type } of requiredCustomFiles) {
    const fp = path.join(customDir, name)
    if (!fs.existsSync(fp)) {
      failures.push(
        `text-govern-rules/custom/${name} 未生成` +
          (name.endsWith(".xlsx") ? "（可能是 xlsx 包未安装，请运行 cd scripts/text-govern && npm install）" : "")
      )
    } else if (name.endsWith(".xlsx")) {
      try {
        assertXlsxShape(fp, type)
      } catch (e) {
        failures.push(e.message)
      }
    }
  }

  if (failures.length > 0) {
    console.error("\n" + "=".repeat(60))
    logger.error("初始化不完整，以下项目检查失败：")
    for (const msg of failures) {
      console.error(`  ✗ ${msg}`)
    }
    console.error("")
    console.error("修复建议：")
    console.error("  1. 确认已在 scripts/text-govern 目录运行 npm install（xlsx 包必须存在）")
    console.error("  2. 检查目录写入权限")
    console.error("  3. 重新运行 text-govern init")
    console.error("=".repeat(60) + "\n")
    process.exit(1)
  }

  // 6. Instructions
  console.log("\n" + "=".repeat(60))
  logger.success("初始化完成！接下来：")
  console.log("")
  console.log("  1. 可选：编辑 text-govern.config.js 的 industry")
  console.log("     留空表示由 AI 根据系统源码自行判断；也可填写任意业务描述")
  console.log("")
  console.log("  2. 在 Cursor 中对 Agent 说：")
  console.log('     "/text-govern-rules"')
  console.log("     → Agent 会读取源码，按 6 维度为你生成 Excel 规则包")
  console.log("")
  console.log("  3. 确认 AI 生成的规则内容后，提交到 git：")
  console.log('     git add text-govern-rules/ && git commit -m "feat: 初始化规则库"')
  console.log("")
  console.log("  4. 之后每次检查，对 Agent 说：")
  console.log('     "/text-govern"')
  console.log("     → Agent 会自动完成扫描→规则分析→AI语义分析→报告")
  console.log("")
  console.log("  5. 可选：编辑 text-govern-rules/custom/ 下的 Excel 模板")
  console.log("     添加项目专属词汇（高优先级，覆盖 AI 生成规则）")
  console.log("=".repeat(60) + "\n")
}

module.exports = { run }
