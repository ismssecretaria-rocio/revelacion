// ====== Configuración ======
const EQUIPOS = [
  { id: "bananines", nombre: "Los Bananines",           logo: "img/bananines.jpg" },
  { id: "pokemones", nombre: "Los Pokémones",           logo: "img/pokemones.jpg" },
  { id: "autitos",   nombre: "Los Súper Autitos Locos", logo: "img/autitos.jpg" },
  { id: "tubby",     nombre: "Los Tubby Papilla",       logo: "img/tubby.jpg" },
];

const PARTICIPANTES_INICIALES = {
  bananines: ["Vero", "Mati", "Ari", "Fran", "Pocha", "Damian", "Pauli", "Mica", "Mariano", "Ruben", "Oscar", "Martina", "Lean", "Ambar"],
  pokemones: ["Favio", "Octavio", "Maca", "Julio", "Alicia", "Noe", "Yani", "Gabi", "Marcela", "Lili", "Ana", "Oscar V", "Sofi", "Novio de martina"],
  autitos:   ["Papá Leo", "Bety", "Diego", "Patri", "Claudia", "Ricky", "Nora", "Lu", "Fede", "Rocio killer", "Killer", "German", "Maira", "Gasty"],
  tubby:     ["Mamá Ro", "Norma", "Marce", "Angie", "Nati", "Ro M", "Ani", "Blanquita", "Ro L", "Polo", "Elian", "Nacho", "Mili", "Guada"],
};

function participantesIniciales() {
  return Object.fromEntries(EQUIPOS.map(e => [e.id, [...(PARTICIPANTES_INICIALES[e.id] || [])]]));
}

const CLAVE_V1 = "revelacion-puntos-v1";
const CLAVE_V2 = "revelacion-datos-v2";

// ====== Modelo de datos ======
// datos = { juegos: [{nombre, puntos: {id: n}}], participantes: {id: [nombres]} }
let datos = cargar();

function datosVacios() {
  return {
    juegos: [
      { nombre: "Juego 1", puntos: puntosVacios() },
      { nombre: "Juego 2", puntos: puntosVacios() },
      { nombre: "Juego 3", puntos: puntosVacios() },
      { nombre: "Juego 4", puntos: puntosVacios() },
    ],
    participantes: participantesIniciales(),
  };
}

function puntosVacios() {
  return Object.fromEntries(EQUIPOS.map(e => [e.id, 0]));
}

function cargar() {
  // Intentar v2
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_V2));
    if (guardado && Array.isArray(guardado.juegos)) {
      // Asegurar que participantes exista
      // Sin participantes guardados: usar la lista inicial
      const sinParticipantes = !guardado.participantes ||
        EQUIPOS.every(e => !(guardado.participantes[e.id] || []).length);
      if (sinParticipantes) guardado.participantes = participantesIniciales();
      // Asegurar que todos los equipos tengan entrada en participantes
      EQUIPOS.forEach(e => {
        if (!guardado.participantes[e.id]) guardado.participantes[e.id] = [];
      });
      // Asegurar que cada juego tenga puntos para todos los equipos
      guardado.juegos.forEach(j => {
        EQUIPOS.forEach(e => {
          if (typeof j.puntos[e.id] !== "number") j.puntos[e.id] = 0;
        });
      });
      return guardado;
    }
  } catch (_) {}

  // Migrar desde v1
  try {
    const v1 = JSON.parse(localStorage.getItem(CLAVE_V1));
    if (Array.isArray(v1)) {
      const juegosNombres = ["Juego 1", "Juego 2", "Juego 3", "Juego 4"];
      const juegos = juegosNombres.map((nombre, i) => ({
        nombre,
        puntos: Object.fromEntries(EQUIPOS.map(e => [e.id, Number(v1[i]?.[e.id]) || 0])),
      }));
      const migrado = {
        juegos,
        participantes: participantesIniciales(),
      };
      localStorage.setItem(CLAVE_V2, JSON.stringify(migrado));
      return migrado;
    }
  } catch (_) {}

  return datosVacios();
}

