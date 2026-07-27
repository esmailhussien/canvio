import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { LivingNode, Point } from '../types';
import './CodeNode.css';

export interface CodeData {
  language: string;
  code: string;
  filename: string;
}

interface CodeNodeProps {
  node: LivingNode;
  selected?: boolean;
  onChange?: (id: string, updates: Partial<LivingNode>) => void;
}

export const CodeNode: React.FC<CodeNodeProps> = ({ node, selected, onChange }) => {
  const rawData = node.data as Partial<CodeData>;
  const data: CodeData = {
    language: typeof rawData.language === 'string' ? rawData.language : 'typescript',
    code: typeof rawData.code === 'string'
      ? rawData.code
      : '// Type or paste code here...\nfunction helloWorld() {\n  console.log("Hello from Canvio!");\n}',
    filename: typeof rawData.filename === 'string' ? rawData.filename : 'script.ts',
  };
  const language = data.language || 'typescript';
  const code = data.code || '// Type or paste code here...\nfunction helloWorld() {\n  console.log("Hello from Canvio!");\n}';
  const filename = data.filename || 'script.ts';

  const [copied, setCopied] = useState(false);
  const [isEditingFilename, setIsEditingFilename] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(node.id, {
        data: { ...data, code: e.target.value }
      });
    }
  };

  const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(node.id, {
        data: { ...data, filename: e.target.value }
      });
    }
  };

  return (
    <div className={`code-node ${selected ? 'code-node--selected' : ''}`}>
      {/* Code Header Bar */}
      <div className="code-node__header">
        <div className="code-node__dots">
          <span className="code-dot red" />
          <span className="code-dot yellow" />
          <span className="code-dot green" />
        </div>
        {isEditingFilename ? (
          <input
            autoFocus
            className="code-node__filename-input"
            value={filename}
            onChange={handleFilenameChange}
            onBlur={() => setIsEditingFilename(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setIsEditingFilename(false);
            }}
          />
        ) : (
          <span
            className="code-node__filename"
            onDoubleClick={() => setIsEditingFilename(true)}
            title="Double-click to rename"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>{filename}</span>
          </span>
        )}
        <button className="code-node__copy-btn" onClick={handleCopy} title="Copy Code">
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Textarea Body */}
      <textarea
        className="code-node__textarea"
        value={code}
        onChange={handleCodeChange}
        placeholder="// Write code here..."
        spellCheck={false}
      />
    </div>
  );
};

export const codePlugin = {
  type: 'code',
  name: 'Code Snippet',
  icon: 'code',
  category: 'core' as const,
  defaultSize: { width: 340, height: 220 },
  create: (position: Point): LivingNode => ({
    id: nanoid(),
    type: 'code',
    position,
    size: { width: 340, height: 220 },
    rotation: 0,
    zIndex: 0,
    locked: false,
    data: {
      language: 'typescript',
      filename: 'index.ts',
      code: '// Canvio Living Code Node\nfunction main() {\n  console.log("Spatial Thinking Enabled");\n}',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }),
  getConnectionPorts: () => [
    { id: 'top', position: 'top' as const },
    { id: 'right', position: 'right' as const },
    { id: 'bottom', position: 'bottom' as const },
    { id: 'left', position: 'left' as const },
  ],
};
