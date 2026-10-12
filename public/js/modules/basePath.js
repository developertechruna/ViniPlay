/**
 * basePath.js
 * Centralized base path detection and resolution for ViniPlay.
 * Supports root deployments (/), predefined subpaths (/viniplay), or any custom path (/tv, /iptv).
 */

const metaTag = typeof document !== 'undefined' ? document.querySelector('meta[name="base-path"]') : null;
const metaContent = metaTag ? metaTag.getAttribute('content') : null;

const detectedPrefix = (typeof window !== 'undefined' && window.__VINI_BASE_PATH__ !== undefined)
    ? window.__VINI_BASE_PATH__
    : (metaContent !== null ? metaContent : '');

// Normalize BASE_PATH: ensure single leading slash and no trailing slash (empty string if root)
export const BASE_PATH = detectedPrefix
    ? (detectedPrefix === '/' ? '' : (detectedPrefix.startsWith('/') ? detectedPrefix : '/' + detectedPrefix).replace(/\/+$/, ''))
    : '';

/**
 * Returns an absolute URL or path prefixed with BASE_PATH.
 * @param {string} path - URL path (e.g. '/stream', '/api/channels', '/viniplay.png')
 * @returns {string} - Full path prefixed with BASE_PATH
 */
export function withBase(path) {
    if (!path || path === '/') {
        return BASE_PATH ? `${BASE_PATH}/` : '/';
    }
    // If it's already an absolute or special URL, leave it untouched
    if (/^(https?:|blob:|data:|\/\/)/i.test(path)) {
        return path;
    }
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    if (BASE_PATH && (cleanPath === BASE_PATH || cleanPath.startsWith(BASE_PATH + '/'))) {
        return cleanPath;
    }
    return `${BASE_PATH}${cleanPath}`;
}

/**
 * Strips BASE_PATH from the beginning of a URL or pathname for client-side routing.
 * @param {string} pathname - Full pathname (e.g. '/viniplay/tvguide' or '/tvguide')
 * @returns {string} - Clean path without the BASE_PATH prefix
 */
export function stripBase(pathname) {
    if (!pathname) return '/';
    if (!BASE_PATH) return pathname;
    if (pathname === BASE_PATH || pathname === `${BASE_PATH}/`) return '/';
    if (pathname.startsWith(`${BASE_PATH}/`)) {
        const stripped = pathname.slice(BASE_PATH.length);
        return stripped.startsWith('/') ? stripped : '/' + stripped;
    }
    return pathname;
}
