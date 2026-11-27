const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const getToken = () => localStorage.getItem('token');
// One function for every request. Throws Error(message) using the API's error message.
export async function api(path, { method = 'GET', body, form, turnstile } = {}) {
 const headers = {};
 if (getToken()) headers.Authorization = 'Bearer ' + getToken();
 if (turnstile) headers['X-Turnstile-Token'] = turnstile;
 let payload;
 if (form) payload = form; // FormData: the browser sets the content type
 else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
 let r;
 try { r = await fetch(BASE + path, { method, headers, body: payload }); }
 catch { throw new Error('Cannot reach the server. Is the API running?'); }
 if (r.status === 204) return null;
 const data = (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.blob();
 if (!r.ok) throw new Error((data && data.error && data.error.message) || `Request failed (${r.status})`);
 return data;
}
// Downloads need the Authorization header, so fetch a blob and click a temporary link.
export async function download(path, fileName) {
 const blob = await api(path);
 const a = document.createElement('a');
 a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
 URL.revokeObjectURL(a.href);
}
