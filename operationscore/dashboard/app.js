/* ============================================================
   OperationScore Dashboard — app.js
   SPA with 3 tabs: Cihazlar, Analiz, Metodoloji + Device Detail
   ============================================================ */

/* ----------------------------------------------------------
   Utilities
   ---------------------------------------------------------- */

function escapeHtml(str) {
    if (str == null) return '';
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
}

function formatRelativeTime(iso) {
    if (!iso) return "—";
    // Ensure the string is parsed as UTC (append Z if no offset present)
    var normalized = iso;
    if (!/[Zz]$/.test(iso) && !/[+\-]\d{2}:\d{2}$/.test(iso)) {
        normalized = iso + "Z";
    }
    var then = new Date(normalized);
    if (isNaN(then.getTime())) return "—";
    var diffSec = Math.floor((Date.now() - then.getTime()) / 1000);
    if (diffSec < 0) diffSec = 0;
    if (diffSec < 60) return "az önce";
    var diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return diffMin + " dk önce";
    // For anything ≥1 hour, show the absolute time in Istanbul timezone
    return then.toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit"
    });
}

function formatTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
}

function formatDateTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
}

function mapRiskToBadge(riskLevel) {
    var r = (riskLevel || "").toUpperCase();
    if (r === "CRITICAL" || r === "HIGH") {
        return { text: "Kritik", className: "badge--red" };
    }
    if (r === "MEDIUM") {
        return { text: "Dikkat", className: "badge--yellow" };
    }
    return { text: "İyi", className: "badge--green" };
}

function scoreClass(score) {
    if (score == null) return "score-pill--yellow";
    if (score < 60) return "score-pill--red";
    if (score < 75) return "score-pill--yellow";
    return "score-pill--green";
}

function _deriveRiskLevel(score) {
    if (score < 40) return 'CRITICAL';
    if (score < 60) return 'HIGH';
    if (score < 75) return 'MEDIUM';
    if (score < 90) return 'LOW';
    return 'EXCELLENT';
}

function safeParseJson(str) {
    if (!str || typeof str !== 'string') return [];
    try { var v = JSON.parse(str); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
}

/* ----------------------------------------------------------
   Safe Fetch
   All /api/* and /tasks/* requests pass through here.
   X-OPS-KEY header is injected automatically.
   To set the key: window.OPS_KEY = "your-key" in index.html
   or via env before page load. Fallback: "secret" (demo).
   ---------------------------------------------------------- */

var _fetchTimeout = 10000;

function safeFetch(url, options, timeoutMs) {
    timeoutMs = timeoutMs || _fetchTimeout;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    var opts = {};
    if (options) { for (var k in options) { if (options.hasOwnProperty(k)) opts[k] = options[k]; } }
    opts.signal = controller.signal;
    // Inject X-OPS-KEY header (merge with existing headers)
    var opsKey = (typeof window !== 'undefined' && window.OPS_KEY) || 'secret';
    var existingHeaders = opts.headers || {};
    if (existingHeaders instanceof Headers) {
        existingHeaders.set('X-OPS-KEY', opsKey);
    } else {
        existingHeaders['X-OPS-KEY'] = opsKey;
    }
    opts.headers = existingHeaders;
    return fetch(url, opts)
        .then(function (res) { clearTimeout(timer); return res; })
        .catch(function (err) { clearTimeout(timer); throw err; });
}

/* ----------------------------------------------------------
   Global State
   ---------------------------------------------------------- */

var state = {
    currentTab: 'cihazlar',
    devices: [],
    deviceCount: 0,
    fleetHistory: null,
    latestTimestamp: null,
    /* Scan session */
    scanRunId: null,
    scanActive: false,
    scanDevicesMap: {},
    scanTotal: 0,
    scanCompleted: 0,
    scanPercent: 0,
    scanStartedAt: null,
    scanLastMessage: null
};

/* Polling intervals */
var _devicesPollTimer = null;
var _fleetPollTimer = null;

/* Chart instances (for cleanup) */
var _chartInstances = {};

/* ----------------------------------------------------------
   API Client — New Endpoints
   ---------------------------------------------------------- */

function fetchDevices() {
    var url = (window.API_BASE || 'http://127.0.0.1:8000') + '/api/devices';
    return safeFetch(url)
        .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(function (data) {
            state.devices = (data && Array.isArray(data.devices)) ? data.devices : [];
            state.deviceCount = data.device_count || state.devices.length;
            return state.devices;
        })
        .catch(function () {
            return state.devices; // return cached on failure
        });
}

function fetchFleetHistory(limit) {
    limit = limit || 200;
    var url = (window.API_BASE || 'http://127.0.0.1:8000') + '/api/fleet/history?limit=' + limit;
    return safeFetch(url)
        .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(function (data) {
            if (limit === 1) {
                // For latest timestamp
                var pts = (data && data.points) || [];
                if (pts.length > 0) {
                    state.latestTimestamp = pts[pts.length - 1].timestamp;
                    _updateHeaderTimestamp();
                }
                return pts;
            }
            state.fleetHistory = (data && data.points) || [];
            return state.fleetHistory;
        })
        .catch(function () {
            if (limit === 1) return [];
            return state.fleetHistory || [];
        });
}

function fetchDeviceHistory(hostname) {
    var url = (window.API_BASE || 'http://127.0.0.1:8000') + '/api/devices/' + encodeURIComponent(hostname) + '/history?limit=100';
    return safeFetch(url)
        .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(function (data) {
            return (data && data.points) || [];
        })
        .catch(function () {
            return [];
        });
}

function _updateHeaderTimestamp() {
    var el = document.getElementById('headerLastData');
    if (!el) return;
    if (state.latestTimestamp) {
        el.textContent = 'Son veri: ' + formatDateTime(state.latestTimestamp);
    } else {
        el.textContent = 'Son veri: —';
    }
}

/* ----------------------------------------------------------
   Scan Trigger & Session Progress
   ---------------------------------------------------------- */

var _scanSessionTimer = null;
var _scanDoneTimer = null;
var _SCAN_TIMEOUT_MS = 30000; // 30 seconds

function setScanStatus(type, msg) {
    var el = document.getElementById('scan-status');
    if (!el) return;
    var cls = 'scan-card scan-card--' + type;
    el.innerHTML = '<div class="' + cls + '">' + escapeHtml(msg) + '</div>';
    var clearDelay = (type === 'done') ? 10000 : 8000;
    if (type === 'done' || type === 'timeout' || type === 'error' || type === 'info') {
        setTimeout(function () { if (el) el.innerHTML = ''; }, clearDelay);
    }
}

function fetchScanSession(runId) {
    var url = (window.API_BASE || 'http://127.0.0.1:8000') + '/scan_sessions/' + encodeURIComponent(runId);
    return safeFetch(url, null, 5000)
        .then(function (res) {
            if (res.status === 404) return { error: 'not_found' };
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .catch(function (err) {
            return { error: err.message || 'fetch_failed' };
        });
}

function handleScanClick() {
    if (state.scanActive) return;
    var btn = document.getElementById('btnScanGlobal');

    // Clear any stale done/timeout timer from previous scan
    if (_scanDoneTimer) { clearTimeout(_scanDoneTimer); _scanDoneTimer = null; }

    // Disable button, show starting state
    state.scanActive = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Başlatılıyor…'; }
    _updateScanPill('starting', 'Başlatılıyor…');
    setScanStatus('loading', 'Tarama başlatılıyor…');

    var base = window.API_BASE || 'http://127.0.0.1:8000';
    safeFetch(base + '/tasks/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'run_scan' })
    }, 8000)
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) {
            var runId = data.run_id || '';
            var targeted = data.devices_targeted || 0;

            if (targeted === 0) {
                // No devices registered
                _resetScanState();
                setScanStatus('info', 'Kayıtlı cihaz yok. Önce register edin.');
                _updateScanPill('hide');
                return;
            }

            state.scanRunId = runId;
            state.scanStartedAt = Date.now();
            state.scanTotal = targeted;
            state.scanCompleted = 0;
            state.scanPercent = 0;
            state.scanDevicesMap = {};

            if (btn) btn.textContent = '⏳ Taranıyor…';
            setScanStatus('success', 'Tarama başlatıldı — Hedef: ' + targeted + ' cihaz');
            _updateScanPill('progress', '0/' + targeted + ' (0%)');

            // Start session polling
            _startScanSessionPolling();
        })
        .catch(function (err) {
            _resetScanState();
            setScanStatus('error', 'Tarama başlatılamadı: ' + (err.message || 'Bilinmeyen hata'));
            _updateScanPill('hide');
        });
}

