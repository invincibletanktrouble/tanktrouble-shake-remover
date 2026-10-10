// ==UserScript==
// @name         Tank Trouble - Shake Remover
// @namespace    https://github.com/invincibletanktrouble/TankTrouble-Shake-Remover
// @version      1.1.0
// @description  Completely eliminates explosion and weapon screen shake in Tank Trouble.
// @author       invincible
// @match        https://tanktrouble.com/*
// @match        https://*.tanktrouble.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function patchGameSource(code) {
        return code
            .replace(/TANK_EXPLOSION_CAMERA_SHAKE\s*=\s*\d+/g, 'TANK_EXPLOSION_CAMERA_SHAKE=0')
            .replace(/MAX_CAMERA_SHAKE\s*=\s*\d+/g, 'MAX_CAMERA_SHAKE=0')
            .replace(/CAMERA_SHAKE\s*=\s*\d+/g, 'CAMERA_SHAKE=0')
            .replace(/MINE_EXPLOSION_CAMERA_SHAKE\s*=\s*\d+/g, 'MINE_EXPLOSION_CAMERA_SHAKE=0')
            .replace(/SPAWN_ZONE_UNSTABLE_SHAKE\s*=\s*\d+/g, 'SPAWN_ZONE_UNSTABLE_SHAKE=0')
            .replace(/shake:\s*function\s*\(([^)]*)\)\s*\{/g, 'shake:function($1){return;');
    }

    // 1. Intercept dynamic fetch/bundles
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';

        if (url.includes('/build/js/index-') || url.includes('/build/js/libraries-') || url.includes('libraries.js') || url.includes('index.js')) {
            const text = await response.text();
            return new Response(patchGameSource(text), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        }
        return response;
    };

    // 2. Intercept static script elements before browser executes them
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.tagName === 'SCRIPT' && node.src) {
                    if (node.src.includes('/build/js/index-') || node.src.includes('/build/js/libraries-') || node.src.includes('libraries.js') || node.src.includes('index.js')) {
                        const originalSrc = node.src;
                        node.removeAttribute('src');

                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', originalSrc, false); // Synchronous fetch to keep load order intact
                        try {
                            xhr.send();
                            node.textContent = patchGameSource(xhr.responseText);
                        } catch (e) {
                            node.src = originalSrc;
                        }
                    }
                }
            }
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
