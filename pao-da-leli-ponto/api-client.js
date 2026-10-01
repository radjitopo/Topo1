async function leliApi(endpoint, action, method = 'GET', data) {
  const params = new URLSearchParams({ action });
  const options = { method, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
  if (method === 'GET' && data) {
    for (const [key, value] of Object.entries(data)) params.set(key, String(value));
  } else if (data !== undefined) options.body = JSON.stringify(data);

  const canRetry = method === 'GET';
  const attempts = canRetry ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(endpoint + '?' + params.toString(), { ...options, signal: controller.signal });
      if (canRetry && attempt === 0 && [502, 503, 504].includes(response.status)) {
        await new Promise(resolve => setTimeout(resolve, 400));
        continue;
      }
      let result;
      try { result = await response.json(); }
      catch (cause) {
        if (cause.name !== 'SyntaxError') throw cause;
        const error = new Error('O servidor não conseguiu responder. Tente novamente em instantes.');
        error.status = response.status;
        throw error;
      }
      if (!response.ok) {
        const error = new Error(result?.error || 'Não foi possível concluir a operação.');
        error.status = response.status;
        error.data = result;
        throw error;
      }
      return result;
    } catch (cause) {
      if (cause.status !== undefined || !['TypeError', 'AbortError'].includes(cause.name)) throw cause;
      if (canRetry && attempt === 0 && navigator.onLine !== false) {
        await new Promise(resolve => setTimeout(resolve, 400));
        continue;
      }
      const login = action === 'admin-login' || action === 'employee-login';
      const error = new Error(method === 'GET' || login
        ? 'Não foi possível conectar ao servidor. Confira sua internet e tente novamente.'
        : 'Não foi possível confirmar a operação. Confira sua conexão e consulte o resultado antes de tentar novamente.');
      error.code = cause.name === 'AbortError' ? 'TIMEOUT' : 'CONNECTION';
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
