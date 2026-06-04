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

# 发布前自检（与 prepublishOnly 一致；publish 时也会再跑一遍）
npm run build:defaults   # 可选，与 prepublish 一致
npm test
npm pack --dry-run       # 确认包内容与版本

# 升小版本号（0.1.0 → 0.1.1）
npm version patch    # patch（小修复、不影响功能）或 minor（新增功能、向下兼容） / major（大改版、不兼容旧版本）

npm publish --registry=https://registry.npmjs.org/
（npm version 会改 package.json/package-lock.json 版本并打 git tag；若不想动 git，也可手改版本号后再 npm publish。）

# 核对线上版本
npm view text-govern version

# 更新版本
npm update -g text-govern --registry=https://registry.npmjs.org/

# 查看本地安装的版本
npm list -g text-govern
```

**发布说明**：未限定作用域的包使用 `npm publish` 即可公开发布；只有带 `@scope/` 的包首次发布才需要 `npm publish --access public`。
