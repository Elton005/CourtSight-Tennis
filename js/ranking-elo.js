/* ============================================
COURT SIGHT TENNIS - RANKING ELO JS v4.1
✅ 1000+ jugadores sin lag | Sin duplicados | Banderas estables
✅ Buscador con debounce + highlight + scroll infinito
============================================ */

const RANKING_CONFIG = {
    surfaces: {
        total: { name: 'General', icon: 'fa-globe', class: 'surface-total' },
        hardOut: { name: 'Dura Outdoor', icon: 'fa-circle', class: 'surface-hard-outdoor' },
        hardIndoor: { name: 'Dura Indoor', icon: 'fa-house-chimney', class: 'surface-hard-indoor' },
        clay: { name: 'Arcilla', icon: 'fa-mound', class: 'surface-clay' },
        grass: { name: 'Hierba', icon: 'fa-seedling', class: 'surface-grass' }
    },
    defaultSurface: 'total',
    minElo: 0,
    CACHE_TTL: 24 * 60 * 60 * 1000,
    INITIAL_RENDER: 150,  // 🚀 Render inicial ligero
    SCROLL_INCREMENT: 100 // Cargar de 100 en 100 al hacer scroll
};

let playersDatabase = [], playersRank = [], mergedPlayers = [];
let currentSurface = RANKING_CONFIG.defaultSurface, isLoading = false, searchTimeout = null;
let visibleCount = RANKING_CONFIG.INITIAL_RENDER, allSortedPlayers = [];

// ============================================
// INDEXEDDB CACHE (Nombres únicos)
// ============================================
const RANKING_DB_NAME = 'CourtSightCache', RANKING_DB_VERSION = 1, RANKING_STORE_NAME = 'rankingData';

function initCacheDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(RANKING_DB_NAME, RANKING_DB_VERSION);
        req.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains(RANKING_STORE_NAME)) db.createObjectStore(RANKING_STORE_NAME, { keyPath: 'key' }); };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
    });
}
async function getCachedData(key) {
    try {
        const db = await initCacheDB();
        return new Promise(res => {
            const tx = db.transaction([RANKING_STORE_NAME], 'readonly'), req = tx.objectStore(RANKING_STORE_NAME).get(key);
            req.onsuccess = () => { const d = req.result; res((d && Date.now() - d.timestamp < RANKING_CONFIG.CACHE_TTL) ? d.value : null); };
            req.onerror = () => res(null);
        });
    } catch { return null; }
}
async function setCachedData(key, value) {
    try { const db = await initCacheDB(); db.transaction([RANKING_STORE_NAME], 'readwrite').objectStore(RANKING_STORE_NAME).put({ key, value, timestamp: Date.now() }); } catch {}
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initSurfaceSelector();
    initSearch();
    initScrollLoader();
    loadRankingData();
});

// ============================================
// 📥 CARGA + DEDUPLICACIÓN + NORMALIZACIÓN
// ============================================
async function loadRankingData() {
    if (isLoading) return; isLoading = true; showLoadingState();
    try {
        const [cachedDB, cachedRank] = await Promise.all([getCachedData('playersDatabase'), getCachedData('playersRank')]);
        if (cachedDB && cachedRank) { playersDatabase = cachedDB; playersRank = cachedRank; }
        else {
            const [dbRes, rankRes] = await Promise.all([fetch('../data/players_database.json'), fetch('../data/players_rank.json')]);
            if (!dbRes.ok || !rankRes.ok) throw new Error('HTTP Error');
            playersDatabase = await dbRes.json(); playersRank = await rankRes.json();
            await Promise.all([setCachedData('playersDatabase', playersDatabase), setCachedData('playersRank', playersRank)]);
        }
        updateDateBadge(playersRank.date);
        mergeAndRenderPlayers();
    } catch (e) { console.error('❌ Error:', e); showEmptyState('Error al cargar. Revisa consola.'); }
    finally { isLoading = false; }
}

