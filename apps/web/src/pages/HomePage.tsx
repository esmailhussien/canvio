import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { createBoard } from '../utils/api';
import { useCanvasStore } from '../store/canvasStore';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { IconTheme } from '@canvio/ui';
import './HomePage.css';

function HomeGlyph({ value }: { value: string }) {
  return (
    <span className="home-glyph" aria-hidden="true">
      {value}
    </span>
  );
}

const PRODUCT_STEPS = [
  { glyph: '01', title: 'Start', text: 'Open a blank board, a model, or an AI draft.' },
  { glyph: '02', title: 'Build', text: 'Add notes, frames, ink, shapes, maps, media, and code.' },
  { glyph: '03', title: 'Connect', text: 'Show meaning with routed relations and labels.' },
  { glyph: '04', title: 'Deliver', text: 'Present, collaborate, export, and revisit the work.' },
];

const START_OPTIONS = [
  { glyph: 'BL', title: 'Blank canvas', text: 'Start open-ended work from scratch.', action: 'create' as const },
  { glyph: 'SA', title: 'Sample board', text: 'Explore a ready-made board with real content.', action: 'demo' as const },
  { glyph: 'HW', title: 'How it works', text: 'See the workflow before opening a board.', action: 'how' as const },
];

const USE_CASES = [
  { glyph: 'ED', title: 'Teaching', text: 'Plan lessons, explain relationships, focus attention, and export class artifacts.' },
  { glyph: 'ST', title: 'Studying', text: 'Map topics, examples, questions, mistakes, and review prompts visually.' },
  { glyph: 'PM', title: 'Planning', text: 'Turn project goals, dependencies, decisions, and risks into a shared workspace.' },
  { glyph: 'RS', title: 'Research', text: 'Connect evidence, notes, papers, conclusions, and places when location matters.' },
];

