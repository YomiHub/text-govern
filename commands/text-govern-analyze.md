---
description: "用 text-govern 执行规则匹配分析，检测违禁词/术语不统一/业务语义歧义，输出 .text-govern/findings.rule.json。当用户说「分析文案」「规则匹配」「检查违禁词」「text-govern 分析」时使用。"
---

# /text-govern-analyze — 规则匹配分析

## 前置检查（按顺序）

1. 确认 `text-govern --version` 可用；不可用则提示 `npx @bf/text-govern install`
2. 确认 `.text-govern/extracted.json` 存在；不存在则先执行 `/text-govern-scan`

## 执行

```bash
text-govern analyze
```

## 完成后汇报

- 加载了多少条规则（违禁词 / 术语 / 语义）
- 违禁/行业词命中数
- 术语不统一数
- 语义歧义数
- 合计问题数（按风险等级分列）
- 输出文件路径：`.text-govern/findings.rule.json`

如需 AI 进一步语义深度分析，请使用 `/text-govern-report` 或 `/text-govern`。
