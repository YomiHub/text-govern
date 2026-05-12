---
description: "text-govern 全流程文案治理：扫描源码 → 规则匹配 → AI 语义深度分析 → 生成 HTML 整改报告。当用户说「跑一下文案治理」「做一次文案合规检查」「生成整改报告」时使用。"
---

# /text-govern — 全流程文案治理

按顺序完成以下 5 步，每步完成后汇报结果，**不要跳过任何步骤**。

## 前置检查

1. 确认 `text-govern --version` 可用；不可用则提示用户运行 `npx @anmei/text-govern install`
2. 确认项目根存在 `text-govern.config.js`；不存在则先执行 `text-govern init`

## 步骤 1 — 静态扫描

```bash
text-govern scan
```

汇报：扫描了多少文件、提取了多少条文案片段、是否有解析失败的文件。

## 步骤 2 — 规则匹配分析

```bash
text-govern analyze
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
text-govern report
```

## 步骤 5 — 总结

1. 告知报告路径：`.text-govern/report.html`（可直接用浏览器打开）
2. 按中文风险等级汇总：`严重违禁 / 高风险 / 需关注 / 推荐修改`
3. 列出 TOP 5 最严重问题（附文件 + 行号）
4. 如有 `严重违禁` 问题，明确提示必须修复才能发布
