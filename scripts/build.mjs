// 构建 dist/*.js：用 Node 内置的 TypeScript 类型剥离（无第三方依赖）。
// 这样 src 是唯一真源，dist 不再手工同步，避免「改了 src 忘改 dist」。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entrypoints = ['index', 'presets', 'tools', 'shared', 'tool-surface'];

mkdirSync(join(root, 'dist'), { recursive: true });
for (const name of entrypoints) {
  const source = readFileSync(join(root, 'src', `${name}.ts`), 'utf8');
  // mode: 'strip' 只删类型标注，不做语法降级；输出仍是 ESM
  // strip 会把被删掉的类型行留下纯空白行；统一清空，避免 dist 里满是 trailing whitespace。
  const output = stripTypeScriptTypes(source, { mode: 'strip', sourceUrl: `src/${name}.ts` })
    .split('\n')
    .map((line) => (/^\s+$/u.test(line) ? '' : line))
    .join('\n');
  writeFileSync(join(root, 'dist', `${name}.js`), output);
  console.log(`built dist/${name}.js (${output.length} bytes)`);
}
