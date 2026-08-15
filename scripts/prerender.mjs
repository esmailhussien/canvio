import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const distDir = join(root, 'apps', 'web', 'dist');
const templatePath = join(distDir, 'index.html');

if (!existsSync(templatePath)) {
  console.error('Error: apps/web/dist/index.html not found. Run vite build before prerendering.');
  process.exit(1);
}

const template = readFileSync(templatePath, 'utf8');
const SITE_URL = 'https://canvio.space';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

const articlesPath = join(root, 'apps', 'web', 'src', 'pages', 'updatesData.json');
const UPDATE_ARTICLES = JSON.parse(readFileSync(articlesPath, 'utf8'));


function buildNavigationHtml(activePath) {
  return `
    <nav class="home-nav" aria-label="Main Navigation">
      <a class="home-logo" href="/" aria-label="Canvio home">
        <span class="home-logo__text">Canvio</span>
      </a>
      <div class="home-nav__links">
        <a class="home-nav__link ${activePath === '/' ? 'active' : ''}" href="/">Workspace</a>
        <a class="home-nav__link ${activePath === '/how-it-works' ? 'active' : ''}" href="/how-it-works">How It Works</a>
        <a class="home-nav__link ${activePath.startsWith('/updates') ? 'active' : ''}" href="/updates">Updates</a>
        <a class="home-nav__link ${activePath === '/support' ? 'active' : ''}" href="/support">Support</a>
        <a class="home-btn-primary home-nav__launch" href="/w/new">Launch Canvas</a>
      </div>
    </nav>
  `;
}

function buildFooterHtml() {
  return `
    <footer class="home-footer" style="padding: 40px 24px; text-align: center; border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.08)); margin-top: 60px;">
      <div style="max-width: 1100px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px;">
        <div style="text-align: left;">
          <strong>Canvio</strong> — Visual Knowledge Workspace
          <p style="margin: 4px 0 0; color: var(--text-secondary, #94a3b8); font-size: 14px;">Connect ideas, maps, notes, and AI-assisted models on an infinite canvas.</p>
        </div>
        <div style="display: flex; gap: 20px; font-size: 14px;">
          <a href="/how-it-works" style="color: var(--text-secondary, #94a3b8);">How It Works</a>
          <a href="/updates" style="color: var(--text-secondary, #94a3b8);">Updates</a>
          <a href="/support" style="color: var(--text-secondary, #94a3b8);">Support</a>
          <a href="https://github.com/esmailhussien/canvio" target="_blank" rel="noopener noreferrer" style="color: var(--text-secondary, #94a3b8);">GitHub</a>
        </div>
      </div>
    </footer>
  `;
}

