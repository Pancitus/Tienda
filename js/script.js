// ===================== CONFIGURACIÓN =====================
const CSV_URL         = 'https://docs.google.com/spreadsheets/d/1ApjOy0d0sTGOwFQNPif-bgbyzJVVidPAPtDYhp4tYuw/export?format=csv&gid=625925071';
const UPDATE_INTERVAL = 5000;
const MAX_HISTORIAL   = 6;

// ── EDITOR ADMIN ──────────────────────────────────────────
const ADMIN_API_URL = 'https://script.google.com/macros/s/AKfycbw8bmSGgJrzYD-OiWdQHhpZI85YWm08cK5Z21pvuzpYfFjKTSHj1r2j_2M0QxKxnYDPlQ/exec';
const ADMIN_KEY     = 'JAK2025admin'; // clave de URL (primer filtro)

// ── Credenciales — hashes SHA-256 ─────────────────────────
// Genera tus hashes en: https://emn178.github.io/online-tools/sha256.html
// Usuario actual : jakadmin          → reemplaza el hash de abajo
// Contraseña actual: JAK@Tienda2025! → reemplaza el hash de abajo
const ADMIN_HASH_USER = '586c5e35894aba95555008af0cbe41f18ccd3e587d8f19e42e79693c1b240826';
const ADMIN_HASH_PASS = '586c5e35894aba95555008af0cbe41f18ccd3e587d8f19e42e79693c1b240826';

// IS_ADMIN: arranca false; solo se pone true tras pasar el login
let IS_ADMIN = false;

// ── ¿La URL tiene la clave correcta? → mostrar login al cargar
const _urlTieneKey = new URLSearchParams(window.location.search).get('admin') === ADMIN_KEY;

// ── Límite de intentos (localStorage) ────────────────────
const _MAX_INT  = 5;
const _BLQ_MS   = 10 * 60 * 1000; // 10 min
const _LS_INT   = 'jak_adm_int';
const _LS_BLQ   = 'jak_adm_blq';
const _getInt   = () => parseInt(localStorage.getItem(_LS_INT) || '0');
const _setInt   = n  => localStorage.setItem(_LS_INT, n);
const _getBlq   = () => parseInt(localStorage.getItem(_LS_BLQ) || '0');
const _setBlq   = ts => localStorage.setItem(_LS_BLQ, ts);
const _resetInt = () => { localStorage.removeItem(_LS_INT); localStorage.removeItem(_LS_BLQ); };
function _bloqueado() {
    const ts = _getBlq();
    if (!ts) return false;
    if (Date.now() - ts < _BLQ_MS) return true;
    _resetInt(); return false;
}

