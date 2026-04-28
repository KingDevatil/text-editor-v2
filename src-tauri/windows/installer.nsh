!macro NSIS_HOOK_PREINSTALL
  ; 为所有文件添加"使用Text Editor打开"右键菜单
  WriteRegStr HKCR "*\shell\TextEditor" "" "使用Text Editor打开"
  WriteRegStr HKCR "*\shell\TextEditor" "Icon" "$\"$INSTDIR\text-editor.exe,0$\""
  WriteRegStr HKCR "*\shell\TextEditor\command" "" "$\"$INSTDIR\text-editor.exe$\" $\"%1$\""

  ; 为文件夹添加"使用Text Editor打开"右键菜单
  WriteRegStr HKCR "Directory\shell\TextEditor" "" "使用Text Editor打开"
  WriteRegStr HKCR "Directory\shell\TextEditor" "Icon" "$\"$INSTDIR\text-editor.exe,0$\""
  WriteRegStr HKCR "Directory\shell\TextEditor\command" "" "$\"$INSTDIR\text-editor.exe$\" $\"%1$\""

  ; === 注册为 TextFile 类型的默认打开程序 ===
  ; 设置默认操作为 open
  WriteRegStr HKCR "TextFile" "" "Text Document"
  WriteRegStr HKCR "TextFile\shell" "" "open"
  ; 设置 open 命令
  WriteRegStr HKCR "TextFile\shell\open" "" "打开"
  WriteRegStr HKCR "TextFile\shell\open\command" "" "$\"$INSTDIR\text-editor.exe$\" $\"%1$\""
  ; 通知 Windows 刷新文件关联图标
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegKey HKCR "*\shell\TextEditor"
  DeleteRegKey HKCR "Directory\shell\TextEditor"
  DeleteRegKey HKCR "TextFile\shell\open\command"
  DeleteRegKey HKCR "TextFile\shell\open"
  ; 如果 TextFile 下没有其他 shell 操作，删除整个 TextFile
  DeleteRegKey /ifempty HKCR "TextFile\shell"
  DeleteRegKey /ifempty HKCR "TextFile"
!macroend
