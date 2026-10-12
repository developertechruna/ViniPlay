/**
 * dashboard.js
 * Manages the User Dashboard: Continue Watching carousel, Series Hub progress,
 * and seamless one-click resume playback.
 * Redesigned to 100% adhere to ViniPlay native design system.
 */

import { apiFetch } from './api.js';
import { appState, UIElements } from './state.js';
import { playVOD } from './player.js';
import { withBase } from './basePath.js';
import { showNotification } from './ui.js';

let isDashboardLoading = false;

/**
 * Initializes and populates the Dashboard view.
 * Called by the SPA router when navigating to /dashboard.
 */
export async function initDashboardPage() {
    if (isDashboardLoading) return;
    isDashboardLoading = true;
    console.log('[DASHBOARD] Initializing Dashboard Page...');

    const refreshBtn = document.getElementById('dashboard-refresh-btn');
    if (refreshBtn && !refreshBtn.dataset.hasListener) {
        refreshBtn.dataset.hasListener = 'true';
        refreshBtn.addEventListener('click', () => {
            console.log('[DASHBOARD] Refresh triggered');
            loadContinueWatching();
            loadSeriesSummary();
        });
    }

    try {
        await Promise.all([
            loadContinueWatching(),
            loadSeriesSummary()
        ]);
    } catch (err) {
        console.error('[DASHBOARD] Error loading dashboard data:', err);
    } finally {
        isDashboardLoading = false;
    }
}

/**
 * Fetches and renders in-progress movies and episodes.
 */
async function loadContinueWatching() {
    const grid = document.getElementById('dashboard-continue-grid');
    const emptyMsg = document.getElementById('dashboard-continue-empty');
    const countBadge = document.getElementById('dashboard-continue-count');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-full py-8 text-center text-gray-400">Cargando contenido en curso...</div>';

    try {
        const res = await apiFetch('/api/vod/continue-watching');
        if (!res || !res.ok) {
            grid.innerHTML = '';
            emptyMsg?.classList.remove('hidden');
            if (countBadge) countBadge.classList.add('hidden');
            return;
        }

        const data = await res.json();
        const items = data?.items || [];

        if (countBadge) {
            countBadge.textContent = items.length;
            countBadge.classList.toggle('hidden', items.length === 0);
        }

        if (items.length === 0) {
            grid.innerHTML = '';
            emptyMsg?.classList.remove('hidden');
            return;
        }

        emptyMsg?.classList.add('hidden');
        grid.innerHTML = '';

        items.forEach(item => {
            const card = createContinueCard(item);
            grid.appendChild(card);
        });
    } catch (err) {
        console.error('[DASHBOARD] Error loading continue-watching:', err);
        grid.innerHTML = '';
        emptyMsg?.classList.remove('hidden');
        if (countBadge) countBadge.classList.add('hidden');
    }
}

/**
 * Creates an interactive card for Continue Watching matching ViniPlay's native .vod-item design.
 */
