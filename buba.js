/**
 * Capsule Mod v12.0 — «Капсула»
 * Полная переработка:
 * - Новый интерфейс (как на скриншоте)
 * - Перерисованный робот с анимациями
 * - Улучшенные отсылки
 * - Кнопка "Обновить ВСЕ капсулы"
 * - Оптимизированное управление
 * - Исправленные ошибки синхронизации
 * - Умный компаньон
 */

(function () {
    'use strict';

    // === 1. КОНСТАНТЫ И НАСТРОЙКИ ===
    if (window.plugin_capsule_mod_ready) return;
    window.plugin_capsule_mod_ready = true;

    const COMPONENT_ID = 'capsule_mod_view';
    const CTRL_ID = 'capsule_mod_ctrl';
    const TMDB = 'https://api.themoviedb.org/3';
    const IMG = 'https://image.tmdb.org/t/p/';
    const FALLBACK_KEY = '4ef0d7355d9ffb5151e987764708ce96';
    const LANG = 'ru-RU';
    const CAPSULE_SIZE = 6;

    // === 2. УТИЛИТЫ ===
    const el = (tag, cls, html) => {
        const d = document.createElement(tag || 'div');
        if (cls) d.className = cls;
        if (html != null) d.innerHTML = html;
        return d;
    };

    const hasClass = (n, c) => !!n && (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1;
    const addClass = (n, c) => { if (n && !hasClass(n, c)) n.className += (n.className ? ' ' : '') + c; };
    const removeClass = (n, c) => {
        if (!n) return;
        n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/\s+/g, ' ').trim();
    };

    const closestClass = (n, cls) => {
        while (n && n !== document) {
            if (n.className && hasClass(n, cls)) return n;
            n = n.parentNode;
        }
        return null;
    };

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const indexOfArr = (arr, v) => arr.indexOf(v);
    const isArr = (v) => Array.isArray(v);
    const pad2 = (n) => (n < 10 ? '0' : '') + n;

    const raf = window.requestAnimationFrame || (f => setTimeout(f, 16));

    const animScroll = (node, prop, to, ms = 260) => {
        if (!node) return;
        const from = node[prop];
        const dist = to - from;
        if (Math.abs(dist) < 2) { node[prop] = to; return; }
        const start = Date.now();
        const token = {};
        node._cmAnim = token;
        const step = (ts) => {
            if (node._cmAnim !== token) return;
            const now = ts || Date.now();
            const p = clamp((now - start) / ms, 0, 1);
            node[prop] = from + dist * (1 - Math.pow(1 - p, 3));
            if (p < 1) raf(step);
            else node._cmAnim = null;
        };
        raf(step);
    };

    // === 3. ГОТОВНОСТЬ LAMPA + ХРАНИЛИЩЕ ===
    const LampaReady = { ready: false, waiters: [] };
    const onLampaReady = (cb) => {
        if (LampaReady.ready) { cb(); return; }
        LampaReady.waiters.push(cb);
    };

    const flushReady = () => {
        LampaReady.ready = true;
        LampaReady.waiters.forEach(cb => {
            try { cb(); } catch (e) { console.error(e); }
        });
        LampaReady.waiters = [];
    };

    try {
        if (window.Lampa?.Listener?.follow) {
            Lampa.Listener.follow('app', (e) => {
                if (e?.type === 'ready') flushReady();
            });
        }
    } catch (e) { console.error(e); }

    setTimeout(flushReady, 2500);

    // Собственные ключи плагина (localStorage)
    const pGet = (key, def) => {
        try {
            const raw = localStorage.getItem('cm_' + key);
            return raw != null ? JSON.parse(raw) : def;
        } catch (e) { return def; }
    };

    const pSet = (key, val) => {
        try { localStorage.setItem('cm_' + key, JSON.stringify(val)); } catch (e) {}
    };

    // Ключи Lampa (только через Lampa.Storage)
    const lampaStorageAvailable = () => {
        try { return !!(window.Lampa?.Storage?.get); } catch (e) { return false; }
    };

    const lampaGetRaw = (key, def) => {
        try { return Lampa.Storage.get(key, def); } catch (e) { return def; }
    };

    const isEmptyish = (v) => {
        if (v == null) return true;
        if (isArr(v)) return v.length === 0;
        if (typeof v === 'object') return Object.keys(v).length === 0;
        return false;
    };

    const ownedGet = (key, def, cb, attempt = 0) => {
        onLampaReady(() => {
            if (!lampaStorageAvailable()) { cb(def); return; }
            const value = lampaGetRaw(key, def);
            if (!isEmptyish(value) || attempt >= 6) { cb(value); return; }
            setTimeout(() => ownedGet(key, def, cb, attempt + 1), 350);
        });
    };

    // === 4. СЕТЬ (TMDb API) ===
    const Net = {
        mem: {},
        key: () => pGet('tmdb_key', '') || FALLBACK_KEY,
        url: (path, params) => {
            let u = `${TMDB}${path}?api_key=${Net.key()}&language=${LANG}`;
            if (params) for (const k in params) {
                if (params[k] == null) continue;
                u += `&${k}=${encodeURIComponent(params[k])}`;
            }
            return u;
        },
        get: (path, params, ok, fail, opts = {}) => {
            const url = Net.url(path, params);
            if (!opts.force && Net.mem[url] && Date.now() - Net.mem[url].t < (opts.ttl || 900000)) {
                setTimeout(() => ok(Net.mem[url].d), 0);
                return;
            }
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 12000;
            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) return;
                if (xhr.status >= 200 && xhr.status < 400) {
                    try { const d = JSON.parse(xhr.responseText); Net.mem[url] = { t: Date.now(), d }; ok(d); }
                    catch (e) { if (fail) fail('parse'); }
                } else if (fail) fail('http_' + xhr.status);
            };
            xhr.onerror = () => { if (fail) fail('net'); };
            xhr.ontimeout = () => { if (fail) fail('timeout'); };
            xhr.send();
        },
        drop: () => { Net.mem = {}; }
    };

    const parallel = (tasks, done) => {
        let left = tasks.length;
        const out = new Array(left);
        if (!left) return done(out);
        tasks.forEach((task, idx) => {
            task((r) => { out[idx] = r; if (--left === 0) done(out); });
        });
    };

    // === 5. СЛОВАРИ ===
    const GENRE_NAMES = {
        28: 'боевики', 12: 'приключения', 16: 'анимация', 35: 'комедии', 80: 'криминал',
        99: 'документальное', 18: 'драмы', 10751: 'семейное', 14: 'фэнтези', 36: 'историческое',
        27: 'ужасы', 10402: 'музыкальное', 9648: 'детективы', 10749: 'мелодрамы', 878: 'фантастика',
        53: 'триллеры', 10752: 'военное', 37: 'вестерны', 10759: 'боевики', 10765: 'фантастика',
        10768: 'военное', 10762: 'детское', 10763: 'новости', 10764: 'реалити', 10766: 'сериальные драмы', 10767: 'ток-шоу'
    };

    const TV2MOVIE = { 10759: 28, 10765: 878, 10768: 10752, 10762: 10751, 10766: 18 };

    const GENRE_SYN = [
        { m: [28], t: [10759], w: ['боевик', 'экшен', 'экшн', 'драка', 'перестрел', 'action'] },
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

    const TAG_SYN = [
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

    const STOP_WORDS = ['фильм', 'фильмы', 'кино', 'сериал', 'сериалы', 'смотреть', 'найди', 'найти',
        'хочу', 'что-то', 'что', 'нибудь', 'посоветуй', 'подбери', 'самые', 'самый', 'какой',
        'какие', 'типа', 'вроде', 'про', 'для', 'или', 'the', 'and'];

    const MOODS = [
        { label: '🎬 Отключить голову', q: 'лёгкая комедия приключения' },
        { label: '😱 Держать в напряжении', q: 'напряжённый триллер детектив' },
        { label: '🧠 Подумать', q: 'умная драма философский' },
        { label: '🚀 Улететь подальше', q: 'космическая фантастика фэнтези' },
        { label: '👻 Испугаться', q: 'ужасы хоррор' },
        { label: '😢 Заплакать', q: 'сильная драма мелодрама по реальным событиям' },
        { label: '💑 Вдвоём', q: 'мелодрама романтика' },
        { label: '👨‍👩‍👧‍👦 С детьми', q: 'семейное мультфильм анимация' },
        { label: '⚔️ Боевики', q: 'боевик экшен' },
        { label: '🕵️‍♂️ Детективы', q: 'детектив расследование' }
    ];

    // === 6. ИСТОРИЯ LAMPA ===
    const WEIGHTS = {
        history: 3.0, viewed: 3.0, look: 2.6, continued: 3.2,
        like: 2.8, wath: 1.8, book: 1.2, scheduled: 1.0, card: 1.0, thrown: -2.0
    };

    const History = {
        read: (cb) => {
            const cards = {}, acc = {}, order = [];
            const addCard = (c) => { if (c?.id && !cards[c.id]) cards[c.id] = c; };
            const bump = (id, weight, type, card) => {
                if (!id) return;
                id = parseInt(id, 10);
                if (!id) return;
                if (!acc[id]) { acc[id] = { id, w: 0, type: type || null, card: card || cards[id] || null }; order.push(id); }
                acc[id].w += weight;
                if (type && !acc[id].type) acc[id].type = type;
                if (card && !acc[id].card) acc[id].card = card;
            };
            const typeOf = (c) => {
                if (!c) return null;
                if (c.media_type === 'tv' || c.method === 'tv' || c.number_of_seasons || c.first_air_date) return 'tv';
                if (c.media_type === 'movie' || c.method === 'movie' || c.release_date || c.title) return 'movie';
                return (c.name && !c.title) ? 'tv' : 'movie';
            };

            const withFavorite = (fav) => {
                if (fav && typeof fav === 'object') {
                    if (isArr(fav.card)) fav.card.forEach(addCard);
                    for (const k in fav) {
                        const list = fav[k];
                        if (!isArr(list) || !list.length) continue;
                        const w = WEIGHTS[k] ?? 1;
                        list.forEach((entry, i) => {
                            const recency = 1 + clamp((list.length - i) / Math.max(list.length, 1), 0, 1) * 0.6;
                            if (entry && typeof entry === 'object') { addCard(entry); bump(entry.id, w * recency, typeOf(entry), entry); }
                            else bump(entry, w * recency, null, cards[entry] || null);
                        });
                    }
                }
                withExtras();
            };

            const withExtras = () => {
                const extra = ['history', 'view', 'viewed', 'card_history', 'recomends_last',
                               'wath', 'look', 'like', 'book', 'scheduled', 'continued', 'thrown'];
                let left = extra.length;
                if (!left) return withTimeline();
                extra.forEach(key => {
                    const w = WEIGHTS[key] || 1.6;
                    ownedGet(key, null, (list2) => {
                        if (isArr(list2)) {
                            list2.forEach(it => {
                                if (it && typeof it === 'object') { addCard(it); bump(it.id, w, typeOf(it), it); }
                                else bump(it, w, null, null);
                            });
                        }
                        if (--left === 0) withTimeline();
                    });
                });
            };

            const withTimeline = () => {
                ownedGet('timeline', {}, (timeline) => {
                    if (timeline && typeof timeline === 'object') {
                        for (const tk in timeline) {
                            if (!timeline.hasOwnProperty(tk)) continue;
                            const m = /^(movie|tv)_(\d+)/.exec(tk) || /^(\d+)$/.exec(tk);
                            if (m) bump(m[2] || m[1], 1.5, m[1] === 'tv' ? 'tv' : 'movie', null);
                        }
                    }
                    finish();
                });
            };

            const finish = () => {
                const out = [];
                order.forEach(id => {
                    const rec = acc[id];
                    if (!rec) return;
                    if (!rec.card && cards[rec.id]) rec.card = cards[rec.id];
                    if (!rec.type) rec.type = typeOf(rec.card);
                    if (rec.w <= 0) return;
                    out.push(rec);
                });
                out.sort((a, b) => b.w - a.w);
                cb(out);
            };

            onLampaReady(() => {
                let fav = null;
                try { if (window.Lampa?.Favorite?.full) fav = Lampa.Favorite.full(); } catch (e) {}
                if (fav && typeof fav === 'object' && !isEmptyish(fav)) { withFavorite(fav); return; }
                ownedGet('favorite', {}, withFavorite);
            });
        },

        stats: (cb) => {
            History.read((items) => {
                const withCards = items.filter(it => it.card).length;
                ownedGet('timeline', {}, (timeline) => {
                    const tlCount = timeline ? Object.keys(timeline).length : 0;
                    cb({ total: items.length, withCards, timeline: tlCount, items });
                });
            });
        }
    };

    // === 7. МОДЕЛЬ ВКУСА ===
    const DCACHE_KEY = 'dcache';
    const Taste = {
        cache: null,
        loadCache: () => {
            if (Taste.cache) return Taste.cache;
            Taste.cache = pGet(DCACHE_KEY, {}) || {};
            return Taste.cache;
        },
        saveCache: () => {
            const c = Taste.cache || {};
            const keys = Object.keys(c);
            if (keys.length > 240) {
                const trimmed = {};
                for (let i = keys.length - 240; i < keys.length; i++) trimmed[keys[i]] = c[keys[i]];
                Taste.cache = trimmed;
            }
            pSet(DCACHE_KEY, Taste.cache);
        },
        enrich: (items, limit, cb) => {
            const cache = Taste.loadCache();
            const need = [];
            for (let i = 0; i < Math.min(items.length, limit); i++) {
                const it = items[i];
                const ck = (it.type || 'x') + '_' + it.id;
                if (cache[ck]) continue;
                if (it.card?.genre_ids?.length) {
                    cache[ck] = {
                        g: it.card.genre_ids.slice(0, 5),
                        k: [],
                        v: it.card.vote_average || 0,
                        y: parseInt(String(it.card.release_date || it.card.first_air_date || '').slice(0, 4), 10) || 0,
                        n: it.card.title || it.card.name || '',
                        t: it.type || 'movie'
                    };
                    continue;
                }
                need.push(it);
            }
            if (!need.length) { Taste.saveCache(); return cb(cache); }
            const tasks = need.map(it => () => {
                const order = it.type === 'tv' ? ['tv', 'movie'] : ['movie', 'tv'];
                let n = 0;
                const attempt = () => {
                    if (n >= order.length) return cb(null);
                    const type = order[n++];
                    Net.get(`/${type}/${it.id}`, { append_to_response: 'keywords' }, (d) => {
                        if (!d?.id) return attempt();
                        const kws = (d.keywords?.keywords || d.keywords?.results) || [];
                        const kk = kws.slice(0, 8).map(k => [k.id, k.name]);
                        const gg = (d.genres || []).slice(0, 5).map(g => g.id);
                        cache[(it.type || type) + '_' + it.id] = {
                            g: gg, k: kk, v: d.vote_average || 0,
                            y: parseInt(String(d.release_date || d.first_air_date || '').slice(0, 4), 10) || 0,
                            n: d.title || d.name || '', t: type
                        };
                        it.type = type;
                        cb(true);
                    }, attempt, { ttl: 604800000 });
                };
                attempt();
            });
            parallel(tasks, () => { Taste.saveCache(); cb(Taste.cache); });
        },
        build: (cb) => {
            History.stats((stats) => {
                const items = stats.items;
                if (!items.length) return cb({ empty: true, count: 0, genres: [], keywords: [], seeds: [], watched: {}, stats });
                Taste.enrich(items, 14, (cache) => {
                    const gScore = {}, kScore = {}, kName = {}, years = [], votes = [];
                    const watched = {}, seeds = [];
                    items.forEach(it => {
                        watched[it.id] = true;
                        const d = cache[(it.type || 'movie') + '_' + it.id] || cache['movie_' + it.id] || cache['tv_' + it.id];
                        if (!d) return;
                        const w = it.w;
                        (d.g || []).forEach(gid => { gScore[TV2MOVIE[gid] || gid] = (gScore[TV2MOVIE[gid] || gid] || 0) + w; });
                        (d.k || []).forEach(([kid, name]) => { kScore[kid] = (kScore[kid] || 0) + w * 0.8; kName[kid] = name; });
                        if (d.y) years.push(d.y);
                        if (d.v) votes.push(d.v);
                        if (seeds.length < 5 && w > 0) seeds.push({ id: it.id, type: d.t || it.type || 'movie', title: d.n });
                    });
                    const genres = Object.entries(gScore)
                        .map(([id, score]) => ({ id: parseInt(id, 10), score, name: GENRE_NAMES[id] || '' }))
                        .sort((a, b) => b.score - a.score);
                    const keywords = Object.entries(kScore)
                        .filter(([k, score]) => score > 1.5)
                        .map(([id, score]) => ({ id: parseInt(id, 10), score, name: kName[id] }))
                        .sort((a, b) => b.score - a.score);
                    years.sort((a, b) => a - b);
                    const median = years.length ? years[Math.floor(years.length / 2)] : 0;
                    const avgVote = votes.length ? votes.reduce((a, b) => a + b, 0) / votes.length : 0;
                    cb({ empty: false, count: items.length, known: years.length, genres, keywords, era: median, avgVote, seeds, watched, stats });
                });
            });
        }
    };

    // === 8. СБОРКА КАПСУЛЫ ===
    const markList = (list, type, src, via) => {
        if (!list) return [];
        return list.filter(it => {
            if (!it || !it.poster_path || it.adult) return false;
            it.media_type = it.media_type || type || (it.name && !it.title ? 'tv' : 'movie');
            if (it.media_type !== 'movie' && it.media_type !== 'tv') return false;
            it._src = src;
            it._via = via || null;
            return true;
        });
    };

    const Capsule = {
        shown: () => { const v = pGet('shown', []); return isArr(v) ? v : []; },
        remember: (ids) => {
            let s = Capsule.shown().concat(ids);
            if (s.length > 80) s = s.slice(s.length - 80);
            pSet('shown', s);
        },
        forget: () => pSet('shown', []),
        build: (taste, opts, cb) => {
            opts = opts || {};
            const force = !!opts.force;
            const page = force ? 1 + Math.floor(Math.random() * 3) : 1;
            const tasks = [];
            const topG = taste.genres || [];
            const topK = taste.keywords || [];
            (taste.seeds || []).slice(0, 3).forEach(seed => {
                tasks.push(done => {
                    Net.get(`/${seed.type}/${seed.id}/recommendations`, { page: 1 }, (d) => {
                        done(markList(d?.results, seed.type, 'seed', { seed: seed.title }));
                    }, () => done([]), { force });
                });
            });
            if (topG.length) {
                const gids = topG.slice(0, 2).map(g => g.id);
                tasks.push(done => {
                    Net.get('/discover/movie', {
                        with_genres: gids.join(','),
                        sort_by: 'popularity.desc',
                        page,
                        'vote_count.gte': 200,
                        'vote_average.gte': clamp(taste.avgVote ? taste.avgVote - 0.4 : 6.4, 6.0, 7.4),
                        include_adult: false
                    }, (d) => { done(markList(d?.results, 'movie', 'genre', { genres: gids })); }, () => done([]), { force });
                });
            }
            if (topK.length) {
                const kids = topK.slice(0, 3).map(k => k.id);
                tasks.push(done => {
                    Net.get('/discover/movie', {
                        with_keywords: kids.join('|'),
                        sort_by: 'popularity.desc',
                        page,
                        'vote_count.gte': 120,
                        'vote_average.gte': 6.2,
                        include_adult: false
                    }, (d) => { done(markList(d?.results, 'movie', 'keyword', { kw: topK[0]?.name })); }, () => done([]), { force });
                });
            }
            if (!taste.seeds?.length && !topG.length) {
                tasks.push(done => {
                    Net.get('/discover/movie', {
                        sort_by: 'vote_average.desc',
                        'vote_count.gte': 3000,
                        'vote_average.gte': 7.6,
                        page,
                        include_adult: false
                    }, (d) => { done(markList(d?.results, 'movie', 'top')); }, () => done([]), { force });
                });
                tasks.push(done => {
                    Net.get('/trending/all/week', { page: 1 }, (d) => { done(markList(d?.results, null, 'trend')); }, () => done([]), { force });
                });
            }
            parallel(tasks, (packs) => {
                const all = packs.flat().filter(Boolean);
                let picked = Capsule.pick(all, taste, force);
                if (picked.length < 3) {
                    Net.get('/discover/movie', {
                        with_genres: topG.length ? topG[0].id : '',
                        sort_by: 'vote_average.desc',
                        'vote_count.gte': 800,
                        'vote_average.gte': 7.0,
                        page: 1,
                        include_adult: false
                    }, (d) => { cb(Capsule.pick(all.concat(markList(d?.results, 'movie', 'relax')), taste, force)); }, () => cb(picked));
                } else cb(picked);
            });
        },
        pick: (all, taste, force) => {
            const seen = {};
            const out = [];
            const shown = Capsule.shown();
            const gWeight = {};
            (taste.genres || []).forEach(g => { gWeight[g.id] = g.score; });
            const maxG = taste.genres?.length ? taste.genres[0].score : 1;
            all.forEach(it => {
                const key = it.media_type + '_' + it.id;
                if (seen[key]) { seen[key]._score += 3.5; seen[key]._multi = true; return; }
                if (taste.watched?.[it.id]) return;
                if (shown.includes(it.id)) return;
                if (!it.vote_average || it.vote_average < 5.8) return;
                if ((it.vote_count || 0) < 60) return;
                let s = 0;
                (it.genre_ids || []).forEach(gid => {
                    const g = TV2MOVIE[gid] || gid;
                    if (gWeight[g]) s += 4 * Math.sqrt(gWeight[g] / maxG);
                });
                if (it._src === 'seed') s += 5;
                if (it._src === 'keyword') {
                    s += 4.5;
                    if (it._via?.kw?.length > 12) s += 0.8;
                }
                if (it._src === 'genre') s += 2;
                if (it._src === 'trend') s += 0.5;
                s += clamp(it.vote_average - 6, 0, 3) * 1.6;
                s += clamp((it.vote_count || 0) / 4000, 0, 1.2);
                if (taste.era) {
                    const y = parseInt(String(it.release_date || it.first_air_date || '').slice(0, 4), 10) || 0;
                    if (y) s -= clamp(Math.abs(y - taste.era) / 30, 0, 1.2);
                }
                if (!it.overview) s -= 1;
                s += (Math.random() - 0.5) * 0.5;
                it._score = s;
                seen[key] = it;
                out.push(it);
            });
            out.sort((a, b) => b._score - a._score);
            const bySrc = {};
            const discoverySlots = Math.min(1, CAPSULE_SIZE - 1);
            const mainSlots = CAPSULE_SIZE - discoverySlots;
            const final = [];
            for (let i = 0; i < out.length && final.length < mainSlots; i++) {
                const src = out[i]._src || 'x';
                bySrc[src] = (bySrc[src] || 0) + 1;
                if (bySrc[src] > 3) continue;
                final.push(out[i]);
            }
            if (discoverySlots > 0) {
                for (let i = 0; i < out.length; i++) {
                    if (final.includes(out[i])) continue;
                    let isTop = false;
                    const gids = out[i].genre_ids || [];
                    if (taste.genres?.length) {
                        const topId = taste.genres[0].id;
                        for (const gid of gids) if ((TV2MOVIE[gid] || gid) === topId) { isTop = true; break; }
                    }
                    if (!isTop && out[i].vote_average >= 6.6) { final.push(out[i]); break; }
                }
            }
            for (let i = 0; final.length < CAPSULE_SIZE && i < out.length; i++) {
                if (!final.includes(out[i])) final.push(out[i]);
            }
            return final;
        },
        reason: (item, taste) => {
            if (item._reasonText) return item._reasonText;
            let r = '';
            if (item._src === 'seed' && item._via?.seed) r = `✅ Похоже на «${item._via.seed}»`;
            else if (item._src === 'keyword' && item._via?.kw) r = `🏷️ Тема: «${item._via.kw}»`;
            else if (item._src === 'genre' || item._src === 'relax') {
                const names = [];
                const gids = item.genre_ids || [];
                for (let i = 0; i < (taste.genres || []).length && names.length < 2; i++) {
                    if (gids.includes(taste.genres[i].id) && taste.genres[i].name) names.push(taste.genres[i].name);
                }
                r = names.length ? `🎭 Твои жанры: ${names.join(' и ')}` : '⭐ Высокий рейтинг';
            } else if (item._src === 'search') {
                r = item._via?.query ? `🔍 По запросу: «${item._via.query}»` : 'Найдено по запросу';
            } else r = '⭐ Высокий рейтинг';
            if (item._multi) r += ' · Совпало по нескольким признакам';
            item._reasonText = r;
            return r;
        }
    };

    // === 9. ПОИСК ===
    const parseQuery = (raw) => {
        const q = String(raw || '').toLowerCase().replace(/ё/g, 'е');
        const ctx = {
            raw,
            genresM: [],
            genresT: [],
            tags: [],
            tokens: [],
            type: 'any',
            yearFrom: 0,
            yearTo: 0,
            minVote: 5.8,
            minVotes: 40
        };
        if (/сериал|сезон|series/.test(q)) ctx.type = 'tv';
        else if (/фильм|кино|movie/.test(q)) ctx.type = 'movie';
        GENRE_SYN.forEach(g => g.w.forEach(w => {
            if (q.includes(w)) { ctx.genresM.push(...g.m); ctx.genresT.push(...g.t); }
        }));
        TAG_SYN.forEach(t => t.w.forEach(w => {
            if (q.includes(w)) ctx.tags.push(t.k);
        }));
        const dec = q.match(/(\d{2})\s?-?\s?х/);
        if (dec) {
            const d = parseInt(dec[1], 10);
            const base = d >= 30 ? 1900 + d : 2000 + d;
            ctx.yearFrom = base;
            ctx.yearTo = base + 9;
        }
        const y4 = q.match(/(19|20)\d{2}/);
        if (y4 && !ctx.yearFrom) { ctx.yearFrom = parseInt(y4[0], 10); ctx.yearTo = ctx.yearFrom; }
        if (/новинк|свеж|недавн/.test(q)) { const cy = new Date().getFullYear(); ctx.yearFrom = cy - 1; ctx.yearTo = cy + 1; }
        if (/классик|стар[оы]е/.test(q) && !ctx.yearFrom) { ctx.yearFrom = 1950; ctx.yearTo = 1999; }
        if (/лучш|топ|шедевр|культов/.test(q)) { ctx.minVote = 7.2; ctx.minVotes = 600; }
        const words = q.split(/[^a-zа-я0-9]+/);
        words.forEach(w => {
            if (w.length >= 4 && !STOP_WORDS.includes(w)) ctx.tokens.push(w);
        });
        ctx.genresM = [...new Set(ctx.genresM)];
        ctx.genresT = [...new Set(ctx.genresT)];
        ctx.tags = [...new Set(ctx.tags)];
        return ctx;
    };

    const uniq = (a) => [...new Set(a)];
    const stem = (t) => t.length > 5 ? t.substring(0, t.length - 2) : t;

    const Search = {
        resolveTags: (tags, cb) => {
            if (!tags.length) return cb([]);
            const tasks = tags.slice(0, 3).map(name => done => {
                Net.get('/search/keyword', { query: name, page: 1 }, (d) => {
                    done(d?.results?.length ? d.results[0].id : null);
                }, () => done(null), { ttl: 604800000 });
            });
            parallel(tasks, (res) => cb(res.filter(Boolean)));
        },
        run: (query, taste, cb) => {
            const ctx = parseQuery(query);
            Search.resolveTags(ctx.tags, (kwIds) => {
                const tasks = [];
                const discover = (media) => {
                    const p = {
                        sort_by: 'popularity.desc',
                        include_adult: false,
                        page: 1,
                        'vote_count.gte': ctx.minVotes,
                        'vote_average.gte': ctx.minVote
                    };
                    const g = media === 'tv' ? ctx.genresT : ctx.genresM;
                    if (g.length) p.with_genres = g.slice(0, 2).join(',');
                    if (kwIds.length) p.with_keywords = kwIds.join('|');
                    if (ctx.yearFrom) {
                        if (media === 'tv') {
                            p['first_air_date.gte'] = `${ctx.yearFrom}-01-01`;
                            p['first_air_date.lte'] = `${ctx.yearTo}-12-31`;
                        } else {
                            p['primary_release_date.gte'] = `${ctx.yearFrom}-01-01`;
                            p['primary_release_date.lte'] = `${ctx.yearTo}-12-31`;
                        }
                    }
                    return p;
                };
                if (ctx.type !== 'tv') tasks.push(done => {
                    Net.get('/discover/movie', discover('movie'), (d) => {
                        done(markList(d?.results, 'movie', 'search', { query }));
                    }, () => done([]));
                });
                if (ctx.type !== 'movie') tasks.push(done => {
                    Net.get('/discover/tv', discover('tv'), (d) => {
                        done(markList(d?.results, 'tv', 'search', { query }));
                    }, () => done([]));
                });
                if (ctx.tokens.length) tasks.push(done => {
                    Net.get('/search/multi', { query, page: 1, include_adult: false }, (d) => {
                        done(markList(d?.results, null, 'search', { query }));
                    }, () => done([]));
                });
                parallel(tasks, (packs) => {
                    const all = packs.flat().filter(Boolean);
                    cb(Search.rank(all, ctx, taste), ctx);
                });
            });
        },
        rank: (list, ctx, taste) => {
            const out = [], seen = {};
            const stems = ctx.tokens.map(stem);
            const gWeight = {};
            (taste?.genres || []).forEach(g => { gWeight[g.id] = g.score; });
            const maxG = (taste?.genres?.length) ? taste.genres[0].score : 1;
            list.forEach(it => {
                const key = it.media_type + '_' + it.id;
                if (seen[key]) { seen[key]._score += 2; return; }
                const title = String(it.title || it.name || '').toLowerCase();
                const over = String(it.overview || '').toLowerCase();
                let s = 0;
                stems.forEach(stem => {
                    if (title.includes(stem)) s += 5;
                    if (over.includes(stem)) s += 2.5;
                });
                const wanted = it.media_type === 'tv' ? ctx.genresT : ctx.genresM;
                (it.genre_ids || []).forEach(gid => {
                    if (wanted.includes(gid)) s += 4;
                    const mapped = TV2MOVIE[gid] || gid;
                    if (gWeight[mapped]) s += 2 * (gWeight[mapped] / maxG);
                });
                s += clamp((it.vote_average || 0) - 5.5, 0, 4) * 1.1;
                s += clamp((it.vote_count || 0) / 5000, 0, 1);
                if (!it.overview) s -= 1.5;
                it._score = s;
                seen[key] = it;
                out.push(it);
            });
            return out.sort((a, b) => b._score - a._score).slice(0, CAPSULE_SIZE * 2);
        }
    };

    // === 10. ТЕМЫ ОФОРМЛЕНИЯ ===
    const THEMES = {
        astro: {
            name: 'Космос',
            cls: 'cm-t-astro',
            vars: {
                '--cm-bg': '#05070D',
                '--cm-accent': '#FF7A2F',
                '--cm-accent2': '#7FD8FF',
                '--cm-text': '#E8ECF5',
                '--cm-sub': '#8695AC',
                '--cm-panel': 'rgba(16,21,32,.65)',
                '--cm-panel2': 'rgba(9,12,20,.55)',
                '--cm-chip': 'rgba(232,236,245,.05)',
                '--cm-radius': '1.5em'
            }
        },
        breakingbad: {
            name: 'Лаборатория',
            cls: 'cm-t-bb',
            vars: {
                '--cm-bg': '#0B0E08',
                '--cm-accent': '#D6E24A',
                '--cm-accent2': '#1FAE96',
                '--cm-text': '#EDF2E0',
                '--cm-sub': '#9AAE8C',
                '--cm-panel': 'rgba(19,24,13,.72)',
                '--cm-panel2': 'rgba(12,16,8,.6)',
                '--cm-chip': 'rgba(214,226,74,.08)',
                '--cm-radius': '.6em'
            }
        },
        matrix: {
            name: 'Матрица',
            cls: 'cm-t-matrix',
            vars: {
                '--cm-bg': '#000600',
                '--cm-accent': '#00FF41',
                '--cm-accent2': '#00B32E',
                '--cm-text': '#C8FFD4',
                '--cm-sub': '#4E9E5E',
                '--cm-panel': 'rgba(0,12,0,.72)',
                '--cm-panel2': 'rgba(0,8,0,.6)',
                '--cm-chip': 'rgba(0,255,65,.06)',
                '--cm-radius': '.2em'
            }
        },
        panda: {
            name: 'Свиток',
            cls: 'cm-t-panda',
            vars: {
                '--cm-bg': '#1C140B',
                '--cm-accent': '#D8433C',
                '--cm-accent2': '#E7B65C',
                '--cm-text': '#F4E9D2',
                '--cm-sub': '#B79E7B',
                '--cm-panel': 'rgba(42,31,18,.78)',
                '--cm-panel2': 'rgba(30,22,13,.65)',
                '--cm-chip': 'rgba(231,182,92,.1)',
                '--cm-radius': '.9em'
            }
        },
        rickmorty: {
            name: 'Портал',
            cls: 'cm-t-rm',
            vars: {
                '--cm-bg': '#07141B',
                '--cm-accent': '#7CFF6B',
                '--cm-accent2': '#3AD1FF',
                '--cm-text': '#E6FFF1',
                '--cm-sub': '#6FA894',
                '--cm-panel': 'rgba(6,22,28,.72)',
                '--cm-panel2': 'rgba(4,16,20,.6)',
                '--cm-chip': 'rgba(124,255,107,.08)',
                '--cm-radius': '1.1em'
            }
        }
    };
    const THEME_ORDER = ['astro', 'breakingbad', 'matrix', 'panda', 'rickmorty'];

    const Themes = {
        current: () => THEMES[pGet('theme', 'astro')] ? pGet('theme', 'astro') : 'astro',
        apply: (key, root) => {
            const t = THEMES[key] || THEMES.astro;
            root = root || View.root;
            if (!root) return;
            THEME_ORDER.forEach(k => removeClass(root, THEMES[k].cls));
            addClass(root, t.cls);
            Object.entries(t.vars).forEach(([v, val]) => root.style.setProperty(v, val));
            Themes.fx(key, root);
        },
        set: (key) => { pSet('theme', key); Themes.apply(key, View.root); },
        fx: (key, root) => {
            const old = root?.querySelector('.cm-rain');
            if (old) old.remove();
            if (key === 'matrix') Themes.rain(root);
        },
        rain: (root) => {
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
            const canvas = el('canvas', 'cm-rain');
            root.insertBefore(canvas, root.firstChild);
            const ctx = canvas.getContext?.('2d');
            if (!ctx) return;
            const chars = 'アイウエオカキクケコサシスセソ0123456789'.split('');
            const resize = () => { canvas.width = root.clientWidth; canvas.height = root.clientHeight; };
            resize();
            const cols = Math.max(1, Math.floor(canvas.width / 18));
            const drops = Array(cols).fill().map(() => Math.random() * -40);
            const timer = setInterval(() => {
                if (!canvas.parentNode) { clearInterval(timer); return; }
                ctx.fillStyle = 'rgba(0,6,0,0.12)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#00FF41';
                ctx.font = '14px monospace';
                drops.forEach((y, c) => {
                    ctx.fillText(chars[Math.floor(Math.random() * chars.length)], c * 18, y * 18);
                    if (y * 18 > canvas.height && Math.random() > 0.975) drops[c] = 0;
                    drops[c]++;
                });
            }, 70);
            canvas._cmTimer = timer;
        },
        portalBurst: (fromNode) => {
            if (Themes.current() !== 'rickmorty') return;
            const ring = el('div', 'cm-portal-burst');
            document.body.appendChild(ring);
            setTimeout(() => ring.remove(), 650);
        }
    };

    // === 11. CSS ===
    const CSS = `
        .cm-root {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 999998;
            overflow: hidden;
            color: var(--cm-text);
            background: var(--cm-bg);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            -webkit-tap-highlight-color: transparent;
            user-select: none;
            transition: background .4s;
        }
        .cm-root * { box-sizing: border-box; }
        .cm-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
        .cm-rain {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: .5;
            pointer-events: none;
        }
        .cm-stars {
            position: absolute;
            top: -10%;
            left: -10%;
            width: 120%;
            height: 120%;
            opacity: .35;
            background-image:
                radial-gradient(1px 1px at 12% 22%, #fff, transparent),
                radial-gradient(1px 1px at 68% 14%, #cfe6ff, transparent),
                radial-gradient(1.4px 1.4px at 84% 62%, #fff, transparent),
                radial-gradient(1px 1px at 32% 78%, #9fd4ff, transparent),
                radial-gradient(1px 1px at 52% 46%, #fff, transparent),
                radial-gradient(1.2px 1.2px at 8% 64%, #fff, transparent);
            background-repeat: repeat;
            background-size: 100% 100%;
            animation: cm-drift 60s linear infinite;
        }
        .cm-t-matrix .cm-stars, .cm-t-bb .cm-stars, .cm-t-panda .cm-stars { opacity: .08; }
        @keyframes cm-drift { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(-2%,-3%,0); } }
        .cm-glow {
            position: absolute;
            top: -25%;
            left: -25%;
            width: 150%;
            height: 150%;
            background-size: cover;
            background-position: center;
            opacity: 0;
            filter: blur(80px) saturate(150%);
            transition: opacity .8s ease;
        }
        .cm-glow.on { opacity: .2; }
        .cm-shade {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(90% 70% at 65% 40%, rgba(0,0,0,.2), rgba(0,0,0,.86) 62%, var(--cm-bg) 100%);
        }
        .cm-bar {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1.6em;
            z-index: 40;
        }
        .cm-stage {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2.2em 3em 1.5em 3em;
        }
        .cm-port {
            position: relative;
            display: flex;
            align-items: center;
            width: 100%;
            max-width: 72em;
            border-radius: var(--cm-radius);
            padding: 1.8em;
            background: var(--cm-panel);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
            transition: background .4s, border-radius .4s;
        }
        .cm-port:before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: var(--cm-radius);
            pointer-events: none;
            background: linear-gradient(115deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,0) 34%);
        }
        .cm-hero-poster {
            position: relative;
            flex: none;
            width: 16em;
            height: 24em;
            border-radius: calc(var(--cm-radius) * 0.7);
            overflow: hidden;
            background: #0B0F18;
            box-shadow: 0 1em 2em rgba(0,0,0,.5);
            margin-right: 1.8em;
        }
        .cm-hero-poster img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0;
            transition: opacity .4s;
        }
        .cm-hero-poster img.ready { opacity: 1; }
        .cm-hero { flex: 1; min-width: 0; }
        .cm-count {
            font-size: .7em;
            letter-spacing: .24em;
            color: var(--cm-sub);
            margin-bottom: .6em;
        }
        .cm-count b { color: var(--cm-accent); font-weight: 700; }
        .cm-name {
            font-size: 2.2em;
            font-weight: 700;
            line-height: 1.1;
            letter-spacing: -.01em;
            margin-bottom: .5em;
        }
        .cm-why {
            position: relative;
            padding-left: 1em;
            font-size: 1em;
            line-height: 1.4;
            color: var(--cm-text);
            opacity: .85;
            margin-bottom: 1em;
            max-width: 30em;
        }
        .cm-why:before {
            content: "";
            position: absolute;
            left: 0;
            top: .3em;
            bottom: .3em;
            width: .16em;
            border-radius: .1em;
            background: var(--cm-accent);
        }
        .cm-acts {
            display: flex;
            flex-wrap: wrap;
            margin-top: .4em;
        }
        .cm-act {
            display: flex;
            align-items: center;
            padding: .85em 1.5em;
            border-radius: calc(var(--cm-radius) * 0.5);
            margin: 0 .6em .6em 0;
            cursor: pointer;
            background: var(--cm-chip);
            font-size: 1.05em;
            font-weight: 600;
            color: var(--cm-text);
            transition: background .16s, transform .16s, color .16s, box-shadow .16s;
        }
        .cm-act svg { width: 1.1em; height: 1.1em; fill: currentColor; margin-right: .55em; }
        .cm-act.primary { background: var(--cm-accent); color: #05070D; }
        .cm-act.cm-focus {
            background: #FFFFFF;
            color: #05070D;
            transform: scale(1.04);
        }
        .cm-act.primary.cm-focus { box-shadow: 0 0 0 .18em rgba(255,255,255,.25); }
        .cm-tray {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 1em;
            display: flex;
            justify-content: center;
            z-index: 30;
        }
        .cm-tray-in {
            display: flex;
            align-items: center;
            padding: .5em;
            border-radius: 1em;
            background: var(--cm-panel2);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
        }
        .cm-mini {
            position: relative;
            flex: none;
            width: 3.8em;
            height: 5.6em;
            border-radius: .5em;
            overflow: hidden;
            margin: 0 .35em;
            background: #0B0F18;
            cursor: pointer;
            opacity: .5;
            transition: opacity .18s, transform .18s, box-shadow .18s, filter .18s;
        }
        .cm-mini img { width: 100%; height: 100%; object-fit: cover; }
        .cm-mini.active { opacity: 1; }
        .cm-mini.cm-focus {
            opacity: 1;
            transform: translateY(-.4em) scale(1.08);
            box-shadow: 0 .4em .8em rgba(0,0,0,.5), 0 0 0 .12em var(--cm-accent);
        }
        .cm-astro-wrap {
            position: absolute;
            left: 1.2em;
            bottom: .8em;
            z-index: 20;
            pointer-events: none;
            opacity: .9;
        }
        .cm-astro { width: 6.4em; height: 7.2em; pointer-events: auto; }
        .cm-astro svg { width: 100%; height: 100%; }
        .cm-astro .cm-body {
            animation: cm-float 5s ease-in-out infinite, cm-sway 7s ease-in-out infinite;
            transform-origin: 50% 50%;
        }
        @keyframes cm-float { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-.6em) rotate(2deg); } }
        @keyframes cm-sway { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(5deg); } }
        .cm-load {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .cm-load-ring {
            width: 4em;
            height: 4em;
            border-radius: 50%;
            box-shadow: inset 0 0 0 .16em rgba(255,255,255,.15);
            position: relative;
        }
        .cm-load-ring:after {
            content: "";
            position: absolute;
            top: -.16em;
            left: -.16em;
            right: -.16em;
            bottom: -.16em;
            border-radius: 50%;
            border: .16em solid transparent;
            border-top-color: var(--cm-accent);
            animation: cm-spin 1.1s linear infinite;
        }
        @keyframes cm-spin { to { transform: rotate(360deg); } }
        .cm-load-txt {
            margin-top: 1em;
            font-size: .7em;
            letter-spacing: .22em;
            color: var(--cm-sub);
        }
        .cm-ov {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,.78);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.2em;
        }
        .cm-modal {
            width: 36em;
            max-width: 100%;
            max-height: 86%;
            overflow-y: auto;
            padding: 1.6em;
            border-radius: var(--cm-radius);
            background: var(--cm-panel2);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
        }
        .cm-modal::-webkit-scrollbar { width: 0; }
        .cm-modal h3 {
            margin: 0 0 .3em;
            font-size: 1.25em;
            font-weight: 700;
            letter-spacing: -.01em;
        }
        .cm-modal p {
            margin: 0 0 1em;
            color: var(--cm-sub);
            font-size: .95em;
            line-height: 1.5;
        }
        .cm-modal p b { color: var(--cm-text); }
        .cm-modal-mascot {
            display: flex;
            justify-content: center;
            margin: -.2em 0 .8em;
        }
        .cm-modal-mascot .cm-astro { width: 6em; height: 6.6em; display: block; }
        .cm-sec {
            font-size: .72em;
            letter-spacing: .18em;
            color: var(--cm-sub);
            margin: 1em 0 .5em;
        }
        .cm-sec:first-child { margin-top: 0; }
        .cm-opt {
            display: block;
            width: 100%;
            text-align: left;
            padding: .8em 1em;
            margin-bottom: .45em;
            border-radius: calc(var(--cm-radius) * 0.5);
            background: var(--cm-chip);
            color: var(--cm-text);
            font-size: .95em;
            cursor: pointer;
            transition: background .15s, transform .15s, color .15s;
        }
        .cm-opt.cm-focus {
            background: var(--cm-accent);
            color: #05070D;
            transform: scale(1.01);
        }
        .cm-opt small {
            display: block;
            font-size: .75em;
            opacity: .7;
            margin-top: .1em;
        }
        .cm-chips {
            display: flex;
            flex-wrap: wrap;
            margin-bottom: .8em;
        }
        .cm-chip {
            padding: .55em .9em;
            margin: 0 .45em .45em 0;
            border-radius: 1em;
            font-size: .9em;
            cursor: pointer;
            background: var(--cm-chip);
            color: var(--cm-text);
            transition: background .15s, transform .15s, color .15s;
        }
        .cm-chip.cm-focus {
            background: var(--cm-accent2);
            color: #05070D;
            transform: scale(1.05);
        }
        .cm-input {
            width: 100%;
            padding: .8em 1em;
            margin-bottom: .8em;
            border-radius: calc(var(--cm-radius) * 0.5);
            font-size: 1em;
            color: #fff;
            outline: none;
            background: var(--cm-chip);
            border: 1px solid rgba(255,255,255,.15);
        }
        .cm-toast {
            position: fixed;
            left: 50%;
            bottom: 1.8em;
            transform: translateX(-50%) translateY(1em);
            z-index: 1000001;
            opacity: 0;
            padding: .7em 1.2em;
            border-radius: .7em;
            background: var(--cm-panel2);
            color: var(--cm-text);
            font-size: .9em;
            box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
            transition: opacity .25s, transform .25s;
        }
        .cm-toast.on {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        @media (hover:hover) {
            .cm-act:hover, .cm-opt:hover, .cm-chip:hover { background: rgba(255,255,255,.14); }
            .cm-mini:hover { opacity: 1; }
        }
        .cm-t-bb .cm-port { border: 1px solid rgba(214,226,74,.18); }
        .cm-t-bb .cm-flask {
            position: absolute;
            width: 3em;
            height: 3.6em;
            opacity: .5;
            pointer-events: none;
        }
        .cm-t-bb .cm-flask.f1 { top: .6em; right: 1em; }
        .cm-t-bb .cm-flask.f2 { bottom: .6em; right: 4.2em; }
        .cm-t-bb .cm-flask svg { width: 100%; height: 100%; }
        .cm-t-bb .cm-mini.cm-focus, .cm-t-bb .cm-act.cm-focus {
            box-shadow: 0 0 0 .14em var(--cm-accent2), 0 .4em .8em rgba(0,0,0,.5);
        }
        .cm-t-matrix { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        .cm-t-matrix .cm-name, .cm-t-matrix .cm-act, .cm-t-matrix .cm-opt { letter-spacing: .02em; }
        .cm-t-matrix .cm-mini { filter: grayscale(.6) contrast(1.1); }
        .cm-t-matrix .cm-mini.active { filter: none; }
        .cm-t-matrix .cm-mini.cm-focus {
            filter: none;
            box-shadow: 0 0 0 2px var(--cm-accent), 0 0 0 4px rgba(0,255,65,.25);
            transform: translateY(-.4em) scale(1.1);
            transition: transform .35s cubic-bezier(.2,1.4,.4,1), box-shadow .35s;
        }
        .cm-t-matrix .cm-act.cm-focus { box-shadow: 0 0 0 2px var(--cm-accent), 0 0 12px rgba(0,255,65,.5); }
        .cm-t-matrix .cm-port { border: 1px solid rgba(0,255,65,.15); }
        .cm-t-panda .cm-port {
            background-image:
                linear-gradient(var(--cm-panel), var(--cm-panel)),
                repeating-linear-gradient(115deg, rgba(255,255,255,.025) 0 2px, transparent 2px 6px);
            background-blend-mode: normal;
            border: 1px solid rgba(231,182,92,.25);
        }
        .cm-t-panda .cm-root {
            background-image: radial-gradient(120% 90% at 30% 0%, rgba(216,67,60,.08), transparent 60%);
        }
        .cm-t-panda .cm-mini { border-radius: .35em; }
        .cm-t-panda .cm-mini.cm-focus {
            box-shadow: 0 0 0 .16em var(--cm-accent);
            animation: cm-ink .5s ease;
        }
        @keyframes cm-ink { 0% { transform: scale(.9) translateY(0); } 60% { transform: scale(1.12) translateY(-.5em); } 100% { transform: scale(1.08) translateY(-.4em); } }
        .cm-t-panda .cm-act.cm-focus { border-radius: 1.4em .4em 1.4em .4em; }
        .cm-t-rm .cm-port {
            border: 1px solid rgba(124,255,107,.22);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), 0 0 40px rgba(58,209,255,.06);
        }
        .cm-t-rm .cm-mini.cm-focus { box-shadow: 0 0 0 .14em var(--cm-accent2), 0 0 16px rgba(124,255,107,.5); }
        .cm-t-rm .cm-act.cm-focus { box-shadow: 0 0 0 .14em var(--cm-accent2), 0 0 14px rgba(124,255,107,.45); }
        .cm-portal-burst {
            position: fixed;
            left: 50%;
            top: 50%;
            width: 2em;
            height: 2em;
            margin: -1em 0 0 -1em;
            border-radius: 50%;
            z-index: 1000002;
            pointer-events: none;
            background: radial-gradient(circle, rgba(124,255,107,.9) 0%, rgba(58,209,255,.6) 40%, transparent 70%);
            animation: cm-portal .6s ease-out forwards;
        }
        @keyframes cm-portal { 0% { transform: scale(0); opacity: 1; } 100% { transform: scale(38); opacity: 0; } }
        @media (max-width: 1000px) {
            .cm-root { font-size: 13px; }
            .cm-stage { padding: 2.2em 1em 8em; align-items: flex-start; }
            .cm-port { flex-direction: column; align-items: flex-start; padding: 1em; }
            .cm-hero-poster { width: 7em; height: 10.5em; margin: 0 0 .8em; }
            .cm-name { font-size: 1.6em; }
            .cm-act { flex: 1 1 100%; justify-content: center; }
            .cm-astro { width: 4.2em; height: 4.8em; }
            .cm-tray { bottom: .6em; }
        }
        @media (prefers-reduced-motion: reduce) {
            .cm-root * { animation: none !important; transition: none !important; }
        }
    `;

    const injectCSS = () => {
        if (document.getElementById('cm_css')) return;
        const s = el('style');
        s.id = 'cm_css';
        s.textContent = CSS;
        document.head.appendChild(s);
    };

    // === 12. ГРАФИКА (НОВЫЙ РОБОТ) ===
    const I_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    const I_COMPANION = '<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 1 5 5v1.2a5 5 0 0 1-1.4 9.6H8.4A5 5 0 0 1 7 8.2V7a5 5 0 0 1 5-5zm-3 9a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm6 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"/></svg>';
    const I_CAPSULE = '<svg viewBox="0 0 24 24"><path d="M17 2a5 5 0 0 1 3.5 8.5l-10 10A5 5 0 0 1 3.5 13.5l10-10A5 5 0 0 1 17 2zm-2 3.9-9.1 9.2a3 3 0 0 0 4.2 4.2L19.2 10a3 3 0 0 0-4.2-4.2z"/></svg>';
    const I_FLASK = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 2h6v2h-1v5l5 10a2 2 0 0 1-1.8 3H6.8A2 2 0 0 1 5 19l5-10V4H9z" fill="none" stroke="#D6E24A" stroke-width="1.3"/><circle cx="12" cy="17" r="1.3" fill="#1FAE96"/><circle cx="10" cy="19" r=".9" fill="#D6E24A"/></svg>';

    // НОВЫЙ РОБОТ (анимированный)
    const SVG_ROBOT = `
        <svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="robotBody" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#4A6B8A" />
                    <stop offset="100%" stop-color="#2A3A4A" />
                </linearGradient>
                <linearGradient id="robotVisor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#6A8BAD" />
                    <stop offset="100%" stop-color="#1A2A3A" />
                </linearGradient>
                <linearGradient id="robotLight" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FFD700" />
                    <stop offset="100%" stop-color="#FFA500" />
                </linearGradient>
            </defs>
            <!-- Тело робота -->
            <rect x="70" y="80" width="60" height="80" rx="10" fill="url(#robotBody)" class="robot-body" />
            <!-- Голова -->
            <circle cx="100" cy="60" r="25" fill="url(#robotVisor)" class="robot-head" />
            <!-- Глаза -->
            <circle cx="90" cy="55" r="3" fill="url(#robotLight)" class="robot-eye" />
            <circle cx="110" cy="55" r="3" fill="url(#robotLight)" class="robot-eye" />
            <!-- Рот -->
            <rect x="85" y="65" width="30" height="5" rx="2" fill="#1A2A3A" />
            <!-- Руки -->
            <rect x="40" y="90" width="30" height="10" rx="5" fill="#5A7A9A" class="robot-arm left-arm" />
            <rect x="130" y="90" width="30" height="10" rx="5" fill="#5A7A9A" class="robot-arm right-arm" />
            <!-- Ноги -->
            <rect x="70" y="160" width="20" height="30" rx="5" fill="#5A7A9A" class="robot-leg left-leg" />
            <rect x="110" y="160" width="20" height="30" rx="5" fill="#5A7A9A" class="robot-leg right-leg" />
            <!-- Антенна -->
            <line x1="100" y1="35" x2="100" y2="50" stroke="#FFD700" stroke-width="2" class="robot-antenna" />
            <circle cx="100" cy="35" r="5" fill="#FFD700" class="robot-antenna-ball" />
            <!-- Кнопка на теле -->
            <rect x="90" y="110" width="20" height="15" rx="3" fill="#1A2A3A" />
            <circle cx="100" cy="117.5" r="2" fill="#FFD700" />
        </svg>
    `;

    // === 13. НАВИГАЦИЯ ===
    const Nav = {
        rows: [],
        r: 0,
        c: 0,
        reset: () => { Nav.rows = []; Nav.r = 0; Nav.c = 0; },
        addRow: (items) => {
            const clean = items.filter(Boolean);
            if (!clean.length) return;
            Nav.rows.push({ items: clean, memo: 0 });
            const idx = Nav.rows.length - 1;
            clean.forEach((item, j) => bindPointer(item, idx, j));
        },
        setFocus: (r, c, silent) => {
            if (!Nav.rows.length) return;
            Nav.r = clamp(r, 0, Nav.rows.length - 1);
            const row = Nav.rows[Nav.r];
            Nav.c = clamp(c, 0, row.items.length - 1);
            row.memo = Nav.c;
            Nav.paint(silent);
        },
        current: () => Nav.rows[Nav.r]?.items[Nav.c] || null,
        paint: (silent) => {
            document.querySelectorAll('.cm-focus').forEach(n => removeClass(n, 'cm-focus'));
            const cur = Nav.current();
            if (!cur) return;
            addClass(cur, 'cm-focus');
            if (!silent) {
                const strip = closestClass(cur, 'cm-tray-in');
                if (strip && strip.scrollWidth > strip.clientWidth) {
                    animScroll(strip, 'scrollLeft', cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2, 220);
                }
            }
        },
        move: (dir) => {
            if (!Nav.rows.length) return;
            if (dir === 'up' && Nav.r > 0) Nav.setFocus(Nav.r - 1, Nav.rows[Nav.r - 1].memo || 0);
            else if (dir === 'down' && Nav.r < Nav.rows.length - 1) Nav.setFocus(Nav.r + 1, Nav.rows[Nav.r + 1].memo || 0);
        },
        enter: () => { const cur = Nav.current(); if (cur?._cmAction) cur._cmAction(cur); }
    };

    let touchMode = false;
    document.addEventListener('touchstart', () => { touchMode = true; }, true);

    const bindPointer = (node, r, c) => {
        node.setAttribute('data-cm-r', r);
        node.setAttribute('data-cm-c', c);
        node.onmouseenter = () => { if (!touchMode) Nav.setFocus(r, c, true); };
    };

    const trigger = (node) => { if (node?._cmAction) node._cmAction(node); };

    document.addEventListener('click', (e) => {
        let n = e.target;
        while (n && n !== document) {
            if (n._cmAction) {
                const r = parseInt(n.getAttribute('data-cm-r'), 10);
                const c = parseInt(n.getAttribute('data-cm-c'), 10);
                if (!isNaN(r) && !isNaN(c)) Nav.setFocus(r, c, true);
                trigger(n);
                return;
            }
            n = n.parentNode;
        }
    }, false);

    // Свайп для смены фильмов
    let swipe = { x: 0, y: 0, on: false };
    document.addEventListener('touchstart', (e) => {
        if (!App.active || Modal.active()) return;
        swipe.x = e.touches[0].clientX;
        swipe.y = e.touches[0].clientY;
        swipe.on = true;
    }, true);
    document.addEventListener('touchend', (e) => {
        if (!swipe.on || !App.active || Modal.active()) return;
        swipe.on = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - swipe.x;
        const dy = t.clientY - swipe.y;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
            if (dx < 0) View.step(1);
            else View.step(-1);
        }
    }, true);

    // === 14. МОДАЛЬНЫЕ ОКНА И УВЕДОМЛЕНИЯ ===
    const Toast = {
        node: null,
        timer: null,
        show: (text) => {
            if (!Toast.node) {
                Toast.node = el('div', 'cm-toast');
                document.body.appendChild(Toast.node);
            }
            Toast.node.textContent = text;
            addClass(Toast.node, 'on');
            clearTimeout(Toast.timer);
            Toast.timer = setTimeout(() => removeClass(Toast.node, 'on'), 2600);
        }
    };

    const notify = (t) => {
        try { if (window.Lampa?.Noty?.show) { Lampa.Noty.show(t); return; } } catch (e) {}
        Toast.show(t);
    };

    const Modal = {
        stack: [],
        open: (opts) => {
            Themes.portalBurst();
            const ov = el('div', 'cm-ov');
            const box = el('div', 'cm-modal');
            const nodes = [];
            if (opts.mascot) {
                const mw = el('div', 'cm-modal-mascot');
                mw.innerHTML = SVG_ROBOT;
                box.appendChild(mw);
            }
            if (opts.title) box.appendChild(el('h3', '', esc(opts.title)));
            if (opts.text) box.appendChild(el('p', '', opts.text));
            if (opts.chips?.length) {
                const wrap = el('div', 'cm-chips');
                opts.chips.forEach(ch => {
                    const c = el('div', 'cm-chip', esc(ch.label));
                    c._cmAction = () => { Modal.close(); ch.onSelect(); };
                    wrap.appendChild(c);
                    nodes.push(c);
                });
                box.appendChild(wrap);
            }
            if (opts.items) opts.items.forEach(it => {
                if (it.section) { box.appendChild(el('div', 'cm-sec cm-mono', esc(it.section))); return; }
                const b = el('div', 'cm-opt', esc(it.label) + (it.hint ? '<small>' + esc(it.hint) + '</small>' : ''));
                b._cmAction = () => { Modal.close(); if (it.onSelect) it.onSelect(); };
                box.appendChild(b);
                nodes.push(b);
            });
            ov.appendChild(box);
            document.body.appendChild(ov);
            ov.onclick = (e) => { if (e.target === ov) Modal.close(); };
            const st = { ov, box, nodes, idx: 0 };
            Modal.stack.push(st);
            Modal.paint();
            return st;
        },
        paint: () => {
            const st = Modal.stack[Modal.stack.length - 1];
            if (!st) return;
            st.nodes.forEach(n => removeClass(n, 'cm-focus'));
            const cur = st.nodes[st.idx];
            if (cur) {
                addClass(cur, 'cm-focus');
                try { cur.scrollIntoView?.(false); } catch (e) {}
            }
        },
        move: (dir) => {
            const st = Modal.stack[Modal.stack.length - 1];
            if (!st?.nodes.length) return;
            if (dir === 'down' || dir === 'right') st.idx = clamp(st.idx + 1, 0, st.nodes.length - 1);
            if (dir === 'up' || dir === 'left') st.idx = clamp(st.idx - 1, 0, st.nodes.length - 1);
            Modal.paint();
        },
        enter: () => { const st = Modal.stack[Modal.stack.length - 1]; if (st) trigger(st.nodes[st.idx]); },
        close: () => {
            const st = Modal.stack.pop();
            if (!st) return;
            st.ov.remove();
            if (Modal.stack.length) Modal.paint();
            else Nav.paint(true);
        },
        active: () => Modal.stack.length > 0
    };

    const askText = (title, value, cb) => {
        try {
            if (window.Lampa?.Input?.edit) {
                Lampa.Input.edit({ title, value: value || '', free: true }, (v) => { if (v) cb(v); });
                return;
            }
        } catch (e) {}
        const input = el('input', 'cm-input');
        input.type = 'text';
        input.value = value || '';
        const st = Modal.open({
            title,
            items: [
                { label: 'Найти', onSelect: () => { if (input.value) cb(input.value); } },
                { label: 'Отмена' }
            ]
        });
        st.box.insertBefore(input, st.box.childNodes[1] || null);
        input.onkeydown = (e) => {
            e.stopPropagation();
            if (e.keyCode === 13 && input.value) { Modal.close(); cb(input.value); }
        };
        setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
    };

    // === 15. ЭКРАН КАПСУЛЫ ===
    const View = {
        root: null,
        stage: null,
        glow: null,
        list: [],
        idx: 0,
        taste: null,
        source: 'taste',
        sourceLabel: '',
        say: null,
        busy: false,
        activeQuery: { kind: 'taste', label: 'КАПСУЛА' },
        _lastBuiltAt: 0,
        _enteredBefore: false,

        create: () => {
            injectCSS();
            View.root = el('div', 'cm-root');
            Themes.apply(Themes.current(), View.root);
            View.root.appendChild(el('div', 'cm-stars'));
            View.glow = el('div', 'cm-glow');
            View.root.appendChild(View.glow);
            View.root.appendChild(el('div', 'cm-shade'));
            View.stage = el('div');
            View.stage.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;';
            View.root.appendChild(View.stage);
            View.loading('СОБИРАЮ КАПСУЛУ');
            View.boot(false);
            return View.root;
        },

        loading: (text) => {
            View.stage.innerHTML = '';
            const box = el('div', 'cm-load');
            box.appendChild(el('div', 'cm-load-ring'));
            box.appendChild(el('div', 'cm-load-txt cm-mono', text));
            View.stage.appendChild(box);
            Nav.reset();
        },

        boot: (force) => {
            View.busy = true;
            Taste.build((taste) => {
                View.taste = taste;
                Capsule.build(taste, { force }, (list) => {
                    View.busy = false;
                    View.source = 'taste';
                    View.sourceLabel = 'КАПСУЛА';
                    View.activeQuery = { kind: 'taste', label: 'КАПСУЛА' };
                    if (!list.length) { View.renderEmpty(); return; }
                    const ids = list.map(item => item.id);
                    Capsule.remember(ids);
                    View.list = list;
                    View.idx = 0;
                    View.render();
                    View.greet();
                });
            });
        },

        // ОБНОВЛЕНИЕ: Теперь обновляет ВСЕ капсулы
        refreshAllCapsules: () => {
            if (View.busy) return;
            View.busy = true;
            Net.drop();
            View.loading('ОБНОВЛЯЮ ВСЕ КАПСУЛЫ');
            Taste.build((taste) => {
                View.taste = taste;
                Capsule.build(taste, { force: true }, (list) => {
                    View.busy = false;
                    View.list = list;
                    View.idx = 0;
                    View.source = 'taste';
                    View.sourceLabel = 'КАПСУЛА';
                    View.activeQuery = { kind: 'taste', label: 'КАПСУЛА' };
                    if (!list.length) { View.renderEmpty(); return; }
                    const ids = list.map(item => item.id);
                    Capsule.remember(ids);
                    View.render();
                    notify("✅ Все капсулы обновлены!");
                });
            });
        },

        greet: () => {
            const t = View.taste;
            if (!t || t.empty || !t.count) {
                View.speak('Истории пока нет. Нажми «Компаньон» — соберу капсулу по настроению.');
                return;
            }
            const parts = [];
            for (let i = 0; i < Math.min(t.genres.length, 2); i++) if (t.genres[i].name) parts.push(t.genres[i].name);
            const kw = t.keywords.length ? t.keywords[0].name : '';
            let line = `Прочитал ${t.count} карточек из истории`;
            if (parts.length) line += `: жанры ${parts.join(' и ')}`;
            if (kw) line += `, тема «${kw}»`;
            View.speak(line + '. Вот шесть фильмов под тебя.');
        },

        speak: (text) => { if (View.say) View.say.textContent = text; },

        renderEmpty: () => {
            View.stage.innerHTML = '';
            View.stage.appendChild(el('div', 'cm-bar'));
            const wrap = el('div', 'cm-stage');
            const port = el('div', 'cm-port');
            const hero = el('div', 'cm-hero');
            hero.appendChild(el('div', 'cm-count cm-mono', 'КАПСУЛА ПУСТА'));
            hero.appendChild(el('div', 'cm-name', 'Нечего показать'));
            hero.appendChild(el('div', 'cm-why', 'TMDb не ответил или нет интернета. Открой «Компаньон» → «Обновить ВСЕ капсулы».'));
            const acts = el('div', 'cm-acts');
            const retry = el('div', 'cm-act primary', '🔄 Попробовать снова');
            retry._cmAction = () => { Net.drop(); View.loading('ПОВТОРЯЮ ПОПЫТКУ'); View.refreshAllCapsules(); };
            const comp = el('div', 'cm-act', I_COMPANION + 'Компаньон');
            comp._cmAction = () => Companion.open();
            acts.appendChild(retry);
            acts.appendChild(comp);
            hero.appendChild(acts);
            port.appendChild(hero);
            wrap.appendChild(port);
            View.stage.appendChild(wrap);
            Nav.reset();
            Nav.addRow([retry, comp]);
            Nav.setFocus(0, 0, true);
        },

        render: () => {
            const m = View.list[View.idx];
            if (!m) return View.renderEmpty();
            View._lastBuiltAt = Date.now();
            View.stage.innerHTML = '';
            Nav.reset();
            View.stage.appendChild(el('div', 'cm-bar'));
            const wrap = el('div', 'cm-stage');
            const port = el('div', 'cm-port');
            if (Themes.current() === 'breakingbad') {
                port.appendChild(el('div', 'cm-flask f1', I_FLASK));
                port.appendChild(el('div', 'cm-flask f2', I_FLASK));
            }
            const pos = el('div', 'cm-hero-poster');
            if (m.poster_path) {
                const img = el('img');
                img.onload = () => addClass(img, 'ready');
                img.src = IMG + 'w500' + m.poster_path;
                pos.appendChild(img);
            }
            port.appendChild(pos);
            const hero = el('div', 'cm-hero');
            hero.appendChild(el('div', 'cm-count cm-mono',
                esc(View.sourceLabel || 'КАПСУЛА') + ' · <b>' + pad2(View.idx + 1) + '</b> / ' + pad2(View.list.length)));
            hero.appendChild(el('div', 'cm-name', esc(m.title || m.name || '')));
            hero.appendChild(el('div', 'cm-why', esc(Capsule.reason(m, View.taste || {}))));
            const acts = el('div', 'cm-acts');
            const bPlay = el('div', 'cm-act primary', I_PLAY + 'Смотреть');
            bPlay._cmAction = () => play(m);
            const bComp = el('div', 'cm-act', I_COMPANION + 'Компаньон');
            bComp._cmAction = () => Companion.open();
            const bRefresh = el('div', 'cm-act', '🔄 Обновить ВСЕ');
            bRefresh._cmAction = () => View.refreshAllCapsules();
            acts.appendChild(bPlay);
            acts.appendChild(bComp);
            acts.appendChild(bRefresh);
            hero.appendChild(acts);
            port.appendChild(hero);
            wrap.appendChild(port);
            View.stage.appendChild(wrap);
            Nav.addRow([bPlay, bComp, bRefresh]);
            const tray = el('div', 'cm-tray');
            const trayIn = el('div', 'cm-tray-in');
            View.list.forEach((item, i) => {
                const mini = el('div', 'cm-mini' + (i === View.idx ? ' active' : ''));
                if (item.poster_path) {
                    const mi = el('img');
                    mi.src = IMG + 'w185' + item.poster_path;
                    mini.appendChild(mi);
                }
                mini._cmAction = () => View.go(i);
                trayIn.appendChild(mini);
            });
            tray.appendChild(trayIn);
            View.stage.appendChild(tray);
            Nav.addRow(Array.from(trayIn.children));
            Nav.setFocus(0, 0, true);
            View.setGlow(m);
        },

        setGlow: (m) => {
            if (!pGet('glow', true) || !View.glow) return;
            const url = m.backdrop_path ? IMG + 'w780' + m.backdrop_path : (m.poster_path ? IMG + 'w342' + m.poster_path : '');
            if (!url || View.glow._url === url) return;
            View.glow._url = url;
            View.glow.style.backgroundImage = `url(${url})`;
            addClass(View.glow, 'on');
        },

        go: (i) => {
            if (i < 0 || i >= View.list.length || i === View.idx) return;
            const r = Nav.r;
            const c = Nav.c;
            View.idx = i;
            View.render();
            Nav.setFocus(r, c, true);
        },

        step: (delta) => {
            if (!View.list.length) return;
            let next = View.idx + delta;
            if (next >= View.list.length) next = 0;
            if (next < 0) next = View.list.length - 1;
            View.go(next);
        }
    };

    // === 16. КОМПАНЬОН (УМНЕЕ) ===
    const Companion = {
        open: () => {
            const chips = MOODS.map(mood => ({
                label: mood.label,
                onSelect: () => Companion.find(mood.q, mood.label, 'mood')
            }));
            Modal.open({
                mascot: true,
                title: '🤖 Компаньон на связи',
                text: 'Выбери настроение или скажи словами, что хочешь посмотреть.',
                chips,
                items: [
                    { section: '🎭 НАСТРОЕНИЕ' },
                    { label: '🔍 Сказать словами', hint: 'Например: «триллер про космос 90-х»', onSelect: () => Companion.ask() },
                    { section: '🔄 ДЕЙСТВИЯ' },
                    { label: '🔄 Обновить ВСЕ капсулы', onSelect: View.refreshAllCapsules },
                    { label: '🎬 Похожее на последний фильм', onSelect: () => Companion.similar() },
                    { label: '🏠 Вернуть мою капсулу', onSelect: () => { View.loading('СОБИРАЮ КАПСУЛУ'); View.boot(false); } },
                    { label: 'ℹ️ Подробнее об этом фильме', onSelect: () => View.details(View.list[View.idx]) },
                    { label: '❓ Почему это в капсуле?', onSelect: () => Companion.why(View.list[View.idx]) },
                    { section: '⚙️ НАСТРОЙКИ' },
                    { label: `🎨 Сменить тему: ${THEMES[Themes.current()].name}`, onSelect: () => Companion.themes() },
                    { label: '💡 Что я знаю о твоих вкусах', onSelect: () => Settings.diagnose() },
                    Settings.registeredInLampa
                        ? { label: '⚙️ Открыть настройки Lampa', onSelect: () => Settings.openLampaMenu() }
                        : { label: '🔑 Свой ключ TMDb', hint: pGet('tmdb_key', '') ? 'задан' : 'встроенный', onSelect: () => Settings.askKey() },
                    { label: '🗑️ Сбросить историю просмотров', onSelect: () => { Capsule.forget(); notify('История сброшена!'); } },
                    { label: '🚫 Закрыть' }
                ].filter(Boolean)
            });
        },

        themes: () => {
            const items = THEME_ORDER.map(key => {
                const t = THEMES[key];
                return {
                    label: (Themes.current() === key ? '● ' : '○ ') + t.name,
                    onSelect: () => { Themes.set(key); notify(`Тема: ${t.name}`); View.render(); }
                };
            });
            items.push({ label: 'Назад', onSelect: () => Companion.open() });
            Modal.open({ title: 'Оформление', items });
        },

        ask: () => askText('Что ищем?', '', (v) => Companion.find(v, v, 'search')),

        find: (query, label, kind) => {
            if (!query) return;
            View.loading(`ИЩУ: ${query.toUpperCase()}`);
            Search.run(query, View.taste, (list, ctx) => View.showFound(label || query, list, ctx, kind || 'search', query));
        },

        similar: () => {
            const t = View.taste;
            if (!t?.seeds?.length) { notify('История пуста'); return; }
            const seed = t.seeds[0];
            View.loading('ПОДБИРАЮ ПОХОЖЕЕ');
            const shown = Capsule.shown();
            Net.get(`/${seed.type}/${seed.id}/similar`, { page: 1 }, (d) => {
                let list = markList(d?.results, seed.type, 'seed', { seed: seed.title });
                list = list.filter(it => !t.watched?.[it.id] && !shown.includes(it.id) && it.vote_average >= 6.6);
                if (!list.length) { notify('Похожего не нашлось'); View.render(); return; }
                const ids = list.map(it => it.id);
                Capsule.remember(ids);
                View.list = list.slice(0, CAPSULE_SIZE);
                View.idx = 0;
                View.source = 'search';
                View.sourceLabel = 'ПОХОЖЕЕ';
                View.activeQuery = { kind: 'similar', label: 'ПОХОЖЕЕ' };
                View.render();
            }, () => { notify('Не получилось'); View.render(); });
        },

        why: (m) => {
            if (!m) return;
            const t = View.taste || {};
            let html = `<b>${esc(m.title || m.name || '')}</b><br>${esc(Capsule.reason(m, t))}<br><br>`;
            if (t.count) {
                html += `Что я прочитал из истории: <b>${t.count}</b> карточек`;
                if (t.known) html += `, из них разобрано подробно — <b>${t.known}</b>`;
                html += '.<br>';
                const gs = (t.genres || []).filter(g => g.name).map(g => g.name);
                if (gs.length) html += `Твои жанры: <b>${esc(gs.join(', '))}</b>.<br>`;
                const ks = (t.keywords || []).slice(0, 4).map(k => k.name);
                if (ks.length) html += `Повторяющиеся темы: <b>${esc(ks.join(', '))}</b>.`;
            } else {
                html += 'Историю Lampa я пока не вижу — подборка идёт по общим высоким оценкам. Посмотри пару фильмов, и капсула станет личной.';
            }
            Modal.open({ title: 'Почему это здесь', text: html, items: [{ label: 'Понятно' }] });
        }
    };

    // === 17. НАСТРОЙКИ ===
    const Settings = {
        registeredInLampa: false,
        sanitizeLegacy: () => {
            try {
                if (!(window.Lampa?.Storage)) return;
                const cur = Lampa.Storage.get('cm_theme_select', null);
                if (cur !== null && !THEME_ORDER.includes(cur) && Lampa.Storage.set) {
                    Lampa.Storage.set('cm_theme_select', THEME_ORDER[0]);
                }
            } catch (e) {}
        },
        tryRegister: () => {
            if (Settings.registeredInLampa) return;
            try {
                if (!(window.Lampa?.SettingsApi?.addComponent)) return;
                Settings.sanitizeLegacy();
                Lampa.SettingsApi.addComponent({
                    component: 'capsule_mod',
                    name: 'Капсула',
                    icon: I_CAPSULE
                });
                Lampa.SettingsApi.addParam({
                    component: 'capsule_mod',
                    param: { name: 'cm_theme_btn', type: 'button', default: false },
                    field: { name: 'Тема оформления', description: THEMES[Themes.current()].name },
                    onChange: () => Companion.themes()
                });
                Lampa.SettingsApi.addParam({
                    component: 'capsule_mod',
                    param: { name: 'cm_glow_toggle', type: 'trigger', default: true },
                    field: { name: 'Свет от постера' },
                    onChange: (v) => pSet('glow', !!v.cm_glow_toggle)
                });
                Lampa.SettingsApi.addParam({
                    component: 'capsule_mod',
                    param: { name: 'cm_tmdb_key_input', type: 'input', default: '' },
                    field: { name: 'Свой ключ TMDb', description: 'оставь пустым для встроенного' },
                    onChange: (v) => { pSet('tmdb_key', (v.cm_tmdb_key_input || '').trim()); Net.drop(); }
                });
                Settings.registeredInLampa = true;
            } catch (e) {
                Settings.registeredInLampa = false;
            }
        },
        openLampaMenu: () => {
            try {
                if (window.Lampa?.Activity) {
                    Lampa.Activity.push({ url: '', title: 'Настройки', component: 'settings', page: 'capsule_mod' });
                    return;
                }
            } catch (e) {}
            notify('Системное меню недоступно');
        },
        askKey: () => askText('Ключ TMDb', pGet('tmdb_key', ''), (v) => {
            pSet('tmdb_key', v.trim());
            Net.drop();
            notify('Ключ сохранён');
        }),
        rebuildTaste: () => {
            pSet(DCACHE_KEY, {});
            Taste.cache = null;
            Net.drop();
            View.loading('ПЕРЕСОБИРАЮ ВКУС');
            View.boot(true);
        },
        diagnose: () => {
            History.stats((st) => {
                const t = View.taste || {};
                let html = `Найдено в истории Lampa: <b>${st.total}</b> карточек `;
                html += `(с полными данными — <b>${st.withCards}</b>, записей таймлайна — <b>${st.timeline}</b>).<br><br>`;
                if (!st.total) {
                    html += 'Пусто. Обычно это значит, что фильмы ещё не открывались в этом профиле, либо активен другой профиль Lampa. Открой пару карточек или добавь в избранное — и вернись сюда.';
                } else {
                    const gs = (t.genres || []).map(g => `${g.name} (${g.score.toFixed(1)})`);
                    if (gs.length) html += `Жанры по весу: <b>${esc(gs.join(', '))}</b>.<br>`;
                    const ks = (t.keywords || []).map(k => k.name);
                    if (ks.length) html += `Темы: <b>${esc(ks.join(', '))}</b>.<br>`;
                    if (t.era) html += `Тяготеешь к кино около <b>${t.era}</b> года.<br>`;
                    if (t.avgVote) html += `Средняя оценка того, что смотришь: <b>${t.avgVote.toFixed(1)}</b>.`;
                }
                Modal.open({ title: 'Что я знаю', text: html, items: [{ label: 'Закрыть' }] });
            });
        }
    };

    // === 18. ДЕЙСТВИЯ LAMPA ===
    const play = (m) => {
        try {
            if (window.Lampa?.Activity) {
                Lampa.Activity.push({
                    url: '',
                    component: 'full',
                    id: m.id,
                    method: m.media_type === 'tv' ? 'tv' : 'movie',
                    card: m,
                    source: 'tmdb'
                });
                return;
            }
        } catch (e) {}
        notify('Lampa не отвечает');
    };

    const exitApp = () => {
        try { if (window.Lampa?.Activity) Lampa.Activity.backward(); } catch (e) {}
    };

    // === 19. УПРАВЛЕНИЕ КЛАВИШАМИ ===
    const KEYS = { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 32: 'enter', 8: 'back', 27: 'back', 461: 'back', 10009: 'back' };

    const route = (kind) => {
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
        Nav.move(kind);
    };

    const keyFallback = (e) => {
        if (!App.active) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        const kind = KEYS[e.keyCode];
        if (!kind) return;
        e.preventDefault();
        e.stopPropagation();
        route(kind);
    };

    // === 20. КОМПОНЕНТ LAMPA ===
    const App = { active: false, fallback: false };

    const CapsuleComponent = function() {
        let node = null, wrapped = null;
        this.create = () => {
            node = View.create();
            wrapped = window.$ ? window.$(node) : node;
            return this.render();
        };
        this.render = () => wrapped;
        this.start = () => {
            App.active = true;
            if (App._enteredBefore && (Date.now() - (View._lastBuiltAt || 0) > 4000)) {
                View.refreshAllCapsules();
            }
            App._enteredBefore = true;
            let ok = false;
            try { ok = !!(window.Lampa?.Controller?.add); } catch (e) {}
            if (ok) {
                Lampa.Controller.add(CTRL_ID, {
                    toggle: () => { try { Lampa.Controller.clear(); } catch (e) {} Nav.paint(true); },
                    up: () => route('up'),
                    down: () => route('down'),
                    left: () => route('left'),
                    right: () => route('right'),
                    enter: () => route('enter'),
                    back: () => route('back')
                });
                Lampa.Controller.toggle(CTRL_ID);
            } else {
                App.fallback = true;
                document.addEventListener('keydown', keyFallback, true);
            }
        };
        this.pause = () => { App.active = false; };
        this.resume = () => { App.active = true; };
        this.stop = () => { App.active = false; };
        this.destroy = () => {
            App.active = false;
            if (App.fallback) document.removeEventListener('keydown', keyFallback, true);
            while (Modal.active()) Modal.close();
            const rain = node?.querySelector?.('.cm-rain');
            if (rain?._cmTimer) clearInterval(rain._cmTimer);
            if (node?.parentNode) node.parentNode.removeChild(node);
            node = null;
            wrapped = null;
            Nav.reset();
        };
    };

    // === 21. ПУНКТ МЕНЮ ===
    const addMenu = () => {
        let done = false;
        const tryAdd = () => {
            if (done) return;
            try {
                if (document.querySelector('[data-action="capsule_mod_entry"]')) { done = true; return; }
                const $ = window.jQuery || window.$;
                if (!$) return;
                const list = $('.menu .menu__list').eq(0);
                if (!list.length) return;
                const item = $('<li class="menu__item selector" data-action="capsule_mod_entry"><div class="menu__ico">' + I_CAPSULE + '</div><div class="menu__text">Капсула</div></li>');
                item.on('hover:enter click', () => {
                    try { Lampa.Activity.push({ url: '', title: 'Капсула', component: COMPONENT_ID, page: 1 }); } catch (e) {}
                });
                list.append(item);
                done = true;
            } catch (e) {}
        };
        if (window.appready) tryAdd();
        try { if (window.Lampa?.Listener) Lampa.Listener.follow('app', (e) => { if (e.type === 'ready') tryAdd(); }); } catch (e) {}
        setTimeout(tryAdd, 1500);
        setTimeout(tryAdd, 4000);
    };

    // === 22. СТАРТ ===
    (() => {
        try {
            if (window.Lampa?.Component?.add) window.Lampa.Component.add(COMPONENT_ID, CapsuleComponent);
            addMenu();
            onLampaReady(() => { Settings.tryRegister(); });
            console.log('[Капсула] v12.0 загружена');
        } catch (e) {
            console.error('[Капсула] ошибка старта:', e);
        }
    })();
})();
