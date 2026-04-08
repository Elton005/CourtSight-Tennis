/* ============================================
COURT SIGHT TENNIS - SIMULADOR JS
Versión Final: Pesos 60/40, sin racha/importancia, bug corregido
============================================ */

// ESTADO GLOBAL (MANTENIDO COMPATIBLE)
let allPlayers = [];
let player1 = null;
let player2 = null;
let currentSurface = 'hardOut';
let simulationHistory = [];

// Ajustes por jugador
const playerAdjustments = {
    1: { total: 0, selections: {} },
    2: { total: 0, selections: {} }
};
let adjustingPlayer = null;

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎾 Simulador cargado - Lógica corregida');
    loadPlayers();
    initEventListeners();
    loadHistory();
});

// CARGAR JUGADORES
async function loadPlayers() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        
        const [dbRes, rankRes] = await Promise.all([
            fetch('../data/players_database.json', { signal: controller.signal }),
            fetch('../data/players_rank.json', { signal: controller.signal })
        ]);
        clearTimeout(timeout);
        
        if (!dbRes.ok || !rankRes.ok) throw new Error('Error al cargar JSON');
        const db = await dbRes.json();
        const rank = await rankRes.json();
        
        const dbMap = new Map(db.map(p => [p.id, p]));
        allPlayers = rank.rankings.map(r => {
            const d = dbMap.get(r.id);
            if (!d) return null;
            return { id: r.id, name: d.name, nationality: d.nationality, flagUrl: d.flagUrl, rank: d.rank, elo: r.elo };
        }).filter(p => p !== null);
        
        console.log('✅ Jugadores cargados:', allPlayers.length);
        document.getElementById('loading')?.classList.add('hidden');
        document.getElementById('simulate-form')?.classList.remove('hidden');
    } catch (error) {
        console.error('❌ Error:', error);
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.innerHTML = `<p style="color: var(--danger)">Error al cargar</p><button onclick="location.reload()" class="btn-primary" style="margin-top:1rem">Reintentar</button>`;
    }
}

// EVENT LISTENERS
function initEventListeners() {
    const p1Search = document.getElementById('player1-search');
    const p2Search = document.getElementById('player2-search');
    if (p1Search) p1Search.addEventListener('input', (e) => searchPlayer(e.target.value, 1));
    if (p2Search) p2Search.addEventListener('input', (e) => searchPlayer(e.target.value, 2));
    
    const surfaceSelect = document.getElementById('surface-select');
    if (surfaceSelect) {
        surfaceSelect.addEventListener('change', (e) => {
            currentSurface = e.target.value;
            if (player1 && getElo(player1, currentSurface) <= 0) removePlayer(1);
            if (player2 && getElo(player2, currentSurface) <= 0) removePlayer(2);
            updateSimulateButton();
        });
    }
    
    document.addEventListener('click', (e) => {
        if (e.target.closest('.remove-player')) removePlayer(parseInt(e.target.closest('.remove-player').dataset.player));
        if (e.target.closest('.btn-adjust')) openAdjustPanel(parseInt(e.target.closest('.btn-adjust').dataset.player));
    });
    
    const btnSimulate = document.getElementById('btn-simulate');
    if (btnSimulate) btnSimulate.addEventListener('click', runSimulation);
    
    const btnNew = document.getElementById('btn-new');
    if (btnNew) btnNew.addEventListener('click', resetSimulation);
    
    const btnClear = document.getElementById('btn-clear-history');
    if (btnClear) btnClear.addEventListener('click', clearHistory);
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) document.querySelectorAll('.suggestions-list').forEach(el => el.classList.add('hidden'));
    });
    
    const btnClose = document.querySelector('#adjust-panel .btn-close');
    if (btnClose) btnClose.addEventListener('click', closeAdjustPanel);
    
    const btnApply = document.getElementById('btn-apply-adjustments');
    if (btnApply) btnApply.addEventListener('click', () => { applyContextAdjustments(); closeAdjustPanel(); });
}