function guardar() {
  try { localStorage.setItem(CLAVE_V2, JSON.stringify(datos)); } catch (_) {}
}

// ====== Navegación ======
let vistaActual = "tablero";

function navegarA(vista) {
  vistaActual = vista;
  document.getElementById("vista-tablero").classList.toggle("vista-oculta", vista !== "tablero");
  document.getElementById("vista-participantes").classList.toggle("vista-oculta", vista !== "participantes");
  document.querySelectorAll(".nav-link[data-vista]").forEach(el => {
    el.classList.toggle("activo", el.dataset.vista === vista);
  });
  cerrarSidebar();
}

function toggleSidebar() {
  document.querySelector(".sidebar").classList.toggle("abierto");
  document.querySelector(".sidebar-overlay").classList.toggle("visible");
}

function cerrarSidebar() {
  document.querySelector(".sidebar").classList.remove("abierto");
  document.querySelector(".sidebar-overlay").classList.remove("visible");
}

// ====== Render Tablero ======
const filaEquipos = document.getElementById("fila-equipos");
const cuerpo = document.getElementById("cuerpo-juegos");
const filaTotales = document.getElementById("fila-totales");
const podio = document.getElementById("podio");

function armarTablero() {
  // Cabecera
  filaEquipos.innerHTML = `<th class="esquina">Juegos</th>` + EQUIPOS.map(e => `
    <th data-equipo="${e.id}">
      <div class="equipo">
        <img src="${e.logo}" alt="${e.nombre}">
        <span class="nombre">${e.nombre}</span>
      </div>
    </th>`).join("");

  // Filas de juegos
  cuerpo.innerHTML = datos.juegos.map((juego, i) => `
    <tr data-juego-idx="${i}">
      <th scope="row" class="celda-nombre-juego">
        <span class="nombre-juego" contenteditable="true" data-juego-idx="${i}">${juego.nombre}</span>
        <button class="btn-eliminar-juego" data-juego-idx="${i}" title="Eliminar juego" aria-label="Eliminar juego">×</button>
      </th>
      ${EQUIPOS.map(e => `
        <td>
          <div class="celda-puntos">
            <button class="paso menos" data-juego="${i}" data-equipo="${e.id}" data-delta="-1" aria-label="Restar punto">−</button>
            <input type="number" inputmode="numeric" data-juego="${i}" data-equipo="${e.id}" value="${juego.puntos[e.id]}">
            <button class="paso mas" data-juego="${i}" data-equipo="${e.id}" data-delta="1" aria-label="Sumar punto">+</button>
          </div>
        </td>`).join("")}
    </tr>`).join("");

  // Totales
  filaTotales.innerHTML = `<th>Total</th>` + EQUIPOS.map(e =>
    `<td><span class="total" id="total-${e.id}">0</span></td>`).join("");

  actualizarResultados(false);
}

function calcularTotales() {
  return EQUIPOS.map(e => ({
    ...e,
    total: datos.juegos.reduce((suma, j) => suma + (j.puntos[e.id] || 0), 0),
  }));
}

function actualizarResultados(animar = true, equipoCambiado = null) {
  const totales = calcularTotales();
  const maximo = Math.max(...totales.map(t => t.total));
  const hayPuntos = maximo > 0;

  totales.forEach(t => {
    const el = document.getElementById(`total-${t.id}`);
    if (!el) return;
    el.textContent = t.total;
    const esLider = hayPuntos && t.total === maximo;
    el.classList.toggle("lider", esLider);
    filaEquipos.querySelector(`[data-equipo="${t.id}"]`).classList.toggle("col-lider", esLider);
    if (animar && t.id === equipoCambiado) {
      el.classList.remove("salto");
      void el.offsetWidth;
      el.classList.add("salto");
    }
  });

  armarPodio(totales, hayPuntos);
}

