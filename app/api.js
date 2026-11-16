// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// Every answer is cached two ways, so a view costs as few requests as possible:
//   1. an in-memory cache (60 s) — going back to a view you just saw refetches nothing;
//   2. ETag revalidation — after the minute turns, a request sends If-None-Match and a
//      304 answer reuses the stored body, which the API counts as free.
// Bodies and tags live in sessionStorage, so a reload still revalidates instead of
// downloading the same list again.

const API = 'https://make.fun/api';
const TTL_MS = 60_000;

const memory = new Map(); // path -> { at, data }

function readStore(path) {
  try {
    const raw = sessionStorage.getItem('mf:' + path);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStore(path, etag, data) {
  try {
    sessionStorage.setItem('mf:' + path, JSON.stringify({ etag, data }));
  } catch {
    // Storage full or unavailable: the in-memory cache still works.
  }
}

/** GET one API path, returning its parsed JSON (cached or revalidated). */
export async function get(path) {
  const hit = memory.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const stored = readStore(path);
  const headers = {};
  if (stored?.etag) headers['If-None-Match'] = stored.etag;
  const res = await fetch(API + path, { headers });
  if (res.status === 304 && stored) {
    memory.set(path, { at: Date.now(), data: stored.data });
    return stored.data;
  }
  if (!res.ok) throw new Error(`make.fun answered ${res.status} for ${path}`);
  const data = await res.json();
  const etag = res.headers.get('ETag');
  if (etag) writeStore(path, etag, data);
  memory.set(path, { at: Date.now(), data });
  return data;
}

/** The open bounties, one page (activity=times leaves out the activity a board does not show). */
export const getBounties = (cursor) =>
  get('/competitions?status=open&activity=times&limit=50' + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''));

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** One bounty's leaderboard, one page (limit=50, cursor for the next page). */
export const getLeaderboard = (slug, cursor) =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard?limit=50` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''));

/** One account's public profile, by its handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
