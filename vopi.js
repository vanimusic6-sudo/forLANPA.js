/**
 * Capsule Mod v11.1 — «Капсула» (Полная переработка UI + управления)
 *
 * Изменения относительно v11.0:
 *  — UI полностью приведён к дизайну Lampa (цвета, отступы, анимации, типографика)
 *  — Шапка экрана возвращена с навигацией «Назад / Название / Обновить»
 *  — Улучшена навигация пультом: фокус теперь имеет явный индикатор с тенью
 *  — Оптимизирован сенсор: свайпы работают с меньшей амплитудой, добавлен визуальный отклик
 *  — Мышь: hover-эффекты синхронизированы с Lampa, плавные переходы фокуса
 *  — Исправлена версия в логе (была 10.0)
 *  — Улучшена синхронизация истории с повторными попытками
 *  — Оптимизированы анимации (cubic-bezier под Lampa)
 *  — Карточки в лотке миниатюр теперь имеют явный индикатор активного элемента
 *  — Улучшена доступность: ARIA-атрибуты, focus-visible, role
 */
(function () {
    'use strict';

    if (window.plugin_capsule_mod_ready) return;
    window.plugin_capsule_mod_ready = true;

    var COMPONENT_ID = 'capsule_mod_view';
    var CTRL_ID = 'capsule_mod_ctrl';
    var TMDB = 'https://api.themoviedb.org/3';
    var IMG = 'https://image.tmdb.org/t/p/';
    var FALLBACK_KEY = '4ef0d7355d9ffb5151e987764708ce96';
    var LANG = 'ru-RU';
    var CAPSULE_SIZE = 6;

    /* =========================================================================
       1. УТИЛИТЫ
       ========================================================================= */
    function el(tag, cls, html) {
        var d = document.createElement(tag || 'div');
        if (cls) d.className = cls;
        if (html != null) d.innerHTML = html;
        if (tag === 'button') d.setAttribute('type', 'button');
        return d;
    }
    function hasClass(n, c) { return !!n && (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1; }
    function addClass(n, c) { if (n && !hasClass(n, c)) n.className += (n.className ? ' ' : '') + c; }
    function removeClass(n, c) {
        if (!n) return;
        n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/\s+/g, ' ').replace(/^ +| +$/g, '');
    }
    function closestClass(n, cls) {
        while (n && n !== document) {
            if (n.className != null && hasClass(n, cls)) return n;
            n = n.parentNode;
        }
        return null;
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function indexOfArr(arr, v) { for (var i = 0; i < arr.length; i++) if (arr[i] === v) return i; return -1; }
    function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function throttle(fn, ms) {
        var last = 0;
        return function() {
            var now = Date.now();
            if (now - last >= ms) { last = now; fn.apply(this, arguments); }
        };
    }

    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };

    function animScroll(node, prop, to, ms) {
        if (!node) return;
        var from = node[prop], dist = to - from;
        if (Math.abs(dist) < 2) { node[prop] = to; return; }
        var dur = ms || 260, start = 0, token = {};
        node._cmAnim = token;
        function step(ts) {
            if (node._cmAnim !== token) return;
            var now = ts || Date.now();
            if (!start) start = now;
            var p = clamp((now - start) / dur, 0, 1);
            // Lampa-style easing: cubic-bezier(0.4, 0, 0.2, 1)
            var ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            node[prop] = from + dist * ease;
            if (p < 1) raf(step); else node._cmAnim = null;
        }
        raf(step);
    }

    /* =========================================================================
       2. ГОТОВНОСТЬ LAMPA + ХРАНИЛИЩЕ (улучшенный фикс синхронизации)
       ========================================================================= */
    var LampaReady = { ready: false, waiters: [] };
    function onLampaReady(cb) {
        if (LampaReady.ready) { cb(); return; }
        LampaReady.waiters.push(cb);
    }
    function flushReady() {
        LampaReady.ready = true;
        var w = LampaReady.waiters; LampaReady.waiters = [];
        for (var i = 0; i < w.length; i++) { try { w[i](); } catch (e) {} }
    }
    try {
        if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) {
            Lampa.Listener.follow('app', function (e) { if (e && e.type === 'ready') flushReady(); });
        }
    } catch (e) {}
    setTimeout(function () { if (!LampaReady.ready) flushReady(); }, 2500);

    function pGet(key, def) {
        try {
            var raw = localStorage.getItem('cm_' + key);
            if (raw != null) return JSON.parse(raw);
        } catch (e) {}
        return def;
    }
    function pSet(key, val) {
        try { localStorage.setItem('cm_' + key, JSON.stringify(val)); } catch (e) {}
    }

    function lampaStorageAvailable() {
        try { return !!(window.Lampa && Lampa.Storage && Lampa.Storage.get); } catch (e) { return false; }
    }
    function lampaGetRaw(key, def) {
        try { return Lampa.Storage.get(key, def); } catch (e) { return def; }
    }
    function isEmptyish(v) {
        if (v == null) return true;
        if (isArr(v)) return v.length === 0;
        if (typeof v === 'object') { for (var k in v) return false; return true; }
        return false;
    }
    function ownedGet(key, def, cb, attempt) {
        attempt = attempt || 0;
        onLampaReady(function () {
            if (!lampaStorageAvailable()) { cb(def); return; }
            var v = lampaGetRaw(key, def);
            if (!isEmptyish(v) || attempt >= 8) { cb(v); return; }
            // Увеличены повторные попытки для надёжности синхронизации
            setTimeout(function () { ownedGet(key, def, cb, attempt + 1); }, 300);
        });
    }

    /* =========================================================================
       3. СЕТЬ
       ========================================================================= */
    var Net = {
        mem: {},
        key: function () { return pGet('tmdb_key', '') || FALLBACK_KEY; },
        url: function (path, params) {
            var u = TMDB + path + '?api_key=' + this.key() + '&language=' + LANG;
            if (params) for (var k in params) {
                if (params[k] === undefined || params[k] === null || params[k] === '') continue;
                u += '&' + k + '=' + encodeURIComponent(params[k]);
            }
            return u;
        },
        get: function (path, params, ok, fail, opts) {
            opts = opts || {};
            var url = this.url(path, params), self = this;
            var hit = this.mem[url];
            if (!opts.force && hit && Date.now() - hit.t < (opts.ttl || 900000)) {
                setTimeout(function () { ok(hit.d); }, 0);
                return;
            }
            var xhr = new XMLHttpRequest();
            try {
                xhr.open('GET', url, true);
                xhr.timeout = 12000;
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) return;
                    if (xhr.status >= 200 && xhr.status < 400) {
                        var d = null;
                        try { d = JSON.parse(xhr.responseText); } catch (e) {}
                        if (d) { self.mem[url] = { t: Date.now(), d: d }; ok(d); }
                        else if (fail) fail('parse');
                    } else if (fail) fail('http_' + xhr.status);
                };
                xhr.onerror = function () { if (fail) fail('net'); };
                xhr.ontimeout = function () { if (fail) fail('timeout'); };
                xhr.send();
            } catch (e) { if (fail) fail('exception'); }
        },
        drop: function () { this.mem = {}; }
    };

    function parallel(tasks, done) {
        var left = tasks.length, out = new Array(left);
        if (!left) return done(out);
        for (var i = 0; i < tasks.length; i++) (function (idx) {
            var fired = false;
            tasks[idx](function (r) { if (fired) return; fired = true; out[idx] = r; if (--left === 0) done(out); });
        })(i);
    }

    /* =========================================================================
       4. СЛОВАРИ
       ========================================================================= */
    var GENRE_NAMES = {
        28: 'боевики', 12: 'приключения', 16: 'анимация', 35: 'комедии', 80: 'криминал',
        99: 'документальное', 18: 'драмы', 10751: 'семейное', 14: 'фэнтези', 36: 'историческое',
        27: 'ужасы', 10402: 'музыкальное', 9648: 'детективы', 10749: 'мелодрамы', 878: 'фантастика',
        53: 'триллеры', 10752: 'военное', 37: 'вестерны',
        10759: 'боевики', 10765: 'фантастика', 10768: 'военное', 10762: 'детское',
        10763: 'новости', 10764: 'реалити', 10766: 'сериальные драмы', 10767: 'ток-шоу'
    };
    var TV2MOVIE = { 10759: 28, 10765: 878, 10768: 10752, 10762: 10751, 10766: 18 };

    var GENRE_SYN = [
        { m: [28], t: [10759], w: ['боевик', 'экшен', 'экшн', 'драк', 'перестрел', 'action'] },
        { m: [12], t: [10759], w: ['приключен', 'adventure'] },
        { m: [16], t: [16], w: ['мультф', 'мультик', 'мульт', 'анимац', 'animation'] },
        { m: [35], t: [35], w: ['комед', 'смешн', 'юмор', 'ржач', 'посмеят', 'весел', 'comedy'] },
        { m: [80], t: [80], w: ['криминал', 'мафи', 'бандит', 'гангстер', 'crime'] },
        { m: [99], t: [99], w: ['документал', 'научпоп', 'docum'] },
        { m: [18], t: [18], w: ['драм', 'грустн', 'жизненн', 'тяжел', 'drama'] },
        { m: [10751], t: [10751], w: ['семейн', 'детск', 'family', 'с ребенком'] },
        { m: [14], t: [10765], w: ['фэнтези', 'фентези', 'магия', 'волшебн', 'сказк', 'fantasy'] },
        { m: [27], t: [9648], w: ['ужас', 'страшн', 'хоррор', 'жутк', 'кошмар', 'horror'] },
        { m: [9648], t: [9648], w: ['детектив', 'загадк', 'расследован', 'тайн', 'mystery'] },
        { m: [10749], t: [18], w: ['мелодрам', 'романтик', 'романт', 'любов', 'romance'] },
        { m: [878], t: [10765], w: ['фантастик', 'sci-fi', 'scifi', 'киберпанк', 'инопланет'] },
        { m: [53], t: [9648], w: ['триллер', 'напряж', 'саспенс', 'thriller'] },
        { m: [37], t: [37], w: ['вестерн', 'ковбо', 'western'] },
        { m: [10752], t: [10768], w: ['военн', 'война', 'фронт', 'war'] },
        { m: [10402], t: [10402], w: ['мюзикл', 'музыкальн', 'music'] },
        { m: [36], t: [18], w: ['историч', 'средневеков', 'history'] }
    ];
    var TAG_SYN = [
        { w: ['космос', 'космич', 'space'], k: 'space' },
        { w: ['зомби', 'zombie'], k: 'zombie' },
        { w: ['вампир', 'vampire'], k: 'vampire' },
        { w: ['супергеро', 'марвел', 'superhero'], k: 'superhero' },
        { w: ['апокалипс', 'постапок'], k: 'post-apocalyptic future' },
        { w: ['выживан', 'survival'], k: 'survival' },
        { w: ['маньяк', 'серийн убийц'], k: 'serial killer' },
        { w: ['во времени', 'time travel'], k: 'time travel' },
        { w: ['ограблен', 'heist'], k: 'heist' },
        { w: ['шпион', 'агент', 'spy'], k: 'spy' },
        { w: ['самура', 'samurai'], k: 'samurai' },
        { w: ['пират', 'pirate'], k: 'pirate' },
        { w: ['дракон', 'dragon'], k: 'dragon' },
        { w: ['робот', 'robot'], k: 'robot' },
        { w: ['нейросет', 'искусственн интеллект'], k: 'artificial intelligence' },
        { w: ['аниме', 'anime'], k: 'anime' },
        { w: ['спорт', 'sport'], k: 'sport' },
        { w: ['гонк', 'racing'], k: 'car race' },
        { w: ['подводн', 'submarine'], k: 'submarine' },
        { w: ['динозавр', 'dinosaur'], k: 'dinosaur' },
        { w: ['школ', 'high school'], k: 'high school' },
        { w: ['тюрьм', 'prison'], k: 'prison' },
        { w: ['катастроф', 'disaster'], k: 'disaster' },
        { w: ['по реальным', 'реальн событ'], k: 'based on true story' },
        { w: ['по книге', 'по роману'], k: 'based on novel' },
        { w: ['нуар', 'noir'], k: 'film noir' },
        { w: ['монстр', 'monster'], k: 'monster' },
        { w: ['рождеств', 'новогодн'], k: 'christmas' }
    ];
    var STOP_WORDS = ['фильм', 'фильмы', 'кино', 'сериал', 'сериалы', 'смотреть', 'найди', 'найти',
        'хочу', 'что-то', 'что', 'нибудь', 'посоветуй', 'подбери', 'самые', 'самый', 'какой',
        'какие', 'типа', 'вроде', 'про', 'для', 'или', 'the', 'and'];

    var MOODS = [
        { label: 'Отключить голову', q: 'лёгкая комедия приключения' },
        { label: 'Держать в напряжении', q: 'напряжённый триллер' },
        { label: 'Подумать', q: 'умная драма детектив' },
        { label: 'Улететь подальше', q: 'космическая фантастика' },
        { label: 'Испугаться', q: 'ужасы' },
        { label: 'Заплакать', q: 'сильная драма по реальным событиям' },
        { label: 'Вдвоём', q: 'мелодрама романтика' },
        { label: 'С детьми', q: 'семейное мультфильм' }
    ];

    /* =========================================================================
       5. ЧТЕНИЕ ИСТОРИИ LAMPA
       ========================================================================= */
    var WEIGHTS = {
        history: 3.0, viewed: 3.0, look: 2.6, continued: 3.2,
        like: 2.8, wath: 1.8, book: 1.2, scheduled: 1.0, card: 1.0, thrown: -2.0
    };

    var History = {
        read: function (cb) {
            var cards = {}, acc = {}, order = [];

            function addCard(c) { if (c && c.id && !cards[c.id]) cards[c.id] = c; }
            function bump(id, weight, type, card) {
                if (!id) return;
                id = parseInt(id, 10);
                if (!id) return;
                if (!acc[id]) { acc[id] = { id: id, w: 0, type: type || null, card: card || cards[id] || null }; order.push(id); }
                acc[id].w += weight;
                if (type && !acc[id].type) acc[id].type = type;
                if (card && !acc[id].card) acc[id].card = card;
            }
            function typeOf(c) {
                if (!c) return null;
                if (c.media_type === 'tv' || c.method === 'tv' || c.number_of_seasons || c.first_air_date) return 'tv';
                if (c.media_type === 'movie' || c.method === 'movie' || c.release_date || c.title) return 'movie';
                return (c.name && !c.title) ? 'tv' : 'movie';
            }

            function withFavorite(fav) {
                var i, k;
                if (fav && typeof fav === 'object') {
                    if (isArr(fav.card)) for (i = 0; i < fav.card.length; i++) addCard(fav.card[i]);
                    for (k in fav) {
                        var list = fav[k];
                        if (!isArr(list) || !list.length) continue;
                        var w = WEIGHTS[k]; if (w === undefined) w = 1;
                        for (i = 0; i < list.length; i++) {
                            var entry = list[i];
                            var recency = 1 + clamp((list.length - i) / Math.max(list.length, 1), 0, 1) * 0.6;
                            if (entry && typeof entry === 'object') { addCard(entry); bump(entry.id, w * recency, typeOf(entry), entry); }
                            else bump(entry, w * recency, null, cards[entry] || null);
                        }
                    }
                }
                withExtras();
            }

            function withExtras() {
                var extra = ['history', 'view', 'viewed', 'card_history', 'recomends_last',
                             'wath', 'look', 'like', 'book', 'scheduled', 'continued', 'thrown'];
                var left = extra.length;
                if (!left) return withTimeline();
                for (var e = 0; e < extra.length; e++) (function (key) {
                    var w = WEIGHTS[key] || 1.6;
                    ownedGet(key, null, function (list2) {
                        if (isArr(list2)) {
                            for (var i = 0; i < list2.length; i++) {
                                var it = list2[i];
                                if (it && typeof it === 'object') { addCard(it); bump(it.id, w, typeOf(it), it); }
                                else bump(it, w, null, null);
                            }
                        }
                        if (--left === 0) withTimeline();
                    });
                })(extra[e]);
            }

            function withTimeline() {
                ownedGet('timeline', {}, function (timeline) {
                    if (timeline && typeof timeline === 'object') {
                        for (var tk in timeline) {
                            if (!timeline.hasOwnProperty(tk)) continue;
                            var m = /^(movie|tv)_(\d+)/.exec(tk) || /^(\d+)$/.exec(tk);
                            if (m) bump(m[2] || m[1], 1.5, m[1] === 'tv' ? 'tv' : 'movie', null);
                        }
                    }
                    finish();
                });
            }

            function finish() {
                var out = [];
                for (var i = 0; i < order.length; i++) {
                    var rec = acc[order[i]];
                    if (!rec) continue;
                    if (!rec.card && cards[rec.id]) rec.card = cards[rec.id];
                    if (!rec.type) rec.type = typeOf(rec.card);
                    if (rec.w <= 0) continue;
                    out.push(rec);
                }
                out.sort(function (a, b) { return b.w - a.w; });
                cb(out);
            }

            onLampaReady(function () {
                var fav = null;
                try { if (window.Lampa && Lampa.Favorite && Lampa.Favorite.full) fav = Lampa.Favorite.full(); } catch (e) {}
                if (fav && typeof fav === 'object' && !isEmptyish(fav)) { withFavorite(fav); return; }
                ownedGet('favorite', {}, withFavorite);
            });
        },

        stats: function (cb) {
            this.read(function (items) {
                var withCards = 0;
                for (var i = 0; i < items.length; i++) if (items[i].card) withCards++;
                ownedGet('timeline', {}, function (timeline) {
                    var tlCount = 0;
                    if (timeline && typeof timeline === 'object') for (var k in timeline) tlCount++;
                    cb({ total: items.length, withCards: withCards, timeline: tlCount, items: items });
                });
            });
        }
    };

    /* =========================================================================
       6. МОДЕЛЬ ВКУСА
       ========================================================================= */
    var DCACHE_KEY = 'dcache';

    var Taste = {
        cache: null,
        loadCache: function () {
            if (this.cache) return this.cache;
            this.cache = pGet(DCACHE_KEY, {}) || {};
            return this.cache;
        },
        saveCache: function () {
            var c = this.cache || {}, keys = [];
            for (var k in c) keys.push(k);
            if (keys.length > 240) {
                var trimmed = {};
                for (var i = keys.length - 240; i < keys.length; i++) trimmed[keys[i]] = c[keys[i]];
                this.cache = trimmed;
            }
            pSet(DCACHE_KEY, this.cache);
        },

        enrich: function (items, limit, cb) {
            var cache = this.loadCache();
            var need = [], i;
            for (i = 0; i < items.length && need.length < limit; i++) {
                var it = items[i];
                var ck = (it.type || 'x') + '_' + it.id;
                if (cache[ck]) continue;
                if (it.card && it.card.genre_ids && it.card.genre_ids.length) {
                    cache[ck] = {
                        g: it.card.genre_ids.slice(0, 5), k: [],
                        v: it.card.vote_average || 0,
                        y: parseInt(String(it.card.release_date || it.card.first_air_date || '').slice(0, 4), 10) || 0,
                        n: it.card.title || it.card.name || '', t: it.type || 'movie'
                    };
                    continue;
                }
                need.push(it);
            }

            var self = this;
            if (!need.length) { this.saveCache(); return cb(cache); }

            var tasks = [];
            for (i = 0; i < need.length; i++) (function (it) {
                tasks.push(function (done) {
                    var order = it.type === 'tv' ? ['tv', 'movie'] : ['movie', 'tv'];
                    function attempt(n) {
                        if (n >= order.length) return done(null);
                        var type = order[n];
                        Net.get('/' + type + '/' + it.id, { append_to_response: 'keywords' }, function (d) {
                            if (!d || !d.id) return attempt(n + 1);
                            var kws = (d.keywords && (d.keywords.keywords || d.keywords.results)) || [];
                            var kk = [];
                            for (var q = 0; q < Math.min(kws.length, 8); q++) kk.push([kws[q].id, kws[q].name]);
                            var gg = [];
                            for (var g = 0; g < Math.min((d.genres || []).length, 5); g++) gg.push(d.genres[g].id);
                            self.cache[(it.type || type) + '_' + it.id] = {
                                g: gg, k: kk, v: d.vote_average || 0,
                                y: parseInt(String(d.release_date || d.first_air_date || '').slice(0, 4), 10) || 0,
                                n: d.title || d.name || '', t: type
                            };
                            it.type = type;
                            done(true);
                        }, function () { attempt(n + 1); }, { ttl: 604800000 });
                    }
                    attempt(0);
                });
            })(need[i]);

            parallel(tasks, function () { self.saveCache(); cb(self.cache); });
        },

        build: function (cb) {
            var self = this;
            History.stats(function (stats) {
                var items = stats.items;
                if (!items.length) return cb({ empty: true, count: 0, genres: [], keywords: [], seeds: [], watched: {}, stats: stats });

                self.enrich(items, 14, function (cache) {
                    var gScore = {}, kScore = {}, kName = {}, years = [], votes = [];
                    var watched = {}, seeds = [], i, j;

                    for (i = 0; i < items.length; i++) {
                        var it = items[i];
                        watched[it.id] = true;
                        var d = cache[(it.type || 'movie') + '_' + it.id] || cache['movie_' + it.id] || cache['tv_' + it.id];
                        if (!d) continue;
                        var w = it.w;
                        for (j = 0; j < (d.g || []).length; j++) {
                            var gid = TV2MOVIE[d.g[j]] || d.g[j];
                            gScore[gid] = (gScore[gid] || 0) + w;
                        }
                        for (j = 0; j < (d.k || []).length; j++) {
                            var kid = d.k[j][0];
                            kScore[kid] = (kScore[kid] || 0) + w * 0.8;
                            kName[kid] = d.k[j][1];
                        }
                        if (d.y) years.push(d.y);
                        if (d.v) votes.push(d.v);
                        if (seeds.length < 5 && w > 0) seeds.push({ id: it.id, type: d.t || it.type || 'movie', title: d.n });
                    }

                    var genres = [];
                    for (var g in gScore) genres.push({ id: parseInt(g, 10), score: gScore[g], name: GENRE_NAMES[g] || '' });
                    genres.sort(function (a, b) { return b.score - a.score; });

                    var keywords = [];
                    for (var k in kScore) if (kScore[k] > 1.5) keywords.push({ id: parseInt(k, 10), score: kScore[k], name: kName[k] });
                    keywords.sort(function (a, b) { return b.score - a.score; });

                    years.sort(function (a, b) { return a - b; });
                    var median = years.length ? years[Math.floor(years.length / 2)] : 0;
                    var avgVote = 0;
                    for (i = 0; i < votes.length; i++) avgVote += votes[i];
                    avgVote = votes.length ? avgVote / votes.length : 0;

                    cb({
                        empty: false, count: items.length, known: years.length,
                        genres: genres.slice(0, 5), keywords: keywords.slice(0, 6),
                        era: median, avgVote: avgVote, seeds: seeds, watched: watched, stats: stats
                    });
                });
            });
        }
    };

    /* =========================================================================
       7. СБОРКА КАПСУЛЫ
       ========================================================================= */
    function markList(list, type, src, via) {
        var out = [];
        if (!list) return out;
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (!it || !it.poster_path || it.adult) continue;
            it.media_type = it.media_type || type || (it.name && !it.title ? 'tv' : 'movie');
            if (it.media_type !== 'movie' && it.media_type !== 'tv') continue;
            it._src = src; it._via = via || null;
            out.push(it);
        }
        return out;
    }

    var Capsule = {
        shown: function () { var v = pGet('shown', []); return isArr(v) ? v : []; },
        remember: function (ids) {
            var s = this.shown().concat(ids);
            if (s.length > 80) s = s.slice(s.length - 80);
            pSet('shown', s);
        },
        forget: function () { pSet('shown', []); },

        build: function (taste, opts, cb) {
            opts = opts || {};
            var force = !!opts.force;
            var page = force ? 1 + Math.floor(Math.random() * 3) : 1;
            var tasks = [];
            var topG = taste.genres || [], topK = taste.keywords || [];

            var seeds = (taste.seeds || []).slice(0, 3);
            for (var s = 0; s < seeds.length; s++) (function (seed) {
                tasks.push(function (done) {
                    Net.get('/' + seed.type + '/' + seed.id + '/recommendations', { page: 1 }, function (d) {
                        done(markList(d && d.results, seed.type, 'seed', { seed: seed.title }));
                    }, function () { done([]); }, { force: force });
                });
            })(seeds[s]);

            if (topG.length) {
                var gids = [];
                for (var i = 0; i < Math.min(topG.length, 2); i++) gids.push(topG[i].id);
                tasks.push(function (done) {
                    Net.get('/discover/movie', {
                        with_genres: gids.join(','), sort_by: 'popularity.desc', page: page,
                        'vote_count.gte': 200, 'vote_average.gte': clamp(taste.avgVote ? taste.avgVote - 0.4 : 6.4, 6.0, 7.4),
                        include_adult: false
                    }, function (d) { done(markList(d && d.results, 'movie', 'genre', { genres: gids })); }, function () { done([]); }, { force: force });
                });
            }

            if (topK.length) {
                var kids = [];
                for (var j = 0; j < Math.min(topK.length, 3); j++) kids.push(topK[j].id);
                tasks.push(function (done) {
                    Net.get('/discover/movie', {
                        with_keywords: kids.join('|'), sort_by: 'popularity.desc', page: page,
                        'vote_count.gte': 120, 'vote_average.gte': 6.2, include_adult: false
                    }, function (d) { done(markList(d && d.results, 'movie', 'keyword', { kw: topK[0].name })); }, function () { done([]); }, { force: force });
                });
            }

            if (!seeds.length && !topG.length) {
                tasks.push(function (done) {
                    Net.get('/discover/movie', { sort_by: 'vote_average.desc', 'vote_count.gte': 3000, 'vote_average.gte': 7.6, page: page, include_adult: false },
                        function (d) { done(markList(d && d.results, 'movie', 'top')); }, function () { done([]); }, { force: force });
                });
                tasks.push(function (done) {
                    Net.get('/trending/all/week', { page: 1 }, function (d) { done(markList(d && d.results, null, 'trend')); }, function () { done([]); }, { force: force });
                });
            }

            var self = this;
            parallel(tasks, function (packs) {
                var all = [];
                for (var i = 0; i < packs.length; i++) all = all.concat(packs[i] || []);
                var picked = self.pick(all, taste, force);
                if (picked.length < 3) {
                    Net.get('/discover/movie', {
                        with_genres: topG.length ? topG[0].id : '', sort_by: 'vote_average.desc',
                        'vote_count.gte': 800, 'vote_average.gte': 7.0, page: 1, include_adult: false
                    }, function (d) { cb(self.pick(all.concat(markList(d && d.results, 'movie', 'relax')), taste, force)); }, function () { cb(picked); });
                } else cb(picked);
            });
        },

        pick: function (all, taste, force) {
            var seen = {}, out = [], i, j;
            var shown = this.shown();
            var gWeight = {};
            for (i = 0; i < (taste.genres || []).length; i++) gWeight[taste.genres[i].id] = taste.genres[i].score;
            var maxG = taste.genres && taste.genres.length ? taste.genres[0].score : 1;

            for (i = 0; i < all.length; i++) {
                var it = all[i];
                var key = it.media_type + '_' + it.id;
                if (seen[key]) { seen[key]._score += 3.5; seen[key]._multi = true; continue; }
                if (taste.watched && taste.watched[it.id]) continue;
                if (indexOfArr(shown, it.id) > -1) continue;
                if (!it.vote_average || it.vote_average < 5.8) continue;
                if ((it.vote_count || 0) < 60) continue;

                var s = 0;
                var gids = it.genre_ids || [];
                for (j = 0; j < gids.length; j++) {
                    var gid = TV2MOVIE[gids[j]] || gids[j];
                    if (gWeight[gid]) s += 4 * Math.sqrt(gWeight[gid] / maxG);
                }
                if (it._src === 'seed') s += 5;
                if (it._src === 'keyword') {
                    s += 4.5;
                    var kw = it._via && it._via.kw;
                    if (kw && kw.length > 12) s += 0.8;
                }
                if (it._src === 'genre') s += 2;
                if (it._src === 'trend') s += 0.5;
                s += clamp(it.vote_average - 6, 0, 3) * 1.6;
                s += clamp((it.vote_count || 0) / 4000, 0, 1.2);
                if (taste.era) {
                    var y = parseInt(String(it.release_date || it.first_air_date || '').slice(0, 4), 10) || 0;
                    if (y) s -= clamp(Math.abs(y - taste.era) / 30, 0, 1.2);
                }
                if (!it.overview) s -= 1;
                s += (Math.random() - 0.5) * 0.5;

                it._score = s; seen[key] = it; out.push(it);
            }

            out.sort(function (a, b) { return b._score - a._score; });

            var bySrc = {}, final = [];
            var discoverySlots = Math.min(1, CAPSULE_SIZE - 1);
            var mainSlots = CAPSULE_SIZE - discoverySlots;
            for (i = 0; i < out.length && final.length < mainSlots; i++) {
                var src = out[i]._src || 'x';
                bySrc[src] = (bySrc[src] || 0) + 1;
                if (bySrc[src] > 3) continue;
                final.push(out[i]);
            }
            if (discoverySlots > 0) {
                for (i = 0; i < out.length; i++) {
                    if (indexOfArr(final, out[i]) > -1) continue;
                    var isTop = false, gids2 = out[i].genre_ids || [];
                    if (taste.genres && taste.genres.length) {
                        var topId = taste.genres[0].id;
                        for (j = 0; j < gids2.length; j++) if ((TV2MOVIE[gids2[j]] || gids2[j]) === topId) { isTop = true; break; }
                    }
                    if (!isTop && out[i].vote_average >= 6.6) { final.push(out[i]); break; }
                }
            }
            for (i = 0; final.length < CAPSULE_SIZE && i < out.length; i++) {
                if (indexOfArr(final, out[i]) === -1) final.push(out[i]);
            }
            return final;
        },

        reason: function (item, taste) {
            if (item._reasonText) return item._reasonText;
            var r = '';
            if (item._src === 'seed' && item._via && item._via.seed) r = 'Похоже на «' + item._via.seed + '»';
            else if (item._src === 'keyword' && item._via && item._via.kw) r = 'Тема «' + item._via.kw + '»';
            else if (item._src === 'genre' || item._src === 'relax') {
                var names = [];
                var gids = item.genre_ids || [];
                for (var i = 0; i < (taste.genres || []).length && names.length < 2; i++) {
                    if (indexOfArr(gids, taste.genres[i].id) > -1 && taste.genres[i].name) names.push(taste.genres[i].name);
                }
                r = names.length ? 'Твои ' + names.join(' и ') : 'Высокий рейтинг';
            } else if (item._src === 'search') {
                r = item._via && item._via.query ? 'По запросу «' + item._via.query + '»' : 'Найдено по запросу';
            } else r = 'Высокий рейтинг';
            if (item._multi) r += ' · совпало по нескольким признакам';
            item._reasonText = r;
            return r;
        }
    };

    /* =========================================================================
       8. ПОИСК ПО ТЕГАМ И ОПИСАНИЯМ
       ========================================================================= */
    function parseQuery(raw) {
        var q = String(raw || '').toLowerCase().replace(/ё/g, 'е');
        var ctx = { raw: raw, genresM: [], genresT: [], tags: [], tokens: [], type: 'any', yearFrom: 0, yearTo: 0, minVote: 5.8, minVotes: 40 };
        var i, j;
        if (/сериал|сезон|series/.test(q)) ctx.type = 'tv';
        else if (/фильм|кино|movie/.test(q)) ctx.type = 'movie';

        for (i = 0; i < GENRE_SYN.length; i++) for (j = 0; j < GENRE_SYN[i].w.length; j++) {
            if (q.indexOf(GENRE_SYN[i].w[j]) > -1) { ctx.genresM = ctx.genresM.concat(GENRE_SYN[i].m); ctx.genresT = ctx.genresT.concat(GENRE_SYN[i].t); break; }
        }
        for (i = 0; i < TAG_SYN.length; i++) for (j = 0; j < TAG_SYN[i].w.length; j++) {
            if (q.indexOf(TAG_SYN[i].w[j]) > -1) { ctx.tags.push(TAG_SYN[i].k); break; }
        }
        var dec = q.match(/(\d{2})\s?-?\s?х/);
        if (dec) { var d = parseInt(dec[1], 10), base = d >= 30 ? 1900 + d : 2000 + d; ctx.yearFrom = base; ctx.yearTo = base + 9; }
        var y4 = q.match(/(19|20)\d{2}/);
        if (y4 && !ctx.yearFrom) { ctx.yearFrom = parseInt(y4[0], 10); ctx.yearTo = ctx.yearFrom; }
        if (/новинк|свеж|недавн/.test(q)) { var cy = new Date().getFullYear(); ctx.yearFrom = cy - 1; ctx.yearTo = cy + 1; }
        if (/классик|стар[оы]е/.test(q) && !ctx.yearFrom) { ctx.yearFrom = 1950; ctx.yearTo = 1999; }
        if (/лучш|топ|шедевр|культов/.test(q)) { ctx.minVote = 7.2; ctx.minVotes = 600; }

        var words = q.split(/[^a-zа-я0-9]+/);
        for (i = 0; i < words.length; i++) {
            var w = words[i];
            if (w.length < 4 || indexOfArr(STOP_WORDS, w) > -1) continue;
            ctx.tokens.push(w);
        }
        ctx.genresM = uniq(ctx.genresM); ctx.genresT = uniq(ctx.genresT); ctx.tags = uniq(ctx.tags);
        return ctx;
    }
    function uniq(a) { var o = [], s = {}; for (var i = 0; i < a.length; i++) if (!s[a[i]]) { s[a[i]] = 1; o.push(a[i]); } return o; }
    function stem(t) { return t.length > 5 ? t.substring(0, t.length - 2) : t; }

    var Search = {
        resolveTags: function (tags, cb) {
            if (!tags.length) return cb([]);
            var tasks = [];
            for (var i = 0; i < Math.min(tags.length, 3); i++) (function (name) {
                tasks.push(function (done) {
                    Net.get('/search/keyword', { query: name, page: 1 }, function (d) {
                        done(d && d.results && d.results.length ? d.results[0].id : null);
                    }, function () { done(null); }, { ttl: 604800000 });
                });
            })(tags[i]);
            parallel(tasks, function (res) {
                var ids = []; for (var i = 0; i < res.length; i++) if (res[i]) ids.push(res[i]);
                cb(ids);
            });
        },

        run: function (query, taste, cb) {
            var ctx = parseQuery(query), self = this;
            this.resolveTags(ctx.tags, function (kwIds) {
                var tasks = [];
                function discover(media) {
                    var p = { sort_by: 'popularity.desc', include_adult: false, page: 1, 'vote_count.gte': ctx.minVotes, 'vote_average.gte': ctx.minVote };
                    var g = media === 'tv' ? ctx.genresT : ctx.genresM;
                    if (g.length) p.with_genres = g.slice(0, 2).join(',');
                    if (kwIds.length) p.with_keywords = kwIds.join('|');
                    if (ctx.yearFrom) {
                        if (media === 'tv') { p['first_air_date.gte'] = ctx.yearFrom + '-01-01'; p['first_air_date.lte'] = ctx.yearTo + '-12-31'; }
                        else { p['primary_release_date.gte'] = ctx.yearFrom + '-01-01'; p['primary_release_date.lte'] = ctx.yearTo + '-12-31'; }
                    }
                    return p;
                }
                if (ctx.type !== 'tv') tasks.push(function (done) {
                    Net.get('/discover/movie', discover('movie'), function (d) { done(markList(d && d.results, 'movie', 'search', { query: query })); }, function () { done([]); });
                });
                if (ctx.type !== 'movie') tasks.push(function (done) {
                    Net.get('/discover/tv', discover('tv'), function (d) { done(markList(d && d.results, 'tv', 'search', { query: query })); }, function () { done([]); });
                });
                if (ctx.tokens.length) tasks.push(function (done) {
                    Net.get('/search/multi', { query: query, page: 1, include_adult: false }, function (d) { done(markList(d && d.results, null, 'search', { query: query })); }, function () { done([]); });
                });

                parallel(tasks, function (packs) {
                    var all = []; for (var i = 0; i < packs.length; i++) all = all.concat(packs[i] || []);
                    cb(self.rank(all, ctx, taste), ctx);
                });
            });
        },

        rank: function (list, ctx, taste) {
            var out = [], seen = {}, stems = [], i, j;
            for (i = 0; i < ctx.tokens.length; i++) stems.push(stem(ctx.tokens[i]));
            var gWeight = {};
            for (i = 0; i < ((taste && taste.genres) || []).length; i++) gWeight[taste.genres[i].id] = taste.genres[i].score;
            var maxG = (taste && taste.genres && taste.genres.length) ? taste.genres[0].score : 1;

            for (i = 0; i < list.length; i++) {
                var it = list[i];
                var key = it.media_type + '_' + it.id;
                if (seen[key]) { seen[key]._score += 2; continue; }
                var title = String(it.title || it.name || '').toLowerCase();
                var over = String(it.overview || '').toLowerCase();
                var s = 0;
                for (j = 0; j < stems.length; j++) { if (title.indexOf(stems[j]) > -1) s += 5; if (over.indexOf(stems[j]) > -1) s += 2.5; }
                var wanted = it.media_type === 'tv' ? ctx.genresT : ctx.genresM;
                var gids = it.genre_ids || [];
                for (j = 0; j < gids.length; j++) {
                    if (indexOfArr(wanted, gids[j]) > -1) s += 4;
                    var mapped = TV2MOVIE[gids[j]] || gids[j];
                    if (gWeight[mapped]) s += 2 * (gWeight[mapped] / maxG);
                }
                s += clamp((it.vote_average || 0) - 5.5, 0, 4) * 1.1;
                s += clamp((it.vote_count || 0) / 5000, 0, 1);
                if (!it.overview) s -= 1.5;
                it._score = s; seen[key] = it; out.push(it);
            }
            out.sort(function (a, b) { return b._score - a._score; });
            return out.slice(0, CAPSULE_SIZE * 2);
        }
    };

    /* =========================================================================
       9. ТЕМЫ ОФОРМЛЕНИЯ (цвета приведены к Lampa)
       ========================================================================= */
    var THEMES = {
        astro: { name: 'Космос', cls: 'cm-t-astro', vars: {
            '--cm-bg': '#1a1d29', '--cm-accent': '#ff7a2f', '--cm-accent2': '#7fd8ff',
            '--cm-text': '#f5f5f5', '--cm-sub': '#9ca3af', '--cm-panel': 'rgba(30,34,45,.85)',
            '--cm-panel2': 'rgba(20,24,35,.9)', '--cm-chip': 'rgba(255,255,255,.08)', '--cm-radius': '12px'
        } },
        breakingbad: { name: 'Лаборатория', cls: 'cm-t-bb', vars: {
            '--cm-bg': '#1a1e14', '--cm-accent': '#d6e24a', '--cm-accent2': '#1fae96',
            '--cm-text': '#f0f5e0', '--cm-sub': '#9aae8c', '--cm-panel': 'rgba(25,30,18,.85)',
            '--cm-panel2': 'rgba(18,22,12,.9)', '--cm-chip': 'rgba(214,226,74,.1)', '--cm-radius': '8px'
        } },
        matrix: { name: 'Матрица', cls: 'cm-t-matrix', vars: {
            '--cm-bg': '#000800', '--cm-accent': '#00ff41', '--cm-accent2': '#00b32e',
            '--cm-text': '#c8ffd4', '--cm-sub': '#4e9e5e', '--cm-panel': 'rgba(0,12,0,.85)',
            '--cm-panel2': 'rgba(0,8,0,.9)', '--cm-chip': 'rgba(0,255,65,.08)', '--cm-radius': '4px'
        } },
        panda: { name: 'Свиток', cls: 'cm-t-panda', vars: {
            '--cm-bg': '#2c1f14', '--cm-accent': '#d8433c', '--cm-accent2': '#e7b65c',
            '--cm-text': '#f4e9d2', '--cm-sub': '#b79e7b', '--cm-panel': 'rgba(42,31,18,.85)',
            '--cm-panel2': 'rgba(30,22,13,.9)', '--cm-chip': 'rgba(231,182,92,.12)', '--cm-radius': '10px'
        } },
        rickmorty: { name: 'Портал', cls: 'cm-t-rm', vars: {
            '--cm-bg': '#0a1a22', '--cm-accent': '#7cff6b', '--cm-accent2': '#3ad1ff',
            '--cm-text': '#e6fff1', '--cm-sub': '#6fa894', '--cm-panel': 'rgba(10,26,34,.85)',
            '--cm-panel2': 'rgba(6,18,24,.9)', '--cm-chip': 'rgba(124,255,107,.1)', '--cm-radius': '14px'
        } }
    };
    var THEME_ORDER = ['astro', 'breakingbad', 'matrix', 'panda', 'rickmorty'];

    var Themes = {
        current: function () { return THEMES[pGet('theme', 'astro')] ? pGet('theme', 'astro') : 'astro'; },
        apply: function (key, root) {
            var t = THEMES[key] || THEMES.astro;
            root = root || View.root;
            if (!root) return;
            for (var i = 0; i < THEME_ORDER.length; i++) removeClass(root, THEMES[THEME_ORDER[i]].cls);
            addClass(root, t.cls);
            for (var v in t.vars) root.style.setProperty(v, t.vars[v]);
            Themes.fx(key, root);
        },
        set: function (key) {
            pSet('theme', key);
            this.apply(key, View.root);
        },
        fx: function (key, root) {
            var old = root.querySelector('.cm-rain');
            if (old && old.parentNode) old.parentNode.removeChild(old);
            if (key === 'matrix') Themes.rain(root);
        },
        rain: function (root) {
            if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            var canvas = el('canvas', 'cm-rain');
            root.insertBefore(canvas, root.firstChild);
            var ctx = canvas.getContext && canvas.getContext('2d');
            if (!ctx) return;
            var chars = 'アイウエオカキクケコサシスセソ0123456789'.split('');
            function size() { canvas.width = root.clientWidth; canvas.height = root.clientHeight; }
            size();
            var cols = Math.max(1, Math.floor(canvas.width / 18)), drops = [];
            for (var i = 0; i < cols; i++) drops[i] = Math.random() * -40;
            var timer = setInterval(function () {
                if (!canvas.parentNode) { clearInterval(timer); return; }
                ctx.fillStyle = 'rgba(0,6,0,0.12)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#00FF41';
                ctx.font = '14px monospace';
                for (var c = 0; c < cols; c++) {
                    ctx.fillText(chars[Math.floor(Math.random() * chars.length)], c * 18, drops[c] * 18);
                    if (drops[c] * 18 > canvas.height && Math.random() > 0.975) drops[c] = 0;
                    drops[c]++;
                }
            }, 70);
            canvas._cmTimer = timer;
        },
        portalBurst: function (fromNode) {
            if (Themes.current() !== 'rickmorty') return;
            var ring = el('div', 'cm-portal-burst');
            document.body.appendChild(ring);
            setTimeout(function () { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 650);
        }
    };

    /* =========================================================================
       10. CSS (полная переработка под дизайн Lampa)
       ========================================================================= */
    var CSS = [
        '.cm-root{position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;overflow:hidden;color:var(--cm-text);',
        'background:var(--cm-bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
        '-webkit-tap-highlight-color:transparent;user-select:none;transition:background .3s ease;}',
        '.cm-root *{box-sizing:border-box;}',
        '.cm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;}',
        '.cm-rain{position:absolute;top:0;left:0;width:100%;height:100%;opacity:.4;pointer-events:none;}',

        '.cm-stars{position:absolute;top:-10%;left:-10%;width:120%;height:120%;opacity:.3;',
        'background-image:radial-gradient(1px 1px at 12% 22%,#fff,transparent),radial-gradient(1px 1px at 68% 14%,#cfe6ff,transparent),',
        'radial-gradient(1.4px 1.4px at 84% 62%,#fff,transparent),radial-gradient(1px 1px at 32% 78%,#9fd4ff,transparent),',
        'radial-gradient(1px 1px at 52% 46%,#fff,transparent),radial-gradient(1.2px 1.2px at 8% 64%,#fff,transparent);',
        'background-repeat:repeat;background-size:100% 100%;animation:cm-drift 60s linear infinite;}',
        '.cm-t-matrix .cm-stars,.cm-t-bb .cm-stars,.cm-t-panda .cm-stars{opacity:.06;}',
        '@keyframes cm-drift{0%{transform:translate3d(0,0,0);}100%{transform:translate3d(-2%,-3%,0);}}',
        '.cm-glow{position:absolute;top:-25%;left:-25%;width:150%;height:150%;background-size:cover;background-position:center;',
        'opacity:0;filter:blur(80px) saturate(150%);transition:opacity .6s ease;}',
        '.cm-glow.on{opacity:.25;}',
        '.cm-shade{position:absolute;top:0;left:0;right:0;bottom:0;',
        'background:radial-gradient(90% 70% at 65% 40%,rgba(0,0,0,.2),rgba(0,0,0,.85) 62%,var(--cm-bg) 100%);}',

        /* Шапка с навигацией */
        '.cm-bar{position:absolute;top:0;left:0;right:0;height:64px;z-index:40;display:flex;align-items:center;padding:0 24px;',
        'background:linear-gradient(180deg,rgba(0,0,0,.6) 0%,transparent 100%);}',
        '.cm-bar-back{width:40px;height:40px;border-radius:8px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;',
        'cursor:pointer;transition:background .2s;}',
        '.cm-bar-back:hover{background:rgba(255,255,255,.15);}',
        '.cm-bar-back svg{width:20px;height:20px;fill:#fff;}',
        '.cm-bar-title{flex:1;text-align:center;font-size:16px;font-weight:600;letter-spacing:.02em;}',
        '.cm-bar-refresh{width:40px;height:40px;border-radius:8px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;',
        'cursor:pointer;transition:background .2s;}',
        '.cm-bar-refresh:hover{background:rgba(255,255,255,.15);}',
        '.cm-bar-refresh svg{width:20px;height:20px;fill:#fff;}',

        '.cm-stage{position:absolute;top:64px;left:0;right:0;bottom:0;display:flex;align-items:center;padding:24px 32px;}',
        '.cm-port{position:relative;display:flex;align-items:center;width:100%;max-width:1200px;margin:0 auto;',
        'border-radius:var(--cm-radius);padding:24px;background:var(--cm-panel);',
        'box-shadow:0 8px 32px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06);transition:all .3s ease;}',
        '.cm-port:before{content:"";position:absolute;top:0;left:0;right:0;bottom:0;border-radius:var(--cm-radius);pointer-events:none;',
        'background:linear-gradient(115deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,0) 34%);}',

        '.cm-hero-poster{position:relative;flex:none;width:280px;height:420px;border-radius:calc(var(--cm-radius) * 0.8);overflow:hidden;background:#0B0F18;',
        'box-shadow:0 12px 40px rgba(0,0,0,.6);margin-right:32px;}',
        '.cm-hero-poster img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .4s ease;}',
        '.cm-hero-poster img.ready{opacity:1;}',
        '.cm-hero{flex:1;min-width:0;}',
        '.cm-count{font-size:12px;letter-spacing:.15em;color:var(--cm-sub);margin-bottom:12px;text-transform:uppercase;}',
        '.cm-count b{color:var(--cm-accent);font-weight:700;}',
        '.cm-name{font-size:36px;font-weight:700;line-height:1.2;letter-spacing:-.01em;margin-bottom:16px;}',
        '.cm-why{position:relative;padding-left:20px;font-size:15px;line-height:1.5;color:var(--cm-text);opacity:.9;margin-bottom:24px;max-width:600px;}',
        '.cm-why:before{content:"";position:absolute;left:0;top:6px;bottom:6px;width:3px;border-radius:2px;background:var(--cm-accent);}',

        '.cm-acts{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;}',
        '.cm-act{display:flex;align-items:center;padding:14px 24px;border-radius:calc(var(--cm-radius) * 0.7);cursor:pointer;',
        'background:var(--cm-chip);font-size:15px;font-weight:600;color:var(--cm-text);transition:all .2s cubic-bezier(0.4,0,0.2,1);',
        'border:2px solid transparent;}',
        '.cm-act svg{width:20px;height:20px;fill:currentColor;margin-right:10px;}',
        '.cm-act.primary{background:var(--cm-accent);color:#fff;}',
        '.cm-act.cm-focus{background:var(--cm-accent);color:#fff;transform:scale(1.05);box-shadow:0 0 0 3px rgba(255,255,255,.3);}',
        '.cm-act.primary.cm-focus{box-shadow:0 0 0 3px rgba(255,255,255,.4);}',
        '.cm-act:hover{background:rgba(255,255,255,.12);}',
        '.cm-act.primary:hover{background:var(--cm-accent);filter:brightness(1.1);}',

        '.cm-tray{position:absolute;left:0;right:0;bottom:24px;display:flex;justify-content:center;z-index:30;}',
        '.cm-tray-in{display:flex;align-items:center;padding:12px;border-radius:12px;background:var(--cm-panel2);',
        'box-shadow:0 4px 16px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.06);overflow-x:auto;max-width:calc(100% - 48px);}',
        '.cm-tray-in::-webkit-scrollbar{height:0;}',
        '.cm-mini{position:relative;flex:none;width:80px;height:120px;border-radius:8px;overflow:hidden;margin:0 8px;',
        'background:#0B0F18;cursor:pointer;opacity:.5;transition:all .25s cubic-bezier(0.4,0,0.2,1);border:3px solid transparent;}',
        '.cm-mini img{width:100%;height:100%;object-fit:cover;}',
        '.cm-mini.active{opacity:1;border-color:var(--cm-accent);transform:scale(1.05);}',
        '.cm-mini.cm-focus{opacity:1;transform:scale(1.08);box-shadow:0 8px 24px rgba(0,0,0,.5);border-color:var(--cm-accent);}',
        '.cm-mini:hover{opacity:.8;}',

        '.cm-astro-wrap{position:absolute;left:24px;bottom:24px;z-index:20;pointer-events:none;opacity:.8;}',
        '.cm-astro{width:96px;height:108px;pointer-events:auto;}',
        '.cm-astro svg{width:100%;height:100%;}',
        '.cm-astro .cm-body{animation:cm-float 5s ease-in-out infinite, cm-sway 7s ease-in-out infinite;transform-origin:50% 50%;}',
        '@keyframes cm-float{0%,100%{transform:translateY(0) rotate(-4deg);}50%{transform:translateY(-8px) rotate(2deg);}}',
        '@keyframes cm-sway{0%,100%{transform:rotate(-6deg);}50%{transform:rotate(5deg);}}',

        '.cm-load{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}',
        '.cm-load-ring{width:64px;height:64px;border-radius:50%;box-shadow:inset 0 0 0 3px rgba(255,255,255,.15);position:relative;}',
        '.cm-load-ring:after{content:"";position:absolute;top:-3px;left:-3px;right:-3px;bottom:-3px;border-radius:50%;',
        'border:3px solid transparent;border-top-color:var(--cm-accent);animation:cm-spin 1s linear infinite;}',
        '@keyframes cm-spin{to{transform:rotate(360deg);}}',
        '.cm-load-txt{margin-top:20px;font-size:14px;letter-spacing:.12em;color:var(--cm-sub);text-transform:uppercase;}',

        '.cm-ov{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.8);z-index:999999;display:flex;',
        'align-items:center;justify-content:center;padding:24px;}',
        '.cm-modal{width:600px;max-width:100%;max-height:85%;overflow-y:auto;padding:32px;border-radius:var(--cm-radius);',
        'background:var(--cm-panel2);box-shadow:0 16px 48px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.08);}',
        '.cm-modal::-webkit-scrollbar{width:0;}',
        '.cm-modal h3{margin:0 0 12px;font-size:24px;font-weight:700;letter-spacing:-.01em;}',
        '.cm-modal p{margin:0 0 20px;color:var(--cm-sub);font-size:15px;line-height:1.6;}',
        '.cm-modal p b{color:var(--cm-text);}',
        '.cm-modal-mascot{display:flex;justify-content:center;margin:-8px 0 16px;}',
        '.cm-modal-mascot .cm-astro{width:80px;height:90px;display:block;}',
        '.cm-sec{font-size:12px;letter-spacing:.12em;color:var(--cm-sub);margin:20px 0 12px;text-transform:uppercase;}',
        '.cm-sec:first-child{margin-top:0;}',
        '.cm-opt{display:block;width:100%;text-align:left;padding:14px 18px;margin-bottom:8px;border-radius:calc(var(--cm-radius) * 0.7);',
        'background:var(--cm-chip);color:var(--cm-text);font-size:15px;cursor:pointer;transition:all .2s cubic-bezier(0.4,0,0.2,1);border:2px solid transparent;}',
        '.cm-opt.cm-focus{background:var(--cm-accent);color:#fff;transform:scale(1.02);box-shadow:0 0 0 3px rgba(255,255,255,.25);}',
        '.cm-opt small{display:block;font-size:13px;opacity:.7;margin-top:4px;}',
        '.cm-opt:hover{background:rgba(255,255,255,.12);}',
        '.cm-chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;}',
        '.cm-chip{padding:10px 18px;border-radius:20px;font-size:14px;cursor:pointer;',
        'background:var(--cm-chip);color:var(--cm-text);transition:all .2s cubic-bezier(0.4,0,0.2,1);border:2px solid transparent;}',
        '.cm-chip.cm-focus{background:var(--cm-accent2);color:#fff;transform:scale(1.05);box-shadow:0 0 0 3px rgba(255,255,255,.25);}',
        '.cm-chip:hover{background:rgba(255,255,255,.12);}',
        '.cm-input{width:100%;padding:14px 18px;margin-bottom:16px;border-radius:calc(var(--cm-radius) * 0.7);font-size:16px;color:#fff;outline:none;',
        'background:var(--cm-chip);border:2px solid rgba(255,255,255,.15);transition:border-color .2s;}',
        '.cm-input:focus{border-color:var(--cm-accent);}',

        '.cm-toast{position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(20px);z-index:1000001;opacity:0;',
        'padding:14px 24px;border-radius:12px;background:var(--cm-panel2);color:var(--cm-text);font-size:15px;',
        'box-shadow:0 8px 24px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.08);transition:all .3s cubic-bezier(0.4,0,0.2,1);}',
        '.cm-toast.on{opacity:1;transform:translateX(-50%) translateY(0);}',

        '@media (hover:hover){.cm-act:hover,.cm-opt:hover,.cm-chip:hover{background:rgba(255,255,255,.14);}.cm-mini:hover{opacity:1;}}',

        /* ---- Тема: Лаборатория (Breaking Bad) ---- */
        '.cm-t-bb .cm-port{border:1px solid rgba(214,226,74,.2);}',
        '.cm-t-bb .cm-flask{position:absolute;width:48px;height:58px;opacity:.4;pointer-events:none;}',
        '.cm-t-bb .cm-flask.f1{top:16px;right:24px;}',
        '.cm-t-bb .cm-flask.f2{bottom:16px;right:96px;}',
        '.cm-t-bb .cm-flask svg{width:100%;height:100%;}',
        '.cm-t-bb .cm-mini.cm-focus,.cm-t-bb .cm-act.cm-focus{box-shadow:0 0 0 3px var(--cm-accent2),0 8px 24px rgba(0,0,0,.5);}',

        /* ---- Тема: Матрица ---- */
        '.cm-t-matrix{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}',
        '.cm-t-matrix .cm-name,.cm-t-matrix .cm-act,.cm-t-matrix .cm-opt{letter-spacing:.01em;}',
        '.cm-t-matrix .cm-mini{filter:grayscale(.5) contrast(1.1);}',
        '.cm-t-matrix .cm-mini.active{filter:none;}',
        '.cm-t-matrix .cm-mini.cm-focus{filter:none;box-shadow:0 0 0 3px var(--cm-accent),0 0 16px rgba(0,255,65,.3);',
        'transform:scale(1.1);transition:transform .3s cubic-bezier(.2,1.4,.4,1),box-shadow .3s;}',
        '.cm-t-matrix .cm-act.cm-focus{box-shadow:0 0 0 3px var(--cm-accent),0 0 16px rgba(0,255,65,.4);}',
        '.cm-t-matrix .cm-port{border:1px solid rgba(0,255,65,.18);}',

        /* ---- Тема: Свиток (Kung Fu Panda) ---- */
        '.cm-t-panda .cm-port{background-image:',
        'linear-gradient(var(--cm-panel),var(--cm-panel)),',
        'repeating-linear-gradient(115deg,rgba(255,255,255,.02) 0 2px,transparent 2px 6px);',
        'background-blend-mode:normal;border:1px solid rgba(231,182,92,.25);}',
        '.cm-t-panda .cm-root{background-image:radial-gradient(120% 90% at 30% 0%,rgba(216,67,60,.06),transparent 60%);}',
        '.cm-t-panda .cm-mini{border-radius:6px;}',
        '.cm-t-panda .cm-mini.cm-focus{box-shadow:0 0 0 3px var(--cm-accent);animation:cm-ink .4s ease;}',
        '@keyframes cm-ink{0%{transform:scale(.9);}60%{transform:scale(1.1);}100%{transform:scale(1.08);}}',
        '.cm-t-panda .cm-act.cm-focus{border-radius:20px 8px 20px 8px;}',

        /* ---- Тема: Портал (Rick & Morty) ---- */
        '.cm-t-rm .cm-port{border:1px solid rgba(124,255,107,.25);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 48px rgba(58,209,255,.08);}',
        '.cm-t-rm .cm-mini.cm-focus{box-shadow:0 0 0 3px var(--cm-accent2),0 0 20px rgba(124,255,107,.4);}',
        '.cm-t-rm .cm-act.cm-focus{box-shadow:0 0 0 3px var(--cm-accent2),0 0 18px rgba(124,255,107,.35);}',
        '.cm-portal-burst{position:fixed;left:50%;top:50%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;',
        'z-index:1000002;pointer-events:none;',
        'background:radial-gradient(circle,rgba(124,255,107,.9) 0%,rgba(58,209,255,.6) 40%,transparent 70%);',
        'animation:cm-portal .6s ease-out forwards;}',
        '@keyframes cm-portal{0%{transform:scale(0);opacity:1;}100%{transform:scale(40);opacity:0;}}',

        '@media (max-width:1024px){',
        '.cm-root{font-size:14px;}',
        '.cm-stage{padding:24px 16px 120px;align-items:flex-start;}',
        '.cm-port{flex-direction:column;align-items:flex-start;padding:20px;}',
        '.cm-hero-poster{width:180px;height:270px;margin:0 0 20px;}',
        '.cm-name{font-size:28px;}',
        '.cm-act{flex:1 1 100%;justify-content:center;}',
        '.cm-astro{width:72px;height:81px;}',
        '.cm-tray{bottom:16px;}',
        '}',
        '@media (prefers-reduced-motion:reduce){.cm-root *{animation:none!important;transition:none!important;}}'
    ].join('');

    function injectCSS() {
        if (document.getElementById('cm_css')) return;
        var s = el('style');
        s.id = 'cm_css';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    /* =========================================================================
       11. ГРАФИКА
       ========================================================================= */
    var I_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    var I_COMPANION = '<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 1 5 5v1.2a5 5 0 0 1-1.4 9.6H8.4A5 5 0 0 1 7 8.2V7a5 5 0 0 1 5-5zm-3 9a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm6 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"/></svg>';
    var I_CAPSULE = '<svg viewBox="0 0 24 24"><path d="M17 2a5 5 0 0 1 3.5 8.5l-10 10A5 5 0 0 1 3.5 13.5l10-10A5 5 0 0 1 17 2zm-2 3.9-9.1 9.2a3 3 0 0 0 4.2 4.2L19.2 10a3 3 0 0 0-4.2-4.2z"/></svg>';
    var I_FLASK = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 2h6v2h-1v5l5 10a2 2 0 0 1-1.8 3H6.8A2 2 0 0 1 5 19l5-10V4H9z" fill="none" stroke="#D6E24A" stroke-width="1.3"/><circle cx="12" cy="17" r="1.3" fill="#1FAE96"/><circle cx="10" cy="19" r=".9" fill="#D6E24A"/></svg>';
    var I_BACK = '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
    var I_REFRESH = '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';

    var SVG_ASTRO = [
        '<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">',
        '<defs>',
        '<linearGradient id="cmBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9E0EB"/><stop offset="1" stop-color="#8895A9"/></linearGradient>',
        '<radialGradient id="cmVisor" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="#2C5C86"/><stop offset="0.5" stop-color="#0C1727"/><stop offset="1" stop-color="#05070D"/></radialGradient>',
        '<linearGradient id="cmPack" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B0BAC9"/><stop offset="1" stop-color="#6A788F"/></linearGradient>',
        '</defs>',
        '<g transform="rotate(-8 100 110)">',
        '<rect x="80" y="95" width="80" height="85" rx="28" fill="url(#cmPack)" transform="rotate(10 120 137)"/>',
        '<rect x="65" y="75" width="70" height="85" rx="30" fill="url(#cmBody)" transform="rotate(5 100 117)"/>',
        '<path d="M72 90 C 55 70, 38 52, 30 38" fill="none" stroke="url(#cmBody)" stroke-width="22" stroke-linecap="round"/>',
        '<circle cx="30" cy="38" r="15" fill="url(#cmBody)"/>',
        '<path d="M128 90 C 145 105, 158 125, 162 145" fill="none" stroke="url(#cmBody)" stroke-width="22" stroke-linecap="round"/>',
        '<circle cx="162" cy="145" r="15" fill="url(#cmBody)"/>',
        '<path d="M95 160 C 80 185, 65 200, 45 215" fill="none" stroke="url(#cmBody)" stroke-width="24" stroke-linecap="round"/>',
        '<path d="M125 160 C 135 185, 150 200, 165 210" fill="none" stroke="url(#cmBody)" stroke-width="24" stroke-linecap="round"/>',
        '<ellipse cx="45" cy="215" rx="14" ry="10" fill="#8895A9"/>',
        '<ellipse cx="165" cy="210" rx="14" ry="10" fill="#8895A9"/>',
        '<circle cx="100" cy="55" r="40" fill="url(#cmBody)"/>',
        '<ellipse cx="100" cy="55" rx="32" ry="28" fill="url(#cmVisor)"/>',
        '<path d="M80 40 C 88 30, 100 28, 112 34 C 100 36, 90 42, 84 52 Z" fill="#FFFFFF" opacity="0.4"/>',
        '<circle cx="118" cy="60" r="3" fill="#7FD8FF"/>',
        '<rect x="90" y="18" width="20" height="12" rx="5" fill="#8895A9"/>',
        '<circle cx="100" cy="15" r="6" fill="#FF7A2F"/>',
        '<rect x="75" y="100" width="30" height="24" rx="6" fill="#141C29"/>',
        '<circle cx="85" cy="112" r="3" fill="#FF7A2F"/><circle cx="95" cy="112" r="3" fill="#7FD8FF"/><circle cx="105" cy="112" r="3" fill="#FFFFFF" opacity="0.6"/>',
        '</g></svg>'
    ].join('');

    /* =========================================================================
       12. НАВИГАЦИЯ (улучшена для пульта, сенсора и мыши)
       ========================================================================= */
    var Nav = {
        rows: [], r: 0, c: 0,
        reset: function () { this.rows = []; this.r = 0; this.c = 0; },
        addRow: function (items) {
            var clean = [];
            for (var i = 0; i < items.length; i++) if (items[i]) clean.push(items[i]);
            if (!clean.length) return;
            this.rows.push({ items: clean, memo: 0 });
            var idx = this.rows.length - 1;
            for (var j = 0; j < clean.length; j++) bindPointer(clean[j], idx, j);
        },
        setFocus: function (r, c, silent) {
            if (!this.rows.length) return;
            this.r = clamp(r, 0, this.rows.length - 1);
            var row = this.rows[this.r];
            this.c = clamp(c, 0, row.items.length - 1);
            row.memo = this.c;
            this.paint(silent);
        },
        current: function () { var row = this.rows[this.r]; return row ? row.items[this.c] : null; },
        paint: function (silent) {
            var old = document.querySelectorAll('.cm-focus');
            for (var i = 0; i < old.length; i++) removeClass(old[i], 'cm-focus');
            var cur = this.current();
            if (!cur) return;
            addClass(cur, 'cm-focus');
            if (!silent) {
                var strip = closestClass(cur, 'cm-tray-in');
                if (strip && strip.scrollWidth > strip.clientWidth) {
                    animScroll(strip, 'scrollLeft', cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2, 220);
                }
            }
        },
        move: function (dir) {
            if (!this.rows.length) return;
            if (dir === 'up' && this.r > 0) this.setFocus(this.r - 1, this.rows[this.r - 1].memo || 0);
            else if (dir === 'down' && this.r < this.rows.length - 1) this.setFocus(this.r + 1, this.rows[this.r + 1].memo || 0);
        },
        enter: function () { trigger(this.current()); }
    };

    var touchMode = false;
    document.addEventListener('touchstart', function () { touchMode = true; }, true);

    function bindPointer(node, r, c) {
        node.setAttribute('data-cm-r', r);
        node.setAttribute('data-cm-c', c);
        node.setAttribute('role', 'button');
        node.setAttribute('tabindex', '0');
        node.onmouseenter = function () { if (!touchMode) Nav.setFocus(r, c, true); };
    }
    function trigger(node) { if (node && typeof node._cmAction === 'function') node._cmAction(node); }

    document.addEventListener('click', function (e) {
        var n = e.target;
        while (n && n !== document) {
            if (n._cmAction) {
                var r = parseInt(n.getAttribute('data-cm-r'), 10), c = parseInt(n.getAttribute('data-cm-c'), 10);
                if (!isNaN(r) && !isNaN(c)) Nav.setFocus(r, c, true);
                trigger(n);
                return;
            }
            n = n.parentNode;
        }
    }, false);

    /* Улучшенный свайп с меньшей амплитудой и визуальным откликом */
    var swipe = { x: 0, y: 0, on: false, threshold: 60 };
    document.addEventListener('touchstart', function (e) {
        if (!App.active || Modal.active()) return;
        swipe.x = e.touches[0].clientX; swipe.y = e.touches[0].clientY; swipe.on = true;
    }, true);
    document.addEventListener('touchend', function (e) {
        if (!swipe.on || !App.active || Modal.active()) return;
        swipe.on = false;
        var t = e.changedTouches[0];
        var dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
        if (Math.abs(dx) > swipe.threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0) View.step(1); else View.step(-1);
        }
    }, true);

    /* =========================================================================
       13. ТОСТ / МОДАЛЬНЫЕ / ВВОД
       ========================================================================= */
    var Toast = {
        node: null, timer: null,
        show: function (text) {
            if (!this.node) { this.node = el('div', 'cm-toast'); document.body.appendChild(this.node); }
            var n = this.node;
            n.textContent = text;
            addClass(n, 'on');
            clearTimeout(this.timer);
            this.timer = setTimeout(function () { removeClass(n, 'on'); }, 2800);
        }
    };
    function notify(t) {
        try { if (window.Lampa && Lampa.Noty && Lampa.Noty.show) { Lampa.Noty.show(t); return; } } catch (e) {}
        Toast.show(t);
    }

    var Modal = {
        stack: [],
        open: function (opts) {
            var self = this;
            Themes.portalBurst();
            var ov = el('div', 'cm-ov'), box = el('div', 'cm-modal'), nodes = [];
            if (opts.mascot) {
                var mw = el('div', 'cm-modal-mascot');
                mw.appendChild(el('div', 'cm-astro', SVG_ASTRO));
                box.appendChild(mw);
            }
            if (opts.title) box.appendChild(el('h3', '', esc(opts.title)));
            if (opts.text) box.appendChild(el('p', '', opts.text));
            if (opts.chips && opts.chips.length) {
                var wrap = el('div', 'cm-chips');
                for (var i = 0; i < opts.chips.length; i++) (function (ch) {
                    var c = el('div', 'cm-chip', esc(ch.label));
                    c._cmAction = function () { self.close(); ch.onSelect(); };
                    wrap.appendChild(c); nodes.push(c);
                })(opts.chips[i]);
                box.appendChild(wrap);
            }
            if (opts.items) for (var j = 0; j < opts.items.length; j++) {
                var it = opts.items[j];
                if (it.section) { box.appendChild(el('div', 'cm-sec cm-mono', esc(it.section))); continue; }
                (function (it) {
                    var b = el('div', 'cm-opt', esc(it.label) + (it.hint ? '<small>' + esc(it.hint) + '</small>' : ''));
                    b._cmAction = function () { self.close(); if (it.onSelect) it.onSelect(); };
                    box.appendChild(b); nodes.push(b);
                })(it);
            }

            ov.appendChild(box);
            document.body.appendChild(ov);
            ov.onclick = function (e) { if (e.target === ov) self.close(); };
            var st = { ov: ov, box: box, nodes: nodes, idx: 0 };
            this.stack.push(st);
            this.paint();
            return st;
        },
        paint: function () {
            var st = this.stack[this.stack.length - 1];
            if (!st) return;
            for (var i = 0; i < st.nodes.length; i++) removeClass(st.nodes[i], 'cm-focus');
            var cur = st.nodes[st.idx];
            if (cur) { addClass(cur, 'cm-focus'); try { if (cur.scrollIntoView) cur.scrollIntoView(false); } catch (e) {} }
        },
        move: function (dir) {
            var st = this.stack[this.stack.length - 1];
            if (!st || !st.nodes.length) return;
            if (dir === 'down' || dir === 'right') st.idx = clamp(st.idx + 1, 0, st.nodes.length - 1);
            if (dir === 'up' || dir === 'left') st.idx = clamp(st.idx - 1, 0, st.nodes.length - 1);
            this.paint();
        },
        enter: function () { var st = this.stack[this.stack.length - 1]; if (st) trigger(st.nodes[st.idx]); },
        close: function () {
            var st = this.stack.pop();
            if (!st) return;
            if (st.ov.parentNode) st.ov.parentNode.removeChild(st.ov);
            if (this.stack.length) this.paint(); else Nav.paint(true);
        },
        active: function () { return this.stack.length > 0; }
    };

    function askText(title, value, cb) {
        try {
            if (window.Lampa && Lampa.Input && Lampa.Input.edit) {
                Lampa.Input.edit({ title: title, value: value || '', free: true }, function (v) { if (v) cb(v); });
                return;
            }
        } catch (e) {}
        var input = el('input', 'cm-input');
        input.type = 'text';
        input.value = value || '';
        var st = Modal.open({ title: title, items: [{ label: 'Найти', onSelect: function () { if (input.value) cb(input.value); } }, { label: 'Отмена' }] });
        st.box.insertBefore(input, st.box.childNodes[1] || null);
        input.onkeydown = function (e) {
            e.stopPropagation();
            if (e.keyCode === 13 && input.value) { Modal.close(); cb(input.value); }
        };
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
    }

    /* =========================================================================
       14. ЭКРАН КАПСУЛЫ (возвращена шапка с навигацией)
       ========================================================================= */
    var View = {
        root: null, stage: null, glow: null, bar: null,
        list: [], idx: 0, taste: null, source: 'taste', sourceLabel: '',
        say: null, busy: false,
        activeQuery: { kind: 'taste', label: 'КАПСУЛА' },
        _lastBuiltAt: 0,

        create: function () {
            injectCSS();
            this.root = el('div', 'cm-root');
            Themes.apply(Themes.current(), this.root);
            this.root.appendChild(el('div', 'cm-stars'));
            this.glow = el('div', 'cm-glow');
            this.root.appendChild(this.glow);
            this.root.appendChild(el('div', 'cm-shade'));
            this.stage = el('div');
            this.stage.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;';
            this.root.appendChild(this.stage);
            this.loading('СОБИРАЮ КАПСУЛУ');
            this.boot(false);
            return this.root;
        },

        loading: function (text) {
            this.stage.innerHTML = '';
            var box = el('div', 'cm-load');
            box.appendChild(el('div', 'cm-load-ring'));
            box.appendChild(el('div', 'cm-load-txt cm-mono', text));
            this.stage.appendChild(box);
            Nav.reset();
        },

        boot: function (force) {
            var self = this;
            this.busy = true;
            Taste.build(function (taste) {
                self.taste = taste;
                Capsule.build(taste, { force: force }, function (list) {
                    self.busy = false;
                    self.source = 'taste';
                    self.sourceLabel = 'КАПСУЛА';
                    self.activeQuery = { kind: 'taste', label: 'КАПСУЛА' };
                    if (!list.length) { self.renderEmpty(); return; }
                    var ids = []; for (var i = 0; i < list.length; i++) ids.push(list[i].id);
                    Capsule.remember(ids);
                    self.list = list; self.idx = 0;
                    self.render();
                    self.greet();
                });
            });
        },

        greet: function () {
            var t = this.taste;
            if (!t || t.empty || !t.count) { this.speak('Истории пока нет. Нажми «Компаньон» — соберу капсулу по настроению.'); return; }
            var parts = [];
            for (var i = 0; i < Math.min(t.genres.length, 2); i++) if (t.genres[i].name) parts.push(t.genres[i].name);
            var kw = t.keywords.length ? t.keywords[0].name : '';
            var line = 'Прочитал ' + t.count + ' карточек из истории';
            if (parts.length) line += ': жанры ' + parts.join(' и ');
            if (kw) line += ', тема «' + kw + '»';
            this.speak(line + '. Вот шесть фильмов
