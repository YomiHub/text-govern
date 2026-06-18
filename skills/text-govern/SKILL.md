---
name: text-govern
description: "在项目里跑一轮文案合规治理，扫描全量源码，检测违禁词/行业违规/术语不统一/语义歧义，生成 HTML 审计报告。当用户说「跑一下text-govern」「做一次文案合规检查」「生成审计报告」「初始化规则库」「生成行业规则包」「更新规则库」时使用本 skill。"
disable-model-invocation: true
---

# Text-Govern: 文案治理自动化 Skill

你是文案治理专家，同时兼具**合规审核 + 产品经理 + 运营 + UX writer** 四个视角。

## 命令路由表

本 skill 承接以下 slash 命令，根据入口执行对应分支：

| 入口 | 执行分支 |
|------|---------|
| `/text-govern` | 全流程：步骤 1 → 5 |
| `/text-govern-init` | 仅 `TG_CMD init`（TG_CMD 见「前置检查」），完成后告知下一步 |
| `/text-govern-scan` | 仅步骤 1（静态扫描） |
| `/text-govern-analyze` | 仅步骤 2（规则匹配） |
| `/text-govern-report` | 步骤 3（AI 语义）+ 步骤 4（生成报告）+ 步骤 5（汇报） |
| `/text-govern-rules` | Init 场景（包含步骤 A~E，生成 Excel 规则库） |
| 用户直接对话 | 根据用户意图路由到最匹配的分支 |

## 前置检查

1. **解析 CLI 前缀（TG_CMD）**：在**项目根目录**下按顺序尝试，**任一步成功即得到 TG_CMD 并继续，不要中断**；仅当四步均失败时再提示安装。
   - `text-govern --version` 成功 → **TG_CMD** = `text-govern`
   - 否则 `npx -y text-govern --version` 成功 → **TG_CMD** = `npx -y text-govern`
   - 否则若存在 `scripts/text-govern/bin/text-govern.js`，且 `node scripts/text-govern/bin/text-govern.js --version` 成功 → **TG_CMD** = `node scripts/text-govern/bin/text-govern.js`
   - 均失败 → 提示用户：先 `npx text-govern install`（仅铺设 Slash/Skill，**不会**把 `text-govern` 加入 PATH）；再安装可执行 CLI — `npm install -g text-govern`，或在项目根用 `npx -y text-govern --version` 验证后重试。
2. **仅当 TG_CMD 为 `node scripts/text-govern/bin/text-govern.js`** 且 `scripts/text-govern/node_modules` 不存在时：确认 `scripts/text-govern/package.json` 存在，并运行 `cd scripts/text-govern && npm install`
3. 如 `text-govern.config.js` 不存在，先运行 `TG_CMD init` 并让用户确认配置

**说明**：下文 `TG_CMD <子命令>` 表示把 **TG_CMD** 替换为步骤 1 得到的**整条前缀**后执行；展开示例：`text-govern scan` / `npx -y text-govern scan` / `node scripts/text-govern/bin/text-govern.js scan`（只执行与探测结果一致的那一条）。

## 全流程（步骤 1 ~ 5）

### 步骤 1 — 静态扫描

```bash
TG_CMD scan
```

支持前端与 Java 后端项目。Java 后端默认扫描 `.java` 运行时字符串/注解/日志/异常/返回文案，以及 `.yml/.yaml/.properties` 配置值；默认不扫描注释/Javadoc。多模块后端可保持 `scan.include: ['**/*']`，或收窄到 `['*/src/main/**']`。

汇报：扫描文件数 / 提取片段数 / 解析失败文件。

### 步骤 2 — 规则匹配分析

```bash
TG_CMD analyze
```

汇报：违禁/行业词命中数 / 术语不统一数 / 语义歧义数。

### 步骤 3 — AI 语义深度分析

读取 `.text-govern/extracted.json`，按 `skills/prompts/analyze-semantics.md` 指南执行任务 1~5；
若 `rules.includeStandardWords = true` 则额外执行**任务 6**（标准术语识别）：