function mergeAndRenderPlayers() {
    const seen = new Set();
    mergedPlayers = (playersRank.rankings || []).map(rp => {
        const db = playersDatabase.find(p => String(p.id||'').trim().toLowerCase() === String(rp.id||'').trim().toLowerCase());
        if (!db) return null;
        const id = String(db.id||'').trim().toLowerCase();
        if (seen.has(id)) return null; seen.add(id);
        
        const clean = s => String(s||'').trim().replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').normalize('NFC');
        let flagCode = clean(db.flagCode).toLowerCase(), flagUrl = clean(db.flagUrl||'');
        // Normalizar ruta: aceptar flags/ o pictures/
        flagUrl = flagUrl.replace(/^(flags|pictures)\//i, 'flags/');
        // Forzar .png y fallback
        flagUrl = flagUrl.replace(/\.(jpg|jpeg|gif|webp)$/i, '.png');
        if (!flagUrl || flagUrl === 'flags/' || flagUrl.includes('undefined')) flagUrl = flagCode ? `flags/${flagCode}.png` : 'flags/unknown.png';
        
        return { id: rp.id, name: clean(db.name), nationality: clean(db.nationality), flagCode, flagUrl, elo: rp.elo, atpPoints: rp.atpPoints };
    }).filter(Boolean);
    
    console.log(`✅ ${mergedPlayers.length} jugadores únicos. Renderizando...`);
    visibleCount = RANKING_CONFIG.INITIAL_RENDER;
    renderRanking(currentSurface);
}

// ============================================
// 🧮 CÁLCULO ELO + ORDENAMIENTO
// ============================================
function calculateElo(p, surf) {
    if (surf === 'total') return (p.elo.hardOut||0)+(p.elo.hardIndoor||0)+(p.elo.clay||0)+(p.elo.grass||0);
    return p.elo[surf] || 0;
}
function filterAndSortPlayers(surf) {
    return mergedPlayers.map(p => ({...p, calculatedElo: calculateElo(p, surf)}))
        .filter(p => p.calculatedElo > RANKING_CONFIG.minElo)
        .sort((a,b) => b.calculatedElo - a.calculatedElo)
        .map((p,i) => ({...p, realPosition: i+1}));
}

// ============================================
// 📊 RENDERIZADO OPTIMIZADO (DocumentFragment + Lazy)
// ============================================
function renderRanking(surf, append = false) {
    const searchInput = document.getElementById('player-search');
    if (searchInput?.value.trim()) { renderSearchResults(filterPlayersBySearch(searchInput.value.trim()), searchInput.value.trim()); return; }
    
    allSortedPlayers = filterAndSortPlayers(surf);
    const body = document.getElementById('ranking-body'), container = document.getElementById('ranking-container'), empty = document.getElementById('empty-state'), loader = document.getElementById('loading-state');
    
    loader?.classList.add('hidden');
    if (!allSortedPlayers.length) { showEmptyState(); return; }
    
    if (!append) { container?.classList.remove('hidden'); empty?.classList.add('hidden'); updatePlayerCountBadge(allSortedPlayers.length); updateSurfaceBadge(surf); body.innerHTML = ''; }
    
    const fragment = document.createDocumentFragment(), limit = Math.min(allSortedPlayers.length, append ? visibleCount : Math.min(visibleCount, allSortedPlayers.length)), start = append ? body.children.length : 0;
    
    for (let i = start; i < limit; i++) {
        const p = allSortedPlayers[i], pos = p.realPosition, rankClass = pos<=3?`rank-${pos}`:'', trophy = pos<=3?'<i class="fas fa-trophy rank-trophy"></i>':'', delay = Math.min((i-start)*0.008, 0.15);
        const tr = document.createElement('tr'); tr.className = rankClass; tr.style.animationDelay = `${delay}s`;
        tr.innerHTML = `<td class="col-pos">${pos}${trophy}</td>
            <td class="col-player"><div class="player-info">
                <img src="../${p.flagUrl}" alt="${p.nationality}" loading="lazy" decoding="async" fetchpriority="low" class="player-flag" data-code="${p.flagCode||'?'}" onerror="this.onerror=null;this.classList.add('flag-fallback');" onload="this.classList.remove('flag-fallback');">
                <span class="player-name">${escapeHtml(p.name)}</span>
            </div></td>
            <td class="col-country"><span class="player-country-code">${p.nationality}</span></td>
            <td class="col-elo" data-elo-tooltip="${p.calculatedElo} pts">${p.calculatedElo.toLocaleString('es-ES')}</td>`;
        fragment.appendChild(tr);
    }
    body.appendChild(fragment);
    
    if (allSortedPlayers.length > visibleCount) ensureLoadMoreTrigger(); else document.getElementById('load-more-trigger')?.remove();
}

function renderSearchResults(players, term) {
    const body = document.getElementById('ranking-body'), container = document.getElementById('ranking-container'), empty = document.getElementById('empty-state');
    document.getElementById('loading-state')?.classList.add('hidden');
    if (!players.length) { showEmptyState(`No se encontraron jugadores con "${term}"`); return; }
    
    container?.classList.remove('hidden'); empty?.classList.add('hidden'); body.innerHTML = '';
    const fragment = document.createDocumentFragment(), limit = Math.min(players.length, 200);
    
    for (let i=0; i<limit; i++) {
        const p = players[i], pos = p.realPosition, rankClass = pos<=3?`rank-${pos}`:'', trophy = pos<=3?'<i class="fas fa-trophy rank-trophy"></i>':'', indicator = '<span class="search-indicator"><i class="fas fa-search"></i></span>';
        const tr = document.createElement('tr'); tr.className = rankClass;
        tr.innerHTML = `<td class="col-pos">${pos}${trophy}${indicator}</td>
            <td class="col-player"><div class="player-info">
                <img src="../${p.flagUrl}" alt="${p.nationality}" loading="lazy" decoding="async" class="player-flag" data-code="${p.flagCode||'?'}" onerror="this.onerror=null;this.classList.add('flag-fallback');" onload="this.classList.remove('flag-fallback');">
                <span class="player-name">${highlightText(p.name, term)}</span>
            </div></td>
            <td class="col-country"><span class="player-country-code">${highlightText(p.nationality, term)}</span></td>
            <td class="col-elo" data-elo-tooltip="${p.calculatedElo} pts">${p.calculatedElo.toLocaleString('es-ES')}</td>`;
        fragment.appendChild(tr);
    }
    body.appendChild(fragment);
}

// ============================================
// 📜 SCROLL INFINITO
// ============================================
function initScrollLoader() {
    const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !isLoading && !document.getElementById('player-search')?.value.trim()) {
            visibleCount += RANKING_CONFIG.SCROLL_INCREMENT;
            renderRanking(currentSurface, true);
        }
    }, { rootMargin: '300px' });
    const trigger = document.getElementById('load-more-trigger');
    if (trigger) obs.observe(trigger);
}
function ensureLoadMoreTrigger() {
    let t = document.getElementById('load-more-trigger');
    if (!t) { t = document.createElement('div'); t.id = 'load-more-trigger'; t.style.cssText = 'height:1px;width:100%'; document.querySelector('.ranking-container')?.appendChild(t); initScrollLoader(); }
}

