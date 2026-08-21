/**
 * Capsule Mod v8.0
 * Рекомендательный хаб для Lampa: чистый интерфейс, умный поиск по тегам
 * и описаниям, помощник, который отвечает реальными данными TMDb.
 *
 * ES5 only — работает на старых WebOS / Tizen / Android TV WebView.
 */
(function () {
    'use strict';

    if (window.plugin_capsule_mod_ready) return;
    window.plugin_capsule_mod_ready = true;

    /* =========================================================================
       0. КОНСТАНТЫ
       ========================================================================= */
    var COMPONENT_ID = 'capsule_mod_view';
    var CTRL_ID = 'capsule_mod_ctrl';
    var TMDB = 'https://api.themoviedb.org/3';
    var IMG = 'https://image.tmdb.org/t/p/';
    var FALLBACK_KEY = '4ef0d7355d9ffb5151e987764708ce96';
    var LANG = 'ru-RU';

    /* =========================================================================
       1. УТИЛИТЫ (без ES6, без Element.closest, без scrollTo options)
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
    function closestAttr(n, attr) {
        while (n && n !== document) {
            if (n.getAttribute && n.getAttribute(attr)) return n;
            n = n.parentNode;
        }
        return null;
    }
    function closestClass(n, cls) {
        while (n && n !== document) {
            if (n.className != null && hasClass(n, cls)) return n;
            n = n.parentNode;
        }
        return null;
    }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function rnd(a) { return a && a.length ? a[Math.floor(Math.random() * a.length)] : ''; }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };

    /** Плавный скролл без scroll-behavior (его нет на старых ТВ). */
    function animScroll(node, prop, to, ms) {
        if (!node) return;
        var from = node[prop];
        var dist = to - from;
        if (Math.abs(dist) < 2) { node[prop] = to; return; }
        var dur = ms || 260;
        var start = 0;
        if (node._cmAnim) node._cmAnim = null;
        var token = {};
        node._cmAnim = token;
        function step(ts) {
            if (node._cmAnim !== token) return;
            if (!start) start = ts || Date.now();
            var now = ts || Date.now();
            var p = clamp((now - start) / dur, 0, 1);
            var e = 1 - Math.pow(1 - p, 3);
            node[prop] = from + dist * e;
            if (p < 1) raf(step); else node._cmAnim = null;
        }
        raf(step);
    }

    function sGet(key, def) {
        try {
            if (window.Lampa && Lampa.Storage && Lampa.Storage.get) {
                var v = Lampa.Storage.get(key, def);
                if (v !== undefined && v !== null) return v;
            }
        } catch (e) {}
        try {
            var r = localStorage.getItem('cm_' + key);
            if (r != null) return JSON.parse(r);
        } catch (e) {}
        return def;
    }
    function sSet(key, val) {
        try { if (window.Lampa && Lampa.Storage && Lampa.Storage.set) Lampa.Storage.set(key, val); } catch (e) {}
        try { localStorage.setItem('cm_' + key, JSON.stringify(val)); } catch (e) {}
    }

    function notify(text) {
        try {
            if (window.Lampa && Lampa.Noty && Lampa.Noty.show) { Lampa.Noty.show(text); return; }
        } catch (e) {}
        Toast.show(text);
    }

    /* =========================================================================
       2. СЕТЬ + КЭШ
       ========================================================================= */
    var Net = {
        cache: {},
        key: function () {
            return sGet('tmdb_api_key', '') || sGet('capsule_mod_key', '') || FALLBACK_KEY;
        },
        build: function (path, params) {
            var url = TMDB + path + '?api_key=' + this.key() + '&language=' + LANG;
            if (params) {
                for (var k in params) {
                    if (params[k] === undefined || params[k] === null || params[k] === '') continue;
                    url += '&' + k + '=' + encodeURIComponent(params[k]);
                }
            }
            return url;
        },
        get: function (path, params, ok, fail, opts) {
            opts = opts || {};
            var url = this.build(path, params);
            var hit = this.cache[url];
            if (!opts.force && hit && Date.now() - hit.t < (opts.ttl || 600000)) {
                setTimeout(function () { ok(hit.d); }, 0);
                return;
            }
            var self = this;
            var xhr = new XMLHttpRequest();
            try {
                xhr.open('GET', url, true);
                xhr.timeout = 12000;
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) return;
                    if (xhr.status >= 200 && xhr.status < 400) {
                        var data = null;
                        try { data = JSON.parse(xhr.responseText); } catch (e) {}
                        if (data) { self.cache[url] = { t: Date.now(), d: data }; ok(data); }
                        else if (fail) fail('parse');
                    } else if (fail) fail('http_' + xhr.status);
                };
                xhr.onerror = function () { if (fail) fail('network'); };
                xhr.ontimeout = function () { if (fail) fail('timeout'); };
                xhr.send();
            } catch (e) { if (fail) fail('exception'); }
        },
        drop: function () { this.cache = {}; }
    };

    /** Запускает несколько задач параллельно: tasks = [function(done){...}] */
    function parallel(tasks, done) {
        var left = tasks.length, out = new Array(left);
        if (!left) return done(out);
        for (var i = 0; i < tasks.length; i++) {
            (function (idx) {
                tasks[idx](function (res) {
                    out[idx] = res;
                    if (--left === 0) done(out);
                });
            })(i);
        }
    }

    /* =========================================================================
       3. СЛОВАРИ: ЖАНРЫ, ТЕГИ, НАСТРОЕНИЯ
       ========================================================================= */
    var GENRE_NAMES = {
        28: 'боевик', 12: 'приключения', 16: 'анимация', 35: 'комедия', 80: 'криминал',
        99: 'документальный', 18: 'драма', 10751: 'семейный', 14: 'фэнтези', 36: 'история',
        27: 'ужасы', 10402: 'музыка', 9648: 'детектив', 10749: 'мелодрама', 878: 'фантастика',
        53: 'триллер', 10752: 'военный', 37: 'вестерн',
        10759: 'боевик', 10765: 'фантастика', 10768: 'военный', 10762: 'детский',
        10763: 'новости', 10764: 'реалити', 10766: 'мыло', 10767: 'ток-шоу'
    };

    /* стем -> жанры фильма / жанры сериала */
    var GENRE_SYN = [
        { m: [28], t: [10759], w: ['боевик', 'экшен', 'экшн', 'драк', 'мочилов', 'action', 'перестрел'] },
        { m: [12], t: [10759], w: ['приключен', 'adventure', 'путешеств'] },
        { m: [16], t: [16], w: ['мультф', 'мультик', 'мульт', 'анимац', 'cartoon', 'animation'] },
        { m: [35], t: [35], w: ['комед', 'смешн', 'юмор', 'ржач', 'посмеят', 'весел', 'comedy'] },
        { m: [80], t: [80], w: ['криминал', 'мафи', 'бандит', 'гангстер', 'crime'] },
        { m: [99], t: [99], w: ['документал', 'docum', 'научпоп'] },
        { m: [18], t: [18], w: ['драм', 'грустн', 'жизненн', 'тяжел', 'слез', 'drama'] },
        { m: [10751], t: [10751], w: ['семейн', 'детск', 'для детей', 'family', 'с ребенком'] },
        { m: [14], t: [10765], w: ['фэнтези', 'фентези', 'магия', 'волшебн', 'сказк', 'fantasy'] },
        { m: [27], t: [9648], w: ['ужас', 'страшн', 'хоррор', 'horror', 'жутк', 'кошмар', 'пугающ'] },
        { m: [9648], t: [9648], w: ['детектив', 'загадк', 'расследован', 'тайн', 'mystery'] },
        { m: [10749], t: [18], w: ['мелодрам', 'романтик', 'романт', 'любов', 'romance'] },
        { m: [878], t: [10765], w: ['фантастик', 'sci-fi', 'scifi', 'киберпанк', 'будущ', 'инопланет'] },
        { m: [53], t: [9648], w: ['триллер', 'напряж', 'саспенс', 'thriller'] },
        { m: [37], t: [37], w: ['вестерн', 'ковбо', 'western'] },
        { m: [10752], t: [10768], w: ['военн', 'война', 'фронт', 'war'] },
        { m: [10402], t: [10402], w: ['мюзикл', 'музыкальн', 'music'] },
        { m: [36], t: [18], w: ['историч', 'средневеков', 'history'] }
    ];

    /* стем -> английский тег TMDb (id узнаём через /search/keyword) */
    var TAG_SYN = [
        { w: ['космос', 'космич', 'space'], k: 'space' },
        { w: ['зомби', 'zombie'], k: 'zombie' },
        { w: ['вампир', 'vampire'], k: 'vampire' },
        { w: ['супергеро', 'superhero', 'марвел', 'marvel'], k: 'superhero' },
        { w: ['апокалипс', 'постапок', 'apocaly'], k: 'post-apocalyptic future' },
        { w: ['выживан', 'survival'], k: 'survival' },
        { w: ['маньяк', 'серийн убийц'], k: 'serial killer' },
        { w: ['во времени', 'time travel', 'таймтрэвел'], k: 'time travel' },
        { w: ['ограблен', 'heist'], k: 'heist' },
        { w: ['шпион', 'spy', 'агент'], k: 'spy' },
        { w: ['самура', 'samurai'], k: 'samurai' },
        { w: ['пират', 'pirate'], k: 'pirate' },
        { w: ['дракон', 'dragon'], k: 'dragon' },
        { w: ['робот', 'robot'], k: 'robot' },
        { w: ['искусственн интеллект', 'нейросет', 'ии '], k: 'artificial intelligence' },
        { w: ['аниме', 'anime'], k: 'anime' },
        { w: ['спорт', 'sport'], k: 'sport' },
        { w: ['бокс', 'boxing'], k: 'boxing' },
        { w: ['гонк', 'racing', 'автомоб'], k: 'car race' },
        { w: ['подводн', 'submarine'], k: 'submarine' },
        { w: ['акул', 'shark'], k: 'shark' },
        { w: ['динозавр', 'dinosaur'], k: 'dinosaur' },
        { w: ['школ', 'high school'], k: 'high school' },
        { w: ['тюрьм', 'prison'], k: 'prison' },
        { w: ['суд ', 'адвокат', 'courtroom'], k: 'courtroom' },
        { w: ['больниц', 'врач', 'медицин'], k: 'hospital' },
        { w: ['катастроф', 'disaster'], k: 'disaster' },
        { w: ['кулинар', 'повар', 'cooking'], k: 'cooking' },
        { w: ['по реальным', 'реальн событ', 'true story'], k: 'based on true story' },
        { w: ['по книге', 'по роману', 'based on novel'], k: 'based on novel' },
        { w: ['ретро', 'нуар', 'noir'], k: 'film noir' },
        { w: ['монстр', 'monster'], k: 'monster' },
        { w: ['ниндзя', 'ninja'], k: 'ninja' },
        { w: ['рождеств', 'новогодн', 'christmas'], k: 'christmas' },
        { w: ['road movie', 'дорог'], k: 'road trip' }
    ];

    /* Быстрые подборки помощника (для пульта — без набора текста) */
    var QUICK_TAGS = [
        { label: 'Космос', q: 'космическая фантастика' },
        { label: 'Посмеяться', q: 'лёгкая комедия' },
        { label: 'Напряжение', q: 'напряжённый триллер' },
        { label: 'Страшное', q: 'ужасы' },
        { label: 'Подумать', q: 'умная драма детектив' },
        { label: 'С семьёй', q: 'семейное кино мультфильм' },
        { label: 'Аниме', q: 'аниме' },
        { label: 'По реальным событиям', q: 'по реальным событиям драма' },
        { label: 'Кино 90-х', q: 'фильмы 90-х' },
        { label: 'Супергерои', q: 'супергерои' }
    ];

    var STOP_WORDS = ['фильм', 'фильмы', 'кино', 'сериал', 'сериалы', 'смотреть', 'найди',
        'найти', 'хочу', 'что-то', 'что', 'нибудь', 'посоветуй', 'подбери', 'самые',
        'самый', 'какой', 'какие', 'типа', 'вроде', 'про', 'для', 'или', 'the', 'and'];

    /* =========================================================================
       4. РАЗБОР ЗАПРОСА (теги + описание)
       ========================================================================= */
    function parseQuery(raw) {
        var q = String(raw || '').toLowerCase().replace(/ё/g, 'е');
        var ctx = {
            raw: raw, q: q, genresM: [], genresT: [], tags: [], tokens: [],
            type: 'any', yearFrom: 0, yearTo: 0, minVote: 0, minVotes: 0, free: ''
        };

        var i, j;

        // тип
        if (/сериал|сезон|series|show/.test(q)) ctx.type = 'tv';
        else if (/фильм|кино|movie/.test(q) && !/сериал/.test(q)) ctx.type = 'movie';

        // жанры
        for (i = 0; i < GENRE_SYN.length; i++) {
            for (j = 0; j < GENRE_SYN[i].w.length; j++) {
                if (q.indexOf(GENRE_SYN[i].w[j]) > -1) {
                    ctx.genresM = ctx.genresM.concat(GENRE_SYN[i].m);
                    ctx.genresT = ctx.genresT.concat(GENRE_SYN[i].t);
                    break;
                }
            }
        }
        // теги
        for (i = 0; i < TAG_SYN.length; i++) {
            for (j = 0; j < TAG_SYN[i].w.length; j++) {
                if (q.indexOf(TAG_SYN[i].w[j]) > -1) { ctx.tags.push(TAG_SYN[i].k); break; }
            }
        }
        ctx.genresM = uniq(ctx.genresM);
        ctx.genresT = uniq(ctx.genresT);
        ctx.tags = uniq(ctx.tags);

        // годы: «90-х», «2000-х», «2019», «новинки», «классика»
        var dec = q.match(/(\d{2})\s?-?\s?х/);
        if (dec) {
            var d = parseInt(dec[1], 10);
            var base = d >= 30 ? 1900 + d : 2000 + d;
            ctx.yearFrom = base; ctx.yearTo = base + 9;
        }
        var y4 = q.match(/(19|20)\d{2}/);
        if (y4) {
            var yy = parseInt(y4[0], 10);
            if (!ctx.yearFrom) { ctx.yearFrom = yy; ctx.yearTo = yy; }
        }
        if (/новинк|свеж|недавн|этого года|нов[оы]/.test(q)) {
            var cy = new Date().getFullYear();
            ctx.yearFrom = cy - 1; ctx.yearTo = cy + 1;
        }
        if (/классик|стар[оы]е|старин/.test(q) && !ctx.yearFrom) { ctx.yearFrom = 1950; ctx.yearTo = 1999; }

        // качество
        if (/лучш|топ|высок|шедевр|культов/.test(q)) { ctx.minVote = 7.2; ctx.minVotes = 600; }
        else if (/недооцен|малоизвест|редк/.test(q)) { ctx.minVote = 6.5; ctx.minVotes = 60; }
        else { ctx.minVote = 5.5; ctx.minVotes = 40; }

        // токены для сопоставления с описанием
        var words = q.split(/[^a-zа-я0-9]+/);
        for (i = 0; i < words.length; i++) {
            var w = words[i];
            if (w.length < 4) continue;
            if (indexOfArr(STOP_WORDS, w) > -1) continue;
            ctx.tokens.push(w);
        }
        // свободный текст = запрос без служебных слов (для поиска по названию)
        ctx.free = ctx.tokens.join(' ');
        return ctx;
    }

    function uniq(arr) {
        var out = [], seen = {};
        for (var i = 0; i < arr.length; i++) {
            var k = String(arr[i]);
            if (!seen[k]) { seen[k] = 1; out.push(arr[i]); }
        }
        return out;
    }
    function indexOfArr(arr, v) {
        for (var i = 0; i < arr.length; i++) if (arr[i] === v) return i;
        return -1;
    }

    /** стем для поиска в описании: «космический» -> «косми» */
    function stem(t) { return t.length > 5 ? t.substring(0, t.length - 2) : t; }

    /* =========================================================================
       5. ДВИЖОК: ПОИСК ПО ТЕГАМ + ОПИСАНИЯМ, РЕКОМЕНДАЦИИ
       ========================================================================= */
    var Engine = {

        /* ---------- история пользователя ---------- */
        history: function () {
            var items = [], seen = {};
            function push(id, type, card) {
                if (!id || seen[id]) return;
                seen[id] = 1;
                items.push({ id: id, type: type, card: card || null });
            }
            var fav = sGet('favorite', {});
            if (fav && typeof fav === 'object') {
                for (var cat in fav) {
                    var list = fav[cat];
                    if (!list || !list.length) continue;
                    for (var i = 0; i < list.length; i++) {
                        var c = list[i];
                        if (c && c.id) push(c.id, (c.name || c.original_name) ? 'tv' : 'movie', c);
                    }
                }
            }
            var tl = sGet('timeline', {});
            if (tl && typeof tl === 'object') {
                for (var k in tl) {
                    var e = tl[k];
                    if (!e) continue;
                    var card = e.card || null;
                    var id = e.id || (card && card.id);
                    if (!id) continue;
                    var isTv = e.method === 'tv' || e.type === 'tv' || (card && (card.name || card.original_name));
                    push(id, isTv ? 'tv' : 'movie', card);
                }
            }
            return items;
        },

        /** Топ жанров из истории — на этом строится «Капсула дня». */
        tasteProfile: function () {
            var hist = this.history();
            var count = {}, total = 0, i, g;
            for (i = 0; i < hist.length; i++) {
                var ids = hist[i].card && hist[i].card.genre_ids;
                if (!ids || !ids.length) continue;
                for (g = 0; g < ids.length; g++) {
                    count[ids[g]] = (count[ids[g]] || 0) + 1;
                    total++;
                }
            }
            var arr = [];
            for (var key in count) arr.push({ id: parseInt(key, 10), n: count[key] });
            arr.sort(function (a, b) { return b.n - a.n; });
            return { top: arr.slice(0, 3), total: total, count: hist.length, history: hist };
        },

        /* ---------- разрешение тегов в id ---------- */
        resolveTags: function (tags, cb) {
            if (!tags.length) return cb([]);
            var tasks = [];
            for (var i = 0; i < Math.min(tags.length, 3); i++) {
                (function (name) {
                    tasks.push(function (done) {
                        Net.get('/search/keyword', { query: name, page: 1 }, function (d) {
                            done(d && d.results && d.results.length ? d.results[0].id : null);
                        }, function () { done(null); }, { ttl: 86400000 });
                    });
                })(tags[i]);
            }
            parallel(tasks, function (res) {
                var ids = [];
                for (var i = 0; i < res.length; i++) if (res[i]) ids.push(res[i]);
                cb(ids);
            });
        },

        discoverParams: function (ctx, tagIds, media, relaxed) {
            var p = {
                sort_by: 'popularity.desc',
                include_adult: false,
                'vote_count.gte': relaxed ? 20 : ctx.minVotes,
                'vote_average.gte': relaxed ? 4.5 : ctx.minVote,
                page: 1
            };
            var genres = media === 'tv' ? ctx.genresT : ctx.genresM;
            if (genres.length) p.with_genres = genres.slice(0, relaxed ? 1 : 2).join(',');
            if (tagIds.length && !relaxed) p.with_keywords = tagIds.join('|');
            if (ctx.yearFrom) {
                if (media === 'tv') {
                    p['first_air_date.gte'] = ctx.yearFrom + '-01-01';
                    p['first_air_date.lte'] = ctx.yearTo + '-12-31';
                } else {
                    p['primary_release_date.gte'] = ctx.yearFrom + '-01-01';
                    p['primary_release_date.lte'] = ctx.yearTo + '-12-31';
                }
            }
            return p;
        },

        /** Главный поиск: теги -> discover, плюс текстовый поиск, плюс ранжирование по описанию. */
        search: function (query, cb) {
            var ctx = parseQuery(query);
            var self = this;

            this.resolveTags(ctx.tags, function (tagIds) {
                var tasks = [];

                if (ctx.type !== 'tv') {
                    tasks.push(function (done) {
                        Net.get('/discover/movie', self.discoverParams(ctx, tagIds, 'movie'), function (d) {
                            done(mark(d && d.results, 'movie', 'discover'));
                        }, function () { done([]); });
                    });
                }
                if (ctx.type !== 'movie') {
                    tasks.push(function (done) {
                        Net.get('/discover/tv', self.discoverParams(ctx, tagIds, 'tv'), function (d) {
                            done(mark(d && d.results, 'tv', 'discover'));
                        }, function () { done([]); });
                    });
                }
                if (ctx.free) {
                    tasks.push(function (done) {
                        Net.get('/search/multi', { query: ctx.raw, page: 1, include_adult: false }, function (d) {
                            done(mark(d && d.results, null, 'text'));
                        }, function () { done([]); });
                    });
                }

                parallel(tasks, function (packs) {
                    var merged = self.rank(flatten(packs), ctx);

                    if (merged.length >= 6) return cb(merged, ctx);

                    // мало результатов — ослабляем фильтры (без тегов, один жанр)
                    var relax = [];
                    if (ctx.genresM.length || ctx.tags.length) {
                        relax.push(function (done) {
                            Net.get('/discover/movie', self.discoverParams(ctx, [], 'movie', true), function (d) {
                                done(mark(d && d.results, 'movie', 'relax'));
                            }, function () { done([]); });
                        });
                    }
                    relax.push(function (done) {
                        Net.get('/trending/all/week', { page: 1 }, function (d) {
                            done(mark(d && d.results, null, 'trend'));
                        }, function () { done([]); });
                    });
                    parallel(relax, function (more) {
                        var all = self.rank(merged.concat(flatten(more)), ctx);
                        cb(all, ctx);
                    });
                });
            });
        },

        /** Ранжирование: совпадение жанров + слов запроса в названии и описании. */
        rank: function (list, ctx) {
            var out = [], seen = {}, i, j;
            var stems = [];
            for (i = 0; i < ctx.tokens.length; i++) stems.push(stem(ctx.tokens[i]));

            for (i = 0; i < list.length; i++) {
                var it = list[i];
                if (!it || !it.id || !it.poster_path) continue;
                if (it.adult) continue;
                var mt = it.media_type || it._mt;
                if (mt && mt !== 'movie' && mt !== 'tv') continue;
                if (seen[mt + '_' + it.id]) continue;
                seen[mt + '_' + it.id] = 1;

                var title = String(it.title || it.name || '').toLowerCase();
                var over = String(it.overview || '').toLowerCase();
                var s = 0;

                for (j = 0; j < stems.length; j++) {
                    if (title.indexOf(stems[j]) > -1) s += 5;
                    if (over.indexOf(stems[j]) > -1) s += 2.5;
                }
                var wanted = mt === 'tv' ? ctx.genresT : ctx.genresM;
                var gids = it.genre_ids || [];
                for (j = 0; j < gids.length; j++) if (indexOfArr(wanted, gids[j]) > -1) s += 4;

                if (it._src === 'discover') s += 3;
                if (it._src === 'trend') s -= 1;
                if (!over) s -= 1.5;
                s += clamp(it.vote_average || 0, 0, 10) * 0.35;
                s += clamp((it.popularity || 0) / 60, 0, 2.5);

                it._score = s;
                it.media_type = mt || 'movie';
                out.push(it);
            }
            out.sort(function (a, b) { return b._score - a._score; });
            return out.slice(0, 24);
        },

        /* ---------- лента рекомендаций ---------- */
        feed: function (opts, cb) {
            opts = opts || {};
            var force = !!opts.force;
            var self = this;
            var profile = this.tasteProfile();
            var page = force ? (1 + Math.floor(Math.random() * 3)) : 1;
            var rows = [];

            var tasks = [];

            // 1. Капсула дня — похожее на то, что смотрел
            if (profile.history.length) {
                var seed = profile.history[Math.floor(Math.random() * Math.min(profile.history.length, 5))];
                tasks.push(function (done) {
                    Net.get('/' + seed.type + '/' + seed.id + '/recommendations', { page: 1 },
                        function (d) { done({ key: 'daily', seed: seed, items: mark(d && d.results, seed.type, 'discover') }); },
                        function () { done({ key: 'daily', seed: seed, items: [] }); },
                        { force: force });
                });
            }

            // 2. Ряд по любимому жанру
            if (profile.top.length) {
                var gid = profile.top[0].id;
                tasks.push(function (done) {
                    Net.get('/discover/movie', {
                        with_genres: gid, sort_by: 'popularity.desc', page: page,
                        'vote_count.gte': 150, 'vote_average.gte': 6.3, include_adult: false
                    }, function (d) {
                        done({ key: 'genre', gid: gid, items: mark(d && d.results, 'movie', 'discover') });
                    }, function () { done({ key: 'genre', gid: gid, items: [] }); }, { force: force });
                });
            }

            // 3. Сейчас смотрят
            tasks.push(function (done) {
                Net.get('/trending/all/week', { page: page }, function (d) {
                    done({ key: 'trend', items: mark(d && d.results, null, 'trend') });
                }, function () { done({ key: 'trend', items: [] }); }, { force: force });
            });

            // 4. Высокие оценки
            tasks.push(function (done) {
                Net.get('/discover/movie', {
                    sort_by: 'vote_average.desc', 'vote_count.gte': 2000,
                    'vote_average.gte': 7.5, page: page, include_adult: false
                }, function (d) {
                    done({ key: 'top', items: mark(d && d.results, 'movie', 'discover') });
                }, function () { done({ key: 'top', items: [] }); }, { force: force });
            });

            parallel(tasks, function (packs) {
                var used = {};
                for (var i = 0; i < packs.length; i++) {
                    var p = packs[i];
                    var items = dedupe(p.items || [], used).slice(0, 18);
                    if (!items.length) continue;
                    var title = 'Подборка';
                    if (p.key === 'daily') title = 'Капсула дня';
                    if (p.key === 'genre') title = 'Ещё ' + (GENRE_NAMES[p.gid] || 'по вкусу');
                    if (p.key === 'trend') title = 'Сейчас смотрят';
                    if (p.key === 'top') title = 'Высокие оценки';
                    rows.push({ key: p.key, title: title, items: items });
                }
                cb({ rows: rows, profile: profile });
            });
        },

        /** Полные данные карточки: описание, жанры, актёры, похожее, отзывы. */
        details: function (id, type, cb) {
            Net.get('/' + type + '/' + id, {
                append_to_response: 'credits,similar,reviews,keywords'
            }, function (d) {
                if (d && !d.overview) {
                    Net.get('/' + type + '/' + id, { language: 'en-US' }, function (en) {
                        if (en && en.overview) d.overview = en.overview;
                        cb(d);
                    }, function () { cb(d); });
                } else cb(d);
            }, function () { cb(null); });
        }
    };

    function mark(list, forcedType, src) {
        var out = [];
        if (!list) return out;
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (!it) continue;
            it._mt = it.media_type || forcedType || (it.name && !it.title ? 'tv' : 'movie');
            it.media_type = it._mt;
            it._src = src;
            out.push(it);
        }
        return out;
    }
    function flatten(packs) {
        var out = [];
        for (var i = 0; i < packs.length; i++) out = out.concat(packs[i] || []);
        return out;
    }
    function dedupe(items, used) {
        var out = [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || !it.poster_path) continue;
            var k = it.media_type + '_' + it.id;
            if (used[k]) continue;
            used[k] = 1;
            out.push(it);
        }
        return out;
    }

    /* =========================================================================
       6. СТИЛИ
       ========================================================================= */
    var CSS = [
        /* --- база --- */
        '.cm-root{position:fixed;top:0;left:0;right:0;bottom:0;background:#0b0d11;color:#f4f6f8;z-index:999998;overflow:hidden;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;}',
        '.cm-root *{box-sizing:border-box;}',
        /* фоновое свечение от активного постера */
        '.cm-ambient{position:absolute;top:-12%;left:-12%;width:124%;height:124%;background-size:cover;background-position:center;',
        'opacity:0;filter:blur(70px) saturate(140%);transform:scale(1.15);transition:opacity .7s ease;pointer-events:none;}',
        '.cm-ambient.on{opacity:.32;}',
        '.cm-vignette{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;',
        'background:radial-gradient(120% 90% at 20% 0%,rgba(11,13,17,.25) 0%,rgba(11,13,17,.86) 55%,#0b0d11 100%);}',

        /* --- верхняя панель: только иконки --- */
        '.cm-bar{position:absolute;top:0;left:0;right:0;height:4.6em;display:flex;align-items:center;padding:0 1.6em;z-index:30;}',
        '.cm-bar-right{margin-left:auto;display:flex;align-items:center;}',
        '.cm-ico{width:2.9em;height:2.9em;margin-left:.5em;border-radius:1.45em;display:flex;align-items:center;justify-content:center;',
        'background:rgba(255,255,255,.07);cursor:pointer;transition:background .18s,transform .18s,box-shadow .18s;}',
        '.cm-ico svg{width:1.4em;height:1.4em;fill:#e8ecf1;opacity:.85;}',
        '.cm-ico.cm-focus{background:#ffb86b;transform:scale(1.12);box-shadow:0 .4em 1.4em rgba(255,184,107,.45);}',
        '.cm-ico.cm-focus svg{fill:#14161b;opacity:1;}',
        '.cm-ico.spin svg{animation:cm-spin .8s linear infinite;}',
        '@keyframes cm-spin{to{transform:rotate(360deg);}}',

        /* --- лента --- */
        '.cm-scroll{position:absolute;top:4.6em;left:0;right:0;bottom:0;overflow-y:auto;overflow-x:hidden;padding:.4em 0 9em;',
        '-webkit-overflow-scrolling:touch;}',
        '.cm-scroll::-webkit-scrollbar{width:0;height:0;}',
        '.cm-row{margin-bottom:1.5em;}',
        '.cm-row-head{font-size:.78em;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#7d8794;',
        'margin:0 0 .8em 2.3em;display:flex;align-items:center;}',
        '.cm-row-head b{color:#ffb86b;font-weight:700;margin-left:.7em;letter-spacing:.1em;}',
        '.cm-strip{display:flex;overflow-x:auto;overflow-y:hidden;padding:.7em 2.1em 1.1em;-webkit-overflow-scrolling:touch;}',
        '.cm-strip::-webkit-scrollbar{width:0;height:0;}',

        /* --- карточка: только постер, подписи появляются в фокусе --- */
        '.cm-card{position:relative;flex:none;width:12.4em;height:18.4em;margin-right:1em;border-radius:1.1em;overflow:hidden;',
        'background:#171a20;cursor:pointer;transition:transform .2s cubic-bezier(.2,0,0,1),box-shadow .2s;transform-origin:center bottom;}',
        '.cm-card img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .35s;}',
        '.cm-card img.ready{opacity:1;}',
        '.cm-card:after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;border-radius:1.1em;',
        'box-shadow:inset 0 0 0 .18em rgba(255,255,255,0);transition:box-shadow .2s;}',
        '.cm-card.cm-focus{transform:scale(1.09);box-shadow:0 1.1em 2.4em rgba(0,0,0,.65);z-index:4;}',
        '.cm-card.cm-focus:after{box-shadow:inset 0 0 0 .18em #ffb86b;}',
        '.cm-cap{position:absolute;left:0;right:0;bottom:0;padding:2.4em .7em .6em;opacity:0;transform:translateY(.6em);',
        'transition:opacity .2s,transform .2s;background:linear-gradient(180deg,rgba(11,13,17,0),rgba(11,13,17,.94));}',
        '.cm-card.cm-focus .cm-cap{opacity:1;transform:translateY(0);}',
        '.cm-cap-t{font-size:.82em;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '.cm-cap-m{font-size:.7em;color:#9aa4b1;margin-top:.15em;}',
        '.cm-cap-m i{font-style:normal;color:#ffb86b;}',
        '.cm-skel{position:relative;flex:none;width:12.4em;height:18.4em;margin-right:1em;border-radius:1.1em;',
        'background:linear-gradient(100deg,#161920 30%,#1e222a 50%,#161920 70%);background-size:220% 100%;animation:cm-sh 1.3s infinite;}',
        '@keyframes cm-sh{0%{background-position:120% 0;}100%{background-position:-40% 0;}}',

        /* --- помощник --- */
        '.cm-bot{position:absolute;left:1.8em;bottom:1.6em;z-index:25;display:flex;align-items:flex-end;}',
        '.cm-bot-btn{width:6.4em;height:6.4em;border-radius:2em;flex:none;cursor:pointer;background:rgba(255,255,255,.05);',
        'display:flex;align-items:center;justify-content:center;transition:transform .2s,background .2s,box-shadow .2s;}',
        '.cm-bot-btn svg{width:88%;height:88%;animation:cm-float 4s ease-in-out infinite;}',
        '.cm-bot-btn.cm-focus{background:rgba(255,184,107,.16);transform:scale(1.1);box-shadow:0 0 0 .18em #ffb86b;}',
        '@keyframes cm-float{0%,100%{transform:translateY(0);}50%{transform:translateY(-.4em);}}',
        '.cm-bubble{margin-left:1em;margin-bottom:1.1em;max-width:26em;padding:.85em 1.2em;border-radius:1.1em 1.1em 1.1em .2em;',
        'background:rgba(24,28,35,.92);border:1px solid rgba(255,255,255,.08);font-size:1em;line-height:1.4;color:#dfe5ec;',
        'box-shadow:0 .6em 1.8em rgba(0,0,0,.5);}',

        /* --- экран карточки --- */
        '.cm-det{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;}',
        '.cm-det-bg{position:absolute;top:0;left:0;right:0;height:62%;background-size:cover;background-position:center 20%;opacity:.5;}',
        '.cm-det-bg:after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;',
        'background:linear-gradient(180deg,rgba(11,13,17,.55) 0%,rgba(11,13,17,.9) 60%,#0b0d11 100%);}',
        '.cm-det-body{position:relative;flex:1;display:flex;padding:5.6em 3em 2em;overflow-y:auto;-webkit-overflow-scrolling:touch;}',
        '.cm-det-body::-webkit-scrollbar{width:0;}',
        '.cm-poster{flex:none;width:17em;height:25.5em;border-radius:1.2em;overflow:hidden;background:#171a20;',
        'box-shadow:0 1.4em 3em rgba(0,0,0,.7);margin-right:2.6em;}',
        '.cm-poster img{width:100%;height:100%;object-fit:cover;}',
        '.cm-info{flex:1;min-width:0;max-width:44em;}',
        '.cm-title{font-size:2.4em;font-weight:800;line-height:1.1;margin-bottom:.25em;}',
        '.cm-sub{font-size:1em;color:#98a3b1;margin-bottom:1em;}',
        '.cm-sub i{font-style:normal;color:#ffb86b;font-weight:700;}',
        '.cm-tags{display:flex;flex-wrap:wrap;margin-bottom:1.1em;}',
        '.cm-tag{font-size:.8em;padding:.35em .8em;border-radius:1em;background:rgba(255,255,255,.08);color:#c8d1db;',
        'margin:0 .5em .5em 0;letter-spacing:.03em;}',
        '.cm-over{font-size:1.02em;line-height:1.6;color:#c9d2dc;margin-bottom:1.3em;}',
        '.cm-cast{font-size:.95em;color:#8d97a4;margin-bottom:1.6em;}',
        '.cm-cast b{color:#dfe5ec;font-weight:600;}',
        '.cm-acts{display:flex;flex-wrap:wrap;}',
        '.cm-act{padding:.85em 1.5em;border-radius:.9em;background:rgba(255,255,255,.08);font-size:1em;font-weight:600;',
        'color:#e7ecf2;margin:0 .7em .7em 0;cursor:pointer;transition:background .18s,transform .18s,color .18s;}',
        '.cm-act.primary{background:#ffb86b;color:#14161b;}',
        '.cm-act.cm-focus{background:#ffffff;color:#14161b;transform:scale(1.06);}',
        '.cm-act.primary.cm-focus{background:#ffc987;}',

        /* --- модальные окна --- */
        '.cm-ov{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(6,7,10,.82);z-index:999999;',
        'display:flex;align-items:center;justify-content:center;padding:1.5em;}',
        '.cm-modal{width:38em;max-width:100%;max-height:86%;overflow-y:auto;background:#14171d;border:1px solid rgba(255,255,255,.09);',
        'border-radius:1.4em;padding:1.8em;box-shadow:0 2em 5em rgba(0,0,0,.75);}',
        '.cm-modal::-webkit-scrollbar{width:0;}',
        '.cm-modal h3{margin:0 0 .2em;font-size:1.4em;font-weight:700;}',
        '.cm-modal p{color:#a9b3bf;font-size:1em;line-height:1.55;margin:.2em 0 1.2em;}',
        '.cm-opt{display:block;width:100%;text-align:left;padding:.9em 1.1em;margin-bottom:.6em;border-radius:.9em;',
        'background:rgba(255,255,255,.06);color:#e7ecf2;font-size:1.02em;cursor:pointer;transition:background .15s,transform .15s;}',
        '.cm-opt.cm-focus{background:#ffb86b;color:#14161b;transform:scale(1.02);}',
        '.cm-opt small{display:block;font-size:.78em;opacity:.65;margin-top:.15em;}',
        '.cm-chips{display:flex;flex-wrap:wrap;margin-bottom:.8em;}',
        '.cm-chip{padding:.6em 1em;border-radius:1.2em;background:rgba(255,255,255,.07);margin:0 .55em .55em 0;',
        'font-size:.95em;cursor:pointer;transition:background .15s,transform .15s,color .15s;}',
        '.cm-chip.cm-focus{background:#ffb86b;color:#14161b;transform:scale(1.06);}',

        /* --- тост --- */
        '.cm-toast{position:fixed;left:50%;bottom:2.4em;transform:translateX(-50%) translateY(1em);z-index:1000001;',
        'background:rgba(20,23,29,.96);border:1px solid rgba(255,255,255,.1);color:#eef2f6;padding:.8em 1.4em;border-radius:.9em;',
        'font-size:1em;opacity:0;transition:opacity .25s,transform .25s;}',
        '.cm-toast.on{opacity:1;transform:translateX(-50%) translateY(0);}',

        /* --- ввод текста (запасной, если нет клавиатуры Lampa) --- */
        '.cm-input{width:100%;padding:.9em 1.1em;border-radius:.9em;border:1px solid rgba(255,255,255,.14);',
        'background:rgba(255,255,255,.05);color:#fff;font-size:1.05em;outline:none;margin-bottom:1em;}',
        '.cm-input.cm-focus{border-color:#ffb86b;}',

        /* --- мышь: подсветка только там, где есть настоящий hover --- */
        '@media (hover:hover){.cm-card:hover{transform:scale(1.04);}.cm-act:hover,.cm-opt:hover,.cm-chip:hover{background:rgba(255,255,255,.14);}}',

        /* --- планшеты и телефоны --- */
        '@media (max-width:900px){',
        '.cm-root{font-size:14px;}',
        '.cm-card,.cm-skel{width:9.4em;height:14em;}',
        '.cm-det-body{flex-direction:column;padding:5em 1.4em 8em;}',
        '.cm-poster{width:9.5em;height:14em;margin:0 0 1.2em;}',
        '.cm-title{font-size:1.7em;}',
        '.cm-bot{left:1em;bottom:1em;}',
        '.cm-bot-btn{width:4.4em;height:4.4em;}',
        '.cm-bubble{max-width:16em;font-size:.9em;}',
        '.cm-act{flex:1 1 45%;text-align:center;}',
        '}',
        '@media (max-width:560px){.cm-bubble{display:none;}}',
        '@media (prefers-reduced-motion:reduce){.cm-root *{animation:none !important;transition:none !important;}}'
    ].join('');

    function injectCSS() {
        if (document.getElementById('cm_styles')) return;
        var s = el('style');
        s.id = 'cm_styles';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    /* =========================================================================
       7. ИКОНКИ
       ========================================================================= */
    var I_BACK = '<svg viewBox="0 0 24 24"><path d="M15.7 4.3a1 1 0 0 1 0 1.4L9.4 12l6.3 6.3a1 1 0 1 1-1.4 1.4l-7-7a1 1 0 0 1 0-1.4l7-7a1 1 0 0 1 1.4 0z"/></svg>';
    var I_SEARCH = '<svg viewBox="0 0 24 24"><path d="M10 2a8 8 0 1 1-4.9 14.3l-3.4 3.4a1 1 0 0 1-1.4-1.4l3.4-3.4A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>';
    var I_REFRESH = '<svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>';
    var I_GEAR = '<svg viewBox="0 0 24 24"><path d="M19.1 12.9c0-.3.1-.6.1-.9s0-.6-.1-.9l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.6-.9l-.4-2.5H10.9l-.4 2.5c-.6.2-1.1.5-1.6.9l-2.4-1-2 3.4 2 1.6c0 .3-.1.6-.1.9s0 .6.1.9l-2 1.6 2 3.4 2.4-1c.5.4 1 .7 1.6.9l.4 2.5h3.8l.4-2.5c.6-.2 1.1-.5 1.6-.9l2.4 1 2-3.4-2-1.6zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>';
    var I_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    var I_CAPSULE = '<svg viewBox="0 0 24 24"><path d="M17 2a5 5 0 0 1 3.5 8.5l-10 10A5 5 0 0 1 3.5 13.5l10-10A5 5 0 0 1 17 2zm-2 3.9-9.1 9.2a3 3 0 0 0 4.2 4.2L19.2 10a3 3 0 0 0-4.2-4.2z"/></svg>';

    var SVG_BOT = '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><linearGradient id="cmg" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#f6f8fb"/><stop offset="1" stop-color="#c8d0da"/></linearGradient></defs>' +
        '<ellipse cx="60" cy="108" rx="26" ry="5" fill="#000" opacity=".28"/>' +
        '<rect x="24" y="30" width="72" height="58" rx="20" fill="url(#cmg)"/>' +
        '<rect x="34" y="44" width="52" height="30" rx="13" fill="#14171d"/>' +
        '<circle cx="49" cy="59" r="5.6" fill="#ffb86b"/><circle cx="71" cy="59" r="5.6" fill="#ffb86b"/>' +
        '<rect x="53" y="18" width="14" height="14" rx="5" fill="#c8d0da"/>' +
        '<circle cx="60" cy="15" r="6" fill="#ffb86b"/>' +
        '<rect x="12" y="46" width="12" height="30" rx="6" fill="#c8d0da"/>' +
        '<rect x="96" y="46" width="12" height="30" rx="6" fill="#c8d0da"/>' +
        '</svg>';

    /* =========================================================================
       8. НАВИГАЦИЯ: пульт + мышь + сенсор
       ========================================================================= */
    var Nav = {
        rows: [],        // [{el:HTMLElement|null, items:[HTMLElement], memo:0}]
        r: 0, c: 0,
        scroller: null,
        enabled: true,

        reset: function () { this.rows = []; this.r = 0; this.c = 0; },

        addRow: function (items, rowEl) {
            items = items.filter(function (x) { return !!x; });
            if (!items.length) return;
            this.rows.push({ el: rowEl || null, items: items, memo: 0 });
            var idx = this.rows.length - 1;
            for (var i = 0; i < items.length; i++) bindPointer(items[i], idx, i);
        },

        setFocus: function (r, c, silent) {
            if (!this.rows.length) return;
            this.r = clamp(r, 0, this.rows.length - 1);
            var row = this.rows[this.r];
            this.c = clamp(c, 0, row.items.length - 1);
            row.memo = this.c;
            this.paint(silent);
        },

        current: function () {
            var row = this.rows[this.r];
            return row ? row.items[this.c] : null;
        },

        paint: function (silent) {
            var old = document.querySelectorAll('.cm-focus');
            for (var i = 0; i < old.length; i++) removeClass(old[i], 'cm-focus');
            var cur = this.current();
            if (!cur) return;
            addClass(cur, 'cm-focus');
            if (!silent) this.reveal(cur);
            View.ambient(cur);
        },

        reveal: function (node) {
            var strip = closestClass(node, 'cm-strip');
            if (strip) {
                var target = node.offsetLeft - (strip.clientWidth - node.offsetWidth) / 2;
                animScroll(strip, 'scrollLeft', clamp(target, 0, strip.scrollWidth), 240);
            }
            var sc = this.scroller;
            if (sc) {
                var box = closestClass(node, 'cm-row') || node;
                var top = box.offsetTop - 1.2 * sc.clientHeight / 6;
                if (this.r === 0) top = 0;
                animScroll(sc, 'scrollTop', clamp(top, 0, Math.max(0, sc.scrollHeight - sc.clientHeight)), 280);
            }
        },

        /** Вверх/вниз — выбираем ближайший по горизонтали элемент, а не тот же индекс. */
        nearest: function (targetRow, fromNode) {
            var row = this.rows[targetRow];
            if (!row) return 0;
            if (!fromNode) return row.memo || 0;
            var fx = center(fromNode);
            var best = 0, bestD = Infinity;
            for (var i = 0; i < row.items.length; i++) {
                var d = Math.abs(center(row.items[i]) - fx);
                if (d < bestD) { bestD = d; best = i; }
            }
            // если ряд прокручен далеко — уважаем запомненную позицию
            if (bestD > 5000) return row.memo || 0;
            return best;
        },

        move: function (dir) {
            if (!this.rows.length) return;
            var cur = this.current();
            if (dir === 'left') {
                if (this.c > 0) this.setFocus(this.r, this.c - 1);
            } else if (dir === 'right') {
                if (this.c < this.rows[this.r].items.length - 1) this.setFocus(this.r, this.c + 1);
            } else if (dir === 'up') {
                if (this.r > 0) this.setFocus(this.r - 1, this.nearest(this.r - 1, cur));
            } else if (dir === 'down') {
                if (this.r < this.rows.length - 1) this.setFocus(this.r + 1, this.nearest(this.r + 1, cur));
            }
        },

        enter: function () {
            var cur = this.current();
            if (!cur) return;
            trigger(cur);
        }
    };

    function center(node) {
        var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
        return rect ? rect.left + rect.width / 2 : 0;
    }

    var touchMode = false;
    document.addEventListener('touchstart', function () { touchMode = true; }, true);

    function bindPointer(node, r, c) {
        node.setAttribute('data-cm-r', r);
        node.setAttribute('data-cm-c', c);
        node.onmouseenter = function () {
            if (touchMode || !Nav.enabled) return;
            Nav.setFocus(r, c, true);
        };
    }

    function trigger(node) {
        if (!node) return;
        if (typeof node._cmAction === 'function') node._cmAction(node);
    }

    /** Один обработчик клика/тапа на всё приложение. */
    document.addEventListener('click', function (e) {
        var node = e.target;
        while (node && node !== document) {
            if (node._cmAction) {
                var r = parseInt(node.getAttribute('data-cm-r'), 10);
                var c = parseInt(node.getAttribute('data-cm-c'), 10);
                if (!isNaN(r) && !isNaN(c)) Nav.setFocus(r, c, true);
                trigger(node);
                return;
            }
            node = node.parentNode;
        }
    }, false);

    /** Колесо мыши над лентой — горизонтальная прокрутка. */
    document.addEventListener('wheel', function (e) {
        var strip = closestClass(e.target, 'cm-strip');
        if (!strip) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        if (e.shiftKey || strip.scrollWidth > strip.clientWidth + 4) {
            if (e.shiftKey) {
                strip.scrollLeft += e.deltaY;
                e.preventDefault();
            }
        }
    }, { passive: false });

    /* =========================================================================
       9. ТОСТ И МОДАЛЬНЫЕ ОКНА
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

    /**
     * Модальное окно со своей навигацией (пульт + мышь + тач).
     * items: [{label, hint, onSelect}] либо готовые ноды через opts.custom
     */
    var Modal = {
        stack: [],

        open: function (opts) {
            var self = this;
            var ov = el('div', 'cm-ov');
            var box = el('div', 'cm-modal');
            if (opts.title) box.appendChild(el('h3', '', esc(opts.title)));
            if (opts.text) box.appendChild(el('p', '', opts.text));

            var nodes = [];

            if (opts.chips && opts.chips.length) {
                var wrap = el('div', 'cm-chips');
                for (var i = 0; i < opts.chips.length; i++) {
                    (function (ch) {
                        var chip = el('div', 'cm-chip', esc(ch.label));
                        chip._cmAction = function () { self.close(); ch.onSelect(); };
                        wrap.appendChild(chip);
                        nodes.push(chip);
                    })(opts.chips[i]);
                }
                box.appendChild(wrap);
            }

            if (opts.items) {
                for (var j = 0; j < opts.items.length; j++) {
                    (function (it) {
                        var html = esc(it.label) + (it.hint ? '<small>' + esc(it.hint) + '</small>' : '');
                        var b = el('div', 'cm-opt', html);
                        b._cmAction = function () { self.close(); if (it.onSelect) it.onSelect(); };
                        box.appendChild(b);
                        nodes.push(b);
                    })(opts.items[j]);
                }
            }

            ov.appendChild(box);
            document.body.appendChild(ov);

            var state = { ov: ov, nodes: nodes, idx: 0, onClose: opts.onClose };
            this.stack.push(state);
            this.paint();

            ov.onclick = function (e) { if (e.target === ov) self.close(); };
            return state;
        },

        paint: function () {
            var st = this.stack[this.stack.length - 1];
            if (!st) return;
            for (var i = 0; i < st.nodes.length; i++) removeClass(st.nodes[i], 'cm-focus');
            var cur = st.nodes[st.idx];
            if (cur) {
                addClass(cur, 'cm-focus');
                if (cur.scrollIntoView) try { cur.scrollIntoView(false); } catch (e) {}
            }
        },

        move: function (dir) {
            var st = this.stack[this.stack.length - 1];
            if (!st || !st.nodes.length) return;
            if (dir === 'down' || dir === 'right') st.idx = clamp(st.idx + 1, 0, st.nodes.length - 1);
            if (dir === 'up' || dir === 'left') st.idx = clamp(st.idx - 1, 0, st.nodes.length - 1);
            this.paint();
        },

        enter: function () {
            var st = this.stack[this.stack.length - 1];
            if (!st) return;
            trigger(st.nodes[st.idx]);
        },

        close: function () {
            var st = this.stack.pop();
            if (!st) return;
            if (st.ov.parentNode) st.ov.parentNode.removeChild(st.ov);
            if (st.onClose) st.onClose();
            if (this.stack.length) this.paint();
            else Nav.paint(true);
        },

        active: function () { return this.stack.length > 0; }
    };

    /* Ввод текста: клавиатура Lampa, иначе — своё поле. */
    function askText(title, value, cb) {
        try {
            if (window.Lampa && Lampa.Input && Lampa.Input.edit) {
                Lampa.Input.edit({ title: title, value: value || '', free: true }, function (val) {
                    if (val) cb(val);
                });
                return;
            }
        } catch (e) {}
        var st = Modal.open({
            title: title,
            items: [{ label: 'Найти', onSelect: function () { if (input.value) cb(input.value); } },
                    { label: 'Отмена' }]
        });
        var input = el('input', 'cm-input');
        input.type = 'text';
        input.value = value || '';
        input.placeholder = 'например: космос, триллер 90-х';
        st.ov.firstChild.insertBefore(input, st.ov.firstChild.childNodes[1] || null);
        input.onkeydown = function (e) {
            e.stopPropagation();
            if (e.keyCode === 13 && input.value) { Modal.close(); cb(input.value); }
        };
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
    }

    /* =========================================================================
       10. ЭКРАНЫ
       ========================================================================= */
    var View = {
        root: null,
        scroll: null,
        ambientNode: null,
        screen: 'main',
        rows: [],          // данные лент
        profile: null,
        current: null,     // открытая карточка
        botText: null,
        loading: false,

        /* --- каркас --- */
        build: function () {
            injectCSS();
            this.root = el('div', 'cm-root');

            this.ambientNode = el('div', 'cm-ambient');
            this.root.appendChild(this.ambientNode);
            this.root.appendChild(el('div', 'cm-vignette'));

            this.stage = el('div');
            this.stage.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;';
            this.root.appendChild(this.stage);

            this.renderMain(true);
            return this.root;
        },

        ambient: function (node) {
            if (!sGet('cm_ambient', true)) return;
            if (!this.ambientNode) return;
            var url = node && node._cmPoster;
            if (!url) return;
            if (this.ambientNode._url === url) return;
            this.ambientNode._url = url;
            this.ambientNode.style.backgroundImage = 'url(' + url + ')';
            addClass(this.ambientNode, 'on');
        },

        topBar: function (opts) {
            var bar = el('div', 'cm-bar');
            var items = [];

            var back = el('div', 'cm-ico', I_BACK);
            back._cmAction = opts.onBack;
            bar.appendChild(back);
            items.push(back);

            var right = el('div', 'cm-bar-right');
            if (opts.search) {
                var s = el('div', 'cm-ico', I_SEARCH);
                s._cmAction = function () { Robot.askQuery(); };
                right.appendChild(s); items.push(s);
            }
            if (opts.refresh) {
                var r = el('div', 'cm-ico', I_REFRESH);
                r._cmAction = function () { View.refresh(r); };
                right.appendChild(r); items.push(r);
            }
            if (opts.settings) {
                var g = el('div', 'cm-ico', I_GEAR);
                g._cmAction = function () { Settings.open(); };
                right.appendChild(g); items.push(g);
            }
            bar.appendChild(right);
            return { el: bar, items: items };
        },

        /* --- главный экран --- */
        renderMain: function (fetch, keepFocus) {
            this.screen = 'main';
            this.stage.innerHTML = '';
            Nav.reset();

            var bar = this.topBar({
                search: true, refresh: true, settings: true,
                onBack: function () { exitApp(); }
            });
            this.stage.appendChild(bar.el);
            Nav.addRow(bar.items, null);

            this.scroll = el('div', 'cm-scroll');
            this.stage.appendChild(this.scroll);
            Nav.scroller = this.scroll;

            // помощник
            var bot = el('div', 'cm-bot');
            var btn = el('div', 'cm-bot-btn', SVG_BOT);
            btn._cmAction = function () { Robot.open(); };
            this.botText = el('div', 'cm-bubble', 'Собираю подборку…');
            bot.appendChild(btn);
            bot.appendChild(this.botText);
            this.stage.appendChild(bot);
            this.botBtn = btn;

            if (fetch) {
                this.skeleton();
                this.load(false, keepFocus);
            } else {
                this.paintRows(keepFocus);
            }
        },

        skeleton: function () {
            this.scroll.innerHTML = '';
            for (var r = 0; r < 2; r++) {
                var row = el('div', 'cm-row');
                var strip = el('div', 'cm-strip');
                for (var i = 0; i < 7; i++) strip.appendChild(el('div', 'cm-skel'));
                row.appendChild(strip);
                this.scroll.appendChild(row);
            }
        },

        load: function (force, keepFocus) {
            var self = this;
            this.loading = true;
            Engine.feed({ force: force }, function (res) {
                self.loading = false;
                self.rows = res.rows;
                self.profile = res.profile;
                self.paintRows(keepFocus);
                Robot.greet(res.profile);
            });
        },

        refresh: function (icon) {
            if (this.loading) return;
            if (icon) addClass(icon, 'spin');
            Net.drop();                     // без этого лента возвращала тот же кэш
            var self = this;
            this.loading = true;
            Engine.feed({ force: true }, function (res) {
                self.loading = false;
                if (icon) removeClass(icon, 'spin');
                // убираем строку поиска — обновляем именно ленту
                self.rows = res.rows;
                self.profile = res.profile;
                self.paintRows(false);
                Toast.show('Лента обновлена');
                Robot.say('Обновил подборку — тут уже другое.');
            });
        },

        /** Показ результатов поиска отдельным рядом сверху (раньше карточки не появлялись). */
        showResults: function (title, list, ctx) {
            if (!list.length) {
                Robot.say('По запросу «' + ctx.raw + '» ничего не нашёл. Попробуй проще: жанр, тема или год.');
                Toast.show('Ничего не нашлось');
                return;
            }
            var rows = [];
            for (var i = 0; i < this.rows.length; i++) {
                if (this.rows[i].key !== 'search') rows.push(this.rows[i]);
            }
            rows.unshift({ key: 'search', title: title, note: list.length + ' шт.', items: list });
            this.rows = rows;
            if (this.screen !== 'main') this.renderMain(false);
            else this.paintRows(false);
            Nav.setFocus(1, 0);
            Robot.say(describeFind(list, ctx));
        },

        paintRows: function (keepFocus) {
            var prevR = Nav.r, prevC = Nav.c;
            var bar = Nav.rows.length ? Nav.rows[0] : null;
            Nav.rows = bar ? [bar] : [];
            this.scroll.innerHTML = '';

            if (!this.rows.length) {
                var empty = el('div', 'cm-row-head', 'Ничего не загрузилось. Проверь интернет или ключ TMDb в настройках.');
                this.scroll.appendChild(empty);
                Nav.setFocus(0, 0, true);
                return;
            }

            var showTitles = sGet('cm_rowtitles', true);

            for (var i = 0; i < this.rows.length; i++) {
                var data = this.rows[i];
                var row = el('div', 'cm-row');
                if (showTitles) {
                    var head = el('div', 'cm-row-head', esc(data.title) + (data.note ? '<b>' + esc(data.note) + '</b>' : ''));
                    row.appendChild(head);
                }
                var strip = el('div', 'cm-strip');
                var items = [];
                for (var j = 0; j < data.items.length; j++) {
                    var card = this.card(data.items[j]);
                    strip.appendChild(card);
                    items.push(card);
                }
                row.appendChild(strip);
                this.scroll.appendChild(row);
                Nav.addRow(items, row);
            }

            if (this.botBtn) Nav.addRow([this.botBtn], null);

            if (keepFocus) Nav.setFocus(prevR, prevC, true);
            else Nav.setFocus(Nav.rows.length > 1 ? 1 : 0, 0, true);
        },

        card: function (m) {
            var type = m.media_type === 'tv' ? 'tv' : 'movie';
            var title = m.title || m.name || '';
            var year = String(m.release_date || m.first_air_date || '').slice(0, 4);
            var rate = m.vote_average ? m.vote_average.toFixed(1) : '';
            var poster = m.poster_path ? IMG + 'w342' + m.poster_path : '';

            var card = el('div', 'cm-card');
            card._cmPoster = m.backdrop_path ? IMG + 'w780' + m.backdrop_path : poster;
            card._cmAction = function () { View.renderDetails(m); };

            if (poster) {
                var img = el('img');
                img.onload = function () { addClass(img, 'ready'); };
                img.onerror = function () { img.style.display = 'none'; };
                img.src = poster;
                card.appendChild(img);
            }

            var meta = (year ? year : '') + (rate ? (year ? ' · ' : '') + '<i>' + rate + '</i>' : '') +
                (type === 'tv' ? ' · сериал' : '');
            var cap = el('div', 'cm-cap',
                '<div class="cm-cap-t">' + esc(title) + '</div><div class="cm-cap-m">' + meta + '</div>');
            card.appendChild(cap);
            return card;
        },

        /* --- экран карточки --- */
        renderDetails: function (m) {
            var self = this;
            this.screen = 'details';
            this.current = m;
            this.stage.innerHTML = '';
            Nav.reset();

            var type = m.media_type === 'tv' ? 'tv' : 'movie';
            var wrap = el('div', 'cm-det');

            var bg = el('div', 'cm-det-bg');
            if (m.backdrop_path) bg.style.backgroundImage = 'url(' + IMG + 'w1280' + m.backdrop_path + ')';
            wrap.appendChild(bg);

            var bar = this.topBar({ onBack: function () { self.renderMain(false, false); } });
            wrap.appendChild(bar.el);

            var body = el('div', 'cm-det-body');
            var poster = el('div', 'cm-poster');
            if (m.poster_path) {
                var pi = el('img'); pi.src = IMG + 'w500' + m.poster_path; poster.appendChild(pi);
            }
            body.appendChild(poster);

            var info = el('div', 'cm-info');
            info.appendChild(el('div', 'cm-title', esc(m.title || m.name || '')));
            var sub = el('div', 'cm-sub', '…');
            info.appendChild(sub);
            var tags = el('div', 'cm-tags');
            info.appendChild(tags);
            var over = el('div', 'cm-over', esc(m.overview || 'Загружаю описание…'));
            info.appendChild(over);
            var cast = el('div', 'cm-cast', '');
            info.appendChild(cast);

            var acts = el('div', 'cm-acts');
            var bWatch = el('div', 'cm-act primary', '▶  Смотреть');
            bWatch._cmAction = function () { playMovie(m); };
            var bFav = el('div', 'cm-act', '＋  В избранное');
            bFav._cmAction = function () { addFavorite(m); };
            var bSimilar = el('div', 'cm-act', 'Похожее');
            var bReviews = el('div', 'cm-act', 'Отзывы');
            acts.appendChild(bWatch); acts.appendChild(bFav);
            acts.appendChild(bSimilar); acts.appendChild(bReviews);
            info.appendChild(acts);

            body.appendChild(info);
            wrap.appendChild(body);
            this.stage.appendChild(wrap);

            Nav.scroller = body;
            Nav.addRow(bar.items, null);
            Nav.addRow([bWatch, bFav, bSimilar, bReviews], null);
            Nav.setFocus(1, 0, true);

            // реальные данные вместо выдуманных «AI-ответов»
            Engine.details(m.id, type, function (d) {
                if (!d) { sub.textContent = 'Не удалось загрузить подробности'; return; }

                var year = String(d.release_date || d.first_air_date || '').slice(0, 4);
                var runtime = d.runtime || (d.episode_run_time && d.episode_run_time[0]);
                var parts = [];
                if (year) parts.push(year);
                if (runtime) parts.push(runtime + ' мин');
                if (d.number_of_seasons) parts.push(d.number_of_seasons + ' сезон(ов)');
                if (d.vote_average) parts.push('<i>' + d.vote_average.toFixed(1) + '</i> TMDb');
                sub.innerHTML = parts.join(' · ');

                var gs = d.genres || [];
                for (var i = 0; i < Math.min(gs.length, 4); i++) tags.appendChild(el('div', 'cm-tag', esc(gs[i].name)));
                var kws = (d.keywords && (d.keywords.keywords || d.keywords.results)) || [];
                for (var k = 0; k < Math.min(kws.length, 4); k++) tags.appendChild(el('div', 'cm-tag', '#' + esc(kws[k].name)));

                over.textContent = d.overview || 'Описание пока не добавлено.';

                var crew = (d.credits && d.credits.crew) || [];
                var castList = (d.credits && d.credits.cast) || [];
                var dir = '';
                for (var c = 0; c < crew.length; c++) {
                    if (crew[c].job === 'Director' || crew[c].department === 'Directing') { dir = crew[c].name; break; }
                }
                var names = [];
                for (var a = 0; a < Math.min(castList.length, 5); a++) names.push(castList[a].name);
                var html = '';
                if (dir) html += '<b>Режиссёр:</b> ' + esc(dir) + '<br>';
                if (names.length) html += '<b>В ролях:</b> ' + esc(names.join(', '));
                cast.innerHTML = html;

                var similar = (d.similar && d.similar.results) || [];
                bSimilar._cmAction = function () {
                    if (!similar.length) return Toast.show('Похожего не нашлось');
                    View.rows = View.rows || [];
                    View.showResults('Похоже на «' + (d.title || d.name) + '»',
                        Engine.rank(mark(similar, type, 'discover'), parseQuery(d.title || d.name || '')),
                        { raw: d.title || d.name });
                };

                var reviews = (d.reviews && d.reviews.results) || [];
                bReviews._cmAction = function () {
                    if (!reviews.length) {
                        Modal.open({
                            title: 'Отзывы',
                            text: 'На TMDb пока нет отзывов к этой карточке. Оценка зрителей: ' +
                                (d.vote_average ? d.vote_average.toFixed(1) + ' из 10 (' + (d.vote_count || 0) + ' голосов)' : 'нет данных') + '.',
                            items: [{ label: 'Закрыть' }]
                        });
                        return;
                    }
                    var text = '';
                    for (var i = 0; i < Math.min(reviews.length, 3); i++) {
                        var rv = reviews[i];
                        var body = String(rv.content || '').replace(/\s+/g, ' ');
                        if (body.length > 420) body = body.substring(0, 420) + '…';
                        text += '<b>' + esc(rv.author) + '</b><br>' + esc(body) + '<br><br>';
                    }
                    Modal.open({ title: 'Отзывы зрителей', text: text, items: [{ label: 'Закрыть' }] });
                };
            });
        }
    };

    /* =========================================================================
       11. ПОМОЩНИК
       ========================================================================= */
    var Robot = {
        say: function (text) {
            if (View.botText) View.botText.textContent = text;
        },

        greet: function (profile) {
            if (!profile || !profile.count) {
                this.say('Историю пока не вижу — показываю то, что смотрят все. Скажи, что хочешь, и я подберу точнее.');
                return;
            }
            if (profile.top.length) {
                var names = [];
                for (var i = 0; i < profile.top.length; i++) {
                    var n = GENRE_NAMES[profile.top[i].id];
                    if (n && indexOfArr(names, n) === -1) names.push(n);
                }
                if (names.length) {
                    this.say('В твоей истории чаще всего ' + names.join(', ') + '. Собрал подборку под это.');
                    return;
                }
            }
            this.say('Учёл ' + profile.count + ' карточек из истории. Могу поискать по теме — просто скажи какой.');
        },

        open: function () {
            var self = this;
            var chips = [];
            for (var i = 0; i < QUICK_TAGS.length; i++) {
                (function (t) {
                    chips.push({ label: t.label, onSelect: function () { self.run(t.q); } });
                })(QUICK_TAGS[i]);
            }

            var items = [
                { label: 'Написать запрос', hint: 'жанр, тема, год — например «триллер про космос 90-х»', onSelect: function () { self.askQuery(); } },
                { label: 'Похожее на последнее просмотренное', onSelect: function () { self.similarToLast(); } },
                { label: 'Удиви меня', hint: 'случайная тема из твоих жанров', onSelect: function () { self.surprise(); } },
                { label: 'Обновить ленту', onSelect: function () { View.refresh(); } },
                { label: 'Закрыть' }
            ];

            Modal.open({
                title: 'Помощник',
                text: 'Выбери тему или опиши, что хочешь посмотреть.',
                chips: chips,
                items: items
            });
        },

        askQuery: function () {
            var self = this;
            askText('Что найти?', '', function (val) { self.run(val); });
        },

        run: function (query) {
            if (!query) return;
            this.say('Ищу: ' + query + '…');
            Toast.show('Ищу: ' + query);
            Engine.search(query, function (list, ctx) {
                View.showResults('По запросу: ' + query, list, ctx);
            });
        },

        similarToLast: function () {
            var hist = Engine.history();
            if (!hist.length) {
                Toast.show('История пуста');
                this.say('Истории ещё нет. Посмотри что-нибудь — и я подстроюсь.');
                return;
            }
            var seed = hist[0];
            var name = (seed.card && (seed.card.title || seed.card.name)) || 'последнего';
            this.say('Подбираю похожее на «' + name + '»…');
            Net.get('/' + seed.type + '/' + seed.id + '/similar', { page: 1 }, function (d) {
                var list = Engine.rank(mark(d && d.results, seed.type, 'discover'), parseQuery(name));
                View.showResults('Похоже на «' + name + '»', list, { raw: name });
            }, function () { Toast.show('Не получилось загрузить'); });
        },

        surprise: function () {
            var profile = Engine.tasteProfile();
            var gid = profile.top.length ? profile.top[Math.floor(Math.random() * profile.top.length)].id : 878;
            var name = GENRE_NAMES[gid] || 'фантастика';
            var extras = ['неожиданный поворот', 'культовое', 'недооценённое', 'по реальным событиям'];
            var q = name + ' ' + rnd(extras);
            this.run(q);
        }
    };

    function describeFind(list, ctx) {
        var top = list[0];
        var name = top ? (top.title || top.name) : '';
        var by = [];
        if (ctx.genresM && ctx.genresM.length) by.push(GENRE_NAMES[ctx.genresM[0]]);
        if (ctx.tags && ctx.tags.length) by.push('тег «' + ctx.tags[0] + '»');
        if (ctx.yearFrom) by.push(ctx.yearFrom + '–' + ctx.yearTo);
        var basis = by.length ? ' по ' + by.join(', ') : ' по описанию';
        return 'Нашёл ' + list.length + basis + '. Первым делом посмотри «' + name + '».';
    }

    /* =========================================================================
       12. НАСТРОЙКИ
       ========================================================================= */
    var Settings = {
        open: function () {
            var self = this;
            Modal.open({
                title: 'Настройки',
                text: 'Внешний вид и данные Капсулы.',
                items: [
                    {
                        label: 'Фоновое свечение: ' + onOff('cm_ambient', true),
                        hint: 'на слабых ТВ лучше выключить',
                        onSelect: function () { toggle('cm_ambient', true); self.open(); }
                    },
                    {
                        label: 'Названия рядов: ' + onOff('cm_rowtitles', true),
                        onSelect: function () { toggle('cm_rowtitles', true); View.paintRows(true); self.open(); }
                    },
                    {
                        label: 'Свой ключ TMDb',
                        hint: sGet('tmdb_api_key', '') ? 'задан' : 'используется встроенный',
                        onSelect: function () {
                            askText('Ключ TMDb', sGet('tmdb_api_key', ''), function (v) {
                                sSet('tmdb_api_key', v.replace(/\s/g, ''));
                                Net.drop();
                                Toast.show('Ключ сохранён');
                            });
                        }
                    },
                    {
                        label: 'Очистить кэш и обновить',
                        onSelect: function () { Net.drop(); View.refresh(); }
                    },
                    { label: 'Закрыть' }
                ]
            });
        }
    };
    function onOff(key, def) { return sGet(key, def) ? 'вкл' : 'выкл'; }
    function toggle(key, def) { sSet(key, !sGet(key, def)); }

    /* =========================================================================
       13. ДЕЙСТВИЯ LAMPA
       ========================================================================= */
    function playMovie(m) {
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
        Toast.show('Lampa не отвечает — открой карточку вручную');
    }

    function addFavorite(m) {
        try {
            if (window.Lampa && Lampa.Favorite && Lampa.Favorite.add) {
                Lampa.Favorite.add('like', m);
                Toast.show('Добавлено в избранное');
                return;
            }
        } catch (e) {}
        Toast.show('Избранное недоступно');
    }

    function exitApp() {
        try {
            if (window.Lampa && Lampa.Activity) { Lampa.Activity.backward(); return; }
        } catch (e) {}
    }

    /* =========================================================================
       14. КЛАВИАТУРА (запасной путь, если Lampa.Controller недоступен)
       ========================================================================= */
    var KEYS = {
        37: 'left', 38: 'up', 39: 'right', 40: 'down',
        13: 'enter', 32: 'enter',
        8: 'back', 27: 'back', 461: 'back', 10009: 'back'
    };

    function routeKey(kind) {
        if (Modal.active()) {
            if (kind === 'back') Modal.close();
            else if (kind === 'enter') Modal.enter();
            else Modal.move(kind);
            return true;
        }
        if (kind === 'enter') { Nav.enter(); return true; }
        if (kind === 'back') {
            if (View.screen === 'details') View.renderMain(false, false);
            else exitApp();
            return true;
        }
        Nav.move(kind);
        return true;
    }

    function keyFallback(e) {
        if (!App.active) return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        var kind = KEYS[e.keyCode];
        if (!kind) return;
        e.preventDefault();
        e.stopPropagation();
        routeKey(kind);
    }

    /* =========================================================================
       15. КОМПОНЕНТ LAMPA
       ========================================================================= */
    var App = { active: false, useFallback: false };

    function CapsuleComponent() {
        var node = null, wrapped = null;

        this.create = function () {
            node = View.build();
            wrapped = (window.$ ? window.$(node) : node);
            return this.render();
        };
        this.render = function () { return wrapped; };

        this.start = function () {
            App.active = true;
            var hasCtrl = false;
            try { hasCtrl = !!(window.Lampa && Lampa.Controller && Lampa.Controller.add); } catch (e) {}

            if (hasCtrl) {
                Lampa.Controller.add(CTRL_ID, {
                    toggle: function () {
                        try { Lampa.Controller.clear(); } catch (e) {}
                        Nav.paint(true);
                    },
                    up: function () { routeKey('up'); },
                    down: function () { routeKey('down'); },
                    left: function () { routeKey('left'); },
                    right: function () { routeKey('right'); },
                    enter: function () { routeKey('enter'); },
                    back: function () { routeKey('back'); }
                });
                Lampa.Controller.toggle(CTRL_ID);
            } else {
                App.useFallback = true;
                document.addEventListener('keydown', keyFallback, true);
            }
        };

        this.pause = function () { App.active = false; };
        this.resume = function () { App.active = true; };
        this.stop = function () { App.active = false; };

        this.destroy = function () {
            App.active = false;
            if (App.useFallback) document.removeEventListener('keydown', keyFallback, true);
            while (Modal.active()) Modal.close();
            if (node && node.parentNode) node.parentNode.removeChild(node);
            node = null; wrapped = null;
            Nav.reset();
        };
    }

    /* =========================================================================
       16. ПУНКТ МЕНЮ
       ========================================================================= */
    function addMenuItem() {
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
                    '<div class="menu__ico">' + I_CAPSULE + '</div>' +
                    '<div class="menu__text">Капсула</div></li>');
                item.on('hover:enter click', function () {
                    try {
                        Lampa.Activity.push({ url: '', title: 'Капсула', component: COMPONENT_ID, page: 1 });
                    } catch (e) {}
                });
                list.append(item);
                done = true;
            } catch (e) {}
        }
        if (window.appready) tryAdd();
        try {
            if (window.Lampa && Lampa.Listener) {
                Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') tryAdd(); });
            }
        } catch (e) {}
        setTimeout(tryAdd, 1500);
        setTimeout(tryAdd, 4000);
    }

    /* =========================================================================
       17. СТАРТ
       ========================================================================= */
    (function start() {
        try {
            if (window.Lampa && Lampa.Component && Lampa.Component.add) {
                Lampa.Component.add(COMPONENT_ID, CapsuleComponent);
            }
            addMenuItem();
            console.log('[Capsule Mod] v8.0 загружен');
        } catch (e) {
            console.error('[Capsule Mod] ошибка старта:', e);
        }
    })();
})();
