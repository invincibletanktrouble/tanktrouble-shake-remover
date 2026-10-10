// ==UserScript==
// @name         Tank Trouble - Shake Remover
// @namespace    https://github.com/invincibletanktrouble/TankTrouble-Shake-Remover
// @version      1.1.8
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
        let patched = code;

        // Zero out all shake intensity constants (handles both "=" and ":")
        const shakeKeys = [
            'TANK_EXPLOSION_CAMERA_SHAKE',
            'MAX_CAMERA_SHAKE',
            'CAMERA_SHAKE',
            'MINE_EXPLOSION_CAMERA_SHAKE',
            'SPAWN_ZONE_UNSTABLE_SHAKE'
        ];

        for (const key of shakeKeys) {
            const regex = new RegExp('(' + key + '\\s*[:=]\\s*)[0-9.]+', 'g');
            patched = patched.replace(regex, (match, prefix) => prefix + '0');
        }

        // Neuter Phaser Camera shake functions in libraries
        patched = patched
            .replace(/shake\s*:\s*function\s*\([^)]*\)\s*\{/g, 'shake:function(){return;')
            .replace(/shake\s*\([^)]*\)\s*\{/g, 'shake(){return;');

        return patched;
    }

    // 1. Intercept network fetch requests
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const res = await origFetch.apply(this, args);
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        if (url.includes('index-') || url.includes('libraries-') || url.includes('index.js') || url.includes('libraries.js')) {
            const text = await res.text();
            return new Response(patchGameSource(text), {
                status: res.status,
                statusText: res.statusText,
                headers: res.headers
            });
        }
        return res;
    };

    // 2. Intercept static script elements synchronously
    function processScript(node) {
        if (node.tagName === 'SCRIPT' && node.src && !node._ttPatched) {
            const src = node.src;
            if (src.includes('index-') || src.includes('libraries-') || src.includes('index.js') || src.includes('libraries.js')) {
                node._ttPatched = true;
                node.removeAttribute('src');
                try {
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', src, false);
                    xhr.send();
                    node.textContent = patchGameSource(xhr.responseText);
                    console.log('%c[ShakeRemover] Successfully zeroed shake in: ' + src, 'color:#00ff00;font-weight:bold;');
                } catch (e) {
                    node.src = src;
                }
            }
        }
    }

    // Catch scripts already parsed in DOM
    document.querySelectorAll('script[src]').forEach(processScript);

    // Catch scripts added dynamically during startup
    const obs = new MutationObserver(mutations => {
        for (const m of mutations) {
            for (const n of m.addedNodes) {
                processScript(n);
                if (n.querySelectorAll) {
                    n.querySelectorAll('script[src]').forEach(processScript);
                }
            }
        }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    // 3. Fallback: freeze camera shake method if Phaser is instantiated
    setInterval(() => {
        if (window.Phaser?.Camera?.prototype) {
            window.Phaser.Camera.prototype.shake = function() {};
        }
    }, 50);
})();
