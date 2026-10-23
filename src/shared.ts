/**
 * plainspoken-writing-dsh - 跨插件实例共享的运行时配置
 *
 * 宿主注入器（plainspoken-brick-injector）负责读设置，预设内的 tools 与
 * tool-surface 在各自的 Agent 作用域里执行；用模块级单例把引擎路径、
 * 展示维度数和「强制纯净工具面」开关传过去。
 */

export type ToolSurfaceListener = (enforced: boolean) => void;

let toolSurfaceEnforced = false;
const listeners = new Set<ToolSurfaceListener>();

export function getToolSurfaceEnforced(): boolean {
  return toolSurfaceEnforced;
}

export function setToolSurfaceEnforced(value: boolean): void {
  const next = value === true;
  if (next === toolSurfaceEnforced) return;
  toolSurfaceEnforced = next;
  for (const listener of [...listeners]) {
    try {
      listener(next);
    } catch {
      // 单个作用域失败不应阻断其它作用域
    }
  }
}

export function onToolSurfaceChange(listener: ToolSurfaceListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface PlainspokenRuntimeConfig {
  /** 自定义引擎目录（含 cli.py / core / rules）；空串表示用插件内置 engine/ */
  enginePath: string;
  /** 报告里最多展示几个命中维度 */
  showDimensions: number;
}

let runtimeConfig: PlainspokenRuntimeConfig = {
  enginePath: '',
  showDimensions: 5,
};

export function getRuntimeConfig(): PlainspokenRuntimeConfig {
  return runtimeConfig;
}

export function setRuntimeConfig(next: Partial<PlainspokenRuntimeConfig>): void {
  runtimeConfig = {
    enginePath: typeof next.enginePath === 'string' ? next.enginePath : runtimeConfig.enginePath,
    showDimensions:
      typeof next.showDimensions === 'number' && Number.isFinite(next.showDimensions)
        ? Math.min(25, Math.max(1, Math.floor(next.showDimensions)))
        : runtimeConfig.showDimensions,
  };
}
