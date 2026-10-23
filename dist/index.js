/**
 * plainspoken-writing-dsh - 宿主插件
 *
 * 1. 声明可热更新的白描写作配置；
 * 2. 注册 ctx.systemPrompt.variable('plainspoken_brick', ...)；
 * 3. workspace 模式下读取工作区 AGENTS.md / CLAUDE.md / memory / rules；
 * 4. 把引擎路径与展示维度同步给预设内的 tools 实例。
 */

import { closeSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PLAINSPOKEN_PRESET_BRICKS,
  BASE_TOOL_PROTOCOL,
  assemblePlainspokenPrompt,
  resolveWorkspacePromptMode,

} from './presets.js';
import { setRuntimeConfig, setToolSurfaceEnforced } from './shared.js';

export const name = 'plainspoken-brick-injector';
export const inject = ['systemPrompt'];

function createSchemaBuilder() {
  class FluentSchema {
    meta                     ;
    constructor(meta                      = {}) {
      this.meta = meta;
    }
    default(value     ) {
      this.meta.default = value;
      return this;
    }
    description(desc        ) {
      this.meta.description = desc;
      return this;
    }
    volatile() {
      this.meta.volatile = true;
      return this;
    }
    // Cordis 用 standard-schema 接口校验配置；没有宿主 schemastery 时回退到这个
    // 最小实现，值原样透传，默认值由 apply() 里的 unwrapConfigValue 处理。
    get '~standard'() {
      return {
        version: 1,
        vendor: 'plainspoken-writing-dsh',
        validate: (value     ) => ({ value: value ?? {} }),
      };
    }
    toJSON() {
      return this.meta;
    }
  }
  return {
    object: (shape                     ) => new FluentSchema({ type: 'object', shape }),
    union: (items       ) => new FluentSchema({ type: 'union', items }),
    string: () => new FluentSchema({ type: 'string' }),
    boolean: () => new FluentSchema({ type: 'boolean' }),
    number: () => new FluentSchema({ type: 'number' }),
  };
}

let SchemaFactory     ;
try {
  // @ts-ignore
  const schemastery = await import('@deepseek-ai/schemastery');
  SchemaFactory = schemastery.default || schemastery.Schema || schemastery;
} catch {
  SchemaFactory = undefined;
}
if (SchemaFactory === undefined) {
  for (const runtimeRoot of process.argv.slice(2)) {
    for (const anchor of [join(runtimeRoot, 'package.json'), runtimeRoot]) {
      try {
        const resolved = createRequire(anchor).resolve('@deepseek-ai/schemastery');
        const mod      = await import(pathToFileURL(resolved).href);
        SchemaFactory = mod?.default ?? mod?.Schema ?? mod;
        break;
      } catch {
        // 落到下一个候选
      }
    }
    if (SchemaFactory !== undefined) break;
  }
}
if (SchemaFactory === undefined) SchemaFactory = createSchemaBuilder();














export const Config = SchemaFactory.object({
  activePreset: SchemaFactory.union(['writer', 'detect'])
    .default('writer')
    .description('当前写作职能：writer(白描写作者) / detect(白描检测员，只诊断)')
    .volatile(),
  includeBaseProtocol: SchemaFactory.boolean()
    .default(true)
    .description('是否拼接文档与工具协作准则（去工程化底座）')
    .volatile(),
  customPromptOverride: SchemaFactory.string()
    .default('')
    .description('自定义工作区提示（workspacePromptMode=custom 时生效）')
    .volatile(),
  workspacePromptMode: SchemaFactory.union(['off', 'custom', 'workspace'])
    .default('off')
    .description('工作区提示三模式：off / custom / workspace（读取 AGENTS.md、memory、rules 等）')
    .volatile(),
  customPromptBehavior: SchemaFactory.union(['append', 'replace'])
    .default('append')
    .description('custom 模式：append 追加 / replace 整段替换')
    .volatile(),
  workspaceDocsMaxBytes: SchemaFactory.number()
    .default(64 * 1024)
    .description('工作区文档总字节上限（4KB–256KB）')
    .volatile(),
  workspaceDocsIncludeAncestors: SchemaFactory.boolean()
    .default(false)
    .description('workspace 模式是否向上扫描父目录的 AGENTS.md / CLAUDE.md')
    .volatile(),
  enforceToolSurface: SchemaFactory.boolean()
    .default(false)
    .description('强制纯净工具面：隐藏继承的全局工具，只保留白描预设自带的工具')
    .volatile(),
  enginePath: SchemaFactory.string()
    .default('')
    .description('白描 Python 引擎目录（含 cli.py / core / rules）；留空用插件内置 engine/')
    .volatile(),
  showDimensions: SchemaFactory.number()
    .default(5)
    .description('报告里最多展示几个命中维度（1–25）')
    .volatile(),
});

