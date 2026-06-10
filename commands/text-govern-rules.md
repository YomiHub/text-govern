---
description: "完整执行 skills/text-govern/SKILL.md「Init 场景」全文（四角色、输出契约、skills/prompts/generate-rules.md 六维度与生成步骤、步骤 A~E 含 rules:verify 与可选 analyze），扫描项目源码生成强相关 Excel 规则库到 text-govern-rules/generated/。当用户说「生成规则库」「初始化规则」「更新规则包」「生成文案规则」时使用。"
---

# /text-govern-rules — AI 生成 Excel 规则库

严格按 `skills/text-govern/SKILL.md` **Init 场景步骤 A~E** 完整执行。本文档只列前置检查与硬约束。

## 前置检查（按顺序）

### 1. 解析 CLI 前缀（TG_CMD）


在**项目根目录**下按顺序尝试，**任一步成功即得到 TG_CMD 并继续，不要中断**；仅当四步均失败时再提示安装。

1. `text-govern --version` 成功 → **TG_CMD** = `text-govern`
2. 否则 `npx -y text-govern --version` 成功 → **TG_CMD** = `npx -y text-govern`
3. 否则若存在 `scripts/text-govern/bin/text-govern.js`，且 `node scripts/text-govern/bin/text-govern.js --version` 成功 → **TG_CMD** = `node scripts/text-govern/bin/text-govern.js`
4. 均失败 → 提示用户：先 `npx text-govern install`；再安装可执行 CLI（`npm install -g text-govern` 或 `npx -y text-govern --version` 验证后重试）。

**说明**：下文 `TG_CMD <子命令>` 表示把 TG_CMD 替换为以上探测结果后执行。

### 2. 配置文件

确认项目根存在 `text-govern.config.js`；不存在则先执行 `TG_CMD init`（或 `/text-govern-init`）。

### 3. 扫描产物

确认 `.text-govern/extracted.json` 存在；不存在则先运行 `TG_CMD scan`（或 `/text-govern-scan`）。

### 4. 读取开关并注入生成上下文

读取项目根 `text-govern.config.js` 中的以下字段，并将对应的 prompt 段落纳入规则生成上下文：

- **`rules.includeDefaults`**（默认 `true`）：
  - 若为 `true`：在生成 `banned.xlsx` 时，依照 `skills/prompts/generate-rules.md`「内置基线类目限定范围」章节，扫代码库命中项，将确有证据的词写入 banned.xlsx 对应基线分类（色情违规/政治敏感/暴恐违禁/涉枪涉爆/广告违规）。
  - 若为 `false`：完全跳过基线类目，项目 banned.xlsx 只含行业/业务/品牌专有合规词。
- **`rules.includeStandardWords`**（默认 `true`）：
  - 该开关影响的是 `/text-govern-report` AI 语义阶段（`analyze-semantics.md` 任务 6），此处无需额外操作；仅在汇报时提示用户如需启用标准产品名/宣传语识别请开启此开关。
- **`rules.auditStrictness`**（默认 `5`，范围 `1-10`）：
  - 控制本次项目规则生成的筛选门槛和低风险规则数量，越大覆盖越细。
  - `1-3`：只生成确定性高、业务影响明显的项目规则，显著收紧 terminology/semantic 与推荐修改类条目。
  - `4-6`：平衡模式，只生成有明确证据或明显业务歧义的统一项。
  - `7-10`：全面治理，允许更多术语、语义、体验类建议，但仍必须有源码证据。
  - 严重违禁、高风险、基线合规命中不受该等级压制。

## 执行

1. 按 SKILL.md **Init 场景** 完整执行，包含**步骤 A~E**（含业务画像确认、6 维度治理）。
2. 写入 `text-govern-rules/generated/` 后，**必须运行**：
   ```bash
   TG_CMD rules:verify
   ```
3. `rules:verify` 退出码 **0** 才算成功；**非 0** 时直接把完整错误原文返给用户，禁止伪报成功，修正后重跑。

## 成功判据（必须全部满足）

- `text-govern-rules/generated/banned.xlsx` 存在，Sheet 名含 `违禁/违规`，表头含 `词 | 替换建议 | 风险等级 | 分类 | 法规来源 | 备注`
- `text-govern-rules/generated/terminology.xlsx` 存在，Sheet 名含 `术语`，表头含 `标准词 | 别名（逗号分隔） | 备注`
- `text-govern-rules/generated/semantic.xlsx` 存在，Sheet 名含 `语义`，表头含 `页面/路径 glob | 字段含义 | 禁用替代词 | 推荐词 | 备注`
- `text-govern-rules/generated/README.md` 存在（Markdown，不得是 `.xlsx`）
- 三个 xlsx 解析后规则总条数 ≥ 1
- `TG_CMD rules:verify` 退出码 0

## 绝对禁止

- 生成 `README.xlsx`
- 生成词汇统计、词频统计等与规则匹配无关的内容
- 使用英文风险等级（critical/high/medium/low）或英文分类
- 凭空生成与本项目源码无关的规则
- **基线类目规则处理**：当 `rules.includeDefaults = false` 时，**禁止**在 banned.xlsx 中生成色情/政治/暴恐/涉枪涉爆/广告违规等基线类目词条；当 `rules.includeDefaults = true` 时，按「前置检查 4」和 `generate-rules.md`「内置基线类目限定范围」章节执行——**只输出有代码库证据的命中词，绝不照抄词库文件，绝不堆砌通用词**
- **低风险规则截断**：按 `rules.auditStrictness` 执行 `generate-rules.md` 的数量上限；被截断的词义统一、业务语义、推荐修改类条目只写入 README 的未输出原因，不进入 Excel。
