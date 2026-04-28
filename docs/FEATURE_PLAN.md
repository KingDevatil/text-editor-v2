# Text Editor v2 功能规划 — 多光标 / 命令面板 / 插件系统

> 文档日期：2026-04-28
> 基于当前 CM6 迁移后的代码状态制定

---

## 一、多光标（Multiple Cursors）

### 1.1 CM6 原生能力盘点

CodeMirror 6 的多光标支持已经相当成熟，以下命令均在 `@codemirror/commands` 中：

| 命令 | 默认快捷键 | 说明 |
|------|-----------|------|
| `cursorGroupUp` | Alt+Cmd+↑ | 向上添加光标 |
| `cursorGroupDown` | Alt+Cmd+↓ | 向下添加光标 |
| `selectNextOccurrence` | — | 选中下一个匹配（VSCode Cmd+D） |
| `selectAllOccurrences` | — | 选中所有匹配（VSCode Cmd+Shift+L） |
| `addCursorAt` | — | 在指定位置添加光标（用于 Alt+Click） |

**当前状态**：`defaultKeymap` 已包含上下多光标，`drawSelection` 已启用。
**缺失**：`selectNextOccurrence` / `selectAllOccurrences` 的快捷键绑定，以及 `Alt+Click` 交互。

### 1.2 实现方案

```typescript
// src/utils/cmKeymaps.ts
import { selectNextOccurrence, selectAllOccurrences } from '@codemirror/commands';

export const multiCursorKeymap = [
  { key: 'Mod-d', run: selectNextOccurrence, preventDefault: true },
  { key: 'Shift-Mod-l', run: selectAllOccurrences, preventDefault: true },
];
```

**Alt+Click 添加光标**：
CM6 的 `EditorView.mouseSelectionStyle` 可以自定义。但更简单的方式是在 `CmEditor.tsx` 的 `mousedown` handler 中检测 `e.altKey`：

```typescript
// CmEditor.tsx 的 editorRef mousedown handler
if (e.altKey && !e.shiftKey && !e.ctrlKey) {
  const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
  if (pos !== null) {
    view.dispatch({
      selection: EditorSelection.create(
        view.state.selection.ranges.concat(EditorSelection.cursor(pos))
      ),
    });
  }
  e.preventDefault();
}
```

### 1.3 工作量评估

| 任务 | 耗时 | 文件 |
|------|------|------|
| 多光标 keymap 扩展 | 10 min | `CmEditor.tsx` / 新建 `cmKeymaps.ts` |
| Alt+Click 交互 | 15 min | `CmEditor.tsx` |
| 右键菜单增加「选中所有匹配」 | 10 min | `CmEditor.tsx` |
| **总计** | **~35 min** | |

---

## 二、命令面板（Command Palette）

### 2.1 设计目标

类似 VSCode 的 `Cmd+Shift+P`，提供：
- 全局命令搜索与执行
- 模糊匹配
- 快捷键显示
- 最近使用排序
- 可扩展（为插件系统预留接口）

### 2.2 架构设计

```
┌─────────────────────────────────────────────┐
│            Command Registry (Singleton)       │
│  ┌─────────────┐  ┌─────────────┐            │
│  │  EditorCmd  │  │  AppCmd     │  ...       │
│  │  - format   │  │  - toggleTheme│          │
│  │  - foldAll  │  │  - openFile │            │
│  └─────────────┘  └─────────────┘            │
└──────────────────────┬────────────────────────┘
                       │ subscribe
                       ▼
┌─────────────────────────────────────────────┐
│           CommandPalette UI (Overlay)         │
│  ┌───────────────────────────────────────┐  │
│  │  > _____________________________      │  │
│  │  Format Document      Shift+Alt+F   │  │
│  │  Toggle Preview       Cmd+Shift+V   │  │
│  │  Fold All Regions     Cmd+K Cmd+0   │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 2.3 核心接口

```typescript
// src/commands/types.ts
export interface Command {
  id: string;
  title: string;
  category?: string;        // 分类：Editor / View / File / Help
  shortcut?: string;        // 显示用快捷键描述
  when?: (ctx: CommandContext) => boolean;  // 可用性条件
  run: (ctx: CommandContext) => void | Promise<void>;
}

