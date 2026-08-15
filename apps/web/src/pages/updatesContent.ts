import rawArticles from './updatesData.json';

export type UpdateCategory = 'Feature' | 'Design note' | 'Guide' | 'Release';

export interface UpdateArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: UpdateCategory;
  datePublished: string;
  readTime: string;
  icon: string;
  accent: string;
  takeaways: string[];
  sections: Array<{ heading: string; paragraphs: string[] }>;
}

export const UPDATE_ARTICLES: UpdateArticle[] = rawArticles as UpdateArticle[];

export function getUpdateArticle(slug: string): UpdateArticle | undefined {
  return UPDATE_ARTICLES.find((article) => article.slug === slug);
}
