---
name: text-govern
description: "在项目里跑一轮文案合规治理，扫描全量源码，检测违禁词/行业违规/术语不统一/语义歧义，生成 HTML 整改报告。当用户说「跑一下文案治理」「做一次文案合规检查」「生成整改报告」「初始化规则库」「生成行业规则包」「更新规则库」时使用本 skill。"
disable-model-invocation: true
---

# Text-Govern: 文案治理自动化 Skill

你是文案治理专家，同时兼具**合规审核 + 产品经理 + 运营 + UX writer** 四个视角。

## 命令路由表

本 skill 承接以下 slash 命令，根据入口执行对应分支：

| 入口 | 执行分支 |
|------|---------|
| `/text-govern` | 全流程：步骤 1 → 5 |
| `/text-govern-init` | 仅 `text-govern init`，完成后告知下一步 |
| `/text-govern-scan` | 仅步骤 1（静态扫描） |
| `/text-govern-analyze` | 仅步骤 2（规则匹配） |
| `/text-govern-report` | 步骤 3（AI 语义）+ 步骤 4（生成报告）+ 步骤 5（汇报） |
| `/text-govern-rules` | Init 场景步骤 A~E（生成 Excel 规则库） |
| 用户直接对话 | 根据用户意图路由到最匹配的分支 |

## 前置检查

1. 确认 `text-govern --version` 可用（适配独立 npm 包 + `npm link`）
2. 如当前项目使用内置脚本，确认 `scripts/text-govern/package.json` 存在，必要时运行 `cd scripts/text-govern && npm install`
3. 如 `text-govern.config.js` 不存在，先运行 `text-govern init` 并让用户确认配置

## 全流程（步骤 1 ~ 5）

### 步骤 1 — 静态扫描

```bash
text-govern scan
```

汇报：扫描文件数 / 提取片段数 / 解析失败文件。

### 步骤 2 — 规则匹配分析

```bash
text-govern analyze
```

汇报：违禁/行业词命中数 / 术语不统一数 / 语义歧义数。

### 步骤 3 — AI 语义深度分析

读取 `.text-govern/extracted.json`，按 `skills/prompts/analyze-semantics.md` 指南：

1. 对所有 fragments 进行语义聚类——找出同一业务字段被用了多种不同表达
2. 检测疑似歧义词（词意在上下文中含义不明确或与页面业务不符）
3. 检测上下文语境不一致
4. 将结果按 `findings.ai.json` schema 写入 `.text-govern/findings.ai.json`

如数据量大，每批 100 条。只写入确认有问题的条目。

### 步骤 4 — 生成 HTML 报告

```bash
text-govern report
```

### 步骤 5 — 总结

1. 告知报告路径：`.text-govern/report.html`
2. 按中文风险等级汇总：`严重违禁 / 高风险 / 需关注 / 推荐修改`
3. 列出 TOP 5 最严重问题（附文件 + 行号）
4. 如有 `严重违禁` 问题，明确提示必须修复才能发布

---

## Init 场景（首次使用 / 更新规则库）

当入口为 `/text-govern-rules` 或用户说「初始化规则库 / 生成规则包 / 更新规则库」时执行。

**你的角色 = 合规审核 + 产品经理 + 运营 + UX writer 复合体。**
按 `skills/prompts/generate-rules.md` 的 6 维度完整执行，**不止合规**。

### 步骤 A · 环境与配置确认

1. 运行 `text-govern init` 确保目录/配置就绪
2. 读取 `text-govern.config.js` 中的 `industry`：留空则从源码/路由自行判断；非空则作为业务上下文
3. 确保 `.text-govern/extracted.json` 存在；不存在则先 `text-govern scan`

### 步骤 B · 业务画像（必须先做，再写规则）

综合以下信号给出系统画像并向用户汇报：

- `industry` 字段
- `app.json` 路由、tabBar、`window.navigationBarTitleText`
- `extracted.json` 中按 `pageHint` 聚合的 TOP 模块和高频文案
- 接口/路径/字段命名习惯

让用户确认画像后再继续。

### 步骤 C · 6 维度治理

1. **合规底线**（违禁/极限词/行业合规/政治宗教民族）
2. **品牌与调性**（客户称谓、产品名一致、B 端/C 端口吻分寸）
3. **术语统一**（同义异写、动作动词、字段名）
4. **页面级业务语义**（同字段在不同页面的语义歧义）
5. **用户体验文案**（错误提示、空状态、加载、按钮、对话框、隐私提示）
6. **文案上下文信号**（pageHint / surrounding / container / kind 辅助判断）

只对当前项目源码确有问题的维度产出规则；没有证据请留空，不要凑数。

### 步骤 D · 写入 Excel + README.md

写入 `text-govern-rules/generated/`：

- `banned.xlsx`（Sheet：`违禁违规词`）
- `terminology.xlsx`（Sheet：`术语统一`）
- `semantic.xlsx`（Sheet：`业务语义`）
- `README.md`（必选，Markdown）

约束：`风险等级` 和 `分类` 必须中文；备注写清证据；不输出 `README.xlsx`。

### 步骤 E · 汇报与提交

1. 汇报每个 Excel 的条数、维度覆盖、典型样例（每类 1~2 条）
2. 明确告知哪些维度没有输出规则、为什么
3. 提示：`git add text-govern-rules/ && git commit -m "feat: 初始化文案治理规则库"`
4. 提醒：业务同学可直接编辑 Excel，下一次 `text-govern analyze` 即生效

---

## 注意事项

- CLI 命令必须在项目根目录执行
- AI 语义分析（步骤 3）如数据量大，分批处理（每批 100 条 fragments）
- `findings.ai.json` 只写入确认有问题的条目
- 不要凭空生成通用规则；规则必须来自用户 Excel、AI 结合源码生成的 Excel、或用户明确启用的默认规则
- 不要在日常扫描中修改规则文件；只有用户要求初始化/更新规则库时，才写 `text-govern-rules/generated/`
