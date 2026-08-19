(function () {
    'use strict';
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;
    window.should_watch_plugin_enhanced = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var SETTINGS_FLAG = 'sw_settings_ready_v65';
    var ICON = '<svg viewBox="0 0 24 24" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>';
    var GENRE_ID_ANIM = 16, GENRE_ID_FAMILY = 10751, GENRE_ID_KIDS = 10762;

    var _metaCache = {};
    var _domCache = null;

    // ======================================================================
    // СЛОВАРИ ПОИСКА
    // ======================================================================
    var INTERESTING_TAGS = [
        { re: /based on (the )?novel|based on the book|основан на романе|основан на книге|экранизац/i, text: '✨ Экранизация книги' },
        { re: /based on a true story|inspired by true events|основан на реальных событиях|по реальным событиям|true story/i, text: '✨ На реальных событиях' },
        { re: /based on (the )?comic|comic book|graphic novel|по мотивам комикса|графическ(?:им|ий|ого)? роман/i, text: '✨ По мотивам комикса' },
        { re: /\boscar winner\b|academy award winner|лауреат[ ы]* оскар/i, text: '🏆 Лауреат премии «Оскар»' },
        { re: /\bcannes\b|\bvenice film festival\b|\bberlinale\b|film festival winner|призёр фестиваля|каннск(?:ий|ого) фестивал/i, text: '🎬 Призёр кинофестиваля' },
        { re: /cult film|cult classic|культов(?:ый|ая|ого) (?:фильм|сериал|классик)/i, text: '🎭 Культовый фильм' },
        { re: /\bremake\b|римейк|ремейк/i, text: '🔁 Ремейк' },
        { re: /\bsequel\b|сиквел|продолжение франшизы/i, text: '➕ Сиквел' },
        { re: /time travel|путешестви[яе] во времени|временн(?:ая|ой) петл/i, text: '⏳ Путешествия во времени' },
        { re: /\bheist\b|ограблен(?:ие|ия)/i, text: '💼 История ограбления' },
        { re: /post[- ]?apocalyptic|постапокалипсис/i, text: '☢️ Постапокалипсис' },
        { re: /\bdystopia\b|dystopian|антиутопи/i, text: '🏙 Антиутопия' },
        { re: /coming of age|взрослени[ея]|история взросления/i, text: '🌱 История взросления' },
        { re: /cyberpunk|киберпанк/i, text: '🤖 Киберпанк' },
        { re: /\bouter space\b|\bspaceship\b|\bastronaut\b|космос|\bmoon\b|\blunar\b|\bmars\b|марс(?:а|е|ианск)/i, text: '🚀 Космос' },
        { re: /biographical|\bbiopic\b|биографическ(?:ий|ая|ого)/i, text: '📖 Биографическая история' },
        { re: /survival story|выживани[ея]|борьб(?:а|у) за выживание/i, text: '🏝 История выживания' },
        { re: /alien invasion|вторжени[ея] пришельцев|инопланетн(?:ое|ого) вторжени/i, text: '👽 Вторжение пришельцев' }
    ];
    var FEATURES = [
        { re: /plot twist|twist ending|неожиданн(?:ый|ые) поворот|сюжетн(?:ый|ые) поворот/i, text: '🌀 Неожиданные повороты' },
        { re: /\bsuperhero\b|супергеро(?:й|и|ика)/i, text: '🦸 Супергероика' },
        { re: /strong female lead|сильн(?:ая|ой) героин/i, text: '💪 Сильная героиня' },
        { re: /\bmusical\b|мюзикл/i, text: '🎶 Мюзикл' },
        { re: /\bmagic\b|magical|маги[яию]|волшеб(?:ство|ный|ная)/i, text: '✨ Магия' },
        { re: /\bdragon\b|dragons|дракон(?:ы|а|ов)?/i, text: '🐉 Драконы' },
        { re: /\bdetective\b|детектив(?:ный|ная)?/i, text: '🔍 Детектив' },
        { re: /\bspy\b|espionage|шпион(?:аж|ские игры|ская)/i, text: '🕵️ Шпионские игры' },
        { re: /\bzombie\b|zombies|зомби/i, text: '🧟 Зомби' },
        { re: /\bvampire\b|vampires|вампир(?:ы|а|ов)?/i, text: '🧛 Вампиры' },
        { re: /\brobot\b|\bandroid\b|artificial intelligence|робот(?:ы|а)?|искусственн(?:ый|ого) интеллект/i, text: '🤖 Роботы и ИИ' },
        { re: /\banimal(?:s)?\b|животн(?:ые|ых|ое)/i, text: '🐾 Милые животные' },
        { re: /\bcat(?:s)?\b|кошк[аиу]|кошач(?:ий|ья)/i, text: '🐱 Котики' },
        { re: /\bdog(?:s)?\b|собак[аиу]|пёс\b|псы\b/i, text: '🐶 Собаки' },
        { re: /friendship|дружб[аеы]/i, text: '🤝 О дружбе' },
        { re: /\bromance\b|romantic|романтик[аиу]|романтическ(?:ий|ая)/i, text: '❤️ Романтика' },
        { re: /road trip|дорожн(?:ое|ая) приключени|путешестви[ея] на машине/i, text: '🚗 Дорожное приключение' },
        { re: /courtroom drama|trial|судебн(?:ый|ая) процесс|суд над/i, text: '⚖️ Судебная драма' }
    ];
    var DOM_METRICS = [['pace','Темп'],['fear','Страх'],['action','Экшен'],['violence','Насилие'],['sadness','Грусть'],['language','Лексика']].map(function(p){
        return { key: p[0], re: new RegExp(p[1] + '[\\s\\S]{0,60}?([\\d.,]+)\\s*/\\s*10') };
    });

    // ======================================================================
    // НАСТРОЙКИ
    // ======================================================================
    function getSetting(k, d) { try { var v = Lampa.Storage.get(PLUGIN_ID + '_' + k); if (v !== undefined && v !== null && v !== '') return v; } catch(e) {} return d; }
    function getSettings() {
        return {
            bad_genres: String(getSetting('bad_genres', '') || ''),
            bad_actors: String(getSetting('bad_actors', '') || ''),
            bad_directors: String(getSetting('bad_directors', '') || ''),
            min_rating: parseFloat(getSetting('min_rating', '6')) || 6,
            font_scale: parseInt(getSetting('font_scale', '20')) || 20,
            dice_font: parseInt(getSetting('dice_font', '88')) || 88
        };
    }
    function parseBL(s) { return s ? s.split(',').map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean) : []; }
    function initSettings() {
        try {
            if (!window.Lampa || !Lampa.SettingsApi || window[SETTINGS_FLAG]) return;
            window[SETTINGS_FLAG] = true;
            Lampa.SettingsApi.addComponent({ component: PLUGIN_ID, name: 'Стоит ли смотреть', icon: ICON });
            [
                { name: 'bad_genres', type: 'input', title: 'Нелюбимые жанры', description: 'Через запятую', default: '' },
                { name: 'bad_actors', type: 'input', title: 'Нелюбимые актёры', description: 'Через запятую', default: '' },
                { name: 'bad_directors', type: 'input', title: 'Нелюбимые авторы', description: 'Через запятую', default: '' },
                { name: 'min_rating', type: 'select', title: 'Минимальный рейтинг', values: {'0':'Любой','5':'5.0','6':'6.0','7':'7.0','8':'8.0'}, default: '6' },
                { name: 'font_scale', type: 'select', title: 'Размер шрифта', values: {'12':'12','14':'14','16':'16','18':'18','20':'20','24':'24','28':'28','32':'32'}, default: '20' },
                { name: 'dice_font', type: 'select', title: 'Текст в плашке кубика', values: {'40':'40','56':'56','72':'72','88':'88','104':'104','120':'120'}, default: '88' },
                { name: 'reset_cache', type: 'select', title: 'Кэш данных', values: {'0':'Хранить','1':'Сбросить при открытии'}, default: '0' }
            ].forEach(function(p) {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: { name: PLUGIN_ID + '_' + p.name, type: p.type, values: p.values || '', default: p.default },
                    field: { name: p.title, description: p.description }
                });
            });
        } catch(e) { console.error('[SW] initSettings:', e); }
    }

    // ======================================================================
    // МИНИМАЛЬНЫЙ CSS ДЛЯ РЯДА КАРТОЧЕК-ЗАГЛУШЕК
    // Как только появится готовая вёрстка карточек — этот блок заменяется
    // на неё, JS-логика ниже (renderCards) трогать не придётся.
    // ======================================================================
    function injectCSS() {
        if (document.getElementById('sw-plugin-styles-enhanced')) return;
        var s = document.createElement('style'); s.id = 'sw-plugin-styles-enhanced';
        s.innerHTML =
            '.sw-cards-row{display:flex;gap:16px;margin:20px 0;overflow-x:auto;padding-bottom:4px}' +
            '.sw-cards-row::-webkit-scrollbar{height:5px}' +
            '.sw-cards-row::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:10px}' +
            '.sw-card{flex:0 0 auto;width:220px;aspect-ratio:1/1;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.05);transition:background .2s ease}' +
            '@media(max-width:640px){.sw-card{width:150px}}';
        document.head.appendChild(s);
    }

    // ======================================================================
    // УТИЛИТЫ
    // ======================================================================
    var escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) { if (typeof s !== 'string') return ''; return s.replace(/[&<>"']/g, function(m){ return escMap[m]; }); }
    function hasGenre(g, re) { return g.some(function(x){ return re.test((x || '').toLowerCase()); }); }
    function inText(s, re) { return re.test((s || '').toLowerCase()); }
    function inAnyText(texts, re) { return texts.some(function(s){ return inText(s, re); }); }
    function mediaType(m) { return (m && m.name && !m.title) ? 'tv' : 'movie'; }
    function uniq(arr) { return arr.filter(function(v,i,s){ return s.indexOf(v) === i; }); }
    function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

    function genreByIdOrName(genresRaw, ids, nameRe) {
        if (!genresRaw || !genresRaw.length) return false;
        for (var i = 0; i < genresRaw.length; i++) {
            var g = genresRaw[i];
            if (g && typeof g === 'object') {
                if (g.id && ids.indexOf(g.id) >= 0) return true;
                if (nameRe.test((g.name || '').toLowerCase())) return true;
            } else if (typeof g === 'string') { if (nameRe.test(g.toLowerCase())) return true; }
        }
        return false;
    }

    // ======================================================================
    // ЗАПРОСЫ К TMDB / LAMPA
    // ======================================================================
    function loadCredits(movie) {
        try {
            if (movie.credits && ((movie.credits.cast && movie.credits.cast.length) || (movie.credits.crew && movie.credits.crew.length))) return Promise.resolve(movie.credits);
            var id = movie.id || movie.tmdb_id; if (!id) return Promise.resolve(null);
            if (Lampa.TMDB && typeof Lampa.TMDB.credits === 'function') {
                return new Promise(function(res){ Lampa.TMDB.credits(id, function(d){ res(d && !d.status_code ? d : null); }, function(){ res(null); }); });
            }
        } catch(e) {}
        return Promise.resolve(null);
    }
    function tmdbKey() { try { if (Lampa.TMDB && Lampa.TMDB.key) return Lampa.TMDB.key; } catch(e) {} return '4ef0d7355d9ffb5151e987764708ce96'; }
    function curLangCode() { try { var l = Lampa.Storage.get('language', 'ru') || 'ru'; return l + '-' + l.toUpperCase(); } catch(e) { return 'ru-RU'; } }
    var TMDB_TIMEOUT_MS = 5000;
    function tmdbGet(path, lang) {
        return new Promise(function(res){
            var settled = false;
            var to = setTimeout(function(){ if (!settled) { settled = true; res(null); } }, TMDB_TIMEOUT_MS);
            function done(v) { if (settled) return; settled = true; clearTimeout(to); res(v); }
            try {
                var langCode = lang || curLangCode();
                var url = 'https://api.themoviedb.org/3' + path + (path.indexOf('?') > -1 ? '&' : '?') + 'language=' + langCode + '&api_key=' + tmdbKey();
                if (Lampa.Request && typeof Lampa.Request.get === 'function') {
                    Lampa.Request.get(url, function(d){ done(d && d.status_code ? null : d); }, function(){ done(null); }, { dataType: 'json' });
                } else if (typeof fetch !== 'undefined') {
                    fetch(url).then(function(r){ return r.json(); }).then(function(d){ done(d && d.status_code ? null : d); }).catch(function(){ done(null); });
                } else done(null);
            } catch(e) { done(null); }
        });
    }
    function mapUSRating(s) {
        return { 'G':0,'PG':7,'PG-13':13,'R':17,'NC-17':17,'TV-MA':17,'TV-14':14,'TV-PG':7,'TV-G':0,'TV-Y7':7,'TV-Y':0,'MA':17,'18':18,'16':16,'12':12,'12A':12,'15':15 }[(s || '').toUpperCase().trim()] || null;
    }
    function loadMeta(movie) {
        var id = movie.id || movie.tmdb_id;
        if (!id) return Promise.resolve({ kw: [], age: null, reviews: [], hasTrailer: false, enOv: '' });
        if (_metaCache[id]) return Promise.resolve(_metaCache[id]);
        if (Object.keys(_metaCache).length > 100) _metaCache = {};
        var type = mediaType(movie);
        return Promise.all([
            tmdbGet('/' + type + '/' + id + '/keywords'),
            tmdbGet('/' + type + '/' + id + '/content_ratings'),
            tmdbGet('/' + type + '/' + id + '/reviews'),
            tmdbGet('/' + type + '/' + id + '/videos'),
            tmdbGet('/' + type + '/' + id, 'en-US')
        ]).then(function(arr){
            var kw = [];
            if (arr[0]) (arr[0].keywords || arr[0].results || []).forEach(function(k){ if (k && k.name) kw.push(k.name.toLowerCase()); });
            var age = null;
            if (arr[1] && arr[1].results) {
                var ru = arr[1].results.find(function(x){ return x.iso_3166_1 === 'RU'; });
                var us = arr[1].results.find(function(x){ return x.iso_3166_1 === 'US'; });
                if (ru && ru.rating) { var n = parseInt(ru.rating); if (!isNaN(n)) age = n; }
                if (age === null && us && us.rating) age = mapUSRating(us.rating);
                if (age === null && arr[1].results.length) { var f = arr[1].results[0]; if (f.rating) { var n2 = parseInt(f.rating); age = !isNaN(n2) ? n2 : mapUSRating(f.rating); } }
            }
            var reviews = [];
            if (arr[2] && arr[2].results) reviews = arr[2].results.slice(0, 6).map(function(r){ return { author: r.author || 'Аноним', text: (r.content || '').replace(/<[^>]+>/g, '').trim() }; }).filter(function(r){ return r.text.length > 20; });
            var hasTrailer = false;
            if (arr[3] && arr[3].results) hasTrailer = arr[3].results.some(function(v){ return v.type === 'Trailer' && v.site === 'YouTube'; });
            var enOv = (arr[4] && arr[4].overview) ? arr[4].overview : '';
            var r = { kw: kw, age: age, reviews: reviews, hasTrailer: hasTrailer, enOv: enOv };
            if (!r.kw.length) {
                return tmdbGet('/' + type + '/' + id + '/keywords').then(function(d){
                    if (d) (d.keywords || d.results || []).forEach(function(k){ if (k && k.name) r.kw.push(k.name.toLowerCase()); });
                    _metaCache[id] = r; return r;
                });
            }
            _metaCache[id] = r; return r;
        });
    }
    function hasKw(ctx, re) { return ctx.kw.some(function(k){ return re.test(k); }); }

    // ======================================================================
    // АНАЛИЗ ОТЗЫВОВ (пословный разбор с учётом отрицаний)
    // ======================================================================
    var POS_STEMS = ['шедевр','велик','потряса','восхити','блестящ','лучш','мощн','гениальн','замечательн','превосходн','отличн','весел','смешн','понрав','совету','хорош','обожа','наслажд','увлекательн','захватыва','крут','идеальн','любим','супер','кайф','цепля'];
    var NEG_STEMS = ['скучн','ужасн','провал','разочаров','слаб','затянут','бессмысл','плох','утомительн','неинтересн','отврат','кошмар','бредов','тосклив','занудн','вторичн','посредствен','примитивн'];
    var POS_STEMS_EN = ['masterpiece','brilliant','amazing','great','best','loved','love','perfect','outstanding','wonderful','fantastic','enjoyable','impressive','superb'];
    var NEG_STEMS_EN = ['boring','bad','worst','terrible','awful','disappoint','waste','dull','pointless','mediocre','weak','annoying','cringe'];
    var STRONG_NEG_PHRASES = ['так себе','ни о чем','ни о чём','не рекомендую','не советую','не понравил','не впечатлил','время потрачено зря','деньги на ветер','не о чем говорить','зря потратил'];
    var STRONG_POS_PHRASES = ['маст хэв','must watch','всем советую','однозначно рекомендую','на одном дыхании','не пожалел','всем рекомендую'];
    var NEGATORS = ['не', 'ни', 'вовсе', 'нисколько', 'едва', 'вряд'];
    function classifyReview(text) {
        var t = (text || '').toLowerCase();
        var tokens = t.match(/[a-zа-яё]+/gi) || [];
        var pos = 0, neg = 0;
        for (var i = 0; i < tokens.length; i++) {
            var w = tokens[i];
            var negate = (i > 0 && NEGATORS.indexOf(tokens[i - 1]) >= 0) || (i > 1 && NEGATORS.indexOf(tokens[i - 2]) >= 0 && tokens[i - 1].length <= 6);
            var isPos = POS_STEMS.some(function(s){ return w.indexOf(s) === 0; }) || POS_STEMS_EN.indexOf(w) >= 0;
            var isNeg = NEG_STEMS.some(function(s){ return w.indexOf(s) === 0; }) || NEG_STEMS_EN.indexOf(w) >= 0;
            if (isPos) { if (negate) neg++; else pos++; }
            else if (isNeg) { if (negate) pos++; else neg++; }
        }
        STRONG_NEG_PHRASES.forEach(function(p){ if (t.indexOf(p) >= 0) neg += 2; });
        STRONG_POS_PHRASES.forEach(function(p){ if (t.indexOf(p) >= 0) pos += 2; });
        if (pos === 0 && neg === 0) return null;
        if (pos > neg) return 'pos';
        if (neg > pos) return 'neg';
        return 'mix';
    }
    function reviewStats(reviews) {
        var pos = 0, neg = 0, mix = 0;
        reviews.forEach(function(r){
            var c = classifyReview(r.text);
            if (c === 'pos') pos++; else if (c === 'neg') neg++; else if (c === 'mix') mix++;
        });
        var judged = pos + neg + mix;
        var tone = judged === 0 ? null : (pos > neg && pos >= mix ? 'pos' : (neg > pos && neg >= mix ? 'neg' : (judged > 0 ? 'mix' : null)));
        return { total: reviews.length, pos: pos, neg: neg, tone: tone };
    }

    // ======================================================================
    // DOM-СИГНАЛЫ СО СТРАНИЦЫ ЛАМПЫ (настроения/метрики/комментарии) И
    // ЛОКАЛЬНЫЕ ДАННЫЕ ЛАМПЫ (избранное/прогресс просмотра)
    // ======================================================================
    function readDomSignals(key) {
        if (_domCache && _domCache.key === key) return _domCache.data;
        var out = { mm: {}, moods: [], ok: false, age: null, reviews: [] };
        try {
            var txt = document.body.innerText || '';
            var amAll = txt.match(/\b(0|6|12|16|18)\+/g);
            if (amAll) for (var i = 0; i < amAll.length; i++) { var v3 = parseInt(amAll[i], 10); if (!isNaN(v3) && (out.age === null || v3 > out.age)) out.age = v3; }
            var mm = {}, found = 0;
            DOM_METRICS.forEach(function(p){
                var r = txt.match(p.re);
                if (r) { mm[p.key] = parseFloat(r[1].replace(',', '.')); found++; }
            });
            var moods = [];
            var mi = txt.indexOf('Настроения');
            if (mi > -1) {
                var chunk = txt.substring(mi + 10, mi + 1600);
                var re = /(\d{1,3})\s*%\s*\n?\s*([А-Яа-яЁёA-Za-z][А-Яа-яЁёA-Za-z….\-]{2,24})/g, r2;
                while ((r2 = re.exec(chunk)) && moods.length < 12) moods.push({ name: r2[2].trim(), pct: parseInt(r2[1]) });
            }
            if (found >= 3 || moods.length >= 3) { out.mm = mm; out.moods = moods; out.ok = true; }
            var ci = txt.indexOf('Комментарии');
            if (ci < 0) ci = txt.indexOf('Отзывы');
            if (ci > -1) {
                var lines = txt.substring(ci + 11, ci + 6000).split(/\n+/);
                for (var i2 = 0; i2 < lines.length && out.reviews.length < 8; i2++) {
                    var ln = lines[i2].trim();
                    if (!ln) continue;
                    if (/^(Сезон|Режиссёр|Актёры|Производство|Теги|Настроения|Подробно)/.test(ln)) break;
                    if (/^\d+[\s.,:]*$/.test(ln)) continue;
                    if (/^(Ответить|Пожаловаться|Показать ещё|Смотреть|В избранное|Поделиться)$/i.test(ln)) continue;
                    if (ln.length >= 40) out.reviews.push({ author: 'зритель', text: ln });
                }
            }
        } catch(e) {}
        _domCache = { key: key, data: out };
        return out;
    }

    function lampaLocal(movie) {
        var out = { inFavorite: false, favList: null, viewedPercent: 0 };
        try {
            var id = movie.id || movie.tmdb_id || (movie.movie && (movie.movie.id || movie.movie.tmdb_id));
            if (!id) return out;
            var sid = String(id);
            if (window.Lampa && Lampa.Favorite && typeof Lampa.Favorite.list === 'function') {
                ['scheduled','later','viewed'].forEach(function(n){
                    if (out.inFavorite) return;
                    try {
                        var l = Lampa.Favorite.list(n);
                        if (Object.prototype.toString.call(l) === '[object Array]') {
                            for (var i = 0; i < l.length; i++) {
                                var x = l[i];
                                if (x && String(x.id || x.tmdb_id || '') === sid) { out.inFavorite = true; out.favList = n; break; }
                            }
                        }
                    } catch(e) {}
                });
            }
            if (window.Lampa && Lampa.Timeline && typeof Lampa.Timeline.get === 'function') {
                try {
                    var t = Lampa.Timeline.get(sid);
                    if (!t && !isNaN(Number(sid))) t = Lampa.Timeline.get(Number(sid));
                    if (t) {
                        if (t.duration > 0 && t.time >= 0) out.viewedPercent = Math.min(100, Math.round(100 * t.time / t.duration));
                        else if (typeof t.percent === 'number' && t.percent >= 0) out.viewedPercent = Math.min(100, Math.round(t.percent));
                    }
                } catch(e) {}
            }
        } catch(e) {}
        return out;
    }

    function findSparkle(meta, credits) {
        var sparks = [];
        var texts = [meta.enOv || ''].concat(meta.kw || []);
        INTERESTING_TAGS.forEach(function(t){
            if (texts.some(function(txt){ return t.re.test(txt || ''); })) sparks.push(t.text);
        });
        if (credits && credits.crew) {
            var dirs = credits.crew.filter(function(c){ return c.job === 'Director'; });
            if (dirs.length === 1 && dirs[0].name) sparks.push('🎬 Режиссёр: ' + dirs[0].name);
        }
        return sparks.slice(0, 2);
    }
    function findFeatures(meta) {
        var feats = [];
        var texts = [meta.enOv || ''].concat(meta.kw || []);
        FEATURES.forEach(function(f){
            if (texts.some(function(txt){ return f.re.test(txt || ''); })) feats.push(f.text);
        });
        return feats.slice(0, 3);
    }

    // ======================================================================
    // ГЛАВНЫЙ АНАЛИЗ — возвращает { pros, cons, score, norm, vClass, vWord, ... }
    // Это единственная точка, которую должен дёргать будущий интерфейс.
    // ======================================================================
    function analyze(movie) {
        return Promise.all([loadCredits(movie), loadMeta(movie), Promise.resolve(lampaLocal(movie))]).then(function(arr){
            var credits = arr[0], meta = arr[1], local = arr[2];
            var cfg = getSettings();
            var blG = parseBL(cfg.bad_genres), blA = parseBL(cfg.bad_actors), blD = parseBL(cfg.bad_directors);
            var now = new Date().getFullYear();
            var q = (movie.quality || movie.source_quality || '').toString().toUpperCase();
            var rating = parseFloat(movie.vote_average) || 0;
            var votes = parseInt(movie.vote_count) || 0;
            var runtime = parseInt(movie.runtime) || 0;
            var genresRaw = movie.genres || [];
            var genres = genresRaw.map(function(g){ return typeof g === 'string' ? g : (g && g.name) || ''; }).filter(Boolean);
            var ovRu = (movie.overview || '').trim(), ovEn = (meta.enOv || '').trim(), ovBoth = [ovRu, ovEn];
            var yr = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : 0;
            var dom = readDomSignals(movie.id || movie.tmdb_id || 'x');
            var mm = dom.ok ? dom.mm : {}, moods = dom.ok ? dom.moods : [];
            var domRevs = dom.reviews || [];
            var allRev = meta.reviews.concat(domRevs);
            var rt = reviewStats(allRev);
            var who = domRevs.length ? 'Комментаторы' : 'Зрители';
            var ctx = { kw: meta.kw };
            var M = 150, C = 6.1;
            var adj = votes > 0 ? ((votes * rating) + (M * C)) / (votes + M) : 0;
            var cast = (credits && credits.cast || []).slice(0, 15).map(function(c){ return c.name; }).filter(Boolean);
            var crew = credits && credits.crew || [];
            var dirs = crew.filter(function(c){ return c.job === 'Director'; }).map(function(c){ return c.name; }).filter(Boolean);
            var wrts = crew.filter(function(c){ return ['Writer','Screenplay','Story','Author'].indexOf(c.job) >= 0; }).map(function(c){ return c.name; }).filter(Boolean);
            var isAnim = genreByIdOrName(genresRaw, [GENRE_ID_ANIM], /animation|анимац|мульт|anime|аниме/);
            var hasFamilyGenre = genreByIdOrName(genresRaw, [GENRE_ID_FAMILY, GENRE_ID_KIDS], /family|семейн|kids|детск/);
            var kidsKw = hasKw(ctx, /for kids|children|family-friendly|детям|семейн|для детей|preschool|toddler|baby|nursery|cartoon for kids|kids tv|educational|animated series|дошкольн|малыш/i);

            var age = dom.age;

            function dim(kwRe, ovRe) { var k = hasKw(ctx, kwRe); var o = !!ovRe && inAnyText(ovBoth, ovRe); return { k: k, o: o }; }
            var dViol = dim(/violenc|violent|gore|murder|blood|tortur|brutal|weapon|massacre|execution|stab|slaughter|gunfight|shootout|hitman|serial killer|battle/, /убийств|насил|жесток|кровь|крови|кровью|кровав|кровопролит|стрельб|перестрел|взрыв|оружи|резн|террор|бойн/);
            var dDrugs = dim(/drug|meth lab|methamphetamine|crystal meth|cocaine|heroin|marijuan|cannabis|narcotic|addiction|overdose|dealer|cartel|crack|lsd|ecstasy|opium/, /метамфетам|амфетам|наркот|кокаин|героин|марихуан|лсд|экстази|опиум|дилер|картел|зависимост|зелье|травк|варит/);
            var dNud = dim(/nudity|topless|strip club|stripper|full frontal|rear nudity/, /обнаж|нагот|голышом|раздет|стриптиз/);
            var dSex = dim(/sex scene|sexual content|orgy|prostitut|erotic|one night stand|hooker|threesome|explicit/, /эротик|откровенн|проститут|интим|секс|постельн|презерватив/);
            var dSmoke = dim(/smoking|cigarette|cigar/, /курени|сигарет|табак/);
            var dAlc = dim(/alcohol|drunkenness|drunk|booze|hangover|beer|wine|vodka|whiskey/, /алкогол|водк|виски|выпив|пьян|похмел/);
            var dProf = dim(/profanity|strong language|swearing|f word|vulgarity/, /нецензур|сквернослов|матерщин/);
            var dSuic = dim(/suicide|self harm|suicidal/, /суицид|самоубийств|покончи/);
            var dGamb = dim(/gambl|casino|poker|betting|bookmaker|lottery|roulette|slot machine|blackjack/, /азарт|казино|ставки на|тотализатор|покер|рулетк|игровые автомат|лотере|букмекер/);
            var dCrime = dim(/criminal|crime|heist|robbery|mafia|gangster|prison|police|detective|thief|outlaw|cartel|drug lord|dea agent/, /криминал|преступ|грабеж|ограб|мафи|банд|тюрьм|полици|следовател|мошенник|контрабанд|крад|похищ|вору/);
            var dPsych = dim(/psychopath|sociopath|serial killer|paranoia|mental illness|schizophren|disturbing|psychological/, /психопат|социопат|маньяк|параной|безуми|шизофрен|психологическ/);
            var dIll = dim(/terminal illness|cancer|chemotherapy|leukemia|leukaemia|tumor|tumour|alzheimer|parkinson|aids|brain tumor|lung cancer|incurable/, /онколог|злокачествен|химиотерап|лейкеми|неизлечим|терминальн|альцгеймер|паркинсон|рак лёгких|рак мозга|опухол/);
            var dWar = dim(/war|vietnam|world war|soldier|combat|army/, /военн|фрон|солдат|арми|боев|войск/);
            var dChild = dim(/child abuse|abused child|child neglect|cruelty to children|child cruelty|abusive parent|child violence|pedophile|pedophilia/, /насилие над детьми|жестокое обращение с детьми|издевается над детьми|избивает детей|абьюз детей|педофил/);
            var dDarkCom = hasKw(ctx, /dark comed|black comed|satire|parody|absurd/) || inAnyText(ovBoth, /черн юмор|сатир|пароди|абсурд/);

            if (age !== null && age <= 12) { dSex.o = false; dNud.o = false; }

            var gHorror = hasGenre(genres, /horror|ужас|slasher/i);
            var gWar = hasGenre(genres, /war|военн/i);
            var gCrime = hasGenre(genres, /crime|криминал/i);
            var gThr = hasGenre(genres, /thriller|триллер/i);

            var cViol = (dViol.k?50:0)+(dViol.o?30:0)+((mm.violence||0)>=6?40:((mm.violence||0)>=4?20:0))+(gHorror||gWar?20:(gCrime&&gThr?15:0))+(age!==null&&age>=18?15:(age!==null&&age>=16?10:0));
            var cDrugs = (dDrugs.k?50:0)+(dDrugs.o?30:0)+(gCrime?10:0)+(age!==null&&age>=16?10:0);
            var cSex = (dSex.k?50:0)+(dNud.k?40:0)+(dSex.o?30:0)+(dNud.o?30:0)+(age!==null&&age>=18?15:0);
            var cProf = (dProf.k?50:0)+(dProf.o?30:0)+((mm.language||0)>=5?40:((mm.language||0)>=3?20:0))+(age!==null&&age>=18?10:0);
            var cFear = (gHorror?50:0)+(hasKw(ctx,/horror|scary|haunted|possess|demon|jump scare|ghost/)?30:0)+((mm.fear||0)>=6?40:((mm.fear||0)>=4?20:0))+(gThr?10:0)+(dPsych.k?10:0);
            var cSuic = (dSuic.k?50:0)+(dSuic.o?30:0)+(dIll.k?10:0);
            var cAlc = (dAlc.k?40:0)+(dAlc.o?30:0);
            var cSmoke = (dSmoke.k?40:0)+(dSmoke.o?30:0);
            var cGamb = (dGamb.k?50:0)+(dGamb.o?30:0);
            var cCrime = (dCrime.k?35:0)+(dCrime.o?25:0)+(gCrime?35:0)+(age!==null&&age>=16?15:0);
            var cChild = (dChild.k?60:0)+(dChild.o?40:0);

            var hardAdult = cViol >= 50 || cDrugs >= 30 || cSex >= 30 || cChild >= 50 || !!movie.adult;
            var familyOK;
            if (isAnim) {
                if (age !== null && age <= 6) familyOK = !hardAdult;
                else if (age !== null && age <= 12) familyOK = !hardAdult && cSuic < 40 && cFear < 40 && cViol < 30;
                else if (age !== null && age >= 16) familyOK = false;
                else familyOK = !hardAdult && cSuic < 40 && cProf < 40 && (hasFamilyGenre || kidsKw);
            } else {
                familyOK = !hardAdult && cFear < 40 && cSuic < 40 && rating >= 5 && ((age !== null && age <= 12) || hasFamilyGenre || kidsKw);
            }

            var mG = genres.filter(function(g){ return blG.some(function(b){ return g.toLowerCase().indexOf(b) >= 0; }); });
            var mA = cast.filter(function(a){ return blA.some(function(b){ return a.toLowerCase().indexOf(b) >= 0; }); });
            var mD = [].concat(dirs, wrts).filter(function(p){ return blD.some(function(b){ return p.toLowerCase().indexOf(b) >= 0; }); });

            var F = [], usedG = {};
            function add(src, kind, text, w, group) {
                if (group) { if (usedG[group]) return; usedG[group] = 1; }
                F.push({ src: src, kind: kind, text: text, w: w });
            }

            findSparkle(meta, credits).forEach(function(s){ add('sparkle','pro',s,25); });
            findFeatures(meta).forEach(function(t,i){ add('sparkle','pro',t,10,'feat'+i); });

            if (votes >= 3000 && adj >= 8.0) add('card','pro','✨ Высокий рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' голосов)', 30, 'ratehi');
            else if (votes >= 500 && adj >= cfg.min_rating) add('card','pro','✨ Хороший рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' голосов)', 20, 'ratehi');
            else if (votes >= 100 && adj >= cfg.min_rating) add('card','pro','✨ Достойный рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' голосов)', 14, 'ratehi');
            if (votes > 0 && votes < 1500 && adj >= 7.6) add('card','pro','🔍 Скрытая жемчужина', 12);
            if (votes >= 2000 && adj >= 7.8 && yr > 0 && yr <= now - 5) add('card','pro','🏛 Культурное наследие', 12);
            if (yr === now) add('card','pro','🆕 Новинка ' + yr + ' года', 6, 'fresh');
            if (votes > 0 && votes < 100) add('card','con','❓ Мало оценок (' + votes + ')', 14, 'rateunc');
            if (votes === 0) add('card','con','⚠️ Нет оценок', 16, 'rateunc');
            if (votes >= 100 && adj < cfg.min_rating) add('card','con','📉 Рейтинг ниже порога: ' + rating.toFixed(1), 22, 'ratelow');
            else if (votes >= 50 && rating > 0 && rating < 5) add('card','con','📉 Низкий рейтинг: ' + rating.toFixed(1), 26, 'ratelow');
            if (runtime > 0 && runtime <= 95) add('card','pro','⏱ Небольшой хронометраж: ' + runtime + ' мин', 7, 'runtime');
            else if (runtime > 150) add('card','con','⌛ Длинный фильм: ' + runtime + ' мин', 12, 'runtime');
            if (/CAM|TS|HDCAM|HDRIP|TELECINE|SCR|WORKPRINT|TELESYNC/i.test(q)) add('card','con','⚠️ Слабое качество копии', 26, 'quality');
            else if (/4K|UHD|2160p/i.test(q)) add('card','pro','🎥 4K', 10, 'quality');
            else if (q) add('card','pro','🎥 Хорошее качество копии', 7, 'quality');

            if (mG.length) add('user','con','⛔ Нелюбимые жанры: ' + mG.join(', '), 40);
            if (mA.length) add('user','con','⛔ Нелюбимые актёры: ' + uniq(mA).slice(0,2).join(', '), 35);
            if (mD.length) add('user','con','⛔ Нелюбимые авторы: ' + uniq(mD).slice(0,2).join(', '), 35);

            if (familyOK && isAnim) add('tmdb','pro','🧸 Детский' + (age !== null ? ' (' + age + '+)' : ''), 16, 'family');
            else if (familyOK) add('tmdb','pro','👪 Семейный' + (age !== null ? ' (' + age + '+)' : ''), 16, 'family');
            if (age !== null && age >= 18) add('tmdb','con','🔞 Для взрослых (18+)', 14, 'age');
            else if (age !== null && age >= 16) add('tmdb','con','🔞 Ограничение 16+', 12, 'age');
            if (isAnim && !familyOK) add('tmdb','con','🔞 Взрослая анимация' + (age !== null ? ' (' + age + '+)' : ''), 14, 'adultanim');

            if (cViol >= 50) add('tmdb','con','🔪 Сцены насилия', 16, 'violence');
            if (cDrugs >= 30) add('tmdb','con','💉 Упоминание наркотиков', 14, 'drugs');
            if (cSex >= 30) add('tmdb','con','🫣 Откровенные сцены', 12, 'sex');
            if (cProf >= 40) add('tmdb','con','🤬 Нецензурная лексика', 10, 'lang');
            if (cFear >= 40) add('moods','con','😱 Страшно', 14, 'scare');
            else if ((mm.fear||0) >= 3.5) add('moods','pro','😬 Напряжённый сюжет', 9, 'tension');
            if (cSuic >= 40) add('tmdb','con','⚠️ Тема суицида', 16, 'suic');
            if (cAlc >= 40) add('tmdb','con','🍺 Употребление алкоголя', 6, 'alc');
            if (cSmoke >= 40) add('tmdb','con','🚬 Курение', 5, 'smoke');
            if (cGamb >= 40) add('tmdb','con','🎰 Азартные игры', 10, 'gamb');
            if (cCrime >= 50) add('tmdb','con','⚖️ Криминальная тематика', 8, 'crime');
            if (dPsych.k || dPsych.o) add('tmdb','con','🌑 Тяжёлая атмосфера', 8, 'psych');
            if (dIll.k || dIll.o) add('tmdb','con','🏥 Тема болезни', 6, 'ill');
            if (dWar.k || dWar.o) add('tmdb','con','🎖 Война', 8, 'war');
            if (cChild >= 50) add('tmdb','con','🚸 Насилие над детьми', 18, 'childabuse');
            if (dDarkCom) add('tmdb','pro','🖤 Чёрный юмор', 8, 'darkcom');
            if (meta.hasTrailer) add('tmdb','pro','▶ Есть трейлер', 5);
            if (hasGenre(genres, /documentary|документ/i)) add('tmdb','pro','🎥 Документальный фильм', 8);

            if (mm.pace >= 6.5) add('moods','pro','⚡ Динамичный', 12);
            else if (mm.pace > 0 && mm.pace <= 2.5 && runtime > 120) add('moods','con','🐢 Медленный темп', 8);
            if (mm.action >= 6) add('moods','pro','💥 Экшен', 12);
            if (mm.sadness >= 6) add('moods','pro','😢 Трогательный', 10, 'sad');
            moods.forEach(function(md){
                var n = (md.name || '').toLowerCase();
                if (/вес[её]л|комедий|юмор/.test(n) && md.pct >= 20) add('moods','pro','😂 Развеселит', 14, 'fun');
                else if (/напряжен/.test(n) && md.pct >= 30) add('moods','pro','🔥 Напряжённый', 8, 'tension');
                else if (/тревож/.test(n) && md.pct >= 40) add('moods','pro','😰 Тревожный', 6, 'anxiety');
                else if (/задумчив|драматич/.test(n) && md.pct >= 25) add('moods','pro','🎭 Глубокий', 8);
                else if (/романтич/.test(n) && md.pct >= 18) add('moods','pro','❤️ Романтичный', 8);
                else if (/загадоч/.test(n) && md.pct >= 15) add('moods','pro','🕵️ Загадочный', 8);
                else if (/ностальг/.test(n) && md.pct >= 8) add('moods','pro','🕰 Ностальгический', 6);
                else if (/груст/.test(n) && md.pct >= 20) add('moods','con','😔 Не для ранимых', 6, 'sad');
            });
            if (hasGenre(genres, /comedy|комедия/i) && (mm.sadness || 0) <= 3) add('moods','pro','😂 Комедия', 10, 'fun');

            if (rt.total >= 4 && rt.tone === 'pos') add('reviews','pro','💬 ' + who + ' в основном хвалят', 14, 'rev');
            else if (rt.total >= 4 && rt.tone === 'neg') add('reviews','con','💬 ' + who + ' в основном критикуют', 16, 'rev');
            else if (rt.total >= 4 && rt.tone === 'mix') add('reviews','pro','💬 Мнения разделились', 8, 'rev');

            if (local.inFavorite && local.favList === 'viewed') add('lampa','con','👁 Уже смотрели', 8, 'lampa');
            else if (local.inFavorite) add('lampa','pro','🔖 В закладках', 8, 'lampa');
            if (local.viewedPercent >= 90) add('lampa','con','👁 Досмотрено на ' + local.viewedPercent + '%', 8, 'lampa');
            else if (local.viewedPercent >= 10) add('lampa','con','⏸ Брошено на ' + local.viewedPercent + '%', 12, 'lampa');

            var CAPS = { card: 55, user: 50, tmdb: 45, moods: 40, reviews: 18, lampa: 18, sparkle: 60 };
            var per = {};
            var sumPro = 0, sumCon = 0;
            F.forEach(function(f){
                var s = per[f.src] || (per[f.src] = { pro: 0, con: 0 });
                s[f.kind] += f.w;
                if (f.kind === 'pro') sumPro += f.w; else sumCon += f.w;
            });
            var score = 0;
            Object.keys(per).forEach(function(k){
                var cap = CAPS[k] || 40;
                score += Math.min(per[k].pro, cap) - Math.min(per[k].con, cap);
            });
            var metaRich = !!(meta.kw.length || meta.reviews.length);
            var activeSrc = 1 + (metaRich ? 1 : 0) + (rt.total >= 4 ? 1 : 0) + (dom.ok || moods.length ? 1 : 0) + (local.inFavorite || local.viewedPercent > 0 ? 1 : 0);
            var lowConf = activeSrc <= 2;
            if (lowConf) score = Math.round(score * 0.6);
            if (score > 100) score = 100; if (score < -100) score = -100;
            var meterW = (sumPro + sumCon) > 0 ? Math.round(100 * sumPro / (sumPro + sumCon)) : 50;
            if (meterW < 5) meterW = 5; if (meterW > 95) meterW = 95;
            var vClass = score >= 22 ? 'yes' : (score <= -22 ? 'no' : 'maybe');
            var vWord = score >= 22 ? 'СТОИТ' : (score <= -22 ? 'НЕ СТОИТ' : 'СПОРНО');
            var sortF = function(a,b){ return b.w - a.w; };
            var pros = F.filter(function(f){ return f.kind === 'pro'; }).sort(sortF).map(function(f){ return f.text; });
            var cons = F.filter(function(f){ return f.kind === 'con'; }).sort(sortF).map(function(f){ return f.text; });
            if (!pros.length) pros.push('ℹ️ Нет данных');
            if (!cons.length) cons.push((blG.length || blA.length || blD.length) ? '✅ Фильтры чисты' : '✅ Минусов нет');
            return { pros: pros, cons: cons, review: rt, score: score, norm: meterW, vClass: vClass, vWord: vWord, mode: metaRich ? 'TMDB' : 'TAGS', metaRich: metaRich };
        });
    }

    // ======================================================================
    // ИНТЕРФЕЙС — ВРЕМЕННАЯ ЗАГЛУШКА
    // Вставляет пустой ряд карточек на страницу фильма/сериала (там же, где
    // обычно кнопки «Смотреть / В избранное / …»). Сейчас карточки серые и
    // ничем не заполнены — как только появится готовая вёрстка, замените
    // содержимое renderCards() (или подключите window.SW_renderCards —
    // если такая функция определена, она вызывается с результатом анализа
    // и может сама нарисовать карточки, не трогая всё, что выше).
    // ======================================================================
    var CARD_SLOTS = 6;

    function buildEmptyRow() {
        var row = $('<div class="sw-cards-row" data-sw-cards></div>');
        for (var i = 0; i < CARD_SLOTS; i++) {
            row.append($('<div class="sw-card sw-card-empty"></div>').attr('data-slot', i));
        }
        return row;
    }

    function renderCards(el, movie) {
        try {
            if (!el || !el.length || el.find('.sw-cards-row').length) return;
            var row = buildEmptyRow();
            var anchor = el.find('.full-start__buttons,.full-start-new__buttons,.full-card__buttons').last();
            if (anchor.length) anchor.after(row); else el.append(row);

            analyze(movie).then(function(result) {
                row.attr('data-sw-ready', '1');
                row.get(0).swResult = result;
                try {
                    document.dispatchEvent(new CustomEvent('sw:analysis-ready', {
                        detail: { movie: movie, result: result, row: row.get(0) }
                    }));
                } catch(e) {}
                if (typeof window.SW_renderCards === 'function') {
                    try { window.SW_renderCards(row.get(0), result, movie); }
                    catch(e) { console.error('[SW] SW_renderCards:', e); }
                }
            }).catch(function(err){
                console.error('[SW] analyze:', err);
                row.attr('data-sw-error', '1');
            });
        } catch(e) { console.error('[SW] renderCards:', e); }
    }

    // ======================================================================
    // ЗАПУСК
    // ======================================================================
    function startPlugin() {
        try { initSettings(); } catch(e) {}
        try { injectCSS(); } catch(e) {}
        try {
            Lampa.Listener.follow('full', function(e){
                if (e.type !== 'complite') return;
                try {
                    var renderEl = null;
                    if (e.object && typeof e.object.render === 'function') renderEl = e.object.render();
                    else if (e.object && e.object.activity && typeof e.object.activity.render === 'function') renderEl = e.object.activity.render();
                    if (renderEl && e.data && e.data.movie) renderCards(renderEl, e.data.movie);
                } catch(err) { console.error('[SW]', err); }
            });
        } catch(e) {}
        console.log('[ShouldWatch] v66.0-core (интерфейс вынесен: заготовка карточек вместо модалки)');
    }

    try { if (window.appready) startPlugin(); else Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') startPlugin(); }); } catch(e) {}
})();
