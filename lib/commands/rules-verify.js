"use strict"

/**
 * rules-verify: Strictly validate text-govern-rules/generated/ against the
 * scan/analyze consumption contract.
 *
 * Contract (must all pass):
 *   1. banned.xlsx, terminology.xlsx, semantic.xlsx, README.md all exist
 *   2. README.xlsx must NOT exist
 *   3. Each xlsx has the correct Sheet name and recognised column headers
 *   4. Total parsed rules (banned + terminology + semantic) >= 1
 *
 * Exit 0 = pass, Exit 1 = fail.
 */

const path = require("path")
const fs = require("fs")
const chalk = require("chalk")
const { loadConfig } = require("../config")
const logger = require("../logger")

// Expected contract per file
const FILE_CONTRACT = [
  {
    file: "banned.xlsx",
    sheetKeywords: ["违禁", "违规", "banned"],
    // At least one of these header aliases must appear in the sheet
    requiredHeaderAliases: ["词", "违禁词", "违规词", "关键词", "词汇", "word"],
    type: "banned",
    description: "违禁违规词",
  },
  {
    file: "terminology.xlsx",
    sheetKeywords: ["术语", "term"],
    requiredHeaderAliases: ["标准词", "规范词", "正确词", "canonical"],
    type: "terminology",
    description: "术语统一",
  },
  {
    file: "semantic.xlsx",
    sheetKeywords: ["语义", "seman"],
    requiredHeaderAliases: ["页面/路径 glob", "页面/路径", "路径", "页面", "pageglob", "pageGlob"],
    type: "semantic",
    description: "业务语义",
  },
]

function normalizeStr(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/[\s（(）)\/]/g, "")
}

/**
 * Parse xlsx and return { sheetName, headers, parsedCounts }
 * parsedCounts uses parser-xlsx to get the actual rule counts.
 */
