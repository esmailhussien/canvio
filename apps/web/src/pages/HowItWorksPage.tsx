import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { createBoard } from '../utils/api';
import { useCanvasStore } from '../store/canvasStore';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { IconTheme } from '@canvio/ui';
import './HowItWorksPage.css';

type FeatureTab = 'start' | 'build' | 'connect' | 'deliver';

function GuideGlyph({ value, color }: { value: string; color?: string }) {
  return (
    <span className="guide-glyph" style={color ? { color } : undefined} aria-hidden="true">
      {value}
    </span>
  );
}

const TAB_CONTENT: Record<FeatureTab, {
  icon: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  points: Array<{ glyph: string; title: string; text: string; color: string }>;
}> = {
  start: {
    icon: '+',
    label: 'Start',
    eyebrow: '01 / Begin anywhere',
    title: 'Open a blank board, use a model, or ask AI to draft the first structure.',
    description: 'Canvio should feel familiar from the first click: choose a blank canvas, a ready-made board, or a guided AI start without learning a complicated workflow.',
    points: [
      { glyph: 'B', title: 'Blank canvas', text: 'Start from scratch when the idea is still open and messy.', color: '#38bdf8' },
      { glyph: 'M', title: 'Ready-made models', text: 'Use lesson, study, strategy, flow, and planning boards as clean starting points.', color: '#22c55e' },
      { glyph: 'AI', title: 'AI first draft', text: 'Ask the navigator to create a useful board structure from a prompt.', color: '#a855f7' },
      { glyph: 'T', title: 'Readable themes', text: 'Switch dark, light, and board background colors for different rooms and devices.', color: '#f59e0b' },
    ],
  },
  build: {
    icon: 'B',
    label: 'Build',
    eyebrow: '02 / Think visually',
    title: 'Add notes, shapes, ink, highlights, frames, maps, images, and code as living objects.',
    description: 'Everything on the canvas is an object you can move, resize, connect, focus, present, export, or reuse. The board stays flexible without becoming chaotic.',
    points: [
      { glyph: 'N', title: 'Notes and text', text: 'Capture ideas quickly, then edit and arrange them like real whiteboard material.', color: '#facc15' },
      { glyph: 'P', title: 'Pen and highlighter', text: 'Draw, mark, annotate, and turn rough shapes or arrows into cleaner visual elements.', color: '#ef4444' },
      { glyph: 'F', title: 'Frames and pages', text: 'Wrap content into pages, sections, lessons, slides, or export-ready groups.', color: '#6366f1' },
      { glyph: 'O', title: 'Rich objects', text: 'Bring in maps, images, code, and structured blocks when the board needs more than text.', color: '#06b6d4' },
    ],
  },
  connect: {
    icon: 'C',
    label: 'Connect',
    eyebrow: '03 / Make meaning',
    title: 'Draw relationships between ideas, places, decisions, activities, and evidence.',
    description: 'Relations are not decoration. They explain cause, sequence, proof, dependency, and flow. Smart routing keeps connections readable as the board changes.',
    points: [
      { glyph: '->', title: 'Dynamic arrows', text: 'Connect objects with readable routed lines that avoid important content.', color: '#38bdf8' },
      { glyph: 'L', title: 'Meaningful labels', text: 'Name the relation: starts with, proves, prepares, depends on, or reveals.', color: '#f472b6' },
      { glyph: 'PIN', title: 'Pin-level context', text: 'Map pins can act like real canvas anchors for site visits and place-based work.', color: '#22c55e' },
      { glyph: 'F', title: 'Focus mode', text: 'Spotlight one object and its connected context during review or teaching.', color: '#a855f7' },
    ],
  },
  deliver: {
    icon: 'D',
    label: 'Deliver',
    eyebrow: '04 / Share the result',
    title: 'Present, collaborate, export, and keep the board useful after the session ends.',
    description: 'A good whiteboard is not only a place to draw. It becomes a lesson artifact, study map, meeting record, planning document, or shared reference.',
    points: [
      { glyph: 'P', title: 'Present mode', text: 'Hide editing tools, focus the discussion, and move through the board calmly.', color: '#6366f1' },
      { glyph: 'CO', title: 'Live collaboration', text: 'Share a board URL and work together with cursors, selection, and presence.', color: '#22c55e' },
      { glyph: 'PDF', title: 'PDF pages', text: 'Export frame pages for lessons, reports, handouts, and structured documents.', color: '#ef4444' },
      { glyph: 'EX', title: 'PNG and JSON', text: 'Save visuals or portable board data when you need to reuse or archive work.', color: '#f59e0b' },
    ],
  },
};

