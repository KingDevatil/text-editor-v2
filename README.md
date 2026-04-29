# Text Editor V2

一款基于 **Tauri + React + CodeMirror 6** 构建的高性能桌面文本编辑器，支持多种编程语言高亮、分屏编辑、Markdown 预览、文件对比等丰富功能。

![Text Editor V2](./src/assets/hero.png)

---

## ✨ 核心特性

### 编辑器
- **CodeMirror 6 内核**：轻量、极速启动，支持超大文件流畅编辑
- **30+ 语言高亮**：JavaScript、TypeScript、HTML、CSS、JSON、Python、Java、C/C++、C#、Rust、Go、Markdown、YAML、XML、SQL、Shell、INI、Log、Vue、Svelte、Kotlin、Swift、Ruby、PHP、Lua 等
- **多光标编辑**：支持 `Ctrl+D` 选中下一个匹配项、`Ctrl+Shift+L` 选中所有匹配项
- **查找替换**：支持大小写敏感、循环搜索、全部替换
- **代码格式化**：支持 JSON、XML、HTML、CSS、JavaScript、TypeScript、SQL
- **转到定义**：同文件内符号跳转（`F12`）
- **大文件优化**：自动关闭折叠、括号匹配等重扩展，保障大文件流畅度

### 主题系统
- **Light / Dark / Custom 三主题**：一键循环切换
- **22 项可配置颜色**：背景、文字、边框、光标、选中高亮、同字符匹配、标签页、滚动条等全部可自定义
- **实时生效**：在主题编辑器面板中调整颜色，编辑器即时响应
- **导入/导出 JSON**：保存和分享你的专属配色方案

### 界面与交互
- **分屏编辑**：左右双栏独立编辑，方便对照与复制（需至少 2 个标签页）
- **Markdown 预览/阅读模式**：实时预览渲染效果，专注阅读体验
- **文件对比（Diff）**：基于 CodeMirror Merge，高亮差异
- **命令面板（F1）**：快速搜索执行所有命令
- **侧边栏文件树**：浏览项目目录，快速打开文件
- **代码缩略图（Minimap）**：整体代码概览，支持点击跳转
- **自定义右键菜单**：预览和阅读模式接入统一的主题化右键菜单
- **自定义字体大小、自动换行、空白字符显示**

### 文件与编码
- **拖拽打开文件**：支持从系统拖入文件直接编辑
- **多编码支持**：UTF-8、UTF-8 BOM、ANSI、GBK、GB2312、GB18030、BIG5、Shift-JIS、EUC-JP、EUC-KR、ISO-8859-1~9、Windows-1250~1258、KOI8-R、KOI8-U、Macintosh、IBM866 等
- **编码自动检测**：基于 chardetng（Firefox 算法）智能识别文件编码
- **原子写入保存**：先写临时文件再重命名，避免写入中断导致文件损坏
- **未保存更改提醒**：关闭窗口前提示保存

### 系统集成
- **跨平台支持**：Windows（NSIS 安装包）、macOS（DMG 安装包）
- **Windows 文件关联**：可将本编辑器注册为多种文本文件的默认打开方式
- **单实例模式**：已运行时再次打开文件会聚焦到现有窗口
- **系统文件管理器 reveal**：在文件夹中显示当前文件

---

## 🚀 快速开始

### 环境要求
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri-dev
```

### 构建生产版本

```bash
# Windows
npm run tauri-build

# macOS（需在 macOS 系统或 CI 上执行）
npm run tauri-build
```

构建完成后，安装包位于：

| 平台 | 路径 |
|------|------|
| Windows | `src-tauri/target/release/bundle/nsis/Text Editor_1.0.0_x64-setup.exe` |
| macOS | `src-tauri/target/release/bundle/dmg/Text Editor_1.0.0_x64.dmg` |

---

## 📦 自动打包

项目已配置 GitHub Actions，推送 `v*` 标签时自动在 macOS runner 上构建并发布 Release。

```bash
git tag v1.0.0
git push origin v1.0.0
```

也可以手动在 **Actions → Release → Run workflow** 触发。

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + N` | 新建文件 |
| `Ctrl + O` | 打开文件 |
| `Ctrl + S` | 保存文件 |
| `Ctrl + F` | 查找替换 |
| `Ctrl + D` | 选中下一个匹配项 |
| `Ctrl + Shift + L` | 选中所有匹配项 |
| `Shift + Alt + F` | 格式化文档 |
| `F1` | 命令面板 |
| `F12` | 转到定义 |
| `Ctrl + Shift + V` | Markdown 阅读模式 |
| `鼠标拖拽标签` | 同组内排序 / 跨组移动（分屏） |

---

## 🏗️ 技术栈

- **前端框架**：React 19 + TypeScript
- **构建工具**：Vite 8
- **编辑器内核**：CodeMirror 6
- **桌面框架**：Tauri 2
- **样式方案**：Tailwind CSS 3
- **状态管理**：Zustand

---

## 📁 项目结构

```
text-editor-v2/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── hooks/              # 自定义 Hooks（状态管理、文件打开）
│   ├── utils/              # 工具函数（主题、语言扩展、命令等）
│   ├── App.tsx             # 根组件
│   └── types.ts            # TypeScript 类型定义
├── src-tauri/              # Tauri / Rust 后端
│   ├── src/lib.rs          # Rust 主逻辑（文件读写、编码检测等）
│   └── tauri.conf.json     # Tauri 配置
├── .github/workflows/      # GitHub Actions CI
├── dist/                   # 前端构建输出
└── package.json
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

[MIT License](./LICENSE)

---

## 🙏 致谢

本项目图标 **Designed by Freepik**，来自 [www.freepik.com](https://www.freepik.com)。
