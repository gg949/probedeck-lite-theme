/* ProbeDeck-lite Theme — 移植自 Guoba探针面板
 * 纯静态主题：index.html + assets/（无外部 CDN 依赖，Chart.js 已本地化）
 * 数据源：REST /api/config /api/servers /api/server /api/history/all + WebSocket /api/ws
 */
(function () {
  'use strict';

  /* ── 常量与工具 ─────────────────────────────────────── */
  var STORAGE_KEY_VIEW = 'guoba_preferred_view';
  var STORAGE_KEY_RANGE = 'guoba_detail_range';
  var REFRESH_MS = 5000;

  // 详情页时间范围:key / 显示名 / API hours
  // hours 与后端 /api/history/all 白名单一致(336=14天, 720=30天);
  // 后端会按面板 history_retention_days 自动截断超出的部分
  var RANGES = [
    { key: '1', label: '1小时', hours: 1 },
    { key: '6', label: '6小时', hours: 6 },
    { key: '24', label: '1天', hours: 24 },
    { key: '48', label: '2天', hours: 48 },
    { key: '168', label: '7天', hours: 168 },
    { key: '336', label: '14天', hours: 336 },
    { key: '720', label: '30天', hours: 720 }
  ];

  function getRange(key) {
    for (var i = 0; i < RANGES.length; i++) if (RANGES[i].key === key) return RANGES[i];
    return RANGES[2]; // 默认 1天
  }

  var COUNTRY_COORDS = {
    US: [37.09, -95.71], CN: [35.86, 104.19], JP: [36.2, 138.25], HK: [22.31, 114.16],
    SG: [1.35, 103.81], KR: [35.9, 127.76], DE: [51.16, 10.45], GB: [55.37, -3.43],
    NL: [52.13, 5.29], FR: [46.22, 2.21], CA: [56.13, -106.34], AU: [-25.27, 133.77],
    IN: [20.59, 78.96], BR: [-14.23, -51.92], RU: [61.52, 105.31], ZA: [-30.55, 22.93],
    TW: [23.69, 120.96], IT: [41.87, 12.56], SE: [60.12, 18.64], CH: [46.81, 8.22],
    ES: [40.46, -3.74], PL: [51.91, 19.14], FI: [61.92, 25.74], NO: [60.47, 8.46],
    DK: [56.26, 9.5], IE: [53.14, -7.69], AT: [47.51, 14.55], TR: [38.96, 35.24],
    AE: [23.42, 53.84], MY: [4.21, 101.97], TH: [15.87, 100.99], VN: [14.05, 108.27],
    PH: [12.87, 121.77], ID: [-0.78, 113.92], MO: [22.2, 113.55]
  };

  var COUNTRY_NAME_ZH = {
    US: '美国', CN: '中国', JP: '日本', HK: '香港', SG: '新加坡', KR: '韩国', DE: '德国',
    GB: '英国', NL: '荷兰', FR: '法国', CA: '加拿大', AU: '澳大利亚', IN: '印度', BR: '巴西',
    RU: '俄罗斯', ZA: '南非', TW: '台湾', IT: '意大利', SE: '瑞典', CH: '瑞士', ES: '西班牙',
    PL: '波兰', FI: '芬兰', NO: '挪威', DK: '丹麦', IE: '爱尔兰', AT: '奥地利', TR: '土耳其',
    AE: '阿联酋', MY: '马来西亚', TH: '泰国', VN: '越南', PH: '菲律宾', ID: '印度尼西亚',
    MO: '澳门'
  };

  // 原面板的\"地区优先\"排序：卡片按此顺序分组
  var GROUP_ORDER = ['美洲', '欧洲', '亚洲', '大洋洲', '非洲', '其他'];
  var REGION_GROUP = {
    US: '美洲', CA: '美洲', BR: '美洲', MX: '美洲', AR: '美洲', CL: '美洲',
    DE: '欧洲', GB: '欧洲', NL: '欧洲', FR: '欧洲', IT: '欧洲', ES: '欧洲',
    SE: '欧洲', CH: '欧洲', PL: '欧洲', FI: '欧洲', NO: '欧洲', DK: '欧洲',
    IE: '欧洲', AT: '欧洲', TR: '欧洲', RU: '欧洲',
    CN: '亚洲', JP: '亚洲', HK: '亚洲', SG: '亚洲', KR: '亚洲', TW: '亚洲',
    IN: '亚洲', AE: '亚洲', MY: '亚洲', TH: '亚洲', VN: '亚洲', PH: '亚洲',
    ID: '亚洲', MO: '亚洲',
    AU: '大洋洲', NZ: '大洋洲'
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtBytes(bytes, decimals) {
    var b = parseFloat(bytes);
    if (isNaN(b) || b === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    var i = Math.floor(Math.log(Math.abs(b)) / Math.log(k));
    if (i < 0) i = 0;
    if (i >= sizes.length) i = sizes.length - 1;
    var d = decimals != null ? decimals : 2;
    return parseFloat((b / Math.pow(k, i)).toFixed(d)) + ' ' + sizes[i];
  }

  // 探针上报单位换算：ram/swap/disk_* 为 MB；net_rx/net_tx/月流量为字节
  function fmtMB(mb) { return fmtBytes((Number(mb) || 0) * 1048576); }
  function fmtMBPair(used, total) { return fmtMB(used) + ' / ' + fmtMB(total); }
  function fmtBytesSpeed(bps) { return fmtBytes(bps) + '/s'; }

  function fmtUptime(ms) {
    var s = Math.floor(ms / 1000);
    if (s < 60) return s + ' 秒';
    var d = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (d > 0) return d + ' 天, ' + h + ':' + String(m).padStart(2, '0');
    if (h > 0) return h + ' 小时, ' + m + ' 分';
    return m + ' 分钟';
  }

  function fmtAgo(ts) {
    var diff = Date.now() - ts;
    if (diff < 0) diff = 0;
    var s = Math.floor(diff / 1000);
    if (s < 60) return s + ' 秒前';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' 分钟前';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' 小时前';
    return Math.floor(h / 24) + ' 天前';
  }

  function fmtDaysLeft(expire) {
    if (!expire) return '';
    var t = new Date(expire.replace(/-/g, '/')).getTime();
    if (isNaN(t)) return '';
    var days = Math.ceil((t - Date.now()) / 86400000);
    return days + ' 天';
  }

  function fmtMoney(price, currency) {
    if (price == null || price === '') return '';
    if (price === '0' || price === '-1') return '免费';
    return (currency || '¥') + price;
  }

  function fmtDate(ts) {
    if (!ts) return '-';
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) return '-';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');
  }

  function fmtDateShort(ts) {
    if (!ts) return '';
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) return '';
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function pingColor(ms) {
    if (ms == null || ms === false || ms === '') return 'var(--text-faint)';
    var n = Number(ms);
    if (isNaN(n)) return 'var(--text-faint)';
    if (n < 100) return 'var(--green)';
    if (n < 300) return '#f59e0b';
    return 'var(--red)';
  }

  function fmtPing(v) {
    if (v == null || v === false || v === '') return '<span style="color:var(--text-faint)">--</span>';
    if (v === 'timeout') return '<span style="color:var(--red)">超时</span>';
    return '<b style="color:' + pingColor(v) + '">' + Number(v) + 'ms</b>';
  }

  function barColor(pct) {
    var p = Number(pct) || 0;
    if (p < 60) return '#10b981';
    if (p < 85) return '#f59e0b';
    return '#ef4444';
  }

  function flagUrl(code, size) {
    if (!code || code === 'xx') return '';
    var s = size === 24 ? 24 : 16;
    return '/flags/' + code.toLowerCase() + '.svg';
  }

  function flagImg(code, size, cls) {
    var src = flagUrl(code, size);
    if (!src) return '<span class="' + (cls || '') + '">🏳️</span>';
    return '<img class="' + (cls || '') + '" src="' + esc(src) + '" alt="' + esc(code) + '"' +
      ' onerror="this.style.display=\'none\'">';
  }

  /* ── 状态 ───────────────────────────────────────────── */
  var state = {
    config: null,
    servers: [],
    stats: null,
    sysConfig: {},
    view: 'card',
    filter: 'all',
    filterDirty: false,
    charts: [],
    mapDrawn: false,
    worldCells: null,
    ws: null,
    wsTimer: null,
    wsConnectedAt: 0,
    detailServer: null,
    detailHistory: [],
    detailCharts: {},
    detailTimer: null,
    detailWs: null,
    detailRangeKey: '24',
    rangeUpdating: false,   // 时间范围切换请求中,防重复
    onlineIds: {}
  };

  function apiBase() {
    var meta = document.querySelector('meta[name="apiBase"]');
    if (meta && meta.content) {
      var first = meta.content.split(',').map(function (s) { return s.trim(); }).filter(Boolean)[0];
      if (first) return first.replace(/\/+$/, '');
    }
    return window.location.origin;
  }

  function apiUrl(path) { return apiBase() + path; }

  function authHeaders() {
    var h = {};
    try {
      var token = localStorage.getItem('jwt_token');
      if (token) h['Authorization'] = 'Bearer ' + token;
    } catch (e) { /* private mode */ }
    return h;
  }

  function fetchJson(path, opts) {
    var o = opts || {};
    o.headers = Object.assign({}, authHeaders(), o.headers || {});
    return fetch(apiUrl(path), o).then(function (r) {
      if (!r.ok) {
        var err = new Error(r.status + ' ' + path);
        err.status = r.status;
        throw err;
      }
      return r.json();
    });
  }

  /* ── 在线判定 ───────────────────────────────────────── */
  var ONLINE_THRESHOLD_MS = 300000; // 与面板一致：5 分钟
  function computeOnlineMap() {
    var now = Date.now();
    var m = {};
    state.servers.forEach(function (s) {
      var last = Math.max(Number(s.last_updated) || 0, Number(s.timestamp) || 0);
      m[s.id] = (now - last) <= ONLINE_THRESHOLD_MS;
    });
    return m;
  }

  /* ── 主题(固定浅色风格,与 Guoba 探针一致)────────────── */
  function applyTheme() {
    // 仅保留浅色外观;重绘地图浅色底图
    if (state.mapDrawn) drawMap(state.mapCounts || {});
  }

  /* ── 布局骨架 ───────────────────────────────────────── */
  function renderShell() {
    var app = $('#app');
    var title = (state.config && state.config.site_title) || '探针台';
    app.innerHTML =
      '<div class="header">' +
      '  <h1 id="site-title">' + esc(title) + '</h1>' +
      '  <div class="header-right">' +
      '    <div class="view-controls">' +
      '      <button class="toggle-btn" id="btn-card" data-view="card"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> 卡片</button>' +
      '      <button class="toggle-btn" id="btn-table" data-view="table"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="18"></line><line x1="3" y1="18" x2="21" y2="6"></line></svg> 表格</button>' +
      '      <button class="toggle-btn" id="btn-map" data-view="map"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg> 地图</button>' +
      '    </div>' +
      '    <a class="admin-btn" href="/admin#admin" title="管理后台"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></a>' +
      '  </div>' +
      '</div>' +
      '<div class="filter-bar" id="filter-bar"></div>' +
      '<div class="global-stats" id="global-stats"></div>' +
      '<div class="view-panel active" id="view-card"></div>' +
      '<div class="view-panel" id="view-table"></div>' +
      '<div class="view-panel" id="view-map">' +
      '  <div id="map-container"><div class="map-legend">' +
      '    <div><i style="background:var(--green)"></i>有节点地区 &nbsp;<i style="background:var(--map-land)"></i>其他地区</div>' +
      '    <div>数字 = 该地区节点数</div>' +
      '  </div></div>' +
      '</div>' +
      '<div class="powered">' +
      '  <div class="visit" id="visit-box"></div>' +
      '  <div>Powered by <a href="https://github.com/gg949/ProbeDeck/" target="_blank" rel="noopener">ProbeDeck</a> <span id="ver"></span></div>' +
      '</div>';

    $all('.toggle-btn').forEach(function (b) {
      b.addEventListener('click', function () { switchView(b.getAttribute('data-view')); });
    });
  }

  function switchView(v) {
    state.view = v;
    try { localStorage.setItem(STORAGE_KEY_VIEW, v); } catch (e) { /* ignore */ }
    $all('.toggle-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === v);
    });
    $all('.view-panel').forEach(function (p) { p.classList.remove('active'); });
    var panel = $('#view-' + v);
    if (panel) panel.classList.add('active');
    if (v === 'map' && !state.mapDrawn) ensureWorldCells(function () { drawMap(state.mapCounts || {}); });
    else if (v === 'map') drawMap(state.mapCounts || {});
  }

  /* ── 顶部统计 ───────────────────────────────────────── */
  function renderStats() {
    var st = state.stats;
    if (!st) return;
    var online = 0, offline = 0;
    state.servers.forEach(function (s) {
      var on = state.onlineIds[s.id];
      if (on) online++; else offline++;
    });
    $('#global-stats').innerHTML =
      '<div class="g-item"><div class="g-label">服务器总数</div>' +
      '<div class="g-val">' + (st.total != null ? st.total : state.servers.length) + '</div>' +
      '<div class="g-sub">在线 <span style="color:var(--green)">' + online + '</span> | 离线 <span style="color:var(--red)">' + offline + '</span></div></div>' +
      '<div class="g-item"><div class="g-label">总计流量 (入 | 出)</div>' +
      '<div class="g-val">' + fmtBytes(st.globalNetRx) + ' | ' + fmtBytes(st.globalNetTx) + '</div></div>' +
      '<div class="g-item"><div class="g-label">实时网速 (入 | 出)</div>' +
      '<div class="g-val"><span style="color:var(--green)">↓</span> ' + fmtBytesSpeed(st.globalSpeedIn) +
      ' | <span style="color:var(--accent)">↑</span> ' + fmtBytesSpeed(st.globalSpeedOut) + '</div></div>';
  }

  /* ── 过滤条 ─────────────────────────────────────────── */
  function renderFilter() {
    var counts = {};
    state.servers.forEach(function (s) {
      var c = s.region || 'xx';
      counts[c] = (counts[c] || 0) + 1;
    });
    var html = '<span class="filter-tag' + (state.filter === 'all' ? ' active' : '') + '" data-target="all">全部 ' + state.servers.length + '</span>';
    Object.keys(counts).sort().forEach(function (c) {
      html += '<span class="filter-tag' + (state.filter === c ? ' active' : '') + '" data-target="' + esc(c) + '">' +
        flagImg(c, 16) + ' ' + esc(c) + ' ' + counts[c] + '</span>';
    });
    $('#filter-bar').innerHTML = html;
    $all('.filter-tag').forEach(function (t) {
      t.addEventListener('click', function () {
        state.filter = t.getAttribute('data-target');
        renderFilter();
        renderCards();
        renderTable();
      });
    });
  }

  function visibleServers() {
    if (state.filter === 'all') return state.servers;
    return state.servers.filter(function (s) { return (s.region || 'xx') === state.filter; });
  }

  /* ── 卡片视图 ───────────────────────────────────────── */
  function osShort(s) {
    var os = s.os || '';
    var arch = s.arch || '';
    var virt = virtFromOs(os);
    return [os, arch, virt].filter(Boolean).join(' | ');
  }
  function virtFromOs(os) { return ''; }

  function statGroup(label, pct, sub, color) {
    return '<div class="stat-group">' +
      '<div class="stat-header"><span>' + esc(label) + '</span><span>' + pct + '%</span></div>' +
      '<div class="stat-bar-full"><div style="width:' + Math.min(100, Math.max(0, pct)) + '%;background:' + (color || barColor(pct)) + '"></div></div>' +
      (sub ? '<div class="stat-subtext" title="' + esc(sub) + '">' + esc(sub) + '</div>' : '') +
      '</div>';
  }

  function renderCards() {
    var list = visibleServers();
    var panel = $('#view-card');
    if (!list.length) {
      panel.innerHTML = '<div class="empty-tip">没有匹配的服务器</div>';
      return;
    }
    var groups = {};
    list.forEach(function (s) {
      var g = s.server_group || REGION_GROUP[s.region] || '其他';
      (groups[g] = groups[g] || []).push(s);
    });
    var groupNames = Object.keys(groups).sort(function (a, b) {
      var ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    var html = '';
    groupNames.forEach(function (g) {
      html += '<div class="group-header">' + esc(g) + '</div><div class="grid-container">';
      groups[g].forEach(function (s) { html += cardHtml(s); });
      html += '</div>';
    });
    panel.innerHTML = html;
  }

  function cardHtml(s) {
    var online = state.onlineIds[s.id];
    var cpu = Number(s.cpu) || 0;
    var ramPct = s.ram_total ? ((Number(s.ram_used) || 0) / s.ram_total * 100) : 0;
    var diskPct = s.disk_total ? ((Number(s.disk_used) || 0) / s.disk_total * 100) : 0;
    var sc = state.sysConfig || {};
    var meta = [];
    if (sc.show_price !== false) {
      var m = fmtMoney(s.price, s.currency);
      if (m) meta.push('价格: ' + esc(m));
    }
    if (sc.show_expire !== false && s.expire_date) {
      var dl = fmtDaysLeft(s.expire_date);
      if (dl) meta.push('剩余天数: ' + esc(dl));
    }
    if (sc.show_tf !== false && (s.net_rx || s.net_tx)) {
      meta.push('流量: <span style="color:var(--green)">↓</span> ' + fmtBytes(s.net_rx) + ' | <span style="color:var(--accent)">↑</span> ' + fmtBytes(s.net_tx));
    }
    var last = Math.max(Number(s.last_updated) || 0, Number(s.timestamp) || 0);
    meta.push('更新: ' + fmtAgo(last));

    var badges = '';
    if (s.ip_v4 === '1') badges += '<span class="badge badge-v4">IPv4</span>';
    if (s.ip_v6 === '1') badges += '<span class="badge badge-v6">IPv6</span>';

    var pings = ['ct', 'cu', 'cm', 'bd'];
    var pingHtml = '<div class="ping-box">';
    pings.forEach(function (k) {
      pingHtml += '<span>' + esc((sc['custom_' + k + '_name']) || { ct: '电信', cu: '联通', cm: '移动', bd: '字节' }[k]) + ' ' + fmtPing(s['ping_' + k]) + '</span>';
    });
    pingHtml += '</div>';

    return '<a class="vps-card' + (online ? '' : ' offline') + '" href="#/server/' + encodeURIComponent(s.id) + '" data-country="' + esc(s.region || 'xx') + '">' +
      '<div class="card-left">' +
      '  <div class="card-title">' +
      '    <div class="status-dot ' + (online ? 'online' : 'offline') + '"></div>' +
      flagImg(s.region, 24, 'card-flag') +
      '    <span class="card-title-text" title="' + esc(s.name) + '">' + esc(s.name) + '</span>' +
      '  </div>' +
      meta.map(function (m) { return '<div class="card-meta">' + m + '</div>'; }).join('') +
      (badges ? '<div class="card-badges">' + badges + '</div>' : '') +
      pingHtml +
      '</div>' +
      '<div class="card-right">' +
      statGroup('CPU', cpu.toFixed(1), s.cpu_info) +
      statGroup('内存', ramPct.toFixed(1), fmtMBPair(s.ram_used, s.ram_total)) +
      statGroup('存储', diskPct.toFixed(1), fmtMBPair(s.disk_used, s.disk_total)) +
      '<div class="card-foot">' +
      '  <div class="ellipsis" title="' + esc(osShort(s)) + '">' + esc(osShort(s)) + '</div>' +
      '  <div class="nowrap">TCP/UDP: ' + esc(s.tcp_conn || 0) + ' / ' + esc(s.udp_conn || 0) + '</div>' +
      '</div>' +
      '<div class="card-net">' +
      '  <div class="c-down">↓ ' + fmtBytesSpeed(s.net_in_speed) + '</div>' +
      '  <div class="c-up">↑ ' + fmtBytesSpeed(s.net_out_speed) + '</div>' +
      '</div>' +
      '</div>' +
      '</a>';
  }

  /* ── 表格视图 ───────────────────────────────────────── */
  function renderTable() {
    var list = visibleServers();
    var panel = $('#view-table');
    var sc = state.sysConfig || {};
    var cols = ['状态', '名称', '地区', '系统', 'CPU', '内存', '存储', '流量', '下载', '上传', '更新'];
    var html = '<div class="table-responsive"><table class="custom-table"><thead><tr>' +
      cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') +
      '</tr></thead><tbody>';
    list.forEach(function (s) {
      var online = state.onlineIds[s.id];
      var cpu = Number(s.cpu) || 0;
      var ramPct = s.ram_total ? ((Number(s.ram_used) || 0) / s.ram_total * 100) : 0;
      var diskPct = s.disk_total ? ((Number(s.disk_used) || 0) / s.disk_total * 100) : 0;
      var last = Math.max(Number(s.last_updated) || 0, Number(s.timestamp) || 0);
      var cellBar = function (pct) {
        return '<td><div class="td-cell"><div class="stat-bar"><div style="width:' + Math.min(100, Math.max(0, pct)) + '%;background:' + barColor(pct) + '"></div></div><span>' + pct.toFixed(1) + '%</span></div></td>';
      };
      html += '<tr data-id="' + esc(s.id) + '" data-country="' + esc(s.region || 'xx') + '">' +
        '<td style="text-align:center"><div class="status-dot ' + (online ? 'online' : 'offline') + '" style="display:inline-block;margin:0"></div></td>' +
        '<td><b>' + esc(s.name) + '</b></td>' +
        '<td>' + flagImg(s.region, 16) + '</td>' +
        '<td><span class="os-text" title="' + esc(osShort(s)) + '">' + esc(osShort(s)) + '</span></td>' +
        cellBar(cpu) + cellBar(ramPct) + cellBar(diskPct) +
        '<td style="color:var(--text-muted);font-size:12px">' + fmtBytes(s.net_rx) + ' | ' + fmtBytes(s.net_tx) + '</td>' +
        '<td>' + fmtBytesSpeed(s.net_in_speed) + '</td>' +
        '<td>' + fmtBytesSpeed(s.net_out_speed) + '</td>' +
        '<td style="color:var(--text-muted);font-size:12px">' + fmtAgo(last) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    panel.innerHTML = list.length ? html : '<div class="empty-tip">没有匹配的服务器</div>';
    $all('tr[data-id]', panel).forEach(function (tr) {
      tr.addEventListener('click', function () {
        location.hash = '#/server/' + encodeURIComponent(tr.getAttribute('data-id'));
      });
    });
  }

  /* ── 地图视图 ───────────────────────────────────────── */
  function ensureWorldCells(cb) {
    if (state.worldCells) return cb();
    fetch('/assets/world-cells.json').then(function (r) { return r.json(); }).then(function (d) {
      state.worldCells = d;
      cb();
    }).catch(function () { state.worldCells = {}; cb(); });
  }

  function drawMap(counts) {
    state.mapCounts = counts || {};
    var box = $('#map-container');
    if (!box) return;
    var CELL = 5;      // 每格像素
    var STEP = 1.25;   // 与生成数据一致
    var COLS = Math.ceil(360 / STEP);
    var ROWS = Math.ceil(160 / STEP);
    var isDark = false; // 固定浅色风格
    var landColor = isDark ? '#2a303c' : '#d5dce2';
    var activeColor = '#10b981';
    var cells = state.worldCells || {};
    var hasCount = function (gx, gy) {
      for (var k in cells) {
        var list = cells[k];
        for (var i = 0; i < list.length; i++) {
          if (list[i][0] === gx && list[i][1] === gy) return k;
        }
      }
      return null;
    };
    // 建立 (gx,gy)->iso2 索引
    var idx = {};
    for (var k in cells) {
      cells[k].forEach(function (p) { idx[p[0] + ':' + p[1]] = k; });
    }
    var w = COLS * CELL, h = ROWS * CELL;
    var svg = '<svg width="100%" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" style="display:block">';
    for (var gy = -64; gy < 64; gy++) {
      for (var gx = -144; gx < 144; gx++) {
        var iso = idx[gx + ':' + gy];
        if (!iso) continue;
        var x = (gx * STEP + 180) * (360 / 360) * CELL;
        // 经度映射：-180..180 → 0..w
        x = (gx * STEP + STEP / 2 + 180) / 360 * w;
        var y = (84 - (gy * STEP + STEP / 2)) / 168 * h;
        var has = counts[iso] > 0;
        svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + CELL + '" height="' + CELL + '" fill="' +
          (has ? activeColor : landColor) + '"/>';
      }
    }
    // 节点数字标
    for (var code in counts) {
      var c = COUNTRY_COORDS[code];
      if (!c) continue;
      var mx = (c[1] + 180) / 360 * w;
      var my = (84 - c[0]) / 168 * h;
      svg += '<g transform="translate(' + mx.toFixed(1) + ',' + my.toFixed(1) + ')">' +
        '<foreignObject x="-40" y="-40" width="80" height="80">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" class="map-badge">' + counts[code] + '</div>' +
        '</foreignObject></g>';
    }
    svg += '</svg>';
    box.innerHTML = '<div class="map-legend">' +
      '<div><i style="background:' + activeColor + '"></i>有节点地区 &nbsp;<i style="background:' + landColor + '"></i>其他地区</div>' +
      '<div>数字 = 该地区节点数</div></div>' + svg;
    state.mapDrawn = true;
  }

  function mapCountsFromServers() {
    var c = {};
    state.servers.forEach(function (s) {
      var r = s.region || 'xx';
      c[r] = (c[r] || 0) + 1;
    });
    return c;
  }

  /* ── 详情页 ─────────────────────────────────────────── */
  function renderDetail(id) {
    stopListLoop();
    fetchJson('/api/server?id=' + encodeURIComponent(id)).then(function (s) {
      state.detailServer = s;
      drawDetail(s, true);
      startDetailLoop(id);
      connectDetailWs(id);
    }).catch(function () {
      $('#app').innerHTML = '<div class="empty-tip">服务器不存在或加载失败<br><br><a href="#/" style="color:var(--accent)">返回大盘</a></div>';
    });
  }

  function drawDetail(s, first) {
    var app = $('#app');
    var online = state.onlineIds[s.id] != null ? state.onlineIds[s.id] :
      (Date.now() - Math.max(Number(s.last_updated) || 0, Number(s.timestamp) || 0)) <= ONLINE_THRESHOLD_MS;
    var sc = state.sysConfig || {};
    var flag = flagImg(s.region, 24, '');
    var info = [
      ['运行时间', s.boot_time ? fmtUptime(Date.now() - Number(s.boot_time)) : '-'],
      ['架构', s.arch || '-'],
      ['系统', s.os || '-'],
      ['内核', s.kernel_version || '-'],
      ['CPU', (s.cpu_info || '-') + (s.cpu_cores ? ' (' + s.cpu_cores + ' 核)' : '')],
      ['Load', s.load_avg || '-'],
      ['上传 / 下载', fmtBytes(s.net_tx) + ' / ' + fmtBytes(s.net_rx)],
      ['本月流量', fmtBytes(s.net_tx_monthly) + ' / ' + fmtBytes(s.net_rx_monthly)],
      ['启动时间', fmtDate(s.boot_time)],
      ['价格', fmtMoney(s.price, s.currency) || '-'],
      ['到期时间', s.expire_date || '-']
    ];
    if (s.tags) info.push(['标签', s.tags]);
    if (s.cpu_cores) info.push(['CPU 核心', s.cpu_cores + ' 核']);
    if (s.processes != null) info.push(['进程数', s.processes]);

    var chartsHtml =
      chartCard('CPU', 'd-cpu', 'cpu') +
      chartCard('内存', 'd-ram', 'ram') +
      chartCard('磁盘', 'd-disk', 'disk') +
      chartCard('进程数', 'd-proc', 'proc') +
      chartCard('网络速度', 'd-net', 'net') +
      chartCard('TCP / UDP', 'd-conn', 'conn');

    var range = getRange(state.detailRangeKey);
    var rangeBtns = RANGES.map(function (r) {
      return '<button class="range-btn' + (r.key === state.detailRangeKey ? ' active' : '') + '" data-range="' + r.key + '">' + r.label + '</button>';
    }).join('');

    app.innerHTML =
      '<a class="back-btn" href="#/">⬅ 返回大盘</a>' +
      '<div class="range-bar">' +
      '  <span class="range-label">数据范围</span>' + rangeBtns +
      '  <span class="range-note" id="range-note"></span>' +
      '</div>' +
      '<div class="header-card">' +
      '  <div class="title-row">' +
      '    <h2>' + flag + esc(s.name) + '</h2>' +
      '    <span class="status-badge' + (online ? '' : ' offline') + '">' + (online ? '在线' : '离线') + '</span>' +
      '  </div>' +
      '  <div class="info-grid">' +
      info.map(function (kv) {
        return '<div class="info-item"><span class="info-label">' + esc(kv[0]) + '</span><span class="info-value" title="' + esc(kv[1]) + '">' + esc(kv[1]) + '</span></div>';
      }).join('') +
      '  </div>' +
      '</div>' +
      '<div class="charts-grid">' + chartsHtml + '</div>' +
      latencyCardHtml(s, sc) +
      diskIoCardHtml(s) +
      gpuCardHtml(s) +
      '<div class="powered">' +
      '  <div class="visit" id="visit-box"></div>' +
      '  <div>Powered by <a href="https://github.com/gg949/ProbeDeck/" target="_blank" rel="noopener">ProbeDeck</a> <span id="ver"></span></div>' +
      '</div>';

    $('#ver') && ($('#ver').textContent = state.config && state.config.version ? 'v' + state.config.version : '');
    bindVisitBox();
    createDetailCharts();
    bindRangeButtons();
    loadDetailHistory(s.id);
  }

  function chartCard(title, id, kind) {
    var extra = '';
    if (kind === 'ram') extra = '<div style="font-size:12px;color:var(--text-muted);margin-bottom:5px" id="' + id + '-sub"></div>';
    if (kind === 'disk') {
      extra = '<div class="disk-bar-wrap"><div id="' + id + '-bar" style="height:100%;width:0%;background:#34d399"></div></div>' +
        '<div class="disk-detail" id="' + id + '-detail"></div>';
    }
    var valId = id + '-val';
    return '<div class="chart-card">' +
      '<h3>' + esc(title) + ' <span class="chart-val" id="' + valId + '"></span></h3>' +
      extra +
      (kind === 'disk' ? '' : '<div class="chart-box"><canvas id="' + id + '"></canvas></div>') +
      '</div>';
  }

  function latencyCardHtml(s, sc) {
    // 三网延迟趋势图(全宽):电信/联通/移动/字节 四条曲线 + 平均延迟/丢包徽章
    return '<div class="chart-card chart-full"><h3>延迟 / 丢包 <span class="chart-val" id="d-ping-badges"></span></h3>' +
      '<div class="chart-box chart-box-lg"><canvas id="d-ping"></canvas></div></div>';
  }

  function diskIoCardHtml(s) {
    var d = s.disk;
    var rows = '';
    if (d && (d.read_bps || d.write_bps || d.read_iops || d.write_iops || d.util || d.await_ms)) {
      rows =
        '<div class="kv-row"><span>读取</span><span>' + fmtBytesSpeed(d.read_bps) + '</span></div>' +
        '<div class="kv-row"><span>写入</span><span>' + fmtBytesSpeed(d.write_bps) + '</span></div>' +
        '<div class="kv-row"><span>IOPS</span><span>' + (d.read_iops || 0) + ' / ' + (d.write_iops || 0) + '</span></div>' +
        '<div class="kv-row"><span>await</span><span>' + (d.await_ms || 0) + ' ms</span></div>' +
        '<div class="kv-row"><span>利用率</span><span>' + (d.util || 0) + '%</span></div>';
    } else {
      rows = '<div class="kv-row"><span>状态</span><span>未上报磁盘 IO</span></div>';
    }
    return '<div class="chart-card"><h3>磁盘 IO</h3><div class="kv-list">' + rows + '</div></div>';
  }

  function gpuCardHtml(s) {
    var gpus = s.gpu_info;
    if (typeof gpus === 'string') { try { gpus = JSON.parse(gpus); } catch (e) { gpus = null; } }
    var rows = '';
    if (Array.isArray(gpus) && gpus.length) {
      gpus.forEach(function (g, i) {
        rows += '<div class="kv-row"><span>GPU ' + (g.id != null ? g.id : i) + '</span><span title="' + esc(g.name) + '">' + esc(g.name) + (g.info != null ? ' · ' + g.info + '%' : '') + '</span></div>';
      });
    } else {
      rows = '<div class="kv-row"><span>状态</span><span>无 GPU</span></div>';
    }
    return '<div class="chart-card"><h3>GPU</h3><div class="kv-list">' + rows + '</div></div>';
  }

  /* ── 详情页图表 ─────────────────────────────────────── */
  var CHART_COLORS = { cpu: '#3b82f6', ram: '#8b5cf6', proc: '#ec4899', netIn: '#10b981', netOut: '#3b82f6', tcp: '#6366f1', udp: '#d946ef' };

  function baseOpts(extra) {
    var o = {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: { display: false, grid: { color: 'rgba(127,127,127,.15)', borderDash: [4, 4] } },
        y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(127,127,127,.15)', borderDash: [4, 4] } }
      },
      elements: { point: { radius: 0, hitRadius: 8, hoverRadius: 4 }, line: { tension: 0.35, borderWidth: 2 } }
    };
    if (extra) Object.assign(o, extra);
    return o;
  }

  function mkChart(id, cfg) {
    var c = document.getElementById(id);
    if (!c || !window.Chart) return null;
    return new Chart(c.getContext('2d'), cfg);
  }

  function createDetailCharts() {
    destroyDetailCharts();
    var ch = state.detailCharts;
    ch.cpu = mkChart('d-cpu', {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: CHART_COLORS.cpu, backgroundColor: 'rgba(59,130,246,.12)', fill: true }] },
      options: baseOpts()
    });
    ch.ram = mkChart('d-ram', {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: CHART_COLORS.ram, backgroundColor: 'rgba(139,92,246,.12)', fill: true }] },
      options: baseOpts()
    });
    ch.proc = mkChart('d-proc', {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: CHART_COLORS.proc, backgroundColor: 'rgba(236,72,153,.12)', fill: true }] },
      options: baseOpts()
    });
    ch.net = mkChart('d-net', {
      type: 'line',
      data: { labels: [], datasets: [
        { label: '下载', data: [], borderColor: CHART_COLORS.netIn, backgroundColor: 'rgba(16,185,129,.1)', fill: true },
        { label: '上传', data: [], borderColor: CHART_COLORS.netOut, backgroundColor: 'rgba(59,130,246,.1)', fill: true }
      ] },
      options: baseOpts({ plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { enabled: true, callbacks: { label: function (c) { return c.dataset.label + ': ' + fmtBytesSpeed(c.parsed.y); } } } } })
    });
    ch.conn = mkChart('d-conn', {
      type: 'line',
      data: { labels: [], datasets: [
        { label: 'TCP', data: [], borderColor: CHART_COLORS.tcp },
        { label: 'UDP', data: [], borderColor: CHART_COLORS.udp }
      ] },
      options: baseOpts({ plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { enabled: true } } })
    });
    ch.ping = mkChart('d-ping', {
      type: 'line',
      data: { labels: [], datasets: [
        { label: '电信', data: [], borderColor: '#ec4899', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
        { label: '联通', data: [], borderColor: '#10b981', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
        { label: '移动', data: [], borderColor: '#3b82f6', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
        { label: '字节', data: [], borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0, tension: 0.3 }
      ] },
      options: baseOpts({
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true, mode: 'index', intersect: false, callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.parsed.y != null ? Number(c.parsed.y).toFixed(1) + ' ms' : '--'); } } }
        },
        scales: {
          x: { display: true, grid: { color: 'rgba(127,127,127,.15)', borderDash: [4, 4] }, ticks: { maxTicksLimit: 8, font: { size: 10 }, color: '#9ca3af' } },
          y: { beginAtZero: true, grid: { color: 'rgba(127,127,127,.15)', borderDash: [4, 4] }, ticks: { font: { size: 10 }, color: '#9ca3af', callback: function (v) { return v + 'ms'; } } }
        }
      })
    });
  }

  function feedPingChart(s) {
    var ch = state.detailCharts && state.detailCharts.ping;
    if (!ch) return;
    var hist = state.detailHistory;
    if (!hist || !hist.length) {
      ch.data.labels = [];
      ch.data.datasets.forEach(function (ds) { ds.data = []; });
      ch.update('none');
      return;
    }
    var range = getRange(state.detailRangeKey);
    var labels = hist.map(function (r) { return range && range.hours >= 168 ? fmtDateShort(r.timestamp) : fmtTime(r.timestamp); });
    var cols = ['ct', 'cu', 'cm', 'bd'];
    var names = { ct: '电信', cu: '联通', cm: '移动', bd: '字节' };
    var colors = { ct: '#ec4899', cu: '#10b981', cm: '#3b82f6', bd: '#f59e0b' };
    ch.data.labels = labels;
    var badges = '';
    cols.forEach(function (k, i) {
      var series = hist.map(function (r) {
        var v = r['ping_' + k];
        return v == null || v === false ? null : Number(v);
      });
      var valid = series.filter(function (v) { return v != null; });
      var avg = valid.length ? valid.reduce(function (a, b) { return a + b; }, 0) / valid.length : null;
      var lossSeries = hist.map(function (r) { var v = r['loss_' + k]; return v == null || v === false ? null : Number(v); });
      var lossValid = lossSeries.filter(function (v) { return v != null; });
      var lossAvg = lossValid.length ? lossValid.reduce(function (a, b) { return a + b; }, 0) / lossValid.length : null;
      ch.data.datasets[i].label = names[k];
      ch.data.datasets[i].borderColor = colors[k];
      ch.data.datasets[i].data = series;
      if (avg != null || lossAvg != null) {
        badges += '<span class="ping-badge"><i style="background:' + colors[k] + '"></i>' + names[k] + ' ' +
          (avg != null ? avg.toFixed(1) + 'ms' : '--') +
          (lossAvg != null ? ' / ' + lossAvg.toFixed(1) + '%丢包' : '') + '</span>';
      }
    });
    ch.update('none');
    var b = $('#d-ping-badges');
    if (b) b.innerHTML = badges;
  }

  function destroyDetailCharts() {
    for (var k in state.detailCharts) {
      try { state.detailCharts[k] && state.detailCharts[k].destroy(); } catch (e) { /* ignore */ }
    }
    state.detailCharts = {};
  }

  function bindRangeButtons() {
    $all('.range-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-range');
        if (key === state.detailRangeKey) return;
        state.detailRangeKey = key;
        try { localStorage.setItem(STORAGE_KEY_RANGE, key); } catch (e) { /* ignore */ }
        $all('.range-btn').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-range') === key); });
        var note = $('#range-note');
        if (note) note.textContent = '';
        var id = state.detailServer && state.detailServer.id;
        if (!id) return;
        state.rangeUpdating = false;
        loadDetailHistory(id);
      });
    });
  }

  function loadDetailHistory(id) {
    var range = getRange(state.detailRangeKey);
    var isLoggedIn = state.config && (state.config.authorization === true);
    // 访客可看历史上限:面板后台"访客历史范围" public_history_hours(默认24)
    // 合法值 [24, 48, 96, 168, 336, 720],即访客最多可看 30 天
    var publicLimit = state.config && Number(state.config.public_history_hours) > 0
      ? Number(state.config.public_history_hours)
      : 24;
    if (!isLoggedIn && range.hours > publicLimit) {
      // 访客超限:标注不可用档位,仍尝试请求(后端 401 时降级到可用的最大档)
      var note = $('#range-note');
      if (note) note.textContent = '访客最多查看 ' + publicLimit + ' 小时,请登录后查看更多';
    }
    fetchJson('/api/history/all?id=' + encodeURIComponent(id) + '&hours=' + range.hours).then(function (rows) {
      state.detailHistory = Array.isArray(rows) ? rows : [];
      state.rangeUpdating = false;
      feedDetailCharts(state.detailServer);
    }).catch(function (e) {
      state.detailHistory = [];
      // 401:未登录且超范围 → 回退到访客可用的最大档
      if (e && e.status === 401) {
        state.detailHistory = [];
        var fallback = '24';
        RANGES.forEach(function (r) {
          if (r.hours > 0 && r.hours <= publicLimit) fallback = r.key;
        });
        if (fallback !== state.detailRangeKey) {
          state.detailRangeKey = fallback;
          try { localStorage.setItem(STORAGE_KEY_RANGE, fallback); } catch (ex) { /* ignore */ }
          $all('.range-btn').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-range') === fallback); });
          var note = $('#range-note');
          if (note) note.textContent = '未登录,已切换到访客可用的最大范围 (' + fallback + ')';
          loadDetailHistory(id);
          return;
        }
      }
      feedDetailCharts(state.detailServer);
    });
  }

  function feedDetailCharts(s) {
    if (!s) return;
    var ch = state.detailCharts;
    var range = getRange(state.detailRangeKey);
    var hist = state.detailHistory;
    var labels = hist.map(function (r) { return fmtTime(r.timestamp); });
    // 长范围显示日期
    if (range && range.hours >= 168) {
      labels = hist.map(function (r) { return fmtDateShort(r.timestamp); });
    }

    // 历史档在序列尾部追加当前实时值,让曲线延伸到"现在"
    var setSeries = function (chart, series, extraVal) {
      if (!chart) return;
      chart.data.labels = labels;
      var data = series.concat(extraVal != null ? [extraVal] : []);
      chart.data.datasets[0].data = data;
      chart.update('none');
    };
    var setMulti = function (chart, seriesList, vals) {
      if (!chart) return;
      chart.data.labels = labels;
      seriesList.forEach(function (arr, i) {
        if (chart.data.datasets[i]) {
          chart.data.datasets[i].data = (arr || []).concat(vals && vals[i] != null ? [vals[i]] : []);
        }
      });
      chart.update('none');
    };
    var col = function (key) { return hist.map(function (r) { return r[key] != null ? r[key] : null; }); };

    setSeries(ch.cpu, col('cpu'), Number(s.cpu) || 0);
    setSeries(ch.ram, col('ram_used'), Number(s.ram_used) || 0);
    setSeries(ch.proc, col('processes'), Number(s.processes) || 0);
    setMulti(ch.net, [col('net_in_speed'), col('net_out_speed')], [Number(s.net_in_speed) || 0, Number(s.net_out_speed) || 0]);
    setMulti(ch.conn, [col('tcp_conn'), col('udp_conn')], [Number(s.tcp_conn) || 0, Number(s.udp_conn) || 0]);

    // 三网延迟趋势 + 平均/丢包徽章
    feedPingChart(s);

    var cpuV = $('#d-cpu-val'); if (cpuV) cpuV.textContent = (Number(s.cpu) || 0).toFixed(1) + '%';
    var ramV = $('#d-ram-val'); if (ramV) ramV.textContent = (s.ram_total ? ((Number(s.ram_used) || 0) / s.ram_total * 100).toFixed(1) : '0') + '%';
    var ramSub = $('#d-ram-sub'); if (ramSub) ramSub.textContent = 'Swap: ' + fmtMBPair(s.swap_used, s.swap_total);
    var procV = $('#d-proc-val'); if (procV) procV.textContent = s.processes || 0;
    var dpct = s.disk_total ? ((Number(s.disk_used) || 0) / s.disk_total * 100) : 0;
    var dbar = $('#d-disk-bar'); if (dbar) { dbar.style.width = dpct.toFixed(1) + '%'; dbar.style.background = barColor(dpct); }
    var ddet = $('#d-disk-detail'); if (ddet) ddet.textContent = fmtMBPair(s.disk_used, s.disk_total);
    var netV = $('#d-net-val');
    if (netV) netV.innerHTML = '<span style="color:var(--green)">↓</span> ' + fmtBytesSpeed(s.net_in_speed) + ' | <span style="color:var(--accent)">↑</span> ' + fmtBytesSpeed(s.net_out_speed);
    var connV = $('#d-conn-val'); if (connV) connV.textContent = 'TCP ' + (s.tcp_conn || 0) + ' | UDP ' + (s.udp_conn || 0);
  }

  function fmtTime(ts) {
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) return '';
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* ── 实时循环 ───────────────────────────────────────── */
  function startListLoop() {
    stopListLoop();
    state.wsTimer = setInterval(refreshList, REFRESH_MS);
    connectListWs();
  }
  function stopListLoop() {
    if (state.wsTimer) { clearInterval(state.wsTimer); state.wsTimer = null; }
    closeWs(state.ws); state.ws = null;
  }
  function startDetailLoop(id) {
    stopDetailLoop();
    state.detailTimer = setInterval(function () {
      fetchJson('/api/server?id=' + encodeURIComponent(id)).then(function (s) {
        state.detailServer = s;
        feedDetailCharts(s);
        updateDetailStatus(s);
      }).catch(function () { /* ignore */ });
    }, REFRESH_MS);
  }
  function stopDetailLoop() {
    if (state.detailTimer) { clearInterval(state.detailTimer); state.detailTimer = null; }
    closeWs(state.detailWs); state.detailWs = null;
  }
  function updateDetailStatus(s) {
    var badge = $('.status-badge');
    if (!badge) return;
    var online = (Date.now() - Math.max(Number(s.last_updated) || 0, Number(s.timestamp) || 0)) <= ONLINE_THRESHOLD_MS;
    badge.classList.toggle('offline', !online);
    badge.textContent = online ? '在线' : '离线';
  }

  function closeWs(ws) {
    if (!ws) return;
    try { ws.close(); } catch (e) { /* ignore */ }
  }

  function buildWsUrl(subscribe) {
    var base = apiBase().replace(/^http/, 'ws');
    var url = base + '/api/ws?subscribe=' + encodeURIComponent(subscribe);
    var token = null;
    try { token = localStorage.getItem('jwt_token'); } catch (e) { /* ignore */ }
    if (token) url += '&token=' + encodeURIComponent(token);
    return url;
  }

  function connectListWs() {
    try {
      var ws = new WebSocket(buildWsUrl('all'));
      state.ws = ws;
      ws.onopen = function () {
        ws.send(JSON.stringify({ type: 'subscribe', scope: 'all', ids: state.servers.map(function (s) { return s.id; }) }));
      };
      ws.onmessage = function (ev) {
        var msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.type !== 'batchUpdate') return;
        (msg.updates || []).forEach(function (u) {
          var srv = findServer(u.serverId);
          if (!srv) return;
          (u.samples || []).forEach(function (sm) {
            var data = sm.data || sm.payload || sm.metrics || {};
            mergeServer(srv, data);
          });
        });
        applyListData();
      };
      ws.onerror = function () { /* 回落轮询 */ };
      ws.onclose = function () { if (state.ws === ws) state.ws = null; };
    } catch (e) { /* 回落轮询 */ }
  }

  function connectDetailWs(id) {
    try {
      var ws = new WebSocket(buildWsUrl(id));
      state.detailWs = ws;
      ws.onmessage = function (ev) {
        var msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.type !== 'batchUpdate') return;
        (msg.updates || []).forEach(function (u) {
          if (u.serverId !== id) return;
          var last = null;
          (u.samples || []).forEach(function (sm) {
            var data = sm.data || sm.payload || sm.metrics || {};
            mergeServer(state.detailServer, data);
            last = data;
          });
          if (last) {
            state.detailServer.timestamp = Date.now();
            feedDetailCharts(state.detailServer);
            updateDetailStatus(state.detailServer);
          }
        });
      };
      ws.onerror = function () { /* 回落轮询 */ };
      ws.onclose = function () { if (state.detailWs === ws) state.detailWs = null; };
    } catch (e) { /* 回落轮询 */ }
  }

  function findServer(id) {
    for (var i = 0; i < state.servers.length; i++) if (state.servers[i].id === id) return state.servers[i];
    return null;
  }

  // 探针指标合并：只取有效数值字段，磁盘容量等报告级字段只在末样本出现
  function mergeServer(dst, data) {
    if (!dst || !data) return;
    Object.keys(data).forEach(function (k) {
      var v = data[k];
      if (v === undefined || v === null) return;
      if (typeof v === 'number' && isNaN(v)) return;
      dst[k] = v;
    });
  }

  function applyListData() {
    state.onlineIds = computeOnlineMap();
    renderStats();
    renderCards();
    renderTable();
    if (state.view === 'map') drawMap(state.mapCounts);
  }

  function refreshList() {
    fetchJson('/api/servers').then(function (d) {
      state.servers = (d.servers || []).slice();
      state.stats = d.stats || null;
      state.sysConfig = d.sysConfig || {};
      state.onlineIds = computeOnlineMap();
      renderFilter();
      renderStats();
      renderCards();
      renderTable();
      if (state.view === 'map') drawMap(mapCountsFromServers());
    }).catch(function () { /* 保持上一次数据 */ });
  }

  /* ── 访问量展示 ─────────────────────────────────────── */
  function bindVisitBox() {
    var box = $('#visit-box');
    if (box) box.innerHTML = '';
  }

  /* ── 路由 ───────────────────────────────────────────── */
  function route() {
    var hash = location.hash || '#/';
    var m = hash.match(/^#\/server\/(.+)$/);
    destroyDetailCharts();
    stopDetailLoop();
    if (m) {
      try {
        var saved = localStorage.getItem(STORAGE_KEY_RANGE);
        var ok = false;
        for (var i = 0; i < RANGES.length; i++) if (RANGES[i].key === saved) ok = true;
        state.detailRangeKey = ok ? saved : '24';
      } catch (e) { state.detailRangeKey = '24'; }
      renderDetail(decodeURIComponent(m[1]));
      return;
    }
    // 大盘
    applyTheme();
    renderShell();
    startListLoop();
    refreshList();
    var v = 'card';
    try { v = localStorage.getItem(STORAGE_KEY_VIEW) || 'card'; } catch (e) { /* ignore */ }
    switchView(['card', 'table', 'map'].indexOf(v) >= 0 ? v : 'card');
  }

  /* ── 启动 ───────────────────────────────────────────── */
  function boot() {
    applyTheme();
    fetchJson('/api/config').then(function (c) {
      state.config = c;
      if (c.site_title) document.title = c.site_title;
    }).catch(function () { /* ignore */ }).finally(function () {
      route();
    });
    window.addEventListener('hashchange', route);
    // 页面可见性：隐藏时断开实时、可见时恢复
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (state.wsTimer) { clearInterval(state.wsTimer); state.wsTimer = null; }
        if (state.detailTimer) { clearInterval(state.detailTimer); state.detailTimer = null; }
      } else {
        var hash = location.hash || '#/';
        if (/^#\/server\//.test(hash)) {
          var m = hash.match(/^#\/server\/(.+)$/);
          if (m) startDetailLoop(decodeURIComponent(m[1]));
        } else if (!state.wsTimer) {
          startListLoop();
          refreshList();
        }
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
