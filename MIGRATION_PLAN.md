# Text Editor V2 — CodeMirror 6 迁移计划

> 目标：Monaco → CM6，性能接近 Sublime，功能完全保留

---

## 一、架构变更总览

### Monaco → CM6 API 映射

| Monaco 概念 | CM6 等价 | 说明 |
|---|---|---|
| `ITextModel` (modelUri) | `EditorState` + 自定义 `TabState` map | CM6 无全局 model 注册表，需要自己管理状态 |
| `IStandaloneCodeEditor` | `EditorView` | CM6 的核心视图类 |
| `monaco.editor.createModel()` | `EditorState.create()` | CM6 状态是不可变的 |
| `model.setValue()` | `view.dispatch({ changes })` | CM6 用 transaction 替代直接赋值 |
| `editor.setModel()` | `view.setState()` | 切换标签时替换整个状态 |
| `monaco.editor.getModel(uri)` | 自定义 `tabStates: Map<string, EditorState>` | 需要自建状态池 |
| `model.onDidChangeContent` | `EditorView.updateListener` | CM6 的更新监听 |
| `editor.getAction().run()` | 自定义 `KeyBinding` + `Command` | CM6 的命令系统 |
| `model.findMatches()` | `@codemirror/search` SearchCursor | CM6 的搜索 API |
| `editor.executeEdits()` | `view.dispatch({ changes })` | CM6 的编辑 API |
| `monaco.languages.setMonarchTokensProvider` | `@codemirror/language` + Lezer 语法 | 编译型 vs 解释型 |
| `monaco.editor.defineTheme()` | `@codemirror/view` `EditorView.theme()` | CM6 主题是 extension |
| `monaco.editor.setTheme()` | `view.dispatch({ reconfigure })` | 动态切换主题 |

### 数据流变更

```
当前 (Monaco):
  App → createTab(modelUri) → Monaco全局model注册表 → Editor组件读取model
  切换tab → editor.setModel(另一个model) → 全局model池保持所有model存活

CM6:
  App → createTab(tabId) → tabStates Map<tabId, EditorState> → Editor组件读取state
  切换tab → view.setState(另一个state) → tabStates Map保持所有state存活
  关闭tab → tabStates.delete(tabId) → GC 回收
```

---

## 二、类型系统改造

### `EditorTab` 类型变更

```typescript
// 之前 (Monaco)
interface EditorTab {
  id: string;
  title: string;
  language: string;
  isDirty: boolean;
  filePath?: string;
  encoding: Encoding;
  group?: 1 | 2;
  modelUri: string;          // ← Monaco 特有
  initialContent?: string;
}

// 之后 (CM6)
interface EditorTab {
  id: string;
  title: string;
  language: string;
  isDirty: boolean;
  filePath?: string;
  encoding: Encoding;
  group?: 1 | 2;
  // modelUri 删除，EditorState 由 CmEditorStatePool 统一管理
  initialContent?: string;
}
```

### 新增 `CmEditorStatePool`

```typescript
// 新增：CM6 状态池，替代 Monaco 的全局 model 注册表
class CmEditorStatePool {
  private states = new Map<string, EditorState>();
  private extensions = new Map<string, Extension[]>();  // 每个tab的语言/主题extension

  get(tabId: string): EditorState | undefined;
  set(tabId: string, state: EditorState): void;
  delete(tabId: string): void;
  getContent(tabId: string): string;
  getLineCount(tabId: string): number;
  getValueLength(tabId: string): number;
}
```

---

## 三、分阶段实施计划

### Phase 1：项目初始化 + 编辑器核心（Day 1-3）

#### 1.1 项目脚手架

- [ ] 复制 `text-editor/src-tauri/` 到 `text-editor-v2/src-tauri/`（Rust 端完全保留）
- [ ] 复制 `text-editor/src-tauri/tauri.conf.json`、`Cargo.toml`、`icons/`
- [ ] 新建前端项目：React 19 + Vite + TypeScript + TailwindCSS
- [ ] 安装 CM6 核心依赖：
  ```
  @codemirror/view
  @codemirror/state
  @codemirror/language
  @codemirror/commands
  @codemirror/search
  @codemirror/autocomplete
  @codemirror/lint
  ```
- [ ] 安装语言支持：
  ```
  @codemirror/lang-javascript
  @codemirror/lang-css
  @codemirror/lang-html
  @codemirror/lang-json
  @codemirror/lang-python
  @codemirror/lang-java
  @codemirror/lang-cpp
  @codemirror/lang-rust
  @codemirror/lang-go
  @codemirror/lang-sql
  @codemirror/lang-yaml
  @codemirror/lang-xml
  @codemirror/lang-markdown
  @codemirror/lang-shell
  ```