// ── Hash SHA-256 ──────────────────────────────────────────
async function _sha256(txt) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── Modal de Login Admin ──────────────────────────────────
let _loginOpen = false;
function abrirLoginAdmin() {
    if (_loginOpen) return;
    _loginOpen = true;

    const bloq    = _bloqueado();
    const intentos = _getInt();
    const rest    = _MAX_INT - intentos;

    const ov = document.createElement('div');
    ov.id = 'adm-login-ov';
    ov.innerHTML = `
      <div class="adm-login-box" id="adm-login-box">
        <div class="adm-login-icon">🔐</div>
        <h2 class="adm-login-title">Panel Administrador</h2>
        <p class="adm-login-sub">J.A.K Home &amp; Tech</p>
        ${bloq ? `
          <div class="adm-login-blocked">
            ⛔ Demasiados intentos fallidos.<br>
            Espera <span id="adm-cdown"></span> para continuar.
          </div>
          <button class="adm-btn-cancel" id="adm-btn-close">Cerrar</button>
        ` : `
          <div class="adm-login-field">
            <label>Usuario</label>
            <input id="adm-user" type="text" autocomplete="username" placeholder="Tu usuario" />
          </div>
          <div class="adm-login-field">
            <label>Contraseña</label>
            <div class="adm-pass-wrap">
              <input id="adm-pass" type="password" autocomplete="current-password" placeholder="Tu contraseña" />
              <button type="button" class="adm-eye" id="adm-eye">👁</button>
            </div>
          </div>
          ${intentos > 0 ? `<p class="adm-warn">⚠️ Intento ${intentos}/${_MAX_INT} — ${rest} restante${rest!==1?'s':''}</p>` : ''}
          <p class="adm-error" id="adm-err" style="display:none"></p>
          <div class="adm-login-actions">
            <button class="adm-btn-cancel" id="adm-btn-cancel">Cancelar</button>
            <button class="adm-btn-enter"  id="adm-btn-enter">Entrar →</button>
          </div>
        `}
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));

    const cerrar = () => {
        ov.classList.remove('open');
        setTimeout(() => { ov.remove(); _loginOpen = false; }, 300);
    };

    ov.addEventListener('click', e => { if (e.target === ov) cerrar(); });
    const escFn = e => { if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', escFn); } };
    document.addEventListener('keydown', escFn);

    if (bloq) {
        document.getElementById('adm-btn-close').addEventListener('click', cerrar);
        const span = document.getElementById('adm-cdown');
        const blqTs = _getBlq();
        const tick = () => {
            const r = _BLQ_MS - (Date.now() - blqTs);
            if (r <= 0) { cerrar(); return; }
            span.textContent = `${Math.floor(r/60000)}:${String(Math.floor((r%60000)/1000)).padStart(2,'0')}`;
            setTimeout(tick, 1000);
        };
        tick(); return;
    }

    // Mostrar/ocultar contraseña
    document.getElementById('adm-eye').addEventListener('click', () => {
        const i = document.getElementById('adm-pass');
        i.type = i.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('adm-btn-cancel').addEventListener('click', cerrar);

    // Enter navega entre campos / confirma
    document.getElementById('adm-user').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('adm-pass').focus(); });
    document.getElementById('adm-pass').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('adm-btn-enter').click(); });

    setTimeout(() => document.getElementById('adm-user')?.focus(), 120);

    document.getElementById('adm-btn-enter').addEventListener('click', async () => {
        const btn  = document.getElementById('adm-btn-enter');
        const errEl = document.getElementById('adm-err');
        const user = document.getElementById('adm-user').value.trim();
        const pass = document.getElementById('adm-pass').value;

        if (!user || !pass) {
            errEl.textContent = 'Completa usuario y contraseña.';
            errEl.style.display = 'block'; return;
        }

        btn.disabled = true; btn.textContent = 'Verificando...';
        const [hu, hp] = await Promise.all([_sha256(user), _sha256(pass)]);

        if (hu === ADMIN_HASH_USER && hp === ADMIN_HASH_PASS) {
            _resetInt();
            IS_ADMIN = true;
            cerrar();
            _activarAdmin();
        } else {
            const ni = _getInt() + 1;
            _setInt(ni);
            if (ni >= _MAX_INT) {
                _setBlq(Date.now());
                cerrar();
                setTimeout(abrirLoginAdmin, 350);
            } else {
                const r = _MAX_INT - ni;
                errEl.textContent = `❌ Datos incorrectos. ${r} intento${r!==1?'s':''} restante${r!==1?'s':''}.`;
                errEl.style.display = 'block';
                document.getElementById('adm-pass').value = '';
                btn.disabled = false; btn.textContent = 'Entrar →';
            }
        }
    });
}

function _activarAdmin() {
    document.body.classList.add('admin-mode');
    if (allItems.length) window.syncCards(allItems);
    if (!document.getElementById('admin-bar')) injectAdminUI();
    adminToast('✅ Sesión admin iniciada');
}

// ===================== ESTADO =====================
const grid        = document.getElementById('productos-grid');
const searchInput = document.getElementById('search');
let currentFilter = '';
let allItems      = []; // cache global de productos

// ===================== NORMALIZACIÓN DE TEXTO =====================
// Elimina acentos y convierte a minúsculas: "Camiséta" → "camiseta"
function normalizar(texto) {
    return (texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// ===================== HISTORIAL (localStorage) =====================
function getHistorial() {
    try { return JSON.parse(localStorage.getItem('jak_historial') || '[]'); }
    catch { return []; }
}

function saveHistorial(term) {
    if (!term || term.length < 2) return;
    let h = getHistorial().filter(t => t !== term);
    h.unshift(term);
    localStorage.setItem('jak_historial', JSON.stringify(h.slice(0, MAX_HISTORIAL)));
}

// ===================== LEVENSHTEIN ("¿Quisiste decir...?") =====================
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i-1] === b[j-1]
                ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
        }
    }
    return dp[m][n];
}

function sugerirCorreccion(term) {
    if (!term || term.length < 3 || !allItems.length) return null;
    let best = null, bestDist = Infinity;
    allItems.forEach(item => {
        normalizar(item.name).split(' ').forEach(palabra => {
            if (palabra.length < 3) return;
            const dist = levenshtein(term, palabra);
            if (dist > 0 && dist <= 2 && dist < term.length * 0.6 && dist < bestDist) {
                bestDist = dist;
                best = item.name;
            }
        });
    });
    return best;
}

// ===================== SCORING INTELIGENTE =====================
// Prioriza: exacto (12pts) > empieza igual (8pts) > contiene (4pts)
// Pesos por campo: nombre > categoría > descripción = precio
function scoreItem(item, term) {
    if (!term) return 1;
    const campos = [
        { valor: normalizar(item.name),        peso: 3 },
        { valor: normalizar(item.category),    peso: 2 },
        { valor: normalizar(item.descripcion), peso: 1 },
        { valor: normalizar(item.precio),      peso: 1 },
    ];
    let best = 0;
    campos.forEach(({ valor, peso }) => {
        if (valor === term)              best = Math.max(best, peso * 4);
        else if (valor.startsWith(term)) best = Math.max(best, peso * 2);
        else if (valor.includes(term))  best = Math.max(best, peso);
    });
    return best;
}

// ===================== AUTOCOMPLETE =====================
let autocompleteEl = null;

function getAutocompleteEl() {
    if (!autocompleteEl) {
        autocompleteEl = document.createElement('div');
        autocompleteEl.className = 'search-autocomplete';
        searchInput.parentElement.style.position = 'relative';
        searchInput.parentElement.appendChild(autocompleteEl);
    }
    return autocompleteEl;
}

function mostrarAutocomplete(sugerencias) {
    const el = getAutocompleteEl();
    el.innerHTML = '';

    if (!sugerencias.length) { ocultarAutocomplete(); return; }

    sugerencias.forEach(s => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = (s.tipo === 'historial' ? '🕐 ' : '🔍 ') + s.texto;
        // mousedown en vez de click para que ocurra antes del blur del input
        item.addEventListener('mousedown', e => {
            e.preventDefault();
            searchInput.value = s.texto;
            filterCards();
            ocultarAutocomplete();
        });
        el.appendChild(item);
    });

    el.classList.add('active');
}

function ocultarAutocomplete() {
    if (autocompleteEl) autocompleteEl.classList.remove('active');
}

function buildSugerencias(rawTerm) {
    const term = normalizar(rawTerm);
    const sugerencias = [];
    const vistos = new Set();

    if (!term) {
        // Sin texto → mostrar historial reciente
        getHistorial().slice(0, 5).forEach(t => {
            sugerencias.push({ texto: t, tipo: 'historial' });
        });
        return sugerencias;
    }

    // 1. Nombres que empiezan con el término (mayor prioridad)
    allItems
        .filter(i => normalizar(i.name).startsWith(term))
        .slice(0, 3)
        .forEach(i => {
            if (!vistos.has(i.name)) {
                vistos.add(i.name);
                sugerencias.push({ texto: i.name, tipo: 'producto' });
            }
        });

    // 2. Nombres que contienen el término
    allItems
        .filter(i => !vistos.has(i.name) && normalizar(i.name).includes(term))
        .slice(0, 5 - sugerencias.length)
        .forEach(i => {
            vistos.add(i.name);
            sugerencias.push({ texto: i.name, tipo: 'producto' });
        });

    return sugerencias.slice(0, 5);
}

// ===================== MENSAJE SIN RESULTADOS =====================
let noResultsEl = null;

function mostrarSinResultados(mostrar, rawTerm) {
    if (!noResultsEl) {
        noResultsEl = document.createElement('div');
        noResultsEl.className = 'no-results';
        grid.parentElement.insertBefore(noResultsEl, grid);
    }

    if (!mostrar) { noResultsEl.style.display = 'none'; return; }

    const term     = normalizar(rawTerm);
    const sugerido = sugerirCorreccion(term);

    let html = '<div class="no-results-icon">🔎</div>';
    html += `<p class="no-results-title">No encontramos resultados para <strong>"${rawTerm}"</strong></p>`;

    if (sugerido) {
        const esc = sugerido.replace(/'/g, "\\'");
        html += `<p class="no-results-sugerencia">¿Quisiste decir <span class="no-results-link" onclick="usarSugerencia('${esc}')">${sugerido}</span>?</p>`;
    }

    html += '<p class="no-results-tip">Intenta con otras palabras o revisa los filtros de categoría.</p>';

    noResultsEl.innerHTML = html;
    noResultsEl.style.display = 'flex';
}

// Llamada desde el enlace "¿Quisiste decir...?"
function usarSugerencia(nombre) {
    if (searchInput) { searchInput.value = nombre; filterCards(); }
}

// ===================== FILTRADO PRINCIPAL =====================
function filterCards() {
    const rawTerm = searchInput ? searchInput.value : '';
    const term    = normalizar(rawTerm);

    ocultarAutocomplete();

    const cards = Array.from(grid.querySelectorAll('.producto-card'));

    // Puntuar y decidir visibilidad
    const scored = cards.map(card => {
        const item = {
            name:        card.querySelector('.producto-nombre').textContent,
            category:    card.dataset.category    || '',
            descripcion: card.dataset.descripcion || '',
            precio:      card.querySelector('.producto-precio').textContent,
        };
        const score          = scoreItem(item, term);
        const matchesCategory = !currentFilter || normalizar(item.category).includes(normalizar(currentFilter));
        return { card, score, show: (score > 0 || !term) && matchesCategory };
    });

    // Ordenar por score desc (más relevante primero)
    scored.sort((a, b) => b.score - a.score);

    let visible = 0;
    scored.forEach(({ card, show }) => {
        card.style.display = show ? '' : 'none';
        if (show) { visible++; grid.appendChild(card); } // reordena en el DOM
    });

    mostrarSinResultados(visible === 0, rawTerm);
    if (term.length > 1) saveHistorial(rawTerm.trim());
}

// ===================== FILTRO POR CATEGORÍA =====================
function setFilter(btn, category) {
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = category.toLowerCase();
    if (searchInput) searchInput.value = '';
    filterCards();
    setTimeout(() => {
        const section = document.querySelector('#productos');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

// ===================== UTILIDADES DE URL =====================
function normalizeDriveUrl(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes('drive.google.com')) {
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match) return 'https://drive.google.com/uc?export=view&id=' + match[1];
            const id = u.searchParams.get('id');
            if (id) return 'https://drive.google.com/uc?export=view&id=' + id;
        }
    } catch (e) {}
    return url;
}

function extractUrlFromFormula(cellValue) {
    if (!cellValue) return null;
    if (cellValue.startsWith('http')) return cellValue;
    let match = cellValue.match(/=IMAGE\s*\(\s*"([^"]+)"/i);
    if (match) return match[1];
    match = cellValue.match(/=HYPERLINK\s*\(\s*"([^"]+)"\s*;\s*IMAGE\s*\(\s*"([^"]+)"/i);
    if (match) return match[2];
    match = cellValue.match(/=HYPERLINK\s*\(\s*"([^"]+)"/i);
    if (match) return match[1];
    return cellValue;
}

// ===================== PARSEO DE CSV =====================
// Parser robusto: respeta saltos de línea dentro de celdas entre comillas
function parseCsvText(text) {
    const rows = [];
    let col = '', inQ = false, row = [];
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            if (inQ && text[i+1] === '"') { col += '"'; i++; }
            else { inQ = !inQ; }
        } else if (ch === ',' && !inQ) {
            row.push(col); col = '';
        } else if ((ch === '\n' || (ch === '\r' && text[i+1] === '\n')) && !inQ) {
            if (ch === '\r') i++;
            row.push(col); col = '';
            if (row.some(c => c.trim())) rows.push(row);
            row = [];
        } else {
            col += ch;
        }
    }
    row.push(col);
    if (row.some(c => c.trim())) rows.push(row);
    return rows;
}

async function fetchCsv(url) {
    const res = await fetch(url + '&_ts=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const rows  = parseCsvText(await res.text());
    const items = [];

    for (let li = 1; li < rows.length; li++) {
        const cols = rows[li];
        const c = v => (v || '').trim().replace(/^"|"$/g, '');
        const id             = c(cols[0]);
        const name           = c(cols[1]);
        const categoryRaw    = c(cols[2]);
        const cantidad       = c(cols[3]) || '0';
        const precioRaw      = c(cols[4]) || '0';
        const descripcionRaw = c(cols[5]);
        const imageCell      = c(cols[6]);

        let precio = precioRaw;
        if (precio && !precio.includes('$')) precio = '$' + precio;
        if (!precio || precio === '$') precio = '$0';

        const descripcion = descripcionRaw || `${name} - Categoría: ${categoryRaw}`;
        const esOferta    = normalizar(descripcionRaw).includes('oferta') || normalizar(categoryRaw).includes('oferta');
        const category    = esOferta && !normalizar(categoryRaw).includes('oferta')
            ? normalizar(categoryRaw) + ' ofertas'
            : normalizar(categoryRaw);
        const imgUrl = extractUrlFromFormula(imageCell);

        // Imágenes extra: cols[7], cols[8], cols[9]...
        const extraUrls = [];
        for (let ci = 7; ci < cols.length; ci++) {
            const extra = extractUrlFromFormula(c(cols[ci]));
            if (extra) extraUrls.push(normalizeDriveUrl(extra));
        }

        if (id && name) {
            const mainUrl = imgUrl ? normalizeDriveUrl(imgUrl) : null;
            const allUrls = mainUrl
                ? [mainUrl, ...extraUrls]
                : (extraUrls.length ? extraUrls : ['https://via.placeholder.com/200']);
            items.push({
                id, name, category,
                url:      allUrls[0],
                urls:     allUrls,
                cantidad: parseInt(cantidad) || 0,
                precio, descripcion,
                esOferta
            });
        }
    }
    return items;
}

// ===================== SINCRONIZACIÓN DE CARDS =====================
function syncCards(newItems) {
    allItems = newItems.slice(); // actualiza cache para autocomplete

    newItems.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

    const newIds = new Set(newItems.map(i => i.id));

    // Eliminar cards obsoletas
    Array.from(grid.querySelectorAll('.producto-card')).forEach(card => {
        if (!newIds.has(card.dataset.id)) {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(() => card.remove(), 300);
        }
    });

    // Crear o actualizar
    newItems.forEach(item => {
        let card = grid.querySelector(`.producto-card[data-id="${item.id}"]`);

        if (!card) {
            card = document.createElement('div');
            card.className           = 'producto-card';
            card.dataset.id          = item.id;
            card.dataset.category    = item.category;
            card.dataset.descripcion = item.descripcion; // para búsqueda multi-campo

            const img = document.createElement('img');
            img.src = item.url; img.loading = 'lazy'; img.alt = item.name;
            img.onerror = () => img.style.opacity = '0.3';

            // Badge de oferta
            if (item.esOferta) {
                const badge = document.createElement('div');
                badge.className = 'oferta-badge';
                badge.innerHTML = `<svg viewBox="0 0 24 24" fill="white" width="16" height="16" style="flex-shrink:0"><path d="M21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .59 1.42l9 9A2 2 0 0 0 13 22a2 2 0 0 0 1.41-.59l7-7A2 2 0 0 0 22 13a2 2 0 0 0-.59-1.42zM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8z"/></svg> Oferta`;
                card.appendChild(badge);
            }

            const info = document.createElement('div');
            info.className = 'producto-info';

            const nombre = document.createElement('div');
            nombre.className = 'producto-nombre'; nombre.textContent = item.name;

            const precioEl = document.createElement('div');
            precioEl.className = 'producto-precio'; precioEl.textContent = item.precio;

            info.append(nombre, precioEl);
            card.append(img, info);
            card.onclick = () => openProductModal(item);
            grid.appendChild(card);
        } else {
            const img = card.querySelector('img');
            if (img.src !== item.url) img.src = item.url;

            const nombre = card.querySelector('.producto-nombre');
            if (nombre.textContent !== item.name) nombre.textContent = item.name;

            let precioEl = card.querySelector('.producto-precio');
            if (!precioEl) {
                precioEl = document.createElement('div');
                precioEl.className = 'producto-precio';
                card.querySelector('.producto-info').appendChild(precioEl);
            }
            if (precioEl.textContent !== item.precio) precioEl.textContent = item.precio;

            card.dataset.category    = item.category;
            card.dataset.descripcion = item.descripcion;
            card.onclick = () => openProductModal(item);
        }
    });

    filterCards();
}

async function refreshCsv() {
    try { syncCards(await fetchCsv(CSV_URL)); }
    catch (err) { console.error('Error cargando productos:', err); }
}

// ===================== MODAL DE PRODUCTO =====================
function openProductModal(item) {
    const overlay = document.createElement('div');
    overlay.className = 'product-modal-overlay';
    overlay.onclick   = closeProductModal;

    const modal = document.createElement('div');
    modal.className = 'product-modal';
    modal.onclick   = e => e.stopPropagation();

    const stockStatus = item.cantidad > 0
        ? `<span class="stock-disponible">✓ Disponible: ${item.cantidad} unidades</span>`
        : '<span class="stock-agotado">✕ Agotado</span>';

    const whatsappUrl = 'https://wa.me/593963426407?text='
        + encodeURIComponent(`Hola, estoy interesado en: ${item.name} - ${item.precio}`);

    const urls = item.urls && item.urls.length > 1 ? item.urls : null;
    const carruselHTML = urls ? `
        <div class="modal-carousel">
            <img id="carousel-img" src="${urls[0]}" alt="${item.name}" onerror="this.style.opacity='0.3'">
            <button class="carousel-btn carousel-prev" onclick="carouselNav(-1)">&#8249;</button>
            <button class="carousel-btn carousel-next" onclick="carouselNav(1)">&#8250;</button>
            <div class="carousel-dots">
                ${urls.map((_, i) => `<span class="carousel-dot ${i===0?'active':''}" onclick="carouselGo(${i})"></span>`).join('')}
            </div>
        </div>` : `
        <div class="modal-image">
            <img src="${item.url}" alt="${item.name}" onerror="this.style.opacity='0.3'">
        </div>`;

    modal.innerHTML =
        `<button class="modal-close" onclick="closeProductModal()" aria-label="Cerrar">✕</button>
        <div class="modal-content">
            ${carruselHTML}
            <div class="modal-details">
                <h2 class="modal-title">${item.name}</h2>
                <div class="modal-category">${item.category}</div>
                <div class="modal-price">${item.precio}</div>
                <div class="modal-stock">${stockStatus}</div>
                <div class="modal-description">
                    <h3>Descripción del Producto</h3>
                    <p>${item.descripcion.replace(/\n/g, '<br>')}</p>
                </div>
                <div class="modal-actions">
                    <a href="${whatsappUrl}" class="btn-whatsapp" target="_blank" rel="noopener">
                        💬 Consultar por WhatsApp
                    </a>
                </div>
            </div>
        </div>`;

    // Guardar URLs para navegación
    if (urls) {
        modal._urls  = urls;
        modal._index = 0;
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    setTimeout(() => overlay.classList.add('active'), 10);
}

function carouselNav(dir) {
    const modal = document.querySelector('.product-modal');
    if (!modal || !modal._urls) return;
    modal._index = (modal._index + dir + modal._urls.length) % modal._urls.length;
    carouselGo(modal._index);
}

function carouselGo(index) {
    const modal = document.querySelector('.product-modal');
    if (!modal || !modal._urls) return;
    modal._index = index;
    document.getElementById('carousel-img').src = modal._urls[index];
    document.querySelectorAll('.carousel-dot').forEach((d, i) =>
        d.classList.toggle('active', i === index));
}

function closeProductModal() {
    const overlay = document.querySelector('.product-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => { overlay.remove(); document.body.style.overflow = ''; }, 300);
    }
}

// ===================== INICIALIZACIÓN =====================
refreshCsv();
setInterval(refreshCsv, UPDATE_INTERVAL);

// ── Si la URL tiene la clave → mostrar login admin ────────
if (_urlTieneKey) {
    // Esperar a que el DOM esté listo para mostrar el modal
    window.addEventListener('load', () => setTimeout(abrirLoginAdmin, 400));
}

if (searchInput) {
    // Mientras escribe: filtrar + autocomplete
    searchInput.addEventListener('input', () => {
        filterCards();
        mostrarAutocomplete(buildSugerencias(searchInput.value));
    });

    // Al enfocar: mostrar historial si el campo está vacío
    searchInput.addEventListener('focus', () => {
        const s = buildSugerencias(searchInput.value);
        if (s.length) mostrarAutocomplete(s);
    });

    // Al perder foco: ocultar autocomplete (con delay para permitir el click)
    searchInput.addEventListener('blur', () => setTimeout(ocultarAutocomplete, 150));
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeProductModal(); ocultarAutocomplete(); }
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
        const href = anchor.getAttribute('href');
        if (!href || href === '#') return;
        e.preventDefault();
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

// ═══════════════════════════════════════════════════════════
//  MODO EDITOR — solo activo cuando ?admin=CLAVE está en URL
// ═══════════════════════════════════════════════════════════

function injectAdminUI() {
    // ── Barra admin ──────────────────────────────────────
    const bar = document.createElement('div');
    bar.id = 'admin-bar';
    bar.innerHTML = `
        <span>🛠 <strong>Modo Editor</strong> <span class="admin-badge">ADMIN</span>
        — Cambios guardados directo en Google Sheets</span>
        <div style="display:flex;gap:0.5rem;align-items:center">
            <button class="admin-btn-add" onclick="adminOpenEditor(null)">＋ Nuevo producto</button>
            <button class="admin-btn-logout" onclick="cerrarSesionAdmin()">🚪 Salir</button>
        </div>
    `;
    document.body.insertBefore(bar, document.body.firstChild);

    // ── Modal editor ─────────────────────────────────────
    const modal = document.createElement('div');
    modal.id = 'admin-editor-modal';
    modal.innerHTML = `
        <div class="admin-editor-box">
            <h3 id="admin-editor-title">Nuevo producto</h3>
            <input type="hidden" id="af_item_id">
            <div class="admin-form-grid">
                <div>
                    <label>ID único *</label>
                    <input id="af_id" type="text" placeholder="ej: JAK-001">
                </div>
                <div>
                    <label>Categoría *</label>
                    <select id="af_cat">
                        <option value="ropa">Ropa</option>
                        <option value="accesorios">Accesorios</option>
                        <option value="cuidado personal">Cuidado Personal</option>
                        <option value="hogar">Hogar</option>
                        <option value="maquillaje">Maquillaje</option>
                        <option value="electronicos">Electrónicos</option>
                        <option value="ofertas">Ofertas de la Semana</option>
                    </select>
                </div>
                <div class="af-full">
                    <label>Nombre del producto *</label>
                    <input id="af_nombre" type="text" placeholder="Nombre visible en tienda">
                </div>
                <div>
                    <label>Precio (USD) *</label>
                    <input id="af_precio" type="number" step="0.01" min="0" placeholder="0.00">
                </div>
                <div>
                    <label>Cantidad en stock</label>
                    <input id="af_cantidad" type="number" min="0" placeholder="0">
                </div>
                <div class="af-full">
                    <label>Descripción</label>
                    <textarea id="af_desc" placeholder="Describe el producto..."></textarea>
                </div>
                <div class="af-full">
                    <label>Imagen principal</label>
                    <div class="af-img-row">
                        <input id="af_img1" type="url" placeholder="https://... o usa 📁 para subir">
                        <label class="af-upload-btn" title="Subir imagen desde tu PC">
                            📁 <input type="file" accept="image/*" onchange="adminUploadImg(this,'af_img1')" hidden>
                        </label>
                        <img id="af_img1_prev" class="af-img-prev" src="" alt="" onclick="this.style.display='none'">
                    </div>
                </div>
                <div>
                    <label>Imagen 2</label>
                    <div class="af-img-row">
                        <input id="af_img2" type="url" placeholder="https://...">
                        <label class="af-upload-btn" title="Subir imagen">
                            📁 <input type="file" accept="image/*" onchange="adminUploadImg(this,'af_img2')" hidden>
                        </label>
                        <img id="af_img2_prev" class="af-img-prev" src="" alt="" onclick="this.style.display='none'">
                    </div>
                </div>
                <div>
                    <label>Imagen 3</label>
                    <div class="af-img-row">
                        <input id="af_img3" type="url" placeholder="https://...">
                        <label class="af-upload-btn" title="Subir imagen">
                            📁 <input type="file" accept="image/*" onchange="adminUploadImg(this,'af_img3')" hidden>
                        </label>
                        <img id="af_img3_prev" class="af-img-prev" src="" alt="" onclick="this.style.display='none'">
                    </div>
                </div>
                <div>
                    <label>Imagen 4</label>
                    <div class="af-img-row">
                        <input id="af_img4" type="url" placeholder="https://...">
                        <label class="af-upload-btn" title="Subir imagen">
                            📁 <input type="file" accept="image/*" onchange="adminUploadImg(this,'af_img4')" hidden>
                        </label>
                        <img id="af_img4_prev" class="af-img-prev" src="" alt="" onclick="this.style.display='none'">
                    </div>
                </div>
                <div>
                    <label>Imagen 5</label>
                    <div class="af-img-row">
                        <input id="af_img5" type="url" placeholder="https://...">
                        <label class="af-upload-btn" title="Subir imagen">
                            📁 <input type="file" accept="image/*" onchange="adminUploadImg(this,'af_img5')" hidden>
                        </label>
                        <img id="af_img5_prev" class="af-img-prev" src="" alt="" onclick="this.style.display='none'">
                    </div>
                </div>
            </div>
            <div class="admin-form-actions">
                <button class="admin-btn-cancel" onclick="adminCloseEditor()">Cancelar</button>
                <button class="admin-btn-save" id="admin-btn-save" onclick="adminSave()">💾 Guardar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // ── Toast ────────────────────────────────────────────
    const toast = document.createElement('div');
    toast.id = 'admin-toast';
    document.body.appendChild(toast);
}

