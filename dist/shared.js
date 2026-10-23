/**
 * plainspoken-writing-dsh - 跨插件实例共享的运行时配置
 *
 * 宿主注入器（plainspoken-brick-injector）负责读设置，预设内的 tools 与
 * tool-surface 在各自的 Agent 作用域里执行；用模块级单例把引擎路径、
 * 展示维度数和「强制纯净工具面」开关传过去。
 */



let toolSurfaceEnforced = false;
const listeners = new Set                     ();

export function getToolSurfaceEnforced()          {
  return toolSurfaceEnforced;
}

export function setToolSurfaceEnforced(value         )       {
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

export function onToolSurfaceChange(listener                     )             {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}








let runtimeConfig                           = {
  enginePath: '',
  showDimensions: 5,
};

export function getRuntimeConfig()                           {
  return runtimeConfig;
}

export function setRuntimeConfig(next                                   )       {
  runtimeConfig = {
    enginePath: typeof next.enginePath === 'string' ? next.enginePath : runtimeConfig.enginePath,
    showDimensions:
      typeof next.showDimensions === 'number' && Number.isFinite(next.showDimensions)
        ? Math.min(25, Math.max(1, Math.floor(next.showDimensions)))
        : runtimeConfig.showDimensions,
  };
}


//# sourceURL=src/shared.ts