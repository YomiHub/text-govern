#!/usr/bin/env node
'use strict';

/**
 * 生成内置默认规则的 Excel 文件。
 *
 * 维护方式：
 *   terminology.default.xlsx — 通用 UI 文案术语统一，在此处手动维护。
 *   semantic.default.xlsx    — 业务语义高度项目相关，默认留空。
 *
 * 注：banned.default.xlsx 已不再存在。基线违禁词类目（色情/政治/暴恐/广告/涉枪涉爆）
 * 改由 AI 在 /text-govern-rules 阶段按项目证据按需生成，见
 * skills/prompts/generate-rules.md 中的「内置基线类目限定范围」章节。
 *
 * 日常运行：
 *   npm run build:defaults
 *   （即 node scripts/build-default-rules.js）
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const CONFIG_DIR = path.join(__dirname, '..', 'config');

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
| \`terminology.default.xlsx\` | 术语统一 | 通用 UI 文案术语统一（按钮、空状态、错误提示等），手动维护 |
| \`semantic.default.xlsx\` | 业务语义 | 默认留空——业务语义高度项目相关，建议由 AI 在 \`text-govern-rules/\` 中维护 |
| \`standard-product.xlsx\` | 产品名/宣传语 | 标准产品名称与宣传语，由 \`scripts/build-standard-rules.js\` 转换为 JSON 供 AI 语义阶段使用 |

## 基线违禁类目

\`banned.default.xlsx\` 已移除。当 \`rules.includeDefaults = true\` 时，AI 在
\`/text-govern-rules\` 阶段会按下列基线类目扫描代码库，仅将项目中**确有命中证据**的词写入
\`text-govern-rules/generated/banned.xlsx\`：

| 基线类目 | 参考词库范围 |
|----------|------------|
| 色情违规 | konsheng/Sensitive-lexicon 色情类型/色情词库 |
| 政治敏感 | konsheng/Sensitive-lexicon 政治类型/反动词库 |
| 暴恐违禁 | konsheng/Sensitive-lexicon 暴恐词库 |
| 涉枪涉爆 | konsheng/Sensitive-lexicon 涉枪涉爆 |
| 广告违规 | 违法广告极限词、医疗夸大、虚假宣传 |

这种方式避免了运行期加载数万条词汇的开销，同时让识别更贴近项目实际情况。

## 启用方式

在业务项目根目录的 \`text-govern.config.js\` 中：

\`\`\`js
module.exports = {
  rules: {
    // 开启后 /text-govern-rules 阶段 AI 按基线类目扫代码库写入 banned.xlsx
    includeDefaults: true,
    // 开启后 /text-govern-report AI 语义阶段识别标准产品名/宣传语非标准写法
    includeStandardWords: true,
  },
};
\`\`\`

默认均为 \`true\`；若只需项目 AI 生成 / 自定义规则，可在 \`text-govern.config.js\` 中设为 \`false\`。
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
