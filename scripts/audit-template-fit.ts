/**
 * Audits every template for content that cannot fit inside its node box:
 * - stickies/text: wrapped line count vs available height
 * - shapes: label width vs box width
 * - relations between side-by-side boxes: gap too small for a visible label
 * Run: npx tsx scripts/audit-template-fit.mjs
 */
import { TEMPLATES } from '../apps/web/src/utils/templates';
import { PRESET_TEMPLATES } from '../apps/web/src/utils/presetTemplates';

const LINE_HEIGHT = 22.4;      // 16px * 1.4
const CHAR_WIDTH = 8;          // ~16px system-ui average
const STICKY_PAD_X = 62;       // 16 left + 46 tape gutter
const PAD_Y = 32;

function wrapLines(text: string, charsPerLine: number): number {
  return text.split('\n').reduce((total, paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) return total + 1;
    let lines = 1;
    let current = 0;
    for (const word of words) {
      const wordLen = word.length;
      if (current === 0) current = wordLen;
      else if (current + 1 + wordLen <= charsPerLine) current += 1 + wordLen;
      else { lines += 1; current = wordLen; }
    }
    return total + lines;
  }, 0);
}

interface Violation { template: string; node: string; issue: string }

function auditNodes(templateName: string, nodes: any[], out: Violation[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    const { width, height } = node.size;
    const text = typeof node.data?.text === 'string' ? node.data.text : '';

    if ((node.type === 'sticky') && text) {
      const charsPerLine = Math.max(8, Math.floor((width - STICKY_PAD_X) / CHAR_WIDTH));
      const lines = wrapLines(text, charsPerLine);
      const needed = Math.ceil(lines * LINE_HEIGHT + PAD_Y);
      if (needed > height) {
        out.push({ template: templateName, node: text.slice(0, 26).replace(/\n/g, ' '), issue: `sticky ${width}x${height} needs ~${needed}px h (${lines} lines)` });
      }
    }

    if (node.type === 'text' && text) {
      const fontSize = typeof node.data?.fontSize === 'number' ? node.data.fontSize : 18;
      const lineH = fontSize * 1.45;
      const cpl = Math.max(8, Math.floor((width - 30) / (fontSize * 0.5)));
      const lines = wrapLines(text, cpl);
      const needed = Math.ceil(lines * lineH + 24);
      if (needed > height) {
        out.push({ template: templateName, node: text.slice(0, 26).replace(/\n/g, ' '), issue: `text ${width}x${height} needs ~${needed}px h (${lines} lines @${fontSize}px)` });
      }
    }

    if (node.type === 'shape' && typeof node.data?.label === 'string' && node.data.label) {
      // Measure the widest LINE of a multi-line label, not the full string.
      const longestLine = Math.max(...node.data.label.split('\n').map((l: string) => l.length));
      const est = longestLine * 7.5;
      if (est > width - 12) {
        out.push({ template: templateName, node: node.data.label.slice(0, 24), issue: `shape label line ~${Math.round(est)}px > box ${width}` });
      }
    }
    void byId;
  }
}

function auditRelations(templateName: string, nodes: any[], relations: any[], out: Violation[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const rel of relations) {
    const a = byId.get(rel.sourceId);
    const b = byId.get(rel.targetId);
    if (!a || !b || a.type === 'map' || b.type === 'map') continue;
    const ax2 = a.position.x + a.size.width;
    const bx2 = b.position.x + b.size.width;
    // Side-by-side pair with vertical overlap: measure the clear gap.
    const verticalOverlap = a.position.y < b.position.y + b.size.height && b.position.y < a.position.y + a.size.height;
    if (!verticalOverlap) continue;

    // Estimate the rendered pill width with RelationRenderer's clamp:
    // endpoint labels <=20 chars each, total display <=64 chars.
    const base = rel.label || (rel.relationship && rel.relationship !== 'related_to' ? rel.relationship.replace('_', ' ') : '');
    const srcL = String(a.data?.title || a.data?.label || a.data?.text || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    const tgtL = String(b.data?.title || b.data?.label || b.data?.text || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    let display = srcL.length || tgtL.length ? `${srcL} → ${tgtL}` : (base || '');
    if (base && (srcL.length || tgtL.length)) display = `${base} • ${display}`;
    display = display.slice(0, 64);
    const hasIcon = Boolean(rel.relationship && rel.relationship !== 'related_to');
    const pillWidth = Math.max(34, (hasIcon ? 18 : 0) + display.length * 6.8 + 22);

    const gap = a.position.x < b.position.x ? b.position.x - ax2 : a.position.x - bx2;
    // Pill is centered on the path midpoint; require half of it to fit in the gap.
    const needed = Math.ceil(pillWidth / 2 - 14);
    if (gap >= 0 && gap < needed) {
      out.push({
        template: templateName,
        node: `${base || rel.relationship}: ${srcL.slice(0, 14)}…→${tgtL.slice(0, 14)}…`,
        issue: `gap ${Math.round(gap)}px < ~${needed}px for "${display.slice(0, 30)}" pill`,
      });
    }
  }
}

let fitViolations: Violation[] = [];
const labelGapNotes: Violation[] = [];

for (const t of TEMPLATES) {
  const { nodes, relations } = t.generate();
  auditNodes(t.name, nodes, fitViolations);
  // Pills now render in an overlay ABOVE nodes, so tight gaps can no longer
  // hide labels — collected as information only.
  const before = labelGapNotes.length;
  auditRelations(t.name, nodes, relations, labelGapNotes);
  void before;
}

for (const p of PRESET_TEMPLATES) {
  const cx = 10000; const cy = 10000;
  const { nodes, relations } = p.create(cx, cy, () => 1);
  auditNodes(`[preset] ${p.name}`, nodes, fitViolations);
  auditRelations(`[preset] ${p.name}`, nodes, relations, labelGapNotes);
}

if (labelGapNotes.length > 0) {
  console.log(`Label-gap notes (informational — pills overlay nodes): ${labelGapNotes.length}`);
}
console.log('');

if (fitViolations.length === 0) {
  console.log('Template fit audit: CLEAN');
} else {
  console.log(`Template fit audit: ${fitViolations.length} issues\n`);
  let lastTemplate = '';
  for (const v of fitViolations.sort((a, b) => a.template.localeCompare(b.template))) {
    if (v.template !== lastTemplate) { console.log(`\n■ ${v.template}`); lastTemplate = v.template; }
    console.log(`   - [${v.node}] ${v.issue}`);
  }
  process.exitCode = 1;
}