// ── Cerrar sesión admin ───────────────────────────────────
function cerrarSesionAdmin() {
    if (!confirm('¿Salir del modo administrador?')) return;
    IS_ADMIN = false;
    document.body.classList.remove('admin-mode');
    document.getElementById('admin-bar')?.remove();
    // Quitar botones de edición de las cards
    document.querySelectorAll('.admin-card-actions').forEach(el => el.remove());
    adminToast('👋 Sesión cerrada');
}

// ── Botones ✏️ 🗑 sobre cada card ─────────────────────────
function addAdminButtons(card, item) {
    if (!IS_ADMIN) return;
    // evitar duplicados
    if (card.querySelector('.admin-card-actions')) return;
    const wrap = document.createElement('div');
    wrap.className = 'admin-card-actions';
    wrap.innerHTML = `
        <button title="Editar" onclick="event.stopPropagation(); adminOpenEditor('${item.id}')">✏️</button>
        <button title="Eliminar" onclick="event.stopPropagation(); adminDelete('${item.id}')">🗑</button>
    `;
    card.appendChild(wrap);
}

// Parchamos syncCards para que también agregue botones admin
const _origSyncCards = syncCards;
window.syncCards = function(newItems) {
    _origSyncCards(newItems);
    if (!IS_ADMIN) return;
    newItems.forEach(item => {
        const card = grid.querySelector(`.producto-card[data-id="${item.id}"]`);
        if (card) addAdminButtons(card, item);
    });
};

