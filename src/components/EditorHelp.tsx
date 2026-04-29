import React from 'react';
import { X, Keyboard, MousePointer, Eye, Columns, FileText } from 'lucide-react';

interface EditorHelpProps {
  onClose: () => void;
  isDark: boolean;
}

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; isDark: boolean }> = ({
  title,
  icon,
  children,
  isDark,
}) => (
  <div className="mb-6">
    <h3 className={`flex items-center gap-2 text-sm font-semibold mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
      {icon}
      {title}
    </h3>
    <div className={`rounded-lg border ${isDark ? 'border-gray-700/50 bg-gray-800/30' : 'border-gray-200 bg-gray-50'} overflow-hidden`}>
      {children}
    </div>
  </div>
);

const ShortcutRow: React.FC<{ keys: string; desc: string; isDark: boolean }> = ({ keys, desc, isDark }) => (
  <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} border-b last:border-b-0 ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
    <span>{desc}</span>
    <kbd className={`px-2 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
      {keys}
    </kbd>
  </div>
);

const EditorHelp: React.FC<EditorHelpProps> = ({ onClose, isDark }) => {
  const bgColor = isDark ? '#0d1117' : '#ffffff';
  const textColor = isDark ? '#a0aab4' : '#24292f';

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ backgroundColor: bgColor }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 shrink-0 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
        <div className="flex items-center gap-2">
          <Keyboard size={16} style={{ color: textColor }} />
          <span className="text-sm font-medium" style={{ color: textColor }}>编辑器使用说明</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          style={{ color: textColor }}
          title="关闭"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6 max-w-2xl mx-auto w-full">
        <Section title="文本编辑" icon={<FileText size={16} />} isDark={isDark}>
          <ShortcutRow keys="Ctrl + Z" desc="撤销" isDark={isDark} />
          <ShortcutRow keys="Ctrl + Shift + Z" desc="重做" isDark={isDark} />
          <ShortcutRow keys="Ctrl + X" desc="剪切" isDark={isDark} />
          <ShortcutRow keys="Ctrl + C" desc="复制" isDark={isDark} />
          <ShortcutRow keys="Ctrl + V" desc="粘贴" isDark={isDark} />
          <ShortcutRow keys="Ctrl + A" desc="全选" isDark={isDark} />
          <ShortcutRow keys="Ctrl + F" desc="查找" isDark={isDark} />
          <ShortcutRow keys="Ctrl + H" desc="替换" isDark={isDark} />
          <ShortcutRow keys="Tab / Shift + Tab" desc="缩进 / 取消缩进" isDark={isDark} />
        </Section>

        <Section title="多光标与列编辑（Notepad++ 风格）" icon={<MousePointer size={16} />} isDark={isDark}>
          <ShortcutRow keys="Ctrl + 点击" desc="添加多个光标（多光标编辑）" isDark={isDark} />
          <ShortcutRow keys="Alt + 拖拽" desc="矩形框选（列编辑）" isDark={isDark} />
          <ShortcutRow keys="Ctrl + D" desc="选中当前单词，继续按选中下一个匹配" isDark={isDark} />
        </Section>

        <Section title="文件与标签" icon={<FileText size={16} />} isDark={isDark}>
          <ShortcutRow keys="Ctrl + N" desc="新建文件" isDark={isDark} />
          <ShortcutRow keys="Ctrl + O" desc="打开文件" isDark={isDark} />
          <ShortcutRow keys="Ctrl + S" desc="保存" isDark={isDark} />
          <ShortcutRow keys="Ctrl + W" desc="关闭当前标签" isDark={isDark} />
          <ShortcutRow keys="鼠标拖拽标签" desc="同组内排序 / 跨组移动（分屏）" isDark={isDark} />
        </Section>

        <Section title="视图与分屏" icon={<Columns size={16} />} isDark={isDark}>
          <ShortcutRow keys="Ctrl + Shift + P" desc="切换 Markdown 预览" isDark={isDark} />
          <ShortcutRow keys="Ctrl + Shift + R" desc="切换 Markdown 阅读模式" isDark={isDark} />
          <ShortcutRow keys="鼠标拖拽标签到另一侧" desc="分屏编辑" isDark={isDark} />
          <ShortcutRow keys="F11" desc="切换全屏" isDark={isDark} />
        </Section>

        <Section title="Markdown" icon={<Eye size={16} />} isDark={isDark}>
          <div className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            <p className="mb-2">支持 Markdown 实时预览和阅读模式：</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>预览模式：与编辑器并排显示渲染后的 HTML</li>
              <li>阅读模式：专注阅读，带目录导航和字体调节</li>
              <li>文档内目录锚点链接（<code>[标题](#标题)</code>）可点击跳转</li>
            </ul>
          </div>
        </Section>

        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} text-center mt-8`}>
          更多功能持续开发中，如有建议欢迎反馈。
        </div>
      </div>
    </div>
  );
};

export default EditorHelp;