function _startScanSessionPolling() {
    if (_scanSessionTimer) clearInterval(_scanSessionTimer);

    _scanSessionTimer = setInterval(function () {
        if (!state.scanRunId) { _stopScanSession(); return; }

        // Timeout check
        if (state.scanStartedAt && (Date.now() - state.scanStartedAt) > _SCAN_TIMEOUT_MS) {
            // Mark remaining pending devices as 'offline' so UI shows them as unreachable
            for (var _h in state.scanDevicesMap) {
                if (state.scanDevicesMap.hasOwnProperty(_h) && state.scanDevicesMap[_h] === 'pending') {
                    state.scanDevicesMap[_h] = 'offline';
                }
            }
            _stopScanSession();
            setScanStatus('timeout', 'Tarama zaman aşımı (30s). ' + state.scanCompleted + '/' + state.scanTotal +
                ' cihaz yanıt verdi; geri kalanlar çevrimdışı.');
            _updateScanPill('timeout', 'Zaman aşımı (' + state.scanCompleted + '/' + state.scanTotal + ')');
            // Re-render to show offline dots
            if (state.currentTab === 'cihazlar') renderDevicesPage();
            // Auto-hide pill after 5s
            _scanDoneTimer = setTimeout(function () {
                _updateScanPill('hide');
                state.scanLastMessage = 'Son tarama: ' + formatTime(new Date().toISOString());
                _showLastScanInfo();
            }, 5000);
            return;
        }

        fetchScanSession(state.scanRunId).then(function (data) {
            if (data.error === 'not_found') {
                _stopScanSession();
                setScanStatus('error', 'Scan session bulunamadı (run_id: ' + state.scanRunId + ')');
                _updateScanPill('hide');
                return;
            }
            if (data.error) return; // network error, keep trying

            var devicesMap = data.devices || {};
            state.scanDevicesMap = devicesMap;
            var total = 0, completed = 0;
            for (var h in devicesMap) {
                if (devicesMap.hasOwnProperty(h)) {
                    total++;
                    if (devicesMap[h] === 'completed') completed++;
                }
            }
            state.scanTotal = total;
            state.scanCompleted = completed;
            state.scanPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

            _updateScanPill('progress', completed + '/' + total + ' (' + state.scanPercent + '%)');

            // Re-render device list if on Cihazlar tab (to update dots)
            if (state.currentTab === 'cihazlar') renderDevicesPage();

            // Check if completed
            if (total > 0 && completed >= total) {
                _stopScanSession();
                setScanStatus('done', '✅ Tarama tamamlandı! Tüm cihazlar rapor gönderdi.');
                _updateScanPill('done', 'Tamamlandı ✓');

                // Refresh data
                fetchDevices().then(function () {
                    if (state.currentTab === 'cihazlar') renderDevicesPage();
                });
                fetchFleetHistory(1);

                // Collapse pill after 3s
                _scanDoneTimer = setTimeout(function () {
                    state.scanDevicesMap = {};
                    _updateScanPill('hide');
                    state.scanLastMessage = 'Son tarama: ' + formatTime(new Date().toISOString());
                    _showLastScanInfo();
                    if (state.currentTab === 'cihazlar') renderDevicesPage();
                }, 3000);
            }
        });
    }, 2000);
}

