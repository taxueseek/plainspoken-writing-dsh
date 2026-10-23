/**
 * plainspoken-writing-dsh - 白描检测/改写/质检工具
 *
 * 工具在 DSH 预设作用域内注册，execute 时 spawn 本地 Python 引擎
 * （engine/cli.py），走 stdin/stdout JSON，不把长文塞进模型上下文。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRuntimeConfig } from './shared.js';

export const name = 'plainspoken-tools';
export const inject = ['tools'];

function bundledEnginePath()         {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'engine');
}

function engineDir()         {
  const configured = getRuntimeConfig().enginePath;
  return configured && configured.trim() ? resolve(configured) : bundledEnginePath();
}

function runCli(command        , payload                         , timeoutMs = 30000)               {
  const dir = engineDir();
  const cli = join(dir, 'cli.py');
  if (!existsSync(cli)) {
    return Promise.reject(new Error(`找不到白描引擎：${cli}。请在「白描写作配置」里填写 enginePath，或先运行 scripts/sync-engine.sh。`));
  }
  const python = process.env.PLAINSPOKEN_PYTHON || 'python3';
  const input = JSON.stringify(payload);

  return new Promise((resolvePromise, reject) => {
    const child = spawn(python, [cli, command], {
      cwd: dir,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn            ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(() => reject(new Error(`白描引擎执行超时（${timeoutMs}ms）`)));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 4 * 1024 * 1024) {
        child.kill('SIGKILL');
        finish(() => reject(new Error('白描引擎输出超过 4MB')));
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => finish(() => reject(error)));
    child.on('close', (code) => {
      finish(() => {
        if (code !== 0) {
          reject(new Error(`白描引擎退出码 ${code}：${(stderr || stdout).trim().slice(0, 800)}`));
          return;
        }
        try {
          resolvePromise(JSON.parse(stdout));
        } catch (error) {
          reject(new Error(`白描引擎返回了非 JSON 内容：${String(error)}；原始输出：${stdout.slice(0, 400)}`));
        }
      });
    });
    child.stdin.end(input, 'utf8');
  });
}

function topDimensions(result     )        {
  const limit = getRuntimeConfig().showDimensions;
  return Array.isArray(result?.dimensions) ? result.dimensions.slice(0, limit) : [];
}

function renderAnalysis(result     )         {
  if (result?.error) return `检测失败：${result.error}`;
  const lines = [
    `浓度：${result.concentration_label || result.concentration}（${result.concentration_score}）`,
    `命中：${result.triggered_count ?? 0} 维 · 体裁：${result.genre || 'unknown'}`,
  ];
  for (const dim of topDimensions(result)) {
    const evidence = dim.evidence ? `｜证据：${String(dim.evidence).slice(0, 80)}` : '';
    lines.push(`- #${dim.id} ${dim.label_cn}（severity ${dim.severity}${evidence}）`);
  }
  if (Array.isArray(result.suggestions)) {
    for (const suggestion of result.suggestions.slice(0, 3)) lines.push(`建议：${suggestion}`);
  }
  return lines.join('\n');
}

export function apply(ctx     )       {
  ctx.tools.register({
    name: 'plainspoken_analyze',
    description:
      '诊断一段中文的 AI 味浓度与命中维度。只检测不改写，返回浓度等级、命中的维度、原文证据和改写建议。适合发布前体检、改稿前定位。',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要诊断的文本。' },
        top: { type: 'integer', minimum: 1, maximum: 25, description: '可选，最多返回几个命中维度；默认用设置里的展示数。' },
      },
      required: ['text'],
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args     , value     ) => [{ type: 'text', text: renderAnalysis(value) }],
    },
    async execute(args                                ) {
      return runCli('analyze', { text: args.text ?? '', top: args.top });
    },
  });

  ctx.tools.register({
    name: 'plainspoken_rewrite',
    description:
      '对一段中文做机械预清理（删已知套话）并给出改写方向。不会调用 LLM，不会假装完成需要模型判断的改写；没有可清理内容时 changed=false。改写前应先征得用户同意。',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要处理的原文。' },
        mode: {
          type: 'string',
          enum: ['auto', 'question', 'hybrid'],
          description: 'auto=机械预清理；question=只输出追问，不改字；hybrid=机械预清理 + 关键追问。',
        },
      },
      required: ['text'],
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (args     , value     ) => {
        const rewrite = value?.rewrite || {};
        const analysis = value?.analysis || {};
        const mode = args?.mode || 'auto';
        const status = rewrite.changed
          ? '机械预清理：已改动'
          : mode === 'question'
            ? '只输出追问：未改动原文'
            : '机械预清理：没有可安全删除的套话，未改动原文';
        const lines = [
          `浓度：${analysis.concentration_label || analysis.concentration || '未知'}（${analysis.concentration_score ?? '?'}）`,
          status,
        ];
        if (Array.isArray(rewrite.changes) && rewrite.changes.length) {
          lines.push(`处理说明：${rewrite.changes.slice(0, 4).join('；')}`);
        }
        if (rewrite.rewritten) lines.push(`清理后：${String(rewrite.rewritten).slice(0, 600)}`);
        return [{ type: 'text', text: lines.join('\n') }];
      },
    },
    async execute(args                                 ) {
      return runCli('rewrite', { text: args.text ?? '', mode: args.mode || 'auto' });
    },
  });

  ctx.tools.register({
    name: 'plainspoken_validate',
    description:
      '核验一次改写是否保真：事实/数字有没有新增，承诺强度有没有从「可能」升级成「必然」，有没有引入新的 AI 味，结尾是否空洞。返回 A/B/C/D 等级与逐项判据。',
    parameters: {
      type: 'object',
      properties: {
        original: { type: 'string', description: '原文。' },
        rewritten: { type: 'string', description: '改写后的文本。' },
      },
      required: ['original', 'rewritten'],
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args     , value     ) => {
        const grade = value?.quality_grade || '未评级';
        const hard = value?.hard_criteria || {};
        const failed = Object.entries(hard).filter(([, ok]) => ok === false).map(([key]) => key);
        return [{
          type: 'text',
          text: `质检：${grade}${failed.length ? `｜未通过：${failed.join('、')}` : '｜硬指标全过'}`,
        }];
      },
    },
    async execute(args                                         ) {
      return runCli('validate', { original: args.original ?? '', rewritten: args.rewritten ?? '' });
    },
  });
}


//# sourceURL=src/tools.ts