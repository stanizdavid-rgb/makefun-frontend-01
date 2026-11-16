// The four surfaces, each a function from live API data to HTML. Every value from
// the API is escaped (or rendered by the safe Markdown renderer) before it lands
// in the page; images the API points at load with crossorigin="anonymous", as
// make.fun's avatar and entry images require.

import { date, esc, md, money, takingEntries, timeLeft } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one. */
const fee = (b) => (b.entryFeeUsd != null ? `${money(b.entryFeeUsd)} fee` : 'no fee');

/** One board row: title, live pot, fee, time left, entries, taking-entries badge. */
function boardRow(b) {
  const open = takingEntries(b);
  return `<li class="card">
    <a class="card-title" href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
    <p class="card-meta">${esc(b.category ?? '')}${b.skills?.length ? ` · ${esc(b.skills.slice(0, 3).join(', '))}` : ''}</p>
    <p class="card-stats">
      <span class="pot" title="Live pot: prize plus entry fees paid in">${pot(b)}</span>
      <span>${fee(b)}</span>
      <span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>
      <span>${Number(b.submissionCount ?? 0).toLocaleString('en-US')} ${b.submissionCount === 1 ? 'entry' : 'entries'}</span>
    </p>
    <span class="badge ${open ? 'badge-open' : 'badge-closed'}">${open ? 'Taking entries' : 'Entries closed'}</span>
  </li>`;
}

/**
 * The bounty board. `state` carries the page's items, its filter and its sort,
 * so the list can be re-filtered in place without another request.
 */