function _stopScanSession() {
    if (_scanSessionTimer) { clearInterval(_scanSessionTimer); _scanSessionTimer = null; }
    _resetScanState();
}

function _resetScanState() {
    state.scanActive = false;
    state.scanRunId = null;
    state.scanStartedAt = null;
    var btn = document.getElementById('btnScanGlobal');
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Taramayı Başlat'; }
}

function _updateScanPill(mode, text) {
    var pill = document.getElementById('scanProgressPill');
    if (!pill) return;

    if (mode === 'hide') {
        pill.style.display = 'none';
        pill.innerHTML = '';
        pill.className = 'scan-progress-pill';
        return;
    }

    pill.style.display = 'inline-flex';

    if (mode === 'starting') {
        pill.className = 'scan-progress-pill scan-progress-pill--active';
        pill.innerHTML = '<span class="scan-pill__spinner"></span><span class="scan-pill__text">Başlatılıyor…</span>';
    } else if (mode === 'progress') {
        var pct = state.scanPercent || 0;
        pill.className = 'scan-progress-pill scan-progress-pill--active';
        pill.innerHTML =
            '<span class="scan-pill__spinner"></span>' +
            '<span class="scan-pill__text">Scan: ' + escapeHtml(text) + '</span>' +
            '<span class="scan-pill__bar"><span class="scan-pill__fill" style="width:' + pct + '%"></span></span>';
    } else if (mode === 'done') {
        pill.className = 'scan-progress-pill scan-progress-pill--done';
        pill.innerHTML = '<span class="scan-pill__text">✅ ' + escapeHtml(text) + '</span>';
    } else if (mode === 'timeout') {
        pill.className = 'scan-progress-pill scan-progress-pill--timeout';
        pill.innerHTML = '<span class="scan-pill__text">⏱ ' + escapeHtml(text) + '</span>';
    }
}

function _showLastScanInfo() {
    if (!state.scanLastMessage) return;
    var pill = document.getElementById('scanProgressPill');
    if (!pill) return;
    pill.style.display = 'inline-flex';
    pill.className = 'scan-progress-pill scan-progress-pill--idle';
    pill.innerHTML = '<span class="scan-pill__text">' + escapeHtml(state.scanLastMessage) + '</span>';
}

function _getScanDeviceStatus(hostname) {
    if (!state.scanActive && Object.keys(state.scanDevicesMap).length === 0) return null;
    if (!state.scanDevicesMap || !state.scanDevicesMap.hasOwnProperty(hostname)) return null;
    return state.scanDevicesMap[hostname]; // 'pending' | 'completed'
}

/* ----------------------------------------------------------
   KPI Helpers
   ---------------------------------------------------------- */

function calcCriticalCount(devices) {
    var count = 0;
    for (var i = 0; i < devices.length; i++) {
        var r = (devices[i].risk_level || "").toUpperCase();
        if (r === "CRITICAL" || r === "HIGH") count++;
    }
    return count;
}

function calcAverageScore(devices) {
    var sum = 0, n = 0;
    for (var i = 0; i < devices.length; i++) {
        if (devices[i].latest_score != null) { sum += devices[i].latest_score; n++; }
    }
    return n === 0 ? 0 : Math.round((sum / n) * 10) / 10;
}

/* ----------------------------------------------------------
   CSV Export
   ---------------------------------------------------------- */

