import { guideState } from './state.js';
/**
 * watchTracker.js
 * Tracks video playback progress and syncs it with the backend API.
 * Handles throttled sync every 10s, pause/end events, and beacon persistence on window unload.
 */

import { apiFetch } from './api.js';
import { withBase } from './basePath.js';

let activeContext = null;
let initialSeekOffset = 0;
let syncInterval = null;
let lastSyncedTime = -1;
let videoElementRef = null;

function getSyncIntervalMs() {
    const sec = parseInt(guideState?.settings?.vodProgressSyncIntervalSeconds, 10);
    return (sec && sec >= 1 ? sec : 5) * 1000;
}

function getCurrentPlaybackPosition() {
    if (!videoElementRef) return 0;
    // Real position = the seek offset (if started with -ss) + the time elapsed in the current video session
    return Math.max(0, initialSeekOffset + (videoElementRef.currentTime || 0));
}

function getMediaDuration() {
    if (activeContext && activeContext.duration > 0) {
        return activeContext.duration;
    }
    if (videoElementRef && Number.isFinite(videoElementRef.duration) && videoElementRef.duration > 0) {
        return videoElementRef.duration;
    }
    return 0;
}

export async function sendProgressUpdate(force = false) {
    if (!activeContext || !videoElementRef) return;

    const currentPos = getCurrentPlaybackPosition();
    const duration = getMediaDuration();

    // If change is less than 3 seconds and not forced, skip
    if (!force && Math.abs(currentPos - lastSyncedTime) < 2) return;

    lastSyncedTime = currentPos;

    const payload = {
        contentType: activeContext.contentType || 'movie',
        contentId: activeContext.contentId,
        title: activeContext.title,
        seriesName: activeContext.seriesName,
        seasonNum: activeContext.seasonNum,
        episodeNum: activeContext.episodeNum,
        episodeId: activeContext.episodeId,
        episodeTitle: activeContext.episodeTitle,
        logo: activeContext.logo,
        streamUrl: activeContext.streamUrl,
        currentTime: currentPos,
        duration: duration
    };

    console.log(`[WATCH_TRACKER] Syncing progress: "${payload.title}" at ${Math.round(currentPos)}s / ${Math.round(duration)}s`);

    try {
        await apiFetch('/api/vod/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.warn('[WATCH_TRACKER] Progress sync failed:', e);
    }
}

// Emergency beacon for beforeunload to ensure no loss of progress
function sendBeaconUpdate() {
    if (!activeContext || !videoElementRef) return;
    const currentPos = getCurrentPlaybackPosition();
    const duration = getMediaDuration();
    const minTime = parseInt(guideState?.settings?.vodMinWatchTimeSeconds, 10) || 5;
    if (currentPos < minTime) return;

    const payload = {
        contentType: activeContext.contentType || 'movie',
        contentId: activeContext.contentId,
        title: activeContext.title,
        seriesName: activeContext.seriesName,
        seasonNum: activeContext.seasonNum,
        episodeNum: activeContext.episodeNum,
        episodeId: activeContext.episodeId,
        episodeTitle: activeContext.episodeTitle,
        logo: activeContext.logo,
        streamUrl: activeContext.streamUrl,
        currentTime: currentPos,
        duration: duration
    };

    if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(withBase('/api/vod/progress'), blob);
    }
}

const onVideoPause = () => sendProgressUpdate(true);
const onVideoEnded = () => sendProgressUpdate(true);
const onBeforeUnload = () => sendBeaconUpdate();

export function startTracking(videoElement, context, seekOffset = 0) {
    stopTracking(); // Ensure any prior tracking is cleaned up

    videoElementRef = videoElement;
    activeContext = context;
    initialSeekOffset = parseFloat(seekOffset) || 0;
    lastSyncedTime = initialSeekOffset;

    console.log(`[WATCH_TRACKER] Started tracking "${context?.title}" from offset ${initialSeekOffset}s`);

    if (videoElementRef) {
        videoElementRef.addEventListener('pause', onVideoPause);
        videoElementRef.addEventListener('ended', onVideoEnded);
        window.addEventListener('beforeunload', onBeforeUnload);
    }

    // Periodic sync interval
    const intervalMs = getSyncIntervalMs();
    console.log(`[WATCH_TRACKER] Sync interval configured to ${intervalMs / 1000}s`);
    syncInterval = setInterval(() => {
        if (videoElementRef && !videoElementRef.paused) {
            sendProgressUpdate();
        }
    }, intervalMs);
}

export function updateTrackingDuration(duration) {
    if (activeContext && duration > 0) {
        activeContext.duration = duration;
    }
}

export function stopTracking() {
    if (activeContext && videoElementRef) {
        sendProgressUpdate(true); // Final sync
    }

    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }

    if (videoElementRef) {
        videoElementRef.removeEventListener('pause', onVideoPause);
        videoElementRef.removeEventListener('ended', onVideoEnded);
        window.removeEventListener('beforeunload', onBeforeUnload);
    }

    videoElementRef = null;
    activeContext = null;
    initialSeekOffset = 0;
}
