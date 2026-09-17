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

  async function getLatestWeek() {
    return request('/api/semanas/ultima');
  }

  async function getWeek(year, number) {
    return request(`/api/semanas/${year}/${number}`);
  }

  async function ensureWeek({ anio, numero, inicio, fin }) {
    return request('/api/semanas/asegurar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anio, numero, inicio, fin })
    });
  }

  async function getParticipants(semanaId) {
    return request(`/api/semanas/${semanaId}/participantes`);
  }

  async function getOperationalState(semanaId) {
    return request(`/api/semanas/${semanaId}/estado-operativo`);
  }

  async function addParticipant(semanaId, { sembradorId, turnoInicio }) {
    return request(`/api/semanas/${semanaId}/participantes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sembradorId, turnoInicio })
    });
  }

  async function changeParticipantState(participacionId, estado) {
    return request(`/api/participaciones/${participacionId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    });
  }

  async function resolveTurn(participacionId, turno, { tipo, incumplimientos = [], usuarioCorporativoId }) {
    return request(`/api/participaciones/${participacionId}/turnos/${turno}/resolver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, incumplimientos, usuarioCorporativoId })
    });
  }

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

      // Conservamos el código usado por la UI y además guardamos el IdItem real
      // para que una evaluación pueda persistir sus incumplimientos en Azure.
      window.SiembraAzureItemIds = Object.fromEntries(activeItems.map(item => [String(item.codigo), Number(item.id)]));
      seed.criteria = activeItems.map(item => [
        item.codigo,
        item.nombre,
        Boolean(item.esCritico)
      ]);

      window.SiembraCriteriaSource = 'azure';
      return seed.criteria;
    } catch (error) {
      seed.criteria = localFallback;
      window.SiembraAzureItemIds = {};
      window.SiembraCriteriaSource = 'local-fallback';
      console.warn('No fue posible cargar los ítems desde Azure; se usan los criterios locales.', error);
      return seed.criteria;
    }
  }

  window.SiembraApi = Object.freeze({
    baseUrl: API_BASE_URL,
    getItems,
    getLatestWeek,
    getWeek,
    ensureWeek,
    getParticipants,
    getOperationalState,
    addParticipant,
    changeParticipantState,
    resolveTurn,
    loadCriteriaIntoSeed
  });
})();