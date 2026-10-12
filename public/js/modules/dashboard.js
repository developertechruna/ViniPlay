/**
 * dashboard.js
 * Manages the User Dashboard: Continue Watching carousel, Series Hub progress,
 * and seamless one-click resume playback.
 */

import { apiFetch } from './api.js';
import { appState, UIElements } from './state.js';
import { playVOD } from './player.js';
import { withBase } from './basePath.js';
import { showNotification } from './ui.js';
import { ICONS } from './icons.js';

let isDashboardLoading = false;

/**
 * Initializes and populates the Dashboard view.
 * Called by the SPA router when navigating to /dashboard.
 */
export async function initDashboardPage() {
    if (isDashboardLoading) return;
    isDashboardLoading = true;
    console.log('[DASHBOARD] Initializing Dashboard Page...');

    const userBadge = document.getElementById('dashboard-user-badge');
    if (userBadge) {
        userBadge.textContent = appState.currentUser?.username || 'Usuario';
    }

    const refreshBtn = document.getElementById('dashboard-refresh-btn');
    if (refreshBtn && !refreshBtn.dataset.hasListener) {
        refreshBtn.dataset.hasListener = 'true';
        refreshBtn.addEventListener('click', () => {
            console.log('[DASHBOARD] Manual refresh triggered');
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
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-full py-8 text-center text-gray-400">Cargando contenido en curso...</div>';

    try {
        const res = await apiFetch('/api/vod/continue-watching');
        if (!res || !res.ok) {
            console.warn('[DASHBOARD] Failed to fetch continue-watching:', res?.status);
            grid.innerHTML = '';
            emptyMsg?.classList.remove('hidden');
            return;
        }

        const data = await res.json();
        console.log('[DASHBOARD] Continue-watching data received:', data);
        const items = data?.items || [];

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
        console.error('[DASHBOARD] Error parsing continue-watching:', err);
        grid.innerHTML = '';
        emptyMsg?.classList.remove('hidden');
    }
}

/**
 * Creates an interactive card for Continue Watching with a progress bar and instant resume.
 */
function createContinueCard(item) {
    const card = document.createElement('div');
    card.className = 'group relative flex flex-col bg-gray-900/90 rounded-xl overflow-hidden border border-gray-800 hover:border-blue-500/50 shadow-lg hover:shadow-blue-500/10 transition-all duration-300';

    const isSeries = item.contentType === 'series';
    const rawLogo = item.logo || `https://placehold.co/400x600/1f2937/d1d5db?text=${encodeURIComponent(item.title)}`;
    const posterUrl = rawLogo.startsWith('http') ? withBase(`/api/image-proxy?url=${encodeURIComponent(rawLogo)}`) : rawLogo;
    const badgeText = isSeries ? `T${item.seasonNum}:E${item.episodeNum}` : 'Película';
    const subTitle = isSeries ? (item.episodeTitle || `Episodio ${item.episodeNum}`) : (item.title);
    const mainTitle = isSeries ? item.title : item.title;
    const progressPct = Math.max(2, Math.min(100, Math.round(item.percentage || 0)));
    const remainingText = item.remainingMinutes ? `Quedan ${item.remainingMinutes} min` : `${Math.round(item.currentTime / 60)} min vistos`;

    card.innerHTML = `
        <div class="relative aspect-[2/3] w-full overflow-hidden bg-gray-950 cursor-pointer card-poster-btn">
            <img src="${posterUrl}" alt="${mainTitle}" class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" loading="lazy">
            <div class="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-80"></div>
            
            <!-- Type badge -->
            <span class="absolute top-2 left-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md bg-blue-600/80 text-white backdrop-blur-sm shadow">
                ${badgeText}
            </span>

            <!-- Delete button -->
            <button type="button" class="dismiss-btn absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 hover:bg-red-600 text-gray-300 hover:text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-10" title="Descartar de continuar viendo">
                ✕
            </button>

            <!-- Hover Play Button Overlay -->
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                <div class="w-14 h-14 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                    <svg class="w-7 h-7 translate-x-0.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
            </div>

            <!-- Bottom Progress bar directly over poster -->
            <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800">
                <div class="h-full bg-blue-500 transition-all duration-300" style="width: ${progressPct}%;"></div>
            </div>
        </div>

        <div class="p-3 flex flex-col flex-grow justify-between bg-gray-900/90">
            <div>
                <h4 class="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors" title="${mainTitle}">
                    ${mainTitle}
                </h4>
                <p class="text-xs text-gray-400 truncate mt-0.5" title="${subTitle}">
                    ${subTitle}
                </p>
            </div>
            <div class="mt-2.5 flex items-center justify-between text-[11px] text-gray-400">
                <span class="flex items-center gap-1 font-medium text-blue-400">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    ${remainingText}
                </span>
                <span class="text-gray-500 font-mono">${progressPct}%</span>
            </div>
        </div>
    `;

    // Click on poster / card to play and resume
    const posterBtn = card.querySelector('.card-poster-btn');
    posterBtn.addEventListener('click', (e) => {
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

    // Dismiss button click
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
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-full py-6 text-center text-gray-400">Cargando series en curso...</div>';

    try {
        const res = await apiFetch('/api/vod/series-summary');
        if (!res || !res.ok) {
            console.warn('[DASHBOARD] Failed to fetch series-summary:', res?.status);
            grid.innerHTML = '';
            emptyMsg?.classList.remove('hidden');
            return;
        }

        const data = await res.json();
        console.log('[DASHBOARD] Series-summary data received:', data);
        const seriesList = data?.series || [];

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
        console.error('[DASHBOARD] Error parsing series-summary:', err);
        grid.innerHTML = '';
        emptyMsg?.classList.remove('hidden');
    }
}

/**
 * Creates a series overview card displaying overall progress and quick action to continue.
 */
function createSeriesSummaryCard(series) {
    const card = document.createElement('div');
    card.className = 'flex flex-col sm:flex-row bg-gray-900/90 rounded-xl overflow-hidden border border-gray-800 hover:border-purple-500/40 p-4 gap-4 shadow-lg transition-all';

    const rawLogo = series.logo || `https://placehold.co/400x600/1f2937/d1d5db?text=${encodeURIComponent(series.title)}`;
    const posterUrl = rawLogo.startsWith('http') ? withBase(`/api/image-proxy?url=${encodeURIComponent(rawLogo)}`) : rawLogo;

    const activeEp = series.inProgressEpisode || series.lastWatchedEpisode;
    const epBadge = activeEp ? `T${activeEp.season_num}:E${activeEp.episode_num}` : 'Episodio';
    const epTitle = activeEp?.episode_title ? ` - ${activeEp.episode_title}` : '';
    const isPaused = activeEp && activeEp.is_completed === 0 && activeEp.current_time > 0;
    const btnLabel = isPaused
        ? `▶ Continuar ${epBadge} (min ${Math.round(activeEp.current_time / 60)})`
        : `▶ Reproducir ${epBadge}`;

    card.innerHTML = `
        <div class="w-full sm:w-28 aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden bg-gray-950">
            <img src="${posterUrl}" alt="${series.title}" class="w-full h-full object-cover" loading="lazy">
        </div>
        <div class="flex flex-col justify-between flex-grow">
            <div>
                <h4 class="text-base font-bold text-white hover:text-purple-400 transition-colors">
                    ${series.title}
                </h4>
                <div class="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <span class="text-purple-400 font-semibold">${series.completedEpisodes} / ${series.totalEpisodes}</span>
                    <span>episodios vistos</span>
                    <span>•</span>
                    <span class="text-gray-400 font-mono">${series.percentCompleted}%</span>
                </div>
                <!-- Overall series progress bar -->
                <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden mt-2.5">
                    <div class="h-full bg-purple-500 rounded-full" style="width: ${series.percentCompleted}%;"></div>
                </div>

                ${activeEp ? `
                <div class="mt-3 p-2 rounded-lg bg-gray-800/60 border border-gray-700/50">
                    <div class="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Último episodio:</div>
                    <div class="text-xs text-gray-200 font-medium truncate mt-0.5">
                        <span class="text-purple-400 font-bold">${epBadge}</span>${epTitle}
                    </div>
                </div>
                ` : ''}
            </div>

            <div class="mt-4 pt-2">
                ${activeEp ? `
                <button type="button" class="resume-series-btn w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 px-3 rounded-lg shadow transition-all cursor-pointer">
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
