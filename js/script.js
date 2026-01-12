// ============================================
// CONFIGURACIÓN
// ============================================
const CSV_URL = 'https://docs.google.com/spreadsheets/d/1ApjOy0d0sTGOwFQNPif-bgbyzJVVidPAPtDYhp4tYuw/export?format=csv&gid=625925071';
const UPDATE_INTERVAL = 5000; // Actualización cada 5 segundos

// ============================================
// ELEMENTOS DEL DOM
// ============================================
const grid = document.getElementById('productos-grid');
const statusMessage = document.getElementById('status-message');
const searchInput = document.getElementById('search');
let currentItems = [];
let currentFilter = '';

// ============================================
// FUNCIONES DE NAVEGACIÓN Y MENÚ
// ============================================
function toggleMenu() {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.querySelector('.menu-toggle');
    navLinks.classList.toggle('active');
    menuToggle.classList.toggle('active');
}

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
    
    document.querySelectorAll('.categoria-item').forEach(cat => {
        cat.classList.remove('active');
    });
    
    if (!wasActive) {
        item.classList.add('active');
    }
}

// ============================================
// FUNCIONES DE FILTRADO
// ============================================
function filterByCategory(category) {
    currentFilter = category.toLowerCase();
    if (searchInput) searchInput.value = '';
    filterBySearch();
    closeCategorias();
    
    setTimeout(() => {
        document.querySelector('#productos').scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function filterCategorias() {
    const searchTerm = document.getElementById('sidebarSearch').value.toLowerCase();
    const categoriaItems = document.querySelectorAll('.categoria-item');
    
    categoriaItems.forEach(item => {
        const titulo = item.querySelector('.categoria-titulo span:last-child').textContent.toLowerCase();
        const links = item.querySelectorAll('.categoria-link');
        let hasMatch = false;
        
        // Verificar si el título coincide
        if (titulo.includes(searchTerm)) {
            item.style.display = '';
            hasMatch = true;
        } else {
            // Verificar si algún link coincide
            links.forEach(link => {
                const linkText = link.textContent.toLowerCase();
                if (linkText.includes(searchTerm)) {
                    hasMatch = true;
                }
            });
        }
        
        item.style.display = hasMatch ? '' : 'none';
    });
}

function filterBySearch() {
    const term = searchInput ? searchInput.value.toLowerCase() : '';
    const filterCategory = currentFilter.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    
    console.log('Filtrando por categoría:', filterCategory);
    
    let visibleCount = 0;
    grid.querySelectorAll('.producto-card').forEach(card => {
        const name = card.querySelector('.producto-nombre').textContent.toLowerCase();
        const category = card.dataset.category || '';
        
        console.log('Producto:', name, 'Categoría del card:', category, 'Filtro:', filterCategory);
        
        const matchesSearch = name.includes(term);
        const matchesCategory = !filterCategory || category.includes(filterCategory);
        
        const shouldShow = matchesSearch && matchesCategory;
        card.style.display = shouldShow ? '' : 'none';
        
        if (shouldShow) visibleCount++;
    });
    
    console.log('Productos visibles:', visibleCount, 'Total productos:', grid.querySelectorAll('.producto-card').length);
}

// ============================================
// FUNCIONES DE URL
// ============================================
function normalizeDriveUrl(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes('drive.google.com')) {
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match) return 'https://drive.google.com/uc?export=view&id=' + match[1];
            const id = u.searchParams.get('id');
            if (id) return 'https://drive.google.com/uc?export=view&id=' + id;
        }
    } catch {}
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

// ============================================
// FUNCIONES DE CSV
// ============================================
async function fetchCsv(url) {
    const res = await fetch(url + '&_ts=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const items = [];
    
    console.log('Total de líneas:', lines.length);
    
    for (const line of lines.slice(1)) {
        const cols = [];
        let currentCol = '';
        let inQuotes = false;
        
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
        
        const id = cols[0]?.replace(/^"|"$/g, ''); // Columna A: item_id
        const name = cols[1]?.replace(/^"|"$/g, ''); // Columna B: nombre
        const categoryRaw = cols[2]?.replace(/^"|"$/g, '') || ''; // Columna C: categoría
        const cantidad = cols[3]?.replace(/^"|"$/g, '') || '0'; // Columna D: cantidad
        const precio = cols[4]?.replace(/^"|"$/g, '') || '0'; // Columna E: precio_unitario
        const imageCell = cols[6]?.replace(/^"|"$/g, ''); // Columna G: link_imagen
        
        // Normalizar categoría: quitar tildes, espacios extra y convertir a minúsculas
        const category = categoryRaw
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Quitar tildes
            .trim();
        
        console.log('ID:', id, 'Nombre:', name, 'Categoría:', category, 'Cantidad:', cantidad, 'Precio:', precio);
        
        const imgUrl = extractUrlFromFormula(imageCell);
        
        if (id && name) {
            items.push({ 
                id, 
                name, 
                url: imgUrl ? normalizeDriveUrl(imgUrl) : 'https://via.placeholder.com/200',
                category: category,
                cantidad: parseInt(cantidad) || 0,
                precio: parseFloat(precio) || 0,
                descripcion: `${name} - Categoría: ${categoryRaw}` // Por ahora usamos esto como descripción
            });
        }
    }
    
    console.log('Total items procesados:', items.length);
    console.log('Categorías encontradas:', [...new Set(items.map(i => i.category))]);
    return items;
}

// ============================================
// FUNCIONES DE SINCRONIZACIÓN
// ============================================
function syncImages(newItems) {
    newItems.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

    const newIds = new Set(newItems.map(i => i.id));
    const cards = Array.from(grid.querySelectorAll('.producto-card'));

    for (const card of cards) {
        const id = card.dataset.id;
        if (!newIds.has(id)) {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(() => card.remove(), 300);
        }
    }

    newItems.forEach(item => {
        let card = grid.querySelector(`.producto-card[data-id="${item.id}"]`);
        if (!card) {
            card = document.createElement('div');
            card.className = 'producto-card';
            card.dataset.id = item.id;
            card.dataset.category = item.category;
            card.dataset.precio = item.precio;
            card.dataset.cantidad = item.cantidad;
            card.dataset.descripcion = item.descripcion;

            const img = document.createElement('img');
            img.src = item.url;
            img.loading = 'lazy';
            img.alt = item.name;
            img.onerror = () => img.style.opacity = '0.3';

            const info = document.createElement('div');
            info.className = 'producto-info';

            const nombre = document.createElement('div');
            nombre.className = 'producto-nombre';
            nombre.textContent = item.name;

            const precio = document.createElement('div');
            precio.className = 'producto-precio';
            precio.textContent = `${item.precio.toFixed(2)}`;

            info.appendChild(nombre);
            info.appendChild(precio);
            card.appendChild(img);
            card.appendChild(info);
            card.onclick = () => openProductModal(item);

            grid.appendChild(card);
        } else {
            const img = card.querySelector('img');
            if (img.src !== item.url) img.src = item.url;
            const nombre = card.querySelector('.producto-nombre');
            if (nombre.textContent !== item.name) nombre.textContent = item.name;
            const precio = card.querySelector('.producto-precio');
            if (precio) precio.textContent = `${item.precio.toFixed(2)}`;
            card.dataset.category = item.category;
            card.dataset.precio = item.precio;
            card.dataset.cantidad = item.cantidad;
            card.dataset.descripcion = item.descripcion;
            card.onclick = () => openProductModal(item);
        }
    });

    currentItems = newItems;
    filterBySearch();
}

async function refreshCsv() {
    try {
        const items = await fetchCsv(CSV_URL);
        syncImages(items);
    } catch (err) {
        console.error(err);
    }
}

// ============================================
// MODAL DE PRODUCTO
// ============================================
function openProductModal(item) {
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'product-modal-overlay';
    overlay.onclick = closeProductModal;

    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'product-modal';
    modal.onclick = (e) => e.stopPropagation();

    const stockStatus = item.cantidad > 0 ? 
        `<span class="stock-disponible">✓ ${item.cantidad} disponibles</span>` : 
        '<span class="stock-agotado">✗ Agotado</span>';

    modal.innerHTML = `
        <button class="modal-close" onclick="closeProductModal()">✕</button>
        <div class="modal-content">
            <div class="modal-image">
                <img src="${item.url}" alt="${item.name}" onerror="this.style.opacity='0.3'">
            </div>
            <div class="modal-details">
                <h2 class="modal-title">${item.name}</h2>
                <div class="modal-category">Categoría: ${item.category}</div>
                <div class="modal-price">${item.precio.toFixed(2)}</div>
                <div class="modal-stock">${stockStatus}</div>
                <div class="modal-description">
                    <h3>Descripción del Producto</h3>
                    <p>${item.descripcion}</p>
                </div>
                <div class="modal-actions">
                    <a href="https://wa.me/593963426407?text=Hola,%20estoy%20interesado%20en:%20${encodeURIComponent(item.name)}%20-%20${item.precio}" 
                       class="btn-whatsapp" target="_blank">
                        💬 Consultar por WhatsApp
                    </a>
                </div>
            </div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Animación de entrada
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);
}

function closeProductModal() {
    const overlay = document.querySelector('.product-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.remove();
            document.body.style.overflow = '';
        }, 300);
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
refreshCsv();
setInterval(refreshCsv, UPDATE_INTERVAL);
if (searchInput) searchInput.oninput = filterBySearch;

// Scroll suave
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#' || !href) return;
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});