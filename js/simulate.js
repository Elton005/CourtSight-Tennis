/* ============================================
COURT SIGHT TENNIS - SIMULADOR JS
Versión Actualizada - Nueva Estructura
============================================ */

// ESTADO GLOBAL
let allPlayers = [];
let player1 = null;
let player2 = null;
let currentSurface = 'hardOut';
let simulationHistory = [];

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎾 Simulador cargado - Versión Actualizada');
    loadPlayers();
    initEventListeners();
    loadHistory();
});

// ============================================
// CARGAR JUGADORES (SIN INDEXEDDB)
// ============================================
async function loadPlayers() {
    try {
        console.log('📥 Cargando jugadores desde JSON...');
        
        const [dbRes, rankRes] = await Promise.all([
            fetch('../data/players_database.json'),
            fetch('../data/players_rank.json')
        ]);
        
        if (!dbRes.ok || !rankRes.ok) throw new Error('Error al cargar JSON');
        
        const db = await dbRes.json();
        const rank = await rankRes.json();
        
        console.log('✅ JSON cargados:', { db: db.length, rank: rank.rankings?.length });
        
        // Fusionar
        allPlayers = rank.rankings.map(r => {
            const d = db.find(p => p.id === r.id);
            if (!d) return null;
            return {
                id: r.id,
                name: d.name,
                nationality: d.nationality,
                flagUrl: d.flagUrl,
                rank: d.rank,
                elo: r.elo
            };
        }).filter(p => p !== null);
        
        console.log('✅ Total jugadores:', allPlayers.length);
        
        // UI
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('simulate-form').classList.remove('hidden');
        
    } catch (error) {
        console.error('❌ Error:', error);
        document.getElementById('loading').innerHTML = `
            <p style="color: var(--danger)">Error al cargar</p>
            <button onclick="location.reload()" class="btn-primary" style="margin-top:1rem">Reintentar</button>
        `;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
function initEventListeners() {
    // Búsquedas
    document.getElementById('player1-search').addEventListener('input', (e) => searchPlayer(e.target.value, 1));
    document.getElementById('player2-search').addEventListener('input', (e) => searchPlayer(e.target.value, 2));
    
    // Superficie
    document.getElementById('surface-select').addEventListener('change', (e) => {
        currentSurface = e.target.value;
        if (player1 && getElo(player1, currentSurface) <= 0) removePlayer(1);
        if (player2 && getElo(player2, currentSurface) <= 0) removePlayer(2);
        updateSimulateButton();
    });
    
    // Remover jugadores
    document.querySelectorAll('.remove-player').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const num = parseInt(e.target.closest('.remove-player').dataset.player);
            removePlayer(num);
        });
    });
    
    // Simular
    document.getElementById('btn-simulate').addEventListener('click', runSimulation);
    
    // Nueva simulación
    document.getElementById('btn-new').addEventListener('click', resetSimulation);
    
    // Limpiar historial
    document.getElementById('btn-clear-history').addEventListener('click', clearHistory);
    
    // Click fuera para cerrar sugerencias
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            document.querySelectorAll('.suggestions-list').forEach(el => el.classList.add('hidden'));
        }
    });
}

// ============================================
// BÚSQUEDA (SIMPLE)
// ============================================
function searchPlayer(query, playerNum) {
    query = query.toLowerCase().trim();
    if (query.length < 2) {
        hideSuggestions(playerNum);
        return;
    }
    
    const filtered = allPlayers.filter(p => {
        const elo = getElo(p, currentSurface);
        return p.name.toLowerCase().includes(query) && elo > 0;
    }).slice(0, 10);
    
    if (filtered.length === 0) {
        hideSuggestions(playerNum);
        return;
    }
    
    const container = document.getElementById(`player${playerNum}-suggestions`);
    container.innerHTML = filtered.map(p => `
        <div class="suggestion-item" data-id="${p.id}">
            <img src="../${p.flagUrl}" class="sugg-flag" onerror="this.src='../flags/unknown.png'">
            <div class="sugg-info">
                <div class="sugg-name">${escapeHtml(p.name)}</div>
                <div class="sugg-rank">Rank ${p.rank} • ${p.nationality}</div>
            </div>
        </div>
    `).join('');
    
    container.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => selectPlayer(item.dataset.id, playerNum));
    });
    
    container.classList.remove('hidden');
}

function hideSuggestions(num) {
    document.getElementById(`player${num}-suggestions`).classList.add('hidden');
}