const WORKSPACE_DOC_PLAN                                     = [
  ['AGENTS.md'],
  ['CLAUDE.md'],
  ['memory.md'],
  ['memory', '*.md'],
  ['rules.md'],
  ['rules', '*.md'],
];

export const WORKSPACE_DOCS_MAX_BYTES = 64 * 1024;
export const WORKSPACE_DOCS_MIN_BYTES = 4 * 1024;
export const WORKSPACE_DOCS_MAX_ALLOWED_BYTES = 256 * 1024;

const MAX_ANCESTOR_DEPTH = 8;
const ANCESTOR_DOC_NAMES = ['AGENTS.md', 'CLAUDE.md'];






export function resolveWorkspaceDocsMaxBytes(value         )         {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return WORKSPACE_DOCS_MAX_BYTES;
  return Math.min(WORKSPACE_DOCS_MAX_ALLOWED_BYTES, Math.max(WORKSPACE_DOCS_MIN_BYTES, Math.floor(numeric)));
}

function unwrapConfigValue   (value                                   , fallback   )    {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'object' && 'get' in (value       ) && typeof (value       ).get === 'function') {
    const inner = (value                    ).get();
    return inner === undefined || inner === null ? fallback : inner;
  }
  return value     ;
}

function sliceByUtf8Bytes(text        , maxBytes        )         {
  if (maxBytes <= 0) return '';
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= maxBytes) return text;
  return buf.subarray(0, maxBytes).toString('utf8').replace(/\uFFFD+$/g, '');
}

function readBoundedFileSync(file        , maxBytes        )                     {
  try {
    const info = statSync(file);
    if (!info.isFile() || info.size <= 0) return undefined;
    if (info.size <= maxBytes) return readFileSync(file, 'utf8');
    const length = Math.max(1, Math.min(info.size, Math.floor(maxBytes)));
    const buffer = Buffer.allocUnsafe(length);
    const fd = openSync(file, 'r');
    try {
      const read = readSync(fd, buffer, 0, length, 0);
      return buffer.subarray(0, read).toString('utf8');
    } finally {
      closeSync(fd);
    }
  } catch {
    return undefined;
  }
}

function promptPath(path        )         {
  return path.split('\\').join('/');
}

