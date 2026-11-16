// A make.fun frontend: the board, a bounty's page, its leaderboard and a public
// profile, on hash routes — so every surface has its own link and its own URL:
//
//   #/                          the bounty board
//   #/bounty/<slug>             one bounty's page
//   #/bounty/<slug>/leaderboard that bounty's leaderboard
//   #/u/<handle>                an account's public profile
//
// window.__shotReady is false while a page loads and true once its data is on
// screen, so a screenshot script knows when to capture. A view costs one API
// request (the board pages in 50 at a time, the leaderboard too); going back to
// a view you just saw costs none, thanks to the cache in api.js. The countdowns
// tick in place every 30 s: the page is never rebuilt just to move a clock.

import { getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { timeLeft } from './format.js';
import { board, bounty, errorView, leaderboard, profile } from './views.js';

const app = document.getElementById('app');
const search = document.getElementById('q');

// The board's loaded items and its filter, kept across route changes so the
// list is re-filtered in place and "Show more" only fetches the next page.
const boardState = { items: [], cursor: null, filter: 'open', sort: 'deadline', query: '' };

function show(html) {
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

function fail(err) {
  show(errorView(err instanceof Error ? err.message : 'Something went wrong.'));
  document.getElementById('retry')?.addEventListener('click', render);
  window.__shotReady = true;
}

/** The board: first page on arrival, more pages on "Show more", filter in place. */
async function renderBoard() {
  if (!boardState.items.length) {
    const data = await getBounties();
    boardState.items = data.items ?? [];
    boardState.cursor = data.next_cursor ?? null;
  }
  show(board(boardState));
  wireBoard();
  window.__shotReady = true;
}

function wireBoard() {
  document.querySelectorAll('[data-filter]').forEach((btn) =>
    btn.addEventListener('click', () => {
      boardState.filter = btn.dataset.filter;
      show(board(boardState));
      wireBoard();
    }),
  );
  document.getElementById('sort')?.addEventListener('change', (e) => {
    boardState.sort = e.target.value;
    show(board(boardState));
    wireBoard();
  });
  document.getElementById('more')?.addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Loading…';
    try {
      const data = await getBounties(boardState.cursor);
      boardState.items.push(...(data.items ?? []));
      boardState.cursor = data.next_cursor ?? null;
      show(board(boardState));
      wireBoard();
    } catch {
      btn.disabled = false;
      btn.textContent = 'Show more bounties';
    }
  });
}

/** One bounty's page. */
async function renderBounty(slug) {
  const b = await getBounty(slug);
  document.title = `${b.title} | make.fun board`;
  show(bounty(b));
  window.__shotReady = true;
}

/** One bounty's leaderboard, paged 50 at a time. */
async function renderLeaderboard(slug) {
  const data = await getLeaderboard(slug);
  document.title = `Leaderboard · ${data.competition?.title ?? slug} | make.fun board`;
  showLeaderboardPage(slug, data, 1);
  window.__shotReady = true;
}

function showLeaderboardPage(slug, data, page) {
  show(leaderboard(slug, data, page));
  const next = document.getElementById('more');
  if (next) {
    next.addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'Loading…';
      try {
        const nextPage = await getLeaderboard(slug, data.next_cursor);
        showLeaderboardPage(slug, nextPage, page + 1);
      } catch {
        btn.disabled = false;
        btn.textContent = 'Next 50 →';
      }
    });
  }
}

/** One account's public profile. */
async function renderProfile(handle) {
  const p = await getProfile(handle);
  document.title = `@${p.handle} | make.fun board`;
  show(profile(p));
  window.__shotReady = true;
}

async function render() {
  window.__shotReady = false;
  const hash = location.hash || '#/';
  try {
    let m;
    if ((m = hash.match(/^#\/bounty\/([^/]+)\/leaderboard$/))) {
      await renderLeaderboard(decodeURIComponent(m[1]));
    } else if ((m = hash.match(/^#\/bounty\/([^/]+)$/))) {
      await renderBounty(decodeURIComponent(m[1]));
    } else if ((m = hash.match(/^#\/u\/([^/]+)$/))) {
      await renderProfile(decodeURIComponent(m[1]));
    } else {
      document.title = 'make.fun bounties — live board';
      await renderBoard();
    }
  } catch (err) {
    fail(err);
  }
}

// The header search filters the board in place; typing on another surface jumps
// to the board with the query applied.
search.addEventListener('input', () => {
  boardState.query = search.value.trim();
  if ((location.hash || '#/') === '#/') {
    show(board(boardState));
    wireBoard();
  } else if (boardState.query) {
    location.hash = '#/';
  }
});

// Countdowns tick in place: only the time-left nodes change, the page is not rebuilt.
setInterval(() => {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    const left = timeLeft(el.dataset.deadline);
    if (el.childNodes.length === 1) el.textContent = left;
  });
}, 30000);

window.addEventListener('hashchange', render);
render();
