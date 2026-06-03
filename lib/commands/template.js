'use strict';

const path = require('path');
const fs = require('fs');
const { loadConfig } = require('../config');
const logger = require('../logger');

const MD_BANNED = `# 自定义违禁/违规词规则
# 说明：本文件为高优先级，会覆盖 AI 生成的同名规则。
# 风险等级、分类均由业务自定义填写中文，例如：严重违禁 / 高风险 / 推荐修改；行业合规（按系统类型自定义子类）/ 品牌一致性。
# 默认模板不提供样例数据，避免生成和当前系统无关的规则。

| 词 | 替换建议 | 风险等级 | 分类 | 法规来源 | 备注 |
|---|---|---|---|---|---|
`;

const MD_TERMINOLOGY = `# 术语统一规则
# 说明：填写系统内统一的标准词及其所有别名（逗号分隔）。
# 工具会检测同一系统内出现了多个别名的情况并预警。

| 标准词 | 别名（逗号分隔） | 备注 |
|---|---|---|
`;

const MD_SEMANTIC = `# 业务语义映射规则
# 说明：指定某些页面/路径下字段的业务含义，禁止使用语义歧义词。
# 页面/路径 glob 使用 micromatch 语法，如 **/integral/**

| 页面/路径 glob | 字段含义 | 禁用替代词 | 推荐词 |
|---|---|---|---|
`;

function generateMarkdownTemplates(customDir) {
  const files = [
    { name: 'banned.md', content: MD_BANNED },
    { name: 'terminology.md', content: MD_TERMINOLOGY },
    { name: 'semantic.md', content: MD_SEMANTIC },
  ];

  for (const { name, content } of files) {
    const filePath = path.join(customDir, name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, 'utf8');
      logger.success(`已生成模板: ${filePath}`);
    } else {
      logger.dim(`跳过（已存在）: ${filePath}`);
    }
  }
}

function buildReadmeMarkdown(config, scope) {
  const industry = (config.industry || '').trim();
  const industryLine = industry
    ? `- 行业/业务类型（来自 \`text-govern.config.js\` 的 \`industry\` 字段）：**${industry}**`
    : '- 行业/业务类型未配置：由 Cursor AI 在初始化规则库时结合源码、路由、业务文案自行判断';

  if (scope === 'generated') {
    return `# AI 生成的规则包

本目录下的 Excel 由 Cursor Agent 在「初始化规则库」时根据当前项目源码、路由、文案生成。

${industryLine}

## 文件说明

| 文件 | Sheet | 用途 |
|------|-------|------|
| \`banned.xlsx\` | 违禁违规词 | 当前系统真实可能出现的违禁/违规/敏感词 |
| \`terminology.xlsx\` | 术语统一 | 系统内部应统一的标准词与别名映射 |
| \`semantic.xlsx\` | 业务语义 | 页面/路径与字段含义的强相关映射，预防同字段多种表达 |
| \`README.md\` | — | 当前规则包的生成依据、版本与维护说明（请保持纸面易读） |

## 字段说明

### banned.xlsx · 违禁违规词

| 列 | 取值约束 |
|----|----------|
| 词 | 必填，命中即触发规则匹配 |
| 替换建议 | 推荐的合规/合理替换词；可为空 |
| 风险等级 | 中文自由值，推荐：严重违禁 / 高风险 / 需关注 / 推荐修改 |
| 分类 | 中文自由值，按项目行业与适用法规自定义（例如：医疗合规 / 金融合规 / 教育合规 / 政治敏感 / 地域歧视 / 品牌一致性）|
| 法规来源 | 引用具体法规条款，无依据请留空，不要杜撰 |
| 备注 | 上下文、来源页面或维护说明 |

### terminology.xlsx · 术语统一

| 列 | 取值约束 |
|----|----------|
| 标准词 | 系统内部首选规范表达 |
| 别名（逗号分隔） | 实际源码中出现但应被收敛掉的同义/异写词 |
| 备注 | 选择标准词的理由、收敛策略 |

### semantic.xlsx · 业务语义

| 列 | 取值约束 |
|----|----------|
| 页面/路径 glob | micromatch 语法，例如 \`**/integral/**\` |
| 字段含义 | 该页面下字段的业务含义，例如：业绩 |
| 禁用替代词 | 与字段含义存在语义歧义、应避免出现的词 |
| 推荐词 | 推荐使用的规范词 |
| 备注 | 业务背景说明 |

## 维护建议

1. 优先由 Cursor Agent 通过「初始化规则库 / 更新规则库」生成或刷新，确保与最新源码强相关。
2. 业务/合规同学可直接打开 Excel 调整；保存即生效（下一次 \`text-govern analyze\` 会重新加载）。
3. 与 \`text-govern-rules/custom/\` 的关系：generated 优先级 < custom；custom 用于人工兜底/覆盖。
4. 不要在此目录手写一次性测试规则；测试规则请放在 custom/ 下并加上备注。
`;
  }

  return `# 自定义规则

本目录用于沉淀**业务/合规/产品** 同学手工维护的规则，优先级最高，会覆盖 \`text-govern-rules/generated/\` 中 AI 生成的同名规则。

${industryLine}

## 文件说明

| 文件 | Sheet | 用途 |
|------|-------|------|
| \`banned.xlsx\` | 违禁违规词 | 项目专属违禁/合规/品牌红线词 |
| \`terminology.xlsx\` | 术语统一 | 项目内部已经达成共识的标准词与别名映射 |
| \`semantic.xlsx\` | 业务语义 | 页面/路径与字段含义映射，处理同字段多种表达 |
| \`README.md\` | — | 维护说明（本文件） |

## 字段说明

### banned.xlsx · 违禁违规词

| 列 | 取值约束 |
|----|----------|
| 词 | 必填，命中即触发规则匹配 |
| 替换建议 | 推荐替换词；可为空 |
| 风险等级 | 中文自由值，推荐：严重违禁 / 高风险 / 需关注 / 推荐修改 |
| 分类 | 中文自由值，按项目行业与业务语境自定义（例如：行业合规子类 / 品牌红线 / 客服话术 / 客户称谓）|
| 法规来源 | 无依据请留空 |
| 备注 | 上下文、出现页面、维护人等 |

### terminology.xlsx · 术语统一

| 列 | 取值约束 |
|----|----------|
| 标准词 | 项目内部规范词 |
| 别名（逗号分隔） | 应该被收敛的写法 |
| 备注 | 决策依据 |

### semantic.xlsx · 业务语义

| 列 | 取值约束 |
|----|----------|
| 页面/路径 glob | 例如 \`**/integral/**\` |
| 字段含义 | 例如：业绩 |
| 禁用替代词 | 例如：积分 |
| 推荐词 | 例如：业绩 |
| 备注 | 业务背景 |

## 维护建议

1. 自定义规则会覆盖同名 AI 生成规则，请谨慎填写。
2. \`风险等级\` 和 \`分类\` 允许使用任意中文自定义值，HTML 报告会原样展示。
3. 不需要的列可以留空，但请保留表头。
4. 保存 Excel 后下一次 \`text-govern analyze\` 即生效；无需重启或重新初始化。
`;
}

