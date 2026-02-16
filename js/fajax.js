/**
 * ============================================================
 *  Harmony Hub — FAJAX Layer (fajax.js)
 * ============================================================
 *  FXMLHttpRequest — a class that mimics the browser's
 *  XMLHttpRequest API but communicates through the
 *  simulated Network layer instead of real HTTP.
 *
 *  Supported surface:
 *    .open(method, url)
 *    .setRequestHeader(key, value)
 *    .send(body)
 *    .onload / .onerror / .onreadystatechange
 *    .readyState / .status / .statusText / .responseText
 *    .abort()
 *
 *  Also exposes a Promise-based helper `fajax()` for convenience.
 * ============================================================
 */

import Network from './network.js';

/* ---------- readyState constants ---------- */
const UNSENT = 0;
const OPENED = 1;
const HEADERS_RECEIVED = 2;
const LOADING = 3;
const DONE = 4;

/**
 * FXMLHttpRequest — fake XMLHttpRequest.
 * @class
 */
class FXMLHttpRequest {
    constructor() {
        this.readyState = UNSENT;
        this.status = 0;
        this.statusText = '';
        this.responseText = '';

        /** @type {function|null} */
        this.onload = null;
        /** @type {function|null} */
        this.onerror = null;
        /** @type {function|null} */
        this.onreadystatechange = null;

        // Internal
        this._method = '';
        this._url = '';
        this._headers = {};
        this._aborted = false;
    }

    /* ---- public API ---- */

    /**
     * Configure the request (does not send yet).
     * @param {string} method  HTTP verb
     * @param {string} url     route path
     */
    open(method, url) {
        this._method = method.toUpperCase();
        this._url = url;
        this._headers = {};
        this.readyState = OPENED;
        this._fireReadyStateChange();
    }

    /**
     * Set a request header.
     * @param {string} key
     * @param {string} value
     */
    setRequestHeader(key, value) {
        this._headers[key] = value;
    }

    /**
     * Dispatch the request through the Network layer.
     * @param {string|null} body  JSON-stringified payload
     */
    send(body = null) {
        if (this._aborted) return;

        const request = {
            method: this._method,
            url: this._url,
            headers: { ...this._headers },
            body: body,
        };

        // Transition to LOADING
        this.readyState = LOADING;
        this._fireReadyStateChange();

        Network.send(
            request,
            // --- success callback ---
            (response) => {
                if (this._aborted) return; // request was cancelled meanwhile
                this.status = response.status;
                this.statusText = this._statusTextFor(response.status);
                this.responseText = response.body; // already a JSON string
                this.readyState = DONE;
                this._fireReadyStateChange();
                if (typeof this.onload === 'function') this.onload();
            },
            // --- error callback (packet lost) ---
            () => {
                if (this._aborted) return;
                this.status = 0;
                this.statusText = 'Network Error';
                this.responseText = '';
                this.readyState = DONE;
                this._fireReadyStateChange();
                if (typeof this.onerror === 'function') this.onerror();
            },
        );
    }

    /**
     * Cancel an in-flight request.
     */
    abort() {
        this._aborted = true;
        this.readyState = UNSENT;
        this.status = 0;
    }

    /* ---- private helpers ---- */

    _fireReadyStateChange() {
        if (typeof this.onreadystatechange === 'function') {
            this.onreadystatechange();
        }
    }

    _statusTextFor(code) {
        const map = {
            200: 'OK',
            201: 'Created',
            400: 'Bad Request',
            401: 'Unauthorized',
            404: 'Not Found',
            409: 'Conflict',
            500: 'Internal Server Error',
        };
        return map[code] || 'Unknown';
    }
}

/* ========================================================= */
/*  Promise-based convenience wrapper                         */
/* ========================================================= */

/**
 * Send a request and return a Promise that resolves with
 * { status, data } or rejects on network failure / timeout.
 *
 * Includes a client-side timeout (default 8 s) to handle
 * indefinitely-lost packets or extreme delays.
 *
 * @param {Object}  opts
 * @param {string}  opts.method
 * @param {string}  opts.url
 * @param {Object}  [opts.headers]
 * @param {*}       [opts.body]       — will be JSON.stringified
 * @param {number}  [opts.timeout]    — ms, default 8000
 * @returns {Promise<{ status: number, data: * }>}
 */
function fajax({ method, url, headers = {}, body = null, timeout = 8000 }) {
    return new Promise((resolve, reject) => {
        const xhr = new FXMLHttpRequest();
        let settled = false;

        // Client-side timeout guard
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                xhr.abort();
                reject({ error: 'TIMEOUT', message: 'Request timed out.' });
            }
        }, timeout);

        xhr.open(method, url);

        // Apply headers
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

        xhr.onload = function () {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            let data;
            try {
                data = JSON.parse(xhr.responseText);
            } catch {
                data = xhr.responseText;
            }
            resolve({ status: xhr.status, data });
        };

        xhr.onerror = function () {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject({ error: 'NETWORK_ERROR', message: 'Network error — packet lost.' });
        };

        xhr.send(body !== null ? JSON.stringify(body) : null);
    });
}

export { FXMLHttpRequest, fajax };
