/**
 * ============================================================
 *  Harmony Hub — DB-API Layer (db.js)
 * ============================================================
 *  The ONLY module that touches localStorage directly.
 *  Exposes CRUD helpers for two "tables":
 *    • harmony_users       — registered user accounts
 *    • harmony_instruments  — musical-instrument catalog
 * ============================================================
 */

const DB_KEYS = {
    USERS: 'harmony_users',
    INSTRUMENTS: 'harmony_instruments',
};

/** Path to the external seed-data file */
const SEED_DATA_PATH = '../data/instruments.json';

/* ========================================================= */
/*  Internal helpers                                          */
/* ========================================================= */

/**
 * Read a table from localStorage, returning a parsed array.
 * @param {string} key - localStorage key
 * @returns {Array<Object>}
 */
function _read(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * Write an array to localStorage under the given key.
 * @param {string} key
 * @param {Array<Object>} data
 */
function _write(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Generate a simple unique ID (timestamp + random suffix).
 * @returns {string}
 */
function _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ========================================================= */
/*  Seed — loads data from external JSON on first visit       */
/* ========================================================= */

/**
 * Fetch the seed instruments from data/instruments.json and
 * populate localStorage if the tables do not exist yet.
 * Must be called (and awaited) once before using the DB.
 */
async function _seedIfNeeded() {
    if (!localStorage.getItem(DB_KEYS.USERS)) {
        _write(DB_KEYS.USERS, []);
    }
    if (!localStorage.getItem(DB_KEYS.INSTRUMENTS)) {
        try {
            const response = await fetch(SEED_DATA_PATH);
            const seedInstruments = await response.json();
            _write(DB_KEYS.INSTRUMENTS, seedInstruments);
        } catch (err) {
            console.error('Failed to load seed data:', err);
            _write(DB_KEYS.INSTRUMENTS, []);
        }
    }
}

/* ========================================================= */
/*  Public DB-API                                             */
/* ========================================================= */

/** @namespace DB */
const DB = {
    /**
     * Initialize the database (seed from external JSON if needed).
     * Must be awaited once before the app starts.
     */
    async init() {
        await _seedIfNeeded();
    },

    /* ---------- Users ---------- */

    users: {
        /** Return all user records. */
        getAll() {
            return _read(DB_KEYS.USERS);
        },

        /** Find a single user by `username`. */
        getByUsername(username) {
            return _read(DB_KEYS.USERS).find((u) => u.username === username) || null;
        },

        /** Insert a new user record. Returns the created user object. */
        insert(user) {
            const users = _read(DB_KEYS.USERS);
            const newUser = { id: _generateId(), ...user };
            users.push(newUser);
            _write(DB_KEYS.USERS, users);
            return newUser;
        },
    },

    /* ---------- Instruments ---------- */

    instruments: {
        /** Return every instrument. */
        getAll() {
            return _read(DB_KEYS.INSTRUMENTS);
        },

        /** Find a single instrument by `id`. */
        getById(id) {
            return _read(DB_KEYS.INSTRUMENTS).find((i) => i.id === id) || null;
        },

        /** Insert a new instrument. Returns the created record. */
        insert(instrument) {
            const items = _read(DB_KEYS.INSTRUMENTS);
            const newItem = { id: _generateId(), ...instrument };
            items.push(newItem);
            _write(DB_KEYS.INSTRUMENTS, items);
            return newItem;
        },

        /** Update fields on an existing instrument. Returns updated record or null. */
        update(id, changes) {
            const items = _read(DB_KEYS.INSTRUMENTS);
            const idx = items.findIndex((i) => i.id === id);
            if (idx === -1) return null;
            items[idx] = { ...items[idx], ...changes, id }; // guard id overwrite
            _write(DB_KEYS.INSTRUMENTS, items);
            return items[idx];
        },

        /** Delete an instrument by `id`. Returns true if found & removed. */
        remove(id) {
            const items = _read(DB_KEYS.INSTRUMENTS);
            const filtered = items.filter((i) => i.id !== id);
            if (filtered.length === items.length) return false;
            _write(DB_KEYS.INSTRUMENTS, filtered);
            return true;
        },
    },
};

export default DB;
