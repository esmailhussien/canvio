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
    title: 'Open a blank board, choose a model, or ask AI to create, study, summarize, article, or tidy.',
    description: 'Start immediately without complex setup: begin on an open canvas, load a curated model, or use the AI Navigator to create a first structure from your prompt or the board already in front of you.',
    points: [
      { glyph: 'B', title: 'Blank canvas', text: 'Start from scratch when exploring an open-ended idea or rough architecture.', color: '#38bdf8' },
      { glyph: 'M', title: 'Curated models', text: 'Use study, strategy, logic tree, and planning boards as clean starting points.', color: '#22c55e' },
      { glyph: 'AI', title: 'AI Navigator modes', text: 'Choose Create, Study, Summary, Article, or Tidy. When a board has content, AI uses its notes, relations, and map pins when present.', color: '#a855f7' },
      { glyph: 'T', title: 'Readable themes', text: 'Switch dark, light, and board background styles for different rooms and devices.', color: '#f59e0b' },
    ],
  },
  build: {
    icon: 'B',
    label: 'Build',
    eyebrow: '02 / Capture & sketch',
    title: 'Capture structured notes and sketch freely without mixing raw ink into the graph.',
    description: 'Structured objects and freehand drawings live side by side. Ink stays separate until you choose to graduate it into an editable note.',
    points: [
      { glyph: 'N', title: 'Notes and text', text: 'Create sticky notes and text blocks to capture assertions, questions, and evidence.', color: '#facc15' },
      { glyph: 'INK', title: 'Freehand ink layer', text: 'Sketch annotations with pressure sensitivity and highlighter without cluttering the graph.', color: '#ef4444' },
      { glyph: 'CONV', title: 'To Sticky conversion', text: 'Measure handwritten sketches and convert them into connectable sticky notes in one click.', color: '#22c55e' },
      { glyph: 'O', title: 'Rich objects', text: 'Bring in maps, images, frames, and code blocks when ideas need more than text.', color: '#06b6d4' },
    ],
  },
  connect: {
    icon: 'C',
    label: 'Connect',
    eyebrow: '03 / Structure reasoning',
    title: 'Connect ideas with quick-drag ports, assign semantic meaning, and see what needs attention next.',
    description: 'Lines in Canvio explain how ideas relate. Drag from any edge to connect, assign logical assertions like Contradicts or Depends on, then use the reasoning score to improve the board.',
    points: [
      { glyph: 'QD', title: 'Quick-Connect drag', text: 'Drag from any node edge port to connect to an existing note or spawn a new connected note on empty space.', color: '#38bdf8' },
      { glyph: '1-0', title: '10 Semantic types', text: 'Press 1–9 or 0 on any relation to specify Contradicts, Depends on, Enables, Based on, Part of, Leads to, Inspired by, Explains, Causes, or Related to.', color: '#f472b6' },
      { glyph: 'R', title: 'Reasoning Partner (Ctrl+Shift+R)', text: 'See a 0-100 score based on connectedness, relation clarity, evidence grounding, logic safety, and reasoning depth.', color: '#a855f7' },
      { glyph: 'NEXT', title: 'Best next move', text: 'The panel turns the weakest score factor into a focused action so you know whether to connect, label, ground, resolve, or deepen.', color: '#10b981' },
      { glyph: 'CH', title: 'Challenge & Socratic modes', text: 'Ask the assistant to test weak assumptions or generate follow-up questions from the graph.', color: '#f59e0b' },
    ],
  },
  deliver: {
    icon: 'D',
    label: 'Deliver',
    eyebrow: '04 / Share & verify',
    title: 'Present cleanly, guide attention with the laser pointer, and collaborate in real time.',
    description: 'Keep the board useful during live reviews, collaborative work sessions, and long-term reference.',
    points: [
      { glyph: 'P', title: 'Present mode', text: 'Hide editing tools, focus attention on the canvas, and navigate smoothly.', color: '#6366f1' },
      { glyph: 'LP', title: 'Laser pointer (Q)', text: 'Guide live attention during discussions without creating or saving permanent marks.', color: '#ef4444' },
      { glyph: 'CO', title: 'Real-time collaboration', text: 'Share a board URL to work simultaneously with live cursors and instant synchronization.', color: '#22c55e' },
      { glyph: 'EX', title: 'Export & archive', text: 'Save PNG images, PDF exports, or raw JSON snapshots for backup and reuse.', color: '#f59e0b' },
    ],
  },
};

