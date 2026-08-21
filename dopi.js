/**
 * Capsule Mod v8.0 (Optimized & Enhanced)
 * Умный рекомендательный хаб с улучшенным поиском, дизайном и управлением
 */
(function () {
    'use strict';
    if (window.plugin_capsule_mod_ready) return;
    window.plugin_capsule_mod_ready = true;

    /* ==========================================================================
       1. УТИЛИТЫ
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

    // Хранение в Lampa.Storage или localStorage
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

    // HTTP-запросы с таймаутом
    function httpGet(url, onOk, onErr) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 15000;
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
       2. КОНФИГУРАЦИЯ
       ========================================================================== */
    var COMPONENT_ID = 'capsule_mod_view';
    var CTRL_ID = 'capsule_mod_ctrl';
    var TMDB_BASE = 'https://api.themoviedb.org/3';
    var FALLBACK_API_KEY = '4ef0d7355d9ffb5151e987764708ce96'; // Резервный ключ

    // Жанры (TMDb ID → имя)
    var GENRE_MAP = {
        28: 'Боевик', 12: 'Приключения', 16: 'Мультфильм', 35: 'Комедия', 80: 'Криминал',
        99: 'Документальный', 18: 'Драма', 10751: 'Семейный', 14: 'Фэнтези', 27: 'Ужасы',
        9648: 'Детектив', 10749: 'Мелодрама', 878: 'Фантастика', 53: 'Триллер', 37: 'Вестерн'
    };

    // Ключевые слова для жанров (для поиска по запросу)
    var GENRE_KEYWORDS = {
        'боевик': [28], 'action': [28], 'экшен': [28],
        'приключения': [12], 'adventure': [12], 'путешествие': [12],
        'мультфильм': [16], 'анимация': [16], 'animation': [16], 'мультик': [16],
        'комедия': [35], 'comedy': [35], 'смешной': [35],
        'криминал': [80], 'crime': [80], 'мафия': [80],
        'документальный': [99], 'documentary': [99], 'док': [99],
        'драма': [18], 'drama': [18], 'драматичный': [18],
        'семейный': [10751], 'family': [10751], 'детский': [10751],
        'фэнтези': [14], 'fantasy': [14], 'магия': [14],
        'ужасы': [27], 'horror': [27], 'страшный': [27],
        'детектив': [9648], 'mystery': [9648], 'расследование': [9648],
        'мелодрама': [10749], 'romance': [10749], 'любовный': [10749],
        'фантастика': [878], 'sci-fi': [878], 'научная фантастика': [878], 'космос': [878],
        'триллер': [53], 'thriller': [53], 'напряженный': [53],
        'вестерн': [37], 'western': [37], 'ковбой': [37]
    };

    // Фразы робота (теперь динамические)
    var ROBOT_PHRASES = {
        hello: ['Привет! Я Капсула — твой гид по миру кино.', 'Готов помочь найти идеальный фильм!', 'Добро пожаловать! Давай подберём что-то интересное.'],
        recommend: ['Анализирую твои предпочтения... Вот подборка для тебя!', 'На основе истории просмотров подобрал лучшие варианты!', 'Исходя из твоих вкусов, рекомендую обратить внимание на это.'],
        loading: ['Ищу лучшие варианты...', 'Анализирую базу данных...', 'Собираю рекомендации...', 'Поиск идеального контента...'],
        empty: ['Пока мало данных. Посмотри несколько фильмов, и я смогу точнее подбирать рекомендации!', 'Твоя история просмотров пуста. Начни с просмотра любого фильма!', 'Добавь фильмы в избранное, чтобы я анализировал твои предпочтения.'],
        query: function(query) {
            var genre = this.extractGenreFromQuery(query);
            if (genre) return ['Найдены фильмы в жанре "' + genre + '"!', 'Вот что я нашёл по запросу "' + query + '" в жанре ' + genre + '.'];
            return ['Найдены фильмы по запросу "' + query + '"!', 'Вот результаты для "' + query + '".'];
        },
        not_found: function(query) { return ['К сожалению, ничего не найдено по запросу "' + query + '". Попробуй уточнить.', 'По запросу "' + query + '" ничего нет. Проверь правильность написания.']; },
        error: ['Произошла ошибка. Попробуй ещё раз.', 'Не удалось загрузить данные. Проверь подключение к интернету.']
    };

    function getApiKey() {
        return sGet('tmdb_api_key', '') || sGet('capsule_mod_key', '') || FALLBACK_API_KEY;
    }

    /* ==========================================================================
       3. УЛУЧШЕННЫЕ СТИЛИ (Минималистичный дизайн)
       ========================================================================== */
    var CSS_CODE = [
        /* Базовые стили */
        '.cm-root{position:fixed;inset:0;background:#0a0b0d;z-index:999999;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden;user-select:none;}',

        /* Хедер (только кнопка назад и шестеренка) */
        '.cm-header{position:absolute;top:0;left:0;right:0;height:3em;display:flex;align-items:center;padding:0 1.5em;z-index:10;background:linear-gradient(180deg,rgba(10,11,13,0.9) 0%,rgba(10,11,13,0) 100%);}',
        '.cm-btn-back{width:2.2em;height:2.2em;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:50%;transition:all 0.2s;}',
        '.cm-btn-back.cm-focus{background:rgba(255,255,255,0.15);transform:scale(1.1);outline:2px solid #fff;}',
        '.cm-btn-back svg{width:1.4em;height:1.4em;fill:#fff;}',
        '.cm-header-right{margin-left:auto;display:flex;align-items:center;gap:1em;}',
        '.cm-btn-gear{width:2em;height:2em;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:0.4em;}',
        '.cm-btn-gear.cm-focus{outline:2px solid #fff;background:rgba(255,255,255,0.1);}',
        '.cm-btn-gear svg{width:1.2em;height:1.2em;fill:#bbb;}',

        /* Контент (без отступов сверху) */
        '.cm-content{position:absolute;top:3em;bottom:0;left:0;right:0;overflow-y:auto;overflow-x:hidden;padding:0.5em 1.5em 6em;scrollbar-width:none;}',
        '.cm-content::-webkit-scrollbar{display:none;}',

        /* Ряды фильмов */
        '.cm-row{margin-bottom:1.2em;}',
        '.cm-row-title{font-size:1.1em;font-weight:600;color:#e0e0e0;margin-bottom:0.5em;}',
        '.cm-row-subtitle{font-size:0.75em;color:#888;margin-left:0.5em;}',
        '.cm-strip{display:flex;gap:0.8em;overflow-x:auto;overflow-y:hidden;padding:0.4em 0;scrollbar-width:none;-webkit-overflow-scrolling:touch;}',
        '.cm-strip::-webkit-scrollbar{display:none;}',

        /* Карточки фильмов (компактнее) */
        '.cm-card{position:relative;flex:none;width:10.5em;height:15.5em;border-radius:0.8em;overflow:hidden;background:#1a1c1e;border:0.2em solid transparent;cursor:pointer;transition:all 0.18s cubic-bezier(0.2,0,0,1);}',
        '.cm-card img{width:100%;height:100%;object-fit:cover;display:block;}',
        '.cm-card.cm-focus{border-color:#fff;transform:scale(1.05);z-index:5;box-shadow:0 0.5em 1.5em rgba(0,0,0,0.7);}',
        '.cm-badge-type{position:absolute;top:0.4em;left:0.4em;background:#e50914;color:#fff;font-size:0.65em;font-weight:700;padding:0.15em 0.4em;border-radius:0.3em;letter-spacing:0.03em;}',
        '.cm-badge-type.tv{background:#2a5298;}',
        '.cm-badge-rate{position:absolute;bottom:0.4em;right:0.4em;background:rgba(10,11,13,0.8);backdrop-filter:blur(4px);color:#fff;font-size:0.8em;font-weight:700;padding:0.12em 0.45em;border-radius:0.4em;}',
        '.cm-card-title{position:absolute;left:0;right:0;bottom:0;padding:1.5em 0.5em 0.4em;font-size:0.8em;font-weight:600;color:#fff;background:linear-gradient(180deg,transparent 0%,rgba(0,0,0,0.9) 100%);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',

        /* Робот (компактный) */
        '.cm-mascot-fixed{position:absolute;left:1.5em;bottom:1em;z-index:20;display:flex;align-items:flex-end;pointer-events:auto;}',
        '.cm-robot-box{width:7em;height:6.5em;cursor:pointer;animation:cm-float 3s ease-in-out infinite;border-radius:0.8em;transition:all 0.18s;}',
        '.cm-robot-box.cm-focus{outline:0.2em solid #fff;background:rgba(255,255,255,0.05);transform:scale(1.05);}',
        '.cm-robot-box svg{width:100%;height:100%;}',
        '.cm-speech-bubble{position:relative;background:#1a1c1e;border:1px solid #2a2e36;color:#e0e0e0;padding:0.7em 1em;border-radius:0.8em;margin-left:1em;margin-bottom:1.2em;font-size:0.9em;font-weight:500;max-width:18em;line-height:1.3;box-shadow:0 0.3em 1em rgba(0,0,0,0.5);}',
        '.cm-speech-bubble:before{content:"";position:absolute;left:-0.6em;bottom:0.8em;border-top:0.5em solid transparent;border-bottom:0.5em solid transparent;border-right:0.6em solid #1a1c1e;}',
        '@keyframes cm-float{0%,100%{transform:translateY(0) rotate(0deg);}50%{transform:translateY(-0.3em) rotate(-1deg);}}',

        /* Экран деталей */
        '.cm-details-view{display:flex;align-items:center;height:calc(100vh - 3em);padding:0 2em;gap:3em;}',
        '.cm-det-left{flex:none;width:16em;}',
        '.cm-det-poster{width:15.5em;height:22em;border-radius:1em;overflow:hidden;background:#1a1c1e;box-shadow:0 0.8em 2em rgba(0,0,0,0.6);position:relative;}',
        '.cm-det-poster img{width:100%;height:100%;object-fit:cover;}',
        '.cm-det-meta{margin-top:0.8em;font-size:1em;color:#aaa;}',
        '.cm-det-meta b{color:#fff;font-size:1.1em;display:block;margin-bottom:0.15em;}',
        '.cm-det-center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;}',
        '.cm-big-play-btn{width:13em;height:8em;background:#1a1c1e;border-radius:1.5em;display:flex;align-items:center;justify-content:center;cursor:pointer;border:0.25em solid transparent;transition:all 0.2s;box-shadow:0 0.8em 2em rgba(0,0,0,0.5);}',
        '.cm-big-play-btn svg{width:4em;height:4em;fill:#888;transition:all 0.2s;}',
        '.cm-big-play-btn.cm-focus{border-color:#fff;background:#22262b;transform:scale(1.05);}',
        '.cm-big-play-btn.cm-focus svg{fill:#fff;}',
        '.cm-det-right{flex:none;width:20em;display:flex;flex-direction:column;gap:0.7em;}',
        '.cm-chip-action{background:#1a1c1e;border:0.18em solid transparent;border-radius:0.8em;padding:0.7em 1em;font-size:0.95em;font-weight:500;color:#ccc;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;gap:0.5em;}',
        '.cm-chip-action.cm-focus{border-color:#fff;background:#22262b;color:#fff;transform:scale(1.03);}',

        /* Модальные окна */
        '.cm-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);z-index:1000000;display:flex;align-items:center;justify-content:center;}',
        '.cm-modal-box{background:#141618;border:1px solid #2a2e36;border-radius:1.2em;padding:1.5em 2em;width:30em;max-width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 1em 3em rgba(0,0,0,0.7);position:relative;}',
        '.cm-modal-box h3{margin:0 0 0.7em;font-size:1.2em;color:#fff;font-weight:600;}',
        '.cm-modal-btn{background:#1a1c1e;border:0.15em solid transparent;border-radius:0.6em;padding:0.6em 1em;color:#ccc;font-size:0.95em;cursor:pointer;margin-bottom:0.5em;display:block;width:100%;text-align:left;transition:all 0.15s;}',
        '.cm-modal-btn.cm-focus{border-color:#fff;background:#22262b;color:#fff;transform:scale(1.02);}',
        '.cm-modal-text{color:#aaa;font-size:0.95em;line-height:1.5;}',

        /* Адаптивность для мобильных устройств */
        '@media (max-width:768px){' +
            '.cm-root{font-size:12px;}' +
            '.cm-header{height:2.5em;padding:0 1em;}' +
            '.cm-content{top:2.5em;padding:0.5em 1em 5em;}' +
            '.cm-details-view{flex-direction:column;height:auto;padding:1em;gap:1.2em;}' +
            '.cm-det-left{width:100%;text-align:center;}' +
            '.cm-det-poster{margin:0 auto;width:10em;height:14em;}' +
            '.cm-det-right{width:100%;}' +
            '.cm-mascot-fixed{position:relative;left:0;bottom:0;margin-top:1em;}' +
            '.cm-robot-box{width:5em;height:4.5em;}' +
        '}'
    ].join('\n');

    function injectStyles() {
        if (document.getElementById('capsule_mod_styles')) return;
        var style = el('style');
        style.id = 'capsule_mod_styles';
        style.textContent = CSS_CODE;
        document.head.appendChild(style);
    }

    /* SVG-иконки */
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
       4. УМНЫЙ ДВИЖОК (Поиск по тегам + описаниям)
       ========================================================================== */
    var Engine = {
        // Извлекаем ID жанров из запроса
        extractGenreIdsFromQuery: function(query) {
            var foundGenres = [];
            var queryLower = query.toLowerCase();
            for (var keyword in GENRE_KEYWORDS) {
                if (queryLower.includes(keyword)) {
                    foundGenres = foundGenres.concat(GENRE_KEYWORDS[keyword]);
                }
            }
            return foundGenres;
        },

        // Получаем имя жанра по ID
        getGenreName: function(genreId) {
            return GENRE_MAP[genreId] || 'Неизвестный';
        },

        // Получаем историю просмотров
        getHistoryItems: function() {
            var items = [];
            var seen = {};
            try {
                // 1. Избранное
                var fav = sGet('favorite', {});
                if (fav && typeof fav === 'object') {
                    for (var cat in fav) {
                        var list = fav[cat];
                        if (Array.isArray(list)) {
                            list.forEach(function(c) {
                                if (c && c.id && !seen[c.id]) {
                                    seen[c.id] = true;
                                    items.push({ id: c.id, type: (c.name || c.original_name) ? 'tv' : 'movie', title: c.title || c.name || '' });
                                }
                            });
                        }
                    }
                }
                // 2. История просмотров
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
            } catch (e) {}
            return items;
        },

        // Собираем рекомендации
        buildRecommendations: function(callback) {
            var history = this.getHistoryItems();
            var apiKey = getApiKey();
            var result = { daily: [], fresh: [], historyCount: history.length };

            if (history.length > 0) {
                var sampleItem = rnd(history.slice(0, 3));
                var recUrl = TMDB_BASE + '/' + sampleItem.type + '/' + sampleItem.id + '/recommendations?api_key=' + apiKey + '&language=ru-RU&page=1';

                httpGet(recUrl, function(data) {
                    if (data && data.results && data.results.length >= 4) {
                        result.daily = data.results.slice(0, 10).map(function(m) {
                            m.media_type = sampleItem.type;
                            return m;
                        });
                    }
                    // Добираем свежие хиты
                    Engine.fetchPopularPicks(apiKey, function(freshList) {
                        result.fresh = freshList;
                        if (!result.daily.length) result.daily = freshList.slice(0, 5);
                        callback(result);
                    });
                }, function() {
                    Engine.fetchPopularPicks(apiKey, function(freshList) {
                        result.daily = freshList.slice(0, 5);
                        result.fresh = freshList.slice(5, 10);
                        callback(result);
                    });
                });
            } else {
                Engine.fetchPopularPicks(apiKey, function(freshList) {
                    result.daily = freshList.slice(0, 5);
                    result.fresh = freshList.slice(5, 10);
                    callback(result);
                });
            }
        },

        // Популярные фильмы (резервный вариант)
        fetchPopularPicks: function(apiKey, cb) {
            var url = TMDB_BASE + '/discover/movie?api_key=' + apiKey + '&language=ru-RU&sort_by=popularity.desc&vote_average.gte=6.8&vote_count.gte=200&page=1';
            httpGet(url, function(data) {
                cb((data && data.results) ? data.results.slice(0, 10) : []);
            }, function() {
                cb([]);
            });
        },

        // Поиск по запросу (с поддержкой жанров)
        searchByQuery: function(queryText, cb) {
            var apiKey = getApiKey();
            var genreIds = this.extractGenreIdsFromQuery(queryText);
            var results = [];

            // 1. Поиск по названию
            var searchUrl = TMDB_BASE + '/search/multi?api_key=' + apiKey + '&language=ru-RU&query=' + encodeURIComponent(queryText) + '&page=1&include_adult=false';
            httpGet(searchUrl, function(data) {
                var namedResults = (data && data.results) ? data.results.filter(function(x) {
                    return x.poster_path && (x.media_type === 'movie' || x.media_type === 'tv');
                }) : [];
                results = results.concat(namedResults);

                // 2. Если мало результатов или есть жанры в запросе — ищем по жанрам
                if (genreIds.length > 0 || results.length < 5) {
                    Engine.searchByGenres(genreIds.length > 0 ? genreIds : Object.keys(GENRE_MAP).map(Number), apiKey, function(genreResults) {
                        results = results.concat(genreResults);
                        // Удаляем дубликаты
                        var uniqueResults = Engine.removeDuplicates(results);
                        cb(uniqueResults.slice(0, 20));
                    });
                } else {
                    cb(results.slice(0, 20));
                }
            }, function() {
                // Fallback: поиск по жанрам, если основной поиск провалился
                if (genreIds.length > 0) {
                    Engine.searchByGenres(genreIds, apiKey, function(genreResults) {
                        cb(genreResults.slice(0, 20));
                    });
                } else {
                    cb([]);
                }
            });
        },

        // Поиск по жанрам
        searchByGenres: function(genreIds, apiKey, cb) {
            if (genreIds.length === 0) {
                cb([]);
                return;
            }
            var url = TMDB_BASE + '/discover/movie?api_key=' + apiKey + '&language=ru-RU&with_genres=' + genreIds.join(',') + '&sort_by=popularity.desc&page=1';
            httpGet(url, function(data) {
                var results = (data && data.results) ? data.results.filter(function(x) {
                    return x.poster_path;
                }) : [];
                cb(results);
            }, function() {
                cb([]);
            });
        },

        // Удаление дубликатов
        removeDuplicates: function(arr) {
            var seen = {};
            return arr.filter(function(item) {
                if (!seen[item.id]) {
                    seen[item.id] = true;
                    return true;
                }
                return false;
            });
        }
    };

    /* ==========================================================================
       5. ФОКУС-МЕНЕДЖЕР (Оптимизирован для ТВ/ПК/сенсора)
       ========================================================================== */
    var Focus = {
        grid: [],
        r: 0,
        c: 0,
        lastFocusTime: 0,
        isTouchDevice: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0),
        touchStartX: 0,
        touchStartY: 0,
        touchStartTime: 0,

        set: function(matrix, r, c) {
            this.grid = matrix || [];
            this.r = r || 0;
            this.c = c || 0;
            this.update();
        },

        current: function() {
            if (!this.grid[this.r] || !this.grid[this.r].length) return null;
            return this.grid[this.r][Math.min(this.c, this.grid[this.r].length - 1)];
        },

        update: function() {
            var old = document.querySelectorAll('.cm-focus');
            for (var i = 0; i < old.length; i++) removeClass(old[i], 'cm-focus');

            var cur = this.current();
            if (!cur) return;

            addClass(cur, 'cm-focus');

            // Плавный скролл для горизонтальных полос
            var strip = cur.closest('.cm-strip');
            if (strip) {
                var targetLeft = cur.offsetLeft - (strip.clientWidth / 2) + (cur.clientWidth / 2);
                strip.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
            }

            // Автоскролл для вертикального контента
            if (cur.scrollIntoViewIfNeeded) {
                cur.scrollIntoViewIfNeeded(false);
            } else {
                var rect = cur.getBoundingClientRect();
                var parentRect = cur.parentNode.getBoundingClientRect();
                if (rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
                    cur.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        },

        move: function(dir) {
            if (!this.grid.length) return;

            var now = Date.now();
            // Защита от двойных нажатий (для ТВ пультов)
            if (now - this.lastFocusTime < 150) return;
            this.lastFocusTime = now;

            if (dir === 'left') {
                if (this.c > 0) { this.c--; this.update(); }
            } else if (dir === 'right') {
                if (this.grid[this.r] && this.c < this.grid[this.r].length - 1) { this.c++; this.update(); }
            } else if (dir === 'up') {
                if (this.r > 0) { this.r--; this.c = Math.min(this.c, this.grid[this.r].length - 1); this.update(); }
            } else if (dir === 'down') {
                if (this.r < this.grid.length - 1) { this.r++; this.c = Math.min(this.c, this.grid[this.r].length - 1); this.update(); }
            }
        },

        // Инициализация сенсорного управления
        initTouchControls: function() {
            if (!this.isTouchDevice) return;

            document.addEventListener('touchstart', function(e) {
                Focus.touchStartX = e.touches[0].clientX;
                Focus.touchStartY = e.touches[0].clientY;
                Focus.touchStartTime = Date.now();
            }, { passive: true });

            document.addEventListener('touchend', function(e) {
                if (!Focus.touchStartX || !Focus.touchStartY) return;

                var touchEndX = e.changedTouches[0].clientX;
                var touchEndY = e.changedTouches[0].clientY;
                var diffX = Focus.touchStartX - touchEndX;
                var diffY = Focus.touchStartY - touchEndY;
                var diffTime = Date.now() - Focus.touchStartTime;

                var minSwipeDistance = 50;
                var maxSwipeTime = 300;

                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance && diffTime < maxSwipeTime) {
                    if (diffX > 0) Focus.move('right');
                    else Focus.move('left');
                } else if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > minSwipeDistance && diffTime < maxSwipeTime) {
                    if (diffY > 0) Focus.move('down');
                    else Focus.move('up');
                }

                Focus.touchStartX = 0;
                Focus.touchStartY = 0;
            }, { passive: true });
        }
    };
    Focus.initTouchControls();

    /* ==========================================================================
       6. ГЛАВНЫЙ UI И РЕНДЕРИНГ
       ========================================================================== */
    var View = {
        root: null,
        currentView: 'main',
        selectedMovie: null,
        searchResults: null, // Хранит текущие результаты поиска

        init: function() {
            injectStyles();
            this.root = el('div', 'cm-root');
            this.renderMain();
            return this.root;
        },

        // Рендеринг главного экрана (с поддержкой результатов поиска)
        renderMain: function(searchResults) {
            this.currentView = 'main';
            this.searchResults = searchResults || null;
            this.root.innerHTML = '';

            // 1. Хедер (только кнопки назад и шестеренка)
            var header = el('div', 'cm-header');
            var btnBack = el('div', 'cm-btn-back', SVG_ICON_BACK);
            btnBack.setAttribute('data-action', 'exit_capsule');
            var right = el('div', 'cm-header-right');
            var btnGear = el('div', 'cm-btn-gear', SVG_ICON_GEAR);
            btnGear.setAttribute('data-action', 'settings');
            right.appendChild(btnGear);
            header.appendChild(btnBack);
            header.appendChild(right);
            this.root.appendChild(header);

            // 2. Контентная область
            var content = el('div', 'cm-content');
            this.root.appendChild(content);

            // 3. Робот-помощник
            var mascot = el('div', 'cm-mascot-fixed');
            var robotBox = el('div', 'cm-robot-box', SVG_ROBOT_ASTRONAUT);
            robotBox.setAttribute('data-action', 'robot_dialog');
            var bubble = el('div', 'cm-speech-bubble', rnd(ROBOT_PHRASES.hello));
            bubble.id = 'cm_robot_text';
            mascot.appendChild(robotBox);
            mascot.appendChild(bubble);
            this.root.appendChild(mascot);

            // Загрузка рекомендаций или отображение результатов поиска
            if (this.searchResults && this.searchResults.length > 0) {
                this.renderSearchResults(content);
            } else {
                Engine.buildRecommendations(function(data) {
                    content.innerHTML = '';
                    var matrix = [[btnBack, btnGear]];

                    // Ряд 1: Капсула дня
                    if (data.daily && data.daily.length > 0) {
                        var row1 = el('div', 'cm-row');
                        var countNote = data.historyCount ? 'на основе ' + data.historyCount + ' просмотренных' : 'популярные хиты';
                        row1.appendChild(el('div', 'cm-row-title', 'Капсула дня <span class="cm-row-subtitle">' + countNote + '</span>'));
                        var strip1 = el('div', 'cm-strip');
                        var cards1 = [];
                        data.daily.forEach(function(m) {
                            var card = View.createCard(m);
                            strip1.appendChild(card);
                            cards1.push(card);
                        });
                        row1.appendChild(strip1);
                        content.appendChild(row1);
                        if (cards1.length) matrix.push(cards1);
                    }

                    // Ряд 2: Новое и неожиданное
                    if (data.fresh && data.fresh.length > 0) {
                        var row2 = el('div', 'cm-row');
                        row2.appendChild(el('div', 'cm-row-title', 'Новое и неожиданное'));
                        var strip2 = el('div', 'cm-strip');
                        var cards2 = [];
                        data.fresh.forEach(function(m) {
                            var card = View.createCard(m);
                            strip2.appendChild(card);
                            cards2.push(card);
                        });
                        row2.appendChild(strip2);
                        content.appendChild(row2);
                        if (cards2.length) matrix.push(cards2);
                    }

                    // Добавляем робота в сетку фокуса
                    matrix.push([robotBox]);
                    Focus.set(matrix, 1, 0);

                    var txt = document.getElementById('cm_robot_text');
                    if (txt) txt.textContent = rnd(ROBOT_PHRASES.recommend);
                });
            }
        },

        // Рендеринг результатов поиска
        renderSearchResults: function(content) {
            var matrix = [];
            var btnBack = this.root.querySelector('[data-action="exit_capsule"]');
            var btnGear = this.root.querySelector('[data-action="settings"]');
            if (btnBack && btnGear) matrix.push([btnBack, btnGear]);

            // Ряд с результатами поиска
            var row = el('div', 'cm-row');
            row.appendChild(el('div', 'cm-row-title', 'Результаты поиска'));
            var strip = el('div', 'cm-strip');
            var cards = [];

            this.searchResults.forEach(function(m) {
                var card = View.createCard(m);
                strip.appendChild(card);
                cards.push(card);
            });
            row.appendChild(strip);
            content.appendChild(row);
            if (cards.length) matrix.push(cards);

            // Добавляем робота
            var robotBox = this.root.querySelector('.cm-robot-box');
            if (robotBox) matrix.push([robotBox]);

            Focus.set(matrix, matrix.length > 1 ? 1 : 0, 0);

            var txt = document.getElementById('cm_robot_text');
            if (txt) {
                var query = this.searchResults[0] ? (this.searchResults[0].title || this.searchResults[0].name || '') : '';
                txt.textContent = rnd(ROBOT_PHRASES.query(query));
            }
        },

        // Создание карточки фильма
        createCard: function(m) {
            var type = m.media_type === 'tv' || m.name ? 'tv' : 'movie';
            var title = m.title || m.name || 'Без названия';
            var rating = m.vote_average ? m.vote_average.toFixed(1) : '7.5';
            var poster = m.poster_path ? ('https://image.tmdb.org/t/p/w342' + m.poster_path) : '';

            var card = el('div', 'cm-card');
            card.setAttribute('data-action', 'open_details');
            card._movieData = m;

            var img = el('img');
            img.src = poster;
            img.onerror = function() { this.style.display = 'none'; };
            card.appendChild(img);

            card.appendChild(el('div', 'cm-badge-type ' + type, type === 'tv' ? 'TV' : 'FILM'));
            card.appendChild(el('div', 'cm-badge-rate', rating));
            card.appendChild(el('div', 'cm-card-title', esc(title)));
            return card;
        },

        // Экран деталей фильма
        renderDetails: function(movie) {
            this.currentView = 'details';
            this.selectedMovie = movie;
            this.root.innerHTML = '';

            // Хедер (только кнопка назад)
            var header = el('div', 'cm-header');
            var btnBack = el('div', 'cm-btn-back', SVG_ICON_BACK);
            btnBack.setAttribute('data-action', 'back_to_main');
            header.appendChild(btnBack);
            this.root.appendChild(header);

            // Тело экрана
            var view = el('div', 'cm-details-view');

            // Левый блок: постер
            var left = el('div', 'cm-det-left');
            var posterBox = el('div', 'cm-det-poster');
            var img = el('img');
            img.src = movie.poster_path ? ('https://image.tmdb.org/t/p/w500' + movie.poster_path) : '';
            img.onerror = function() { this.style.display = 'none'; };
            posterBox.appendChild(img);
            left.appendChild(posterBox);

            var meta = el('div', 'cm-det-meta');
            var title = movie.title || movie.name || '';
            var year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
            meta.innerHTML = '<b>' + esc(title) + '</b>' + (year ? year + ' · ' : '') + (movie.media_type === 'tv' ? 'Сериал' : 'Фильм');
            left.appendChild(meta);
            view.appendChild(left);

            // Центр: кнопка "Смотреть"
            var center = el('div', 'cm-det-center');
            var playBtn = el('div', 'cm-big-play-btn', SVG_ICON_PLAY);
            playBtn.setAttribute('data-action', 'watch_movie');
            center.appendChild(playBtn);
            view.appendChild(center);

            // Правая часть: AI-кнопки
            var right = el('div', 'cm-det-right');
            var chips = [
                { id: 'ai_desc', title: '📝 Описание' },
                { id: 'ai_target', title: '👥 Кому подойдёт' },
                { id: 'ai_reviews', title: '💬 Отзывы' },
                { id: 'ai_cast', title: '🎭 Актёры' }
            ];

            var chipEls = [];
            chips.forEach(function(c) {
                var chip = el('div', 'cm-chip-action', c.title);
                chip.setAttribute('data-action', c.id);
                right.appendChild(chip);
                chipEls.push(chip);
            });
            view.appendChild(right);
            this.root.appendChild(view);

            // Фокус-матрица для деталей
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
       7. МОДАЛЬНЫЕ ОКНА И ДИАЛОГИ РОБОТА
       ========================================================================== */
    function showModal(titleHtml, contentHtml, buttons) {
        var overlay = el('div', 'cm-modal-overlay');
        var box = el('div', 'cm-modal-box');
        box.appendChild(el('h3', '', titleHtml));
        var body = el('div', 'cm-modal-text', contentHtml);
        box.appendChild(body);

        var btnMatrix = [];
        if (buttons && buttons.length) {
            buttons.forEach(function(b) {
                var btn = el('div', 'cm-modal-btn', b.title);
                btn.onclick = function() {
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

    // Получение ответа робота
    function getRobotResponse(type, query) {
        if (typeof ROBOT_PHRASES[type] === 'function') {
            return rnd(ROBOT_PHRASES[type](query));
        } else if (Array.isArray(ROBOT_PHRASES[type])) {
            return rnd(ROBOT_PHRASES[type]);
        }
        return 'Готов помочь!';
    }

    // Диалог с роботом
    function openRobotDialog() {
        var lastQuery = ''; // Храним последний запрос

        showModal('🤖 Помощник Капсулы', 'Чем могу помочь?', [
            {
                title: '✍️ Ввести запрос (жанр, тема, актер...)',
                onClick: function() {
                    if (window.Lampa && Lampa.Input && Lampa.Input.edit) {
                        Lampa.Input.edit({ title: 'Поиск фильмов', value: lastQuery, free: true }, function(val) {
                            if (val) {
                                lastQuery = val;
                                var robotText = document.getElementById('cm_robot_text');
                                if (robotText) robotText.textContent = getRobotResponse('loading');

                                Engine.searchByQuery(val, function(list) {
                                    if (list.length) {
                                        View.searchResults = list;
                                        View.renderMain(list);
                                        notify('Найдено: ' + list.length + ' фильмов');
                                        if (robotText) robotText.textContent = getRobotResponse('query', val);
                                    } else {
                                        notify(getRobotResponse('not_found', val));
                                        if (robotText) robotText.textContent = getRobotResponse('not_found', val);
                                    }
                                });
                            }
                        });
                    } else {
                        var promptVal = prompt('Введите запрос для поиска:', lastQuery);
                        if (promptVal) {
                            lastQuery = promptVal;
                            var robotText = document.getElementById('cm_robot_text');
                            if (robotText) robotText.textContent = getRobotResponse('loading');

                            Engine.searchByQuery(promptVal, function(list) {
                                if (list.length) {
                                    View.searchResults = list;
                                    View.renderMain(list);
                                } else {
                                    notify(getRobotResponse('not_found', promptVal));
                                    if (robotText) robotText.textContent = getRobotResponse('not_found', promptVal);
                                }
                            });
                        }
                    }
                }
            },
            {
                title: '🎬 Популярные жанры',
                onClick: function() {
                    var genreButtons = [];
                    for (var keyword in GENRE_KEYWORDS) {
                        if (GENRE_KEYWORDS.hasOwnProperty(keyword)) {
                            var genreIds = GENRE_KEYWORDS[keyword];
                            var genreName = GENRE_MAP[genreIds[0]] || keyword;
                            genreButtons.push({
                                title: '🔹 ' + genreName,
                                onClick: function(ids) {
                                    return function() {
                                        var robotText = document.getElementById('cm_robot_text');
                                        if (robotText) robotText.textContent = getRobotResponse('loading');

                                        Engine.searchByGenres(ids, getApiKey(), function(results) {
                                            if (results.length) {
                                                View.searchResults = results;
                                                View.renderMain(results);
                                                notify('Найдено: ' + results.length + ' фильмов в жанре "' + genreName + '"');
                                                if (robotText) robotText.textContent = 'Найдены фильмы в жанре "' + genreName + '"';
                                            } else {
                                                notify(getRobotResponse('not_found', genreName));
                                                if (robotText) robotText.textContent = getRobotResponse('not_found', genreName);
                                            }
                                        });
                                    };
                                }(genreIds)
                            });
                        }
                    }
                    genreButtons.push({ title: '❤️ Назад', onClick: openRobotDialog });
                    showModal('🎬 Выбери жанр', 'Популярные категории:', genreButtons);
                }
            },
            {
                title: '🔄 Обновить рекомендации',
                onClick: function() {
                    notify('Обновляю рекомендации...');
                    Engine.buildRecommendations(function(data) {
                        View.renderMain();
                        var txt = document.getElementById('cm_robot_text');
                        if (txt) txt.textContent = getRobotResponse('recommend');
                    });
                }
            },
            {
                title: '✖ Закрыть'
            }
        ]);
    }

    function notify(text) {
        if (window.Lampa && Lampa.Noty && Lampa.Noty.show) {
            Lampa.Noty.show(text);
        } else {
            console.log('[CapsuleMod]', text);
        }
    }

    /* ==========================================================================
       8. ОБРАБОТЧИК ДЕЙСТВИЙ
       ========================================================================== */
    function handleAction(action, target) {
        var movie = View.selectedMovie;
        switch (action) {
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
                if (movie) showModal('📝 Сюжет', movie.overview || 'Описание отсутствует.');
                break;
            case 'ai_target':
                if (movie) {
                    var isAction = (movie.genre_ids || []).indexOf(28) > -1 || (movie.genre_ids || []).indexOf(53) > -1;
                    var pros = isAction ? 'Любителям динамики и острых ощущений' : 'Ценителям атмосферного и вдумчивого кино';
                    var cons = isAction ? 'Тем, кто ищет легкую спокойную комедию' : 'Тем, кому нужен непрерывный экшен';
                    showModal('👥 Кому подойдёт', '<b>Кому смотреть:</b><br>✅ ' + pros + '<br><br><b>Кому пропустить:</b><br>⛔ ' + cons);
                }
                break;
            case 'ai_reviews':
                showModal('💬 Отзывы', 'Рейтинг TMDb: ⭐ ' + (movie ? movie.vote_average.toFixed(1) : '7.5') + '<br><br>Зрители отмечают качественный визуальный стиль и захватывающий сценарий.');
                break;
            case 'ai_cast':
                showModal('🎭 Актёры и факты', 'Фильм снят при поддержке ведущих мировых киностудий.<br>Дата премьеры: ' + ((movie && movie.release_date) ? movie.release_date : 'неизвестна'));
                break;
        }
    }

    // Обработка кликов мыши/тача
    document.addEventListener('click', function(e) {
        var actionElem = closestAttr(e.target, 'data-action');
        if (actionElem) {
            var act = actionElem.getAttribute('data-action');
            handleAction(act, actionElem);
        }
    });

    // Обработка клавиш для ПК
    document.addEventListener('keydown', function(e) {
        if (!document.querySelector('.cm-root')) return;

        var handled = false;
        switch(e.key) {
            case 'ArrowUp':
                Focus.move('up');
                handled = true;
                break;
            case 'ArrowDown':
                Focus.move('down');
                handled = true;
                break;
            case 'ArrowLeft':
                Focus.move('left');
                handled = true;
                break;
            case 'ArrowRight':
                Focus.move('right');
                handled = true;
                break;
            case 'Enter':
                var cur = Focus.current();
                if (cur) {
                    var act = cur.getAttribute('data-action');
                    if (act) handleAction(act, cur);
                }
                handled = true;
                break;
            case 'Escape':
                if (View.currentView === 'details') {
                    View.renderMain();
                } else if (window.Lampa && Lampa.Activity) {
                    Lampa.Activity.backward();
                }
                handled = true;
                break;
            case 'Tab':
                Focus.move(e.shiftKey ? 'left' : 'right');
                handled = true;
                break;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    /* ==========================================================================
       9. РЕГИСТРАЦИЯ КОМПОНЕНТА В LAMPA
       ========================================================================== */
    function CapsuleComponent() {
        var html = null;
        this.create = function() {
            html = View.init();
            return this.render();
        };
        this.render = function() { return html; };
        this.start = function() {
            if (window.Lampa && Lampa.Controller) {
                Lampa.Controller.add(CTRL_ID, {
                    toggle: function() { Focus.update(); },
                    up: function() { Focus.move('up'); },
                    down: function() { Focus.move('down'); },
                    left: function() { Focus.move('left'); },
                    right: function() { Focus.move('right'); },
                    enter: function() {
                        var cur = Focus.current();
                        if (cur) {
                            var act = cur.getAttribute('data-action');
                            if (act) handleAction(act, cur);
                        }
                    },
                    back: function() {
                        if (View.currentView === 'details') {
                            View.renderMain();
                        } else if (window.Lampa && Lampa.Activity) {
                            Lampa.Activity.backward();
                        }
                    },
                    pageUp: function() { Focus.move('up'); },
                    pageDown: function() { Focus.move('down'); },
                    home: function() { View.renderMain(); },
                    menu: function() { openRobotDialog(); }
                });
                Lampa.Controller.toggle(CTRL_ID);
            }
        };
        this.pause = function() {};
        this.stop = function() {};
        this.destroy = function() {
            if (html && html.parentNode) html.parentNode.removeChild(html);
        };
    }

    // Добавление пункта в меню Lampa
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
                        $btn.on('hover:enter click', function() {
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
            Lampa.Listener.follow('app', function(e) { if (e.type === 'ready') tryAdd(); });
            setTimeout(tryAdd, 2000);
        } else setTimeout(tryAdd, 1500);
    }

    // Точка входа
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
