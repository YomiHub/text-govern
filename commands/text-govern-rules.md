---
description: "用 text-govern 按 6 维度（合规底线/品牌调性/术语统一/业务语义/UX文案/上下文）扫描当前项目源码，生成强相关的 Excel 规则库到 text-govern-rules/generated/。当用户说「生成规则库」「初始化规则」「更新规则包」「生成文案规则」时使用。"
---

# /text-govern-rules — AI 生成 Excel 规则库

调用 `text-govern` skill 的「初始化/更新规则库」分支（即 SKILL.md 中的 Init 场景步骤 A~E）。

## 前置检查（按顺序）

1. 确认 `text-govern --version` 可用；不可用则提示 `npx @bf/text-govern install`
2. 确认项目根存在 `text-govern.config.js`；不存在则先执行 `text-govern init`（或 `/text-govern-init`）
3. 确认 `.text-govern/extracted.json` 存在；不存在则先运行 `text-govern scan`（或 `/text-govern-scan`）

## 执行

按 `skills/text-govern/SKILL.md` 中 **Init 场景 步骤 A~E** 完整执行：

- **步骤 A**：环境与配置确认（读取 `industry` 字段）
- **步骤 B**：业务画像（分析路由、pageHint、高频文案，向用户汇报并确认）
- **步骤 C**：6 维度治理检查（合规/品牌/术语/业务语义/UX/上下文）
- **步骤 D**：写入 `text-govern-rules/generated/` 下的 Excel 文件 + `README.md`
- **步骤 E**：汇报条数与维度覆盖，提示 git 提交

## 约束

- `风险等级` 和 `分类` 必须使用中文
- 每条规则的 `备注` 字段写清"证据片段 / 来源页面"
- 不输出与当前项目源码无关的规则
- 不输出 `README.xlsx`，README 一律 Markdown 格式
