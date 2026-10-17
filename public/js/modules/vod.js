/**
 * vod.js
 * * Manages all functionality for the new Video on Demand (VOD) page.
 * Handles parsing, filtering, rendering, and playback of movies and series.
 */

import { appState, UIElements, guideState } from './state.js'; // Keep guideState for settings
import { openModal, closeModal, showNotification, navigate } from './ui.js';
import { ICONS } from './icons.js';
import { saveUserSetting, fetchVodLibrary, fetchSeriesDetails } from './api.js';
import { playVOD } from './player.js';
import { withBase } from './basePath.js';

// Local state for VOD page
const vodState = {
    // This will hold the parsed and combined list of all movies and series objects
    fullLibrary: [],
    // This will hold the items currently being shown after filters are applied
    filteredLibrary: [],
    // Simple debounce timer for search
    searchDebounce: null,
    // --- NEW: Pagination State ---
    pagination: {
        currentPage: 1,
        pageSize: 50, // Default page size
        totalItems: 0,
        totalPages: 1,
    },
};

function formatDurationDisplay(duration) {
    if (!duration || duration <= 0) return 'N/A';
    const totalSecs = Math.round(duration);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hrs > 0) {
        return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
}

/**
 * Main initialization function for the VOD page.
 * This is called by the router in ui.js when switching to the VOD tab.
 */
export async function initVodPage() {
    console.log('[VOD] Initializing VOD Page...');

    // 1. Fetch the structured library from the server (only if not already loaded)
    if (!vodState.fullLibrary || vodState.fullLibrary.length === 0) {
        const library = await fetchVodLibrary();

        if (library) {
            vodState.fullLibrary = [...library.movies, ...library.series];
            vodState.fullLibrary.forEach(item => item.id = String(item.id));
            vodState.fullLibrary.sort((a, b) => a.name.localeCompare(b.name));
            console.log(`[VOD] Library loaded: ${library.movies.length} movies, ${library.series.length} series headers.`);
            // 2. Populate the category filter dropdown
            populateVodGroups(library.categories);
            if (UIElements.vodGroupFilter) UIElements.vodGroupFilter.value = 'all';
        } else {
            console.error('[VOD] Failed to load VOD library from server.');
            vodState.fullLibrary = [];
            showNotification('Could not load VOD library.', true);
        }
    }

    // 3. Set initial state of the VOD Direct Play checkbox
    const savedVodDirectPlay = guideState.settings.vodDirectPlayEnabled === true;
    if (UIElements.vodDirectPlayCheckbox) {
        UIElements.vodDirectPlayCheckbox.checked = savedVodDirectPlay;
    }
    console.log(`[VOD] Initial VOD Direct Play state: ${savedVodDirectPlay}`);

    // 4. Render the grid
    renderVodGrid();

    // 5. Set up all event listeners for the page
    setupVodEventListeners();
}


/**
 * Populates the "All Categories" dropdown filter.
 */
function populateVodGroups(categories) {
    const selectEl = UIElements.vodGroupFilter;
    selectEl.innerHTML = ''; // Clear existing options

    // Always add "All Categories"
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Categories';
    selectEl.appendChild(allOption);

    // Add sorted group names
    if (categories && Array.isArray(categories)) {
        categories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            selectEl.appendChild(option);
        });
    }

    console.log(`[VOD] Populated group filter with ${categories ? categories.length : 0} categories.`);
}

/**
 * Renders the VOD grid based on the current filters and pagination state.
 */