function armarPodio(totales, hayPuntos) {
  if (!hayPuntos) { podio.innerHTML = ""; return; }
  const ordenados = [...totales].sort((a, b) => b.total - a.total);

  let pos = 0;
  const conPos = ordenados.map((t, i) => {
    if (i === 0 || t.total !== ordenados[i - 1].total) pos = i + 1;
    return { ...t, pos };
  });

  podio.innerHTML = conPos.map(t => `
    <div class="puesto p${t.pos}">
      <div class="pos">${t.pos}°</div>
      <img src="${t.logo}" alt="">
      <div class="nombre">${t.nombre}</div>
      <div class="pts">${t.total} pts</div>
    </div>`).join("");
}

// ====== CRUD Juegos ======
function agregarJuego() {
  const num = datos.juegos.length + 1;
  datos.juegos.push({ nombre: `Juego ${num}`, puntos: puntosVacios() });
  guardar();
  armarTablero();
}

function eliminarJuego(idx) {
  if (datos.juegos.length <= 1) return;
  const juego = datos.juegos[idx];
  const tienePuntos = EQUIPOS.some(e => juego.puntos[e.id] !== 0);
  if (tienePuntos && !confirm(`"${juego.nombre}" tiene puntos cargados. ¿Eliminar?`)) return;
  datos.juegos.splice(idx, 1);
  guardar();
  armarTablero();
}

function renombrarJuego(idx, nuevoNombre) {
  const nombre = nuevoNombre.trim();
  if (!nombre) {
    // Restaurar nombre anterior
    armarTablero();
    return;
  }
  datos.juegos[idx].nombre = nombre;
  guardar();
}

// ====== Render Participantes ======
function armarParticipantes() {
  const contenedor = document.getElementById("grid-participantes");
  if (!contenedor) return;

  contenedor.innerHTML = EQUIPOS.map(e => {
    const lista = datos.participantes[e.id] || [];
    return `
    <div class="card-equipo" data-equipo="${e.id}">
      <div class="card-equipo-header">
        <img src="${e.logo}" alt="${e.nombre}">
        <h3>${e.nombre}</h3>
      </div>
      <div class="card-equipo-agregar">
        <input type="text" placeholder="Nombre..." data-equipo="${e.id}" class="input-participante">
        <button class="btn-agregar-participante" data-equipo="${e.id}" aria-label="Agregar participante">+</button>
      </div>
      <ol class="lista-participantes" data-equipo="${e.id}">
        ${lista.map((nombre, i) => `
          <li>
            <span class="participante-nombre">${nombre}</span>
            <div class="participante-acciones">
              <button class="btn-mover" data-dir="-1" data-equipo="${e.id}" data-idx="${i}" title="Subir" ${i === 0 ? "disabled" : ""}>▲</button>
              <button class="btn-mover" data-dir="1" data-equipo="${e.id}" data-idx="${i}" title="Bajar" ${i === lista.length - 1 ? "disabled" : ""}>▼</button>
              <button class="btn-transferir" data-equipo="${e.id}" data-idx="${i}" title="Cambiar de equipo">⇄</button>
              <button class="btn-eliminar-participante" data-equipo="${e.id}" data-idx="${i}" title="Eliminar">×</button>
            </div>
          </li>`).join("")}
      </ol>
    </div>`;
  }).join("");
}

function agregarParticipante(equipoId, nombre) {
  const n = nombre.trim();
  if (!n) return;
  if (!datos.participantes[equipoId]) datos.participantes[equipoId] = [];
  datos.participantes[equipoId].push(n);
  guardar();
  armarParticipantes();
}

function eliminarParticipante(equipoId, idx) {
  datos.participantes[equipoId].splice(idx, 1);
  guardar();
  armarParticipantes();
}

