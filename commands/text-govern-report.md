---
description: "用 text-govern 执行 AI 语义深度分析并生成 HTML 审计报告。当用户说「生成报告」「生成审计报告」「text-govern 报告」「查看文案问题」时使用。"
---

# /text-govern-report — AI 语义分析 + 生成 HTML 报告

## 前置检查（按顺序）

### 1. 解析 CLI 前缀（TG_CMD）

在**项目根目录**下按顺序尝试，**任一步成功即得到 TG_CMD 并继续，不要中断**；仅当四步均失败时再提示安装。

1. `text-govern --version` 成功 → **TG_CMD** = `text-govern`
2. 否则 `npx -y text-govern --version` 成功 → **TG_CMD** = `npx -y text-govern`
3. 否则若存在 `scripts/text-govern/bin/text-govern.js`，且 `node scripts/text-govern/bin/text-govern.js --version` 成功 → **TG_CMD** = `node scripts/text-govern/bin/text-govern.js`
4. 均失败 → 提示用户：先 `npx text-govern install`（仅铺设 Slash/Skill，**不会**把 `text-govern` 加入 PATH）；再安装可执行 CLI（任选其一）— `npm install -g text-govern`，或在项目根用 `npx -y text-govern --version` 验证后重试。

**说明**：下文 `TG_CMD <子命令>` 表示把 **TG_CMD** 替换为步骤 1–3 得到的**整条前缀**后执行；展开示例：`text-govern report` / `npx -y text-govern report` / `node scripts/text-govern/bin/text-govern.js report`（只执行与探测结果一致的那一条）。

### 2. 输入产物

确认 `.text-govern/extracted.json` 存在；不存在则先执行 `/text-govern-scan`

### 3. 规则匹配产物

确认 `.text-govern/findings.rule.json` 存在；不存在则先执行 `/text-govern-analyze`

## 步骤 1 — AI 语义深度分析

读取 `.text-govern/extracted.json`，按照 `skills/prompts/analyze-semantics.md` 指南执行任务 1~5；
若 `rules.includeStandardWords = true` 则额外执行**任务 6**（标准术语识别）：

0. **系统背景**：读取 `text-govern.config.js` 的 `systemBackground`；若为空则基于源码生成约 200 字以内的系统背景介绍，**必须**写入 `findings.ai.json.meta.systemBackground`（供报告 header 展示）
1. 对 fragments 进行语义聚类——找出同一业务字段被用了多种不同表达
2. 检测疑似歧义词（词意在上下文中含义不明确或与页面业务不符）
3. 检测上下文语境不一致
4. **（当 `rules.includeStandardWords = true`）** 读取 `scripts/text-govern/config/standard-product.json` 与 `standard-slogan.json`，对 fragments 做模糊/谐音/篡改判定——识别产品名/宣传语的非标准写法；多语言（英文名/拼音/不同语言翻译）不计错误
5. 将发现的问题按 `findings.ai.json` schema 写入 `.text-govern/findings.ai.json`

如数据量大，可分批处理（每批 100 条 fragments）。只写入你确认有问题的条目。

## 步骤 2 — 生成 HTML 报告

```bash
TG_CMD report
```

## 步骤 3 — 汇报

1. 报告路径：`.text-govern/report/index.html`（可直接用浏览器打开）
2. 说明报告 header 中的系统背景介绍来源（config / AI 生成 / 占位提示）
3. 按中文风险等级汇总问题数
4. 列出 TOP 5 最严重问题（附文件 + 行号）
5. 如有 `严重违禁` 问题，明确提示必须修复才能发布
