/* ============================================
COURT SIGHT TENNIS - BIBLIOTECA JS
Lógica Específica para la Página de Biblioteca
============================================ */

// --- ESTADO GLOBAL ---
let guides = [];
let filteredGuides = [];
let isLoading = false;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    loadGuides();
});

// ============================================
// 📥 CARGA DE DATOS DESDE JSON
// ============================================
async function loadGuides() {
    if (isLoading) return;
    
    isLoading = true;
    showLoadingState();
    
    try {
        const response = await fetch('../data/guides.json');
        
        if (!response.ok) {
            throw new Error('Error al cargar las guías');
        }
        
        guides = await response.json();
        
        // Filtrar y mostrar
        filteredGuides = [...guides];
        
        // Poblar filtro de categorías
        populateCategoryFilter();
        
        // Actualizar badges
        updateBadges();
        
        // Renderizar guías
        renderGuides();
        
    } catch (error) {
        console.error('❌ Error cargando biblioteca:', error);
        showEmptyState('Error al cargar las guías. Verifica tu conexión.');
    } finally {
        isLoading = false;
    }
}

// ============================================
// 🏷️ POBLAR FILTRO DE CATEGORÍAS
// ============================================
function populateCategoryFilter() {
    const categoryFilter = document.getElementById('category-filter');
    if (!categoryFilter) return;
    
    // Obtener categorías únicas
    const categories = [...new Set(guides.map(g => g.category))];
    
    // Limpiar opciones (mantener "Todas")
    categoryFilter.innerHTML = '<option value="all">Todas</option>';
    
    // Agregar categorías
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
    
    // Actualizar badge de categorías
    document.getElementById('total-categories').textContent = `${categories.length} categorías`;
}

// ============================================
// 🎯 FILTRADO DE GUÍAS
// ============================================
function filterGuides() {
    const searchInput = document.getElementById('search-input').value.toLowerCase();
    const categoryFilter = document.getElementById('category-filter').value;
    const difficultyFilter = document.getElementById('difficulty-filter').value;
    
    filteredGuides = guides.filter(guide => {
        // Filtro de búsqueda
        const searchMatch = 
            guide.title.toLowerCase().includes(searchInput) ||
            guide.excerpt.toLowerCase().includes(searchInput) ||
            guide.content.toLowerCase().includes(searchInput);
        
        // Filtro de categoría
        const categoryMatch = categoryFilter === 'all' || guide.category === categoryFilter;
        
        // Filtro de dificultad
        const difficultyMatch = difficultyFilter === 'all' || guide.difficulty === difficultyFilter;
        
        return searchMatch && categoryMatch && difficultyMatch;
    });
    
    renderGuides();
}

// ============================================
// 📊 RENDERIZADO DE GUÍAS
// ============================================
function renderGuides() {
    const guidesGrid = document.getElementById('guides-grid');
    const guidesContainer = document.getElementById('guides-container');
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');
    
    // Ocultar loading
    if (loadingState) loadingState.classList.add('hidden');
    
    // Validar si hay datos
    if (filteredGuides.length === 0) {
        showEmptyState();
        return;
    }
    
    // Mostrar contenedor
    if (guidesContainer) guidesContainer.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    
    // Actualizar badge de total
    document.getElementById('total-guides').textContent = `${filteredGuides.length} guía${filteredGuides.length !== 1 ? 's' : ''}`;
    
    // Generar HTML
    guidesGrid.innerHTML = filteredGuides.map((guide, index) => `
        <article class="guide-card" data-guide-id="${guide.id}" style="animation-delay: ${index * 0.05}s">
            <div class="guide-card-header">
                <span class="guide-card-category">
                    <i class="fas fa-folder"></i>
                    ${guide.category}
                </span>
                <span class="guide-card-difficulty difficulty-${guide.difficulty}">
                    <i class="fas fa-signal"></i>
                    ${getDifficultyLabel(guide.difficulty)}
                </span>
            </div>
            <h3 class="guide-card-title">${escapeHtml(guide.title)}</h3>
            <p class="guide-card-excerpt">${escapeHtml(guide.excerpt)}</p>
            <div class="guide-card-meta">
                <span>
                    <i class="fas fa-clock"></i>
                    ${guide.readTime} min
                </span>
                <span class="guide-card-read">
                    Leer más
                    <i class="fas fa-arrow-right"></i>
                </span>
            </div>
        </article>
    `).join('');
    
    // Agregar event listeners a las tarjetas
    document.querySelectorAll('.guide-card').forEach(card => {
        card.addEventListener('click', () => {
            const guideId = card.getAttribute('data-guide-id');
            openGuideModal(guideId);
        });
    });
}

