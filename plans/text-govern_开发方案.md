---
name: text-govern CLI 开发方案
overview: 在 `scripts/text-govern/` 下交付一个多端通用的文案治理 CLI + AI Skill：静态扫描提取 → 规则匹配（违禁/术语/语义）→ Cursor/Claude/Codex Skill 编排 AI 做多维度治理 → 输出自包含 HTML 整改报告。规则以 Excel 为一等公民，分内置默认 / AI 生成 / 用户自定义三层；通过 npm 包发布 + text-govern install 安装器铺设 Slash 命令到多家 AI 编辑器。
isProject: false
revision: v3 · 三层封装多编辑器发布
lastUpdated: 2026-05-12
---

> 本文档为 **现状描述（v3）**，与主干代码一致。
> 后续若有大改动，请同步更新本文件以及 `scripts/text-govern/README.md`。

## 一、目标与定位

提供一个面向多端（WXML / Vue / React / HTML / JS / JSON）的**通用文案治理 CLI**，覆盖：

1. **静态扫描**：抽取所有面向用户的中文文案片段（带文件、行、列、上下文）
2. **规则匹配**：违禁/极限词、术语统一、页面级业务语义
3. **AI 语义分析**：由 Cursor Agent 调起 Skill，进行歧义/上下文/品牌调性深度分析
4. **可视化报告**：单文件 HTML，含统计/筛选/详情

设计原则：

- **规则强相关于业务**：内置默认仅保底，AI 与用户规则才是主力，全部用 Excel 维护
- **中文一等公民**：风险等级、分类支持自定义中文，不固定英文枚举
- **可复用**：CLI 设计为独立 npm 包形态，业务项目仅留 `text-govern.config.js` 与 `text-govern-rules/`
- **AI 集成边界清晰**：CLI 不直调 LLM，AI 由 Skill 编排，Slash 命令提供快捷入口
- **跨编辑器**：一套 Skill + Slash 命令，支持 Cursor / Claude Code / Codex

---

## 二、目录结构

### CLI 包内（未来独立 npm 仓库）

```text
scripts/text-govern/
├── package.json              # 可发布 npm 包（text-govern，含 bin 入口）
├── LICENSE                   # MIT
├── README.md                 # 使用手册
├── bin/
│   ├── text-govern.js        # commander 入口（含 install 子命令）
│   └── install.js            # 安装器：探测编辑器、铺设 Skill + Slash 命令
├── lib/
│   ├── commands/
│   │   ├── init.js           # 初始化配置 + 引导 AI 生成规则包
│   │   ├── scan.js           # 提取文案 → extracted.json
│   │   ├── analyze.js        # 规则匹配 → findings.rule.json
│   │   ├── report.js         # 合并 rule + ai → HTML
│   │   └── template.js       # 生成业务自定义 Excel 模板 + README.md
│   ├── adapters/             # 文件解析器（适配器模式）
│   │   ├── index.js          # 按扩展名分派
│   │   ├── wxml.js           # 正则 + Mustache 提取
│   │   ├── js.js             # @babel/parser（含 jsx）
│   │   ├── json.js           # 路径 + 行号
│   │   ├── vue.js            # @vue/compiler-sfc（可选）
│   │   ├── html.js           # parse5（可选）
│   │   └── react.js          # @babel/parser + jsx（可选）
│   ├── extractor/
│   │   ├── walker.js         # fast-glob 遍历
│   │   ├── normalize.js      # 归一化 / 去重 / 排除
│   │   └── fragment.js       # TextFragment 工厂
│   ├── analyzers/
│   │   ├── banned.js         # 违禁/行业（Aho-Corasick 多模式匹配）
│   │   ├── terminology.js    # 术语统一（别名 → 标准词）
│   │   └── semantic.js       # 页面 glob + 禁用词上下文匹配
│   ├── rules/
│   │   ├── loader.js         # 合并 内置 < AI生成 < 用户自定义
│   │   ├── defaults.js       # 从 ../config/*.default.xlsx 加载内置默认
│   │   ├── parser-md.js      # 解析 markdown 表格规则
│   │   └── parser-xlsx.js    # 解析 xlsx 规则
│   ├── reporters/
│   │   └── html.js           # 生成自包含 HTML
│   ├── config.js             # 读取 text-govern.config.js
│   ├── severity.js           # 中文风险等级 + 排序/阈值
│   ├── constants.js          # 中文严重程度/分类标签
│   └── logger.js
├── config/                   # 内置默认规则（Excel + Markdown 说明）
│   ├── banned.default.xlsx        # ≥ 80 条面向中国大陆通用违禁词
│   ├── terminology.default.xlsx   # ≥ 14 条通用 UI 文案术语
│   ├── semantic.default.xlsx      # 默认空——业务语义强项目相关
│   └── README.md
├── scripts/
│   └── build-default-rules.js     # 内置 Excel 维护脚本
├── skills/
│   ├── text-govern/
│   │   └── SKILL.md          # 主 Skill（承接 6 条 slash 命令 + 直接对话）
│   └── prompts/
│       ├── generate-rules.md # 初始化/更新规则库的多维度 Prompt
│       └── analyze-semantics.md
├── commands/                 # Slash 命令模板（铺设到各编辑器的 commands/ 目录）
│   ├── text-govern.md        # /text-govern：全流程
│   ├── text-govern-init.md   # /text-govern-init：CLI init
│   ├── text-govern-rules.md  # /text-govern-rules：AI 生成规则库
│   ├── text-govern-scan.md   # /text-govern-scan：CLI scan
│   ├── text-govern-analyze.md # /text-govern-analyze：CLI analyze
│   └── text-govern-report.md # /text-govern-report：AI 语义 + report
├── templates/
│   └── report.template.html  # HTML 报告模板
└── test/
    └── text-govern.behavior.test.js  # 行为驱动测试（npm test），10 项
```