const CORE_STEPS: Array<{ id: FeatureTab; glyph: string; title: string; text: string }> = [
  { id: 'start', glyph: '01', title: 'Start', text: 'Blank, model, or AI draft.' },
  { id: 'build', glyph: '02', title: 'Add', text: 'Notes, shapes, ink, frames, media.' },
  { id: 'connect', glyph: '03', title: 'Connect', text: 'Relations show how ideas work.' },
  { id: 'deliver', glyph: '04', title: 'Use', text: 'Present, share, export, revisit.' },
];

const USE_CASES = [
  { glyph: 'ED', title: 'Teach a lesson', text: 'Plan the flow, show relationships, focus the class, and export the result.' },
  { glyph: 'ST', title: 'Study a topic', text: 'Turn a messy subject into a concept map with examples and review prompts.' },
  { glyph: 'PR', title: 'Plan a project', text: 'Map goals, dependencies, decisions, risks, and delivery steps in one place.' },
  { glyph: 'MAP', title: 'Work with places', text: 'Use maps when location matters, without making the whole product only about maps.' },
];

export function HowItWorksPage() {
  const navigate = useNavigate();
  const theme = useCanvasStore((s) => s.theme);
  const toggleTheme = useCanvasStore((s) => s.toggleTheme);
  const [activeTab, setActiveTab] = useState<FeatureTab>('start');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleCreateWorld = () => {
    const newId = nanoid(10);
    createBoard().catch(() => {});
    navigate(`/w/${newId}`);
  };

  const tab = TAB_CONTENT[activeTab];

  return (
    <div className="guide-page dot-grid">
      <nav className="guide-nav">
        <button className="guide-logo" onClick={() => navigate('/')} aria-label="Go to home">
          <CanvioLogoIcon size={26} />
          <span className="guide-logo__text">Canvio</span>
        </button>
        <div className="guide-nav__links">
          <button className="guide-nav__link" onClick={() => navigate('/')}>Workspace</button>
          <button className="guide-nav__link active" onClick={() => navigate('/how-it-works')}>How It Works</button>
          <Link className="guide-nav__link" to="/updates">Updates</Link>
          <button className="guide-nav__link" onClick={() => navigate('/support')}>Support</button>
          <button className="guide-btn-primary" onClick={handleCreateWorld}>
            <GuideGlyph value="+" />
            <span>Launch Canvas</span>
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

      <header className="guide-hero">
        <div className="guide-hero__copy">
          <div className="guide-hero__badge">
            <GuideGlyph value="ED" />
            <span>Simple enough to start. Powerful enough to keep thinking.</span>
          </div>
          <h1 className="guide-hero__title">How Canvio works</h1>
          <p className="guide-hero__subtitle">
            Canvio is an interactive online whiteboard for visual knowledge work: start with a board, add living elements, connect the meaning, then present or export the result.
          </p>
          <div className="guide-hero__actions">
            <button className="guide-btn-action" onClick={handleCreateWorld}>
              <GuideGlyph value="GO" />
              <span>Start a blank board</span>
            </button>
            <button className="guide-btn-secondary" onClick={() => navigate(`/w/demo-${nanoid(6)}`)}>
              <GuideGlyph value="DE" />
              <span>Open demo board</span>
            </button>
          </div>
        </div>

        <div className="guide-hero__preview" aria-hidden="true">
          <div className="preview-frame">
            <div className="preview-frame__label">Lesson, project, map, or research board</div>
            <div className="preview-card preview-card--yellow">
              <strong>Question</strong>
              <span>What are we trying to understand?</span>
            </div>
            <div className="preview-card preview-card--blue">
              <strong>Evidence</strong>
              <span>Notes, maps, images, code, and examples.</span>
            </div>
            <div className="preview-card preview-card--green">
              <strong>Outcome</strong>
              <span>Present, share, export, revisit.</span>
            </div>
            <svg className="preview-lines" viewBox="0 0 620 360">
              <path d="M150 138 C235 98 310 102 392 132" />
              <path d="M396 178 C344 260 272 278 178 242" />
              <path d="M178 214 C236 200 296 202 346 212" />
            </svg>
          </div>
        </div>
      </header>

      <main className="guide-main">
        <section className="guide-loop">
          {CORE_STEPS.map((step, index) => (
            <button
              className={`guide-loop__step ${activeTab === step.id ? 'active' : ''}`}
              key={step.title}
              onClick={() => setActiveTab(step.id)}
              aria-label={`Show ${step.title} details`}
            >
              <span className="guide-loop__index">{index + 1}</span>
              <GuideGlyph value={step.glyph} />
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </button>
          ))}
        </section>

        <section className="guide-explorer">
          <div className="guide-tabs-nav" role="tablist" aria-label="Canvio workflow">
            {(Object.keys(TAB_CONTENT) as FeatureTab[]).map((id) => (
              <button
                key={id}
                className={`guide-tab-btn ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
                role="tab"
                aria-selected={activeTab === id}
              >
                <GuideGlyph value={TAB_CONTENT[id].icon} />
                <span>{TAB_CONTENT[id].label}</span>
              </button>
            ))}
          </div>

          <div className="guide-feature-detail fade-in">
            <div className="guide-detail__info">
              <span className="guide-detail__tag">{tab.eyebrow}</span>
              <h2>{tab.title}</h2>
              <p>{tab.description}</p>
            </div>

            <div className="capabilities-grid">
              {tab.points.map((point) => (
                <div className="cap-card" key={point.title}>
                  <GuideGlyph value={point.glyph} color={point.color} />
                  <h4>{point.title}</h4>
                  <p>{point.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="guide-use-cases">
          <div className="guide-section-heading">
            <GuideGlyph value="USE" />
            <h2>One board, many familiar jobs</h2>
            <p>The main idea is not one feature. It is a flexible visual workspace that adapts to the task.</p>
          </div>
          <div className="use-case-grid">
            {USE_CASES.map((item) => (
              <div className="use-case-card" key={item.title}>
                <GuideGlyph value={item.glyph} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="guide-quality-section">
          <div>
            <span className="guide-detail__tag">Built for real devices</span>
            <h2>Designed for mouse, touch, tablet, and pen.</h2>
            <p>
              The interaction model is centered on large targets, direct manipulation, focus mode, present mode, and simple recovery through undo, redo, fit view, and start-over flows.
            </p>
          </div>
          <div className="device-strip">
            <div><GuideGlyph value="PC" /><strong>PC</strong><small>Precise editing</small></div>
            <div><GuideGlyph value="TB" /><strong>Tablet</strong><small>Touch planning</small></div>
            <div><GuideGlyph value="PN" /><strong>Pen</strong><small>Ink and markups</small></div>
            <div><GuideGlyph value="MO" /><strong>Mobile</strong><small>Review and present</small></div>
          </div>
        </section>

        <section className="guide-shortcuts-section">
          <h2>Quick controls</h2>
          <div className="shortcuts-grid">
            <div className="shortcut-card"><kbd>V</kbd><span>Select and move</span></div>
            <div className="shortcut-card"><kbd>P</kbd><span>Draw with pen</span></div>
            <div className="shortcut-card"><kbd>A</kbd><span>Draw arrow</span></div>
            <div className="shortcut-card"><kbd>K</kbd><span>Highlighter</span></div>
            <div className="shortcut-card"><kbd>Space + drag</kbd><span>Pan canvas</span></div>
            <div className="shortcut-card"><kbd>Ctrl + Z</kbd><span>Undo</span></div>
          </div>
        </section>

        <section className="guide-cta-section">
          <h2>Try the full workflow on a real board</h2>
          <p>Start with a blank canvas or open a demo and move through the loop yourself.</p>
          <div className="guide-cta-actions">
            <button className="guide-btn-action" onClick={handleCreateWorld}>
              <GuideGlyph value="+" />
              <span>Launch Canvas</span>
            </button>
            <button className="guide-btn-secondary" onClick={() => navigate('/')}>
              <GuideGlyph value="HM" />
              <span>Back to workspace</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="guide-footer">
        <div className="guide-footer__brand">
          <CanvioLogoIcon size={20} />
          <span>Canvio - Connect ideas. Create knowledge.</span>
        </div>
        <div className="guide-footer__links">
          <button className="guide-footer__link" onClick={() => navigate('/')}>Home</button>
          <Link className="guide-footer__link" to="/updates">Updates</Link>
          <button className="guide-footer__link" onClick={() => navigate('/support')}>Support</button>
        </div>
      </footer>
    </div>
  );
}
