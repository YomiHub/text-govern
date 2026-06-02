---
description: "初始化 text-govern：创建 text-govern.config.js、text-govern-rules/ 目录和空 Excel 模板。当用户说「初始化text-govern」「第一次使用 text-govern」「初始化 text-govern 配置」时使用。"
---

# /text-govern-init — 初始化配置与模板

## 前置检查：解析 CLI 前缀（TG_CMD）

在**项目根目录**下按顺序尝试，**任一步成功即得到 TG_CMD 并继续，不要中断**；仅当四步均失败时再提示安装。

1. `text-govern --version` 成功 → **TG_CMD** = `text-govern`
2. 否则 `npx -y text-govern --version` 成功 → **TG_CMD** = `npx -y text-govern`
3. 否则若存在 `scripts/text-govern/bin/text-govern.js`，且 `node scripts/text-govern/bin/text-govern.js --version` 成功 → **TG_CMD** = `node scripts/text-govern/bin/text-govern.js`
4. 均失败 → 提示用户：先 `npx text-govern install`（仅铺设 Slash/Skill，**不会**把 `text-govern` 加入 PATH）；再安装可执行 CLI（任选其一）— `npm install -g text-govern`，或在项目根用 `npx -y text-govern --version` 验证网络与包可用后重试。

**说明**：下文 `TG_CMD <子命令>` 表示把 **TG_CMD** 替换为步骤 1–3 得到的**整条前缀**后执行；展开示例：`text-govern init` / `npx -y text-govern init` / `node scripts/text-govern/bin/text-govern.js init`（只执行与探测结果一致的那一条）。

## 执行

```bash
TG_CMD init
```

**重要**：若 CLI 退出码非 0，必须将完整错误原文如实告知用户，禁止伪报成功。用户看到的状态必须与 CLI 实际结果一致。

## 完成后告知用户

1. 已创建 `text-govern.config.js` — 可以编辑 `industry` 字段（留空让 AI 自动判断，或填写业务描述如"医药代理商 SaaS 系统"）
2. 已创建 `text-govern-rules/custom/` — 存放业务/合规人工维护的规则（最高优先级）
3. 已创建 `text-govern-rules/generated/` — 存放 AI 生成的规则
4. 下一步：使用 `/text-govern-rules` 让 AI 按 6 维度生成规则库
