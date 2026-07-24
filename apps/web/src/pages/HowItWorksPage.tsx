import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvasStore } from '../store/canvasStore';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { IconTheme } from '@canvio/ui';
import './HowItWorksPage.css';

type FeatureTab = 'spatial-nodes' | 'gesture-ink' | 'spatial-ai' | 'pdf-collab';

export function HowItWorksPage() {
  const navigate = useNavigate();
  const theme = useCanvasStore((s) => s.theme);
  const toggleTheme = useCanvasStore((s) => s.toggleTheme);
  const [activeTab, setActiveTab] = useState<FeatureTab>('spatial-nodes');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="guide-page dot-grid">
      {/* Navigation Bar */}
      <nav className="guide-nav">
        <div className="guide-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <CanvioLogoIcon size={26} />
          <span className="guide-logo__text">Canvio</span>
        </div>
        <div className="guide-nav__links">
          <button className="guide-nav__link" onClick={() => navigate('/')}>
            Workspace
          </button>
          <button className="guide-nav__link" onClick={() => navigate('/how-it-works')}>
            How It Works
          </button>
          <button className="guide-nav__link" onClick={() => navigate('/support')}>
            Support
          </button>
          <button className="guide-btn-primary" onClick={() => navigate('/w/demo-workspace')}>
            + Launch Canvas
          </button>
          <button
            className="guide-theme-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <IconTheme size={18} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="guide-hero">
        <div className="guide-hero__badge">
          <span className="material-symbols-outlined text-sm" style={{ color: '#6366f1' }}>school</span>
          <span>Interactive Feature Guide & Capabilities</span>
        </div>
        <h1 className="guide-hero__title">
          Master <span>Canvio</span> in Minutes
        </h1>
        <p className="guide-hero__subtitle">
          An intuitive visual workspace combining spatial AI, vector drawing, living maps, and multi-page PDF generation.
        </p>
      </header>

      {/* Feature Selector Tabs */}
      <div className="guide-tabs-nav">
        <button
          className={`guide-tab-btn ${activeTab === 'spatial-nodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('spatial-nodes')}
        >
          <span className="material-symbols-outlined">space_dashboard</span>
          <span>Spatial Nodes</span>
        </button>
        <button
          className={`guide-tab-btn ${activeTab === 'gesture-ink' ? 'active' : ''}`}
          onClick={() => setActiveTab('gesture-ink')}
        >
          <span className="material-symbols-outlined">edit</span>
          <span>Smart Gesture Ink</span>
        </button>
        <button
          className={`guide-tab-btn ${activeTab === 'spatial-ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('spatial-ai')}
        >
          <span className="material-symbols-outlined">auto_awesome</span>
          <span>Spatial AI</span>
        </button>
        <button
          className={`guide-tab-btn ${activeTab === 'pdf-collab' ? 'active' : ''}`}
          onClick={() => setActiveTab('pdf-collab')}
        >
          <span className="material-symbols-outlined">group</span>
          <span>Multiplayer & PDF</span>
        </button>
      </div>

      {/* Main Guide Content */}
      <main className="guide-main">
        {/* TAB 1: SPATIAL NODES */}
        {activeTab === 'spatial-nodes' && (
          <section className="guide-feature-detail fade-in">
            <div className="guide-detail__info">
              <span className="guide-detail__tag">01 / Infinite Canvas</span>
              <h2>Flexible Spatial Nodes & Living Embeds</h2>
              <p>
                Break free from linear documents. Canvio lets you position, organize, and nest diverse node types across an infinite 2D plane:
              </p>

              <div className="capabilities-grid">
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#f59e0b' }}>sticky_note_2</span>
                  <h4>Sticky Notes & Markdown</h4>
                  <p>Capture quick thoughts, color-code ideas, and format rich text with full GFM Markdown support.</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#6366f1' }}>map</span>
                  <h4>Living Map Embeds</h4>
                  <p>Embed interactive spatial Leaflet maps with custom coordinates, markers, and live tile layers.</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#10b981' }}>code</span>
                  <h4>Executable Code Snippets</h4>
                  <p>Write and display code with automatic syntax highlighting and execution wrappers.</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#ec4899' }}>crop_free</span>
                  <h4>Frames & Sectioning</h4>
                  <p>Group related objects inside frames for clean multi-page document pagination and exports.</p>
                </div>
              </div>
            </div>

            {/* Visual Canvas Demo Container */}
            <div className="guide-detail__visual-canvas">
              <div className="visual-canvas-header">
                <div className="visual-canvas-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="visual-canvas-title">Infinite Canvas — Spatial Preview</div>
                <span className="material-symbols-outlined text-xs opacity-50">pan_tool</span>
              </div>
              <div className="visual-canvas-body dot-grid">
                <div className="visual-node demo-sticky">
                  <div className="visual-node-bar">
                    <span>Sticky Note</span>
                    <span className="material-symbols-outlined text-xs">pin</span>
                  </div>
                  <div className="visual-node-content">
                    💡 <strong>Architecture Goal Q3</strong>
                    <p>Decouple node rendering logic into high-performance web workers.</p>
                  </div>
                </div>

                <div className="visual-node demo-map">
                  <div className="visual-node-bar">
                    <span>Living Map Widget</span>
                    <span className="material-symbols-outlined text-xs text-indigo-400">location_on</span>
                  </div>
                  <div className="visual-node-map-bg">
                    <span className="material-symbols-outlined text-2xl text-indigo-400">my_location</span>
                    <span>San Francisco Hub</span>
                  </div>
                </div>

                <div className="visual-connector-line">
                  <span className="material-symbols-outlined text-sm text-indigo-400">arrow_forward</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: SMART GESTURE INK */}
        {activeTab === 'gesture-ink' && (
          <section className="guide-feature-detail fade-in">
            <div className="guide-detail__info">
              <span className="guide-detail__tag">02 / Gesture Engine</span>
              <h2>Ink-to-Shape & Gesture Arrow Recognition</h2>
              <p>
                Draw naturally with a mouse, stylus, or touch screen. Canvio's smart gesture engine translates hand-drawn strokes into perfect vector geometry.
              </p>

              <div className="capabilities-grid">
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#3b82f6' }}>gesture</span>
                  <h4>Ink-to-Shape Conversion</h4>
                  <p>Draw a rough circle, rectangle, or diamond; Canvio instantly snaps it into clean vector paths.</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#8b5cf6' }}>trending_flat</span>
                  <h4>Gesture Connections</h4>
                  <p>Draw a single line stroke between any two nodes to create an intelligent routed arrow.</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#ec4899' }}>brush</span>
                  <h4>Pressure Vector Strokes</h4>
                  <p>Smooth, pressure-sensitive freehand ink powered by optimized Bezier curve interpolation.</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#f59e0b' }}>polyline</span>
                  <h4>Polyline Routing</h4>
                  <p>Connection lines automatically adjust and re-route as you move or resize canvas nodes.</p>
                </div>
              </div>
            </div>

            {/* Visual Ink Demo */}
            <div className="guide-detail__visual-canvas">
              <div className="visual-canvas-header">
                <div className="visual-canvas-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="visual-canvas-title">Gesture Engine — Live Stroke Snap</div>
              </div>
              <div className="visual-canvas-body dot-grid center-content">
                <div className="visual-sketch-demo">
                  <div className="rough-sketch">
                    <span className="sketch-label">Hand Sketch</span>
                    <div className="rough-box">✏️ Rough Circle</div>
                  </div>
                  <span className="material-symbols-outlined snap-arrow">east</span>
                  <div className="snapped-shape">
                    <span className="sketch-label">Vector Snap</span>
                    <div className="perfect-circle">
                      <span className="material-symbols-outlined text-emerald-400">check</span>
                      <span>Vector Path</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: SPATIAL AI */}
        {activeTab === 'spatial-ai' && (
          <section className="guide-feature-detail fade-in">
            <div className="guide-detail__info">
              <span className="guide-detail__tag">03 / AI Co-Pilot & BYOK</span>
              <h2>Spatial AI Engine, BYOK & Auto-Synthesis</h2>
              <p>
                Use AI as an active spatial collaborator. Connect your own API keys (Google Gemini, OpenAI, or Anthropic Claude) with zero server tracking, and transform your infinite canvas into structured knowledge.
              </p>

              <div className="capabilities-grid">
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#a855f7' }}>key</span>
                  <h4>Bring Your Own Key (BYOK)</h4>
                  <p>Support for Google Gemini (2.5 & 3 Flash/Pro), OpenAI (GPT-4o), and Anthropic Claude with local, private key storage.</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#6366f1' }}>summarize</span>
                  <h4>✨ Summarize & Research Papers</h4>
                  <p>Summarize the entire canvas into executive boards or academic research paper outlines (Abstract, Methodology, Findings, Conclusion).</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#06b6d4' }}>auto_awesome</span>
                  <h4>✨ AI Expand & Brainstorm</h4>
                  <p>Click any node to spawn 3 related sub-topics and automatically link them with labeled semantic relations.</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#10b981' }}>grid_view</span>
                  <h4>✨ Organize & Cluster</h4>
                  <p>Group messy whiteboard notes into thematic, color-coded section frames automatically on command.</p>
                </div>
              </div>
            </div>

            {/* Visual AI Demo */}
            <div className="guide-detail__visual-canvas">
              <div className="visual-canvas-header">
                <div className="visual-canvas-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="visual-canvas-title">Spatial AI — BYOK Engine & Brainstorming</div>
              </div>
              <div className="visual-canvas-body dot-grid">
                <div className="visual-ai-prompt">
                  <span className="material-symbols-outlined text-purple-400">auto_awesome</span>
                  <span>"Google Gemini 2.5 Flash • BYOK Connected"</span>
                </div>
                <div className="visual-ai-results">
                  <div className="ai-node">✨ AI Executive Summary</div>
                  <div className="ai-node">⚡ Key Decisions & Risks</div>
                  <div className="ai-node">🎓 Academic Research Paper</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: MULTIPLAYER & PDF */}
        {activeTab === 'pdf-collab' && (
          <section className="guide-feature-detail fade-in">
            <div className="guide-detail__info">
              <span className="guide-detail__tag">04 / Export & Sync</span>
              <h2>Real-Time Multiplayer & A4 Multi-Page PDF</h2>
              <p>
                Collaborate seamlessly in real-time with zero signup required, then export your canvas into production-ready PDF documents.
              </p>

              <div className="capabilities-grid">
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#ec4899' }}>group</span>
                  <h4>Multiplayer Cursors</h4>
                  <p>Real-time cursor presence, selection highlights, and zero-latency YJS WebSocket synchronization.</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#ef4444' }}>picture_as_pdf</span>
                  <h4>Multi-Page A4 PDF Export</h4>
                  <p>Export canvas frames into crisp, multi-page vector A4 PDFs for reports and presentations.</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#10b981' }}>share</span>
                  <h4>Zero-Signup Share Links</h4>
                  <p>Share a simple URL to let anyone join and contribute immediately without friction.</p>
                </div>
                <div className="cap-card">
                  <span className="material-symbols-outlined cap-icon" style={{ color: '#f59e0b' }}>file_download</span>
                  <h4>High-Res PNG & SVG</h4>
                  <p>Export individual nodes, selected frames, or the full canvas in PNG or scalable SVG formats.</p>
                </div>
              </div>
            </div>

            {/* Visual Collab & PDF Demo */}
            <div className="guide-detail__visual-canvas">
              <div className="visual-canvas-header">
                <div className="visual-canvas-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="visual-canvas-title">Multiplayer & Vector PDF Export</div>
              </div>
              <div className="visual-canvas-body dot-grid center-content">
                <div className="visual-pdf-preview-box">
                  <div className="pdf-page-mockup">
                    <span className="pdf-page-num">Page 1 / A4</span>
                    <div className="pdf-page-content">
                      <div className="pdf-line long" />
                      <div className="pdf-line short" />
                      <div className="pdf-line medium" />
                    </div>
                  </div>
                  <div className="pdf-action-tag">
                    <span className="material-symbols-outlined text-red-400">picture_as_pdf</span>
                    <span>100% Vector PDF Output</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Pro Tips Section */}
        <section className="guide-protips-section">
          <h2>
            <span className="material-symbols-outlined text-amber-400">tips_and_updates</span>
            <span>Pro Tips for Power Users</span>
          </h2>
          <div className="protips-grid">
            <div className="protip-card">
              <div className="protip-icon">💡</div>
              <h4>Frame Page Layouts for PDF</h4>
              <p>Wrap related notes in an A4 Aspect Frame before exporting to ensure perfectly formatted pages.</p>
            </div>
            <div className="protip-card">
              <div className="protip-icon">⚡</div>
              <h4>Instant Arrow Connection</h4>
              <p>Draw a quick freehand stroke from Node A to Node B — Canvio instantly creates a routed connector.</p>
            </div>
            <div className="protip-card">
              <div className="protip-icon">🎯</div>
              <h4>Angle Snapping</h4>
              <p>Hold <kbd>Shift</kbd> while drawing lines to snap to exact 45° and 90° straight angles.</p>
            </div>
            <div className="protip-card">
              <div className="protip-icon">🚀</div>
              <h4>Instant Share URLs</h4>
              <p>Copy your browser workspace URL and send it to a teammate for instant live multiplayer.</p>
            </div>
          </div>
        </section>

        {/* Complete Keyboard & Mouse Gesture Index */}
        <section className="guide-shortcuts-section">
          <h2>Keyboard & Mouse Gesture Shortcuts</h2>
          <div className="shortcuts-grid">
            <div className="shortcut-card">
              <kbd>V</kbd>
              <span>Select & Move Tool</span>
            </div>
            <div className="shortcut-card">
              <kbd>P</kbd>
              <span>Vector Pen Tool</span>
            </div>
            <div className="shortcut-card">
              <kbd>Space + Drag</kbd>
              <span>Pan Infinite Canvas</span>
            </div>
            <div className="shortcut-card">
              <kbd>Scroll Wheel</kbd>
              <span>Infinite Zoom In / Out</span>
            </div>
            <div className="shortcut-card">
              <kbd>Shift + Click</kbd>
              <span>Multi-Select Nodes</span>
            </div>
            <div className="shortcut-card">
              <kbd>Cmd / Ctrl + Z</kbd>
              <span>Undo Action</span>
            </div>
            <div className="shortcut-card">
              <kbd>Delete / Backspace</kbd>
              <span>Delete Selected Nodes</span>
            </div>
            <div className="shortcut-card">
              <kbd>Double Click Canvas</kbd>
              <span>Quick Create Sticky Note</span>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="guide-cta-section">
          <h2>Experience Canvio in Action</h2>
          <p>Launch your infinite canvas now — no registration required.</p>
          <button className="guide-btn-action" onClick={() => navigate('/w/demo-workspace')}>
            <span className="material-symbols-outlined">rocket_launch</span>
            <span>Launch Canvio Canvas</span>
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer className="guide-footer">
        <div className="guide-footer__brand">
          <CanvioLogoIcon size={20} />
          <span>Canvio — Connect ideas. Create knowledge.</span>
        </div>
        <div className="guide-footer__links">
          <button className="guide-footer__link" onClick={() => navigate('/')}>Home</button>
          <button className="guide-footer__link" onClick={() => navigate('/support')}>Support</button>
        </div>
      </footer>
    </div>
  );
}