// ── Abrir / cerrar editor ────────────────────────────────
function adminOpenEditor(id) {
    const isNew = !id;
    document.getElementById('admin-editor-title').textContent = isNew ? 'Nuevo producto' : 'Editar producto';
    const btn = document.getElementById('admin-btn-save');
    btn.disabled = false;
    btn.textContent = '💾 Guardar';

    clearImgPreviews();

    if (isNew) {
        ['af_item_id','af_id','af_nombre','af_precio','af_cantidad','af_desc',
         'af_img1','af_img2','af_img3','af_img4','af_img5'].forEach(i => {
            const el = document.getElementById(i);
            if (el) el.value = '';
        });
        document.getElementById('af_cat').value = 'ropa';
    } else {
        const p = allItems.find(x => String(x.id) === String(id));
        if (!p) return;
        document.getElementById('af_item_id').value = p.id;
        document.getElementById('af_id').value      = p.id;
        document.getElementById('af_nombre').value  = p.name;
        document.getElementById('af_cat').value     = p.category.replace(' ofertas','');
        document.getElementById('af_precio').value  = p.precio.replace('$','');
        document.getElementById('af_cantidad').value= p.cantidad;
        document.getElementById('af_desc').value    = p.descripcion;
        const imgs = p.urls || [];
        ['af_img1','af_img2','af_img3','af_img4','af_img5'].forEach((fid, i) => {
            document.getElementById(fid).value = imgs[i] || '';
            // Mostrar preview de imagen existente
            if (imgs[i]) {
                const prev = document.getElementById(fid + '_prev');
                if (prev) { prev.src = imgs[i]; prev.style.display = 'block'; }
            }
        });
    }
    document.getElementById('admin-editor-modal').classList.add('open');
}

