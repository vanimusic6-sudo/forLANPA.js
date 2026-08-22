/**
 * Capsule Mod v17.2 — «Капсула»
 *
 * Изменения в v17.2:
 *  — На смартфонах интерфейс опущен чуть ниже (padding-top увеличен).
 *  — Остальные элементы без изменений.
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
    const CAPSULE_SIZE = 100;

    // === УТИЛИТЫ ===
    const el = (tag, cls, html) => { const d = document.createElement(tag || 'div'); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
    const hasClass = (n, c) => !!n && (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1;
    const addClass = (n, c) => { if (n && !hasClass(n, c)) n.className += (n.className ? ' ' : '') + c; };
    const removeClass = (n, c) => { if (!n) return; n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/\s+/g, ' ').trim(); };
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const isArr = (v) => Array.isArray(v);
    const rnd = (n) => Math.floor(Math.random() * n);
    const pick = (arr) => arr[rnd(arr.length)];
    const vibrate = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
    const fmtRuntime = (min) => min ? (min >= 60 ? Math.floor(min / 60) + ' ч ' + (min % 60) + ' мин' : min + ' мин') : '';
    const hexRgb = (hex) => {
        let h = String(hex || '').trim().replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        const n = parseInt(h, 16);
        if (isNaN(n) || h.length !== 6) return '255,255,255';
        return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
    };
    const reducedMotion = () => { try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

    // === LAMPA READY + ХРАНИЛИЩЕ ===
    const LampaReady = { ready: false, waiters: [] };
    const onLampaReady = (cb) => { if (LampaReady.ready) { cb(); return; } LampaReady.waiters.push(cb); };
    const flushReady = () => { LampaReady.ready = true; LampaReady.waiters.forEach(cb => { try { cb(); } catch (e) { console.error(e); } }); LampaReady.waiters = []; };
    try { if (window.Lampa?.Listener?.follow) Lampa.Listener.follow('app', (e) => { if (e?.type === 'ready') flushReady(); }); } catch (e) { console.error(e); }
    setTimeout(flushReady, 2500);

    const pGet = (key, def) => { try { const v = JSON.parse(localStorage.getItem('cm_' + key)); return v === null || v === undefined ? def : v; } catch (e) { return def; } };
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
            xhr.onerror = () => { if (!settled) { settled = true; if (fail) fail('net'); } };
            xhr.ontimeout = () => { if (!settled) { settled = true; if (fail) fail('timeout'); } };
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
        { m: [12], t: [10759], w: ['приключен', 'adventure'] }, { m: [16], t: [16], w: ['мультф', 'мультик', 'мульт', 'анимац', 'animation'] },
        { m: [35], t: [35], w: ['комед', 'смешн', 'юмор', 'ржач', 'посмеят', 'весел', 'comedy'] },
        { m: [80], t: [80], w: ['криминал', 'мафи', 'бандит', 'гангстер', 'crime'] }, { m: [99], t: [99], w: ['документал', 'научпоп', 'docum'] },
        { m: [18], t: [18], w: ['драм', 'грустн', 'жизненн', 'тяжел', 'drama'] }, { m: [10751], t: [10751], w: ['семейн', 'детск', 'family', 'с ребенком'] },
        { m: [14], t: [10765], w: ['фэнтези', 'фентези', 'магия', 'волшебн', 'сказк', 'fantasy'] },
        { m: [27], t: [9648], w: ['ужас', 'страшн', 'хоррор', 'жутк', 'кошмар', 'horror'] },
        { m: [9648], t: [9648], w: ['детектив', 'загадк', 'расследован', 'тайн', 'нуар', 'noir', 'mystery'] },
        { m: [10749], t: [18], w: ['мелодрам', 'романтик', 'романт', 'любов', 'romance'] },
        { m: [878], t: [10765], w: ['фантастик', 'sci-fi', 'scifi', 'киберпанк', 'инопланет'] },
        { m: [53], t: [9648], w: ['триллер', 'напряж', 'саспенс', 'thriller'] }, { m: [37], t: [37], w: ['вестерн', 'ковбо', 'western'] },
        { m: [10752], t: [10768], w: ['военн', 'война', 'фронт', 'war'] }, { m: [10402], t: [10402], w: ['мюзикл', 'музыкальн', 'music'] },
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
        { w: ['рождеств', 'новогодн'], k: 'christmas' }
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
                            if (!Object.prototype.hasOwnProperty.call(timeline, tk)) continue;
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
            notify('Предпочтения сохранены');
            View.refreshCapsule();
        },
        renderStep: () => {
            View.stage.innerHTML = '';
            Nav.reset();
            const outer = el('div', 'cm-onb');
            const wrap = el('div', 'cm-onb-inner');
            outer.appendChild(wrap);
            const s = Onboard.step, d = Onboard.data;
            wrap.appendChild(el('div', 'cm-onb-head cm-mono', `ШАГ ${s + 1} / 4`));
            let firstRow = null;

            if (s === 0) {
                wrap.appendChild(el('div', 'cm-onb-title', 'Что вы смотрели или слышали?'));
                wrap.appendChild(el('div', 'cm-onb-sub', 'Отметьте знакомое — с этого начнётся подбор.'));
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
                wrap.appendChild(el('div', 'cm-onb-title', 'Какие жанры нравятся?'));
                wrap.appendChild(el('div', 'cm-onb-sub', 'Чем больше отметите, тем точнее подбор.'));
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
                wrap.appendChild(el('div', 'cm-onb-title', 'Какая эпоха ближе?'));
                wrap.appendChild(el('div', 'cm-onb-sub', 'Необязательно — этот шаг можно пропустить.'));
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
                wrap.appendChild(el('div', 'cm-onb-title', 'Настроение на сегодняшний вечер?'));
                wrap.appendChild(el('div', 'cm-onb-sub', 'Соберём стартовый набор под него.'));
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
            if (s > 0) mkBtn('Назад', false, () => Onboard.back());
            mkBtn('Пропустить', false, () => (s === 3 ? Onboard.finish() : Onboard.next()));
            if (s < 3) mkBtn('Далее', true, () => Onboard.next());
            else mkBtn('Готово', true, () => Onboard.finish());
            const footRow = el('div', 'cm-onb-foot');
            foot.forEach(b => footRow.appendChild(b));
            wrap.appendChild(footRow);
            View.stage.appendChild(outer);
            Nav.addRow(foot, 'foot');
            Nav.setFocus(firstRow != null ? 0 : Nav.rows.length - 1, 0, true);
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
        remember: (ids) => { let s = Capsule.shown().concat(ids); if (s.length > 80) s = s.slice(s.length - 80); pSet('shown', s); },
        forget: () => pSet('shown', []),
        build: (taste, opts, cb) => {
            const force = !!opts?.force, tasks = [], topG = taste.genres || [], topK = taste.keywords || [];
            const pages = force ? [2, 3, 4, 5] : [1, 2, 3, 4];
            const addPaged = (path, base, type, src, via) => pages.forEach(page => {
                tasks.push(done => Net.get(path, Object.assign({}, base, { page }), (d) => done(markList(d?.results, type, src, via)), () => done([]), { force }));
            });

            (taste.seeds || []).slice(0, 5).forEach(seed => {
                [1, 2, 3].forEach(page => tasks.push(done =>
                    Net.get(`/${seed.type}/${seed.id}/recommendations`, { page }, (d) =>
                        done(markList(d?.results, seed.type, 'seed', { seed: seed.title })), () => done([]), { force })
                ));
            });

            if (topG.length) {
                addPaged('/discover/movie', {
                    with_genres: topG.slice(0, 3).map(g => g.id).join(','),
                    sort_by: 'popularity.desc',
                    'vote_count.gte': 150,
                    'vote_average.gte': clamp(taste.avgVote ? taste.avgVote - 0.7 : 6.2, 5.9, 7.4),
                    include_adult: false
                }, 'movie', 'genre');
                addPaged('/discover/tv', {
                    with_genres: topG.slice(0, 3).map(g => TV2MOVIE[g.id] || g.id).join(','),
                    sort_by: 'popularity.desc',
                    'vote_count.gte': 80,
                    'vote_average.gte': 6.1,
                    include_adult: false
                }, 'tv', 'genre');
            }

            if (topK.length) {
                addPaged('/discover/movie', {
                    with_keywords: topK.slice(0, 5).map(k => k.id).join('|'),
                    sort_by: 'popularity.desc',
                    'vote_count.gte': 80,
                    'vote_average.gte': 6.0,
                    include_adult: false
                }, 'movie', 'keyword', { kw: topK[0]?.name });
            }

            addPaged('/discover/movie', {
                sort_by: force ? 'vote_average.desc' : 'popularity.desc',
                'vote_count.gte': 250,
                'vote_average.gte': 6.8,
                include_adult: false
            }, 'movie', 'top');

            [1, 2, 3].forEach(page => tasks.push(done =>
                Net.get('/trending/all/week', { page }, (d) =>
                    done(markList(d?.results, null, 'trend')), () => done([]), { force })
            ));

            parallel(tasks, (packs) => {
                const all = packs.flat().filter(Boolean);
                const picked = Capsule.pick(all, taste, force);
                if (picked.length < CAPSULE_SIZE && topG.length) {
                    const fallbackTasks = [1, 2, 3].map(page => done =>
                        Net.get('/discover/movie', {
                            with_genres: topG[0].id,
                            sort_by: 'vote_average.desc',
                            'vote_count.gte': 300,
                            'vote_average.gte': 6.7,
                            page,
                            include_adult: false
                        }, (d) => done(markList(d?.results, 'movie', 'relax')), () => done([]), { force })
                    );
                    parallel(fallbackTasks, extra => cb(Capsule.pick(all.concat(extra.flat()), taste, force)));
                } else cb(picked);
            });
        },
        pick: (all, taste, force) => {
            const seen = {}, out = [], shownSet = new Set(Capsule.shown()), gWeight = {};
            (taste.genres || []).forEach(g => { gWeight[g.id] = g.score; });
            const maxG = taste.genres?.length ? taste.genres[0].score : 1;
            all.forEach(it => {
                const key = it.media_type + '_' + it.id;
                if (seen[key]) { seen[key]._score += 3.5; seen[key]._multi = true; return; }
                if (taste.watched?.[it.id] || shownSet.has(it.id) || !it.vote_average || it.vote_average < 5.8 || (it.vote_count || 0) < 60) return;
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

            const bySrc = {}, chosen = new Set(), final = [];
            const take = (item) => { if (chosen.has(item)) return false; chosen.add(item); final.push(item); return true; };
            for (let i = 0; i < out.length && final.length < CAPSULE_SIZE - 1; i++) {
                const src = out[i]._src || 'x';
                bySrc[src] = (bySrc[src] || 0) + 1;
                if (bySrc[src] > 3) continue;
                take(out[i]);
            }
            const topId = taste.genres?.length ? taste.genres[0].id : 0;
            for (let i = 0; i < out.length; i++) {
                if (chosen.has(out[i])) continue;
                const inTop = topId && (out[i].genre_ids || []).some(gid => (TV2MOVIE[gid] || gid) === topId);
                if (!inTop && out[i].vote_average >= 6.6) { take(out[i]); break; }
            }
            for (let i = 0; final.length < CAPSULE_SIZE && i < out.length; i++) take(out[i]);
            return final;
        },
        reason: (item, taste) => {
            if (item._reasonText) return item._reasonText;
            let r = '';
            if (item._src === 'seed' && item._via?.seed) r = `Похоже на «${item._via.seed}»`;
            else if (item._src === 'keyword' && item._via?.kw) r = `Тема: «${item._via.kw}»`;
            else if (item._src === 'genre' || item._src === 'relax') {
                const names = [];
                for (let i = 0; i < (taste.genres || []).length && names.length < 2; i++) if ((item.genre_ids || []).includes(taste.genres[i].id) && taste.genres[i].name) names.push(taste.genres[i].name);
                r = names.length ? `Ваши жанры: ${names.join(' и ')}` : 'Высокий рейтинг';
            } else if (item._src === 'search') r = item._via?.query ? `По запросу «${item._via.query}»` : 'Найдено по запросу';
            else r = 'Высокий рейтинг';
            if (item._multi) r += ' · совпало по нескольким признакам';
            return (item._reasonText = r);
        }
    };

    // === ПОИСК ===
    const parseQuery = (raw) => {
        const q = String(raw || '').toLowerCase().replace(/ё/g, 'е');
        const ctx = { raw, genresM: [], genresT: [], tags: [], tokens: [], type: 'any', yearFrom: 0, yearTo: 0, minVote: 5.8, minVotes: 40 };
        if (/сериал|сезон|series/.test(q)) ctx.type = 'tv'; else if (/фильм|кино|movie/.test(q)) ctx.type = 'movie';
        GENRE_SYN.forEach(g => g.w.forEach(w => { if (q.includes(w)) { ctx.genresM.push(...g.m); ctx.genresT.push(...g.t); } }));
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
                const tasks = [], pages = force ? [2, 3, 4, 5] : [1, 2, 3, 4];
                const discover = (media, page) => {
                    const p = { sort_by: 'popularity.desc', include_adult: false, page, 'vote_count.gte': ctx.minVotes, 'vote_average.gte': ctx.minVote };
                    const g = media === 'tv' ? ctx.genresT : ctx.genresM;
                    if (g.length) p.with_genres = g.slice(0, 3).join(',');
                    if (kwIds.length) p.with_keywords = kwIds.join('|');
                    if (ctx.yearFrom) {
                        if (media === 'tv') { p['first_air_date.gte'] = `${ctx.yearFrom}-01-01`; p['first_air_date.lte'] = `${ctx.yearTo}-12-31`; }
                        else { p['primary_release_date.gte'] = `${ctx.yearFrom}-01-01`; p['primary_release_date.lte'] = `${ctx.yearTo}-12-31`; }
                    }
                    return p;
                };
                pages.forEach(page => {
                    if (ctx.type !== 'tv') tasks.push(done => Net.get('/discover/movie', discover('movie', page), (d) => done(markList(d?.results, 'movie', 'search', { query })), () => done([]), { force }));
                    if (ctx.type !== 'movie') tasks.push(done => Net.get('/discover/tv', discover('tv', page), (d) => done(markList(d?.results, 'tv', 'search', { query })), () => done([]), { force }));
                    if (ctx.tokens.length) tasks.push(done => Net.get('/search/multi', { query, page, include_adult: false }, (d) => done(markList(d?.results, null, 'search', { query })), () => done([]), { force }));
                });
                parallel(tasks, (packs) => cb(Search.rank(packs.flat().filter(Boolean), ctx, taste, force), ctx));
            });
        },
        rank: (list, ctx, taste, force) => {
            const out = [], seen = {}, shownSet = new Set(Capsule.shown()), stems = ctx.tokens.map(stem), gWeight = {};
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
                if (shownSet.has(it.id)) s -= 6;
                if (force) s += Math.random() * 1.2;
                it._score = s; seen[key] = it; out.push(it);
            });
            out.sort((a, b) => b._score - a._score);
            const fresh = out.filter(it => !shownSet.has(it.id));
            return (fresh.length >= CAPSULE_SIZE ? fresh : out).slice(0, CAPSULE_SIZE);
        }
    };

    // === ТЕМЫ ===
    const THEMES = {
        astro: {
            name: 'Космос', cls: 'cm-t-astro', fx: 'astro', sys: 'ORBITAL UPLINK: ESTABLISHED',
            quotes: ['«Хьюстон, у нас проблема»', '«Космос ждёт»'],
            load: ['ПРОКЛАДЫВАЮ КУРС', 'СОБИРАЮ КАПСУЛУ'],
            vars: { '--cm-bg': '#05070D', '--cm-accent': '#FF7A2F', '--cm-accent2': '#7FD8FF', '--cm-text': '#E8ECF5', '--cm-sub': '#8695AC', '--cm-radius': '1.2em' }
        },
        breakingbad: {
            name: 'Лаборатория', cls: 'cm-t-bb', fx: 'lab', sys: 'LAB NET: HEISENBERG // ONLINE',
            quotes: ['«Скажи моё имя»', '«Химия — это сила»'],
            load: ['ВАРЮ СИНЬКУ', 'СОБИРАЮ КАПСУЛУ'],
            vars: { '--cm-bg': '#0B0E08', '--cm-accent': '#D6E24A', '--cm-accent2': '#1FAE96', '--cm-text': '#EDF2E0', '--cm-sub': '#9AAE8C', '--cm-radius': '.6em' }
        },
        matrix: {
            name: 'Матрица', cls: 'cm-t-matrix', fx: 'matrix', sys: 'SYSTEM_KERNEL: NEBUCHADNEZZAR // ONLINE',
            quotes: ['«Ложки нет»', '«Следуй за белым кроликом»'],
            load: ['ДЕШИФРУЮ КОД', 'СОБИРАЮ КАПСУЛУ'],
            vars: { '--cm-bg': '#000600', '--cm-accent': '#00FF41', '--cm-accent2': '#00B32E', '--cm-text': '#C8FFD4', '--cm-sub': '#4E9E5E', '--cm-radius': '.4em' }
        },
        panda: {
            name: 'Свиток', cls: 'cm-t-panda', fx: 'scroll', sys: 'SCROLL OF DESTINY: OPEN',
            quotes: ['«Случайностей не бывает»', '«Твоё время настало»'],
            load: ['ЧИТАЮ СВИТКИ', 'СОБИРАЮ КАПСУЛУ'],
            vars: { '--cm-bg': '#1C140B', '--cm-accent': '#D8433C', '--cm-accent2': '#E7B65C', '--cm-text': '#F4E9D2', '--cm-sub': '#B79E7B', '--cm-radius': '.9em' }
        },
        rickmorty: {
            name: 'Портал', cls: 'cm-t-rm', fx: 'portal', sys: 'PORTAL GUN: CHARGED // C-137',
            quotes: ['«Вубба-лубба-даб-даб»'],
            load: ['ПРЫГАЮ ЧЕРЕЗ ПОРТАЛ', 'СОБИРАЮ КАПСУЛУ'],
            vars: { '--cm-bg': '#07141B', '--cm-accent': '#7CFF6B', '--cm-accent2': '#3AD1FF', '--cm-text': '#E6FFF1', '--cm-sub': '#6FA894', '--cm-radius': '1.1em' }
        },
        starwars: {
            name: 'Галактика', cls: 'cm-t-sw', fx: 'galaxy', sys: 'HOLONET LINK: ACTIVE',
            quotes: ['«Да пребудет с тобой Сила»'],
            load: ['ГИПЕРПРЫЖОК', 'СОБИРАЮ КАПСУЛУ'],
            vars: { '--cm-bg': '#020409', '--cm-accent': '#FFE81F', '--cm-accent2': '#4BD5FF', '--cm-text': '#F2F4F8', '--cm-sub': '#8C93A0', '--cm-radius': '.8em' }
        },
        noir: {
            name: 'Нуар', cls: 'cm-t-noir', fx: 'noir', sys: 'CASE #1947: OPEN',
            quotes: ['«Забудь её, Джейк»', '«В этом городе все врут»', '«Туман всё скроет»', '«Свет фонаря — единственная правда»'],
            load: ['ЛИСТАЮ ДЕЛО', 'ПРОВЕРЯЮ УЛИКИ', 'СОБИРАЮ КАПСУЛУ'],
            vars: { '--cm-bg': '#0B0B0B', '--cm-accent': '#E6E6E6', '--cm-accent2': '#B48A3C', '--cm-text': '#EDEDED', '--cm-sub': '#8A8A8A', '--cm-radius': '.3em' }
        },
        inception: {
            name: 'Сон', cls: 'cm-t-inception', fx: 'inception', sys: 'LIMBO LEVEL: 01 // STABLE',
            quotes: ['«Как долго мы здесь?»', '«Ты ждёшь поезд»', '«Не бойся глубины»', '«Время здесь течёт иначе»'],
            load: ['ПОГРУЖАЮСЬ В СОН', 'НАСТРАИВАЮ ГЛУБИНУ'],
            vars: { '--cm-bg': '#0A0A0C', '--cm-accent': '#E9B487', '--cm-accent2': '#C98A5E', '--cm-text': '#F1E8DF', '--cm-sub': '#8B8279', '--cm-radius': '1em' }
        },
        dune: {
            name: 'Арракис', cls: 'cm-t-dune', fx: 'dune', sys: 'ARRAKIS // DEEP DESERT',
            quotes: ['«Страх — убийца разума»', '«Пустыня помнит всё»', '«Слушай ветер»', '«Следуй за ритмом песка»'],
            load: ['СЛУШАЮ ПЕСКИ', 'НАСТРАИВАЮ КОМПАС'],
            vars: { '--cm-bg': '#17100A', '--cm-accent': '#E7B46A', '--cm-accent2': '#8EC7B1', '--cm-text': '#F4E7D1', '--cm-sub': '#AA9274', '--cm-radius': '1.05em' }
        },
        bladerunner: {
            name: 'Неон', cls: 'cm-t-blade', fx: 'blade', sys: 'LOS ANGELES // 2049',
            quotes: ['«Я видел то, во что вы не поверите»', '«Память — это тоже история»', '«Город никогда не спит»', '«Ищи свет в дожде»'],
            load: ['ВКЛЮЧАЮ НЕОН', 'СИНХРОНИЗИРУЮ ПАМЯТЬ'],
            vars: { '--cm-bg': '#090D16', '--cm-accent': '#F2B6FF', '--cm-accent2': '#74E5FF', '--cm-text': '#EEF7FF', '--cm-sub': '#788DA1', '--cm-radius': '.75em' }
        },
        dreamworks: {
            name: 'Тихий вечер', cls: 'cm-t-dream', fx: 'dream', sys: 'SLOW EVENING // PLAY',
            quotes: ['«Сегодня можно никуда не спешить»', '«Выбери историю и выдохни»', '«Оставь шум за дверью»', '«Пусть фильм найдёт тебя»'],
            load: ['НАСТРАИВАЮ ТИШИНУ', 'СОБИРАЮ ВЕЧЕР'],
            vars: { '--cm-bg': '#080C16', '--cm-accent': '#B9C7FF', '--cm-accent2': '#A9E7D5', '--cm-text': '#EAF0FF', '--cm-sub': '#77839C', '--cm-radius': '1.25em' }
        }
    };
    const THEME_ORDER = ['astro', 'breakingbad', 'matrix', 'panda', 'rickmorty', 'starwars', 'noir', 'inception', 'dune', 'bladerunner', 'dreamworks'];

    // === ФОНОВЫЕ СЦЕНЫ ===
    const SCENES = {
        astro: () => {
            const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: .4 + Math.random() * 1.2, p: Math.random() * 6.28, v: .004 + Math.random() * .014 }));
            let shoot = null, wait = 4 + Math.random() * 8, t = 0;
            return {
                step: 1000 / 30,
                draw(ctx, W, H, dt) {
                    t += dt;
                    stars.forEach(s => {
                        s.x -= s.v * dt * .08;
                        if (s.x < -.02) { s.x = 1.02; s.y = Math.random(); }
                        ctx.globalAlpha = .12 + .14 * Math.sin(t * 1.2 + s.p);
                        ctx.fillStyle = '#DCE9FF';
                        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.283); ctx.fill();
                    });
                    const cx = W * .5, cy = H * .5, base = Math.min(W, H);
                    ctx.lineWidth = 1;
                    for (let i = 0; i < 3; i++) {
                        ctx.globalAlpha = .05 - i * .012;
                        ctx.strokeStyle = i % 2 ? '#7FD8FF' : '#FF7A2F';
                        ctx.beginPath();
                        ctx.ellipse(cx, cy, base * (.30 + i * .17), base * (.13 + i * .075), Math.sin(t * .05 + i) * .22, 0, 6.283);
                        ctx.stroke();
                    }
                    wait -= dt;
                    if (!shoot && wait <= 0) { shoot = { x: .1 + Math.random() * .6, y: Math.random() * .5, p: 0 }; wait = 7 + Math.random() * 11; }
                    if (shoot) {
                        shoot.p += dt * .55;
                        if (shoot.p >= 1) shoot = null;
                        else {
                            const x = (shoot.x + shoot.p * .3) * W, y = (shoot.y + shoot.p * .18) * H, len = base * .06;
                            ctx.globalAlpha = .28 * Math.sin(shoot.p * Math.PI);
                            ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.2;
                            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len, y - len * .6); ctx.stroke();
                        }
                    }
                    ctx.globalAlpha = 1;
                }
            };
        },
        lab: () => {
            const mk = (bottom) => ({
                x: .05 + Math.random() * .9,
                y: bottom ? 1.05 + Math.random() * .35 : Math.random(),
                r: 3 + Math.random() * 14,
                v: .02 + Math.random() * .06,
                w: Math.random() * 6.28,
                ws: .4 + Math.random() * .8
            });
            const bubbles = Array.from({ length: 30 }, () => mk(false));
            let t = 0;
            return {
                step: 1000 / 30,
                draw(ctx, W, H, dt) {
                    t += dt;
                    bubbles.forEach(b => {
                        b.y -= b.v * dt;
                        b.x += Math.sin(t * b.ws + b.w) * .0007;
                        if (b.y < -.1) Object.assign(b, mk(true));
                        const x = b.x * W, y = b.y * H;
                        const fade = clamp(b.y * 5, 0, 1) * clamp((1.05 - b.y) * 3.5, 0, 1);
                        ctx.globalAlpha = .14 * fade;
                        ctx.strokeStyle = '#D6E24A'; ctx.lineWidth = 1.2;
                        ctx.beginPath(); ctx.arc(x, y, b.r, 0, 6.283); ctx.stroke();
                        ctx.globalAlpha = .07 * fade;
                        ctx.fillStyle = '#1FAE96';
                        ctx.beginPath(); ctx.arc(x, y, b.r * .92, 0, 6.283); ctx.fill();
                        ctx.globalAlpha = .18 * fade;
                        ctx.fillStyle = '#F4FBDA';
                        ctx.beginPath(); ctx.arc(x - b.r * .33, y - b.r * .33, Math.max(.8, b.r * .22), 0, 6.283); ctx.fill();
                    });
                    ctx.globalAlpha = 1;
                }
            };
        },
        matrix: () => {
            const CH = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789ABCDEF<>=*+-';
            const ch = () => CH.charAt(rnd(CH.length));
            let cols = [], size = 16;
            const mkCol = () => {
                const len = 6 + rnd(16);
                return { y: -rnd(30), v: 5 + Math.random() * 13, len, s: Array.from({ length: len }, ch) };
            };
            return {
                step: 1000 / 24,
                resize(W) {
                    size = clamp(Math.round(W / 46), 11, 22);
                    cols = Array.from({ length: Math.ceil(W / size) + 1 }, mkCol);
                },
                draw(ctx, W, H, dt) {
                    ctx.font = size + 'px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
                    ctx.textBaseline = 'top';
                    for (let i = 0; i < cols.length; i++) {
                        const c = cols[i];
                        c.y += c.v * dt;
                        c.s[rnd(c.len)] = ch();
                        for (let k = 0; k < c.len; k++) {
                            const y = (c.y - k) * size;
                            if (y < -size || y > H) continue;
                            const f = 1 - k / c.len;
                            if (k === 0) { ctx.globalAlpha = .38; ctx.fillStyle = '#C8FFD4'; }
                            else { ctx.globalAlpha = .18 * f * f; ctx.fillStyle = '#00FF41'; }
                            ctx.fillText(c.s[k], i * size, y);
                        }
                        if ((c.y - c.len) * size > H) cols[i] = mkCol();
                    }
                    ctx.globalAlpha = 1;
                }
            };
        },
        scroll: () => {
            const GL = ['永', '道', '心', '和', '氣', '龍', '風', '静'];
            const mkG = (bottom) => ({
                x: .05 + Math.random() * .9,
                y: bottom ? 1.06 + Math.random() * .3 : Math.random(),
                s: 14 + Math.random() * 24,
                v: .014 + Math.random() * .026,
                rot: (Math.random() - .5) * .32,
                a: Math.random() * 6.28,
                ch: pick(GL)
            });
            const mkP = (top) => ({
                x: top ? Math.random() * 1.1 - .1 : Math.random(),
                y: top ? -.06 - Math.random() * .25 : Math.random(),
                r: 2.8 + Math.random() * 4.5,
                vx: .008 + Math.random() * .022,
                vy: .02 + Math.random() * .038,
                rot: Math.random() * 6.28,
                vr: (Math.random() - .5) * 1.3,
                sw: Math.random() * 6.28
            });
            const glyphs = Array.from({ length: 16 }, () => mkG(false));
            const petals = Array.from({ length: 28 }, () => mkP(false));
            let t = 0;
            return {
                step: 1000 / 30,
                draw(ctx, W, H, dt) {
                    t += dt;
                    glyphs.forEach(g => {
                        g.y -= g.v * dt;
                        g.x += Math.sin(t * .5 + g.a) * .0005;
                        if (g.y < -.14) Object.assign(g, mkG(true));
                        const fade = clamp(g.y * 3, 0, 1) * clamp((1.06 - g.y) * 3, 0, 1);
                        ctx.globalAlpha = (.04 + .025 * Math.sin(t * .8 + g.a)) * fade;
                        ctx.fillStyle = '#E7D7B0';
                        ctx.font = g.s + 'px "Songti SC","Noto Serif CJK",serif';
                        ctx.save(); ctx.translate(g.x * W, g.y * H); ctx.rotate(g.rot);
                        ctx.fillText(g.ch, 0, 0); ctx.restore();
                    });
                    petals.forEach(p => {
                        p.x += (p.vx + Math.sin(t * .9 + p.sw) * .012) * dt;
                        p.y += p.vy * dt;
                        p.rot += p.vr * dt;
                        if (p.y > 1.1 || p.x > 1.12) Object.assign(p, mkP(true));
                        ctx.globalAlpha = .07 + .025 * Math.sin(t + p.sw);
                        ctx.fillStyle = '#D9A7A7';
                        ctx.save(); ctx.translate(p.x * W, p.y * H); ctx.rotate(p.rot);
                        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .52, .5, 0, 6.283); ctx.fill();
                        ctx.restore();
                    });
                    ctx.globalAlpha = 1;
                }
            };
        },
        portal: () => {
            const N = 4;
            const mkPortal = () => ({ x: .1 + Math.random() * .8, y: .12 + Math.random() * .76, r: 30 + Math.random() * 40, age: 0, ttl: 8 + Math.random() * 10, ph: Math.random() * 6.28 });
            const portals = Array.from({ length: N }, () => { const p = mkPortal(); p.age = Math.random() * 4; return p; });
            const KINDS = ['chair', 'table', 'lamp', 'sofa', 'tv', 'clock'];
            const mkItem = () => {
                const from = rnd(N);
                return { from, to: (from + 1 + rnd(N - 1)) % N, p: -Math.random() * 1.2, v: .16 + Math.random() * .2, kind: pick(KINDS), rot: (Math.random() - .5) * .7, spin: (Math.random() - .5) * .8 };
            };
            const items = Array.from({ length: 8 }, mkItem);
            const shape = (ctx, kind, s) => {
                ctx.beginPath();
                if (kind === 'chair') { ctx.rect(-s * .46, -s * .95, s * .18, s * 1.05); ctx.rect(-s * .46, 0, s * .95, s * .16); ctx.rect(-s * .4, s * .16, s * .13, s * .55); ctx.rect(s * .34, s * .16, s * .13, s * .55); }
                else if (kind === 'table') { ctx.rect(-s * .72, -s * .12, s * 1.44, s * .16); ctx.rect(-s * .58, s * .04, s * .12, s * .68); ctx.rect(s * .46, s * .04, s * .12, s * .68); }
                else if (kind === 'lamp') { ctx.moveTo(-s * .34, -s * .22); ctx.lineTo(s * .34, -s * .22); ctx.lineTo(s * .19, -s * .78); ctx.lineTo(-s * .19, -s * .78); ctx.closePath(); ctx.rect(-s * .05, -s * .22, s * .1, s * .88); ctx.rect(-s * .3, s * .66, s * .6, s * .12); }
                else if (kind === 'sofa') { ctx.rect(-s * .78, -s * .48, s * 1.56, s * .5); ctx.rect(-s * .9, -s * .08, s * 1.8, s * .5); ctx.rect(-s * .8, s * .42, s * .14, s * .22); ctx.rect(s * .66, s * .42, s * .14, s * .22); }
                else if (kind === 'tv') { ctx.rect(-s * .7, -s * .52, s * 1.4, s * .84); ctx.rect(-s * .1, s * .32, s * .2, s * .24); ctx.rect(-s * .42, s * .56, s * .84, s * .12); }
                else { ctx.arc(0, -s * .1, s * .5, 0, 6.283); ctx.rect(-s * .04, -s * .5, s * .08, s * .42); ctx.rect(-s * .04, -s * .14, s * .34, s * .08); }
                ctx.fill();
            };
            let t = 0;
            return {
                step: 1000 / 30,
                draw(ctx, W, H, dt) {
                    t += dt;
                    portals.forEach(p => {
                        p.age += dt;
                        if (p.age > p.ttl) Object.assign(p, mkPortal());
                        const inn = clamp(p.age / 1.0, 0, 1);
                        const out = clamp((p.ttl - p.age) / 1.0, 0, 1);
                        const life = inn * out;
                        const pulse = 1 + .07 * Math.sin(t * 1.7 + p.ph);
                        const x = p.x * W, y = p.y * H, r = p.r * pulse * (.4 + .6 * life);
                        ctx.lineWidth = 2.4;
                        ctx.globalAlpha = .13 * life; ctx.strokeStyle = '#7CFF6B';
                        ctx.beginPath(); ctx.ellipse(x, y, r, r * .82, 0, 0, 6.283); ctx.stroke();
                        ctx.globalAlpha = .08 * life; ctx.strokeStyle = '#3AD1FF'; ctx.lineWidth = 1.4;
                        ctx.beginPath(); ctx.ellipse(x, y, r * .66, r * .54, 0, 0, 6.283); ctx.stroke();
                        ctx.globalAlpha = .05 * life; ctx.fillStyle = '#7CFF6B';
                        ctx.beginPath(); ctx.ellipse(x, y, r * .9, r * .74, 0, 0, 6.283); ctx.fill();
                    });
                    const base = Math.min(W, H) * .05;
                    items.forEach((o, i) => {
                        o.p += o.v * dt;
                        if (o.p > 1) { items[i] = mkItem(); items[i].p = -Math.random() * .8; return; }
                        if (o.p < 0) return;
                        const a = portals[o.from], b = portals[o.to], q = o.p;
                        const x = (a.x + (b.x - a.x) * q) * W;
                        const y = (a.y + (b.y - a.y) * q) * H - Math.sin(q * Math.PI) * H * .08;
                        const s = base * (.3 + .7 * Math.sin(q * Math.PI));
                        ctx.globalAlpha = .14 * Math.sin(q * Math.PI);
                        ctx.fillStyle = '#DCD6C9';
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.rotate(o.rot + o.spin * q);
                        shape(ctx, o.kind, s);
                        ctx.restore();
                    });
                    ctx.globalAlpha = 1;
                }
            };
        },
        galaxy: () => {
            let stars = [];
            const makeStars = (W, H) => {
                stars = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: .4 + Math.random() * .9, p: Math.random() * 6.28 }));
            };
            let t = 0;
            return {
                step: 1000 / 30,
                resize(W, H) { makeStars(W, H); },
                draw(ctx, W, H, dt) {
                    t += dt;
                    stars.forEach(s => {
                        ctx.globalAlpha = .06 + .05 * Math.sin(t * .7 + s.p);
                        ctx.fillStyle = '#FFFFFF';
                        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.283); ctx.fill();
                    });
                    ctx.globalAlpha = 1;

                    const now = new Date();
                    const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
                    const ang = (h / 24) * 6.283 - Math.PI / 2;
                    const cx = W * .5, cy = H * .58, orbit = Math.min(W, H) * .36;
                    const x = cx + Math.cos(ang) * orbit, y = cy + Math.sin(ang) * orbit * .6;
                    const night = h < 6.5 || h >= 18.5;
                    const R = clamp(Math.min(W, H) * .045, 13, 34);

                    ctx.lineWidth = 1;
                    ctx.globalAlpha = .06; ctx.strokeStyle = night ? '#9FB0FF' : '#FFE81F';
                    ctx.beginPath(); ctx.ellipse(cx, cy, orbit, orbit * .6, 0, 0, 6.283); ctx.stroke();
                    ctx.globalAlpha = .04;
                    ctx.beginPath(); ctx.moveTo(W * .06, cy); ctx.lineTo(W * .94, cy); ctx.stroke();

                    const g = ctx.createRadialGradient(x, y, R * .2, x, y, R * 4.2);
                    g.addColorStop(0, night ? 'rgba(190,203,255,.25)' : 'rgba(255,226,80,.26)');
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(x, y, R * 4.2, 0, 6.283); ctx.fill();

                    if (night) {
                        ctx.save();
                        ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.clip();
                        ctx.globalAlpha = .55; ctx.fillStyle = '#DCE3FF';
                        ctx.fillRect(x - R, y - R, R * 2, R * 2);
                        ctx.globalAlpha = .22; ctx.fillStyle = '#9AA6D6';
                        ctx.beginPath(); ctx.arc(x - R * .3, y + R * .25, R * .22, 0, 6.283); ctx.fill();
                        ctx.beginPath(); ctx.arc(x + R * .1, y - R * .4, R * .13, 0, 6.283); ctx.fill();
                        ctx.globalCompositeOperation = 'destination-out';
                        ctx.globalAlpha = 1;
                        ctx.beginPath(); ctx.arc(x + R * .5, y - R * .22, R * .92, 0, 6.283); ctx.fill();
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.restore();
                    } else {
                        ctx.globalAlpha = .5; ctx.fillStyle = '#FFE9A3';
                        ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fill();
                        ctx.globalAlpha = .16; ctx.strokeStyle = '#FFE81F'; ctx.lineWidth = 1.4;
                        for (let i = 0; i < 12; i++) {
                            const a = i * (Math.PI / 6) + t * .1;
                            const l = R * (1.32 + .12 * Math.sin(t * 1.1 + i));
                            ctx.beginPath();
                            ctx.moveTo(x + Math.cos(a) * R * 1.18, y + Math.sin(a) * R * 1.18);
                            ctx.lineTo(x + Math.cos(a) * l * 1.28, y + Math.sin(a) * l * 1.28);
                            ctx.stroke();
                        }
                    }
                    ctx.globalAlpha = 1;
                }
            };
        },
        noir: () => {
            const mkDrop = () => ({ x: Math.random() * 1.15 - .1, y: -.05 - Math.random() * .4, v: .7 + Math.random() * .8, len: .03 + Math.random() * .04 });
            const drops = Array.from({ length: 42 }, () => { const d = mkDrop(); d.y = Math.random(); return d; });
            const smoke = Array.from({ length: 9 }, () => ({ x: Math.random() * 1.2 - .1, y: .45 + Math.random() * .5, r: 50 + Math.random() * 90, v: .01 + Math.random() * .02, ph: Math.random() * 6.28 }));
            let t = 0;
            return {
                step: 1000 / 30,
                draw(ctx, W, H, dt) {
                    t += dt;
                    smoke.forEach(s => {
                        s.x += s.v * dt;
                        if (s.x > 1.25) { s.x = -.25; s.y = .45 + Math.random() * .5; }
                        ctx.globalAlpha = .02 + .008 * Math.sin(t * .5 + s.ph);
                        ctx.fillStyle = '#BFBFBF';
                        ctx.beginPath(); ctx.arc(s.x * W, (s.y + Math.sin(t * .3 + s.ph) * .012) * H, s.r, 0, 6.283); ctx.fill();
                    });
                    ctx.lineWidth = .8; ctx.strokeStyle = '#D3D3D3';
                    drops.forEach(d => {
                        d.y += d.v * dt;
                        d.x += .04 * dt;
                        if (d.y > 1.08) Object.assign(d, mkDrop());
                        ctx.globalAlpha = .04;
                        ctx.beginPath();
                        ctx.moveTo(d.x * W, d.y * H);
                        ctx.lineTo((d.x - d.len * .22) * W, (d.y + d.len) * H);
                        ctx.stroke();
                    });
                    ctx.globalAlpha = 1;
                }
            };
        },
        inception: () => {
            let t = 0;
            return {
                step: 1000 / 30,
                draw(ctx, W, H, dt) {
                    t += dt;
                    const cx = W * .5, cy = H * .52, base = Math.min(W, H);
                    ctx.lineWidth = 1;
                    for (let i = 0; i < 11; i++) {
                        const r = (i + 1) * base * .05 * (1 + .03 * Math.sin(t * .4 + i * .6));
                        ctx.globalAlpha = .012 + i * .002;
                        ctx.strokeStyle = i % 2 ? '#E9B487' : '#8A7563';
                        ctx.beginPath();
                        ctx.ellipse(cx, cy, r, r * .47, Math.sin(t * .25 + i) * .07, 0, 6.283);
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                }
            };
        },
        dune: () => {
            let t = 0;
            return {
                step: 1000 / 30,
                draw(ctx, W, H, dt) {
                    t += dt;
                    ctx.lineWidth = 1; ctx.strokeStyle = '#E7B46A';
                    for (let i = 0; i < 8; i++) {
                        ctx.globalAlpha = .012 + i * .0018;
                        ctx.beginPath();
                        for (let x = -20; x < W + 20; x += 18) {
                            const y = H * (.34 + i * .075) + Math.sin(x * .011 + t * .35 + i) * 12 + i * 2;
                            x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                        }
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                }
            };
        },
        blade: () => {
            const mk = () => ({ x: Math.random() * 1.15 - .1, y: -.05 - Math.random() * .4, v: .9 + Math.random() * 1.1 });
            const drops = Array.from({ length: 46 }, () => { const d = mk(); d.y = Math.random(); return d; });
            return {
                step: 1000 / 30,
                draw(ctx, W, H, dt) {
                    ctx.lineWidth = 1;
                    drops.forEach(d => {
                        d.y += d.v * dt;
                        d.x += .05 * dt;
                        if (d.y > 1.1) Object.assign(d, mk());
                        ctx.globalAlpha = .035;
                        ctx.strokeStyle = d.x > .5 ? '#74E5FF' : '#F2B6FF';
                        ctx.beginPath();
                        ctx.moveTo(d.x * W, d.y * H);
                        ctx.lineTo((d.x - .008) * W, (d.y + .04) * H);
                        ctx.stroke();
                    });
                    ctx.globalAlpha = 1;
                }
            };
        },
        dream: () => {
            const clouds = Array.from({ length: 9 }, () => ({ x: Math.random(), y: Math.random(), r: 50 + Math.random() * 105, v: .012 + Math.random() * .018 }));
            return {
                step: 1000 / 24,
                draw(ctx, W, H, dt) {
                    clouds.forEach(c => {
                        c.x += c.v * dt;
                        if (c.x > 1.25) { c.x = -.25; c.y = Math.random(); }
                        ctx.globalAlpha = .018;
                        ctx.fillStyle = c.y < .5 ? '#B9C7FF' : '#A9E7D5';
                        ctx.beginPath(); ctx.arc(c.x * W, c.y * H, c.r, 0, 6.283); ctx.fill();
                    });
                    ctx.globalAlpha = 1;
                }
            };
        }
    };

    const Fx = {
        stop: (root) => {
            const old = root?.querySelector?.('.cm-rain');
            if (!old) return;
            if (old._cmStop) old._cmStop();
            if (old.parentNode) old.parentNode.removeChild(old);
        },
        start: (root, mode) => {
            Fx.stop(root);
            if (!root || reducedMotion()) return;
            const canvas = el('canvas', 'cm-rain');
            root.insertBefore(canvas, root.firstChild);
            const ctx = canvas.getContext ? canvas.getContext('2d') : null;
            if (!ctx) { canvas.remove(); return; }

            const scene = (SCENES[mode] || SCENES.astro)();
            let W = 1, H = 1, stopped = false, rafId = null, last = 0;

            const resize = () => {
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                W = Math.max(1, root.clientWidth);
                H = Math.max(1, root.clientHeight);
                canvas.width = Math.round(W * dpr);
                canvas.height = Math.round(H * dpr);
                canvas.style.width = W + 'px';
                canvas.style.height = H + 'px';
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                if (scene.resize) scene.resize(W, H);
            };
            resize();
            window.addEventListener('resize', resize, { passive: true });
            window.addEventListener('orientationchange', resize, { passive: true });

            const frame = (now) => {
                if (stopped) return;
                rafId = requestAnimationFrame(frame);
                if (!canvas.parentNode) return;
                if (!last) last = now;
                const elapsed = now - last;
                if (elapsed < (scene.step || 33)) return;
                last = now;
                if (document.hidden) return;
                const dt = Math.min(elapsed / 1000, .12);
                ctx.clearRect(0, 0, W, H);
                try { scene.draw(ctx, W, H, dt, now / 1000); } catch (e) { stopped = true; }
            };
            rafId = requestAnimationFrame(frame);

            canvas._cmStop = () => {
                stopped = true;
                if (rafId) cancelAnimationFrame(rafId);
                window.removeEventListener('resize', resize);
                window.removeEventListener('orientationchange', resize);
            };
        }
    };

    const Themes = {
        current: () => (THEMES[pGet('theme', 'astro')] ? pGet('theme', 'astro') : 'astro'),
        apply: (key, root) => {
            const t = THEMES[key] || THEMES.astro;
            root = root || View.root;
            if (!root) return;
            THEME_ORDER.forEach(k => removeClass(root, THEMES[k].cls));
            addClass(root, t.cls);
            Object.entries(t.vars).forEach(([v, val]) => root.style.setProperty(v, val));
            root.style.setProperty('--cm-accent-rgb', hexRgb(t.vars['--cm-accent']));
            root.style.setProperty('--cm-accent2-rgb', hexRgb(t.vars['--cm-accent2']));
            const sl = root.querySelector('.cm-sysline');
            if (sl) sl.textContent = t.sys || '';
            Fx.start(root, t.fx);
        },
        set: (key) => { pSet('theme', key); Themes.apply(key, View.root); },
        quote: (key) => { const t = THEMES[key || Themes.current()] || THEMES.astro; const q = t.quotes || []; return q.length ? pick(q) : ''; },
        loadLine: () => { const t = THEMES[Themes.current()] || THEMES.astro; return pick(t.load || ['СОБИРАЮ КАПСУЛУ']); }
    };

    // === CSS ===
    const CSS = `
.cm-root{
    position:fixed;inset:0;z-index:999998;overflow:hidden;
    color:var(--cm-text);background:var(--cm-bg);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
    -webkit-tap-highlight-color:transparent;
    user-select:none;-webkit-user-select:none;
    font-size:14px;font-size:clamp(13px,1.5vw,16px);
    isolation:isolate;
    transition:background-color .5s ease,color .5s ease;
}
.cm-root *{box-sizing:border-box}
.cm-root .cm-act,.cm-root .cm-opt,.cm-root .cm-chip,
.cm-root .cm-onb-card,.cm-root .cm-bar-btn,.cm-root .cm-poster{touch-action:manipulation}
.cm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}

.cm-sysline{
    position:absolute;top:1.1em;left:1.5em;z-index:8;
    font-family:ui-monospace,Menlo,Consolas,monospace;
    font-size:.56em;letter-spacing:.16em;
    color:var(--cm-accent2);opacity:.22;pointer-events:none;
}

.cm-rain{position:absolute;inset:0;width:100%;height:100%;opacity:.34;pointer-events:none;z-index:0}
.cm-stars{
    display:none;position:absolute;inset:-12%;opacity:.26;z-index:0;pointer-events:none;
    background-image:
        radial-gradient(1px 1px at 12% 22%,#fff,transparent),
        radial-gradient(1px 1px at 68% 14%,#cfe6ff,transparent),
        radial-gradient(1.4px 1.4px at 84% 62%,#fff,transparent),
        radial-gradient(1px 1px at 32% 78%,#9fd4ff,transparent);
    animation:cm-drift 70s linear infinite;
}
.cm-t-astro .cm-stars,.cm-t-sw .cm-stars{display:block}
@keyframes cm-drift{
    0%{transform:translate3d(0,0,0) scale(1)}
    50%{transform:translate3d(-1.2%,-1.5%,0) scale(1.015)}
    100%{transform:translate3d(-2.5%,-3%,0) scale(1.03)}
}

.cm-root:before{
    content:"";position:absolute;inset:-20%;z-index:0;pointer-events:none;
    background:
        radial-gradient(35% 30% at 20% 25%,rgba(var(--cm-accent-rgb),.16),transparent 70%),
        radial-gradient(40% 35% at 82% 72%,rgba(var(--cm-accent2-rgb),.14),transparent 72%);
    filter:blur(34px);opacity:.5;
    animation:cm-ambient 26s ease-in-out infinite alternate;
}
@keyframes cm-ambient{
    from{transform:scale(1) rotate(0deg);opacity:.36}
    to{transform:scale(1.06) rotate(1.5deg);opacity:.6}
}

.cm-t-astro:after,.cm-t-bb:after,.cm-t-matrix:after,.cm-t-panda:after,
.cm-t-rm:after,.cm-t-sw:after,.cm-t-noir:after,.cm-t-inception:after,
.cm-t-dune:after,.cm-t-blade:after,.cm-t-dream:after{
    content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
}
.cm-t-astro:after{
    background:
        radial-gradient(45% 55% at 18% 65%,rgba(255,122,47,.10),transparent 70%),
        radial-gradient(38% 48% at 82% 25%,rgba(127,216,255,.12),transparent 70%);
    animation:cm-space 22s ease-in-out infinite alternate;
}
@keyframes cm-space{from{transform:scale(1) rotate(-.6deg)}to{transform:scale(1.05) rotate(.6deg)}}

.cm-t-bb:after{
    background:
        radial-gradient(28% 40% at 15% 85%,rgba(214,226,74,.10),transparent 70%),
        radial-gradient(35% 35% at 85% 20%,rgba(31,174,150,.09),transparent 70%);
    animation:cm-lab 20s ease-in-out infinite alternate;
}
@keyframes cm-lab{from{transform:translateX(-1.5%) scale(1)}to{transform:translateX(1.5%) scale(1.04)}}

.cm-t-matrix:after{
    background:
        linear-gradient(rgba(0,255,65,.028) 1px,transparent 1px),
        linear-gradient(90deg,rgba(0,255,65,.028) 1px,transparent 1px);
    background-size:36px 36px,36px 36px;
    animation:cm-matrix-grid 26s linear infinite;
}
@keyframes cm-matrix-grid{to{background-position:0 36px,36px 0}}

.cm-t-panda:after{
    background:
        radial-gradient(circle at 18% 20%,rgba(231,182,92,.10),transparent 24%),
        radial-gradient(circle at 82% 72%,rgba(216,67,60,.08),transparent 26%),
        repeating-linear-gradient(0deg,rgba(244,233,210,.014) 0 2px,transparent 2px 6px);
    animation:cm-scroll 24s ease-in-out infinite alternate;
}
@keyframes cm-scroll{from{transform:translateY(-.8%) scale(1)}to{transform:translateY(1%) scale(1.025)}}

.cm-t-rm:after{
    background:
        radial-gradient(circle at 50% 50%,transparent 0 14%,rgba(58,209,255,.055) 24%,transparent 45%);
    animation:cm-portal 26s linear infinite;
}
@keyframes cm-portal{to{transform:rotate(360deg) scale(1.06)}}

.cm-t-sw:after{
    background:radial-gradient(ellipse at center,transparent 0 26%,rgba(75,213,255,.05) 54%,transparent 74%);
    animation:cm-hyper 20s ease-in-out infinite;
}
@keyframes cm-hyper{0%,100%{transform:scale(.99)}50%{transform:scale(1.07)}}

.cm-t-noir:after{
    background:
        repeating-linear-gradient(90deg,transparent 0 5px,rgba(255,255,255,.012) 6px 7px),
        radial-gradient(80% 60% at 50% 40%,transparent 40%,rgba(0,0,0,.8) 100%);
    animation:cm-film 14s linear infinite;
}
@keyframes cm-film{from{background-position:0 0,0 0}to{background-position:55px 0,0 0}}

.cm-t-inception:after{
    background:
        radial-gradient(ellipse at 50% 52%,transparent 0 20%,rgba(233,180,135,.055) 32%,transparent 52%),
        radial-gradient(60% 50% at 50% 100%,rgba(201,138,94,.06),transparent 70%);
    animation:cm-dream-depth 30s ease-in-out infinite alternate;
}
@keyframes cm-dream-depth{from{transform:scale(1) translateY(.8%)}to{transform:scale(1.08) translateY(-.8%)}}

.cm-t-dune:after{
    background:
        radial-gradient(65% 35% at 20% 75%,rgba(231,180,106,.10),transparent 72%),
        radial-gradient(55% 30% at 78% 30%,rgba(142,199,177,.06),transparent 70%);
    animation:cm-sand 32s ease-in-out infinite alternate;
}
@keyframes cm-sand{from{transform:translateX(-1.5%) scale(1.02)}to{transform:translateX(1.5%) scale(1.06)}}

.cm-t-blade:after{
    background:linear-gradient(115deg,transparent 28%,rgba(242,182,255,.045) 48%,transparent 66%);
    animation:cm-rain-city 18s linear infinite;
}
@keyframes cm-rain-city{from{background-position:0 0}to{background-position:120px 200px}}

.cm-t-dream:after{
    background:
        radial-gradient(40% 35% at 20% 25%,rgba(185,199,255,.07),transparent 70%),
        radial-gradient(45% 40% at 80% 70%,rgba(169,231,213,.055),transparent 72%);
    filter:blur(8px);
    animation:cm-evening 30s ease-in-out infinite alternate;
}
@keyframes cm-evening{from{transform:translate3d(-1%,-1%,0) scale(1)}to{transform:translate3d(2%,2%,0) scale(1.06)}}

.cm-glow{
    position:absolute;top:-25%;left:-25%;width:150%;height:150%;z-index:0;
    background-size:cover;background-position:center;opacity:0;
    filter:blur(72px) saturate(160%);transform:scale(1.08);
    transition:opacity 1s ease,transform 1.4s ease;
}
.cm-glow.on{opacity:.2;transform:scale(1.13)}
.cm-shade{
    position:absolute;inset:0;z-index:2;pointer-events:none;
    background:
        linear-gradient(180deg,rgba(0,0,0,.08),transparent 32%,transparent 68%,rgba(0,0,0,.48)),
        radial-gradient(90% 80% at 50% 45%,rgba(0,0,0,.06),rgba(0,0,0,.6) 88%,var(--cm-bg) 100%);
}

.cm-stage{
    position:absolute;inset:0;z-index:3;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:.7em;padding:3.4em 1.1em 1.25em;
    overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;
}
.cm-stage::-webkit-scrollbar{width:0;height:0}

.cm-port{
    display:flex;gap:1.35em;width:100%;max-width:64em;padding:1em;
    border-radius:calc(var(--cm-radius) * 1.15);
    background:rgba(255,255,255,.045);
    border:1px solid rgba(255,255,255,.075);
    box-shadow:0 1.4em 3.5em rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.055);
    -webkit-backdrop-filter:blur(24px) saturate(112%);
    backdrop-filter:blur(24px) saturate(112%);
    animation:cm-in-up .5s cubic-bezier(.22,.7,.25,1) both;
}
.cm-port.dir-next{animation-name:cm-in-right}
.cm-port.dir-prev{animation-name:cm-in-left}
@keyframes cm-in-up{from{opacity:0;transform:translateY(10px) scale(.99)}to{opacity:1;transform:none}}
@keyframes cm-in-right{from{opacity:0;transform:translateX(2.2%)}to{opacity:1;transform:none}}
@keyframes cm-in-left{from{opacity:0;transform:translateX(-2.2%)}to{opacity:1;transform:none}}

.cm-poster{
    position:relative;flex:none;width:13.5em;height:20.25em;
    border-radius:calc(var(--cm-radius) * .7);overflow:hidden;background:#0B0F18;cursor:pointer;
    box-shadow:0 1em 2.4em rgba(0,0,0,.44),0 0 0 1px rgba(255,255,255,.09);
    transition:transform .3s cubic-bezier(.22,.7,.25,1),box-shadow .3s ease;
}
@supports (aspect-ratio:2/3){.cm-poster{height:auto;aspect-ratio:2/3}}
.cm-poster:after{
    content:"";position:absolute;inset:0;pointer-events:none;
    background:linear-gradient(135deg,rgba(255,255,255,.13),transparent 30%,transparent 70%,rgba(0,0,0,.32));
}
.cm-poster img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .5s ease,transform .7s ease}
.cm-poster img.ready{opacity:1}
.cm-poster.cm-focus{transform:scale(1.02);box-shadow:0 1.2em 2.8em rgba(0,0,0,.5),0 0 0 .14em var(--cm-accent)}
.cm-t-noir .cm-poster img{filter:grayscale(1) contrast(1.1)}

.cm-rate{
    position:absolute;top:.6em;right:.6em;z-index:2;
    padding:.32em .62em;border-radius:.6em;
    background:rgba(0,0,0,.62);color:var(--cm-accent);
    font-weight:800;font-size:.76em;letter-spacing:.02em;
    border:1px solid rgba(var(--cm-accent-rgb),.55);
    -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
}

.cm-hero{flex:1;min-width:0;display:flex;flex-direction:column;padding:.1em}
.cm-meta{display:flex;flex-wrap:wrap;gap:.35em;margin-bottom:.72em}
.cm-mchip{
    display:inline-flex;align-items:center;white-space:nowrap;
    padding:.34em .62em;border-radius:.6em;font-size:.65em;letter-spacing:.05em;
    background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.075);
    color:var(--cm-text);opacity:.78;
}
.cm-mchip.src{color:var(--cm-accent);border-color:rgba(var(--cm-accent-rgb),.5);background:rgba(var(--cm-accent-rgb),.07);opacity:.95}
.cm-mchip.type{color:var(--cm-accent2);border-color:rgba(var(--cm-accent2-rgb),.45)}

.cm-name{
    font-size:1.6rem;font-size:clamp(1.5rem,3vw,2.25rem);
    font-weight:800;line-height:1.08;letter-spacing:-.035em;
    margin-bottom:.45em;overflow-wrap:anywhere;
    text-shadow:0 .08em .8em rgba(0,0,0,.28);
}
.cm-ref{
    display:inline-flex;align-items:center;align-self:flex-start;max-width:100%;
    margin:-.05em 0 .55em;padding:.25em .55em;
    border-left:1px solid var(--cm-accent);border-radius:.3em;
    background:rgba(255,255,255,.03);color:var(--cm-accent2);
    font-size:.6em;letter-spacing:.08em;opacity:.68;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    animation:cm-ref-pulse 9s ease-in-out infinite;
}
@keyframes cm-ref-pulse{0%,100%{opacity:.5}50%{opacity:.78}}

.cm-genres{display:flex;flex-wrap:wrap;gap:.35em;margin-bottom:.55em}
.cm-gchip{
    padding:.27em .62em;border-radius:1.2em;font-size:.64em;opacity:.82;
    color:var(--cm-accent);background:rgba(255,255,255,.025);
    border:1px solid rgba(var(--cm-accent-rgb),.32);
}
.cm-why{
    position:relative;margin-bottom:.55em;padding:.48em .65em .48em .85em;
    font-size:.76em;line-height:1.4;opacity:.8;color:var(--cm-text);
    background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05);border-radius:.6em;
}
.cm-why:before{
    content:"";position:absolute;left:0;top:.5em;bottom:.5em;width:.14em;
    border-radius:.2em;background:var(--cm-accent);
}
.cm-over{
    font-size:.8em;line-height:1.55;margin-bottom:.7em;max-width:48em;color:var(--cm-sub);
    display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;
}

.cm-acts{margin-top:auto;display:flex;gap:.45em;flex-wrap:wrap}
.cm-act{
    display:flex;align-items:center;justify-content:center;gap:.5em;
    min-height:2.7em;padding:.72em 1em;white-space:nowrap;cursor:pointer;
    border-radius:calc(var(--cm-radius) * .58);
    background:rgba(255,255,255,.065);color:var(--cm-text);
    border:1px solid rgba(255,255,255,.075);
    font-size:.82em;font-weight:700;
    transition:transform .22s cubic-bezier(.22,.7,.25,1),box-shadow .22s ease,background-color .22s ease,border-color .22s ease;
}
.cm-act svg{width:1.05em;height:1.05em;fill:currentColor;flex:none}
.cm-act:active{transform:scale(.98)}
.cm-act.primary{
    flex:1;background:var(--cm-accent);color:#0A0A0A;border-color:transparent;
    box-shadow:0 .4em 1.1em rgba(var(--cm-accent-rgb),.18);
}
.cm-act.secondary{flex:1;background:rgba(255,255,255,.08)}
.cm-act.cm-focus{
    transform:translateY(-2px);
    box-shadow:0 .7em 1.6em rgba(0,0,0,.32),0 0 0 .14em var(--cm-accent);
}

.cm-bar{
    width:100%;max-width:64em;display:flex;align-items:center;justify-content:space-between;gap:.5em;
    padding:.48em .62em;border-radius:calc(var(--cm-radius) * 1.05);
    background:rgba(8,10,16,.4);border:1px solid rgba(255,255,255,.065);
    box-shadow:0 .7em 1.8em rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.05);
    -webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);
    animation:cm-in-up .55s cubic-bezier(.22,.7,.25,1) both;
}
.cm-bar-btn{
    display:flex;align-items:center;justify-content:center;gap:.5em;
    min-height:2.35em;padding:.6em .8em;cursor:pointer;opacity:.76;
    font-size:.76em;color:var(--cm-text);
    background:transparent;border:1px solid transparent;border-radius:.7em;
    transition:transform .18s ease,background-color .18s ease,border-color .18s ease,color .18s ease,opacity .18s ease;
}
.cm-bar-btn svg{width:1.15em;height:1.15em;fill:currentColor;flex:none}
.cm-bar-btn.center{font-weight:800;font-size:.8em;letter-spacing:.05em;color:var(--cm-accent);opacity:.92}
.cm-bar-btn.cm-focus{
    opacity:1;color:var(--cm-accent);transform:translateY(-1px);
    background:rgba(var(--cm-accent-rgb),.09);border-color:rgba(var(--cm-accent-rgb),.45);
}

.cm-load{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center}
.cm-load-ring{
    width:4.4em;height:4.4em;border-radius:50%;position:relative;
    border:1px solid rgba(255,255,255,.1);
}
.cm-load-ring:before{
    content:"";position:absolute;inset:.35em;border-radius:50%;
    border:1px dashed rgba(var(--cm-accent2-rgb),.3);
    animation:cm-spin 5s linear infinite reverse;
}
.cm-load-ring:after{
    content:"";position:absolute;inset:-.15em;border-radius:50%;
    border:.15em solid transparent;border-top-color:var(--cm-accent);
    animation:cm-spin 1.15s cubic-bezier(.55,.15,.45,.85) infinite;
}
@keyframes cm-spin{to{transform:rotate(360deg)}}
.cm-load-txt{margin-top:1.15em;font-size:.66em;letter-spacing:.22em;color:var(--cm-sub);opacity:.8}

.cm-onb{
    position:absolute;inset:0;z-index:3;
    display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
    padding:3.2em 1.2em 1.5em;overflow-y:auto;scrollbar-width:none;
}
.cm-onb::-webkit-scrollbar{width:0}
.cm-onb-inner{width:100%;max-width:58em;display:flex;flex-direction:column;align-items:center;margin:auto 0}
.cm-onb-head{font-size:.62em;letter-spacing:.24em;color:var(--cm-accent2);opacity:.62;margin-bottom:1em}
.cm-onb-title{font-size:1.4em;font-weight:800;margin-bottom:.4em;text-align:center;letter-spacing:-.02em}
.cm-onb-sub{color:var(--cm-sub);font-size:.85em;text-align:center;max-width:38em;margin-bottom:1.5em;line-height:1.5;opacity:.85}
.cm-onb-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8em;width:100%}
.cm-onb-card{
    position:relative;height:0;padding-bottom:150%;
    border-radius:.8em;overflow:hidden;background:#0B0F18;cursor:pointer;
    border:1px solid rgba(255,255,255,.09);
    box-shadow:0 .8em 1.6em rgba(0,0,0,.22);
    transition:transform .2s cubic-bezier(.22,.7,.25,1),box-shadow .2s ease;
}
@supports (aspect-ratio:2/3){.cm-onb-card{height:auto;padding-bottom:0;aspect-ratio:2/3}}
.cm-onb-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .4s ease}
.cm-onb-card .t{
    position:absolute;left:0;right:0;bottom:0;padding:1.7em .6em .55em;font-size:.7em;
    background:linear-gradient(transparent,rgba(0,0,0,.92));
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.cm-onb-card.sel{transform:translateY(-2px);box-shadow:0 0 0 .16em var(--cm-accent),0 .8em 1.8em rgba(0,0,0,.3)}
.cm-onb-card.sel:after{
    content:"✓";position:absolute;top:.5em;right:.5em;width:1.6em;height:1.6em;border-radius:50%;
    background:var(--cm-accent);color:#0A0A0A;font-weight:900;
    display:flex;align-items:center;justify-content:center;
}
.cm-onb-card.cm-focus{box-shadow:0 0 0 .17em var(--cm-accent2)}
.cm-onb-card.sel.cm-focus{box-shadow:0 0 0 .17em var(--cm-accent),0 0 0 .32em var(--cm-accent2)}
.cm-onb-chips{max-width:44em;margin:0 auto}
.cm-onb-foot{display:flex;gap:.6em;margin-top:1.5em;flex-wrap:wrap;justify-content:center}
.cm-onb-foot .cm-act{flex:0 1 auto;min-width:7.5em}

.cm-chips{display:grid;grid-template-columns:1fr 1fr;gap:.5em;margin-bottom:.9em;width:100%}
.cm-chip{
    display:flex;align-items:center;min-height:2.8em;padding:.58em .9em;
    border-radius:.75em;font-size:.84em;text-align:left;cursor:pointer;
    background:rgba(255,255,255,.04);color:var(--cm-text);
    border:1px solid rgba(255,255,255,.09);
    transition:transform .18s cubic-bezier(.22,.7,.25,1),background-color .18s ease,border-color .18s ease,color .18s ease;
}
.cm-chip.sel{border-color:var(--cm-accent);color:var(--cm-accent);background:rgba(var(--cm-accent-rgb),.08)}
.cm-chip.cm-focus{background:var(--cm-accent2);color:#0A0A0A;border-color:transparent;transform:scale(1.02)}

.cm-ov{
    position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;
    padding:1.2em;background:rgba(0,0,0,.68);
    -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
    animation:cm-fade .22s ease both;
}
@keyframes cm-fade{from{opacity:0}to{opacity:1}}
.cm-modal{
    width:40em;max-width:100%;max-height:88%;overflow-y:auto;padding:1.4em;
    border-radius:calc(var(--cm-radius) * 1.15);
    background:rgba(11,14,21,.88);border:1px solid rgba(255,255,255,.09);
    box-shadow:0 1.5em 4em rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06);
    -webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);
    scrollbar-width:none;animation:cm-modal-in .26s cubic-bezier(.22,.7,.25,1) both;
}
@keyframes cm-modal-in{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
.cm-modal::-webkit-scrollbar{width:0}
.cm-modal h3{margin:0 0 .5em;font-size:1.15em;font-weight:800;letter-spacing:-.01em}
.cm-modal p{margin:0 0 1em;color:var(--cm-sub);font-size:.88em;line-height:1.55}
.cm-modal p b{color:var(--cm-text)}
.cm-opt{
    display:flex;flex-direction:column;justify-content:center;
    width:100%;min-height:3.1em;padding:.7em 1em;margin-bottom:.42em;
    text-align:left;font-size:.9em;cursor:pointer;
    border-radius:calc(var(--cm-radius) * .55);
    background:rgba(255,255,255,.035);color:var(--cm-text);
    border:1px solid rgba(255,255,255,.06);
    transition:transform .18s ease,background-color .18s ease,border-color .18s ease,color .18s ease;
}
.cm-opt small{display:block;font-size:.72em;opacity:.65;margin-top:.15em}
.cm-opt.cm-focus{background:var(--cm-accent);color:#0A0A0A;border-color:transparent;transform:translateX(3px)}
.cm-opt.cm-focus small{opacity:.75}
.cm-input{
    width:100%;padding:.85em 1em;margin-bottom:.8em;font-size:1em;color:#fff;outline:none;
    border-radius:calc(var(--cm-radius) * .5);
    background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.15);
}
.cm-toast{
    position:fixed;left:50%;bottom:1.8em;z-index:1000001;
    transform:translateX(-50%) translateY(1em);opacity:0;
    max-width:92%;padding:.75em 1.2em;text-align:center;font-size:.86em;
    border-radius:.8em;background:rgba(10,12,18,.9);color:var(--cm-text);
    border:1px solid rgba(255,255,255,.1);box-shadow:0 .8em 2em rgba(0,0,0,.35);
    -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
    transition:opacity .28s ease,transform .28s cubic-bezier(.22,.7,.25,1);
}
.cm-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
.cm-t-matrix,.cm-t-matrix .cm-name{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}

@media (hover:hover) and (pointer:fine){
    .cm-act:hover{background:rgba(255,255,255,.11);transform:translateY(-1px)}
    .cm-act.primary:hover{filter:brightness(1.06)}
    .cm-opt:hover,.cm-chip:hover,.cm-bar-btn:hover{background:rgba(255,255,255,.09)}
    .cm-bar-btn:hover{opacity:1}
    .cm-poster:hover img{transform:scale(1.03)}
    .cm-onb-card:hover{transform:translateY(-3px);box-shadow:0 0 0 .1em var(--cm-accent2),0 1em 2em rgba(0,0,0,.32)}
    .cm-onb-card:hover img{transform:scale(1.03)}
}

/* ============================================================
   АДАПТИВ
   ============================================================ */