### 业务项目根（被治理的项目）

```text
<project-root>/
├── text-govern.config.js     # 项目级配置（必选）
├── text-govern-rules/        # 项目本地规则（建议入 git）
│   ├── custom/               # 业务/合规人工维护，最高优先级
│   │   ├── banned.xlsx
│   │   ├── terminology.xlsx
│   │   ├── semantic.xlsx
│   │   └── README.md         # 业务可读说明
│   └── generated/            # Cursor Agent 生成，业务可微调
│       ├── banned.xlsx
│       ├── terminology.xlsx
│       ├── semantic.xlsx
│       └── README.md         # 本次生成依据 + 维度覆盖说明
└── .text-govern/             # 运行时产物，已加入 .gitignore
    ├── extracted.json
    ├── findings.rule.json
    ├── findings.ai.json
    └── report.html
```

**重要：**

- 用户自定义规则放在业务项目的 `text-govern-rules/custom/`，**不再**放进 CLI 包内
- AI 生成规则放在业务项目的 `text-govern-rules/generated/`，**不再**放进 CLI 包内
- 只有 **内置默认规则** 留在 CLI 包内的 `scripts/text-govern/config/`

---

## 三、核心数据结构

`TextFragment`（提取产物的最小单元）：

```js
{
  id: "wxml#packageA/pages/more/integral/index.wxml:48:24",
  file: "packageA/pages/more/integral/index.wxml",
  line: 48,
  column: 24,
  raw: "累计业绩：",
  normalized: "累计业绩",
  kind: "wxml-text", // wxml-text | wxml-attr | js-literal | json-value | vue-text | jsx-text
  container: "view.total_name",
  surrounding: "…上下文…",
  pageHint: "more/integral"
}
```

`Finding`（命中产物）：

```js
{
  id: "...",
  fragmentId: "wxml#...",
  category: "广告法极限词" | "金融合规" | "术语不统一" | "业务语义歧义" | "用户体验" | "<任意中文>",
  severity: "严重违禁" | "高风险" | "需关注" | "推荐修改" | "<任意中文>",
  matched: "积分",
  suggestion: "业绩",
  reason: "页面属于 more/integral，但业务字段定义为业绩，此处出现积分易引起歧义",
  source: "rule" | "ai",
  rulePack: "semantic.business.integral-vs-points",
  legalRef?: "广告法第九条",
  note?: "AI 生成于 2026-05-12，依据来源页面：xxx"
}
```

要点：

- `category` 与 `severity` 一律使用中文，允许业务自定义任意中文字符串
- `severity` 内部排序在 `lib/severity.js`，未知中文按既定顺序追加，HTML 报告原样展示

---

## 四、CLI 命令

`bin/text-govern.js`（commander）：

| 命令 | 作用 | 退出码 |
|------|------|--------|
| `text-govern init` | 创建 `text-govern.config.js`、`text-govern-rules/{custom,generated}/`、空 Excel 模板与 README.md | 0 |
| `text-govern scan` | 扫描 → `.text-govern/extracted.json` | 0 |
| `text-govern analyze` | 规则匹配 → `.text-govern/findings.rule.json` | 0 |
| `text-govern report` | 合并 rule + ai → `.text-govern/report.html` | 按 `severity.failOn` 决定 |
| `text-govern template [--md]` | 仅重新生成业务自定义模板（默认 Excel；`--md` 切换 Markdown） | 0 |