// BÚSQUEDA
function searchPlayer(query, playerNum) {
    query = query.toLowerCase().trim();
    if (query.length < 2) { hideSuggestions(playerNum); return; }
    const filtered = allPlayers.filter(p => p.name.toLowerCase().includes(query) && getElo(p, currentSurface) > 0).slice(0, 10);
    if (filtered.length === 0) { hideSuggestions(playerNum); return; }
    
    const container = document.getElementById(`player${playerNum}-suggestions`);
    if (!container) return;
    container.innerHTML = filtered.map(p => `
        <div class="suggestion-item" data-id="${p.id}" role="option">
            <img src="../${p.flagUrl}" class="sugg-flag" onerror="this.src='../flags/unknown.png'" alt="">
            <div class="sugg-info">
                <div class="sugg-name">${escapeHtml(p.name)}</div>
                <div class="sugg-rank">Rank ${p.rank} • ${escapeHtml(p.nationality)}</div>
            </div>
        </div>
    `).join('');
    container.querySelectorAll('.suggestion-item').forEach(item => item.addEventListener('click', () => selectPlayer(item.dataset.id, playerNum)));
    container.classList.remove('hidden');
}
function hideSuggestions(num) { const el = document.getElementById(`player${num}-suggestions`); if (el) el.classList.add('hidden'); }

// SELECCIONAR JUGADOR
function selectPlayer(playerId, playerNum) {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;
    if ((playerNum === 1 && player2?.id === playerId) || (playerNum === 2 && player1?.id === playerId)) {
        showError('⚠️ Los jugadores deben ser diferentes'); return;
    }
    const elo = getElo(player, currentSurface);
    if (elo <= 0) { showError(`⚠️ ${player.name} no tiene puntos en esta superficie`); return; }
    
    if (playerNum === 1) player1 = { ...player, elo }; else player2 = { ...player, elo };
    playerAdjustments[playerNum] = { total: 0 }; // Resetear ajustes al cambiar
    showSelectedPlayer(playerNum);
    const searchInput = document.getElementById(`player${playerNum}-search`);
    if (searchInput) searchInput.value = '';
    hideSuggestions(playerNum); hideError(); updateSimulateButton(); updateOddsDropdown();
}

function showSelectedPlayer(num) {
    const player = num === 1 ? player1 : player2;
    if (!player) return;
    const container = document.getElementById(`player${num}-selected`);
    const searchBox = document.getElementById(`player${num}-search`)?.parentElement;
    if (!container) return;
    
    const flagEl = container.querySelector('.selected-flag');
    const nameEl = container.querySelector('.selected-name');
    const eloEl = container.querySelector('.selected-elo');
    if (flagEl) flagEl.src = `../${player.flagUrl}`;
    if (nameEl) nameEl.textContent = player.name;
    if (eloEl) eloEl.textContent = `ELO: ${player.elo}`;
    
    container.classList.remove('hidden');
    if (searchBox) searchBox.classList.add('hidden');
    updateOddsDropdown();
}

function removePlayer(num) {
    if (num === 1) { player1 = null; playerAdjustments[1] = { total: 0 }; }
    else { player2 = null; playerAdjustments[2] = { total: 0 }; }
    const selectedEl = document.getElementById(`player${num}-selected`);
    const searchEl = document.getElementById(`player${num}-search`);
    if (selectedEl) selectedEl.classList.add('hidden');
    if (searchEl?.parentElement) searchEl.parentElement.classList.remove('hidden');
    updateOddsDropdown(); updateSimulateButton();
}
function updateSimulateButton() { const btn = document.getElementById('btn-simulate'); if (btn) btn.disabled = !(player1 && player2); }

// PANEL DE AJUSTES
// ✅ CORREGIDO: Carga las selecciones previas al abrir el panel
function openAdjustPanel(playerNum) {
    const player = playerNum === 1 ? player1 : player2;
    if (!player) { showError('⚠️ Selecciona un jugador primero'); return; }
    
    adjustingPlayer = playerNum;
    const panel = document.getElementById('adjust-panel');
    const playerNameEl = document.getElementById('adjust-player-name');
    
    if (panel && playerNameEl) {
        panel.dataset.adjustingPlayer = playerNum;
        playerNameEl.textContent = player.name;
        
        // OBTENER SELECCIONES GUARDADAS
        const saved = playerAdjustments[playerNum]?.selections;
        
        // RECORRER TODOS LOS RADIOS Y MARCAR LOS GUARDADOS
        // Si no hay guardados (primera vez), marca el primero por defecto
        document.querySelectorAll('#adjust-panel input[type="radio"]').forEach(radio => {
            const name = radio.name;
            const value = radio.value;
            
            // Si tenemos selección guardada para este nombre y coincide con este valor -> checked
            if (saved && saved[name] === value) {
                radio.checked = true;
            } 
            // Si NO hay selección guardada, marcar el primero (checked por defecto en HTML)
            else if (!saved) {
                // Solo marcamos el primero de cada grupo
                const group = document.querySelector(`input[name="${name}"]`);
                if (group && group === radio) radio.checked = true;
            }
        });
        
        panel.classList.remove('hidden');
        void panel.offsetWidth; // Forzar reflow
        panel.classList.add('active');
    }
}

