import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getUpdateArticle } from '../../pages/updatesContent';

const SITE_URL = 'https://canvio.space';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

const PUBLIC_PAGES: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Canvio | Visual Knowledge Workspace for Learning, Planning and Research',
    description: 'Canvio is a collaborative visual workspace for learning, planning, research, concept maps, connected notes, and shared ideas.',
  },
  '/how-it-works': {
    title: 'How Canvio Works | Visual Knowledge Workspace',
    description: 'Learn how Canvio turns notes, shapes, maps, relations, and AI drafts into one editable visual knowledge workspace.',
  },
  '/support': {
    title: 'Support Canvio | Help Improve the Visual Knowledge Workspace',
    description: 'Find Canvio support, report an issue, request a feature, contribute feedback, or help improve the open-source workspace.',
  },
  '/updates': {
    title: 'Canvio Updates | Product Notes, Guides, and Releases',
    description: 'Read Canvio product updates, design notes, guides, and archived releases about visual thinking, AI boards, relations, maps, and collaboration.',
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
    const page = PUBLIC_PAGES[pathname] || (article ? {
      title: `${article.title} | Canvio Updates`,
      description: article.excerpt,
    } : undefined);
    const isPublicPage = Boolean(page);
    const title = page?.title || (isPrivateBoard ? 'Canvio Workspace' : 'Canvio');
    const description = page?.description || 'Canvio is a visual knowledge workspace for connected ideas.';
    const canonicalPath = isPublicPage ? pathname : '/';
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', isPrivateBoard ? 'noindex, nofollow' : isPublicPage ? 'index, follow' : 'noindex, nofollow');
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'Canvio');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', DEFAULT_IMAGE);
    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', DEFAULT_IMAGE);
    upsertCanonical(canonicalUrl);

    if (article) {
      updateJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.excerpt,
        datePublished: article.datePublished,
        dateModified: article.datePublished,
        author: { '@type': 'Organization', name: 'Canvio', url: SITE_URL },
        publisher: { '@type': 'Organization', name: 'Canvio', url: SITE_URL, logo: { '@type': 'ImageObject', url: DEFAULT_IMAGE } },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
      });
    } else if (pathname === '/') {
      updateJsonLd({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${SITE_URL}/#organization`,
            name: 'Canvio',
            url: SITE_URL,
            logo: DEFAULT_IMAGE,
            sameAs: ['https://github.com/esmailhussien/canvio'],
          },
          {
            '@type': 'WebSite',
            '@id': `${SITE_URL}/#website`,
            name: 'Canvio',
            url: SITE_URL,
            description,
            publisher: { '@id': `${SITE_URL}/#organization` },
          },
        ],
      });
    } else {
      updateJsonLd(null);
    }
  }, [pathname]);

  return null;
}