function createContinueCard(item) {
    const card = document.createElement('div');
    card.className = 'vod-item group';

    const isSeries = item.contentType === 'series';
    const rawLogo = item.logo || `https://placehold.co/400x600/1f2937/d1d5db?text=${encodeURIComponent(item.title)}`;
    const posterUrl = rawLogo.startsWith('http') ? withBase(`/api/image-proxy?url=${encodeURIComponent(rawLogo)}`) : rawLogo;
    const badgeText = isSeries ? `T${item.seasonNum}:E${item.episodeNum}` : 'Película';
    const subTitle = isSeries ? (item.episodeTitle || `Episodio ${item.episodeNum}`) : (item.title);
    const mainTitle = item.title;
    const progressPct = Math.max(2, Math.min(100, Math.round(item.percentage || 0)));
    const remainingText = item.remainingMinutes ? `Quedan ${item.remainingMinutes} min` : `${Math.round(item.currentTime / 60)} min vistos`;

    card.innerHTML = `
        <span class="vod-type-badge">${badgeText}</span>

        <!-- Botón Descartar (hover) -->
        <button type="button" class="dismiss-btn absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded bg-black/75 hover:bg-red-600 text-gray-300 hover:text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer" title="Descartar">
            ✕
        </button>

        <div class="vod-item-poster relative">
            <img src="${posterUrl}"
                 alt="${mainTitle.replace(/"/g, '&quot;')}"
                 loading="lazy"
                 onerror="this.onerror=null; this.src='https://placehold.co/400x600/1f2937/d1d5db?text=No+Poster'; this.style.objectFit='cover';">
            
            <!-- Barra de progreso sobre el póster -->
            <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-900/90">
                <div class="h-full bg-blue-600 transition-all" style="width: ${progressPct}%;"></div>
            </div>
        </div>

        <div class="vod-item-info">
            <p class="vod-item-title" title="${mainTitle.replace(/"/g, '&quot;')}">${mainTitle}</p>
            <div class="flex items-center justify-between text-xs text-gray-400 mt-1">
                <span class="truncate" title="${subTitle.replace(/"/g, '&quot;')}">${subTitle}</span>
                <span class="text-blue-400 font-semibold ml-1 flex-shrink-0">${progressPct}%</span>
            </div>
            <p class="text-[11px] text-gray-500 mt-0.5">${remainingText}</p>
        </div>
    `;

    // Click en la tarjeta para reanudar reproducción
    card.addEventListener('click', (e) => {
        if (e.target.closest('.dismiss-btn')) return;

        const playTitle = isSeries ? `${item.title} - T${item.seasonNum}:E${item.episodeNum} ${item.episodeTitle || ''}` : item.title;
        const context = {
            contentType: item.contentType,
            contentId: item.contentId,
            title: item.title,
            seriesName: item.seriesName,
            seasonNum: item.seasonNum,
            episodeNum: item.episodeNum,
            episodeId: item.episodeId,
            episodeTitle: item.episodeTitle,
            logo: item.logo,
            streamUrl: item.streamUrl,
            duration: item.duration || 0
        };

        console.log(`[DASHBOARD] Resuming playback for "${playTitle}" at ${item.currentTime}s`);
        playVOD(item.streamUrl, playTitle, item.logo, item.currentTime, context);
    });

    // Descartar de continuar viendo
    const dismissBtn = card.querySelector('.dismiss-btn');
    dismissBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await apiFetch(`/api/vod/progress/${encodeURIComponent(item.contentId)}`, { method: 'DELETE' });
            showNotification('Eliminado de continuar viendo', false, 2000);
            card.remove();
            const grid = document.getElementById('dashboard-continue-grid');
            if (grid && grid.children.length === 0) {
                document.getElementById('dashboard-continue-empty')?.classList.remove('hidden');
                const countBadge = document.getElementById('dashboard-continue-count');
                if (countBadge) countBadge.classList.add('hidden');
            }
        } catch (err) {
            console.error('[DASHBOARD] Error dismissing item:', err);
        }
    });

    return card;
}

/**
 * Fetches and renders the series progress summary hub.
 */
async function loadSeriesSummary() {
    const grid = document.getElementById('dashboard-series-grid');
    const emptyMsg = document.getElementById('dashboard-series-empty');
    const countBadge = document.getElementById('dashboard-series-count');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-full py-6 text-center text-gray-400">Cargando series en curso...</div>';

    try {
        const res = await apiFetch('/api/vod/series-summary');
        if (!res || !res.ok) {
            grid.innerHTML = '';
            emptyMsg?.classList.remove('hidden');
            if (countBadge) countBadge.classList.add('hidden');
            return;
        }

        const data = await res.json();
        const seriesList = data?.series || [];

        if (countBadge) {
            countBadge.textContent = seriesList.length;
            countBadge.classList.toggle('hidden', seriesList.length === 0);
        }

        if (seriesList.length === 0) {
            grid.innerHTML = '';
            emptyMsg?.classList.remove('hidden');
            return;
        }

        emptyMsg?.classList.add('hidden');
        grid.innerHTML = '';

        seriesList.forEach(s => {
            const card = createSeriesSummaryCard(s);
            grid.appendChild(card);
        });
    } catch (err) {
        console.error('[DASHBOARD] Error loading series-summary:', err);
        grid.innerHTML = '';
        emptyMsg?.classList.remove('hidden');
        if (countBadge) countBadge.classList.add('hidden');
    }
}

