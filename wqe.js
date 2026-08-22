/**
 * Capsule Mod v11.0 — «Капсула»
 *
 * Изолированное пространство внутри Lampa. Карточка = постер + «Смотреть».
 * Всё остальное (поиск, обновление, «почему это здесь», настройки, темы)
 * живёт в модалке компаньона-космонавта, вызываемой кнопкой «Компаньон»
 * под «Смотреть» — шапка экрана теперь пустая.
 *
 * Что изменилось относительно v9.1:
 *  — UI карточки: только постер + «Смотреть» + «Компаньон» (Details/Next/бар убраны)
 *  — 4 переключаемые темы оформления (Лаборатория / Матрица / Свиток / Портал)
 *  — Настройки регистрируются в системном меню Lampa (SettingsApi), с фолбэком
 *    в модалку компаньона, если SettingsApi недоступен
 *  — Левая/правая стрелка пульта ВСЕГДА листает фильм капсулы (как и свайп),
 *    вверх/вниз переключает фокус между кнопками и лотком миниатюр
 *  — Починена синхронизация истории: чтение больше не подмешивает «сырой»
 *    localStorage поверх Lampa.Storage — это и вызывало расхождение
 *    приложение/браузер. Теперь один источник правды (Lampa.Storage) с
 *    ожиданием готовности и повторными попытками; localStorage — только
 *    как резерв для собственных ключей плагина (тема, ключ TMDb и т.п.)
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

    /* =========================================================================
       2. ГОТОВНОСТЬ LAMPA + ХРАНИЛИЩЕ (фикс синхронизации)
       ========================================================================= */
    /*
       Причина бага «видно в приложении, нет в браузере»: старый код при
       любом промахе Lampa.Storage.get() тут же читал «сырой» localStorage
       как резерв. В момент первого вызова (сразу после старта скрипта)
       Lampa.Storage в браузерной сборке ещё может быть не прогрет —
       и вместо ожидания плагин молча подставлял локальный JSON, который
       не совпадает с тем, что реально видит сама Lampa (аккаунт-синхронизация,
       другой бэкенд хранилища и т.д.). В WebView сборке скрипт Lampa обычно
       успевает прогреться раньше, поэтому там расхождения не было видно.

       Фикс: для «чужих» ключей Lampa (favorite, history, timeline и т.п.)
       ЕДИНСТВЕННЫЙ источник правды — Lampa.Storage. Мы ждём событие
       app -> ready, а если Storage всё ещё выглядит пустым — делаем
       несколько повторных попыток с задержкой перед тем как признать
       историю пустой. Raw localStorage используется только для СОБСТВЕННЫХ
       ключей плагина (тема, ключ TMDb, «уже показано», свет от постера).
    */
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
    // страховка: если событие не пришло (или Lampa вообще нет) — не блокируем плагин навечно
    setTimeout(function () { if (!LampaReady.ready) flushReady(); }, 2500);

    /* Собственные ключи плагина — можно смело держать в localStorage. */
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

    /* Ключи, которыми владеет сама Lampa — читаем ТОЛЬКО через Lampa.Storage,
       с ожиданием готовности и повторными попытками при пустом ответе. */
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
    /** Асинхронное, но настойчивое чтение ключей Lampa. */
    function ownedGet(key, def, cb, attempt) {
        attempt = attempt || 0;
        onLampaReady(function () {
            if (!lampaStorageAvailable()) { cb(def); return; }
            var v = lampaGetRaw(key, def);
            if (!isEmptyish(v) || attempt >= 6) { cb(v); return; }
            // хранилище ещё догружается (частая причина расхождения браузер/приложение) — ждём и пробуем снова
            setTimeout(function () { ownedGet(key, def, cb, attempt + 1); }, 350);
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
        /** Асинхронно (ждёт готовность Lampa + повторяет попытки) собирает вес карточек. */
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

            // предпочитаем Lampa.Favorite.full(), но и её дожидаемся через onLampaReady,
            // а если она пуста/отсутствует — читаем ключ 'favorite' напрямую тем же надёжным путём
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
            // «уже показанное» исключаем ВСЕГДА, не только при явном force — так капсула
            // естественно выглядит свежей при каждом новом входе в плагин без ручного клика.
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
                    // sqrt-демпфирование: один сильно пересмотренный жанр больше не
                    // выжигает шансы остальных — вес растёт медленнее, чем линейно
                    if (gWeight[gid]) s += 4 * Math.sqrt(gWeight[gid] / maxG);
                }
                if (it._src === 'seed') s += 5;
                if (it._src === 'keyword') {
                    s += 4.5;
                    var kw = it._via && it._via.kw;
                    if (kw && kw.length > 12) s += 0.8; // специфичная тема — более надёжный сигнал, чем общая
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
                // лёгкий джиттер — «Обновить» ощущается как реальное обновление,
                // а не перестановка тех же шести карточек в том же порядке
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
            // резервируем один слот под «открытие» — хороший фильм вне топ-жанра пользователя,
            // чтобы капсула не закукливалась в одном и том же
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
       9. ТЕМЫ ОФОРМЛЕНИЯ
       ========================================================================= */
    /*
       Каждая тема — это набор CSS-переменных + класс на .cm-root, который
       включает дополнительные декоративные селекторы ниже в CSS. Никакой
       логики капсулы темы не трогают — только внешний вид.
    */
    var THEMES = {
        astro: { name: 'Космос', cls: 'cm-t-astro', vars: {
            '--cm-bg': '#05070D', '--cm-accent': '#FF7A2F', '--cm-accent2': '#7FD8FF',
            '--cm-text': '#E8ECF5', '--cm-sub': '#8695AC', '--cm-panel': 'rgba(16,21,32,.65)',
            '--cm-panel2': 'rgba(9,12,20,.55)', '--cm-chip': 'rgba(232,236,245,.05)', '--cm-radius': '1.5em'
        } },
        breakingbad: { name: 'Лаборатория', cls: 'cm-t-bb', vars: {
            '--cm-bg': '#0B0E08', '--cm-accent': '#D6E24A', '--cm-accent2': '#1FAE96',
            '--cm-text': '#EDF2E0', '--cm-sub': '#9AAE8C', '--cm-panel': 'rgba(19,24,13,.72)',
            '--cm-panel2': 'rgba(12,16,8,.6)', '--cm-chip': 'rgba(214,226,74,.08)', '--cm-radius': '.6em'
        } },
        matrix: { name: 'Матрица', cls: 'cm-t-matrix', vars: {
            '--cm-bg': '#000600', '--cm-accent': '#00FF41', '--cm-accent2': '#00B32E',
            '--cm-text': '#C8FFD4', '--cm-sub': '#4E9E5E', '--cm-panel': 'rgba(0,12,0,.72)',
            '--cm-panel2': 'rgba(0,8,0,.6)', '--cm-chip': 'rgba(0,255,65,.06)', '--cm-radius': '.2em'
        } },
        panda: { name: 'Свиток', cls: 'cm-t-panda', vars: {
            '--cm-bg': '#1C140B', '--cm-accent': '#D8433C', '--cm-accent2': '#E7B65C',
            '--cm-text': '#F4E9D2', '--cm-sub': '#B79E7B', '--cm-panel': 'rgba(42,31,18,.78)',
            '--cm-panel2': 'rgba(30,22,13,.65)', '--cm-chip': 'rgba(231,182,92,.1)', '--cm-radius': '.9em'
        } },
        rickmorty: { name: 'Портал', cls: 'cm-t-rm', vars: {
            '--cm-bg': '#07141B', '--cm-accent': '#7CFF6B', '--cm-accent2': '#3AD1FF',
            '--cm-text': '#E6FFF1', '--cm-sub': '#6FA894', '--cm-panel': 'rgba(6,22,28,.72)',
            '--cm-panel2': 'rgba(4,16,20,.6)', '--cm-chip': 'rgba(124,255,107,.08)', '--cm-radius': '1.1em'
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
        /* Лёгкие тематические эффекты: матричный «дождь» и портальная вспышка. */
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
        /* Круговая вспышка портала при открытии модалки компаньона (только для темы Портал). */
        portalBurst: function (fromNode) {
            if (Themes.current() !== 'rickmorty') return;
            var ring = el('div', 'cm-portal-burst');
            document.body.appendChild(ring);
            setTimeout(function () { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 650);
        }
    };

    /* =========================================================================
       10. CSS
       ========================================================================= */
    var CSS = [
        '.cm-root{position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;overflow:hidden;color:var(--cm-text);',
        'background:var(--cm-bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
        '-webkit-tap-highlight-color:transparent;user-select:none;transition:background .4s;}',
        '.cm-root *{box-sizing:border-box;}',
        '.cm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;}',
        '.cm-rain{position:absolute;top:0;left:0;width:100%;height:100%;opacity:.5;pointer-events:none;}',

        '.cm-stars{position:absolute;top:-10%;left:-10%;width:120%;height:120%;opacity:.35;',
        'background-image:radial-gradient(1px 1px at 12% 22%,#fff,transparent),radial-gradient(1px 1px at 68% 14%,#cfe6ff,transparent),',
        'radial-gradient(1.4px 1.4px at 84% 62%,#fff,transparent),radial-gradient(1px 1px at 32% 78%,#9fd4ff,transparent),',
        'radial-gradient(1px 1px at 52% 46%,#fff,transparent),radial-gradient(1.2px 1.2px at 8% 64%,#fff,transparent);',
        'background-repeat:repeat;background-size:100% 100%;animation:cm-drift 60s linear infinite;}',
        '.cm-t-matrix .cm-stars,.cm-t-bb .cm-stars,.cm-t-panda .cm-stars{opacity:.08;}',
        '@keyframes cm-drift{0%{transform:translate3d(0,0,0);}100%{transform:translate3d(-2%,-3%,0);}}',
        '.cm-glow{position:absolute;top:-25%;left:-25%;width:150%;height:150%;background-size:cover;background-position:center;',
        'opacity:0;filter:blur(80px) saturate(150%);transition:opacity .8s ease;}',
        '.cm-glow.on{opacity:.2;}',
        '.cm-shade{position:absolute;top:0;left:0;right:0;bottom:0;',
        'background:radial-gradient(90% 70% at 65% 40%,rgba(0,0,0,.2),rgba(0,0,0,.86) 62%,var(--cm-bg) 100%);}',

        /* пустая шапка — оставлена только для системного жеста «назад», без иконок */
        '.cm-bar{position:absolute;top:0;left:0;right:0;height:1.6em;z-index:40;}',

        '.cm-stage{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;padding:2.2em 3em 1.5em 3em;}',
        '.cm-port{position:relative;display:flex;align-items:center;width:100%;max-width:72em;margin:0 auto;',
        'border-radius:var(--cm-radius);padding:1.8em;background:var(--cm-panel);',
        'box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);transition:background .4s,border-radius .4s;}',
        '.cm-port:before{content:"";position:absolute;top:0;left:0;right:0;bottom:0;border-radius:var(--cm-radius);pointer-events:none;',
        'background:linear-gradient(115deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,0) 34%);}',

        '.cm-hero-poster{position:relative;flex:none;width:16em;height:24em;border-radius:calc(var(--cm-radius) * 0.7);overflow:hidden;background:#0B0F18;',
        'box-shadow:0 1em 2em rgba(0,0,0,.5);margin-right:1.8em;}',
        '.cm-hero-poster img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .4s;}',
        '.cm-hero-poster img.ready{opacity:1;}',
        '.cm-hero{flex:1;min-width:0;}',
        '.cm-count{font-size:.7em;letter-spacing:.24em;color:var(--cm-sub);margin-bottom:.6em;}',
        '.cm-count b{color:var(--cm-accent);font-weight:700;}',
        '.cm-name{font-size:2.2em;font-weight:700;line-height:1.1;letter-spacing:-.01em;margin-bottom:.5em;}',
        '.cm-why{position:relative;padding-left:1em;font-size:1em;line-height:1.4;color:var(--cm-text);opacity:.85;margin-bottom:1em;max-width:30em;}',
        '.cm-why:before{content:"";position:absolute;left:0;top:.3em;bottom:.3em;width:.16em;border-radius:.1em;background:var(--cm-accent);}',

        '.cm-acts{display:flex;flex-wrap:wrap;margin-top:.4em;}',
        '.cm-act{display:flex;align-items:center;padding:.85em 1.5em;border-radius:calc(var(--cm-radius) * 0.5);margin:0 .6em .6em 0;cursor:pointer;',
        'background:var(--cm-chip);font-size:1.05em;font-weight:600;color:var(--cm-text);transition:background .16s,transform .16s,color .16s,box-shadow .16s;}',
        '.cm-act svg{width:1.1em;height:1.1em;fill:currentColor;margin-right:.55em;}',
        '.cm-act.primary{background:var(--cm-accent);color:#05070D;}',
        '.cm-act.cm-focus{background:#FFFFFF;color:#05070D;transform:scale(1.04);}',
        '.cm-act.primary.cm-focus{box-shadow:0 0 0 .18em rgba(255,255,255,.25);}',

        '.cm-tray{position:absolute;left:0;right:0;bottom:1em;display:flex;justify-content:center;z-index:30;}',
        '.cm-tray-in{display:flex;align-items:center;padding:.5em;border-radius:1em;background:var(--cm-panel2);',
        'box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);}',
        '.cm-mini{position:relative;flex:none;width:3.8em;height:5.6em;border-radius:.5em;overflow:hidden;margin:0 .35em;',
        'background:#0B0F18;cursor:pointer;opacity:.5;transition:opacity .18s,transform .18s,box-shadow .18s,filter .18s;}',
        '.cm-mini img{width:100%;height:100%;object-fit:cover;}',
        '.cm-mini.active{opacity:1;}',
        '.cm-mini.cm-focus{opacity:1;transform:translateY(-.4em) scale(1.08);box-shadow:0 .4em .8em rgba(0,0,0,.5),0 0 0 .12em var(--cm-accent);}',

        '.cm-astro-wrap{position:absolute;left:1.2em;bottom:.8em;z-index:20;pointer-events:none;opacity:.9;}',
        '.cm-astro{width:6.4em;height:7.2em;pointer-events:auto;}',
        '.cm-astro svg{width:100%;height:100%;}',
        '.cm-astro .cm-body{animation:cm-float 5s ease-in-out infinite, cm-sway 7s ease-in-out infinite;transform-origin:50% 50%;}',
        '@keyframes cm-float{0%,100%{transform:translateY(0) rotate(-4deg);}50%{transform:translateY(-.6em) rotate(2deg);}}',
        '@keyframes cm-sway{0%,100%{transform:rotate(-6deg);}50%{transform:rotate(5deg);}}',

        '.cm-load{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}',
        '.cm-load-ring{width:4em;height:4em;border-radius:50%;box-shadow:inset 0 0 0 .16em rgba(255,255,255,.15);position:relative;}',
        '.cm-load-ring:after{content:"";position:absolute;top:-.16em;left:-.16em;right:-.16em;bottom:-.16em;border-radius:50%;',
        'border:.16em solid transparent;border-top-color:var(--cm-accent);animation:cm-spin 1.1s linear infinite;}',
        '@keyframes cm-spin{to{transform:rotate(360deg);}}',
        '.cm-load-txt{margin-top:1em;font-size:.7em;letter-spacing:.22em;color:var(--cm-sub);}',

        '.cm-ov{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.78);z-index:999999;display:flex;',
        'align-items:center;justify-content:center;padding:1.2em;}',
        '.cm-modal{width:36em;max-width:100%;max-height:86%;overflow-y:auto;padding:1.6em;border-radius:var(--cm-radius);',
        'background:var(--cm-panel2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);}',
        '.cm-modal::-webkit-scrollbar{width:0;}',
        '.cm-modal h3{margin:0 0 .3em;font-size:1.25em;font-weight:700;letter-spacing:-.01em;}',
        '.cm-modal p{margin:0 0 1em;color:var(--cm-sub);font-size:.95em;line-height:1.5;}',
        '.cm-modal p b{color:var(--cm-text);}',
        '.cm-modal-mascot{display:flex;justify-content:center;margin:-.2em 0 .8em;}',
        '.cm-modal-mascot .cm-astro{width:6em;height:6.6em;display:block;}',
        '.cm-sec{font-size:.72em;letter-spacing:.18em;color:var(--cm-sub);margin:1em 0 .5em;}',
        '.cm-sec:first-child{margin-top:0;}',
        '.cm-opt{display:block;width:100%;text-align:left;padding:.8em 1em;margin-bottom:.45em;border-radius:calc(var(--cm-radius) * 0.5);',
        'background:var(--cm-chip);color:var(--cm-text);font-size:.95em;cursor:pointer;transition:background .15s,transform .15s,color .15s;}',
        '.cm-opt.cm-focus{background:var(--cm-accent);color:#05070D;transform:scale(1.01);}',
        '.cm-opt small{display:block;font-size:.75em;opacity:.7;margin-top:.1em;}',
        '.cm-chips{display:flex;flex-wrap:wrap;margin-bottom:.8em;}',
        '.cm-chip{padding:.55em .9em;margin:0 .45em .45em 0;border-radius:1em;font-size:.9em;cursor:pointer;',
        'background:var(--cm-chip);color:var(--cm-text);transition:background .15s,transform .15s,color .15s;}',
        '.cm-chip.cm-focus{background:var(--cm-accent2);color:#05070D;transform:scale(1.05);}',
        '.cm-input{width:100%;padding:.8em 1em;margin-bottom:.8em;border-radius:calc(var(--cm-radius) * 0.5);font-size:1em;color:#fff;outline:none;',
        'background:var(--cm-chip);border:1px solid rgba(255,255,255,.15);}',

        '.cm-toast{position:fixed;left:50%;bottom:1.8em;transform:translateX(-50%) translateY(1em);z-index:1000001;opacity:0;',
        'padding:.7em 1.2em;border-radius:.7em;background:var(--cm-panel2);color:var(--cm-text);font-size:.9em;',
        'box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);transition:opacity .25s,transform .25s;}',
        '.cm-toast.on{opacity:1;transform:translateX(-50%) translateY(0);}',

        '@media (hover:hover){.cm-act:hover,.cm-opt:hover,.cm-chip:hover{background:rgba(255,255,255,.14);}.cm-mini:hover{opacity:1;}}',

        /* ---- Тема: Лаборатория (Breaking Bad) ---- */
        '.cm-t-bb .cm-port{border:1px solid rgba(214,226,74,.18);}',
        '.cm-t-bb .cm-flask{position:absolute;width:3em;height:3.6em;opacity:.5;pointer-events:none;}',
        '.cm-t-bb .cm-flask.f1{top:.6em;right:1em;}',
        '.cm-t-bb .cm-flask.f2{bottom:.6em;right:4.2em;}',
        '.cm-t-bb .cm-flask svg{width:100%;height:100%;}',
        '.cm-t-bb .cm-mini.cm-focus,.cm-t-bb .cm-act.cm-focus{box-shadow:0 0 0 .14em var(--cm-accent2),0 .4em .8em rgba(0,0,0,.5);}',

        /* ---- Тема: Матрица ---- */
        '.cm-t-matrix{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}',
        '.cm-t-matrix .cm-name,.cm-t-matrix .cm-act,.cm-t-matrix .cm-opt{letter-spacing:.02em;}',
        '.cm-t-matrix .cm-mini{filter:grayscale(.6) contrast(1.1);}',
        '.cm-t-matrix .cm-mini.active{filter:none;}',
        '.cm-t-matrix .cm-mini.cm-focus{filter:none;box-shadow:0 0 0 2px var(--cm-accent),0 0 0 4px rgba(0,255,65,.25);',
        'transform:translateY(-.4em) scale(1.1);transition:transform .35s cubic-bezier(.2,1.4,.4,1),box-shadow .35s;}',
        '.cm-t-matrix .cm-act.cm-focus{box-shadow:0 0 0 2px var(--cm-accent),0 0 12px rgba(0,255,65,.5);}',
        '.cm-t-matrix .cm-port{border:1px solid rgba(0,255,65,.15);}',

        /* ---- Тема: Свиток (Kung Fu Panda) ---- */
        '.cm-t-panda .cm-port{background-image:',
        'linear-gradient(var(--cm-panel),var(--cm-panel)),',
        'repeating-linear-gradient(115deg,rgba(255,255,255,.025) 0 2px,transparent 2px 6px);',
        'background-blend-mode:normal;border:1px solid rgba(231,182,92,.25);}',
        '.cm-t-panda .cm-root{background-image:radial-gradient(120% 90% at 30% 0%,rgba(216,67,60,.08),transparent 60%);}',
        '.cm-t-panda .cm-mini{border-radius:.35em;}',
        '.cm-t-panda .cm-mini.cm-focus{box-shadow:0 0 0 .16em var(--cm-accent);animation:cm-ink .5s ease;}',
        '@keyframes cm-ink{0%{transform:scale(.9) translateY(0);}60%{transform:scale(1.12) translateY(-.5em);}100%{transform:scale(1.08) translateY(-.4em);}}',
        '.cm-t-panda .cm-act.cm-focus{border-radius:1.4em .4em 1.4em .4em;}',

        /* ---- Тема: Портал (Rick & Morty) ---- */
        '.cm-t-rm .cm-port{border:1px solid rgba(124,255,107,.22);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 0 40px rgba(58,209,255,.06);}',
        '.cm-t-rm .cm-mini.cm-focus{box-shadow:0 0 0 .14em var(--cm-accent2),0 0 16px rgba(124,255,107,.5);}',
        '.cm-t-rm .cm-act.cm-focus{box-shadow:0 0 0 .14em var(--cm-accent2),0 0 14px rgba(124,255,107,.45);}',
        '.cm-portal-burst{position:fixed;left:50%;top:50%;width:2em;height:2em;margin:-1em 0 0 -1em;border-radius:50%;',
        'z-index:1000002;pointer-events:none;',
        'background:radial-gradient(circle,rgba(124,255,107,.9) 0%,rgba(58,209,255,.6) 40%,transparent 70%);',
        'animation:cm-portal .6s ease-out forwards;}',
        '@keyframes cm-portal{0%{transform:scale(0);opacity:1;}100%{transform:scale(38);opacity:0;}}',

        '@media (max-width:1000px){',
        '.cm-root{font-size:13px;}',
        '.cm-stage{padding:2.2em 1em 8em;align-items:flex-start;}',
        '.cm-port{flex-direction:column;align-items:flex-start;padding:1em;}',
        '.cm-hero-poster{width:7em;height:10.5em;margin:0 0 .8em;}',
        '.cm-name{font-size:1.6em;}',
        '.cm-act{flex:1 1 100%;justify-content:center;}',
        '.cm-astro{width:4.2em;height:4.8em;}',
        '.cm-tray{bottom:.6em;}',
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
       12. НАВИГАЦИЯ (пульт + мышь + сенсор)
       ========================================================================= */
    /*
       Две строки фокуса: [Watch, Companion] и [tray minis].
       Влево/вправо на пульте и свайп ВСЕГДА листают текущий фильм капсулы
       (симметрично, в обе стороны) — это отдельный, не связанный с Nav.rows
       глобальный жест, как и требуется. Вверх/вниз переключают фокус между
       строками, Enter активирует то, что в фокусе.
    */
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
            // только вертикальная навигация между строками; горизонталь = смена фильма (см. route())
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

    /* горизонтальный свайп по экрану капсулы листает фильм в обе стороны */
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
       14. ЭКРАН КАПСУЛЫ
       ========================================================================= */
    var View = {
        root: null, stage: null, glow: null,
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
            this.speak(line + '. Вот шесть фильмов под тебя.');
        },

        speak: function (text) { if (this.say) this.say.textContent = text; },

        renderEmpty: function () {
            this.stage.innerHTML = '';
            this.stage.appendChild(el('div', 'cm-bar'));
            var wrap = el('div', 'cm-stage');
            var port = el('div', 'cm-port');
            var hero = el('div', 'cm-hero');
            hero.appendChild(el('div', 'cm-count cm-mono', 'КАПСУЛА ПУСТА'));
            hero.appendChild(el('div', 'cm-name', 'Нечего показать'));
            hero.appendChild(el('div', 'cm-why', 'TMDb не ответил или нет интернета. Открой «Компаньон» → «Попробовать снова».'));
            var acts = el('div', 'cm-acts');
            var retry = el('div', 'cm-act primary', 'Попробовать снова');
            retry._cmAction = function () { Net.drop(); View.loading('ПОВТОРЯЮ ПОПЫТКУ'); View.boot(true); };
            var comp = el('div', 'cm-act', I_COMPANION + 'Компаньон');
            comp._cmAction = function () { Companion.open(); };
            acts.appendChild(retry); acts.appendChild(comp);
            hero.appendChild(acts);
            port.appendChild(hero);
            wrap.appendChild(port);
            this.stage.appendChild(wrap);
            Nav.reset();
            Nav.addRow([retry, comp]);
            Nav.setFocus(0, 0, true);
        },

        render: function () {
            var self = this;
            var m = this.list[this.idx];
            if (!m) return this.renderEmpty();
            this._lastBuiltAt = Date.now();

            this.stage.innerHTML = '';
            Nav.reset();

            // пустая шапка — держим только для последовательности разметки/жеста «назад»
            this.stage.appendChild(el('div', 'cm-bar'));

            var wrap = el('div', 'cm-stage');
            var port = el('div', 'cm-port');

            if (Themes.current() === 'breakingbad') {
                port.appendChild(el('div', 'cm-flask f1', I_FLASK));
                port.appendChild(el('div', 'cm-flask f2', I_FLASK));
            }

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
            hero.appendChild(el('div', 'cm-why', esc(Capsule.reason(m, this.taste || {}))));

            // карточка: только «Смотреть» + «Компаньон» — остальное убрано в модалку
            var acts = el('div', 'cm-acts');
            var bPlay = el('div', 'cm-act primary', I_PLAY + 'Смотреть');
            bPlay._cmAction = function () { play(m); };
            var bComp = el('div', 'cm-act', I_COMPANION + 'Компаньон');
            bComp._cmAction = function () { Companion.open(); };
            acts.appendChild(bPlay); acts.appendChild(bComp);
            hero.appendChild(acts);

            port.appendChild(hero);
            wrap.appendChild(port);
            this.stage.appendChild(wrap);
            Nav.addRow([bPlay, bComp]);

            var tray = el('div', 'cm-tray');
            var trayIn = el('div', 'cm-tray-in');
            var minis = [];
            for (var i = 0; i < this.list.length; i++) (function (item, index) {
                var mini = el('div', 'cm-mini' + (index === self.idx ? ' active' : ''));
                if (item.poster_path) { var mi = el('img'); mi.src = IMG + 'w185' + item.poster_path; mini.appendChild(mi); }
                mini._cmAction = function () { self.go(index); };
                trayIn.appendChild(mini);
                minis.push(mini);
            })(this.list[i], i);
            tray.appendChild(trayIn);
            this.stage.appendChild(tray);
            Nav.addRow(minis);

            // мастер-фигура (космонавт) больше не висит на главном экране —
            // она живёт только в модалке компаньона (см. Companion.open / Modal.open mascot)
            Nav.setFocus(0, 0, true);
            this.setGlow(m);
        },

        setGlow: function (m) {
            if (!pGet('glow', true) || !this.glow) return;
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

        /** Листает фильм капсулы в обе стороны (D-pad left/right и свайп). */
        step: function (delta) {
            if (!this.list.length) return;
            var next = this.idx + delta;
            if (next >= this.list.length) next = 0;
            if (next < 0) next = this.list.length - 1;
            this.go(next);
        },

        /** Обновляет ТОЛЬКО текущую активную категорию рекомендаций
            (вкус / настроение / поиск / похожее) — а не всю капсулу целиком. */
        refreshActive: function (silent) {
            if (this.busy) return;
            var self = this, q = this.activeQuery || { kind: 'taste', label: 'КАПСУЛА' };
            this.busy = true;
            Net.drop();
            function done(list) {
                self.busy = false;
                if (!list || !list.length) { if (silent) self.render(); else Toast.show('Ничего нового не нашлось'); return; }
                var ids = []; for (var i = 0; i < list.length; i++) ids.push(list[i].id);
                Capsule.remember(ids);
                self.list = list; self.idx = 0;
                self.render();
                if (silent) Toast.show('Капсула обновлена: ' + (q.label || ''));
            }
            if (q.kind === 'mood' || q.kind === 'search') {
                Search.run(q.q || q.label, this.taste, function (list, ctx) {
                    var trimmed = list.slice(0, CAPSULE_SIZE);
                    for (var i = 0; i < trimmed.length; i++) { trimmed[i]._src = 'search'; trimmed[i]._via = { query: ctx && ctx.raw }; trimmed[i]._reasonText = null; }
                    done(trimmed);
                });
            } else if (q.kind === 'similar') {
                this.busy = false;
                Companion.similar(true);
            } else {
                Taste.build(function (taste) {
                    self.taste = taste;
                    Capsule.build(taste, { force: true }, done);
                });
            }
        },
        /** Легаси-алиас (используется кнопкой «Попробовать снова» на пустой капсуле). */
        reload: function () { this.refreshActive(false); },

        showFound: function (label, list, ctx, kind, rawQuery) {
            if (!list.length) { Toast.show('Ничего не нашлось по «' + (ctx && ctx.raw ? ctx.raw : '') + '»'); return; }
            var trimmed = list.slice(0, CAPSULE_SIZE);
            for (var i = 0; i < trimmed.length; i++) { trimmed[i]._src = 'search'; trimmed[i]._via = { query: ctx && ctx.raw }; trimmed[i]._reasonText = null; }
            this.list = trimmed; this.idx = 0;
            this.sourceLabel = label.toUpperCase();
            this.source = 'search';
            this.activeQuery = { kind: kind || 'search', label: label, q: rawQuery || (ctx && ctx.raw) };
            this.render();
            Toast.show('Отобрал ' + trimmed.length + ' из ' + list.length);
        },

        details: function (m) {
            var type = m.media_type === 'tv' ? 'tv' : 'movie';
            Net.get('/' + type + '/' + m.id, { append_to_response: 'credits' }, function (d) {
                if (!d) return Toast.show('Не загрузилось');
                var crew = (d.credits && d.credits.crew) || [], cast = (d.credits && d.credits.cast) || [];
                var dir = ''; for (var i = 0; i < crew.length; i++) if (crew[i].job === 'Director') { dir = crew[i].name; break; }
                var names = []; for (var c = 0; c < Math.min(cast.length, 5); c++) names.push(cast[c].name);
                var html = '';
                if (d.overview) html += esc(d.overview) + '<br><br>';
                if (dir) html += '<b>Режиссёр:</b> ' + esc(dir) + '<br>';
                if (names.length) html += '<b>В ролях:</b> ' + esc(names.join(', ')) + '<br>';
                if (d.runtime) html += '<b>Хронометраж:</b> ' + d.runtime + ' мин<br>';
                if (d.vote_average) html += '<b>Оценка TMDb:</b> ' + d.vote_average.toFixed(1) + ' (' + (d.vote_count || 0) + ')';
                Modal.open({
                    title: d.title || d.name || '', text: html || 'Описание не заполнено.',
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
       15. КОМПАНЬОН — сюда переехало всё, что убрано с карточки/шапки
       ========================================================================= */
    var Companion = {
        open: function () {
            var self = this, chips = [];
            for (var i = 0; i < MOODS.length; i++) (function (mo) {
                chips.push({ label: mo.label, onSelect: function () { self.find(mo.q, mo.label, 'mood'); } });
            })(MOODS[i]);

            var catLabel = (View.activeQuery && View.activeQuery.label) ? View.activeQuery.label : 'КАПСУЛА';
            var items = [
                { section: 'НАСТРОЕНИЕ' },
                { label: 'Сказать словами', hint: 'например: «триллер про космос 90-х»', onSelect: function () { self.ask(); } },
                { section: 'РЕКОМЕНДАЦИИ' },
                { label: 'Обновить: ' + catLabel, hint: 'подберёт новое в этой же категории', onSelect: function () { View.loading('ОБНОВЛЯЮ: ' + catLabel.toUpperCase()); View.refreshActive(true); } },
                { label: 'Похожее на последнее', onSelect: function () { self.similar(); } },
                { label: 'Вернуть мою капсулу', onSelect: function () { View.loading('СОБИРАЮ КАПСУЛУ'); View.boot(false); } },
                { label: 'Подробнее об этом фильме', onSelect: function () { View.details(View.list[View.idx]); } },
                { label: 'Почему это в капсуле', onSelect: function () { self.why(View.list[View.idx]); } },
                { section: 'ОФОРМЛЕНИЕ' },
                { label: 'Сменить тему: ' + THEMES[Themes.current()].name, onSelect: function () { self.themes(); } }
            ];

            // если системные настройки Lampa недоступны — держим блок настроек здесь же
            if (!Settings.registeredInLampa) {
                items.push({ section: 'НАСТРОЙКИ' });
                items.push({ label: 'Свет от постера: ' + (pGet('glow', true) ? 'вкл' : 'выкл'), onSelect: function () { pSet('glow', !pGet('glow', true)); self.open(); } });
                items.push({ label: 'Что я знаю о твоих вкусах', onSelect: function () { Settings.diagnose(); } });
                items.push({ label: 'Свой ключ TMDb', hint: pGet('tmdb_key', '') ? 'задан' : 'встроенный', onSelect: function () { Settings.askKey(); } });
                items.push({ label: 'Показать заново уже виденное', onSelect: function () { Capsule.forget(); Toast.show('Сброшено'); } });
                items.push({ label: 'Пересобрать вкус с нуля', onSelect: function () { Settings.rebuildTaste(); } });
            } else {
                items.push({ section: 'НАСТРОЙКИ' });
                items.push({ label: 'Открыть настройки Lampa', hint: 'ключ TMDb, свет, сброс — там', onSelect: function () { Settings.openLampaMenu(); } });
                items.push({ label: 'Что я знаю о твоих вкусах', onSelect: function () { Settings.diagnose(); } });
            }
            items.push({ label: 'Закрыть' });

            Modal.open({ mascot: true, title: 'Компаньон на связи', text: 'Выбери настроение — соберу капсулу под него. Или скажи словами, что хочешь.', chips: chips, items: items });
        },

        themes: function () {
            var self = this, items = [];
            for (var i = 0; i < THEME_ORDER.length; i++) (function (key) {
                var t = THEMES[key];
                items.push({ label: (Themes.current() === key ? '● ' : '○ ') + t.name, onSelect: function () { Themes.set(key); Toast.show('Тема: ' + t.name); View.render(); } });
            })(THEME_ORDER[i]);
            items.push({ label: 'Назад', onSelect: function () { self.open(); } });
            Modal.open({ title: 'Оформление', items: items });
        },

        ask: function () { var self = this; askText('Что ищем?', '', function (v) { self.find(v, v, 'search'); }); },

        find: function (query, label, kind) {
            if (!query) return;
            View.loading('ИЩУ: ' + query.toUpperCase());
            Search.run(query, View.taste, function (list, ctx) { View.showFound(label || query, list, ctx, kind || 'search', query); });
        },

        similar: function (silent) {
            var t = View.taste;
            if (!t || !t.seeds || !t.seeds.length) { Toast.show('История пуста'); return; }
            var seed = t.seeds[0];
            if (!silent) View.loading('ПОДБИРАЮ ПОХОЖЕЕ');
            var shown = Capsule.shown();
            Net.get('/' + seed.type + '/' + seed.id + '/similar', { page: 1 }, function (d) {
                var list = markList(d && d.results, seed.type, 'seed', { seed: seed.title });
                var out = [];
                for (var i = 0; i < list.length && out.length < CAPSULE_SIZE; i++) {
                    if (t.watched[list[i].id]) continue;
                    if (silent && indexOfArr(shown, list[i].id) > -1) continue;
                    out.push(list[i]);
                }
                if (!out.length) { Toast.show('Похожего не нашлось'); View.render(); return; }
                var ids = []; for (var i = 0; i < out.length; i++) ids.push(out[i].id);
                Capsule.remember(ids);
                View.list = out; View.idx = 0; View.source = 'search'; View.sourceLabel = 'ПОХОЖЕЕ';
                View.activeQuery = { kind: 'similar', label: 'ПОХОЖЕЕ' };
                View.render();
                if (silent) Toast.show('Капсула обновлена: похожее');
            }, function () { Toast.show('Не получилось'); View.render(); });
        },

        why: function (m) {
            if (!m) return;
            var t = View.taste || {};
            var html = '<b>' + esc(m.title || m.name || '') + '</b><br>' + esc(Capsule.reason(m, t)) + '<br><br>';
            if (t.count) {
                html += 'Что я прочитал из истории: <b>' + t.count + '</b> карточек';
                if (t.known) html += ', из них разобрано подробно — <b>' + t.known + '</b>';
                html += '.<br>';
                var gs = []; for (var i = 0; i < (t.genres || []).length; i++) if (t.genres[i].name) gs.push(t.genres[i].name);
                if (gs.length) html += 'Твои жанры: ' + esc(gs.join(', ')) + '.<br>';
                var ks = []; for (var k = 0; k < Math.min((t.keywords || []).length, 4); k++) ks.push(t.keywords[k].name);
                if (ks.length) html += 'Повторяющиеся темы: ' + esc(ks.join(', ')) + '.';
            } else {
                html += 'Историю Lampa я пока не вижу — подборка идёт по общим высоким оценкам. Посмотри пару фильмов, и капсула станет личной.';
            }
            Modal.open({ title: 'Почему это здесь', text: html, items: [{ label: 'Понятно' }] });
        }
    };

    /* =========================================================================
       16. НАСТРОЙКИ — регистрация в системном меню Lampa
       ========================================================================= */
    var Settings = {
        registeredInLampa: false,

        /*
           БАГ СО СКРИНШОТА: "Message: can't access property "", values[name] is
           undefined" при открытии Настроек — падение внутри РЕНДЕРА самой Lampa
           (Component$2 / this.update), а не в нашем коде. Причина: параметр
           типа 'select' ('cm_theme_select') Lampa рендерит через
           values[текущее_сохранённое_значение]; если в хранилище Lampa хоть раз
           оказалось значение вне карты values (пустая строка, значение от
           предыдущей версии плагина и т.п.), Lampa падает — и происходит это
           ПОЗЖЕ, при открытии системного меню, поэтому try/catch вокруг
           регистрации параметра эту ошибку не ловит в принципе.

           Фикс: 1) 'select' убран совсем — самый рискованный тип рендера
           заменён на 'button', который просто открывает наш собственный список
           тем (тот же, что в модалке компаньона) — там разметку контролируем
           мы сами, а не Lampa; 2) на всякий случай санируем старое значение
           ключа 'cm_theme_select', если оно осталось от прошлой версии и не
           входит в текущий список тем; 3) регистрация теперь идёт один раз
           (защита от повторного addParam, которое могло бы задвоить состояние).
        */
        sanitizeLegacy: function () {
            try {
                if (!(window.Lampa && Lampa.Storage)) return;
                var cur = Lampa.Storage.get('cm_theme_select', null);
                if (cur !== null && indexOfArr(THEME_ORDER, cur) === -1 && Lampa.Storage.set) {
                    Lampa.Storage.set('cm_theme_select', THEME_ORDER[0]);
                }
            } catch (e) {}
        },

        tryRegister: function () {
            if (this.registeredInLampa) return;
            try {
                if (!(window.Lampa && Lampa.SettingsApi && Lampa.SettingsApi.addComponent)) return;
                this.sanitizeLegacy();
                Lampa.SettingsApi.addComponent({ component: 'capsule_mod', name: 'Капсула', icon: I_CAPSULE });

                Lampa.SettingsApi.addParam({
                    component: 'capsule_mod',
                    param: { name: 'cm_theme_btn', type: 'button', default: false },
                    field: { name: 'Тема оформления', description: THEMES[Themes.current()].name },
                    onChange: function () { Companion.themes(); }
                });
                Lampa.SettingsApi.addParam({
                    component: 'capsule_mod',
                    param: { name: 'cm_glow_toggle', type: 'trigger', default: true },
                    field: { name: 'Свет от постера' },
                    onChange: function (v) { pSet('glow', !!v.cm_glow_toggle); }
                });
                Lampa.SettingsApi.addParam({
                    component: 'capsule_mod',
                    param: { name: 'cm_tmdb_key_input', type: 'input', default: '' },
                    field: { name: 'Свой ключ TMDb', description: 'оставь пустым для встроенного' },
                    onChange: function (v) { pSet('tmdb_key', (v.cm_tmdb_key_input || '').replace(/\s/g, '')); Net.drop(); }
                });
                this.registeredInLampa = true;
            } catch (e) {
                this.registeredInLampa = false; // остаёмся на фолбэке в модалке компаньона
            }
        },

        openLampaMenu: function () {
            try {
                if (window.Lampa && Lampa.Activity) { Lampa.Activity.push({ url: '', title: 'Настройки', component: 'settings', page: 'capsule_mod' }); return; }
            } catch (e) {}
            Toast.show('Системное меню недоступно');
        },

        askKey: function () {
            askText('Ключ TMDb', pGet('tmdb_key', ''), function (v) { pSet('tmdb_key', v.replace(/\s/g, '')); Net.drop(); Toast.show('Ключ сохранён'); });
        },

        rebuildTaste: function () {
            pSet(DCACHE_KEY, {});
            Taste.cache = null;
            Net.drop();
            View.loading('ПЕРЕСОБИРАЮ ВКУС');
            View.boot(true);
        },

        diagnose: function () {
            History.stats(function (st) {
                var t = View.taste || {};
                var html = 'Найдено в истории Lampa: <b>' + st.total + '</b> карточек';
                html += ' (с полными данными — <b>' + st.withCards + '</b>, записей таймлайна — <b>' + st.timeline + '</b>).<br><br>';
                if (!st.total) {
                    html += 'Пусто. Обычно это значит, что фильмы ещё не открывались в этом профиле, либо активен другой профиль Lampa. Открой пару карточек или добавь в избранное — и вернись сюда.';
                } else {
                    var gs = []; for (var i = 0; i < (t.genres || []).length; i++) gs.push(t.genres[i].name + ' (' + t.genres[i].score.toFixed(1) + ')');
                    html += gs.length ? 'Жанры по весу: ' + esc(gs.join(', ')) + '.<br>' : '';
                    var ks = []; for (var k = 0; k < (t.keywords || []).length; k++) ks.push(t.keywords[k].name);
                    if (ks.length) html += 'Темы: ' + esc(ks.join(', ')) + '.<br>';
                    if (t.era) html += 'Тяготеешь к кино около <b>' + t.era + '</b> года.<br>';
                    if (t.avgVote) html += 'Средняя оценка того, что смотришь: <b>' + t.avgVote.toFixed(1) + '</b>.';
                }
                Modal.open({ title: 'Что я знаю', text: html, items: [{ label: 'Закрыть' }] });
            });
        }
    };

    /* =========================================================================
       17. ДЕЙСТВИЯ LAMPA
       ========================================================================= */
    function play(m) {
        try {
            if (window.Lampa && Lampa.Activity) {
                Lampa.Activity.push({ url: '', component: 'full', id: m.id, method: m.media_type === 'tv' ? 'tv' : 'movie', card: m, source: 'tmdb' });
                return;
            }
        } catch (e) {}
        notify('Lampa не отвечает');
    }
    function exitApp() { try { if (window.Lampa && Lampa.Activity) Lampa.Activity.backward(); } catch (e) {} }

    /* =========================================================================
       18. КЛАВИШИ
       ========================================================================= */
    var KEYS = { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 32: 'enter', 8: 'back', 27: 'back', 461: 'back', 10009: 'back' };

    function route(kind) {
        if (Modal.active()) {
            if (kind === 'back') Modal.close();
            else if (kind === 'enter') Modal.enter();
            else Modal.move(kind);
            return;
        }
        if (kind === 'left') { View.step(-1); return; }
        if (kind === 'right') { View.step(1); return; }
        if (kind === 'enter') { Nav.enter(); return; }
        if (kind === 'back') {
            if (View.source === 'search') { View.loading('ВОЗВРАЩАЮ КАПСУЛУ'); View.boot(false); }
            else exitApp();
            return;
        }
        Nav.move(kind); // только up/down
    }

    function keyFallback(e) {
        if (!App.active) return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        var kind = KEYS[e.keyCode];
        if (!kind) return;
        e.preventDefault(); e.stopPropagation();
        route(kind);
    }

    /* =========================================================================
       19. КОМПОНЕНТ LAMPA
       ========================================================================= */
    var App = { active: false, fallback: false };

    function CapsuleComponent() {
        var node = null, wrapped = null;
        this.create = function () { node = View.create(); wrapped = window.$ ? window.$(node) : node; return this.render(); };
        this.render = function () { return wrapped; };
        this.start = function () {
            App.active = true;
            // авто-обновление при повторном входе: если компонент был приостановлен
            // (resume без полного пересоздания) и с последней сборки прошло больше
            // нескольких секунд — тихо подтягиваем свежие рекомендации в той же
            // категории вместо вчерашней подборки. Пересоздание через create()
            // и так строит капсулу заново (см. always-exclude-shown в Capsule.pick),
            // поэтому здесь не дублируем это на самом первом входе.
            if (App._enteredBefore && (Date.now() - (View._lastBuiltAt || 0) > 4000)) {
                View.refreshActive(true);
            }
            App._enteredBefore = true;
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
            var rain = node && node.querySelector && node.querySelector('.cm-rain');
            if (rain && rain._cmTimer) clearInterval(rain._cmTimer);
            if (node && node.parentNode) node.parentNode.removeChild(node);
            node = null; wrapped = null;
            Nav.reset();
        };
    }

    /* =========================================================================
       20. ПУНКТ МЕНЮ
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
                var item = $('<li class="menu__item selector" data-action="capsule_mod_entry"><div class="menu__ico">' + I_CAPSULE + '</div><div class="menu__text">Капсула</div></li>');
                item.on('hover:enter click', function () {
                    try { Lampa.Activity.push({ url: '', title: 'Капсула', component: COMPONENT_ID, page: 1 }); } catch (e) {}
                });
                list.append(item);
                done = true;
            } catch (e) {}
        }
        if (window.appready) tryAdd();
        try { if (window.Lampa && Lampa.Listener) Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') tryAdd(); }); } catch (e) {}
        setTimeout(tryAdd, 1500);
        setTimeout(tryAdd, 4000);
    }

    /* =========================================================================
       21. СТАРТ
       ========================================================================= */
    (function () {
        try {
            if (window.Lampa && Lampa.Component && Lampa.Component.add) Lampa.Component.add(COMPONENT_ID, CapsuleComponent);
            addMenu();
            onLampaReady(function () { Settings.tryRegister(); });
            console.log('[Капсула] v10.0 загружена');
        } catch (e) {
            console.error('[Капсула] ошибка старта:', e);
        }
    })();
})();
