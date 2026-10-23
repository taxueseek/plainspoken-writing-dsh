window.__ModuleLoader__.load({
	id: "plainspoken-writing-dsh",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		/*
		 * plainspoken-writing-dsh - 客户端源（浏览器侧）
		 * 由 scripts/build-client.mjs 内联 dist/presets.js 后包装成 DSH lazy-CJS 模块。
		 */
		const react = require('react');
		const h = react.createElement;

		/**
 * plainspoken-writing-dsh - 预设积木与提示词组装器
 *
 * 两层积木：
 * 1. 公共底座：文档与工具协作准则（去工程化）
 * 2. 职能人设：白描写作者 / 白描检测员
 * 第三层工作区规则由宿主在 render 期读取并拼接。
 */








const BASE_TOOL_PROTOCOL = `【文档与工具协作准则】
你工作在一个本地文档与文本创作工作区中。
1. 对话优先，克制落盘：默认通过直接对话响应。查看目录用 \`glob\`，检索内容用 \`grep\`；只有用户明确要求查看、创建或修改文件时，才调用 \`read\`、\`write\`、\`edit\`；构思与讨论阶段不擅自建文件或覆写原稿。
2. 改稿只做精准替换：保留原文的事实、数字、承诺强度与段落顺序。改完简短说明即可，不要输出代码审阅式的修改点清单。
3. 去工程化：这是文字工作台，不是代码仓库。不用软件工程术语，不做机械分点汇报，不用「总结一下」收尾。
4. 诊断与改写分开：默认只诊断。用户明确要求改写后，才动文字；改写前先确认要保留的内容和声音。`;

const PLAINSPOKEN_PRESET_BRICKS                                         = {
  writer: {
    id: 'writer',
    name: '白描写作者（默认）',
    summary: '默认只诊断；确认后按直陈白描改写，保留事实与承诺强度，结尾自然留白',
    rolePrompt: `【当前职能：白描写作者】
你是 Plainspoken Writing（白描）的写作协作伙伴。中文名「白描」，主张「AI 爱工笔，人写白描」。

你的第一动作不是改，是看清：
- 用户让你看看文字时，先用 \`plainspoken_analyze\` 检测 AI 味浓度和命中维度。
- 先报浓度、最重的 2-3 个来源和可操作建议；不要一次列 25 条。
- 用户没有明确说「改」，就不要改。改之前先问一句：哪些事实、数字、立场必须保留？

用户确认改写后，按白描原则动手：
- 直陈：直接说事实和判断，不写「展现出了显著的效果」「对此持有审慎的态度」。
- 白描：用具体动作、场景、数字替代抽象包装；写「他吃了三碗饭」，不写「食欲旺盛」。
- 删二元对立：删掉「不是……而是……」「不在于……而在于……」「与其说……不如说……」。删完如果句子没有少信息，原句就是假深刻。
- 保留承诺强度：原文是「可能」「也许」「尝试」，改写不得升级成「必然」「确保」「100%」。
- 自然留白：结尾停在具体动作、真实场景或开放处，不写「未来已来」「愿你」「让我们拭目以待」。
- 准确的词可以重复，不为了显得词汇丰富而刻意轮换近义词。

工具分工：
- \`plainspoken_analyze\`：只诊断，不改。
- \`plainspoken_rewrite\`：只做机械预清理（删套话），会如实标注「没有可清理内容」；其余改写由你按上面的原则完成。
- \`plainspoken_validate\`：改完后核验事实、承诺强度、二元对立和结尾。

底线：去 AI 味 ≠ 好内容。文本干净但内容空，就直接说内容空；不要为了交报告硬找问题。`,
  },
  detect: {
    id: 'detect',
    name: '白描检测员（只诊断）',
    summary: '只出检测报告，不改一个字；适合发布前体检和改稿前定位',
    rolePrompt: `【当前职能：白描检测员】
你只做诊断，不改写。

用户给你文字时：
1. 调用 \`plainspoken_analyze\`，拿到浓度、命中的维度和证据。
2. 先报结论：浓度几级（无 / 轻微 / 中等 / 严重 / 致命），最重的 2-3 个来源。
3. 每个来源给一条可操作建议，引用原文里的具体句子作证据。
4. 如果文本很干净，直接说干净；不要为了凑报告硬找问题。
5. 结尾提醒一句：要不要改、怎么改，由用户决定。

不要调用 \`plainspoken_rewrite\`，不要输出改写稿。`,
  },
};




const WORKSPACE_RULES_HEADER = '【工作区上下文规则】';










function unwrapValue   (val                                   , fallback   )    {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'object' && val !== null && 'get' in (val                     ) && typeof (val                     ).get === 'function') {
    const inner = (val                    ).get();
    return inner !== undefined && inner !== null ? inner : fallback;
  }
  return val     ;
}

function resolveWorkspacePromptMode(options                        )                      {
  return unwrapValue(options?.workspacePromptMode, 'off');
}

function assemblePlainspokenPrompt(options                        )         {
  const activePresetKey = unwrapValue(options?.activePreset, 'writer');
  const includeBaseProtocol = unwrapValue(options?.includeBaseProtocol, true);
  const customPromptOverride = unwrapValue(options?.customPromptOverride, '');
  const workspacePromptMode = unwrapValue(options?.workspacePromptMode, 'off');
  const customPromptBehavior = unwrapValue(options?.customPromptBehavior, 'append');
  const workspaceDocs = typeof options?.workspaceDocs === 'string' ? options.workspaceDocs : '';

  const preset = PLAINSPOKEN_PRESET_BRICKS[activePresetKey] || PLAINSPOKEN_PRESET_BRICKS.writer;

  const sections           = [];
  if (preset.rolePrompt && preset.rolePrompt.trim()) sections.push(preset.rolePrompt.trim());
  if (includeBaseProtocol && BASE_TOOL_PROTOCOL.trim()) sections.push(BASE_TOOL_PROTOCOL.trim());

  const base = sections.join('\n\n').trim();
  const custom = customPromptOverride.trim();

  if (workspacePromptMode === 'custom' && custom) {
    if (customPromptBehavior === 'replace') return custom;
    return base ? `${base}\n\n${custom}` : custom;
  }

  if (workspacePromptMode === 'workspace' && workspaceDocs.trim()) {
    const docs = `${WORKSPACE_RULES_HEADER}\n${workspaceDocs.trim()}`;
    return base ? `${base}\n\n${docs}` : docs;
  }

  return base;
}


//# sourceURL=src/presets.ts

		const NS = 'plainspoken-brick-injector';
		const PRESET_ORDER = ['writer', 'detect'];
		const OPTIONS = PRESET_ORDER.map((id) => PLAINSPOKEN_PRESET_BRICKS[id]);
		const MODE_ORDER = ['off', 'custom', 'workspace'];
		const MODES = {
		  off: { id: 'off', name: '初始纯净', summary: '只用白描人设和协作准则，不读取工作区文档' },
		  custom: { id: 'custom', name: '自定义填写', summary: '在下方填写工作区提示，追加或整段替换' },
		  workspace: { id: 'workspace', name: '工作区识别', summary: '新会话自动读取 AGENTS.md / CLAUDE.md / memory / rules' },
		};

		const S = {
		  wrap: { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760, color: 'var(--dsw-alias-label-primary)' },
		  title: { margin: 0, fontSize: 18, fontWeight: 600 },
		  hint: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)' },
		  card: (active) => ({
		    display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', cursor: 'pointer', font: 'inherit',
		    padding: '10px 14px', borderRadius: 12, color: 'inherit',
		    border: '.5px solid ' + (active ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-border-l3)'),
		    background: active ? 'var(--dsw-alias-interactive-bg-hover)' : 'var(--dsw-alias-settings-card-fill)',
		  }),
		  cardName: { fontSize: 14, fontWeight: 500 },
		  cardSummary: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' },
		  row: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
		  input: {
		    width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 13, padding: '7px 9px', borderRadius: 8,
		    border: '.5px solid var(--dsw-alias-border-l4)', background: 'var(--dsw-alias-bg-layer-1)', color: 'inherit',
		  },
		  textarea: {
		    width: '100%', minHeight: 72, boxSizing: 'border-box', font: 'inherit', fontSize: 13, padding: 8, borderRadius: 8,
		    border: '.5px solid var(--dsw-alias-border-l4)', background: 'var(--dsw-alias-bg-layer-1)', color: 'inherit',
		  },
		  pre: {
		    margin: 0, padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: '18px',
		    background: 'var(--dsw-alias-bg-module-platform)', maxHeight: 240, overflow: 'auto',
		  },
		};

		function PlainspokenPanel(props) {
		  const state = props.usePlainspokenForm((snapshot) => snapshot);
		  const value = state.value || {};
		  const cfg = {
		    activePreset: PRESET_ORDER.includes(value.activePreset) ? value.activePreset : 'writer',
		    includeBaseProtocol: value.includeBaseProtocol !== false,
		    customPromptOverride: typeof value.customPromptOverride === 'string' ? value.customPromptOverride : '',
		    workspacePromptMode: MODE_ORDER.includes(value.workspacePromptMode) ? value.workspacePromptMode : 'off',
		    customPromptBehavior: value.customPromptBehavior === 'replace' ? 'replace' : 'append',
		    workspaceDocsMaxBytes: typeof value.workspaceDocsMaxBytes === 'number' ? value.workspaceDocsMaxBytes : 64 * 1024,
		    workspaceDocsIncludeAncestors: value.workspaceDocsIncludeAncestors === true,
		    enforceToolSurface: value.enforceToolSurface === true,
		    enginePath: typeof value.enginePath === 'string' ? value.enginePath : '',
		    showDimensions: typeof value.showDimensions === 'number' ? value.showDimensions : 5,
		  };
		  const disabled = !state.writable || state.status !== 'ready';
		  const [draft, setDraft] = react.useState(null);
		  const draftRef = react.useRef(draft);
		  const cfgRef = react.useRef(cfg);
		  draftRef.current = draft;
		  cfgRef.current = cfg;
		  react.useEffect(() => () => {
		    const pending = draftRef.current;
		    if (pending === null || pending === cfgRef.current.customPromptOverride) return;
		    try {
		      props.set('customPromptOverride', pending);
		    } catch {
		      // 表单已销毁
		    }
		  }, []);

		  const text = draft === null ? cfg.customPromptOverride : draft;
		  const modeName = MODES[cfg.workspacePromptMode].name;

		  if (props.view === 'summary') {
		    return '白描写作（当前：' + PLAINSPOKEN_PRESET_BRICKS[cfg.activePreset].name + ' · 工作区提示：' + modeName + '）';
		  }

		  const preview = assemblePlainspokenPrompt({
		    ...cfg,
		    customPromptOverride: text,
		    workspaceDocs: cfg.workspacePromptMode === 'workspace'
		      ? '（工作区文档由宿主在会话组装时按 AGENTS.md / CLAUDE.md / memory / rules 读取注入）'
		      : undefined,
		  });

		  return h('div', { style: S.wrap }, [
		    h('h2', { key: 'h', style: S.title }, '白描写作配置'),
		    h('p', { key: 'p', style: S.hint },
		      '选择白描写作的职能。修改即时生效，新开会话使用新的预设；默认只诊断，改写由你确认。'),
		    disabled ? h('p', { key: 'd', style: S.hint }, '配置服务暂不可用（只读或未就绪）。') : null,
		    h('div', { key: 'opts', style: { display: 'grid', gap: 8 } }, OPTIONS.map((opt) =>
		      h('button', {
		        key: opt.id, type: 'button', disabled, style: S.card(opt.id === cfg.activePreset),
		        onClick: () => props.set('activePreset', opt.id),
		      }, [
		        h('span', { key: 'n', style: S.cardName }, opt.name + (opt.id === cfg.activePreset ? '  ✓' : '')),
		        h('span', { key: 's', style: S.cardSummary }, opt.summary),
		      ]))),
		    h('label', { key: 'base', style: S.row }, [
		      h('input', {
		        key: 'i', type: 'checkbox', disabled, checked: cfg.includeBaseProtocol,
		        onChange: (e) => props.set('includeBaseProtocol', e.target.checked),
		      }),
		      '附加「文档与工具协作准则」',
		    ]),
		    h('label', { key: 'surface', style: S.row }, [
		      h('input', {
		        key: 'i', type: 'checkbox', disabled, checked: cfg.enforceToolSurface,
		        onChange: (e) => props.set('enforceToolSurface', e.target.checked),
		      }),
		      '强制纯净工具面（隐藏全局工具，只留白描预设自带工具；下一步生效）',
		    ]),
		    h('div', { key: 'engine', style: { display: 'grid', gap: 8 } }, [
		      h('p', { key: 'l', style: Object.assign({}, S.hint, { fontWeight: 600 }) }, '引擎'),
		      h('label', { key: 'path', style: { display: 'grid', gap: 4, fontSize: 13 } }, [
		        'Python 引擎目录（留空用插件内置 engine/）',
		        h('input', {
		          key: 'i', type: 'text', disabled, style: S.input, defaultValue: cfg.enginePath,
		          placeholder: '例如 /Users/you/Documents/GPT/plainspoken-writing',
		          onBlur: (e) => props.set('enginePath', e.target.value.trim()),
		        }),
		      ]),
		      h('label', { key: 'dims', style: S.row }, [
		        '报告最多展示',
		        h('select', {
		          key: 's', disabled, value: String(cfg.showDimensions),
		          onChange: (e) => props.set('showDimensions', Number(e.target.value)),
		        }, [3, 5, 8, 10, 25].map((n) => h('option', { key: n, value: String(n) }, n + ' 维'))),
		      ]),
		    ]),
		    h('div', { key: 'ws' }, [
		      h('p', { key: 'wt', style: Object.assign({}, S.hint, { fontWeight: 600 }) }, '工作区提示模式'),
		      h('div', { key: 'wm', style: { display: 'grid', gap: 8 } }, MODE_ORDER.map((id) =>
		        h('button', {
		          key: id, type: 'button', disabled, style: S.card(id === cfg.workspacePromptMode),
		          onClick: () => props.set('workspacePromptMode', id),
		        }, [
		          h('span', { key: 'n', style: S.cardName }, MODES[id].name + (id === cfg.workspacePromptMode ? '  ✓' : '')),
		          h('span', { key: 's', style: S.cardSummary }, MODES[id].summary),
		        ]))),
		      cfg.workspacePromptMode === 'workspace' ? h('div', { key: 'wsopt', style: { display: 'grid', gap: 8, marginTop: 8 } }, [
		        h('label', { key: 'anc', style: S.row }, [
		          h('input', {
		            key: 'i', type: 'checkbox', disabled, checked: cfg.workspaceDocsIncludeAncestors,
		            onChange: (e) => props.set('workspaceDocsIncludeAncestors', e.target.checked),
		          }),
		          '同时读取父目录的 AGENTS.md / CLAUDE.md',
		        ]),
		        h('label', { key: 'budget', style: S.row }, [
		          '文档总预算　',
		          h('select', {
		            key: 's', disabled, value: String(cfg.workspaceDocsMaxBytes),
		            onChange: (e) => props.set('workspaceDocsMaxBytes', Number(e.target.value)),
		          }, [16, 32, 64, 128].map((kb) => h('option', { key: kb, value: String(kb * 1024) }, kb + ' KB'))),
		        ]),
		      ]) : null,
		    ]),
		    cfg.workspacePromptMode === 'custom' ? h('div', { key: 'custom' }, [
		      h('p', { key: 'l', style: S.hint }, '自定义工作区提示（失焦保存；可追加或整段替换）'),
		      h('div', { key: 'bar', style: S.row }, [
		        h('button', {
		          key: 'a', type: 'button', disabled, style: S.card(cfg.customPromptBehavior === 'append'),
		          onClick: () => {
		            if (draft !== null && draft !== cfg.customPromptOverride) props.set('customPromptOverride', draft);
		            setDraft(null);
		            props.set('customPromptBehavior', 'append');
		          },
		        }, h('span', { style: S.cardName }, '追加')),
		        h('button', {
		          key: 'r', type: 'button', disabled, style: S.card(cfg.customPromptBehavior === 'replace'),
		          onClick: () => {
		            if (draft !== null && draft !== cfg.customPromptOverride) props.set('customPromptOverride', draft);
		            setDraft(null);
		            props.set('customPromptBehavior', 'replace');
		          },
		        }, h('span', { style: S.cardName }, '替换初始提示')),
		      ]),
		      h('textarea', {
		        key: 't', style: S.textarea, disabled, value: text,
		        onChange: (e) => setDraft(e.target.value),
		        onBlur: () => {
		          if (draft !== null && draft !== cfg.customPromptOverride) props.set('customPromptOverride', draft);
		          setDraft(null);
		        },
		      }),
		    ]) : null,
		    h('div', { key: 'prev' }, [
		      h('p', { key: 'l', style: S.hint }, '当前组合出的 System Prompt 预览'),
		      h('pre', { key: 'p', style: S.pre }, preview),
		    ]),
		  ]);
		}

		const inject = ['slots', 'locale', 'configForms'];

		function apply(ctx) {
		  const form = ctx.configForms.get(NS);
		  const injected = () => ({
		    hooks: { plainspokenForm: form },
		    set: (field, v) => form.set(field, v),
		  });

		  ctx.effect(() => ctx.configForms.whileServed([NS], () => {
		    const offs = [
		      ctx.slots.inject('settings.section', () => ctx.slots.register({
		        name: 'settings.section',
		        id: 'plainspoken-writing',
		        order: 26,
		        label: () => '白描写作配置',
		        inject: injected,
		      }, PlainspokenPanel)),
		      ctx.slots.inject('plugins.item', () => ctx.slots.register({
		        name: 'plugins.item',
		        id: 'plainspoken-writing',
		        order: 51,
		        label: () => '白描写作配置',
		        inject: injected,
		      }, PlainspokenPanel)),
		    ];
		    return () => { for (const off of offs) off(); };
		  }), 'plainspoken-writing-dsh: settings page');
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.PRESET_OPTIONS = OPTIONS;

		return module.exports;
	}
});
