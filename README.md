# visualize-skills

生成可交互的架构图、时序图和泳道图，分别解释职责边界与组件依赖、同步与异步消息、跨负责方的活动流转。架构分区表达共同职责或归属，连线说明组件间使用的能力与契约。悬停或键盘聚焦节点可突出相关连接，方便阅读关系。

通过 TypeScript 声明图表，生成器检查布局并输出独立 HTML 页面，可直接在浏览器中打开，保存或分享。页面包含全部样式与交互，随浏览器明暗偏好和容器宽度调整显示。也支持输出继承宿主主题的嵌入片段，用于 Codex 原生可视化展示。

运行需要 Node.js 22.18+，无需安装依赖或构建。内容脚本调用 SDK 声明和渲染图表，再用 Node 的 `writeFile()` 保存 HTML，直接执行 `node diagram.ts`。使用方式见 [SKILL.md](SKILL.md)。

## 安装

```sh
npx skills add git@github.com/woxQAQ/visualize-skill
```
