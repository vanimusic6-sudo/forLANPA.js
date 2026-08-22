/**
 * Capsule Mod v13.0 — «Капсула & Компаньон»
 *
 * Что изменено относительно v12:
 *  1. [Управление — полная переработка]
 *     — Единая 2D-навигация (ряд действий ⇄ лента миниатюр) с памятью столбца.
 *     — TV/пульт: стрелки внутри ряда, а на краю ряда — листают фильмы; фокус
 *       не «теряется» при смене карточки (сохраняется активный ряд).
 *     — Мышь: наведение = мягкий фокус (без автоскролла), клик = выбор,
 *       колесо прокрутки листает фильмы (ПК).
 *     — Сенсор: свайпы влево/вправо, тап по кнопкам и миниатюрам; режимы мыши и
 *       касания больше не конфликтуют.
 *     — Корректная интеграция с Lampa.Controller (toggle/pause/resume/back).
 *  2. [Интерфейс ближе к Lampa]
 *     — Тосты через Lampa.Noty, выход через Lampa.Activity.backward, пункт меню
 *       по нативному шаблону Lampa.
 *     — Честный рейтинг: реальный балл TMDb + число оценок + жанры (вместо
 *       выдуманных КП/IMDb/RT, которые считались по формуле).
 *  3. [Отсылки усилены]
 *     — Курируемая база цитат/пасхалок по фильмам (по original_title, без
 *       завязки на хрупкие ID).
 *     — Тематический «характер» компаньона: приветствие, текст загрузки и
 *       реплики меняются под выбранную тему (Космос/Лаборатория/Матрица/
 *       Свиток/Портал).
 *  4. [Исправлены баги из заметок]
 *     — Компаньон читает историю Lampa (favorite: history/like/viewed/…),
 *       считает любимые жанры и собирает капсулу через /discover, исключая
 *       уже просмотренное.
 *     — «Обновить подборку» реально обновляет (случайная страница + перемешивание).
 *     — Поиск компаньона идёт и по названиям, и по ключевым словам/тегам.
 *  5. [Адаптивность] сохранена и подчищена (TV overscan / телефон / ПК).
 */

