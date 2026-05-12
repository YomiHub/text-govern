# 内置默认规则（Built-in Defaults）

本目录是 `text-govern` CLI 在 `text-govern.config.js` 中设置 `rules.includeDefaults = true` 时
加载的内置规则数据源。

## 文件清单

| 文件 | Sheet | 用途 |
|------|-------|------|
| `banned.default.xlsx` | 违禁违规词 | 面向中国大陆 To B/To C 业务的通用违禁/合规底线 |
| `terminology.default.xlsx` | 术语统一 | 通用 UI 文案术语统一（按钮、空状态、错误提示等） |
| `semantic.default.xlsx` | 业务语义 | 默认留空——业务语义高度项目相关，建议由 AI/业务在 `text-govern-rules/` 中维护 |

## 词库定位

- **覆盖**：《广告法》第九条极限词、金融资管新规、医疗广告管理办法、明显不文明用语、轻量政治/封建迷信兜底
- **不覆盖**：明确的政治领导人/民族宗教敏感词、色情/赌博/毒品大词库——这类词请在
  业务项目的 `text-govern-rules/custom/banned.xlsx` 中按需补充，不在通用代码仓库中沉淀
- **不覆盖**：行业强相关（医药、教育、汽车、奢侈品等）的具体合规词——请由 AI 在
  `text-govern-rules/generated/` 生成或业务在 `text-govern-rules/custom/` 维护

## 维护方式

### 方式一：直接编辑 Excel（推荐）

合规/业务同学可直接打开 `banned.default.xlsx` 等文件增删条目，保存即生效。
工具运行时通过 `scripts/text-govern/lib/rules/defaults.js` 读取这些 Excel。

### 方式二：维护数据脚本

若需通过代码批量维护：

```bash
# 编辑 scripts/text-govern/scripts/build-default-rules.js 中的 *_ROWS 数据
node scripts/text-govern/scripts/build-default-rules.js
```

## 字段约束

参考 `text-govern-rules/custom/README.md`，字段含义完全一致。

## 启用方式

在业务项目根目录的 `text-govern.config.js` 中：

```js
module.exports = {
  rules: { includeDefaults: true },
};
```

默认情况下 `includeDefaults: false`，避免与项目无关的规则干扰。
