---
description: "用 text-govern 按 6 维度（合规底线/品牌调性/术语统一/业务语义/UX文案/上下文）扫描当前项目源码，生成强相关的 Excel 规则库到 text-govern-rules/generated/。当用户说「生成规则库」「初始化规则」「更新规则包」「生成文案规则」时使用。"
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

## 执行

1. 按 SKILL.md Init 场景 **步骤 A~E** 完整执行（含业务画像确认、6 维度治理）。
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