function moverParticipante(equipoId, idx, dir) {
  const lista = datos.participantes[equipoId];
  const nuevoIdx = idx + dir;
  if (nuevoIdx < 0 || nuevoIdx >= lista.length) return;
  [lista[idx], lista[nuevoIdx]] = [lista[nuevoIdx], lista[idx]];
  guardar();
  armarParticipantes();
}

function transferirParticipante(origenId, idx, destinoId) {
  const nombre = datos.participantes[origenId].splice(idx, 1)[0];
  if (!datos.participantes[destinoId]) datos.participantes[destinoId] = [];
  datos.participantes[destinoId].push(nombre);
  guardar();
  cerrarTransferPopover();
  armarParticipantes();
}

// ====== Transfer popover ======
let transferPopoverAbierto = null; // {equipoId, idx} o null

function abrirTransferPopover(btn, equipoId, idx) {
  cerrarTransferPopover();
  const li = btn.closest("li");
  const popover = document.createElement("div");
  popover.className = "transfer-popover";
  popover.innerHTML = EQUIPOS
    .filter(e => e.id !== equipoId)
    .map(e => `
      <button class="transfer-opcion" data-destino="${e.id}">
        <img src="${e.logo}" alt="${e.nombre}">
        <span>${e.nombre}</span>
      </button>`).join("");

  popover.addEventListener("click", ev => {
    const opcion = ev.target.closest(".transfer-opcion");
    if (!opcion) return;
    transferirParticipante(equipoId, idx, opcion.dataset.destino);
  });

  li.appendChild(popover);
  transferPopoverAbierto = popover;

  // Cerrar al hacer click fuera
  setTimeout(() => {
    document.addEventListener("click", cerrarTransferSiClickFuera, { once: true, capture: true });
  }, 0);
}

function cerrarTransferSiClickFuera(ev) {
  if (transferPopoverAbierto && !transferPopoverAbierto.contains(ev.target)) {
    cerrarTransferPopover();
  } else if (transferPopoverAbierto) {
    // Todavía está abierto, re-escuchar
    setTimeout(() => {
      document.addEventListener("click", cerrarTransferSiClickFuera, { once: true, capture: true });
    }, 0);
  }
}

function cerrarTransferPopover() {
  if (transferPopoverAbierto) {
    transferPopoverAbierto.remove();
    transferPopoverAbierto = null;
  }
}

// ====== Eventos: Puntos ======
function setPuntos(i, id, valor) {
  datos.juegos[i].puntos[id] = Number.isFinite(valor) ? valor : 0;
  guardar();
  actualizarResultados(true, id);
}

cuerpo.addEventListener("input", ev => {
  const inp = ev.target;
  if (inp.tagName !== "INPUT") return;
  setPuntos(Number(inp.dataset.juego), inp.dataset.equipo, parseInt(inp.value, 10));
});

cuerpo.addEventListener("click", ev => {
  const btn = ev.target.closest(".paso");
  if (!btn) return;
  const i = Number(btn.dataset.juego);
  const id = btn.dataset.equipo;
  const nuevo = (datos.juegos[i].puntos[id] || 0) + Number(btn.dataset.delta);
  const inp = cuerpo.querySelector(`input[data-juego="${i}"][data-equipo="${id}"]`);
  inp.value = nuevo;
  setPuntos(i, id, nuevo);
});

cuerpo.addEventListener("focusin", ev => {
  if (ev.target.tagName === "INPUT") ev.target.select();
});

// ====== Eventos: Nombres de juegos ======
cuerpo.addEventListener("blur", ev => {
  if (ev.target.classList.contains("nombre-juego")) {
    renombrarJuego(Number(ev.target.dataset.juegoIdx), ev.target.textContent);
  }
}, true);

cuerpo.addEventListener("keydown", ev => {
  if (ev.target.classList.contains("nombre-juego") && ev.key === "Enter") {
    ev.preventDefault();
    ev.target.blur();
  }
});

// ====== Eventos: Eliminar juego ======
cuerpo.addEventListener("click", ev => {
  const btn = ev.target.closest(".btn-eliminar-juego");
  if (!btn) return;
  eliminarJuego(Number(btn.dataset.juegoIdx));
});