注册到业务项目根 `package.json`：

```jsonc
{
  "scripts": {
    "text-govern": "node ./scripts/text-govern/bin/text-govern.js",
    "text-govern:init": "node ./scripts/text-govern/bin/text-govern.js init",
    "text-govern:scan": "node ./scripts/text-govern/bin/text-govern.js scan",
    "text-govern:analyze": "node ./scripts/text-govern/bin/text-govern.js analyze",
    "text-govern:report": "node ./scripts/text-govern/bin/text-govern.js report"
  }
}
```

未来 `npm link @scope/text-govern` 后可直接 `text-govern <cmd>`。

---

## 五、配置文件 `text-govern.config.js`

```js
module.exports = {
  /**
   * 行业/业务类型，支持：
   * - 留空：由 Cursor AI 自行判断
   * - 任意中文描述：例如 '医药系统中的代理商专用商贷宝系统'
   * 不再使用 medical/finance/ecommerce 等固定枚举。
   */
  industry: '医药系统中的代理商专用商贷宝系统',

  scan: {
    include: ['pages/**', 'packageA/**', 'packageB/**', 'packageC/**', 'components/**', 'app.json'],
    exclude: ['node_modules/**', 'miniprogram_npm/**', '.text-govern/**', '**/scripts/text-govern/**', '**/*.test.js'],
    adapters: ['wxml', 'js', 'json'],
  },

  // 业务项目本地规则（推荐入 git）
  customRules: { dir: './text-govern-rules/custom' },
  builtinRules: { dir: './text-govern-rules/generated' },

  rules: {
    // 是否启用 CLI 包内 scripts/text-govern/config/*.default.xlsx 中的内置规则
    // 默认 false，避免与项目无关的规则干扰；需要兜底时设为 true
    includeDefaults: false,
  },

  output: { dir: './.text-govern' },

  exclusions: {
    minChineseChars: 2,
    patterns: ['^https?://', '^\\.\\.', '^[A-Za-z0-9_\\-\\.]+$', '^#[0-9a-fA-F]{3,6}$'],
  },

  severity: {
    // 中文阈值；高于该等级的命中会让 CLI 以非零码退出（CI 阻断）
    // 严重违禁 | 高风险 | 需关注 | 推荐修改 | none
    failOn: '严重违禁',
  },
};
```

---

## 六、规则三层模型

```
┌────────────────────────────────────────────────────────────┐
│ 1. 内置默认（最低优先级）                                  │
│    scripts/text-govern/config/*.default.xlsx               │
│    - 广告法极限词、金融合规、医疗合规、政治敏感兜底等       │
│    - 由 lib/rules/defaults.js 通过 parser-xlsx 加载         │
│    - 默认不启用：rules.includeDefaults = false              │
├────────────────────────────────────────────────────────────┤
│ 2. AI 生成（中优先级）                                      │
│    <project>/text-govern-rules/generated/*.xlsx             │
│    - 由 Cursor Agent 跑 generate-rules.md prompt 生成       │
│    - 业务/合规可手动微调；建议 git 入库                     │
├────────────────────────────────────────────────────────────┤
│ 3. 用户自定义（最高优先级）                                  │
│    <project>/text-govern-rules/custom/*.xlsx                │
│    - 项目专属红线，覆盖前两层                                │
└────────────────────────────────────────────────────────────┘
```

合并策略（`lib/rules/loader.js`）：

- 同名规则后者覆盖前者（按 `word` / `canonical` / `pageGlob` 作为合并键）
- Excel 优先于 JSON（JSON 仅保留向后兼容）

---

## 七、规则分析器

| 分析器 | 算法 | 默认严重等级映射 |
|--------|------|---------------|
| `banned.js` | Aho-Corasick 多模式扫描（万级词库 O(n)） | 取 Excel 中的 `severity`，缺省 `需关注` |
| `terminology.js` | 别名 → 标准词聚合，同系统多别名预警 | 取 Excel 中 `severity`，缺省 `需关注` |
| `semantic.js` | 页面 glob + 禁用词上下文匹配 | 取 Excel 中 `severity`，缺省 `需关注`，AI 补充歧义类 |

`lib/severity.js`：

- `SEVERITY_ALIASES`：兼容旧英文（`critical` → `严重违禁`）
- `severityRank`：内置 + 未知中文动态追加
- `meetsThreshold`：失败阈值比较
- `sortFindings`：报告排序