function closeAdjustPanel() {
    const panel = document.getElementById('adjust-panel');
    if (!panel) return;
    panel.classList.remove('active');
    setTimeout(() => { panel.classList.add('hidden'); adjustingPlayer = null; }, 400);
}

// ✅ LÓGICA CORREGIDA: Guarda selecciones y calcula
function applyContextAdjustments() {
    if (!adjustingPlayer) return;
    
    // 1. Capturar y guardar selecciones actuales
    const selections = {
        'form-5matches': document.querySelector('input[name="form-5matches"]:checked')?.value,
        'form-quality': document.querySelector('input[name="form-quality"]:checked')?.value,
        'form-rivals': document.querySelector('input[name="form-rivals"]:checked')?.value,
        'context-participation': document.querySelector('input[name="context-participation"]:checked')?.value,
        'context-best': document.querySelector('input[name="context-best"]:checked')?.value
    };

    // 2. Calcular totales
    const form5 = parseInt(selections['form-5matches'] || 5);
    const quality = parseInt(selections['form-quality'] || 3);
    const rivals = parseInt(selections['form-rivals'] || 4);
    const ctxPart = parseInt(selections['context-participation'] || 10);
    const ctxBest = parseInt(selections['context-best'] || 8);

    const formaAjuste = (form5 + quality + rivals) * 0.6;
    const contextoAjuste = (ctxPart + ctxBest) * 0.4;
    
    const totalAdjust = Math.max(-35, Math.min(35, formaAjuste + contextoAjuste));
    
    // 3. Guardar todo en el estado (ajuste + selecciones)
    playerAdjustments[adjustingPlayer] = { 
        total: totalAdjust, 
        selections: selections 
    };
    
    console.log(`✅ Ajustes guardados para Jugador ${adjustingPlayer}`);
    showError(`✓ Ajustes guardados (${totalAdjust > 0 ? '+' : ''}${totalAdjust.toFixed(1)}%)`);
}

// SIMULACIÓN
async function runSimulation() {
    if (!player1 || !player2) return;
    const formEl = document.getElementById('simulate-form');
    const simEl = document.getElementById('simulating');
    if (formEl) formEl.classList.add('hidden');
    if (simEl) simEl.classList.remove('hidden');
    
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress = Math.min(90, progress + 2);
        const fillEl = document.getElementById('progress-fill');
        const textEl = document.getElementById('progress-text');
        if (fillEl) fillEl.style.width = `${progress}%`;
        if (textEl) textEl.textContent = `${Math.round(progress)}%`;
    }, 50);
    
    setTimeout(() => {
        clearInterval(progressInterval);
        const results = calculateSimulation();
        const fillEl = document.getElementById('progress-fill');
        const textEl = document.getElementById('progress-text');
        if (fillEl) fillEl.style.width = '100%';
        if (textEl) textEl.textContent = '100%';
        
        setTimeout(() => {
            displayResults(results);
            saveToHistory(results);
            if (simEl) simEl.classList.add('hidden');
            const resultsEl = document.getElementById('results');
            if (resultsEl) resultsEl.classList.remove('hidden');
        }, 300);
    }, 1500);
}

