# visualize-skills

生成可交互的架构图、时序图和泳道图，用于解释组件依赖、同步调用和跨负责方的活动流转。悬停或键盘聚焦节点可突出相关连接，方便阅读关系。

通过 TypeScript 声明图表，生成器检查布局并输出独立 HTML 页面，可直接在浏览器中打开，保存或分享。页面包含全部样式与交互，随浏览器明暗偏好和容器宽度调整显示。也支持输出继承宿主主题的嵌入片段，用于 Codex 原生可视化展示。

运行需要 Node.js 22.18+，无需安装依赖或构建。使用方式见 [SKILL.md](SKILL.md)。

## 安装

```sh
npx skills add git@github.com/woxQAQ/visualize-skill
```
