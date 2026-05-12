# Prompt: AI 语义深度分析

## 任务

读取 `.text-govern/extracted.json` 中的 `fragments` 数组，执行语义层面的深度分析，找出规则引擎无法覆盖的以下 4 类问题：

1. **跨页面语义不一致** — 同一个业务字段在不同页面使用了不同表述
2. **上下文语义歧义** — 词语在当前上下文中含义不明确或与页面业务不符
3. **隐式术语混用** — 没有明确定义为别名，但在语义上描述同一个概念
4. **推荐优化** — 虽不违规，但措辞可以更专业、更清晰

---

## 分析方法

### Step 1: 按 pageHint 分组

将 fragments 按 `pageHint` 字段分组，了解每个页面包含哪些文案。

### Step 2: 语义聚类

对全量 fragments 的 `normalized` 字段做语义聚类：
- 找出语义上相近但写法不同的片段组
- 例如："业绩" "绩效" "成绩" "分数" 可能指同一业务字段

### Step 3: 上下文一致性检查

对每个 pageHint 下的文案集合：
- 检查页面路径名（如 integral、performance、score）与文案内容的语义是否一致
- 例如：路径含 `integral`（积分）但文案全是"业绩"——路径名与文案矛盾
- 例如：路径含 `performance` 但某处出现"积分"——上下文不一致

### Step 4: 歧义词检测

逐条检查高频词语：
- 该词在不同 pageHint 下是否有不同含义
- 例如："分数" 在积分页是积分，在业绩页是业绩，但在某页同时出现 → 歧义

---

## 输出格式

将分析结果输出为合法 JSON，写入 `.text-govern/findings.ai.json`：

```json
{
  "meta": {
    "generatedAt": "{{ISO_DATE}}",
    "totalFindings": 5,
    "method": "ai-semantic-analysis"
  },
  "findings": [
    {
      "id": "ai_001",
      "fragmentId": "packageA/pages/more/integral/index.wxml:60:24:a1b2c3d4",
      "file": "packageA/pages/more/integral/index.wxml",
      "line": 60,
      "column": 24,
      "rawText": "业绩已完成：",
      "category": "业务语义统一类",
      "severity": "需关注",
      "matched": "业绩",
      "suggestion": "建议确认：integral 路径名暗示积分场景，但文案使用业绩——请确认字段含义",
      "reason": "页面路径 more/integral 语义上指积分，但该页面同时出现了'业绩'字样（line 54、60、65）。如业务字段定义为业绩，建议将路径名改为 performance；如字段是积分，则文案中的'业绩'应改为'积分'。",
      "source": "ai",
      "rulePack": "ai.semantic.path-content-mismatch",
      "legalRef": "",
      "pageHint": "more/integral",
      "surrounding": "累计业绩：",
      "kind": "wxml-text",
      "relatedFragments": [
        "packageA/pages/more/integral/index.wxml:48:24:xxxxxxxx",
        "packageA/pages/more/integral/index.wxml:54:24:yyyyyyyy"
      ]
    }
  ]
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| `id` | 唯一 ID，格式 `ai_XXX`（三位数字） |
| `fragmentId` | 来源 fragment 的 id（从 extracted.json 中取） |
| `file` | 文件路径（从 fragment 取） |
| `line` | 行号（从 fragment 取） |
| `column` | 列号（从 fragment 取） |
| `rawText` | 原始文案 |
| `category` | 中文分类，例如 `业务语义统一类`、`词义统一类`、`推荐修改类` |
| `severity` | 中文风险等级，例如 `高风险` 明确歧义 / `需关注` 疑似歧义 / `推荐修改` 推荐优化 |
| `matched` | 发现问题的具体词 |
| `suggestion` | 简短建议（不超过 40 字） |
| `reason` | 详细原因（说明为什么有问题，给出具体证据）|
| `source` | 固定为 `"ai"` |
| `rulePack` | 固定格式 `ai.semantic.{type}`，type 见下方 |
| `relatedFragments` | 相关联的其他 fragmentId 数组（可选，用于聚合展示）|

### rulePack 类型

- `ai.semantic.path-content-mismatch` — 路径名与内容语义不符
- `ai.semantic.cross-page-inconsistency` — 跨页面同字段多种写法
- `ai.semantic.context-ambiguity` — 上下文歧义
- `ai.terminology.implicit-alias` — 隐式别名（未定义为术语但语义相同）
- `ai.recommend.clarity` — 措辞清晰度推荐优化

---

## 注意事项

1. **只写入你确认有问题的条目**，不确定的不写入，宁缺毋滥
2. 每个 finding 的 `reason` 必须给出具体证据（引用具体的行号、文件、词语）
3. `severity=高风险` 只用于你非常确认存在问题的情况
4. 如果 extracted.json fragments 超过 200 条，按 pageHint 分批处理，每批 50 条
5. 处理完后汇报：共分析了多少 fragments，发现了多少问题