- [ ] 保留非 Monaco 依赖：`react`、`react-dom`、`zustand`、`@tauri-apps/api`、`@tauri-apps/plugin-dialog`、`lucide-react`、`marked`
- [ ] 移除：`monaco-editor`、`monaco-worker.d.ts`
- [ ] 更新 `vite.config.ts`：移除 Monaco manualChunks 配置

#### 1.2 CmEditor 组件

- [ ] 创建 `src/components/CmEditor.tsx`（替代 `MonacoEditor.tsx`）
  - Props：`tabId`, `language`, `theme`, `onChange`, `readOnly`, `fontSize`, `unicodeHighlight`, `largeFileOptimize`, `initialContent`
  - 使用 `useRef<EditorView>` 管理 CM6 实例
  - 使用 `Compartment` 实现动态配置切换（语言、主题、只读等）
  - 使用 `ResizeObserver` + `requestAnimationFrame` 节流 layout
  - IME 支持：CM6 原生支持 CJK 输入法，无需手动处理 compositionstart/end

#### 1.3 CmEditorStatePool

- [ ] 创建 `src/hooks/useEditorStatePool.ts`
  - `Map<string, EditorState>` 管理所有 tab 的编辑状态
  - `createState(tabId, content, language)` — 创建初始状态
  - `getState(tabId)` — 获取状态（切换标签用）
  - `deleteState(tabId)` — 删除状态（关闭标签用）
  - `getContent(tabId)` — 获取文本内容（保存用）
  - `getLineCount(tabId)` / `getValueLength(tabId)` — 状态栏用

#### 1.4 基础功能验证

- [ ] 打开文件 → 显示内容
- [ ] 编辑 → 标记 dirty
- [ ] 保存 → 写入文件
- [ ] 切换标签 → 状态保留
- [ ] 关闭标签 → 状态清理

### Phase 2：语言支持 + 主题（Day 4-5）

#### 2.1 语言映射

- [ ] 创建 `src/utils/languageExtensions.ts`
  ```typescript
  import { javascript } from '@codemirror/lang-javascript';
  import { css } from '@codemirror/lang-css';
  // ...
  
  const LANGUAGE_EXTENSIONS: Record<string, () => Extension[]> = {
    javascript: () => [javascript({ jsx: true, typescript: false })],
    typescript: () => [javascript({ jsx: true, typescript: true })],
    html: () => [html()],
    css: () => [css()],
    json: () => [json()],
    python: () => [python()],
    java: () => [java()],
    cpp: () => [cpp()],
    rust: () => [rust()],
    go: () => [go()],
    markdown: () => [markdown()],
    yaml: () => [yaml()],
    xml: () => [xml()],
    sql: () => [sql()],
    shell: () => [shell()],
    ini: () => [iniSupport()],   // 需要自定义 StreamLanguage
    log: () => [logHighlight()], // 需要自定义 Decorations
  };
  ```

#### 2.2 自定义语言支持

- [ ] `ini` 语言：使用 `StreamLanguage` 定义（CM6 没有 @codemirror/lang-ini）
- [ ] `log` 语言：使用 `ViewPlugin` + `Decoration` 实现 INFO/WARN/ERROR 高亮
  - CM6 的 Decoration 比 Monaco 的 Monarch 更高效：只对可见行应用

#### 2.3 主题系统

- [ ] 创建 `src/utils/themes.ts`
  ```typescript
  // CM6 主题是静态 Extension，通过 Compartment 动态切换
  const lightTheme = EditorView.theme({ ... });
  const darkTheme = EditorView.theme({ ... }, { dark: true });
  const hcTheme = EditorView.theme({ ... }, { dark: true });
  ```
- [ ] 亮色主题（`vs`）：白色背景、深色文字
- [ ] 暗色主题（`vs-dark`）：深灰背景、浅色文字
- [ ] 高对比度主题（`hc-black`）：黑色背景、纯白文字
- [ ] 使用 `Compartment.of(theme)` 实现运行时切换

### Phase 3：查找替换 + 高级功能（Day 6-7）

#### 3.1 查找替换

- [ ] 重写 `FindReplace.tsx`
  - Monaco 方式：`model.findMatches()` → `editor.executeEdits()`
  - CM6 方式：`@codemirror/search` 的 `SearchCursor` + `replaceNext` / `replaceAll`
  - 使用 CM6 内置的 search panel extension 或自定义 UI

