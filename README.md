# text-govern

自动化文案治理 CLI + AI Skill。静态扫描源码、规则匹配、AI 语义分析、生成 HTML 整改报告；规则以 Excel 为一等公民，支持通过 `/text-govern-*` slash 命令在 Cursor / Claude Code / Codex 中直接触发。

## 安装

### 方式一：npx（推荐，免全局安装）

- npx text-govern install --scope global 做的是把 Skill / Slash 命令「复制」到你本机用户目录下的 Cursor / Claude 等配置里，并不等价于「装了一个全局 npm 包」

```bash
# 把 Skill + Slash 命令铺设到当前项目的 .cursor / .claude / .codex 目录
npx text-govern install

# 只装 Cursor
npx text-govern install --editor cursor

# 装到用户全局（对所有项目生效）
npx text-govern install --scope global

# 查看安装版本
npx text-govern --version
npx text-govern@latest install --scope global --force
```

安装后在 Cursor 输入 `/text-govern-init` 开始使用。

### 方式二：全局安装

```bash
npm install -g text-govern
text-govern install
text-govern --version
npm install -g text-govern@lates
```

### 方式三：当前 monorepo 内置源码（本地开发）

本仓库 **`package.json` 根目录未挂载 `npm run text-govern:*` 脚本**时，请直接用 **`node` 指向 CLI 入口**（工作目录始终在**业务项目根**，可以是前端项目根，也可以是 Java 后端 monorepo 根）。

```bash
# 1) 一次性安装 CLI 包依赖（在 text-govern 子目录）
cd scripts/text-govern && npm install

# 2) 在业务项目根（含 scripts/text-govern/；Java 多模块项目可直接在 monorepo 根执行）
node scripts/text-govern/bin/text-govern.js install --editor cursor,claude
# 预览不写盘：node scripts/text-govern/bin/text-govern.js install --dry-run --editor cursor

# 3) 日常 CLI（均在项目根执行）
node scripts/text-govern/bin/text-govern.js init
node scripts/text-govern/bin/text-govern.js scan
node scripts/text-govern/bin/text-govern.js analyze
node scripts/text-govern/bin/text-govern.js report
```

可选：若希望 Shell 里直接打 `text-govern`（免写长路径），可在 `scripts/text-govern` 下执行 **`npm link`**，全局链到当前开发版二进制。

如需重新生成内置默认 Excel，可在 `scripts/text-govern` 下执行：**`npm run build:defaults`**；跑回归测试：**`npm test`**。

## Slash 命令一览

安装后在 Cursor / Claude Code 的 Agent 对话框中输入：

| 命令                   | 说明                                                                   | 是否需要 AI |
| ---------------------- | ---------------------------------------------------------------------- | ----------- |
| `/text-govern`         | 已init和生成rules后走全流程：扫描 → 规则匹配 → AI 语义分析 → HTML 报告 | 是          |
| `/text-govern-init`    | 初始化配置与模板                                                       | 否          |
| `/text-govern-rules`   | AI 按 6 维度生成 Excel 规则库（会前置检查执行scan）                       | 是          |
| `/text-govern-scan`    | 扫描源码，提取中文文案片段                                             | 否          |
| `/text-govern-analyze` | 规则匹配分析，输出 findings.rule.json                                  | 否          |
| `/text-govern-report`  | AI 语义分析 + 生成 HTML 报告                                           | 是          |

Codex 已弃用 custom prompts，统一通过加载 Skill 触发（输入「用 text-govern 跑 rules」即可）。

## CLI 命令

不依赖 AI 的命令可在任何环境直接运行（包括 CI）：

```bash
text-govern init        # 初始化配置
text-govern scan        # 扫描源码 → .text-govern/extracted.json
text-govern analyze     # 规则匹配 → .text-govern/findings.rule.json
text-govern report      # 合并 rule+ai → .text-govern/report/index.html
text-govern template    # 重新生成空 Excel 模板
text-govern install     # 铺设 Skill + Slash 命令到 IDE
```

### install 选项

```
text-govern install [options]

Options:
  --editor <list>    编辑器（cursor,claude,codex，逗号分隔；默认自动探测）
  --scope <scope>    project | global（默认 project）
  --force            覆盖已有资产
  --dry-run          仅打印计划，不实际写入
  --cwd <dir>        工作目录（project scope 有效）
```

