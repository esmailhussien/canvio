import React, { useState, useMemo } from 'react';
import { TEMPLATES, applyTemplate } from '../../utils/templates';
import { tidyGrid, tidyFlow } from '../../utils/autoLayout';
import { CanvioLogoIcon } from '../CanvioLogo/CanvioLogo';
import { IconX } from '@canvio/ui';
import './TemplatePicker.css';

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onStartBlank?: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Templates', icon: 'grid_view' },
  { id: 'strategy', label: 'Strategy & Brainstorming', icon: 'lightbulb' },
  { id: 'architecture', label: 'Architecture & Systems', icon: 'schema' },
  { id: 'operations', label: 'Operations & Execution', icon: 'view_kanban' },
  { id: 'maps', label: 'Maps & Field Work', icon: 'map' },
  { id: 'decision', label: 'Decision & Spatial AI', icon: 'psychology' },
];

export const TemplatePicker: React.FC<TemplatePickerProps> = ({ isOpen, onClose, onStartBlank }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((t) => {
      // Filter by Category
      let matchesCat = true;
      if (selectedCategory === 'strategy') {
        matchesCat = /strategy|research|brainstorming/i.test(t.category);
      } else if (selectedCategory === 'architecture') {
        matchesCat = /engineering|architecture|system/i.test(t.category);
      } else if (selectedCategory === 'operations') {
        matchesCat = /operations|execution/i.test(t.category);
      } else if (selectedCategory === 'maps') {
        matchesCat = /maps|field/i.test(t.category);
      } else if (selectedCategory === 'decision') {
        matchesCat = /decision|spatial/i.test(t.category);
      }

      // Filter by Search Query
      let matchesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        matchesSearch =
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.outcome.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q);
      }

      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const applyAndClose = (templateId: string) => {
    applyTemplate(templateId);
    onClose();
  };

  return (
    <div className="template-modal__overlay" onClick={onClose}>
      <div className="template-modal__dialog" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar Navigation */}
        <aside className="template-sidebar">
          <div className="template-sidebar__brand">
            <div className="template-sidebar__logo">
              <CanvioLogoIcon size={24} />
              <span className="template-sidebar__title">Canvio</span>
            </div>
            <span className="template-sidebar__badge">Template Library</span>
          </div>

          <nav className="template-sidebar__nav">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`template-sidebar__link ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </nav>

          <div className="template-sidebar__footer">
            <button
              className="template-sidebar__create-btn"
              onClick={() => {
                if (onStartBlank) onStartBlank();
                onClose();
              }}
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span>Blank Canvas</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="template-main">
          {/* Header Bar */}
          <header className="template-main__header">
            <div className="template-search">
              <span className="material-symbols-outlined template-search__icon">search</span>
              <input
                type="text"
                className="template-search__input"
                placeholder="Search templates & models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="template-search__clear" onClick={() => setSearchQuery('')}>
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            <button className="template-close-btn" onClick={onClose} title="Close Template Library">
              <IconX size={18} />
            </button>
          </header>

          {/* Scrollable Library Area */}
          <div className="template-main__body">
            {/* Library Hero Banner */}
            <div className="template-hero">
              <h2>Canvas Models & Auto-Layout</h2>
              <p>Authored spatial boards for decisions, research, operations, systems, and field work.</p>
            </div>

            {/* Auto-Layout Tools Section */}
            <section className="template-section">
              <h3 className="template-section__label">Auto-Layout Engine</h3>
              <div className="template-tools-grid">
                <button
                  className="template-tool-card"
                  onClick={() => {
                    tidyGrid();
                    onClose();
                  }}
                >
                  <div className="template-tool-card__icon">
                    <span className="material-symbols-outlined text-xl">grid_view</span>
                  </div>
                  <div>
                    <strong>Tidy Grid</strong>
                    <p>Align nodes into neat rows & columns</p>
                  </div>
                </button>

                <button
                  className="template-tool-card"
                  onClick={() => {
                    tidyFlow();
                    onClose();
                  }}
                >
                  <div className="template-tool-card__icon">
                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                  </div>
                  <div>
                    <strong>Horizontal Flow</strong>
                    <p>Align nodes into a clean process line</p>
                  </div>
                </button>
              </div>
            </section>

            {/* Ready-Made Templates Grid */}
            <section className="template-section">
              <div className="template-section__header">
                <h3 className="template-section__label">Ready-Made Templates</h3>
                <span className="template-section__count">
                  {filteredTemplates.length} model{filteredTemplates.length !== 1 ? 's' : ''} available
                </span>
              </div>

              {filteredTemplates.length === 0 ? (
                <div className="template-empty">
                  <span className="material-symbols-outlined text-3xl opacity-50">search_off</span>
                  <p>No templates found matching "{searchQuery}"</p>
                  <button className="template-empty__reset" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}>
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="template-cards-grid">
                  {filteredTemplates.map((t) => (
                    <div
                      key={t.id}
                      className="template-card"
                      style={{ '--template-accent': t.accent } as React.CSSProperties}
                      onClick={() => applyAndClose(t.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          applyAndClose(t.id);
                        }
                      }}
                    >
                      <div className={`template-card__preview template-card__preview--${t.preview}`}>
                        <span />
                        <span />
                        <span />
                        <span />
                        <i />
                      </div>

                      <div className="template-card__content">
                        <div className="template-card__top">
                          <div>
                            <h4>{t.name}</h4>
                            <span className="template-card__category">{t.category}</span>
                          </div>
                          <div className="template-card__badge" style={{ color: t.accent, background: `color-mix(in srgb, ${t.accent} 15%, transparent)` }}>
                            <span className="material-symbols-outlined text-sm">
                              {t.preview === 'spatial' ? 'map' : t.preview === 'system' ? 'schema' : 'space_dashboard'}
                            </span>
                          </div>
                        </div>

                        <p className="template-card__desc">{t.description}</p>
                        <p className="template-card__outcome">{t.outcome}</p>

                        <div className="template-card__footer">
                          <span className="template-card__stats">
                            {t.nodes} nodes / {t.relations} relations
                          </span>
                          <button className="template-card__apply-btn" type="button">
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};
