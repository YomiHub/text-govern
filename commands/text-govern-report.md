---
description: "用 text-govern 执行 AI 语义深度分析并生成 HTML 整改报告。当用户说「生成报告」「生成整改报告」「text-govern 报告」「查看文案问题」时使用。"
---

# /text-govern-report — AI 语义分析 + 生成 HTML 报告

## 前置检查（按顺序）

1. 确认 `text-govern --version` 可用；不可用则提示 `npx text-govern install`
2. 确认 `.text-govern/extracted.json` 存在；不存在则先执行 `/text-govern-scan`
3. 确认 `.text-govern/findings.rule.json` 存在；不存在则先执行 `/text-govern-analyze`

## 步骤 1 — AI 语义深度分析

读取 `.text-govern/extracted.json`，按照 `skills/text-govern/SKILL.md` 步骤 3 指南：

1. 对 fragments 进行语义聚类——找出同一业务字段被用了多种不同表达
2. 检测疑似歧义词（词意在上下文中含义不明确或与页面业务不符）
3. 检测上下文语境不一致
4. 将发现的问题按 `findings.ai.json` schema 写入 `.text-govern/findings.ai.json`

如数据量大，可分批处理（每批 100 条 fragments）。只写入你确认有问题的条目。

## 步骤 2 — 生成 HTML 报告

```bash
text-govern report
```

## 步骤 3 — 汇报

1. 报告路径：`.text-govern/report.html`（可直接用浏览器打开）
2. 按中文风险等级汇总问题数
3. 列出 TOP 5 最严重问题（附文件 + 行号）
4. 如有 `严重违禁` 问题，明确提示必须修复才能发布
