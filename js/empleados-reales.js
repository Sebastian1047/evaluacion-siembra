// El navegador consulta el proxy local, que a su vez accede a la API corporativa.
const EMPLEADOS_API_URL = "/api/empleados";

function actualizarEmpleadosDisponibles(empleados) {
  const actuales = new Set((state.people || []).map((persona) => String(persona.doc)));

  const empleadosValidos = empleados
    .map((empleado) => ({
      codigo: String(empleado.codigo || "").trim(),
      nombre: String(empleado.nombre || "")
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .trim(),
      area: empleado.area,
    }))
    .filter((empleado) => empleado.codigo && empleado.nombre);

  state.available = empleadosValidos
    .filter((empleado) => !actuales.has(empleado.codigo))
    .map((empleado) => ({
      id: `emp-${empleado.codigo}`,
      name: empleado.nombre,
      doc: empleado.codigo,
      area: empleado.area,
    }));

  return {
    total: empleadosValidos.length,
    disponibles: state.available.length,
  };
}

async function cargarEmpleadosDesdeApi() {
  const respuesta = await fetch(EMPLEADOS_API_URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!respuesta.ok) {
    throw new Error(`La API respondió con HTTP ${respuesta.status}`);
  }

  const empleados = await respuesta.json();
  if (!Array.isArray(empleados)) {
    throw new Error("La API no devolvió una lista de empleados");
  }

  return actualizarEmpleadosDisponibles(empleados);
}

function mostrarEstadoDeEmpleados(mensaje, permitirReintento = false) {
  const contenedor = document.querySelector("#avail");
  if (!contenedor) return;

  contenedor.innerHTML = `<div class="card muted">${mensaje}${
    permitirReintento
      ? '<br><br><button class="btn secondary" onclick="addPerson()">Reintentar</button>'
      : ""
  }</div>`;
}

const mostrarPantallaAgregar = addPerson;
addPerson = function () {
  state.available = [];
  mostrarPantallaAgregar();
  mostrarEstadoDeEmpleados("Consultando empleados en la fuente corporativa...");

  cargarEmpleadosDesdeApi()
    .then(({ disponibles }) => {
      if (state.view !== "agregar") return;
      mostrarPantallaAgregar();
      const contador = document.querySelector("#available-count");
      if (contador) {
        contador.textContent = `${disponibles} personas disponibles para agregar`;
      }
      toast("Lista de empleados actualizada");
    })
    .catch((error) => {
      console.error("No fue posible consultar la API de empleados:", error);
      if (state.view !== "agregar") return;
      mostrarEstadoDeEmpleados("No fue posible consultar los empleados.", true);
      toast("Error consultando la fuente corporativa");
    });
};

if (state.view === "agregar") {
  addPerson();
}