// ============================================
// SELECCIONAR JUGADOR
// ============================================
function selectPlayer(playerId, playerNum) {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;
    
    // Validar diferente
    if (playerNum === 1 && player2 && player2.id === playerId) {
        showError('⚠️ Los jugadores deben ser diferentes');
        return;
    }
    if (playerNum === 2 && player1 && player1.id === playerId) {
        showError('⚠️ Los jugadores deben ser diferentes');
        return;
    }
    
    // Validar ELO
    const elo = getElo(player, currentSurface);
    if (elo <= 0) {
        showError(`⚠️ ${player.name} no tiene puntos en esta superficie`);
        return;
    }
    
    // Guardar
    if (playerNum === 1) player1 = { ...player, elo };
    else player2 = { ...player, elo };
    
    // Mostrar
    showSelectedPlayer(playerNum);
    document.getElementById(`player${playerNum}-search`).value = '';
    hideSuggestions(playerNum);
    hideError();
    updateSimulateButton();
}

function showSelectedPlayer(num) {
    const player = num === 1 ? player1 : player2;
    const container = document.getElementById(`player${num}-selected`);
    const searchBox = document.getElementById(`player${num}-search`).parentElement;
    
    container.querySelector('.selected-flag').src = `../${player.flagUrl}`;
    container.querySelector('.selected-name').textContent = player.name;
    container.querySelector('.selected-elo').textContent = `ELO: ${player.elo}`;
    
    container.classList.remove('hidden');
    searchBox.classList.add('hidden');

    // Actualizar dropdown de cuotas
    updateOddsDropdown();
}

function removePlayer(num) {
    if (num === 1) player1 = null;
    else player2 = null;
    
    document.getElementById(`player${num}-selected`).classList.add('hidden');
    document.getElementById(`player${num}-search`).parentElement.classList.remove('hidden');
    
    // Actualizar dropdown de cuotas
    updateOddsDropdown();
    
    updateSimulateButton();
}

function updateSimulateButton() {
    document.getElementById('btn-simulate').disabled = !(player1 && player2);
}

// ============================================
// SIMULACIÓN COMPLEJA
// ============================================
async function runSimulation() {
    if (!player1 || !player2) return;
    
    // UI: Simulando
    document.getElementById('simulate-form').classList.add('hidden');
    document.getElementById('simulating').classList.remove('hidden');
    
    // Progreso animado
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        document.getElementById('progress-fill').style.width = `${progress}%`;
        document.getElementById('progress-text').textContent = `${Math.round(progress)}%`;
    }, 100);
    
    // Calcular en siguiente tick
    setTimeout(() => {
        clearInterval(progressInterval);
        
        const results = calculateSimulation();
        
        // 100%
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('progress-text').textContent = '100%';
        
        setTimeout(() => {
            displayResults(results);
            saveToHistory(results);
            
            document.getElementById('simulating').classList.add('hidden');
            document.getElementById('results').classList.remove('hidden');
        }, 300);
    }, 1500);
}

// ============================================
// 🎯 SIMULACIÓN MEJORADA CON ELO ESPACIADO (COMPATIBLE CON NUEVA ESTRUCTURA)
// ============================================
function calculateSimulation() {
    // ⚙️ PARÁMETROS CONFIGURABLES
    const CONFIG = {
        eloDivisor: 800,        // ← Aumentado de 700 para manejar el spread extremo
        minProb: 0.12,          // ← Bajado de 0.15 para permitir más valor en underdogs reales
        maxProb: 0.90,          // ← Subido de 0.85 para respetar dominancia legítima de top 3
        simulations: 10000,     // ← Mantenido (óptimo para convergencia)
        uncertainty: 85,        // ← Aumentado de 50 por mayor ruido en datos de baja categoría
        margin: 1.05            // ← Mantenido (estándar para mercados competitivos)
    };
    
    const elo1 = player1.elo;
    const elo2 = player2.elo;
    
    // 🎯 FÓRMULA ELO MEJORADA
    const eloDiff = elo1 - elo2;
    const adjustedDiff = eloDiff / Math.sqrt(1 + Math.pow(CONFIG.uncertainty / 400, 2));
    
    let prob1 = 1 / (1 + Math.pow(10, -adjustedDiff / CONFIG.eloDivisor));
    prob1 = Math.max(CONFIG.minProb, Math.min(CONFIG.maxProb, prob1));
    const prob2 = 1 - prob1;
    
    // 🎲 SIMULACIÓN MONTE CARLO (Seed determinístico)
    const seedStr = `${player1.id}_${player2.id}_${currentSurface}`;
    const seed = hashString(seedStr);
    
    let wins1 = 0;
    for (let i = 0; i < CONFIG.simulations; i++) {
        const random = seededRandom(seed + i);
        if (random < prob1) wins1++;
    }
    
    // 📊 RESULTADOS FINALES
    const finalProb1 = (wins1 / CONFIG.simulations) * 100;
    const finalProb2 = 100 - finalProb1;
    
    const odds1 = 1 / ((finalProb1 / 100) * CONFIG.margin);
    const odds2 = 1 / ((finalProb2 / 100) * CONFIG.margin);
    
    return {
        player1: { ...player1, prob: finalProb1, odds: odds1, wins: wins1 },
        player2: { ...player2, prob: finalProb2, odds: odds2, wins: CONFIG.simulations - wins1 },
        eloDiff: Math.abs(elo1 - elo2),
        adjustedEloDiff: Math.abs(adjustedDiff),
        surface: currentSurface,
        timestamp: new Date().toISOString(),
        config: { ...CONFIG }
    };
}