function generateXlsxTemplates(customDir, config) {
  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch (e) {
    logger.warn('xlsx 包未安装，跳过 Excel 模板生成。请在 scripts/text-govern 目录运行 npm install。');
    return;
  }

  const sheets = [
    {
      name: 'banned.xlsx',
      sheetName: '违禁违规词',
      data: [
        ['词', '替换建议', '风险等级', '分类', '法规来源', '备注'],
      ],
    },
    {
      name: 'terminology.xlsx',
      sheetName: '术语统一',
      data: [
        ['标准词', '别名（逗号分隔）', '备注'],
      ],
    },
    {
      name: 'semantic.xlsx',
      sheetName: '业务语义',
      data: [
        ['页面/路径 glob', '字段含义', '禁用替代词', '推荐词', '备注'],
      ],
    },
  ];

  for (const { name, sheetName, data } of sheets) {
    const filePath = path.join(customDir, name);
    if (!fs.existsSync(filePath)) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, filePath);
      logger.success(`已生成模板: ${filePath}`);
    } else {
      logger.dim(`跳过（已存在）: ${filePath}`);
    }
  }

  const readmePath = path.join(customDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, buildReadmeMarkdown(config || {}, 'custom'), 'utf8');
    logger.success(`已生成模板: ${readmePath}`);
  } else {
    logger.dim(`跳过（已存在）: ${readmePath}`);
  }
}

async function run(opts = {}) {
  const config = loadConfig(opts);
  const customDir = config.customRules.dir;
  fs.mkdirSync(customDir, { recursive: true });

  const genMd = Boolean(opts.md);
  const genXlsx = !opts.md;

  if (genMd) {
    logger.step(1, 2, '生成 Markdown 模板...');
    generateMarkdownTemplates(customDir);
  }

  if (genXlsx) {
    logger.step(1, 1, '生成 Excel 模板...');
    generateXlsxTemplates(customDir, config);
  }

  logger.success(`\n模板已就绪，请编辑以下目录中的文件填入规则：\n  ${customDir}`);
  logger.info('提示：编辑后无需重新运行 init，下次 analyze 时会自动加载。');
}

module.exports = { run, buildReadmeMarkdown };