---

## 八、内置默认规则维护

文件：

- `scripts/text-govern/config/banned.default.xlsx`（约 84 条）
- `scripts/text-govern/config/terminology.default.xlsx`（约 14 条）
- `scripts/text-govern/config/semantic.default.xlsx`（默认空）
- `scripts/text-govern/config/README.md`

维护方式：

1. **直接编辑 Excel**（业务/合规友好）
2. **代码维护**：修改 `scripts/text-govern/scripts/build-default-rules.js` 中的 `*_ROWS`，运行 `node scripts/text-govern/scripts/build-default-rules.js` 重新生成

定位：

- 覆盖：广告法极限词、金融合规、医疗合规、不文明用语、轻量政治/封建迷信兜底
- 不覆盖：明确的政治领导人/民族宗教敏感词、色情/赌博/毒品大词库、行业强相关规则——后两类放业务项目的 `text-govern-rules/`

---

## 九、三层封装 + 多编辑器分发

### 三层架构

```
text-govern (npm 包)
│
├── Layer 1: CLI bin (bin/text-govern.js)
│   纯算法、无 AI 依赖、可跑 CI
│   命令：init / scan / analyze / report / template / install
│
├── Layer 2: Skill (skills/text-govern/SKILL.md)
│   AI 编排说明书，一份跨编辑器复用
│   带 disable-model-invocation，只在显式调用时加载
│   内置命令路由表：/text-govern* → 对应执行分支
│
└── Layer 3: Slash Commands (commands/text-govern*.md)
    各编辑器的入口快捷方式
    由安装器拷贝到 .cursor/commands/ / .claude/commands/
```

### 安装器 `bin/install.js`

`text-govern install` 子命令：

1. 探测 `.cursor/` / `.claude/` / `.codex/` 目录自动识别编辑器
2. 按 `--scope project|global` 决定目标根目录
3. 铺设 Skill 目录（所有编辑器）+ Slash 命令文件（Cursor/Claude）

| 编辑器 | Skill 目标 | Slash 命令目标 |
|--------|-----------|---------------|
| Cursor | `.cursor/skills/text-govern/` | `.cursor/commands/text-govern*.md` |
| Claude Code | `.claude/skills/text-govern/` | `.claude/commands/text-govern*.md` |
| Codex | `.codex/skills/text-govern/` | 不铺（已弃用 custom prompts） |

选项：`--editor cursor,claude,codex`、`--force`、`--dry-run`

### Slash 命令 → Skill 路由

| 命令 | 执行分支 |
|------|---------|
| `/text-govern` | 全流程 5 步 |
| `/text-govern-init` | CLI init |
| `/text-govern-rules` | Init 场景步骤 A~E（AI 生成 Excel 规则库） |
| `/text-govern-scan` | CLI scan |
| `/text-govern-analyze` | CLI analyze |
| `/text-govern-report` | AI 语义 + CLI report |

### 编排 A · 日常治理 5 步（`/text-govern` 或直接对话）

1. `text-govern scan`
2. `text-govern analyze`
3. 读取 `.text-govern/extracted.json`，按 `prompts/analyze-semantics.md` 做 AI 语义分析，写 `findings.ai.json`
4. `text-govern report`
5. 输出 `.text-govern/report.html` 路径 + TOP 5 严重问题

### 编排 B · 初始化/更新规则库

Agent 严格按 `prompts/generate-rules.md` 执行，**角色 = 合规审核 + 产品经理 + 运营 + UX writer**，
覆盖 6 个治理维度，**不止合规**：

1. 合规底线（违禁/极限词/行业合规/政治宗教民族）
2. 品牌与调性（客户称谓、产品名一致、B 端/C 端口吻）
3. 术语统一（同义异写、动作动词、字段名）
4. 页面级业务语义（同字段在不同页面的语义歧义）
5. 用户体验文案（错误提示、空状态、加载、按钮、对话框、隐私提示）
6. 文案上下文信号（pageHint / surrounding / container / kind 辅助判断）

输出：

- `text-govern-rules/generated/banned.xlsx`
- `text-govern-rules/generated/terminology.xlsx`
- `text-govern-rules/generated/semantic.xlsx`
- `text-govern-rules/generated/README.md`（必选，Markdown）

约束：

- `风险等级` / `分类` 必须中文，允许业务自定义
- 每条规则的 `备注` 写清"证据片段 / 来源页面 / 触发条件"
- 不要堆砌通用词典；只输出本项目有证据的规则

---

