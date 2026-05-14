---
description: "用 text-govern 按 6 维度（合规底线/品牌调性/术语统一/业务语义/UX文案/上下文）扫描当前项目源码，生成强相关的 Excel 规则库到 text-govern-rules/generated/。当用户说「生成规则库」「初始化规则」「更新规则包」「生成文案规则」时使用。"
---

# /text-govern-rules — AI 生成 Excel 规则库

调用 `text-govern` skill 的「初始化/更新规则库」分支（即 SKILL.md 中的 Init 场景步骤 A~E）。

## 前置检查（按顺序）

### 1. 解析 CLI 前缀（TG_CMD）

在**项目根目录**下按顺序尝试，**任一步成功即得到 TG_CMD 并继续，不要中断**；仅当四步均失败时再提示安装。

1. `text-govern --version` 成功 → **TG_CMD** = `text-govern`
2. 否则 `npx -y text-govern --version` 成功 → **TG_CMD** = `npx -y text-govern`
3. 否则若存在 `scripts/text-govern/bin/text-govern.js`，且 `node scripts/text-govern/bin/text-govern.js --version` 成功 → **TG_CMD** = `node scripts/text-govern/bin/text-govern.js`
4. 均失败 → 提示用户：先 `npx text-govern install`（仅铺设 Slash/Skill，**不会**把 `text-govern` 加入 PATH）；再安装可执行 CLI（任选其一）— `npm install -g text-govern`，或在项目根用 `npx -y text-govern --version` 验证后重试。

**说明**：下文 `TG_CMD <子命令>` 表示把 **TG_CMD** 替换为步骤 1–3 得到的**整条前缀**后执行；展开示例：`text-govern init` / `npx -y text-govern init` / `node scripts/text-govern/bin/text-govern.js init`（只执行与探测结果一致的那一条）。

### 2. 配置文件

确认项目根存在 `text-govern.config.js`；不存在则先执行 `TG_CMD init`（或 `/text-govern-init`，其中 CLI 仍须用 **TG_CMD**）。

### 3. 扫描产物

确认 `.text-govern/extracted.json` 存在；不存在则先运行 `TG_CMD scan`（或 `/text-govern-scan`）

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
