import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { createBoard } from '../utils/api';
import { useCanvasStore } from '../store/canvasStore';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { IconTheme } from '@canvio/ui';
import './SupportPage.css';

const KOFI_URL = 'https://ko-fi.com/canvio';
const GITHUB_REPO_URL = 'https://github.com/esmailhussien/canvio';
const BUG_REPORT_URL = `${GITHUB_REPO_URL}/issues/new?title=Bug%20report%3A%20`;
const FEATURE_REQUEST_URL = `${GITHUB_REPO_URL}/issues/new?title=Feature%20request%3A%20`;
const UX_FEEDBACK_URL = `${GITHUB_REPO_URL}/issues/new?title=UX%20feedback%3A%20`;

function SupportGlyph({ value, color }: { value: string; color?: string }) {
  return (
    <span className="support-glyph" style={color ? { color } : undefined} aria-hidden="true">
      {value}
    </span>
  );
}

const SUPPORT_PATHS = [
  {
    glyph: 'BUG',
    color: '#ef4444',
    title: 'Report a bug',
    text: 'Use this when something breaks, exports fail, sync feels unstable, or a tool behaves differently from what you expected.',
    cta: 'Open bug report',
    href: BUG_REPORT_URL,
  },
  {
    glyph: 'UX',
    color: '#38bdf8',
    title: 'Send UX feedback',
    text: 'Tell us where the board feels hard on mobile, tablet, pen, classroom screens, or daily desktop work.',
    cta: 'Share feedback',
    href: UX_FEEDBACK_URL,
  },
  {
    glyph: 'IDEA',
    color: '#22c55e',
    title: 'Request a feature',
    text: 'Suggest a workflow, template, AI behavior, export option, or object type that would make Canvio more useful.',
    cta: 'Request feature',
    href: FEATURE_REQUEST_URL,
  },
];

const PRIORITIES = [
  { label: 'Mobile, tablet, and pen interaction quality', color: '#38bdf8' },
  { label: 'Reliable export, import, sharing, and collaboration', color: '#22c55e' },
  { label: 'Higher-quality ready-made models and AI board generation', color: '#a855f7' },
  { label: 'Readable relation routing across notes, shapes, maps, and frames', color: '#f59e0b' },
];

