# plainspoken-writing-dsh

> **DSH 白描写作协作模式插件**  
> *Plainspoken Writing for DeepSeek Harness — AI-flavor diagnosis, mechanical cleanup, rewrite validation, and a clean writing workspace.*

把 [Plainspoken Writing（白描）](https://github.com/taxueseek/plainspoken-writing) 的检测与改写能力接进 DSH：一个干净的写作预设、三个白描工具、一层工作区规则注入。默认只诊断，改写要你确认。

## 它做什么

- **白描写作预设**：接管系统提示词，去掉工程化噪声，只留下「对话优先、改稿只做精准替换、不列代码审阅式修改清单」的协作底座。
- **两个职能**：
  - `writer`（白描写作者，默认）：先诊断，确认后按直陈白描改写；保留事实、数字与承诺强度，结尾自然留白。
  - `detect`（白描检测员）：只出检测报告，不改一个字。
- **三个工具**：
  - `plainspoken_analyze`：25 维 AI 味检测、浓度分级、原文证据、可操作建议。
  - `plainspoken_rewrite`：机械预清理（删已知套话）；没有可清理内容时如实返回 `changed=false`，不假装改写。
  - `plainspoken_validate`：核验改写是否保真（事实、承诺强度、新 AI 味、结尾）。
- **工作区规则**：可选读取 `AGENTS.md` / `CLAUDE.md` / `memory/*.md` / `rules/*.md`，作为第三层提示词注入。
- **纯净工具面**：可选隐藏从全局继承的工具，只留本地读写、查找与白描工具。

## 安装

本地开发：

```bash
cd /path/to/plainspoken-writing-dsh
npm run build
npm test
dsh plugin --profile web add /path/to/plainspoken-writing-dsh
```

没有全局 `dsh` CLI 时用：

```bash
npx @deepseek-ai/dsh plugin --profile web add /path/to/plainspoken-writing-dsh
```

安装后重启 DSH，在预设选择器里选 **白描写作**。插件不会修改宿主的默认预设。

## 设置

**设置 → 白描写作配置**：

- 职能：白描写作者 / 白描检测员
- 是否附加「文档与工具协作准则」
- 强制纯净工具面
- Python 引擎目录（留空用插件内置 `engine/`）
- 报告最多展示几维
- 工作区提示模式：初始纯净 / 自定义 / 工作区识别
- 工作区文档预算与父目录规则

设置即时生效；强制工具面在下一步或新会话生效。

## 引擎

插件自带 `engine/`（`core/` + `rules/` + `cli.py`），不依赖外部安装。更新项目引擎后同步：

```bash
npm run sync-engine
```

也可以用设置里的「Python 引擎目录」指向 `plainspoken-writing` 仓库根目录，直接使用最新代码。

CLI 也可以单独调用：

```bash
echo '{"text":"综上所述……"}' | python3 engine/cli.py analyze
echo '{"text":"……","mode":"auto"}' | python3 engine/cli.py rewrite
echo '{"original":"……","rewritten":"……"}' | python3 engine/cli.py validate
```

## 目录

```
plainspoken-writing-dsh/
├── cordis.patch.yml        # 预设、persona、工具面
├── src/
│   ├── index.ts            # 配置 + {{plainspoken_brick}} 注入
│   ├── presets.ts          # 两层提示词积木
│   ├── tools.ts            # plainspoken_analyze / rewrite / validate
│   ├── shared.ts           # 引擎路径与工具面开关
│   ├── tool-surface.ts     # 强制纯净工具面
│   └── client/panel.js     # 设置页
├── engine/                 # 内置 Python 引擎（由 sync-engine.sh 同步）
├── scripts/
├── tests/verify-bundle.mjs
└── dist/                   # 构建产物（src 为唯一真源）
```

## 边界

- 引擎的 `rewrite` 只做机械预清理，不调用 LLM；需要判断的改写由模型按白描原则完成。
- 默认只诊断；用户明确要求后才改。
- 去 AI 味 ≠ 好内容。文本干净但内容空，插件会直说。
