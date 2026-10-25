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

const JUEGOS_INICIALES = ["Tatetí", "Misión mamadera", "Abri la boquita", "Operación ojota"];

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
    juegos: JUEGOS_INICIALES.map(nombre => ({ nombre, puntos: puntosVacios() })),
    participantes: participantesIniciales(),
  };
}

function puntosVacios() {
  return Object.fromEntries(EQUIPOS.map(e => [e.id, 0]));
}

// Completa y corrige datos guardados (localStorage o Firebase). Devuelve null si no sirven.
// Firebase puede devolver las listas como objetos y omite las listas vacías.
function normalizar(crudo, { rellenarParticipantes = false } = {}) {
  if (!crudo || typeof crudo !== "object" || !crudo.juegos) return null;
  const comoLista = v => Array.isArray(v) ? v.filter(x => x != null) : (v && typeof v === "object" ? Object.values(v) : []);

  const juegos = comoLista(crudo.juegos).map((j, i) => {
    let nombre = typeof j?.nombre === "string" && j.nombre ? j.nombre : `Juego ${i + 1}`;
    // Juegos con nombre por defecto ("Juego N"): usar el nombre inicial
    if (JUEGOS_INICIALES[i] && nombre === `Juego ${i + 1}`) nombre = JUEGOS_INICIALES[i];
    const puntos = Object.fromEntries(EQUIPOS.map(e => {
      const n = Number(j?.puntos?.[e.id]);
      return [e.id, Number.isFinite(n) ? n : 0];
    }));
    return { nombre, puntos };
  });
  if (!juegos.length) return null;

  let participantes = Object.fromEntries(EQUIPOS.map(e => [e.id, comoLista(crudo.participantes?.[e.id]).map(String)]));
  // Sin participantes guardados: usar la lista inicial
  if (rellenarParticipantes && EQUIPOS.every(e => !participantes[e.id].length)) {
    participantes = participantesIniciales();
  }
  return { juegos, participantes };
}

