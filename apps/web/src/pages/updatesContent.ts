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

export const UPDATE_ARTICLES: UpdateArticle[] = [
  {
    slug: 'ai-navigator-editable-boards',
    title: 'AI Navigator: From a Prompt to an Editable Board',
    excerpt: 'Why Canvio turns an AI answer into movable, connected objects instead of a block of text.',
    category: 'Feature',
    datePublished: '2026-08-09',
    readTime: '4 min read',
    icon: 'auto_awesome',
    accent: '#a855f7',
    takeaways: [
      'AI drafts become normal, editable Canvio objects.',
      'Generated boards use frames, shapes, notes, and relations together.',
      'The first draft is fitted into view so people can start editing immediately.',
    ],
    sections: [
      {
        heading: 'The problem with AI answers',
        paragraphs: [
          'A useful idea can become difficult to use when it arrives as one long response. People need to compare parts, move them around, add evidence, and change the structure as they learn more.',
          'Canvio treats AI as a starting partner for spatial thinking. The result is not a finished poster. It is a first board that people can question and reshape.',
        ],
      },
      {
        heading: 'What Canvio creates',
        paragraphs: [
          'A prompt can become a frame, a central shape, supporting notes, and labeled relations. The generated elements remain normal Canvio objects, so they can be edited, connected, presented, exported, or deleted like anything else on the canvas.',
          'The AI flow also fits the created structure into view. That small step matters: a useful first draft should be visible immediately, not left somewhere off-screen.',
        ],
      },
      {
        heading: 'The design principle',
        paragraphs: [
          'AI should reduce the blank-page problem without taking ownership away from the person thinking. Canvio keeps every generated choice visible and editable.',
        ],
      },
    ],
  },
  {
    slug: 'relations-for-connected-thinking',
    title: 'Relations: Turning Notes Into Connected Thinking',
    excerpt: 'A relation is more useful when it explains why two ideas belong together, not only that a line exists.',
    category: 'Design note',
    datePublished: '2026-07-18',
    readTime: '5 min read',
    icon: 'account_tree',
    accent: '#38bdf8',
    takeaways: [
      'Relations explain meaning such as cause, proof, sequence, and dependency.',
      'Labels and routing keep important connections readable as boards change.',
      'The same relation model works across notes, maps, shapes, and frames.',
    ],
    sections: [
      {
        heading: 'Lines are not enough',
        paragraphs: [
          'A plain line can show proximity, but it does not explain meaning. In a lesson, a research board, or a project plan, the important question is often whether one idea proves, enables, depends on, or leads to another.',
        ],
      },
      {
        heading: 'Meaning stays attached',
        paragraphs: [
          'Canvio relations have labels, relationship types, colors, and editable endpoints. Routing responds to the objects around it so the connection can remain readable as the board changes.',
          'The same interaction works across notes, shapes, frames, maps, and other living objects. That makes relations part of the workspace language rather than a special diagram mode.',
        ],
      },
      {
        heading: 'A calmer visual system',
        paragraphs: [
          'The goal is not to put more lines on a board. It is to make the important connections easier to follow, especially when the board is being taught, reviewed, or shared with someone new.',
        ],
      },
    ],
  },
  {
    slug: 'maps-are-an-optional-lens',
    title: 'Why Maps Are an Optional Lens in Canvio',
    excerpt: 'Location is powerful when it matters, but the main idea is a flexible visual workspace for connected work.',
    category: 'Design note',
    datePublished: '2026-07-02',
    readTime: '4 min read',
    icon: 'map',
    accent: '#22c55e',
    takeaways: [
      'Maps appear when location matters, without defining the whole product.',
      'Pins can sit beside evidence, decisions, and notes on the same board.',
      'People can move between a world view and a focused site view.',
    ],
    sections: [
      {
        heading: 'Start with the task',
        paragraphs: [
          'A field visit, geography lesson, or site investigation may need a map. A study guide, architecture review, or decision board may not. Canvio keeps the canvas open so the task determines the objects, not the other way around.',
        ],
      },
      {
        heading: 'Place can become evidence',
        paragraphs: [
          'When a map is useful, pins can sit alongside notes, images, relations, and decisions. A location becomes part of the reasoning instead of a separate screen that people have to leave the board to inspect.',
        ],
      },
      {
        heading: 'One workspace, different lenses',
        paragraphs: [
          'The same board can move from a world view to a focused site visit, then back to the larger story. Maps are one strong lens inside a broader workspace for thinking.',
        ],
      },
    ],
  },
  {
    slug: 'designing-for-mouse-touch-and-pen',
    title: 'Designing Canvio for Mouse, Touch, Tablet, and Pen',
    excerpt: 'Why direct manipulation needs different protections on a laptop, a tablet, and a small phone.',
    category: 'Guide',
    datePublished: '2026-06-18',
    readTime: '6 min read',
    icon: 'devices',
    accent: '#f59e0b',
    takeaways: [
      'Mouse, touch, and pen need different interaction protections.',
      'Dedicated handles and clear active tools reduce accidental movement.',
      'Undo, redo, fit view, and recovery are part of good touch design.',
    ],
    sections: [
      {
        heading: 'The canvas has more than one input',
        paragraphs: [
          'A mouse offers precision. A finger needs space. A pen expects drawing to feel immediate. The same board has to accept all three without making selection, panning, and editing fight each other.',
        ],
      },
      {
        heading: 'Small details make the difference',
        paragraphs: [
          'Canvio uses larger touch targets, dedicated drag handles for notes, clearer active tools, and recovery controls such as undo, redo, and fit view. The interface should explain what is active without covering the work.',
        ],
      },
      {
        heading: 'Designing for recovery',
        paragraphs: [
          'Good touch interaction is not only about preventing mistakes. It is also about making mistakes easy to reverse. Every device should let people try, move, zoom, and return to a useful view with confidence.',
        ],
      },
    ],
  },
  {
    slug: 'private-by-default-workspaces',
    title: 'Private by Default: Keeping Workspace Data in Its Context',
    excerpt: 'A shared link should help the right people collaborate without turning personal board content into public search results.',
    category: 'Release',
    datePublished: '2026-06-04',
    readTime: '3 min read',
    icon: 'lock',
    accent: '#ef4444',
    takeaways: [
      'A shared board link does not mean a board should be searchable.',
      'Workspace routes stay out of the public sitemap and search index.',
      'The public website and private thinking space serve different jobs.',
    ],
    sections: [
      {
        heading: 'A board can contain unfinished thinking',
        paragraphs: [
          'Notes, research, decisions, and classroom plans are often useful before they are polished. People need a place to work privately, then choose when and how to share the result.',
        ],
      },
      {
        heading: 'Sharing and discoverability are different',
        paragraphs: [
          'Canvio keeps workspace routes out of the public sitemap and marks them as non-indexable. That preserves direct sharing while avoiding the assumption that every board should appear in a search engine.',
        ],
      },
      {
        heading: 'A product promise',
        paragraphs: [
          'The public website explains Canvio. The workspace is where people think. Keeping those contexts separate is a small technical choice with a large trust effect.',
        ],
      },
    ],
  },
];

export function getUpdateArticle(slug: string) {
  return UPDATE_ARTICLES.find((article) => article.slug === slug);
}