function calculateSimulation() {
    const elo1 = player1.elo;
    const elo2 = player2.elo;
    const CONFIG = { eloDivisor: 800, minProb: 0.12, maxProb: 0.90, simulations: 10000, uncertainty: 85, margin: 1.05 };
    
    const eloDiff = elo1 - elo2;
    const adjustedDiff = eloDiff / Math.sqrt(1 + Math.pow(CONFIG.uncertainty / 400, 2));
    let baseProb1 = 1 / (1 + Math.pow(10, -adjustedDiff / CONFIG.eloDivisor));
    baseProb1 = Math.max(CONFIG.minProb, Math.min(CONFIG.maxProb, baseProb1));
    
    // ✅ APLICAR AJUSTES CORREGIDOS
    const adj1 = playerAdjustments[1]?.total || 0;
    const adj2 = playerAdjustments[2]?.total || 0;
    const netAdjust = (adj1 - adj2) / 100; // Diferencia neta en probabilidad decimal
    
    let finalProb1 = baseProb1 + netAdjust;
    finalProb1 = Math.max(CONFIG.minProb, Math.min(CONFIG.maxProb, finalProb1));
    
    const seed = Math.abs(`${player1.id}_${player2.id}_${currentSurface}`.split('').reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0)) & b, 0));
    let wins1 = 0;
    for (let i = 0; i < CONFIG.simulations; i++) {
        const x = Math.sin(seed + i) * 10000;
        if ((x - Math.floor(x)) < finalProb1) wins1++;
    }
    
    const simProb1 = (wins1 / CONFIG.simulations) * 100;
    const simProb2 = 100 - simProb1;
    const odds1 = 1 / ((simProb1 / 100) * CONFIG.margin);
    const odds2 = 1 / ((simProb2 / 100) * CONFIG.margin);
    
    return {
        player1: { ...player1, prob: simProb1, odds: odds1, wins: wins1 },
        player2: { ...player2, prob: simProb2, odds: odds2, wins: CONFIG.simulations - wins1 },
        eloDiff: Math.abs(elo1 - elo2), adjustedEloDiff: Math.abs(adjustedDiff),
        surface: currentSurface, timestamp: new Date().toISOString(),
        adjustments: { player1: adj1, player2: adj2 }
    };
}

// RESULTADOS & UTILIDADES
function displayResults(data) {
    const { player1: p1, player2: p2, eloDiff, surface, timestamp } = data;
    const isP1Favorite = p1.prob > p2.prob;
    
    ['.matchup-player-card.player-1', '.matchup-player-card.player-2'].forEach(selector => {
        const isP1 = selector.includes('player-1');
        const p = isP1 ? p1 : p2;
        const card = document.querySelector(selector);
        if (card) {
            card.querySelector('.matchup-flag')?.setAttribute('src', `../${p.flagUrl}`);
            card.querySelector('.matchup-name').textContent = p.name;
            card.querySelector('.matchup-elo').textContent = `ELO: ${p.elo}`;
            const probEl = card.querySelector('.prob-number');
            probEl.textContent = `${p.prob.toFixed(1)}%`;
            probEl.className = 'prob-number ' + (isP1Favorite ? (isP1 ? 'player-1-win' : 'player-2-win') : (isP1 ? 'player-2-win' : 'player-1-win'));
            card.querySelector('.player-odds-card .odds-value').textContent = p.odds.toFixed(2);
        }
    });
    
    document.querySelector('.stat-elo-diff').textContent = `+${eloDiff}`;
    document.querySelector('.stat-confidence').textContent = getConfidence(eloDiff);
    document.querySelector('.stat-surface').textContent = getSurfaceName(surface);
    document.querySelector('.stat-time').textContent = new Date(timestamp).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});
    
    const favorite = isP1Favorite ? p1 : p2;
    const badge = document.getElementById('value-badge');
    const text = document.getElementById('recommendation-text');
    if (badge && text) {
        badge.className = 'value-badge value-high';
        badge.querySelector('.value-text').textContent = 'Encuentra el valor';
        text.textContent = `Si encuentras cuota mayor que ${favorite.odds.toFixed(2)} para ${favorite.name}, es una apuesta de VALOR recomendada.`;
    }
    checkHouseOdds(data);
}

