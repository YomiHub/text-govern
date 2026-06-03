#!/usr/bin/env node
'use strict';

/**
 * 生成内置默认规则的 Excel 文件，作为 lib/rules/defaults.js 的数据源。
 *
 * 维护方式：
 *   banned.default.xlsx  — 由 scripts/fetch-public-baseline.js 从公开开源词库生成，
 *                          不在此处硬编码，请勿手动添加违禁词列表。
 *   terminology.default.xlsx — 通用 UI 文案术语统一，在此处手动维护。
 *   semantic.default.xlsx    — 业务语义高度项目相关，默认留空。
 *
 * 日常运行：
 *   npm run build:defaults
 *   （即 npm run fetch:baseline && node scripts/build-default-rules.js）
 *
 * 仅刷新术语/语义：
 *   node scripts/text-govern/scripts/build-default-rules.js
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const BANNED_XLSX = path.join(CONFIG_DIR, 'banned.default.xlsx');

// ── 术语统一（手动维护，适用于通用 UI 文案）──────────────────────────────────

const TERMINOLOGY_HEADERS = ['标准词', '别名（逗号分隔）', '备注'];

const TERMINOLOGY_ROWS = [
  ['订单编号', '订单编码,订单号,单号', '全系统订单标识统一为"订单编号"'],
  ['用户名', '账号名称,登录名,用户账号,账号', '账户标识统一为"用户名"'],
  ['手机号', '手机号码,联系电话,电话号码,电话', '手机号字段统一'],
  ['密码', '登陆密码,口令', '系统认证字段统一'],
  ['登录', '登陆', '动作统一为"登录"'],
  ['提交', '确认提交,保存提交', '按钮文字统一'],
  ['取消', '放弃,不了,我再想想', '按钮文字统一'],
  ['确认', '确定,好的,OK,知道了,我知道了', '正向确认按钮统一为"确认"'],
  ['请稍候', '请稍等,请等待,稍后,稍等', '加载提示统一'],
  ['加载中', '玩命加载中,马上来,稍候', '加载提示统一'],
  ['暂无数据', '空空如也,什么都没有,木有数据', '空状态文案统一'],
  ['网络异常', '网络开小差了,网络不给力', '错误提示统一'],
  ['加载失败', '加载出错,获取失败,加载错误', '错误提示统一'],
  ['更多', '查看更多,更多内容,展开更多', '入口文案统一'],
];

// ── 业务语义（默认留空，由 AI 按项目生成到 text-govern-rules/generated/）──────

const SEMANTIC_HEADERS = ['页面/路径 glob', '字段含义', '禁用替代词', '推荐词', '备注'];
const SEMANTIC_ROWS = [];

// ── README ──────────────────────────────────────────────────────────────────

const README_MD = `# 内置默认规则（Built-in Defaults）

本目录是 \`text-govern\` CLI 在 \`text-govern.config.js\` 中设置 \`rules.includeDefaults = true\` 时
加载的内置规则数据源。

## 文件清单

| 文件 | Sheet | 用途 |
|------|-------|------|
| \`banned.default.xlsx\` | 违禁违规词 | 基于公开开源词库（konsheng/Sensitive-lexicon MIT + fwwdn/sensitive-stop-words Apache-2.0），构建期拉取生成 |
| \`terminology.default.xlsx\` | 术语统一 | 通用 UI 文案术语统一（按钮、空状态、错误提示等），手动维护 |
| \`semantic.default.xlsx\` | 业务语义 | 默认留空——业务语义高度项目相关，建议由 AI 在 \`text-govern-rules/\` 中维护 |
| \`THIRD_PARTY_NOTICES.md\` | — | 三方词库许可声明与锁定的 commit SHA |

## 词库来源

\`banned.default.xlsx\` 由 \`scripts/fetch-public-baseline.js\` 构建期拉取生成，词库涵盖：

| 分类 | 风险等级 | 来源 |
|------|----------|------|
| 色情违规 | 严重违禁 | konsheng/Sensitive-lexicon |
| 政治敏感 | 严重违禁 | konsheng/Sensitive-lexicon |
| 暴恐违禁 | 严重违禁 | konsheng/Sensitive-lexicon |
| 涉枪涉爆 | 严重违禁 | konsheng/Sensitive-lexicon |
| 广告违规 | 高风险 | konsheng/Sensitive-lexicon + fwwdn/sensitive-stop-words |

**有意不覆盖（请通过 AI 生成或手动 custom 维护）**：
- 行业专有合规词（绝对化用语、功效宣称、保本承诺等，适用范围因行业而异）— 由 AI 结合项目落地形态与适用法规生成
- 金融合规（资管新规保本/保收益）— 行业强相关
- 医疗合规（治愈/根治等）— 行业强相关
- 教育合规、食品合规等——同上

## 刷新词库

词库版本锁定于指定 commit SHA（见 \`THIRD_PARTY_NOTICES.md\`）。如需同步上游更新：

\`\`\`bash
cd scripts/text-govern
npm run fetch:baseline   # 需要网络，重新拉取并覆盖 banned.default.xlsx
\`\`\`

## 启用方式

在业务项目根目录的 \`text-govern.config.js\` 中：

\`\`\`js
module.exports = {
  rules: { includeDefaults: true },
};
\`\`\`

默认 \`includeDefaults: false\`，避免基线规则干扰纯项目扫描。
`;

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function writeSheet(filePath, sheetName, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filePath);
  console.log(`written: ${path.relative(process.cwd(), filePath)} (${rows.length - 1} rules)`);
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

function main() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  // banned.default.xlsx is owned by fetch-public-baseline.js.
  // We only validate it exists and report, never overwrite it here.
  if (!fs.existsSync(BANNED_XLSX)) {
    console.error(
      '错误：config/banned.default.xlsx 不存在。\n' +
      '请先运行: npm run fetch:baseline\n' +
      '（需要网络连接，从公开开源词库拉取并生成该文件）'
    );
    process.exit(1);
  }

  const XLSX_lib = require('xlsx');
  const wb = XLSX_lib.readFile(BANNED_XLSX);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX_lib.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  console.log(
    `skip:    ${path.relative(process.cwd(), BANNED_XLSX)} (${rows.length - 1} rules, 由 fetch:baseline 管理)`
  );

  writeSheet(
    path.join(CONFIG_DIR, 'terminology.default.xlsx'),
    '术语统一',
    [TERMINOLOGY_HEADERS, ...TERMINOLOGY_ROWS]
  );
  writeSheet(
    path.join(CONFIG_DIR, 'semantic.default.xlsx'),
    '业务语义',
    [SEMANTIC_HEADERS, ...SEMANTIC_ROWS]
  );

  fs.writeFileSync(path.join(CONFIG_DIR, 'README.md'), README_MD, 'utf8');
  console.log(`written: ${path.relative(process.cwd(), path.join(CONFIG_DIR, 'README.md'))}`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
