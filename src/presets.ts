/**
 * plainspoken-writing-dsh - 预设积木与提示词组装器
 *
 * 两层积木：
 * 1. 公共底座：文档与工具协作准则（去工程化）
 * 2. 职能人设：白描写作者 / 白描检测员
 * 第三层工作区规则由宿主在 render 期读取并拼接。
 */

export interface PlainspokenPresetBrick {
  id: string;
  name: string;
  summary: string;
  rolePrompt: string;
}

export const BASE_TOOL_PROTOCOL = `【文档与工具协作准则】
你工作在一个本地文档与文本创作工作区中。
1. 对话优先，克制落盘：默认通过直接对话响应。查看目录用 \`glob\`，检索内容用 \`grep\`；只有用户明确要求查看、创建或修改文件时，才调用 \`read\`、\`write\`、\`edit\`；构思与讨论阶段不擅自建文件或覆写原稿。
2. 改稿只做精准替换：保留原文的事实、数字、承诺强度与段落顺序。改完简短说明即可，不要输出代码审阅式的修改点清单。
3. 去工程化：这是文字工作台，不是代码仓库。不用软件工程术语，不做机械分点汇报，不用「总结一下」收尾。
4. 诊断与改写分开：默认只诊断。用户明确要求改写后，才动文字；改写前先确认要保留的内容和声音。`;

export const PLAINSPOKEN_PRESET_BRICKS: Record<string, PlainspokenPresetBrick> = {
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

export type WorkspacePromptMode = 'off' | 'custom' | 'workspace';
export type CustomPromptBehavior = 'append' | 'replace';

export const WORKSPACE_RULES_HEADER = '【工作区上下文规则】';

export interface AssemblePromptOptions {
  activePreset?: string | { get?: () => string };
  includeBaseProtocol?: boolean | { get?: () => boolean };
  customPromptOverride?: string | { get?: () => string };
  workspacePromptMode?: WorkspacePromptMode | { get?: () => WorkspacePromptMode };
  customPromptBehavior?: CustomPromptBehavior | { get?: () => CustomPromptBehavior };
  workspaceDocs?: string;
}

function unwrapValue<T>(val: T | { get?: () => T } | undefined, fallback: T): T {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'object' && val !== null && 'get' in (val as { get?: () => T }) && typeof (val as { get?: () => T }).get === 'function') {
    const inner = (val as { get: () => T }).get();
    return inner !== undefined && inner !== null ? inner : fallback;
  }
  return val as T;
}

export function resolveWorkspacePromptMode(options?: AssemblePromptOptions): WorkspacePromptMode {
  return unwrapValue(options?.workspacePromptMode, 'off');
}

export function assemblePlainspokenPrompt(options?: AssemblePromptOptions): string {
  const activePresetKey = unwrapValue(options?.activePreset, 'writer');
  const includeBaseProtocol = unwrapValue(options?.includeBaseProtocol, true);
  const customPromptOverride = unwrapValue(options?.customPromptOverride, '');
  const workspacePromptMode = unwrapValue(options?.workspacePromptMode, 'off');
  const customPromptBehavior = unwrapValue(options?.customPromptBehavior, 'append');
  const workspaceDocs = typeof options?.workspaceDocs === 'string' ? options.workspaceDocs : '';

  const preset = PLAINSPOKEN_PRESET_BRICKS[activePresetKey] || PLAINSPOKEN_PRESET_BRICKS.writer;

  const sections: string[] = [];
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
