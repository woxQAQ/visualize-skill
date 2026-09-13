# visualize-skills

在 Codex 对话中绘制交互式架构图、时序图和泳道图。声明节点与关系，由 Skill 检查布局并生成可直接嵌入的 HTML 片段，继承 Codex 的配色和明暗主题，根据容器宽度等比例缩放，支持关联强调；节点详情暂时停用，保留实现。

使用入口见 [SKILL.md](SKILL.md)，接口见 [references/api.md](references/api.md)。不提供报告编排或 Markdown 正文处理。

## 安装

```sh
npx skills add git@github.com/woxQAQ/visualize-skill
```

## 开发

使用 Nix 管理的环境，Node.js 22.18+ 与 `package.json` 声明的 pnpm 版本：

```sh
devenv shell
pnpm test
pnpm example
pnpm example:sequence
pnpm example:swimlane
```

生成图表无需安装运行时依赖或构建。例子输出到忽略的 `output/`，交付方式是将片段嵌入 Codex 对话。