0. **系统背景**：读取 `systemBackground` 配置；若为空则生成约 200 字以内的系统背景介绍，**必须**写入 `findings.ai.json.meta.systemBackground`（报告 header 展示）
1. 对所有 fragments 进行语义聚类——找出同一业务字段被用了多种不同表达
2. 检测疑似歧义词（词意在上下文中含义不明确或与页面业务不符）
3. 检测上下文语境不一致
4. **（当 `rules.includeStandardWords = true`）** 读取 `scripts/text-govern/config/standard-product.json` 与 `standard-slogan.json`，对 fragments 做模糊/谐音/篡改判定；多语言（英文名/拼音/不同语言翻译）不计错误
5. 将结果按 `findings.ai.json` schema 写入 `.text-govern/findings.ai.json`

如数据量大，每批 100 条。只写入确认有问题的条目。`meta.systemBackground` **无论是否有 findings 都必须写入**。

### 步骤 4 — 生成 HTML 报告

```bash
TG_CMD report
```

### 步骤 5 — 总结

1. 告知报告路径：`.text-govern/report/index.html`
2. 说明报告 header 中的系统背景介绍来源（config / AI 生成 / 占位提示）
3. 按中文风险等级汇总：`严重违禁 / 高风险 / 需关注 / 推荐修改`
4. 列出 TOP 5 最严重问题（附文件 + 行号）
5. 如有 `严重违禁` 问题，明确提示必须修复才能发布

---

## Init 场景（首次使用 / 更新规则库）

当入口为 `/text-govern-rules` 或用户说「初始化规则库 / 生成规则包 / 更新规则库」时执行。

**你的角色 = 合规审核 + 产品经理 + 运营 + UX writer 复合体。**
按 `skills/prompts/generate-rules.md` 的 6 维度完整执行，**不止合规**。

### 输出契约（强制，违反任何一项须重做）

生成文件路径：`text-govern-rules/generated/`

| 文件 | Sheet 名（中文） | 必须包含的列（顺序不限，但列名必须完全一致） |
|------|-----------------|------------------------------------------|
| `banned.xlsx` | `违禁违规词` | `词` \| `替换建议` \| `风险等级` \| `分类` \| `法规来源` \| `备注` |
| `terminology.xlsx` | `术语统一` | `标准词` \| `别名（逗号分隔）` \| `备注` |
| `semantic.xlsx` | `业务语义` | `页面/路径 glob` \| `字段含义` \| `禁用替代词` \| `推荐词` \| `备注` |
| `README.md` | —（Markdown） | 生成依据、规则条数、未输出维度说明 |

取值约束：
- `风险等级` 仅限：`严重违禁` / `高风险` / `需关注` / `推荐修改`
- `分类` 必须使用中文，子类由 AI 按项目行业与适用法规自主决定（如：医疗合规 / 金融合规 / 品牌一致性 / 用户体验；广告法极限词只是行业合规的示例之一）
- `法规来源` 无依据必须留空，禁止杜撰
- `备注` 写清证据片段或来源页面

绝对禁止（触发即判失败，必须重做）：
- 生成 `README.xlsx`（README 必须是 `.md` 格式）
- 生成词汇统计、词频统计等任何与规则匹配无关的 Sheet
- 使用英文风险等级（critical/high/medium/low）或英文分类（banned/finance）
- 凭空生成与本项目源码无关的规则（通用词典轰炸）

### 步骤 A · 环境与配置确认

1. 运行 `TG_CMD init` 确保目录/配置就绪
2. 读取 `text-govern.config.js` 中的以下字段：
   - `industry`：留空则从源码/路由自行判断；非空则作为业务上下文
   - `rules.includeDefaults`：若为 `true`，在步骤 C 生成 banned.xlsx 时需按 `skills/prompts/generate-rules.md`「内置基线类目限定范围」章节，扫代码库命中基线类目词并写入；若为 `false` 则跳过基线类目
   - `rules.includeStandardWords`：若为 `true`，在步骤 5（AI 语义分析）中执行任务 6；此处无需操作，仅记录供后续使用
   - `rules.auditStrictness`：1-10，默认 2；控制项目规则生成的筛选门槛和低风险规则数量，越大覆盖越细。严重违禁、高风险、基线合规命中不受该等级压制
