import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { createBoard } from '../utils/api';
import { useCanvasStore } from '../store/canvasStore';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { IconTheme } from '@canvio/ui';
import './HomePage.css';

export function HomePage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const theme = useCanvasStore((s) => s.theme);
  const toggleTheme = useCanvasStore((s) => s.toggleTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleCreateWorld = () => {
    const newId = nanoid(10);
    createBoard().catch(() => {});
    navigate(`/w/${newId}`);
  };

  return (
    <div className="home-page dot-grid">
      {/* Top Navigation */}
      <nav className="home-nav">
        <div className="home-logo">
          <CanvioLogoIcon size={26} />
          <span className="home-logo__text">Canvio</span>
        </div>
        <div className="home-nav__links">
          <button className="home-nav__link" onClick={handleCreateWorld} disabled={isCreating}>
            Workspace
          </button>
          <button className="home-btn-primary" onClick={handleCreateWorld} disabled={isCreating}>
            {isCreating ? 'Creating...' : '+ Launch Canvas'}
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

      {/* Hero Section */}
      <section className="home-hero">
        <h1 className="home-hero__title">
          Build ideas the way you <span>build cities</span>.
        </h1>
        <p className="home-hero__subtitle">
          An infinite collaborative canvas powered by spatial AI, freehand drawing, vector shape recognition, and real-time multiplayer.
        </p>
        <div className="home-hero__cta">
          <button className="home-btn-primary" onClick={handleCreateWorld} disabled={isCreating}>
            <span className="material-symbols-outlined">add_circle</span>
            {isCreating ? 'Creating World...' : 'Launch Canvas Now'}
          </button>
          <button className="home-btn-secondary" onClick={() => navigate(`/w/demo-${nanoid(6)}`)}>
            <span className="material-symbols-outlined">play_circle</span>
            Explore Demo World
          </button>
        </div>

        {/* Interactive Preview Frame */}
        <div className="home-preview">
          <div className="home-preview__grid" />
          
          <div className="preview-sticky preview-sticky-1">
            <strong>Project Vision: Spatial AI</strong>
            <p style={{ opacity: 0.8, marginTop: 4 }}>Focus on seamless interactions & infinite canvas flexibility.</p>
          </div>

          <div className="preview-sticky preview-sticky-2">
            <strong>Team Sync @ 10am</strong>
            <p style={{ opacity: 0.8, marginTop: 4 }}>Discuss component hierarchy & features.</p>
          </div>

          <div className="preview-sticky preview-sticky-3">
            <strong>Sprint Tasks</strong>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 6, lineHeight: 1.4 }}>
              <li>✓ Design System</li>
              <li>✓ Ink-to-Shape Engine</li>
              <li>✓ Real-time Multiplayer</li>
            </ul>
          </div>

          <div className="preview-shape-rect">
            <span>Frontend App</span>
          </div>

          <div className="preview-shape-circle">
            <span>Spatial Engine</span>
          </div>

          {/* SVG Connection Lines Simulation */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <path d="M 280 180 Q 450 120 700 160" fill="none" stroke="rgba(99,102,241,0.5)" strokeDasharray="6,6" strokeWidth="2" />
            <path d="M 400 320 C 550 320, 680 280, 750 360" fill="none" stroke="rgba(34,197,94,0.5)" strokeWidth="2.5" />
            <path d="M 220 280 Q 300 450 450 380" fill="none" stroke="#ec4899" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 8px rgba(236,72,153,0.8))' }} />
          </svg>
        </div>
      </section>

      {/* Features Grid */}
      <section className="home-features">
        <div className="home-features__grid">
          <div className="feature-card">
            <div className="feature-card__icon feature-card__icon--edit">
              <span className="material-symbols-outlined">edit</span>
            </div>
            <h3 className="feature-card__title">Pure Freehand & Ink-to-Shape</h3>
            <p className="feature-card__desc">
              Hand-drawn shapes auto-convert into crisp vector geometry for perfectly clean diagrams instantly.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__icon feature-card__icon--arrow">
              <span className="material-symbols-outlined">arrow_right_alt</span>
            </div>
            <h3 className="feature-card__title">Smart Connection Arrows</h3>
            <p className="feature-card__desc">
              Draw a gesture line between objects to auto-connect with dynamic routing that stays neat as you move nodes.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__icon feature-card__icon--group">
              <span className="material-symbols-outlined">group</span>
            </div>
            <h3 className="feature-card__title">Real-Time Collaboration</h3>
            <p className="feature-card__desc">
              Multiplayer cursors, instant sync, and presence awareness make remote teamwork feel physical and alive.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__icon feature-card__icon--map">
              <span className="material-symbols-outlined">map</span>
            </div>
            <h3 className="feature-card__title">Spatial AI & Widgets</h3>
            <p className="feature-card__desc">
              Embed interactive Leaflet maps, code snippets, frames, and spatial AI navigators directly onto your workspace.
            </p>
          </div>
        </div>
      </section>

      {/* Recent Worlds Section */}
      <section className="home-worlds">
        <div className="home-worlds__header">
          <h2 className="home-worlds__title">Recent Workspaces</h2>
          <button className="home-btn-primary" onClick={handleCreateWorld} disabled={isCreating}>
            <span className="material-symbols-outlined">add</span> Create New World
          </button>
        </div>

        <div className="worlds-grid">
          <div className="world-card--create world-card" onClick={handleCreateWorld}>
            <span className="material-symbols-outlined" style={{ fontSize: 36 }}>add_box</span>
            <span style={{ fontWeight: 600 }}>Create Blank Canvas</span>
          </div>

          <div className="world-card" onClick={() => navigate(`/w/operations-hub`)}>
            <div className="world-card__preview">
              <span className="material-symbols-outlined" style={{ fontSize: 40 }}>schema</span>
            </div>
            <div className="world-card__info">
              <div className="world-card__name">Operations Hub</div>
              <div className="world-card__date">Active workspace</div>
            </div>
          </div>

          <div className="world-card" onClick={() => navigate(`/w/strategy-sprint`)}>
            <div className="world-card__preview">
              <span className="material-symbols-outlined" style={{ fontSize: 40 }}>space_dashboard</span>
            </div>
            <div className="world-card__info">
              <div className="world-card__name">Strategy Sprint Q3</div>
              <div className="world-card__date">Active workspace</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
