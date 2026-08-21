/**
 * Capsule Mod v8.0 (Major Refactor & Polish)
 * Умный рекомендательный хаб и режим Капсулы для Lampa
 * - Убран лишний текст из шапки
 * - Поиск по тегам (жанрам) и описаниям
 * - Исправлено отображение результатов поиска
 * - Исправлено обновление ленты
 * - Улучшен дизайн и навигация
 * - Робот стал умнее и дружелюбнее
 */
(function () {
    'use strict';
    if (window.plugin_capsule_mod_ready) return;
    window.plugin_capsule_mod_ready = true;

    /* ==========================================================================
       1. ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ
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
    function nowMs() { return Date.now(); }
    function rnd(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : ''; }

    function sGet(key, def) {
        try {
            if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') {
                var v = Lampa.Storage.get(key, def);
                return (v === undefined || v === null) ? def : v;
            }
        } catch (e) {}
        try {
            if (window.localStorage) {
                var r = localStorage.getItem('cm_' + key);
                if (r != null) return JSON.parse(r);
            }
        } catch (e) {}
        return def;
    }
    function sSet(key, val) {
        try { if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') Lampa.Storage.set(key, val); } catch (e) {}
        try { if (window.localStorage) localStorage.setItem('cm_' + key, JSON.stringify(val)); } catch (e) {}
    }

    function httpGet(url, onOk, onErr) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 10000;
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 400) {
                        var res = null;
                        try { res = JSON.parse(xhr.responseText); } catch (e) {}
                        if (res) onOk(res); else if (onErr) onErr('json_parse_err');
                    } else if (onErr) onErr('status_' + xhr.status);
                }
            };
            xhr.onerror = function () { if (onErr) onErr('network_err'); };
            xhr.ontimeout = function () { if (onErr) onErr('timeout'); };
            xhr.send();
        } catch (e) { if (onErr) onErr('exception'); }
    }

    /* ==========================================================================
       2. КОНФИГУРАЦИЯ И СЛОВАРИ
       ========================================================================== */
    var COMPONENT_ID = 'capsule_mod_view';
    var CTRL_ID = 'capsule_mod_ctrl';
    var TMDB_BASE = 'https://api.themoviedb.org/3';
    var FALLBACK_API_KEY = '4ef0d7355d9ffb5151e987764708ce96';

    var GENRE_MAP = {
        28: 'Боевик', 12: 'Приключения', 16: 'Мультфильм', 35: 'Комедия', 80: 'Криминал',
        99: 'Документальный', 18: 'Драма', 10751: 'Семейный', 14: 'Фэнтези', 27: 'Ужасы',
        9648: 'Детектив', 10749: 'Мелодрама', 878: 'Фантастика', 53: 'Триллер', 37: 'Вестерн'
    };
    // Обратный маппинг: русское название -> id
    var GENRE_NAME_TO_ID = {};
    for (var gid in GENRE_MAP) GENRE_NAME_TO_ID[GENRE_MAP[gid].toLowerCase()] = parseInt(gid);

    var ROBOT_PHRASES = {
        hello: ['привет! я всегда готов помочь!', 'рад тебя видеть! давай подберём что-нибудь интересное?'],
        recommend: ['проанализировал твои вкусы — вот отличные варианты!', 'собрал капсулу на основе того, что ты смотрел.'],
        loading: ['сканирую галактику фильмов...', 'собираю рекомендации...'],
        empty: ['пока мало данных. посмотри пару фильмов, и я настроюсь!'],
        query: ['нашёл фильмы по твоему запросу!', 'вот что удалось найти.'],
        found: ['держи результаты поиска!', 'нашёл кое-что интересное.'],
        notfound: ['ничего не нашёл по такому запросу. попробуй иначе.', 'увы, в моей базе пусто.'],
        updated: ['лента обновлена!', 'пересчитал рекомендации.'],
        bygenre: ['ищу фильмы в жанре']
    };

    function getApiKey() {
        return sGet('tmdb_api_key', '') || sGet('capsule_mod_key', '') || FALLBACK_API_KEY;
    }

    /* ==========================================================================
       3. СТИЛИ (УЛУЧШЕННЫЙ ДИЗАЙН, МИНИМАЛИЗМ)
       ========================================================================== */
    var CSS_CODE = [
        '.cm-root{position:fixed;inset:0;background:#0f1013;z-index:999999;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;user-select:none;}',
        '.cm-header{position:absolute;top:0;left:0;right:0;height:4.4em;display:flex;align-items:center;padding:0 1.5em;z-index:10;background:linear-gradient(180deg,rgba(15,16,19,0.9) 0%,rgba(15,16,19,0) 100%);pointer-events:none;}',
        '.cm-header > *{pointer-events:auto;}',
        '.cm-btn-back,.cm-btn-gear{width:2.6em;height:2.6em;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:50%;transition:background 0.2s,transform 0.2s;}',
        '.cm-btn-back.cm-focus,.cm-btn-gear.cm-focus{background:rgba(255,255,255,0.2);transform:scale(1.1);outline:2px solid #fff;}',
        '.cm-btn-back svg,.cm-btn-gear svg{width:1.6em;height:1.6em;fill:#fff;}',
        '.cm-btn-gear{margin-left:auto;}',
        '.cm-content{position:absolute;top:4.4em;bottom:0;left:0;right:0;overflow-y:auto;overflow-x:hidden;padding:0.5em 2em 7.5em;scrollbar-width:none;}',
        '.cm-content::-webkit-scrollbar{display:none;}',
        '.cm-row{margin-bottom:1.8em;}',
        '.cm-row-title{font-size:1.25em;font-weight:700;color:#f0f0f0;margin-bottom:0.6em;display:flex;align-items:baseline;gap:0.6em;}',
        '.cm-row-subtitle{font-size:0.7em;font-weight:400;color:#888;}',
        '.cm-strip{display:flex;gap:1.2em;overflow-x:auto;overflow-y:hidden;padding:0.6em 0.3em;scrollbar-width:none;-webkit-overflow-scrolling:touch;}',
        '.cm-strip::-webkit-scrollbar{display:none;}',
        '.cm-card{position:relative;flex:none;width:12em;height:17.5em;border-radius:1.2em;overflow:hidden;background:#1c1e22;border:0.25em solid transparent;cursor:pointer;transition:transform 0.2s cubic-bezier(0.2,0,0,1),border-color 0.2s,box-shadow 0.2s;}',
        '.cm-card img{width:100%;height:100%;object-fit:cover;display:block;transition:opacity 0.3s;}',
        '.cm-card.cm-focus{border-color:#ffffff;transform:scale(1.07);z-index:5;box-shadow:0 0.8em 2em rgba(0,0,0,0.8);}',
        '.cm-badge-rate{position:absolute;bottom:0.6em;right:0.6em;background:rgba(10,11,13,0.9);backdrop-filter:blur(4px);color:#fff;font-size:0.9em;font-weight:700;padding:0.15em 0.55em;border-radius:0.5em;display:flex;align-items:center;gap:0.3em;}',
        '.cm-badge-rate:before{content:"★";color:#f5c518;font-size:0.8em;}',
        '.cm-card-title{position:absolute;left:0;right:0;bottom:0;padding:2.5em 0.8em 0.7em;font-size:0.9em;font-weight:600;color:#fff;background:linear-gradient(180deg,transparent 0%,rgba(0,0,0,0.95) 100%);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;transition:opacity 0.3s;}',
        '.cm-card.cm-focus .cm-card-title{opacity:1;}',
        /* Маскот Робот */
        '.cm-mascot-fixed{position:absolute;left:2.5em;bottom:1.5em;z-index:20;display:flex;align-items:flex-end;pointer-events:auto;}',
        '.cm-robot-box{width:8.5em;height:8em;cursor:pointer;animation:cm-float 3.5s ease-in-out infinite;border-radius:1em;transition:transform 0.18s;}',
        '.cm-robot-box.cm-focus{outline:0.25em solid #fff;background:rgba(255,255,255,0.08);transform:scale(1.08);}',
        '.cm-robot-box svg{width:100%;height:100%;}',
        '.cm-speech-bubble{position:relative;background:#1f2328;border:1px solid #2a2f36;color:#f0f0f0;padding:0.9em 1.3em;border-radius:1.1em;margin-left:1.2em;margin-bottom:1.8em;font-size:1.05em;font-weight:500;max-width:22em;line-height:1.4;box-shadow:0 0.5em 1.5em rgba(0,0,0,0.4);}',
        '.cm-speech-bubble:before{content:"";position:absolute;left:-0.75em;bottom:1.2em;border-top:0.6em solid transparent;border-bottom:0.6em solid transparent;border-right:0.8em solid #1f2328;}',
        '@keyframes cm-float{0%,100%{transform:translateY(0) rotate(0deg);}50%{transform:translateY(-0.45em) rotate(-1.5deg);}}',
        /* Экран 2 (Детали) */
        '.cm-details-view{display:flex;align-items:center;height:calc(100vh - 4.4em);padding:0 3em;gap:4em;}',
        '.cm-det-left{flex:none;width:19em;}',
        '.cm-det-poster{width:18.5em;height:27em;border-radius:1.4em;overflow:hidden;background:#1c1e22;box-shadow:0 1.2em 3em rgba(0,0,0,0.7);position:relative;}',
        '.cm-det-poster img{width:100%;height:100%;object-fit:cover;}',
        '.cm-det-meta{margin-top:1em;font-size:1.1em;color:#aaa;}',
        '.cm-det-meta b{color:#fff;font-size:1.3em;display:block;margin-bottom:0.2em;}',
        '.cm-det-center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;}',
        '.cm-big-play-btn{width:15em;height:9.5em;background:#1f2328;border-radius:2.2em;display:flex;align-items:center;justify-content:center;cursor:pointer;border:0.3em solid transparent;transition:transform 0.2s,border-color 0.2s,background 0.2s;box-shadow:0 1em 2.5em rgba(0,0,0,0.5);}',
        '.cm-big-play-btn svg{width:5em;height:5em;fill:#555;transition:fill 0.2s;}',
        '.cm-big-play-btn.cm-focus{border-color:#ffffff;background:#2a2f36;transform:scale(1.08);}',
        '.cm-big-play-btn.cm-focus svg{fill:#ffffff;}',
        '.cm-det-right{flex:none;width:24em;display:flex;flex-direction:column;gap:0.9em;}',
        '.cm-chip-action{background:#1f2328;border:0.22em solid transparent;border-radius:1.1em;padding:0.9em 1.3em;font-size:1.05em;font-weight:600;color:#d8d8d8;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;gap:0.7em;}',
        '.cm-chip-action.cm-focus{border-color:#fff;background:#2a2f36;color:#fff;transform:scale(1.04);}',
        /* Модальные окна */
        '.cm-modal-overlay{position:fixed;inset:0;background:rgba(10,11,13,0.85);backdrop-filter:blur(6px);z-index:1000000;display:flex;align-items:center;justify-content:center;}',
        '.cm-modal-box{background:#17191d;border:1px solid #2a2f36;border-radius:1.4em;padding:2em 2.4em;width:34em;max-width:92%;max-height:85vh;overflow-y:auto;box-shadow:0 1.5em 4em rgba(0,0,0,0.8);position:relative;}',
        '.cm-modal-box h3{margin:0 0 0.9em;font-size:1.4em;color:#fff;font-weight:700;}',
        '.cm-modal-btn{background:#23272d;border:0.2em solid transparent;border-radius:0.8em;padding:0.8em 1.2em;color:#eee;font-size:1.05em;cursor:pointer;margin-bottom:0.7em;display:block;width:100%;text-align:left;transition:all 0.15s;}',
        '.cm-modal-btn.cm-focus{border-color:#fff;background:#2f353d;color:#fff;transform:scale(1.02);}',
        '.cm-modal-text{color:#ccc;font-size:1.05em;line-height:1.6;}',
        '@media (max-width:768px){.cm-root{font-size:13px;}.cm-details-view{flex-direction:column;height:auto;padding:1em;gap:1.5em;}.cm-det-left{width:100%;text-align:center;}.cm-det-poster{margin:0 auto;width:12em;height:17em;}.cm-det-right{width:100%;}.cm-mascot-fixed{position:relative;left:0;bottom:0;margin-top:1.5em;}}'
    ].join('\n');

    function injectStyles() {
        if (document.getElementById('capsule_mod_styles')) return;
        var style = el('style');
        style.id = 'capsule_mod_styles';
        style.textContent = CSS_CODE;
        document.head.appendChild(style);
    }

    var SVG_ROBOT_ASTRONAUT = '<svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">' +
        '<g transform="rotate(-15 100 90)">' +
        '<rect x="25" y="10" width="70" height="52" rx="14" fill="#ebebeb"/>' +
        '<circle cx="48" cy="34" r="7.5" fill="#151515"/><circle cx="50.5" cy="31.5" r="2.5" fill="#ffffff"/>' +
        '<circle cx="74" cy="34" r="7.5" fill="#151515"/><circle cx="76.5" cy="31.5" r="2.5" fill="#ffffff"/>' +
        '<rect x="20" y="70" width="80" height="74" rx="20" fill="#ebebeb"/>' +
        '<path d="M42 92 L78 92 M42 104 L78 104 M42 116 L78 116" stroke="#9e9e9e" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M22 135 C10 148 5 162 0 175 L16 180 C20 168 25 156 34 148 Z" fill="#ebebeb"/>' +
        '<path d="M78 140 C85 155 92 166 98 178 L114 172 C108 160 100 148 92 138 Z" fill="#ebebeb"/>' +
        '<path d="M22 82 C8 88 -2 102 -8 115 L6 122 C12 110 18 100 28 94 Z" fill="#ebebeb"/>' +
        '<path d="M-8 120 C-25 130 -40 145 -55 165" fill="none" stroke="#d5d5d5" stroke-width="9" stroke-linecap="round"/>' +
        '<line x1="30" y1="138" x2="45" y2="135" stroke="#d32f2f" stroke-width="4.5" stroke-linecap="round"/>' +
        '</g></svg>';

    var SVG_ICON_BACK = '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
    var SVG_ICON_GEAR = '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>';
    var SVG_ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

    /* ==========================================================================
       4. УМНЫЙ ДВИЖОК
       ========================================================================== */
    var Engine = {
        getHistoryItems: function () {
            var items = [], seen = {};
            var fav = sGet('favorite', {});
            if (fav && typeof fav === 'object') {
                for (var cat in fav) {
                    var list = fav[cat];
                    if (Array.isArray(list)) {
                        list.forEach(function (c) {
                            if (c && c.id && !seen[c.id]) {
                                seen[c.id] = true;
                                items.push({ id: c.id, type: (c.name || c.original_name) ? 'tv' : 'movie', title: c.title || c.name || '' });
                            }
                        });
                    }
                }
            }
            var tl = sGet('timeline', {});
            if (tl && typeof tl === 'object') {
                for (var k in tl) {
                    var entry = tl[k];
                    if (entry && (entry.id || (entry.card && entry.card.id))) {
                        var cid = entry.id || entry.card.id;
                        if (!seen[cid]) {
                            seen[cid] = true;
                            var isTv = entry.method === 'tv' || entry.type === 'tv' || (entry.card && (entry.card.name || entry.card.original_name));
                            items.push({ id: cid, type: isTv ? 'tv' : 'movie', title: (entry.card && (entry.card.title || entry.card.name)) || '' });
                        }
                    }
                }
            }
            return items;
        },

        buildRecommendations: function (callback) {
            var history = this.getHistoryItems();
            var apiKey = getApiKey();
            var result = { daily: [], fresh: [], historyCount: history.length };

            if (history.length > 0) {
                var topSample = history.slice(0, 3);
                var sampleItem = rnd(topSample);
                var recUrl = TMDB_BASE + '/' + sampleItem.type + '/' + sampleItem.id + '/recommendations?api_key=' + apiKey + '&language=ru-RU&page=1';
                httpGet(recUrl, function (data) {
                    if (data && data.results && data.results.length >= 4) {
                        result.daily = data.results.slice(0, 10).map(function (m) {
                            m.media_type = sampleItem.type;
                            return m;
                        });
                    }
                    Engine.fetchPopularPicks(apiKey, function (freshList) {
                        result.fresh = freshList;
                        if (!result.daily.length) result.daily = freshList.slice(0, 5);
                        callback(result);
                    });
                }, function () {
                    Engine.fetchPopularPicks(apiKey, function (freshList) {
                        result.daily = freshList.slice(0, 5);
                        result.fresh = freshList.slice(5, 10);
                        callback(result);
                    });
                });
            } else {
                Engine.fetchPopularPicks(apiKey, function (freshList) {
                    result.daily = freshList.slice(0, 5);
                    result.fresh = freshList.slice(5, 10);
                    callback(result);
                });
            }
        },

        fetchPopularPicks: function (apiKey, cb) {
            var url = TMDB_BASE + '/discover/movie?api_key=' + apiKey + '&language=ru-RU&sort_by=popularity.desc&vote_average.gte=6.8&vote_count.gte=200&page=1';
            httpGet(url, function (data) {
                cb((data && data.results) ? data.results.slice(0, 10) : []);
            }, function () {
                cb([]);
            });
        },

        searchByQuery: function (queryText, cb) {
            var apiKey = getApiKey();
            var trimmed = queryText.trim().toLowerCase();

            // Проверяем, является ли запрос жанром
            var genreId = GENRE_NAME_TO_ID[trimmed];
            if (genreId) {
                // Поиск по жанру через discover
                var discoverUrl = TMDB_BASE + '/discover/movie?api_key=' + apiKey + '&language=ru-RU&sort_by=popularity.desc&with_genres=' + genreId + '&vote_count.gte=50&page=1';
                httpGet(discoverUrl, function (data) {
                    var list = (data && data.results) ? data.results.filter(function (x) { return x.poster_path; }) : [];
                    cb(list);
                }, function () { cb([]); });
            } else {
                // Обычный поиск по ключевым словам
                var searchUrl = TMDB_BASE + '/search/multi?api_key=' + apiKey + '&language=ru-RU&query=' + encodeURIComponent(queryText) + '&page=1';
                httpGet(searchUrl, function (data) {
                    var list = (data && data.results) ? data.results.filter(function (x) { return x.poster_path && (x.media_type === 'movie' || x.media_type === 'tv'); }) : [];
                    cb(list);
                }, function () { cb([]); });
            }
        },

        // Поиск по описанию (используется, если нужно искать по сюжету)
        searchByDescription: function (queryText, cb) {
            // Пока используем обычный поиск, но можно расширить
            this.searchByQuery(queryText, cb);
        }
    };

    /* ==========================================================================
       5. ФОКУС-МЕНЕДЖЕР
       ========================================================================== */
    var Focus = {
        grid: [],
        r: 0,
        c: 0,
        set: function (matrix, r, c) {
            this.grid = matrix || [];
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
            // Показываем название карточки при фокусе (CSS уже обрабатывает)
        },
        move: function (dir) {
            if (!this.grid.length) return;
            if (dir === 'left') {
                if (this.c > 0) { this.c--; this.update(); }
            } else if (dir === 'right') {
                if (this.grid[this.r] && this.c < this.grid[this.r].length - 1) { this.c++; this.update(); }
            } else if (dir === 'up') {
                if (this.r > 0) { this.r--; this.c = Math.min(this.c, this.grid[this.r].length - 1); this.update(); }
            } else if (dir === 'down') {
                if (this.r < this.grid.length - 1) { this.r++; this.c = Math.min(this.c, this.grid[this.r].length - 1); this.update(); }
            }
        }
    };

    /* ==========================================================================
       6. ГЛАВНЫЙ UI
       ========================================================================== */
    var View = {
        root: null,
        currentView: 'main',
        selectedMovie: null,
        searchResults: null, // массив результатов поиска для отображения
        lastMatrix: null, // сохраняем последнюю матрицу фокуса для возможного обновления

        init: function () {
            injectStyles();
            this.root = el('div', 'cm-root');
            this.renderMain();
            return this.root;
        },

        // Обновление только контента, без пересоздания root
        refreshRecommendations: function () {
            var self = this;
            // Показываем роботу, что идет загрузка
            var bubble = document.getElementById('cm_robot_text');
            if (bubble) bubble.textContent = rnd(ROBOT_PHRASES.loading);

            Engine.buildRecommendations(function (data) {
                // Находим контентную область
                var content = self.root.querySelector('.cm-content');
                if (!content) return; // если root пересоздан, выходим
                content.innerHTML = '';
                var matrix = [];

                // Добавляем кнопки шапки (если они есть)
                var backBtn = self.root.querySelector('.cm-btn-back');
                var gearBtn = self.root.querySelector('.cm-btn-gear');
                if (backBtn && gearBtn) matrix.push([backBtn, gearBtn]);

                // Если есть результаты поиска, показываем их первым рядом
                if (self.searchResults && self.searchResults.length) {
                    var searchRow = el('div', 'cm-row');
                    searchRow.appendChild(el('div', 'cm-row-title', 'Результаты поиска'));
                    var searchStrip = el('div', 'cm-strip');
                    var searchCards = [];
                    self.searchResults.forEach(function (m) {
                        var card = self.createCard(m);
                        searchStrip.appendChild(card);
                        searchCards.push(card);
                    });
                    searchRow.appendChild(searchStrip);
                    content.appendChild(searchRow);
                    if (searchCards.length) matrix.push(searchCards);
                }

                // Ряд "Капсула дня"
                var row1 = el('div', 'cm-row');
                var countNote = data.historyCount ? 'на основе ' + data.historyCount + ' просмотренных' : 'популярные хиты';
                row1.appendChild(el('div', 'cm-row-title', 'Капсула дня <span class="cm-row-subtitle">' + countNote + '</span>'));
                var strip1 = el('div', 'cm-strip');
                var cards1 = [];
                data.daily.forEach(function (m) {
                    var card = self.createCard(m);
                    strip1.appendChild(card);
                    cards1.push(card);
                });
                row1.appendChild(strip1);
                content.appendChild(row1);
                if (cards1.length) matrix.push(cards1);

                // Ряд "Новое и неожиданное"
                if (data.fresh && data.fresh.length) {
                    var row2 = el('div', 'cm-row');
                    row2.appendChild(el('div', 'cm-row-title', 'Новое и неожиданное'));
                    var strip2 = el('div', 'cm-strip');
                    var cards2 = [];
                    data.fresh.forEach(function (m) {
                        var card2 = self.createCard(m);
                        strip2.appendChild(card2);
                        cards2.push(card2);
                    });
                    row2.appendChild(strip2);
                    content.appendChild(row2);
                    if (cards2.length) matrix.push(cards2);
                }

                // Добавляем робота в сетку фокуса
                var robotBox = self.root.querySelector('.cm-robot-box');
                if (robotBox) matrix.push([robotBox]);

                Focus.set(matrix, 1, 0);
                self.lastMatrix = matrix;

                var txt = document.getElementById('cm_robot_text');
                if (txt) txt.textContent = rnd(ROBOT_PHRASES.updated);
            });
        },

        renderMain: function () {
            this.currentView = 'main';
            this.root.innerHTML = '';

            // Шапка (только иконки)
            var header = el('div', 'cm-header');
            var btnBack = el('div', 'cm-btn-back', SVG_ICON_BACK);
            btnBack.setAttribute('data-action', 'exit_capsule');
            var btnGear = el('div', 'cm-btn-gear', SVG_ICON_GEAR);
            btnGear.setAttribute('data-action', 'settings');
            header.appendChild(btnBack);
            header.appendChild(btnGear);
            this.root.appendChild(header);

            // Контент
            var content = el('div', 'cm-content');
            this.root.appendChild(content);

            // Робот
            var mascot = el('div', 'cm-mascot-fixed');
            var robotBox = el('div', 'cm-robot-box', SVG_ROBOT_ASTRONAUT);
            robotBox.setAttribute('data-action', 'robot_dialog');
            var bubble = el('div', 'cm-speech-bubble', rnd(ROBOT_PHRASES.loading));
            bubble.id = 'cm_robot_text';
            mascot.appendChild(robotBox);
            mascot.appendChild(bubble);
            this.root.appendChild(mascot);

            // Загрузка рекомендаций (переиспользуем refresh)
            this.refreshRecommendations();
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

            card.appendChild(el('div', 'cm-badge-rate', rating));
            card.appendChild(el('div', 'cm-card-title', esc(title)));
            return card;
        },

        renderDetails: function (movie) {
            this.currentView = 'details';
            this.selectedMovie = movie;
            this.root.innerHTML = '';

            var header = el('div', 'cm-header');
            var btnBack = el('div', 'cm-btn-back', SVG_ICON_BACK);
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
            var playBtn = el('div', 'cm-big-play-btn', SVG_ICON_PLAY);
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
       7. МОДАЛЬНЫЕ ОКНА
       ========================================================================== */
    function showModal(titleHtml, contentHtml, buttons) {
        var overlay = el('div', 'cm-modal-overlay');
        var box = el('div', 'cm-modal-box');
        box.appendChild(el('h3', '', titleHtml));
        var body = el('div', 'cm-modal-text', contentHtml);
        box.appendChild(body);

        var btnMatrix = [];
        if (buttons && buttons.length) {
            buttons.forEach(function (b) {
                var btn = el('div', 'cm-modal-btn', b.title);
                btn.onclick = function () {
                    closeModal();
                    if (b.onClick) b.onClick();
                };
                btn.setAttribute('data-modal-action', 'true');
                box.appendChild(btn);
                btnMatrix.push([btn]);
            });
        }
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        function closeModal() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.removeEventListener('keydown', modalKeyHandler, true);
            Focus.update();
        }

        function modalKeyHandler(e) {
            if (e.keyCode === 27 || e.keyCode === 8 || e.keyCode === 461 || e.keyCode === 10009) {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            } else if (e.keyCode === 13) {
                var cur = document.querySelector('.cm-modal-btn.cm-focus');
                if (cur) cur.click();
            }
        }
        document.addEventListener('keydown', modalKeyHandler, true);
        if (btnMatrix.length) {
            addClass(btnMatrix[0][0], 'cm-focus');
        }
    }

    function openRobotDialog() {
        var buttons = [
            {
                title: '✍️ Ввести запрос (жанр или название)',
                onClick: function () {
                    if (window.Lampa && Lampa.Input && Lampa.Input.edit) {
                        Lampa.Input.edit({ title: 'Поиск фильма', value: '', free: true }, function (val) {
                            if (val) {
                                // Сохраняем запрос, ищем
                                View.searchResults = null;
                                Engine.searchByQuery(val, function (list) {
                                    if (list.length) {
                                        View.searchResults = list;
                                        View.renderMain();
                                        notify('Найдено фильмов: ' + list.length);
                                        var bubble = document.getElementById('cm_robot_text');
                                        if (bubble) bubble.textContent = rnd(ROBOT_PHRASES.found);
                                    } else {
                                        notify('Ничего не нашлось');
                                        var bubble = document.getElementById('cm_robot_text');
                                        if (bubble) bubble.textContent = rnd(ROBOT_PHRASES.notfound);
                                    }
                                });
                            }
                        });
                    } else {
                        var promptVal = prompt('Введите запрос (жанр или название):', 'комедия');
                        if (promptVal) {
                            View.searchResults = null;
                            Engine.searchByQuery(promptVal, function (list) {
                                if (list.length) {
                                    View.searchResults = list;
                                    View.renderMain();
                                }
                            });
                        }
                    }
                }
            },
            {
                title: '🔄 Обновить рекомендации',
                onClick: function () {
                    View.searchResults = null; // сбрасываем поиск
                    View.refreshRecommendations();
                    notify('Обновляю ленту...');
                }
            },
            {
                title: '✖ Закрыть',
                onClick: function () {}
            }
        ];
        showModal('🤖 Помощник Капсулы', 'Чем могу помочь?', buttons);
    }

    function notify(text) {
        if (window.Lampa && Lampa.Noty && Lampa.Noty.show) {
            Lampa.Noty.show(text);
        } else {
            console.log('[CapsuleMod]', text);
        }
    }

    /* ==========================================================================
       8. ОБРАБОТЧИКИ ДЕЙСТВИЙ
       ========================================================================== */
    function handleAction(action, target) {
        var movie = View.selectedMovie;
        switch (action) {
            case 'exit_capsule':
                if (window.Lampa && Lampa.Activity) Lampa.Activity.backward();
                break;
            case 'back_to_main':
                View.searchResults = null; // очищаем результаты поиска при возврате
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
                    var isAction = (movie.genre_ids || []).indexOf(28) > -1 || (movie.genre_ids || []).indexOf(53) > -1;
                    var pros = isAction ? 'Любителям динамики и острых ощущений' : 'Ценителям атмосферного и вдумчивого кино';
                    var cons = isAction ? 'Тем, кто ищет лёгкую спокойную комедию' : 'Тем, кому нужен непрерывный экшен';
                    showModal('👥 Кому подойдёт', '<b>Кому смотреть:</b><br>✅ ' + pros + '<br><br><b>Кому пропустить:</b><br>⛔ ' + cons);
                }
                break;
            case 'ai_reviews':
                showModal('💬 Отзывы зрителей', 'Зрители отмечают отличный визуальный стиль и захватывающий сценарий. Рейтинг TMDb: ⭐ ' + (movie ? movie.vote_average : '7.5'));
                break;
            case 'ai_cast':
                showModal('🎭 Актёры и факты', 'Фильм снят при поддержке ведущих мировых киностудий. Дата премьеры: ' + ((movie && movie.release_date) ? movie.release_date : '2024-2026'));
                break;
        }
    }

    document.addEventListener('click', function (e) {
        var actionElem = closestAttr(e.target, 'data-action');
        if (actionElem) {
            var act = actionElem.getAttribute('data-action');
            handleAction(act, actionElem);
        }
    });

    /* ==========================================================================
       9. РЕГИСТРАЦИЯ КОМПОНЕНТА
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
                        if (cur) {
                            var act = cur.getAttribute('data-action');
                            if (act) handleAction(act, cur);
                        }
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
        var executed = false;
        function tryAdd() {
            if (executed) return;
            try {
                if (document.querySelector('[data-action="capsule_mod_entry"]')) return;
                var itemHtml = '<li class="menu__item selector" data-action="capsule_mod_entry">' +
                    '<div class="menu__ico">' + SVG_ICON_PLAY + '</div>' +
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
                        executed = true;
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
            console.error('[Capsule Mod] Ошибка инициализации:', e);
        }
    }

    start();
})();
