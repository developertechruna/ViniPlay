/**
 * dashboard.js
 * Dedicated module for the ViniPlay Dashboard:
 * 1. Canales Favoritos (Starred Live TV channels)
 * 2. Continuar Viendo (Películas en curso con reanudación exacta)
 * 3. Series en Curso (Resumen de episodios vistos/totales y reanudación)
 */

import { apiFetch, fetchConfig } from './api.js';
import { withBase } from './basePath.js';
import { playVOD, playChannel } from './player.js';
import { guideState } from './state.js';
import { navigate } from './ui.js';

let isDashboardLoading = false;

/**
 * Initializes the Dashboard page and loads all sections.
 */
export async function initDashboardPage() {
    if (isDashboardLoading) return;
    isDashboardLoading = true;

    const refreshBtn = document.getElementById('dashboard-refresh-btn');
    if (refreshBtn && !refreshBtn.dataset.hasListener) {
        refreshBtn.dataset.hasListener = 'true';
        refreshBtn.addEventListener('click', () => {
            console.log('[DASHBOARD] Manual refresh triggered');
            loadFavoriteChannels();
            loadContinueWatching();
            loadSeriesSummary();
        });
    }

    try {
        await Promise.all([
            loadFavoriteChannels(),
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
 * Fetches and renders favorite Live TV channels marked with star (★).
 */
async function loadFavoriteChannels() {
    const grid = document.getElementById('dashboard-favorites-grid');
    const emptyMsg = document.getElementById('dashboard-favorites-empty');
    const countBadge = document.getElementById('dashboard-favorites-count');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-full py-6 text-center text-gray-400">Cargando canales favoritos...</div>';

    try {
        let channels = guideState.channels || [];

        // If channels are not yet in memory, fetch config and parse
        if (channels.length === 0) {
            const config = await fetchConfig();
            if (config) {
                if (config.settings) {
                    Object.assign(guideState.settings, config.settings);
                }
                if (config.m3uContent) {
                    const { parseM3U } = await import('./utils.js');
                    guideState.channels = parseM3U(config.m3uContent);
                    channels = guideState.channels;
                }
            }
        }

        const favoriteIds = new Set(guideState.settings?.favorites || []);
        const favChannels = channels.filter(ch => favoriteIds.has(ch.id) || ch.isFavorite);

        if (countBadge) {
            countBadge.textContent = favChannels.length;
            countBadge.classList.toggle('hidden', favChannels.length === 0);
        }

        if (favChannels.length === 0) {
            grid.innerHTML = '';
            emptyMsg?.classList.remove('hidden');
            return;
        }

        emptyMsg?.classList.add('hidden');
        grid.innerHTML = '';

        favChannels.forEach(ch => {
            const card = createFavoriteChannelCard(ch);
            grid.appendChild(card);
        });
    } catch (err) {
        console.error('[DASHBOARD] Error loading favorite channels:', err);
        grid.innerHTML = '';
        emptyMsg?.classList.remove('hidden');
        if (countBadge) countBadge.classList.add('hidden');
    }
}

/**
 * Creates an interactive card for a Favorite Live Channel using .vod-item styling.
 */
function createFavoriteChannelCard(channel) {
    const card = document.createElement('div');
    card.className = 'vod-item group cursor-pointer';

    const rawLogo = channel.logo || '';
    const logoUrl = rawLogo
        ? (rawLogo.startsWith('http') ? withBase(`/api/image-proxy?url=${encodeURIComponent(rawLogo)}`) : rawLogo)
        : 'https://placehold.co/300x450/1f2937/d1d5db?text=LIVE+TV';
    const channelName = channel.displayName || channel.name || 'Canal';
    const groupName = channel.group || 'Live TV';

    card.innerHTML = `
        <span class="vod-type-badge text-yellow-400 font-bold">★ LIVE</span>

        <div class="vod-item-poster bg-gray-900 flex items-center justify-center p-3 relative">
            <img src="${logoUrl}"
                 alt="${channelName.replace(/"/g, '&quot;')}"
                 class="max-w-full max-h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform duration-300"
                 loading="lazy"
                 onerror="this.onerror=null; this.src='https://placehold.co/300x450/1f2937/d1d5db?text=LIVE';">
        </div>

        <div class="vod-item-info">
            <p class="vod-item-title group-hover:text-yellow-400 transition-colors" title="${channelName.replace(/"/g, '&quot;')}">
                ${channelName}
            </p>
            <p class="vod-item-type" title="${groupName.replace(/"/g, '&quot;')}">${groupName}</p>
        </div>
    `;

    card.addEventListener('click', () => {
        console.log(`[DASHBOARD] Playing favorite channel: ${channelName}`);
        playChannel(channel.url, channelName, channel.id);
    });

    return card;
}

/**
 * Fetches and renders in-progress movies (series are excluded so they do not duplicate with "Series en Curso").
 */
async function loadContinueWatching() {
    const grid = document.getElementById('dashboard-continue-grid');
    const emptyMsg = document.getElementById('dashboard-continue-empty');
    const countBadge = document.getElementById('dashboard-continue-count');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-full py-8 text-center text-gray-400">Cargando contenido pendiente...</div>';

    try {
        const res = await apiFetch('/api/vod/continue-watching');
        if (!res || !res.ok) {
            grid.innerHTML = '';
            emptyMsg?.classList.remove('hidden');
            if (countBadge) countBadge.classList.add('hidden');
            return;
        }

        const data = await res.json();
        // Filtrar series explícitamente para que no se dupliquen con "Series en Curso"
        const items = (data?.items || []).filter(item => item.contentType !== 'series');

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
 * Creates an interactive card for Continue Watching matching ViniPlay's native .vod-item size and design.
 */
function createContinueCard(item) {
    const card = document.createElement('div');
    card.className = 'vod-item group cursor-pointer relative';

    const rawLogo = item.logo || `https://placehold.co/400x600/1f2937/d1d5db?text=${encodeURIComponent(item.title)}`;
    const posterUrl = rawLogo.startsWith('http') ? withBase(`/api/image-proxy?url=${encodeURIComponent(rawLogo)}`) : rawLogo;
    const badgeText = item.contentType === 'movie' ? 'Película' : 'VOD';
    const mainTitle = item.title;
    const progressPct = Math.max(2, Math.min(100, Math.round(item.percentage || 0)));
    const remainingText = item.remainingMinutes ? `${item.remainingMinutes}m restantes` : `${Math.round(item.currentTime / 60)}m vistos`;

    card.innerHTML = `
        <span class="vod-type-badge">${badgeText}</span>

        <!-- Botón Descartar (hover) -->
        <button type="button" class="dismiss-btn absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded bg-black/75 hover:bg-red-600 text-gray-300 hover:text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer" title="Descartar">
            ✕
        </button>

        <div class="vod-item-poster">
            <img src="${posterUrl}"
                 alt="${mainTitle.replace(/"/g, '&quot;')}"
                 loading="lazy"
                 class="group-hover:scale-105 transition-transform duration-300"
                 onerror="this.onerror=null; this.src='https://placehold.co/400x600/1f2937/d1d5db?text=No+Poster'; this.style.objectFit='cover';">
            
            <!-- Barra de progreso integrada al pie del póster -->
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-900/90">
                <div class="h-full bg-blue-600 transition-all" style="width: ${progressPct}%;"></div>
            </div>
        </div>

        <div class="vod-item-info">
            <p class="vod-item-title" title="${mainTitle.replace(/"/g, '&quot;')}">${mainTitle}</p>
            <p class="vod-item-type" title="${remainingText}">${remainingText}</p>
        </div>
    `;

    // Click handler to resume playback
    card.addEventListener('click', (e) => {
        if (e.target.closest('.dismiss-btn')) return;

        console.log(`[DASHBOARD] Resuming playback: "${mainTitle}" from ${item.currentTime}s`);
        const seekTime = item.currentTime > 0 ? item.currentTime : 0;
        const context = {
            contentType: item.contentType,
            contentId: item.contentId,
            title: item.title,
            logo: item.logo,
            streamUrl: item.streamUrl,
            duration: item.duration || 0
        };
        playVOD(item.streamUrl, item.title, item.logo, seekTime, context);
    });

    // Dismiss handler
    const dismissBtn = card.querySelector('.dismiss-btn');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`¿Eliminar "${mainTitle}" de continuar viendo?`)) return;

            try {
                await fetch(withBase(`/api/vod/progress/${encodeURIComponent(item.contentId)}`), {
                    method: 'DELETE'
                });
                card.remove();
                const grid = document.getElementById('dashboard-continue-grid');
                const countBadge = document.getElementById('dashboard-continue-count');
                const emptyMsg = document.getElementById('dashboard-continue-empty');
                const remainingCards = grid?.querySelectorAll('.vod-item').length || 0;
                if (countBadge) {
                    countBadge.textContent = remainingCards;
                    countBadge.classList.toggle('hidden', remainingCards === 0);
                }
                if (remainingCards === 0) emptyMsg?.classList.remove('hidden');
            } catch (err) {
                console.error('[DASHBOARD] Error removing progress:', err);
            }
        });
    }

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
    card.className = 'group relative flex bg-gray-900 rounded-lg overflow-hidden border border-gray-700/60 p-3 gap-3 shadow hover:border-gray-600 transition-colors cursor-pointer';

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
        <!-- Botón Descartar Serie (hover) -->
        <button type="button" class="dismiss-series-btn absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded bg-black/75 hover:bg-red-600 text-gray-300 hover:text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer" title="Descartar serie">
            ✕
        </button>

        <div class="w-20 sm:w-24 aspect-[2/3] flex-shrink-0 rounded bg-gray-700 overflow-hidden relative">
            <img src="${posterUrl}"
                 alt="${series.title.replace(/"/g, '&quot;')}"
                 class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                 loading="lazy"
                 onerror="this.onerror=null; this.src='https://placehold.co/400x600/1f2937/d1d5db?text=No+Poster'; this.style.objectFit='cover';">
        </div>
        <div class="flex flex-col justify-between flex-grow min-w-0 pr-6">
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

    const playSeriesEpisode = () => {
        if (!activeEp) return;
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
    };

    // Click on card: resume button plays directly, clicking card opens series details page
    card.addEventListener('click', (e) => {
        if (e.target.closest('.dismiss-series-btn')) return;
        if (e.target.closest('.resume-series-btn')) {
            playSeriesEpisode();
            return;
        }
        if (series.contentId) {
            navigate(`/vod/details/${encodeURIComponent(series.contentId)}`);
        } else {
            playSeriesEpisode();
        }
    });

    // Dismiss series handler
    const dismissBtn = card.querySelector('.dismiss-series-btn');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`¿Eliminar la serie "${series.title}" de series en curso?`)) return;

            try {
                await fetch(withBase(`/api/vod/progress/${encodeURIComponent(series.contentId)}`), {
                    method: 'DELETE'
                });
                card.remove();
                const grid = document.getElementById('dashboard-series-grid');
                const countBadge = document.getElementById('dashboard-series-count');
                const emptyMsg = document.getElementById('dashboard-series-empty');
                const remainingCards = grid?.querySelectorAll('.group').length || 0;
                if (countBadge) {
                    countBadge.textContent = remainingCards;
                    countBadge.classList.toggle('hidden', remainingCards === 0);
                }
                if (remainingCards === 0) emptyMsg?.classList.remove('hidden');
            } catch (err) {
                console.error('[DASHBOARD] Error removing series progress:', err);
            }
        });
    }

    return card;
}
