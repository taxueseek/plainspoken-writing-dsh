/*
 * plainspoken-writing-dsh - 客户端源（浏览器侧）
 * 由 scripts/build-client.mjs 内联 dist/presets.js 后包装成 DSH lazy-CJS 模块。
 */
const react = require('react');
const h = react.createElement;

/*__PRESETS__*/

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
          placeholder: '例如 /path/to/plainspoken-writing',
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
