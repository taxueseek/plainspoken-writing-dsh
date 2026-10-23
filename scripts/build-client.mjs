// 构建 dist/client.js：内联 dist/presets.js，并包装为 DSH lazy-CJS 客户端模块。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'plainspoken-writing-dsh';

const presets = readFileSync(join(root, 'dist/presets.js'), 'utf8')
  .replace(/^export\s+/gm, '')
  .replace(/^import .*$/gm, '');
const panel = readFileSync(join(root, 'src/client/panel.js'), 'utf8');

// 只缩进 panel 源码，再在缩进后的占位符处原样插入 presets。
// 反过来的顺序会把 presets 里每个模板字符串的换行也加上 \t\t，
// 导致设置面板预览与宿主实际注入的提示词不一致（多出 2 个 tab/行）。
const body = panel
  .split('\n')
  .map((l) => (l ? '\t\t' + l : l))
  .join('\n')
  .replace('/*__PRESETS__*/', () => presets);
const out = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(ID)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
\t\treturn module.exports;
\t}
});
`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/client.js'), out);
console.log('built dist/client.js (' + out.length + ' bytes)');