const PAGES = [
  {
    path: '/',
    title: 'Canvio | Online Whiteboard for Learning, Planning and Research',
    description: 'Canvio is an online whiteboard and visual knowledge workspace for learning, planning, research, concept maps, connected notes, and shared ideas.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://canvio.space/#organization',
          name: 'Canvio',
          url: 'https://canvio.space',
          logo: 'https://canvio.space/logo.png',
          sameAs: ['https://github.com/esmailhussien/canvio'],
        },
        {
          '@type': 'WebSite',
          '@id': 'https://canvio.space/#website',
          name: 'Canvio',
          url: 'https://canvio.space',
          description: 'Canvio is an online whiteboard and visual knowledge workspace for learning, planning, research, concept maps, connected notes, and shared ideas.',
          publisher: { '@id': 'https://canvio.space/#organization' },
        },
        {
          '@type': 'WebApplication',
          '@id': 'https://canvio.space/#application',
          name: 'Canvio',
          url: 'https://canvio.space',
          description: 'Canvio is an online whiteboard and visual knowledge workspace for learning, planning, research, concept maps, connected notes, and shared ideas.',
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web',
          browserRequirements: 'Requires a modern web browser',
          featureList: [
            'Infinite online whiteboard',
            'Concept mapping and connected notes',
            'Living Map nodes with interactive coordinates',
            'AI-assisted board creation and summarization',
            'Real-time CRDT collaboration',
            'Presentation mode & laser pointer',
            'Vector shapes, freehand ink, and export tools',
          ],
          publisher: { '@id': 'https://canvio.space/#organization' },
        },
      ],
    },
    bodyHtml: `
      <div class="home-page dot-grid">
        ${buildNavigationHtml('/')}
        <main class="home-main">
          <section class="home-hero" style="padding: 60px 24px; text-align: center; max-width: 900px; margin: 0 auto;">
            <div class="home-hero__badge" style="display: inline-block; padding: 6px 14px; border-radius: 999px; background: rgba(99,102,241,0.12); color: #818cf8; margin-bottom: 20px; font-weight: 500;">
              ✨ The Operating System for Ideas
            </div>
            <h1 style="font-size: clamp(32px, 5vw, 56px); font-weight: 800; line-height: 1.15; margin-bottom: 20px;">
              An online whiteboard built for connected thinking.
            </h1>
            <p style="font-size: clamp(16px, 2vw, 20px); color: var(--text-secondary, #94a3b8); max-width: 680px; margin: 0 auto 32px; line-height: 1.6;">
              Combine sticky notes, interactive maps, freehand drawing, vector shapes, frames, and AI drafts on a collaborative spatial canvas.
            </p>
            <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 48px;">
              <a href="/w/new" class="home-btn-primary" style="padding: 14px 28px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 12px; background: #6366f1; color: #fff;">
                Start Blank Canvas
              </a>
              <a href="/how-it-works" class="home-btn-secondary" style="padding: 14px 28px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 12px; border: 1px solid var(--border-default, rgba(255,255,255,0.15)); color: inherit;">
                See How It Works
              </a>
            </div>
          </section>

          <section class="home-features" style="max-width: 1100px; margin: 0 auto 60px; padding: 0 24px;">
            <h2 style="font-size: 28px; text-align: center; margin-bottom: 36px;">How Canvio turns thoughts into spatial knowledge</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px;">
              <div class="home-card" style="padding: 24px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                <div style="font-size: 24px; font-weight: 800; color: #38bdf8; margin-bottom: 12px;">01. Start</div>
                <h3 style="font-size: 18px; margin-bottom: 8px;">Blank or AI-assisted</h3>
                <p style="color: var(--text-secondary, #94a3b8); line-height: 1.5;">Begin with an open canvas, ready-made study models, or an AI prompt that drafts real movable objects.</p>
              </div>
              <div class="home-card" style="padding: 24px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                <div style="font-size: 24px; font-weight: 800; color: #22c55e; margin-bottom: 12px;">02. Build</div>
                <h3 style="font-size: 18px; margin-bottom: 8px;">Living canvas nodes</h3>
                <p style="color: var(--text-secondary, #94a3b8); line-height: 1.5;">Drop sticky notes, Leaflet satellite maps, stylus drawings, code blocks, and structured frames.</p>
              </div>
              <div class="home-card" style="padding: 24px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                <div style="font-size: 24px; font-weight: 800; color: #a855f7; margin-bottom: 12px;">03. Connect</div>
                <h3 style="font-size: 18px; margin-bottom: 8px;">Semantic relations</h3>
                <p style="color: var(--text-secondary, #94a3b8); line-height: 1.5;">Smart routed arrows explain why ideas belong together: causes, dependencies, evidence, and map pins.</p>
              </div>
              <div class="home-card" style="padding: 24px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                <div style="font-size: 24px; font-weight: 800; color: #f59e0b; margin-bottom: 12px;">04. Deliver</div>
                <h3 style="font-size: 18px; margin-bottom: 8px;">Present & collaborate</h3>
                <p style="color: var(--text-secondary, #94a3b8); line-height: 1.5;">Live multi-cursor sync, laser pointer, focus mode, and high-resolution export for lessons and reviews.</p>
              </div>
            </div>
          </section>

          <section class="home-use-cases" style="max-width: 1100px; margin: 0 auto 60px; padding: 0 24px;">
            <h2 style="font-size: 28px; text-align: center; margin-bottom: 36px;">Tailored for visual thinkers</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;">
              <div style="padding: 20px; border-radius: 12px; border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                <strong style="color: #38bdf8;">Teaching & Lessons</strong>
                <p style="font-size: 14px; color: var(--text-secondary, #94a3b8); margin-top: 8px;">Plan explanations, guide attention with temporary laser cues, and export clear board artifacts for students.</p>
              </div>
              <div style="padding: 20px; border-radius: 12px; border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                <strong style="color: #22c55e;">Studying & Research</strong>
                <p style="font-size: 14px; color: var(--text-secondary, #94a3b8); margin-top: 8px;">Synthesize papers, connect evidence to conclusions, and create visual concept maps that stick.</p>
              </div>
              <div style="padding: 20px; border-radius: 12px; border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                <strong style="color: #a855f7;">Planning & Projects</strong>
                <p style="font-size: 14px; color: var(--text-secondary, #94a3b8); margin-top: 8px;">Turn goals, dependencies, decisions, and risks into a shared visual landscape for the team.</p>
              </div>
              <div style="padding: 20px; border-radius: 12px; border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                <strong style="color: #f59e0b;">Spatial & Field Work</strong>
                <p style="font-size: 14px; color: var(--text-secondary, #94a3b8); margin-top: 8px;">Embed interactive geographic maps right next to site notes, images, and connected checklists.</p>
              </div>
            </div>
          </section>
        </main>
        ${buildFooterHtml()}
      </div>
    `,
  },
  {
    path: '/how-it-works',
    title: 'How Canvio Works | Interactive Online Whiteboard for Visual Thinking',
    description: 'Learn how Canvio turns notes, shapes, maps, relations, and AI drafts into one editable online whiteboard for visual thinking, learning, and planning.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Canvio', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'How It Works', item: `${SITE_URL}/how-it-works` },
          ],
        },
        {
          '@type': 'HowTo',
          name: 'How to use Canvio for visual thinking and planning',
          description: 'A visual workflow to start, build, connect, and deliver ideas on an infinite online whiteboard.',
          step: [
            {
              '@type': 'HowToStep',
              position: 1,
              name: 'Start Anywhere',
              text: 'Open a blank canvas, choose a ready-made study model, or generate a structured board with Spatial AI.',
            },
            {
              '@type': 'HowToStep',
              position: 2,
              name: 'Add Living Canvas Objects',
              text: 'Place sticky notes, vector shapes, stylus annotations, frames, interactive maps, code, and images.',
            },
            {
              '@type': 'HowToStep',
              position: 3,
              name: 'Connect with Semantic Relations',
              text: 'Create labeled relations between ideas and map pins to show cause, sequence, proof, and dependency.',
            },
            {
              '@type': 'HowToStep',
              position: 4,
              name: 'Deliver, Present, and Collaborate',
              text: 'Share a zero-signup link for real-time collaboration, present with laser pointer, or export to PNG.',
            },
          ],
        },
      ],
    },
    bodyHtml: `
      <div class="how-it-works-page dot-grid">
        ${buildNavigationHtml('/how-it-works')}
        <main class="how-main" style="max-width: 1000px; margin: 0 auto; padding: 40px 24px;">
          <header style="text-align: center; margin-bottom: 48px;">
            <p style="color: #818cf8; font-weight: 600; margin-bottom: 8px;">A Calm & Powerful Workflow</p>
            <h1 style="font-size: clamp(30px, 4vw, 44px); font-weight: 800; margin-bottom: 16px;">How Canvio Works</h1>
            <p style="font-size: 18px; color: var(--text-secondary, #94a3b8); max-width: 650px; margin: 0 auto;">
              From the first stroke to a completed knowledge map — four steps to organize complex ideas spatially.
            </p>
          </header>

          <div style="display: flex; flex-direction: column; gap: 32px; margin-bottom: 60px;">
            <article style="padding: 32px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
              <span style="color: #38bdf8; font-weight: 700; font-size: 14px;">STEP 01</span>
              <h2 style="font-size: 24px; margin: 8px 0 12px;">Start Anywhere: Blank, Model, or AI Draft</h2>
              <p style="color: var(--text-secondary, #94a3b8); line-height: 1.6;">
                Begin your work without friction. Open a blank canvas in 2 seconds, pick from pre-built models (study concept maps, lesson plans, decision matrices), or type a prompt into Spatial AI to generate an editable starting structure with connected cards.
              </p>
            </article>

            <article style="padding: 32px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
              <span style="color: #22c55e; font-weight: 700; font-size: 14px;">STEP 02</span>
              <h2 style="font-size: 24px; margin: 8px 0 12px;">Build with Living Canvas Objects</h2>
              <p style="color: var(--text-secondary, #94a3b8); line-height: 1.6;">
                Every item is an interactive object. Write notes, draw with pressure-sensitive stylus ink, create geometric shapes, group sections with frames, drop syntax-highlighted code blocks, and embed interactive Leaflet satellite maps.
              </p>
            </article>

            <article style="padding: 32px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
              <span style="color: #a855f7; font-weight: 700; font-size: 14px;">STEP 03</span>
              <h2 style="font-size: 24px; margin: 8px 0 12px;">Connect Ideas with Meaningful Relations</h2>
              <p style="color: var(--text-secondary, #94a3b8); line-height: 1.6;">
                Connections in Canvio aren't just dumb lines — they carry meaning. Define relationships like "based on", "depends on", "leads to", or "contradicts". Smart routing keeps arrows readable as you rearrange items on the canvas.
              </p>
            </article>

            <article style="padding: 32px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
              <span style="color: #f59e0b; font-weight: 700; font-size: 14px;">STEP 04</span>
              <h2 style="font-size: 24px; margin: 8px 0 12px;">Deliver: Present, Collaborate, and Export</h2>
              <p style="color: var(--text-secondary, #94a3b8); line-height: 1.6;">
                Share your board link for instant multiplayer collaboration powered by Yjs CRDTs. Switch into Presentation Mode with a spotlight focus and temporary laser pointer. Export frame pages or full-resolution PNGs whenever you need them.
              </p>
            </article>
          </div>
        </main>
        ${buildFooterHtml()}
      </div>
    `,
  },
  {
    path: '/support',
    title: 'Support Canvio | Help Improve the Visual Knowledge Workspace',
    description: 'Find Canvio support, report an issue, request a feature, contribute feedback, or help improve the open-source workspace.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Canvio', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Support', item: `${SITE_URL}/support` },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'How do I report a bug or issue in Canvio?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'You can email support@canvio.space or open an issue on the official GitHub repository at https://github.com/esmailhussien/canvio.',
              },
            },
            {
              '@type': 'Question',
              name: 'Are Canvio workspace boards private?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. Boards accessed via /w/ links are private by default, blocked from search engine crawlers, and only accessible to people who have the link or share token.',
              },
            },
            {
              '@type': 'Question',
              name: 'Does Canvio require an account or login to start?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'No signup is required. You can open a canvas and start drawing, creating notes, and collaborating immediately.',
              },
            },
          ],
        },
      ],
    },
    bodyHtml: `
      <div class="support-page dot-grid">
        ${buildNavigationHtml('/support')}
        <main class="support-main" style="max-width: 1000px; margin: 0 auto; padding: 40px 24px;">
          <header style="text-align: center; margin-bottom: 48px;">
            <h1 style="font-size: clamp(30px, 4vw, 44px); font-weight: 800; margin-bottom: 16px;">Canvio Support & Community</h1>
            <p style="font-size: 18px; color: var(--text-secondary, #94a3b8); max-width: 650px; margin: 0 auto;">
              Report bugs, suggest features, explore the product roadmap, or contribute to open-source development.
            </p>
          </header>

          <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-bottom: 60px;">
            <div style="padding: 24px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
              <h2 style="font-size: 20px; color: #ef4444; margin-bottom: 8px;">Report a Bug</h2>
              <p style="color: var(--text-secondary, #94a3b8); margin-bottom: 16px;">Found an issue with drawing, synchronization, or export? Let us know so we can fix it quickly.</p>
              <a href="mailto:support@canvio.space?subject=Canvio%20Bug%20Report" style="color: #818cf8; font-weight: 600;">Email Bug Report →</a>
            </div>
            <div style="padding: 24px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
              <h2 style="font-size: 20px; color: #22c55e; margin-bottom: 8px;">Request a Feature</h2>
              <p style="color: var(--text-secondary, #94a3b8); margin-bottom: 16px;">Have an idea for a new node type, AI behavior, template model, or keyboard shortcut?</p>
              <a href="mailto:support@canvio.space?subject=Canvio%20Feature%20Request" style="color: #818cf8; font-weight: 600;">Submit Feature Idea →</a>
            </div>
            <div style="padding: 24px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
              <h2 style="font-size: 20px; color: #38bdf8; margin-bottom: 8px;">Open Source Code</h2>
              <p style="color: var(--text-secondary, #94a3b8); margin-bottom: 16px;">Inspect the code, report GitHub issues, or contribute improvements directly.</p>
              <a href="https://github.com/esmailhussien/canvio" target="_blank" rel="noopener noreferrer" style="color: #818cf8; font-weight: 600;">View on GitHub →</a>
            </div>
          </section>
        </main>
        ${buildFooterHtml()}
      </div>
    `,
  },
  {
    path: '/updates',
    title: 'Canvio Updates | Online Whiteboard Features, Releases & Guides',
    description: 'Read Canvio product updates, design notes, guides, and releases about online whiteboard features, visual thinking, AI boards, relations, maps, and collaboration.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Canvio', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Updates', item: `${SITE_URL}/updates` },
          ],
        },
        {
          '@type': 'CollectionPage',
          name: 'Canvio Updates',
          description: 'Product updates, design notes, guides, and releases for Canvio.',
          hasPart: UPDATE_ARTICLES.map((article) => ({
            '@type': 'Article',
            headline: article.title,
            description: article.excerpt,
            url: `${SITE_URL}/updates/${article.slug}`,
            datePublished: article.datePublished,
          })),
        },
      ],
    },
    bodyHtml: `
      <div class="updates-page dot-grid">
        ${buildNavigationHtml('/updates')}
        <main class="updates-main" style="max-width: 1000px; margin: 0 auto; padding: 40px 24px;">
          <header style="text-align: center; margin-bottom: 48px;">
            <p style="color: #818cf8; font-weight: 600; margin-bottom: 8px;">Changelog & Notes</p>
            <h1 style="font-size: clamp(30px, 4vw, 44px); font-weight: 800; margin-bottom: 16px;">Product Updates</h1>
            <p style="font-size: 18px; color: var(--text-secondary, #94a3b8); max-width: 650px; margin: 0 auto;">
              New features, design notes, and guides on spatial thinking with Canvio.
            </p>
          </header>

          <div style="display: flex; flex-direction: column; gap: 24px; margin-bottom: 60px;">
            ${UPDATE_ARTICLES.map((article) => `
              <article style="padding: 28px; border-radius: 16px; background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 8px; font-size: 13px; color: var(--text-secondary, #94a3b8);">
                  <span style="color: ${article.accent}; font-weight: 600;">${article.category}</span>
                  <span>•</span>
                  <time datetime="${article.datePublished}">${article.datePublished}</time>
                  <span>•</span>
                  <span>${article.readTime}</span>
                </div>
                <h2 style="font-size: 22px; margin-bottom: 8px;">
                  <a href="/updates/${article.slug}" style="color: inherit; text-decoration: none;">${article.title}</a>
                </h2>
                <p style="color: var(--text-secondary, #94a3b8); line-height: 1.5; margin-bottom: 16px;">${article.excerpt}</p>
                <a href="/updates/${article.slug}" style="color: #818cf8; font-weight: 600; text-decoration: none;">Read article →</a>
              </article>
            `).join('')}
          </div>
        </main>
        ${buildFooterHtml()}
      </div>
    `,
  },
];

