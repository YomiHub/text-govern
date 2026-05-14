---
description: "用 text-govern 扫描项目源码，提取所有中文文案片段，输出 .text-govern/extracted.json。当用户说「扫描文案」「提取文案片段」「text-govern 扫描」时使用。"
---

# /text-govern-scan — 静态扫描提取文案

## 前置检查：解析 CLI 前缀（TG_CMD）

在**项目根目录**下按顺序尝试，**任一步成功即得到 TG_CMD 并继续，不要中断**；仅当四步均失败时再提示安装。

1. `text-govern --version` 成功 → **TG_CMD** = `text-govern`
2. 否则 `npx -y text-govern --version` 成功 → **TG_CMD** = `npx -y text-govern`
3. 否则若存在 `scripts/text-govern/bin/text-govern.js`，且 `node scripts/text-govern/bin/text-govern.js --version` 成功 → **TG_CMD** = `node scripts/text-govern/bin/text-govern.js`
4. 均失败 → 提示用户：先 `npx text-govern install`（仅铺设 Slash/Skill，**不会**把 `text-govern` 加入 PATH）；再安装可执行 CLI（任选其一）— `npm install -g text-govern`，或在项目根用 `npx -y text-govern --version` 验证后重试。

**说明**：下文 `TG_CMD <子命令>` 表示把 **TG_CMD** 替换为步骤 1–3 得到的**整条前缀**后执行；展开示例：`text-govern scan` / `npx -y text-govern scan` / `node scripts/text-govern/bin/text-govern.js scan`（只执行与探测结果一致的那一条）。

## 执行

```bash
TG_CMD scan
```

## 完成后汇报

- 扫描了多少文件
- 提取了多少条文案片段（原始 / 过滤后）
- 是否有解析失败的文件（如有，列出文件名）
- 输出文件路径：`.text-govern/extracted.json`
