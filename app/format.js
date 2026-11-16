// Small helpers for showing API values, and a safe Markdown renderer for bounty
// descriptions (the API answers Markdown; it is escaped first, then the few
// constructs the descriptions use are turned into HTML — never raw HTML).

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('1000.00', 0.5 or '716.00') as '$1,000' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

/** A deadline as a date in UTC. */
export function date(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** The time until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return `${Math.floor(ms / 1000)}s left`;
}

/** True while a bounty still takes entries: a bounty past its deadline may still
 *  read status open until its results are published, so the deadline decides. */
export function takingEntries(b) {
  return Boolean(b?.deadline) && new Date(b.deadline).getTime() > Date.now();
}

/** Inline Markdown on already-escaped text: `code`, **bold**, *italic*, [text](url). */
function inlineMd(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

/** A small safe Markdown renderer: headings, lists, rules, paragraphs, inline markup. */
export function md(src) {
  const lines = String(src ?? '').split('\n');
  let html = '';
  let list = null; // 'ul' | 'ol' | null
  const closeList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html += `<h${level + 1}>${inlineMd(esc(heading[2]))}</h${level + 1}>`;
    } else if (/^---+$/.test(line)) {
      closeList();
      html += '<hr>';
    } else if (ul || ol) {
      const tag = ul ? 'ul' : 'ol';
      if (list !== tag) {
        closeList();
        html += `<${tag}>`;
        list = tag;
      }
      html += `<li>${inlineMd(esc(ul ? ul[1] : ol[1]))}</li>`;
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      html += `<p>${inlineMd(esc(line))}</p>`;
    }
  }
  closeList();
  return html;
}