// ============================================
// MOSTRAR RESULTADOS - ACTUALIZADO
// ============================================
function displayResults(data) {
    const { player1: p1, player2: p2, eloDiff, surface, timestamp } = data;
    const isP1Favorite = p1.prob > p2.prob;
    
    // Player 1 - NUEVOS SELECTORES
    const p1Card = document.querySelector('.matchup-player-card.player-1');
    p1Card.querySelector('.matchup-flag').src = `../${p1.flagUrl}`;
    p1Card.querySelector('.matchup-name').textContent = p1.name;
    p1Card.querySelector('.matchup-elo').textContent = `ELO: ${p1.elo}`;
    
    const prob1El = p1Card.querySelector('.prob-number');
    prob1El.textContent = `${p1.prob.toFixed(1)}%`;
    prob1El.className = 'prob-number ' + (isP1Favorite ? 'player-1-win' : 'player-2-win');
    
    // Cuota Jugador 1 - NUEVO SELECTOR
    p1Card.querySelector('.player-odds-card .odds-value').textContent = p1.odds.toFixed(2);
    
    // Player 2 - NUEVOS SELECTORES
    const p2Card = document.querySelector('.matchup-player-card.player-2');
    p2Card.querySelector('.matchup-flag').src = `../${p2.flagUrl}`;
    p2Card.querySelector('.matchup-name').textContent = p2.name;
    p2Card.querySelector('.matchup-elo').textContent = `ELO: ${p2.elo}`;
    
    const prob2El = p2Card.querySelector('.prob-number');
    prob2El.textContent = `${p2.prob.toFixed(1)}%`;
    prob2El.className = 'prob-number ' + (isP1Favorite ? 'player-2-win' : 'player-1-win');
    
    // Cuota Jugador 2 - NUEVO SELECTOR
    p2Card.querySelector('.player-odds-card .odds-value').textContent = p2.odds.toFixed(2);
    
    // Stats
    document.querySelector('.stat-elo-diff').textContent = `+${eloDiff}`;
    document.querySelector('.stat-confidence').textContent = getConfidence(eloDiff);
    document.querySelector('.stat-surface').textContent = getSurfaceName(surface);
    document.querySelector('.stat-time').textContent = new Date(timestamp).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});
    
    // Recomendación
    const favorite = isP1Favorite ? p1 : p2;
    displayRecommendation(favorite);
    
    // Comparación cuota casa
    checkHouseOdds(data);
}

function getConfidence(diff) {
    if (diff >= 300) return 'Muy Alta';
    if (diff >= 200) return 'Alta';
    if (diff >= 100) return 'Media';
    return 'Baja';
}

function getSurfaceName(surface) {
    const names = { hardOut: 'Dura Outdoor', hardIndoor: 'Dura Indoor', clay: 'Arcilla', grass: 'Hierba' };
    return names[surface] || surface;
}

function displayRecommendation(favorite) {
    const badge = document.getElementById('value-badge');
    const text = document.getElementById('recommendation-text');
    
    badge.className = 'value-badge value-high';
    badge.querySelector('.value-text').textContent = 'Encuentra el valor';
    text.textContent = `Si encuentras cuota un poco superior a ${favorite.odds.toFixed(2)} para ${favorite.name}, es una apuesta de VALOR recomendada.`;
}

