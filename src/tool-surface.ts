/**
 * plainspoken-writing-dsh - 预设内工具面收敛插件
 *
 * 挂载位置：白描预设的顶层（与 persona 同级），因此 ctx 作用域就是预设作用域。
 * DSH 的 `ctx.tools.restrict()` 只过滤「从祖先继承来的全局工具」，不碰本作用域
 * 注册的工具（read/write/edit/glob/grep 与 plainspoken_* 都在预设作用域）。
 * 因此 `allow: []` 的语义是：隐藏全部全局工具，只留下白描预设自带的工具。
 *
 * 默认关闭；开关来自 plainspoken-brick-injector 的 `enforceToolSurface` 设置项，
 * 经 shared.js 的进程内单例同步到每个 Agent 的预设作用域。
 */

import { getToolSurfaceEnforced, onToolSurfaceChange } from './shared.js';

export const name = 'plainspoken-tool-surface';
export const inject = ['tools'];

/** 在预设作用域上收紧/解除工具面；失败只记日志，不影响预设其它部分。 */
export function createToolSurfaceController(ctx: any): { sync: () => void; dispose: () => void } {
  let disposeRestriction: (() => void) | undefined;

  const sync = (): void => {
    const want = getToolSurfaceEnforced();
    if (want && disposeRestriction === undefined) {
      try {
        disposeRestriction = ctx.tools.restrict({ allow: [] });
      } catch (error) {
        ctx.logger?.warn?.('plainspoken-tool-surface: 无法收紧工具面（保留完整工具集）');
        ctx.logger?.warn?.(error);
      }
      return;
    }
    if (!want && disposeRestriction !== undefined) {
      disposeRestriction();
      disposeRestriction = undefined;
    }
  };

  return {
    sync,
    dispose: () => {
      disposeRestriction?.();
      disposeRestriction = undefined;
    },
  };
}

export function apply(ctx: any): void {
  const controller = createToolSurfaceController(ctx);
  controller.sync();
  const off = onToolSurfaceChange(controller.sync);

  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => {
      off();
      controller.dispose();
    }, 'plainspoken-tool-surface.restrict()');
  }
}
