// ===================== CONFIGURACIÓN =====================
const CSV_URL       = 'https://docs.google.com/spreadsheets/d/1ApjOy0d0sTGOwFQNPif-bgbyzJVVidPAPtDYhp4tYuw/export?format=csv&gid=625925071';
const UPDATE_INTERVAL = 5000;
const MAX_HISTORIAL   = 6;

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
async function fetchCsv(url) {
    const res = await fetch(url + '&_ts=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const lines = (await res.text()).split(/\r?\n/).filter(l => l.trim());
    const items = [];

    for (let li = 1; li < lines.length; li++) {
        const cols = [];
        let col = '', inQ = false;
        for (const ch of lines[li]) {
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { cols.push(col.trim()); col = ''; }
            else { col += ch; }
        }
        cols.push(col.trim());

        const c = v => (v || '').replace(/^"|"$/g, '');
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
        const category    = normalizar(categoryRaw);
        const imgUrl      = extractUrlFromFormula(imageCell);

        if (id && name) {
            items.push({
                id, name, category,
                url:      imgUrl ? normalizeDriveUrl(imgUrl) : 'https://via.placeholder.com/200',
                cantidad: parseInt(cantidad) || 0,
                precio, descripcion
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

    modal.innerHTML =
        `<button class="modal-close" onclick="closeProductModal()" aria-label="Cerrar">✕</button>
        <div class="modal-content">
            <div class="modal-image">
                <img src="${item.url}" alt="${item.name}" onerror="this.style.opacity='0.3'">
            </div>
            <div class="modal-details">
                <h2 class="modal-title">${item.name}</h2>
                <div class="modal-category">${item.category}</div>
                <div class="modal-price">${item.precio}</div>
                <div class="modal-stock">${stockStatus}</div>
                <div class="modal-description">
                    <h3>Descripción del Producto</h3>
                    <p>${item.descripcion}</p>
                </div>
                <div class="modal-actions">
                    <a href="${whatsappUrl}" class="btn-whatsapp" target="_blank" rel="noopener">
                        💬 Consultar por WhatsApp
                    </a>
                </div>
            </div>
        </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    setTimeout(() => overlay.classList.add('active'), 10);
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
