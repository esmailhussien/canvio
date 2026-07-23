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
            📄 {filename}
          </span>
        )}
        <button className="code-node__copy-btn" onClick={handleCopy} title="Copy Code">
          {copied ? '✓ Copied' : '📋 Copy'}
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
