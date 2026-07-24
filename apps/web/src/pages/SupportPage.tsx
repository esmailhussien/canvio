import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvasStore } from '../store/canvasStore';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { IconTheme } from '@canvio/ui';
import './SupportPage.css';

export function SupportPage() {
  const navigate = useNavigate();
  const theme = useCanvasStore((s) => s.theme);
  const toggleTheme = useCanvasStore((s) => s.toggleTheme);
  const [selectedAmount, setSelectedAmount] = useState<number | 'custom'>(10);
  const [customAmount, setCustomAmount] = useState<string>('25');
  const [donorName, setDonorName] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const activeAmount = selectedAmount === 'custom' ? Number(customAmount) || 1 : selectedAmount;

  const handleSimulateDonation = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

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
          <button className="support-nav__link" onClick={() => navigate('/support')}>
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
          Contribute to <span>Canvio</span>
        </h1>
        <p className="support-hero__subtitle">
          Canvio is free, open source, and built for everyone.
        </p>
        <p className="support-hero__text">
          If it helps you think, learn, or create, consider supporting its development.
        </p>
      </header>

      {/* Main Container */}
      <main className="support-main-container">
        {isSubmitted ? (
          <div className="support-thankyou-box">
            <span className="material-symbols-outlined text-4xl" style={{ color: '#22c55e' }}>verified</span>
            <h2>Thank You for Contributing to Canvio! ❤️</h2>
            <p>Your contribution helps keep Canvio free, open source, and accessible to everyone.</p>
            {donorName && <p className="support-thankyou__name">Thank you, <strong>{donorName}</strong>!</p>}
            <button className="support-btn-primary" onClick={() => setIsSubmitted(false)} style={{ marginTop: 20 }}>
              Make Another Contribution
            </button>
          </div>
        ) : (
          <form className="support-form" onSubmit={handleSimulateDonation}>
            {/* Informational Cards with Distinct Visual Identity & Crisp Text */}
            <div className="support-cards-grid">
              <div className="support-reason-card card-coffee">
                <div className="support-card__icon-wrapper icon-coffee">
                  <span className="material-symbols-outlined">coffee</span>
                </div>
                <h3>Buy the team a coffee</h3>
                <p>A small thank you.</p>
              </div>

              <div className="support-reason-card card-support">
                <div className="support-card__icon-wrapper icon-support">
                  <span className="material-symbols-outlined">favorite</span>
                </div>
                <h3>Support the Project</h3>
                <p>Help us build the next release.</p>
              </div>

              <div className="support-reason-card card-sponsor">
                <div className="support-card__icon-wrapper icon-sponsor">
                  <span className="material-symbols-outlined">rocket_launch</span>
                </div>
                <h3>Become a Sponsor</h3>
                <p>Back Canvio's long-term mission.</p>
              </div>
            </div>

            {/* Choose your contribution Section */}
            <div className="support-amount-selector">
              <span className="support-amount__label">Choose your contribution</span>
              <div className="support-amount__buttons">
                <button
                  type="button"
                  className={`support-amount-btn ${selectedAmount === 5 ? 'active' : ''}`}
                  onClick={() => setSelectedAmount(5)}
                >
                  $5
                </button>
                <button
                  type="button"
                  className={`support-amount-btn ${selectedAmount === 10 ? 'active' : ''}`}
                  onClick={() => setSelectedAmount(10)}
                >
                  $10
                </button>
                <button
                  type="button"
                  className={`support-amount-btn ${selectedAmount === 25 ? 'active' : ''}`}
                  onClick={() => setSelectedAmount(25)}
                >
                  $25
                </button>
                <button
                  type="button"
                  className={`support-amount-btn ${selectedAmount === 'custom' ? 'active' : ''}`}
                  onClick={() => setSelectedAmount('custom')}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Custom Amount Input */}
            {selectedAmount === 'custom' && (
              <div className="support-custom-input-group">
                <label>Custom Amount ($USD)</label>
                <input
                  type="number"
                  min="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="support-input"
                  required
                />
              </div>
            )}

            {/* Optional Supporter Name */}
            <div className="support-name-group">
              <label>Your Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Alex"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                className="support-input"
              />
            </div>

            {/* Main Contribute Button & Human Touch Line */}
            <div className="support-action-wrapper">
              <button type="submit" className="support-btn-action">
                <span className="material-symbols-outlined text-base">favorite</span>
                <span>Contribute to Canvio</span>
              </button>
              <p className="support-action-subtext">
                Thank you for helping keep Canvio free for everyone.
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
                  <span>Keep Canvio free and open source.</span>
                </li>
                <li>
                  <span className="material-symbols-outlined impact-icon" style={{ color: '#3b82f6' }}>group</span>
                  <span>Improve real-time collaboration.</span>
                </li>
                <li>
                  <span className="material-symbols-outlined impact-icon" style={{ color: '#a855f7' }}>auto_awesome</span>
                  <span>Build smarter AI features.</span>
                </li>
              </ul>
              
              <div className="support-promise-line">
                Canvio will always remain free and open source. Your contribution helps us keep that promise.
              </div>
            </div>
          </form>
        )}
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
        </div>
      </footer>
    </div>
  );
}