#### 3.2 Markdown 预览

- [ ] 修改 `MarkdownPreview.tsx`
  - 之前：`monaco.editor.getModel(monaco.Uri.parse(modelUri)).getValue()`
  - 之后：`statePool.getContent(tabId)`
  - 之前：`model.onDidChangeContent()`
  - 之后：通过 Zustand store 的 `onContentChange` 回调，或 EditorView 的 `updateListener`

#### 3.3 状态栏

- [ ] 修改 `StatusBar.tsx`
  - 之前：`monaco.editor.getModel(monaco.Uri.parse(tab.modelUri)).getLineCount()`
  - 之后：`statePool.getLineCount(tab.id)`
  - 之前：`model.onDidChangeContent()` 驱动字数统计
  - 之后：`EditorView.updateListener` 或 store 订阅

#### 3.4 右键菜单

- [ ] CM6 没有内置右键菜单（Monaco 有）
- [ ] 方案：使用自定义 `ContextMenu` 组件 + CM6 的 `commands` API
  - 撤销/恢复：`undo` / `redo` command
  - 剪切/复制/粘贴：浏览器原生 + CM6 selection
  - 格式化 JSON：自定义 command
  - 中文翻译：直接在自定义菜单中写中文

### Phase 4：大文件优化（Day 8-9）

#### 4.1 渐进式加载

- [ ] 保留 Rust 端 `read_file_meta` + `read_file_auto_detect` 不变
- [ ] CM6 原生 viewport 渲染：只渲染可见行，不需要 Monaco 的 pushEditOperations hack
- [ ] 大文件策略简化：
  ```
  // 之前 (Monaco): 
  // 1. 显示前 1000 行
  // 2. 后台 100KB chunk 追加 (pushEditOperations)
  // 3. 非活跃 tab 暂停追加

  // 之后 (CM6):
  // 1. 直接创建 EditorState（即使 10MB 文件也只需 ~100ms）
  // 2. Lezer 语法分析增量进行，只解析可见区域
  // 3. 不需要手动 chunk 追加——CM6 的不可变数据结构本身就高效
  ```
- [ ] 大文件优化开关：
  - 关闭折叠：`folding: false`
  - 关闭 bracket 匹配：不加载 `bracketMatching` extension
  - 限制 tokenization 行长：`StreamLanguage` 的 `token` 函数加行长度检查

#### 4.2 内存管理

- [ ] 非活跃 tab 的 EditorState 保留在内存（只是 JS 对象，~10KB/MB文件）
- [ ] 超大文件（>50MB）可考虑将 EditorState 序列化为 JSON 存入 IndexedDB，切回时反序列化

### Phase 5：UI 组件迁移 + 完善（Day 10-12）

#### 5.1 无需修改的组件

| 组件 | Monaco 依赖 | 改动 |
|------|-----------|------|
| `Toolbar.tsx` | 无 | 仅改主题类型名 |
| `TabBar.tsx` | 无 | 仅改 `EditorTab` 类型（去掉 modelUri） |
| `Sidebar.tsx` | 无 | 不变 |

#### 5.2 需要修改的组件

| 组件 | 改动内容 |
|------|---------|
| `App.tsx` | 去掉 `import * as monaco`，改为 `statePool`；editorRef 类型改为 `EditorView` |
| `StatusBar.tsx` | 去掉 `import * as monaco`，改用 `statePool` API |
| `FindReplace.tsx` | 去掉 `import * as monaco`，改用 CM6 SearchCursor |
| `MarkdownPreview.tsx` | 去掉 `import * as monaco`，改用 `statePool.getContent()` |

#### 5.3 useEditorStore 改造

- [ ] 去掉 `generateModelUri()` 函数
- [ ] `createTab` 不再生成 `modelUri`
- [ ] `EditorTab` 类型去掉 `modelUri` 字段
- [ ] 新增 `statePool` 引用

#### 5.4 useFileOpener 改造

- [ ] 去掉 `import * as monaco`
- [ ] 去掉 `void import('../components/MonacoEditor')` 预加载（CM6 不需要，体积小）
- [ ] 去掉所有 `monaco.editor.getModel(monaco.Uri.parse(...))` 调用
- [ ] 去掉 `pushEditOperations` 分块追加（CM6 不需要）
- [ ] 简化为：读取文件 → `statePool.createState()` → 创建 tab
- [ ] 大文件：直接全量创建 state（CM6 的开销可忽略）

### Phase 6：性能优化 + 测试（Day 13-14）

#### 6.1 CM6 特有优化

