---
description: "用 text-govern 执行规则匹配分析，检测违禁词/术语不统一/业务语义歧义，输出 .text-govern/findings.rule.json。当用户说「分析文案」「规则匹配」「检查违禁词」「text-govern 分析」时使用。"
---

# /text-govern-analyze — 规则匹配分析

## 前置检查（按顺序）

### 1. 解析 CLI 前缀（TG_CMD）

在**项目根目录**下按顺序尝试，**任一步成功即得到 TG_CMD 并继续，不要中断**；仅当四步均失败时再提示安装。

1. `text-govern --version` 成功 → **TG_CMD** = `text-govern`
2. 否则 `npx -y text-govern --version` 成功 → **TG_CMD** = `npx -y text-govern`
3. 否则若存在 `scripts/text-govern/bin/text-govern.js`，且 `node scripts/text-govern/bin/text-govern.js --version` 成功 → **TG_CMD** = `node scripts/text-govern/bin/text-govern.js`
4. 均失败 → 提示用户：先 `npx text-govern install`（仅铺设 Slash/Skill，**不会**把 `text-govern` 加入 PATH）；再安装可执行 CLI（任选其一）— `npm install -g text-govern`，或在项目根用 `npx -y text-govern --version` 验证后重试。

**说明**：下文 `TG_CMD <子命令>` 表示把 **TG_CMD** 替换为步骤 1–3 得到的**整条前缀**后执行；展开示例：`text-govern analyze` / `npx -y text-govern analyze` / `node scripts/text-govern/bin/text-govern.js analyze`（只执行与探测结果一致的那一条）。

### 2. 输入产物

确认 `.text-govern/extracted.json` 存在；不存在则先执行 `/text-govern-scan`

## 执行

```bash
TG_CMD analyze
```

## 完成后汇报

- 加载了多少条规则（违禁词 / 术语 / 语义）
- 违禁/行业词命中数
- 术语不统一数
- 语义歧义数
- 合计问题数（按风险等级分列）
- 输出文件路径：`.text-govern/findings.rule.json`

如需 AI 进一步语义深度分析，请使用 `/text-govern-report` 或 `/text-govern`。
