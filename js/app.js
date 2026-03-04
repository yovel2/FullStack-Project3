/**
 * ============================================================
 *  Harmony Hub — Client SPA (app.js)
 * ============================================================
 *  Hash-based SPA that communicates with the simulated servers
 *  exclusively through the FAJAX layer.
 *
 *  Features:
 *    - Login / Register / Logout
 *    - Instrument CRUD (list, detail, add, edit, delete)
 *    - Race-condition guard (monotonic request IDs)
 *    - Network-error / timeout toasts
 *    - Network-config panel wiring
 * ============================================================
 */

import { fajax } from './fajax.js';
import Network from './network.js';
import DB from './db.js';

/* ========================================================= */
/*  State                                                     */
/* ========================================================= */

/** @type {{ token: string|null, user: Object|null }} */
const _auth = {
    token: null,
    user: null,
};

/**
 * Monotonically increasing request ID.
 * Used to discard stale responses (race-condition guard).
 */
let _reqCounter = 0;

/* ========================================================= */
/*  DOM helpers                                               */
/* ========================================================= */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/** Clone a <template> and return the DocumentFragment. */
function cloneTemplate(id) {
    const tpl = document.getElementById(id);
    return tpl.content.cloneNode(true);
}

/** Render a template into #app. */
function renderView(templateId) {
    const app = $('#app');
    app.innerHTML = '';
    app.appendChild(cloneTemplate(templateId));
}

/* ========================================================= */
/*  Toast notifications                                       */
/* ========================================================= */

/**
 * Show a toast message.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration  — ms
 */
function toast(message, type = 'info', duration = 3500) {
    const container = $('#toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('toast-out');
        el.addEventListener('animationend', () => el.remove());
    }, duration);
}

/* ========================================================= */
/*  Loading overlay                                           */
/* ========================================================= */

let _loadingCount = 0;

function showLoading() {
    _loadingCount++;
    $('#loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    _loadingCount = Math.max(0, _loadingCount - 1);
    if (_loadingCount === 0) $('#loading-overlay').classList.add('hidden');
}

/* ========================================================= */
/*  API helper (wraps fajax with auth + race-condition guard) */
/* ========================================================= */

/**
 * Perform an API call via FAJAX.
 * Automatically attaches the auth token and handles errors.
 *
 * @param {Object} opts
 * @param {string} opts.method
 * @param {string} opts.url
 * @param {*}      [opts.body]
 * @param {boolean}[opts.silent] — suppress loading overlay
 * @returns {Promise<{ status: number, data: * }>}
 */
async function api({ method, url, body = null, silent = false }) {
    const reqId = ++_reqCounter;

    if (!silent) showLoading();

    const headers = {};
    if (_auth.token) headers['Authorization'] = _auth.token;

    try {
        const res = await fajax({ method, url, headers, body });

        // Race-condition guard — ignore stale responses
        if (reqId < _reqCounter && method === 'GET') {
            return { status: 0, data: null, stale: true };
        }

        if (!silent) hideLoading();
        return res;
    } catch (err) {
        if (!silent) hideLoading();

        if (err.error === 'TIMEOUT') {
            toast('Request timed out. Please try again.', 'error');
        } else {
            toast('Network error — packet lost. Please try again.', 'error');
        }
        throw err;
    }
}

/* ========================================================= */
/*  Router                                                    */
/* ========================================================= */

function getHash() {
    return window.location.hash.slice(1) || 'login';
}

function navigate(hash) {
    window.location.hash = hash;
}

function route() {
    const hash = getHash();
    const [path, param] = hash.split('/'); // e.g. "instrument/42"

    // Auth guard — redirect unauthenticated users
    const publicRoutes = ['login', 'register'];
    if (!_auth.token && !publicRoutes.includes(path)) {
        navigate('login');
        return;
    }

    // Already logged in — redirect away from auth pages
    if (_auth.token && publicRoutes.includes(path)) {
        navigate('dashboard');
        return;
    }

    // Show / hide navbar
    const navbar = $('#navbar');
    _auth.token ? navbar.classList.remove('hidden') : navbar.classList.add('hidden');

    switch (path) {
        case 'login': return viewLogin();
        case 'register': return viewRegister();
        case 'dashboard': return viewDashboard();
        case 'instrument': return viewDetail(param);
        case 'add': return viewForm();
        case 'edit': return viewForm(param);
        default: return navigate('login');
    }
}

/* ========================================================= */
/*  Views                                                     */
/* ========================================================= */

/* ---------- Login ---------- */

function viewLogin() {
    renderView('tpl-login');

    $('#form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = $('#login-user').value.trim();
        const password = $('#login-pass').value;

        try {
            const res = await api({ method: 'POST', url: '/auth/login', body: { username, password } });

            if (res.status === 200) {
                _auth.token = res.data.token;
                _auth.user = res.data.user;
                updateNavUser();
                toast('Logged in successfully.', 'success');
                navigate('dashboard');
            } else {
                toast(res.data.error || 'Login failed.', 'error');
            }
        } catch {
            // network error already toasted
        }
    });
}