- [ ] **Extension 懒加载**：语言包按需加载（`() => import('@codemirror/lang-python')`）
- [ ] **Compartment 热切换**：语言、主题通过 Compartment 切换，不重建 EditorView
- [ ] **Worker 模式**：Lezer 语法分析在 Worker 中运行（CM6 默认支持）
- [ ] **大文件检测**：文件 >2MB 时不加载 folding/bracketMatching 等重 extension

#### 6.2 基准测试

| 指标 | Monaco (V1) | CM6 (V2 目标) |
|------|------------|-------------|
| 冷启动到可编辑 | 300-800ms | < 100ms |
| 打开 1MB 文件 | ~1s | < 200ms |
| 打开 10MB 文件 | 3-5s | < 500ms |
| 切换标签（大文件） | 3s 卡顿 | < 50ms |
| 打字延迟 | ~16ms | < 5ms |
| JS 包体积 | ~4MB | ~200KB |
| 内存占用（10MB 文件） | ~500MB | ~50MB |
| 调整窗口大小 | 卡顿 | 流畅 |

---

## 四、关键文件清单

### 新增文件

| 文件 | 用途 |
|------|------|
| `src/components/CmEditor.tsx` | CM6 编辑器封装（替代 MonacoEditor.tsx） |
| `src/hooks/useEditorStatePool.ts` | CM6 状态池（替代 Monaco 全局 model 注册表） |
| `src/utils/languageExtensions.ts` | 语言 → CM6 Extension 映射 |
| `src/utils/themes.ts` | CM6 主题定义（亮/暗/高对比） |
| `src/utils/cmCommands.ts` | 自定义命令（格式化JSON等） |
| `src/utils/logHighlight.ts` | log 语言高亮（CM6 Decoration） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/types.ts` | `EditorTab` 去掉 `modelUri` |
| `src/App.tsx` | 去掉 `import * as monaco`，改用 `statePool` + `EditorView` |
| `src/hooks/useEditorStore.ts` | 去掉 `generateModelUri`，`createTab` 不生成 modelUri |
| `src/hooks/useFileOpener.ts` | 去掉所有 Monaco API 调用，简化大文件逻辑 |
| `src/components/FindReplace.tsx` | 改用 CM6 SearchCursor |
| `src/components/MarkdownPreview.tsx` | 改用 statePool 获取内容 |
| `src/components/StatusBar.tsx` | 改用 statePool API |
| `vite.config.ts` | 移除 Monaco manualChunks |
| `package.json` | 移除 `monaco-editor`，添加 CM6 依赖 |

### 删除文件

| 文件 | 原因 |
|------|------|
| `src/components/MonacoEditor.tsx` | 被 CmEditor.tsx 替代 |
| `src/monaco-worker.d.ts` | Monaco Worker 类型声明，不再需要 |

### 保留不变

| 文件/目录 | 原因 |
|-----------|------|
| `src-tauri/` | Rust 后端完全保留 |
| `src/components/Toolbar.tsx` | 无 Monaco 依赖 |
| `src/components/TabBar.tsx` | 无 Monaco 依赖（只改类型） |
| `src/components/Sidebar.tsx` | 无 Monaco 依赖 |
| `src/main.tsx` | 入口不变 |
| `src/index.css` | 样式不变 |
| `src/assets/` | 资源不变 |

---

## 五、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| CM6 API 学习曲线 | 开发时间 +1-2 天 | 已分析所有 API 映射，有明确方案 |
| IME 输入法兼容性 | CJK 用户体验 | CM6 原生支持 IME，比 Monaco 更好 |
| 自定义右键菜单工作量 | +0.5 天 | CM6 社区有 context-menu 扩展可参考 |
| INI/Log 语言需自定义 | +0.5 天 | 用 StreamLanguage/Decoration 实现，代码量小 |
| 分屏模式状态共享 | 切换 tab 时状态同步 | 两个 EditorView 共享同一个 EditorState |

---

## 六、里程碑

| 里程碑 | 交付物 | 预计时间 |
|--------|--------|---------|
| M1: 基础编辑 | 打开/编辑/保存/切换标签 | Day 3 |
| M2: 语言+主题 | 20种语言高亮 + 3套主题 | Day 5 |
| M3: 完整功能 | 查找替换/预览/右键菜单/分屏 | Day 7 |
| M4: 大文件优化 | 10MB 文件流畅打开 | Day 9 |
| M5: 全量迁移 | 所有 UI 组件迁移完成 | Day 12 |
| M6: 性能验证 | 基准测试通过 | Day 14 |