export interface CommandContext {
  activeTabId: string | null;
  activeView: EditorView | undefined;
  store: EditorStore;
}
```

### 2.4 命令注册表

```typescript
// src/commands/registry.ts
class CommandRegistry {
  private commands = new Map<string, Command>();

  register(cmd: Command) {
    this.commands.set(cmd.id, cmd);
  }

  unregister(id: string) {
    this.commands.delete(id);
  }

  query(input: string): Command[] {
    // 模糊匹配 + 最近使用权重
    const all = Array.from(this.commands.values());
    if (!input) return all;
    return fuse.search(input).map(r => r.item);
  }

  execute(id: string, ctx: CommandContext) {
    const cmd = this.commands.get(id);
    if (!cmd || (cmd.when && !cmd.when(ctx))) return;
    cmd.run(ctx);
  }
}

export const commandRegistry = new CommandRegistry();
```

### 2.5 内置命令清单

| 命令 ID | 标题 | 分类 | 快捷键 |
|---------|------|------|--------|
| `editor.format` | Format Document | Editor | Shift+Alt+F |
| `editor.foldAll` | Fold All Regions | Editor | Cmd+K Cmd+0 |
| `editor.unfoldAll` | Unfold All Regions | Editor | Cmd+K Cmd+J |
| `editor.gotoLine` | Go to Line | Editor | Ctrl+G |
| `editor.selectAllMatches` | Select All Occurrences | Editor | Cmd+Shift+L |
| `view.togglePreview` | Toggle Markdown Preview | View | Cmd+Shift+V |
| `view.toggleSplit` | Toggle Split Editor | View | — |
| `view.toggleTheme` | Toggle Light/Dark Theme | View | — |
| `file.new` | New File | File | Ctrl+N |
| `file.open` | Open File | File | Ctrl+O |
| `file.save` | Save | File | Ctrl+S |
| `file.closeTab` | Close Tab | File | Ctrl+W |

### 2.6 UI 设计

复用 `ContextMenu` 的视觉风格，但改为底部居中弹窗：
- **输入框**：顶部搜索，实时过滤
- **列表**：max-height 400px，支持键盘导航（↑↓Enter Esc）
- **快捷键**：右侧显示绑定
- **分类**：左侧小标签或分组

```tsx
// src/components/CommandPalette.tsx
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+Shift+P 打开
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'p' && e.metaKey && e.shiftKey) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const results = commandRegistry.query(query);

  return open ? (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="w-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl">
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} />
        <ul>
          {results.map((cmd, i) => (
            <li key={cmd.id} className={i === selectedIndex ? 'bg-blue-50' : ''}>
              <span>{cmd.title}</span>
              {cmd.shortcut && <kbd>{cmd.shortcut}</kbd>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  ) : null;
}
```

### 2.7 工作量评估

| 任务 | 耗时 | 文件 |
|------|------|------|
| 命令接口 + 注册表 | 30 min | `src/commands/` 目录 |
| 内置命令实现（~12 个） | 60 min | `src/commands/builtins/` |
| CommandPalette UI 组件 | 45 min | `src/components/CommandPalette.tsx` |
| 全局快捷键绑定 | 15 min | `App.tsx` |
| 模糊搜索集成 | 20 min | 引入 fuse.js 或自研 |
| **总计** | **~2.5 h** | |

---

## 三、插件系统（Plugin System）

### 3.1 设计目标

提供一个**轻量级、可扩展**的插件架构，满足以下场景：
- 用户自定义快捷键绑定
- 添加自定义语言支持
- 集成外部工具（如 LSP、格式化器）
- 主题和 UI 定制
- **安全**：插件不能直接访问 Node.js / Rust 后端 API

### 3.2 架构设计

```
┌────────────────────────────────────────────────────────────┐
│                    Plugin Manager                           │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐ │
│  │  Loader     │  │  Registry   │  │  API Bridge        │ │
│  │  (import)   │  │  (activate) │  │  (sandbox)         │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────┬──────────┘ │
│         │                │                     │            │
│         ▼                ▼                     ▼            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Plugin Instance (User Land)                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │ │
│  │  │ activate │  │ commands │  │ views    │           │ │
│  │  │ (api)    │  │ (reg)    │  │ (panel)  │           │ │
│  │  └──────────┘  └──────────┘  └──────────┘           │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 3.3 插件接口

```typescript
// src/plugins/types.ts
export interface TextEditorAPI {
  // 编辑器操作
  readonly editor: {
    getActiveView(): EditorView | undefined;
    getView(tabId: string): EditorView | undefined;
    insertText(text: string): void;
    replaceRange(from: number, to: number, text: string): void;
    getSelection(): { from: number; to: number; text: string };
  };

  // 命令系统（与命令面板共享）
  readonly commands: {
    register(cmd: Command): void;
    unregister(id: string): void;
  };

  // UI 扩展
  readonly ui: {
    addStatusBarItem(priority: number, render: () => React.ReactNode): string;
    removeStatusBarItem(id: string): void;
    addSidebarPanel(title: string, icon: string, render: () => React.ReactNode): string;
    removeSidebarPanel(id: string): void;
  };

  // 存储（隔离的 per-plugin 存储）
  readonly storage: {
    get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
  };

  // 事件
  readonly events: {
    on(event: 'tabChange' | 'fileOpen' | 'fileSave', handler: (data: unknown) => void): () => void;
  };

  // 主题
  readonly themes: {
    addCustomTheme(name: string, theme: EditorTheme): void;
  };
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;

  activate(api: TextEditorAPI): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
```

### 3.4 插件加载机制

```typescript
// src/plugins/loader.ts
export async function loadPlugin(manifestPath: string): Promise<Plugin> {
  // 1. 读取 manifest.json
  const manifest = await readTextFile(manifestPath);
  const config = JSON.parse(manifest) as PluginManifest;

  // 2. 验证 manifest
  validateManifest(config);

  // 3. 动态导入插件入口
  const entryPath = resolve(manifestPath, '..', config.main);
  const module = await import(/* @vite-ignore */ entryPath);
  const plugin = module.default as Plugin;

  // 4. 验证插件接口
  if (!plugin.id || !plugin.activate) {
    throw new Error(`Invalid plugin: ${config.name}`);
  }

  return plugin;
}
```

**插件目录结构**：
```
plugins/
├── my-plugin/
│   ├── manifest.json
│   ├── index.js
│   └── package.json
└── another-plugin/
    └── ...
```

**manifest.json**：
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Does something cool",
  "author": "User",
  "main": "./index.js",
  "permissions": ["editor", "commands", "storage"]
}
```

### 3.5 安全沙箱

由于 Tauri 的前端代码运行在 WebView 中，插件代码天然隔离于 Node.js 和 Rust 后端。但需要注意：

1. **前端 API 限制**：插件只能访问 `TextEditorAPI`，不能访问 Tauri 的 `invoke`
2. **CSP 策略**：Tauri 的 CSP 限制插件加载外部资源
3. **Storage 隔离**：每个插件有独立的 localStorage 前缀
4. **权限声明**：manifest 中声明权限，未声明的 API 调用会被拒绝

```typescript
// src/plugins/sandbox.ts
function createSandboxedAPI(pluginId: string, permissions: string[]): TextEditorAPI {
  const api = createFullAPI();

  // 根据权限过滤 API
  const allowed = new Set(permissions);
  const sandboxed: Partial<TextEditorAPI> = {};

  for (const [key, value] of Object.entries(api)) {
    if (allowed.has(key)) {
      sandboxed[key as keyof TextEditorAPI] = value;
    }
  }

  return sandboxed as TextEditorAPI;
}
```

### 3.6 插件管理 UI

```
┌──────────────────────────────────────┐
│  Settings  │  Plugins                 │
│──────────────────────────────────────│
│                                      │
│  Installed Plugins                   │
│  ┌────────────────────────────────┐ │
│  │ ☑ My Plugin      v1.0.0    [⚙]│ │
│  │ ☑ LSP Client     v0.2.1    [⚙]│ │
│  │ ☐ Experimental   v0.1.0    [⚙]│ │
│  └────────────────────────────────┘ │
│                                      │
│  [Install from File...]              │
│  [Install from URL...]               │
│                                      │
└──────────────────────────────────────┘
```

### 3.7 工作量评估

| 阶段 | 任务 | 耗时 | 文件 |
|------|------|------|------|
| **Phase 1** | API 接口设计 | 1 h | `src/plugins/types.ts` |
| | 插件加载器 + manifest 解析 | 1 h | `src/plugins/loader.ts` |
| | 沙箱 API 工厂 | 1.5 h | `src/plugins/sandbox.ts` |
| | 插件管理器（activate/deactivate） | 1 h | `src/plugins/manager.ts` |
| **Phase 2** | 命令面板集成（插件注册命令） | 30 min | `src/commands/registry.ts` |
| | UI 扩展点（status bar / sidebar） | 1.5 h | `App.tsx` + 新组件 |
| | Storage 隔离 | 30 min | `src/plugins/storage.ts` |
| **Phase 3** | 插件管理 UI | 1 h | `src/components/PluginManager.tsx` |
| | 设置持久化 | 30 min | `useEditorStore.ts` |
| | 示例插件（Hello World） | 30 min | `plugins/hello-world/` |
| **总计** | | **~9 h** | |

---

## 四、实施优先级建议

```
Week 1 ────────────────────────────────────────────────
Day 1-2: 多光标（35 min）+ 命令面板（2.5 h）
Day 3-5: 命令面板完善 + 内置命令扩展

Week 2 ────────────────────────────────────────────────
Day 1-3: 插件系统 Phase 1（API + Loader + Sandbox）
Day 4-5: 插件系统 Phase 2（UI 扩展 + 集成）

Week 3 ────────────────────────────────────────────────
Day 1-2: 插件系统 Phase 3（UI + 示例）
Day 3-5: 测试、文档、Bugfix
```

### 推荐顺序

1. **多光标** — 工作量最小，用户高频使用，CM6 原生支持
2. **命令面板** — 为插件系统铺垫命令注册机制，自身价值也高
3. **插件系统** — 依赖命令面板，工程量最大，放最后

---

## 五、技术选型

| 功能 | 依赖 | 说明 |
|------|------|------|
| 模糊搜索 | `fuse.js` | 轻量级，~5KB gzip，支持中文 |
| 命令面板快捷键 | 原生 `keydown` | 避开 CM6 keymap，全局捕获 |
| 插件加载 | `import()` | 原生动态导入，Vite 支持 |
| 插件隔离 | Proxy + 权限白名单 | 无需 iframe，够用 |
| 存储隔离 | `localStorage` + 前缀 | `plugin:${id}:${key}` |

---

## 六、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 插件加载失败导致崩溃 | 高 | try/catch 包裹 activate，失败时禁用插件并提示 |
| 插件 API 设计过早固化 | 中 | Phase 1 标记为 `@beta`，允许 breaking change |
| 命令面板与 CM6 keymap 冲突 | 低 | 命令面板捕获 `keydown`，未匹配时放行 |
| 多光标 Alt+Click 与系统冲突 | 低 | 提供设置开关，可改绑为 Alt+Shift+Click |