## 三层架构

```
text-govern
├── Layer 1: CLI bin          纯算法层，无 AI 依赖，可跑 CI
│   bin/text-govern.js
├── Layer 2: Skill            AI 编排说明书，跨编辑器复用
│   skills/text-govern/SKILL.md
│   skills/prompts/generate-rules.md
│   skills/prompts/analyze-semantics.md
└── Layer 3: Slash 命令       各编辑器的入口快捷方式
    commands/text-govern*.md
```

`text-govern install` 负责把 Layer 2+3 资产拷贝到 `.cursor/` / `.claude/` / `.codex/` 目录。

## 跨编辑器兼容矩阵

| 编辑器      | Skill 载体                            | Slash 命令                         | 安装后自动探测             |
| ----------- | ------------------------------------- | ---------------------------------- | -------------------------- |
| Cursor      | `.cursor/skills/text-govern/SKILL.md` | `.cursor/commands/text-govern*.md` | 是（检测 `.cursor/` 目录） |
| Claude Code | `.claude/skills/text-govern/SKILL.md` | `.claude/commands/text-govern*.md` | 是（检测 `.claude/` 目录） |
| Codex       | `.codex/skills/text-govern/SKILL.md`  | 不铺（已弃用 prompts）             | 是（检测 `.codex/` 目录）  |

## 配置

```js
// text-govern.config.js（在项目根目录）
module.exports = {
  // 可留空，让 AI 根据源码判断；也可填任意中文业务描述
  industry: "医院信息系统",

  scan: {
    // 默认可覆盖前端项目和 Java 多模块后端；只处理 adapters 支持的文件后缀。
    include: ["**/*"],
    // Java 后端也可收窄为 ["*/src/main/**"] 或 ["bfcn-core/src/main/**"]。
    exclude: ["node_modules/**", "miniprogram_npm/**", ".text-govern/**", "target/**", "**/target/**", "build/**", "**/build/**", ".gradle/**", "**/.gradle/**", "**/*.test.js"],
    adapters: ["wxml", "js", "json", "vue", "jsx", "html", "java", "yaml", "properties"],
    backend: {
      includeComments: false,
      includeLogMessages: true,
      includeAnnotations: true,
    },
  },

  customRules: { dir: "./text-govern-rules/custom" },
  builtinRules: { dir: "./text-govern-rules/generated" },

  rules: {
    // 是否启用内置默认词库（config/*.default.xlsx）
    // 默认 false，只用项目 AI 生成 / 自定义规则
    includeDefaults: false,
  },

  output: { dir: "./.text-govern" },

  severity: {
    // 严重违禁 | 高风险 | 需关注 | 推荐修改 | none
    failOn: "严重违禁",
  },
}
```

## 规则三层与优先级

```
内置默认（可选） < AI 生成 text-govern-rules/generated/*.xlsx < 用户自定义 text-govern-rules/custom/*.xlsx
```

### 内置默认规则（`rules.includeDefaults: true`）

来自 CLI 包内 `config/banned.default.xlsx`，由构建期脚本从公开开源词库拉取生成：

| 分类 | 风险等级 | 词库来源 |
|---|---|---|
| 色情违规 | 严重违禁 | konsheng/Sensitive-lexicon (MIT) |
| 政治敏感 | 严重违禁 | konsheng/Sensitive-lexicon (MIT) |
| 暴恐违禁 | 严重违禁 | konsheng/Sensitive-lexicon (MIT) |
| 涉枪涉爆 | 严重违禁 | konsheng/Sensitive-lexicon (MIT) |
| 广告违规 | 高风险 | konsheng/Sensitive-lexicon + fwwdn/sensitive-stop-words (Apache-2.0) |

commit SHA 及许可声明见 `scripts/text-govern/config/THIRD_PARTY_NOTICES.md`。

**有意不覆盖**（请通过 `/text-govern-rules` 让 AI 按项目行业自主判定生成）：行业专有合规词（如绝对化用语、功效宣称、保本承诺等，适用范围因行业而异）、金融合规、医疗合规、教育合规等行业强相关词汇。

