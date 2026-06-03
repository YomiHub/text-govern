# Prompt: AI 语义深度分析

## 分类模型（必须了解并严格遵守）

本工具采用**四大固定大类 + AI 自主识别子类**的模型：

| 大类（category，固定不变） | 含义 | 子类来源 |
|---|---|---|
| `行业合规` | 违反适用法规、行业强制要求 | **AI 按系统类型自主判定**（不写死） |
| `业务语义统一类` | 跨页面字段表述不一致、上下文语义歧义 | — |
| `词义统一类` | 同一概念多种写法混用 | — |
| `优化类` | 不违规但措辞可改进 | — |

> `行业合规` 的子类（即 Excel `分类` 列的具体值）**由 AI 依据系统行业与适用法规自主决定**，
> 例如：功效宣称违规 / 绝对化用语 / 保本承诺 / 未成年人保护 …
> 《广告法》极限词只是其中一个示例，**不要默认套用广告法**；
> 实际适用哪些法规，必须先判断系统落地形态、受众、功能后再决定。

---

## 任务

读取 `.text-govern/extracted.json` 中的 `fragments` 数组，依次执行以下 5 类分析：

1. **跨页面语义不一致** — 同一个业务字段在不同页面使用了不同表述
2. **上下文语义歧义** — 词语在当前上下文中含义不明确或与页面业务不符
3. **隐式术语混用** — 没有明确定义为别名，但在语义上描述同一个概念
4. **推荐优化** — 虽不违规，但措辞可以更专业、更清晰
5. **行业合规深度研判** — 基于系统落地形态与受众，识别规则词表难以覆盖的隐式/上下文合规风险

---

## 分析方法

### Step 1: 业务画像（为任务 5 服务，其他任务也可参考）

在开始之前，先完成系统画像：

1. 读取 `text-govern.config.js` 中的 `industry` 字段（若为空则进入步骤 2）
2. 如果 `industry` 为空，从 `app.json` 路由、页面标题、核心文案、接口命名中推断系统类型
3. 综合判断：
   - **终端类型**：微信小程序 / H5 / 官网 / App / 管理系统 / 内部工具 / 其他
   - **公开范围**：面向公众（C 端）/ 企业用户（B 端）/ 企业内部
   - **核心功能**：含交易 / 个人信息收集 / 支付 / 金融产品 / 医疗健康 / 教育培训 / 食品保健品 / 营销推广 / 其他
4. 根据上述判断，**列出本系统实际应遵守的法规范围**（不套模板，按实际情况判断）

### Step 2: 按 pageHint 分组

将 fragments 按 `pageHint` 字段分组，了解每个页面包含哪些文案。

### Step 3: 语义聚类

对全量 fragments 的 `normalized` 字段做语义聚类：
- 找出语义上相近但写法不同的片段组
- 例如："业绩" "绩效" "成绩" "分数" 可能指同一业务字段

### Step 4: 上下文一致性检查

对每个 pageHint 下的文案集合：
- 检查页面路径名（如 integral、performance、score）与文案内容的语义是否一致
- 例如：路径含 `integral`（积分）但文案全是"业绩"——路径名与文案矛盾
- 例如：路径含 `performance` 但某处出现"积分"——上下文不一致

### Step 5: 歧义词检测

逐条检查高频词语：
- 该词在不同 pageHint 下是否有不同含义
- 例如："分数" 在积分页是积分，在业绩页是业绩，但在某页同时出现 → 歧义

### Step 6: 行业合规隐式风险扫描（任务 5）

基于 Step 1 得出的法规范围，在文案中寻找**规则词表无法覆盖的隐式/上下文合规风险**：

- **绝对化/夸大宣称**：不是单独一个极限词，而是组合表述构成的违规语义（如"行业唯一通过认证的…"中，"唯一"在上下文中构成绝对化宣称）
- **功效/疗效暗示**：未用明显违禁词，但语境暗示疗效（如"改善睡眠品质，三周见效"）
- **虚假/夸大承诺**：组合数字或比较构成的隐式虚假广告（如"客户满意度高达 99.9%"无来源说明）
- **个人信息收集提示不当**：授权告知措辞不严肃、不合规
- **其他行业特有风险**：按 Step 1 判断结果，检查该行业专有的合规红线