// ====== Eventos: Agregar juego ======
document.getElementById("btn-agregar-juego").addEventListener("click", agregarJuego);

// ====== Eventos: Reiniciar ======
document.getElementById("btn-reiniciar").addEventListener("click", () => {
  if (!confirm("¿Seguro que querés borrar todos los puntos?")) return;
  datos.juegos.forEach(j => {
    EQUIPOS.forEach(e => { j.puntos[e.id] = 0; });
  });
  guardar();
  armarTablero();
});

// ====== Eventos: Sidebar ======
document.getElementById("btn-hamburguesa").addEventListener("click", toggleSidebar);
document.querySelector(".sidebar-overlay").addEventListener("click", cerrarSidebar);

document.querySelectorAll(".nav-link[data-vista]").forEach(el => {
  el.addEventListener("click", ev => {
    ev.preventDefault();
    navegarA(el.dataset.vista);
  });
});

// ====== Eventos: Participantes ======
document.getElementById("vista-participantes").addEventListener("click", ev => {
  const btnAgregar = ev.target.closest(".btn-agregar-participante");
  if (btnAgregar) {
    const equipoId = btnAgregar.dataset.equipo;
    const input = document.querySelector(`.input-participante[data-equipo="${equipoId}"]`);
    agregarParticipante(equipoId, input.value);
    input.value = "";
    input.focus();
    return;
  }

  const btnEliminar = ev.target.closest(".btn-eliminar-participante");
  if (btnEliminar) {
    eliminarParticipante(btnEliminar.dataset.equipo, Number(btnEliminar.dataset.idx));
    return;
  }

  const btnMover = ev.target.closest(".btn-mover");
  if (btnMover) {
    moverParticipante(btnMover.dataset.equipo, Number(btnMover.dataset.idx), Number(btnMover.dataset.dir));
    return;
  }

  const btnTransferir = ev.target.closest(".btn-transferir");
  if (btnTransferir) {
    ev.stopPropagation();
    abrirTransferPopover(btnTransferir, btnTransferir.dataset.equipo, Number(btnTransferir.dataset.idx));
    return;
  }
});

document.getElementById("vista-participantes").addEventListener("keydown", ev => {
  if (ev.target.classList.contains("input-participante") && ev.key === "Enter") {
    const equipoId = ev.target.dataset.equipo;
    agregarParticipante(equipoId, ev.target.value);
    ev.target.value = "";
  }
});

// ====== Login ======
const CLAVE_SESION = "revelacion-sesion";
const CREDENCIAL = "copadrejos";

document.getElementById("form-login").addEventListener("submit", ev => {
  ev.preventDefault();
  const usuario = document.getElementById("login-usuario");
  const clave = document.getElementById("login-clave");
  const error = document.getElementById("login-error");
  const card = ev.target;

  if (usuario.value.trim() === CREDENCIAL && clave.value === CREDENCIAL) {
    try { sessionStorage.setItem(CLAVE_SESION, "ok"); } catch (_) {}
    error.textContent = "";
    usuario.value = "";
    clave.value = "";
    document.documentElement.classList.add("autenticado");
  } else {
    error.textContent = "Usuario o contraseña incorrectos";
    clave.value = "";
    clave.focus();
    card.classList.remove("sacudir");
    void card.offsetWidth;
    card.classList.add("sacudir");
  }
});

document.getElementById("btn-cerrar-sesion").addEventListener("click", ev => {
  ev.preventDefault();
  ev.stopImmediatePropagation();
  try { sessionStorage.removeItem(CLAVE_SESION); } catch (_) {}
  cerrarSidebar();
  document.documentElement.classList.remove("autenticado");
  document.getElementById("login-usuario").focus();
});

// ====== Inicialización ======
armarTablero();
armarParticipantes();
navegarA("tablero");