function inspectXlsx(filePath, contract) {
  let XLSX
  try {
    XLSX = require("xlsx")
  } catch (e) {
    throw new Error(`xlsx 包未安装，请运行: cd scripts/text-govern && npm install`)
  }

  const workbook = XLSX.readFile(filePath)
  if (!workbook.SheetNames.length) {
    throw new Error(`没有任何 Sheet`)
  }

  // Check sheet name matches expected keywords
  const sheetName = workbook.SheetNames[0]
  const sheetNorm = normalizeStr(sheetName)
  const sheetOk = contract.sheetKeywords.some((kw) => sheetNorm.includes(normalizeStr(kw)))
  if (!sheetOk) {
    throw new Error(
      `Sheet 名 "${sheetName}" 不符合契约（期望包含: ${contract.sheetKeywords.join("/")}）。` +
        `\n  这通常是 AI 生成了错误格式的文件（如词频统计表）。请重新运行 /text-govern-rules。`
    )
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
  if (!rows.length || !rows[0].length) {
    throw new Error(`Sheet "${sheetName}" 为空或缺少表头行`)
  }

  const headers = rows[0].map((h) => String(h || "").trim())
  const headersNorm = headers.map(normalizeStr)

  // Check at least one required header alias is present
  const headerOk = contract.requiredHeaderAliases.some((alias) =>
    headersNorm.includes(normalizeStr(alias))
  )
  if (!headerOk) {
    throw new Error(
      `表头不符合契约。\n  当前表头: [${headers.join(", ")}]\n  期望包含: [${contract.requiredHeaderAliases.join(" / ")}]\n  请确认列名与 README.md 一致。`
    )
  }

  // Use the real parser to get actual rule counts
  let parsedCounts = { banned: 0, terminology: 0, semantic: 0 }
  try {
    const { parseXlsxRules } = require("../rules/parser-xlsx")
    const parsed = parseXlsxRules(filePath)
    parsedCounts = {
      banned: parsed.banned.length,
      terminology: parsed.terminology.length,
      semantic: parsed.semantic.length,
    }
  } catch (e) {
    // Parser error is non-fatal for verify; shape is already OK at this point
  }

  return { sheetName, headers, parsedCounts }
}

async function run(opts = {}) {
  const config = loadConfig(opts)
  const generatedDir = opts.dir
    ? path.resolve(opts.cwd || process.cwd(), opts.dir)
    : config.builtinRules.dir

  const cwd = opts.cwd || process.cwd()

  console.log("")
  logger.info(`校验目录: ${path.relative(cwd, generatedDir)}`)
  console.log("─".repeat(60))

  const results = []
  let passed = 0
  let failed = 0

  // Check README.xlsx must NOT exist
  const forbiddenReadme = path.join(generatedDir, "README.xlsx")
  if (fs.existsSync(forbiddenReadme)) {
    results.push({ ok: false, item: "README.xlsx 不应存在", detail: "README 必须是 Markdown 格式，不得使用 Excel" })
    failed++
  } else {
    results.push({ ok: true, item: "README.xlsx 不存在 (正确)" })
    passed++
  }

  // Check README.md must exist
  const readmePath = path.join(generatedDir, "README.md")
  if (!fs.existsSync(readmePath)) {
    results.push({ ok: false, item: "README.md 存在", detail: "文件缺失，请重新运行 /text-govern-rules" })
    failed++
  } else {
    results.push({ ok: true, item: "README.md 存在" })
    passed++
  }

  // Validate each xlsx
  const totalCounts = { banned: 0, terminology: 0, semantic: 0 }
  for (const contract of FILE_CONTRACT) {
    const filePath = path.join(generatedDir, contract.file)
    if (!fs.existsSync(filePath)) {
      results.push({
        ok: false,
        item: `${contract.file} 存在`,
        detail: "文件缺失，请重新运行 /text-govern-rules",
      })
      failed++
      continue
    }

    try {
      const { sheetName, headers, parsedCounts } = inspectXlsx(filePath, contract)
      totalCounts.banned += parsedCounts.banned
      totalCounts.terminology += parsedCounts.terminology
      totalCounts.semantic += parsedCounts.semantic

      const dataRows = parsedCounts[contract.type]
      results.push({
        ok: true,
        item: `${contract.file} 格式正确`,
        detail: `Sheet="${sheetName}" | 表头=[${headers.slice(0, 4).join(", ")}${headers.length > 4 ? "..." : ""}] | 已解析 ${dataRows} 条规则`,
      })
      passed++
    } catch (e) {
      results.push({ ok: false, item: `${contract.file} 格式校验`, detail: e.message })
      failed++
    }
  }

  // Total rules >= 1
  const totalRules = totalCounts.banned + totalCounts.terminology + totalCounts.semantic
  if (totalRules === 0) {
    results.push({
      ok: false,
      item: "规则包非空",
      detail: "三个 xlsx 均为空，未解析到任何规则。请确认 AI 已按 6 维度填写内容，而非生成了空表。",
    })
    failed++
  } else {
    results.push({
      ok: true,
      item: "规则包非空",
      detail: `共 ${totalRules} 条（banned ${totalCounts.banned} / 术语 ${totalCounts.terminology} / 语义 ${totalCounts.semantic}）`,
    })
    passed++
  }

  // Print results
  for (const r of results) {
    const tag = r.ok ? chalk.green("[OK]  ") : chalk.red("[FAIL]")
    const detail = r.detail ? `  → ${r.detail}` : ""
    console.log(`  ${tag} ${r.item}${detail}`)
  }

  console.log("─".repeat(60))

  if (failed > 0) {
    logger.error(
      `严格契约校验失败：${failed} 项不通过 / ${passed + failed} 项检查。` +
        `\n请修正后重新运行 /text-govern-rules，不得向用户汇报"完成"。`
    )
    process.exit(1)
  } else {
    logger.success(
      `严格契约校验通过：banned ${totalCounts.banned} 条 / 术语 ${totalCounts.terminology} 条 / 语义 ${totalCounts.semantic} 条`
    )
    console.log("")
  }
}

module.exports = { run }
