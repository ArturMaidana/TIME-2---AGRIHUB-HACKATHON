export async function api(path, options = {}, token) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await response.json();
  if (response.status === 401 && token) {
    localStorage.removeItem('agri-auth');
    location.reload();
    throw new Error('Sessão expirada');
  }
  if (!response.ok) throw new Error(data.error);
  return data;
}