function adminCloseEditor() {
    document.getElementById('admin-editor-modal').classList.remove('open');
}

// ── Guardar (add / update) ───────────────────────────────
async function adminSave() {
    const oldId = document.getElementById('af_item_id').value.trim();
    const newId = document.getElementById('af_id').value.trim();
    const isNew = !oldId;

    const product = {
        item_id:                  isNew ? newId : oldId,
        nombre:                   document.getElementById('af_nombre').value.trim(),
        categoria:                document.getElementById('af_cat').value,
        precio_unitario:          document.getElementById('af_precio').value,
        cantidad:                 document.getElementById('af_cantidad').value,
        descripcion_del_producto: document.getElementById('af_desc').value.trim(),
        link_imagen:              document.getElementById('af_img1').value.trim(),
        Imagen_2:                 document.getElementById('af_img2').value.trim(),
        Imagen_3:                 document.getElementById('af_img3').value.trim(),
        Imagen_4:                 document.getElementById('af_img4').value.trim(),
        Imagen_5:                 document.getElementById('af_img5').value.trim(),
    };

    if (!product.item_id || !product.nombre || !product.precio_unitario) {
        adminToast('⚠️ Completa ID, Nombre y Precio'); return;
    }

    const btn = document.getElementById('admin-btn-save');
    btn.disabled = true; btn.textContent = 'Guardando...';

    try {
        const res  = await fetch(ADMIN_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: isNew ? 'addProduct' : 'updateProduct', key: ADMIN_KEY, product })
        });
        const data = await res.json();
        if (data.success) {
            adminToast(isNew ? '✅ Producto agregado' : '✅ Producto actualizado');
            adminCloseEditor();
            await refreshCsv();
        } else {
            adminToast('❌ Error: ' + (data.error || 'desconocido'));
        }
    } catch (e) {
        adminToast('❌ Error de conexión con Apps Script');
    }
    btn.disabled = false; btn.textContent = '💾 Guardar';
}

