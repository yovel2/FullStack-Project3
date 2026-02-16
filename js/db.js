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

/* ---------- seed data (loaded on first visit) ---------- */

const SEED_INSTRUMENTS = [
    {
        id: '1',
        name: 'Fender Stratocaster',
        category: 'Guitars',
        price: 1299,
        stock: 8,
        description: 'Iconic electric guitar with a classic tone and comfortable neck profile.',
        image: 'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=400',
    },
    {
        id: '2',
        name: 'Yamaha U1 Upright Piano',
        category: 'Pianos',
        price: 5499,
        stock: 3,
        description: 'Professional upright piano with rich tonal quality and responsive action.',
        image: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400',
    },
    {
        id: '3',
        name: 'Pearl Export Drum Kit',
        category: 'Drums',
        price: 849,
        stock: 5,
        description: 'Complete 5-piece drum set ideal for gigging and studio recording.',
        image: 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=400',
    },
    {
        id: '4',
        name: 'Gibson Les Paul Standard',
        category: 'Guitars',
        price: 2499,
        stock: 4,
        description: 'Legendary solid-body electric guitar with humbucker pickups and sustain for days.',
        image: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400',
    },
    {
        id: '5',
        name: 'Roland FP-30X Digital Piano',
        category: 'Pianos',
        price: 749,
        stock: 10,
        description: 'Portable digital piano with weighted keys and built-in Bluetooth.',
        image: 'https://images.unsplash.com/photo-1552422535-c45813c61732?w=400',
    },
    {
        id: '6',
        name: 'Zildjian A Custom Cymbal Pack',
        category: 'Drums',
        price: 999,
        stock: 6,
        description: 'Professional cymbal set featuring brilliant finish and cutting projection.',
        image: 'https://images.unsplash.com/photo-1524230659092-07f99a75c013?w=400',
    },
    {
        id: '7',
        name: 'Martin D-28 Acoustic Guitar',
        category: 'Guitars',
        price: 3099,
        stock: 2,
        description: 'Premium dreadnought acoustic with solid Sitka spruce top and rosewood back.',
        image: 'https://images.unsplash.com/photo-1550985616-10810253b84d?w=400',
    },
    {
        id: '8',
        name: 'Selmer Paris Alto Saxophone',
        category: 'Wind',
        price: 4200,
        stock: 3,
        description: 'Hand-crafted alto saxophone with warm tone and precise intonation.',
        image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=400',
    },
    {
        id: '9',
        name: 'Fender Precision Bass',
        category: 'Bass',
        price: 1749,
        stock: 5,
        description: 'The original electric bass guitar — deep, punchy, and unmistakable.',
        image: 'https://images.unsplash.com/photo-1612225330812-01a9c1b0d7ba?w=400',
    },
    {
        id: '10',
        name: 'Korg Minilogue XD Synthesizer',
        category: 'Keyboards',
        price: 649,
        stock: 7,
        description: 'Polyphonic analog synthesizer with digital multi-engine and effects.',
        image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400',
    },
];

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
/*  Seed (runs once)                                          */
/* ========================================================= */

function _seedIfNeeded() {
    if (!localStorage.getItem(DB_KEYS.INSTRUMENTS)) {
        _write(DB_KEYS.INSTRUMENTS, SEED_INSTRUMENTS);
    }
    if (!localStorage.getItem(DB_KEYS.USERS)) {
        _write(DB_KEYS.USERS, []);
    }
}

_seedIfNeeded();

/* ========================================================= */
/*  Public DB-API                                             */
/* ========================================================= */

/** @namespace DB */
const DB = {
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