> 注意：**只报告规则引擎词表匹配不到的部分**——如果某词已被 `banned.xlsx` 规则覆盖，此处不重复。
> 必须给出明确的上下文证据，说明为什么这条文案构成合规风险，而不是仅凭词汇匹配。

---

## 输出格式

将分析结果输出为合法 JSON，写入 `.text-govern/findings.ai.json`：

```json
{
  "meta": {
    "generatedAt": "{{ISO_DATE}}",
    "totalFindings": 5,
    "method": "ai-semantic-analysis",
    "industryProfile": {
      "industry": "{{从 config 读取或推断}}",
      "terminalType": "{{终端类型}}",
      "audience": "{{受众}}",
      "applicableLaws": ["{{适用法规1}}", "{{适用法规2}}"]
    }
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
| `category` | 中文分类，必须严格按下方规则选取，见注意事项第 6 条 |
| `severity` | 中文风险等级：`严重违禁` / `高风险` / `需关注` / `推荐修改` |
| `matched` | 发现问题的具体词或表述片段 |
| `suggestion` | 简短建议（不超过 40 字） |
| `reason` | 详细原因（说明为什么有问题，给出具体证据）|
| `source` | 固定为 `"ai"` |
| `rulePack` | 固定格式见下方，按任务类型选取 |
| `legalRef` | 行业合规类必填（有明确法规依据时填写，不确定则留空，不杜撰） |
| `relatedFragments` | 相关联的其他 fragmentId 数组（可选，用于聚合展示）|

### rulePack 类型

**语义/术语/优化类**（任务 1-4）：
- `ai.semantic.path-content-mismatch` — 路径名与内容语义不符
- `ai.semantic.cross-page-inconsistency` — 跨页面同字段多种写法
- `ai.semantic.context-ambiguity` — 上下文歧义
- `ai.terminology.implicit-alias` — 隐式别名（未定义为术语但语义相同）
- `ai.recommend.clarity` — 措辞清晰度推荐优化

**行业合规类**（任务 5）：
- `ai.compliance.absolute-claim` — 绝对化/夸大宣称（上下文构成的绝对化语义）
- `ai.compliance.efficacy-claim` — 功效/疗效暗示（未用禁词但语境暗示）
- `ai.compliance.false-promise` — 虚假/夸大承诺（缺乏来源支撑的数字声明等）
- `ai.compliance.privacy-notice` — 个人信息授权提示不规范
- `ai.compliance.industry-specific` — 行业专有合规风险（按判断结果，说明具体类型）

---

## 注意事项

1. **只写入你确认有问题的条目**，不确定的不写入，宁缺毋滥
2. 每个 finding 的 `reason` 必须给出具体证据（引用具体的行号、文件、词语）
3. `severity=严重违禁` 仅用于法规明确禁止且无上下文争议的情况；`severity=高风险` 用于你非常确认存在问题的情况
4. 如果 extracted.json fragments 超过 200 条，按 pageHint 分批处理，每批 50 条
5. 处理完后汇报：共分析了多少 fragments，发现了多少问题（按任务类型分列）
6. **`category` 取值规则**（必须严格遵守，不可自造其他值）：
   - 任务 1（跨页面语义不一致）→ `category: "业务语义统一类"`，`severity: "高风险"` 或 `"需关注"`
   - 任务 2（上下文语义歧义）→ `category: "业务语义统一类"`，`severity: "高风险"` 或 `"需关注"`
   - 任务 3（隐式术语混用）→ `category: "词义统一类"`，`severity: "需关注"`
   - 任务 4（推荐优化，措辞清晰度）→ `category: "优化类"`，`severity: "推荐修改"`
   - 任务 5（行业合规深度研判）→ `category: "行业合规"`，`severity: "严重违禁"` / `"高风险"` / `"需关注"`
7. **行业合规任务的要求**：
   - 先完成 Step 1 业务画像，再执行扫描；不做画像不得产出行业合规类 findings
   - `legalRef` 有明确法规依据时务必填写；无法确定则留空，**不允许杜撰法规条款编号**
   - 任务 5 只报告规则引擎词表**覆盖不到**的隐式/上下文风险，不重复词表已有命中
   - 《广告法》极限词只是行业合规的示例之一；实际适用哪些法规，按系统类型判断，不要默认套用广告法