## 十、HTML 报告

- 单文件、内联 CSS/JS、无外部依赖
- 顶部统计卡片：按 `severity`（动态中文）计数 + 按 `category` 饼图
- 主表格：文件 / 行 / 命中词 / 建议 / 等级 / 分类 / 原因 / 来源（rule/ai）
- 交互：左侧筛选（severity / category 多选、文件搜索），表头排序，行点击展开 surrounding 上下文
- 中文 slug：通过 `slug()` 函数把中文等级/分类映射为合法 DOM id

---

## 十一、依赖清单（`scripts/text-govern/package.json`）

- `commander` — CLI 解析
- `fast-glob` — 文件遍历
- `@babel/parser` `@babel/traverse` `@babel/types` — JS/JSX AST
- `@vue/compiler-sfc`（可选）— Vue SFC
- `parse5`（可选）— HTML
- `xlsx` — Excel 模板生成 + 解析（一等公民）
- `chalk` — 终端输出

包形态（v3）：

- `name`: `text-govern`，`version`: `0.1.0`
- `bin`: `{ "text-govern": "./bin/text-govern.js" }`
- `files`: `["bin", "lib", "config", "skills", "commands", "templates", "scripts", "README.md", "LICENSE"]`
- `prepublishOnly`: `node scripts/build-default-rules.js && npm test`
- 通过 `npx text-govern install` 分发 Skill + Slash 命令

---

## 十二、测试

`test/text-govern.behavior.test.js`（`npm test` 运行）覆盖 10 项：

1. `init` 默认生成空的 Excel 模板 + Markdown README，industry 默认为空字符串
2. `package.json` 为可发布 CLI 包（`text-govern`，含 bin/files/prepublishOnly）
3. 中文 severity / category 在 `severity.js` 中正确归一化与统计
4. AI 生成的 Excel 规则可被 loader 正确加载
5. 内置默认规则从 `config/*.default.xlsx` 加载，覆盖 广告法极限词 / 金融合规 / 医疗合规 三类
6. `text-govern init` 在 `text-govern-rules/custom/` 生成 `README.md`，不再生成 `README.xlsx`
7. `install --editor cursor` 铺设 SKILL.md + 6 个 slash 命令到 `.cursor/`
8. `install --editor claude` 铺设到 `.claude/`
9. `install` 幂等：连跑两次不报错、不丢文件
10. `install --dry-run` 不写入任何文件

---

## 十三、各版本主要差异对照

| 维度 | v1 初始方案 | v2（规则 Excel 化） | v3（三层多编辑器） |
|------|----------|----------|----------|
| 风险等级 / 分类 | 英文枚举 | 中文自定义字符串 | 同 v2 |
| 行业 industry | 固定枚举 | 留空或任意中文描述 | 同 v2 |
| 自定义规则位置 | `scripts/text-govern/custom/` | `text-govern-rules/custom/` | 同 v2 |
| AI 生成规则位置 | `scripts/text-govern/rules/` | `text-govern-rules/generated/` | 同 v2 |
| 内置默认规则 | `defaults.js` 硬编码 | `config/*.default.xlsx` | 同 v2 |
| 规则格式 | Markdown 优先 | Excel 优先，Markdown 兼容 | 同 v2 |
| 规则生成视角 | 合规 + 行业 | 6 维度（含 UX/品牌/语义） | 同 v2 |
| 包名 / 形态 | 局部脚本（private） | `text-govern`（bin 入口） | `text-govern`（含 files/prepublishOnly） |
| Skill | 无 | Cursor Skill | Cursor + Claude Code + Codex Skill（disable-model-invocation） |
| Slash 命令 | 无 | 无 | 6 条（text-govern / -init / -rules / -scan / -analyze / -report） |
| 安装器 | 无 | 无 | `text-govern install`（--editor/--scope/--force/--dry-run） |

---

## 十四、后续演进方向

- 正式发布 `text-govern` 到 npm public registry（当前已可 `npm publish --dry-run` 验证）
- 抽离为独立 git 仓库（例如 `YomiHub/text-govern`，与 npm 包名 `text-govern` 对应），通过 `npm link` 引入各业务项目
- 自带预设词库子包（如 `text-govern-rules-cn-baseline`），供 `rules.includeDefaults` 之外的可选叠加
- 支持 `text-govern watch` 在开发期增量提示
- 接入 PR 评论：CI 中跑 analyze → 在 PR 上写差异化整改清单
- 后续考虑 stdio MCP 模式，让 Cursor/Claude Desktop 直接以工具形式调用 CLI