@media (max-width:900px){
    .cm-stage{padding:2.7em 1em 1em}
    .cm-port{flex-direction:column;gap:1em;padding:1em}
    .cm-poster{width:min(12em,42vw);margin:0 auto}
    .cm-acts .cm-act{flex:1 1 100%}
    .cm-onb-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
}

@media (max-width:700px){
    .cm-sysline{top:.6em;left:1em;font-size:.5em}
    .cm-stage{
        justify-content:flex-start;
        padding:2.4em .6em .9em;
        gap:.5em;
    }
    .cm-port{
        margin:0;
        display:grid;grid-template-columns:7.4em 1fr;align-items:start;
        gap:.85em;padding:.7em;
    }
    .cm-poster{width:7.4em;height:11.1em;grid-row:1;margin:0}
    @supports (aspect-ratio:2/3){.cm-poster{height:auto}}
    .cm-hero{grid-column:2;padding:0}
    .cm-name{font-size:1.35rem;font-size:clamp(1.2rem,5.6vw,1.65rem);margin-bottom:.35em}
    .cm-meta{margin-bottom:.5em;gap:.3em}
    .cm-mchip{font-size:.62em;padding:.3em .55em}
    .cm-genres{display:none}
    .cm-why{font-size:.7em;padding:.42em .55em .42em .75em;margin-bottom:.45em}
    .cm-over{-webkit-line-clamp:3;font-size:.74em;margin-bottom:.55em}
    .cm-ref{max-width:95%;margin-bottom:.45em}
    .cm-acts{margin-top:.5em}
    .cm-act{min-height:2.55em;padding:.62em .75em;font-size:.78em}
    .cm-bar{margin-top:.15em;padding:.42em .5em}
    .cm-bar-btn{padding:.52em .5em}
    .cm-bar-btn .lbl{display:none}
    .cm-bar-btn.center .lbl{display:inline}
    .cm-rate{font-size:.68em;padding:.28em .48em;top:.4em;right:.4em}
    .cm-onb{padding:2em .7em 1em}
    .cm-onb-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:.6em}
    .cm-onb-title{font-size:1.2em}
    .cm-onb-sub{margin-bottom:1.1em;font-size:.8em}
}