**如何刷新基线**（需要网络连接）：

```bash
cd scripts/text-govern
npm run fetch:baseline   # 从上游重新拉取，覆盖 config/banned.default.xlsx
npm run build:defaults   # 等同于 fetch:baseline + 重写 terminology/semantic xlsx
```

### AI 生成规则（推荐主力）

在 IDE 中执行 `/text-govern-rules`，AI 按 6 维度生成到 `text-govern-rules/generated/`：

1. 合规底线（违禁/行业合规/政治宗教民族；AI 按系统类型自主判定适用法规）
2. 品牌与调性（客户称谓、产品名一致、B 端/C 端口吻分寸）
3. 术语统一（同义异写、动作动词、字段名）
4. 页面级业务语义（同字段在不同页面的语义歧义）
5. 用户体验文案（错误提示、空状态、加载、按钮、危险操作）
6. 文案上下文信号（pageHint / surrounding / container / kind 辅助）

### 自定义规则（最高优先级）

`text-govern-rules/custom/` 由业务/合规同学手工维护，编辑 Excel 后立即生效。

## Excel 规则格式

### banned.xlsx — 违禁违规词

Sheet 名：`违禁违规词`

| 词  | 替换建议 | 风险等级 | 分类 | 法规来源 | 备注 |
| --- | -------- | -------- | ---- | -------- | ---- |

- `风险等级` 和 `分类` 均为中文自由值
- 推荐风险等级：`严重违禁` / `高风险` / `需关注` / `推荐修改`

### terminology.xlsx — 术语统一

Sheet 名：`术语统一`

| 标准词 | 别名（逗号分隔） | 备注 |
| ------ | ---------------- | ---- |

### semantic.xlsx — 业务语义

Sheet 名：`业务语义`

| 页面/路径 glob | 字段含义 | 禁用替代词 | 推荐词 | 备注 |
| -------------- | -------- | ---------- | ------ | ---- |

## 输出文件

| 文件                              | 说明                                     |
| --------------------------------- | ---------------------------------------- |
| `.text-govern/extracted.json`     | 文案提取结果                             |
| `.text-govern/findings.rule.json` | 规则匹配结果                             |
| `.text-govern/findings.ai.json`   | AI 语义分析结果                          |
| `.text-govern/report/index.html`        | HTML 整改报告（入口为 index.html） |

## 推荐工作流

若未全局安装 CLI，将下面命令中的 `text-govern` 换成 `npx -y text-govern`；或使用本仓库内置 CLI：`node scripts/text-govern/bin/text-govern.js`（与 Slash 命令中的 **TG_CMD** 解析规则一致）。

```
# 1. 在新项目安装
npx text-govern install

# 2. 初始化（在 IDE 里或命令行）
text-govern init           # 或 /text-govern-init；无全局命令时：npx -y text-govern init

# 3. 生成规则库（在 Cursor/Claude Code 里）
/text-govern-rules         # AI 读取源码，按 6 维度生成 Excel

# 4. 确认规则后提交
git add text-govern-rules/
git commit -m "feat: 初始化规则库"

# 5. 日常检查（已经生成rules之后，在 IDE 里或 CI）
/text-govern               # 完整流程
# 或
text-govern scan && text-govern analyze && text-govern report   # 无全局时前缀同上
```

## 文件类型支持

| 适配器 | 文件扩展名     | 说明                              |
| ------ | -------------- | --------------------------------- |
| `wxml` | `.wxml`        | 微信小程序模板                    |
| `js`   | `.js` `.wxs`   | JS + Babel AST                    |
| `json` | `.json`        | JSON 值提取                       |
| `vue`  | `.vue`         | Vue SFC（需 `@vue/compiler-sfc`） |
| `jsx`  | `.jsx` `.tsx`  | JSX（需 `@babel/parser`，已内置） |
| `html` | `.html` `.htm` | HTML（需 `parse5`）               |
| `java` | `.java`        | Java 后端运行时字符串、注解、日志/异常/返回文案 |
| `yaml` | `.yml` `.yaml` | YAML 配置值（默认跳过注释）       |
| `properties` | `.properties` | Properties 配置值（默认跳过注释） |
