import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { createBoard } from '../utils/api';
import { useCanvasStore } from '../store/canvasStore';
import { CanvioLogoIcon } from '../components/CanvioLogo/CanvioLogo';
import { IconTheme } from '@canvio/ui';
import { getUpdateArticle, LATEST_UPDATE, UPDATE_ARTICLES, UpdateCategory } from './updatesContent';
import './UpdatesPage.css';

const CATEGORIES: Array<'All' | UpdateCategory> = ['All', 'Feature', 'Design note', 'Guide', 'Release'];

function UpdateGlyph({ icon, accent }: { icon: string; accent: string }) {
  return (
    <span className="updates-glyph" style={{ color: accent, backgroundColor: `${accent}1a` }} aria-hidden="true">
      <span className="material-symbols-outlined">{icon}</span>
    </span>
  );
}

function UpdatesNav({ onLaunch, isCreating, theme, toggleTheme }: { onLaunch: () => void; isCreating: boolean; theme: string; toggleTheme: () => void }) {
  return (
    <nav className="updates-nav">
      <Link className="updates-logo" to="/" aria-label="Canvio home">
        <CanvioLogoIcon size={26} />
        <span>Canvio</span>
      </Link>
      <div className="updates-nav__links">
        <Link className="updates-nav__link" to="/">Workspace</Link>
        <Link className="updates-nav__link" to="/how-it-works">How It Works</Link>
        <Link className="updates-nav__link active" to="/updates">Updates</Link>
        <Link className="updates-nav__link" to="/support">Support</Link>
        <button className="updates-launch" onClick={onLaunch} disabled={isCreating}>
          <span className="updates-launch__glyph">+</span>
          <span>{isCreating ? 'Opening...' : 'Launch Canvas'}</span>
        </button>
        <button className="updates-theme" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconTheme size={18} />
        </button>
      </div>
    </nav>
  );
}