export const CAPSULE_PLUGIN_CODE = `/**
 * Capsule Mod v13.0 — «Капсула & Компаньон» для Lampa
 * ES5 compatible: Tizen, WebOS, Android TV, Mobile, Desktop.
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
       1. УТИЛИТЫ DOM И СТИЛЕЙ
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
    function normTitle(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^ | $/g, ''); }
    function shuffle(a) {
        a = a.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }
    function formatVotes(n) {
        n = n || 0;
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
        return '' + n;
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
            node[prop] = from + dist * (1 - Math.pow(1 - p, 3));
            if (p < 1) raf(step); else node._cmAnim = null;
        }
        raf(step);
    }

    /* =========================================================================
       2. ГОТОВНОСТЬ LAMPA + ХРАНИЛИЩЕ
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
    setTimeout(function () { if (!LampaReady.ready) flushReady(); }, 2000);

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
            if (!isEmptyish(v) || attempt >= 5) { cb(v); return; }
            setTimeout(function () { ownedGet(key, def, cb, attempt + 1); }, 300);
        });
    }

    /* =========================================================================
       3. СЕТЬ, ЖАНРЫ, НАСТРОЕНИЯ
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
                xhr.timeout = 10000;
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

    var GENRE_NAMES = {
        28: 'боевик', 12: 'приключения', 16: 'мультфильм', 35: 'комедия', 80: 'криминал',
        99: 'документальный', 18: 'драма', 10751: 'семейный', 14: 'фэнтези', 36: 'история',
        27: 'ужасы', 10402: 'музыка', 9648: 'детектив', 10749: 'мелодрама', 878: 'фантастика',
        53: 'триллер', 10752: 'военный', 37: 'вестерн',
        10759: 'боевик', 10765: 'фантастика', 10768: 'военный', 10762: 'детское',
        10763: 'новости', 10764: 'реалити', 10766: 'драма', 10767: 'ток-шоу'
    };
    var TV2MOVIE = { 10759: 28, 10765: 878, 10768: 10752, 10762: 10751, 10766: 18 };

    var MOODS = [
        { label: '🍿 На расслабоне', q: 'легкая комедия приключения' },
        { label: '🤯 Взорвать мозг', q: 'умный научно-фантастический триллер детектив' },
        { label: '🚀 Космос и звезды', q: 'космическая фантастика sci-fi' },
        { label: '🕵️ Загадки и нуар', q: 'напряженный детектив триллер mystery' },
        { label: '🔥 Адреналин', q: 'динамичный боевик экшен' },
        { label: '❤️ Теплый вечер', q: 'романтическая комедия мелодрама' },
        { label: '👨‍👩‍👧 Вся семья', q: 'семейный мультфильм сказка' },
        { label: '😱 Мурашки по коже', q: 'мистический хоррор ужасы' }
    ];

    /* =========================================================================
       4. ДВИЖОК ВКУСА (ЧТЕНИЕ ИСТОРИИ LAMPA)
       ========================================================================= */
    var Taste = {
        genres: [], seen: {}, ready: false,
        collect: function (fav, tally, seen) {
            if (!fav) return;
            var buckets = ['history', 'like', 'wath', 'look', 'viewed', 'card', 'thrown'];
            for (var b = 0; b < buckets.length; b++) {
                var arr = fav[buckets[b]];
                if (!isArr(arr)) continue;
                var weight = (buckets[b] === 'thrown') ? -1 : 1;
                for (var i = 0; i < arr.length; i++) {
                    var c = arr[i]; if (!c) continue;
                    if (c.id) seen[c.id] = true;
                    var gids = c.genre_ids;
                    if (!isArr(gids) && isArr(c.genres)) {
                        gids = [];
                        for (var z = 0; z < c.genres.length; z++) if (c.genres[z] && c.genres[z].id) gids.push(c.genres[z].id);
                    }
                    if (!isArr(gids)) continue;
                    for (var g = 0; g < gids.length; g++) {
                        var gid = TV2MOVIE[gids[g]] || gids[g];
                        tally[gid] = (tally[gid] || 0) + weight;
                    }
                }
            }
        },
        build: function (cb) {
            var self = this;
            ownedGet('favorite', {}, function (fav) {
                var tally = {}, seen = {};
                self.collect(fav, tally, seen);
                var pairs = [];
                for (var k in tally) if (tally[k] > 0) pairs.push([k, tally[k]]);
                pairs.sort(function (a, b) { return b[1] - a[1]; });
                self.genres = [];
                for (var p = 0; p < pairs.length && p < 3; p++) self.genres.push(pairs[p][0]);
                self.seen = seen;
                self.ready = true;
                cb(self);
            });
        }
    };

    /* =========================================================================
       5. ОТСЫЛКИ: ТЕМАТИЧЕСКИЙ ХАРАКТЕР + БАЗА ЦИТАТ
       ========================================================================= */
    // Тематический «характер» компаньона (усиливает отсылки под выбранную тему)
    var THEME_FLAVOR = {
        astro: { load: 'СИНХРОНИЗАЦИЯ КАПСУЛЫ', hi: 'Компаньон на связи 🚀',
            intro: 'Сверился со звёздами и собрал для тебя капсулу.' },
        breakingbad: { load: 'ЗАПУСК РЕАКЦИИ', hi: 'Химия подобрана точно ⚗️',
            intro: 'Формула твоего вкуса выведена. Чистота — 99.1%.' },
        matrix: { load: 'ЗАГРУЗКА МАТРИЦЫ', hi: 'Проснись… выбор реален 🕶️',
            intro: 'Красная таблетка принята — вот что реально стоит смотреть.' },
        panda: { load: 'РАЗВОРАЧИВАЮ СВИТОК', hi: 'Внутренний покой найден 🐼',
            intro: 'Секретного ингредиента нет. Просто хорошее кино.' },
        rickmorty: { load: 'ОТКРЫВАЮ ПОРТАЛ', hi: 'Wubba lubba dub dub! 🛸',
            intro: 'Портал открыт в лучшую версию твоего вечера, Морти.' }
    };
    function flavor() { return THEME_FLAVOR[Themes.current()] || THEME_FLAVOR.astro; }

    // Курируемые отсылки по фильмам (ключ — нормализованный original_title / original_name)
    var REFERENCES = {
        'the matrix': { q: 'Я покажу тебе, как глубока эта кроличья нора.', a: 'Морфеус', egg: 'Красная таблетка' },
        'inception': { q: 'Не бойся мечтать чуть масштабнее, дорогуша.', a: 'Имс', egg: 'А волчок всё крутится…' },
        'fight club': { q: 'Первое правило: никому не рассказывать.', a: 'Тайлер Дёрден', egg: '🧼 Мыло' },
        'pulp fiction': { q: 'Ты знаешь, как в Париже зовут четвертьфунтовый бургер?', a: 'Винсент Вега', egg: 'Тайна чемоданчика' },
        'forrest gump': { q: 'Жизнь как коробка шоколадных конфет.', a: 'Форрест Гамп', egg: '🏃 Беги, Форрест!' },
        'interstellar': { q: 'Мы найдём путь. Мы всегда его находили.', a: 'Купер', egg: '⏳ Тессеракт' },
        'the dark knight': { q: 'Ты либо умираешь героем, либо живёшь достаточно долго, чтобы стать злодеем.', a: 'Харви Дент', egg: '🃏 Почему так серьёзно?' },
        'the shawshank redemption': { q: 'Надежда — это хорошо. Может быть, лучшее из чувств.', a: 'Энди Дюфрейн', egg: '🔨 Плакат на стене' },
        'the godfather': { q: 'Я сделаю ему предложение, от которого он не сможет отказаться.', a: 'Дон Корлеоне', egg: '🍊 Апельсины к беде' },
        'gladiator': { q: 'Что мы сделаем в жизни, отзовётся в вечности.', a: 'Максимус', egg: '⚔️ Развлёк ли я вас?' },
        'the silence of the lambs': { q: 'Я съел его печень с бобами и славным кьянти.', a: 'Ганнибал Лектер', egg: '🦋 Мотылёк' },
        'se7en': { q: 'Что в коробке?!', a: 'Детектив Миллс', egg: '📦 Семь грехов' },
        'seven': { q: 'Что в коробке?!', a: 'Детектив Миллс', egg: '📦 Семь грехов' },
        'back to the future': { q: 'Дороги? Там, куда мы едем, дороги не нужны.', a: 'Док Браун', egg: '⚡ 88 миль в час' },
        'the terminator': { q: 'Я вернусь.', a: 'Терминатор', egg: '🤖 T-800' },
        'terminator 2 judgment day': { q: 'Hasta la vista, детка.', a: 'Терминатор', egg: '👍 Большой палец в лаву' },
        'jurassic park': { q: 'Жизнь всегда находит путь.', a: 'Ян Малкольм', egg: '🦖 Стакан воды дрожит' },
        'the avengers': { q: 'Мстители, общий сбор!', a: 'Капитан Америка', egg: '🛡️ Сцена после титров' },
        'avengers infinity war': { q: 'Я иду на это в последний раз.', a: 'Танос', egg: '🫰 Щелчок' },
        'joker': { q: 'Раньше я думал, что моя жизнь — трагедия. Теперь понимаю: это комедия.', a: 'Артур Флек', egg: '🕺 Танец на лестнице' },
        'parasite': { q: 'Знаешь, какой план не проваливается? Никакого плана.', a: 'Ки-тхэк', egg: '🪨 Камень удачи' },
        'blade runner': { q: 'Я видел то, во что вы, люди, не поверили бы.', a: 'Рой Батти', egg: '🦄 Оригами-единорог' },
        'blade runner 2049': { q: 'Иногда, чтобы любить, нужно быть незнакомцем.', a: 'Кей', egg: '👁️ Настоящее или нет?' },
        'the wolf of wall street': { q: 'Продай мне эту ручку.', a: 'Джордан Белфорт', egg: '📈 Гуд-мьютированный успех' },
        'goodfellas': { q: 'Сколько себя помню, всегда хотел быть гангстером.', a: 'Генри Хилл', egg: '🍝 Соус в тюрьме' },
        'breaking bad': { q: 'Я — тот, кто стучится.', a: 'Уолтер Уайт', egg: '🎩 Хайзенберг' },
        'rick and morty': { q: 'Ничего не значит. Никто не существует специально. Все умрут. Идём смотреть кино.', a: 'Рик Санчез', egg: '🥒 Огурчик Рик' },
        'kung fu panda': { q: 'Нет секретного ингредиента. Он — просто ты.', a: 'Мистер Пинг', egg: '🥟 Свиток Дракона' }
    };
    function refFor(m) {
        var key = normTitle(m.original_title || m.original_name || m.title || m.name);
        return REFERENCES[key] || null;
    }
    function decorate(m) {
        if (!m || m._cm_done) return m;
        m._cm_done = true;
        var r = refFor(m);
        if (r) { m.cm_quote = r.q; m.cm_author = r.a; m.cm_egg = r.egg; }
        return m;
    }

    // Реплики компаньона внутри карточки (по жанру, с тематическим оттенком)
    var COMPANION_QUIPS = {
        sciFi: ['Визор поймал аномалию — впереди отличная фантастика.', 'Курс проложен на неизведанные миры!', 'Гравитация выключена, погружаемся.'],
        action: ['Держись крепче — уровень экшена зашкаливает.', 'Пульс растёт, заряд адреналина гарантирован.', 'Боевой режим активирован.'],
        comedy: ['Датчик настроения на максимуме — готовься смеяться.', 'Идеально под попкорн и перезагрузку.', 'Улыбка детектирована на 100%.'],
        drama: ['Глубокая история — задевает тонкие струны.', 'Приготовься к сильным эмоциям.', 'Настоящее кино со смыслом.'],
        horror: ['Сенсоры уловили шорох в темноте… Не оглядывайся.', 'Уровень мурашек: критический. Свет оставить?', 'Смелый выбор — держись ближе к экрану.'],
        animation: ['Чистая магия анимации для настроения.', 'Визуальный шедевр, сделанный с душой.', 'Ныряем в сказочные миры.'],
        def: ['Капсула синхронизирована с твоими вкусами.', 'Отобрал самое интересное из тысяч вариантов.', 'Нажми «Смотреть» или кликни по мне для других настроений.']
    };
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function companionReaction(m) {
        if (!m) return 'Капсула готова к запуску.';
        if (m.cm_egg) return 'Тут есть на что засмотреться: ' + m.cm_egg + '.';
        var g = m.genre_ids || [];
        for (var i = 0; i < g.length; i++) {
            var gid = TV2MOVIE[g[i]] || g[i];
            if (gid === 878) return pick(COMPANION_QUIPS.sciFi);
            if (gid === 28 || gid === 12) return pick(COMPANION_QUIPS.action);
            if (gid === 35) return pick(COMPANION_QUIPS.comedy);
            if (gid === 27 || gid === 53) return pick(COMPANION_QUIPS.horror);
            if (gid === 16) return pick(COMPANION_QUIPS.animation);
            if (gid === 18) return pick(COMPANION_QUIPS.drama);
        }
        return pick(COMPANION_QUIPS.def);
    }

    /* =========================================================================
       6. ТЕМЫ ОФОРМЛЕНИЯ
       ========================================================================= */
    var THEMES = {
        astro: { name: 'Космос', cls: 'cm-t-astro', vars: {
            '--cm-bg': '#05070D', '--cm-accent': '#FF7A2F', '--cm-accent2': '#7FD8FF',
            '--cm-text': '#E8ECF5', '--cm-sub': '#8695AC', '--cm-panel': 'rgba(16,21,32,.75)',
            '--cm-panel2': 'rgba(9,12,20,.65)', '--cm-chip': 'rgba(232,236,245,.06)', '--cm-radius': '1.2em'
        } },
        breakingbad: { name: 'Лаборатория', cls: 'cm-t-bb', vars: {
            '--cm-bg': '#0B0E08', '--cm-accent': '#D6E24A', '--cm-accent2': '#1FAE96',
            '--cm-text': '#EDF2E0', '--cm-sub': '#9AAE8C', '--cm-panel': 'rgba(19,24,13,.82)',
            '--cm-panel2': 'rgba(12,16,8,.7)', '--cm-chip': 'rgba(214,226,74,.08)', '--cm-radius': '.6em'
        } },
        matrix: { name: 'Матрица', cls: 'cm-t-matrix', vars: {
            '--cm-bg': '#000600', '--cm-accent': '#00FF41', '--cm-accent2': '#00B32E',
            '--cm-text': '#C8FFD4', '--cm-sub': '#4E9E5E', '--cm-panel': 'rgba(0,14,0,.82)',
            '--cm-panel2': 'rgba(0,10,0,.7)', '--cm-chip': 'rgba(0,255,65,.07)', '--cm-radius': '.25em'
        } },
        panda: { name: 'Свиток', cls: 'cm-t-panda', vars: {
            '--cm-bg': '#1C140B', '--cm-accent': '#D8433C', '--cm-accent2': '#E7B65C',
            '--cm-text': '#F4E9D2', '--cm-sub': '#B79E7B', '--cm-panel': 'rgba(42,31,18,.85)',
            '--cm-panel2': 'rgba(30,22,13,.75)', '--cm-chip': 'rgba(231,182,92,.1)', '--cm-radius': '.9em'
        } },
        rickmorty: { name: 'Портал', cls: 'cm-t-rm', vars: {
            '--cm-bg': '#07141B', '--cm-accent': '#7CFF6B', '--cm-accent2': '#3AD1FF',
            '--cm-text': '#E6FFF1', '--cm-sub': '#6FA894', '--cm-panel': 'rgba(6,22,28,.82)',
            '--cm-panel2': 'rgba(4,16,20,.7)', '--cm-chip': 'rgba(124,255,107,.08)', '--cm-radius': '1.1em'
        } }
    };
    var THEME_ORDER = ['astro', 'breakingbad', 'matrix', 'panda', 'rickmorty'];

    var Themes = {
        current: function () { var k = pGet('theme', 'astro'); return THEMES[k] ? k : 'astro'; },
        apply: function (key, root) {
            var t = THEMES[key] || THEMES.astro;
            root = root || View.root;
            if (!root) return;
            for (var i = 0; i < THEME_ORDER.length; i++) removeClass(root, THEMES[THEME_ORDER[i]].cls);
            addClass(root, t.cls);
            for (var v in t.vars) root.style.setProperty(v, t.vars[v]);
        },
        set: function (key) { pSet('theme', key); this.apply(key, View.root); }
    };

    /* =========================================================================
       7. АДАПТИВНЫЙ CSS (TV / ТЕЛЕФОН / ПК)
       ========================================================================= */
    var CSS = [
        '.cm-root{position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;overflow:hidden;color:var(--cm-text);',
        'background:var(--cm-bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
        '-webkit-tap-highlight-color:transparent;user-select:none;transition:background .4s;',
        'padding-top:env(safe-area-inset-top, 0px);padding-bottom:env(safe-area-inset-bottom, 0px);',
        'padding-left:env(safe-area-inset-left, 0px);padding-right:env(safe-area-inset-right, 0px);}',
        '.cm-root *{box-sizing:border-box;}',
        '.cm-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;}',

        '.cm-stars{position:absolute;top:0;left:0;width:100%;height:100%;opacity:.35;pointer-events:none;',
        'background-image:radial-gradient(1.2px 1.2px at 15% 25%,#fff,transparent),radial-gradient(1px 1px at 70% 20%,#cfe6ff,transparent),',
        'radial-gradient(1.5px 1.5px at 85% 65%,#fff,transparent),radial-gradient(1px 1px at 30% 80%,#9fd4ff,transparent);',
        'background-size:100% 100%;}',
        '.cm-glow{position:absolute;top:-20%;left:-20%;width:140%;height:140%;background-size:cover;background-position:center;',
        'opacity:0;filter:blur(70px) saturate(140%);transition:opacity .7s ease;pointer-events:none;}',
        '.cm-glow.on{opacity:.22;}',
        '.cm-shade{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;',
        'background:radial-gradient(ellipse at center,rgba(0,0,0,.15) 0%,rgba(0,0,0,.75) 75%,var(--cm-bg) 100%);}',

        '.cm-stage{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;',
        'align-items:center;justify-content:space-between;padding:1.4em 2em 1.2em 2em;overflow-y:auto;',
        '-webkit-overflow-scrolling:touch;z-index:20;}',

        '.cm-port-wrap{display:flex;align-items:center;justify-content:center;width:100%;flex:1;min-height:0;margin-bottom:.8em;}',
        '.cm-port{position:relative;display:flex;align-items:center;width:100%;max-width:64em;',
        'border-radius:var(--cm-radius);padding:1.5em;background:var(--cm-panel);',
        'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
        'box-shadow:inset 0 0 0 1px rgba(255,255,255,.1), 0 1.2em 3em rgba(0,0,0,.6);transition:all .3s;}',

        '.cm-hero-poster{position:relative;flex:none;width:14em;height:21em;max-height:45vh;border-radius:calc(var(--cm-radius) * 0.7);',
        'overflow:hidden;background:#0B0F18;box-shadow:0 1em 2.5em rgba(0,0,0,.6);margin-right:1.6em;transition:transform .3s;}',
        '.cm-hero-poster img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .4s;}',
        '.cm-hero-poster img.ready{opacity:1;}',

        '.cm-hero{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;}',
        '.cm-count{font-size:.72em;letter-spacing:.2em;color:var(--cm-sub);margin-bottom:.4em;}',
        '.cm-count b{color:var(--cm-accent);font-weight:700;}',
        '.cm-name{font-size:1.8em;font-weight:800;line-height:1.15;letter-spacing:-.02em;margin-bottom:.4em;',
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',

        '.cm-why{position:relative;padding-left:.9em;font-size:.92em;line-height:1.4;color:var(--cm-text);opacity:.9;margin-bottom:.8em;max-width:34em;',
        'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}',
        '.cm-why:before{content:"";position:absolute;left:0;top:.25em;bottom:.25em;width:.18em;border-radius:.1em;background:var(--cm-accent);}',

        /* Честный рейтинг TMDb + оценки + жанры */
        '.cm-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.4em;margin:.3em 0 .5em;}',
        '.cm-rate-tmdb{display:inline-flex;align-items:center;gap:.3em;padding:.22em .55em;border-radius:.4em;',
        'background:var(--cm-accent);color:#05070D;font-weight:900;font-size:.85em;}',
        '.cm-votes{font-size:.78em;color:var(--cm-sub);}',
        '.cm-genre{padding:.22em .55em;border-radius:.4em;background:var(--cm-chip);color:var(--cm-text);font-size:.78em;}',

        '.cm-quote-box{position:relative;padding:.45em .8em;border-radius:.6em;background:rgba(255,255,255,.06);',
        'border-left:3px solid var(--cm-accent);font-style:italic;font-size:.86em;color:var(--cm-text);margin:.3em 0;max-width:34em;}',
        '.cm-quote-author{font-style:normal;font-size:.75em;color:var(--cm-sub);text-align:right;margin-top:.2em;}',
        '.cm-easter-tag{display:inline-flex;align-items:center;gap:.4em;padding:.2em .6em;border-radius:.4em;',
        'background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.25);color:#FFE066;font-size:.78em;margin:.2em 0;align-self:flex-start;}',

        '.cm-speech{display:flex;align-items:center;padding:.4em .7em;border-radius:.8em;background:rgba(255,255,255,.05);',
        'border:1px solid rgba(255,255,255,.08);margin-bottom:.6em;cursor:pointer;transition:background .2s,border-color .2s;}',
        '.cm-speech:hover,.cm-speech.cm-focus{background:rgba(255,255,255,.12);border-color:var(--cm-accent);}',
        '.cm-speech-icon{flex:none;width:1.8em;height:1.8em;margin-right:.6em;}',
        '.cm-speech-txt{font-size:.82em;color:var(--cm-accent2);line-height:1.3;font-style:italic;}',

        '.cm-acts{display:flex;flex-wrap:wrap;align-items:center;gap:.6em;margin-top:.3em;}',
        '.cm-act{display:inline-flex;align-items:center;justify-content:center;padding:.65em 1.3em;',
        'border-radius:calc(var(--cm-radius) * 0.6);cursor:pointer;font-size:.92em;font-weight:700;',
        'background:var(--cm-chip);color:var(--cm-text);transition:all .18s;outline:none;}',
        '.cm-act svg{width:1.1em;height:1.1em;fill:currentColor;margin-right:.5em;}',
        '.cm-act.primary{background:var(--cm-accent);color:#05070D;}',
        '.cm-act.cm-focus,.cm-act:hover{transform:scale(1.04);background:#FFFFFF;color:#05070D;box-shadow:0 0 1.2em rgba(255,255,255,.3);}',
        '.cm-act.primary.cm-focus,.cm-act.primary:hover{background:#FFFFFF;color:#05070D;box-shadow:0 0 1.5em var(--cm-accent);}',

        '.cm-tray{position:relative;width:100%;max-width:54em;display:flex;justify-content:center;flex:none;z-index:30;padding-bottom:.4em;}',
        '.cm-tray-in{display:flex;align-items:center;padding:.35em .55em;border-radius:1.2em;background:var(--cm-panel2);',
        'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);',
        'overflow-x:auto;max-width:100%;scrollbar-width:none;}',
        '.cm-tray-in::-webkit-scrollbar{display:none;}',
        '.cm-mini{position:relative;flex:none;width:3.4em;height:5em;border-radius:.5em;overflow:hidden;margin:0 .3em;',
        'background:#0B0F18;cursor:pointer;opacity:.45;transition:all .2s;}',
        '.cm-mini img{width:100%;height:100%;object-fit:cover;}',
        '.cm-mini.active{opacity:1;box-shadow:0 0 0 .15em var(--cm-accent);}',
        '.cm-mini.cm-focus,.cm-mini:hover{opacity:1;transform:translateY(-.3em) scale(1.1);box-shadow:0 .4em 1em rgba(0,0,0,.6), 0 0 0 .15em var(--cm-accent);}',

        '.cm-ov{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.82);z-index:999999;',
        'display:flex;align-items:center;justify-content:center;padding:1em;}',
        '.cm-modal{width:36em;max-width:95vw;max-height:88vh;overflow-y:auto;padding:1.6em;border-radius:var(--cm-radius);',
        'background:var(--cm-panel);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);',
        'box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 1.5em 3.5em rgba(0,0,0,.8);}',
        '.cm-modal::-webkit-scrollbar{width:4px;}',
        '.cm-modal::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:2px;}',
        '.cm-modal h3{margin:0 0 .3em;font-size:1.3em;font-weight:800;letter-spacing:-.01em;}',
        '.cm-modal p{margin:0 0 1em;color:var(--cm-sub);font-size:.92em;line-height:1.5;}',
        '.cm-modal p b{color:var(--cm-text);}',
        '.cm-modal-mascot{display:flex;justify-content:center;margin:-.2em 0 .8em;}',
        '.cm-modal-mascot .cm-astro{width:5.5em;height:6em;display:block;}',
        '.cm-sec{font-size:.72em;letter-spacing:.18em;color:var(--cm-sub);margin:1em 0 .5em;font-weight:700;}',
        '.cm-sec:first-child{margin-top:0;}',
        '.cm-opt{display:block;width:100%;text-align:left;padding:.8em 1em;margin-bottom:.4em;border-radius:calc(var(--cm-radius) * 0.5);',
        'background:var(--cm-chip);color:var(--cm-text);font-size:.92em;cursor:pointer;transition:all .15s;}',
        '.cm-opt.cm-focus,.cm-opt:hover{background:var(--cm-accent);color:#05070D;transform:scale(1.01);}',
        '.cm-opt small{display:block;font-size:.75em;opacity:.8;margin-top:.15em;}',
        '.cm-chips{display:flex;flex-wrap:wrap;gap:.4em;margin-bottom:.8em;}',
        '.cm-chip-btn{padding:.5em .85em;border-radius:1em;font-size:.86em;cursor:pointer;',
        'background:var(--cm-chip);color:var(--cm-text);transition:all .15s;}',
        '.cm-chip-btn.cm-focus,.cm-chip-btn:hover{background:var(--cm-accent2);color:#05070D;transform:scale(1.05);}',
        '.cm-input{width:100%;padding:.8em 1em;margin-bottom:.8em;border-radius:calc(var(--cm-radius) * 0.5);font-size:1em;color:#fff;outline:none;',
        'background:var(--cm-chip);border:1px solid rgba(255,255,255,.15);}',

        '.cm-load{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:40;}',
        '.cm-load-ring{width:3.5em;height:3.5em;border-radius:50%;box-shadow:inset 0 0 0 .15em rgba(255,255,255,.15);position:relative;}',
        '.cm-load-ring:after{content:"";position:absolute;top:-.15em;left:-.15em;right:-.15em;bottom:-.15em;border-radius:50%;',
        'border:.15em solid transparent;border-top-color:var(--cm-accent);animation:cm-spin 1s linear infinite;}',
        '@keyframes cm-spin{to{transform:rotate(360deg);}}',
        '.cm-load-txt{margin-top:1em;font-size:.72em;letter-spacing:.22em;color:var(--cm-sub);}',

        '.cm-toast{position:fixed;left:50%;bottom:1.5em;transform:translateX(-50%) translateY(1em);z-index:1000001;opacity:0;',
        'padding:.7em 1.3em;border-radius:.8em;background:var(--cm-panel2);color:var(--cm-text);font-size:.9em;',
        'box-shadow:inset 0 0 0 1px rgba(255,255,255,.15),0 .6em 1.5em rgba(0,0,0,.5);transition:opacity .25s,transform .25s;pointer-events:none;}',
        '.cm-toast.on{opacity:1;transform:translateX(-50%) translateY(0);}',

        '.cm-body-anim{animation:cm-float 4.5s ease-in-out infinite;transform-origin:50% 50%;}',
        '@keyframes cm-float{0%,100%{transform:translateY(0) rotate(-2deg);}50%{transform:translateY(-.4em) rotate(2deg);}}',
        '.cm-visor-pulse{animation:cm-visor 3s ease-in-out infinite;}',
        '@keyframes cm-visor{0%,100%{opacity:.85;}50%{opacity:1;filter:drop-shadow(0 0 6px var(--cm-accent2));}}',

        '@media (max-width: 768px), (max-height: 580px){',
        '  .cm-stage{padding:.8em .8em .6em .8em;}',
        '  .cm-port{flex-direction:row;align-items:flex-start;padding:1em;gap:1em;}',
        '  .cm-hero-poster{width:6.5em;height:9.5em;margin-right:0;border-radius:.6em;}',
        '  .cm-name{font-size:1.25em;margin-bottom:.3em;}',
        '  .cm-why{font-size:.82em;margin-bottom:.6em;-webkit-line-clamp:3;}',
        '  .cm-speech{padding:.4em .6em;margin-bottom:.6em;}',
        '  .cm-speech-txt{font-size:.75em;}',
        '  .cm-act{padding:.6em 1em;font-size:.85em;}',
        '  .cm-mini{width:2.8em;height:4.1em;}',
        '  .cm-tray{padding-bottom:0;}',
        '}',

        '@media (max-width: 480px){',
        '  .cm-port{flex-direction:column;align-items:center;text-align:center;}',
        '  .cm-hero-poster{width:7.5em;height:11em;margin-bottom:.6em;}',
        '  .cm-hero{align-items:center;}',
        '  .cm-why{padding-left:0;padding-top:.4em;text-align:center;}',
        '  .cm-why:before{left:50%;top:0;bottom:auto;width:3em;height:.15em;transform:translateX(-50%);}',
        '  .cm-meta,.cm-acts{justify-content:center;}',
        '  .cm-easter-tag{align-self:center;}',
        '  .cm-mini{width:2.5em;height:3.7em;}',
        '}',

        '@media (min-width: 1200px){',
        '  .cm-stage{padding:3vh 4vw 2.5vh 4vw;}',
        '  .cm-port{max-width:70em;padding:2em;}',
        '  .cm-hero-poster{width:16em;height:24em;margin-right:2.2em;}',
        '  .cm-name{font-size:2.4em;}',
        '  .cm-why{font-size:1.05em;}',
        '  .cm-act{padding:.9em 1.8em;font-size:1.1em;}',
        '  .cm-mini{width:4.2em;height:6.2em;margin:0 .45em;}',
        '}'
    ].join('\\n');

    function injectCSS() {
        if (document.getElementById('cm_css')) return;
        var s = el('style');
        s.id = 'cm_css';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    /* =========================================================================
       8. ГРАФИКА
       ========================================================================= */
    var I_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    var I_COMPANION = '<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 1 5 5v1.2a5 5 0 0 1-1.4 9.6H8.4A5 5 0 0 1 7 8.2V7a5 5 0 0 1 5-5zm-3 9a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm6 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"/></svg>';
    var I_CAPSULE = '<svg viewBox="0 0 24 24"><path d="M17 2a5 5 0 0 1 3.5 8.5l-10 10A5 5 0 0 1 3.5 13.5l10-10A5 5 0 0 1 17 2zm-2 3.9-9.1 9.2a3 3 0 0 0 4.2 4.2L19.2 10a3 3 0 0 0-4.2-4.2z"/></svg>';

    var SVG_ASTRO = [
        '<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" class="cm-body-anim">',
        '<defs>',
        '<linearGradient id="cmBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2E8F0"/><stop offset="1" stop-color="#94A3B8"/></linearGradient>',
        '<radialGradient id="cmVisor" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#38BDF8"/><stop offset="0.6" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></radialGradient>',
        '<linearGradient id="cmPack" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#CBD5E1"/><stop offset="1" stop-color="#64748B"/></linearGradient>',
        '</defs>',
        '<g transform="rotate(-4 100 110)">',
        '<rect x="75" y="90" width="85" height="90" rx="28" fill="url(#cmPack)" transform="rotate(8 117 135)"/>',
        '<rect x="62" y="70" width="76" height="90" rx="32" fill="url(#cmBody)"/>',
        '<path d="M68 85 C 50 65, 34 50, 26 36" fill="none" stroke="url(#cmBody)" stroke-width="20" stroke-linecap="round"/>',
        '<circle cx="26" cy="36" r="14" fill="url(#cmBody)"/>',
        '<path d="M132 85 C 150 100, 162 120, 166 140" fill="none" stroke="url(#cmBody)" stroke-width="20" stroke-linecap="round"/>',
        '<circle cx="166" cy="140" r="14" fill="url(#cmBody)"/>',
        '<path d="M92 155 C 78 180, 62 195, 42 210" fill="none" stroke="url(#cmBody)" stroke-width="22" stroke-linecap="round"/>',
        '<path d="M122 155 C 132 180, 148 195, 162 205" fill="none" stroke="url(#cmBody)" stroke-width="22" stroke-linecap="round"/>',
        '<ellipse cx="42" cy="210" rx="14" ry="10" fill="#64748B"/>',
        '<ellipse cx="162" cy="205" rx="14" ry="10" fill="#64748B"/>',
        '<circle cx="100" cy="52" r="42" fill="url(#cmBody)"/>',
        '<ellipse cx="100" cy="52" rx="34" ry="28" fill="url(#cmVisor)" class="cm-visor-pulse"/>',
        '<path d="M80 38 C 88 28, 100 26, 114 32 C 100 34, 90 40, 84 50 Z" fill="#FFFFFF" opacity="0.5"/>',
        '<circle cx="118" cy="56" r="3.5" fill="#38BDF8"/>',
        '<rect x="90" y="16" width="20" height="12" rx="5" fill="#64748B"/>',
        '<circle cx="100" cy="14" r="6" fill="#FF7A2F"/>',
        '<rect x="74" y="96" width="32" height="26" rx="6" fill="#0F172A"/>',
        '<circle cx="84" cy="109" r="3.5" fill="#FF7A2F"/><circle cx="94" cy="109" r="3.5" fill="#38BDF8"/><circle cx="104" cy="109" r="3.5" fill="#22C55E"/>',
        '</g></svg>'
    ].join('');

    /* =========================================================================
       9. НАВИГАЦИЯ (ПУЛЬТ / МЫШЬ / СЕНСОР)
       ========================================================================= */
    var touchMode = false;
    document.addEventListener('touchstart', function () { touchMode = true; }, true);

    var Nav = {
        rows: [], r: 0, c: 0,
        reset: function () { this.rows = []; this.r = 0; this.c = 0; },
        addRow: function (items, kind) {
            var clean = [];
            for (var i = 0; i < items.length; i++) if (items[i]) clean.push(items[i]);
            if (!clean.length) return;
            this.rows.push({ items: clean, memo: 0, kind: kind || 'row' });
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
            var row = this.rows[this.r];
            if (dir === 'up') {
                if (this.r > 0) this.setFocus(this.r - 1, this.rows[this.r - 1].memo || 0);
            } else if (dir === 'down') {
                if (this.r < this.rows.length - 1) this.setFocus(this.r + 1, this.rows[this.r + 1].memo || 0);
            } else if (dir === 'left') {
                if (this.c > 0) this.setFocus(this.r, this.c - 1);
                else View.step(-1);      // на краю ряда — листаем фильмы
            } else if (dir === 'right') {
                if (this.c < row.items.length - 1) this.setFocus(this.r, this.c + 1);
                else View.step(1);
            }
        },
        enter: function () { trigger(this.current()); }
    };

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
                if (!isNaN(r) && !isNaN(c) && !Modal.active()) Nav.setFocus(r, c, true);
                trigger(n);
                return;
            }
            n = n.parentNode;
        }
    }, false);

    /* Свайпы (сенсор) */
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
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0) View.step(1); else View.step(-1);
        }
    }, true);

    /* Колесо мыши (ПК) */
    var wheelLock = false;
    function onWheel(e) {
        if (!App.active || Modal.active()) return;
        if (Math.abs(e.deltaY) < 8) return;
        if (wheelLock) return;
        wheelLock = true;
        setTimeout(function () { wheelLock = false; }, 240);
        View.step(e.deltaY > 0 ? 1 : -1);
        try { e.preventDefault(); } catch (er) {}
    }

    /* =========================================================================
       10. ТОСТЫ (LAMPA.NOTY) И МОДАЛКИ
       ========================================================================= */
    var Toast = {
        node: null, timer: null,
        show: function (text) {
            try { if (window.Lampa && Lampa.Noty && Lampa.Noty.show) { Lampa.Noty.show(text); return; } } catch (e) {}
            if (!this.node) { this.node = el('div', 'cm-toast'); document.body.appendChild(this.node); }
            var n = this.node;
            n.textContent = text;
            addClass(n, 'on');
            clearTimeout(this.timer);
            this.timer = setTimeout(function () { removeClass(n, 'on'); }, 2500);
        }
    };

    var Modal = {
        stack: [],
        open: function (opts) {
            var self = this;
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
                    var c = el('div', 'cm-chip-btn', esc(ch.label));
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
       11. ЭКРАН КАПСУЛЫ И РЕНДЕР
       ========================================================================= */
    var View = {
        root: null, stage: null, glow: null,
        list: [], idx: 0, busy: false,
        activeQuery: { kind: 'taste', label: 'КАПСУЛА' },

        create: function () {
            injectCSS();
            this.root = el('div', 'cm-root');
            Themes.apply(Themes.current(), this.root);
            this.root.appendChild(el('div', 'cm-stars'));
            this.glow = el('div', 'cm-glow');
            this.root.appendChild(this.glow);
            this.root.appendChild(el('div', 'cm-shade'));
            this.stage = el('div', 'cm-stage');
            this.root.appendChild(this.stage);
            try { this.root.addEventListener('wheel', onWheel, false); } catch (e) {}
            this.loading(flavor().load);
            this.boot(false);
            return this.root;
        },

        loading: function (text) {
            this.stage.innerHTML = '';
            var box = el('div', 'cm-load');
            box.appendChild(el('div', 'cm-load-ring'));
            box.appendChild(el('div', 'cm-load-txt cm-mono', text || 'ЗАГРУЗКА'));
            this.stage.appendChild(box);
            Nav.reset();
        },

        boot: function (force) {
            var self = this;
            this.busy = true;
            Taste.build(function (taste) {
                if (taste.genres.length) {
                    var page = 1 + Math.floor(Math.random() * (force ? 5 : 3));
                    Net.get('/discover/movie', {
                        sort_by: 'popularity.desc',
                        with_genres: taste.genres.join(','),
                        'vote_count.gte': 150,
                        include_adult: false,
                        page: page
                    }, function (d) { self.fill(d, taste, 'ДЛЯ ТЕБЯ', force); },
                       function () { self.trending(force); }, { force: force });
                } else {
                    self.trending(force);
                }
            });
        },

        trending: function (force) {
            var self = this;
            var page = 1 + Math.floor(Math.random() * (force ? 3 : 1));
            Net.get('/trending/movie/week', { page: page }, function (d) {
                self.fill(d, null, 'ТРЕНДЫ', force);
            }, function () { self.busy = false; self.renderEmpty(); }, { force: force });
        },

        fill: function (d, taste, label, force) {
            var self = this;
            self.busy = false;
            var raw = (d && d.results) || [];
            if (force) raw = shuffle(raw);
            var seen = (taste && taste.seen) || {};
            var out = [], i, m;
            for (i = 0; i < raw.length && out.length < CAPSULE_SIZE; i++) {
                m = raw[i];
                if (!m || !m.poster_path || seen[m.id]) continue;
                out.push(m);
            }
            if (out.length < CAPSULE_SIZE) {
                for (i = 0; i < raw.length && out.length < CAPSULE_SIZE; i++) {
                    m = raw[i];
                    if (m && m.poster_path && indexOfArr(out, m) < 0) out.push(m);
                }
            }
            if (!out.length) { self.renderEmpty(); return; }
            self.list = out;
            self.idx = 0;
            self.activeQuery = { kind: 'taste', label: label };
            self.render();
        },

        renderEmpty: function () {
            this.stage.innerHTML = '';
            var wrap = el('div', 'cm-port-wrap');
            var port = el('div', 'cm-port');
            var hero = el('div', 'cm-hero');
            hero.appendChild(el('div', 'cm-count cm-mono', 'КАПСУЛА ОФФЛАЙН'));
            hero.appendChild(el('div', 'cm-name', 'Нет соединения'));
            hero.appendChild(el('div', 'cm-why', 'Проверь интернет или ключ TMDb в настройках.'));
            var acts = el('div', 'cm-acts');
            var retry = el('div', 'cm-act primary', 'Попробовать снова');
            retry._cmAction = function () { View.loading('ПОВТОРЯЮ'); View.boot(true); };
            var comp = el('div', 'cm-act', I_COMPANION + 'Компаньон');
            comp._cmAction = function () { Companion.open(); };
            acts.appendChild(retry); acts.appendChild(comp);
            hero.appendChild(acts);
            port.appendChild(hero);
            wrap.appendChild(port);
            this.stage.appendChild(wrap);
            Nav.reset();
            Nav.addRow([retry, comp], 'acts');
            Nav.setFocus(0, 0, true);
        },

        render: function (keepRow) {
            var self = this;
            var m = decorate(this.list[this.idx]);
            if (!m) return this.renderEmpty();

            this.stage.innerHTML = '';
            Nav.reset();

            var portWrap = el('div', 'cm-port-wrap');
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
                esc(this.activeQuery.label || 'КАПСУЛА') + ' · <b>' + pad2(this.idx + 1) + '</b> / ' + pad2(this.list.length)));
            hero.appendChild(el('div', 'cm-name', esc(m.title || m.name || 'Без названия')));

            /* Честный рейтинг TMDb + число оценок + жанры */
            var meta = el('div', 'cm-meta');
            if (m.vote_average) {
                meta.appendChild(el('div', 'cm-rate-tmdb', '★ ' + m.vote_average.toFixed(1)));
                if (m.vote_count) meta.appendChild(el('div', 'cm-votes', formatVotes(m.vote_count) + ' оценок'));
            }
            var year = String(m.release_date || m.first_air_date || '').slice(0, 4);
            if (year) meta.appendChild(el('div', 'cm-genre', year));
            var gids = m.genre_ids || [];
            for (var gi = 0, shown = 0; gi < gids.length && shown < 3; gi++) {
                var gn = GENRE_NAMES[gids[gi]];
                if (gn) { meta.appendChild(el('div', 'cm-genre', gn)); shown++; }
            }
            hero.appendChild(meta);

            /* Отсылка (цитата) либо описание */
            if (m.cm_quote) {
                hero.appendChild(el('div', 'cm-quote-box',
                    '«' + esc(m.cm_quote) + '»' + (m.cm_author ? '<div class="cm-quote-author">— ' + esc(m.cm_author) + '</div>' : '')));
            } else {
                hero.appendChild(el('div', 'cm-why', esc(m.overview || 'Свежая подборка из капсулы рекомендаций.')));
            }
            if (m.cm_egg) hero.appendChild(el('div', 'cm-easter-tag', esc(m.cm_egg)));

            /* Живая реплика компаньона */
            var speech = el('div', 'cm-speech');
            speech.appendChild(el('div', 'cm-speech-icon', SVG_ASTRO));
            speech.appendChild(el('div', 'cm-speech-txt', '«' + esc(companionReaction(m)) + '»'));
            speech._cmAction = function () { Companion.open(); };
            hero.appendChild(speech);

            /* Кнопки */
            var acts = el('div', 'cm-acts');
            var bPlay = el('div', 'cm-act primary', I_PLAY + 'Смотреть');
            bPlay._cmAction = function () { play(m); };
            var bComp = el('div', 'cm-act', I_COMPANION + 'Компаньон');
            bComp._cmAction = function () { Companion.open(); };
            acts.appendChild(bPlay); acts.appendChild(bComp);
            hero.appendChild(acts);

            port.appendChild(hero);
            portWrap.appendChild(port);
            this.stage.appendChild(portWrap);

            /* Лента миниатюр */
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
                mini._cmAction = function () { self.go(index, 1); };
                trayIn.appendChild(mini);
                minis.push(mini);
            })(this.list[i], i);
            tray.appendChild(trayIn);
            this.stage.appendChild(tray);

            Nav.addRow([bPlay, bComp], 'acts');
            Nav.addRow(minis, 'tray');

            /* ИСПРАВЛЕНО: корректное сохранение фокуса для любого активного ряда */
            if (typeof keepRow === 'number' && Nav.rows[keepRow]) {
                var focusC = (keepRow === 1) ? this.idx : (Nav.rows[keepRow].memo || 0);
                Nav.setFocus(keepRow, focusC, true);
            } else {
                Nav.setFocus(0, 0, true);
            }

            this.setGlow(m);
        },

        setGlow: function (m) {
            if (!pGet('glow', true) || !this.glow) return;
            var url = m.backdrop_path ? IMG + 'w780' + m.backdrop_path : (m.poster_path ? IMG + 'w342' + m.poster_path : '');
            if (!url) { removeClass(this.glow, 'on'); return; }
            this.glow.style.backgroundImage = 'url(' + url + ')';
            addClass(this.glow, 'on');
        },

        go: function (i, keepRow) {
            if (i < 0 || i >= this.list.length) return;
            this.idx = i;
            this.render(keepRow);
        },

        step: function (delta, keepRow) {
            if (!this.list.length) return;
            var next = this.idx + delta;
            if (next >= this.list.length) next = 0;
            if (next < 0) next = this.list.length - 1;
            // ИСПРАВЛЕНО: если keepRow не передан (свайп/колесо), берем текущий ряд
            this.go(next, typeof keepRow === 'number' ? keepRow : Nav.r);
        }
    };

    /* =========================================================================
       12. КОМПАНЬОН
       ========================================================================= */
    var Companion = {
        open: function () {
            var self = this, chips = [];
            for (var i = 0; i < MOODS.length; i++) (function (mo) {
                chips.push({ label: mo.label, onSelect: function () { self.find(mo.q, mo.label); } });
            })(MOODS[i]);

            var items = [
                { section: 'НАСТРОЕНИЕ' },
                { label: 'Сказать словами…', hint: 'например: «киберпанк 80-х»', onSelect: function () { self.ask(); } },
                { section: 'РЕКОМЕНДАЦИИ' },
                { label: 'Обновить подборку', hint: 'подберёт свежие 6 фильмов', onSelect: function () { View.loading(flavor().load); View.boot(true); } },
                { section: 'ОФОРМЛЕНИЕ' },
                { label: 'Сменить тему: ' + THEMES[Themes.current()].name, onSelect: function () { self.themes(); } },
                { section: 'НАСТРОЙКИ' },
                { label: 'Свет от постера: ' + (pGet('glow', true) ? 'вкл' : 'выкл'), onSelect: function () { pSet('glow', !pGet('glow', true)); self.open(); } },
                { label: 'Свой ключ TMDb', hint: pGet('tmdb_key', '') ? 'задан' : 'встроенный', onSelect: function () { Settings.askKey(); } },
                { label: 'Закрыть' }
            ];

            Modal.open({ mascot: true, title: flavor().hi, text: flavor().intro + ' Выбери настроение или скажи словами — соберу персональную капсулу.', chips: chips, items: items });
        },

        themes: function () {
            var self = this, items = [];
            for (var i = 0; i < THEME_ORDER.length; i++) (function (key) {
                var t = THEMES[key];
                items.push({ label: (Themes.current() === key ? '● ' : '○ ') + t.name, onSelect: function () { Themes.set(key); Toast.show('Тема: ' + t.name); View.render(Nav.r); } });
            })(THEME_ORDER[i]);
            items.push({ label: 'Назад', onSelect: function () { self.open(); } });
            Modal.open({ title: 'Темы оформления', items: items });
        },

        ask: function () {
            var self = this;
            askText('Что ищем?', '', function (v) { self.find(v, v); });
        },

        // Поиск по названиям И по ключевым словам/тегам (описания)
        find: function (query, label) {
            if (!query) return;
            View.loading('ИЩУ: ' + String(query).toUpperCase());
            var tasks = [
                function (cb) {
                    Net.get('/search/movie', { query: query, include_adult: false, page: 1 },
                        function (d) { cb((d && d.results) || []); }, function () { cb([]); });
                },
                function (cb) {
                    Net.get('/search/keyword', { query: query, page: 1 }, function (d) {
                        var kws = (d && d.results) || [];
                        if (!kws.length) { cb([]); return; }
                        var ids = [];
                        for (var i = 0; i < kws.length && i < 3; i++) ids.push(kws[i].id);
                        Net.get('/discover/movie', {
                            with_keywords: ids.join('|'),
                            sort_by: 'popularity.desc',
                            include_adult: false,
                            'vote_count.gte': 40,
                            page: 1
                        }, function (dd) { cb((dd && dd.results) || []); }, function () { cb([]); });
                    }, function () { cb([]); });
                }
            ];
            parallel(tasks, function (res) {
                var merged = res[0].concat(res[1]);
                var seenId = {}, out = [];
                for (var i = 0; i < merged.length && out.length < CAPSULE_SIZE; i++) {
                    var m = merged[i];
                    if (!m || !m.poster_path || seenId[m.id]) continue;
                    seenId[m.id] = true;
                    out.push(m);
                }
                if (!out.length) { Toast.show('Ничего не найдено'); View.render(); return; }
                View.list = out;
                View.idx = 0;
                View.activeQuery = { kind: 'search', label: String(label || query).toUpperCase() };
                View.render();
                Toast.show('Отобрал ' + out.length + ' — приятного просмотра');
            });
        }
    };

    var Settings = {
        askKey: function () {
            askText('Ключ TMDb', pGet('tmdb_key', ''), function (v) {
                pSet('tmdb_key', v.replace(/\\s/g, ''));
                Net.drop();
                Toast.show('Ключ сохранён');
                View.loading(flavor().load);
                View.boot(true);
            });
        }
    };

    /* =========================================================================
       13. ЗАПУСК LAMPA / ВЫХОД
       ========================================================================= */
    function play(m) {
        try {
            if (window.Lampa && Lampa.Activity) {
                Lampa.Activity.push({ url: '', component: 'full', id: m.id, method: m.media_type === 'tv' ? 'tv' : 'movie', card: m, source: 'tmdb' });
                return;
            }
        } catch (e) {}
        Toast.show('Запуск карточки в Lampa');
    }
    function exitApp() { try { if (window.Lampa && Lampa.Activity) Lampa.Activity.backward(); } catch (e) {} }

    /* =========================================================================
       14. МАРШРУТИЗАЦИЯ КНОПОК
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
        if (kind === 'back') { exitApp(); return; }
        Nav.move(kind);
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

    var App = { active: false, fallback: false };

    function bindController() {
        try {
            if (window.Lampa && Lampa.Controller && Lampa.Controller.add) {
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
                return true;
            }
        } catch (e) {}
        return false;
    }

    function CapsuleComponent() {
        var node = null, wrapped = null;
        this.create = function () { node = View.create(); wrapped = window.$ ? window.$(node) : node; return this.render(); };
        this.render = function () { return wrapped; };
        this.start = function () {
            App.active = true;
            if (!bindController()) {
                App.fallback = true;
                document.addEventListener('keydown', keyFallback, true);
            }
        };
        this.pause = function () { App.active = false; };
        this.resume = function () { App.active = true; bindController(); };
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
       15. ПУНКТ МЕНЮ И СТАРТ
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
        setTimeout(tryAdd, 3500);
    }

    (function () {
        try {
            if (window.Lampa && Lampa.Component && Lampa.Component.add) Lampa.Component.add(COMPONENT_ID, CapsuleComponent);
            addMenu();
            console.log('[Капсула] v13.0 готова: TV / Mobile / PC');
        } catch (e) {
            console.error('[Капсула] ошибка старта:', e);
        }
    })();
})();
`;
