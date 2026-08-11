import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { createBoard } from '../utils/api';
import { useCanvasStore } from '../store/canvasStore';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { IconTheme } from '@canvio/ui';
import './SupportPage.css';

const KOFI_URL = 'https://ko-fi.com/canvio';
const GITHUB_REPO_URL = 'https://github.com/esmailhussien/canvio';
const SUPPORT_EMAIL = 'support@canvio.space';

function supportEmailUrl(type: 'Bug report' | 'UX feedback' | 'Feature request' | 'General inquiry') {
  const subject = encodeURIComponent(`Canvio ${type}: `);
  const body = encodeURIComponent(
    type === 'Bug report'
      ? 'What were you trying to do?\n\nWhat happened instead?\n\nDevice and browser:\n\nSteps to reproduce:\n'
      : type === 'UX feedback'
        ? 'What workflow or device were you using?\n\nWhat felt difficult?\n\nWhat would feel better?\n'
        : type === 'Feature request'
          ? 'What would you like Canvio to do?\n\nWho would this help?\n\nWhy would it matter?\n'
          : 'How can we help?\n',
  );
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}

const BUG_REPORT_URL = supportEmailUrl('Bug report');
const FEATURE_REQUEST_URL = supportEmailUrl('Feature request');
const UX_FEEDBACK_URL = supportEmailUrl('UX feedback');

function SupportIcon({ value, color, size = 20 }: { value: string; color?: string; size?: number }) {
  const style = { color: color || 'currentColor', flexShrink: 0 };
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style };

  switch (value) {
    case 'HELP':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'BUG':
      return <svg {...props}><path d="M8 2l1.88 1.88M16 2l-1.88 1.88M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0 1 12 0v3c0 3.3-2.7 6-6 6Z"/><path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2M6 17l-4 1M17.47 9c1.93-.2 3.53-1.9 3.53-4"/><path d="M18 13h4M18 17l4 1"/></svg>;
    case 'UX':
      return <svg {...props}><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>;
    case 'IDEA':
      return <svg {...props}><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>;
    case 'KO':
      return <svg {...props}><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>;
    case 'GH':
      return <svg {...props} fill="currentColor" stroke="none"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"/></svg>;
    case 'GO':
    case '+':
      return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case '01':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/><polyline points="16 12 12 8 8 12"/></svg>;
    case '02':
      return <svg {...props}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg>;
    case '03':
      return <svg {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    default:
      return <span className="support-glyph" style={style} aria-hidden="true">{value}</span>;
  }
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

const ROADMAP = [
  {
    status: 'Now',
    color: '#38bdf8',
    title: 'Interaction quality everywhere',
    text: 'Make selection, drawing, touch, pen, mobile layouts, sharing, and collaboration feel dependable on every device.',
  },
  {
    status: 'Next',
    color: '#a855f7',
    title: 'Boards that publish clearly',
    text: 'Turn connected board content into stronger summaries, articles, presentation outlines, and editable infographics.',
  },
  {
    status: 'Exploring',
    color: '#f59e0b',
    title: 'Board-aware image generation',
    text: 'Create useful diagrams and visual assets from the ideas, labels, and relationships already present on the board.',
  },
  {
    status: 'Exploring',
    color: '#22c55e',
    title: 'Reusable learning and team workflows',
    text: 'Improve role-based templates, activity history, review flows, and reusable board libraries without making the canvas heavier.',
  },
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
          <Link className="support-nav__link" to="/updates">Updates</Link>
          <button className="support-nav__link active" onClick={() => navigate('/support')}>Support</button>
          <button className="support-btn-primary support-nav__launch" onClick={handleCreateWorld} disabled={isCreating}>
            <SupportIcon value="+" />
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
              Report a problem, ask a question, request an improvement, or support development through Ko-fi.
            </p>
            <div className="support-hero__actions">
              <a className="support-btn-primary" href={BUG_REPORT_URL}>
                <SupportIcon value="BUG" />
                <span>Report a bug</span>
              </a>
              <a className="support-btn-secondary" href={supportEmailUrl('General inquiry')}>
                <SupportIcon value="HELP" color="#38bdf8" />
                <span>Email support</span>
              </a>
              <a className="support-btn-secondary" href={KOFI_URL} target="_blank" rel="noopener noreferrer">
                <SupportIcon value="KO" color="#f59e0b" />
                <span>Support on Ko-fi</span>
              </a>
            </div>
          </div>

          <aside className="support-hero__panel" aria-label="Support response guide">
            <div className="support-panel__header">
              <SupportIcon value="HELP" color="#38bdf8" />
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
            <SupportIcon value="01" />
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
              >
                <SupportIcon value={path.glyph} color={path.color} />
                <h3>{path.title}</h3>
                <p>{path.text}</p>
                <span>{path.cta}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="support-two-column">
          <div className="support-email-card">
            <div className="support-kofi-card__label">
              <SupportIcon value="HELP" color="#38bdf8" />
              <span>Direct support</span>
            </div>
            <h2>Have a question or problem?</h2>
            <p>
              Email the Canvio team directly for product questions, account help, bugs, and suggestions.
            </p>
            <a className="support-kofi-card__button" href={supportEmailUrl('General inquiry')}>
              Email {SUPPORT_EMAIL}
            </a>
            <span className="support-kofi-card__note">Your mail app will open with a ready-to-edit message.</span>
          </div>

          <div className="support-kofi-card">
            <div className="support-kofi-card__label">
              <SupportIcon value="KO" color="#f59e0b" />
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
              <SupportIcon value="02" color="#22c55e" />
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

        <section className="support-section support-roadmap">
          <div className="support-roadmap__intro">
            <div className="support-section__heading">
              <SupportIcon value="03" color="#a855f7" />
              <div>
                <h2>Roadmap: what support can help unlock</h2>
                <p>Near-term quality comes first. Larger creation ideas follow when they make the whole workspace more useful.</p>
              </div>
            </div>
            <a className="support-btn-secondary" href={FEATURE_REQUEST_URL}>
              <SupportIcon value="IDEA" color="#22c55e" />
              <span>Shape the roadmap</span>
            </a>
          </div>

          <div className="support-roadmap-grid">
            {ROADMAP.map((item) => (
              <article className="support-roadmap-item" key={item.title}>
                <span
                  className="support-roadmap-item__status"
                  style={{ '--roadmap-color': item.color } as CSSProperties}
                >
                  {item.status}
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <p className="support-roadmap__note">
            “Exploring” describes product direction, not a release promise. Feedback helps decide what becomes a committed milestone.
          </p>
        </section>

        <section className="support-feedback-guide">
          <div className="support-section__heading">
            <SupportIcon value="04" color="#a855f7" />
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
              <SupportIcon value="GO" />
              <span>{isCreating ? 'Opening board...' : 'Start a blank board'}</span>
            </button>
            <a className="support-btn-secondary" href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
              <SupportIcon value="GH" />
              <span>View GitHub</span>
            </a>
            <a className="support-btn-secondary" href={supportEmailUrl('General inquiry')}>
              <SupportIcon value="HELP" color="#38bdf8" />
              <span>Email support</span>
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
          <Link className="support-footer__link" to="/updates">Updates</Link>
          <button className="support-footer__link" onClick={() => navigate('/how-it-works')}>How It Works</button>
          <a className="support-footer__link" href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a className="support-footer__link" href={KOFI_URL} target="_blank" rel="noopener noreferrer">Ko-fi</a>
          <a className="support-footer__link" href={supportEmailUrl('General inquiry')}>Email support</a>
        </div>
      </footer>
    </div>
  );
}