/* ---------- Register ---------- */

function viewRegister() {
    renderView('tpl-register');

    $('#form-register').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = $('#reg-name').value.trim();
        const username = $('#reg-user').value.trim();
        const password = $('#reg-pass').value;

        try {
            const res = await api({ method: 'POST', url: '/auth/register', body: { fullName, username, password } });

            if (res.status === 201) {
                toast('Account created. Please sign in.', 'success');
                navigate('login');
            } else {
                toast(res.data.error || 'Registration failed.', 'error');
            }
        } catch {
            // network error already toasted
        }
    });
}

/* ---------- Dashboard ---------- */

async function viewDashboard() {
    renderView('tpl-dashboard');

    const grid = $('#instruments-grid');
    const searchInput = $('#search-input');
    const filterSelect = $('#filter-category');

    let instruments = [];

    async function loadInstruments() {
        try {
            const res = await api({ method: 'GET', url: '/instruments' });
            if (res.stale) return;
            if (res.status === 200 && Array.isArray(res.data)) {
                instruments = res.data;
                renderGrid();
            }
        } catch {
            grid.innerHTML = '<p class="empty-state">Could not load instruments. Please try again.</p>';
        }
    }

    function renderGrid() {
        const query = searchInput.value.toLowerCase();
        const cat = filterSelect.value;

        const filtered = instruments.filter((item) => {
            const matchQuery =
                item.name.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query);
            const matchCat = !cat || item.category === cat;
            return matchQuery && matchCat;
        });

        grid.innerHTML = '';

        if (filtered.length === 0) {
            grid.innerHTML = '<p class="empty-state">No instruments found.</p>';
            return;
        }

        filtered.forEach((item, idx) => {
            const frag = cloneTemplate('tpl-card');
            const card = frag.querySelector('.instrument-card');

            card.style.animationDelay = `${idx * .06}s`;
            card.querySelector('.card-img').src = item.image || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400';
            card.querySelector('.card-img').alt = item.name;
            card.querySelector('.card-badge').textContent = item.category;
            card.querySelector('.card-title').textContent = item.name;
            card.querySelector('.card-desc').textContent = item.description || '';
            card.querySelector('.card-price').textContent = `$${Number(item.price).toLocaleString()}`;
            card.querySelector('.card-stock').textContent = `${item.stock} in stock`;

            card.addEventListener('click', () => navigate(`instrument/${item.id}`));

            grid.appendChild(frag);
        });
    }

    searchInput.addEventListener('input', renderGrid);
    filterSelect.addEventListener('change', renderGrid);

    await loadInstruments();
}

/* ---------- Instrument detail ---------- */

async function viewDetail(id) {
    renderView('tpl-detail');

    try {
        const res = await api({ method: 'GET', url: `/instruments/${id}` });
        if (res.stale) return;

        if (res.status !== 200) {
            toast('Instrument not found.', 'error');
            navigate('dashboard');
            return;
        }

        const item = res.data;
        $('#detail-img').src = item.image || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400';
        $('#detail-img').alt = item.name;
        $('#detail-category').textContent = item.category;
        $('#detail-name').textContent = item.name;
        $('#detail-description').textContent = item.description || '';
        $('#detail-price').textContent = `$${Number(item.price).toLocaleString()}`;
        $('#detail-stock').textContent = item.stock;
        $('#detail-edit').href = `#edit/${item.id}`;

        // Delete button
        $('#detail-delete').addEventListener('click', () => confirmDelete(item));
    } catch {
        // network error already toasted
    }
}

/* ---------- Add / Edit form ---------- */

