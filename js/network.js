/**
 * ============================================================
 *  Harmony Hub — Network Simulation Layer (network.js)
 * ============================================================
 *  Simulates real-world network behaviour:
 *    • Random latency   : 1 000 – 3 000 ms per message
 *    • Packet loss       : configurable probability (default 20%)
 *
 *  The FAJAX layer calls `Network.send()` which routes the
 *  request to the correct simulated server after the delay.
 * ============================================================
 */

import { handleRequest as authHandle } from './authServer.js';
import { handleRequest as appHandle } from './appServer.js';

/* ---------- configurable knobs ---------- */

const _config = {
    /** Minimum latency in ms */
    minDelay: 1000,
    /** Maximum latency in ms */
    maxDelay: 3000,
    /** Probability (0–1) that a packet is "dropped" */
    packetLoss: 0.2,
};

/* ========================================================= */
/*  Public API                                                */
/* ========================================================= */

const Network = {
    /* ---------- configuration ---------- */

    /**
     * Update network parameters at runtime (used by the UI panel).
     * @param {{ minDelay?: number, maxDelay?: number, packetLoss?: number }} opts
     */
    configure(opts) {
        if (opts.minDelay !== undefined) _config.minDelay = opts.minDelay;
        if (opts.maxDelay !== undefined) _config.maxDelay = opts.maxDelay;
        if (opts.packetLoss !== undefined) _config.packetLoss = opts.packetLoss;
    },

    /** Return a copy of the current config (for the UI). */
    getConfig() {
        return { ..._config };
    },

    /* ---------- core transport ---------- */

    /**
     * Send a request "over the network" to the simulated server.
     *
     * @param {Object}  request
     * @param {string}  request.method   — HTTP verb
     * @param {string}  request.url      — route path
     * @param {Object}  request.headers  — header map
     * @param {string|null} request.body — JSON string
     * @param {function} onSuccess       — called with { status, body }
     * @param {function} onError         — called when packet is dropped
     */
    send(request, onSuccess, onError) {
        const delay =
            Math.floor(Math.random() * (_config.maxDelay - _config.minDelay + 1)) + _config.minDelay;

        const dropped = Math.random() < _config.packetLoss;

        setTimeout(() => {
            if (dropped) {
                // Packet lost — invoke error callback
                if (typeof onError === 'function') {
                    onError({ error: 'PACKET_LOST', message: 'Network: packet was dropped.' });
                }
                return;
            }

            // Route to the correct server based on URL prefix
            let response;
            if (request.url.startsWith('/auth')) {
                response = authHandle(request.method, request.url, request.headers, request.body);
            } else {
                response = appHandle(request.method, request.url, request.headers, request.body);
            }

            if (typeof onSuccess === 'function') {
                onSuccess(response);
            }
        }, delay);
    },
};

export default Network;
