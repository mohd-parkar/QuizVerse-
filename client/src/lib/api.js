const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${SERVER_URL}/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