// ── Eliminar ─────────────────────────────────────────────
async function adminDelete(id) {
    const p = allItems.find(x => String(x.id) === String(id));
    if (!confirm(`¿Eliminar "${p?.name}"? No se puede deshacer.`)) return;
    try {
        const res  = await fetch(`${ADMIN_API_URL}?action=deleteProduct&key=${ADMIN_KEY}&item_id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (data.success) { adminToast('🗑 Producto eliminado'); await refreshCsv(); }
        else adminToast('❌ Error: ' + (data.error || 'desconocido'));
    } catch (e) {
        adminToast('❌ Error de conexión');
    }
}

// ── Toast ────────────────────────────────────────────────
function adminToast(msg) {
    const t = document.getElementById('admin-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Subir imagen a ImgBB ─────────────────────────────────
const IMGBB_KEY = '634e5a5b7a6b4c9a8e1f2d3c4b5a6789'; // clave pública ImgBB

async function adminUploadImg(input, targetId) {
    const file = input.files[0];
    if (!file) return;

    // Vista previa local inmediata
    const reader = new FileReader();
    reader.onload = ev => {
        const prev = document.getElementById(targetId + '_prev');
        if (prev) { prev.src = ev.target.result; prev.style.display = 'block'; }
    };
    reader.readAsDataURL(file);

    adminToast('⏳ Subiendo imagen...');

    try {
        const formData = new FormData();
        formData.append('image', file);

        const res  = await fetch('https://api.imgbb.com/1/upload?key=' + IMGBB_KEY, {
            method: 'POST', body: formData
        });
        const data = await res.json();

        if (data.success) {
            const url = data.data.url;
            document.getElementById(targetId).value = url;
            // Actualizar preview con URL real
            const prev = document.getElementById(targetId + '_prev');
            if (prev) prev.src = url;
            adminToast('✅ Imagen subida correctamente');
        } else {
            adminToast('❌ Error al subir: ' + (data.error?.message || 'intenta de nuevo'));
        }
    } catch (e) {
        adminToast('❌ Error de conexión al subir imagen');
    }

    // Limpiar el input file para permitir subir el mismo archivo otra vez
    input.value = '';
}

// Limpiar previews al abrir el editor
function clearImgPreviews() {
    ['af_img1','af_img2','af_img3','af_img4','af_img5'].forEach(id => {
        const prev = document.getElementById(id + '_prev');
        if (prev) { prev.src = ''; prev.style.display = 'none'; }
    });
}

// ── Cerrar editor con Escape ─────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') adminCloseEditor();
});