function csvField(val) {
    var s = String(val == null ? "" : val);
    if (s.indexOf('"') !== -1 || s.indexOf(',') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function exportCsv() {
    var header = "hostname,device_type,latest_score,risk_level,last_seen_at,last_seen_ip";
    var lines = [header];
    for (var i = 0; i < state.devices.length; i++) {
        var d = state.devices[i];
        lines.push([
            csvField(d.hostname), csvField(d.device_type),
            csvField(d.latest_score), csvField(d.risk_level),
            csvField(d.last_seen_at), csvField(d.last_seen_ip)
        ].join(","));
    }
    var text = lines.join("\n");
    var blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var now = new Date();
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    a.download = "operationscore_" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ----------------------------------------------------------
   SPA Router
   ---------------------------------------------------------- */

function navigateTo(tab) {
    state.currentTab = tab;
    window.location.hash = '#' + tab;
    _updateTabUI();
    renderCurrentTab();
}

function navigateToDevice(hostname) {
    state.currentTab = 'device';
    window.location.hash = '#device?hostname=' + encodeURIComponent(hostname);
    _updateTabUI();
    _stopFleetPolling();  // stop Analiz polling while on device detail
    _destroyCharts();     // clean up any existing chart instances
    renderDeviceDetail(hostname);
}

function _updateTabUI() {
    var btns = document.querySelectorAll('.tab-nav__item');
    for (var i = 0; i < btns.length; i++) {
        var tab = btns[i].getAttribute('data-tab');
        if (tab === state.currentTab) {
            btns[i].classList.add('tab-nav__item--active');
        } else {
            btns[i].classList.remove('tab-nav__item--active');
        }
    }
}

function _parseHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return { tab: 'cihazlar', params: {} };
    var parts = hash.split('?');
    var tab = parts[0] || 'cihazlar';
    var params = {};
    if (parts[1]) {
        var pairs = parts[1].split('&');
        for (var i = 0; i < pairs.length; i++) {
            var kv = pairs[i].split('=');
            params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
        }
    }
    return { tab: tab, params: params };
}

function renderCurrentTab() {
    _stopFleetPolling();
    _destroyCharts();

    switch (state.currentTab) {
        case 'analiz':
            renderAnalyticsPage();
            break;
        case 'metodoloji':
            renderMethodologyPage();
            break;
        case 'device':
            // handled by navigateToDevice
            break;
        case 'cihazlar':
        default:
            renderDevicesPage();
            break;
    }
}

/* ----------------------------------------------------------
   Polling Management
   ---------------------------------------------------------- */

function _startDevicesPolling() {
    if (_devicesPollTimer) return;
    _devicesPollTimer = setInterval(function () {
        fetchDevices().then(function () {
            if (state.currentTab === 'cihazlar') renderDevicesPage();
        });
    }, 5000);
}

function _startFleetPolling() {
    if (_fleetPollTimer) return;
    _fleetPollTimer = setInterval(function () {
        if (state.currentTab === 'analiz') {
            fetchFleetHistory(200).then(function () {
                renderAnalyticsCharts();
            });
        }
    }, 10000);
}

function _stopFleetPolling() {
    if (_fleetPollTimer) { clearInterval(_fleetPollTimer); _fleetPollTimer = null; }
}

function _destroyCharts() {
    for (var key in _chartInstances) {
        if (_chartInstances[key]) {
            try { _chartInstances[key].destroy(); } catch (e) { }
            delete _chartInstances[key];
        }
    }
}

/* ----------------------------------------------------------
   UI State Helpers
   ---------------------------------------------------------- */

function showLoading() {
    var app = document.getElementById("app");
    if (!app) return;
    app.innerHTML =
        '<div class="state-loading">' +
        '  <div class="state-loading__spinner"></div>' +
        '  <div class="text-muted">Yükleniyor…</div>' +
        '</div>';
}

function showEmpty(msg) {
    var app = document.getElementById("app");
    if (!app) return;
    app.innerHTML =
        '<div class="state-empty">' +
        '  <div class="state-empty__icon">📭</div>' +
        '  <div class="state-empty__title">' + escapeHtml(msg || 'Henüz veri yok') + '</div>' +
        '</div>';
}

/* ==========================================================
   TAB 1: CİHAZLAR (Devices Page)
   ========================================================== */

var _searchQuery = "";

function renderDevicesPage() {
    var app = document.getElementById("app");
    if (!app) return;

    var devices = state.devices || [];
    if (devices.length === 0) {
        showEmpty('Henüz cihaz yok. Ajanlar rapor gönderdikçe burada görünecek.');
        return;
    }

    // Separate SERVER / CLIENT
    var servers = [];
    var clients = [];
    for (var i = 0; i < devices.length; i++) {
        var d = devices[i];
        // Apply search filter
        if (_searchQuery) {
            var q = _searchQuery.toLowerCase();
            if ((d.hostname || "").toLowerCase().indexOf(q) === -1) continue;
        }
        if ((d.device_type || "").toUpperCase() === "SERVER") {
            servers.push(d);
        } else {
            clients.push(d);
        }
    }

    // Sort each group: latest_score ascending, nulls at bottom
    function sortByScore(a, b) {
        var sa = a.latest_score, sb = b.latest_score;
        if (sa == null && sb == null) return 0;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return sa - sb;
    }
    servers.sort(sortByScore);
    clients.sort(sortByScore);

    // KPI
    var critCount = calcCriticalCount(devices);
    var avgScore = calcAverageScore(devices);
    var avgClass = avgScore < 60 ? 'kpi-value--red' : avgScore < 75 ? 'kpi-value--yellow' : 'kpi-value--green';

    var html = '';

    // KPI Cards
    html += '<div class="kpi-grid">';
    html += '  <div class="kpi-card"><div class="kpi-value">' + escapeHtml(String(state.deviceCount || 0)) + '</div><div class="kpi-label">Cihaz Sayısı</div></div>';
    html += '  <div class="kpi-card"><div class="kpi-value kpi-value--red">' + escapeHtml(String(critCount)) + '</div><div class="kpi-label">Kritik Cihaz</div></div>';
    html += '  <div class="kpi-card"><div class="kpi-value ' + avgClass + '">' + escapeHtml(String(avgScore)) + '</div><div class="kpi-label">Ortalama Skor</div></div>';
    html += '  <div class="kpi-card"><div class="kpi-value">' + escapeHtml(String(servers.length)) + ' / ' + escapeHtml(String(clients.length)) + '</div><div class="kpi-label">Sunucu / Client</div></div>';
    html += '</div>';

    // Action bar
    html += '<div class="action-bar">';
    html += '  <div class="action-bar__meta">';
    html += '    <span class="text-muted text-sm">' + escapeHtml(String(devices.length)) + ' cihaz</span>';
    html += '  </div>';
    html += '  <div class="action-bar__right">';
    html += '    <input class="search-input search-input--icon" id="searchInput" type="text" placeholder="Cihaz ara…" value="' + escapeHtml(_searchQuery) + '">';
    html += '    <button class="btn btn--secondary" id="btnCsvExport" title="CSV İndir">⬇ CSV İndir</button>';
    html += '  </div>';
    html += '</div>';

    // Sunucular section
    html += _renderDeviceSection('Sunucular (SERVER)', servers, '🖥️');

    // Clientlar section
    html += _renderDeviceSection('Clientlar (CLIENT)', clients, '💻');

    app.innerHTML = html;

    // Attach events
    _attachDevicesEvents();
}

function _renderDeviceSection(title, devices, icon) {
    var html = '';
    html += '<div class="device-section">';
    html += '  <h2 class="device-section__title">' + icon + ' ' + escapeHtml(title) + ' <span class="text-muted text-sm">(' + devices.length + ')</span></h2>';

    if (devices.length === 0) {
        html += '  <div class="card" style="padding:24px;text-align:center"><span class="text-muted">Bu kategoride cihaz yok.</span></div>';
        html += '</div>';
        return html;
    }

    html += '  <div class="card"><div class="table-wrap">';
    html += '  <table class="tbl">';
    var showScanCol = state.scanActive || Object.keys(state.scanDevicesMap).length > 0;
    html += '    <thead><tr>';
    html += '      <th>Cihaz</th>';
    html += '      <th>Skor</th>';
    html += '      <th>Seviye</th>';
    html += '      <th>Son Görülme</th>';
    html += '      <th>IP</th>';
    if (showScanCol) html += '      <th class="th-scan-status">Scan</th>';
    html += '    </tr></thead>';
    html += '    <tbody>';

    for (var i = 0; i < devices.length; i++) {
        var d = devices[i];
        var risk = d.risk_level ? mapRiskToBadge(d.risk_level) : { text: '—', className: 'badge--yellow' };
        var sClass = d.latest_score != null ? scoreClass(d.latest_score) : 'score-pill--yellow';
        var scoreText = d.latest_score != null ? String(Math.round(d.latest_score)) : '—';

        var scanStatus = _getScanDeviceStatus(d.hostname);
        html += '<tr data-hostname="' + escapeHtml(d.hostname) + '" class="device-row">';
        html += '  <td><div class="device-cell"><span class="device-cell__icon">' + (d.device_type === 'SERVER' ? '🖥' : '💻') + '</span>' + escapeHtml(d.hostname) + '</div></td>';
        html += '  <td><span class="score-pill ' + sClass + '">' + escapeHtml(scoreText) + '</span></td>';
        html += '  <td><span class="badge ' + risk.className + '">' + escapeHtml(risk.text) + '</span></td>';
        html += '  <td class="text-muted text-sm">' + escapeHtml(formatRelativeTime(d.last_seen_at)) + '</td>';
        html += '  <td class="text-muted text-sm">' + escapeHtml(d.last_seen_ip || '—') + '</td>';
        if (showScanCol) {
            if (scanStatus === 'completed') {
                html += '  <td><span class="scan-dot scan-dot--completed" title="Tamamlandı">●</span></td>';
            } else if (scanStatus === 'pending') {
                html += '  <td><span class="scan-dot scan-dot--pending" title="Bekliyor…">●</span></td>';
            } else if (scanStatus === 'offline') {
                html += '  <td><span class="scan-dot scan-dot--offline" title="Yanıt vermedi (çevrimdışı)">●</span></td>';
            } else {
                html += '  <td></td>';
            }
        }
        html += '</tr>';
    }

    html += '    </tbody>';
    html += '  </table>';
    html += '  </div></div>';
    html += '</div>';
    return html;
}

function _attachDevicesEvents() {
    // Search
    var searchEl = document.getElementById("searchInput");
    if (searchEl) {
        searchEl.addEventListener("input", function () {
            _searchQuery = this.value;
            renderDevicesPage();
            var s = document.getElementById("searchInput");
            if (s) { s.focus(); s.selectionStart = s.selectionEnd = s.value.length; }
        });
    }

    // CSV export
    var csvBtn = document.getElementById("btnCsvExport");
    if (csvBtn) {
        csvBtn.addEventListener("click", exportCsv);
    }

    // Row clicks
    var rows = document.querySelectorAll("tr[data-hostname]");
    for (var i = 0; i < rows.length; i++) {
        rows[i].addEventListener("click", function () {
            var h = this.getAttribute("data-hostname");
            if (h) navigateToDevice(h);
        });
    }
}

/* ==========================================================
   TAB 2: ANALİZ (Fleet Analytics)
   ========================================================== */

function renderAnalyticsPage() {
    var app = document.getElementById("app");
    if (!app) return;

    // Show loading, then fetch
    showLoading();

    fetchFleetHistory(200).then(function (points) {
        if (!points || points.length === 0) {
            showEmpty('Henüz fleet geçmiş verisi yok. Tarama yapıldıkça burada grafikler oluşacak.');
            return;
        }

        var html = '';
        html += '<h2 class="page-title">📊 Fleet Analiz</h2>';

        // Chart 1: Fleet avg
        html += '<div class="chart-card card">';
        html += '  <h3 class="chart-card__title">Fleet Ortalama Skor</h3>';
        html += '  <div class="chart-container"><canvas id="chartFleetAvg"></canvas></div>';
        html += '</div>';

        // Chart 2: Server vs Client avg
        html += '<div class="chart-card card">';
        html += '  <h3 class="chart-card__title">Sunucu vs Client Ortalama</h3>';
        html += '  <div class="chart-container"><canvas id="chartServerClient"></canvas></div>';
        html += '</div>';

        // Chart 3: Critical count (only if data has it)
        var hasCritical = false;
        for (var i = 0; i < points.length; i++) {
            if (points[i].critical_count != null) { hasCritical = true; break; }
        }
        if (hasCritical) {
            html += '<div class="chart-card card">';
            html += '  <h3 class="chart-card__title">Kritik Cihaz Sayısı</h3>';
            html += '  <div class="chart-container"><canvas id="chartCritical"></canvas></div>';
            html += '</div>';
        }

        app.innerHTML = html;

        // Render charts
        renderAnalyticsCharts();

        // Start polling
        _startFleetPolling();
    });
}

function renderAnalyticsCharts() {
    var points = state.fleetHistory || [];
    if (points.length === 0) return;

    var labels = points.map(function (p) { return formatTime(p.timestamp); });
    var fleetAvg = points.map(function (p) { return p.fleet_avg; });
    var serverAvg = points.map(function (p) { return p.server_avg; });
    var clientAvg = points.map(function (p) { return p.client_avg; });
    var critical = points.map(function (p) { return p.critical_count; });

    // Destroy previous charts
    _destroyCharts();

    // Chart 1: Fleet Average
    var ctx1 = document.getElementById('chartFleetAvg');
    if (ctx1) {
        _chartInstances.fleetAvg = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Fleet Ort.',
                    data: fleetAvg,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }]
            },
            options: _chartOptions(0, 100)
        });
    }

    // Chart 2: Server vs Client
    var ctx2 = document.getElementById('chartServerClient');
    if (ctx2) {
        _chartInstances.serverClient = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Sunucu Ort.',
                        data: serverAvg,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.08)',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 2,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'Client Ort.',
                        data: clientAvg,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245,158,11,0.08)',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 2,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: _chartOptions(0, 100)
        });
    }

    // Chart 3: Critical count
    var ctx3 = document.getElementById('chartCritical');
    if (ctx3) {
        _chartInstances.critical = new Chart(ctx3, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Kritik Cihaz',
                    data: critical,
                    backgroundColor: 'rgba(239,68,68,0.6)',
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderRadius: 3
                }]
            },
            options: _chartOptions(0, undefined)
        });
    }
}