const CORE_STEPS: Array<{ id: FeatureTab; glyph: string; title: string; text: string }> = [
  { id: 'start', glyph: '01', title: 'Start', text: 'Blank, template, or AI draft.' },
  { id: 'build', glyph: '02', title: 'Build & Sketch', text: 'Notes, media, and decoupled ink.' },
  { id: 'connect', glyph: '03', title: 'Connect & Audit', text: 'Quick-connect, semantics, graph health.' },
  { id: 'deliver', glyph: '04', title: 'Share & Present', text: 'Laser pointer, live sync, exports.' },
];

const USE_CASES = [
  { glyph: 'ED', title: 'Teach a lesson', text: 'Plan the flow, show relationships, focus the class, and export the result.' },
  { glyph: 'ST', title: 'Study a topic', text: 'Turn a messy subject into a concept map with examples and review prompts.' },
  { glyph: 'PR', title: 'Plan a project', text: 'Map goals, dependencies, decisions, risks, and delivery steps in one place.' },
  { glyph: 'MAP', title: 'Work with places', text: 'Add maps only when location matters, connect relations to exact pins, and keep place evidence beside the rest of the board.' },
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

  const handleOpenSampleBoard = () => {
    navigate(`/w/demo-${nanoid(8)}`);
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
            Canvio is an interactive online whiteboard for visual knowledge work: start with a board, add living elements, connect the meaning, and bring in maps only when place matters.
          </p>
          <div className="guide-hero__actions">
            <button className="guide-btn-action" onClick={handleCreateWorld}>
              <GuideGlyph value="GO" />
              <span>Start a blank board</span>
            </button>
            <button className="guide-btn-secondary" onClick={handleOpenSampleBoard}>
              <GuideGlyph value="SA" />
              <span>Open sample board</span>
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
            <p>The main idea is not one feature. Notes, relations, AI, maps, frames, drawing, and presentation adapt to the task.</p>
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
          <h2>Quick keyboard controls</h2>
          <div className="shortcuts-grid">
            <div className="shortcut-card"><kbd>V</kbd><span>Select and move</span></div>
            <div className="shortcut-card"><kbd>P</kbd><span>Freehand pen</span></div>
            <div className="shortcut-card"><kbd>E</kbd><span>Stroke eraser</span></div>
            <div className="shortcut-card"><kbd>Q</kbd><span>Laser pointer</span></div>
            <div className="shortcut-card"><kbd>1 – 9, 0</kbd><span>Semantic relation type</span></div>
            <div className="shortcut-card"><kbd>Ctrl + K</kbd><span>AI Navigator</span></div>
            <div className="shortcut-card"><kbd>Ctrl + Shift + R</kbd><span>Reasoning Partner</span></div>
            <div className="shortcut-card"><kbd>Space + drag</kbd><span>Pan canvas</span></div>
            <div className="shortcut-card"><kbd>Ctrl + Z</kbd><span>Undo</span></div>
          </div>
        </section>

        <section className="guide-cta-section">
          <h2>Try the full workflow on a real board</h2>
          <p>Start with a blank canvas or open the sample board and move through the full workflow yourself.</p>
          <div className="guide-cta-actions">
            <button className="guide-btn-action" onClick={handleCreateWorld}>
              <GuideGlyph value="+" />
              <span>Launch Canvas</span>
            </button>
            <button className="guide-btn-secondary" onClick={handleOpenSampleBoard}>
              <GuideGlyph value="SA" />
              <span>Open sample board</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="guide-footer">
        <div className="guide-footer__brand">
          <CanvioLogoIcon size={20} />
          <span>Canvio — Connect ideas. Create knowledge.</span>
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