function renderVodGrid() {
    const gridEl = UIElements.vodGrid;
    const noResultsEl = UIElements.vodNoResults;
    if (!gridEl || !noResultsEl) return;

    // 1. Get current filter values
    const activeTypeBtn = document.querySelector('.vod-type-btn.active');
    const typeFilter = activeTypeBtn ? activeTypeBtn.id.replace('vod-type-', '') : 'all'; // 'all', 'movies', 'series'
    const groupFilter = UIElements.vodGroupFilter.value; // 'all' or specific group
    const searchFilter = UIElements.vodSearchInput.value.toLowerCase();

    // 2. Apply filters to the full library
    vodState.filteredLibrary = vodState.fullLibrary.filter(item => {
        const typeMatch = (typeFilter === 'all') || (typeFilter === 'movies' && item.type === 'movie') || (typeFilter === 'series' && item.type === 'series');
        const groupMatch = (groupFilter === 'all') || (item.group === groupFilter);
        const searchMatch = (searchFilter === '') || (item.name.toLowerCase().includes(searchFilter));

        return typeMatch && groupMatch && searchMatch;
    });

    // 3. Update Pagination State
    vodState.pagination.totalItems = vodState.filteredLibrary.length;
    vodState.pagination.totalPages = Math.ceil(vodState.pagination.totalItems / vodState.pagination.pageSize);
    // Ensure currentPage is valid after filtering
    if (vodState.pagination.currentPage > vodState.pagination.totalPages) {
        vodState.pagination.currentPage = Math.max(1, vodState.pagination.totalPages);
    }

    // 4. Calculate items for the current page
    const startIndex = (vodState.pagination.currentPage - 1) * vodState.pagination.pageSize;
    const endIndex = startIndex + vodState.pagination.pageSize;
    const itemsToRender = vodState.filteredLibrary.slice(startIndex, endIndex);

    // 5. Render Grid HTML
    if (itemsToRender.length === 0) {
        gridEl.innerHTML = ''; // Clear grid
        noResultsEl.classList.remove('hidden');
    } else {
        noResultsEl.classList.add('hidden');
        gridEl.innerHTML = itemsToRender.map(item => {
            const itemType = item.type === 'movie' ? 'Movie' : 'Series';
            // Sanitize the name for placeholder text just in case
            const safeName = item.name ? String(item.name).replace(/[^a-zA-Z0-9 ]/g, '') : 'VOD';
            const placeholderImageUrl = `https://placehold.co/400x600/1f2937/d1d5db?text=${encodeURIComponent(safeName)}`;
            // Ensure ID is treated as a string for the data attribute
            const itemIdStr = String(item.id);

            // --- SERIES RENDERING FIX ---
            // Display the series name, not individual episode names here
            const displayName = item.name || (item.type === 'series' ? 'Unknown Series' : 'Unknown Movie');
            const displayGroup = item.group || 'Uncategorized';
            const displayLogo = item.logo || placeholderImageUrl;

            // Use image proxy for both HTTP and HTTPS posters to avoid mixed content warnings
            const proxiedLogo = displayLogo.startsWith('http') ? withBase(`/api/image-proxy?url=${encodeURIComponent(displayLogo)}`) : displayLogo;

            return `
                <div class="vod-item" data-id="${itemIdStr}">
                    <span class="vod-type-badge">${itemType}</span>
                    <div class="vod-item-poster">
                        <img src="${proxiedLogo}"
                             alt="${displayName.replace(/"/g, '&quot;')}"
                             onerror="this.onerror=null; this.src='${placeholderImageUrl}'; this.style.objectFit='cover';">
                    </div>
                    <div class="vod-item-info">
                        <p class="vod-item-title" title="${displayName.replace(/"/g, '&quot;')}">${displayName}</p>
                        <p class="vod-item-type">${displayGroup}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 6. Render Pagination Controls
    renderVodPaginationControls();
}



/**
 * Navigates to the VOD details page for a specific item.
 * @param {object} item - The movie or series item.
 */
export function openVodDetails(item) {
    if (!item) return;
    const itemId = String(item.id || '');
    if (!itemId) return;
    navigate(`/vod/details/${encodeURIComponent(itemId)}`);
}

/**
 * Initializes and renders the VOD Details Page for a given URL path.
 * Called by the SPA router in ui.js when path matches /vod/details/:id or /vod/item/:id.
 * @param {string} path - The client route path.
 */
export async function initVodDetailsPage(path) {
    console.log('[VOD] Initializing VOD Details Page for path:', path);
    setupVodEventListeners();

    // 1. Extract item ID from path or URL query parameters
    let itemId = null;
    try {
        const urlObj = new URL(window.location.href);
        if (urlObj.searchParams.has('id')) {
            itemId = urlObj.searchParams.get('id');
        }
    } catch (_) { }

    if (!itemId) {
        const match = path.match(/^\/vod\/(?:details|item)\/([^/?#]+)/);
        if (match) {
            itemId = decodeURIComponent(match[1]);
        }
    }

    if (!itemId) {
        console.warn('[VOD] No item ID found in details path:', path);
        navigate('/vod');
        return;
    }

    // 2. Ensure library is loaded (e.g. if arriving via direct link or refresh)
    if (!vodState.fullLibrary || vodState.fullLibrary.length === 0) {
        showVodDetailsSkeleton();
        const library = await fetchVodLibrary();
        if (library) {
            vodState.fullLibrary = [...library.movies, ...library.series];
            vodState.fullLibrary.forEach(item => item.id = String(item.id));
            vodState.fullLibrary.sort((a, b) => a.name.localeCompare(b.name));
            populateVodGroups(library.categories);
        } else {
            vodState.fullLibrary = [];
        }
    }

    // 3. Find item in library
    const item = vodState.fullLibrary.find(i => String(i.id) === String(itemId));
    if (!item) {
        console.error(`[VOD] Item not found with ID: ${itemId}`);
        showVodItemNotFound(itemId);
        return;
    }

    // 4. Render details onto page
    await renderVodDetails(item);
}

/**
 * Renders the item information onto the VOD details page.
 * @param {object} item - The movie or series object.
 */
async function renderVodDetails(item) {
    if (!item) return;

    // Scroll to top of details page
    if (UIElements.pageVodDetails) {
        UIElements.pageVodDetails.scrollTop = 0;
    }

    const safeName = item.name || (item.type === 'series' ? 'Serie' : 'Película');
    const placeholderPoster = `https://placehold.co/400x600/1f2937/d1d5db?text=${encodeURIComponent(safeName)}`;
    const posterUrl = item.logo || placeholderPoster;
    const proxiedPoster = posterUrl.startsWith('http') ? withBase(`/api/image-proxy?url=${encodeURIComponent(posterUrl)}`) : posterUrl;

    if (UIElements.vodDetailsTitle) UIElements.vodDetailsTitle.textContent = safeName;
    if (UIElements.vodDetailsPoster) {
        UIElements.vodDetailsPoster.src = proxiedPoster;
        UIElements.vodDetailsPoster.alt = safeName;
        UIElements.vodDetailsPoster.onerror = function () {
            this.onerror = null;
            this.src = placeholderPoster;
        };
    }
    if (UIElements.vodDetailsBackdropImg) {
        UIElements.vodDetailsBackdropImg.src = item.logo ? proxiedPoster : '';
    }

    // Metadata
    if (UIElements.vodDetailsYear) {
        UIElements.vodDetailsYear.textContent = item.year || '';
        UIElements.vodDetailsYear.classList.toggle('hidden', !item.year);
    }
    if (UIElements.vodDetailsDuration) {
        const formattedDur = item.duration ? formatDurationDisplay(item.duration) : '';
        UIElements.vodDetailsDuration.textContent = formattedDur;
        UIElements.vodDetailsDuration.classList.toggle('hidden', !formattedDur);
    }
    if (UIElements.vodDetailsRating) {
        UIElements.vodDetailsRating.textContent = item.rating ? `★ ${item.rating}` : '';
        UIElements.vodDetailsRating.classList.toggle('hidden', !item.rating);
    }
    if (UIElements.vodDetailsGenre) {
        UIElements.vodDetailsGenre.textContent = item.group || 'N/A';
    }
    if (UIElements.vodDetailsGenreBadge) {
        UIElements.vodDetailsGenreBadge.textContent = item.group || 'VOD';
        UIElements.vodDetailsGenreBadge.classList.toggle('hidden', !item.group);
    }
    if (UIElements.vodDetailsDirector) {
        UIElements.vodDetailsDirector.textContent = item.director || 'N/A';
    }
    if (UIElements.vodDetailsCast) {
        UIElements.vodDetailsCast.textContent = item.cast || 'N/A';
    }
    if (UIElements.vodDetailsDesc) {
        UIElements.vodDetailsDesc.textContent = item.description || `Detalles para ${safeName}.`;
    }

    // Reset visibility
    if (UIElements.vodDetailsMovieActions) UIElements.vodDetailsMovieActions.classList.add('hidden');
    if (UIElements.vodDetailsSeriesActions) UIElements.vodDetailsSeriesActions.classList.add('hidden');
    if (UIElements.vodSeasonSelect) UIElements.vodSeasonSelect.innerHTML = '';
    if (UIElements.vodEpisodeList) UIElements.vodEpisodeList.innerHTML = '';

    // --- Movie Logic ---
    if (item.type === 'movie') {
        if (UIElements.vodDetailsType) {
            UIElements.vodDetailsType.textContent = 'Película';
            UIElements.vodDetailsType.className = 'px-3 py-1 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs';
        }
        if (UIElements.vodDetailsMovieActions) UIElements.vodDetailsMovieActions.classList.remove('hidden');

        const movieUrl = item.url;
        const movieName = item.name;
        const movieLogo = item.logo;
        const movieContext = {
            contentType: 'movie',
            contentId: item.id,
            title: item.name,
            logo: item.logo,
            streamUrl: item.url,
            duration: item.duration || 0
        };

        if (UIElements.vodPlayMovieBtn) {
            UIElements.vodPlayMovieBtn.onclick = () => {
                playVOD(movieUrl, movieName, movieLogo, 0, movieContext);
            };
        }

        // --- Series Logic ---
    } else if (item.type === 'series') {
        if (UIElements.vodDetailsType) {
            UIElements.vodDetailsType.textContent = 'Serie';
            UIElements.vodDetailsType.className = 'px-3 py-1 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs';
        }
        if (UIElements.vodDetailsSeriesActions) UIElements.vodDetailsSeriesActions.classList.remove('hidden');

        // Loading state
        if (UIElements.vodEpisodeList) {
            UIElements.vodEpisodeList.innerHTML = `
                <div class="flex items-center justify-center p-12 text-gray-400 gap-3">
                    <svg class="animate-spin h-6 w-6 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span class="text-sm font-medium">Cargando episodios...</span>
                </div>
            `;
        }

        const fullSeriesData = await fetchSeriesDetails(item.id);
        console.log(`[VOD] Fetched full series data for ID ${item.id}:`, fullSeriesData);

        if (UIElements.vodEpisodeList) {
            UIElements.vodEpisodeList.dataset.seriesLogo = fullSeriesData?.logo || item.logo || '';
            UIElements.vodEpisodeList.dataset.seriesId = fullSeriesData?.id || item.id || '';
            UIElements.vodEpisodeList.dataset.seriesName = fullSeriesData?.name || item.name || '';
        }

        if (!fullSeriesData || !fullSeriesData.seasons || Object.keys(fullSeriesData.seasons).length === 0) {
            const errorMessage = fullSeriesData ? "No se encontraron episodios para esta serie." : "No se pudieron cargar los episodios de esta serie. El proveedor podría estar fuera de línea.";
            if (UIElements.vodEpisodeList) {
                UIElements.vodEpisodeList.innerHTML = `<p class="p-8 text-center text-gray-400">${errorMessage}</p>`;
            }
            if (UIElements.vodSeasonSelect) {
                UIElements.vodSeasonSelect.innerHTML = '<option disabled selected>Sin Temporadas</option>';
            }
            if (UIElements.vodEpisodesCountBadge) {
                UIElements.vodEpisodesCountBadge.textContent = '0 episodios';
            }
            return;
        }

        const seasonSelect = UIElements.vodSeasonSelect;
        if (seasonSelect) {
            seasonSelect.innerHTML = '';
            const sortedSeasonKeys = Object.keys(fullSeriesData.seasons).map(Number).sort((a, b) => a - b);

            let totalEps = 0;
            for (const sNum of sortedSeasonKeys) {
                totalEps += fullSeriesData.seasons[sNum]?.length || 0;
            }
            if (UIElements.vodEpisodesCountBadge) {
                UIElements.vodEpisodesCountBadge.textContent = `${totalEps} episodios`;
            }

            if (sortedSeasonKeys.length > 0) {
                for (const seasonNum of sortedSeasonKeys) {
                    const option = document.createElement('option');
                    option.value = seasonNum;
                    const epCount = fullSeriesData.seasons[seasonNum]?.length || 0;
                    option.textContent = `Temporada ${seasonNum} (${epCount} ep.)`;
                    seasonSelect.appendChild(option);
                }

                renderEpisodeList(fullSeriesData, sortedSeasonKeys[0]);

                seasonSelect.onchange = (e) => {
                    renderEpisodeList(fullSeriesData, parseInt(e.target.value, 10));
                };
            } else {
                UIElements.vodEpisodeList.innerHTML = `<p class="p-8 text-center text-gray-400">No se encontraron episodios para esta serie.</p>`;
                seasonSelect.innerHTML = '<option disabled selected>Sin Temporadas</option>';
            }
        }
    }
}

/**
 * Renders the list of episodes for a given season inside the details page.
 * @param {object} series - The full series object.
 * @param {number} seasonNum - The season number to render.
 */
function renderEpisodeList(series, seasonNum) {
    const episodeListEl = UIElements.vodEpisodeList;
    if (!episodeListEl) return;
    const episodes = series.seasons[seasonNum];
    console.log(`[VOD] Rendering episodes for Series ID ${series.id}, Season ${seasonNum}:`, episodes);

    if (!episodes || episodes.length === 0) {
        episodeListEl.innerHTML = `<p class="p-8 text-center text-gray-400">No hay episodios disponibles para esta temporada.</p>`;
        return;
    }

    episodeListEl.innerHTML = episodes.map((ep, index) => {
        let epName = ep.name.split(' - ').pop();
        if (epName.length < 5) epName = ep.name;
        const originalTitle = ep.name || `Episodio ${index + 1}`;
        const epNum = ep.episode || (index + 1);

        return `
            <div class="episode-item group flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-gray-800/80 hover:bg-gray-750 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                 data-url="${ep.url}"
                 data-title="${originalTitle.replace(/"/g, '&quot;')}"
                 data-season-num="${seasonNum}"
                 data-episode-num="${epNum}"
                 data-id="${ep.id || ''}"
                 data-episode-title="${epName.replace(/"/g, '&quot;')}"
                 data-duration="${ep.duration || 0}">
                
                <div class="flex items-center gap-3 sm:gap-4 min-w-0 flex-grow pr-4">
                    <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-700 group-hover:bg-blue-600/30 group-hover:text-blue-400 text-gray-300 font-bold text-xs sm:text-sm flex items-center justify-center flex-shrink-0 transition-colors border border-gray-600/60 group-hover:border-blue-500/50">
                        ${index + 1}
                    </div>
                    <div class="min-w-0 flex-grow">
                        <h4 class="text-white text-sm sm:text-base font-semibold truncate group-hover:text-blue-300 transition-colors" title="${epName.replace(/"/g, '&quot;')}">
                            ${epName}
                        </h4>
                        <div class="flex items-center gap-2 sm:gap-3 text-xs text-gray-400 mt-0.5">
                            <span class="text-purple-400 font-medium">T${seasonNum}:E${epNum}</span>
                            ${ep.duration ? `<span>•</span><span>${formatDurationDisplay(ep.duration)}</span>` : ''}
                            ${ep.air_date ? `<span>•</span><span>${ep.air_date}</span>` : ''}
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0">
                    <button type="button" class="episode-item-play-btn w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-600/20 group-hover:bg-blue-600 text-blue-400 group-hover:text-white flex items-center justify-center transition-all duration-200 shadow group-hover:scale-105" title="Reproducir episodio">
                        <svg class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8.118v3.764a1 1 0 001.555.832l3.197-1.882a1 1 0 000-1.664l-3.197-1.882z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function showVodDetailsSkeleton() {
    if (UIElements.vodDetailsTitle) UIElements.vodDetailsTitle.textContent = 'Cargando...';
    if (UIElements.vodDetailsDesc) UIElements.vodDetailsDesc.textContent = 'Cargando información del catálogo VOD...';
    if (UIElements.vodDetailsPoster) {
        UIElements.vodDetailsPoster.src = 'https://placehold.co/400x600/1f2937/374151?text=Cargando...';
    }
    if (UIElements.vodDetailsMovieActions) UIElements.vodDetailsMovieActions.classList.add('hidden');
    if (UIElements.vodDetailsSeriesActions) UIElements.vodDetailsSeriesActions.classList.add('hidden');
    if (UIElements.vodDetailsBackdropImg) UIElements.vodDetailsBackdropImg.src = '';
}

function showVodItemNotFound(itemId) {
    if (UIElements.vodDetailsTitle) UIElements.vodDetailsTitle.textContent = 'Contenido no encontrado';
    if (UIElements.vodDetailsDesc) {
        UIElements.vodDetailsDesc.textContent = `No se pudo encontrar ningún título con ID "${itemId}" en la biblioteca VOD.`;
    }
    if (UIElements.vodDetailsPoster) {
        UIElements.vodDetailsPoster.src = 'https://placehold.co/400x600/1f2937/d1d5db?text=No+Encontrado';
    }
    if (UIElements.vodDetailsMovieActions) UIElements.vodDetailsMovieActions.classList.add('hidden');
    if (UIElements.vodDetailsSeriesActions) UIElements.vodDetailsSeriesActions.classList.add('hidden');
    if (UIElements.vodDetailsBackdropImg) UIElements.vodDetailsBackdropImg.src = '';
}

let vodEventListenersInitialized = false;

/**
 * Sets up all event listeners for the VOD page and VOD details page.
 */
function setupVodEventListeners() {
    if (vodEventListenersInitialized) return;
    vodEventListenersInitialized = true;

    // --- Back button on VOD Details page ---
    UIElements.vodDetailsBackBtn?.addEventListener('click', () => {
        navigate('/vod');
    });

    // --- Filter Bar Listeners ---
    UIElements.vodTypeAll?.addEventListener('click', () => {
        UIElements.vodTypeAll.classList.add('active');
        UIElements.vodTypeMovies?.classList.remove('active');
        UIElements.vodTypeSeries?.classList.remove('active');
        renderVodGrid();
    });
    UIElements.vodTypeMovies?.addEventListener('click', () => {
        UIElements.vodTypeAll?.classList.remove('active');
        UIElements.vodTypeMovies.classList.add('active');
        UIElements.vodTypeSeries?.classList.remove('active');
        renderVodGrid();
    });
    UIElements.vodTypeSeries?.addEventListener('click', () => {
        UIElements.vodTypeAll?.classList.remove('active');
        UIElements.vodTypeMovies?.classList.remove('active');
        UIElements.vodTypeSeries.classList.add('active');
        renderVodGrid();
    });

    UIElements.vodGroupFilter?.addEventListener('change', renderVodGrid);
    UIElements.vodSearchInput?.addEventListener('input', () => {
        clearTimeout(vodState.searchDebounce);
        vodState.searchDebounce = setTimeout(renderVodGrid, 300);
    });

    UIElements.vodDirectPlayCheckbox?.addEventListener('change', () => {
        const isEnabled = UIElements.vodDirectPlayCheckbox.checked;
        guideState.settings.vodDirectPlayEnabled = isEnabled;
        saveUserSetting('vodDirectPlayEnabled', isEnabled);
        showNotification(`VOD Direct Play ${isEnabled ? 'enabled' : 'disabled'}.`, false, 2000);
        console.log(`[VOD] VOD Direct Play toggled to: ${isEnabled}`);
    });

    // --- Pagination Listeners ---
    const paginationContainer = document.getElementById('vod-pagination-controls');
    if (paginationContainer) {
        const pageSizeSelect = paginationContainer.querySelector('#vod-page-size-select');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', changeVodPageSize);
        }
    }

    // --- VOD Grid Click Listener (Event Delegation) ---
    UIElements.vodGrid?.addEventListener('click', (e) => {
        const vodItemEl = e.target.closest('.vod-item');
        if (vodItemEl) {
            const itemId = vodItemEl.dataset.id;
            console.log(`[VOD_CLICK] Click detected on item with data-id: ${itemId}`);
            navigate(`/vod/details/${encodeURIComponent(itemId)}`);
        }
    });

    // Episode play click (Event Delegation)
    UIElements.vodEpisodeList?.addEventListener('click', (e) => {
        const episodeItem = e.target.closest('.episode-item');
        if (episodeItem) {
            const url = episodeItem.dataset.url;
            const title = episodeItem.dataset.title;
            const seriesLogo = UIElements.vodEpisodeList.dataset.seriesLogo || '';
            const epDuration = parseInt(episodeItem.dataset.duration, 10) || 0;
            const epContext = {
                contentType: 'series',
                contentId: UIElements.vodEpisodeList.dataset.seriesId || '',
                title: UIElements.vodEpisodeList.dataset.seriesName || title,
                seriesName: UIElements.vodEpisodeList.dataset.seriesName || '',
                seasonNum: parseInt(episodeItem.dataset.seasonNum, 10) || 1,
                episodeNum: parseInt(episodeItem.dataset.episodeNum, 10) || 1,
                episodeId: episodeItem.dataset.id || '',
                episodeTitle: episodeItem.dataset.episodeTitle || title,
                logo: seriesLogo,
                streamUrl: url,
                duration: epDuration
            };
            playVOD(url, title, seriesLogo, 0, epContext);
        }
    });
}

/**
 * Renders the pagination controls below the VOD grid.
 */
function renderVodPaginationControls() {
    const controlsContainer = document.getElementById('vod-pagination-controls'); // We'll add this ID in index.html
    if (!controlsContainer) return;

    const { currentPage, totalPages, totalItems, pageSize } = vodState.pagination;

    if (totalPages <= 1) {
        controlsContainer.innerHTML = ''; // Hide controls if only one page
        return;
    }

    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(startItem + pageSize - 1, totalItems);

    let pagesHTML = '';
    // Previous button
    pagesHTML += `<li><button class="pagination-btn prev-page-btn" ${currentPage === 1 ? 'disabled' : ''}>Prev</button></li>`;

    // Page number buttons (simplified for now: first, current, last)
    pagesHTML += `<li><button class="pagination-btn page-number-btn ${1 === currentPage ? 'active' : ''}" data-page="1">1</button></li>`;

    if (currentPage > 2) {
        pagesHTML += `<li><span class="pagination-btn">...</span></li>`;
    }
    if (currentPage !== 1 && currentPage !== totalPages) {
        pagesHTML += `<li><button class="pagination-btn page-number-btn active" data-page="${currentPage}">${currentPage}</button></li>`;
    }
    if (currentPage < totalPages - 1) {
        pagesHTML += `<li><span class="pagination-btn">...</span></li>`;
    }

    if (totalPages > 1) {
        pagesHTML += `<li><button class="pagination-btn page-number-btn ${totalPages === currentPage ? 'active' : ''}" data-page="${totalPages}">${totalPages}</button></li>`;
    }


    // Next button
    pagesHTML += `<li><button class="pagination-btn next-page-btn" ${currentPage === totalPages ? 'disabled' : ''}>Next</button></li>`;

    controlsContainer.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0 p-4" aria-label="Table navigation">
            <div class="flex items-center gap-2">
                <span class="text-sm font-normal text-gray-400">Page Size:</span>
                <select id="vod-page-size-select" class="bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm text-white focus:ring-blue-500 focus:border-blue-500">
                    <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                    <option value="75" ${pageSize === 75 ? 'selected' : ''}>75</option>
                    <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
                </select>
                <span id="vod-pagination-info" class="text-sm font-normal text-gray-400 ml-4">
                    Showing ${startItem}-${endItem} of ${totalItems}
                </span>
            </div>
            <ul id="vod-pagination-pages" class="inline-flex items-center -space-x-px">
                ${pagesHTML}
            </ul>
        </div>
    `;

    // Re-attach listeners specifically for the newly rendered elements
    const pageSizeSelect = controlsContainer.querySelector('#vod-page-size-select');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', changeVodPageSize);
    }
    const paginationPages = controlsContainer.querySelector('#vod-pagination-pages');
    if (paginationPages) {
        paginationPages.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button || button.disabled) return;

            if (button.classList.contains('prev-page-btn')) {
                goToVodPage(vodState.pagination.currentPage - 1);
            } else if (button.classList.contains('next-page-btn')) {
                goToVodPage(vodState.pagination.currentPage + 1);
            } else if (button.classList.contains('page-number-btn')) {
                const pageNum = parseInt(button.dataset.page, 10);
                if (pageNum) {
                    goToVodPage(pageNum);
                }
            }
        });
    }
}

/**
 * Navigates to a specific page in the VOD grid.
 * @param {number} pageNum - The page number to go to.
 */
function goToVodPage(pageNum) {
    const { totalPages } = vodState.pagination;
    if (pageNum >= 1 && pageNum <= totalPages) {
        vodState.pagination.currentPage = pageNum;
        renderVodGrid(); // Re-render the grid for the new page
        // Scroll to the top of the grid container
        UIElements.vodGridContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Changes the number of items shown per page in the VOD grid.
 * @param {Event} event - The change event from the select dropdown.
 */
function changeVodPageSize(event) {
    const newSize = parseInt(event.target.value, 10);
    if (newSize) {
        vodState.pagination.pageSize = newSize;
        vodState.pagination.currentPage = 1; // Reset to first page
        renderVodGrid(); // Re-render with new page size
        // Optionally save this preference
        // import('./api.js').then(({ saveUserSetting }) => saveUserSetting('vodPageSize', newSize));
    }
}
