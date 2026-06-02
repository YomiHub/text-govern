# 内置默认规则（Built-in Defaults）

本目录是 `text-govern` CLI 在 `text-govern.config.js` 中设置 `rules.includeDefaults = true` 时
加载的内置规则数据源。

## 文件清单

| 文件 | Sheet | 用途 |
|------|-------|------|
| `banned.default.xlsx` | 违禁违规词 | 基于公开开源词库（konsheng/Sensitive-lexicon MIT + fwwdn/sensitive-stop-words Apache-2.0），构建期拉取生成 |
| `terminology.default.xlsx` | 术语统一 | 通用 UI 文案术语统一（按钮、空状态、错误提示等），手动维护 |
| `semantic.default.xlsx` | 业务语义 | 默认留空——业务语义高度项目相关，建议由 AI 在 `text-govern-rules/` 中维护 |
| `THIRD_PARTY_NOTICES.md` | — | 三方词库许可声明与锁定的 commit SHA |

## 词库来源

`banned.default.xlsx` 由 `scripts/fetch-public-baseline.js` 构建期拉取生成，词库涵盖：

| 分类 | 风险等级 | 来源 |
|------|----------|------|
| 色情违规 | 严重违禁 | konsheng/Sensitive-lexicon |
| 政治敏感 | 严重违禁 | konsheng/Sensitive-lexicon |
| 暴恐违禁 | 严重违禁 | konsheng/Sensitive-lexicon |
| 涉枪涉爆 | 严重违禁 | konsheng/Sensitive-lexicon |
| 广告违规 | 高风险 | konsheng/Sensitive-lexicon + fwwdn/sensitive-stop-words |

**有意不覆盖（请通过 AI 生成或手动 custom 维护）**：
- 广告法（"最佳/第一"等）— 行业强相关，由 AI 结合项目生成
- 金融合规（资管新规保本/保收益）— 行业强相关
- 医疗合规（治愈/根治等）— 行业强相关
- 教育合规、食品合规等——同上

## 刷新词库

词库版本锁定于指定 commit SHA（见 `THIRD_PARTY_NOTICES.md`）。如需同步上游更新：

```bash
cd scripts/text-govern
npm run fetch:baseline   # 需要网络，重新拉取并覆盖 banned.default.xlsx
```

## 启用方式

在业务项目根目录的 `text-govern.config.js` 中：

```js
module.exports = {
  rules: { includeDefaults: true },
};
```

默认 `includeDefaults: false`，避免基线规则干扰纯项目扫描。