function _chartOptions(minY, maxY) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
            legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } },
            tooltip: { backgroundColor: '#1e293b', titleFont: { size: 13 }, bodyFont: { size: 12 }, padding: 10 }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { size: 11 }, maxRotation: 0, maxTicksLimit: 12, color: '#64748b' }
            },
            y: {
                min: minY,
                max: maxY,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { font: { size: 11 }, color: '#64748b' }
            }
        }
    };
}

/* ==========================================================
   TAB 3: METODOLOJİ (Static)
   ========================================================== */

function renderMethodologyPage() {
    var app = document.getElementById("app");
    if (!app) return;

    var html = '';
    html += '<h2 class="page-title">📘 OperationScore Metodoloji</h2>';

    // Scoring logic
    html += '<div class="card meth-card">';
    html += '  <h3 class="meth-card__title">Skor Mantığı</h3>';
    html += '  <p class="meth-card__text">Her cihaz <strong>100 puan</strong> ile başlar. Güvenlik ve yapılandırma denetimlerinde tespit edilen her sorun için belirlenen ceza puanı düşülür.</p>';
    html += '  <div class="meth-formula">Skor = 100 − Σ cezalar</div>';
    html += '  <p class="meth-card__text text-muted text-sm">Minimum skor 0, maksimum skor 100\'dür. Daha yüksek skor daha güvenli anlamına gelir.</p>';
    html += '  <p class="meth-card__text text-muted text-sm">K9 ve K10 kaynak kullanımına göre ek ceza uygular; CPU yüksek yükse K10 ceza uygulanır.</p>';
    html += '</div>';

    // Criteria penalties table
    html += '<div class="card meth-card">';
    html += '  <h3 class="meth-card__title">Kriterler ve Ceza Puanları</h3>';
    html += '  <div class="table-wrap"><table class="tbl">';
    html += '    <thead><tr><th scope="col">Kriter</th><th scope="col">Eşik</th><th scope="col">Ceza</th></tr></thead>';
    html += '    <tbody>';
    html += '      <tr><td>Güncellik (K1)</td><td>11–30 eksik güncelleme / &gt;30 eksik güncelleme</td><td>−15 / −30</td></tr>';
    html += '      <tr><td>Firewall (K2)</td><td>Firewall kapalı</td><td>−25</td></tr>';
    html += '      <tr><td>SSH (K3)</td><td>Root login açık</td><td>−20</td></tr>';
    html += '      <tr><td>Sudo Sayısı (K4)</td><td>&gt;3 sudo kullanıcı</td><td>−15</td></tr>';
    html += '      <tr><td>Kara Liste Servis (K5)</td><td>1 gereksiz servis / 2+ servis (maks)</td><td>−8 … −25</td></tr>';
    html += '      <tr><td>Disk (K6)</td><td>&gt;85% doluluk / &gt;95% doluluk</td><td>−15 / −30</td></tr>';
    html += '      <tr><td>Şifre Politikası (K7)</td><td>Politika uyumsuz</td><td>−20</td></tr>';
    html += '      <tr><td>Zombi Cihaz (K8)</td><td>&gt;60 dk yanıt yok</td><td>−10</td></tr>';
    html += '      <tr><td>RAM (K9)</td><td>80% → −5, 90% → −10, 97%+ → −20</td><td>−5 / −10 / −20</td></tr>';
    html += '      <tr><td>CPU (K10)</td><td>CPU ≤70% → 0; 70-85% → −10; 85-95% → −20; 95%+ → −30</td><td>−10 / −20 / −30</td></tr>';
    html += '    </tbody>';
    html += '  </table></div>';
    html += '  <h4 class="meth-card__subtitle" style="margin-top:var(--sp-4);font-size:var(--text-sm);font-weight:700;color:var(--color-text)">Test Senaryoları (K9–K10)</h4>';
    html += '  <div class="meth-test-scenarios" style="font-family:monospace;font-size:var(--text-xs);color:var(--color-text-muted);line-height:1.8;padding:var(--sp-2) 0">';
    html += '    RAM=50 → K9 yok &nbsp;|&nbsp; RAM=80 → K9 −5 &nbsp;|&nbsp; RAM=90 → K9 −10 &nbsp;|&nbsp; RAM=97 → K9 −20<br>';
    html += '    CPU=25 → K10 yok &nbsp;|&nbsp; CPU=82 → K10 −10 &nbsp;|&nbsp; CPU=97 → K10 −30';
    html += '  </div>';
    html += '</div>';

    // Risk levels
    html += '<div class="card meth-card">';
    html += '  <h3 class="meth-card__title">Risk Seviyeleri</h3>';
    html += '  <div class="table-wrap"><table class="tbl">';
    html += '    <thead><tr><th>Skor Aralığı</th><th>Seviye</th><th>Anlam</th></tr></thead>';
    html += '    <tbody>';
    html += '      <tr><td><span class="score-pill score-pill--green">90–100</span></td><td><span class="badge badge--green">Mükemmel</span></td><td>Mükemmel — Sorun yok</td></tr>';
    html += '      <tr><td><span class="score-pill score-pill--green">75–89</span></td><td><span class="badge badge--green">İyi</span></td><td>İyi — Küçük iyileştirmeler</td></tr>';
    html += '      <tr><td><span class="score-pill score-pill--yellow">60–74</span></td><td><span class="badge badge--yellow">Dikkat</span></td><td>Dikkat — Aksiyon önerilir</td></tr>';
    html += '      <tr><td><span class="score-pill score-pill--red">40–59</span></td><td><span class="badge badge--red">Yüksek</span></td><td>Yüksek risk — Acil müdahale</td></tr>';
    html += '      <tr><td><span class="score-pill score-pill--red">0–39</span></td><td><span class="badge badge--red">Kritik</span></td><td>Kritik — Derhal aksiyon</td></tr>';
    html += '    </tbody>';
    html += '  </table></div>';
    html += '</div>';

    // Criteria
    html += '<div class="card meth-card">';
    html += '  <h3 class="meth-card__title">Kriterler (K1–K10)</h3>';
    html += '  <div class="criteria-grid">';

    var criteria = [
        { id: 'K1', title: 'Güncellik', check: 'Eksik güvenlik güncellemelerini kontrol eder.', action: 'sudo apt update && apt upgrade ile güncellemeleri uygulayın.', icon: '🔄' },
        { id: 'K2', title: 'Firewall', check: 'UFW firewall durumunu kontrol eder.', action: 'sudo ufw enable ile firewall\'ı etkinleştirin.', icon: '🛡️' },
        { id: 'K3', title: 'SSH', check: 'SSH root login ve güvenlik ayarlarını denetler.', action: 'PermitRootLogin no ayarı ile root erişimini kapatın.', icon: '🔐' },
        { id: 'K4', title: 'Sudo Sayısı', check: 'Sudo yetkisine sahip kullanıcı sayısını kontrol eder.', action: 'Gereksiz sudo yetkilerini kaldırın (maks. 3 kullanıcı).', icon: '👥' },
        { id: 'K5', title: 'Kara Liste Servis', check: 'Kara listedeki gereksiz servisleri tespit eder.', action: 'Gereksiz servisleri devre dışı bırakın: systemctl disable.', icon: '🚫' },
        { id: 'K6', title: 'Disk', check: 'Disk doluluk oranını analiz eder.', action: 'Disk temizliği yapın. %85 üzeri doluluk ceza alır (%95 üzeri daha ağır ceza).', icon: '💾' },
        { id: 'K7', title: 'Şifre Politikası', check: 'Şifre güvenlik kurallarını kontrol eder.', action: 'pam_pwquality modülünü yapılandırın.', icon: '🔑' },
        { id: 'K8', title: 'Zombi Cihaz', check: 'Uzun süredir rapor vermeyen cihazları tespit eder.', action: 'Cihazın ajan servisini kontrol edin ve yeniden başlatın.', icon: '👻' },
        { id: 'K9', title: 'RAM Kullanımı', check: 'RAM kullanım yüzdesi belirli eşikleri aşıyor mu?', action: 'Yüksek RAM kullanan süreçleri tespit edin, servisleri optimize edin.', icon: '🧠' },
        { id: 'K10', title: 'CPU Kullanımı', check: 'CPU kullanım yüzdesi kritik seviyede mi? (yük ortalaması / çekirdek sayısı)', action: 'Yoğun CPU süreçlerini tespit edin (top/htop); gereksiz servisleri durdurun ve kaynakları ölçeklendirin.', icon: '⚙️' }
    ];

    for (var i = 0; i < criteria.length; i++) {
        var c = criteria[i];
        html += '<div class="criteria-card">';
        html += '  <div class="criteria-icon">' + c.icon + '</div>';
        html += '  <div class="criteria-title">' + escapeHtml(c.id) + ': ' + escapeHtml(c.title) + '</div>';
        html += '  <div class="criteria-desc">' + escapeHtml(c.check) + '</div>';
        html += '  <div class="criteria-action text-sm">✅ ' + escapeHtml(c.action) + '</div>';
        html += '</div>';
    }

    html += '  </div>';
    html += '</div>';

    app.innerHTML = html;
}

