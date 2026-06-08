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
6. **标准术语识别**（仅当 `text-govern.config.js` 中 `rules.includeStandardWords = true` 时执行）— 对照标准产品名/宣传语 JSON 文件，识别代码库中出现的非标准写法（拼写错误、谐音、形近字、缩写篡改等）

---

## 分析方法

### Step 1: 业务画像与系统背景（为任务 5 服务，其他任务也可参考）

在开始之前，先完成系统画像，并准备报告 header 所需的**系统背景介绍**：

1. 读取 `text-govern.config.js` 中的 `industry` 字段（若为空则进入步骤 2）
2. 如果 `industry` 为空，从 `app.json` 路由、页面标题、核心文案、接口命名中推断系统类型；Java 后端项目还要参考 controller/service 路径、注解、日志/异常、邮件/消息模板、YAML/Properties 配置值
3. 综合判断：
   - **终端类型**：微信小程序 / H5 / 官网 / App / 管理系统 / Java 后端服务 / 内部工具 / 其他
   - **公开范围**：面向公众（C 端）/ 企业用户（B 端）/ 企业内部
   - **核心功能**：含交易 / 个人信息收集 / 支付 / 金融产品 / 医疗健康 / 教育培训 / 食品保健品 / 营销推广 / 其他
4. 根据上述判断，**列出本系统实际应遵守的法规范围**（不套模板，按实际情况判断）

**系统背景介绍（写入 `findings.ai.json.meta.systemBackground`，供报告 header 展示）**：

- 读取 `text-govern.config.js` 的 `systemBackground` 字段
- **若已配置**：直接沿用（超过 200 字则截断至 200 字），写入 `meta.systemBackground`
- **若为空**：基于 `extracted.json`（pageHint、高频文案、路由/标题）、`industry`（若有）生成一段**中文系统背景介绍**，要求：
  - 说明系统类型、目标用户、核心业务场景
  - **不超过 200 字**，客观精炼
  - 不编造未在源码中出现的功能或模块
  - 写入 `meta.systemBackground`

> `industryProfile` 供合规分析上下文；`systemBackground` 供报告 header 人类可读摘要，两者职责分离。

### Step 2: 按 pageHint 分组

将 fragments 按 `pageHint` 字段分组，了解每个页面包含哪些文案。
对 Java 后端项目，`pageHint` 通常是模块/包路径；同时结合 fragment 的 `kind`、`context`、`container` 判断是接口注解、日志、异常、返回值、邮件/消息模板还是配置文案。

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

### Step 7: 标准术语对比（任务 6 — 仅当 `rules.includeStandardWords = true`）

**前置**：先读取 `text-govern.config.js` 中的 `rules.includeStandardWords`；若为 `false`（默认值），
直接跳过本 Step，不执行任何匹配。

**数据加载**：

1. 读取 `scripts/text-govern/config/standard-product.json`（若文件不存在则跳过产品名部分）
   - 结构：`[{ code, name, genericName, brand, trademark }]`
   - 有效标准词：`name`（产品名）、`genericName`（通用名）、`brand`（品牌）、`trademark`（商标）中非空的字段
2. 读取 `scripts/text-govern/config/standard-slogan.json`（若文件不存在则跳过宣传语部分）
   - 结构：`[{ type, slogan }]`
   - 有效标准词：`slogan` 字段

**匹配逻辑**：

对每条 fragment 的 `normalized` 字段，依次检查是否出现了以下非标准写法：

- **拼写错别字**：如「澳特絲」（丝/絲混淆）vs 标准「澳特斯」
- **谐音/形近字**：如「澳特思」「澳特司」「奥特斯」（奥/澳混淆）
- **缩写/截断**：如宣传语被截断或不完整引用
- **篡改变体**：标准宣传语的措辞被改动

**豁免规则**（以下情况不报告）：

- 英文名称（如品牌的英文缩写、拉丁文通用名）
- 纯拼音写法（如「Aoteisi」等拼音表示）
- 多语言翻译（不同语言的等价表述，如日文、韩文版产品名）
- `brand` 或 `trademark` 字段中与标准一致的英文简称
- 只是产品规格/包装描述差异（括号内的剂量/数量等），不影响产品名本身

**命中时的 finding 格式**：

```json
{
  "category": "词义统一类",
  "severity": "需关注",
  "rulePack": "ai.terminology.standard-mismatch",
  "suggestion": "建议改为标准写法：<标准词>",
  "reason": "代码库中出现「<命中文本>」，与标准产品名/宣传语「<标准词>」不一致（<差异类型：拼写错误/谐音/形近字/截断等>）"
}
```

**效率说明**：本步骤只对 fragment 中出现疑似品牌/产品相关词汇时执行比对，
不对所有 fragment 做全量扫描；当确认某个 fragment 与标准词无关时直接跳过。

---

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
    "systemBackground": "{{配置值或 AI 生成的背景介绍，≤200字}}",
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

**语义/术语/优化类**（任务 1-4、6）：
- `ai.semantic.path-content-mismatch` — 路径名与内容语义不符
- `ai.semantic.cross-page-inconsistency` — 跨页面同字段多种写法
- `ai.semantic.context-ambiguity` — 上下文歧义
- `ai.terminology.implicit-alias` — 隐式别名（未定义为术语但语义相同）
- `ai.terminology.standard-mismatch` — 标准产品名/宣传语非标准写法（拼写错误/谐音/篡改）
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
   - 任务 6（标准术语识别）→ `category: "词义统一类"`，`severity: "需关注"`，`rulePack: "ai.terminology.standard-mismatch"`
7. **行业合规任务的要求**：
   - 先完成 Step 1 业务画像，再执行扫描；不做画像不得产出行业合规类 findings
   - `legalRef` 有明确法规依据时务必填写；无法确定则留空，**不允许杜撰法规条款编号**
   - 任务 5 只报告规则引擎词表**覆盖不到**的隐式/上下文风险，不重复词表已有命中
   - 《广告法》极限词只是行业合规的示例之一；实际适用哪些法规，按系统类型判断，不要默认套用广告法
8. **标准术语任务（任务 6）的豁免要求**：
   - 仅当 `rules.includeStandardWords = true` 时执行，否则直接跳过
   - 英文品牌名、拉丁文通用名、纯拼音写法、多语言翻译**不报告**
   - 括号内的剂量/数量/包装规格差异**不报告**，只关注核心产品名/品牌/宣传语本身
   - 只写入**确认有问题**的条目，模棱两可的不写入
