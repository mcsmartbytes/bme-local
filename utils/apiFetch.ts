const ENTITY_STORAGE_KEY = 'bme_selected_entity_id';

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let finalUrl = url;
  if (typeof window !== 'undefined') {
    const entityId = localStorage.getItem(ENTITY_STORAGE_KEY);
    if (entityId && entityId !== 'all' && !url.includes('entity_id=')) {
      const separator = url.includes('?') ? '&' : '?';
      finalUrl = `${url}${separator}entity_id=${entityId}`;
    }
  }

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(finalUrl, { ...options, headers, credentials: 'include' });
}