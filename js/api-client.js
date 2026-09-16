// Punto único de comunicación entre el frontend y el backend de Evaluación de Siembra.
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

  // Carga los ítems reales desde Azure y los adapta al formato que el
  // prototipo ya usa: [codigo, nombre, esCritico]. Si Azure no responde,
  // se conservan los criterios locales de data.js para no romper la demo.
  async function loadCriteriaIntoSeed() {
    if (typeof seed === 'undefined' || !Array.isArray(seed.criteria)) {
      throw new Error('seed.criteria no está disponible');
    }

    const localFallback = seed.criteria.map(c => [...c]);

    try {
      const items = await getItems();
      const activeItems = Array.isArray(items)
        ? items.filter(item => item.activo !== false)
        : [];

      if (!activeItems.length) {
        throw new Error('La API no devolvió ítems activos');
      }

      seed.criteria = activeItems.map(item => [
        item.codigo,
        item.nombre,
        Boolean(item.esCritico)
      ]);

      window.SiembraCriteriaSource = 'azure';
      return seed.criteria;
    } catch (error) {
      seed.criteria = localFallback;
      window.SiembraCriteriaSource = 'local-fallback';
      console.warn('No fue posible cargar los ítems desde Azure; se usan los criterios locales.', error);
      return seed.criteria;
    }
  }

  window.SiembraApi = Object.freeze({
    baseUrl: API_BASE_URL,
    getItems,
    loadCriteriaIntoSeed
  });
})();
