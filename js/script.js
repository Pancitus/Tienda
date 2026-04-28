// ===================== CONFIGURACIÓN =====================
const CSV_URL = 'https://docs.google.com/spreadsheets/d/1ApjOy0d0sTGOwFQNPif-bgbyzJVVidPAPtDYhp4tYuw/export?format=csv&gid=625925071';
const UPDATE_INTERVAL = 5000;

// ===================== ELEMENTOS DEL DOM =====================
const grid = document.getElementById('productos-grid');
const searchInput = document.getElementById('search'); // buscador del hero
let currentFilter = '';

// ===================== NAVEGACIÓN Y MENÚ (solo móvil) =====================
function openCategorias(e) {
    if (e) e.preventDefault();
    document.getElementById('categoriasSidebar').classList.add('active');
    document.getElementById('sidebarOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCategorias() {
    document.getElementById('categoriasSidebar').classList.remove('active');
    document.getElementById('sidebarOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function toggleCategoria(header) {
    const item = header.parentElement;
    const wasActive = item.classList.contains('active');

    document.querySelectorAll('.categoria-item').forEach(function(cat) {
        cat.classList.remove('active');
    });

    if (!wasActive) {
        item.classList.add('active');
    }
}

// Cerrar sidebar con tecla Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeCategorias();
        closeProductModal();
    }
});

// ===================== FILTRADO =====================

/**
 * Activa un filtro de categoría.
 * Funciona tanto desde el sidebar móvil como desde las pills de desktop.
 */
function filterByCategory(category) {
    currentFilter = category.toLowerCase();

    // Limpiar buscador de texto
    if (searchInput) searchInput.value = '';
    const sidebarSearch = document.getElementById('sidebar-search');
    if (sidebarSearch) sidebarSearch.value = '';

    filterBySearch();
    closeCategorias();

    setTimeout(function() {
        const section = document.querySelector('#productos');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

/**
 * Maneja el clic en las pills de categorías de desktop.
 * Actualiza el estado visual (active) y llama a filterByCategory.
 */
function setDesktopFilter(btn, category) {
    // Quitar .active de todos los pills
    document.querySelectorAll('.filter-pill').forEach(function(pill) {
        pill.classList.remove('active');
    });
    // Activar el pill clickeado
    btn.classList.add('active');

    filterByCategory(category);
}

/**
 * Filtra las cards por texto del buscador y/o categoría activa.
 * Se llama desde ambos buscadores (hero y sidebar).
 */
function filterBySearch() {
    // Usa el buscador que tenga contenido, priorizando el hero
    const heroTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const sidebarInput = document.getElementById('sidebar-search');
    const sidebarTerm = sidebarInput ? sidebarInput.value.toLowerCase().trim() : '';
    const term = heroTerm || sidebarTerm;

    grid.querySelectorAll('.producto-card').forEach(function(card) {
        const name     = card.querySelector('.producto-nombre').textContent.toLowerCase();
        const category = (card.dataset.category || '').toLowerCase();

        const matchesSearch   = !term || name.includes(term);
        const matchesCategory = !currentFilter || category.includes(currentFilter);

        card.style.display = (matchesSearch && matchesCategory) ? '' : 'none';
    });
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

    const text  = await res.text();
    const lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
    const items = [];

    for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const cols = [];
        let currentCol = '';
        let inQuotes   = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                cols.push(currentCol.trim());
                currentCol = '';
            } else {
                currentCol += char;
            }
        }
        cols.push(currentCol.trim());

        const clean = function(v) { return (v || '').replace(/^"|"$/g, ''); };

        const id           = clean(cols[0]);
        const name         = clean(cols[1]);
        const categoryRaw  = clean(cols[2]);
        const cantidad     = clean(cols[3]) || '0';
        const precioRaw    = clean(cols[4]) || '0';
        const descripcionRaw = clean(cols[5]);
        const imageCell    = clean(cols[6]);

        // Formato del precio
        let precio = precioRaw;
        if (precio && !precio.includes('$')) precio = '$' + precio;
        if (!precio || precio === '$') precio = '$0';

        // Descripción de respaldo
        const descripcion = descripcionRaw || (name + ' - Categoría: ' + categoryRaw);

        // Normalizar categoría (sin tildes, minúsculas)
        const category = categoryRaw
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        const imgUrl = extractUrlFromFormula(imageCell);

        if (id && name) {
            items.push({
                id,
                name,
                url: imgUrl ? normalizeDriveUrl(imgUrl) : 'https://via.placeholder.com/200',
                category,
                cantidad: parseInt(cantidad) || 0,
                precio,
                descripcion
            });
        }
    }

    return items;
}

