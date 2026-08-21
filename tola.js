/**
 * Capsule Mod v9.0.1
 * Smart recommendation hub for Lampa
 *
 * Основные возможности:
 * - рекомендации по истории/избранному;
 * - поиск по названию;
 * - поиск по жанрам;
 * - поиск по актёрам;
 * - поиск по ключевым словам;
 * - TMDB через Lampa.TMDB, без захардкоженного API key;
 * - fallback на прямой TMDB API только если пользователь задал ключ;
 * - кэширование запросов с LRU-ограничением;
 * - защита от устаревших ответов;
 * - TV / Movie;
 * - карточка деталей;
 * - актёры;
 * - рекомендации;
 * - нормальная навигация;
 * - TV remote / keyboard / touch;
 * - модальные окна с навигацией;
 * - собственные настройки;
 * - очистка listeners при destroy;
 * - совместимость со старыми WebView;
 */

(function () {
    'use strict';

    if (window.__CAPSULE_MOD_V9__) return;
    window.__CAPSULE_MOD_V9__ = true;

    var VERSION = '9.0.1';
    var COMPONENT = 'capsule_mod_v9';
    var CONTROLLER = 'capsule_mod_v9_controller';
    var STORAGE_PREFIX = 'capsule_mod_v9_';

    var TMDB_IMAGE = 'https://image.tmdb.org/t/p/';

    var state = {
        root: null,
        view: 'main',
        movie: null,
        searchQuery: '',
        searchResults: [],
        requestId: 0,
        destroyed: false,
        modal: null,
        lastRows: [],
        focusRow: 0,
        focusCol: 0,
        touchStartX: 0,
        touchStartY: 0,
        touchStartTime: 0
    };

    /* ============================================================
     * HELPERS
     * ============================================================ */

    function $(selector, root) {
        return (root || document).querySelector(selector);
    }

    function $all(selector, root) {
        return Array.prototype.slice.call(
            (root || document).querySelectorAll(selector)
        );
    }

    function el(tag, cls, html) {
        var node = document.createElement(tag);

        if (cls) node.className = cls;
        if (html !== undefined && html !== null) node.innerHTML = html;

        return node;
    }

    function textNode(text) {
        return document.createTextNode(String(text || ''));
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function addClass(node, cls) {
        if (!node) return;

        if (node.classList) {
            node.classList.add(cls);
            return;
        }

        if (!hasClass(node, cls)) {
            node.className += (node.className ? ' ' : '') + cls;
        }
    }

    function removeClass(node, cls) {
        if (!node) return;

        if (node.classList) {
            node.classList.remove(cls);
            return;
        }

        node.className = (' ' + node.className + ' ')
            .replace(' ' + cls + ' ', ' ')
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/g, '');
    }

    function hasClass(node, cls) {
        if (!node) return false;

        if (node.classList) {
            return node.classList.contains(cls);
        }

        return (' ' + node.className + ' ').indexOf(' ' + cls + ' ') !== -1;
    }

    // FIX: closest теперь корректно работает с атрибутами без значений
    function closest(node, selector) {
        while (node && node !== document) {
            if (node.matches && node.matches(selector)) return node;

            if (node.getAttribute && selector.charAt(0) === '[') {
                var attrName = selector.slice(1, -1);
                // Проверяем наличие атрибута, а не его значение
                if (node.hasAttribute && node.hasAttribute(attrName)) {
                    return node;
                }
            }

            node = node.parentNode;
        }

        return null;
    }

    function random(arr) {
        if (!arr || !arr.length) return '';
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function uniq(items, keyFn) {
        var seen = {};
        var result = [];

        (items || []).forEach(function (item) {
            var key = keyFn ? keyFn(item) : item && item.id;

            if (key === undefined || key === null) {
                result.push(item);
                return;
            }

            key = String(key);

            if (!seen[key]) {
                seen[key] = true;
                result.push(item);
            }
        });

        return result;
    }

    function debounce(fn, delay) {
        var timer;

        return function () {
            var args = arguments;

            clearTimeout(timer);

            timer = setTimeout(function () {
                fn.apply(null, args);
            }, delay || 300);
        };
    }

    function now() {
        return Date.now ? Date.now() : new Date().getTime();
    }

    /* ============================================================
     * STORAGE
     * ============================================================ */

    var Storage = {

        get: function (key, def) {
            var fullKey = STORAGE_PREFIX + key;

            try {
                if (window.Lampa &&
                    Lampa.Storage &&
                    typeof Lampa.Storage.get === 'function') {

                    var value = Lampa.Storage.get(fullKey, def);

                    if (value !== undefined && value !== null) {
                        return value;
                    }
                }
            } catch (e) {}

            try {
                if (window.localStorage) {
                    var raw = localStorage.getItem(fullKey);

                    if (raw !== null) {
                        return JSON.parse(raw);
                    }
                }
            } catch (e2) {}

            return def;
        },

        set: function (key, value) {
            var fullKey = STORAGE_PREFIX + key;

            try {
                if (window.Lampa &&
                    Lampa.Storage &&
                    typeof Lampa.Storage.set === 'function') {

                    Lampa.Storage.set(fullKey, value);
                }
            } catch (e) {}

            try {
                if (window.localStorage) {
                    localStorage.setItem(fullKey, JSON.stringify(value));
                }
            } catch (e2) {}
        },

        remove: function (key) {
            var fullKey = STORAGE_PREFIX + key;

            try {
                if (window.Lampa &&
                    Lampa.Storage &&
                    typeof Lampa.Storage.remove === 'function') {

                    Lampa.Storage.remove(fullKey);
                }
            } catch (e) {}

            try {
                if (window.localStorage) {
                    localStorage.removeItem(fullKey);
                }
            } catch (e2) {}
        }
    };

    /* ============================================================
     * CONFIG
     * ============================================================ */

    var Config = {

        getApiKey: function () {
            return Storage.get('tmdb_api_key', '');
        },

        getLanguage: function () {
            return Storage.get('language', 'ru-RU');
        },

        getCacheMinutes: function () {
            var value = parseInt(Storage.get('cache_minutes', 30), 10);

            if (isNaN(value)) value = 30;

            return Math.max(5, Math.min(1440, value));
        },

        getAdult: function () {
            return !!Storage.get('include_adult', false);
        },

        getPosterSize: function () {
            return Storage.get('poster_size', 'w342');
        }
    };

    /* ============================================================
     * GENRES
     * ============================================================ */

    var GENRES = {
        28: 'Боевик',
        12: 'Приключения',
        16: 'Мультфильм',
        35: 'Комедия',
        80: 'Криминал',
        99: 'Документальный',
        18: 'Драма',
        10751: 'Семейный',
        14: 'Фэнтези',
        27: 'Ужасы',
        9648: 'Детектив',
        10749: 'Мелодрама',
        878: 'Фантастика',
        53: 'Триллер',
        37: 'Вестерн',
        10752: 'Военный',
        36: 'История',
        10402: 'Музыка',
        10770: 'Телефильм'
    };

    var GENRE_ALIASES = {
        'боевик': 28,
        'экшен': 28,
        'action': 28,

        'приключения': 12,
        'приключение': 12,
        'adventure': 12,

        'мультфильм': 16,
        'мультик': 16,
        'анимация': 16,
        'animation': 16,

        'комедия': 35,
        'comedy': 35,

        'криминал': 80,
        'crime': 80,
        'мафия': 80,

        'документальный': 99,
        'документалка': 99,
        'documentary': 99,

        'драма': 18,
        'drama': 18,

        'семейный': 10751,
        'семейное': 10751,
        'family': 10751,

        'фэнтези': 14,
        'фентези': 14,
        'fantasy': 14,
        'магия': 14,

        'ужасы': 27,
        'ужас': 27,
        'horror': 27,

        'детектив': 9648,
        'mystery': 9648,
        'расследование': 9648,

        'мелодрама': 10749,
        'романтика': 10749,
        'романтический': 10749,
        'romance': 10749,

        'фантастика': 878,
        'sci-fi': 878,
        'сай фай': 878,
        'космос': 878,

        'триллер': 53,
        'thriller': 53,

        'вестерн': 37,
        'western': 37,
        'ковбой': 37,

        'военный': 10752,
        'война': 10752,
        'war': 10752,

        'история': 36,
        'исторический': 36,
        'history': 36,

        'музыка': 10402,
        'music': 10402,

        'телефильм': 10770
    };

    /* ============================================================
     * SVG
     * ============================================================ */

    var ICON = {

        back:
            '<svg viewBox="0 0 24 24">' +
            '<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>' +
            '</svg>',

        search:
            '<svg viewBox="0 0 24 24">' +
            '<path d="M9.5 3a6.5 6.5 0 0 0 0 13c1.61 0 3.09-.59 4.23-1.57L19.3 20l1.4-1.4-5.57-5.57A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 0 0 9.5 3zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z"/>' +
            '</svg>',

        settings:
            '<svg viewBox="0 0 24 24">' +
            '<path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65-2-3.46-2.49 1a7.2 7.2 0 0 0-1.69-.98L15 2h-4l-.36 2.93c-.61.25-1.18.58-1.69.98l-2.49-1-2 3.46 2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65 2 3.46 2.49-1c.51.4 1.08.73 1.69.98L11 22h4l.36-2.93c.61-.25 1.18-.58 1.69-.98l2.49 1 2-3.46-2.11-1.65zM13 15.5A3.5 3.5 0 1 1 13 8a3.5 3.5 0 0 1 0 7.5z"/>' +
            '</svg>',

        play:
            '<svg viewBox="0 0 24 24">' +
            '<path d="M8 5v14l11-7z"/>' +
            '</svg>',

        robot:
            '<svg viewBox="0 0 220 190">' +
            '<rect x="25" y="20" width="170" height="140" rx="30" fill="#e9e9e9"/>' +
            '<rect x="45" y="45" width="130" height="65" rx="22" fill="#191b1e"/>' +
            '<circle cx="82" cy="77" r="9" fill="#fff"/>' +
            '<circle cx="138" cy="77" r="9" fill="#fff"/>' +
            '<circle cx="82" cy="77" r="4" fill="#111"/>' +
            '<circle cx="138" cy="77" r="4" fill="#111"/>' +
            '<path d="M82 95 Q110 112 138 95" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>' +
            '<rect x="70" y="122" width="80" height="18" rx="9" fill="#bdbdbd"/>' +
            '<path d="M110 20V5" stroke="#ddd" stroke-width="6"/>' +
            '<circle cx="110" cy="4" r="6" fill="#e50914"/>' +
            '<path d="M25 80H8M195 80h17" stroke="#ddd" stroke-width="7" stroke-linecap="round"/>' +
            '</svg>'
    };

    /* ============================================================
     * CSS
     * ============================================================ */

    var CSS = [
        '.cm9-root{position:fixed;inset:0;z-index:999999;background:#090a0c;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;overflow:hidden;user-select:none;}',
        '.cm9-header{position:absolute;top:0;left:0;right:0;height:4.5em;display:flex;align-items:center;padding:0 2em;z-index:30;background:linear-gradient(#090a0c,rgba(9,10,12,.92),rgba(9,10,12,0));}',
        '.cm9-icon-btn{width:3em;height:3em;border-radius:.7em;display:flex;align-items:center;justify-content:center;color:#bbb;cursor:pointer;border:.12em solid transparent;box-sizing:border-box;}',
        '.cm9-icon-btn svg{width:1.45em;height:1.45em;fill:currentColor;}',
        '.cm9-icon-btn.focus{color:#fff;background:#1d2024;border-color:#fff;transform:scale(1.06);}',
        '.cm9-header-right{margin-left:auto;display:flex;gap:.5em;}',
        '.cm9-content{position:absolute;inset:4em 0 0;overflow-y:auto;overflow-x:hidden;padding:1em 2em 9em;scrollbar-width:none;box-sizing:border-box;}',
        '.cm9-content::-webkit-scrollbar{display:none;}',
        '.cm9-row{margin:0 0 1.6em;}',
        '.cm9-row-title{font-size:1.2em;font-weight:700;margin:0 0 .55em;color:#f1f1f1;}',
        '.cm9-row-subtitle{font-size:.7em;color:#777;font-weight:400;margin-left:.5em;}',
        '.cm9-strip{display:flex;gap:.85em;overflow-x:auto;padding:.5em .25em .7em;scrollbar-width:none;}',
        '.cm9-strip::-webkit-scrollbar{display:none;}',
        '.cm9-card{position:relative;flex:0 0 10.5em;height:15.5em;background:#17191c;border:.16em solid transparent;border-radius:.75em;overflow:hidden;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s;box-sizing:border-box;}',
        '.cm9-card.focus{border-color:#fff;transform:scale(1.055);z-index:5;box-shadow:0 .8em 2em rgba(0,0,0,.65);}',
        '.cm9-card img{display:block;width:100%;height:100%;object-fit:cover;background:#17191c;}',
        '.cm9-card:after{content:"";position:absolute;left:0;right:0;bottom:0;height:45%;background:linear-gradient(transparent,rgba(0,0,0,.92));pointer-events:none;}',
        '.cm9-type{position:absolute;top:.45em;left:.45em;padding:.22em .48em;border-radius:.3em;background:#e50914;font-size:.58em;font-weight:800;z-index:2;}',
        '.cm9-type.tv{background:#3569ad;}',
        '.cm9-rating{position:absolute;right:.45em;bottom:.55em;padding:.2em .42em;border-radius:.3em;background:rgba(0,0,0,.75);font-size:.68em;font-weight:800;z-index:2;}',
        '.cm9-title{position:absolute;left:.55em;right:.55em;bottom:.55em;z-index:2;font-size:.72em;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '.cm9-year{position:absolute;left:.55em;bottom:2em;z-index:2;color:#bbb;font-size:.6em;}',
        '.cm9-robot{position:absolute;left:1.5em;bottom:1em;z-index:20;display:flex;align-items:flex-end;pointer-events:none;}',
        '.cm9-robot-box{width:7em;height:6em;pointer-events:auto;cursor:pointer;border-radius:.8em;border:.15em solid transparent;box-sizing:border-box;animation:cm9float 3s ease-in-out infinite;}',
        '.cm9-robot-box.focus{border-color:#fff;background:rgba(255,255,255,.05);transform:scale(1.05);}',
        '.cm9-robot-box svg{width:100%;height:100%;}',
        '.cm9-bubble{max-width:21em;margin:0 0 1em 1em;padding:.75em 1em;border:1px solid #2c3035;border-radius:.8em;background:#17191c;color:#ddd;font-size:.8em;line-height:1.4;box-shadow:0 .5em 1.5em rgba(0,0,0,.5);}',
        '.cm9-empty{padding:4em 1em;text-align:center;color:#888;font-size:1.1em;}',
        '.cm9-loading{padding:3em;text-align:center;color:#888;}',
        '.cm9-details{display:flex;align-items:center;justify-content:center;gap:3em;min-height:calc(100vh - 5em);padding:2em;box-sizing:border-box;}',
        '.cm9-poster{width:17em;height:24em;flex:none;border-radius:1em;overflow:hidden;background:#17191c;box-shadow:0 1em 3em rgba(0,0,0,.65);}',
        '.cm9-poster img{width:100%;height:100%;object-fit:cover;}',
        '.cm9-info{width:min(38em,45vw);max-height:70vh;overflow:hidden;}',
        '.cm9-detail-title{font-size:2em;font-weight:800;margin-bottom:.3em;}',
        '.cm9-detail-meta{color:#999;margin-bottom:1em;}',
        '.cm9-overview{color:#ccc;font-size:.95em;line-height:1.6;margin-bottom:1.3em;}',
        '.cm9-actions{display:flex;flex-wrap:wrap;gap:.7em;}',
        '.cm9-action{padding:.8em 1.15em;border-radius:.65em;background:#181b1e;border:.15em solid transparent;color:#ccc;cursor:pointer;font-size:.85em;font-weight:700;}',
        '.cm9-action.focus{border-color:#fff;color:#fff;background:#22262b;transform:scale(1.04);}',
        '.cm9-modal{position:fixed;inset:0;background:rgba(0,0,0,.82);backdrop-filter:blur(7px);z-index:1000000;display:flex;align-items:center;justify-content:center;padding:2em;box-sizing:border-box;}',
        '.cm9-modal-box{width:34em;max-width:95vw;max-height:82vh;overflow:auto;background:#141619;border:1px solid #30343a;border-radius:1em;padding:1.5em;box-sizing:border-box;box-shadow:0 1em 4em rgba(0,0,0,.7);}',
        '.cm9-modal-title{font-size:1.25em;font-weight:800;margin-bottom:.8em;}',
        '.cm9-modal-body{color:#aaa;line-height:1.55;font-size:.9em;margin-bottom:1em;}',
        '.cm9-modal-button{width:100%;padding:.75em 1em;margin-top:.5em;background:#1a1d20;border:.14em solid transparent;border-radius:.6em;color:#ccc;text-align:left;cursor:pointer;box-sizing:border-box;}',
        '.cm9-modal-button.focus{border-color:#fff;color:#fff;background:#24282d;}',
        '.cm9-cast{display:flex;gap:.8em;overflow-x:auto;padding:.5em 0 1em;scrollbar-width:none;}',
        '.cm9-cast::-webkit-scrollbar{display:none;}',
        '.cm9-person{flex:0 0 7em;text-align:center;color:#ccc;font-size:.7em;}',
        '.cm9-person img{display:block;width:6em;height:7.5em;margin:auto auto .45em;border-radius:.5em;object-fit:cover;background:#222;}',
        '@keyframes cm9float{0%,100%{transform:translateY(0)}50%{transform:translateY(-.3em)}}',
        '@media(max-width:800px){',
        '.cm9-root{font-size:12px;}',
        '.cm9-content{padding-left:1em;padding-right:1em;}',
        '.cm9-header{padding:0 1em;}',
        '.cm9-details{flex-direction:column;justify-content:flex-start;padding-top:4em;overflow:auto;}',
        '.cm9-poster{width:11em;height:15.5em;}',
        '.cm9-info{width:100%;max-width:100%;max-height:none;}',
        '.cm9-detail-title{font-size:1.4em;}',
        '.cm9-robot{left:1em;}',
        '.cm9-bubble{max-width:15em;}',
        '}'
    ].join('\n');

    function injectCSS() {
        if ($('#capsule_mod_v9_css')) return;

        var style = el('style');
        style.id = 'capsule_mod_v9_css';
        style.textContent = CSS;

        document.head.appendChild(style);
    }

    /* ============================================================
     * NOTIFY
     * ============================================================ */

    function notify(message) {
        try {
            if (window.Lampa &&
                Lampa.Noty &&
                typeof Lampa.Noty.show === 'function') {

                Lampa.Noty.show(message);
                return;
            }
        } catch (e) {}

        try {
            console.log('[Capsule Mod]', message);
        } catch (e2) {}
    }

    /* ============================================================
     * TMDB CLIENT
     * ============================================================ */

    var TMDB = {

        cache: {},

        image: function (path, size) {
            if (!path) return '';

            try {
                if (window.Lampa &&
                    Lampa.TMDB &&
                    typeof Lampa.TMDB.image === 'function') {

                    return Lampa.TMDB.image(path, size || 'w342');
                }
            } catch (e) {}

            return TMDB_IMAGE + (size || 'w342') + path;
        },

        buildUrl: function (path, params) {
            var apiKey = Config.getApiKey();
            var language = Config.getLanguage();

            var query = [];

            params = params || {};

            Object.keys(params).forEach(function (key) {
                if (params[key] !== undefined &&
                    params[key] !== null &&
                    params[key] !== '') {

                    query.push(
                        encodeURIComponent(key) +
                        '=' +
                        encodeURIComponent(params[key])
                    );
                }
            });

            if (language && !params.language) {
                query.push('language=' + encodeURIComponent(language));
            }

            if (apiKey) {
                query.push('api_key=' + encodeURIComponent(apiKey));
            }

            return 'https://api.themoviedb.org/3/' +
                path.replace(/^\/+/, '') +
                '?' +
                query.join('&');
        },

        get: function (path, params, callback) {
            var self = this;
            var cacheKey = path + '?' + JSON.stringify(params || {});
            var ttl = Config.getCacheMinutes() * 60 * 1000;

            if (self.cache[cacheKey] &&
                now() - self.cache[cacheKey].time < ttl) {

                callback(null, self.cache[cacheKey].data);
                return;
            }

            // FIX: LRU-ограничение кэша (не более 100 записей)
            var keys = Object.keys(self.cache);
            if (keys.length > 100) {
                keys.sort(function (a, b) {
                    return self.cache[a].time - self.cache[b].time;
                });
                for (var i = 0; i < keys.length - 50; i++) {
                    delete self.cache[keys[i]];
                }
            }

            if (window.Lampa &&
                Lampa.TMDB &&
                typeof Lampa.TMDB.api === 'function') {

                self.getViaLampa(path, params, function (error, data) {
                    if (!error && data) {
                        self.cache[cacheKey] = {
                            time: now(),
                            data: data
                        };
                    }

                    callback(error, data);
                });

                return;
            }

            if (!Config.getApiKey()) {
                callback('tmdb_api_key_missing');
                return;
            }

            self.getDirect(path, params, function (error, data) {
                if (!error && data) {
                    self.cache[cacheKey] = {
                        time: now(),
                        data: data
                    };
                }

                callback(error, data);
            });
        },

        getViaLampa: function (path, params, callback) {
            var url = '';

            try {
                url = Lampa.TMDB.api(
                    path.replace(/^\/+/, ''),
                    params || {}
                );
            } catch (e) {
                try {
                    url = Lampa.TMDB.api(
                        path.replace(/^\/+/, '')
                    );
                } catch (e2) {}
            }

            if (!url) {
                callback('tmdb_url_error');
                return;
            }

            Http.get(url, callback);
        },

        getDirect: function (path, params, callback) {
            Http.get(this.buildUrl(path, params), callback);
        }
    };

    /* ============================================================
     * HTTP
     * ============================================================ */

    var Http = {

        get: function (url, callback) {
            var xhr;

            try {
                xhr = new XMLHttpRequest();

                xhr.open('GET', url, true);
                xhr.timeout = 15000;

                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) return;

                    if (xhr.status >= 200 && xhr.status < 400) {
                        var data;

                        try {
                            data = JSON.parse(xhr.responseText);
                        } catch (e) {
                            callback('invalid_json');
                            return;
                        }

                        callback(null, data);
                    } else {
                        callback('http_' + xhr.status);
                    }
                };

                xhr.onerror = function () {
                    callback('network_error');
                };

                xhr.ontimeout = function () {
                    callback('timeout');
                };

                xhr.send();

            } catch (e2) {
                callback('exception');
            }
        }
    };

    /* ============================================================
     * NORMALIZATION
     * ============================================================ */

    var Normalize = {

        mediaType: function (item) {
            if (!item) return 'movie';

            if (item.media_type === 'tv') return 'tv';
            if (item.media_type === 'movie') return 'movie';

            if (item.first_air_date || item.name) return 'tv';

            return 'movie';
        },

        title: function (item) {
            return item && (item.title || item.name) ||
                'Без названия';
        },

        year: function (item) {
            var date = item && (
                item.release_date ||
                item.first_air_date
            );

            return date ? String(date).slice(0, 4) : '';
        },

        rating: function (item) {
            var rating = parseFloat(item && item.vote_average);

            if (!isNaN(rating)) {
                return rating.toFixed(1);
            }

            return '—';
        },

        key: function (item) {
            if (!item) return '';

            return Normalize.mediaType(item) + ':' +
                String(item.id || '');
        },

        prepare: function (item) {
            if (!item) return null;

            var copy = {};

            Object.keys(item).forEach(function (key) {
                copy[key] = item[key];
            });

            copy.media_type = Normalize.mediaType(item);

            return copy;
        }
    };

    /* ============================================================
     * HISTORY
     * ============================================================ */

    var History = {

        read: function () {
            var result = [];
            var seen = {};

            function add(item) {
                if (!item || item.id === undefined || item.id === null) {
                    return;
                }

                var normalized = Normalize.prepare(item);
                var key = Normalize.key(normalized);

                if (seen[key]) return;

                seen[key] = true;

                result.push({
                    id: normalized.id,
                    media_type: normalized.media_type,
                    title: Normalize.title(normalized)
                });
            }

            try {
                var favorite = null;

                if (window.Lampa &&
                    Lampa.Storage &&
                    typeof Lampa.Storage.get === 'function') {

                    favorite = Lampa.Storage.get('favorite', {});
                }

                if (favorite && typeof favorite === 'object') {
                    Object.keys(favorite).forEach(function (category) {
                        var list = favorite[category];

                        if (!Array.isArray(list)) return;

                        list.forEach(function (item) {
                            add(item);
                        });
                    });
                }
            } catch (e) {}

            try {
                var timeline = null;

                if (window.Lampa &&
                    Lampa.Storage &&
                    typeof Lampa.Storage.get === 'function') {

                    timeline = Lampa.Storage.get('timeline', {});
                }

                if (timeline && typeof timeline === 'object') {
                    Object.keys(timeline).forEach(function (key) {
                        var entry = timeline[key];
                        var card = entry && entry.card;

                        if (card) {
                            add(card);
                            return;
                        }

                        if (entry && entry.id) {
                            add({
                                id: entry.id,
                                media_type: entry.type ||
                                    (entry.method === 'tv' ? 'tv' : 'movie'),
                                title: entry.title || ''
                            });
                        }
                    });
                }
            } catch (e2) {}

            return result.slice(0, 30);
        }
    };

    /* ============================================================
     * SEARCH ENGINE
     * ============================================================ */

    var Engine = {

        extractGenres: function (query) {
            var text = String(query || '').toLowerCase();
            var ids = [];

            Object.keys(GENRE_ALIASES).forEach(function (alias) {
                if (text.indexOf(alias) !== -1) {
                    var id = GENRE_ALIASES[alias];

                    if (ids.indexOf(id) === -1) {
                        ids.push(id);
                    }
                }
            });

            return ids;
        },

        genreName: function (id) {
            return GENRES[id] || 'Жанр';
        },

        cleanSearchResults: function (results) {
            return uniq(
                (results || [])
                    .filter(function (item) {
                        return item &&
                            item.id &&
                            item.poster_path &&
                            (
                                item.media_type === 'movie' ||
                                item.media_type === 'tv' ||
                                item.title ||
                                item.name
                            );
                    })
                    .map(Normalize.prepare),
                Normalize.key
            );
        },

        search: function (query, callback) {
            query = String(query || '').replace(/\s+/g, ' ').trim();

            if (!query) {
                callback(null, []);
                return;
            }

            var requestId = ++state.requestId;
            var genres = this.extractGenres(query);
            var self = this;

            TMDB.get(
                'search/multi',
                {
                    query: query,
                    page: 1,
                    include_adult: Config.getAdult() ? 'true' : 'false'
                },
                function (error, data) {

                    if (requestId !== state.requestId) return;

                    var results = [];

                    if (!error && data && Array.isArray(data.results)) {
                        results = data.results
                            .filter(function (item) {
                                return item.media_type === 'movie' ||
                                    item.media_type === 'tv';
                            });
                    }

                    results = self.cleanSearchResults(results);

                    if (genres.length) {
                        self.discoverByGenres(genres, function (genreResults) {

                            if (requestId !== state.requestId) return;

                            var merged = self.cleanSearchResults(
                                results.concat(genreResults)
                            );

                            callback(null, self.rankSearch(
                                merged,
                                query,
                                genres
                            ));
                        });

                        return;
                    }

                    callback(null, self.rankSearch(
                        results,
                        query,
                        genres
                    ));
                }
            );
        },

        rankSearch: function (results, query, genres) {
            var text = query.toLowerCase();

            return results
                .map(function (item) {
                    var score = 0;
                    var title = Normalize.title(item).toLowerCase();

                    if (title === text) score += 100;
                    else if (title.indexOf(text) !== -1) score += 60;

                    if (genres && genres.length &&
                        item.genre_ids) {

                        genres.forEach(function (genreId) {
                            if (item.genre_ids.indexOf(genreId) !== -1) {
                                score += 20;
                            }
                        });
                    }

                    score += Math.min(
                        parseFloat(item.vote_average) || 0,
                        10
                    );

                    return {
                        item: item,
                        score: score
                    };
                })
                .sort(function (a, b) {
                    return b.score - a.score;
                })
                .map(function (entry) {
                    return entry.item;
                })
                .slice(0, 30);
        },

        discoverByGenres: function (genres, callback) {
            if (!genres || !genres.length) {
                callback([]);
                return;
            }

            var pending = genres.length;
            var all = [];

            genres.forEach(function (genreId) {
                TMDB.get(
                    'discover/movie',
                    {
                        with_genres: genreId,
                        sort_by: 'popularity.desc',
                        page: 1,
                        include_adult: Config.getAdult() ? 'true' : 'false',
                        'vote_count.gte': 50
                    },
                    function (error, data) {

                        if (!error &&
                            data &&
                            Array.isArray(data.results)) {

                            all = all.concat(
                                data.results.map(function (item) {
                                    item.media_type = 'movie';
                                    return item;
                                })
                            );
                        }

                        pending--;

                        if (pending <= 0) {
                            callback(
                                uniq(all, Normalize.key)
                                    .slice(0, 30)
                            );
                        }
                    }
                );
            });
        },

        recommendations: function (item, callback) {
            if (!item || !item.id) {
                callback([]);
                return;
            }

            var type = Normalize.mediaType(item);

            TMDB.get(
                type + '/' + item.id + '/recommendations',
                {
                    page: 1
                },
                function (error, data) {

                    if (error || !data || !data.results) {
                        callback([]);
                        return;
                    }

                    var list = data.results.map(function (entry) {
                        entry.media_type = type;
                        return entry;
                    });

                    callback(
                        Engine.cleanSearchResults(list)
                            .slice(0, 20)
                    );
                }
            );
        },

        popular: function (callback) {
            TMDB.get(
                'trending/all/week',
                {},
                function (error, data) {

                    if (error || !data || !data.results) {
                        callback([]);
                        return;
                    }

                    callback(
                        Engine.cleanSearchResults(
                            data.results
                        ).slice(0, 20)
                    );
                }
            );
        },

        details: function (item, callback) {
            if (!item || !item.id) {
                callback('invalid_item');
                return;
            }

            var type = Normalize.mediaType(item);

            TMDB.get(
                type + '/' + item.id,
                {
                    append_to_response:
                        'credits,recommendations,keywords,videos'
                },
                function (error, data) {

                    if (error || !data) {
                        callback(error || 'empty');
                        return;
                    }

                    data.media_type = type;

                    callback(null, data);
                }
            );
        }
    };

    /* ============================================================
     * RECOMMENDATIONS
     * ============================================================ */

    var Recommendations = {

        load: function (callback) {
            var history = History.read();

            if (!history.length) {
                Engine.popular(function (list) {
                    callback({
                        primary: list.slice(0, 10),
                        secondary: list.slice(10, 20),
                        historyCount: 0
                    });
                });

                return;
            }

            var sample = history.slice(0, 5);
            var pending = sample.length;
            var all = [];

            sample.forEach(function (item) {
                Engine.recommendations(item, function (list) {
                    all = all.concat(list);

                    pending--;

                    if (pending <= 0) {
                        var merged = uniq(
                            all,
                            Normalize.key
                        );

                        Engine.popular(function (popular) {
                            callback({
                                primary: merged.slice(0, 10),
                                secondary: popular
                                    .filter(function (entry) {
                                        return !merged.some(function (x) {
                                            return Normalize.key(x) ===
                                                Normalize.key(entry);
                                        });
                                    })
                                    .slice(0, 10),
                                historyCount: history.length
                            });
                        });
                    }
                });
            });
        }
    };

    /* ============================================================
     * FOCUS
     * ============================================================ */

    var Focus = {

        rows: [],

        setRows: function (rows, row, col) {
            this.rows = rows || [];

            this.row = Math.max(
                0,
                Math.min(
                    row || 0,
                    Math.max(0, this.rows.length - 1)
                )
            );

            this.col = Math.max(
                0,
                col || 0
            );

            this.normalize();
            this.render();
        },

        // FIX: добавлена защита от падения при пустых строках
        normalize: function () {
            if (!this.rows.length) {
                this.row = 0;
                this.col = 0;
                return;
            }

            var currentRow = this.rows[this.row];

            if (!currentRow || !currentRow.length) {
                this.row = 0;
                this.col = 0;
                currentRow = this.rows[0];

                // Если даже первая строка пустая, выходим
                if (!currentRow || !currentRow.length) {
                    return;
                }
            }

            this.col = Math.max(
                0,
                Math.min(
                    this.col,
                    currentRow.length - 1
                )
            );
        },

        current: function () {
            if (!this.rows.length) return null;

            var row = this.rows[this.row];

            if (!row || !row.length) return null;

            return row[this.col] || row[0];
        },

        render: function () {
            var nodes = $all('.cm9-root .focus');

            nodes.forEach(function (node) {
                removeClass(node, 'focus');
            });

            var current = this.current();

            if (!current) return;

            addClass(current, 'focus');

            try {
                current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            } catch (e) {}

            var strip = current.parentNode;

            if (strip && hasClass(strip, 'cm9-strip')) {
                try {
                    var left =
                        current.offsetLeft -
                        strip.clientWidth / 2 +
                        current.clientWidth / 2;

                    strip.scrollTo({
                        left: Math.max(0, left),
                        behavior: 'smooth'
                    });
                } catch (e2) {}
            }
        },

        move: function (direction) {
            var row = this.row;
            var col = this.col;

            if (direction === 'left') {
                col--;
            }

            if (direction === 'right') {
                col++;
            }

            if (direction === 'up') {
                row--;
            }

            if (direction === 'down') {
                row++;
            }

            row = Math.max(
                0,
                Math.min(row, this.rows.length - 1)
            );

            if (!this.rows[row] || !this.rows[row].length) {
                return;
            }

            col = Math.max(
                0,
                Math.min(
                    col,
                    this.rows[row].length - 1
                )
            );

            this.row = row;
            this.col = col;

            this.render();
        },

        setFirst: function () {
            this.row = 0;
            this.col = 0;
            this.render();
        }
    };

    /* ============================================================
     * MODAL
     * ============================================================ */

    var Modal = {

        open: function (title, html, buttons) {
            this.close();

            var overlay = el('div', 'cm9-modal');
            var box = el('div', 'cm9-modal-box');

            var titleNode = el(
                'div',
                'cm9-modal-title',
                esc(title)
            );

            var body = el(
                'div',
                'cm9-modal-body',
                html || ''
            );

            box.appendChild(titleNode);
            box.appendChild(body);

            var modalRows = [];

            (buttons || []).forEach(function (button) {
                var node = el(
                    'div',
                    'cm9-modal-button',
                    esc(button.title)
                );

                node.setAttribute(
                    'data-modal-index',
                    modalRows.length
                );

                node.onclick = function () {
                    var action = button.onClick;

                    Modal.close();

                    if (action) {
                        action();
                    }
                };

                box.appendChild(node);
                modalRows.push([node]);
            });

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            state.modal = {
                overlay: overlay,
                rows: modalRows,
                row: 0
            };

            if (modalRows.length) {
                addClass(modalRows[0][0], 'focus');
            }
        },

        close: function () {
            if (!state.modal) return;

            if (state.modal.overlay &&
                state.modal.overlay.parentNode) {

                state.modal.overlay.parentNode.removeChild(
                    state.modal.overlay
                );
            }

            state.modal = null;

            Focus.render();
        },

        move: function (direction) {
            if (!state.modal) return;

            var rows = state.modal.rows;

            if (!rows.length) return;

            removeClass(
                rows[state.modal.row][0],
                'focus'
            );

            if (direction === 'up') {
                state.modal.row--;
            }

            if (direction === 'down') {
                state.modal.row++;
            }

            state.modal.row = Math.max(
                0,
                Math.min(
                    state.modal.row,
                    rows.length - 1
                )
            );

            addClass(
                rows[state.modal.row][0],
                'focus'
            );
        },

        enter: function () {
            if (!state.modal) return;

            var node =
                state.modal.rows[state.modal.row] &&
                state.modal.rows[state.modal.row][0];

            if (node) node.click();
        }
    };

    /* ============================================================
     * VIEW
     * ============================================================ */

    var View = {

        init: function () {
            injectCSS();

            state.root = el('div', 'cm9-root');

            document.body.appendChild(state.root);

            this.bindEvents();
            this.main();

            return state.root;
        },

        clear: function () {
            if (state.root) {
                state.root.innerHTML = '';
            }
        },

        header: function (showSearch) {
            var header = el('div', 'cm9-header');

            var back = el(
                'div',
                'cm9-icon-btn',
                ICON.back
            );

            back.setAttribute(
                'data-action',
                state.view === 'details' ?
                    'back_main' :
                    'exit'
            );

            header.appendChild(back);

            var right = el(
                'div',
                'cm9-header-right'
            );

            if (showSearch) {
                var search = el(
                    'div',
                    'cm9-icon-btn',
                    ICON.search
                );

                search.setAttribute(
                    'data-action',
                    'search'
                );

                right.appendChild(search);
            }

            var settings = el(
                'div',
                'cm9-icon-btn',
                ICON.settings
            );

            settings.setAttribute(
                'data-action',
                'settings'
            );

            right.appendChild(settings);

            header.appendChild(right);

            state.root.appendChild(header);

            return {
                back: back,
                search: search,
                settings: settings
            };
        },

        robot: function (message) {
            var robot = el('div', 'cm9-robot');

            var robotBox = el(
                'div',
                'cm9-robot-box',
                ICON.robot
            );

            robotBox.setAttribute(
                'data-action',
                'robot'
            );

            var bubble = el(
                'div',
                'cm9-bubble',
                esc(message || 'Готов помочь!')
            );

            bubble.id = 'cm9_robot_message';

            robot.appendChild(robotBox);
            robot.appendChild(bubble);

            state.root.appendChild(robot);

            return robotBox;
        },

        // FIX: добавлен requestId для защиты от устаревших ответов
        main: function (results) {
            state.view = 'main';
            var requestId = ++state.requestId;

            this.clear();

            var header = this.header(true);

            var content = el(
                'div',
                'cm9-content'
            );

            state.root.appendChild(content);

            var robot = this.robot(
                results && results.length ?
                    'Нашёл подходящие варианты.' :
                    'Готов подобрать фильм специально для тебя.'
            );

            var rows = [
                [header.back]
            ];

            if (header.search) {
                rows[0].push(header.search);
            }

            rows[0].push(header.settings);

            if (results) {
                this.renderSearch(content, results, rows, robot);
                return;
            }

            var loading = el(
                'div',
                'cm9-loading',
                'Загружаю рекомендации…'
            );

            content.appendChild(loading);

            Recommendations.load(function (data) {
                // FIX: проверка requestId для защиты от устаревших ответов
                if (state.destroyed ||
                    state.view !== 'main' ||
                    requestId !== state.requestId) return;

                content.innerHTML = '';

                var localRows = [
                    [header.back, header.search, header.settings]
                ];

                if (data.primary && data.primary.length) {
                    var row1 = View.makeRow(
                        content,
                        'Капсула дня',
                        data.historyCount ?
                            'на основе истории и избранного' :
                            'популярное сейчас',
                        data.primary
                    );

                    localRows.push(row1);
                }

                if (data.secondary && data.secondary.length) {
                    var row2 = View.makeRow(
                        content,
                        'Новое и неожиданное',
                        '',
                        data.secondary
                    );

                    localRows.push(row2);
                }

                localRows.push([robot]);

                // FIX: корректный расчёт фокуса при пустых данных
                var focusRow = localRows.length > 2 ? 1 : 0;
                Focus.setRows(localRows, focusRow, 0);

                View.setRobot(
                    data.historyCount ?
                        'Я проанализировал твою историю и собрал несколько вариантов.' :
                        'Истории пока мало, поэтому показываю популярное кино.'
                );
            });
        },

        renderSearch: function (
            content,
            results,
            rows,
            robot
        ) {
            var title =
                state.searchQuery ?
                    'Поиск: ' + esc(state.searchQuery) :
                    'Результаты поиска';

            var rowTitle = el(
                'div',
                'cm9-row-title',
                title
            );

            var row = el('div', 'cm9-row');
            var strip = el('div', 'cm9-strip');

            row.appendChild(rowTitle);
            row.appendChild(strip);

            var cards = [];

            results.forEach(function (movie) {
                var card = View.card(movie);

                strip.appendChild(card);
                cards.push(card);
            });

            if (!cards.length) {
                row.appendChild(
                    el(
                        'div',
                        'cm9-empty',
                        'Ничего не найдено.'
                    )
                );
            }

            content.appendChild(row);

            rows.push(cards);
            rows.push([robot]);

            Focus.setRows(rows, cards.length ? 1 : 0, 0);
        },

        makeRow: function (
            content,
            title,
            subtitle,
            movies
        ) {
            var row = el('div', 'cm9-row');

            var titleHtml =
                esc(title) +
                (
                    subtitle ?
                        '<span class="cm9-row-subtitle">' +
                        esc(subtitle) +
                        '</span>' :
                        ''
                );

            row.appendChild(
                el(
                    'div',
                    'cm9-row-title',
                    titleHtml
                )
            );

            var strip = el(
                'div',
                'cm9-strip'
            );

            var cards = [];

            movies.forEach(function (movie) {
                var card = View.card(movie);

                strip.appendChild(card);
                cards.push(card);
            });

            row.appendChild(strip);
            content.appendChild(row);

            return cards;
        },

        card: function (movie) {
            movie = Normalize.prepare(movie);

            var type = Normalize.mediaType(movie);
            var title = Normalize.title(movie);
            var year = Normalize.year(movie);
            var rating = Normalize.rating(movie);

            var card = el('div', 'cm9-card');

            card.setAttribute(
                'data-action',
                'details'
            );

            card._movieData = movie;

            var img = el('img');

            img.loading = 'lazy';
            img.src = TMDB.image(
                movie.poster_path,
                Config.getPosterSize()
            );

            img.onerror = function () {
                this.style.display = 'none';
            };

            card.appendChild(img);

            card.appendChild(
                el(
                    'div',
                    'cm9-type ' + (type === 'tv' ? 'tv' : ''),
                    type === 'tv' ? 'TV' : 'FILM'
                )
            );

            card.appendChild(
                el(
                    'div',
                    'cm9-rating',
                    rating
                )
            );

            if (year) {
                card.appendChild(
                    el(
                        'div',
                        'cm9-year',
                        year
                    )
                );
            }

            card.appendChild(
                el(
                    'div',
                    'cm9-title',
                    esc(title)
                )
            );

            return card;
        },

        details: function (movie) {
            state.view = 'details';
            state.movie = Normalize.prepare(movie);

            this.clear();

            var header = this.header(false);

            var wrapper = el(
                'div',
                'cm9-details'
            );

            var poster = el(
                'div',
                'cm9-poster'
            );

            var posterImg = el('img');

            posterImg.src = TMDB.image(
                state.movie.poster_path,
                'w500'
            );

            posterImg.onerror = function () {
                this.style.display = 'none';
            };

            poster.appendChild(posterImg);

            var info = el(
                'div',
                'cm9-info'
            );

            var title = Normalize.title(
                state.movie
            );

            var year = Normalize.year(
                state.movie
            );

            var type = Normalize.mediaType(
                state.movie
            );

            info.appendChild(
                el(
                    'div',
                    'cm9-detail-title',
                    esc(title)
                )
            );

            info.appendChild(
                el(
                    'div',
                    'cm9-detail-meta',
                    esc(
                        [
                            year,
                            type === 'tv' ?
                                'Сериал' :
                                'Фильм',
                            '★ ' +
                                Normalize.rating(
                                    state.movie
                                )
                        ]
                        .filter(Boolean)
                        .join(' · ')
                    )
                )
            );

            var overview = state.movie.overview ||
                'Описание отсутствует.';

            info.appendChild(
                el(
                    'div',
                    'cm9-overview',
                    esc(overview)
                )
            );

            var actions = el(
                'div',
                'cm9-actions'
            );

            var actionList = [
                {
                    action: 'watch',
                    title: '▶ Смотреть'
                },
                {
                    action: 'recommendations',
                    title: '✨ Похожие'
                },
                {
                    action: 'cast',
                    title: '🎭 Актёры'
                },
                {
                    action: 'keywords',
                    title: '🏷 Темы'
                }
            ];

            var actionNodes = [];

            actionList.forEach(function (item) {
                var button = el(
                    'div',
                    'cm9-action',
                    esc(item.title)
                );

                button.setAttribute(
                    'data-action',
                    item.action
                );

                actions.appendChild(button);
                actionNodes.push(button);
            });

            info.appendChild(actions);

            wrapper.appendChild(poster);
            wrapper.appendChild(info);

            state.root.appendChild(wrapper);

            Focus.setRows(
                [
                    [header.back],
                    actionNodes
                ],
                1,
                0
            );

            this.loadDetails(state.movie);
        },

        loadDetails: function (movie) {
            var requestId = ++state.requestId;

            Engine.details(
                movie,
                function (error, data) {

                    if (state.destroyed ||
                        state.view !== 'details' ||
                        requestId !== state.requestId) {
                        return;
                    }

                    if (error || !data) return;

                    state.movie = data;

                    var overview = $('.cm9-overview');

                    if (overview) {
                        overview.textContent =
                            data.overview ||
                            'Описание отсутствует.';
                    }

                    View.setRobot(
                        'Если хочешь, могу показать актёров, похожие фильмы и основные темы.'
                    );
                }
            );
        },

        setRobot: function (message) {
            var node = $('#cm9_robot_message');

            if (node) {
                node.textContent = message;
            }
        }
    };

    /* ============================================================
     * ACTIONS
     * ============================================================ */

    function openSearch() {
        var previous = state.searchQuery || '';

        if (window.Lampa &&
            Lampa.Input &&
            typeof Lampa.Input.edit === 'function') {

            Lampa.Input.edit(
                {
                    title: 'Поиск фильмов',
                    value: previous,
                    free: true
                },
                function (value) {
                    value = String(value || '').trim();

                    if (!value) return;

                    state.searchQuery = value;

                    View.setRobot(
                        'Ищу: ' + value + '…'
                    );

                    Engine.search(
                        value,
                        function (error, results) {

                            if (error) {
                                notify(
                                    'Ошибка поиска: ' +
                                    error
                                );

                                return;
                            }

                            state.searchResults =
                                results || [];

                            View.main(
                                state.searchResults
                            );

                            View.setRobot(
                                state.searchResults.length ?
                                    'Нашёл ' +
                                    state.searchResults.length +
                                    ' вариантов.' :
                                    'По этому запросу ничего не найдено.'
                            );
                        }
                    );
                }
            );

            return;
        }

        var value;

        try {
            value = prompt(
                'Введите название, жанр или актёра:',
                previous
            );
        } catch (e) {
            value = '';
        }

        if (!value) return;

        state.searchQuery = value;

        Engine.search(
            value,
            function (error, results) {
                if (error) {
                    notify('Ошибка поиска');
                    return;
                }

                state.searchResults =
                    results || [];

                View.main(
                    state.searchResults
                );
            }
        );
    }

    // FIX: добавлен requestId для защиты от устаревших ответов
    function openGenres() {
        var buttons = [];

        Object.keys(GENRES).forEach(function (id) {
            buttons.push({
                title: GENRES[id],
                onClick: function () {
                    var query = GENRES[id];

                    state.searchQuery = query;

                    var requestId = ++state.requestId;

                    Engine.discoverByGenres(
                        [parseInt(id, 10)],
                        function (results) {

                            // FIX: проверка requestId
                            if (state.destroyed || requestId !== state.requestId) return;

                            state.searchResults =
                                results || [];

                            View.main(
                                state.searchResults
                            );

                            View.setRobot(
                                results.length ?
                                    'Подобрал фильмы в жанре «' +
                                    query +
                                    '».' :
                                    'В этом жанре ничего не найдено.'
                            );
                        }
                    );
                }
            });
        });

        buttons.push({
            title: 'Назад',
            onClick: function () {
                openRobot();
            }
        });

        Modal.open(
            '🎬 Популярные жанры',
            'Выбери жанр:',
            buttons
        );
    }

    function openRobot() {
        Modal.open(
            '🤖 Помощник Капсулы',
            'Что будем делать?',
            [
                {
                    title: '🔎 Поиск фильма / актёра / темы',
                    onClick: openSearch
                },
                {
                    title: '🎬 Выбрать жанр',
                    onClick: openGenres
                },
                {
                    title: '✨ Обновить рекомендации',
                    onClick: function () {
                        View.main();

                        notify(
                            'Обновляю рекомендации…'
                        );
                    }
                },
                {
                    title: '✖ Закрыть'
                }
            ]
        );
    }

    function openSettings() {
        Modal.open(
            '⚙ Настройки Capsule Mod',
            'Настройки хранятся локально на устройстве.',
            [
                {
                    title: '🔑 TMDb API key',
                    onClick: function () {
                        editApiKey();
                    }
                },
                {
                    title: '🗑 Очистить кэш',
                    onClick: function () {
                        TMDB.cache = {};
                        notify(
                            'Кэш Capsule Mod очищен.'
                        );
                    }
                },
                {
                    title: '🧹 Сбросить настройки',
                    onClick: function () {
                        Storage.remove('tmdb_api_key');
                        Storage.remove('cache_minutes');
                        Storage.remove('include_adult');
                        Storage.remove('poster_size');

                        notify(
                            'Настройки сброшены.'
                        );
                    }
                },
                {
                    title: 'Назад',
                    onClick: function () {}
                }
            ]
        );
    }

    function editApiKey() {
        if (!(window.Lampa &&
            Lampa.Input &&
            typeof Lampa.Input.edit === 'function')) {

            notify(
                'Для ручного ввода API key нужен Lampa.Input.'
            );

            return;
        }

        Lampa.Input.edit(
            {
                title: 'TMDb API key',
                value: Config.getApiKey(),
                free: true
            },
            function (value) {
                value = String(value || '').trim();

                Storage.set(
                    'tmdb_api_key',
                    value
                );

                TMDB.cache = {};

                notify(
                    value ?
                        'TMDb API key сохранён.' :
                        'TMDb API key удалён.'
                );
            }
        );
    }

    function openCast() {
        var movie = state.movie;

        if (!movie) return;

        var cast =
            movie.credits &&
            movie.credits.cast;

        if (!cast || !cast.length) {
            Modal.open(
                '🎭 Актёры',
                'Информация об актёрах недоступна.',
                [
                    {
                        title: 'Закрыть'
                    }
                ]
            );

            return;
        }

        var html =
            '<div class="cm9-cast">';

        cast.slice(0, 20).forEach(function (person) {
            var image = person.profile_path ?
                TMDB.image(
                    person.profile_path,
                    'w185'
                ) :
                '';

            html +=
                '<div class="cm9-person">' +
                (
                    image ?
                        '<img src="' +
                        esc(image) +
                        '">' :
                        '<div class="cm9-person-img"></div>'
                ) +
                '<div>' +
                esc(person.name || '') +
                '</div>' +
                (
                    person.character ?
                        '<div style="color:#777;margin-top:.2em">' +
                        esc(person.character) +
                        '</div>' :
                        ''
                ) +
                '</div>';
        });

        html += '</div>';

        Modal.open(
            '🎭 Актёры',
            html,
            [
                {
                    title: 'Закрыть'
                }
            ]
        );
    }

    function openKeywords() {
        var movie = state.movie;

        if (!movie) return;

        var keywords = [];

        if (movie.keywords) {
            if (Array.isArray(movie.keywords.keywords)) {
                keywords =
                    movie.keywords.keywords;
            }

            if (Array.isArray(movie.keywords.results)) {
                keywords =
                    movie.keywords.results;
            }
        }

        if (!keywords.length) {
            Modal.open(
                '🏷 Темы',
                'Ключевые слова отсутствуют.',
                [
                    {
                        title: 'Закрыть'
                    }
                ]
            );

            return;
        }

        var html = keywords
            .slice(0, 30)
            .map(function (item) {
                return '<span style="' +
                    'display:inline-block;' +
                    'padding:.35em .6em;' +
                    'margin:.2em;' +
                    'background:#22262b;' +
                    'border-radius:.5em;' +
                    'color:#ccc;">' +
                    esc(item.name) +
                    '</span>';
            })
            .join('');

        Modal.open(
            '🏷 Темы',
            html,
            [
                {
                    title: 'Закрыть'
                }
            ]
        );
    }

    // FIX: добавлен requestId для защиты от устаревших ответов
    function openRecommendations() {
        var movie = state.movie;

        if (!movie) return;

        notify(
            'Загружаю похожие фильмы…'
        );

        var requestId = ++state.requestId;

        Engine.recommendations(
            movie,
            function (results) {

                // FIX: проверка requestId
                if (state.destroyed || requestId !== state.requestId) return;

                if (!results.length) {
                    Modal.open(
                        '✨ Похожие фильмы',
                        'Похожие фильмы не найдены.',
                        [
                            {
                                title: 'Закрыть'
                            }
                        ]
                    );

                    return;
                }

                state.searchQuery =
                    'Похожие на ' +
                    Normalize.title(movie);

                state.searchResults =
                    results;

                View.main(results);
            }
        );
    }

    function watchMovie() {
        var movie = state.movie;

        if (!movie) return;

        if (window.Lampa &&
            Lampa.Activity &&
            typeof Lampa.Activity.push === 'function') {

            Lampa.Activity.push({
                url: '',
                title: Normalize.title(movie),
                component: 'full',
                id: movie.id,
                method: Normalize.mediaType(movie),
                card: movie,
                source: 'tmdb'
            });

            return;
        }

        notify(
            'Не удалось открыть карточку фильма.'
        );
    }

    function handleAction(action, target) {

        switch (action) {

            case 'exit':
                exitCapsule();
                break;

            case 'back_main':
                View.main();
                break;

            case 'search':
                openSearch();
                break;

            case 'settings':
                openSettings();
                break;

            case 'robot':
                openRobot();
                break;

            case 'details':
                if (target && target._movieData) {
                    View.details(
                        target._movieData
                    );
                }
                break;

            case 'watch':
                watchMovie();
                break;

            case 'cast':
                openCast();
                break;

            case 'keywords':
                openKeywords();
                break;

            case 'recommendations':
                openRecommendations();
                break;
        }
    }

    function exitCapsule() {
        Modal.close();

        if (window.Lampa &&
            Lampa.Activity &&
            typeof Lampa.Activity.backward === 'function') {

            Lampa.Activity.backward();
        }
    }

    /* ============================================================
     * EVENTS
     * ============================================================ */

    function onClick(event) {
        if (state.destroyed) return;

        var target = closest(
            event.target,
            '[data-action]'
        );

        if (!target) return;

        handleAction(
            target.getAttribute('data-action'),
            target
        );
    }

    // FIX: добавлена проверка isInput для предотвращения блокировки ввода
    function onKeyDown(event) {
        if (state.destroyed) return;

        var key = event.key;
        var tag = event.target && event.target.tagName;
        var isInput = tag === 'INPUT' || tag === 'TEXTAREA' || 
                      (event.target.isContentEditable);

        if (state.modal) {
            // Не перехватываем ввод в модалке
            if (isInput) return;

            if (
                key === 'ArrowUp' ||
                key === 'ArrowDown'
            ) {
                event.preventDefault();

                Modal.move(
                    key === 'ArrowUp' ?
                        'up' :
                        'down'
                );

                return;
            }

            if (
                key === 'Enter' ||
                key === 'NumpadEnter'
            ) {
                event.preventDefault();
                Modal.enter();
                return;
            }

            if (
                key === 'Escape' ||
                key === 'Backspace' ||
                event.keyCode === 461 ||
                event.keyCode === 10009
            ) {
                event.preventDefault();
                Modal.close();
                return;
            }

            return;
        }

        // Не перехватываем ввод вне модалки
        if (isInput) return;

        if (key === 'ArrowUp' ||
            key === 'ArrowDown' ||
            key === 'ArrowLeft' ||
            key === 'ArrowRight') {

            event.preventDefault();

            Focus.move(
                key === 'ArrowUp' ?
                    'up' :
                key === 'ArrowDown' ?
                    'down' :
                key === 'ArrowLeft' ?
                    'left' :
                    'right'
            );

            return;
        }

        if (
            key === 'Enter' ||
            key === 'NumpadEnter'
        ) {
            event.preventDefault();

            var current = Focus.current();

            if (current) {
                handleAction(
                    current.getAttribute(
                        'data-action'
                    ),
                    current
                );
            }

            return;
        }

        if (
            key === 'Escape' ||
            key === 'Backspace' ||
            event.keyCode === 461 ||
            event.keyCode === 10009
        ) {
            event.preventDefault();

            if (state.view === 'details') {
                View.main();
            } else {
                exitCapsule();
            }

            return;
        }

        if (key === 'Tab') {
            event.preventDefault();

            Focus.move(
                event.shiftKey ?
                    'left' :
                    'right'
            );
        }
    }

    function onTouchStart(event) {
        if (state.modal || !event.touches.length) return;

        state.touchStartX =
            event.touches[0].clientX;

        state.touchStartY =
            event.touches[0].clientY;

        state.touchStartTime = now();
    }

    function onTouchEnd(event) {
        if (state.modal ||
            !event.changedTouches.length) {
            return;
        }

        var dx =
            state.touchStartX -
            event.changedTouches[0].clientX;

        var dy =
            state.touchStartY -
            event.changedTouches[0].clientY;

        var elapsed =
            now() -
            state.touchStartTime;

        state.touchStartX = 0;
        state.touchStartY = 0;

        if (elapsed > 500) return;

        var threshold = 45;

        if (
            Math.abs(dx) < threshold &&
            Math.abs(dy) < threshold
        ) {
            return;
        }

        if (Math.abs(dx) > Math.abs(dy)) {
            Focus.move(
                dx > 0 ?
                    'right' :
                    'left'
            );
        } else {
            Focus.move(
                dy > 0 ?
                    'down' :
                    'up'
            );
        }
    }

    function bindGlobalEvents() {
        document.addEventListener(
            'click',
            onClick,
            true
        );

        document.addEventListener(
            'keydown',
            onKeyDown,
            true
        );

        document.addEventListener(
            'touchstart',
            onTouchStart,
            {
                passive: true
            }
        );

        document.addEventListener(
            'touchend',
            onTouchEnd,
            {
                passive: true
            }
        );
    }

    function unbindGlobalEvents() {
        document.removeEventListener(
            'click',
            onClick,
            true
        );

        document.removeEventListener(
            'keydown',
            onKeyDown,
            true
        );

        document.removeEventListener(
            'touchstart',
            onTouchStart
        );

        document.removeEventListener(
            'touchend',
            onTouchEnd
        );
    }

    /* ============================================================
     * LAMPA CONTROLLER
     * ============================================================ */

    function registerController() {
        if (!window.Lampa ||
            !Lampa.Controller ||
            typeof Lampa.Controller.add !== 'function') {
            return;
        }

        try {
            Lampa.Controller.add(
                CONTROLLER,
                {
                    toggle: function () {
                        Focus.render();
                    },

                    up: function () {
                        if (state.modal) {
                            Modal.move('up');
                        } else {
                            Focus.move('up');
                        }
                    },

                    down: function () {
                        if (state.modal) {
                            Modal.move('down');
                        } else {
                            Focus.move('down');
                        }
                    },

                    left: function () {
                        if (!state.modal) {
                            Focus.move('left');
                        }
                    },

                    right: function () {
                        if (!state.modal) {
                            Focus.move('right');
                        }
                    },

                    enter: function () {
                        if (state.modal) {
                            Modal.enter();
                            return;
                        }

                        var current =
                            Focus.current();

                        if (current) {
                            handleAction(
                                current.getAttribute(
                                    'data-action'
                                ),
                                current
                            );
                        }
                    },

                    back: function () {
                        if (state.modal) {
                            Modal.close();
                            return;
                        }

                        if (state.view === 'details') {
                            View.main();
                        } else {
                            exitCapsule();
                        }
                    },

                    pageUp: function () {
                        Focus.move('up');
                    },

                    pageDown: function () {
                        Focus.move('down');
                    },

                    home: function () {
                        View.main();
                    },

                    menu: function () {
                        openRobot();
                    }
                }
            );

            if (typeof Lampa.Controller.toggle === 'function') {
                Lampa.Controller.toggle(
                    CONTROLLER
                );
            }

        } catch (e) {
            console.log(
                '[Capsule Mod] Controller error',
                e
            );
        }
    }

    function unregisterController() {
        try {
            if (window.Lampa &&
                Lampa.Controller &&
                typeof Lampa.Controller.remove === 'function') {

                Lampa.Controller.remove(
                    CONTROLLER
                );
            }
        } catch (e) {}
    }

    /* ============================================================
     * COMPONENT
     * ============================================================ */

    function CapsuleComponent() {

        var html;

        this.create = function () {
            state.destroyed = false;

            html = View.init();

            bindGlobalEvents();

            return html;
        };

        this.render = function () {
            return html;
        };

        this.start = function () {
            registerController();

            setTimeout(function () {
                if (!state.destroyed) {
                    Focus.render();
                }
            }, 50);
        };

        this.pause = function () {};

        this.stop = function () {};

        // FIX: правильная очистка состояния при уничтожении
        this.destroy = function () {
            state.destroyed = true;

            Modal.close();
            unbindGlobalEvents();
            unregisterController();

            if (html &&
                html.parentNode) {

                html.parentNode.removeChild(
                    html
                );
            }

            state.root = null;
            state.movie = null;
            state.searchResults = [];
            state.lastRows = [];
            state.searchQuery = '';
            state.view = 'main';
            
            // Очищаем Focus состояние
            Focus.rows = [];
            Focus.row = 0;
            Focus.col = 0;
        };
    }

    /* ============================================================
     * MENU
     * ============================================================ */

    function openCapsule() {
        if (!window.Lampa ||
            !Lampa.Activity ||
            typeof Lampa.Activity.push !== 'function') {
            return;
        }

        try {
            Lampa.Activity.push({
                url: '',
                title: 'Capsule Mod',
                component: COMPONENT,
                page: 1
            });
        } catch (e) {
            console.log(
                '[Capsule Mod] Activity error',
                e
            );
        }
    }

    function addMenuItemLegacy() {
        var attempts = 0;

        var timer = setInterval(function () {
            attempts++;

            if (attempts > 30) {
                clearInterval(timer);
                return;
            }

            try {
                if (document.querySelector(
                    '[data-capsule-mod-entry]'
                )) {
                    clearInterval(timer);
                    return;
                }

                var list =
                    document.querySelector(
                        '.menu .menu__list'
                    );

                if (!list) return;

                var item = el(
                    'li',
                    'menu__item selector'
                );

                item.setAttribute(
                    'data-capsule-mod-entry',
                    '1'
                );

                item.innerHTML =
                    '<div class="menu__ico">' +
                    ICON.play +
                    '</div>' +
                    '<div class="menu__text">' +
                    'Capsule Mod' +
                    '</div>';

                item.onclick = openCapsule;

                list.appendChild(item);

                clearInterval(timer);

            } catch (e) {}
        }, 500);
    }

    function addMenuItemModern() {
        try {
            if (!window.Lampa ||
                !Lampa.Menu ||
                typeof Lampa.Menu.addButton !== 'function') {
                return false;
            }

            Lampa.Menu.addButton(
                ICON.play,
                'Capsule Mod',
                openCapsule
            );

            return true;

        } catch (e) {
            return false;
        }
    }

    function registerMenu() {
        if (addMenuItemModern()) return;

        addMenuItemLegacy();
    }

    /* ============================================================
     * MANIFEST
     * ============================================================ */

    function registerManifest() {
        try {
            if (!window.Lampa) return;

            if (!Lampa.Manifest) {
                Lampa.Manifest = {};
            }

            var manifest = {
                type: 'other',
                version: VERSION,
                name: 'Capsule Mod',
                description:
                    'Умный рекомендательный хаб для фильмов и сериалов',
                component: COMPONENT
            };

            if (Array.isArray(
                Lampa.Manifest.plugins
            )) {

                var exists =
                    Lampa.Manifest.plugins.some(
                        function (plugin) {
                            return plugin &&
                                plugin.component ===
                                COMPONENT;
                        }
                    );

                if (!exists) {
                    Lampa.Manifest.plugins.push(
                        manifest
                    );
                }

            } else {
                Lampa.Manifest.plugins =
                    Lampa.Manifest.plugins || {};

                Lampa.Manifest.plugins[
                    COMPONENT
                ] = manifest;
            }

        } catch (e) {}
    }

    /* ============================================================
     * START
     * ============================================================ */

    function start() {

        if (window.__CAPSULE_MOD_V9_STARTED__) {
            return;
        }

        window.__CAPSULE_MOD_V9_STARTED__ = true;

        try {
            if (window.Lampa &&
                Lampa.Component &&
                typeof Lampa.Component.add === 'function') {

                Lampa.Component.add(
                    COMPONENT,
                    CapsuleComponent
                );
            } else {
                console.log(
                    '[Capsule Mod] Lampa.Component недоступен'
                );
                return;
            }

            registerManifest();
            registerMenu();

            console.log(
                '[Capsule Mod] v' +
                VERSION +
                ' loaded'
            );

        } catch (e) {

            console.error(
                '[Capsule Mod] Startup error:',
                e
            );
        }
    }

    // FIX: добавлен счётчик попыток для предотвращения бесконечного цикла
    function bootstrap() {
        var attempts = 0;

        function tryStart() {
            attempts++;

            if (!window.Lampa) {
                // Максимум 40 попыток = 10 секунд
                if (attempts < 40) {
                    setTimeout(tryStart, 250);
                }
                return;
            }

            if (window.appready) {
                start();
                return;
            }

            if (Lampa.Listener &&
                typeof Lampa.Listener.follow === 'function') {

                Lampa.Listener.follow(
                    'app',
                    function (event) {
                        if (event.type === 'ready') {
                            start();
                        }
                    }
                );

                setTimeout(
                    function () {
                        if (window.appready) {
                            start();
                        }
                    },
                    1500
                );

            } else {
                setTimeout(
                    start,
                    500
                );
            }
        }

        tryStart();
    }

    bootstrap();

})();