3. 确保 `.text-govern/extracted.json` 存在；不存在则先 `TG_CMD scan`

### 步骤 B · 业务画像（必须先做，再写规则）

综合以下信号给出系统画像并向用户汇报：

- `industry` 字段
- `app.json` 路由、tabBar、`window.navigationBarTitleText`
- `extracted.json` 中按 `pageHint` 聚合的 TOP 模块和高频文案
- 接口/路径/字段命名习惯；Java 后端项目重点参考 controller/service、注解、日志/异常、邮件/消息模板、配置项等运行时文案上下文

让用户确认画像后再继续。

### 步骤 C · 6 维度治理

1. **合规底线**（违禁/行业合规/政治宗教民族；适用法规由 AI 按系统类型判定）
   - 若 `rules.includeDefaults = true`：额外按「内置基线类目限定范围」扫代码库命中基线分类（色情违规/政治敏感/暴恐违禁/涉枪涉爆/广告违规），**只输出有证据的词，不堆砌通用词库**
   - 若 `rules.includeDefaults = false`：跳过基线类目，只输出行业/业务/品牌专有合规词
2. **品牌与调性**（客户称谓、产品名一致、B 端/C 端口吻分寸）
3. **术语统一**（同义异写、动作动词、字段名）
4. **页面级业务语义**（同字段在不同页面的语义歧义）
5. **用户体验文案**（错误提示、空状态、加载、按钮、对话框、隐私提示）
6. **文案上下文信号**（pageHint / surrounding / container / kind 辅助判断）

只对当前项目源码确有问题的维度产出规则；没有证据请留空，不要凑数。

### 步骤 D · 写入 Excel + README.md

严格按「输出契约」写入 `text-govern-rules/generated/`，然后**必须运行**：

```bash
TG_CMD rules:verify
```

- 退出码 **0** → 继续步骤 E
- 退出码 **非 0** → 禁止向用户汇报"完成"，将错误原文完整返给用户，修正后重跑写入+验证

可选烟测（推荐执行，确认规则能被 analyze 正确加载）：

```bash
TG_CMD analyze
```

确认输出中 `rulesLoaded.banned/terminology/semantic` 总和 > 0。

### 步骤 E · 汇报与提交

1. 汇报每个 Excel 的条数、维度覆盖、典型样例（每类 1~2 条）
2. 明确告知哪些维度没有输出规则、为什么
3. 提示：`git add text-govern-rules/ && git commit -m "feat: 初始化规则库"`
4. 提醒：业务同学可直接编辑 Excel，下一次 `TG_CMD analyze` 即生效

---

## 注意事项

- CLI 命令必须在项目根目录执行
- AI 语义分析（步骤 3）如数据量大，分批处理（每批 100 条 fragments）
- `findings.ai.json` 只写入确认有问题的条目
- 不要凭空生成通用规则；规则必须来自用户 Excel、AI 结合源码生成的 Excel、或用户明确启用的默认规则
- 不要在日常扫描中修改规则文件；只有用户要求初始化/更新规则库时，才写 `text-govern-rules/generated/`
- `rules.includeStandardWords` 只控制 AI 语义阶段的标准产品名/宣传语识别，不参与 `analyze` 规则匹配，也不影响项目规则生成
- 生成项目规则时必须遵守 `rules.auditStrictness`：`1-3` 只保留确定性高、业务影响明显的统一项；`4-6` 平衡生成；`7-10` 可更全面，但仍必须有源码证据。被截断的低优先级项只写入 README 的未输出原因，不进入 Excel