// ============================================
// 📖 ABRIR MODAL DE GUÍA
// ============================================
function openGuideModal(guideId) {
    const guide = guides.find(g => g.id === guideId);
    if (!guide) return;
    
    const modal = document.getElementById('guide-modal');
    const modalCategory = document.getElementById('modal-category');
    const modalDifficulty = document.getElementById('modal-difficulty');
    const modalTitle = document.getElementById('modal-title');
    const modalMeta = document.getElementById('modal-meta');
    const modalBody = document.getElementById('modal-body');
    
    // Llenar datos
    modalCategory.textContent = guide.category;
    modalDifficulty.textContent = getDifficultyLabel(guide.difficulty);
    modalDifficulty.className = `modal-difficulty difficulty-${guide.difficulty}`;
    modalTitle.textContent = guide.title;
    
    modalMeta.innerHTML = `
        <span><i class="fas fa-clock"></i> ${guide.readTime} min de lectura</span>
        <span><i class="fas fa-calendar"></i> ${guide.updatedAt}</span>
        <span><i class="fas fa-user"></i> ${guide.author || 'CourtSight'}</span>
    `;
    
    // Renderizar contenido (soporta HTML básico)
    modalBody.innerHTML = formatGuideContent(guide.content);
    
    // Mostrar modal
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// ============================================
// ❌ CERRAR MODAL
// ============================================
function closeGuideModal() {
    const modal = document.getElementById('guide-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// ============================================
// 📝 FORMATEAR CONTENIDO DE GUÍA
// ============================================
function formatGuideContent(content) {
    // Convertir saltos de línea a párrafos
    let formatted = content.replace(/\n\n/g, '</p><p>');
    formatted = `<p>${formatted}</p>`;
    
    // Negritas
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Listas
    formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>');
    
    return formatted;
}

// ============================================
// 🏷️ OBTENER LABEL DE DIFICULTAD
// ============================================
function getDifficultyLabel(difficulty) {
    const labels = {
        beginner: 'Principiante',
        intermediate: 'Intermedio',
        advanced: 'Avanzado',
        expert: 'Experto'
    };
    return labels[difficulty] || difficulty;
}

// ============================================
// 🎨 ACTUALIZAR BADGES
// ============================================
function updateBadges() {
    document.getElementById('total-guides').textContent = `${guides.length} guías`;
    
    const categories = [...new Set(guides.map(g => g.category))];
    document.getElementById('total-categories').textContent = `${categories.length} categorías`;
}

// ============================================
// 🔍 INICIALIZAR FILTROS
// ============================================
function initFilters() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const difficultyFilter = document.getElementById('difficulty-filter');
    const modalClose = document.getElementById('modal-close');
    const modalBack = document.getElementById('modal-back');
    const modalOverlay = document.querySelector('.modal-overlay');
    
    // Event listeners para filtros
    if (searchInput) {
        searchInput.addEventListener('input', filterGuides);
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterGuides);
    }
    
    if (difficultyFilter) {
        difficultyFilter.addEventListener('change', filterGuides);
    }
    
    // Cerrar modal
    if (modalClose) {
        modalClose.addEventListener('click', closeGuideModal);
    }
    
    if (modalBack) {
        modalBack.addEventListener('click', closeGuideModal);
    }
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeGuideModal);
    }
    
    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeGuideModal();
        }
    });
}

// ============================================
// 📭 ESTADOS DE LA UI
// ============================================
function showLoadingState() {
    const loadingState = document.getElementById('loading-state');
    const guidesContainer = document.getElementById('guides-container');
    const emptyState = document.getElementById('empty-state');
    
    if (loadingState) loadingState.classList.remove('hidden');
    if (guidesContainer) guidesContainer.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
}

function showEmptyState(message = 'No se encontraron guías con los filtros seleccionados') {
    const emptyState = document.getElementById('empty-state');
    const guidesContainer = document.getElementById('guides-container');
    const loadingState = document.getElementById('loading-state');
    
    if (loadingState) loadingState.classList.add('hidden');
    if (guidesContainer) guidesContainer.classList.add('hidden');
    if (emptyState) {
        emptyState.classList.remove('hidden');
        const messageEl = emptyState.querySelector('p');
        if (messageEl) messageEl.textContent = message;
    }
}

// ============================================
// 🔒 SEGURIDAD - ESCAPAR HTML
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// 📤 EXPORTAR FUNCIONES GLOBALES
// ============================================
window.CourtSightBiblioteca = {
    refresh: loadGuides,
    getGuides: () => guides,
    getFilteredGuides: () => filteredGuides
};

// ============================================
// 💬 MENSAJE DE CONSOLA - DEBUG
// ============================================
console.log('📚 Biblioteca JS cargado correctamente');
console.log('🔧 Funciones globales: window.CourtSightBiblioteca');