/**
 * Creates a series overview card matching ViniPlay's card design.
 */
function createSeriesSummaryCard(series) {
    const card = document.createElement('div');
    card.className = 'flex bg-gray-900 rounded-lg overflow-hidden border border-gray-700/60 p-3 gap-3 shadow hover:border-gray-600 transition-colors';

    const rawLogo = series.logo || `https://placehold.co/400x600/1f2937/d1d5db?text=${encodeURIComponent(series.title)}`;
    const posterUrl = rawLogo.startsWith('http') ? withBase(`/api/image-proxy?url=${encodeURIComponent(rawLogo)}`) : rawLogo;

    const activeEp = series.inProgressEpisode || series.lastWatchedEpisode;
    const epBadge = activeEp ? `T${activeEp.season_num}:E${activeEp.episode_num}` : 'Episodio';
    const epTitle = activeEp?.episode_title ? ` - ${activeEp.episode_title}` : '';
    const isPaused = activeEp && activeEp.is_completed === 0 && activeEp.current_time > 0;
    const btnLabel = isPaused
        ? `▶ Continuar ${epBadge} (${Math.round(activeEp.current_time / 60)} min)`
        : `▶ Reproducir ${epBadge}`;

    card.innerHTML = `
        <div class="w-20 sm:w-24 aspect-[2/3] flex-shrink-0 rounded bg-gray-700 overflow-hidden">
            <img src="${posterUrl}"
                 alt="${series.title.replace(/"/g, '&quot;')}"
                 class="w-full h-full object-cover"
                 loading="lazy"
                 onerror="this.onerror=null; this.src='https://placehold.co/400x600/1f2937/d1d5db?text=No+Poster'; this.style.objectFit='cover';">
        </div>
        <div class="flex flex-col justify-between flex-grow min-w-0">
            <div>
                <h4 class="text-sm font-bold text-white truncate" title="${series.title.replace(/"/g, '&quot;')}">
                    ${series.title}
                </h4>
                <div class="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                    <span class="text-blue-400 font-semibold">${series.completedEpisodes}/${series.totalEpisodes}</span>
                    <span>episodios</span>
                    <span>•</span>
                    <span class="text-gray-300 font-medium">${series.percentCompleted}%</span>
                </div>
                <!-- Progress bar matching DVR storage style -->
                <div class="w-full bg-gray-700 rounded-full h-2 mt-2 overflow-hidden">
                    <div class="bg-blue-600 h-2 rounded-full transition-all" style="width: ${series.percentCompleted}%"></div>
                </div>

                ${activeEp ? `
                <div class="mt-2 text-xs text-gray-300 truncate">
                    <span class="text-gray-400">Último:</span> <span class="font-semibold text-white">${epBadge}</span>${epTitle}
                </div>
                ` : ''}
            </div>

            <div class="mt-3">
                ${activeEp ? `
                <button type="button" class="resume-series-btn w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-md text-xs transition-colors cursor-pointer">
                    ${btnLabel}
                </button>
                ` : ''}
            </div>
        </div>
    `;

    const resumeBtn = card.querySelector('.resume-series-btn');
    if (resumeBtn && activeEp) {
        resumeBtn.addEventListener('click', () => {
            const streamUrl = activeEp.stream_url;
            const title = `${series.title} - ${epBadge}${epTitle}`;
            const seekTime = isPaused ? activeEp.current_time : 0;
            const context = {
                contentType: 'series',
                contentId: series.contentId,
                title: series.title,
                seriesName: series.title,
                seasonNum: activeEp.season_num,
                episodeNum: activeEp.episode_num,
                episodeId: activeEp.episode_id,
                episodeTitle: activeEp.episode_title,
                logo: series.logo,
                streamUrl: streamUrl,
                duration: activeEp.duration || 0
            };
            playVOD(streamUrl, title, series.logo, seekTime, context);
        });
    }

    return card;
}