function checkHouseOdds(data) {
    const houseOddsInput = document.getElementById('house-odds');
    const oddsPlayerSelect = document.getElementById('odds-player-select');
    const comparisonEl = document.getElementById('house-comparison');
    
    const houseOdds = parseFloat(houseOddsInput.value);
    if (!houseOdds || houseOdds < 1) {
        comparisonEl.classList.add('hidden');
        return;
    }
    
    const playerNum = oddsPlayerSelect.value;
    const selected = playerNum === '1' ? data.player1 : data.player2;
    const modelOdds = selected.odds;
    
    comparisonEl.classList.remove('hidden');
    comparisonEl.querySelector('.comp-house').textContent = houseOdds.toFixed(2);
    comparisonEl.querySelector('.comp-model').textContent = `Modelo: ${modelOdds.toFixed(2)}`;
    
    const valueBadge = comparisonEl.querySelector('.comp-value-badge');
    if (houseOdds > modelOdds * 1.05) {
        valueBadge.className = 'comp-value-badge value-high';
        valueBadge.textContent = '✅ VALOR';
    } else if (houseOdds >= modelOdds * 0.95) {
        valueBadge.className = 'comp-value-badge value-fair';
        valueBadge.textContent = '⚠️ JUSTA';
    } else {
        valueBadge.className = 'comp-value-badge value-low';
        valueBadge.textContent = '❌ SIN VALOR';
    }
}

// ============================================
// HISTORIAL
// ============================================
function saveToHistory(data) {
    const item = {
        id: Date.now(),
        p1: data.player1.name,
        p2: data.player2.name,
        winner: data.player1.prob > data.player2.prob ? data.player1.name : data.player2.name,
        prob: Math.max(data.player1.prob, data.player2.prob),
        surface: currentSurface,
        date: new Date(data.timestamp).toLocaleDateString('es-ES')
    };
    
    simulationHistory.unshift(item);
    if (simulationHistory.length > 10) simulationHistory.pop();
    
    localStorage.setItem('courtSight_history', JSON.stringify(simulationHistory));
    loadHistory();
}

function loadHistory() {
    try {
        simulationHistory = JSON.parse(localStorage.getItem('courtSight_history') || '[]');
    } catch {
        simulationHistory = [];
    }
    
    const section = document.getElementById('history-section');
    const list = document.getElementById('history-list');
    
    if (simulationHistory.length === 0) {
        section.classList.add('hidden');
        return;
    }
    
    section.classList.remove('hidden');
    list.innerHTML = simulationHistory.map(item => `
        <div class="history-item">
            <div>
                <div class="hist-players">${item.p1} vs ${item.p2}</div>
                <div class="hist-meta">${getSurfaceName(item.surface)} • ${item.date}</div>
            </div>
            <div class="hist-winner">${item.winner} (${item.prob.toFixed(1)}%)</div>
        </div>
    `).join('');
}

function clearHistory() {
    simulationHistory = [];
    localStorage.removeItem('courtSight_history');
    loadHistory();
}

// ============================================
// RESET
// ============================================
function resetSimulation() {
    player1 = null;
    player2 = null;
    
    document.getElementById('player1-selected').classList.add('hidden');
    document.getElementById('player2-selected').classList.add('hidden');
    document.getElementById('player1-search').parentElement.classList.remove('hidden');
    document.getElementById('player2-search').parentElement.classList.remove('hidden');
    document.getElementById('house-odds').value = '';
    
    document.getElementById('results').classList.add('hidden');
    document.getElementById('simulate-form').classList.remove('hidden');
    
    // Resetear dropdown a valores por defecto
    updateOddsDropdown();
    
    updateSimulateButton();
}

// ============================================
// UTILIDADES
// ============================================
function getElo(player, surface) {
    if (!player || !player.elo) return 0;
    return player.elo[surface] || 0;
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(msg) {
    const el = document.getElementById('error-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function hideError() {
    document.getElementById('error-msg').classList.add('hidden');
}

// ============================================
// ACTUALIZAR DROPDOWN DE CUOTAS CON NOMBRES
// ============================================
function updateOddsDropdown() {
    const oddsSelect = document.getElementById('odds-player-select');
    if (!oddsSelect) return;
    
    // Guardar selección actual
    const currentValue = oddsSelect.value;
    
    // Opciones dinámicas
    let options = '<option value="1">';
    options += player1 ? `🎾 ${player1.name}` : 'Jugador 1';
    options += '</option>';
    
    options += '<option value="2">';
    options += player2 ? `🎾 ${player2.name}` : 'Jugador 2';
    options += '</option>';
    
    oddsSelect.innerHTML = options;
    
    // Restaurar selección si es válida
    if (currentValue && (player1 && player2)) {
        oddsSelect.value = currentValue;
    }
}
