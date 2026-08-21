/**
 * Capsule Mod v10.0 — «Капсула»
 * Production-ready ES5 Lampa Plugin with Full-Screen Sanctuary Overlay,
 * Deep Multi-Engine History Extraction, and Zero-G Astronaut Companion.
 */

export const LAMPA_PLUGIN_SOURCE = `(function () {
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
       1. УТИЛИТЫ И ХРАНИЛИЩЕ
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
        n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/\\s+/g, ' ').replace(/^ +| +$/g, '');
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
       3. СЛОВАРИ ЖАНРОВ И ТЕГОВ
       ========================================================================= */
    var GENRE_NAMES = {
        28: 'боевик', 12: 'приключения', 16: 'анимация', 35: 'комедия', 80: 'криминал',
        99: 'документальное', 18: 'драма', 10751: 'семейное', 14: 'фэнтези', 36: 'история',
        27: 'ужасы', 10402: 'музыка', 9648: 'детектив', 10749: 'мелодрама', 878: 'фантастика',
        53: 'триллер', 10752: 'военный', 37: 'вестерн',
        10759: 'боевик & приключения', 10765: 'фантастика & фэнтези', 10768: 'война & политика',
        10762: 'детское', 10766: 'мыльная опера'
    };
    var TV2MOVIE = { 10759: 28, 10765: 878, 10768: 10752, 10762: 10751, 10766: 18 };

    var MOODS = [
        { label: 'Отключить голову', desc: 'легкое кино, юмор, без драмы', q: 'легкая комедия приключения' },
        { label: 'Держать в напряжении', desc: 'саспенс, неожиданные повороты', q: 'остросюжетный триллер детектив' },
        { label: 'Подумать и погрузиться', desc: 'глубокий сюжет, атмосфера', q: 'умная фантастика драма' },
        { label: 'Улететь в космос', desc: 'звезды, неизведанное, масштаб', q: 'космическая фантастика sci-fi' },
        { label: 'Побояться', desc: 'жуткая атмосфера, мистика, хоррор', q: 'ужасы триллер' },
        { label: 'Теплый вечер вдвоем', desc: 'душевное, красивое, романтика', q: 'мелодрама драма' },
        { label: 'С детьми / семьей', desc: 'доброе, яркое, для всех возрастов', q: 'семейный мультфильм' }
    ];

    /* =========================================================================
       4. СБОР ИСТОРИИ ИЗ ВСЕХ ХРАНИЛИЩ LAMPA (исправлено и усилено)
       ========================================================================= */
    var WEIGHTS = {
        history: 3.2, viewed: 3.2, look: 2.8, continued: 3.5,
        like: 3.0, wath: 2.0, book: 1.5, scheduled: 1.0, card: 1.2, thrown: -2.5
    };

    var History = {
        read: function () {
            var cards = {}, acc = {}, order = [], i, k;

            function addCard(c) {
                if (!c) return;
                var id = parseInt(c.id || (c.card && c.card.id) || (c.movie && c.movie.id), 10);
                if (!id) return;
                if (!cards[id]) cards[id] = c.card || c.movie || c;
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
                if (c.media_type === 'tv' || c.method === 'tv' || c.number_of_seasons || c.first_air_date) return 'tv';
                if (c.media_type === 'movie' || c.method === 'movie' || c.release_date || c.title) return 'movie';
                return (c.name && !c.title) ? 'tv' : 'movie';
            }

            /* 1. Lampa.Favorite.full() и Storage favorite */
            var fav = null;
            try { if (window.Lampa && Lampa.Favorite && Lampa.Favorite.full) fav = Lampa.Favorite.full(); } catch (e) {}
            if (!fav || typeof fav !== 'object') fav = sGet('favorite', {});
            if (fav && typeof fav === 'object') {
                if (isArr(fav.card)) for (i = 0; i < fav.card.length; i++) addCard(fav.card[i]);
                for (k in fav) {
                    var list = fav[k];
                    if (!isArr(list) || !list.length) continue;
                    var w = WEIGHTS[k] !== undefined ? WEIGHTS[k] : 1.2;
                    for (i = 0; i < list.length; i++) {
                        var entry = list[i];
                        var recency = 1 + clamp((list.length - i) / Math.max(list.length, 1), 0, 1) * 0.5;
                        if (entry && typeof entry === 'object') {
                            addCard(entry);
                            bump(entry.id, w * recency, typeOf(entry), entry);
                        } else {
                            bump(entry, w * recency, null, cards[entry] || null);
                        }
                    }
                }
            }

            /* 2. Timeline (история воспроизведения со временем) */
            var timeline = sGet('timeline', {});
            if (timeline && typeof timeline === 'object') {
                for (var tKey in timeline) {
                    var tItem = timeline[tKey];
                    if (!tItem) continue;
                    var tid = parseInt(tItem.id || (tItem.data && tItem.data.card && tItem.data.card.id) || (tItem.movie && tItem.movie.id), 10);
                    if (tid) {
                        var tCard = (tItem.data && tItem.data.card) || tItem.card || tItem.movie || null;
                        if (tCard) addCard(tCard);
                        var percent = (tItem.percent || (tItem.duration ? tItem.time / tItem.duration : 0.5));
                        var tw = percent > 0.7 ? 3.4 : (percent > 0.2 ? 2.6 : 1.4);
                        bump(tid, tw, typeOf(tCard), tCard);
                    }
                }
            }

            /* 3. Дополнительные ключи различных версий Lampa */
            var extras = ['history', 'view', 'viewed', 'card_history', 'cub_bookmarks', 'recomends_last', 'custom_history'];
            for (var e = 0; e < extras.length; e++) {
                var list2 = sGet(extras[e], null);
                if (isArr(list2)) {
                    for (i = 0; i < list2.length; i++) {
                        var it = list2[i];
                        if (it && typeof it === 'object') {
                            addCard(it);
                            bump(it.id, 2.5, typeOf(it), it);
                        } else if (it) {
                            bump(it, 1.8, null, null);
                        }
                    }
                }
            }

            /* 4. Формируем единый отсортированный список */
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
       5. МОДЕЛЬ ВКУСА И ОБОГАЩЕНИЕ
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
                if (keys.length > 250) {
                    var trimmed = {};
                    for (var i = keys.length - 250; i < keys.length; i++) trimmed[keys[i]] = c[keys[i]];
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

            // Если история совершенно пуста, проверяем сохраненные ручные предпочтения
            var manualPref = sGet('cm_manual_pref', null);

            if (!items.length) {
                return cb({ empty: true, count: 0, genres: manualPref ? manualPref.genres : [], keywords: [], seeds: [], watched: {}, stats: stats, manual: manualPref });
            }

            this.enrich(items, 16, function (cache) {
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
                        kScore[kid] = (kScore[kid] || 0) + w * 0.9;
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
                for (var k in kScore) if (kScore[k] > 1.4) keywords.push({ id: parseInt(k, 10), score: kScore[k], name: kName[k] });
                keywords.sort(function (a, b) { return b.score - a.score; });

                years.sort(function (a, b) { return a - b; });
                var median = years.length ? years[Math.floor(years.length / 2)] : 0;
                var avgVote = 0;
                for (i = 0; i < votes.length; i++) avgVote += votes[i];
                avgVote = votes.length ? avgVote / votes.length : 0;

                cb({
                    empty: false,
                    count: items.length,
                    known: years.length,
                    genres: genres.slice(0, 6),
                    keywords: keywords.slice(0, 8),
                    era: median,
                    avgVote: avgVote,
                    seeds: seeds,
                    watched: watched,
                    stats: stats
                });
            });
        }
    };

    /* =========================================================================
       6. ГЕНЕРАЦИЯ КАПСУЛЫ (6 персональных фильмов)
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
            if (s.length > 90) s = s.slice(s.length - 90);
            sSet(this.shownKey, s);
        },
        forget: function () { sSet(this.shownKey, []); },

        build: function (taste, opts, cb) {
            opts = opts || {};
            var force = !!opts.force;
            var page = force ? 1 + Math.floor(Math.random() * 3) : 1;
            var tasks = [];
            var topG = taste.genres || [], topK = taste.keywords || [];

            // 1. Похожие на любимые фильмы из истории
            var seeds = (taste.seeds || []).slice(0, 3);
            for (var s = 0; s < seeds.length; s++) (function (seed) {
                tasks.push(function (done) {
                    Net.get('/' + seed.type + '/' + seed.id + '/recommendations', { page: 1 }, function (d) {
                        done(markList(d && d.results, seed.type, 'seed', { seed: seed.title }));
                    }, function () { done([]); }, { force: force });
                });
            })(seeds[s]);

            // 2. По ключевым тегам и тропам
            if (topK.length) {
                var kids = [];
                for (var j = 0; j < Math.min(topK.length, 3); j++) kids.push(topK[j].id);
                tasks.push(function (done) {
                    Net.get('/discover/movie', {
                        with_keywords: kids.join('|'), sort_by: 'popularity.desc', page: page,
                        'vote_count.gte': 120, 'vote_average.gte': 6.3, include_adult: false
                    }, function (d) {
                        done(markList(d && d.results, 'movie', 'keyword', { kw: topK[0].name }));
                    }, function () { done([]); }, { force: force });
                });
            }

            // 3. По любимым жанрам с фильтром по оценке
            if (topG.length) {
                var gids = [];
                for (var i = 0; i < Math.min(topG.length, 2); i++) gids.push(topG[i].id);
                tasks.push(function (done) {
                    Net.get('/discover/movie', {
                        with_genres: gids.join(','), sort_by: 'popularity.desc', page: page,
                        'vote_count.gte': 250, 'vote_average.gte': clamp(taste.avgVote ? taste.avgVote - 0.5 : 6.5, 6.0, 7.6),
                        include_adult: false
                    }, function (d) {
                        done(markList(d && d.results, 'movie', 'genre', { genres: gids }));
                    }, function () { done([]); }, { force: force });
                });
            }

            // 4. Если истории нет или она маленькая — топовые шедевры и тренды
            if (!seeds.length && !topG.length) {
                tasks.push(function (done) {
                    Net.get('/discover/movie', {
                        sort_by: 'vote_average.desc', 'vote_count.gte': 4000, 'vote_average.gte': 7.8,
                        page: page, include_adult: false
                    }, function (d) { done(markList(d && d.results, 'movie', 'top')); }, function () { done([]); }, { force: force });
                });
                tasks.push(function (done) {
                    Net.get('/trending/all/week', { page: 1 }, function (d) {
                        done(markList(d && d.results, null, 'trend'));
                    }, function () { done([]); }, { force: force });
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
            for (i = 0; i < (taste.genres || []).length; i++) {
                gWeight[taste.genres[i].id] = taste.genres[i].score;
            }
            var maxG = taste.genres && taste.genres.length ? taste.genres[0].score : 1;

            for (i = 0; i < all.length; i++) {
                var it = all[i];
                var key = it.media_type + '_' + it.id;
                if (seen[key]) {
                    seen[key]._score += 3.8;
                    seen[key]._multi = true;
                    continue;
                }
                if (taste.watched && taste.watched[it.id]) continue;
                if (indexOfArr(shown, it.id) > -1) continue;
                if (!it.vote_average || it.vote_average < 5.8) continue;
                if ((it.vote_count || 0) < 50) continue;

                var s = 0;
                var gids = it.genre_ids || [];
                for (j = 0; j < gids.length; j++) {
                    var gid = TV2MOVIE[gids[j]] || gids[j];
                    if (gWeight[gid]) s += 4.5 * (gWeight[gid] / maxG);
                }
                if (it._src === 'seed') s += 5.5;
                if (it._src === 'keyword') s += 4.8;
                if (it._src === 'genre') s += 2.5;
                if (it._src === 'trend') s += 1.0;
                s += clamp(it.vote_average - 6, 0, 3) * 1.8;
                s += clamp((it.vote_count || 0) / 4000, 0, 1.2);
                if (taste.era) {
                    var y = parseInt(String(it.release_date || it.first_air_date || '').slice(0, 4), 10) || 0;
                    if (y) s -= clamp(Math.abs(y - taste.era) / 30, 0, 1.0);
                }
                if (!it.overview) s -= 1.5;

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
                r = 'Похоже на «' + item._via.seed + '» из твоих любимых';
            } else if (item._src === 'keyword' && item._via && item._via.kw) {
                r = 'Тема «' + item._via.kw + '» в твоем стиле';
            } else if (item._src === 'genre' || item._src === 'relax') {
                var names = [];
                var gids = item.genre_ids || [];
                for (var i = 0; i < (taste.genres || []).length && names.length < 2; i++) {
                    if (indexOfArr(gids, taste.genres[i].id) > -1 && taste.genres[i].name) names.push(taste.genres[i].name);
                }
                r = names.length ? 'Твой любимый жанр (' + names.join(', ') + ') · рейтинг ' + (item.vote_average || 0).toFixed(1)
                    : 'Высочайшая зрительская оценка: ' + (item.vote_average || 0).toFixed(1);
            } else if (item._src === 'search') {
                r = item._via && item._via.query ? 'По твоему запросу: «' + item._via.query + '»' : 'Точное попадание по настроению';
            } else {
                r = 'Киношедевр с рейтингом ' + (item.vote_average || 0).toFixed(1);
            }
            if (item._multi) r += ' · совпало сразу по нескольким признакам';
            item._reasonText = r;
            return r;
        }
    };

    /* =========================================================================
       7. СТИЛИ ИЗОЛИРОВАННОГО СВЕРХ-СЛОЯ (OVERLAY)
       ========================================================================= */
    var CSS = [
        /* ПОЛНОЭКРАННЫЙ СВЕРХСЛОЙ ПОВЕРХ ВСЕЙ LAMPA */
        '.cm-root{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;',
        'width:100vw!important;height:100vh!important;z-index:9999999!important;overflow:hidden;color:#E6EDF8;',
        'background:#03060C;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
        '-webkit-tap-highlight-color:transparent;user-select:none;}',
        '.cm-root *{box-sizing:border-box;}',
        '.cm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;}',

        /* КОСМИЧЕСКАЯ ГЛУБИНА */
        '.cm-stars{position:absolute;top:-10%;left:-10%;width:120%;height:120%;opacity:.45;pointer-events:none;',
        'background-image:radial-gradient(1.2px 1.2px at 15% 25%,#fff,transparent),radial-gradient(1px 1px at 72% 18%,#bfe0ff,transparent),',
        'radial-gradient(1.6px 1.6px at 85% 65%,#fff,transparent),radial-gradient(1.1px 1.1px at 30% 75%,#7fd8ff,transparent),',
        'radial-gradient(1px 1px at 50% 45%,#fff,transparent),radial-gradient(1.4px 1.4px at 10% 65%,#fff,transparent);',
        'background-repeat:repeat;background-size:100% 100%;animation:cm-drift 75s linear infinite;}',
        '@keyframes cm-drift{0%{transform:translate3d(0,0,0);}100%{transform:translate3d(-2%,-3%,0);}}',

        '.cm-glow{position:absolute;top:-25%;left:-25%;width:150%;height:150%;background-size:cover;background-position:center;',
        'opacity:0;filter:blur(110px) saturate(160%);transition:opacity 1.1s ease;pointer-events:none;}',
        '.cm-glow.on{opacity:.26;}',

        '.cm-shade{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;',
        'background:radial-gradient(85% 65% at 68% 45%,rgba(3,6,12,.10),rgba(3,6,12,.82) 65%,#03060C 100%);}',

        /* ВЕРХНЯЯ ПАНЕЛЬ СВЯЗИ */
        '.cm-bar{position:absolute;top:0;left:0;right:0;height:4.6em;display:flex;align-items:center;padding:0 2.2em;z-index:50;}',
        '.cm-brand{display:flex;align-items:center;font-size:1em;font-weight:700;letter-spacing:.22em;color:#7FD8FF;}',
        '.cm-brand span{font-size:.72em;padding:.2em .6em;margin-left:.7em;border-radius:.5em;background:rgba(127,216,255,.12);color:#A5E2FF;}',
        '.cm-bar-r{margin-left:auto;display:flex;align-items:center;}',
        '.cm-ico{width:2.9em;height:2.9em;margin-left:.65em;border-radius:50%;display:flex;align-items:center;justify-content:center;',
        'background:rgba(230,237,248,.07);cursor:pointer;border:1px solid rgba(255,255,255,.06);transition:all .18s ease;}',
        '.cm-ico svg{width:1.3em;height:1.3em;fill:#A0B1CA;}',
        '.cm-ico.cm-focus{background:#FF7A2F;border-color:#FF7A2F;transform:scale(1.14);box-shadow:0 0 1.2em rgba(255,122,47,.45);}',
        '.cm-ico.cm-focus svg{fill:#03060C;}',
        '.cm-ico.spin svg{animation:cm-spin .9s linear infinite;}',
        '@keyframes cm-spin{to{transform:rotate(360deg);}}',

        /* ГЛАВНЫЙ ИЛЛЮМИНАТОР-КАРТОЧКА */
        '.cm-stage{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;padding:4.8em 4.4em 7.5em 4.4em;z-index:20;}',
        '.cm-port{position:relative;display:flex;align-items:center;width:100%;max-width:78em;margin:0 auto;',
        'border-radius:2.2em;padding:2.4em;background:linear-gradient(150deg,rgba(19,27,42,.78),rgba(7,11,18,.88));',
        'box-shadow:inset 0 0 0 1px rgba(127,216,255,.14),inset 0 1.5em 4em rgba(0,0,0,.6),0 2em 5em rgba(0,0,0,.7);}',

        '.cm-poster{position:relative;flex:none;width:18em;height:26.5em;border-radius:1.5em;overflow:hidden;background:#0A0F1A;',
        'box-shadow:0 1.8em 4em rgba(0,0,0,.75);margin-right:2.8em;border:1px solid rgba(255,255,255,.08);}',
        '.cm-poster img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .5s;}',
        '.cm-poster img.ready{opacity:1;}',

        '.cm-hero{flex:1;min-width:0;}',
        '.cm-badge{display:inline-flex;align-items:center;font-size:.76em;font-weight:700;letter-spacing:.2em;color:#FF9354;',
        'padding:.35em .85em;border-radius:.6em;background:rgba(255,122,47,.12);border:1px solid rgba(255,122,47,.25);margin-bottom:1em;}',
        '.cm-badge b{color:#FFF;margin-left:.4em;}',
        '.cm-name{font-size:2.8em;font-weight:800;line-height:1.06;letter-spacing:-.02em;margin-bottom:.35em;color:#FFFFFF;}',
        '.cm-meta{font-size:.82em;letter-spacing:.12em;color:#8FA2BC;margin-bottom:1.2em;}',
        '.cm-meta i{font-style:normal;color:#7FD8FF;font-weight:700;}',
        '.cm-why{position:relative;padding:.7em 1.2em;border-radius:.9em;background:rgba(127,216,255,.08);border-left:3px solid #FF7A2F;',
        'font-size:1.02em;line-height:1.45;color:#D8E3F2;margin-bottom:1.1em;max-width:38em;}',
        '.cm-plot{font-size:.96em;line-height:1.55;color:#8FA2BC;margin-bottom:1.6em;max-width:40em;max-height:4.8em;overflow:hidden;}',

        /* КНОПКИ ДЕЙСТВИЯ */
        '.cm-acts{display:flex;flex-wrap:wrap;}',
        '.cm-act{display:flex;align-items:center;padding:.9em 1.65em;border-radius:1em;margin:0 .8em .8em 0;cursor:pointer;',
        'background:rgba(230,237,248,.08);border:1px solid rgba(255,255,255,.08);font-size:1.02em;font-weight:600;color:#E6EDF8;',
        'transition:all .18s ease;}',
        '.cm-act svg{width:1.15em;height:1.15em;fill:currentColor;margin-right:.6em;}',
        '.cm-act.primary{background:#FF7A2F;border-color:#FF7A2F;color:#03060C;font-weight:700;}',
        '.cm-act.cm-focus{background:#FFFFFF;border-color:#FFFFFF;color:#03060C;transform:scale(1.06);box-shadow:0 0 1.5em rgba(255,255,255,.3);}',
        '.cm-act.primary.cm-focus{background:#FF9354;border-color:#FF9354;color:#03060C;transform:scale(1.06);box-shadow:0 0 1.8em rgba(255,122,47,.6);}',

        /* НИЖНИЙ ЛОТОК КАПСУЛ */
        '.cm-tray{position:absolute;left:0;right:0;bottom:1.4em;display:flex;justify-content:center;z-index:40;}',
        '.cm-tray-in{display:flex;align-items:center;padding:.55em .8em;border-radius:1.5em;background:rgba(7,11,18,.8);',
        'border:1px solid rgba(127,216,255,.14);box-shadow:0 1em 3em rgba(0,0,0,.6);}',
        '.cm-mini{position:relative;flex:none;width:4.6em;height:6.6em;border-radius:.8em;overflow:hidden;margin:0 .45em;',
        'background:#0A0F1A;cursor:pointer;opacity:.45;border:1px solid rgba(255,255,255,.08);transition:all .2s ease;}',
        '.cm-mini img{width:100%;height:100%;object-fit:cover;}',
        '.cm-mini.active{opacity:1;border-color:#7FD8FF;box-shadow:0 0 1em rgba(127,216,255,.3);}',
        '.cm-mini.cm-focus{opacity:1;transform:translateY(-.6em) scale(1.14);border-color:#FF7A2F;box-shadow:0 .8em 2em rgba(0,0,0,.7),0 0 1.2em rgba(255,122,47,.6);}',

        /* КОСМОНАВТ В НЕВЕСОМОСТИ (RICK & MORTY / GRAVITY FALLS STYLE) */
        '.cm-astro-wrap{position:absolute;left:2.2em;bottom:1.2em;z-index:45;display:flex;align-items:flex-end;}',
        '.cm-astro{width:9.2em;height:10.5em;flex:none;cursor:pointer;border-radius:1.5em;transition:all .22s ease;}',
        '.cm-astro svg{width:100%;height:100%;filter:drop-shadow(0 1em 2em rgba(0,0,0,.6));}',
        '.cm-astro .cm-body{animation:cm-zerog 7s ease-in-out infinite;transform-origin:48% 52%;}',
        '.cm-astro.cm-focus{transform:scale(1.1);background:rgba(255,122,47,.12);border-radius:1.5em;box-shadow:0 0 0 2px #FF7A2F;}',
        '@keyframes cm-zerog{0%,100%{transform:translateY(0) rotate(-4deg);}50%{transform:translateY(-.7em) rotate(4deg);}}',
        '.cm-say{margin:0 0 1.6em 1.2em;max-width:25em;padding:.9em 1.3em;border-radius:1.2em 1.2em 1.2em .3em;',
        'background:rgba(11,16,26,.92);border:1px solid rgba(127,216,255,.2);font-size:1em;line-height:1.45;color:#D8E3F2;',
        'box-shadow:0 1em 2.5em rgba(0,0,0,.6);}',

        /* ЭКРАН ЗАГРУЗКИ */
        '.cm-load{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}',
        '.cm-load-ring{width:4.8em;height:4.8em;border-radius:50%;border:3px solid rgba(127,216,255,.15);border-top-color:#FF7A2F;',
        'animation:cm-spin 1s linear infinite;}',
        '.cm-load-txt{margin-top:1.4em;font-size:.82em;letter-spacing:.26em;color:#8FA2BC;}',

        /* МОДАЛЬНЫЕ ОКНА И ДИАЛОГИ */
        '.cm-ov{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;',
        'width:100vw!important;height:100vh!important;background:rgba(2,4,8,.88)!important;z-index:10000000!important;',
        'display:flex;align-items:center;justify-content:center;padding:2em;}',
        '.cm-modal{width:40em;max-width:100%;max-height:88%;overflow-y:auto;padding:2.2em;border-radius:1.8em;',
        'background:#0B101A;border:1px solid rgba(127,216,255,.2);box-shadow:0 2em 6em rgba(0,0,0,.8);}',
        '.cm-modal::-webkit-scrollbar{width:0;}',
        '.cm-modal h3{margin:0 0 .4em;font-size:1.45em;font-weight:800;letter-spacing:-.01em;color:#FFFFFF;}',
        '.cm-modal p{margin:0 0 1.4em;color:#8FA2BC;font-size:1.02em;line-height:1.55;}',
        '.cm-modal p b{color:#E6EDF8;}',
        '.cm-opt{display:block;width:100%;text-align:left;padding:1em 1.2em;margin-bottom:.65em;border-radius:1em;',
        'background:rgba(230,237,248,.06);color:#E6EDF8;font-size:1.02em;cursor:pointer;border:1px solid rgba(255,255,255,.05);',
        'transition:all .16s ease;}',
        '.cm-opt.cm-focus{background:#FF7A2F;color:#03060C;border-color:#FF7A2F;transform:scale(1.02);box-shadow:0 0 1.2em rgba(255,122,47,.4);}',
        '.cm-opt small{display:block;font-size:.8em;opacity:.75;margin-top:.2em;}',
        '.cm-chips{display:flex;flex-wrap:wrap;margin-bottom:1.2em;}',
        '.cm-chip{padding:.65em 1.15em;margin:0 .55em .55em 0;border-radius:1.3em;font-size:.96em;cursor:pointer;',
        'background:rgba(230,237,248,.07);border:1px solid rgba(127,216,255,.15);color:#E6EDF8;transition:all .16s ease;}',
        '.cm-chip.cm-focus{background:#7FD8FF;color:#03060C;border-color:#7FD8FF;transform:scale(1.08);box-shadow:0 0 1.2em rgba(127,216,255,.5);}',
        '.cm-input{width:100%;padding:1em 1.2em;margin-bottom:1.2em;border-radius:1em;font-size:1.05em;color:#FFF;outline:none;',
        'background:rgba(230,237,248,.08);border:1px solid rgba(127,216,255,.25);}',

        /* ТОСТЫ */
        '.cm-toast{position:fixed;left:50%;bottom:2.4em;transform:translateX(-50%) translateY(1em);z-index:10000001;opacity:0;',
        'padding:.85em 1.5em;border-radius:1em;background:rgba(11,16,26,.96);color:#E6EDF8;font-size:1em;',
        'border:1px solid rgba(127,216,255,.25);box-shadow:0 1em 3em rgba(0,0,0,.6);transition:all .25s ease;}',
        '.cm-toast.on{opacity:1;transform:translateX(-50%) translateY(0);}',

        /* АДАПТИВНОСТЬ */
        '@media (max-width:1020px){',
        '.cm-root{font-size:13.5px;}',
        '.cm-stage{padding:4.6em 1.4em 8.5em;align-items:flex-start;}',
        '.cm-port{flex-direction:column;align-items:flex-start;padding:1.4em;border-radius:1.8em;}',
        '.cm-poster{width:9em;height:13.5em;margin:0 0 1.2em;}',
        '.cm-name{font-size:1.85em;}',
        '.cm-plot{display:none;}',
        '.cm-act{flex:1 1 45%;justify-content:center;}',
        '.cm-astro{width:5.2em;height:6em;}',
        '.cm-say{display:none;}',
        '.cm-tray{bottom:.8em;}',
        '}'
    ].join('');

    function injectCSS() {
        if (document.getElementById('cm_css')) return;
        var s = el('style');
        s.id = 'cm_css';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    /* =========================================================================
       8. ГРАФИКА: ИКОНКИ И КОСМОНАВТ В СТИЛЕ RICK & MORTY / GRAVITY FALLS
       ========================================================================= */
    var I_BACK = '<svg viewBox="0 0 24 24"><path d="M15.4 4.3a1 1 0 0 1 0 1.4L9.4 12l6 6.3a1 1 0 1 1-1.4 1.4l-7-7a1 1 0 0 1 0-1.4l7-7a1 1 0 0 1 1.4 0z"/></svg>';
    var I_SEARCH = '<svg viewBox="0 0 24 24"><path d="M10 2a8 8 0 1 1-4.9 14.3l-3.4 3.4a1 1 0 0 1-1.4-1.4l3.4-3.4A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>';
    var I_REFRESH = '<svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>';
    var I_GEAR = '<svg viewBox="0 0 24 24"><path d="M19.1 12.9c0-.3.1-.6.1-.9s0-.6-.1-.9l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.6-.9l-.4-2.5H10.9l-.4 2.5c-.6.2-1.1.5-1.6.9l-2.4-1-2 3.4 2 1.6c0 .3-.1.6-.1.9s0 .6.1.9l-2 1.6 2 3.4 2.4-1c.5.4 1 .7 1.6.9l.4 2.5h3.8l.4-2.5c.6-.2 1.1-.5 1.6-.9l2.4 1 2-3.4-2-1.6zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>';
    var I_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    var I_NEXT = '<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z"/></svg>';
    var I_INFO = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
    var I_SPARKLE = '<svg viewBox="0 0 24 24"><path d="M12 2L9.5 8.5 3 11l6.5 2.5L12 20l2.5-6.5L21 11l-6.5-2.5L12 2z"/></svg>';
    var I_CAPSULE = '<svg viewBox="0 0 24 24"><path d="M17 2a5 5 0 0 1 3.5 8.5l-10 10A5 5 0 0 1 3.5 13.5l10-10A5 5 0 0 1 17 2zm-2 3.9-9.1 9.2a3 3 0 0 0 4.2 4.2L19.2 10a3 3 0 0 0-4.2-4.2z"/></svg>';

    /* Космонавт в невесомости: выразительный контур, шлем с отражением звёзд, плавный фал */
    var SVG_ASTRO = [
        '<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">',
        '<defs>',
        '<linearGradient id="cmVisorGrad" x1="0.2" y1="0.1" x2="0.8" y2="0.9">',
        '<stop offset="0%" stop-color="#3FA5D9"/>',
        '<stop offset="45%" stop-color="#142C48"/>',
        '<stop offset="100%" stop-color="#070D16"/>',
        '</linearGradient>',
        '<linearGradient id="cmSuitWhite" x1="0" y1="0" x2="1" y2="1">',
        '<stop offset="0%" stop-color="#FFFFFF"/>',
        '<stop offset="100%" stop-color="#C2CEE0"/>',
        '</linearGradient>',
        '</defs>',
        /* фал в невесомости */
        '<path d="M-10 205 C 40 210, 60 175, 45 145 C 35 125, 65 110, 75 125" fill="none" stroke="#60728C" stroke-width="4.5" stroke-linecap="round" opacity=".85"/>',
        '<g class="cm-body">',
        /* ранец системы жизнеобеспечения */
        '<rect x="52" y="70" width="94" height="88" rx="28" fill="#7A89A0" stroke="#0B101A" stroke-width="4.5"/>',
        '<rect x="62" y="80" width="74" height="20" rx="8" fill="#4B586E"/>',
        /* руки в невесомости */
        '<g transform="rotate(-18 42 98)">',
        '<rect x="22" y="80" width="34" height="62" rx="17" fill="url(#cmSuitWhite)" stroke="#0B101A" stroke-width="4.5"/>',
        '<rect x="22" y="105" width="34" height="9" fill="#FF7A2F" stroke="#0B101A" stroke-width="2.5"/>',
        '<circle cx="39" cy="144" r="13" fill="#E6EDF8" stroke="#0B101A" stroke-width="4.5"/>',
        '</g>',
        '<g transform="rotate(22 155 98)">',
        '<rect x="142" y="76" width="34" height="62" rx="17" fill="url(#cmSuitWhite)" stroke="#0B101A" stroke-width="4.5"/>',
        '<rect x="142" y="101" width="34" height="9" fill="#FF7A2F" stroke="#0B101A" stroke-width="2.5"/>',
        '<circle cx="159" cy="140" r="13" fill="#E6EDF8" stroke="#0B101A" stroke-width="4.5"/>',
        '</g>',
        /* ноги свободно парят */
        '<g transform="rotate(-12 72 155)">',
        '<rect x="60" y="145" width="28" height="58" rx="14" fill="url(#cmSuitWhite)" stroke="#0B101A" stroke-width="4.5"/>',
        '<ellipse cx="74" cy="204" rx="18" ry="12" fill="#7A89A0" stroke="#0B101A" stroke-width="4.5"/>',
        '</g>',
        '<g transform="rotate(14 125 155)">',
        '<rect x="110" y="145" width="28" height="58" rx="14" fill="url(#cmSuitWhite)" stroke="#0B101A" stroke-width="4.5"/>',
        '<ellipse cx="124" cy="204" rx="18" ry="12" fill="#7A89A0" stroke="#0B101A" stroke-width="4.5"/>',
        '</g>',
        /* торс и нагрудник */
        '<rect x="58" y="72" width="82" height="82" rx="26" fill="url(#cmSuitWhite)" stroke="#0B101A" stroke-width="4.5"/>',
        '<rect x="80" y="98" width="38" height="24" rx="7" fill="#141E2E" stroke="#0B101A" stroke-width="2.5"/>',
        '<circle cx="90" cy="110" r="3.5" fill="#FF7A2F"/>',
        '<circle cx="99" cy="110" r="3.5" fill="#7FD8FF"/>',
        '<circle cx="108" cy="110" r="3.5" fill="#A5E2FF"/>',
        /* шлем */
        '<circle cx="99" cy="50" r="42" fill="url(#cmSuitWhite)" stroke="#0B101A" stroke-width="4.5"/>',
        '<ellipse cx="99" cy="50" rx="31" ry="28" fill="url(#cmVisorGrad)" stroke="#0B101A" stroke-width="4"/>',
        /* блик на визоре (Rick & Morty / Gravity Falls dynamic shine) */
        '<path d="M78 35 C 88 26, 106 25, 116 31 C 105 34, 90 40, 83 49 Z" fill="#FFFFFF" opacity=".4"/>',
        '<circle cx="112" cy="58" r="2.8" fill="#7FD8FF" opacity=".95"/>',
        '<circle cx="88" cy="64" r="1.8" fill="#FFFFFF" opacity=".85"/>',
        /* антенна с маячком */
        '<rect x="94" y="6" width="10" height="8" rx="3" fill="#7A89A0" stroke="#0B101A" stroke-width="2.5"/>',
        '<circle cx="99" cy="4" r="5" fill="#FF7A2F" stroke="#0B101A" stroke-width="2.5"/>',
        '</g></svg>'
    ].join('');

    /* =========================================================================
       9. СИСТЕМА ФОКУСА И НАВИГАЦИИ (TV Remote D-Pad + Мышь + Сенсор)
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

    function bindPointer(node, r, c) {
        node.setAttribute('data-cm-r', r);
        node.setAttribute('data-cm-c', c);
        node.onmouseenter = function () { Nav.setFocus(r, c, true); };
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

    function animScroll(node, prop, to, ms) {
        if (!node) return;
        var from = node[prop], dist = to - from;
        if (Math.abs(dist) < 2) { node[prop] = to; return; }
        var dur = ms || 240, start = 0, token = {};
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
       10. ДИАЛОГИ, ТОСТЫ И ВВОД
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
       11. ОСНОВНОЙ ВИД КАПСУЛЫ
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
                this.speak('Связь установлена! Истории пока нет, но скажи свое настроение или любимый жанр — и я выберу 100% попадание.');
                return;
            }
            var parts = [];
            for (var i = 0; i < Math.min(t.genres.length, 2); i++) if (t.genres[i].name) parts.push(t.genres[i].name);
            var kw = t.keywords.length ? t.keywords[0].name : '';
            var line = 'Разобрал ' + t.count + ' фильмов из твоей истории';
            if (parts.length) line += ' (любишь ' + parts.join(', ') + ')';
            if (kw) line += ' и тему «' + kw + '»';
            this.speak(line + '. Вот шесть идеальных вариантов без лишнего шума.');
        },

        speak: function (text) { if (this.say) this.say.textContent = text; },

        renderEmpty: function () {
            this.stage.innerHTML = '';
            var bar = this.bar();
            this.stage.appendChild(bar.el);
            var wrap = el('div', 'cm-stage');
            var port = el('div', 'cm-port');
            var hero = el('div', 'cm-hero');
            hero.appendChild(el('div', 'cm-badge cm-mono', 'КАПСУЛА ПУСТА'));
            hero.appendChild(el('div', 'cm-name', 'Не удалось загрузить фильмы'));
            hero.appendChild(el('div', 'cm-why', 'Проверь интернет-соединение или выбери настроение вручную.'));
            var acts = el('div', 'cm-acts');
            var retry = el('div', 'cm-act primary', 'Попробовать снова');
            retry._cmAction = function () { Net.drop(); View.loading('ПОВТОРЯЮ ПОПЫТКУ'); View.boot(true); };
            var moodBtn = el('div', 'cm-act', 'Выбрать настроение');
            moodBtn._cmAction = function () { Companion.open(); };
            acts.appendChild(retry); acts.appendChild(moodBtn);
            hero.appendChild(acts);
            port.appendChild(hero);
            wrap.appendChild(port);
            this.stage.appendChild(wrap);
            Nav.reset();
            Nav.addRow(bar.items);
            Nav.addRow([retry, moodBtn]);
            Nav.setFocus(1, 0, true);
        },

        bar: function () {
            var bar = el('div', 'cm-bar'), items = [];
            var brand = el('div', 'cm-brand', 'КАПСУЛА <span>SANCTUARY</span>');
            bar.appendChild(brand);

            var right = el('div', 'cm-bar-r');
            var find = el('div', 'cm-ico', I_SEARCH);
            find.title = 'Поиск по настроению';
            find._cmAction = function () { Companion.ask(); };
            var upd = el('div', 'cm-ico', I_REFRESH);
            upd.title = 'Пересобрать капсулу';
            upd._cmAction = function () { View.reload(upd); };
            var gear = el('div', 'cm-ico', I_GEAR);
            gear.title = 'Настройки и вкус';
            gear._cmAction = function () { Settings.open(); };
            var back = el('div', 'cm-ico', I_BACK);
            back.title = 'Выйти из капсулы';
            back._cmAction = function () { exitApp(); };

            right.appendChild(find); right.appendChild(upd); right.appendChild(gear); right.appendChild(back);
            items.push(find); items.push(upd); items.push(gear); items.push(back);
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

            var pos = el('div', 'cm-poster');
            if (m.poster_path) {
                var img = el('img');
                img.onload = function () { addClass(img, 'ready'); };
                img.src = IMG + 'w500' + m.poster_path;
                pos.appendChild(img);
            }
            port.appendChild(pos);

            var hero = el('div', 'cm-hero');
            hero.appendChild(el('div', 'cm-badge cm-mono',
                esc(this.sourceLabel || 'КАПСУЛА') + ' <b>' + pad2(this.idx + 1) + ' / ' + pad2(this.list.length) + '</b>'));
            hero.appendChild(el('div', 'cm-name', esc(m.title || m.name || '')));

            var year = String(m.release_date || m.first_air_date || '').slice(0, 4);
            var gnames = [];
            var gids = m.genre_ids || [];
            for (var g = 0; g < Math.min(gids.length, 2); g++) if (GENRE_NAMES[gids[g]]) gnames.push(GENRE_NAMES[gids[g]]);
            var meta = [];
            if (year) meta.push(year);
            if (m.vote_average) meta.push('<i>★ ' + m.vote_average.toFixed(1) + '</i>');
            if (gnames.length) meta.push(gnames.join(' · '));
            if (m.media_type === 'tv') meta.push('сериал');
            hero.appendChild(el('div', 'cm-meta cm-mono', meta.join('   |   ').toUpperCase()));

            hero.appendChild(el('div', 'cm-why', '✦ ' + esc(Capsule.reason(m, this.taste || {}))));
            if (m.overview) hero.appendChild(el('div', 'cm-plot', esc(m.overview)));

            var acts = el('div', 'cm-acts');
            var bPlay = el('div', 'cm-act primary', I_PLAY + 'Смотреть');
            bPlay._cmAction = function () { play(m); };
            var bNext = el('div', 'cm-act', I_NEXT + 'Другой фильм');
            bNext._cmAction = function () { self.step(1); };
            var bMood = el('div', 'cm-act', I_SPARKLE + 'Настроение');
            bMood._cmAction = function () { Companion.open(); };
            var bInfo = el('div', 'cm-act', I_INFO + 'О фильме');
            bInfo._cmAction = function () { self.details(m); };
            acts.appendChild(bPlay); acts.appendChild(bNext); acts.appendChild(bMood); acts.appendChild(bInfo);
            hero.appendChild(acts);

            port.appendChild(hero);
            wrap.appendChild(port);
            this.stage.appendChild(wrap);
            Nav.addRow([bPlay, bNext, bMood, bInfo]);

            // Нижний лоток капсул
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

            // Космонавт
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
                    self.speak('Собрал свежую капсулу! Прошлые фильмы спрятаны.');
                });
            });
        },

        showFound: function (label, list) {
            if (!list.length) {
                this.speak('По запросу ничего не нашлось. Попробуй жанр или другое настроение.');
                Toast.show('Ничего не найдено');
                return;
            }
            var trimmed = list.slice(0, CAPSULE_SIZE);
            for (var i = 0; i < trimmed.length; i++) { trimmed[i]._src = 'search'; trimmed[i]._via = { query: label }; trimmed[i]._reasonText = null; }
            this.list = trimmed;
            this.idx = 0;
            this.sourceLabel = label.toUpperCase();
            this.source = 'search';
            this.render();
            this.speak('Отобрал ' + trimmed.length + ' лучших вариантов по теме «' + label + '».');
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
                if (dir) html += '<b>Режиссер:</b> ' + esc(dir) + '<br>';
                if (names.length) html += '<b>В главных ролях:</b> ' + esc(names.join(', ')) + '<br>';
                if (d.runtime) html += '<b>Длительность:</b> ' + d.runtime + ' мин<br>';
                if (d.vote_average) html += '<b>Рейтинг TMDb:</b> ' + d.vote_average.toFixed(1) + ' (' + (d.vote_count || 0) + ' оценок)';
                Modal.open({
                    title: d.title || d.name || '',
                    text: html || 'Описание не заполнено.',
                    items: [
                        { label: 'Смотреть', onSelect: function () { play(m); } },
                        { label: 'Почему в капсуле', onSelect: function () { Companion.why(m); } },
                        { label: 'Закрыть' }
                    ]
                });
            }, function () { Toast.show('Не загрузилось'); });
        }
    };

    /* =========================================================================
       12. КОСМОНАВТ-КОМПАНЬОН
       ========================================================================= */
    var Companion = {
        open: function () {
            var self = this, chips = [];
            for (var i = 0; i < MOODS.length; i++) (function (mo) {
                chips.push({ label: mo.label, onSelect: function () { self.find(mo.q, mo.label); } });
            })(MOODS[i]);

            Modal.open({
                title: 'Космонавт на связи',
                text: 'Устал искать? Выбери свое состояние — я изолирую шум и оставлю только то, что попадет в цель.',
                chips: chips,
                items: [
                    { label: 'Сказать словами / поиск', hint: 'например: «космический триллер», «нолановские головоломки»', onSelect: function () { self.ask(); } },
                    { label: 'Похожее на любимый фильм', onSelect: function () { self.similar(); } },
                    { label: 'Вернуть мою личную капсулу', onSelect: function () { View.loading('СОБИРАЮ КАПСУЛУ'); View.boot(false); } },
                    { label: 'Почему этот фильм выбран', onSelect: function () { self.why(View.list[View.idx]); } },
                    { label: 'Закрыть' }
                ]
            });
        },

        ask: function () {
            var self = this;
            askText('Что хочется посмотреть?', '', function (v) { self.find(v, v); });
        },

        find: function (query, label) {
            if (!query) return;
            View.speak('Сканирую киногалактику по запросу: «' + query + '»…');
            Net.get('/search/multi', { query: query, page: 1, include_adult: false }, function (d) {
                var list = markList(d && d.results, null, 'search', { query: query });
                list.sort(function (a, b) { return (b.vote_average || 0) - (a.vote_average || 0); });
                View.showFound(label || query, list);
            }, function () {
                Toast.show('Ошибка поиска');
            });
        },

        similar: function () {
            var t = View.taste;
            if (!t || !t.seeds || !t.seeds.length) {
                Toast.show('История пока пуста');
                View.speak('История пока не накопилась, но выбери настроение — и мы найдем то, что нужно.');
                return;
            }
            var seed = t.seeds[0];
            View.speak('Ищу фильмы по духу похожие на «' + (seed.title || 'любимое') + '»…');
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
                View.sourceLabel = 'ПОХОЖЕЕ НА ' + seed.title;
                View.render();
                View.speak('Все эти картины в одном ключе с «' + seed.title + '».');
            }, function () { Toast.show('Не получилось загрузить'); });
        },

        why: function (m) {
            if (!m) return;
            var t = View.taste || {};
            var html = '<b>' + esc(m.title || m.name || '') + '</b><br>' + esc(Capsule.reason(m, t)) + '<br><br>';
            if (t.count) {
                html += 'Проанализировано из истории Lampa: <b>' + t.count + '</b> карточек.<br>';
                var gs = [];
                for (var i = 0; i < (t.genres || []).length; i++) if (t.genres[i].name) gs.push(t.genres[i].name);
                if (gs.length) html += 'Твои доминирующие жанры: ' + esc(gs.join(', ')) + '.<br>';
                var ks = [];
                for (var k = 0; k < Math.min((t.keywords || []).length, 4); k++) ks.push(t.keywords[k].name);
                if (ks.length) html += 'Характерные темы: ' + esc(ks.join(', ')) + '.';
            } else {
                html += 'История Lampa пока пуста, поэтому капсула подобрана на основе мирового рейтинга и проверенных шедевров. Посмотри пару фильмов или добавь в избранное — и космонавт адаптируется!';
            }
            Modal.open({ title: 'Почему это здесь', text: html, items: [{ label: 'Понятно' }] });
        }
    };

    /* =========================================================================
       13. НАСТРОЙКИ И КАЛИБРОВКА ВКУСА
       ========================================================================= */
    var Settings = {
        open: function () {
            var self = this;
            Modal.open({
                title: 'Капсула',
                text: 'Изолированное пространство: минимум шума, максимум точности.',
                items: [
                    {
                        label: 'Свет от постера: ' + (sGet('cm_glow', true) ? 'вкл' : 'выкл'),
                        hint: 'мягкая космическая аура',
                        onSelect: function () { sSet('cm_glow', !sGet('cm_glow', true)); self.open(); }
                    },
                    {
                        label: 'Диагностика вкуса',
                        hint: 'проверить, что видит космонавт в истории',
                        onSelect: function () { self.diagnose(); }
                    },
                    {
                        label: 'Быстрая калибровка вкуса',
                        hint: 'выбрать 3 любимых жанра вручную',
                        onSelect: function () { self.calibrate(); }
                    },
                    {
                        label: 'Свой ключ TMDb',
                        hint: sGet('cm_tmdb_key', '') ? 'пользовательский' : 'встроенный',
                        onSelect: function () {
                            askText('Ключ TMDb', sGet('cm_tmdb_key', ''), function (v) {
                                sSet('cm_tmdb_key', v.replace(/\\s/g, ''));
                                Net.drop();
                                Toast.show('Ключ сохранен');
                            });
                        }
                    },
                    {
                        label: 'Сбросить показанные фильмы',
                        hint: 'разрешить показывать недавние варианты снова',
                        onSelect: function () { Capsule.forget(); Toast.show('Список сброшен'); }
                    },
                    {
                        label: 'Пересобрать капсулу с нуля',
                        hint: 'очистить кэш вкуса',
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

        calibrate: function () {
            var list = [
                { id: 878, label: 'Фантастика и Космос' },
                { id: 53, label: 'Триллеры и Саспенс' },
                { id: 35, label: 'Комедии' },
                { id: 18, label: 'Глубокие Драмы' },
                { id: 28, label: 'Боевики и Экшен' },
                { id: 9648, label: 'Детективы и Загадки' },
                { id: 27, label: 'Хоррор и Ужасы' },
                { id: 14, label: 'Фэнтези и Магия' }
            ];
            var chosen = [];
            var chips = [];
            for (var i = 0; i < list.length; i++) (function (it) {
                chips.push({
                    label: it.label,
                    onSelect: function () {
                        chosen.push({ id: it.id, score: 5, name: GENRE_NAMES[it.id] || it.label });
                        if (chosen.length >= 2) {
                            sSet('cm_manual_pref', { genres: chosen });
                            Toast.show('Вкус откалиброван!');
                            View.loading('СОБИРАЮ КАПСУЛУ');
                            View.boot(true);
                        } else {
                            Toast.show('Выбери еще один жанр');
                            Settings.calibrate();
                        }
                    }
                });
            })(list[i]);

            Modal.open({
                title: 'Калибровка вкуса',
                text: 'Выбери 2 любимых жанра, чтобы капсула знала твои предпочтения:',
                chips: chips,
                items: [{ label: 'Отмена' }]
            });
        },

        diagnose: function () {
            var st = History.stats();
            var t = View.taste || {};
            var html = 'Найдено в базах Lampa: <b>' + st.total + '</b> карточек';
            html += ' (с подробными данными — <b>' + st.withCards + '</b>, записей таймлайна — <b>' + st.timeline + '</b>).<br><br>';
            if (!st.total) {
                html += 'История пока пуста. Это нормально, если профиль новый. Посмотри фильмы или используй «Быструю калибровку вкуса» в настройках!';
            } else {
                var gs = [];
                for (var i = 0; i < (t.genres || []).length; i++) gs.push(t.genres[i].name + ' (' + t.genres[i].score.toFixed(1) + ')');
                html += gs.length ? 'Твои жанры: ' + esc(gs.join(', ')) + '.<br>' : 'Жанры в процессе анализа.<br>';
                var ks = [];
                for (var k = 0; k < (t.keywords || []).length; k++) ks.push(t.keywords[k].name);
                if (ks.length) html += 'Темы: ' + esc(ks.join(', ')) + '.<br>';
                if (t.era) html += 'Период: около <b>' + t.era + '</b> года.<br>';
                if (t.avgVote) html += 'Средняя оценка того, что ты смотришь: <b>' + t.avgVote.toFixed(1) + '</b>.';
            }
            Modal.open({ title: 'Что видит космонавт', text: html, items: [{ label: 'Закрыть' }] });
        }
    };

    /* =========================================================================
       14. ИНТЕГРАЦИЯ С LAMPA
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
       15. КЛАВИШИ ПУЛЬТА И УПРАВЛЕНИЕ
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
       16. КОМПОНЕНТ LAMPA И ПУНКТ МЕНЮ
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
        setTimeout(tryAdd, 1200);
        setTimeout(tryAdd, 3500);
    }

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
`;
