/* ============================================
COURT SIGHT TENNIS - RANKING ELO JS
Lógica Específica para la Página de Ranking ELO
============================================ */

// --- CONFIGURACIÓN ---
const RANKING_CONFIG = {
    surfaces: {
        total: { name: 'General', icon: 'fa-globe', class: 'surface-total' },
        hardOut: { name: 'Dura Outdoor', icon: 'fa-circle', class: 'surface-hard-outdoor' },
        hardIndoor: { name: 'Dura Indoor', icon: 'fa-house-chimney', class: 'surface-hard-indoor' },
        clay: { name: 'Arcilla', icon: 'fa-mound', class: 'surface-clay' },
        grass: { name: 'Hierba', icon: 'fa-seedling', class: 'surface-grass' }
    },
    defaultSurface: 'total',
    minElo: 0
};

// --- ESTADO GLOBAL ---
let playersDatabase = [];
let playersRank = [];
let mergedPlayers = [];
let currentSurface = RANKING_CONFIG.defaultSurface;
let isLoading = false;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initSurfaceSelector();
    loadRankingData();
});

// ============================================
// 📥 CARGA DE DATOS DESDE JSON
// ============================================
async function loadRankingData() {
    if (isLoading) return;
    
    isLoading = true;
    showLoadingState();
    
    try {
        // Fetch paralelo de ambos JSON
        const [dbResponse, rankResponse] = await Promise.all([
            fetch('../data/players_database.json'),
            fetch('../data/players_rank.json')
        ]);
        
        if (!dbResponse.ok || !rankResponse.ok) {
            throw new Error('Error al cargar los datos');
        }
        
        playersDatabase = await dbResponse.json();
        playersRank = await rankResponse.json();
        
        // Actualizar badge de fecha
        updateDateBadge(playersRank.date);
        
        // Fusionar datos y renderizar
        mergeAndRenderPlayers();
        
    } catch (error) {
        console.error('❌ Error cargando ranking:', error);
        showEmptyState('Error al cargar los datos. Verifica tu conexión.');
    } finally {
        isLoading = false;
    }
}

// ============================================
// 🔗 FUSIÓN DE DATOS (DATABASE + RANK)
// ============================================
function mergeAndRenderPlayers() {
    // Cruzar datos por ID
    mergedPlayers = playersRank.rankings.map(rankPlayer => {
        const dbPlayer = playersDatabase.find(p => p.id === rankPlayer.id);
        
        if (!dbPlayer) {
            console.warn(`⚠️ Jugador sin datos en database: ${rankPlayer.id}`);
            return null;
        }
        
        return {
            id: rankPlayer.id,
            name: dbPlayer.name,
            nationality: dbPlayer.nationality,
            flagCode: dbPlayer.flagCode,
            flagUrl: dbPlayer.flagUrl,
            elo: rankPlayer.elo,
            atpPoints: rankPlayer.atpPoints
        };
    }).filter(player => player !== null);
    
    // Renderizar con la superficie actual
    renderRanking(currentSurface);
}

// ============================================
// 🧮 CÁLCULO DE ELO POR SUPERFICIE
// ============================================
function calculateElo(player, surface) {
    if (surface === 'total') {
        // Suma de todas las superficies
        const elo = player.elo;
        return (elo.hardOut || 0) + 
               (elo.hardIndoor || 0) + 
               (elo.clay || 0) + 
               (elo.grass || 0);
    } else {
        // Valor directo de la superficie específica
        return player.elo[surface] || 0;
    }
}

// ============================================
// 🎯 FILTRADO Y ORDENAMIENTO
// ============================================
function filterAndSortPlayers(surface) {
    return mergedPlayers
        .map(player => ({
            ...player,
            calculatedElo: calculateElo(player, surface)
        }))
        .filter(player => player.calculatedElo > RANKING_CONFIG.minElo)
        .sort((a, b) => b.calculatedElo - a.calculatedElo);
}

// ============================================
// 📊 RENDERIZADO DE LA TABLA
// ============================================
function renderRanking(surface) {
    const filteredPlayers = filterAndSortPlayers(surface);
    const rankingBody = document.getElementById('ranking-body');
    const rankingContainer = document.getElementById('ranking-container');
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');
    
    // Ocultar loading
    if (loadingState) loadingState.classList.add('hidden');
    
    // Validar si hay datos
    if (filteredPlayers.length === 0) {
        showEmptyState();
        return;
    }
    
    // Mostrar contenedor de ranking
    if (rankingContainer) rankingContainer.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    
    // Actualizar badge de cantidad de jugadores
    updatePlayerCountBadge(filteredPlayers.length);
    
    // Actualizar badge de superficie
    updateSurfaceBadge(surface);
    
    // Generar HTML de la tabla
    rankingBody.innerHTML = filteredPlayers.map((player, index) => {
        const position = index + 1;
        const rankClass = position <= 3 ? `rank-${position}` : '';
        const trophyIcon = position <= 3 ? '<i class="fas fa-trophy rank-trophy"></i>' : '';
        
        return `
            <tr class="${rankClass}">
                <td class="col-pos">
                    ${position}${trophyIcon}
                </td>
                <td class="col-player">
                    <div class="player-info">
                        <img 
                            src="../${player.flagUrl}" 
                            alt="${player.nationality}" 
                            class="player-flag"
                            onerror="this.src='../flags/unknown.png'"
                        >
                        <span class="player-name">${escapeHtml(player.name)}</span>
                    </div>
                </td>
                <td class="col-country">
                    <span class="player-country-code">${player.nationality}</span>
                </td>
                <td class="col-elo" data-elo-tooltip="${player.calculatedElo} pts">
                    ${player.calculatedElo.toLocaleString('es-ES')}
                </td>
            </tr>
        `;
    }).join('');
    
    // Agregar animación de entrada
    animateTableRows();
}