export function HomePage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const theme = useCanvasStore((s) => s.theme);
  const toggleTheme = useCanvasStore((s) => s.toggleTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleCreateWorld = () => {
    if (isCreating) return;
    setIsCreating(true);
    const newId = nanoid(10);
    createBoard().catch(() => {});
    navigate(`/w/${newId}`);
  };

  const handleOpenSampleBoard = () => {
    navigate(`/w/demo-${nanoid(8)}`);
  };

  const handleStartOption = (action: 'create' | 'demo' | 'how') => {
    if (action === 'create') {
      handleCreateWorld();
      return;
    }
    if (action === 'demo') {
      handleOpenSampleBoard();
      return;
    }
    navigate('/how-it-works');
  };

  return (
    <div className="home-page dot-grid">
      <nav className="home-nav">
        <button className="home-logo" onClick={() => navigate('/')} aria-label="Canvio home">
          <CanvioLogoIcon size={26} />
          <span className="home-logo__text">Canvio</span>
        </button>
        <div className="home-nav__links">
          <button className="home-nav__link" onClick={handleCreateWorld} disabled={isCreating}>Workspace</button>
          <button className="home-nav__link" onClick={() => navigate('/how-it-works')}>How It Works</button>
          <Link className="home-nav__link" to="/updates">Updates</Link>
          <button className="home-nav__link" onClick={() => navigate('/support')}>Support</button>
          <button className="home-btn-primary home-nav__launch" onClick={handleCreateWorld} disabled={isCreating}>
            <HomeGlyph value="+" />
            <span className="home-nav__label-full">{isCreating ? 'Opening...' : 'Launch Canvas'}</span>
            <span className="home-nav__label-mobile">{isCreating ? 'Opening...' : 'Start'}</span>
          </button>
          <button
            className="home-theme-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <IconTheme size={18} />
          </button>
        </div>
      </nav>

      <main className="home-main">
        <section className="home-hero">
          <div className="home-hero__copy">
            <div className="home-hero__badge">
              <span className="home-hero__badge-dot" />
              <span>Connected whiteboard for learning, planning, and research</span>
            </div>
            <h1 className="home-hero__title">
              A connected whiteboard for thinking, learning, and <span>research.</span>
            </h1>
            <p className="home-hero__subtitle">
              Canvio brings notes, relations, AI, frames, drawing, maps, presentation, and export into one familiar workspace. Use maps when location matters while the board stays centered on the idea.
            </p>
            <div className="home-hero__cta">
              <button className="home-btn-primary" onClick={handleCreateWorld} disabled={isCreating}>
                <HomeGlyph value="GO" />
                <span>{isCreating ? 'Opening board...' : 'Start a blank board'}</span>
              </button>
              <button className="home-btn-secondary" onClick={handleOpenSampleBoard}>
                <HomeGlyph value="SA" />
                <span>Open sample board</span>
              </button>
            </div>
            <ul className="home-hero__trust" aria-label="Why Canvio is safe to try">
              <li>No signup required</li>
              <li>Private by default</li>
              <li>Export your data anytime</li>
              <li>
                <a href="https://github.com/esmailhussien/canvio" target="_blank" rel="noopener noreferrer">
                  Open source (AGPL-3.0)
                </a>
              </li>
            </ul>
          </div>

          <div className="home-preview" aria-label="Canvio canvas preview">
            <div className="home-preview__toolbar">
              <span>Select</span>
              <span>Pen</span>
              <span>Frame</span>
              <span>Relation</span>
              <span>Present</span>
            </div>
            <div className="home-preview__frame">
              <span className="home-preview__frame-label">Project Learning Board</span>
              <div className="preview-node preview-node--question">
                <strong>Question</strong>
                <p>What should the team understand?</p>
              </div>
              <div className="preview-node preview-node--evidence">
                <strong>Evidence</strong>
                <p>Notes, examples, screenshots, maps, and code.</p>
              </div>
              <div className="preview-node preview-node--decision">
                <strong>Decision</strong>
                <p>What changes after we connect the facts?</p>
              </div>
              <div className="preview-shape">
                <span>Goal</span>
              </div>
              <svg className="preview-relations" viewBox="0 0 780 440" aria-hidden="true">
                <path className="preview-relation preview-relation--blue" d="M182 168 C270 112 396 112 488 160" />
                <path className="preview-relation preview-relation--green" d="M564 226 C526 312 420 348 302 314" />
                <path className="preview-relation preview-relation--pink" d="M256 284 C208 260 180 230 166 194" />
              </svg>
            </div>
          </div>
        </section>

        <section className="home-loop" aria-label="Canvio workflow">
          {PRODUCT_STEPS.map((step) => (
            <div className="home-loop__item" key={step.title}>
              <HomeGlyph value={step.glyph} />
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </section>

        <section className="home-start">
          <div className="home-section-heading">
            <span className="home-section-kicker">Start your way</span>
            <h2>No blank-page panic.</h2>
            <p>Choose a board entry point that matches how much structure you want right now.</p>
          </div>
          <div className="home-start__grid">
            {START_OPTIONS.map((option) => (
              <button className="home-start-card" key={option.title} onClick={() => handleStartOption(option.action)}>
                <HomeGlyph value={option.glyph} />
                <span>
                  <strong>{option.title}</strong>
                  <small>{option.text}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="home-use-cases">
          <div className="home-section-heading">
            <span className="home-section-kicker">Built for real work</span>
            <h2>One canvas, many jobs.</h2>
            <p>Use the same space for lessons, research, project plans, and place-based work with maps available when location matters.</p>
          </div>
          <div className="home-use-cases__grid">
            {USE_CASES.map((item) => (
              <div className="home-use-card" key={item.title}>
                <HomeGlyph value={item.glyph} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="home-cta-band">
          <div>
            <span className="home-section-kicker">Ready when you are</span>
            <h2>Open the canvas and start moving ideas around.</h2>
          </div>
          <div className="home-cta-band__actions">
            <button className="home-btn-primary" onClick={handleCreateWorld} disabled={isCreating}>
              <HomeGlyph value="+" />
              <span>Launch Canvas</span>
            </button>
            <button className="home-btn-secondary" onClick={() => navigate('/how-it-works')}>
              <HomeGlyph value="HW" />
              <span>How it works</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer__brand">
          <CanvioLogoIcon size={20} />
          <span>Canvio — Connect ideas. Create knowledge.</span>
        </div>
        <div className="home-footer__links">
          <Link className="home-footer__link" to="/updates">Updates</Link>
          <button className="home-footer__link" onClick={() => navigate('/support')}>Support Canvio</button>
          <button className="home-footer__link" onClick={() => navigate('/how-it-works')}>How It Works</button>
        </div>
      </footer>
    </div>
  );
}