export function readWorkspaceDocs(cwd                    , options                       = {})         {
  if (!cwd || typeof cwd !== 'string') return '';
  const maxBytes = resolveWorkspaceDocsMaxBytes(options.maxBytes);
  const includeAncestors = options.includeAncestors === true;
  const rootDir = resolve(cwd);

  const parts           = [];
  const seenContents = new Set        ();
  let total = 0;
  let truncated = false;

  const pushDoc = (label        , content        )       => {
    if (truncated) return;
    const trimmed = content.trim();
    if (!trimmed || seenContents.has(trimmed)) return;
    const text = `## ${label}\n${trimmed}`;
    const bytes = Buffer.byteLength(text, 'utf8');
    if (total + bytes > maxBytes) {
      const remain = maxBytes - total;
      const sliced = sliceByUtf8Bytes(text, remain);
      if (sliced.length > 0) parts.push(sliced);
      truncated = true;
      return;
    }
    seenContents.add(trimmed);
    total += bytes;
    parts.push(text);
  };

  const scanDir = (dir        , plan                                    , prefix        )       => {
    for (const entry of plan) {
      if (truncated) return;
      const joinLabel = (entryName        )         => (prefix ? `${prefix}/${entryName}` : entryName);
      if (entry.length === 1) {
        const content = readBoundedFileSync(join(dir, entry[0]), maxBytes - total + 4);
        if (content !== undefined) pushDoc(joinLabel(entry[0]), content);
        continue;
      }
      const [subdir] = entry;
      let files           = [];
      try {
        files = readdirSync(join(dir, subdir)).filter((f) => f.endsWith('.md')).sort();
      } catch {
        continue;
      }
      for (const file of files) {
        if (truncated) return;
        const content = readBoundedFileSync(join(dir, subdir, file), maxBytes - total + 4);
        if (content !== undefined) pushDoc(joinLabel(`${subdir}/${file}`), content);
      }
    }
  };

  if (includeAncestors) {
    const chain           = [];
    const home = resolve(homedir());
    let current = rootDir;
    for (let depth = 0; depth < MAX_ANCESTOR_DEPTH; depth += 1) {
      chain.unshift(current);
      if (current === home) break;
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    for (const dir of chain) {
      const prefix = dir === rootDir ? '' : promptPath(relative(rootDir, dir));
      scanDir(
        dir,
        dir === rootDir ? WORKSPACE_DOC_PLAN : ANCESTOR_DOC_NAMES.map((docName) => [docName]            ),
        prefix,
      );
    }
  } else {
    scanDir(rootDir, WORKSPACE_DOC_PLAN, '');
  }

  if (parts.length === 0) return '';
  const limitLabel = `${Math.round(maxBytes / 1024)}KB`;
  const note = truncated ? `（工作区文档合计超出 ${limitLabel} 上限，已截断）\n` : '';
  return note + parts.join('\n\n');
}

export function apply(ctx     , config                            = {}) {
  const syncRuntime = ()       => {
    setToolSurfaceEnforced(unwrapConfigValue(config.enforceToolSurface, false));
    setRuntimeConfig({
      enginePath: unwrapConfigValue(config.enginePath, ''),
      showDimensions: unwrapConfigValue(config.showDimensions, 5),
    });
  };
  syncRuntime();

  if (ctx.systemPrompt?.variable) {
    const registerVariable = () => {
      return ctx.systemPrompt.variable('plainspoken_brick', (context     ) => {
        const cwd = context?.agent?.session?.header?.cwd                      ;
        const workspaceDocs =
          resolveWorkspacePromptMode(config                         ) === 'workspace'
            ? readWorkspaceDocs(cwd, {
                maxBytes: unwrapConfigValue(config.workspaceDocsMaxBytes, WORKSPACE_DOCS_MAX_BYTES),
                includeAncestors: unwrapConfigValue(config.workspaceDocsIncludeAncestors, false),
              })
            : '';
        return assemblePlainspokenPrompt({ ...(config                         ), workspaceDocs });
      });
    };

    if (typeof ctx.effect === 'function') {
      ctx.effect(registerVariable, 'plainspoken-brick-injector.variable()');
    } else {
      registerVariable();
    }
  }

  if (ctx.inject && typeof ctx.inject === 'function') {
    ctx.inject(['settings'], (child     ) => {
      child.settings?.configure?.({ auto: false }, ctx.fiber);
    });
  } else if (ctx.settings?.configure) {
    ctx.settings.configure({ auto: false }, ctx.fiber);
  }

  if (typeof ctx.on === 'function') {
    ctx.on('loader/volatile-update', () => {
      syncRuntime();
      ctx.emit?.('system-prompt/change');
    });
  }
}

export {
  PLAINSPOKEN_PRESET_BRICKS,
  BASE_TOOL_PROTOCOL,
  assemblePlainspokenPrompt,
  resolveWorkspacePromptMode,
};


//# sourceURL=src/index.ts