/* ==========================================================
   DEVICE DETAIL PAGE
   ========================================================== */

function renderDeviceDetail(hostname) {
    var app = document.getElementById("app");
    if (!app) return;

    showLoading();

    // Ensure we have device data
    var renderDetail = function () {
        var device = null;
        for (var i = 0; i < state.devices.length; i++) {
            if (state.devices[i].hostname === hostname) { device = state.devices[i]; break; }
        }

        if (!device) {
            app.innerHTML =
                '<div class="state-empty">' +
                '  <div class="state-empty__icon">❓</div>' +
                '  <div class="state-empty__title">"' + escapeHtml(hostname) + '" bulunamadı.</div>' +
                '  <button class="btn btn--primary mt-4" onclick="navigateTo(\'cihazlar\')">← Cihazlara Dön</button>' +
                '</div>';
            return;
        }

        var risk = device.risk_level ? mapRiskToBadge(device.risk_level) : { text: '—', className: 'badge--yellow' };
        var sClass = device.latest_score != null ? scoreClass(device.latest_score) : 'score-pill--yellow';
        var scoreText = device.latest_score != null ? String(Math.round(device.latest_score)) : '—';
        var isCritical = (device.latest_score != null && device.latest_score < 60) ||
            (device.risk_level || "").toUpperCase() === "CRITICAL" ||
            (device.risk_level || "").toUpperCase() === "HIGH";

        // Parse top_reasons_json and actions_json
        var topReasons = safeParseJson(device.top_reasons_json);
        var actions = safeParseJson(device.actions_json);

        var html = '';

        // Back button
        html += '<div class="action-bar">';
        html += '  <div><button class="btn btn--secondary" onclick="navigateTo(\'cihazlar\')">← Cihazlara Dön</button></div>';
        html += '</div>';

        // Header section
        html += '<div class="detail-header card">';
        html += '  <div class="detail-header__main">';
        html += '    <div class="detail-header__info">';
        html += '      <h2 class="detail-header__hostname">' + escapeHtml(hostname) + '</h2>';
        html += '      <span class="device-type-badge device-type-badge--' + (device.device_type || 'CLIENT').toLowerCase() + '">' + escapeHtml(device.device_type || 'CLIENT') + '</span>';
        html += '    </div>';
        html += '    <div class="detail-header__meta">';
        html += '      <span class="text-muted text-sm">Son görülme: <strong>' + escapeHtml(formatRelativeTime(device.last_seen_at)) + '</strong></span>';
        html += '      <span class="text-muted text-sm">IP: <strong>' + escapeHtml(device.last_seen_ip || '—') + '</strong></span>';
        html += '    </div>';
        html += '  </div>';
        html += '  <div class="detail-header__score">';
        html += '    <div class="device-score-badge ' + sClass + '">' + escapeHtml(scoreText) + '</div>';
        html += '    <span class="badge ' + risk.className + '">' + escapeHtml(risk.text) + '</span>';
        html += '  </div>';
        html += '</div>';

        // Alert banner
        if (isCritical) {
            html += '<div class="banner banner-critical"><span class="banner__icon">⚠</span><span>Kritik durum: Bu cihaz için aksiyon gerekli.</span></div>';
        }

        // Score history chart
        html += '<div class="chart-card card">';
        html += '  <h3 class="chart-card__title">Skor Geçmişi</h3>';
        html += '  <div class="chart-container"><canvas id="chartDeviceHistory"></canvas></div>';
        html += '  <div id="chartDeviceEmpty" class="text-muted text-sm" style="display:none;padding:16px;text-align:center">Henüz tarama geçmişi yok.</div>';
        html += '</div>';

        // Two-column panels: Reasons + Actions
        html += '<div class="detail-panels">';

        // Top Reasons
        html += '<div class="card detail-panel">';
        html += '  <h3 class="detail-panel__title">🔍 Top Nedenler</h3>';
        if (topReasons.length === 0) {
            html += '  <p class="text-muted text-sm">Öneri yok.</p>';
        } else {
            html += '  <ul class="reasons-list reasons-list--detail">';
            for (var r = 0; r < Math.min(3, topReasons.length); r++) {
                var reason = typeof topReasons[r] === 'string' ? topReasons[r] : (topReasons[r].message || topReasons[r].reason || JSON.stringify(topReasons[r]));
                html += '    <li>' + escapeHtml(reason) + '</li>';
            }
            html += '  </ul>';
        }
        html += '</div>';

        // Actions (Yapılacaklar)
        html += '<div class="card detail-panel">';
        html += '  <h3 class="detail-panel__title">✅ Yapılacaklar</h3>';
        if (actions.length === 0) {
            html += '  <p class="text-muted text-sm">Öneri yok.</p>';
        } else {
            html += '  <ul class="reasons-list reasons-list--detail">';
            for (var a = 0; a < Math.min(3, actions.length); a++) {
                var action = typeof actions[a] === 'string' ? actions[a] : (actions[a].action || actions[a].recommendation || JSON.stringify(actions[a]));
                html += '    <li>' + escapeHtml(action) + '</li>';
            }
            html += '  </ul>';
        }
        html += '</div>';

        html += '</div>'; // end detail-panels

        app.innerHTML = html;

        // Fetch and render device history chart
        fetchDeviceHistory(hostname).then(function (points) {
            if (!points || points.length === 0) {
                var emptyEl = document.getElementById('chartDeviceEmpty');
                var canvasEl = document.getElementById('chartDeviceHistory');
                if (emptyEl) emptyEl.style.display = 'block';
                if (canvasEl) canvasEl.style.display = 'none';
                return;
            }
            var labels = points.map(function (p) { return formatTime(p.timestamp); });
            var scores = points.map(function (p) { return p.score; });

            var ctx = document.getElementById('chartDeviceHistory');
            if (ctx) {
                _chartInstances.deviceHistory = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Skor',
                            data: scores,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59,130,246,0.1)',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#3b82f6'
                        }]
                    },
                    options: _chartOptions(0, 100)
                });
            }
        });
    };

    // If we have devices in cache, use them; otherwise fetch
    if (state.devices.length > 0) {
        renderDetail();
    } else {
        fetchDevices().then(renderDetail);
    }
}