async function viewForm(editId) {
    renderView('tpl-form');

    const isEdit = Boolean(editId);
    $('#form-title').textContent = isEdit ? 'Edit Instrument' : 'Add Instrument';
    $('#form-submit').textContent = isEdit ? 'Update Instrument' : 'Save Instrument';

    // If editing, pre-fill the form
    if (isEdit) {
        try {
            const res = await api({ method: 'GET', url: `/instruments/${editId}` });
            if (res.status === 200) {
                const item = res.data;
                $('#f-name').value = item.name;
                $('#f-category').value = item.category;
                $('#f-price').value = item.price;
                $('#f-stock').value = item.stock;
                $('#f-image').value = item.image || '';
                $('#f-desc').value = item.description || '';
            } else {
                toast('Instrument not found.', 'error');
                navigate('dashboard');
                return;
            }
        } catch {
            return; // network error already toasted
        }
    }

    $('#instrument-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            name: $('#f-name').value,
            category: $('#f-category').value,
            price: $('#f-price').value,
            stock: $('#f-stock').value,
            image: $('#f-image').value,
            description: $('#f-desc').value,
        };

        try {
            const res = isEdit
                ? await api({ method: 'PUT', url: `/instruments/${editId}`, body: payload })
                : await api({ method: 'POST', url: '/instruments', body: payload });

            if (res.status === 200 || res.status === 201) {
                toast(isEdit ? 'Instrument updated.' : 'Instrument added.', 'success');
                navigate('dashboard');
            } else {
                toast(res.data.error || 'Operation failed.', 'error');
            }
        } catch {
            // network error already toasted
        }
    });
}

/* ========================================================= */
/*  Confirm delete dialog                                     */
/* ========================================================= */

function confirmDelete(item) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-box">
            <h3>Delete Instrument</h3>
            <p>Are you sure you want to remove <strong>${item.name}</strong> from the catalog?</p>
            <div class="confirm-actions">
                <button class="btn btn-outline" id="confirm-cancel">Cancel</button>
                <button class="btn btn-danger" id="confirm-yes">Delete</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirm-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#confirm-yes').addEventListener('click', async () => {
        overlay.remove();
        try {
            const res = await api({ method: 'DELETE', url: `/instruments/${item.id}` });
            if (res.status === 200) {
                toast('Instrument deleted.', 'success');
                navigate('dashboard');
            } else {
                toast(res.data.error || 'Delete failed.', 'error');
            }
        } catch {
            // network error already toasted
        }
    });
}

/* ========================================================= */
/*  Navbar                                                    */
/* ========================================================= */

function updateNavUser() {
    const el = $('#nav-user');
    if (_auth.user) {
        el.textContent = `Hello, ${_auth.user.fullName}`;
    }
}

function setupLogout() {
    $('#btn-logout').addEventListener('click', async () => {
        try {
            await api({ method: 'POST', url: '/auth/logout', silent: true });
        } catch {
            // ignore — we log out locally regardless
        }
        _auth.token = null;
        _auth.user = null;
        toast('Logged out.', 'info');
        navigate('login');
    });
}

/* ========================================================= */
/*  Network config panel                                      */
/* ========================================================= */

function setupNetworkPanel() {
    const toggle = $('#net-toggle');
    const body = $('#net-body');

    toggle.addEventListener('click', () => body.classList.toggle('hidden'));

    const lossSlider = $('#loss-slider');
    const lossVal = $('#loss-val');
    const minSlider = $('#min-delay-slider');
    const minVal = $('#min-delay-val');
    const maxSlider = $('#max-delay-slider');
    const maxVal = $('#max-delay-val');

    function sync() {
        const loss = Number(lossSlider.value);
        const minD = Number(minSlider.value);
        const maxD = Number(maxSlider.value);

        lossVal.textContent = loss + '%';
        minVal.textContent = (minD / 1000).toFixed(1) + 's';
        maxVal.textContent = (maxD / 1000).toFixed(1) + 's';

        Network.configure({
            packetLoss: loss / 100,
            minDelay: minD,
            maxDelay: Math.max(minD, maxD),
        });
    }

    lossSlider.addEventListener('input', sync);
    minSlider.addEventListener('input', sync);
    maxSlider.addEventListener('input', sync);
}

/* ========================================================= */
/*  Boot                                                      */
/* ========================================================= */

async function init() {
    // Initialize the DB (fetch seed data from external JSON if first visit)
    await DB.init();

    setupLogout();
    setupNetworkPanel();

    window.addEventListener('hashchange', route);
    route(); // initial render
}

document.addEventListener('DOMContentLoaded', init);