function getConfidence(diff) { if (diff >= 300) return 'Muy Alta'; if (diff >= 200) return 'Alta'; if (diff >= 100) return 'Media'; return 'Baja'; }
function getSurfaceName(surface) { return { hardOut: 'Dura Outdoor', hardIndoor: 'Dura Indoor', clay: 'Arcilla', grass: 'Hierba' }[surface] || surface; }
function checkHouseOdds(data) {
    const houseOddsInput = document.getElementById('house-odds');
    const oddsPlayerSelect = document.getElementById('odds-player-select');
    const comparisonEl = document.getElementById('house-comparison');
    if (!comparisonEl) return;
    const houseOdds = parseFloat(houseOddsInput?.value);
    if (!houseOdds || houseOdds < 1) { comparisonEl.classList.add('hidden'); return; }
    const playerNum = oddsPlayerSelect?.value;
    const selected = playerNum === '1' ? data.player1 : data.player2;
    const modelOdds = selected.odds;
    comparisonEl.classList.remove('hidden');
    comparisonEl.querySelector('.comp-house').textContent = houseOdds.toFixed(2);
    comparisonEl.querySelector('.comp-model').textContent = `Modelo: ${modelOdds.toFixed(2)}`;
    const valueBadge = comparisonEl.querySelector('.comp-value-badge');
    if (valueBadge) {
        if (houseOdds > modelOdds * 1.05) { valueBadge.className = 'comp-value-badge value-high'; valueBadge.textContent = '✅ VALOR'; }
        else if (houseOdds >= modelOdds * 0.95) { valueBadge.className = 'comp-value-badge value-fair'; valueBadge.textContent = '⚠️ JUSTA'; }
        else { valueBadge.className = 'comp-value-badge value-low'; valueBadge.textContent = '❌ SIN VALOR'; }
    }
}

function saveToHistory(data) {
    const item = { id: Date.now(), p1: data.player1.name, p2: data.player2.name, winner: data.player1.prob > data.player2.prob ? data.player1.name : data.player2.name, prob: Math.max(data.player1.prob, data.player2.prob), surface: currentSurface, date: new Date(data.timestamp).toLocaleDateString('es-ES') };
    simulationHistory.unshift(item);
    if (simulationHistory.length > 10) simulationHistory.pop();
    localStorage.setItem('courtSight_history', JSON.stringify(simulationHistory));
    loadHistory();
}

function loadHistory() {
    try { simulationHistory = JSON.parse(localStorage.getItem('courtSight_history') || '[]'); } catch { simulationHistory = []; }
    const section = document.getElementById('history-section');
    const list = document.getElementById('history-list');
    if (!section || !list) return;
    if (simulationHistory.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    list.innerHTML = simulationHistory.map(item => `
        <div class="history-item"><div><div class="hist-players">${escapeHtml(item.p1)} vs ${escapeHtml(item.p2)}</div><div class="hist-meta">${getSurfaceName(item.surface)} • ${item.date}</div></div><div class="hist-winner">${escapeHtml(item.winner)} (${item.prob.toFixed(1)}%)</div></div>
    `).join('');
}
function clearHistory() { simulationHistory = []; localStorage.removeItem('courtSight_history'); loadHistory(); }

function resetSimulation() {
    player1 = null; player2 = null;
    playerAdjustments[1] = { total: 0 }; playerAdjustments[2] = { total: 0 };
    ['player1-selected', 'player2-selected'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    ['player1-search', 'player2-search'].forEach(id => document.getElementById(id)?.parentElement?.classList.remove('hidden'));
    document.getElementById('house-odds').value = '';
    document.getElementById('results')?.classList.add('hidden');
    document.getElementById('simulate-form')?.classList.remove('hidden');
    updateOddsDropdown(); updateSimulateButton();
}

function getElo(player, surface) { return player?.elo?.[surface] || 0; }
function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function showError(msg) { const el = document.getElementById('error-msg'); if (!el) return; el.textContent = msg; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 3000); }
function hideError() { document.getElementById('error-msg')?.classList.add('hidden'); }
function updateOddsDropdown() {
    const oddsSelect = document.getElementById('odds-player-select');
    if (!oddsSelect) return;
    const currentValue = oddsSelect.value;
    oddsSelect.innerHTML = `<option value="1">🎾 ${player1 ? escapeHtml(player1.name) : 'Jugador 1'}</option><option value="2">🎾 ${player2 ? escapeHtml(player2.name) : 'Jugador 2'}</option>`;
    if (player1 && player2) oddsSelect.value = currentValue;
}