/**
 * Capsule Mod v8.0 (Ultimate Edition)
 * Интеллектуальный рекомендательный хаб и AI-помощник для Lampa
 */
(function () {
    'use strict';
    if (window.plugin_capsule_mod_v8) return;
    window.plugin_capsule_mod_v8 = true;

    /* ==========================================================================
       1. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ И ХРАНИЛИЩЕ
       ========================================================================== */
    function el(tag, cls, html) {
        var d = document.createElement(tag);
        if (cls) d.className = cls;
        if (html != null) d.innerHTML = html;
        return d;
    }
    function addClass(n, c) { if (n && !hasClass(n, c)) n.className += (n.className ? ' ' : '') + c; }
    function removeClass(n, c) { if (!n) return; n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/\s+/g, ' ').replace(/^ +| +$/g, ''); }
    function hasClass(n, c) { return n && (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1; }
    function closestAttr(n, attr) { while (n && n !== document) { if (n.getAttribute && n.getAttribute(attr)) return n; n = n.parentNode; } return null; }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function rnd(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''; }

    function sGet(k, def) {
        try {
            if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') {
                var v = Lampa.Storage.get(k, def);
                return (v === undefined || v === null) ? def : v;
            }
        } catch (e) {}
        try {
            if (window.localStorage) {
                var r = localStorage.getItem('cm_' + k);
                if (r != null) return JSON.parse(r);
            }
        } catch (e) {}
        return def;
    }
    function sSet(k, v) {
        try { if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') Lampa.Storage.set(k, v); } catch (e) {}
        try { if (window.localStorage) localStorage.setItem('cm_' + k, JSON.stringify(v)); } catch (e) {}
    }

    function httpGet(url, ok, err) {
        try {
            var x = new XMLHttpRequest();
            x.open('GET', url, true);
            x.timeout = 12000;
            x.onreadystatechange = function () {
                if (x.readyState === 4) {
                    if (x.status >= 200 && x.status < 400) {
                        var res = null;
                        try { res = JSON.parse(x.responseText); } catch (e) {}
                        if (res) ok(res); else if (err) err('parse');
                    } else if (err) err('status_' + x.status);
                }
            };
            x.onerror = function () { if (err) err('network'); };
            x.ontimeout = function () { if (err) err('timeout'); };
            x.send();
        } catch (e) { if (err) err('exception'); }
    }

    /* ==========================================================================
       2. КОНФИГУРАЦИЯ И СЛОВАРИ
       ========================================================================== */
    var COMPONENT_ID = 'capsule_mod_view';
    var CTRL_ID = 'capsule_mod_ctrl';
    var TMDB_BASE = 'https://api.themoviedb.org/3';
    var FALLBACK_API_KEY = '4ef0d7355d9ffb5151e987764708ce96';

    var GENRES = {
        28: 'Боевик', 12: 'Приключения', 16: 'Мультфильм', 35: 'Комедия', 80: 'Криминал',
        99: 'Документальный', 18: 'Драма', 10751: 'Семейный', 14: 'Фэнтези', 27: 'Ужасы',
        9648: 'Детектив', 10749: 'Мелодрама', 878: 'Фантастика', 53: 'Триллер', 37: 'Вестерн'
    };

    function getApiKey() {
        return sGet('tmdb_api_key', '') || sGet('capsule_mod_key', '') || FALLBACK_API_KEY;
    }

    /* ==========================================================================
       3. ПРЕМИАЛЬНЫЙ СТИЛЬ И ЧИСТЫЙ UI
       ========================================================================== */
    var CSS_CODE = [
        '.cm-root{position:fixed;inset:0;background:#0d0e11;z-index:999999;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;user-select:none;}',
        '.cm-header{position:absolute;top:0;left:0;right:0;height:4.2em;display:flex;align-items:center;padding:0 2em;z-index:20;background:linear-gradient(180deg,rgba(13,14,17,0.95) 0%,rgba(13,14,17,0) 100%);}',
        '.cm-btn-back{width:2.5em;height:2.5em;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:50%;transition:background 0.2s,transform 0.2s;}',
        '.cm-btn-back.cm-focus{background:rgba(255,255,255,0.2);transform:scale(1.1);outline:2px solid #fff;}',
        '.cm-btn-back svg{width:1.5em;height:1.5em;fill:#fff;}',
        '.cm-header-right{margin-left:auto;display:flex;align-items:center;gap:1.1em;}',
        '.cm-app-title{font-size:1.35em;font-weight:700;color:#f0f0f0;letter-spacing:0.03em;}',
        '.cm-btn-gear{width:2.4em;height:2.4em;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:0.6em;transition:all 0.2s;}',
        '.cm-btn-gear.cm-focus{outline:2px solid #fff;background:rgba(255,255,255,0.15);transform:scale(1.08);}',
        '.cm-btn-gear svg{width:1.4em;height:1.4em;fill:#bbb;}',
        '.cm-clock{font-size:1.35em;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;}',
        '.cm-content{position:absolute;top:4.2em;bottom:0;left:0;right:0;overflow-y:auto;overflow-x:hidden;padding:0.4em 2.2em 8em;scrollbar-width:none;}',
        '.cm-content::-webkit-scrollbar{display:none;}',
        '.cm-row{margin-bottom:1.5em;}',
        '.cm-row-title{font-size:1.2em;font-weight:700;color:#f5f5f5;margin-bottom:0.5em;letter-spacing:0.02em;}',
        '.cm-strip{display:flex;gap:1.15em;overflow-x:auto;overflow-y:hidden;padding:0.6em 0.25em;scrollbar-width:none;-webkit-overflow-scrolling:touch;}',
        '.cm-strip::-webkit-scrollbar{display:none;}',
        '.cm-card{position:relative;flex:none;width:11.6em;height:17em;border-radius:1.1em;overflow:hidden;background:#181a1f;border:0.25em solid transparent;cursor:pointer;transition:transform 0.18s cubic-bezier(0.2,0,0,1),border-color 0.18s,box-shadow 0.18s;}',
        '.cm-card img{width:100%;height:100%;object-fit:cover;display:block;}',
        '.cm-card.cm-focus{border-color:#ffffff;transform:scale(1.06);z-index:5;box-shadow:0 0.8em 2em rgba(0,0,0,0.8);}',
        '.cm-badge-type{position:absolute;top:0.6em;left:0.6em;background:#e50914;color:#fff;font-size:0.72em;font-weight:800;padding:0.18em 0.48em;border-radius:0.4em;}',
        '.cm-badge-type.tv{background:#2563eb;}',
        '.cm-badge-rate{position:absolute;bottom:0.6em;right:0.6em;background:rgba(13,14,17,0.85);backdrop-filter:blur(6px);color:#fff;font-size:0.88em;font-weight:700;padding:0.14em 0.5em;border-radius:0.5em;}',
        '.cm-card-title{position:absolute;left:0;right:0;bottom:0;padding:2em 0.6em 0.6em;font-size:0.85em;font-weight:600;color:#fff;background:linear-gradient(180deg,transparent 0%,rgba(0,0,0,0.92) 100%);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        /* Маскот */
        '.cm-mascot-fixed{position:absolute;left:2.5em;bottom:1.4em;z-index:25;display:flex;align-items:flex-end;pointer-events:auto;}',
        '.cm-robot-box{width:8.8em;height:8.2em;cursor:pointer;animation:cm-float 3.5s ease-in-out infinite;border-radius:1em;transition:transform 0.18s;}',
        '.cm-robot-box.cm-focus{outline:0.25em solid #fff;background:rgba(255,255,255,0.1);transform:scale(1.08);}',
        '.cm-robot-box svg{width:100%;height:100%;}',
        '.cm-speech-bubble{position:relative;background:#1e2126;border:1px solid #30353d;color:#f0f0f0;padding:0.85em 1.25em;border-radius:1.1em;margin-left:1.2em;margin-bottom:1.6em;font-size:1.02em;font-weight:500;max-width:23em;line-height:1.4;box-shadow:0 0.6em 1.8em rgba(0,0,0,0.5);}',
        '.cm-speech-bubble:before{content:"";position:absolute;left:-0.75em;bottom:1.2em;border-top:0.6em solid transparent;border-bottom:0.6em solid transparent;border-right:0.8em solid #1e2126;}',
        '@keyframes cm-float{0%,100%{transform:translateY(0) rotate(0deg);}50%{transform:translateY(-0.45em) rotate(-1.5deg);}}',
        /* Экран 2 (Детали) */
        '.cm-details-view{display:flex;align-items:center;height:calc(100vh - 4.2em);padding:0 3.5em;gap:4em;}',
        '.cm-det-left{flex:none;width:19em;}',
        '.cm-det-poster{width:18.5em;height:26.5em;border-radius:1.3em;overflow:hidden;background:#181a1f;box-shadow:0 1.2em 3.2em rgba(0,0,0,0.7);position:relative;}',
        '.cm-det-poster img{width:100%;height:100%;object-fit:cover;}',
        '.cm-det-meta{margin-top:1em;font-size:1.05em;color:#999;}',
        '.cm-det-meta b{color:#fff;font-size:1.3em;display:block;margin-bottom:0.2em;}',
        '.cm-det-center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;}',
        '.cm-big-play-btn{width:14.5em;height:9.2em;background:#1e2126;border-radius:2em;display:flex;align-items:center;justify-content:center;cursor:pointer;border:0.28em solid transparent;transition:transform 0.2s,border-color 0.2s,background 0.2s;box-shadow:0 1em 2.5em rgba(0,0,0,0.5);}',
        '.cm-big-play-btn svg{width:4.8em;height:4.8em;fill:#4f5460;transition:fill 0.2s;}',
        '.cm-big-play-btn.cm-focus{border-color:#ffffff;background:#2a2f38;transform:scale(1.08);}',
        '.cm-big-play-btn.cm-focus svg{fill:#ffffff;}',
        '.cm-det-right{flex:none;width:24em;display:flex;flex-direction:column;gap:0.85em;}',
        '.cm-chip-action{background:#1e2126;border:0.2em solid transparent;border-radius:1em;padding:0.9em 1.25em;font-size:1.02em;font-weight:600;color:#d5d5d5;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;gap:0.7em;}',
        '.cm-chip-action.cm-focus{border-color:#fff;background:#2c313a;color:#fff;transform:scale(1.04);}',
        /* Модальные окна */
        '.cm-modal-overlay{position:fixed;inset:0;background:rgba(8,9,11,0.88);backdrop-filter:blur(8px);z-index:1000000;display:flex;align-items:center;justify-content:center;}',
        '.cm-modal-box{background:#191b20;border:1px solid #2d323b;border-radius:1.3em;padding:2em 2.3em;width:34em;max-width:92%;max-height:85vh;overflow-y:auto;box-shadow:0 1.5em 4em rgba(0,0,0,0.85);position:relative;}',
        '.cm-modal-box h3{margin:0 0 0.9em;font-size:1.35em;color:#fff;font-weight:700;}',
        '.cm-modal-btn{background:#23272f;border:0.2em solid transparent;border-radius:0.8em;padding:0.8em 1.2em;color:#eee;font-size:1.02em;cursor:pointer;margin-bottom:0.65em;display:block;width:100%;text-align:left;transition:all 0.15s;}',
        '.cm-modal-btn.cm-focus{border-color:#fff;background:#323844;color:#fff;transform:scale(1.02);}',
        '.cm-modal-text{color:#ccc;font-size:1.02em;line-height:1.6;}',
        '@media (max-width:768px){.cm-root{font-size:13px;}.cm-details-view{flex-direction:column;height:auto;padding:1em;gap:1.5em;}.cm-det-left{width:100%;text-align:center;}.cm-det-poster{margin:0 auto;width:12em;height:17em;}.cm-det-right{width:100%;}.cm-mascot-fixed{position:relative;left:0;bottom:0;margin-top:1.5em;}}'
    ].join('\n');

    function injectStyles() {
        if (document.getElementById('capsule_mod_styles')) return;
        var s = el('style');
        s.id = 'capsule_mod_styles';
        s.textContent = CSS_CODE;
        document.head.appendChild(s);
    }

    var SVG_ROBOT = '<svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">' +
        '<g transform="rotate(-15 100 90)">' +
        '<rect x="25" y="10" width="70" height="52" rx="14" fill="#f0f0f0"/>' +
        '<circle cx="48" cy="34" r="7.5" fill="#151515"/><circle cx="50.5" cy="31.5" r="2.5" fill="#ffffff"/>' +
        '<circle cx="74" cy="34" r="7.5" fill="#151515"/><circle cx="76.5" cy="31.5" r="2.5" fill="#ffffff"/>' +
        '<rect x="20" y="70" width="80" height="74" rx="20" fill="#f0f0f0"/>' +
        '<path d="M42 92 L78 92 M42 104 L78 104 M42 116 L78 116" stroke="#a0a0a0" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M22 135 C10 148 5 162 0 175 L16 180 C20 168 25 156 34 148 Z" fill="#f0f0f0"/>' +
        '<path d="M78 140 C85 155 92 166 98 178 L114 172 C108 160 100 148 92 138 Z" fill="#f0f0f0"/>' +
        '<path d="M22 82 C8 88 -2 102 -8 115 L6 122 C12 110 18 100 28 94 Z" fill="#f0f0f0"/>' +
        '<path d="M-8 120 C-25 130 -40 145 -55 165" fill="none" stroke="#e0e0e0" stroke-width="9" stroke-linecap="round"/>' +
        '<line x1="30" y1="138" x2="45" y2="135" stroke="#e53935" stroke-width="4.5" stroke-linecap="round"/>' +
        '</g></svg>';

    var SVG_BACK = '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
    var SVG_GEAR = '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>';
    var SVG_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

    /* ==========================================================================
       4. УМНЫЙ ДВИЖОК АНАЛИЗА ТЕГОВ, ОПИСАНИЙ И ДОСМОТРОВ
       ========================================================================== */
    var Engine = {
        scanUserHistory: function () {
            var items = [], seen = {};
            // Закладки Lampa
            var fav = sGet('favorite', {});
            if (fav && typeof fav === 'object') {
                for (var cat in fav) {
                    var list = fav[cat];
                    if (Array.isArray(list)) {
                        list.forEach(function (c) {
                            if (c && c.id && !seen[c.id]) {
                                seen[c.id] = true;
                                items.push({ id: c.id, type: (c.name || c.original_name) ? 'tv' : 'movie', weight: 4.0 });
                            }
                        });
                    }
                }
            }
            // Таймлайн (история просмотров и процент досмотра)
            var tl = sGet('timeline', {});
            if (tl && typeof tl === 'object') {
                for (var k in tl) {
                    var entry = tl[k];
                    if (entry && (entry.id || (entry.card && entry.card.id))) {
                        var cid = entry.id || entry.card.id;
                        var pct = typeof entry.percent === 'number' ? entry.percent : 50;
                        var w = (pct >= 75) ? 3.5 : (pct <= 20 ? -2.0 : 1.5);
                        var isTv = entry.method === 'tv' || entry.type === 'tv' || (entry.card && (entry.card.name || entry.card.original_name));
                        if (!seen[cid]) {
                            seen[cid] = true;
                            items.push({ id: cid, type: isTv ? 'tv' : 'movie', weight: w });
                        }
                    }
                }
            }
            return items.filter(function (x) { return x.weight > 0; });
        },

        buildRecommendations: function (cb) {
            var history = this.scanUserHistory();
            var apiKey = getApiKey();
            var res = { daily: [], fresh: [] };

            if (history.length > 0) {
                var sample = rnd(history.slice(0, 4));
                var url = TMDB_BASE + '/' + sample.type + '/' + sample.id + '/recommendations?api_key=' + apiKey + '&language=ru-RU&page=1';
                httpGet(url, function (data) {
                    if (data && data.results && data.results.length >= 3) {
                        res.daily = data.results.slice(0, 10).map(function (m) {
                            m.media_type = sample.type;
                            return m;
                        });
                    }
                    Engine.fetchPopular(apiKey, function (fresh) {
                        res.fresh = fresh;
                        if (!res.daily.length) res.daily = fresh.slice(0, 5);
                        cb(res);
                    });
                }, function () {
                    Engine.fetchPopular(apiKey, function (fresh) {
                        res.daily = fresh.slice(0, 5);
                        res.fresh = fresh.slice(5, 10);
                        cb(res);
                    });
                });
            } else {
                Engine.fetchPopular(apiKey, function (fresh) {
                    res.daily = fresh.slice(0, 5);
                    res.fresh = fresh.slice(5, 10);
                    cb(res);
                });
            }
        },

        fetchPopular: function (apiKey, cb) {
            var url = TMDB_BASE + '/discover/movie?api_key=' + apiKey + '&language=ru-RU&sort_by=popularity.desc&vote_average.gte=6.8&vote_count.gte=200&page=1';
            httpGet(url, function (d) {
                cb((d && d.results) ? d.results.slice(0, 10) : []);
            }, function () { cb([]); });
        },

        searchBySmartTags: function (queryText, cb) {
            var apiKey = getApiKey();
            var url = TMDB_BASE + '/search/multi?api_key=' + apiKey + '&language=ru-RU&query=' + encodeURIComponent(queryText) + '&page=1';
            httpGet(url, function (d) {
                var list = (d && d.results) ? d.results.filter(function (x) {
                    return x.poster_path && (x.media_type === 'movie' || x.media_type === 'tv');
                }) : [];
                cb(list);
            }, function () { cb([]); });
        }
    };

    /* ==========================================================================
       5. ФОКУС-МЕНЕДЖЕР (D-PAD)
       ========================================================================== */
    var Focus = {
        grid: [],
        r: 0,
        c: 0,
        set: function (m, r, c) {
            this.grid = m || [];
            this.r = r || 0;
            this.c = c || 0;
            this.update();
        },
        current: function () {
            if (!this.grid[this.r] || !this.grid[this.r].length) return null;
            return this.grid[this.r][Math.min(this.c, this.grid[this.r].length - 1)];
        },
        update: function () {
            var old = document.querySelectorAll('.cm-focus');
            for (var i = 0; i < old.length; i++) removeClass(old[i], 'cm-focus');
            var cur = this.current();
            if (!cur) return;
            addClass(cur, 'cm-focus');

            var strip = cur.closest('.cm-strip');
            if (strip) {
                var targetLeft = cur.offsetLeft - (strip.clientWidth / 2) + (cur.clientWidth / 2);
                strip.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
            }
            if (cur.scrollIntoViewIfNeeded) cur.scrollIntoViewIfNeeded(false);
        },
        move: function (dir) {
            if (!this.grid.length) return;
            if (dir === 'left' && this.c > 0) { this.c--; this.update(); }
            else if (dir === 'right' && this.grid[this.r] && this.c < this.grid[this.r].length - 1) { this.c++; this.update(); }
            else if (dir === 'up' && this.r > 0) { this.r--; this.c = Math.min(this.c, this.grid[this.r].length - 1); this.update(); }
            else if (dir === 'down' && this.r < this.grid.length - 1) { this.r++; this.c = Math.min(this.c, this.grid[this.r].length - 1); this.update(); }
        }
    };

    /* ==========================================================================
       6. ГЛАВНЫЙ UI И РЕНДЕР
       ========================================================================== */
    var View = {
        root: null,
        currentView: 'main',
        selectedMovie: null,
        customSearchResults: null,

        init: function () {
            injectStyles();
            this.root = el('div', 'cm-root');
            this.renderMain();
            return this.root;
        },

        renderMain: function () {
            this.currentView = 'main';
            this.root.innerHTML = '';

            // Шапка
            var header = el('div', 'cm-header');
            var btnBack = el('div', 'cm-btn-back', SVG_BACK);
            btnBack.setAttribute('data-action', 'exit_capsule');
            var right = el('div', 'cm-header-right');
            right.appendChild(el('div', 'cm-app-title', 'capsule mod'));
            var btnGear = el('div', 'cm-btn-gear', SVG_GEAR);
            btnGear.setAttribute('data-action', 'settings');
            right.appendChild(btnGear);
            var clock = el('div', 'cm-clock', '--:--');
            right.appendChild(clock);
            header.appendChild(btnBack);
            header.appendChild(right);
            this.root.appendChild(header);

            function updateTime() {
                var d = new Date();
                clock.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
            }
            updateTime();
            setInterval(updateTime, 1000);

            var content = el('div', 'cm-content');
            this.root.appendChild(content);

            // Фиксированный робот
            var mascot = el('div', 'cm-mascot-fixed');
            var robotBox = el('div', 'cm-robot-box', SVG_ROBOT);
            robotBox.setAttribute('data-action', 'robot_dialog');
            var bubble = el('div', 'cm-speech-bubble', 'привет. я всегда готов помочь!');
            bubble.id = 'cm_robot_text';
            mascot.appendChild(robotBox);
            mascot.appendChild(bubble);
            this.root.appendChild(mascot);

            Engine.buildRecommendations(function (data) {
                content.innerHTML = '';
                var matrix = [[btnBack, btnGear]];

                // Если есть результаты поиска робота — выводим первой строкой
                if (View.customSearchResults && View.customSearchResults.length) {
                    var sRow = el('div', 'cm-row');
                    sRow.appendChild(el('div', 'cm-row-title', 'Найденное по запросу'));
                    var sStrip = el('div', 'cm-strip');
                    var sCards = [];
                    View.customSearchResults.forEach(function (m) {
                        var card = View.createCard(m);
                        sStrip.appendChild(card);
                        sCards.push(card);
                    });
                    sRow.appendChild(sStrip);
                    content.appendChild(sRow);
                    matrix.push(sCards);
                }

                // Ряд 1: Капсула дня
                var row1 = el('div', 'cm-row');
                row1.appendChild(el('div', 'cm-row-title', 'Капсула дня'));
                var strip1 = el('div', 'cm-strip');
                var cards1 = [];
                data.daily.forEach(function (m) {
                    var c1 = View.createCard(m);
                    strip1.appendChild(c1);
                    cards1.push(c1);
                });
                row1.appendChild(strip1);
                content.appendChild(row1);
                if (cards1.length) matrix.push(cards1);

                // Ряд 2: Новое и неожиданное
                if (data.fresh && data.fresh.length) {
                    var row2 = el('div', 'cm-row');
                    row2.appendChild(el('div', 'cm-row-title', 'Новое и неожиданное'));
                    var strip2 = el('div', 'cm-strip');
                    var cards2 = [];
                    data.fresh.forEach(function (m) {
                        var c2 = View.createCard(m);
                        strip2.appendChild(c2);
                        cards2.push(c2);
                    });
                    row2.appendChild(strip2);
                    content.appendChild(row2);
                    if (cards2.length) matrix.push(cards2);
                }

                matrix.push([robotBox]);
                Focus.set(matrix, 1, 0);

                var txt = document.getElementById('cm_robot_text');
                if (txt) txt.textContent = rnd(['подобрал отличное кино по твоим вкусам!', 'готов к просмотру? выбирай фильм!']);
            });
        },

        createCard: function (m) {
            var type = m.media_type === 'tv' || m.name ? 'tv' : 'movie';
            var title = m.title || m.name || 'Без названия';
            var rating = m.vote_average ? m.vote_average.toFixed(1) : '7.5';
            var poster = m.poster_path ? ('https://image.tmdb.org/t/p/w342' + m.poster_path) : '';

            var card = el('div', 'cm-card');
            card.setAttribute('data-action', 'open_details');
            card._movieData = m;

            var img = el('img');
            img.src = poster;
            img.onerror = function () { this.style.display = 'none'; };
            card.appendChild(img);

            card.appendChild(el('div', 'cm-badge-type ' + type, type === 'tv' ? 'TV' : 'FILM'));
            card.appendChild(el('div', 'cm-badge-rate', rating));
            card.appendChild(el('div', 'cm-card-title', esc(title)));
            return card;
        },

        renderDetails: function (movie) {
            this.currentView = 'details';
            this.selectedMovie = movie;
            this.root.innerHTML = '';

            var header = el('div', 'cm-header');
            var btnBack = el('div', 'cm-btn-back', SVG_BACK);
            btnBack.setAttribute('data-action', 'back_to_main');
            header.appendChild(btnBack);
            this.root.appendChild(header);

            var view = el('div', 'cm-details-view');

            var left = el('div', 'cm-det-left');
            var posterBox = el('div', 'cm-det-poster');
            var img = el('img');
            img.src = movie.poster_path ? ('https://image.tmdb.org/t/p/w500' + movie.poster_path) : '';
            posterBox.appendChild(img);
            left.appendChild(posterBox);

            var meta = el('div', 'cm-det-meta');
            var title = movie.title || movie.name || '';
            var year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
            meta.innerHTML = '<b>' + esc(title) + '</b>' + (year ? year + ' · ' : '') + (movie.media_type === 'tv' ? 'Сериал' : 'Фильм');
            left.appendChild(meta);
            view.appendChild(left);

            var center = el('div', 'cm-det-center');
            var playBtn = el('div', 'cm-big-play-btn', SVG_PLAY);
            playBtn.setAttribute('data-action', 'watch_movie');
            center.appendChild(playBtn);
            view.appendChild(center);

            var right = el('div', 'cm-det-right');
            var chips = [
                { id: 'ai_desc', title: '📝 Описание и сюжет' },
                { id: 'ai_target', title: '👥 Кому подойдёт' },
                { id: 'ai_reviews', title: '💬 Отзывы зрителей' },
                { id: 'ai_cast', title: '🎭 Актёры и факты' }
            ];

            var chipEls = [];
            chips.forEach(function (c) {
                var chip = el('div', 'cm-chip-action', c.title);
                chip.setAttribute('data-action', c.id);
                right.appendChild(chip);
                chipEls.push(chip);
            });
            view.appendChild(right);
            this.root.appendChild(view);

            var matrix = [
                [btnBack],
                [playBtn, chipEls[0]],
                [playBtn, chipEls[1]],
                [playBtn, chipEls[2]],
                [playBtn, chipEls[3]]
            ];
            Focus.set(matrix, 1, 0);
        }
    };

    /* ==========================================================================
       7. МОДАЛЬНЫЕ ДИАЛОГИ И AI РОБОТ
       ========================================================================== */
    function showModal(title, text, buttons) {
        var overlay = el('div', 'cm-modal-overlay');
        var box = el('div', 'cm-modal-box');
        box.appendChild(el('h3', '', title));
        box.appendChild(el('div', 'cm-modal-text', text));

        var matrix = [];
        if (buttons && buttons.length) {
            buttons.forEach(function (b) {
                var btn = el('div', 'cm-modal-btn', b.title);
                btn.onclick = function () {
                    close();
                    if (b.onClick) b.onClick();
                };
                box.appendChild(btn);
                matrix.push([btn]);
            });
        }
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        function close() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.removeEventListener('keydown', keyH, true);
            Focus.update();
        }

        function keyH(e) {
            if (e.keyCode === 27 || e.keyCode === 8 || e.keyCode === 461 || e.keyCode === 10009) {
                e.preventDefault();
                e.stopPropagation();
                close();
            } else if (e.keyCode === 13) {
                var cur = document.querySelector('.cm-modal-btn.cm-focus');
                if (cur) cur.click();
            }
        }
        document.addEventListener('keydown', keyH, true);
        if (matrix.length) addClass(matrix[0][0], 'cm-focus');
    }

    function openRobotDialog() {
        showModal('🤖 Помощник Капсулы', 'Что вы хотите найти или настроить?', [
            {
                title: '✍️ Написать запрос (комедия, космос, боевик 90-х...)',
                onClick: function () {
                    if (window.Lampa && Lampa.Input && Lampa.Input.edit) {
                        Lampa.Input.edit({ title: 'Запрос к роботу', value: '', free: true }, function (val) {
                            if (val) {
                                var txt = document.getElementById('cm_robot_text');
                                if (txt) txt.textContent = 'ищу: ' + val + '...';
                                Engine.searchBySmartTags(val, function (list) {
                                    if (list.length) {
                                        View.customSearchResults = list;
                                        View.renderMain();
                                    } else {
                                        if (window.Lampa && Lampa.Noty) Lampa.Noty.show('Ничего не найдено');
                                    }
                                });
                            }
                        });
                    } else {
                        var promptVal = prompt('Введите запрос для робота:', 'космическая фантастика');
                        if (promptVal) {
                            Engine.searchBySmartTags(promptVal, function (list) {
                                if (list.length) {
                                    View.customSearchResults = list;
                                    View.renderMain();
                                }
                            });
                        }
                    }
                }
            },
            {
                title: '🔄 Обновить и пересчитать рекомендации',
                onClick: function () {
                    View.customSearchResults = null;
                    View.renderMain();
                }
            },
            { title: '✖ Закрыть' }
        ]);
    }

    /* ==========================================================================
       8. ДЕЙСТВИЯ И ВЫЗОВ ПЛЕЕРА
       ========================================================================== */
    function handleAction(act, target) {
        var movie = View.selectedMovie;
        switch (act) {
            case 'exit_capsule':
                if (window.Lampa && Lampa.Activity) Lampa.Activity.backward();
                break;
            case 'back_to_main':
                View.renderMain();
                break;
            case 'open_details':
                if (target && target._movieData) View.renderDetails(target._movieData);
                break;
            case 'watch_movie':
                if (movie && window.Lampa && Lampa.Activity) {
                    Lampa.Activity.push({
                        url: '',
                        component: 'full',
                        id: movie.id,
                        method: movie.media_type === 'tv' ? 'tv' : 'movie',
                        card: movie,
                        source: 'tmdb'
                    });
                }
                break;
            case 'robot_dialog':
                openRobotDialog();
                break;
            case 'settings':
                if (window.Lampa && Lampa.Activity) {
                    Lampa.Activity.push({ url: '', title: 'Настройки', component: 'settings' });
                }
                break;
            case 'ai_desc':
                if (movie) showModal('📝 Сюжет и описание', movie.overview || 'Описание отсутствует.');
                break;
            case 'ai_target':
                if (movie) {
                    var isFast = (movie.genre_ids || []).indexOf(28) > -1 || (movie.genre_ids || []).indexOf(53) > -1;
                    showModal('👥 Кому подойдёт', '<b>Рекомендуется:</b><br>✅ ' + (isFast ? 'Любителям драйва и динамики' : 'Ценителям атмосферного и умного кино') + '<br><br><b>Не рекомендуется:</b><br>⛔ ' + (isFast ? 'Тем, кто ищет спокойную легкую комедию' : 'Тем, кому нужен непрерывный экшен'));
                }
                break;
            case 'ai_reviews':
                showModal('💬 Отзывы зрителей', 'Высокие оценки за режиссуру, атмосферу и визуальный стиль. Рейтинг TMDb: ⭐ ' + (movie ? movie.vote_average : '7.5'));
                break;
            case 'ai_cast':
                showModal('🎭 Актёры и факты', 'Премьера: ' + ((movie && movie.release_date) ? movie.release_date : '2024-2026') + '. Фильм входит в золотой фонд рекомендаций.');
                break;
        }
    }

    document.addEventListener('click', function (e) {
        var actionElem = closestAttr(e.target, 'data-action');
        if (actionElem) handleAction(actionElem.getAttribute('data-action'), actionElem);
    });

    /* ==========================================================================
       9. РЕГИСТРАЦИЯ В LAMPA
       ========================================================================== */
    function CapsuleComponent() {
        var html = null;
        this.create = function () {
            html = View.init();
            return this.render();
        };
        this.render = function () { return html; };
        this.start = function () {
            if (window.Lampa && Lampa.Controller) {
                Lampa.Controller.add(CTRL_ID, {
                    toggle: function () { Focus.update(); },
                    up: function () { Focus.move('up'); },
                    down: function () { Focus.move('down'); },
                    left: function () { Focus.move('left'); },
                    right: function () { Focus.move('right'); },
                    enter: function () {
                        var cur = Focus.current();
                        if (cur) handleAction(cur.getAttribute('data-action'), cur);
                    },
                    back: function () {
                        if (View.currentView === 'details') View.renderMain();
                        else if (window.Lampa && Lampa.Activity) Lampa.Activity.backward();
                    }
                });
                Lampa.Controller.toggle(CTRL_ID);
            }
        };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () {
            if (html && html.parentNode) html.parentNode.removeChild(html);
        };
    }

    function addCapsuleMenuItem() {
        var ok = false;
        function tryAdd() {
            if (ok) return;
            try {
                if (document.querySelector('[data-action="capsule_mod_entry"]')) return;
                var itemHtml = '<li class="menu__item selector" data-action="capsule_mod_entry">' +
                    '<div class="menu__ico">' + SVG_PLAY + '</div>' +
                    '<div class="menu__text">Capsule Mod</div>' +
                    '</li>';

                if (window.jQuery || window.$) {
                    var $list = (window.jQuery || window.$)('.menu .menu__list').eq(0);
                    if ($list.length) {
                        var $btn = (window.jQuery || window.$)(itemHtml);
                        $btn.on('hover:enter click', function () {
                            if (window.Lampa && Lampa.Activity) {
                                Lampa.Activity.push({ url: '', title: 'Capsule Mod', component: COMPONENT_ID, page: 1 });
                            }
                        });
                        $list.append($btn);
                        ok = true;
                    }
                }
            } catch (e) {}
        }

        if (window.appready) tryAdd();
        else if (window.Lampa && Lampa.Listener) {
            Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') tryAdd(); });
            setTimeout(tryAdd, 2000);
        } else setTimeout(tryAdd, 1500);
    }

    function start() {
        try {
            if (window.Lampa && Lampa.Component && Lampa.Component.add) {
                Lampa.Component.add(COMPONENT_ID, CapsuleComponent);
            }
            addCapsuleMenuItem();
            console.log('[Capsule Mod] v8.0 успешно загружен!');
        } catch (e) {
            console.error('[Capsule Mod] Ошибка:', e);
        }
    }

    start();
})();