export function board(state) {
  const { items, filter, sort, query, cursor } = state;
  const visible = items
    .filter((b) => {
      if (filter === 'open' && !takingEntries(b)) return false;
      if (filter === 'soon' && !(takingEntries(b) && new Date(b.deadline).getTime() - Date.now() < 86400000)) return false;
      if (filter === 'nofee' && b.entryFeeUsd != null) return false;
      if (query) {
        const hay = `${b.title} ${b.slug} ${b.category ?? ''} ${(b.skills ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) =>
      sort === 'pot'
        ? Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0)
        : sort === 'entries'
          ? (b.submissionCount ?? 0) - (a.submissionCount ?? 0)
          : new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
    );
  const chip = (key, label) =>
    `<button type="button" data-filter="${key}" class="${filter === key ? 'on' : ''}" aria-pressed="${filter === key}">${label}</button>`;
  return `<h1>Open bounties</h1>
  <p class="lede">${items.length} live on make.fun — reward is the live pot, fees included.</p>
  <div class="filters" role="group" aria-label="Filter bounties">
    ${chip('open', 'Taking entries')}${chip('soon', 'Closing in 24h')}${chip('nofee', 'No entry fee')}${chip('all', 'All')}
    <label class="sort">Sort
      <select id="sort" aria-label="Sort bounties">
        <option value="deadline" ${sort === 'deadline' ? 'selected' : ''}>Closing soonest</option>
        <option value="pot" ${sort === 'pot' ? 'selected' : ''}>Biggest pot</option>
        <option value="entries" ${sort === 'entries' ? 'selected' : ''}>Most entries</option>
      </select>
    </label>
  </div>
  ${visible.length ? `<ul class="board">${visible.map(boardRow).join('')}</ul>` : '<p class="empty">No bounties match — try another filter or search.</p>'}
  ${cursor ? '<p class="more"><button type="button" id="more">Show more bounties</button></p>' : ''}`;
}

/** The rewards table: each paid place with its live amount (base prize + fee share). */
function rewardsTable(b) {
  const rows = (b.rewardsNow ?? []).map(
    (r) => `<tr><td>${r.place}${r.place === 1 ? 'st' : r.place === 2 ? 'nd' : r.place === 3 ? 'rd' : 'th'}</td>
      <td>${money(r.baseUsd)}</td><td>${money(r.feeShareUsd)}</td><td><strong>${money(r.amountUsd)}</strong></td></tr>`,
  );
  if (!rows.length) return '';
  return `<h2>Rewards — live pot ${pot(b)}</h2>
  <table class="rewards"><thead><tr><th>Place</th><th>Prize</th><th>Fee share</th><th>Total now</th></tr></thead>
  <tbody>${rows.join('')}</tbody></table>
  <p class="note">Every $0.50 entry fee paid joins the pot and is split over the paid places.</p>`;
}

/** One bounty's page: summary, live pot, fee, dates, status by deadline, rules, rewards. */
export function bounty(b) {
  const open = takingEntries(b);
  return `<p class="crumbs"><a href="#/">All bounties</a> › ${esc(b.category ?? 'Bounty')}</p>
  <h1>${esc(b.title)}</h1>
  <p class="lede">${esc(b.summary ?? '')}</p>
  <p><span class="badge ${open ? 'badge-open' : 'badge-closed'}">${open ? 'Taking entries' : 'Entries closed'}</span>
  ${open ? '' : ' — this bounty reads “open” until its results are published, but its deadline has passed.'}</p>
  <dl class="facts">
    <dt>Live pot</dt><dd><strong>${pot(b)}</strong>${b.entryFeesUsd && Number(b.entryFeesUsd) > 0 ? ` (includes ${money(b.entryFeesUsd)} in entry fees from ${b.entryFeePayers ?? 0} payers)` : ''}</dd>
    <dt>Prize</dt><dd>${money(b.rewardAmount)}</dd>
    ${b.entryFeeUsd != null ? `<dt>Entry fee</dt><dd>${money(b.entryFeeUsd)}</dd>` : ''}
    <dt>Deadline</dt><dd>${date(b.deadline)} (<span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>)</dd>
    <dt>Published</dt><dd>${date(b.publishedAt)}</dd>
    <dt>Entries</dt><dd>${Number(b.submissionCount ?? 0).toLocaleString('en-US')}</dd>
    ${b.sponsor ? `<dt>Sponsor</dt><dd>${esc(b.sponsor.name)}${b.sponsor.isVerified ? ' ✓' : ''}</dd>` : ''}
    ${b.skills?.length ? `<dt>Skills</dt><dd>${b.skills.map(esc).join(', ')}</dd>` : ''}
  </dl>
  <p class="actions"><a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a>
  <a class="btn btn-ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">Open on make.fun ↗</a></p>
  ${rewardsTable(b)}
  <h2>About this bounty</h2>
  <div class="description">${md(b.description ?? '')}</div>`;
}

/** A leaderboard cell: the API's display string, with micro-unit rates as percent. */
function cell(column, entry) {
  const raw = entry.display?.[column.key] ?? entry.values?.[column.key];
  if (raw == null) return '—';
  if (column.key === 'judge' || column.key === 'judge_low' || column.key === 'judge_high') {
    return `${(Number(raw) / 10000).toFixed(2)}%`;
  }
  if (column.key === 'bytes') return `${(Number(raw) / 1024).toFixed(1)} KB`;
  if (column.key === 'valid') return Number(raw) === 1 ? '✓ valid' : '✗ invalid';
  return esc(String(raw));
}

/** One bounty's leaderboard: ranked entries, paginated, handles link to profiles. */
export function leaderboard(slug, data, page) {
  const columns = (data.columns ?? []).filter((c) => !c.hidden);
  const head = columns.map((c) => `<th>${esc(c.title)}</th>`).join('');
  const rows = (data.entries ?? [])
    .map(
      (e) => `<tr>
        <td class="rank">${e.rank ?? '—'}</td>
        <td><a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a>${e.house ? ' <span class="house">house</span>' : ''}${e.baseline ? ' <span class="house">baseline</span>' : ''}</td>
        <td>${esc(e.title ?? '')}</td>
        ${columns.map((c) => `<td>${cell(c, e)}</td>`).join('')}
        <td>${esc(e.status ?? '')}</td>
      </tr>`,
    )
    .join('');
  return `<p class="crumbs"><a href="#/">All bounties</a> › <a href="#/bounty/${encodeURIComponent(slug)}">${esc(data.competition?.title ?? slug)}</a> › Leaderboard</p>
  <h1>Leaderboard</h1>
  <p class="lede">${esc(data.title ?? 'Results')}${data.phase?.title ? ` · ${esc(data.phase.title)}` : ''}${data.phase?.ends_at ? ` · ends ${date(data.phase.ends_at)} (<span data-deadline="${esc(data.phase.ends_at)}">${timeLeft(data.phase.ends_at)}</span>)` : ''}</p>
  ${data.entries?.length ? `<div class="tablewrap"><table class="lb">
    <thead><tr><th>#</th><th>Hunter</th><th>Entry</th>${head}<th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : '<p class="empty">No entries on the leaderboard yet.</p>'}
  <p class="more">Page ${page}${data.next_cursor ? ` <button type="button" id="more">Next 50 →</button>` : ' · end of the board'}</p>
  <p class="note">Scores are live; the rank column is ${esc(data.rank_key ?? 'the first column')}.</p>`;
}

/** An account's public profile: avatar, record, entries and payouts. */
export function profile(p) {
  const r = p.record ?? {};
  const avatar = p.image || `https://make.fun/api/profiles/${encodeURIComponent(p.handle)}/picture.png`;
  const solutions = (p.solutions ?? [])
    .map(
      (s) => `<li>
        <a href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.competition.title)}</a>
        <span>${esc(s.title ?? '')}</span>
        <span>${s.placement ? `Placed #${s.placement}` : 'Entered'}${s.prize_usd ? ` · won ${money(s.prize_usd)}` : ''} · ${date(s.entered_at)}</span>
      </li>`,
    )
    .join('');
  const payouts = (p.payouts ?? [])
    .map(
      (x) => `<li><a href="#/bounty/${encodeURIComponent(x.competition.slug)}">${esc(x.competition.title)}</a>
        <span>${money(x.amount_usd)} · #${x.place} · ${date(x.paid_at)}</span></li>`,
    )
    .join('');
  return `<div class="profile-head">
    <img class="avatar" src="${esc(avatar)}" alt="" crossorigin="anonymous" width="96" height="96" referrerpolicy="no-referrer">
    <div>
      <h1>@${esc(p.handle)}</h1>
      ${p.display_name ? `<p class="lede">${esc(p.display_name)}</p>` : ''}
      ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
      <p class="card-meta">Joined ${date(p.joined_at)}${p.github_login ? ` · GitHub @${esc(p.github_login)}` : ''}${p.wallet?.address ? ` · <a href="${esc(p.wallet.explorer_url ?? '')}">wallet</a>` : ''}</p>
    </div>
  </div>
  <dl class="facts">
    <dt>Entered</dt><dd>${r.competitions_entered ?? 0} competitions</dd>
    <dt>Placed</dt><dd>${r.competitions_placed ?? 0} · won ${r.competitions_won ?? 0}${r.podium_finishes ? ` · ${r.podium_finishes} podium` : ''}</dd>
    <dt>Best place</dt><dd>${r.best_placement ? `#${r.best_placement}` : '—'}</dd>
    <dt>Prize money</dt><dd>${money(r.prize_usd ?? 0)}</dd>
  </dl>
  <h2>Entries (${(p.solutions ?? []).length})</h2>
  ${solutions ? `<ul class="entries">${solutions}</ul>` : '<p class="empty">No entries yet.</p>'}
  <h2>Payouts (${(p.payouts ?? []).length})</h2>
  ${payouts ? `<ul class="entries">${payouts}</ul>` : '<p class="empty">No payouts yet.</p>'}`;
}

/** A failed view: what happened, and a retry that re-runs the same route. */
export function errorView(message) {
  return `<h1>Couldn’t load this page</h1>
  <p class="lede">${esc(message)}</p>
  <p><button type="button" id="retry">Try again</button> <a href="#/">Back to the board</a></p>`;
}
