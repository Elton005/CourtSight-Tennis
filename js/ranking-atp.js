/* ============================================
COURT SIGHT TENNIS - RANKING ATP JS
Lógica Específica para la Página de Ranking ATP
============================================ */

// --- ESTADO GLOBAL ---
let playersDatabase = [];
let playersRank = [];
let mergedPlayers = [];
let isLoading = false;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
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
        console.error('❌ Error cargando ranking ATP:', error);
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
            atpPoints: rankPlayer.atpPoints || 0,
            elo: rankPlayer.elo
        };
    }).filter(player => player !== null);
    
    // Renderizar ranking
    renderRanking();
}

// ============================================
// 🎯 ORDENAMIENTO POR PUNTOS ATP
// ============================================
function sortPlayersByAtp() {
    return mergedPlayers
        .filter(player => player.atpPoints > 0)
        .sort((a, b) => b.atpPoints - a.atpPoints);
}

// ============================================
// 📊 RENDERIZADO DE LA TABLA
// ============================================
function renderRanking() {
    const sortedPlayers = sortPlayersByAtp();
    const rankingBody = document.getElementById('ranking-body');
    const rankingContainer = document.getElementById('ranking-container');
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');
    
    // Ocultar loading
    if (loadingState) loadingState.classList.add('hidden');
    
    // Validar si hay datos
    if (sortedPlayers.length === 0) {
        showEmptyState();
        return;
    }
    
    // Mostrar contenedor de ranking
    if (rankingContainer) rankingContainer.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    
    // Actualizar badge de cantidad de jugadores
    updatePlayerCountBadge(sortedPlayers.length);
    
    // Generar HTML de la tabla
    rankingBody.innerHTML = sortedPlayers.map((player, index) => {
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
                <td class="col-atp" data-atp-tooltip="${player.atpPoints} pts">
                    ${player.atpPoints.toLocaleString('es-ES')}
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

function showEmptyState(message = 'No hay jugadores con puntos ATP disponibles') {
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
// 📤 EXPORTAR FUNCIONES GLOBALES
// ============================================
window.CourtSightATP = {
    refresh: loadRankingData,
    getPlayers: () => mergedPlayers
};

// ============================================
// 💬 MENSAJE DE CONSOLA - DEBUG
// ============================================
console.log('🎾 Ranking ATP JS cargado correctamente');
console.log('🔧 Funciones globales: window.CourtSightATP');