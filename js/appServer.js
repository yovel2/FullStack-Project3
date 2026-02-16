/**
 * ============================================================
 *  Harmony Hub — App Server (appServer.js)
 * ============================================================
 *  Simulated application server for instrument CRUD.
 *  Routes:
 *    GET    /instruments        — list all instruments
 *    GET    /instruments/:id    — single instrument
 *    POST   /instruments        — create  (auth required)
 *    PUT    /instruments/:id    — update  (auth required)
 *    DELETE /instruments/:id    — remove  (auth required)
 * ============================================================
 */

import DB from './db.js';
import { verifyToken } from './authServer.js';

/* ========================================================= */
/*  Helpers                                                   */
/* ========================================================= */

/**
 * Build a standard JSON response.
 * @param {number} status
 * @param {Object} body
 * @returns {{ status: number, body: string }}
 */
function _response(status, body) {
    return { status, body: JSON.stringify(body) };
}

/**
 * Extract the resource ID from a URL like "/instruments/42".
 * @param {string} url
 * @returns {string|null}
 */
function _extractId(url) {
    const parts = url.split('/').filter(Boolean); // e.g. ["instruments", "42"]
    return parts.length >= 2 ? parts[1] : null;
}

/**
 * Check Authorization header; returns username or an error response.
 * @param {Object} headers
 * @returns {{ ok: boolean, username?: string, error?: Object }}
 */
function _authorize(headers) {
    const token = (headers && headers['Authorization']) || '';
    const username = verifyToken(token);
    if (!username) {
        return { ok: false, error: _response(401, { error: 'Unauthorized. Please log in.' }) };
    }
    return { ok: true, username };
}

/**
 * Validate required fields on an instrument payload.
 * @param {Object} data
 * @returns {string|null} error message or null
 */
function _validateInstrument(data) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        return 'Instrument name is required.';
    }
    if (!data.category || typeof data.category !== 'string') {
        return 'Category is required.';
    }
    if (data.price == null || isNaN(Number(data.price)) || Number(data.price) < 0) {
        return 'A valid price is required.';
    }
    if (data.stock == null || isNaN(Number(data.stock)) || Number(data.stock) < 0) {
        return 'A valid stock quantity is required.';
    }
    return null;
}

/* ========================================================= */
/*  Route handler                                             */
/* ========================================================= */

/**
 * Process an incoming request directed at the App Server.
 *
 * @param {string} method
 * @param {string} url
 * @param {Object} headers
 * @param {string|null} body
 * @returns {{ status: number, body: string }}
 */
function handleRequest(method, url, headers, body) {
    // Normalize URL for matching
    const cleanUrl = url.split('?')[0]; // strip query string

    /* ---- GET /instruments ---- */
    if (method === 'GET' && cleanUrl === '/instruments') {
        const instruments = DB.instruments.getAll();
        return _response(200, instruments);
    }

    /* ---- GET /instruments/:id ---- */
    if (method === 'GET' && cleanUrl.startsWith('/instruments/')) {
        const id = _extractId(cleanUrl);
        const instrument = DB.instruments.getById(id);
        if (!instrument) {
            return _response(404, { error: 'Instrument not found.' });
        }
        return _response(200, instrument);
    }

    /* ---- POST /instruments ---- */
    if (method === 'POST' && cleanUrl === '/instruments') {
        const auth = _authorize(headers);
        if (!auth.ok) return auth.error;

        try {
            const data = JSON.parse(body);
            const validationError = _validateInstrument(data);
            if (validationError) return _response(400, { error: validationError });

            const instrument = DB.instruments.insert({
                name: data.name.trim(),
                category: data.category.trim(),
                price: Number(data.price),
                stock: Number(data.stock),
                description: (data.description || '').trim(),
                image: (data.image || '').trim(),
            });

            return _response(201, instrument);
        } catch {
            return _response(400, { error: 'Invalid request body.' });
        }
    }

    /* ---- PUT /instruments/:id ---- */
    if (method === 'PUT' && cleanUrl.startsWith('/instruments/')) {
        const auth = _authorize(headers);
        if (!auth.ok) return auth.error;

        const id = _extractId(cleanUrl);

        try {
            const data = JSON.parse(body);
            const validationError = _validateInstrument(data);
            if (validationError) return _response(400, { error: validationError });

            const updated = DB.instruments.update(id, {
                name: data.name.trim(),
                category: data.category.trim(),
                price: Number(data.price),
                stock: Number(data.stock),
                description: (data.description || '').trim(),
                image: (data.image || '').trim(),
            });

            if (!updated) return _response(404, { error: 'Instrument not found.' });
            return _response(200, updated);
        } catch {
            return _response(400, { error: 'Invalid request body.' });
        }
    }

    /* ---- DELETE /instruments/:id ---- */
    if (method === 'DELETE' && cleanUrl.startsWith('/instruments/')) {
        const auth = _authorize(headers);
        if (!auth.ok) return auth.error;

        const id = _extractId(cleanUrl);
        const removed = DB.instruments.remove(id);
        if (!removed) return _response(404, { error: 'Instrument not found.' });
        return _response(200, { message: 'Instrument deleted.' });
    }

    /* ---- 404 fallback ---- */
    return _response(404, { error: 'Route not found.' });
}

export { handleRequest };
