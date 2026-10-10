// ==UserScript==
// @name         Tank Trouble - Shake Remover
// @namespace    https://github.com/invincibletanktrouble/TankTrouble-Shake-Remover
// @version      1.0.0
// @description  Completely eliminates explosion and weapon screen shake in Tank Trouble for smooth, stable gameplay.
// @author       invincible
// @match        https://tanktrouble.com/*
// @match        https://*.tanktrouble.com/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/invincibletanktrouble/TankTrouble-Shake-Remover/main/TankTrouble-Shake-Remover.user.js
// @updateURL    https://raw.githubusercontent.com/invincibletanktrouble/TankTrouble-Shake-Remover/main/TankTrouble-Shake-Remover.user.js
// ==/UserScript==
(function() {
    'use strict';

    // 1. Intercept network fetching of scripts if loaded dynamically
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';

        if (url.includes('/build/js/index-') || url.includes('/build/js/libraries-')) {
            const text = await response.text();
            const patched = patchGameSource(text);
            return new Response(patched, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        }
        return response;
    };

    // 2. Patch text before it runs
    function patchGameSource(code) {
        return code
            // Force explosion camera shake constants to 0
            .replace(/TANK_EXPLOSION_CAMERA_SHAKE\s*=\s*\d+/g, 'TANK_EXPLOSION_CAMERA_SHAKE=0')
            .replace(/MAX_CAMERA_SHAKE\s*=\s*\d+/g, 'MAX_CAMERA_SHAKE=0')
            .replace(/CAMERA_SHAKE\s*=\s*\d+/g, 'CAMERA_SHAKE=0')
            .replace(/MINE_EXPLOSION_CAMERA_SHAKE\s*=\s*\d+/g, 'MINE_EXPLOSION_CAMERA_SHAKE=0')
            .replace(/SPAWN_ZONE_UNSTABLE_SHAKE\s*=\s*\d+/g, 'SPAWN_ZONE_UNSTABLE_SHAKE=0')
            // Neuter Phaser Camera.prototype.shake in libraries bundle
            .replace(/shake:\s*function\s*\(([^)]*)\)\s*\{/g, 'shake:function($1){return;');
    }

    // 3. MutationObserver to catch static script tags before execution
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.tagName === 'SCRIPT' && node.src) {
                    if (node.src.includes('/build/js/index-') || node.src.includes('/build/js/libraries-')) {
                        const originalSrc = node.src;
                        node.removeAttribute('src');

                        // Synchronously fetch, patch, and execute inline
                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', originalSrc, false);
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
