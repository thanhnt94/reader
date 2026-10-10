/**
 * Zero-dependency bidirectional converter between Markdown and HTML
 * Specially tuned for WordPress-style Visual <-> Code editor synchronization,
 * supporting Japanese Ruby Furigana, GitHub Alerts, Tables, and Math.
 */

export function htmlToMarkdown(element: HTMLElement): string {
  if (!element) return '';

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Check for Japanese Ruby tags
    if (tag === 'ruby') {
      return el.outerHTML;
    }

    // Check for GitHub alert boxes
    if (el.dataset.alertType) {
      const type = el.dataset.alertType.toUpperCase();
      const content = Array.from(el.childNodes)
        .filter((n) => !(n as HTMLElement).classList?.contains('alert-icon'))
        .map(processNode)
        .join('')
        .trim();
      return `> [!${type}]\n> ${content.replace(/\n/g, '\n> ')}\n\n`;
    }

    const children = Array.from(el.childNodes).map(processNode).join('');

    switch (tag) {
      case 'h1':
        return `# ${children.trim()}\n\n`;
      case 'h2':
        return `## ${children.trim()}\n\n`;
      case 'h3':
        return `### ${children.trim()}\n\n`;
      case 'h4':
        return `#### ${children.trim()}\n\n`;
      case 'h5':
        return `##### ${children.trim()}\n\n`;
      case 'h6':
        return `###### ${children.trim()}\n\n`;
      case 'p':
        return `${children.trim()}\n\n`;
      case 'strong':
      case 'b':
        return `**${children}**`;
      case 'em':
      case 'i':
        return `*${children}*`;
      case 'del':
      case 's':
      case 'strike':
        return `~~${children}~~`;
      case 'u':
        return `<u>${children}</u>`;
      case 'blockquote':
        return `> ${children.trim().replace(/\n/g, '\n> ')}\n\n`;
      case 'code':
        if (el.parentElement?.tagName.toLowerCase() === 'pre') {
          return children;
        }
        return `\`${children}\``;
      case 'pre': {
        const lang = el.querySelector('code')?.getAttribute('data-language') || '';
        return `\`\`\`${lang}\n${children.trim()}\n\`\`\`\n\n`;
      }
      case 'ul':
        return (
          Array.from(el.children)
            .map((li) => `- ${processNode(li).trim()}`)
            .join('\n') + '\n\n'
        );
      case 'ol':
        return (
          Array.from(el.children)
            .map((li, idx) => `${idx + 1}. ${processNode(li).trim()}`)
            .join('\n') + '\n\n'
        );
      case 'li':
        return children;
      case 'a':
        return `[${children}](${el.getAttribute('href') || '#'})`;
      case 'img':
        return `![${el.getAttribute('alt') || ''}](${el.getAttribute('src') || ''})`;
      case 'table': {
        const rows = Array.from(el.querySelectorAll('tr'));
        if (rows.length === 0) return '';
        let mdTable = '';
        rows.forEach((tr, rIdx) => {
          const cells = Array.from(tr.querySelectorAll('th, td'));
          const rowText = '| ' + cells.map((c) => processNode(c).trim()).join(' | ') + ' |';
          mdTable += rowText + '\n';
          if (rIdx === 0) {
            mdTable += '| ' + cells.map(() => ':---').join(' | ') + ' |\n';
          }
        });
        return mdTable + '\n';
      }
      case 'hr':
        return '---\n\n';
      case 'br':
        return '\n';
      case 'div':
        return `${children.trim()}\n\n`;
      default:
        return children;
    }
  }

  const raw = processNode(element);
  // Normalize consecutive newlines
  return raw.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Converts Markdown string into editable HTML suitable for contentEditable canvas
 */
export function markdownToHtml(md: string): string {
  if (!md) return '<p><br></p>';

  let html = md;

  // 1. Convert GitHub Alerts
  html = html.replace(
    /^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*\n((?:>.*\n?)*)/gim,
    (_match, type, content) => {
      const cleanContent = content.replace(/^>\s?/gm, '').trim();
      return `<div data-alert-type="${type.toLowerCase()}" class="my-4 p-4 rounded-xl border alert-${type.toLowerCase()}"><strong>${type}:</strong> ${cleanContent}</div>\n\n`;
    }
  );

  // 2. Headings
  html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

  // 3. Blockquotes
  html = html.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');

  // 4. Code Blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/gm, (_match, lang, code) => {
    return `<pre><code data-language="${lang}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
  });

  // 5. Tables
  html = html.replace(/((?:\|[^\n]+\|\n?)+)/g, (match) => {
    const lines = match.trim().split('\n');
    if (lines.length < 2) return match;

    let tableHtml = '<table class="border-collapse border border-slate-700 w-full my-4">';
    lines.forEach((line, idx) => {
      if (/^\|[\s:-\|]+\|$/.test(line)) return; // skip divider
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      const tag = idx === 0 ? 'th' : 'td';
      tableHtml += '<tr>' + cells.map((c) => `<${tag} class="border border-slate-700 p-2">${c}</${tag}>`).join('') + '</tr>';
    });
    tableHtml += '</table>';
    return tableHtml;
  });

  // 6. Ordered & Unordered Lists
  html = html.replace(/^\s*(\d+)\.\s+(.*)$/gm, '<li data-type="ol">$2</li>');
  html = html.replace(/(?:<li data-type="ol">[\s\S]*?<\/li>\s*)+/g, (match) => `<ol>${match.replace(/ data-type="ol"/g, '')}</ol>`);

  html = html.replace(/^\s*[-*+]\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(?:<li>[\s\S]*?<\/li>\s*)+/g, (match) => `<ul>${match}</ul>`);

  // 7. Inline Formatting
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 8. Paragraphs
  const blocks = html.split(/\n{2,}/);
  const formattedBlocks = blocks.map((b) => {
    b = b.trim();
    if (!b) return '';
    if (/^<(h[1-6]|ul|ol|blockquote|div|pre|table)/i.test(b)) {
      return b;
    }
    return `<p>${b.replace(/\n/g, '<br>')}</p>`;
  });

  return formattedBlocks.filter(Boolean).join('\n');
}
