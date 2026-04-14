/**
 * Lightweight markdown-to-HTML converter for proposal text.
 * Handles: **bold**, *italic*, bullet lists (- or *), numbered lists, line breaks.
 * No external dependencies.
 */
export function renderMarkdown(text: string | null | undefined): string {
  if (!text) return '';

  // Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_ (but not inside words with underscores)
  html = html.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<em>$1</em>');
  html = html.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<em>$1</em>');

  // Process lines for lists
  const lines = html.split('\n');
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Unordered list item: - item or * item (but not ** bold)
    const ulMatch = trimmed.match(/^[-•]\s+(.+)/);
    const starBullet = !trimmed.startsWith('<strong>') && trimmed.match(/^\*\s+(.+)/);
    // Ordered list item: 1. item
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)/);

    if (ulMatch || starBullet) {
      if (inOl) { result.push('</ol>'); inOl = false; }
      if (!inUl) { result.push('<ul style="margin:6px 0 6px 0;padding-left:22px;list-style-type:disc;">'); inUl = true; }
      const content = ulMatch ? ulMatch[1] : starBullet![1];
      result.push(`<li style="margin:4px 0;line-height:1.6;">${content}</li>`);
    } else if (olMatch) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (!inOl) { result.push('<ol style="margin:6px 0 6px 0;padding-left:22px;">'); inOl = true; }
      result.push(`<li style="margin:4px 0;line-height:1.6;">${olMatch[2]}</li>`);
    } else {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (inOl) { result.push('</ol>'); inOl = false; }
      if (trimmed === '') {
        result.push('<br/>');
      } else {
        result.push(line);
      }
    }
  }
  if (inUl) result.push('</ul>');
  if (inOl) result.push('</ol>');

  return result.join('\n');
}
