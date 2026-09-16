// Punto único de comunicación entre el frontend y el backend de Evaluación de Siembra.
// Por ahora este módulo es aditivo: ninguna pantalla depende todavía de él.
(function () {
  const API_BASE_URL = 'https://evaluacion-siembra-api-dev-gcfcawa0fmfgdcas.centralus-01.azurewebsites.net';

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body.detail || body.error || '';
      } catch (_) {
        // La respuesta puede no ser JSON.
      }
      throw new Error(detail || `Error HTTP ${response.status}`);
    }

    return response.json();
  }

  async function getItems() {
    return request('/api/items');
  }

  window.SiembraApi = Object.freeze({
    baseUrl: API_BASE_URL,
    getItems
  });
})();