@media (max-width:480px){
    .cm-stage{padding:2.3em .5em .8em}
    .cm-port{grid-template-columns:6.6em 1fr;gap:.7em;padding:.6em}
    .cm-poster{width:6.6em;height:9.9em}
    @supports (aspect-ratio:2/3){.cm-poster{height:auto}}
    .cm-over{-webkit-line-clamp:2}
    .cm-acts .secondary{display:none}
    .cm-act.primary{flex:1}
    .cm-bar{gap:.3em}
    .cm-chips{grid-template-columns:1fr 1fr}
    .cm-onb-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    .cm-onb-foot .cm-act{min-width:6.5em}
}

@media (min-width:1600px){
    .cm-root{font-size:17px}
    .cm-port{max-width:70em}
    .cm-bar{max-width:70em}
}

@media (prefers-reduced-motion:reduce){
    .cm-root *,.cm-root *:before,.cm-root *:after{
        animation:none !important;transition-duration:.01ms !important;
    }
    .cm-rain{display:none}
}
`;
    const injectCSS = () => {
        const prev = document.getElementById('cm_css');
        if (prev) prev.remove();
        const s = el('style');
        s.id = 'cm_css';
        s.textContent = CSS;
        document.head.appendChild(s);
    };

    // === ИКОНКИ ===
    const I_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    const I_SEARCH = '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>';
    const I_INFO = '<svg viewBox="0 0 24 24"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/></svg>';
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
        if ((Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) || (vx > 0.5 && Math.abs(dx) > 28)) {
            vibrate(12);
            View.step(dx > 0 ? 1 : -1);
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
            items: [{ label: 'Найти', onSelect: () => { if (input.value) cb(input.value); } }, { label: 'Отмена' }]
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
        _dir: 0,
        _lastBuiltAt: 0,

        create: () => {
            injectCSS();
            View.root = el('div', 'cm-root');
            View.root.appendChild(el('div', 'cm-sysline cm-mono'));
            View.root.appendChild(el('div', 'cm-stars'));
            View.glow = el('div', 'cm-glow');
            View.root.appendChild(View.glow);
            View.root.appendChild(el('div', 'cm-shade'));
            View.stage = el('div');
            View.stage.style.cssText = 'position:absolute;inset:0;z-index:3;';
            View.root.appendChild(View.stage);
            Themes.apply(Themes.current(), View.root);
            View.loading(Themes.loadLine());
            View.boot(false);
            return View.root;
        },

        loading: (text) => {
            View.stage.innerHTML = '';
            const box = el('div', 'cm-load');
            box.appendChild(el('div', 'cm-load-ring'));
            box.appendChild(el('div', 'cm-load-txt cm-mono', esc(text)));
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
                    View._dir = 0;
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
                    View._dir = 0;
                    View.render();
                    notify('Капсула обновлена');
                });
            });
        },

        renderEmpty: () => {
            View.stage.innerHTML = '';
            Nav.reset();
            const wrap = el('div', 'cm-stage');
            const port = el('div', 'cm-port');
            const hero = el('div', 'cm-hero');
            hero.appendChild(el('div', 'cm-meta', '<div class="cm-mchip src cm-mono">КАПСУЛА ПУСТА</div>'));
            hero.appendChild(el('div', 'cm-name', 'Пока нечего показать'));
            hero.appendChild(el('div', 'cm-why', 'Нет истории Lampa или связи с TMDb. Пройдите короткий тест — капсула соберётся под ваш вкус за минуту.'));
            const acts = el('div', 'cm-acts');
            const bTest = el('div', 'cm-act primary', 'Пройти тест');
            bTest._cmAction = () => Onboard.start();
            const bRetry = el('div', 'cm-act secondary', 'Повторить');
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
            const port = el('div', 'cm-port' + (View._dir > 0 ? ' dir-next' : View._dir < 0 ? ' dir-prev' : ''));

            const pos = el('div', 'cm-poster');
            if (m.poster_path) {
                const img = el('img');
                img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
                img.onload = () => addClass(img, 'ready');
                img.src = IMG + 'w500' + m.poster_path;
                pos.appendChild(img);
            }
            pos.appendChild(el('div', 'cm-rate cm-mono', '★ ' + (m.vote_average ? m.vote_average.toFixed(1) : '—')));
            let held = false, holdT = null;
            pos.addEventListener('click', () => { if (held) { held = false; return; } play(m); });
            pos.addEventListener('touchstart', () => { holdT = setTimeout(() => { held = true; holdT = null; vibrate(18); View.details(m); }, 550); }, { passive: true });
            pos.addEventListener('touchend', () => { if (holdT) { clearTimeout(holdT); holdT = null; } }, { passive: true });
            pos.addEventListener('touchmove', () => { if (holdT) { clearTimeout(holdT); holdT = null; } }, { passive: true });
            port.appendChild(pos);

            const hero = el('div', 'cm-hero');
            const meta = el('div', 'cm-meta');
            const year = parseInt(String(m.release_date || m.first_air_date || '').slice(0, 4), 10) || 0;
            const chipSrc = el('div', 'cm-mchip src cm-mono', esc(View.sourceLabel || 'КАПСУЛА') + ' · ' + (View.idx + 1) + '/' + View.list.length);
            const chipType = el('div', 'cm-mchip type cm-mono', m.media_type === 'tv' ? 'СЕРИАЛ' : 'ФИЛЬМ');
            const chipYear = el('div', 'cm-mchip cm-mono', year ? String(year) : '—');
            meta.appendChild(chipSrc); meta.appendChild(chipType); meta.appendChild(chipYear);
            hero.appendChild(meta);

            hero.appendChild(el('div', 'cm-name', esc(m.title || m.name || '')));
            const quote = Themes.quote(Themes.current());
            if (quote) hero.appendChild(el('div', 'cm-ref cm-mono', esc(quote)));

            const genresBox = el('div', 'cm-genres');
            (m.genre_ids || []).slice(0, 3).forEach(gid => { if (GENRE_NAMES[gid]) genresBox.appendChild(el('div', 'cm-gchip', esc(GENRE_NAMES[gid]))); });
            hero.appendChild(genresBox);

            hero.appendChild(el('div', 'cm-why', esc(Capsule.reason(m, View.taste || {}))));
            const over = el('div', 'cm-over', esc(m.overview || 'Описание подгружается…'));
            hero.appendChild(over);

            const acts = el('div', 'cm-acts');
            const bPlay = el('div', 'cm-act primary', I_PLAY + 'Смотреть');
            bPlay._cmAction = () => play(m);
            const bMore = el('div', 'cm-act secondary', I_INFO + 'Подробнее');
            bMore._cmAction = () => View.details(m);
            acts.appendChild(bPlay); acts.appendChild(bMore);
            hero.appendChild(acts);
            port.appendChild(hero);
            wrap.appendChild(port);

            const bar = el('div', 'cm-bar');
            const bSet = el('div', 'cm-bar-btn', I_GEAR + '<span class="lbl">Настройки</span>');
            bSet._cmAction = () => UI.settings();
            const bChange = el('div', 'cm-bar-btn center cm-mono', I_CHANGE + '<span class="lbl">Изменить набор</span>');
            bChange._cmAction = () => UI.changeSet();
            const bSearch = el('div', 'cm-bar-btn', I_SEARCH + '<span class="lbl">Поиск</span>');
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
                if (View.list[View.idx] !== m || !d) return;
                if (refs.type) refs.type.textContent = type === 'tv'
                    ? `СЕРИАЛ · ${d.number_of_seasons || 1} СЕЗ.`
                    : (d.runtime ? `ФИЛЬМ · ${fmtRuntime(d.runtime).toUpperCase()}` : 'ФИЛЬМ');
                if (refs.over && !m.overview && d.overview) refs.over.textContent = d.overview;
                if (refs.genres && d.genres?.length) {
                    refs.genres.innerHTML = '';
                    d.genres.slice(0, 3).forEach(g => refs.genres.appendChild(el('div', 'cm-gchip', esc(g.name))));
                }
            }, () => {}, { ttl: 604800000 });
        },

        preload: () => {
            [1, -1].forEach(d => {
                const it = View.list[(View.idx + d + View.list.length) % View.list.length];
                if (it?.poster_path) { const im = new Image(); im.decoding = 'async'; im.src = IMG + 'w342' + it.poster_path; }
            });
        },

        setGlow: (m) => {
            if (!View.glow) return;
            if (!pGet('glow', true)) { removeClass(View.glow, 'on'); return; }
            const url = m.backdrop_path ? IMG + 'w780' + m.backdrop_path : (m.poster_path ? IMG + 'w342' + m.poster_path : '');
            if (!url) { removeClass(View.glow, 'on'); return; }
            if (View.glow._url === url) { addClass(View.glow, 'on'); return; }
            View.glow._url = url;
            View.glow.style.backgroundImage = `url(${url})`;
            addClass(View.glow, 'on');
        },

        showFound: (label, list, kind, query) => {
            View.busy = false;
            if (!list.length) { notify('Ничего не нашлось — попробуйте другие слова'); return; }
            const top = list.slice(0, CAPSULE_SIZE);
            Capsule.remember(top.map(i => i.id));
            View.list = top;
            View.idx = 0;
            View._dir = 0;
            View.sourceLabel = String(label || 'ПОИСК').toUpperCase().slice(0, 22);
            View.activeQuery = { kind: kind || 'search', label: View.sourceLabel, query: query || label };
            View.render();
        },

        details: (m) => {
            if (!m) return;
            const type = m.media_type === 'tv' ? 'tv' : 'movie';
            const waiting = Modal.open({ title: 'Загружаем…', items: [{ label: 'Закрыть' }] });
            const closeWaiting = () => { if (Modal.stack.includes(waiting)) Modal.close(); };
            Net.get(`/${type}/${m.id}`, {}, (d) => {
                closeWaiting();
                const title = d.title || d.name || '';
                const year = (d.release_date || d.first_air_date || '').slice(0, 4);
                const genres = (d.genres || []).map(g => g.name).join(', ');
                const score = d.vote_average ? d.vote_average.toFixed(1) : '—';
                let html = `<b>${esc(title)}</b>${year ? ' (' + year + ')' : ''} · ★ ${score}${d.runtime ? ' · ' + fmtRuntime(d.runtime) : ''}`;
                if (genres) html += `<br>${esc(genres)}`;
                html += `<br><br>${esc(d.overview || 'Описания нет.')}`;
                Modal.open({
                    title: 'Подробнее', text: html,
                    items: [{ label: 'Смотреть', onSelect: () => play(m) }, { label: 'Закрыть' }]
                });
            }, () => { closeWaiting(); notify('Не удалось загрузить описание'); });
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
            View._dir = delta > 0 ? 1 : -1;
            View.go(next);
        }
    };

    // === ИНТЕРФЕЙС ===
    const UI = {
        settings: () => {
            Modal.open({
                title: 'Настройки',
                items: [
                    { label: `Тема: ${THEMES[Themes.current()].name}`, onSelect: () => UI.themes() },
                    { label: `Свет от постера: ${pGet('glow', true) ? 'включён' : 'выключен'}`, onSelect: () => { pSet('glow', !pGet('glow', true)); View.setGlow(View.list[View.idx] || {}); UI.settings(); } },
                    { label: 'Пройти тест предпочтений', hint: 'пересобрать вкус с нуля', onSelect: () => Onboard.start() },
                    { label: 'Свой ключ TMDb', hint: pGet('tmdb_key', '') ? 'задан' : 'встроенный', onSelect: () => Settings.askKey() },
                    { label: 'Очистить историю показов', hint: 'снова покажем отложенное', onSelect: () => { Capsule.forget(); notify('История показов очищена'); } },
                    { label: 'Закрыть' }
                ]
            });
        },
        themes: () => {
            const items = THEME_ORDER.map(key => ({
                label: (Themes.current() === key ? '● ' : '○ ') + THEMES[key].name,
                onSelect: () => {
                    Themes.set(key);
                    notify(`Тема: ${THEMES[key].name}`);
                    if (Onboard.active) Onboard.renderStep();
                    else if (View.list.length) View.render();
                    else View.renderEmpty();
                }
            }));
            items.push({ label: 'Назад', onSelect: () => UI.settings() });
            Modal.open({ title: 'Оформление', items });
        },
        changeSet: () => {
            Modal.open({
                title: 'Изменить набор',
                items: [
                    { label: 'Обновить этот набор', hint: 'другие варианты по той же логике', onSelect: () => View.refreshCurrent() },
                    { label: 'Выбрать по настроению', onSelect: () => UI.moods() },
                    { label: 'Поиск по названию', onSelect: () => UI.ask() }
                ]
            });
        },
        moods: () => {
            Modal.open({
                title: 'Настроение',
                chips: MOODS.map(md => ({ label: md.label, onSelect: () => UI.find(md.q, md.label, 'mood') })),
                items: [{ label: 'Назад', onSelect: () => UI.changeSet() }]
            });
        },
        ask: () => askText('Что ищем?', '', (v) => UI.find(v, v, 'search')),
        find: (query, label, kind, force) => {
            if (!query || View.busy) return;
            View.busy = true;
            View.loading('ИЩУ: ' + String(query).toUpperCase().slice(0, 24));
            Search.run(query, View.taste, (list) => View.showFound(label || query, list, kind || 'search', query), !!force);
        }
    };

    const Settings = {
        askKey: () => askText('Ключ TMDb', pGet('tmdb_key', ''), (v) => {
            pSet('tmdb_key', String(v).trim());
            Net.drop();
            notify('Ключ сохранён');
        })
    };

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
                if (now - lastStepAt > 220) { lastStepAt = now; View.step(kind === 'right' ? 1 : -1); }
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
            Fx.stop(node);
            if (node?.parentNode) node.parentNode.removeChild(node);
            node = null; wrapped = null;
            View.root = null; View.stage = null; View.glow = null;
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
            console.log('[Капсула] v17.2 загружена');
        } catch (e) { console.error('[Капсула] ошибка старта:', e); }
    })();
})();
