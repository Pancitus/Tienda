// ============================================
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSvL2JBgHkHwUIBktva-RSgJYId3X9b6BiJxYgn8XyOj03LiAG-mVJygvG3WE4tlobSAcknp8i8Ql3O/pub?gid=0&single=true&output=csv';
const UPDATE_INTERVAL = 5000; // Actualización cada 5 segundos
// ============================================

const grid = document.getElementById('productos-grid');
const statusMessage = document.getElementById('status-message');
const searchInput = document.getElementById('search');
let currentItems = [];

function toggleMenu() {
    document.getElementById('navLinks').classList.toggle('active');
}

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

async function fetchCsv(url) {
    const res = await fetch(url + '&_ts=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const items = [];
    
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
        
        const id = cols[0]?.replace(/^"|"$/g, '');
        const name = cols[1]?.replace(/^"|"$/g, '');
        const imageCell = cols[2]?.replace(/^"|"$/g, '');
        
        const imgUrl = extractUrlFromFormula(imageCell);
        
        if (id && name && imgUrl) {
            items.push({ id, name, url: normalizeDriveUrl(imgUrl) });
        }
    }
    return items;
}

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

            info.appendChild(nombre);
            card.appendChild(img);
            card.appendChild(info);
            card.onclick = () => window.open(item.url, '_blank');

            grid.appendChild(card);
        } else {
            const img = card.querySelector('img');
            if (img.src !== item.url) img.src = item.url;
            const nombre = card.querySelector('.producto-nombre');
            if (nombre.textContent !== item.name) nombre.textContent = item.name;
        }
    });

    currentItems = newItems;
    filterBySearch();
    statusMessage.textContent = `✅ ${newItems.length} productos cargados — ${new Date().toLocaleTimeString()}`;
}

async function refreshCsv() {
    try {
        const items = await fetchCsv(CSV_URL);
        syncImages(items);
    } catch (err) {
        console.error(err);
        statusMessage.textContent = '❌ Error: ' + err.message;
    }
}

function filterBySearch() {
    const term = searchInput.value.toLowerCase();
    grid.querySelectorAll('.producto-card').forEach(card => {
        const name = card.querySelector('.producto-nombre').textContent.toLowerCase();
        card.style.display = name.includes(term) ? '' : 'none';
    });
}

// Inicializar
refreshCsv();
setInterval(refreshCsv, UPDATE_INTERVAL);
searchInput.oninput = filterBySearch;

// Scroll suave
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});
