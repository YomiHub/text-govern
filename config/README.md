# 内置默认规则（Built-in Defaults）

本目录是 `text-govern` CLI 在 `text-govern.config.js` 中设置 `rules.includeDefaults = true` 时
加载的内置规则数据源。

## 文件清单

| 文件 | Sheet | 用途 |
|------|-------|------|
| `terminology.default.xlsx` | 术语统一 | 通用 UI 文案术语统一（按钮、空状态、错误提示等），手动维护 |
| `semantic.default.xlsx` | 业务语义 | 默认留空——业务语义高度项目相关，建议由 AI 在 `text-govern-rules/` 中维护 |
| `standard-product.xlsx` | 产品名/宣传语 | 标准产品名称与宣传语，由 `scripts/build-standard-rules.js` 转换为 JSON 供 AI 语义阶段使用 |

## 基线违禁类目

`banned.default.xlsx` 已移除。当 `rules.includeDefaults = true` 时，AI 在
`/text-govern-rules` 阶段会按下列基线类目扫描代码库，仅将项目中**确有命中证据**的词写入
`text-govern-rules/generated/banned.xlsx`：

| 基线类目 | 参考词库范围 |
|----------|------------|
| 色情违规 | konsheng/Sensitive-lexicon 色情类型/色情词库 |
| 政治敏感 | konsheng/Sensitive-lexicon 政治类型/反动词库 |
| 暴恐违禁 | konsheng/Sensitive-lexicon 暴恐词库 |
| 涉枪涉爆 | konsheng/Sensitive-lexicon 涉枪涉爆 |
| 广告违规 | 违法广告极限词、医疗夸大、虚假宣传 |

这种方式避免了运行期加载数万条词汇的开销，同时让识别更贴近项目实际情况。

## 启用方式

在业务项目根目录的 `text-govern.config.js` 中：

```js
module.exports = {
  rules: {
    // 开启后 /text-govern-rules 阶段 AI 按基线类目扫代码库写入 banned.xlsx
    includeDefaults: true,
    // 开启后 /text-govern-report AI 语义阶段识别标准产品名/宣传语非标准写法
    includeStandardWords: true,
  },
};
```

默认均为 `true`；若只需项目 AI 生成 / 自定义规则，可在 `text-govern.config.js` 中设为 `false`。
