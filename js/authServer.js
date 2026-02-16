/**
 * ============================================================
 *  Harmony Hub — Auth Server (authServer.js)
 * ============================================================
 *  Simulated authentication server.
 *  Routes:
 *    POST /auth/register  — create a new user
 *    POST /auth/login     — authenticate & return a token
 *    POST /auth/logout    — invalidate the session token
 *    GET  /auth/verify    — check if a token is still valid
 * ============================================================
 */

import DB from './db.js';

/* -------- session store (in-memory Map) -------- */
const _sessions = new Map(); // token → username

/**
 * Generate a simple session token.
 * @returns {string}
 */
function _createToken() {
    return 'tk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/**
 * Build a standard JSON response object.
 * @param {number} status  HTTP-like status code
 * @param {Object} body    response payload
 * @returns {{ status: number, body: string }}
 */
function _response(status, body) {
    return { status, body: JSON.stringify(body) };
}

/* ========================================================= */
/*  Route handler                                             */
/* ========================================================= */

/**
 * Process an incoming request directed at the Auth Server.
 *
 * @param {string} method  HTTP method (GET | POST)
 * @param {string} url     request URL (e.g. "/auth/login")
 * @param {Object} headers request headers (may contain Authorization)
 * @param {string|null} body  JSON-stringified body
 * @returns {{ status: number, body: string }}
 */
function handleRequest(method, url, headers, body) {
    /* ---- POST /auth/register ---- */
    if (method === 'POST' && url === '/auth/register') {
        try {
            const { username, password, fullName } = JSON.parse(body);

            if (!username || !password) {
                return _response(400, { error: 'Username and password are required.' });
            }

            if (username.length < 3) {
                return _response(400, { error: 'Username must be at least 3 characters.' });
            }

            if (password.length < 4) {
                return _response(400, { error: 'Password must be at least 4 characters.' });
            }

            // Check for existing user
            const existing = DB.users.getByUsername(username);
            if (existing) {
                return _response(409, { error: 'Username already exists.' });
            }

            const user = DB.users.insert({ username, password, fullName: fullName || username });
            return _response(201, { message: 'Registration successful.', userId: user.id });
        } catch {
            return _response(400, { error: 'Invalid request body.' });
        }
    }

    /* ---- POST /auth/login ---- */
    if (method === 'POST' && url === '/auth/login') {
        try {
            const { username, password } = JSON.parse(body);

            if (!username || !password) {
                return _response(400, { error: 'Username and password are required.' });
            }

            const user = DB.users.getByUsername(username);
            if (!user || user.password !== password) {
                return _response(401, { error: 'Invalid credentials.' });
            }

            const token = _createToken();
            _sessions.set(token, username);

            return _response(200, {
                message: 'Login successful.',
                token,
                user: { id: user.id, username: user.username, fullName: user.fullName },
            });
        } catch {
            return _response(400, { error: 'Invalid request body.' });
        }
    }

    /* ---- POST /auth/logout ---- */
    if (method === 'POST' && url === '/auth/logout') {
        const token = (headers && headers['Authorization']) || '';
        _sessions.delete(token);
        return _response(200, { message: 'Logged out.' });
    }

    /* ---- GET /auth/verify ---- */
    if (method === 'GET' && url === '/auth/verify') {
        const token = (headers && headers['Authorization']) || '';
        if (_sessions.has(token)) {
            const username = _sessions.get(token);
            const user = DB.users.getByUsername(username);
            return _response(200, {
                valid: true,
                user: user
                    ? { id: user.id, username: user.username, fullName: user.fullName }
                    : null,
            });
        }
        return _response(401, { valid: false, error: 'Invalid or expired token.' });
    }

    /* ---- 404 fallback ---- */
    return _response(404, { error: 'Auth route not found.' });
}

/* ========================================================= */
/*  Exported helpers                                          */
/* ========================================================= */

/**
 * Verify a token and return the associated username, or null.
 * Used internally by the App Server to gate protected routes.
 * @param {string} token
 * @returns {string|null}
 */
function verifyToken(token) {
    return _sessions.get(token) || null;
}

export { handleRequest, verifyToken };
