---
description: "text-govern 全流程：扫描源码 → 规则匹配 → AI 语义深度分析 → 生成 HTML 整改报告。当用户说「跑一下text-govern」「做一次文案合规检查」「生成整改报告」时使用。"
---

# /text-govern — 全流程文案治理

按顺序完成以下 5 步，每步完成后汇报结果，**不要跳过任何步骤**。

## 前置检查（按顺序）

### 1. 解析 CLI 前缀（TG_CMD）

在**项目根目录**下按顺序尝试，**任一步成功即得到 TG_CMD 并继续，不要中断**；仅当四步均失败时再提示安装。

1. `text-govern --version` 成功 → **TG_CMD** = `text-govern`
2. 否则 `npx -y text-govern --version` 成功 → **TG_CMD** = `npx -y text-govern`
3. 否则若存在 `scripts/text-govern/bin/text-govern.js`，且 `node scripts/text-govern/bin/text-govern.js --version` 成功 → **TG_CMD** = `node scripts/text-govern/bin/text-govern.js`
4. 均失败 → 提示用户：先 `npx text-govern install`（仅铺设 Slash/Skill，**不会**把 `text-govern` 加入 PATH）；再安装可执行 CLI（任选其一）— `npm install -g text-govern`，或在项目根用 `npx -y text-govern --version` 验证后重试。

**说明**：下文 `TG_CMD <子命令>` 表示把 **TG_CMD** 替换为步骤 1–3 得到的**整条前缀**后执行；展开示例：`text-govern scan` / `npx -y text-govern scan` / `node scripts/text-govern/bin/text-govern.js scan`（只执行与探测结果一致的那一条）。

### 2. 配置文件

确认项目根存在 `text-govern.config.js`；不存在则先执行 `TG_CMD init`（或 `/text-govern-init`，其中 CLI 仍须用本步得到的 **TG_CMD**）。

## 步骤 1 — 静态扫描

```bash
TG_CMD scan
```

汇报：扫描了多少文件、提取了多少条文案片段、是否有解析失败的文件。

## 步骤 2 — 规则匹配分析

```bash
TG_CMD analyze
```

汇报：违禁/行业词命中数、术语不统一数、语义歧义数。

## 步骤 3 — AI 语义深度分析

读取 `.text-govern/extracted.json`，按照 `skills/text-govern/SKILL.md` 中步骤 3 的指南：

1. 对所有 fragments 进行语义聚类，找出同一业务字段的多种表达
2. 检测疑似歧义词
3. 检测上下文语境不一致
4. 将结果写入 `.text-govern/findings.ai.json`

## 步骤 4 — 生成 HTML 报告

```bash
TG_CMD report
```

## 步骤 5 — 总结

1. 告知报告路径：`.text-govern/report.html`（可直接用浏览器打开）
2. 按中文风险等级汇总：`严重违禁 / 高风险 / 需关注 / 推荐修改`
3. 列出 TOP 5 最严重问题（附文件 + 行号）
4. 如有 `严重违禁` 问题，明确提示必须修复才能发布
