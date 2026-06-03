# Third-Party Notices — text-govern 默认词库

本目录的 `banned.default.xlsx` 由构建期脚本 `scripts/fetch-public-baseline.js` 自动生成，
基于以下开源词库。如需刷新，在 `scripts/text-govern/` 目录下运行：

```bash
npm run fetch:baseline
```

---

## 1. konsheng/Sensitive-lexicon

- **仓库**：<https://github.com/konsheng/Sensitive-lexicon>
- **许可证**：MIT
- **锁定 SHA**：`b38d80aece9837a434c601811c202d7640adeb4b`
- **使用文件**：
  - `Vocabulary/色情类型.txt` → 分类：色情违规
  - `Vocabulary/色情词库.txt` → 分类：色情违规
  - `Vocabulary/政治类型.txt` → 分类：政治敏感
  - `Vocabulary/反动词库.txt` → 分类：政治敏感
  - `Vocabulary/暴恐词库.txt` → 分类：暴恐违禁
  - `Vocabulary/涉枪涉爆.txt` → 分类：涉枪涉爆
  - `Vocabulary/广告类型.txt` → 分类：广告违规

MIT License 全文见：<https://github.com/konsheng/Sensitive-lexicon/blob/b38d80aece9837a434c601811c202d7640adeb4b/LICENSE>

---

## 2. fwwdn/sensitive-stop-words

- **仓库**：<https://github.com/fwwdn/sensitive-stop-words>
- **许可证**：Apache-2.0
- **锁定 SHA**：`a7d06bb1c321e669943b6841570d9da6dad8ce2b`
- **使用文件**：
  - `广告.txt` → 分类：广告违规

Apache 2.0 License 全文见：<https://github.com/fwwdn/sensitive-stop-words/blob/a7d06bb1c321e669943b6841570d9da6dad8ce2b/LICENSE>

---

## 维护说明

- 仅引入对中国大陆互联网平台监管相关的词汇分类（政治、色情、暴恐、广告、涉枪涉爆）。
- 故意**未引入**以下内容，以避免干扰正常业务文案扫描：
  - 网站黑名单（非法网址类）
  - GFW 翻墙工具词汇
  - 大规模无分类聚合词库（如腾讯、网易词库，体量过大且噪音过高）
  - COVID-19 专项词库（时效性过强）
  - 贪腐、民生词库（与text govern无关）
- 行业专有合规词（如绝对化用语、功效宣称、保本承诺等）、金融合规、医疗合规等**行业强相关合规词**不在此基线中，
  请通过 `/text-govern-rules` 命令让 AI 根据系统落地形态与行业，自主判定适用法规后生成到 `text-govern-rules/generated/` 目录。
