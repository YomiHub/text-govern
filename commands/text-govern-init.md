---
description: "初始化 text-govern：创建 text-govern.config.js、text-govern-rules/ 目录和空 Excel 模板。当用户说「初始化文案治理」「第一次使用 text-govern」「初始化 text-govern 配置」时使用。"
---

# /text-govern-init — 初始化配置与模板

## 前置检查

确认 `text-govern --version` 可用；不可用则提示用户运行 `npx @anmei/text-govern install`。

## 执行

```bash
text-govern init
```

## 完成后告知用户

1. 已创建 `text-govern.config.js` — 可以编辑 `industry` 字段（留空让 AI 自动判断，或填写业务描述如"医药代理商 SaaS 系统"）
2. 已创建 `text-govern-rules/custom/` — 存放业务/合规人工维护的规则（最高优先级）
3. 已创建 `text-govern-rules/generated/` — 存放 AI 生成的规则
4. 下一步：使用 `/text-govern-rules` 让 AI 按 6 维度生成规则库
