/**
 * Capsule Mod v10.0 — «Глубокий космос»
 *
 * Изолированное пространство внутри Lampa: минимум визуального шума,
 * шесть фильмов вместо бесконечных лент, космонавт-компаньон.
 *
 * ES5 only — WebOS / Tizen / старые Android TV WebView.
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
    function rnd(a) { return a && a.length ? a[Math.floor(Math.random() * a.length)] : ''; }
    function indexOfArr(arr, v) { for (var i = 0; i < arr.length; i++) if (arr[i] === v) return i; return -1; }
    function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }

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
            node[prop] = from + dist * (1 - Math.pow(1 - p, 3));
            if (p < 1) raf(step); else node._cmAnim = null;
        }
        raf(step);
    }

    function sGet(key, def) {
        try {
            if (window.Lampa && Lampa.Storage && Lampa.Storage.get) {
                var v = Lampa.Storage.get(key, def);
                if (v !== undefined && v !== null && !(isArr(v) && !v.length && def && def.length)) return v;
            }
        } catch (e) {}
        try {
            var raw = localStorage.getItem(key);
            if (raw != null) return JSON.parse(raw);
        } catch (e) {}
        try {
            var mine = localStorage.getItem('cm_' + key);
            if (mine != null) return JSON.parse(mine);
        } catch (e) {}
        return def;
    }
    function sSet(key, val) {
        try { if (window.Lampa && Lampa.Storage && Lampa.Storage.set) Lampa.Storage.set(key, val); } catch (e) {}
        try { localStorage.setItem('cm_' + key, JSON.stringify(val)); } catch (e) {}
    }

    /* =========================================================================
       2. СЕТЬ
       ========================================================================= */
    var Net = {
        mem: {},
        key: function () { return sGet('cm_tmdb_key', '') || sGet('tmdb_api_key', '') || FALLBACK_KEY; },
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
       3. СЛОВАРИ
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
       4. ЧТЕНИЕ ИСТОРИИ LAMPA  (ГЛУБОКИЙ АНАЛИЗ)
       ========================================================================= */
    var WEIGHTS = {
        history: 3.0, viewed: 3.0, look: 2.6, continued: 3.2,
        like: 2.8, wath: 1.8, book: 1.2, scheduled: 1.0, card: 1.0, thrown: -2.0
    };

    var History = {
        read: function () {
            var cards = {}, acc = {}, order = [], i, k;

            function addCard(c) {
                if (!c) return;
                var id = c.id || c.tmdb_id;
                if (!id) return;
                if (!cards[id]) cards[id] = c;
            }
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
                if (c.media_type === 'tv' || c.method === 'tv' || c.number_of_seasons || c.first_air_date || (c.name && !c.title)) return 'tv';
                if (c.media_type === 'movie' || c.method === 'movie' || c.release_date || c.title) return 'movie';
                return 'movie';
            }
            function processList(list, weight, recencyBase) {
                if (!list) return;
                if (isArr(list)) {
                    for (var i = 0; i < list.length; i++) {
                        var entry = list[i];
                        var recency = recencyBase ? (1 + clamp((list.length - i) / Math.max(list.length, 1), 0, 1) * 0.6) : 1;
                        if (entry && typeof entry === 'object') {
                            addCard(entry);
                            bump(entry.id || entry.tmdb_id, weight * recency, typeOf(entry), entry);
                        } else {
                            bump(entry, weight * recency, null, cards[entry] || null);
                        }
                    }
                } else if (typeof list === 'object') {
                    var keys = Object.keys(list);
                    for (var j = 0; j < keys.length; j++) {
                        var key = keys[j];
                        var entry = list[key];
                        var recency = recencyBase ? (1 + clamp((keys.length - j) / Math.max(keys.length, 1), 0, 1) * 0.6) : 1;
                        if (entry && typeof entry === 'object') {
                            var id = entry.id || entry.tmdb_id || (parseInt(key, 10) || null);
                            if (id) {
                                addCard(entry);
                                bump(id, weight * recency, typeOf(entry), entry);
                            }
                        } else {
                            var id2 = parseInt(key, 10);
                            if (id2) bump(id2, weight * recency, null, cards[id2] || null);
                        }
                    }
                }
            }

            var fav = null;
            try { if (window.Lampa && Lampa.Favorite && Lampa.Favorite.full) fav = Lampa.Favorite.full(); } catch (e) {}
            if (!fav || typeof fav !== 'object') fav = sGet('favorite', {});
            if (fav && typeof fav === 'object') {
                if (isArr(fav.card)) for (i = 0; i < fav.card.length; i++) addCard(fav.card[i]);
                for (k in fav) {
                    if (k === 'card') continue;
                    var list = fav[k];
                    var w = WEIGHTS[k];
                    if (w === undefined) w = 1.5;
                    processList(list, w, true);
                }
            }

            var extra = ['history', 'online_history', 'torrent_history', 'view', 'viewed', 'card_history', 'recomends_last'];
            for (var e = 0; e < extra.length; e++) {
                processList(sGet(extra[e], null), 2.5, true);
            }

            var timeline = sGet('timeline', {});
            if (timeline && typeof timeline === 'object') {
                for (var tk in timeline) {
                    var tv = timeline[tk];
                    if (tv && tv.id) {
                        var percent = tv.percent || (tv.time && tv.duration ? (tv.time / tv.duration) * 100 : 0);
                        var w = 2.0;
                        if (percent > 80) w = 3.5;
                        else if (percent > 40) w = 2.5;
                        else if (percent > 0) w = 1.0;
                        var type = tv.season ? 'tv' : (tv.episode ? 'tv' : 'movie');
                        bump(tv.id, w, type, null);
                    }
                }
            }

            var out = [];
            for (i = 0; i < order.length; i++) {
                var rec = acc[order[i]];
                if (!rec) continue;
                if (!rec.card && cards[rec.id]) rec.card = cards[rec.id];
                if (!rec.type) rec.type = typeOf(rec.card);
                if (rec.w <= 0) continue;
                out.push(rec);
            }
            out.sort(function (a, b) { return b.w - a.w; });
            return out;
        },

        stats: function () {
            var items = this.read();
            var withCards = 0;
            for (var i = 0; i < items.length; i++) if (items[i].card) withCards++;
            var timeline = sGet('timeline', {});
            var tlCount = 0;
            if (timeline && typeof timeline === 'object') for (var k in timeline) tlCount++;
            return { total: items.length, withCards: withCards, timeline: tlCount, items: items };
        }
    };

    /* =========================================================================
       5. МОДЕЛЬ ВКУСА
       ========================================================================= */
    var DCACHE_KEY = 'cm_dcache';

    var Taste = {
        cache: null,
        loadCache: function () {
            if (this.cache) return this.cache;
            var raw = null;
            try { raw = JSON.parse(localStorage.getItem(DCACHE_KEY) || '{}'); } catch (e) { raw = {}; }
            this.cache = raw || {};
            return this.cache;
        },
        saveCache: function () {
            try {
                var c = this.cache || {}, keys = [];
                for (var k in c) keys.push(k);
                if (keys.length > 240) {
                    var trimmed = {};
                    for (var i = keys.length - 240; i < keys.length; i++) trimmed[keys[i]] = c[keys[i]];
                    this.cache = trimmed;
                }
                localStorage.setItem(DCACHE_KEY, JSON.stringify(this.cache));
            } catch (e) {}
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
            var stats = History.stats();
            var items = stats.items;
            var self = this;

            if (!items.length) {
                return cb({ empty: true, count: 0, genres: [], keywords: [], seeds: [], watched: {}, stats: stats });
            }

            this.enrich(items, 14, function (cache) {
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
        }
    };

    /* =========================================================================
       6. СБОРКА КАПСУЛЫ
       ========================================================================= */
    function markList(list, type, src, via) {
        var out = [];
        if (!list) return out;
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (!it || !it.poster_path || it.adult) continue;
            it.media_type = it.media_type || type || (it.name && !it.title ? 'tv' : 'movie');
            if (it.media_type !== 'movie' && it.media_type !== 'tv') continue;
            it._src = src;
            it._via = via || null;
            out.push(it);
        }
        return out;
    }

    var Capsule = {
        shownKey: 'cm_shown',
        shown: function () { var v = sGet(this.shownKey, []); return isArr(v) ? v : []; },
        remember: function (ids) {
            var s = this.shown().concat(ids);
            if (s.length > 80) s = s.slice(s.length - 80);
            sSet(this.shownKey, s);
        },
        forget: function () { sSet(this.shownKey, []); },

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
                    }, function (d) {
                        done(markList(d && d.results, 'movie', 'genre', { genres: gids }));
                    }, function () { done([]); }, { force: force });
                });
            }

            if (topK.length) {
                var kids = [];
                for (var j = 0; j < Math.min(topK.length, 3); j++) kids.push(topK[j].id);
                tasks.push(function (done) {
                    Net.get('/discover/movie', {
                        with_keywords: kids.join('|'), sort_by: 'popularity.desc', page: page,
                        'vote_count.gte': 120, 'vote_average.gte': 6.2, include_adult: false
                    }, function (d) {
                        done(markList(d && d.results, 'movie', 'keyword', { kw: topK[0].name }));
                    }, function () { done([]); }, { force: force });
                });
            }

            if (!seeds.length && !topG.length) {
                tasks.push(function (done) {
                    Net.get('/discover/movie', {
                        sort_by: 'vote_average.desc', 'vote_count.gte': 3000, 'vote_average.gte': 7.6,
                        page: page, include_adult: false
                    }, function (d) { done(markList(d && d.results, 'movie', 'top')); }, function () { done([]); }, { force: force });
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
                    }, function (d) {
                        var more = self.pick(all.concat(markList(d && d.results, 'movie', 'relax')), taste, force);
                        cb(more);
                    }, function () { cb(picked); });
                } else cb(picked);
            });
        },

        pick: function (all, taste, force) {
            var seen = {}, out = [], i, j;
            var shown = force ? this.shown() : [];
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
                    if (gWeight[gid]) s += 4 * (gWeight[gid] / maxG);
                }
                if (it._src === 'seed') s += 5;
                if (it._src === 'keyword') s += 4.5;
                if (it._src === 'genre') s += 2;
                s += clamp(it.vote_average - 6, 0, 3) * 1.6;
                s += clamp((it.vote_count || 0) / 4000, 0, 1.2);
                if (taste.era) {
                    var y = parseInt(String(it.release_date || it.first_air_date || '').slice(0, 4), 10) || 0;
                    if (y) s -= clamp(Math.abs(y - taste.era) / 30, 0, 1.2);
                }
                if (!it.overview) s -= 1;

                it._score = s;
                seen[key] = it;
                out.push(it);
            }

            out.sort(function (a, b) { return b._score - a._score; });
            var bySrc = {}, final = [];
            for (i = 0; i < out.length && final.length < CAPSULE_SIZE; i++) {
                var src = out[i]._src || 'x';
                bySrc[src] = (bySrc[src] || 0) + 1;
                if (bySrc[src] > 3) continue;
                final.push(out[i]);
            }
            for (i = 0; final.length < CAPSULE_SIZE && i < out.length; i++) {
                if (indexOfArr(final, out[i]) === -1) final.push(out[i]);
            }
            return final;
        },

        reason: function (item, taste) {
            if (item._reasonText) return item._reasonText;
            var r = '';
            if (item._src === 'seed' && item._via && item._via.seed) {
                r = 'На одной волне с «' + item._via.seed + '» из твоего бортового журнала';
            } else if (item._src === 'keyword' && item._via && item._via.kw) {
                r = 'Тема «' + item._via.kw + '» — твой частый маршрут. Это кино её отлично раскрывает';
            } else if (item._src === 'genre' || item._src === 'relax') {
                var names = [];
                var gids = item.genre_ids || [];
                for (var i = 0; i < (taste.genres || []).length && names.length < 2; i++) {
                    if (indexOfArr(gids, taste.genres[i].id) > -1 && taste.genres[i].name) names.push(taste.genres[i].name);
                }
                r = names.length ? 'Твои любимые ' + names.join(' и ') + '. Оценка зрителей: ' + (item.vote_average || 0).toFixed(1)
                    : 'Высокая оценка зрителей: ' + (item.vote_average || 0).toFixed(1) + '. Проверенная классика';
            } else if (item._src === 'search') {
                r = item._via && item._via.query ? 'Навел оптику по запросу «' + item._via.query + '»' : 'Найдено по координатам';
            } else {
                r = 'Одно из самых высоко оценённых: ' + (item.vote_average || 0).toFixed(1);
            }
            if (item._multi) r += ' · совпало сразу по нескольким признакам';
            item._reasonText = r;
            return r;
        }
    };

    /* =========================================================================
       7. ПОИСК ПО ТЕГАМ И ОПИСАНИЯМ
       ========================================================================= */
    function parseQuery(raw) {
        var q = String(raw || '').toLowerCase().replace(/ё/g, 'е');
        var ctx = { raw: raw, genresM: [], genresT: [], tags: [], tokens: [], type: 'any', yearFrom: 0, yearTo: 0, minVote: 5.8, minVotes: 40 };
        var i, j;
        if (/сериал|сезон|series/.test(q)) ctx.type = 'tv';
        else if (/фильм|кино|movie/.test(q)) ctx.type = 'movie';

        for (i = 0; i < GENRE_SYN.length; i++) for (j = 0; j < GENRE_SYN[i].w.length; j++) {
            if (q.indexOf(GENRE_SYN[i].w[j]) > -1) {
                ctx.genresM = ctx.genresM.concat(GENRE_SYN[i].m);
                ctx.genresT = ctx.genresT.concat(GENRE_SYN[i].t);
                break;
            }
        }
        for (i = 0; i < TAG_SYN.length; i++) for (j = 0; j < TAG_SYN[i].w.length; j++) {
            if (q.indexOf(TAG_SYN[i].w[j]) > -1) { ctx.tags.push(TAG_SYN[i].k); break; }
        }
        var dec = q.match(/(\d{2})\s?-?\s?х/);
        if (dec) {
            var d = parseInt(dec[1], 10), base = d >= 30 ? 1900 + d : 2000 + d;
            ctx.yearFrom = base; ctx.yearTo = base + 9;
        }
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
        ctx.genresM = uniqNum(ctx.genresM);
        ctx.genresT = uniqNum(ctx.genresT);
        ctx.tags = uniqStr(ctx.tags);
        return ctx;
    }
    function uniqNum(a) { var o = [], s = {}; for (var i = 0; i < a.length; i++) if (!s[a[i]]) { s[a[i]] = 1; o.push(a[i]); } return o; }
    function uniqStr(a) { return uniqNum(a); }
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
                var ids = [];
                for (var i = 0; i < res.length; i++) if (res[i]) ids.push(res[i]);
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
                    var all = [];
                    for (var i = 0; i < packs.length; i++) all = all.concat(packs[i] || []);
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
                for (j = 0; j < stems.length; j++) {
                    if (title.indexOf(stems[j]) > -1) s += 5;
                    if (over.indexOf(stems[j]) > -1) s += 2.5;
                }
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
                it._score = s;
                seen[key] = it;
                out.push(it);
            }
            out.sort(function (a, b) { return b._score - a._score; });
            return out.slice(0, CAPSULE_SIZE * 2);
        }
    };

    /* =========================================================================
       8. ОФОРМЛЕНИЕ
       ========================================================================= */
    var CSS = [
        '.cm-root{position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;overflow:hidden;color:#E8ECF5;',
        'background:#05070D;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
        '-webkit-tap-highlight-color:transparent;user-select:none;}',
        '.cm-root *{box-sizing:border-box;}',
        '.cm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;}',
        '.cm-stars{position:absolute;top:-10%;left:-10%;width:120%;height:120%;opacity:.5;',
        'background-image:radial-gradient(1px 1px at 12% 22%,#fff,transparent),radial-gradient(1px 1px at 68% 14%,#cfe6ff,transparent),',
        'radial-gradient(1.4px 1.4px at 84% 62%,#fff,transparent),radial-gradient(1px 1px at 32% 78%,#9fd4ff,transparent),',
        'radial-gradient(1px 1px at 52% 46%,#fff,transparent),radial-gradient(1.2px 1.2px at 8% 64%,#fff,transparent);',
        'background-repeat:repeat;background-size:100% 100%;animation:cm-drift 60s linear infinite;}',
        '@keyframes cm-drift{0%{transform:translate3d(0,0,0);}100%{transform:translate3d(-2%,-3%,0);}}',
        '.cm-glow{position:absolute;top:-25%;left:-25%;width:150%;height:150%;background-size:cover;background-position:center;',
        'opacity:0;filter:blur(90px) saturate(160%);transition:opacity .9s ease;}',
        '.cm-glow.on{opacity:.28;}',
        '.cm-shade{position:absolute;top:0;left:0;right:0;bottom:0;',
        'background:radial-gradient(90% 70% at 65% 40%,rgba(5,7,13,.15),rgba(5,7,13,.86) 62%,#05070D 100%);}',
        '.cm-bar{position:absolute;top:0;left:0;right:0;height:4.4em;display:flex;align-items:center;padding:0 1.7em;z-index:40;}',
        '.cm-bar-r{margin-left:auto;display:flex;align-items:center;}',
        '.cm-ico{width:2.8em;height:2.8em;margin-left:.55em;border-radius:50%;display:flex;align-items:center;justify-content:center;',
        'background:rgba(232,236,245,.06);cursor:pointer;transition:background .18s,transform .18s,box-shadow .18s;}',
        '.cm-ico svg{width:1.35em;height:1.35em;fill:#9FB0C8;}',
        '.cm-ico.cm-focus{background:#FF7A2F;transform:scale(1.12);box-shadow:0 0 0 .16em rgba(255,122,47,.35);}',
        '.cm-ico.cm-focus svg{fill:#05070D;}',
        '.cm-ico.spin svg{animation:cm-spin .9s linear infinite;}',
        '@keyframes cm-spin{to{transform:rotate(360deg);}}',
        '.cm-stage{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;padding:4.6em 4em 2em 4em;}',
        '.cm-port{position:relative;display:flex;align-items:center;width:100%;max-width:76em;margin:0 auto;',
        'border-radius:2.4em;padding:2.2em;background:linear-gradient(160deg,rgba(24,32,48,.72),rgba(9,12,20,.82));',
        'box-shadow:inset 0 0 0 1px rgba(159,176,200,.16),inset 0 2em 5em rgba(0,0,0,.55),0 2em 5em rgba(0,0,0,.55);}',
        '.cm-port:before{content:"";position:absolute;top:0;left:0;right:0;bottom:0;border-radius:2.4em;pointer-events:none;',
        'background:linear-gradient(115deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,0) 34%);box-shadow:inset 0 0 40px rgba(0,0,0,0.8);}',
        '.cm-hero-poster{position:relative;flex:none;width:17.5em;height:26em;border-radius:1.4em;overflow:hidden;background:#0B0F18;',
        'box-shadow:0 1.6em 3.4em rgba(0,0,0,.65);margin-right:2.4em;}',
        '.cm-hero-poster img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .45s;}',
        '.cm-hero-poster img.ready{opacity:1;}',
        '.cm-hero{flex:1;min-width:0;}',
        '.cm-count{font-size:.72em;letter-spacing:.28em;color:#6C7C94;margin-bottom:.9em;}',
        '.cm-count b{color:#FF7A2F;font-weight:700;}',
        '.cm-name{font-size:2.7em;font-weight:800;line-height:1.05;letter-spacing:-.02em;margin-bottom:.28em;color:#F2F5FA;text-shadow:0 4px 24px rgba(0,0,0,0.6);}',
        '.cm-meta{font-size:.78em;letter-spacing:.14em;color:#8695AC;margin-bottom:1.1em;}',
        '.cm-meta i{font-style:normal;color:#7FD8FF;}',
        '.cm-why{position:relative;padding-left:1.1em;font-size:1.02em;line-height:1.45;color:#C6D2E4;margin-bottom:1em;max-width:34em;}',
        '.cm-why:before{content:"";position:absolute;left:0;top:.35em;bottom:.35em;width:.18em;border-radius:.1em;background:#FF7A2F;}',
        '.cm-plot{font-size:.95em;line-height:1.5;color:#8695AC;margin-bottom:1.6em;max-width:36em;max-height:4.6em;overflow:hidden;}',
        '.cm-acts{display:flex;flex-wrap:wrap;}',
        '.cm-act{display:flex;align-items:center;padding:.85em 1.5em;border-radius:.85em;margin:0 .7em .7em 0;cursor:pointer;',
        'background:rgba(232,236,245,.07);font-size:1em;font-weight:600;color:#DCE4F0;transition:background .16s,transform .16s,color .16s;}',
        '.cm-act svg{width:1.1em;height:1.1em;fill:currentColor;margin-right:.55em;}',
        '.cm-act.primary{background:#FF7A2F;color:#05070D;}',
        '.cm-act.cm-focus{background:#FFFFFF;color:#05070D;transform:scale(1.05);}',
        '.cm-act.primary.cm-focus{background:#FF9354;color:#05070D;}',
        '.cm-tray{position:absolute;left:0;right:0;bottom:1.4em;display:flex;justify-content:center;z-index:30;}',
        '.cm-tray-in{display:flex;align-items:center;padding:.6em;border-radius:1.4em;background:rgba(9,12,20,.6);',
        'box-shadow:inset 0 0 0 1px rgba(159,176,200,.12);}',
        '.cm-mini{position:relative;flex:none;width:4.4em;height:6.4em;border-radius:.7em;overflow:hidden;margin:0 .45em;',
        'background:#0B0F18;cursor:pointer;opacity:.55;transition:opacity .18s,transform .18s,box-shadow .18s;}',
        '.cm-mini img{width:100%;height:100%;object-fit:cover;}',
        '.cm-mini.active{opacity:1;}',
        '.cm-mini.cm-focus{opacity:1;transform:translateY(-.5em) scale(1.1);box-shadow:0 .6em 1.4em rgba(0,0,0,.6),0 0 0 .14em #FF7A2F;}',
        '.cm-astro-wrap{position:absolute;left:1.6em;bottom:1.2em;z-index:35;display:flex;align-items:flex-end;}',
        '.cm-astro{width:8.2em;height:9.4em;flex:none;cursor:pointer;border-radius:1.4em;transition:transform .2s,box-shadow .2s;}',
        '.cm-astro svg{width:100%;height:100%;}',
        '.cm-astro .cm-body{animation:cm-float 6s ease-in-out infinite;transform-origin:50% 50%;}',
        '.cm-astro .cm-chest-glow{animation:cm-pulse 4s ease-in-out infinite;transform-origin:center;filter:blur(4px);}',
        '@keyframes cm-pulse{0%,100%{opacity:.2;transform:scale(0.8);}50%{opacity:.6;transform:scale(1.2);}}',
        '.cm-astro.cm-focus{transform:scale(1.08);box-shadow:0 0 0 .16em #FF7A2F;background:rgba(255,122,47,.1);}',
        '@keyframes cm-float{0%,100%{transform:translateY(0) rotate(-3deg);}50%{transform:translateY(-.5em) rotate(3deg);}}',
        '.cm-say{margin:0 0 1.4em 1em;max-width:24em;padding:.8em 1.15em;border-radius:1.1em 1.1em 1.1em .25em;',
        'background:rgba(12,17,27,.9);box-shadow:inset 0 0 0 1px rgba(159,176,200,.16);font-size:.98em;line-height:1.4;color:#C6D2E4;}',
        '.cm-load{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}',
        '.cm-load-ring{width:4.5em;height:4.5em;border-radius:50%;box-shadow:inset 0 0 0 .18em rgba(159,176,200,.18);position:relative;}',
        '.cm-load-ring:after{content:"";position:absolute;top:-.18em;left:-.18em;right:-.18em;bottom:-.18em;border-radius:50%;',
        'border:.18em solid transparent;border-top-color:#FF7A2F;animation:cm-spin 1.1s linear infinite;}',
        '.cm-load-txt{margin-top:1.2em;font-size:.75em;letter-spacing:.26em;color:#6C7C94;}',
        '.cm-ov{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(3,5,9,.85);z-index:999999;display:flex;',
        'align-items:center;justify-content:center;padding:1.5em;}',
        '.cm-modal{width:38em;max-width:100%;max-height:86%;overflow-y:auto;padding:1.9em;border-radius:1.6em;',
        'background:linear-gradient(180deg,rgba(15,20,32,0.98) 0%,rgba(8,11,18,0.98) 100%);box-shadow:0 2em 5em rgba(0,0,0,0.8),inset 0 1px 0 rgba(255,255,255,0.08);}',
        '.cm-modal::-webkit-scrollbar{width:0;}',
        '.cm-modal h3{margin:0 0 .35em;font-size:1.35em;font-weight:800;letter-spacing:-.01em;}',
        '.cm-modal p{margin:0 0 1.2em;color:#8695AC;font-size:.98em;line-height:1.55;}',
        '.cm-modal p b{color:#C6D2E4;}',
        '.cm-opt{display:block;width:100%;text-align:left;padding:.85em 1.1em;margin-bottom:.55em;border-radius:.85em;',
        'background:rgba(232,236,245,.06);color:#DCE4F0;font-size:1em;cursor:pointer;transition:background .15s,transform .15s,color .15s;}',
        '.cm-opt.cm-focus{background:#FF7A2F;color:#05070D;transform:scale(1.02);}',
        '.cm-opt small{display:block;font-size:.76em;opacity:.7;margin-top:.15em;}',
        '.cm-chips{display:flex;flex-wrap:wrap;margin-bottom:1em;}',
        '.cm-chip{padding:.6em 1em;margin:0 .5em .5em 0;border-radius:1.2em;font-size:.94em;cursor:pointer;',
        'background:rgba(232,236,245,.06);transition:background .15s,transform .15s,color .15s;}',
        '.cm-chip.cm-focus{background:#7FD8FF;color:#05070D;transform:scale(1.06);}',
        '.cm-input{width:100%;padding:.85em 1.05em;margin-bottom:1em;border-radius:.85em;font-size:1.02em;color:#fff;outline:none;',
        'background:rgba(232,236,245,.06);border:1px solid rgba(159,176,200,.2);}',
        '.cm-toast{position:fixed;left:50%;bottom:2.2em;transform:translateX(-50%) translateY(1em);z-index:1000001;opacity:0;',
        'padding:.75em 1.3em;border-radius:.85em;background:rgba(11,15,24,.96);color:#DCE4F0;font-size:.95em;',
        'box-shadow:inset 0 0 0 1px rgba(159,176,200,.16);transition:opacity .25s,transform .25s;}',
        '.cm-toast.on{opacity:1;transform:translateX(-50%) translateY(0);}',
        '@media (hover:hover){.cm-act:hover,.cm-opt:hover,.cm-chip:hover{background:rgba(232,236,245,.14);}.cm-mini:hover{opacity:1;}}',
        '@media (max-width:1000px){',
        '.cm-root{font-size:14px;}',
        '.cm-stage{padding:4.4em 1.2em 9em;align-items:flex-start;}',
        '.cm-port{flex-direction:column;align-items:flex-start;padding:1.3em;border-radius:1.6em;}',
        '.cm-hero-poster{width:8.5em;height:12.6em;margin:0 0 1em;}',
        '.cm-name{font-size:1.8em;}',
        '.cm-plot{display:none;}',
        '.cm-act{flex:1 1 42%;justify-content:center;}',
        '.cm-astro{width:5em;height:5.8em;}',
        '.cm-say{display:none;}',
        '.cm-tray{bottom:.8em;}',
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
       9. ГРАФИКА
       ========================================================================= */
    var I_BACK = '<svg viewBox="0 0 24 24"><path d="M15.7 4.3a1 1 0 0 1 0 1.4L9.4 12l6.3 6.3a1 1 0 1 1-1.4 1.4l-7-7a1 1 0 0 1 0-1.4l7-7a1 1 0 0 1 1.4 0z"/></svg>';
    var I_SEARCH = '<svg viewBox="0 0 24 24"><path d="M10 2a8 8 0 1 1-4.9 14.3l-3.4 3.4a1 1 0 0 1-1.4-1.4l3.4-3.4A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>';
    var I_REFRESH = '<svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>';
    var I_GEAR = '<svg viewBox="0 0 24 24"><path d="M19.1 12.9c0-.3.1-.6.1-.9s0-.6-.1-.9l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.6-.9l-.4-2.5H10.9l-.4 2.5c-.6.2-1.1.5-1.6.9l-2.4-1-2 3.4 2 1.6c0 .3-.1.6-.1.9s0 .6.1.9l-2 1.6 2 3.4 2.4-1c.5.4 1 .7 1.6.9l.4 2.5h3.8l.4-2.5c.6-.2 1.1-.5 1.6-.9l2.4 1 2-3.4-2-1.6zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>';
    var I_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    var I_NEXT = '<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z"/></svg>';
    var I_INFO = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
    var I_CAPSULE = '<svg viewBox="0 0 24 24"><path d="M17 2a5 5 0 0 1 3.5 8.5l-10 10A5 5 0 0 1 3.5 13.5l10-10A5 5 0 0 1 17 2zm-2 3.9-9.1 9.2a3 3 0 0 0 4.2 4.2L19.2 10a3 3 0 0 0-4.2-4.2z"/></svg>';

    var SVG_ASTRO = [
        '<svg viewBox="0 0 170 190" xmlns="http://www.w3.org/2000/svg">',
        '<defs>',
        '<linearGradient id="cmSuit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2F5FA"/><stop offset="1" stop-color="#9AA7BC"/></linearGradient>',
        '<radialGradient id="cmVisor" cx="0.34" cy="0.28" r="0.85"><stop offset="0" stop-color="#3A7CA5"/><stop offset="0.4" stop-color="#163854"/><stop offset="1" stop-color="#05070D"/></radialGradient>',
        '<linearGradient id="cmPack" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B9C4D6"/><stop offset="1" stop-color="#6E7C93"/></linearGradient>',
        '</defs>',
        '<path d="M2 178 C 26 176, 34 152, 30 132" fill="none" stroke="#4A576B" stroke-width="3.4" stroke-linecap="round" opacity=".9"/>',
        '<g class="cm-body">',
        '<rect x="44" y="66" width="82" height="72" rx="26" fill="url(#cmPack)"/>',
        '<rect x="20" y="76" width="30" height="54" rx="15" fill="url(#cmSuit)"/>',
        '<rect x="120" y="76" width="30" height="54" rx="15" fill="url(#cmSuit)"/>',
        '<rect x="20" y="96" width="30" height="7" fill="#FF7A2F" opacity=".9"/>',
        '<rect x="120" y="96" width="30" height="7" fill="#FF7A2F" opacity=".9"/>',
        '<rect x="56" y="128" width="24" height="50" rx="12" fill="url(#cmSuit)"/>',
        '<rect x="90" y="128" width="24" height="50" rx="12" fill="url(#cmSuit)"/>',
        '<rect x="50" y="70" width="70" height="66" rx="24" fill="url(#cmSuit)"/>',
        '<rect x="70" y="92" width="30" height="20" rx="6" fill="#0C1727"/>',
        '<circle cx="78" cy="102" r="3" fill="#FF7A2F"/>',
        '<circle class="cm-chest-glow" cx="85" cy="102" r="12" fill="#FF7A2F" opacity="0.4"/>',
        '<circle cx="94" cy="102" r="3" fill="#7FD8FF"/>',
        '<circle cx="85" cy="48" r="36" fill="url(#cmSuit)"/>',
        '<ellipse cx="85" cy="48" rx="27" ry="24" fill="url(#cmVisor)"/>',
        '<path d="M66 36 C 74 28, 88 27, 96 32 C 88 34, 76 39, 70 47 Z" fill="#FFFFFF" opacity=".4"/>',
        '<circle cx="95" cy="55" r="2.2" fill="#7FD8FF" opacity=".95"/>',
        '<circle cx="76" cy="60" r="1.4" fill="#FFFFFF" opacity=".8"/>',
        '<rect x="79" y="12" width="12" height="10" rx="4" fill="#B9C4D6"/>',
        '<circle cx="85" cy="10" r="5" fill="#FF7A2F"/>',
        '</g></svg>'
    ].join('');

    /* =========================================================================
       10. НАВИГАЦИЯ
       ========================================================================= */
    var Nav = {
        rows: [], r: 0, c: 0, scroller: null,
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
        nearest: function (target, from) {
            var row = this.rows[target];
            if (!row) return 0;
            if (!from || !from.getBoundingClientRect) return row.memo || 0;
            var fx = from.getBoundingClientRect().left + from.offsetWidth / 2;
            var best = 0, bd = Infinity;
            for (var i = 0; i < row.items.length; i++) {
                var b = row.items[i].getBoundingClientRect();
                var d = Math.abs(b.left + b.width / 2 - fx);
                if (d < bd) { bd = d; best = i; }
            }
            return best;
        },
        move: function (dir) {
            if (!this.rows.length) return;
            var cur = this.current();
            if (dir === 'left' && this.c > 0) this.setFocus(this.r, this.c - 1);
            else if (dir === 'right' && this.c < this.rows[this.r].items.length - 1) this.setFocus(this.r, this.c + 1);
            else if (dir === 'up' && this.r > 0) this.setFocus(this.r - 1, this.nearest(this.r - 1, cur));
            else if (dir === 'down' && this.r < this.rows.length - 1) this.setFocus(this.r + 1, this.nearest(this.r + 1, cur));
        },
        enter: function () { trigger(this.current()); }
    };

    var touchMode = false;
    document.addEventListener('touchstart', function () { touchMode = true; }, true);

    function bindPointer(node, r, c) {
        node.setAttribute('data-cm-r', r);
        node.setAttribute('data-cm-c', c);
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

    var swipe = { x: 0, y: 0, on: false };
    document.addEventListener('touchstart', function (e) {
        if (!App.active || Modal.active()) return;
        swipe.x = e.touches[0].clientX; swipe.y = e.touches[0].clientY; swipe.on = true;
    }, true);
    document.addEventListener('touchend', function (e) {
        if (!swipe.on || !App.active || Modal.active()) return;
        swipe.on = false;
        var t = e.changedTouches[0];
        var dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
            if (dx < 0) View.step(1); else View.step(-1);
        }
    }, true);

    /* =========================================================================
       11. ТОСТ / МОДАЛЬНЫЕ / ВВОД
       ========================================================================= */
    var Toast = {
        node: null, timer: null,
        show: function (text) {
            if (!this.node) { this.node = el('div', 'cm-toast'); document.body.appendChild(this.node); }
            var n = this.node;
            n.textContent = text;
            addClass(n, 'on');
            clearTimeout(this.timer);
            this.timer = setTimeout(function () { removeClass(n, 'on'); }, 2600);
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
            var ov = el('div', 'cm-ov'), box = el('div', 'cm-modal'), nodes = [];
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
            if (opts.items) for (var j = 0; j < opts.items.length; j++) (function (it) {
                var b = el('div', 'cm-opt', esc(it.label) + (it.hint ? '<small>' + esc(it.hint) + '</small>' : ''));
                b._cmAction = function () { self.close(); if (it.onSelect) it.onSelect(); };
                box.appendChild(b); nodes.push(b);
            })(opts.items[j]);

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
        var st = Modal.open({
            title: title,
            items: [{ label: 'Найти', onSelect: function () { if (input.value) cb(input.value); } }, { label: 'Отмена' }]
        });
        st.box.insertBefore(input, st.box.childNodes[1] || null);
        input.onkeydown = function (e) {
            e.stopPropagation();
            if (e.keyCode === 13 && input.value) { Modal.close(); cb(input.value); }
        };
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
    }

    /* =========================================================================
       12. ЭКРАН КАПСУЛЫ
       ========================================================================= */
    var View = {
        root: null, stage: null, glow: null,
        list: [], idx: 0, taste: null, source: 'taste', sourceLabel: '',
        say: null, busy: false,

        create: function () {
            injectCSS();
            this.root = el('div', 'cm-root');
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
                    if (!list.length) {
                        self.renderEmpty();
                        return;
                    }
                    var ids = [];
                    for (var i = 0; i < list.length; i++) ids.push(list[i].id);
                    Capsule.remember(ids);
                    self.list = list;
                    self.idx = 0;
                    self.render();
                    self.greet();
                });
            });
        },

        greet: function () {
            var t = this.taste;
            if (!t || t.empty || !t.count) {
                this.speak('Пока в моей памяти пусто. Давай зададим координаты: расскажи, какое у тебя настроение, и я проложу маршрут.');
                return;
            }
            var parts = [];
            for (var i = 0; i < Math.min(t.genres.length, 2); i++) if (t.genres[i].name) parts.push(t.genres[i].name);
            var kw = t.keywords.length ? t.keywords[0].name : '';
            var line = 'Изучил ' + t.count + ' записей бортового журнала';
            if (parts.length) line += ': чаще всего ты выбираешь ' + parts.join(' и ');
            if (kw) line += ', тебя тянет на тему «' + kw + '»';
            this.speak(line + '. В этом отсеке тихо. Я подготовил шесть историй, которые точно тебе отзовутся.');
        },

        speak: function (text) { if (this.say) this.say.textContent = text; },

        renderEmpty: function () {
            this.stage.innerHTML = '';
            var bar = this.bar();
            this.stage.appendChild(bar.el);
            var wrap = el('div', 'cm-stage');
            var port = el('div', 'cm-port');
            var hero = el('div', 'cm-hero');
            hero.appendChild(el('div', 'cm-count cm-mono', 'КАПСУЛА ПУСТА'));
            hero.appendChild(el('div', 'cm-name', 'Нечего показать'));
            hero.appendChild(el('div', 'cm-why', 'TMDb не ответил или нет интернета. Проверь соединение и ключ в настройках.'));
            var acts = el('div', 'cm-acts');
            var retry = el('div', 'cm-act primary', 'Попробовать снова');
            retry._cmAction = function () { Net.drop(); View.loading('ПОВТОРЯЮ ПОПЫТКУ'); View.boot(true); };
            acts.appendChild(retry);
            hero.appendChild(acts);
            port.appendChild(hero);
            wrap.appendChild(port);
            this.stage.appendChild(wrap);
            Nav.reset();
            Nav.addRow(bar.items);
            Nav.addRow([retry]);
            Nav.setFocus(1, 0, true);
        },

        bar: function () {
            var bar = el('div', 'cm-bar'), items = [];
            var back = el('div', 'cm-ico', I_BACK);
            back._cmAction = function () { exitApp(); };
            bar.appendChild(back); items.push(back);
            var right = el('div', 'cm-bar-r');
            var find = el('div', 'cm-ico', I_SEARCH);
            find._cmAction = function () { Companion.ask(); };
            var upd = el('div', 'cm-ico', I_REFRESH);
            upd._cmAction = function () { View.reload(upd); };
            var gear = el('div', 'cm-ico', I_GEAR);
            gear._cmAction = function () { Settings.open(); };
            right.appendChild(find); right.appendChild(upd); right.appendChild(gear);
            items.push(find); items.push(upd); items.push(gear);
            bar.appendChild(right);
            return { el: bar, items: items };
        },

        render: function () {
            var self = this;
            var m = this.list[this.idx];
            if (!m) return this.renderEmpty();

            this.stage.innerHTML = '';
            Nav.reset();

            var bar = this.bar();
            this.stage.appendChild(bar.el);
            Nav.addRow(bar.items);

            var wrap = el('div', 'cm-stage');
            var port = el('div', 'cm-port');

            var pos = el('div', 'cm-hero-poster');
            if (m.poster_path) {
                var img = el('img');
                img.onload = function () { addClass(img, 'ready'); };
                img.src = IMG + 'w500' + m.poster_path;
                pos.appendChild(img);
            }
            port.appendChild(pos);

            var hero = el('div', 'cm-hero');
            hero.appendChild(el('div', 'cm-count cm-mono',
                esc(this.sourceLabel || 'КАПСУЛА') + ' · <b>' + pad2(this.idx + 1) + '</b> / ' + pad2(this.list.length)));
            hero.appendChild(el('div', 'cm-name', esc(m.title || m.name || '')));

            var year = String(m.release_date || m.first_air_date || '').slice(0, 4);
            var gnames = [];
            var gids = m.genre_ids || [];
            for (var g = 0; g < Math.min(gids.length, 2); g++) if (GENRE_NAMES[gids[g]]) gnames.push(GENRE_NAMES[gids[g]]);
            var meta = [];
            if (year) meta.push(year);
            if (m.vote_average) meta.push('<i>' + m.vote_average.toFixed(1) + '</i>');
            if (gnames.length) meta.push(gnames.join(' · '));
            if (m.media_type === 'tv') meta.push('сериал');
            hero.appendChild(el('div', 'cm-meta cm-mono', meta.join('  ·  ').toUpperCase()));

            hero.appendChild(el('div', 'cm-why', esc(Capsule.reason(m, this.taste || {}))));
            if (m.overview) hero.appendChild(el('div', 'cm-plot', esc(m.overview)));

            var acts = el('div', 'cm-acts');
            var bPlay = el('div', 'cm-act primary', I_PLAY + 'Смотреть');
            bPlay._cmAction = function () { play(m); };
            var bNext = el('div', 'cm-act', I_NEXT + 'Другое');
            bNext._cmAction = function () { self.step(1); };
            var bInfo = el('div', 'cm-act', I_INFO + 'Подробнее');
            bInfo._cmAction = function () { self.details(m); };
            acts.appendChild(bPlay); acts.appendChild(bNext); acts.appendChild(bInfo);
            hero.appendChild(acts);

            port.appendChild(hero);
            wrap.appendChild(port);
            this.stage.appendChild(wrap);
            Nav.addRow([bPlay, bNext, bInfo]);

            var tray = el('div', 'cm-tray');
            var trayIn = el('div', 'cm-tray-in');
            var minis = [];
            for (var i = 0; i < this.list.length; i++) (function (item, index) {
                var mini = el('div', 'cm-mini' + (index === self.idx ? ' active' : ''));
                if (item.poster_path) {
                    var mi = el('img');
                    mi.src = IMG + 'w185' + item.poster_path;
                    mini.appendChild(mi);
                }
                mini._cmAction = function () { self.go(index); };
                trayIn.appendChild(mini);
                minis.push(mini);
            })(this.list[i], i);
            tray.appendChild(trayIn);
            this.stage.appendChild(tray);
            Nav.addRow(minis);

            var aw = el('div', 'cm-astro-wrap');
            var astro = el('div', 'cm-astro', SVG_ASTRO);
            astro._cmAction = function () { Companion.open(); };
            this.say = el('div', 'cm-say', this.say ? this.say.textContent : '');
            aw.appendChild(astro);
            aw.appendChild(this.say);
            this.stage.appendChild(aw);
            Nav.addRow([astro]);

            Nav.setFocus(1, 0, true);
            this.setGlow(m);
        },

        setGlow: function (m) {
            if (!sGet('cm_glow', true) || !this.glow) return;
            var url = m.backdrop_path ? IMG + 'w780' + m.backdrop_path : (m.poster_path ? IMG + 'w342' + m.poster_path : '');
            if (!url || this.glow._url === url) return;
            this.glow._url = url;
            this.glow.style.backgroundImage = 'url(' + url + ')';
            addClass(this.glow, 'on');
        },

        go: function (i) {
            if (i < 0 || i >= this.list.length || i === this.idx) return;
            var r = Nav.r, c = Nav.c;
            this.idx = i;
            this.render();
            Nav.setFocus(r, c, true);
        },

        step: function (delta) {
            if (!this.list.length) return;
            var next = this.idx + delta;
            if (next >= this.list.length) next = 0;
            if (next < 0) next = this.list.length - 1;
            this.go(next);
        },

        reload: function (icon) {
            if (this.busy) return;
            if (icon) addClass(icon, 'spin');
            Net.drop();
            var self = this;
            this.busy = true;
            Taste.build(function (taste) {
                self.taste = taste;
                Capsule.build(taste, { force: true }, function (list) {
                    self.busy = false;
                    if (icon) removeClass(icon, 'spin');
                    if (!list.length) { Toast.show('Ничего нового не нашлось'); return; }
                    var ids = [];
                    for (var i = 0; i < list.length; i++) ids.push(list[i].id);
                    Capsule.remember(ids);
                    self.list = list; self.idx = 0;
                    self.source = 'taste'; self.sourceLabel = 'КАПСУЛА';
                    self.render();
                    self.speak('Собрал новую капсулу — прошлые шесть больше не покажу.');
                });
            });
        },

        showFound: function (label, list, ctx) {
            if (!list.length) {
                this.speak('По «' + (ctx && ctx.raw ? ctx.raw : '') + '» пусто. Скажи проще: жанр, тема или год.');
                Toast.show('Ничего не нашлось');
                return;
            }
            var trimmed = list.slice(0, CAPSULE_SIZE);
            for (var i = 0; i < trimmed.length; i++) { trimmed[i]._src = 'search'; trimmed[i]._via = { query: ctx && ctx.raw }; trimmed[i]._reasonText = null; }
            this.list = trimmed;
            this.idx = 0;
            this.sourceLabel = label.toUpperCase();
            this.source = 'search';
            this.render();
            this.speak('Отобрал ' + trimmed.length + ' из ' + list.length + '. Первый — самое точное совпадение.');
        },

        details: function (m) {
            var type = m.media_type === 'tv' ? 'tv' : 'movie';
            Net.get('/' + type + '/' + m.id, { append_to_response: 'credits' }, function (d) {
                if (!d) return Toast.show('Не загрузилось');
                var crew = (d.credits && d.credits.crew) || [], cast = (d.credits && d.credits.cast) || [];
                var dir = '';
                for (var i = 0; i < crew.length; i++) if (crew[i].job === 'Director') { dir = crew[i].name; break; }
                var names = [];
                for (var c = 0; c < Math.min(cast.length, 5); c++) names.push(cast[c].name);
                var html = '';
                if (d.overview) html += esc(d.overview) + '<br><br>';
                if (dir) html += '<b>Режиссёр:</b> ' + esc(dir) + '<br>';
                if (names.length) html += '<b>В ролях:</b> ' + esc(names.join(', ')) + '<br>';
                if (d.runtime) html += '<b>Хронометраж:</b> ' + d.runtime + ' мин<br>';
                if (d.vote_average) html += '<b>Оценка TMDb:</b> ' + d.vote_average.toFixed(1) + ' (' + (d.vote_count || 0) + ')';
                Modal.open({
                    title: d.title || d.name || '',
                    text: html || 'Описание не заполнено.',
                    items: [
                        { label: 'Смотреть', onSelect: function () { play(m); } },
                        { label: 'Почему это в капсуле', onSelect: function () { Companion.why(m); } },
                        { label: 'Закрыть' }
                    ]
                });
            }, function () { Toast.show('Не загрузилось'); });
        }
    };

    /* =========================================================================
       13. КОМПАНЬОН
       ========================================================================= */
    var Companion = {
        open: function () {
            var self = this, chips = [];
            for (var i = 0; i < MOODS.length; i++) (function (mo) {
                chips.push({ label: mo.label, onSelect: function () { self.find(mo.q, mo.label); } });
            })(MOODS[i]);

            Modal.open({
                title: 'Космонавт на связи',
                text: 'В капсуле нет лишнего шума. Выбери состояние — и я подберу фильмы под него. Или просто скажи, чего хочется.',
                chips: chips,
                items: [
                    { label: 'Сказать словами', hint: 'например: «триллер про космос 90-х»', onSelect: function () { self.ask(); } },
                    { label: 'Похожее на последнее', onSelect: function () { self.similar(); } },
                    { label: 'Вернуть мою капсулу', onSelect: function () { View.loading('СОБИРАЮ КАПСУЛУ'); View.boot(false); } },
                    { label: 'Почему это в капсуле', onSelect: function () { self.why(View.list[View.idx]); } },
                    { label: 'Закрыть' }
                ]
            });
        },

        ask: function () {
            var self = this;
            askText('Что ищем?', '', function (v) { self.find(v, v); });
        },

        find: function (query, label) {
            if (!query) return;
            View.speak('Ищу: ' + query + '…');
            Search.run(query, View.taste, function (list, ctx) {
                View.showFound(label || query, list, ctx);
            });
        },

        similar: function () {
            var t = View.taste;
            if (!t || !t.seeds || !t.seeds.length) {
                Toast.show('История пуста');
                View.speak('Истории ещё нет — но скажи настроение, и я справлюсь.');
                return;
            }
            var seed = t.seeds[0];
            View.speak('Подбираю похожее на «' + (seed.title || 'последнее') + '»…');
            Net.get('/' + seed.type + '/' + seed.id + '/similar', { page: 1 }, function (d) {
                var list = markList(d && d.results, seed.type, 'seed', { seed: seed.title });
                var out = [];
                for (var i = 0; i < list.length && out.length < CAPSULE_SIZE; i++) {
                    if (t.watched[list[i].id]) continue;
                    out.push(list[i]);
                }
                View.list = out;
                View.idx = 0;
                View.source = 'search';
                View.sourceLabel = 'ПОХОЖЕЕ';
                View.render();
                View.speak('Всё это рядом с «' + (seed.title || 'последним') + '».');
            }, function () { Toast.show('Не получилось'); });
        },

        why: function (m) {
            if (!m) return;
            var t = View.taste || {};
            var html = '<b>' + esc(m.title || m.name || '') + '</b><br>' + esc(Capsule.reason(m, t)) + '<br><br>';
            if (t.count) {
                html += 'Что я прочитал из истории: <b>' + t.count + '</b> карточек';
                if (t.known) html += ', из них разобрано подробно — <b>' + t.known + '</b>';
                html += '.<br>';
                var gs = [];
                for (var i = 0; i < (t.genres || []).length; i++) if (t.genres[i].name) gs.push(t.genres[i].name);
                if (gs.length) html += 'Твои жанры: ' + esc(gs.join(', ')) + '.<br>';
                var ks = [];
                for (var k = 0; k < Math.min((t.keywords || []).length, 4); k++) ks.push(t.keywords[k].name);
                if (ks.length) html += 'Повторяющиеся темы: ' + esc(ks.join(', ')) + '.';
            } else {
                html += 'Историю Lampa я пока не вижу — подборка идёт по общим высоким оценкам. Посмотри пару фильмов или добавь их в избранное, и капсула станет личной.';
            }
            Modal.open({ title: 'Почему это здесь', text: html, items: [{ label: 'Понятно' }] });
        }
    };

    /* =========================================================================
       14. НАСТРОЙКИ И ДИАГНОСТИКА
       ========================================================================= */
    var Settings = {
        open: function () {
            var self = this;
            Modal.open({
                title: 'Капсула',
                text: 'Тише — значит лучше. Здесь только то, что реально влияет.',
                items: [
                    {
                        label: 'Свет от постера: ' + (sGet('cm_glow', true) ? 'вкл' : 'выкл'),
                        hint: 'на слабых ТВ лучше выключить',
                        onSelect: function () { sSet('cm_glow', !sGet('cm_glow', true)); self.open(); }
                    },
                    {
                        label: 'Что я знаю о твоих вкусах',
                        hint: 'проверка чтения истории Lampa',
                        onSelect: function () { self.diagnose(); }
                    },
                    {
                        label: 'Свой ключ TMDb',
                        hint: sGet('cm_tmdb_key', '') ? 'задан' : 'встроенный',
                        onSelect: function () {
                            askText('Ключ TMDb', sGet('cm_tmdb_key', ''), function (v) {
                                sSet('cm_tmdb_key', v.replace(/\s/g, ''));
                                Net.drop();
                                Toast.show('Ключ сохранён');
                            });
                        }
                    },
                    {
                        label: 'Показывать заново то, что уже видел',
                        hint: 'сбросить список показанных',
                        onSelect: function () { Capsule.forget(); Toast.show('Сброшено'); }
                    },
                    {
                        label: 'Пересобрать вкус с нуля',
                        hint: 'очистить кэш разбора истории',
                        onSelect: function () {
                            try { localStorage.removeItem(DCACHE_KEY); } catch (e) {}
                            Taste.cache = null;
                            Net.drop();
                            View.loading('ПЕРЕСОБИРАЮ ВКУС');
                            View.boot(true);
                        }
                    },
                    { label: 'Закрыть' }
                ]
            });
        },

        diagnose: function () {
            var st = History.stats();
            var t = View.taste || {};
            var html = 'В бортовом журнале найдено: <b>' + st.total + '</b> записей';
            html += ' (с полными данными — <b>' + st.withCards + '</b>, отметок в таймлайне — <b>' + st.timeline + '</b>).<br><br>';
            if (!st.total) {
                html += 'Пока пусто. Обычно это значит, что ты ещё не открывал карточки в этом профиле. Посмотри пару фильмов или добавь их в избранное — и я запомню твой вкус.';
            } else {
                var gs = [];
                for (var i = 0; i < (t.genres || []).length; i++) gs.push(t.genres[i].name + ' (' + t.genres[i].score.toFixed(1) + ')');
                html += gs.length ? 'Жанры по весу: ' + esc(gs.join(', ')) + '.<br>' : 'Жанры ещё не разобраны — открой капсулу ещё раз.<br>';
                var ks = [];
                for (var k = 0; k < (t.keywords || []).length; k++) ks.push(t.keywords[k].name);
                if (ks.length) html += 'Темы: ' + esc(ks.join(', ')) + '.<br>';
                if (t.era) html += 'Тяготеешь к кино около <b>' + t.era + '</b> года.<br>';
                if (t.avgVote) html += 'Средняя оценка того, что смотришь: <b>' + t.avgVote.toFixed(1) + '</b>.';
            }
            Modal.open({ title: 'Что я знаю', text: html, items: [{ label: 'Закрыть' }] });
        }
    };

    /* =========================================================================
       15. ДЕЙСТВИЯ LAMPA
       ========================================================================= */
    function play(m) {
        try {
            if (window.Lampa && Lampa.Activity) {
                Lampa.Activity.push({
                    url: '', component: 'full', id: m.id,
                    method: m.media_type === 'tv' ? 'tv' : 'movie',
                    card: m, source: 'tmdb'
                });
                return;
            }
        } catch (e) {}
        notify('Lampa не отвечает');
    }
    function exitApp() {
        try { if (window.Lampa && Lampa.Activity) Lampa.Activity.backward(); } catch (e) {}
    }

    /* =========================================================================
       16. КЛАВИШИ
       ========================================================================= */
    var KEYS = { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 32: 'enter', 8: 'back', 27: 'back', 461: 'back', 10009: 'back' };

    function route(kind) {
        if (Modal.active()) {
            if (kind === 'back') Modal.close();
            else if (kind === 'enter') Modal.enter();
            else Modal.move(kind);
            return;
        }
        if (kind === 'enter') { Nav.enter(); return; }
        if (kind === 'back') {
            if (View.source === 'search') { View.loading('ВОЗВРАЩАЮ КАПСУЛУ'); View.boot(false); }
            else exitApp();
            return;
        }
        Nav.move(kind);
    }

    function keyFallback(e) {
        if (!App.active) return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        var kind = KEYS[e.keyCode];
        if (!kind) return;
        e.preventDefault();
        e.stopPropagation();
        route(kind);
    }

    /* =========================================================================
       17. КОМПОНЕНТ LAMPA
       ========================================================================= */
    var App = { active: false, fallback: false };

    function CapsuleComponent() {
        var node = null, wrapped = null;
        this.create = function () {
            node = View.create();
            wrapped = window.$ ? window.$(node) : node;
            return this.render();
        };
        this.render = function () { return wrapped; };
        this.start = function () {
            App.active = true;
            var ok = false;
            try { ok = !!(window.Lampa && Lampa.Controller && Lampa.Controller.add); } catch (e) {}
            if (ok) {
                Lampa.Controller.add(CTRL_ID, {
                    toggle: function () { try { Lampa.Controller.clear(); } catch (e) {} Nav.paint(true); },
                    up: function () { route('up'); },
                    down: function () { route('down'); },
                    left: function () { route('left'); },
                    right: function () { route('right'); },
                    enter: function () { route('enter'); },
                    back: function () { route('back'); }
                });
                Lampa.Controller.toggle(CTRL_ID);
            } else {
                App.fallback = true;
                document.addEventListener('keydown', keyFallback, true);
            }
        };
        this.pause = function () { App.active = false; };
        this.resume = function () { App.active = true; };
        this.stop = function () { App.active = false; };
        this.destroy = function () {
            App.active = false;
            if (App.fallback) document.removeEventListener('keydown', keyFallback, true);
            while (Modal.active()) Modal.close();
            if (node && node.parentNode) node.parentNode.removeChild(node);
            node = null; wrapped = null;
            Nav.reset();
        };
    }

    /* =========================================================================
       18. ПУНКТ МЕНЮ
       ========================================================================= */
    function addMenu() {
        var done = false;
        function tryAdd() {
            if (done) return;
            try {
                if (document.querySelector('[data-action="capsule_mod_entry"]')) { done = true; return; }
                var $ = window.jQuery || window.$;
                if (!$) return;
                var list = $('.menu .menu__list').eq(0);
                if (!list.length) return;
                var item = $('<li class="menu__item selector" data-action="capsule_mod_entry">' +
                    '<div class="menu__ico">' + I_CAPSULE + '</div><div class="menu__text">Капсула</div></li>');
                item.on('hover:enter click', function () {
                    try { Lampa.Activity.push({ url: '', title: 'Капсула', component: COMPONENT_ID, page: 1 }); } catch (e) {}
                });
                list.append(item);
                done = true;
            } catch (e) {}
        }
        if (window.appready) tryAdd();
        try {
            if (window.Lampa && Lampa.Listener) Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') tryAdd(); });
        } catch (e) {}
        setTimeout(tryAdd, 1500);
        setTimeout(tryAdd, 4000);
    }

    /* =========================================================================
       19. СТАРТ
       ========================================================================= */
    (function () {
        try {
            if (window.Lampa && Lampa.Component && Lampa.Component.add) Lampa.Component.add(COMPONENT_ID, CapsuleComponent);
            addMenu();
            console.log('[Капсула] v10.0 загружена');
        } catch (e) {
            console.error('[Капсула] ошибка старта:', e);
        }
    })();
})();
