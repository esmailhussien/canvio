import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvasStore } from '../store/canvasStore';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { IconTheme } from '@canvio/ui';
import './SupportPage.css';

const KOFI_URL = 'https://ko-fi.com/canvio';
const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/esmailhussien';
const GITHUB_REPO_URL = 'https://github.com/esmailhussien/canvio';

export function SupportPage() {
  const navigate = useNavigate();
  const theme = useCanvasStore((s) => s.theme);
  const toggleTheme = useCanvasStore((s) => s.toggleTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="support-page dot-grid">
      {/* Navigation Bar */}
      <nav className="support-nav">
        <div className="support-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <CanvioLogoIcon size={26} />
          <span className="support-logo__text">Canvio</span>
        </div>
        <div className="support-nav__links">
          <button className="support-nav__link" onClick={() => navigate('/')}>
            Workspace
          </button>
          <button className="support-nav__link" onClick={() => navigate('/how-it-works')}>
            How It Works
          </button>
          <button className="support-nav__link active" onClick={() => navigate('/support')}>
            Support
          </button>
          <button className="support-btn-primary" onClick={() => navigate('/w/demo-workspace')}>
            + Launch Canvas
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

      {/* Hero Section */}
      <header className="support-hero">
        <div className="support-hero__badge">
          <span className="material-symbols-outlined text-sm" style={{ fontSize: '1rem', color: '#6366f1' }}>public</span>
          <span>Free Forever. Open Forever.</span>
        </div>
        <h1 className="support-hero__title">
          Support <span>Canvio</span>
        </h1>
        <p className="support-hero__subtitle">
          Canvio is free, open source, and built for everyone.
        </p>
        <p className="support-hero__text">
          If it helps you think, learn, or create — consider supporting its development.
        </p>
      </header>

      {/* Main Container */}
      <main className="support-main-container">
        {/* Platform Cards */}
        <div className="support-cards-grid">
          {/* Ko-fi Card */}
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="support-reason-card card-coffee support-card-link"
          >
            <div className="support-card__icon-wrapper icon-coffee">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                <line x1="6" y1="2" x2="6" y2="4" />
                <line x1="10" y1="2" x2="10" y2="4" />
                <line x1="14" y1="2" x2="14" y2="4" />
              </svg>
            </div>
            <h3>Buy a Coffee on Ko-fi</h3>
            <p>One-time or monthly support. No account needed — just pick an amount and go.</p>
            <span className="support-card__cta">
              Support on Ko-fi
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7" /><path d="M7 7h10v10" />
              </svg>
            </span>
          </a>

          {/* GitHub Sponsors Card */}
          <a
            href={GITHUB_SPONSORS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="support-reason-card card-sponsor support-card-link"
          >
            <div className="support-card__icon-wrapper icon-sponsor">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z" />
              </svg>
            </div>
            <h3>Sponsor on GitHub</h3>
            <p>Back the open-source mission directly through GitHub Sponsors.</p>
            <span className="support-card__cta">
              Sponsor on GitHub
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7" /><path d="M7 7h10v10" />
              </svg>
            </span>
          </a>

          {/* Star the Repo Card */}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="support-reason-card card-support support-card-link"
          >
            <div className="support-card__icon-wrapper icon-support">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <h3>Star on GitHub</h3>
            <p>Free and powerful — a star helps others discover Canvio and keeps the project visible.</p>
            <span className="support-card__cta">
              Star the repo
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7" /><path d="M7 7h10v10" />
              </svg>
            </span>
          </a>
        </div>

        {/* Main CTA — Ko-fi */}
        <div className="support-amount-selector">
          <span className="support-amount__label">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6 }}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
            </svg>
            Quick Support via Ko-fi
          </span>
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="support-btn-action"
            style={{ textDecoration: 'none', width: '100%', maxWidth: 440 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
            </svg>
            <span>Support Canvio on Ko-fi</span>
          </a>
          <p className="support-action-subtext">
            One-time or monthly — every contribution keeps Canvio free and open source.
          </p>
        </div>

        {/* Transparency Note */}
        <div className="support-transparency-note">
          <span className="material-symbols-outlined text-xs" style={{ verticalAlign: 'middle', marginRight: 4 }}>lock</span>
          <span>100% of contributions go toward hosting, collaboration services, and open-source development.</span>
        </div>

        {/* What your support makes possible */}
        <div className="support-impact-box">
          <h4>What your support makes possible:</h4>
          <ul className="support-impact-list">
            <li>
              <span className="material-symbols-outlined impact-icon" style={{ color: '#6366f1' }}>public</span>
              <span>Keep Canvio free and open source — forever.</span>
            </li>
            <li>
              <span className="material-symbols-outlined impact-icon" style={{ color: '#3b82f6' }}>group</span>
              <span>Run real-time collaboration servers 24/7.</span>
            </li>
            <li>
              <span className="material-symbols-outlined impact-icon" style={{ color: '#22c55e' }}>dns</span>
              <span>Cover hosting, domain, and infrastructure costs.</span>
            </li>
            <li>
              <span className="material-symbols-outlined impact-icon" style={{ color: '#a855f7' }}>auto_awesome</span>
              <span>Build Spatial AI, smarter nodes, and new features.</span>
            </li>
            <li>
              <span className="material-symbols-outlined impact-icon" style={{ color: '#f59e0b' }}>devices</span>
              <span>Improve mobile experience and touch support.</span>
            </li>
          </ul>

          <div className="support-promise-line">
            Canvio will always remain free and open source. Your contribution helps us keep that promise.
          </div>
        </div>

        {/* Other ways to support */}
        <div className="support-other-ways">
          <h4>Other ways to support Canvio:</h4>
          <div className="support-other-grid">
            <div className="support-other-card">
              <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: '1.3rem' }}>share</span>
              <div>
                <strong>Share Canvio</strong>
                <p>Tell a friend, post on social media, or share a board link.</p>
              </div>
            </div>
            <div className="support-other-card">
              <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: '1.3rem' }}>bug_report</span>
              <div>
                <strong>Report bugs</strong>
                <p>Found an issue? Open a GitHub issue — every report makes Canvio better.</p>
              </div>
            </div>
            <div className="support-other-card">
              <span className="material-symbols-outlined" style={{ color: '#a855f7', fontSize: '1.3rem' }}>code</span>
              <div>
                <strong>Contribute code</strong>
                <p>Canvio is open source. PRs, docs, and ideas are always welcome.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="support-footer">
        <div className="support-footer__brand">
          <CanvioLogoIcon size={20} />
          <span>Canvio — Connect ideas. Create knowledge.</span>
        </div>
        <div className="support-footer__links">
          <button className="support-footer__link" onClick={() => navigate('/')}>Home</button>
          <button className="support-footer__link" onClick={() => navigate('/w/demo-workspace')}>Canvas</button>
          <a className="support-footer__link" href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </footer>
    </div>
  );
}