export function UpdatesPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const theme = useCanvasStore((s) => s.theme);
  const toggleTheme = useCanvasStore((s) => s.toggleTheme);
  const [isCreating, setIsCreating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'All' | UpdateCategory>('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [slug]);

  const handleCreateWorld = () => {
    if (isCreating) return;
    setIsCreating(true);
    const newId = nanoid(10);
    createBoard().catch(() => {});
    navigate(`/w/${newId}`);
  };

  const article = slug ? getUpdateArticle(slug) : undefined;
  const relatedArticles = article
    ? UPDATE_ARTICLES
        .filter((item) => item.slug !== article.slug)
        .sort((left, right) => Number(right.category === article.category) - Number(left.category === article.category))
        .slice(0, 2)
    : [];
  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return UPDATE_ARTICLES.filter((item) => {
      const categoryMatch = activeCategory === 'All' || item.category === activeCategory;
      const queryMatch = !normalizedQuery || `${item.title} ${item.excerpt} ${item.category}`.toLowerCase().includes(normalizedQuery);
      return categoryMatch && queryMatch;
    });
  }, [activeCategory, query]);

  if (slug && !article) return <Navigate to="/updates" replace />;

  return (
    <div className="updates-page dot-grid">
      <UpdatesNav onLaunch={handleCreateWorld} isCreating={isCreating} theme={theme} toggleTheme={toggleTheme} />

      {article ? (
        <main className="updates-article-page">
          <Link className="updates-back-link" to="/updates">
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            <span>All updates</span>
          </Link>
          <article className="updates-article">
            <header className="updates-article__header">
              <div className="updates-article__meta">
                <span className="updates-category" style={{ color: article.accent, backgroundColor: `${article.accent}18` }}>{article.category}</span>
                <span>{formatDate(article.datePublished)}</span>
                <span>{article.readTime}</span>
              </div>
              <UpdateGlyph icon={article.icon} accent={article.accent} />
              <h1>{article.title}</h1>
              <p>{article.excerpt}</p>
            </header>
            <aside className="updates-article__takeaways" aria-label="Key takeaways">
              <div className="updates-article__takeaways-heading">
                <span className="material-symbols-outlined" aria-hidden="true">checklist</span>
                <strong>At a glance</strong>
              </div>
              <ul>
                {article.takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}
              </ul>
            </aside>
            <div className="updates-article__body">
              {article.sections.map((section) => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </section>
              ))}
            </div>
            <footer className="updates-article__footer">
              <div>
                <span className="updates-section-kicker">Put it into practice</span>
                <h2>Open a board and try the idea.</h2>
              </div>
              <button className="updates-primary-btn" onClick={handleCreateWorld} disabled={isCreating}>
                <span className="material-symbols-outlined" aria-hidden="true">add</span>
                <span>{isCreating ? 'Opening...' : 'Launch Canvas'}</span>
              </button>
            </footer>
            <section className="updates-related" aria-label="Related updates">
              <div>
                <span className="updates-section-kicker">Keep exploring</span>
                <h2>More from Canvio Updates</h2>
              </div>
              <div className="updates-related__grid">
                {relatedArticles.map((item) => (
                  <Link className="updates-related__card" to={`/updates/${item.slug}`} key={item.slug}>
                    <UpdateGlyph icon={item.icon} accent={item.accent} />
                    <span className="updates-category" style={{ color: item.accent, backgroundColor: `${item.accent}18` }}>{item.category}</span>
                    <h3>{item.title}</h3>
                    <span className="updates-related__read">Read article <span aria-hidden="true">-&gt;</span></span>
                  </Link>
                ))}
              </div>
            </section>
          </article>
        </main>
      ) : (
        <>
          <header className="updates-hero">
            <div className="updates-hero__badge"><span className="updates-hero__dot" />Product notes, guides, and archived releases</div>
            <h1>Canvio Updates</h1>
            <p>See what is changing, why it matters, and how each improvement supports clearer visual thinking.</p>
          </header>

          <main className="updates-main">
            <section className="updates-featured" aria-label="Featured update">
              <div className="updates-featured__visual">
                <span className="material-symbols-outlined" aria-hidden="true">psychology_alt</span>
                <div className="updates-featured__mini-card updates-featured__mini-card--one">Rich tools</div>
                <div className="updates-featured__mini-card updates-featured__mini-card--two">Your language</div>
                <div className="updates-featured__mini-card updates-featured__mini-card--three">Clear relations</div>
              </div>
              <div className="updates-featured__copy">
                <div className="updates-article__meta"><span className="updates-category" style={{ color: '#a855f7', backgroundColor: '#a855f718' }}>Featured</span><span>Latest update</span></div>
                <h2>{LATEST_UPDATE.title}</h2>
                <p>{LATEST_UPDATE.excerpt}</p>
                <Link className="updates-text-link" to={`/updates/${LATEST_UPDATE.slug}`}>Read the update <span aria-hidden="true">-&gt;</span></Link>
              </div>
            </section>

            <section className="updates-library" aria-label="Update archive">
              <div className="updates-library__heading">
                <div>
                  <span className="updates-section-kicker">The archive</span>
                  <h2>Ideas behind the workspace</h2>
                </div>
                <label className="updates-search">
                  <span className="material-symbols-outlined" aria-hidden="true">search</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search updates"
                    aria-label="Search updates"
                    aria-describedby="updates-result-count"
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="updates-filters" role="group" aria-label="Filter updates by category">
                {CATEGORIES.map((category) => (
                  <button key={category} className={activeCategory === category ? 'active' : ''} onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category}>{category}</button>
                ))}
              </div>
              <p className="updates-results" id="updates-result-count" aria-live="polite">
                {filteredArticles.length} {filteredArticles.length === 1 ? 'update' : 'updates'}
                {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
                {query.trim() ? ` matching “${query.trim()}”` : ''}
              </p>
              <div className="updates-grid">
                {filteredArticles.map((item) => (
                  <Link className="updates-card" to={`/updates/${item.slug}`} key={item.slug}>
                    <div className="updates-card__top"><UpdateGlyph icon={item.icon} accent={item.accent} /><span className="updates-category" style={{ color: item.accent, backgroundColor: `${item.accent}18` }}>{item.category}</span></div>
                    <h3>{item.title}</h3>
                    <p>{item.excerpt}</p>
                    <div className="updates-card__footer"><span>{formatDate(item.datePublished)}</span><span>{item.readTime}</span></div>
                  </Link>
                ))}
              </div>
              {filteredArticles.length === 0 && (
                <div className="updates-empty">
                  <strong>No matching updates</strong>
                  <span>Try another phrase or show the complete archive.</span>
                  <button onClick={() => { setQuery(''); setActiveCategory('All'); }}>Clear filters</button>
                </div>
              )}
            </section>
          </main>
        </>
      )}

      <footer className="updates-footer">
        <div><CanvioLogoIcon size={20} /><span>Canvio — Connect ideas. Create knowledge.</span></div>
        <div><Link to="/">Home</Link><Link to="/how-it-works">How It Works</Link><Link to="/support">Support</Link></div>
      </footer>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}
