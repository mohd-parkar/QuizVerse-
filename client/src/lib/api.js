const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

export function getAuthToken() {
  try {
    return localStorage.getItem('qv_token');
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem('qv_token', token);
    else localStorage.removeItem('qv_token');
  } catch {}
}

async function request(path, { method = 'GET', body } = {}) {
  const token = getAuthToken();
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${SERVER_URL}/api${path}`, {
    method,
    credentials: 'include',
    headers: Object.keys(headers).length ? headers : undefined,
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