// ===================== SINCRONIZACIÓN DE CARDS =====================
function syncImages(newItems) {
    // Ordenar alfabéticamente
    newItems.sort(function(a, b) {
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });

    const newIds = new Set(newItems.map(function(i) { return i.id; }));

    // Eliminar cards que ya no existen
    Array.from(grid.querySelectorAll('.producto-card')).forEach(function(card) {
        if (!newIds.has(card.dataset.id)) {
            card.style.opacity   = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(function() { card.remove(); }, 300);
        }
    });

    // Agregar o actualizar cards
    newItems.forEach(function(item) {
        let card = grid.querySelector('.producto-card[data-id="' + item.id + '"]');

        if (!card) {
            card = document.createElement('div');
            card.className      = 'producto-card';
            card.dataset.id     = item.id;
            card.dataset.category = item.category;

            const img  = document.createElement('img');
            img.src    = item.url;
            img.loading = 'lazy';
            img.alt    = item.name;
            img.onerror = function() { img.style.opacity = '0.3'; };

            const info = document.createElement('div');
            info.className = 'producto-info';

            const nombre = document.createElement('div');
            nombre.className  = 'producto-nombre';
            nombre.textContent = item.name;

            const precio = document.createElement('div');
            precio.className  = 'producto-precio';
            precio.textContent = item.precio;

            info.appendChild(nombre);
            info.appendChild(precio);
            card.appendChild(img);
            card.appendChild(info);
            card.onclick = function() { openProductModal(item); };

            grid.appendChild(card);
        } else {
            // Actualizar datos si cambiaron
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

            card.dataset.category = item.category;
            card.onclick = function() { openProductModal(item); };
        }
    });

    filterBySearch();
}

async function refreshCsv() {
    try {
        const items = await fetchCsv(CSV_URL);
        syncImages(items);
    } catch (err) {
        console.error('Error cargando productos:', err);
    }
}

// ===================== MODAL DE PRODUCTO =====================
function openProductModal(item) {
    const overlay = document.createElement('div');
    overlay.className = 'product-modal-overlay';
    overlay.onclick   = closeProductModal;

    const modal   = document.createElement('div');
    modal.className = 'product-modal';
    modal.onclick   = function(e) { e.stopPropagation(); };

    const stockStatus = item.cantidad > 0
        ? '<span class="stock-disponible">✓ Disponible: ' + item.cantidad + ' unidades</span>'
        : '<span class="stock-agotado">✕ Agotado</span>';

    const whatsappText = 'Hola, estoy interesado en: ' + item.name + ' - ' + item.precio;
    const whatsappUrl  = 'https://wa.me/593963426407?text=' + encodeURIComponent(whatsappText);

    modal.innerHTML =
        '<button class="modal-close" onclick="closeProductModal()" aria-label="Cerrar">✕</button>' +
        '<div class="modal-content">' +
            '<div class="modal-image">' +
                '<img src="' + item.url + '" alt="' + item.name + '" onerror="this.style.opacity=\'0.3\'">' +
            '</div>' +
            '<div class="modal-details">' +
                '<h2 class="modal-title">' + item.name + '</h2>' +
                '<div class="modal-category">' + item.category + '</div>' +
                '<div class="modal-price">' + item.precio + '</div>' +
                '<div class="modal-stock">' + stockStatus + '</div>' +
                '<div class="modal-description">' +
                    '<h3>Descripción del Producto</h3>' +
                    '<p>' + item.descripcion + '</p>' +
                '</div>' +
                '<div class="modal-actions">' +
                    '<a href="' + whatsappUrl + '" class="btn-whatsapp" target="_blank" rel="noopener">' +
                        '💬 Consultar por WhatsApp' +
                    '</a>' +
                '</div>' +
            '</div>' +
        '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    setTimeout(function() { overlay.classList.add('active'); }, 10);
}

function closeProductModal() {
    const overlay = document.querySelector('.product-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(function() {
            overlay.remove();
            document.body.style.overflow = '';
        }, 300);
    }
}

// ===================== INICIALIZACIÓN =====================
refreshCsv();
setInterval(refreshCsv, UPDATE_INTERVAL);

// Buscador del hero
if (searchInput) {
    searchInput.oninput = filterBySearch;
}

// Scroll suave para links internos
document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (!href || href === '#') return;
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});