/* ==========================================================
   BOOT & INIT
   ========================================================== */

function bootApp() {
    // Parse initial hash
    var parsed = _parseHash();
    state.currentTab = parsed.tab;
    _updateTabUI();

    // Tab navigation clicks
    var tabBtns = document.querySelectorAll('.tab-nav__item');
    for (var i = 0; i < tabBtns.length; i++) {
        tabBtns[i].addEventListener('click', function () {
            var tab = this.getAttribute('data-tab');
            if (tab) navigateTo(tab);
        });
    }

    // Global scan button
    var scanBtn = document.getElementById('btnScanGlobal');
    if (scanBtn) {
        scanBtn.addEventListener('click', handleScanClick);
    }

    // Hash change listener
    window.addEventListener('hashchange', function () {
        var parsed = _parseHash();
        state.currentTab = parsed.tab;
        _updateTabUI();

        if (parsed.tab === 'device' && parsed.params.hostname) {
            renderDeviceDetail(parsed.params.hostname);
        } else {
            renderCurrentTab();
        }
    });

    // Initial data fetch and render
    fetchDevices().then(function () {
        if (state.currentTab === 'device') {
            var parsed2 = _parseHash();
            if (parsed2.params.hostname) {
                renderDeviceDetail(parsed2.params.hostname);
            } else {
                navigateTo('cihazlar');
            }
        } else {
            renderCurrentTab();
        }
    });

    // Fetch latest timestamp for header
    fetchFleetHistory(1);

    // Start devices polling (always)
    _startDevicesPolling();
}
