import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getUpdateArticle, UPDATE_ARTICLES } from '../../pages/updatesContent';

const SITE_URL = 'https://canvio.space';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;
const ORGANIZATION_LOGO = `${SITE_URL}/logo.png`;
const SOCIAL_IMAGE_ALT = 'Canvio — a whiteboard where ideas stay connected. Free, no signup, private by default.';

interface PageSeoConfig {
  title: string;
  description: string;
  jsonLd: Record<string, unknown>;
}

const PUBLIC_PAGES: Record<string, PageSeoConfig> = {
  '/': {
    title: 'Canvio | Connected Whiteboard for Learning, Planning and Research',
    description: 'Canvio is a connected online whiteboard for learning, planning, research, AI-assisted boards, semantic relations, and maps when place matters.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${SITE_URL}/#organization`,
          name: 'Canvio',
          url: SITE_URL,
          logo: ORGANIZATION_LOGO,
          sameAs: ['https://github.com/esmailhussien/canvio'],
        },
        {
          '@type': 'WebSite',
          '@id': `${SITE_URL}/#website`,
          name: 'Canvio',
          url: SITE_URL,
          description: 'Canvio is a connected online whiteboard for learning, planning, research, AI-assisted boards, semantic relations, and maps when place matters.',
          publisher: { '@id': `${SITE_URL}/#organization` },
        },
        {
          '@type': 'WebApplication',
          '@id': `${SITE_URL}/#application`,
          name: 'Canvio',
          url: SITE_URL,
          description: 'Canvio is a connected online whiteboard for learning, planning, research, AI-assisted boards, semantic relations, and maps when place matters.',
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
          publisher: { '@id': `${SITE_URL}/#organization` },
        },
      ],
    },
  },
  '/how-it-works': {
    title: 'How Canvio Works | Interactive Online Whiteboard for Visual Thinking',
    description: 'Learn how Canvio turns notes, relations, AI, frames, drawing, maps, and presentation into one editable online whiteboard for visual thinking.',
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
              text: 'Open a blank canvas, choose a ready-made study model, or generate a structured board with AI Navigator.',
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
  },
  '/support': {
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
  },
  '/updates': {
    title: 'Canvio Updates | Online Whiteboard Features, Releases & Guides',
    description: 'Read Canvio updates about connected whiteboard design, visual thinking, AI boards, semantic relations, maps when place matters, and collaboration.',
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
  },
};

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    element.dataset.canvioSeo = 'true';
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    link.dataset.canvioSeo = 'true';
    document.head.appendChild(link);
  }
  link.href = href;
}

function updateJsonLd(value: Record<string, unknown> | null) {
  const existing = document.head.querySelector<HTMLScriptElement>('#canvio-seo-jsonld');
  if (!value) {
    existing?.remove();
    return;
  }

  const script = existing || document.createElement('script');
  script.id = 'canvio-seo-jsonld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(value);
  if (!existing) document.head.appendChild(script);
}

export function Seo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isPrivateBoard = pathname.startsWith('/w/');
    const articleSlug = pathname.startsWith('/updates/') ? pathname.slice('/updates/'.length) : '';
    const article = articleSlug ? getUpdateArticle(decodeURIComponent(articleSlug)) : undefined;

    const pageConfig = PUBLIC_PAGES[pathname] || (article ? {
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
            publisher: { '@type': 'Organization', name: 'Canvio', url: SITE_URL, logo: { '@type': 'ImageObject', url: ORGANIZATION_LOGO } },
            mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/updates/${article.slug}` },
          },
        ],
      },
    } : undefined);

    const isPublicPage = Boolean(pageConfig);
    const title = pageConfig?.title || (isPrivateBoard ? 'Canvio Workspace' : 'Canvio');
    const description = pageConfig?.description || 'Canvio is a visual knowledge workspace for connected ideas.';
    const canonicalPath = isPublicPage ? pathname : '/';
    const canonicalUrl = canonicalPath === '/' ? `${SITE_URL}/` : `${SITE_URL}${canonicalPath}`;

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', isPrivateBoard ? 'noindex, nofollow' : isPublicPage ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow');
    upsertMeta('property', 'og:type', article ? 'article' : 'website');
    upsertMeta('property', 'og:site_name', 'Canvio');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', DEFAULT_IMAGE);
    upsertMeta('property', 'og:image:width', '1200');
    upsertMeta('property', 'og:image:height', '630');
    upsertMeta('property', 'og:image:alt', SOCIAL_IMAGE_ALT);
    upsertMeta('name', 'twitter:card', isPublicPage ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', DEFAULT_IMAGE);
    upsertMeta('name', 'twitter:image:alt', SOCIAL_IMAGE_ALT);
    upsertCanonical(canonicalUrl);

    if (pageConfig?.jsonLd) {
      updateJsonLd(pageConfig.jsonLd);
    } else {
      updateJsonLd(null);
    }
  }, [pathname]);

  return null;
}
