# visualize-skills

将架构、依赖和同步调用声明成 TypeScript，生成可离线交互阅读的 HTML。Skill 手册、源码、模板与参考文档一起使用。

## 使用

需要 Node.js 22.18+。直接运行源码，无需安装依赖或构建：

```sh
node src/cli.ts examples/self-explanation.ts -o output/self-explanation.html
```

在自己的目录编写内容脚本时，从 Skill 的 `src/index.ts` 导入接口，相对导入路径以内容脚本所在目录为基准，再用同一个 `src/cli.ts` 生成 HTML。具体步骤见 [Skill 手册](SKILL.md)，接口见 [API 索引](references/api.md)。

分发时复制完整目录，保留 `SKILL.md`、`package.json`、`src/`、`references/` 和 `examples/`。`package.json` 声明 ES module；其中的开发依赖不影响直接运行。

## 开发

开发环境由 `devenv.nix` 和 `devenv.yaml` 管理，使用 `devenv shell` 进入。只有类型检查需要安装开发依赖：

```sh
pnpm install --frozen-lockfile
pnpm test
```

`pnpm test` 先执行严格类型检查，再运行测试。源码、示例和测试均参与检查，`test/contracts.ts` 包含类型约束的反例。分发测试将 Skill 复制到没有依赖和构建产物的临时目录，验证直接运行及外部内容脚本。

`pnpm example` 生成系统自我解释报告，`pnpm example:single` 生成单张架构图。HTML 直接在浏览器中打开。

HTML、CSS 和交互模板位于 `src/templates/`。交互使用浏览器可直接执行的 JavaScript，以 JSDoc 标注类型并参与严格检查；渲染时原样内嵌，不生成中间文件。模块关系与设计取舍见 [架构说明](docs/architecture.md)。
