/**
 * Capsule Mod v17.1 — «Капсула»
 *
 * 1. Интерфейс карточки и нижняя панель.
 * 2. Онбординг-тест.
 * 3. Увеличенный пул рекомендаций до 100 фильмов (многостраничный парсинг TMDB).
 * 4. Исправлены баги лимитов, фокуса и жестких отсечек в подборе.
 */
(function () {
    'use strict';
    if (window.plugin_capsule_mod_ready) return;
    window.plugin_capsule_mod_ready = true;

    const COMPONENT_ID = 'capsule_mod_view';
    const CTRL_ID = 'capsule_mod_ctrl';
    const TMDB = 'https://api.themoviedb.org/3';
    const IMG = 'https://image.tmdb.org/t/p/';
    const FALLBACK_KEY = '4ef0d7355d9ffb5151e987764708ce96';
    const LANG = 'ru-RU';
    const CAPSULE_SIZE = 100; // Увеличено с 6 до 100
    const EXPERIMENT_KEY = 'space_experiment';
    const EXPERIMENT_STORAGE = 'cm_' + EXPERIMENT_KEY;

    // === УТИЛИТЫ ===
    const el = (tag, cls, html) => { const d = document.createElement(tag || 'div'); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
    const hasClass = (n, c) => !!n && (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1;
    const addClass = (n, c) => { if (n && !hasClass(n, c)) n.className += (n.className ? ' ' : '') + c; };
    const removeClass = (n, c) => { if (!n) return; n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/\s+/g, ' ').trim(); };
    const closestClass = (n, cls) => { while (n && n !== document) { if (n.className && hasClass(n, cls)) return n; n = n.parentNode; } return null; };
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const isArr = (v) => Array.isArray(v);
    const pad2 = (n) => (n < 10 ? '0' : '') + n;
    const rnd = (n) => Math.floor(Math.random() * n);
    const raf = window.requestAnimationFrame || (f => setTimeout(f, 16));
    const vibrate = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
    const fmtRuntime = (min) => min ? Math.floor(min / 60) + ' ч ' + (min % 60) + ' мин' : '';

    const animScroll = (node, prop, to, ms = 240) => {
        if (!node) return;
        const from = node[prop], dist = to - from;
        if (Math.abs(dist) < 2) { node[prop] = to; return; }
        const start = Date.now(), token = {};
        node._cmAnim = token;
        const step = () => {
            if (node._cmAnim !== token) return;
            const p = clamp((Date.now() - start) / ms, 0, 1);
            node[prop] = from + dist * (1 - Math.pow(1 - p, 3));
            if (p < 1) raf(step); else node._cmAnim = null;
        };
        raf(step);
    };

    // === LAMPA READY + ХРАНИЛИЩЕ ===
    const LampaReady = { ready: false, waiters: [] };
    const onLampaReady = (cb) => { if (LampaReady.ready) { cb(); return; } LampaReady.waiters.push(cb); };
    const flushReady = () => { LampaReady.ready = true; LampaReady.waiters.forEach(cb => { try { cb(); } catch (e) { console.error(e); } }); LampaReady.waiters = []; };
    try { if (window.Lampa?.Listener?.follow) Lampa.Listener.follow('app', (e) => { if (e?.type === 'ready') flushReady(); }); } catch (e) { console.error(e); }
    setTimeout(flushReady, 2500);

    const pGet = (key, def) => { try { return JSON.parse(localStorage.getItem('cm_' + key)) ?? def; } catch (e) { return def; } };
    const pSet = (key, val) => { try { localStorage.setItem('cm_' + key, JSON.stringify(val)); } catch (e) {} };
    const lampaGetRaw = (key, def) => { try { return window.Lampa.Storage.get(key, def); } catch (e) { return def; } };
    const isEmptyish = (v) => v == null || (isArr(v) ? v.length === 0 : Object.keys(v).length === 0);
    const ownedGet = (key, def, cb, attempt = 0) => {
        onLampaReady(() => {
            if (!window.Lampa?.Storage?.get) { cb(def); return; }
            const value = lampaGetRaw(key, def);
            if (!isEmptyish(value) || attempt >= 6) { cb(value); return; }
            setTimeout(() => ownedGet(key, def, cb, attempt + 1), 350);
        });
    };

    // === СЕТЬ ===
    const Net = {
        mem: {},
        key: () => pGet('tmdb_key', '') || FALLBACK_KEY,
        url: (path, params) => {
            let u = `${TMDB}${path}?api_key=${Net.key()}&language=${LANG}`;
            if (params) for (const k in params) if (params[k] != null && params[k] !== '') u += `&${k}=${encodeURIComponent(params[k])}`;
            return u;
        },
        get: (path, params, ok, fail, opts = {}) => {
            const url = Net.url(path, params);
            if (!opts.force && Net.mem[url] && Date.now() - Net.mem[url].t < (opts.ttl || 900000)) return setTimeout(() => ok(Net.mem[url].d), 0);
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 12000;
            let settled = false;
            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4 || settled) return;
                settled = true;
                if (xhr.status >= 200 && xhr.status < 400) {
                    try { const d = JSON.parse(xhr.responseText); Net.mem[url] = { t: Date.now(), d }; ok(d); } catch (e) { if (fail) fail('parse'); }
                } else if (fail) fail('http_' + xhr.status);
            };
            xhr.onerror = () => { if (!settled && fail) fail('net'); };
            xhr.ontimeout = () => { if (!settled && fail) fail('timeout'); };
            xhr.send();
        },
        drop: () => { Net.mem = {}; }
    };
    const parallel = (tasks, done) => {
        let left = tasks.length;
        const out = new Array(left);
        if (!left) return done(out);
        tasks.forEach((task, idx) => task((r) => { out[idx] = r; if (--left === 0) done(out); }));
    };

    // === СЛОВАРИ ===
    const GENRE_NAMES = {
        28: 'Боевик', 12: 'Приключения', 16: 'Анимация', 35: 'Комедия', 80: 'Криминал',
        99: 'Документальное', 18: 'Драма', 10751: 'Семейное', 14: 'Фэнтези', 36: 'История',
        27: 'Ужасы', 10402: 'Музыка', 9648: 'Детектив', 10749: 'Мелодрама', 878: 'Фантастика',
        53: 'Триллер', 10752: 'Война', 37: 'Вестерн', 10759: 'Боевик', 10765: 'Фантастика',
        10768: 'Война', 10762: 'Детское', 10766: 'Драма', 10767: 'Шоу'
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
        { m: [10751], t: [10762, 10751], w: ['детск', 'детское', 'детям', 'ребен', 'kids', 'kid'] },
        { m: [10751], t: [10751], w: ['семейн', 'family', 'с ребенком'] },
        { m: [14], t: [10765], w: ['фэнтези', 'фентези', 'магия', 'волшебн', 'сказк', 'fantasy'] },
        { m: [27], t: [10765], w: ['ужас', 'ужасы', 'страшн', 'хоррор', 'жутк', 'кошмар', 'horror'] },
        { m: [9648], t: [9648], w: ['детектив', 'загадк', 'расследован', 'тайн', 'нуар', 'noir', 'mystery'] },
        { m: [10749], t: [18], w: ['мелодрам', 'романтик', 'романт', 'любов', 'romance'] },
        { m: [878], t: [10765], w: ['фантастик', 'sci-fi', 'scifi', 'киберпанк', 'инопланет'] },
        { m: [53], t: [9648], w: ['триллер', 'напряж', 'саспенс', 'thriller'] },
        { m: [37], t: [37], w: ['вестерн', 'ковбо', 'western'] },
        { m: [10752], t: [10768], w: ['военн', 'война', 'фронт', 'war'] },
        { m: [10402], t: [10402], w: ['мюзикл', 'музыкальн', 'music'] },
        { m: [36], t: [18], w: ['историч', 'средневеков', 'history', 'классик'] }
    ];
    const TAG_SYN = [
        { w: ['космос', 'космич', 'space'], k: 'space' }, { w: ['зомби', 'zombie'], k: 'zombie' }, { w: ['вампир', 'vampire'], k: 'vampire' },
        { w: ['супергеро', 'марвел', 'superhero'], k: 'superhero' }, { w: ['апокалипс', 'постапок'], k: 'post-apocalyptic future' },
        { w: ['выживан', 'survival'], k: 'survival' }, { w: ['маньяк', 'серийн убийц'], k: 'serial killer' }, { w: ['во времени', 'time travel'], k: 'time travel' },
        { w: ['ограблен', 'heist'], k: 'heist' }, { w: ['шпион', 'агент', 'spy'], k: 'spy' }, { w: ['самура', 'samurai'], k: 'samurai' },
        { w: ['пират', 'pirate'], k: 'pirate' }, { w: ['дракон', 'dragon'], k: 'dragon' }, { w: ['робот', 'robot'], k: 'robot' },
        { w: ['нейросет', 'искусственн интеллект'], k: 'artificial intelligence' }, { w: ['аниме', 'anime'], k: 'anime' },
        { w: ['спорт', 'sport'], k: 'sport' }, { w: ['гонк', 'racing'], k: 'car race' }, { w: ['подводн', 'submarine'], k: 'submarine' },
        { w: ['динозавр', 'dinosaur'], k: 'dinosaur' }, { w: ['школ', 'high school'], k: 'high school' }, { w: ['тюрьм', 'prison'], k: 'prison' },
        { w: ['катастроф', 'disaster'], k: 'disaster' }, { w: ['по реальным', 'реальн событ'], k: 'based on true story' },
        { w: ['по книге', 'по роману'], k: 'based on novel' }, { w: ['нуар', 'noir'], k: 'film noir' }, { w: ['монстр', 'monster'], k: 'monster' },
        { w: ['рождеств', 'новогодн'], k: 'christmas' },
        { w: ['ужас', 'ужасы', 'хоррор', 'страшн'], k: 'horror' },
        { w: ['детск', 'детское', 'детям', 'ребен'], k: 'kids' }
    ];
    const STOP_WORDS = ['фильм', 'фильмы', 'кино', 'сериал', 'сериалы', 'смотреть', 'найди', 'найти', 'хочу', 'что-то', 'что', 'нибудь', 'посоветуй', 'подбери', 'самые', 'самый', 'какой', 'какие', 'типа', 'вроде', 'про', 'для', 'или', 'the', 'and'];
    const MOODS = [
        { label: '🎬 Отключить голову', q: 'лёгкая комедия приключения' }, { label: '😱 Держать в напряжении', q: 'напряжённый триллер детектив' },
        { label: '🧠 Подумать', q: 'умная драма философский' }, { label: '🚀 Улететь подальше', q: 'космическая фантастика фэнтези' },
        { label: '👻 Испугаться', q: 'ужасы хоррор' }, { label: '😢 Заплакать', q: 'сильная драма по реальным событиям' },
        { label: '💑 Вдвоём', q: 'мелодрама романтика' }, { label: '👨‍👧 С детьми', q: 'семейное мультфильм анимация' },
        { label: '⚔️ Боевики', q: 'боевик экшен' }, { label: '🕵️ Детективы', q: 'детектив расследование нуар' }
    ];
    const ONB_GENRES = [28, 12, 16, 35, 80, 18, 10751, 14, 27, 9648, 10749, 878, 53, 37, 99];
    const DECADES = [{ y: 0, l: '🎲 Любое' }, { y: 1975, l: '70-е' }, { y: 1985, l: '80-е' }, { y: 1995, l: '90-е' }, { y: 2005, l: '2000-е' }, { y: 2015, l: '2010-е' }, { y: 2023, l: '2020-е' }];

    // === ИСТОРИЯ ===
    const WEIGHTS = { history: 3.0, viewed: 3.0, look: 2.6, continued: 3.2, like: 2.8, wath: 1.8, book: 1.2, scheduled: 1.0, card: 1.0, thrown: -2.0 };
    const History = {
        read: (cb) => {
            const cards = {}, acc = {}, order = [];
            const addCard = (c) => { if (c?.id && !cards[c.id]) cards[c.id] = c; };
            const bump = (id, weight, type, card) => {
                if (!id) return;
                id = parseInt(id, 10);
                if (!id) return;
                if (!acc[id]) { acc[id] = { id, w: 0, type: type || null, card: card || null }; order.push(id); }
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
                const favHadKeys = {};
                if (fav && typeof fav === 'object') {
                    if (isArr(fav.card)) fav.card.forEach(addCard);
                    for (const k in fav) {
                        const list = fav[k];
                        if (!isArr(list) || !list.length) continue;
                        favHadKeys[k] = true;
                        const w = WEIGHTS[k] ?? 1;
                        list.forEach((entry, i) => {
                            const recency = 1 + clamp((list.length - i) / Math.max(list.length, 1), 0, 1) * 0.6;
                            if (entry && typeof entry === 'object') { addCard(entry); bump(entry.id, w * recency, typeOf(entry), entry); }
                            else bump(entry, w * recency, null, cards[entry] || null);
                        });
                    }
                }
                const extra = ['history', 'view', 'viewed', 'card_history', 'recomends_last', 'wath', 'look', 'like', 'book', 'scheduled', 'continued', 'thrown'].filter(k => !favHadKeys[k]);
                let left = extra.length;
                if (!left) return withTimeline();
                extra.forEach(key => {
                    ownedGet(key, null, (list2) => {
                        if (isArr(list2)) list2.forEach(it => {
                            if (it && typeof it === 'object') { addCard(it); bump(it.id, WEIGHTS[key] || 1.6, typeOf(it), it); }
                            else bump(it, WEIGHTS[key] || 1.6, null, null);
                        });
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
                });
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
                ownedGet('timeline', {}, (timeline) => cb({ total: items.length, withCards, timeline: timeline ? Object.keys(timeline).length : 0, items }));
            });
        }
    };

    // === ОНБОРДИНГ (тест вкусов) ===
    const Onboard = {
        active: false, step: 0, moviesList: [],
        data: null,
        profile: () => pGet('onboard', null),
        save: (p) => pSet('onboard', p),
        clear: () => pSet('onboard', null),
        toTaste: (prof, stats) => ({
            empty: false, onboard: true,
            count: (prof.seeds?.length || 0) + Object.keys(prof.g || {}).length,
            known: 0,
            genres: Object.entries(prof.g || {}).map(([id, score]) => ({ id: parseInt(id, 10), score, name: GENRE_NAMES[id] || '' })).sort((a, b) => b.score - a.score),
            keywords: [], era: prof.era || 0, avgVote: 6.9,
            seeds: prof.seeds || [], watched: {},
            stats: stats || { total: 0, withCards: 0, timeline: 0, items: [] }
        }),
        start: () => {
            Onboard.active = true;
            Onboard.step = 0;
            Onboard.data = { movies: [], genres: [], decade: 0, mood: null };
            View.loading('ТЕСТ ПРЕДПОЧТЕНИЙ');
            Net.get('/trending/all/week', { page: 1 }, (d) => {
                Onboard.moviesList = markList(d?.results, null, 'onb').slice(0, 12);
                Onboard.renderStep();
            }, () => { Onboard.moviesList = []; Onboard.renderStep(); });
        },
        back: () => {
            if (Onboard.step > 0) { Onboard.step--; Onboard.renderStep(); return; }
            Onboard.active = false;
            View.boot(false);
        },
        next: () => { Onboard.step = Math.min(3, Onboard.step + 1); Onboard.renderStep(); },
        finish: () => {
            const d = Onboard.data, g = {};
            d.movies.forEach(m => (m.genre_ids || []).forEach(id => { const gid = TV2MOVIE[id] || id; g[gid] = (g[gid] || 0) + 3; }));
            d.genres.forEach(id => { const gid = TV2MOVIE[id] || id; g[gid] = (g[gid] || 0) + 2.5; });
            if (d.mood) parseQuery(d.mood.q).genresM.forEach(id => { g[id] = (g[id] || 0) + 1.5; });
            Onboard.save({
                g, era: d.decade, mood: d.mood ? d.mood.label : null,
                seeds: d.movies.slice(0, 5).map(m => ({ id: m.id, type: m.media_type === 'tv' ? 'tv' : 'movie', title: m.title || m.name }))
            });
            Onboard.active = false;
            vibrate(30);
            notify('✅ Предпочтения сохранены');
            View.refreshCapsule();
        },
        renderStep: () => {
            View.stage.innerHTML = '';
            Nav.reset();
            const wrap = el('div', 'cm-onb');
            const s = Onboard.step, d = Onboard.data;
            wrap.appendChild(el('div', 'cm-onb-head cm-mono', `ШАГ ${s + 1} / 4`));
            let firstRow = -1;

            if (s === 0) {
                wrap.appendChild(el('div', 'cm-onb-title', '🎬 Что вы смотрели или слышали?'));
                wrap.appendChild(el('div', 'cm-onb-sub', 'Отметьте карточки, которые знаете или любите — они станут основой рекомендаций.'));
                const grid = el('div', 'cm-onb-grid');
                const cards = Onboard.moviesList.map(m => {
                    const c = el('div', 'cm-onb-card' + (d.movies.some(x => x.id === m.id) ? ' sel' : ''));
                    if (m.poster_path) { const im = el('img'); im.loading = 'lazy'; im.decoding = 'async'; im.src = IMG + 'w342' + m.poster_path; c.appendChild(im); }
                    c.appendChild(el('div', 't', esc(m.title || m.name || '')));
                    c._cmAction = () => {
                        const i = d.movies.findIndex(x => x.id === m.id);
                        if (i >= 0) { d.movies.splice(i, 1); removeClass(c, 'sel'); } else { d.movies.push(m); addClass(c, 'sel'); }
                        vibrate(10);
                    };
                    return c;
                });
                grid.append(...cards);
                wrap.appendChild(grid);
                if (cards.length) firstRow = Nav.addRow(cards, 'cards');
            }
            if (s === 1) {
                wrap.appendChild(el('div', 'cm-onb-title', '🎭 Какие жанры нравятся?'));
                wrap.appendChild(el('div', 'cm-onb-sub', 'Выберите несколько — чем больше, тем точнее подбор.'));
                const chips = el('div', 'cm-chips cm-onb-chips');
                const nodes = ONB_GENRES.map(gid => {
                    const c = el('div', 'cm-chip' + (d.genres.includes(gid) ? ' sel' : ''), esc(GENRE_NAMES[gid] || ''));
                    c._cmAction = () => {
                        const i = d.genres.indexOf(gid);
                        if (i >= 0) { d.genres.splice(i, 1); removeClass(c, 'sel'); } else { d.genres.push(gid); addClass(c, 'sel'); }
                        vibrate(10);
                    };
                    return c;
                });
                chips.append(...nodes);
                wrap.appendChild(chips);
                firstRow = Nav.addRow(nodes, 'chips');
            }
            if (s === 2) {
                wrap.appendChild(el('div', 'cm-onb-title', '📅 Какая эпоха ближе?'));
                wrap.appendChild(el('div', 'cm-onb-sub', 'Необязательно — можно пропустить.'));
                const chips = el('div', 'cm-chips cm-onb-chips');
                const nodes = DECADES.map(dc => {
                    const c = el('div', 'cm-chip' + (d.decade === dc.y ? ' sel' : ''), esc(dc.l));
                    c._cmAction = () => {
                        d.decade = dc.y;
                        nodes.forEach(n => removeClass(n, 'sel'));
                        addClass(c, 'sel');
                        vibrate(10);
                    };
                    return c;
                });
                chips.append(...nodes);
                wrap.appendChild(chips);
                firstRow = Nav.addRow(nodes, 'chips');
            }
            if (s === 3) {
                wrap.appendChild(el('div', 'cm-onb-title', ' Настроения на первый вечер?'));
                wrap.appendChild(el('div', 'cm-onb-sub', 'Подберём стартовый набор под него.'));
                const chips = el('div', 'cm-chips cm-onb-chips');
                const nodes = MOODS.map(md => {
                    const c = el('div', 'cm-chip' + (d.mood === md ? ' sel' : ''), esc(md.label));
                    c._cmAction = () => {
                        d.mood = (d.mood === md) ? null : md;
                        nodes.forEach(n => removeClass(n, 'sel'));
                        if (d.mood) addClass(c, 'sel');
                        vibrate(10);
                    };
                    return c;
                });
                chips.append(...nodes);
                wrap.appendChild(chips);
                firstRow = Nav.addRow(nodes, 'chips');
            }

            const foot = [];
            const mkBtn = (label, primary, action) => {
                const b = el('div', 'cm-act' + (primary ? ' primary' : ''), esc(label));
                b._cmAction = action;
                foot.push(b);
                return b;
            };
            if (s > 0) mkBtn('↩ Назад', false, () => Onboard.back());
            mkBtn('Пропустить', false, () => (s === 3 ? Onboard.finish() : Onboard.next()));
            if (s < 3) mkBtn('Далее →', true, () => Onboard.next());
            else mkBtn('✨ Готово', true, () => Onboard.finish());
            const footRow = el('div', 'cm-onb-foot');
            foot.forEach(b => footRow.appendChild(b));
            wrap.appendChild(footRow);
            View.stage.appendChild(wrap);
            
            // Исправлен баг с потерей фокуса (firstRow мог быть -1, а не null)
            const footIdx = Nav.addRow(foot, 'foot');
            Nav.setFocus(firstRow >= 0 ? firstRow : footIdx, 0, true);
        }
    };

    // === МОДЕЛЬ ВКУСА ===
    const Taste = {
        cache: null,
        loadCache: () => { Taste.cache = Taste.cache || pGet('dcache', {}) || {}; return Taste.cache; },
        saveCache: () => {
            const c = Taste.cache || {}, keys = Object.keys(c);
            if (keys.length > 240) {
                const trimmed = {};
                for (let i = keys.length - 240; i < keys.length; i++) trimmed[keys[i]] = c[keys[i]];
                Taste.cache = trimmed;
            }
            pSet('dcache', Taste.cache);
        },
        enrich: (items, limit, cb) => {
            const cache = Taste.loadCache(), need = [];
            for (let i = 0; i < Math.min(items.length, limit); i++) {
                const it = items[i], ck = (it.type || 'x') + '_' + it.id;
                if (cache[ck]) continue;
                if (it.card?.genre_ids?.length) {
                    cache[ck] = { g: it.card.genre_ids.slice(0, 5), k: [], v: it.card.vote_average || 0, y: parseInt(String(it.card.release_date || it.card.first_air_date || '').slice(0, 4), 10) || 0, n: it.card.title || it.card.name || '', t: it.type || 'movie' };
                    continue;
                }
                need.push(it);
            }
            if (!need.length) { Taste.saveCache(); return cb(cache); }
            const tasks = need.map(it => (done) => {
                const order = it.type === 'tv' ? ['tv', 'movie'] : ['movie', 'tv'];
                let n = 0;
                const attempt = () => {
                    if (n >= order.length) return done(false);
                    const type = order[n++];
                    Net.get(`/${type}/${it.id}`, { append_to_response: 'keywords' }, (d) => {
                        if (!d?.id) return attempt();
                        const kws = (d.keywords?.keywords || d.keywords?.results) || [];
                        cache[(it.type || type) + '_' + it.id] = { g: (d.genres || []).slice(0, 5).map(g => g.id), k: kws.slice(0, 8).map(k => [k.id, k.name]), v: d.vote_average || 0, y: parseInt(String(d.release_date || d.first_air_date || '').slice(0, 4), 10) || 0, n: d.title || d.name || '', t: type };
                        it.type = type;
                        done(true);
                    }, attempt, { ttl: 604800000 });
                };
                attempt();
            });
            parallel(tasks, () => { Taste.saveCache(); cb(cache); });
        },
        build: (cb) => {
            History.stats((stats) => {
                const items = stats.items;
                if (!items.length) {
                    const prof = Onboard.profile();
                    if (prof) return cb(Onboard.toTaste(prof, stats));
                    return cb({ empty: true, count: 0, genres: [], keywords: [], seeds: [], watched: {}, stats });
                }
                Taste.enrich(items, 14, (cache) => {
                    const gScore = {}, kScore = {}, kName = {}, years = [], votes = [], watched = {}, seeds = [];
                    items.forEach(it => {
                        watched[it.id] = true;
                        const d = cache[(it.type || 'movie') + '_' + it.id] || cache['movie_' + it.id] || cache['tv_' + it.id];
                        if (!d) return;
                        (d.g || []).forEach(gid => { gScore[TV2MOVIE[gid] || gid] = (gScore[TV2MOVIE[gid] || gid] || 0) + it.w; });
                        (d.k || []).forEach(([kid, name]) => { kScore[kid] = (kScore[kid] || 0) + it.w * 0.8; kName[kid] = name; });
                        if (d.y) years.push(d.y);
                        if (d.v) votes.push(d.v);
                        if (seeds.length < 5 && it.w > 0) seeds.push({ id: it.id, type: d.t || it.type || 'movie', title: d.n });
                    });
                    years.sort((a, b) => a - b);
                    cb({
                        empty: false, count: items.length, known: years.length, era: years.length ? years[Math.floor(years.length / 2)] : 0, avgVote: votes.length ? votes.reduce((a, b) => a + b, 0) / votes.length : 0, seeds, watched, stats,
                        genres: Object.entries(gScore).map(([id, score]) => ({ id: parseInt(id, 10), score, name: GENRE_NAMES[id] || '' })).sort((a, b) => b.score - a.score),
                        keywords: Object.entries(kScore).filter(([k, s]) => s > 1.5).map(([id, score]) => ({ id: parseInt(id, 10), score, name: kName[id] })).sort((a, b) => b.score - a.score)
                    });
                });
            });
        }
    };

    // === КАПСУЛА ===
    const markList = (list, type, src, via) => {
        if (!list) return [];
        return list.filter(it => {
            if (!it || !it.poster_path || it.adult) return false;
            it.media_type = it.media_type || type || (it.name && !it.title ? 'tv' : 'movie');
            if (it.media_type !== 'movie' && it.media_type !== 'tv') return false;
            it._src = src; it._via = via || null;
            return true;
        });
    };
    const Capsule = {
        shown: () => { const v = pGet('shown', []); return isArr(v) ? v : []; },
        // Увеличен буфер истории, чтобы 100 фильмов не перетирали друг друга
        remember: (ids) => { let s = Capsule.shown().concat(ids); if (s.length > 400) s = s.slice(s.length - 400); pSet('shown', s); },
        forget: () => pSet('shown', []),
        build: (taste, opts, cb) => {
            const force = !!opts?.force, tasks = [], topG = taste.genres || [], topK = taste.keywords || [];
            // Многостраничный парсинг (до 5 страниц TMDB), чтобы физически набрать 100+ уникальных карточек
            (taste.seeds || []).slice(0, 3).forEach(seed => {
                for (let p = 1; p <= 2; p++) {
                    tasks.push(done => Net.get(`/${seed.type}/${seed.id}/recommendations`, { page: p }, (d) => done(markList(d?.results, seed.type, 'seed', { seed: seed.title })), () => done([]), { force }));
                }
            });
            if (topG.length) {
                for (let p = 1; p <= 4; p++) {
                    tasks.push(done => Net.get('/discover/movie', { with_genres: topG.slice(0, 2).map(g => g.id).join(','), sort_by: 'popularity.desc', page: p, 'vote_count.gte': 200, 'vote_average.gte': clamp(taste.avgVote ? taste.avgVote - 0.4 : 6.4, 6.0, 7.4), include_adult: false }, (d) => done(markList(d?.results, 'movie', 'genre')), () => done([]), { force }));
                }
            }
            if (topK.length) {
                for (let p = 1; p <= 4; p++) {
                    tasks.push(done => Net.get('/discover/movie', { with_keywords: topK.slice(0, 3).map(k => k.id).join('|'), sort_by: 'popularity.desc', page: p, 'vote_count.gte': 120, 'vote_average.gte': 6.2, include_adult: false }, (d) => done(markList(d?.results, 'movie', 'keyword', { kw: topK[0]?.name })), () => done([]), { force }));
                }
            }
            if (!taste.seeds?.length && !topG.length) {
                for (let p = 1; p <= 5; p++) {
                    tasks.push(done => Net.get('/discover/movie', { sort_by: 'vote_average.desc', 'vote_count.gte': 3000, 'vote_average.gte': 7.6, page: p, include_adult: false }, (d) => done(markList(d?.results, 'movie', 'top')), () => done([]), { force }));
                }
                for (let p = 1; p <= 3; p++) {
                    tasks.push(done => Net.get('/trending/all/week', { page: p }, (d) => done(markList(d?.results, null, 'trend')), () => done([]), { force }));
                }
            }
            parallel(tasks, (packs) => {
                const all = packs.flat().filter(Boolean);
                let picked = Capsule.pick(all, taste, force);
                // Fallback: если не хватает до 100, добираем по главному жанру
                if (picked.length < CAPSULE_SIZE && topG.length) {
                    const fallbackTasks = [];
                    for (let p = 1; p <= 4; p++) {
                        fallbackTasks.push(done => Net.get('/discover/movie', { with_genres: topG[0].id, sort_by: 'vote_average.desc', 'vote_count.gte': 800, 'vote_average.gte': 7.0, page: p, include_adult: false }, (d) => done(markList(d?.results, 'movie', 'relax')), () => done([]), { force }));
                    }
                    parallel(fallbackTasks, (fallbackPacks) => cb(Capsule.pick(all.concat(fallbackPacks.flat().filter(Boolean)), taste, force)));
                } else cb(picked);
            });
        },
        pick: (all, taste, force) => {
            const seen = {}, out = [], shown = Capsule.shown(), gWeight = {};
            (taste.genres || []).forEach(g => { gWeight[g.id] = g.score; });
            const maxG = taste.genres?.length ? taste.genres[0].score : 1;
            all.forEach(it => {
                const key = it.media_type + '_' + it.id;
                if (seen[key]) { seen[key]._score += 3.5; seen[key]._multi = true; return; }
                if (taste.watched?.[it.id] || shown.includes(it.id) || !it.vote_average || it.vote_average < 5.8 || (it.vote_count || 0) < 60) return;
                let s = 0;
                (it.genre_ids || []).forEach(gid => { const g = TV2MOVIE[gid] || gid; if (gWeight[g]) s += 4 * Math.sqrt(gWeight[g] / maxG); });
                if (it._src === 'seed') s += 5;
                if (it._src === 'keyword') s += 4.5 + (it._via?.kw?.length > 12 ? 0.8 : 0);
                if (it._src === 'genre') s += 2;
                if (it._src === 'trend') s += 0.5;
                s += clamp(it.vote_average - 6, 0, 3) * 1.6 + clamp((it.vote_count || 0) / 4000, 0, 1.2) + (Math.random() - 0.5) * 0.5;
                if (taste.era) { const y = parseInt(String(it.release_date || it.first_air_date || '').slice(0, 4), 10) || 0; if (y) s -= clamp(Math.abs(y - taste.era) / 30, 0, 1.2); }
                if (!it.overview) s -= 1;
                it._score = s; seen[key] = it; out.push(it);
            });
            out.sort((a, b) => b._score - a._score);
            const bySrc = {}, final = [];
            // Увеличен лимит разнообразия с 3 до 15, иначе список обрывался на 18-20 фильмах
            for (let i = 0; i < out.length && final.length < CAPSULE_SIZE - 5; i++) {
                const src = out[i]._src || 'x';
                bySrc[src] = (bySrc[src] || 0) + 1;
                if (bySrc[src] > 15) continue;
                final.push(out[i]);
            }
            // Убран break, чтобы "дикие карты" добавлялись до конца, а не по 1 штуке
            for (let i = 0; i < out.length && final.length < CAPSULE_SIZE - 1; i++) {
                if (final.includes(out[i])) continue;
                let isTop = false;
                if (taste.genres?.length) { const topId = taste.genres[0].id; for (const gid of (out[i].genre_ids || [])) if ((TV2MOVIE[gid] || gid) === topId) { isTop = true; break; } }
                if (!isTop && out[i].vote_average >= 6.6) final.push(out[i]);
            }
            for (let i = 0; final.length < CAPSULE_SIZE && i < out.length; i++) if (!final.includes(out[i])) final.push(out[i]);
            return final;
        },
        reason: (item, taste) => {
            if (item._reasonText) return item._reasonText;
            let r = '';
            if (item._src === 'seed' && item._via?.seed) r = `✅ Похоже на «${item._via.seed}»`;
            else if (item._src === 'keyword' && item._via?.kw) r = `🏷️ Тема: «${item._via.kw}»`;
            else if (item._src === 'genre' || item._src === 'relax') {
                const names = [];
                for (let i = 0; i < (taste.genres || []).length && names.length < 2; i++) if ((item.genre_ids || []).includes(taste.genres[i].id) && taste.genres[i].name) names.push(taste.genres[i].name);
                r = names.length ? `🎭 Твои жанры: ${names.join(' и ')}` : '⭐ Высокий рейтинг';
            } else if (item._src === 'search') r = item._via?.query ? `🔍 По запросу: «${item._via.query}»` : 'Найдено по запросу';
            else r = '⭐ Высокий рейтинг';
            if (item._multi) r += ' · Совпало по нескольким признакам';
            return item._reasonText = r;
        }
    };

    // === ПОИСК ===
    const parseQuery = (raw) => {
        const q = String(raw || '').toLowerCase().replace(/ё/g, 'е');
        const ctx = { raw, genresM: [], genresT: [], tags: [], tokens: [], type: 'any', yearFrom: 0, yearTo: 0, minVote: 5.8, minVotes: 40, horror: false, kids: false };
        if (/сериал|сезон|series/.test(q)) ctx.type = 'tv'; else if (/фильм|кино|movie/.test(q)) ctx.type = 'movie';
        GENRE_SYN.forEach(g => g.w.forEach(w => { if (q.includes(w)) { ctx.genresM.push(...g.m); ctx.genresT.push(...g.t); if (/ужас|хоррор|страшн/.test(w)) ctx.horror = true; if (/детск|ребен|kids|kid/.test(w)) ctx.kids = true; } }));
        TAG_SYN.forEach(t => t.w.forEach(w => { if (q.includes(w)) ctx.tags.push(t.k); }));
        const dec = q.match(/(\d{2})\s?-?\s?х/);
        if (dec) { const base = parseInt(dec[1], 10) >= 30 ? 1900 + parseInt(dec[1], 10) : 2000 + parseInt(dec[1], 10); ctx.yearFrom = base; ctx.yearTo = base + 9; }
        const y4 = q.match(/(19|20)\d{2}/);
        if (y4 && !ctx.yearFrom) { ctx.yearFrom = parseInt(y4[0], 10); ctx.yearTo = ctx.yearFrom; }
        if (/новинк|свеж|недавн/.test(q)) { const cy = new Date().getFullYear(); ctx.yearFrom = cy - 1; ctx.yearTo = cy + 1; }
        if (/классик|стар[оы]е/.test(q) && !ctx.yearFrom) { ctx.yearFrom = 1950; ctx.yearTo = 1999; }
        if (/лучш|топ|шедевр|культов/.test(q)) { ctx.minVote = 7.2; ctx.minVotes = 600; }
        q.split(/[^a-zа-я0-9]+/).forEach(w => { if (w.length >= 4 && !STOP_WORDS.includes(w)) ctx.tokens.push(w); });
        ctx.genresM = [...new Set(ctx.genresM)]; ctx.genresT = [...new Set(ctx.genresT)]; ctx.tags = [...new Set(ctx.tags)];
        return ctx;
    };
    const stem = (t) => t.length > 5 ? t.substring(0, t.length - 2) : t;
    const Search = {
        resolveTags: (tags, cb) => {
            if (!tags.length) return cb([]);
            parallel(tags.slice(0, 3).map(name => done => Net.get('/search/keyword', { query: name, page: 1 }, (d) => done(d?.results?.length ? d.results[0].id : null), () => done(null), { ttl: 604800000 })), (res) => cb(res.filter(Boolean)));
        },
        run: (query, taste, cb, force) => {
            const ctx = parseQuery(query);
            Search.resolveTags(ctx.tags, (kwIds) => {
                const tasks = [];
                // Парсим 5 страниц вместо 1, чтобы поиск тоже мог вернуть 100 карточек
                const pages = force ? [1 + rnd(2), 2 + rnd(2)] : [1, 2, 3, 4, 5];
                const discover = (media) => {
                    const p = { sort_by: 'popularity.desc', include_adult: false, 'vote_count.gte': ctx.minVotes, 'vote_average.gte': ctx.minVote };
                    const g = media === 'tv' ? ctx.genresT : ctx.genresM;
                    if (g.length) p.with_genres = g.slice(0, 3).join(',');
                    const semanticKw = kwIds.slice();
                    if (ctx.horror && media === 'tv') p.with_genres = '10765';
                    if (ctx.horror && media === 'movie') p.with_genres = '27';
                    if (ctx.kids && media === 'tv') p.with_genres = '10762,10751';
                    if (ctx.kids && media === 'movie') p.with_genres = '10751';
                    if (semanticKw.length) p.with_keywords = semanticKw.join('|');
                    if (ctx.yearFrom) {
                        if (media === 'tv') { p['first_air_date.gte'] = `${ctx.yearFrom}-01-01`; p['first_air_date.lte'] = `${ctx.yearTo}-12-31`; }
                        else { p['primary_release_date.gte'] = `${ctx.yearFrom}-01-01`; p['primary_release_date.lte'] = `${ctx.yearTo}-12-31`; }
                    }
                    return p;
                };
                if (ctx.type !== 'tv') {
                    pages.forEach(p => tasks.push(done => Net.get('/discover/movie', Object.assign({}, discover('movie'), { page: p }), (d) => done(markList(d?.results, 'movie', 'search', { query })), () => done([]), { force })));
                }
                if (ctx.type !== 'movie') {
                    pages.forEach(p => tasks.push(done => Net.get('/discover/tv', Object.assign({}, discover('tv'), { page: p }), (d) => done(markList(d?.results, 'tv', 'search', { query })), () => done([]), { force })));
                }
                if (ctx.tokens.length) {
                    [1, 2].forEach(p => tasks.push(done => Net.get('/search/multi', { query, page: p, include_adult: false }, (d) => done(markList(d?.results, null, 'search', { query })), () => done([]), { force })));
                }
                parallel(tasks, (packs) => cb(Search.rank(packs.flat().filter(Boolean), ctx, taste, force), ctx));
            });
        },
        rank: (list, ctx, taste, force) => {
            const out = [], seen = {}, shown = Capsule.shown(), stems = ctx.tokens.map(stem), gWeight = {};
            (taste?.genres || []).forEach(g => { gWeight[g.id] = g.score; });
            const maxG = (taste?.genres?.length) ? taste.genres[0].score : 1;
            const curYear = new Date().getFullYear();
            list.forEach(it => {
                const key = it.media_type + '_' + it.id;
                if (seen[key]) { seen[key]._score += 2; return; }
                const title = String(it.title || it.name || '').toLowerCase(), over = String(it.overview || '').toLowerCase();
                let s = 0;
                stems.forEach(st => { if (title === st) s += 10; else if (title.includes(st)) s += 5; if (over.includes(st)) s += 2.5; });
                const wanted = it.media_type === 'tv' ? ctx.genresT : ctx.genresM;
                (it.genre_ids || []).forEach(gid => { if (wanted.includes(gid)) s += 4; if (gWeight[TV2MOVIE[gid] || gid]) s += 2 * (gWeight[TV2MOVIE[gid] || gid] / maxG); });
                s += clamp((it.vote_average || 0) - 5.5, 0, 4) * 1.1 + clamp((it.vote_count || 0) / 5000, 0, 1);
                const y = parseInt(String(it.release_date || it.first_air_date || '').slice(0, 4), 10) || 0;
                if (y >= curYear - 2) s += 1.5;
                if (!it.overview) s -= 1.5;
                if (taste?.watched?.[it.id]) s -= 3;
                if (shown.includes(it.id)) s -= 6;
                if (force) s += Math.random() * 1.2;
                it._score = s; seen[key] = it; out.push(it);
            });
            out.sort((a, b) => b._score - a._score);
            const fresh = out.filter(it => !shown.includes(it.id));
            return (fresh.length >= CAPSULE_SIZE ? fresh : out).slice(0, CAPSULE_SIZE * 2);
        }
    };

    // === ТЕМЫ ===
    const THEMES = {
        astro: { name: 'Космос', cls: 'cm-t-astro', sys: 'ORBITAL UPLINK: ESTABLISHED', quotes: ['«Хьюстон, у нас проблема»', '«Космос ждёт»'], load: ['ПРОКЛАДЫВАЮ КУРС', 'СОБИРАЮ КАПСУЛУ'], vars: { '--cm-bg': '#05070D', '--cm-accent': '#FF7A2F', '--cm-accent2': '#7FD8FF', '--cm-text': '#E8ECF5', '--cm-sub': '#8695AC', '--cm-panel': 'rgba(16,21,32,.65)', '--cm-panel2': 'rgba(9,12,20,.55)', '--cm-chip': 'rgba(232,236,245,.05)', '--cm-radius': '1.2em' } },
        breakingbad: { name: 'Лаборатория', cls: 'cm-t-bb', sys: 'LAB NET: HEISENBERG // ONLINE', quotes: ['«Скажи моё имя»', '«Химия — это сила»'], load: ['ВАРЮ СИНЬКУ', 'СОБИРАЮ КАПСУЛУ'], vars: { '--cm-bg': '#0B0E08', '--cm-accent': '#D6E24A', '--cm-accent2': '#1FAE96', '--cm-text': '#EDF2E0', '--cm-sub': '#9AAE8C', '--cm-panel': 'rgba(19,24,13,.72)', '--cm-panel2': 'rgba(12,16,8,.6)', '--cm-chip': 'rgba(214,226,74,.08)', '--cm-radius': '.6em' } },
        matrix: { name: 'Матрица', cls: 'cm-t-matrix', sys: 'SYSTEM_KERNEL: NEBUCHADNEZZAR // ONLINE', quotes: ['«Ложки нет»', '«Следуй за белым кроликом»'], load: ['ДЕШИФРУЮ КОД', 'СОБИРАЮ КАПСУЛУ'], vars: { '--cm-bg': '#000600', '--cm-accent': '#00FF41', '--cm-accent2': '#00B32E', '--cm-text': '#C8FFD4', '--cm-sub': '#4E9E5E', '--cm-panel': 'rgba(0,12,0,.72)', '--cm-panel2': 'rgba(0,8,0,.6)', '--cm-chip': 'rgba(0,255,65,.06)', '--cm-radius': '.4em' } },
        panda: { name: 'Свиток', cls: 'cm-t-panda', sys: 'SCROLL OF DESTINY: OPEN', quotes: ['«Случайностей не бывает»', '«Твоё время настало»'], load: ['ЧИТАЮ СВИТКИ', 'СОБИРАЮ КАПСУЛУ'], vars: { '--cm-bg': '#1C140B', '--cm-accent': '#D8433C', '--cm-accent2': '#E7B65C', '--cm-text': '#F4E9D2', '--cm-sub': '#B79E7B', '--cm-panel': 'rgba(42,31,18,.78)', '--cm-panel2': 'rgba(30,22,13,.65)', '--cm-chip': 'rgba(231,182,92,.1)', '--cm-radius': '.9em' } },
        rickmorty: { name: 'Портал', cls: 'cm-t-rm', sys: 'PORTAL GUN: CHARGED // C-137', quotes: ['«Вубба-лубба-даб-даб»'], load: ['ПРЫГАЮ ЧЕРЕЗ ПОРТАЛ', 'СОБИРАЮ КАПСУЛУ'], vars: { '--cm-bg': '#07141B', '--cm-accent': '#7CFF6B', '--cm-accent2': '#3AD1FF', '--cm-text': '#E6FFF1', '--cm-sub': '#6FA894', '--cm-panel': 'rgba(6,22,28,.72)', '--cm-panel2': 'rgba(4,16,20,.6)', '--cm-chip': 'rgba(124,255,107,.08)', '--cm-radius': '1.1em' } },
        starwars: { name: 'Галактика', cls: 'cm-t-sw', sys: 'HOLONET LINK: ACTIVE', quotes: ['«Да пребудет с тобой Сила»'], load: ['ГИПЕРПРЫЖОК', 'СОБИРАЮ КАПСУЛУ'], vars: { '--cm-bg': '#020409', '--cm-accent': '#FFE81F', '--cm-accent2': '#4BD5FF', '--cm-text': '#F2F4F8', '--cm-sub': '#8C93A0', '--cm-panel': 'rgba(8,12,20,.72)', '--cm-panel2': 'rgba(5,8,14,.6)', '--cm-chip': 'rgba(255,232,31,.07)', '--cm-radius': '.8em' } },
        cyberpunk: { name: 'Найт-Сити', cls: 'cm-t-cp', sys: 'NETWATCH BYPASS: ACTIVE // NC', quotes: ['«Проснись, самурай»'], load: ['ВЗЛАМЫВАЮ СЕТЬ', 'СОБИРАЮ КАПСУЛУ'], vars: { '--cm-bg': '#0A0A12', '--cm-accent': '#FF2A6D', '--cm-accent2': '#05D9E8', '--cm-text': '#EAF2FF', '--cm-sub': '#7A86A0', '--cm-panel': 'rgba(12,12,24,.74)', '--cm-panel2': 'rgba(8,8,16,.62)', '--cm-chip': 'rgba(5,217,232,.07)', '--cm-radius': '.4em' } },
        noir: { name: 'Нуар', cls: 'cm-t-noir', sys: 'CASE #1947: OPEN', quotes: ['«Забудь её, Джейк»', '«В этом городе все врут»'], load: ['ЛИСТАЮ ДЕЛО', 'СОБИРАЮ КАПСУЛУ'], vars: { '--cm-bg': '#0B0B0B', '--cm-accent': '#E6E6E6', '--cm-accent2': '#B48A3C', '--cm-text': '#EDEDED', '--cm-sub': '#8A8A8A', '--cm-panel': 'rgba(20,20,20,.8)', '--cm-panel2': 'rgba(14,14,14,.68)', '--cm-chip': 'rgba(255,255,255,.06)', '--cm-radius': '.3em' } }
    };
    const THEME_ORDER = ['astro', 'breakingbad', 'matrix', 'panda', 'rickmorty', 'starwars', 'cyberpunk', 'noir'];
    const Themes = {
        current: () => THEMES[pGet('theme', 'astro')] ? pGet('theme', 'astro') : 'astro',
        apply: (key, root) => {
            const t = THEMES[key] || THEMES.astro;
            root = root || View.root;
            if (!root) return;
            THEME_ORDER.forEach(k => removeClass(root, THEMES[k].cls));
            addClass(root, t.cls);
            Object.entries(t.vars).forEach(([v, val]) => root.style.setProperty(v, val));
            const sl = root.querySelector('.cm-sysline');
            if (sl) sl.textContent = t.sys || '';
            Themes.fx(key, root);
            ThemeFX.refresh(root);
        },
        set: (key) => { pSet('theme', key); Themes.apply(key, View.root); },
        quote: (key) => { const t = THEMES[key || Themes.current()] || THEMES.astro; const q = t.quotes || []; return q.length ? q[rnd(q.length)] : ''; },
        loadLine: () => { const t = THEMES[Themes.current()]; const l = t.load || ['СОБИРАЮ КАПСУЛУ']; return l[rnd(l.length)]; },
        fx: (key, root) => {
            const old = root?.querySelector('.cm-rain');
            if (old) { if (old._cmTimer) clearInterval(old._cmTimer); old.remove(); }
            if (key === 'matrix') Themes.rain(root);
        },
        rain: (root) => {
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
            const canvas = el('canvas', 'cm-rain');
            root.insertBefore(canvas, root.firstChild);
            const ctx = canvas.getContext?.('2d');
            if (!ctx) return;
            const chars = 'アイウエオカキクケコサシスセソ0123456789'.split('');
            canvas.width = root.clientWidth; canvas.height = root.clientHeight;
            const cols = Math.max(1, Math.floor(canvas.width / 18));
            const drops = Array(cols).fill().map(() => Math.random() * -40);
            const timer = setInterval(() => {
                if (!canvas.parentNode) { clearInterval(timer); return; }
                ctx.fillStyle = 'rgba(0,6,0,0.12)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#00FF41';
                ctx.font = '14px monospace';
                drops.forEach((y, c) => {
                    ctx.fillText(chars[rnd(chars.length)], c * 18, y * 18);
                    if (y * 18 > canvas.height && Math.random() > 0.975) drops[c] = 0;
                    drops[c]++;
                });
            }, 70);
            canvas._cmTimer = timer;
        }
    };

    // === ТЕМАТИЧЕСКИЕ АНИМАЦИИ ===
    const ThemeFX = {
        canvas: null, ctx: null, raf: 0, particles: [], last: 0, mode: '',
        stop: () => {
            if (ThemeFX.raf) cancelAnimationFrame(ThemeFX.raf);
            ThemeFX.raf = 0; ThemeFX.canvas?.remove(); ThemeFX.canvas = null; ThemeFX.ctx = null; ThemeFX.particles = [];
        },
        refresh: (root) => {
            ThemeFX.stop();
            if (!root) return;
            const key = Themes.current();
            const enabled = pGet(EXPERIMENT_KEY, false);
            if (key === 'matrix') return;
            const c = el('canvas', 'cm-fx-canvas');
            root.insertBefore(c, root.querySelector('.cm-stage') || null);
            ThemeFX.canvas = c; ThemeFX.ctx = c.getContext('2d'); ThemeFX.mode = key;
            ThemeFX.resize();
            if (key === 'breakingbad') ThemeFX.makeBubbles();
            else if (key === 'rickmorty') ThemeFX.makePortals();
            else if (key === 'starwars') ThemeFX.makeGalaxy();
            else if (key === 'noir') ThemeFX.makeNoir();
            else if (key === 'astro') ThemeFX.makeSpace();
            else if (key === 'panda') ThemeFX.makeDream();
            if (enabled) ThemeFX.makeExperiment();
            ThemeFX.last = performance.now();
            ThemeFX.loop(ThemeFX.last);
        },
        resize: () => {
            const c = ThemeFX.canvas, root = View.root;
            if (!c || !root) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.max(1, root.clientWidth), h = Math.max(1, root.clientHeight);
            c.width = Math.floor(w*dpr); c.height = Math.floor(h*dpr); c.style.width = w+'px'; c.style.height = h+'px';
            ThemeFX.ctx?.setTransform(dpr,0,0,dpr,0,0); ThemeFX.w=w; ThemeFX.h=h;
        },
        makeBubbles: () => {
            const w=ThemeFX.w||1200,h=ThemeFX.h||700;
            ThemeFX.particles=Array.from({length:18},(_,i)=>({x:Math.random()*w,y:h*.2+Math.random()*h*.65,vx:(Math.random()-.5)*1.15,vy:(Math.random()-.5)*.75,r:8+Math.random()*18,life:1,hit:0,hue:i%2}));
        },
        makePortals: () => {
            const w=ThemeFX.w||1200,h=ThemeFX.h||700;
            const icons=['🍿','🍕','📺','💡','📼','💿'];
            ThemeFX.particles=Array.from({length:16},(_,i)=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*1.6,vy:(Math.random()-.5)*1.2,r:10+Math.random()*8,icon:icons[i%icons.length],phase:Math.random()*6.28,life:1}));
        },
        makeGalaxy: () => { ThemeFX.particles=Array.from({length:95},()=>({x:Math.random(),y:Math.random(),r:.5+Math.random()*1.8,a:.25+Math.random()*.7,p:Math.random()*6.28})); },
        makeNoir: () => { const w=ThemeFX.w||1200,h=ThemeFX.h||700; ThemeFX.particles=Array.from({length:48},(_,i)=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.35,vy:.4+Math.random()*1.2,r:1+Math.random()*3,a:.1+Math.random()*.35,type:i%3})); },
        makeSpace: () => { ThemeFX.particles=Array.from({length:80},()=>({a:Math.random()*6.28,r:30+Math.random()*500,s:.0005+Math.random()*.002,z:.4+Math.random()})); },
        makeDream: () => { const w=ThemeFX.w||1200,h=ThemeFX.h||700; ThemeFX.particles=Array.from({length:12},()=>({x:Math.random()*w,y:Math.random()*h,r:50+Math.random()*130,vx:(Math.random()-.5)*.12,vy:(Math.random()-.5)*.12,a:.025+Math.random()*.06})); },
        makeExperiment: () => {
            for(let i=0;i<70;i++) ThemeFX.particles.push({exp:true,a:Math.random()*6.28,r:40+Math.random()*Math.min(ThemeFX.w,ThemeFX.h)*.5,s:.0008+Math.random()*.0025,z:.4+Math.random()*1.3});
        },
        draw: (now) => {
            const c=ThemeFX.canvas,ctx=ThemeFX.ctx,w=ThemeFX.w,h=ThemeFX.h;if(!c||!ctx)return;
            ctx.clearRect(0,0,w,h);
            const dt=Math.min(32,now-ThemeFX.last); ThemeFX.last=now;
            if(ThemeFX.mode==='breakingbad'){
                const p=ThemeFX.particles;
                p.forEach(x=>{x.x+=x.vx*dt/16;x.y+=x.vy*dt/16;if(x.x<-40)x.x=w+40;if(x.x>w+40)x.x=-40;if(x.y<-40)x.y=h+40;if(x.y>h+40)x.y=-40;});
                for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){const a=p[i],b=p[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);if(d<a.r+b.r){a.hit++;b.hit++;}}
                p.forEach(x=>{ctx.beginPath();ctx.arc(x.x,x.y,x.r,0,6.28);ctx.fillStyle=x.hue?'rgba(31,174,150,.18)':'rgba(214,226,74,.16)';ctx.fill();ctx.strokeStyle=x.hue?'rgba(31,174,150,.35)':'rgba(214,226,74,.32)';ctx.stroke();if(x.hit){for(let k=0;k<5;k++){const a=Math.random()*6.28;ctx.beginPath();ctx.arc(x.x+Math.cos(a)*x.r*.8,x.y+Math.sin(a)*x.r*.8,1+Math.random()*2,0,6.28);ctx.fillStyle='rgba(255,255,255,.6)';ctx.fill();}x.hit=0;}});
            }
            if(ThemeFX.mode==='rickmorty'){
                const p=ThemeFX.particles; p.forEach(x=>{x.x+=x.vx*dt/16;x.y+=x.vy*dt/16;x.phase+=.04;if(x.x<-30)x.x=w+30;if(x.x>w+30)x.x=-30;if(x.y<-30)x.y=h+30;if(x.y>h+30)x.y=-30;ctx.save();ctx.translate(x.x,x.y);ctx.rotate(Math.sin(x.phase)*.15);ctx.globalAlpha=.35;ctx.font=x.r*1.8+'px sans-serif';ctx.fillText(x.icon,-x.r,-x.r);ctx.restore();});
                const px=w*.76,py=h*.34;ctx.beginPath();ctx.arc(px,py,75+Math.sin(now/700)*7,0,6.28);ctx.strokeStyle='rgba(58,209,255,.18)';ctx.lineWidth=12;ctx.stroke();ctx.beginPath();ctx.arc(px,py,55,0,6.28);ctx.strokeStyle='rgba(124,255,107,.22)';ctx.lineWidth=4;ctx.stroke();
            }
            if(ThemeFX.mode==='starwars'){
                const night=(Math.floor(now/9000)%2)===0;ctx.fillStyle=night?'rgba(0,0,12,.18)':'rgba(130,100,40,.06)';ctx.fillRect(0,0,w,h);
                ThemeFX.particles.forEach(x=>{const xx=x.x*w,yy=x.y*h;ctx.globalAlpha=x.a*(.6+.4*Math.sin(now/800+x.p));ctx.fillStyle=night?'#fff':'#b9ffb0';ctx.beginPath();ctx.arc(xx,yy,x.r,0,6.28);ctx.fill();});ctx.globalAlpha=1;
                const cx=w*.78,cy=h*.25;if(night){ctx.fillStyle='rgba(240,245,255,.22)';ctx.beginPath();ctx.arc(cx,cy,42,0,6.28);ctx.fill();ctx.fillStyle='rgba(2,4,9,.92)';ctx.beginPath();ctx.arc(cx+15,cy-5,40,0,6.28);ctx.fill();}else{ctx.fillStyle='rgba(255,225,90,.12)';ctx.beginPath();ctx.arc(cx,cy,55,0,6.28);ctx.fill();for(let i=0;i<16;i++){const lx=(i*97+now*.03)%w;ctx.strokeStyle='rgba(90,210,100,.15)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(lx,h);ctx.lineTo(lx+15,h-80-(i%5)*20);ctx.stroke();}}
            }
            if(ThemeFX.mode==='noir'){
                const phase=(Math.sin(now/3200)+1)/2;const g=ctx.createLinearGradient(0,0,w,0);g.addColorStop(0,`rgba(255,255,255,${.025*phase})`);g.addColorStop(.5,`rgba(255,255,255,${.09*phase})`);g.addColorStop(1,'rgba(0,0,0,.08)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
                ThemeFX.particles.forEach(x=>{x.x+=x.vx*dt;x.y+=x.vy*dt;if(x.y>h+20){x.y=-20;x.x=Math.random()*w;}ctx.globalAlpha=x.a;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x.x,x.y,x.r,0,6.28);ctx.fill();if(x.type===1){ctx.fillRect(x.x,x.y,x.r*7,1);}});ctx.globalAlpha=1;
            }
            if(ThemeFX.mode==='panda'){
                ThemeFX.particles.forEach(x=>{x.x+=x.vx*dt;x.y+=x.vy*dt;if(x.x<-100)x.x=w+100;if(x.x>w+100)x.x=-100;if(x.y<-100)x.y=h+100;if(x.y>h+100)x.y=-100;const g=ctx.createRadialGradient(x.x,x.y,0,x.x,x.y,x.r);g.addColorStop(0,'rgba(255,205,120,'+x.a+')');g.addColorStop(1,'rgba(255,170,100,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x.x,x.y,x.r,0,6.28);ctx.fill();});
            }
            if(ThemeFX.mode==='astro'){
                const cx=w*.78,cy=h*.34;ctx.strokeStyle='rgba(127,216,255,.13)';ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.ellipse(cx,cy,80+i*55,35+i*25,0,0,6.28);ctx.stroke();}ctx.fillStyle='rgba(255,122,47,.18)';ctx.beginPath();ctx.arc(cx,cy,22,0,6.28);ctx.fill();
                ThemeFX.particles.forEach(x=>{x.a+=x.s*dt;const xx=cx+Math.cos(x.a)*x.r,yy=cy+Math.sin(x.a)*x.r*.45;ctx.fillStyle='rgba(127,216,255,.55)';ctx.beginPath();ctx.arc(xx,yy,1.2*x.z,0,6.28);ctx.fill();});
            }
            if(pGet(EXPERIMENT_KEY,false)){
                const cx=w*.5,cy=h*.45;for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(cx,cy,110+k*95,45+k*34,now/8000*(k%2?1:-1),0,6.28);ctx.strokeStyle=`rgba(120,220,255,${.07+k*.025})`;ctx.stroke();}
                ThemeFX.particles.filter(x=>x.exp).forEach(x=>{x.a+=x.s*dt;const xx=cx+Math.cos(x.a)*x.r,yy=cy+Math.sin(x.a)*x.r*.42;ctx.fillStyle='rgba(180,235,255,.7)';ctx.beginPath();ctx.arc(xx,yy,1.1*x.z,0,6.28);ctx.fill();});
            }
        },
        loop: (now) => { ThemeFX.draw(now); ThemeFX.raf=requestAnimationFrame(ThemeFX.loop); }
    };

    // === CSS ===
    const CSS = `
        .cm-root{position:fixed;inset:0;z-index:999998;overflow:hidden;color:var(--cm-text);background:var(--cm-bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;--cm-font-base:clamp(12px,1.6vw,16px);--cm-font-title:clamp(1.3rem,3.4vw,2.2rem);font-size:var(--cm-font-base)}
        .cm-root *{box-sizing:border-box}
        .cm-root .cm-act,.cm-root .cm-opt,.cm-root .cm-chip,.cm-root .cm-onb-card,.cm-root .cm-bar-btn{touch-action:manipulation}
        .cm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
        .cm-sysline{position:absolute;top:1em;left:1.2em;z-index:5;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.68em;letter-spacing:.18em;color:var(--cm-sub);opacity:.75}
        .cm-rain{position:absolute;inset:0;width:100%;height:100%;opacity:.5;pointer-events:none}
        .cm-stars{position:absolute;top:-10%;left:-10%;width:120%;height:120%;opacity:.3;background-image:radial-gradient(1px 1px at 12% 22%,#fff,transparent),radial-gradient(1px 1px at 68% 14%,#cfe6ff,transparent),radial-gradient(1.4px 1.4px at 84% 62%,#fff,transparent),radial-gradient(1px 1px at 32% 78%,#9fd4ff,transparent);background-repeat:repeat;background-size:100% 100%;animation:cm-drift 60s linear infinite;will-change:transform}
        .cm-t-matrix .cm-stars,.cm-t-bb .cm-stars,.cm-t-panda .cm-stars,.cm-t-noir .cm-stars,.cm-t-cp .cm-stars{opacity:.06}
        @keyframes cm-drift{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(-2%,-3%,0)}}
        .cm-t-cp:after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;mix-blend-mode:overlay;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px)}
        .cm-t-noir:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(80% 60% at 50% 40%,transparent 40%,rgba(0,0,0,.78) 100%)}
        .cm-glow{position:absolute;top:-25%;left:-25%;width:150%;height:150%;background-size:cover;background-position:center;opacity:0;filter:blur(80px) saturate(150%);transition:opacity .8s ease;will-change:opacity}
        .cm-glow.on{opacity:.18}
        .cm-shade{position:absolute;inset:0;background:radial-gradient(90% 70% at 65% 40%,rgba(0,0,0,.25),rgba(0,0,0,.88) 62%,var(--cm-bg) 100%)}
        .cm-stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.1em;padding:3.2em 2em 2em;overflow-y:auto}
        .cm-port{display:flex;gap:1.7em;width:100%;max-width:72em;padding:1.6em;border-radius:var(--cm-radius);background:var(--cm-panel);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
        .cm-poster{position:relative;flex:none;width:15em;aspect-ratio:2/3;border-radius:calc(var(--cm-radius)*.6);overflow:hidden;background:#0B0F18;box-shadow:0 1em 2em rgba(0,0,0,.5);cursor:pointer}
        .cm-poster img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .4s}
        .cm-poster img.ready{opacity:1}
        .cm-t-noir .cm-poster img{filter:grayscale(1) contrast(1.12)}
        .cm-rate{position:absolute;top:.6em;right:.6em;padding:.3em .7em;border-radius:.5em;background:var(--cm-accent);color:#041008;font-weight:700;font-size:.8em;box-shadow:0 .2em .6em rgba(0,0,0,.45)}
        .cm-hero{flex:1;min-width:0;display:flex;flex-direction:column}
        .cm-meta{display:flex;flex-wrap:wrap;gap:.5em;margin-bottom:.9em}
        .cm-mchip{display:inline-flex;align-items:center;padding:.45em .9em;border-radius:.6em;font-size:.76em;letter-spacing:.06em;background:var(--cm-chip);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);color:var(--cm-text);white-space:nowrap}
        .cm-mchip.src{color:var(--cm-accent);box-shadow:inset 0 0 0 1px var(--cm-accent)}
        .cm-mchip.type{color:var(--cm-accent2);box-shadow:inset 0 0 0 1px var(--cm-accent2)}
        .cm-name{font-size:var(--cm-font-title);font-weight:700;line-height:1.15;margin-bottom:.6em;overflow-wrap:anywhere}
        .cm-genres{display:flex;flex-wrap:wrap;gap:.45em;margin-bottom:.8em}
        .cm-gchip{padding:.35em .95em;border-radius:1.2em;font-size:.74em;color:var(--cm-accent);box-shadow:inset 0 0 0 1px var(--cm-accent)}
        .cm-why{position:relative;padding-left:1em;font-size:.88em;margin-bottom:.8em;opacity:.92}
        .cm-why:before{content:"";position:absolute;left:0;top:.2em;bottom:.2em;width:.18em;border-radius:.1em;background:var(--cm-accent)}
        .cm-over{font-size:.86em;line-height:1.55;color:var(--cm-sub);max-width:46em;margin-bottom:1.1em}
        .cm-acts{margin-top:auto;display:flex;gap:.9em;flex-wrap:wrap}
        .cm-act{display:flex;align-items:center;justify-content:center;gap:.5em;padding:.95em 1.5em;border-radius:calc(var(--cm-radius)*.55);cursor:pointer;background:var(--cm-chip);font-size:.95em;font-weight:600;color:var(--cm-text);transition:transform .15s,box-shadow .15s,background .15s;white-space:nowrap}
        .cm-act:active{transform:scale(.97)}
        .cm-act svg{width:1.05em;height:1.05em;fill:currentColor;flex:none}
        .cm-act.primary{flex:1;background:var(--cm-accent);color:#041008;box-shadow:0 0 0 .12em rgba(255,255,255,.35)}
        .cm-act.secondary{flex:1;background:#E8ECF5;color:#10131A}
        .cm-t-noir .cm-act.primary{color:#111}
        .cm-act.cm-focus{transform:scale(1.03);box-shadow:0 0 0 .16em rgba(255,255,255,.5)}
        .cm-bar{width:100%;max-width:72em;display:flex;align-items:center;justify-content:space-between;gap:1em;padding:.9em 1.4em;border-radius:var(--cm-radius);background:var(--cm-panel2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
        .cm-bar-btn{display:flex;align-items:center;gap:.55em;cursor:pointer;color:var(--cm-text);background:none;border:none;font-size:.9em;padding:.4em .6em;border-radius:.6em}
        .cm-bar-btn svg{width:1.2em;height:1.2em;fill:currentColor}
        .cm-bar-btn.center{font-weight:700;font-size:1.05em;letter-spacing:.06em}
        .cm-bar-btn.cm-focus{box-shadow:0 0 0 .14em var(--cm-accent)}
        .cm-load{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
        .cm-load-ring{width:4em;height:4em;border-radius:50%;box-shadow:inset 0 0 0 .16em rgba(255,255,255,.15);position:relative}
        .cm-load-ring:after{content:"";position:absolute;inset:-.16em;border-radius:50%;border:.16em solid transparent;border-top-color:var(--cm-accent);animation:cm-spin 1.1s linear infinite}
        @keyframes cm-spin{to{transform:rotate(360deg)}}
        .cm-load-txt{margin-top:1em;font-size:.72em;letter-spacing:.22em;color:var(--cm-sub)}
        .cm-onb{position:relative;width:100%;max-width:64em;display:flex;flex-direction:column;align-items:center;padding:1em}
        .cm-onb-head{font-size:.68em;letter-spacing:.24em;color:var(--cm-sub);margin-bottom:1em}
        .cm-onb-title{font-size:1.4em;font-weight:700;margin-bottom:.4em;text-align:center}
        .cm-onb-sub{color:var(--cm-sub);font-size:.9em;text-align:center;max-width:40em;margin-bottom:1.4em}
        .cm-onb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.9em;width:100%}
        .cm-onb-card{position:relative;aspect-ratio:2/3;border-radius:.8em;overflow:hidden;background:#0B0F18;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
        .cm-onb-card img{width:100%;height:100%;object-fit:cover}
        .cm-onb-card .t{position:absolute;left:0;right:0;bottom:0;padding:.6em .6em .5em;font-size:.72em;background:linear-gradient(transparent,rgba(0,0,0,.92));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cm-onb-card.sel{box-shadow:0 0 0 .18em var(--cm-accent)}
        .cm-onb-card.sel:after{content:"✓";position:absolute;top:.4em;right:.4em;width:1.6em;height:1.6em;border-radius:50%;background:var(--cm-accent);color:#041008;display:flex;align-items:center;justify-content:center;font-weight:800}
        .cm-onb-card.cm-focus{box-shadow:0 0 0 .18em var(--cm-accent2)}
        .cm-onb-card.sel.cm-focus{box-shadow:0 0 0 .18em var(--cm-accent),0 0 0 .34em var(--cm-accent2)}
        .cm-onb-chips{max-width:44em;margin:0 auto}
        .cm-onb-foot{display:flex;gap:.8em;margin-top:1.6em;flex-wrap:wrap;justify-content:center}
        .cm-onb-foot .cm-act{flex:0 1 auto}
        .cm-chips{display:grid;grid-template-columns:1fr 1fr;gap:.45em;margin-bottom:.9em;width:100%}
        .cm-chip{display:flex;align-items:center;min-height:2.6em;padding:.5em .9em;border-radius:.8em;font-size:.88em;cursor:pointer;background:var(--cm-chip);color:var(--cm-text);transition:transform .15s;text-align:left;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
        .cm-chip.sel{box-shadow:inset 0 0 0 1px var(--cm-accent);color:var(--cm-accent)}
        .cm-chip.cm-focus{background:var(--cm-accent2);color:#041008;transform:scale(1.03)}
        .cm-ov{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:999999;display:flex;align-items:center;justify-content:center;padding:1.2em}
        .cm-modal{width:40em;max-width:100%;max-height:90%;overflow-y:auto;padding:1.6em;border-radius:var(--cm-radius);background:var(--cm-panel2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);scrollbar-width:none}
        .cm-modal::-webkit-scrollbar{width:0}
        .cm-modal h3{margin:0 0 .3em;font-size:1.2em;font-weight:700}
        .cm-modal p{margin:0 0 1em;color:var(--cm-sub);font-size:.92em;line-height:1.5}
        .cm-modal p b{color:var(--cm-text)}
        .cm-opt{display:flex;align-items:center;min-height:2.7em;width:100%;text-align:left;padding:.6em 1em;margin-bottom:.45em;border-radius:calc(var(--cm-radius)*.5);background:var(--cm-chip);color:var(--cm-text);font-size:.95em;cursor:pointer}
        .cm-opt.cm-focus{background:var(--cm-accent);color:#04100D}
        .cm-t-noir .cm-opt.cm-focus{color:#111}
        .cm-opt small{display:block;font-size:.75em;opacity:.7;margin-top:.1em}
        .cm-input{width:100%;padding:.8em 1em;margin-bottom:.8em;border-radius:calc(var(--cm-radius)*.5);font-size:1em;color:#fff;outline:none;background:var(--cm-chip);border:1px solid rgba(255,255,255,.15)}
        .cm-toast{position:fixed;left:50%;bottom:1.8em;transform:translateX(-50%) translateY(1em);z-index:1000001;opacity:0;padding:.7em 1.2em;border-radius:.7em;background:var(--cm-panel2);color:var(--cm-text);font-size:.9em;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);transition:opacity .25s,transform .25s;max-width:92%;text-align:center}
        .cm-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
        .cm-t-matrix{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
        .cm-fx-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;opacity:.92}
        .cm-shade{z-index:1;pointer-events:none}
        .cm-stage{z-index:3}
        @media (hover:hover){
            .cm-act:hover,.cm-opt:hover,.cm-chip:hover,.cm-bar-btn:hover{background:rgba(255,255,255,.10);color:#9b9b9b !important}
            .cm-act.primary:hover,.cm-act.secondary:hover{color:#9b9b9b !important}
            .cm-onb-card:hover{box-shadow:inset 0 0 0 1px var(--cm-accent2)}
            .cm-root a:hover,.cm-root button:hover,.cm-root [role="button"]:hover{color:#9b9b9b !important}
        }
        @media (min-width:901px){
            .cm-root{--cm-font-base:clamp(14px,1.05vw,19px);--cm-font-title:clamp(2rem,3.15vw,3.5rem)}
            .cm-stage{padding:4.8em 3em 3.2em;gap:1.8em}
            .cm-port{max-width:92em;gap:2.8em;padding:2.5em 2.7em;min-height:36em;border-radius:calc(var(--cm-radius)*1.12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.10),0 1.5em 4em rgba(0,0,0,.28)}
            .cm-poster{width:19em;box-shadow:0 1.3em 3em rgba(0,0,0,.58)}
            .cm-over{font-size:.98em;line-height:1.7;max-width:62em}
            .cm-bar{max-width:92em;min-height:5.4em;padding:1.25em 2.2em;border-radius:calc(var(--cm-radius)*1.05)}
            .cm-bar-btn{font-size:1.02em;padding:.65em 1em}
            .cm-bar-btn.center{font-size:1.15em}
        }

        @media (max-width:900px){
            .cm-stage{padding:2.6em 1em 1em}
            .cm-port{flex-direction:column;gap:1em;padding:1em}
            .cm-poster{width:min(11em,42vw);margin:0 auto}
            .cm-rate{top:.4em;right:.4em}
            .cm-acts .cm-act{flex:1 1 100%}
            .cm-bar{padding:.7em .9em}
            .cm-bar-btn.center{font-size:.95em}
            .cm-onb-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
        @media (max-width:480px){.cm-chips{grid-template-columns:1fr 1fr}.cm-bar-btn .lbl{display:none}.cm-bar-btn.center .lbl{display:inline}}
        @media (prefers-reduced-motion:reduce){.cm-root *{animation:none !important;transition:none !important}}
    `;
    const injectCSS = () => {
        if (document.getElementById('cm_css')) return;
        const s = el('style');
        s.id = 'cm_css';
        s.textContent = CSS;
        document.head.appendChild(s);
    };

    // === ИКОНКИ ===
    const I_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    const I_SEARCH = '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>';
    const I_GEAR = '<svg viewBox="0 0 24 24"><path d="M19.14 12.94a7.07 7.07 0 0 0 .06-.94 7.07 7.07 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.3 7.3 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.65 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.34.61.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54a7.3 7.3 0 0 0 1.62-.94l2.39.96c.24.1.5 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5z"/></svg>';
    const I_CHANGE = '<svg viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>';
    const I_CAPSULE = '<svg viewBox="0 0 24 24"><path d="M17 2a5 5 0 0 1 3.5 8.5l-10 10A5 5 0 0 1 3.5 13.5l10-10A5 5 0 0 1 17 2zm-2 3.9-9.1 9.2a3 3 0 0 0 4.2 4.2L19.2 10a3 3 0 0 0-4.2-4.2z"/></svg>';

    // === НАВИГАЦИЯ ===
    const Nav = {
        rows: [], r: 0, c: 0,
        reset: () => { Nav.rows = []; Nav.r = 0; Nav.c = 0; },
        addRow: (items, type) => {
            const clean = items.filter(Boolean);
            if (!clean.length) return Nav.rows.length - 1;
            Nav.rows.push({ items: clean, memo: 0, type: type || 'row' });
            const idx = Nav.rows.length - 1;
            clean.forEach((item, j) => bindPointer(item, idx, j));
            return idx;
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
        rowType: () => Nav.rows[Nav.r]?.type || 'row',
        paint: (silent) => {
            View.root?.querySelectorAll('.cm-focus').forEach(n => removeClass(n, 'cm-focus'));
            const cur = Nav.current();
            if (!cur) return;
            addClass(cur, 'cm-focus');
            if (!silent) { try { cur.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); } catch (e) {} }
        },
        move: (dir) => {
            if (!Nav.rows.length) return;
            if (dir === 'up' && Nav.r > 0) Nav.setFocus(Nav.r - 1, Nav.rows[Nav.r - 1].memo || 0);
            else if (dir === 'down' && Nav.r < Nav.rows.length - 1) Nav.setFocus(Nav.r + 1, Nav.rows[Nav.r + 1].memo || 0);
        },
        moveH: (dir) => {
            const row = Nav.rows[Nav.r];
            if (!row) return false;
            const c = Nav.c + (dir === 'right' ? 1 : -1);
            if (c < 0 || c >= row.items.length) return false;
            Nav.setFocus(Nav.r, c);
            return true;
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

    let swipe = { x: 0, y: 0, t: 0, on: false };
    document.addEventListener('touchstart', (e) => {
        if (!App.active || Modal.active() || Onboard.active) return;
        swipe.x = e.touches[0].clientX; swipe.y = e.touches[0].clientY; swipe.t = Date.now(); swipe.on = true;
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
        if (!swipe.on || !App.active || Modal.active() || Onboard.active) return;
        swipe.on = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
        const vx = Math.abs(dx) / Math.max(Date.now() - swipe.t, 1);
        const target = e.target;
        if (target && (closestClass(target, 'cm-act') || closestClass(target, 'cm-bar-btn') || closestClass(target, 'cm-chip') || closestClass(target, 'cm-opt'))) return;
        if ((Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.35) || vx > 0.55) {
            vibrate(15);
            if (dx > 0) View.step(1); else View.step(-1);
        }
    }, { passive: true });

    // === ТОСТЫ / МОДАЛКИ ===
    const Toast = {
        node: null, timer: null,
        show: (text) => {
            if (!Toast.node) { Toast.node = el('div', 'cm-toast'); document.body.appendChild(Toast.node); }
            Toast.node.textContent = text;
            addClass(Toast.node, 'on');
            clearTimeout(Toast.timer);
            Toast.timer = setTimeout(() => removeClass(Toast.node, 'on'), 2600);
        }
    };
    const notify = (t) => { try { if (window.Lampa?.Noty?.show) { Lampa.Noty.show(t); return; } } catch (e) {} Toast.show(t); };
    const CHIP_COLS = 2;
    const Modal = {
        stack: [],
        open: (opts) => {
            const ov = el('div', 'cm-ov');
            const box = el('div', 'cm-modal');
            const nodes = [];
            let gridLen = 0;
            if (opts.title) box.appendChild(el('h3', '', esc(opts.title)));
            if (opts.text) box.appendChild(el('p', '', opts.text));
            if (opts.customNode) box.appendChild(opts.customNode);
            if (opts.chips?.length) {
                const wrap = el('div', 'cm-chips');
                opts.chips.forEach(ch => {
                    const c = el('div', 'cm-chip', esc(ch.label));
                    c._cmAction = () => { Modal.close(); ch.onSelect(); };
                    c.title = ch.label;
                    wrap.appendChild(c);
                    nodes.push(c);
                });
                gridLen = opts.chips.length;
                box.appendChild(wrap);
            }
            if (opts.items) opts.items.forEach(it => {
                const b = el('div', 'cm-opt', esc(it.label) + (it.hint ? '<small>' + esc(it.hint) + '</small>' : ''));
                b._cmAction = () => { Modal.close(); if (it.onSelect) it.onSelect(); };
                box.appendChild(b);
                nodes.push(b);
            });
            ov.appendChild(box);
            document.body.appendChild(ov);
            ov.onclick = (e) => { if (e.target === ov) Modal.close(); };
            const st = { ov, nodes, idx: 0, gridLen };
            Modal.stack.push(st);
            Modal.paint();
            return st;
        },
        paint: () => {
            const st = Modal.stack[Modal.stack.length - 1];
            if (!st) return;
            st.nodes.forEach(n => removeClass(n, 'cm-focus'));
            const cur = st.nodes[st.idx];
            if (cur) { addClass(cur, 'cm-focus'); try { cur.scrollIntoView?.({ block: 'nearest' }); } catch (e) {} }
        },
        move: (dir) => {
            const st = Modal.stack[Modal.stack.length - 1];
            if (!st?.nodes.length) return;
            const gridLen = st.gridLen || 0, last = st.nodes.length - 1, inGrid = st.idx < gridLen;
            let next = st.idx;
            if (inGrid) {
                if (dir === 'right') next = st.idx + 1 < gridLen ? st.idx + 1 : st.idx;
                else if (dir === 'left') next = st.idx - 1 >= 0 ? st.idx - 1 : st.idx;
                else if (dir === 'down') { const cand = st.idx + CHIP_COLS; next = cand < gridLen ? cand : Math.min(gridLen, last); }
                else if (dir === 'up') { const cand = st.idx - CHIP_COLS; next = cand >= 0 ? cand : st.idx; }
            } else {
                if (dir === 'down') next = clamp(st.idx + 1, 0, last);
                else if (dir === 'up') { const cand = st.idx - 1; next = cand >= gridLen ? cand : (gridLen > 0 ? gridLen - 1 : 0); }
            }
            st.idx = clamp(next, 0, last);
            Modal.paint();
        },
        enter: () => { const st = Modal.stack[Modal.stack.length - 1]; if (st) trigger(st.nodes[st.idx]); },
        close: () => {
            const st = Modal.stack.pop();
            if (!st) return;
            st.ov.remove();
            if (Modal.stack.length) Modal.paint(); else Nav.paint(true);
        },
        active: () => Modal.stack.length > 0
    };
    const askText = (title, value, cb) => {
        try {
            if (window.Lampa?.Input?.edit) { Lampa.Input.edit({ title, value: value || '', free: true }, (v) => { if (v) cb(v); }); return; }
        } catch (e) {}
        const input = el('input', 'cm-input');
        input.type = 'text';
        input.value = value || '';
        Modal.open({
            title, customNode: input,
            items: [{ label: '🔍 Найти', onSelect: () => { if (input.value) cb(input.value); } }, { label: 'Отмена' }]
        });
        input.onkeydown = (e) => { e.stopPropagation(); if (e.keyCode === 13 && input.value) { Modal.close(); cb(input.value); } };
        setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
    };

    // === ЭКРАН ===
    const View = {
        root: null, stage: null, glow: null,
        list: [], idx: 0,
        taste: null,
        sourceLabel: '',
        activeQuery: { kind: 'taste', label: 'КАПСУЛА', query: '' },
        busy: false,
        _lastBuiltAt: 0,

        create: () => {
            injectCSS();
            View.root = el('div', 'cm-root');
            View.root.appendChild(el('div', 'cm-sysline cm-mono'));
            Themes.apply(Themes.current(), View.root);
            View.root.appendChild(el('div', 'cm-stars'));
            View.glow = el('div', 'cm-glow');
            View.root.appendChild(View.glow);
            View.root.appendChild(el('div', 'cm-shade'));
            View.stage = el('div');
            View.stage.style.cssText = 'position:absolute;inset:0;';
            View.root.appendChild(View.stage);
            View.loading(Themes.loadLine());
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
                if (taste.empty && !Onboard.profile()) { View.busy = false; Onboard.start(); return; }
                Capsule.build(taste, { force }, (list) => {
                    View.busy = false;
                    View.sourceLabel = 'КАПСУЛА';
                    View.activeQuery = { kind: 'taste', label: 'КАПСУЛА', query: '' };
                    if (!list.length) { View.renderEmpty(); return; }
                    Capsule.remember(list.map(i => i.id));
                    View.list = list;
                    View.idx = 0;
                    View.render();
                });
            });
        },

        refreshCurrent: () => {
            if (View.busy) return;
            const q = View.activeQuery || { kind: 'taste' };
            if (q.kind === 'search' || q.kind === 'mood') { UI.find(q.query, q.label, q.kind, true); return; }
            View.refreshCapsule();
        },

        refreshCapsule: () => {
            if (View.busy) return;
            View.busy = true;
            View.loading(Themes.loadLine());
            Taste.build((taste) => {
                View.taste = taste;
                Capsule.build(taste, { force: true }, (list) => {
                    View.busy = false;
                    View.sourceLabel = 'КАПСУЛА';
                    View.activeQuery = { kind: 'taste', label: 'КАПСУЛА', query: '' };
                    if (!list.length) { View.renderEmpty(); return; }
                    Capsule.remember(list.map(i => i.id));
                    View.list = list;
                    View.idx = 0;
                    View.render();
                    notify('✅ Капсула обновлена');
                });
            });
        },

        renderEmpty: () => {
            View.stage.innerHTML = '';
            Nav.reset();
            const wrap = el('div', 'cm-stage');
            const port = el('div', 'cm-port');
            const hero = el('div', 'cm-hero');
            hero.appendChild(el('div', 'cm-meta', '<div class="cm-mchip src">КАПСУЛА ПУСТА</div>'));
            hero.appendChild(el('div', 'cm-name', 'Нечего показать'));
            hero.appendChild(el('div', 'cm-why', 'Нет истории Lampa или связи с TMDb. Пройди короткий тест — и капсула соберётся под твой вкус.'));
            const acts = el('div', 'cm-acts');
            const bTest = el('div', 'cm-act primary', '🧠 Пройти тест предпочтений');
            bTest._cmAction = () => Onboard.start();
            const bRetry = el('div', 'cm-act secondary', '🔄 Повторить');
            bRetry._cmAction = () => { Net.drop(); View.refreshCapsule(); };
            acts.appendChild(bTest); acts.appendChild(bRetry);
            hero.appendChild(acts);
            port.appendChild(hero);
            wrap.appendChild(port);
            View.stage.appendChild(wrap);
            Nav.addRow([bTest, bRetry], 'actions');
            Nav.setFocus(0, 0, true);
        },

        render: () => {
            const m = View.list[View.idx];
            if (!m) return View.renderEmpty();
            View._lastBuiltAt = Date.now();
            View.stage.innerHTML = '';
            Nav.reset();
            const wrap = el('div', 'cm-stage');
            const port = el('div', 'cm-port');

            const pos = el('div', 'cm-poster');
            if (m.poster_path) {
                const img = el('img');
                img.loading = 'lazy'; img.decoding = 'async';
                img.onload = () => addClass(img, 'ready');
                img.src = IMG + 'w500' + m.poster_path;
                pos.appendChild(img);
            }
            pos.appendChild(el('div', 'cm-rate cm-mono', '★ ' + (m.vote_average ? m.vote_average.toFixed(1) : '—')));
            let held = false, holdT = null;
            pos.addEventListener('click', () => { if (held) { held = false; return; } play(m); });
            pos.addEventListener('touchstart', () => { holdT = setTimeout(() => { held = true; holdT = null; View.details(m); }, 550); }, { passive: true });
            pos.addEventListener('touchend', () => { if (holdT) { clearTimeout(holdT); holdT = null; } }, { passive: true });
            port.appendChild(pos);

            const hero = el('div', 'cm-hero');
            const meta = el('div', 'cm-meta');
            const chipSrc = el('div', 'cm-mchip src cm-mono', esc(View.sourceLabel || 'КАПСУЛА') + ' · ' + pad2(View.idx + 1) + ' / ' + pad2(View.list.length));
            const year = parseInt(String(m.release_date || m.first_air_date || '').slice(0, 4), 10) || 0;
            const chipType = el('div', 'cm-mchip type cm-mono', m.media_type === 'tv' ? 'СЕРИАЛ' : 'ФИЛЬМ');
            const chipYear = el('div', 'cm-mchip cm-mono', '📅 ' + (year || '—'));
            meta.appendChild(chipSrc); meta.appendChild(chipType); meta.appendChild(chipYear);
            hero.appendChild(meta);

            hero.appendChild(el('div', 'cm-name', esc(m.title || m.name || '')));
            const genresBox = el('div', 'cm-genres');
            (m.genre_ids || []).slice(0, 3).forEach(gid => { if (GENRE_NAMES[gid]) genresBox.appendChild(el('div', 'cm-gchip', esc(GENRE_NAMES[gid]))); });
            hero.appendChild(genresBox);
            hero.appendChild(el('div', 'cm-why', esc(Capsule.reason(m, View.taste || {}))));
            const over = el('div', 'cm-over', esc(m.overview || 'Описание подгрузится…'));
            hero.appendChild(over);

            const acts = el('div', 'cm-acts');
            const bPlay = el('div', 'cm-act primary', I_PLAY + 'Смотреть');
            bPlay._cmAction = () => play(m);
            const bMore = el('div', 'cm-act secondary', I_SEARCH + 'Узнать больше');
            bMore._cmAction = () => View.details(m);
            acts.appendChild(bPlay); acts.appendChild(bMore);
            hero.appendChild(acts);
            port.appendChild(hero);
            wrap.appendChild(port);

            const bar = el('div', 'cm-bar');
            const bSet = el('div', 'cm-bar-btn', I_GEAR + '<span class="lbl">Настройки</span>');
            bSet._cmAction = () => UI.settings();
            const bChange = el('div', 'cm-bar-btn center cm-mono', I_CHANGE + '<span class="lbl">изменить набор</span>');
            bChange._cmAction = () => UI.changeSet();
            const bSearch = el('div', 'cm-bar-btn', I_SEARCH);
            bSearch._cmAction = () => UI.ask();
            bar.appendChild(bSet); bar.appendChild(bChange); bar.appendChild(bSearch);
            wrap.appendChild(bar);

            View.stage.appendChild(wrap);
            Nav.addRow([bPlay, bMore], 'actions');
            Nav.addRow([bSet, bChange, bSearch], 'bar');
            Nav.setFocus(0, 0, true);
            View.setGlow(m);
            View.preload();
            View.enrich(m, { type: chipType, over, genres: genresBox });
        },

        enrich: (m, refs) => {
            const type = m.media_type === 'tv' ? 'tv' : 'movie';
            Net.get(`/${type}/${m.id}`, {}, (d) => {
                if (View.list[View.idx] !== m) return;
                if (refs.type) refs.type.textContent = type === 'tv' ? `СЕРИАЛ (${d.number_of_seasons || 1} СЕЗ.)` : (d.runtime ? `ФИЛЬМ (${fmtRuntime(d.runtime).toUpperCase()})` : 'ФИЛЬМ');
                if (refs.over && !m.overview && d.overview) refs.over.textContent = d.overview;
                if (refs.genres && d.genres?.length) { refs.genres.innerHTML = ''; d.genres.slice(0, 3).forEach(g => refs.genres.appendChild(el('div', 'cm-gchip', esc(g.name)))); }
            }, () => {}, { ttl: 604800000 });
        },

        preload: () => {
            [1, -1].forEach(d => {
                const it = View.list[(View.idx + d + View.list.length) % View.list.length];
                if (it?.poster_path) { const im = new Image(); im.src = IMG + 'w342' + it.poster_path; }
            });
        },

        setGlow: (m) => {
            if (!View.glow) return;
            if (!pGet('glow', true)) { removeClass(View.glow, 'on'); return; }
            const url = m.backdrop_path ? IMG + 'w780' + m.backdrop_path : (m.poster_path ? IMG + 'w342' + m.poster_path : '');
            if (!url || View.glow._url === url) { if (url) addClass(View.glow, 'on'); return; }
            View.glow._url = url;
            View.glow.style.backgroundImage = `url(${url})`;
            addClass(View.glow, 'on');
        },

        showFound: (label, list, kind, query) => {
            View.busy = false;
            if (!list.length) { notify('😕 Ничего не нашлось'); return; }
            const top = list.slice(0, CAPSULE_SIZE);
            Capsule.remember(top.map(i => i.id));
            View.list = top;
            View.idx = 0;
            View.sourceLabel = String(label || 'ПОИСК').slice(0, 22);
            View.activeQuery = { kind: kind || 'search', label: View.sourceLabel, query: query || label };
            View.render();
        },

        details: (m) => {
            if (!m) return;
            const type = m.media_type === 'tv' ? 'tv' : 'movie';
            Modal.open({ title: '⏳ Загрузка…', items: [{ label: 'Закрыть' }] });
            Net.get(`/${type}/${m.id}`, {}, (d) => {
                Modal.close();
                const title = d.title || d.name || '';
                const year = (d.release_date || d.first_air_date || '').slice(0, 4);
                const genres = (d.genres || []).map(g => g.name).join(', ');
                const score = d.vote_average ? d.vote_average.toFixed(1) : '—';
                let html = `<b>${esc(title)}</b>${year ? ' (' + year + ')' : ''} · ★ ${score}${d.runtime ? ' · ' + fmtRuntime(d.runtime) : ''}`;
                if (genres) html += `<br>${esc(genres)}`;
                html += `<br><br>${esc(d.overview || 'Описания нет.')}`;
                Modal.open({
                    title: 'Подробнее', text: html,
                    items: [{ label: '▶ Смотреть', onSelect: () => play(m) }, { label: 'Закрыть' }]
                });
            }, () => { Modal.close(); notify('Не загрузилось'); });
        },

        go: (i) => {
            if (i < 0 || i >= View.list.length || i === View.idx) return;
            const r = Nav.r, c = Nav.c;
            View.idx = i;
            View.render();
            Nav.setFocus(r, c, true);
        },

        step: (delta) => {
            if (!View.list.length || View.busy) return;
            let next = View.idx + delta;
            if (next >= View.list.length) next = 0;
            if (next < 0) next = View.list.length - 1;
            View.go(next);
        }
    };

    // === ИНТЕРФЕЙС ===
    const UI = {
        settings: () => {
            Modal.open({
                title: '⚙️ Настройки',
                items: [
                    { label: `🎨 Тема: ${THEMES[Themes.current()].name}`, onSelect: () => UI.themes() },
                    { label: `💡 Свет от постера: ${pGet('glow', true) ? 'вкл' : 'выкл'}`, onSelect: () => { pSet('glow', !pGet('glow', true)); View.setGlow(View.list[View.idx]); UI.settings(); } },
                    { label: `🪐 Космический эксперимент: ${pGet(EXPERIMENT_KEY, false) ? 'вкл' : 'выкл'}`, hint: 'добавляет орбиты, частицы и мягкие космические переходы', onSelect: () => { pSet(EXPERIMENT_KEY, !pGet(EXPERIMENT_KEY, false)); ThemeFX.refresh(View.root); UI.settings(); } },
                    { label: '🧠 Пройти тест предпочтений', hint: 'пересобрать вкус с нуля', onSelect: () => Onboard.start() },
                    { label: '🔑 Свой ключ TMDb', hint: pGet('tmdb_key', '') ? 'задан' : 'встроенный', onSelect: () => Settings.askKey() },
                    { label: '🗑️ Сбросить историю показов', onSelect: () => { Capsule.forget(); notify('История показов сброшена'); } },
                    { label: '🚫 Закрыть' }
                ]
            });
        },
        themes: () => {
            const items = THEME_ORDER.map(key => ({
                label: (Themes.current() === key ? '● ' : '○ ') + THEMES[key].name,
                onSelect: () => { Themes.set(key); notify(`🎨 Тема: ${THEMES[key].name}`); if (View.list.length) View.render(); else View.renderEmpty(); }
            }));
            items.push({ label: '↩️ Назад', onSelect: () => UI.settings() });
            Modal.open({ title: 'Оформление', items });
        },
        changeSet: () => {
            Modal.open({
                title: '🔀 Изменить набор',
                items: [
                    { label: '🔄 Обновить этот набор', hint: 'другие варианты по той же логике', onSelect: () => View.refreshCurrent() },
                    { label: '🎭 Выбрать по настроению', onSelect: () => UI.moods() },
                ]
            });
        },
        moods: () => {
            Modal.open({
                title: '🎭 Настроение',
                chips: MOODS.map(md => ({ label: md.label, onSelect: () => UI.find(md.q, md.label, 'mood') })),
                items: [{ label: '↩️ Назад', onSelect: () => UI.changeSet() }]
            });
        },
        ask: () => {
            const cats = [
                ['😱 Ужасы', 'ужасы'], ['👨‍👩‍👧 Детское', 'детское'], ['😂 Комедия', 'комедия'], ['⚔️ Боевик', 'боевик'],
                ['🕵️ Детектив', 'детектив'], ['🚀 Фантастика', 'фантастика'], ['🐉 Фэнтези', 'фэнтези'], ['💘 Мелодрама', 'мелодрама'],
                ['🎬 Анимация', 'анимация'], ['🔫 Криминал', 'криминал'], ['🌧️ Триллер', 'триллер'], ['📚 Драма', 'драма'],
                ['⭐ Лучшее', 'лучшие фильмы'], ['🆕 Новинки', 'новинки']
            ];
            Modal.open({
                title: '🔎 Поиск по категории',
                text: 'Поиск по точному названию отключён. Выберите жанр или тип подборки.',
                chips: cats.map(x => ({ label: x[0], onSelect: () => UI.find(x[1], x[0], 'search') })),
                items: [{ label: 'Отмена' }]
            });
        },
        find: (query, label, kind, force) => {
            if (!query || View.busy) return;
            View.busy = true;
            View.loading(`ИЩУ: ${String(query).toUpperCase().slice(0, 24)}`);
            Search.run(query, View.taste, (list) => View.showFound(label || query, list, kind || 'search', query), !!force);
        }
    };

    const Settings = {
        askKey: () => askText('Ключ TMDb', pGet('tmdb_key', ''), (v) => {
            pSet('tmdb_key', v.trim());
            Net.drop();
            notify('🔑 Ключ сохранён');
        })
    };

    try { window.addEventListener('resize', () => ThemeFX.resize(), { passive: true }); } catch (e) {}

    // === LAMPA ===
    const play = (m) => {
        try {
            if (window.Lampa?.Activity) {
                Lampa.Activity.push({ url: '', component: 'full', id: m.id, method: m.media_type === 'tv' ? 'tv' : 'movie', card: m, source: 'tmdb' });
                return;
            }
        } catch (e) {}
        notify('Lampa не отвечает');
    };
    const exitApp = () => {
        try { if (window.Lampa?.Activity) { Lampa.Activity.backward(); return; } } catch (e) {}
        try { history.back(); } catch (e) {}
    };

    // === КЛАВИШИ ===
    const KEYS = { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 32: 'enter', 8: 'back', 27: 'back', 461: 'back', 10009: 'back' };
    let lastStepAt = 0;
    const route = (kind) => {
        if (Modal.active()) {
            if (kind === 'back') Modal.close();
            else if (kind === 'enter') Modal.enter();
            else Modal.move(kind);
            return;
        }
        if (Onboard.active) {
            if (kind === 'back') { Onboard.back(); return; }
            if (kind === 'enter') { Nav.enter(); return; }
            if (kind === 'left' || kind === 'right') { Nav.moveH(kind); return; }
            Nav.move(kind);
            return;
        }
        if (kind === 'left' || kind === 'right') {
            if (!Nav.moveH(kind)) {
                const now = Date.now();
                if (now - lastStepAt > 240) { lastStepAt = now; View.step(kind === 'right' ? 1 : -1); }
            }
            return;
        }
        if (kind === 'enter') { Nav.enter(); return; }
        if (kind === 'back') {
            if (View.activeQuery.kind !== 'taste') { View.loading(Themes.loadLine()); View.boot(false); }
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

    // === КОМПОНЕНТ ===
    const App = { active: false, fallback: false };
    const CapsuleComponent = function () {
        let node = null, wrapped = null;
        this.create = () => { node = View.create(); wrapped = window.$ ? window.$(node) : node; return this.render(); };
        this.render = () => wrapped;
        this.start = () => {
            App.active = true;
            if (App._enteredBefore && (Date.now() - (View._lastBuiltAt || 0) > 4000) && !View.list.length && !Onboard.active) View.refreshCapsule();
            App._enteredBefore = true;
            let ok = false;
            try { ok = !!(window.Lampa?.Controller?.add); } catch (e) {}
            if (ok) {
                Lampa.Controller.add(CTRL_ID, {
                    toggle: () => { try { Lampa.Controller.clear(); } catch (e) {} Nav.paint(true); },
                    up: () => route('up'), down: () => route('down'), left: () => route('left'),
                    right: () => route('right'), enter: () => route('enter'), back: () => route('back')
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
            ThemeFX.stop();
            if (node?.parentNode) node.parentNode.removeChild(node);
            node = null; wrapped = null;
            Nav.reset();
        };
    };

    // === МЕНЮ ===
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
                item.on('hover:enter click', () => { try { Lampa.Activity.push({ url: '', title: 'Капсула', component: COMPONENT_ID, page: 1 }); } catch (e) {} });
                list.append(item);
                done = true;
            } catch (e) {}
        };
        if (window.appready) tryAdd();
        try { if (window.Lampa?.Listener) Lampa.Listener.follow('app', (e) => { if (e.type === 'ready') tryAdd(); }); } catch (e) {}
        setTimeout(tryAdd, 1500);
        setTimeout(tryAdd, 4000);
    };

    (() => {
        try {
            if (window.Lampa?.Component?.add) window.Lampa.Component.add(COMPONENT_ID, CapsuleComponent);
            addMenu();
            console.log('[Капсула] v17.1 загружена (до 100 рекомендаций)');
        } catch (e) { console.error('[Капсула] ошибка старта:', e); }
    })();
})();