export function SupportPage() {
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

  return (
    <div className="support-page dot-grid">
      <nav className="support-nav">
        <button className="support-logo" onClick={() => navigate('/')} aria-label="Canvio home">
          <CanvioLogoIcon size={26} />
          <span className="support-logo__text">Canvio</span>
        </button>

        <div className="support-nav__links">
          <button className="support-nav__link" onClick={() => navigate('/')}>Workspace</button>
          <button className="support-nav__link" onClick={() => navigate('/how-it-works')}>How It Works</button>
          <button className="support-nav__link active" onClick={() => navigate('/support')}>Support</button>
          <button className="support-btn-primary support-nav__launch" onClick={handleCreateWorld} disabled={isCreating}>
            <SupportGlyph value="+" />
            <span className="support-nav__label-full">{isCreating ? 'Opening...' : 'Launch Canvas'}</span>
            <span className="support-nav__label-mobile">{isCreating ? 'Opening...' : 'Start'}</span>
          </button>
          <button
            className="support-theme-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <IconTheme size={18} />
          </button>
        </div>
      </nav>

      <main className="support-main">
        <section className="support-hero">
          <div className="support-hero__copy">
            <div className="support-hero__badge">
              <span className="support-hero__badge-dot" />
              <span>Support center for the Canvio workspace</span>
            </div>
            <h1 className="support-hero__title">
              Help Canvio become easier, faster, and more useful.
            </h1>
            <p className="support-hero__subtitle">
              Report friction, request improvements, follow the open-source work, or support development through Ko-fi.
            </p>
            <div className="support-hero__actions">
              <a className="support-btn-primary" href={BUG_REPORT_URL} target="_blank" rel="noopener noreferrer">
                <SupportGlyph value="BUG" />
                <span>Report a bug</span>
              </a>
              <a className="support-btn-secondary" href={KOFI_URL} target="_blank" rel="noopener noreferrer">
                <SupportGlyph value="KO" color="#f59e0b" />
                <span>Support on Ko-fi</span>
              </a>
            </div>
          </div>

          <aside className="support-hero__panel" aria-label="Support response guide">
            <div className="support-panel__header">
              <SupportGlyph value="HELP" color="#38bdf8" />
              <div>
                <strong>What should I choose?</strong>
                <span>Pick the path that matches the moment.</span>
              </div>
            </div>
            <div className="support-choice-list">
              <div className="support-choice">
                <span className="support-choice__dot" style={{ background: '#ef4444' }} />
                <span>Broken, confusing, or not working</span>
                <strong>Bug</strong>
              </div>
              <div className="support-choice">
                <span className="support-choice__dot" style={{ background: '#38bdf8' }} />
                <span>Hard to use on a device or workflow</span>
                <strong>UX</strong>
              </div>
              <div className="support-choice">
                <span className="support-choice__dot" style={{ background: '#22c55e' }} />
                <span>A missing tool, model, or AI capability</span>
                <strong>Idea</strong>
              </div>
            </div>
          </aside>
        </section>

        <section className="support-section">
          <div className="support-section__heading">
            <SupportGlyph value="01" />
            <div>
              <h2>Get to the right place quickly</h2>
              <p>Support should reduce friction, not add a new maze.</p>
            </div>
          </div>

          <div className="support-path-grid">
            {SUPPORT_PATHS.map((path) => (
              <a
                key={path.title}
                className="support-path-card"
                href={path.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <SupportGlyph value={path.glyph} color={path.color} />
                <h3>{path.title}</h3>
                <p>{path.text}</p>
                <span>{path.cta}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="support-two-column">
          <div className="support-kofi-card">
            <div className="support-kofi-card__label">
              <SupportGlyph value="KO" color="#f59e0b" />
              <span>Open-source funding</span>
            </div>
            <h2>Support Canvio on Ko-fi</h2>
            <p>
              Contributions help cover hosting, real-time collaboration, testing devices, and focused development time while keeping Canvio free to use.
            </p>
            <a className="support-kofi-card__button" href={KOFI_URL} target="_blank" rel="noopener noreferrer">
              Support on Ko-fi
            </a>
            <span className="support-kofi-card__note">One-time or monthly support. Ko-fi opens in a new tab.</span>
          </div>

          <div className="support-priority-card">
            <div className="support-section__heading compact">
              <SupportGlyph value="02" color="#22c55e" />
              <div>
                <h2>What support helps improve</h2>
                <p>These are the product areas that matter most right now.</p>
              </div>
            </div>
            <ul className="support-priority-list">
              {PRIORITIES.map((priority) => (
                <li key={priority.label}>
                  <span style={{ background: priority.color }} />
                  {priority.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="support-feedback-guide">
          <div className="support-section__heading">
            <SupportGlyph value="03" color="#a855f7" />
            <div>
              <h2>Write feedback that turns into a fix</h2>
              <p>A clear report saves time and makes improvements easier to ship.</p>
            </div>
          </div>

          <div className="support-feedback-steps">
            <div>
              <strong>1. What were you trying to do?</strong>
              <span>Example: move a sticky note on tablet, export a frame, or create a relation.</span>
            </div>
            <div>
              <strong>2. What happened instead?</strong>
              <span>Add the device, browser, and any console error if you saw one.</span>
            </div>
            <div>
              <strong>3. What would feel better?</strong>
              <span>Describe the expected interaction in plain words. Screenshots help a lot.</span>
            </div>
          </div>
        </section>

        <section className="support-cta-band">
          <div>
            <h2>Want to test the latest board experience?</h2>
            <p>Open a fresh canvas, try the workflow, then send feedback from real use.</p>
          </div>
          <div className="support-cta-band__actions">
            <button className="support-btn-primary" onClick={handleCreateWorld} disabled={isCreating}>
              <SupportGlyph value="GO" />
              <span>{isCreating ? 'Opening board...' : 'Start a blank board'}</span>
            </button>
            <a className="support-btn-secondary" href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
              <SupportGlyph value="GH" />
              <span>View GitHub</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="support-footer">
        <div className="support-footer__brand">
          <CanvioLogoIcon size={20} />
          <span>Canvio — Connect ideas. Create knowledge.</span>
        </div>
        <div className="support-footer__links">
          <button className="support-footer__link" onClick={() => navigate('/')}>Home</button>
          <button className="support-footer__link" onClick={() => navigate('/how-it-works')}>How It Works</button>
          <a className="support-footer__link" href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a className="support-footer__link" href={KOFI_URL} target="_blank" rel="noopener noreferrer">Ko-fi</a>
        </div>
      </footer>
    </div>
  );
}