// Add individual update articles
for (const article of UPDATE_ARTICLES) {
  PAGES.push({
    path: `/updates/${article.slug}`,
    title: `${article.title} | Canvio Updates`,
    description: article.excerpt,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Canvio', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Updates', item: `${SITE_URL}/updates` },
            { '@type': 'ListItem', position: 3, name: article.title, item: `${SITE_URL}/updates/${article.slug}` },
          ],
        },
        {
          '@type': 'Article',
          headline: article.title,
          description: article.excerpt,
          datePublished: article.datePublished,
          dateModified: article.datePublished,
          author: { '@type': 'Organization', name: 'Canvio', url: SITE_URL },
          publisher: { '@type': 'Organization', name: 'Canvio', url: SITE_URL, logo: { '@type': 'ImageObject', url: DEFAULT_IMAGE } },
          mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/updates/${article.slug}` },
        },
      ],
    },
    bodyHtml: `
      <div class="updates-page dot-grid">
        ${buildNavigationHtml(`/updates/${article.slug}`)}
        <main class="updates-article-page" style="max-width: 800px; margin: 0 auto; padding: 40px 24px;">
          <a href="/updates" style="display: inline-flex; align-items: center; gap: 6px; color: var(--text-secondary, #94a3b8); text-decoration: none; margin-bottom: 24px;">
            ← All updates
          </a>
          <article class="updates-article">
            <header style="margin-bottom: 32px;">
              <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px; font-size: 14px; color: var(--text-secondary, #94a3b8);">
                <span style="color: ${article.accent}; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: ${article.accent}18;">${article.category}</span>
                <span>•</span>
                <time datetime="${article.datePublished}">${article.datePublished}</time>
                <span>•</span>
                <span>${article.readTime}</span>
              </div>
              <h1 style="font-size: clamp(28px, 4vw, 40px); font-weight: 800; line-height: 1.2; margin-bottom: 16px;">${article.title}</h1>
              <p style="font-size: 18px; color: var(--text-secondary, #94a3b8); line-height: 1.6;">${article.excerpt}</p>
            </header>

            ${article.takeaways && article.takeaways.length > 0 ? `
              <aside style="padding: 20px 24px; border-radius: 12px; background: var(--bg-surface, rgba(255,255,255,0.03)); border-left: 4px solid ${article.accent}; margin-bottom: 36px;">
                <strong style="display: block; margin-bottom: 10px; font-size: 15px;">At a glance</strong>
                <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary, #94a3b8); line-height: 1.6;">
                  ${article.takeaways.map((t) => `<li>${t}</li>`).join('')}
                </ul>
              </aside>
            ` : ''}

            <div class="updates-article__content" style="line-height: 1.8; font-size: 17px;">
              ${article.sections.map((section) => `
                <section style="margin-bottom: 32px;">
                  <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 12px;">${section.heading}</h2>
                  ${section.paragraphs.map((p) => `<p style="margin-bottom: 16px; color: var(--text-secondary, #cbd5e1);">${p}</p>`).join('')}
                </section>
              `).join('')}
            </div>
          </article>
        </main>
        ${buildFooterHtml()}
      </div>
    `,
  });
}

function generateHtmlForPage(page, { skipBodyInjection = false } = {}) {
  // Bug fix: use trailing slash for root canonical to match index.html source
  const canonicalUrl = page.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${page.path}`;
  let html = template;

  // Replace Title
  html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(page.title)}</title>`);

  // Replace Description
  html = html.replace(
    /<meta name="description" content=".*?" \/>/,
    `<meta name="description" content="${escapeAttr(page.description)}" />`
  );

  // Replace Canonical Link
  html = html.replace(
    /<link rel="canonical" href=".*?" \/>/,
    `<link rel="canonical" href="${canonicalUrl}" />`
  );

  // Replace OpenGraph Title & Description & URL
  html = html.replace(
    /<meta property="og:title" content=".*?" \/>/,
    `<meta property="og:title" content="${escapeAttr(page.title)}" />`
  );
  html = html.replace(
    /<meta property="og:description" content=".*?" \/>/,
    `<meta property="og:description" content="${escapeAttr(page.description)}" />`
  );
  html = html.replace(
    /<meta property="og:url" content=".*?" \/>/,
    `<meta property="og:url" content="${canonicalUrl}" />`
  );

  // Replace Twitter Title & Description
  html = html.replace(
    /<meta name="twitter:title" content=".*?" \/>/,
    `<meta name="twitter:title" content="${escapeAttr(page.title)}" />`
  );
  html = html.replace(
    /<meta name="twitter:description" content=".*?" \/>/,
    `<meta name="twitter:description" content="${escapeAttr(page.description)}" />`
  );

  // Replace Schema.org JSON-LD
  const jsonLdString = JSON.stringify(page.jsonLd, null, 2);
  html = html.replace(
    /<script type="application\/ld\+json" id="canvio-seo-jsonld">[\s\S]*?<\/script>/,
    `<script type="application/ld+json" id="canvio-seo-jsonld">\n${jsonLdString}\n    </script>`
  );

  // Inject pre-rendered body HTML inside #root.
  // SKIP for the root path — dist/index.html doubles as the SPA fallback
  // for /w/:worldId board routes. Injecting homepage body HTML there would
  // cause a flash of wrong content before React mounts the WorldPage.
  if (page.bodyHtml && !skipBodyInjection) {
    html = html.replace(
      /<div id="root"><\/div>/,
      `<div id="root">${page.bodyHtml}</div>`
    );
  }

  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

console.log(`Starting Canvio Static Prerendering (${PAGES.length} routes)...`);

for (const page of PAGES) {
  // The root index.html is also the SPA fallback for /w/ board routes,
  // so we only patch <head> metadata without injecting body HTML.
  const isRootPage = page.path === '/';
  const pageHtml = generateHtmlForPage(page, { skipBodyInjection: isRootPage });
  const targetDir = isRootPage ? distDir : join(distDir, page.path.replace(/^\//, ''));
  mkdirSync(targetDir, { recursive: true });
  const targetFile = join(targetDir, 'index.html');
  writeFileSync(targetFile, pageHtml, 'utf8');
  console.log(`  ✓ Prerendered: ${page.path} -> ${targetFile.replace(root, '')}${isRootPage ? ' (head-only, SPA fallback preserved)' : ''}`);
}

// Generate updated sitemap.xml
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://canvio.space/</loc>
    <lastmod>2026-08-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://canvio.space/how-it-works</loc>
    <lastmod>2026-08-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://canvio.space/updates</loc>
    <lastmod>2026-08-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://canvio.space/support</loc>
    <lastmod>2026-08-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
${UPDATE_ARTICLES.map((article) => `  <url>
    <loc>https://canvio.space/updates/${article.slug}</loc>
    <lastmod>${article.datePublished}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>
`;

writeFileSync(join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');
writeFileSync(join(root, 'apps', 'web', 'public', 'sitemap.xml'), sitemapXml, 'utf8');
console.log(`  ✓ Generated sitemap.xml with ${PAGES.length} URLs`);

console.log('✅ Prerendering completed successfully!');
