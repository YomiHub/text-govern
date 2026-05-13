# text-govern

自动化文案治理 CLI + AI Skill。静态扫描源码、规则匹配、AI 语义分析、生成 HTML 整改报告；规则以 Excel 为一等公民，支持通过 `/text-govern-*` slash 命令在 Cursor / Claude Code / Codex 中直接触发。

## 安装

### 方式一：npx（推荐，免全局安装）

```bash
# 把 Skill + Slash 命令铺设到当前项目的 .cursor / .claude / .codex 目录
npx text-govern install

# 只装 Cursor
npx text-govern install --editor cursor

# 装到用户全局（对所有项目生效）
npx text-govern install --scope global
```

安装后在 Cursor 输入 `/text-govern-init` 开始使用。

### 方式二：全局安装

```bash
npm install -g text-govern
text-govern install
```

### 方式三：当前 monorepo 内置源码（本地开发）

本仓库 **`package.json` 根目录未挂载 `npm run text-govern:*` 脚本**时，请直接用 **`node` 指向 CLI 入口**（工作目录始终在**业务项目根**，即微信小程序仓库根）。

```bash
# 1) 一次性安装 CLI 包依赖（在 text-govern 子目录）
cd scripts/text-govern && npm install

# 2) 在业务项目根（本 monorepo 一般为仓库根目录，含 app.json 与 scripts/text-govern/）
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

| 命令                   | 说明                                              | 是否需要 AI |
| ---------------------- | ------------------------------------------------- | ----------- |
| `/text-govern`         | 全流程：扫描 → 规则匹配 → AI 语义分析 → HTML 报告 | 是          |
| `/text-govern-init`    | 初始化配置与模板                                  | 否          |
| `/text-govern-rules`   | AI 按 6 维度生成 Excel 规则库                     | 是          |
| `/text-govern-scan`    | 扫描源码，提取中文文案片段                        | 否          |
| `/text-govern-analyze` | 规则匹配分析，输出 findings.rule.json             | 否          |
| `/text-govern-report`  | AI 语义分析 + 生成 HTML 报告                      | 是          |

Codex 已弃用 custom prompts，统一通过加载 Skill 触发（输入「用 text-govern 跑 rules」即可）。

## CLI 命令

不依赖 AI 的命令可在任何环境直接运行（包括 CI）：

```bash
text-govern init        # 初始化配置
text-govern scan        # 扫描源码 → .text-govern/extracted.json
text-govern analyze     # 规则匹配 → .text-govern/findings.rule.json
text-govern report      # 合并 rule+ai → .text-govern/report.html
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
  industry: "医药系统中的代理商专用商贷宝系统",

  scan: {
    include: ["pages/**", "packageA/**", "packageB/**", "packageC/**", "components/**", "app.json"],
    exclude: ["node_modules/**", "miniprogram_npm/**", ".text-govern/**", "**/*.test.js"],
    adapters: ["wxml", "js", "json"],
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

来自 CLI 包内 `config/*.default.xlsx`，涵盖：

- 广告法极限词（84 条）
- 金融合规（12 条）
- 医疗合规（11 条）
- 不文明用语 / 封建迷信（轻量兜底）

编辑方式：直接打开 Excel，或修改 `scripts/build-default-rules.js` 后运行重新生成。

### AI 生成规则（推荐主力）

在 IDE 中执行 `/text-govern-rules`，AI 按 6 维度生成到 `text-govern-rules/generated/`：

1. 合规底线（违禁/极限词/行业合规/政治宗教民族）
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
| `.text-govern/report.html`        | 自包含 HTML 整改报告（可直接浏览器打开） |

## 推荐工作流

```
# 1. 在新项目安装
npx text-govern install

# 2. 初始化（在 IDE 里或命令行）
text-govern init           # 或 /text-govern-init

# 3. 生成规则库（在 Cursor/Claude Code 里）
/text-govern-rules         # AI 读取源码，按 6 维度生成 Excel

# 4. 确认规则后提交
git add text-govern-rules/
git commit -m "feat: 初始化文案治理规则库"

# 5. 日常检查（在 IDE 里或 CI）
/text-govern               # 完整流程
# 或
text-govern scan && text-govern analyze && text-govern report
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

# 本包发包流程

## 一、一次性准备

注册 npm 账号
在 npmjs.com 注册并登录。

本机登录

```bash
npm logout --registry=https://registry.npmjs.org/

npm login --auth-type=legacy --registry=https://registry.npmjs.org/
或者
# 1. 设置 token（在 npmjs.com 生成后）
npm config set //registry.npmjs.org/:_authToken npm_你的TokenHere
# 2. 确认登录账号
npm whoami --registry=https://registry.npmjs.org/

确认包名未被占用（你当前包名是 text-govern）

npm view text-govern version
若返回版本号：说明已被别人占用，需改 package.json 里的 name 再发布。
若 404 / E404：通常表示可尝试占用（仍以发布时 npm 为准）。
进入包目录并安装依赖

cd scripts/text-govern
npm install
```

## 二、发布前自检（强烈建议）

跑测试与构建（你项目里 prepublishOnly 会在发布时自动跑）

```bash
cd scripts/text-govern
npm run build:defaults   # 可选，与 prepublish 一致
npm test
看将要打进包的文件

npm pack --dry-run
确认第一行是 text-govern@x.y.z，且 bin、lib、commands 等都在列表里。

（可选）模拟发布

npm publish --dry-run --registry=https://registry.npmjs.org/
```

## 三、正式发布

无 scope 的公开包：

```bash
cd scripts/text-govern
npm publish --registry=https://registry.npmjs.org/

一次性验证码
npm publish --access public --registry=https://registry.npmjs.org/ --otp

不需要 npm publish --access public（那是给 scoped 包 @xxx/pkg 首次公开用的）。
若账号开了 2FA，按 npm 提示在浏览器或 OTP 完成验证。
发布后几秒到几分钟内，-registry 上会能看到包页：https://www.npmjs.com/package/text-govern（名称以你 package.json 为准）。

核对
npm view text-govern version
```

## 四、别人怎么用（你的目标）

```bash
npx text-govern install
npx text-govern scan
# 或固定版本
npx text-govern@0.1.0 install
npx 会按需从 registry 拉包并执行 bin 里的 text-govern。
```

## 五、以后发新版本

```bash
cd scripts/text-govern
npm version patch    # 或 minor / major
npm publish
（npm version 会改 package.json/package-lock.json 版本并打 git tag；若不想动 git，也可手改版本号后再 npm publish。）
```

**发布说明**：未限定作用域的包使用 `npm publish` 即可公开发布；只有带 `@scope/` 的包首次发布才需要 `npm publish --access public`。