function cargar() {
  // Intentar v2
  try {
    const guardado = normalizar(JSON.parse(localStorage.getItem(CLAVE_V2)), { rellenarParticipantes: true });
    if (guardado) return guardado;
  } catch (_) {}

  // Migrar desde v1
  try {
    const v1 = JSON.parse(localStorage.getItem(CLAVE_V1));
    if (Array.isArray(v1)) {
      const juegos = JUEGOS_INICIALES.map((nombre, i) => ({
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

// ====== Sincronización entre celulares (Firebase Realtime Database) ======
// Todos los celulares leen y escriben el mismo nodo "tablero".
// Sin configuración en firebase-config.js, el tablero funciona solo en este navegador.
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/13.1.0";

const nube = {
  activa: false,
  db: null,
  fb: null, // funciones del SDK
  escribir(ruta, valor) {
    if (!this.activa) return;
    this.fb.set(this.fb.ref(this.db, `tablero/${ruta}`), valor).catch(errorNube);
  },
  sumar(ruta, delta) {
    if (!this.activa) return;
    this.fb.set(this.fb.ref(this.db, `tablero/${ruta}`), this.fb.increment(delta)).catch(errorNube);
  },
};

function errorNube(err) {
  console.error("Firebase:", err);
  mostrarEstadoNube("error");
}

function mostrarEstadoNube(estado) {
  const el = document.getElementById("estado-nube");
  if (!el) return;
  const textos = {
    conectado: "En vivo",
    desconectado: "Sin conexión",
    error: "Error al sincronizar",
  };
  el.hidden = false;
  el.dataset.estado = estado;
  el.querySelector(".estado-texto").textContent = textos[estado];
}

async function iniciarNube() {
  const config = window.FIREBASE_CONFIG;
  if (!config || !config.databaseURL) return;
  try {
    const [{ initializeApp }, fb] = await Promise.all([
      import(`${FIREBASE_SDK}/firebase-app.js`),
      import(`${FIREBASE_SDK}/firebase-database.js`),
    ]);
    nube.fb = fb;
    nube.db = fb.getDatabase(initializeApp(config));
    const refTablero = fb.ref(nube.db, "tablero");

    // Si la base está vacía, el primer celular sube sus datos
    await fb.runTransaction(refTablero, actual => (actual === null ? datos : undefined));

    nube.activa = true;
    fb.onValue(refTablero, snap => {
      const remoto = normalizar(snap.val());
      if (remoto) aplicarDatosRemotos(remoto);
    }, errorNube);

    fb.onValue(fb.ref(nube.db, ".info/connected"), snap => {
      mostrarEstadoNube(snap.val() ? "conectado" : "desconectado");
    });
  } catch (err) {
    errorNube(err);
  }
}

let tableroPendiente = false;

function aplicarDatosRemotos(remoto) {
  const anterior = datos;
  const totalesAntes = Object.fromEntries(calcularTotales().map(t => [t.id, t.total]));
  datos = remoto;
  guardar();

  // Tablero: si los juegos son los mismos, actualizar solo los números (no se pierde el foco)
  const mismosJuegos = remoto.juegos.length === anterior.juegos.length &&
    remoto.juegos.every((j, i) => j.nombre === anterior.juegos[i].nombre);
  if (mismosJuegos) {
    cuerpo.querySelectorAll("input[data-juego]").forEach(inp => {
      if (inp === document.activeElement) return;
      inp.value = datos.juegos[inp.dataset.juego].puntos[inp.dataset.equipo];
    });
    const cambiados = calcularTotales().filter(t => t.total !== totalesAntes[t.id]).map(t => t.id);
    actualizarResultados(cambiados.length > 0, cambiados);
  } else if (document.activeElement?.classList.contains("nombre-juego")) {
    tableroPendiente = true; // se rearma cuando termine de editar el nombre
  } else {
    armarTablero();
  }

  if (JSON.stringify(remoto.participantes) !== JSON.stringify(anterior.participantes)) {
    rearmarParticipantesConservandoTexto();
  }
}

// Rearma la vista de participantes sin borrar lo que alguien está escribiendo
function rearmarParticipantesConservandoTexto() {
  const textos = {};
  document.querySelectorAll(".input-participante").forEach(inp => { textos[inp.dataset.equipo] = inp.value; });
  const enfocado = document.activeElement?.classList.contains("input-participante")
    ? document.activeElement.dataset.equipo : null;

  cerrarTransferPopover();
  armarParticipantes();

  document.querySelectorAll(".input-participante").forEach(inp => {
    if (textos[inp.dataset.equipo]) inp.value = textos[inp.dataset.equipo];
    if (inp.dataset.equipo === enfocado) inp.focus();
  });
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
  const abierto = document.querySelector(".sidebar").classList.toggle("abierto");
  document.querySelector(".sidebar-overlay").classList.toggle("visible", abierto);
  const btn = document.getElementById("btn-hamburguesa");
  btn.classList.toggle("abierto", abierto);
  btn.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
}

function cerrarSidebar() {
  document.querySelector(".sidebar").classList.remove("abierto");
  document.querySelector(".sidebar-overlay").classList.remove("visible");
  const btn = document.getElementById("btn-hamburguesa");
  btn.classList.remove("abierto");
  btn.setAttribute("aria-label", "Abrir menú");
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
          ${equipoMovil(e)}
          <div class="celda-puntos">
            <button class="paso menos" data-juego="${i}" data-equipo="${e.id}" data-delta="-1" aria-label="Restar punto">−</button>
            <input type="number" inputmode="numeric" data-juego="${i}" data-equipo="${e.id}" value="${juego.puntos[e.id]}">
            <button class="paso mas" data-juego="${i}" data-equipo="${e.id}" data-delta="1" aria-label="Sumar punto">+</button>
          </div>
        </td>`).join("")}
    </tr>`).join("");

  // Totales
  filaTotales.innerHTML = `<th>Total</th>` + EQUIPOS.map(e =>
    `<td>${equipoMovil(e)}<span class="total" id="total-${e.id}">0</span></td>`).join("");

  actualizarResultados(false);
}

// Etiqueta de equipo dentro de cada celda (solo visible en celulares)
function equipoMovil(e) {
  return `<span class="equipo-movil" aria-hidden="true"><img src="${e.logo}" alt=""><span>${e.nombre}</span></span>`;
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
    if (animar && [].concat(equipoCambiado).includes(t.id)) {
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
  // Subir solo el juego nuevo, para no pisar puntos que otro celular acaba de cargar
  nube.escribir(`juegos/${num - 1}`, datos.juegos[num - 1]);
  armarTablero();
}

function eliminarJuego(idx) {
  if (datos.juegos.length <= 1) return;
  const juego = datos.juegos[idx];
  const tienePuntos = EQUIPOS.some(e => juego.puntos[e.id] !== 0);
  if (tienePuntos && !confirm(`"${juego.nombre}" tiene puntos cargados. ¿Eliminar?`)) return;
  datos.juegos.splice(idx, 1);
  guardar();
  nube.escribir("juegos", datos.juegos);
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
  nube.escribir(`juegos/${idx}/nombre`, nombre);
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
  nube.escribir(`participantes/${equipoId}`, datos.participantes[equipoId]);
  armarParticipantes();
}

function eliminarParticipante(equipoId, idx) {
  datos.participantes[equipoId].splice(idx, 1);
  guardar();
  nube.escribir(`participantes/${equipoId}`, datos.participantes[equipoId]);
  armarParticipantes();
}

function moverParticipante(equipoId, idx, dir) {
  const lista = datos.participantes[equipoId];
  const nuevoIdx = idx + dir;
  if (nuevoIdx < 0 || nuevoIdx >= lista.length) return;
  [lista[idx], lista[nuevoIdx]] = [lista[nuevoIdx], lista[idx]];
  guardar();
  nube.escribir(`participantes/${equipoId}`, lista);
  armarParticipantes();
}

function transferirParticipante(origenId, idx, destinoId) {
  const nombre = datos.participantes[origenId].splice(idx, 1)[0];
  if (!datos.participantes[destinoId]) datos.participantes[destinoId] = [];
  datos.participantes[destinoId].push(nombre);
  guardar();
  nube.escribir(`participantes/${origenId}`, datos.participantes[origenId]);
  nube.escribir(`participantes/${destinoId}`, datos.participantes[destinoId]);
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
// delta: si viene de los botones + / −, se suma en el servidor para no pisar
// a otro celular que toque al mismo tiempo
function setPuntos(i, id, valor, delta = null) {
  datos.juegos[i].puntos[id] = Number.isFinite(valor) ? valor : 0;
  guardar();
  actualizarResultados(true, id);
  const ruta = `juegos/${i}/puntos/${id}`;
  if (delta !== null) nube.sumar(ruta, delta);
  else nube.escribir(ruta, datos.juegos[i].puntos[id]);
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
  const delta = Number(btn.dataset.delta);
  const nuevo = (datos.juegos[i].puntos[id] || 0) + delta;
  const inp = cuerpo.querySelector(`input[data-juego="${i}"][data-equipo="${id}"]`);
  inp.value = nuevo;
  setPuntos(i, id, nuevo, delta);
});

cuerpo.addEventListener("focusin", ev => {
  if (ev.target.tagName === "INPUT") ev.target.select();
});

// ====== Eventos: Nombres de juegos ======
cuerpo.addEventListener("blur", ev => {
  if (ev.target.classList.contains("nombre-juego")) {
    renombrarJuego(Number(ev.target.dataset.juegoIdx), ev.target.textContent);
    if (tableroPendiente) {
      tableroPendiente = false;
      armarTablero();
    }
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
  const aviso = nube.activa
    ? "¿Seguro que querés borrar todos los puntos? Se borran en todos los celulares."
    : "¿Seguro que querés borrar todos los puntos?";
  if (!confirm(aviso)) return;
  datos.juegos.forEach(j => {
    EQUIPOS.forEach(e => { j.puntos[e.id] = 0; });
  });
  guardar();
  nube.escribir("juegos", datos.juegos);
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

// ====== Actualización automática ======
// Si hay una versión publicada más nueva, recargar la página sola
const VERSION_APP = document.querySelector('meta[name="version-app"]')?.content;

async function buscarNuevaVersion() {
  if (!VERSION_APP) return;
  try {
    const resp = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) return;
    const { version } = await resp.json();
    if (!version || version === VERSION_APP) return;

    // Evitar recargas en bucle si el navegador sigue sirviendo la versión vieja
    const intento = `revelacion-recarga-${version}`;
    if (sessionStorage.getItem(intento)) return;
    sessionStorage.setItem(intento, "1");

    // Refrescar la copia guardada de index.html antes de recargar
    await fetch(location.pathname, { cache: "reload" });
    location.reload();
  } catch (_) {}
}

setInterval(buscarNuevaVersion, 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") buscarNuevaVersion();
});
buscarNuevaVersion();

// ====== Inicialización ======
armarTablero();
armarParticipantes();
navegarA("tablero");
iniciarNube();
