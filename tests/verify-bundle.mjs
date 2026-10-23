/**
 * plainspoken-writing-dsh 全链路自检：
 * 文件完整性、ESM 导出、客户端槽位、工具注册、内置 Python 引擎可执行。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

console.log('='.repeat(70));
console.log('开始执行 plainspoken-writing-dsh 插件自检...');
console.log('='.repeat(70));

const required = [
  'package.json',
  'cordis.patch.yml',
  'src/presets.ts',
  'src/index.ts',
  'src/tools.ts',
  'src/shared.ts',
  'src/tool-surface.ts',
  'src/client/panel.js',
  'scripts/build.mjs',
  'scripts/build-client.mjs',
  'scripts/sync-engine.sh',
  'dist/index.js',
  'dist/presets.js',
  'dist/tools.js',
  'dist/shared.js',
  'dist/tool-surface.js',
  'dist/client.js',
  'engine/cli.py',
  'engine/core/detector.py',
  'engine/rules/ai_patterns.yaml',
];
for (const rel of required) {
  assert.ok(fs.existsSync(path.join(ROOT, rel)), `缺少必要文件: ${rel}`);
}
console.log(`✓ 文件完整性：${required.length} 项`);

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.name, 'plainspoken-writing-dsh');
assert.equal(pkg.type, 'module');
assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml');
assert.ok(pkg.exports['.'], '缺少 . 导出');
assert.ok(pkg.exports['./tools'], '缺少 ./tools 导出');
assert.ok(pkg.exports['./client'], '缺少 ./client 导出');
console.log('✓ package.json 结构与导出');

const presets = await import('../dist/presets.js');
assert.ok(presets.BASE_TOOL_PROTOCOL.includes('文档与工具协作准则'));
assert.equal(typeof presets.assemblePlainspokenPrompt, 'function');
assert.ok(presets.PLAINSPOKEN_PRESET_BRICKS.writer);
assert.ok(presets.PLAINSPOKEN_PRESET_BRICKS.detect);
const prompt = presets.assemblePlainspokenPrompt({ activePreset: 'writer', workspacePromptMode: 'off' });
assert.ok(prompt.includes('白描写作者'));
assert.ok(prompt.includes('默认只诊断'));
console.log('✓ 预设积木与提示词组装');

const host = await import('../dist/index.js');
assert.equal(host.name, 'plainspoken-brick-injector');
assert.deepEqual(host.inject, ['systemPrompt']);
assert.equal(typeof host.apply, 'function');
const variableCalls = [];
const hostCtx = {
  systemPrompt: { variable: (name, fn) => { variableCalls.push([name, fn]); return () => {}; } },
  effect: (fn) => fn(),
  on: () => {},
  emit: () => {},
  inject: (_deps, fn) => fn({ settings: { configure: () => {} } }),
};
host.apply(hostCtx, { activePreset: 'writer', workspacePromptMode: 'off' });
assert.equal(variableCalls.length, 1);
assert.equal(variableCalls[0][0], 'plainspoken_brick');
assert.ok(variableCalls[0][1]({ agent: { session: { header: { cwd: ROOT } } } }).includes('白描写作者'));
console.log('✓ 宿主注入器与 plainspoken_brick 变量');

const tools = await import('../dist/tools.js');
assert.equal(tools.name, 'plainspoken-tools');
assert.deepEqual(tools.inject, ['tools']);
const registered = [];
tools.apply({ tools: { register: (tool) => registered.push(tool) } });
assert.deepEqual(registered.map((t) => t.name).sort(), [
  'plainspoken_analyze',
  'plainspoken_rewrite',
  'plainspoken_validate',
]);
assert.ok(registered.every((t) => typeof t.execute === 'function'));
const analyzeTool = registered.find((t) => t.name === 'plainspoken_analyze');
const toolResult = await analyzeTool.execute({
  text: '综上所述，在当今快速发展的AI领域，提示词工程已经成为一项至关重要的技能。',
});
assert.ok(toolResult.concentration_score > 0, '工具 execute 应能调到内置引擎');
assert.ok(toolResult.triggered_count >= 1);
console.log(`✓ 三个白描工具注册，analyze 工具实测浓度 ${toolResult.concentration_label}`);

const clientSource = fs.readFileSync(path.join(ROOT, 'dist/client.js'), 'utf8');
assert.ok(clientSource.includes('window.__ModuleLoader__.load('));
let loaded;
const sandbox = { window: { __ModuleLoader__: { load: (m) => { loaded = m; } } }, Symbol, Object, console };
sandbox.globalThis = sandbox;
vm.runInNewContext(clientSource, sandbox);
assert.equal(loaded.id, 'plainspoken-writing-dsh');
const fakeReact = {
  createElement: (...a) => ({ t: a[0], p: a[1], c: a[2] }),
  useState: (v) => [v, () => {}],
  useRef: (v) => ({ current: v }),
  useEffect: () => {},
};
const clientExports = loaded.factory((id) => {
  if (id === 'react') return fakeReact;
  throw new Error('unexpected require: ' + id);
});
assert.equal(typeof clientExports.apply, 'function');
assert.ok(clientExports.inject.includes('configForms'));
assert.equal(clientExports.PRESET_OPTIONS.length, 2);
const registeredSlots = [];
clientExports.apply({
  configForms: {
    get: () => ({ set: () => Promise.resolve(true) }),
    whileServed: (_ns, fn) => fn(),
  },
  slots: { inject: (_name, fn) => fn(), register: (opts) => { registeredSlots.push(opts); return () => {}; } },
  effect: (fn) => fn(),
});
assert.ok(registeredSlots.find((o) => o.name === 'settings.section'));
assert.ok(registeredSlots.find((o) => o.name === 'plugins.item'));
console.log('✓ 客户端槽位与设置页');

const sample = '综上所述，在当今快速发展的AI领域，提示词工程已经成为一项至关重要的技能。值得注意的是，掌握这项技能的人将在未来的职场中占据显著优势。';
const raw = execFileSync(process.env.PLAINSPOKEN_PYTHON || 'python3', [path.join(ROOT, 'engine/cli.py'), 'analyze'], {
  input: JSON.stringify({ text: sample }),
  encoding: 'utf8',
});
const analysis = JSON.parse(raw);
assert.ok(analysis.concentration_score > 0, '样例应检出 AI 味');
assert.ok(analysis.triggered_count >= 1, '样例应至少命中一个维度');
assert.ok(Array.isArray(analysis.dimensions));
console.log(`✓ 内置引擎：浓度 ${analysis.concentration_label} / 命中 ${analysis.triggered_count} 维`);

console.log('\n全部自检通过。');