// ============================================
// 🔍 BUSCADOR + UTILIDADES
// ============================================
function filterPlayersBySearch(term) { const t = term.toLowerCase(); return filterAndSortPlayers(currentSurface).filter(p => p.name.toLowerCase().includes(t) || p.nationality.toLowerCase().includes(t)); }
function highlightText(text, term) { if (!term) return escapeHtml(text); return escapeHtml(text).replace(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'), '<span class="highlight-match">$1</span>'); }
function escapeHtml(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function updateDateBadge(d) { const el = document.getElementById('update-date'); if (el && d) el.textContent = new Date(d).toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' }); }
function updatePlayerCountBadge(c) { const el = document.getElementById('player-count'); if (el) el.textContent = `${c} jugador${c!==1?'es':''}`; }
function updateSurfaceBadge(s) { const el = document.getElementById('surface-name'); if (el) el.textContent = RANKING_CONFIG.surfaces[s]?.name || 'Desconocida'; }

function showLoadingState() { document.getElementById('loading-state')?.classList.remove('hidden'); document.getElementById('ranking-container')?.classList.add('hidden'); document.getElementById('empty-state')?.classList.add('hidden'); }
function showEmptyState(msg = 'No hay jugadores con puntos ELO en esta superficie') {
    document.getElementById('loading-state')?.classList.add('hidden'); document.getElementById('ranking-container')?.classList.add('hidden');
    const el = document.getElementById('empty-state'); if (el) { el.classList.remove('hidden'); const p = el.querySelector('p'); if (p) p.textContent = msg; }
    updatePlayerCountBadge(0);
}

function initSurfaceSelector() {
    const sel = document.getElementById('surface-select'); if (!sel) return;
    sel.addEventListener('change', () => {
        const s = sel.value; if (!s || s === currentSurface) return;
        currentSurface = s; visibleCount = RANKING_CONFIG.INITIAL_RENDER;
        updateBodySurfaceClass(s); updateSurfaceBadge(s);
        const searchInput = document.getElementById('player-search');
        if (searchInput?.value.trim()) renderSearchResults(filterPlayersBySearch(searchInput.value.trim()), searchInput.value.trim());
        else renderRanking(s);
    });
}
function updateBodySurfaceClass(s) {
    const body = document.body; Object.values(RANKING_CONFIG.surfaces).forEach(sc => body.classList.remove(sc.class));
    body.classList.add('surface-transition', RANKING_CONFIG.surfaces[s].class);
    setTimeout(() => body.classList.remove('surface-transition'), 300);
}

function initSearch() {
    const input = document.getElementById('player-search'), clear = document.getElementById('search-clear'), count = document.getElementById('search-results-count');
    if (!input) return;
    input.addEventListener('input', () => {
        const t = input.value.trim(); clear?.classList.toggle('hidden', !t);
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (!t) { count?.classList.add('hidden'); visibleCount = RANKING_CONFIG.INITIAL_RENDER; renderRanking(currentSurface); return; }
            const res = filterPlayersBySearch(t);
            if (count) { count.textContent = `${res.length} resultado${res.length!==1?'s':''}`; count.classList.remove('hidden'); }
            renderSearchResults(res, t);
        }, 250);
    });
    clear?.addEventListener('click', () => { input.value=''; clear.classList.add('hidden'); count?.classList.add('hidden'); visibleCount = RANKING_CONFIG.INITIAL_RENDER; renderRanking(currentSurface); });
    document.addEventListener('keydown', e => { if (e.key==='Escape' && input.value) { input.value=''; clear?.classList.add('hidden'); count?.classList.add('hidden'); renderRanking(currentSurface); } });
}

console.log('🎾 Ranking ELO JS v4.1 ✅ Optimizado para 1000+ jugadores');