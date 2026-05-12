---
description: "用 text-govern 扫描项目源码，提取所有中文文案片段，输出 .text-govern/extracted.json。当用户说「扫描文案」「提取文案片段」「text-govern 扫描」时使用。"
---

# /text-govern-scan — 静态扫描提取文案

## 前置检查

确认 `text-govern --version` 可用；不可用则提示 `npx @anmei/text-govern install`。

## 执行

```bash
text-govern scan
```

## 完成后汇报

- 扫描了多少文件
- 提取了多少条文案片段（原始 / 过滤后）
- 是否有解析失败的文件（如有，列出文件名）
- 输出文件路径：`.text-govern/extracted.json`