// ============================================
// 🎨 ACTUALIZACIÓN DE BADGES
// ============================================
function updateDateBadge(dateString) {
    const dateEl = document.getElementById('update-date');
    if (!dateEl || !dateString) return;
    
    const date = new Date(dateString);
    const formattedDate = date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    
    dateEl.textContent = formattedDate;
}

function updatePlayerCountBadge(count) {
    const countEl = document.getElementById('player-count');
    if (!countEl) return;
    
    countEl.textContent = `${count} jugador${count !== 1 ? 'es' : ''}`;
}

function updateSurfaceBadge(surface) {
    const surfaceEl = document.getElementById('surface-name');
    if (!surfaceEl) return;
    
    const surfaceInfo = RANKING_CONFIG.surfaces[surface];
    surfaceEl.textContent = surfaceInfo ? surfaceInfo.name : 'Desconocida';
}

// ============================================
// 🎾 SELECTOR DE SUPERFICIE (DESPLEGABLE)
// ============================================
function initSurfaceSelector() {
    const surfaceSelect = document.getElementById('surface-select');
    
    if (!surfaceSelect) return;
    
    surfaceSelect.addEventListener('change', () => {
        const surface = surfaceSelect.value;
        
        if (!surface || surface === currentSurface) return;
        
        // Actualizar superficie actual
        currentSurface = surface;
        
        // Actualizar clase del body para cambio de color
        updateBodySurfaceClass(surface);
        
        // Actualizar badge de superficie
        updateSurfaceBadge(surface);
        
        // Re-renderizar ranking con animación
        renderRankingWithTransition(surface);
    });
}

function updateBodySurfaceClass(surface) {
    const body = document.body;
    const surfaceInfo = RANKING_CONFIG.surfaces[surface];
    
    if (!surfaceInfo) return;
    
    // Remover todas las clases de superficie
    Object.values(RANKING_CONFIG.surfaces).forEach(s => {
        body.classList.remove(s.class);
    });
    
    // Agregar nueva clase con transición suave
    body.classList.add('surface-transition');
    body.classList.add(surfaceInfo.class);
    
    // Remover clase de transición después de la animación
    setTimeout(() => {
        body.classList.remove('surface-transition');
    }, 300);
}

function renderRankingWithTransition(surface) {
    const rankingContainer = document.getElementById('ranking-container');
    
    if (rankingContainer) {
        rankingContainer.style.opacity = '0';
        rankingContainer.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            renderRanking(surface);
            rankingContainer.style.transition = 'all 0.3s ease';
            rankingContainer.style.opacity = '1';
            rankingContainer.style.transform = 'translateY(0)';
        }, 150);
    } else {
        renderRanking(surface);
    }
}

// ============================================
// 📭 ESTADOS DE LA UI
// ============================================
function showLoadingState() {
    const loadingState = document.getElementById('loading-state');
    const rankingContainer = document.getElementById('ranking-container');
    const emptyState = document.getElementById('empty-state');
    
    if (loadingState) loadingState.classList.remove('hidden');
    if (rankingContainer) rankingContainer.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
}

function showEmptyState(message = 'No hay jugadores con puntos ELO en esta superficie') {
    const emptyState = document.getElementById('empty-state');
    const rankingContainer = document.getElementById('ranking-container');
    const loadingState = document.getElementById('loading-state');
    const playerCountEl = document.getElementById('player-count');
    
    if (loadingState) loadingState.classList.add('hidden');
    if (rankingContainer) rankingContainer.classList.add('hidden');
    if (emptyState) {
        emptyState.classList.remove('hidden');
        const messageEl = emptyState.querySelector('p');
        if (messageEl) messageEl.textContent = message;
    }
    if (playerCountEl) playerCountEl.textContent = '0 jugadores';
}

// ============================================
// 🎬 ANIMACIONES DE TABLA
// ============================================
function animateTableRows() {
    const rows = document.querySelectorAll('.ranking-table tbody tr');
    
    rows.forEach((row, index) => {
        row.style.animationDelay = `${index * 0.05}s`;
    });
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
// 🔄 REFRESCAR DATOS (OPCIONAL)
// ============================================
function refreshRanking() {
    currentSurface = RANKING_CONFIG.defaultSurface;
    
    // Resetear botones
    document.querySelectorAll('.surface-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-surface') === currentSurface);
    });
    
    // Resetear clase del body
    updateBodySurfaceClass(currentSurface);
    
    // Recargar datos
    loadRankingData();
}

// ============================================
// 📤 EXPORTAR FUNCIONES GLOBALES
// ============================================
window.CourtSightRanking = {
    refresh: refreshRanking,
    getCurrentSurface: () => currentSurface,
    getPlayers: () => mergedPlayers,
    config: RANKING_CONFIG
};

// ============================================
// 💬 MENSAJE DE CONSOLA - DEBUG
// ============================================
console.log('🎾 Ranking ELO JS cargado correctamente');
console.log('📊 Superficies disponibles:', Object.keys(RANKING_CONFIG.surfaces));
console.log('🔧 Funciones globales: window.CourtSightRanking');