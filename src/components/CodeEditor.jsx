import Editor from '@monaco-editor/react'

const CodeEditor = ({ code, onChange, language = 'javascript', theme = 'vs-dark' }) => {
  return (
    <div className="code-editor-wrapper">
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        value={code}
        onChange={(value) => onChange(value ?? '')}
        theme={theme}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          tabSize: 2,
        }}
      />
    </div>
  )
}

export default CodeEditor
