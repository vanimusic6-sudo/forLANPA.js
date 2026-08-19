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

    function injectCSS() {
        if (document.getElementById('sw-plugin-styles-enhanced')) return;
        var s = document.createElement('style'); s.id = 'sw-plugin-styles-enhanced';
        s.innerHTML =
            '.sw-cards-row{display:flex;gap:16px;margin:16px 0 26px;overflow-x:auto;padding:6px 24px 10px}' +
            '.sw-cards-row::-webkit-scrollbar{height:5px}' +
            '.sw-cards-row::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:10px}' +
            '.sw-card{flex:0 0 auto;width:296px;aspect-ratio:4/3;border-radius:18px;overflow:hidden;position:relative;background:transparent;border:none}' +
            '.sw-card svg{position:absolute;inset:0;width:100%;height:100%;display:block}' +
            '@media(max-width:640px){.sw-card{width:210px}}';
        document.head.appendChild(s);
    }

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
            return { pros: pros, cons: cons, factors: F, review: rt, score: score, norm: meterW, vClass: vClass, vWord: vWord, mode: metaRich ? 'TMDB' : 'TAGS', metaRich: metaRich };
        });
    }

    var SW_FONT = "'Arial Black','Segoe UI',Arial,sans-serif";
    function svgWrap(inner) { return '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>'; }
    function swBg(c) { return '<rect x="0" y="0" width="400" height="300" rx="26" fill="' + c + '"/>'; }
    function swText(x, y, size, fill, label, extra) {
        return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="' + size + '" font-weight="900" fill="' + fill + '" font-family="' + SW_FONT + '" ' + (extra || '') + '>' + esc(label) + '</text>';
    }
    function swSmall(x, y, size, fill, label) {
        return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="' + size + '" font-style="italic" font-weight="700" fill="' + fill + '" font-family="Arial,sans-serif">' + esc(label) + '</text>';
    }

    function artWar() {
        var t = swBg('#1e2121');
        t += '<g transform="translate(208,92) rotate(24)">';
        t += '<rect x="-62" y="-70" width="124" height="140" fill="#a0704d"/>';
        t += '<rect x="-62" y="-70" width="124" height="26" fill="#7d5741"/>';
        t += '<rect x="-12" y="-20" width="26" height="4" fill="#e8e5df"/>';
        t += '</g>';
        t += '<path d="M0,208 Q18,186 36,204 Q52,182 70,202 Q90,178 108,200 Q126,184 144,202 Q164,176 184,198 Q204,182 222,200 Q242,174 262,196 Q282,180 300,200 Q320,176 340,198 Q360,184 378,202 Q390,190 400,200 L400,300 L0,300 Z" fill="#e8192c"/>';
        t += '<path d="M0,222 Q18,200 36,218 Q52,196 70,216 Q90,192 108,214 Q126,198 144,216 Q164,190 184,212 Q204,196 222,214 Q242,188 262,210 Q282,194 300,214 Q320,190 340,212 Q360,198 378,216 Q390,204 400,214 L400,300 L0,300 Z" fill="#7a0c1c"/>';
        return t + swText(200, 196, 92, '#f5f5f5', 'война', 'textLength="330" lengthAdjust="spacingAndGlyphs"');
    }

    /* «ЮМОР» — твой трассированный SVG */
    function artHumor() {
        return '<svg viewBox="0 0 838 845" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' +
        '<g><path fill="#ffffff" stroke="#ffffff" stroke-width="0.5" d="M 0,0 c 279.33,0 558.67,0 838,0 c 0,281.67 0,563.33 0,845 c -279.33,0 -558.67,0 -838,0 c 0,-281.67 0,-563.33 0,-845 Z M 201.84,614.26 c 1.14,1.3 4.11,0.51 5.67,0.76 c 1.27,0.56 2.59,0.9 3.97,1 c 124.34,-0.01 248.69,-0.03 373.03,-0.05 c 2.23,-0.96 4.56,-1.29 7,-0.99 c 0.99,-0.34 1.98,-0.66 2.98,-0.96 c 1.01,-0.01 2.01,-0.03 3.02,-0.05 c 1.72,-0.56 3.44,-1.15 5.15,-1.77 c 4.22,-0.56 8.24,-2.56 12.36,-3.69 c 4.44,-2.26 8.89,-4.49 13.36,-6.69 c 2.21,-1.48 4.42,-2.94 6.64,-4.39 c 0.98,-0.97 1.96,-1.93 2.94,-2.88 c 3.07,-1.3 5.05,-4.35 7.47,-6.53 c 1.02,-2.49 3.07,-3.37 3.86,-5.89 c 4.63,-4.51 9.27,-21.3 9.73,-27.61 c -0.03,-86.01 -0.03,-172.03 0,-258.04 c -5.36,-37.11 -34.57,-53.03 -68.52,-59.51 c -3.76,-1.84 -7.26,-0.1 -10.99,-1.95 c -122.01,-0.03 -244.01,-0.03 -366.02,0 c -3.73,1.85 -7.23,0.11 -10.99,1.95 c -32.82,6.25 -60.56,22.19 -66.52,57.51 c 0.01,87.68 0.03,175.35 0.04,263.03 c 4.34,19.05 9.52,25.21 23.49,38.44 c 13,9.94 26.1,15.92 42.33,18.31 Z M 234.29,445.85 c -0.29,-9.78 -0.38,-19.57 -0.28,-29.37 c 0.04,-0.58 -0.17,-1.02 -0.64,-1.35 c -7.58,-0.18 -15.16,-0.18 -22.74,0 c -0.47,0.33 -0.68,0.77 -0.64,1.35 c -0.03,3.22 0.01,6.45 0.12,9.67 c -1.85,-1.86 -4.4,-5.6 -5.94,-7.77 c -14.64,-27.62 -15.92,-53.37 -4.68,-82.4 c 14.5,-30.26 41.35,-49.34 75.85,-40.77 c 46.69,14.85 62.53,71.63 44.17,113.81 c -9.72,20.17 -19.23,29.94 -39.49,39.5 c -2.64,0.46 -5.2,1.22 -7.67,2.28 c -9.66,1.58 -30.08,1.9 -38.06,-4.95 Z M 551.15,449.84 c -0.1,-9.74 -0.2,-19.48 -0.28,-29.21 c -0.33,-0.47 -0.77,-0.68 -1.35,-0.64 c -7.97,-0.04 -15.93,0.01 -23.89,0.14 c -0.47,0.33 -0.68,0.77 -0.64,1.35 c 0.05,12.46 0.01,24.91 -0.11,37.37 c -9.13,1.02 -15.61,-0.75 -24.23,-3.06 c -15.76,-6.77 -24.42,-14.87 -34.08,-28.77 c -15.95,-29.62 -17.54,-52.18 -7.08,-84.04 c 9.42,-20.13 18.72,-32.12 39.18,-41.76 c 17.43,-5.85 25.23,-5.85 42.66,0 c 21,9.81 29.94,21.8 39.45,42.45 c 13.87,37.87 4.73,82.78 -29.63,106.17 Z M 473.99,344 c -0.52,40 55.27,38.17 51.81,-2.35 c -2.39,-8.89 -3.99,-10.73 -10.78,-17.09 c -18.8,-10.75 -37.62,-1.68 -41.03,19.44 Z M 256.99,387 c -0.37,30.58 37.94,39.48 50.81,10.35 c 0.1,-1.69 0.5,-3.3 1.18,-4.84 c 1.7,-35.66 -46.28,-41 -51.99,-5.51 Z"/></g>' +
        '<g><path fill="#000000" stroke="#000000" stroke-width="0.5" d="M 649.29,582.13 c -0.68,0.14 -1.27,0.44 -1.79,0.89 c -1.76,2.51 -3.74,4.84 -5.96,6.99 c -2.47,1.43 -4.65,3.24 -6.51,5.44 c -2.23,1.45 -4.45,2.92 -6.66,4.39 c -2.96,1.27 -5.74,2.83 -8.34,4.71 c -2.68,0.79 -5.25,1.88 -7.69,3.26 c -3.05,0.85 -6.04,1.86 -8.99,3.01 c -2.67,0.67 -5.33,1.34 -8,2.01 c -1.97,0.36 -3.22,-0.15 -5,1 c -1.94,0.17 -3.9,0.24 -5.86,0.19 c -0.98,0.36 -1.97,0.68 -2.98,0.97 c -123.01,0 -246.02,0.01 -369.03,0.03 c -1.39,-0.04 -2.72,-0.37 -3.97,-1 c -2.23,-0.12 -4.46,-0.04 -6.67,0.24 c -16.23,-2.39 -29.33,-8.37 -42.33,-18.31 c -13.97,-13.23 -19.15,-19.39 -23.49,-38.44 c -0.01,-87.68 -0.03,-175.35 -0.04,-263.03 c 5.96,-35.32 33.7,-51.26 66.52,-57.51 c 3.76,-1.84 7.26,-0.1 10.99,-1.95 c 122.01,-0.03 244.01,-0.03 366.02,0 c 3.73,1.85 7.23,0.11 10.99,1.95 c 33.95,6.48 63.16,22.4 68.52,59.51 c -0.03,86.01 -0.03,172.03 0,258.04 c -0.46,6.31 -5.1,23.1 -9.73,27.61 Z M 140.99,295 c 0,87.17 0.01,174.34 0.03,261.51 c 5.35,33.84 40.82,50.52 71.46,53.51 c 123.01,-0.01 246.02,-0.03 369.03,-0.04 c 4.39,-1.32 13.34,-1.84 17.83,-3.19 c 27.68,-9.14 49.58,-21.51 54.68,-52.27 c -0.01,-86.68 -0.03,-173.35 -0.04,-260.03 c -5.92,-31.82 -32.51,-45.58 -61.47,-52.47 c -4.84,-0.61 -10.28,-0.97 -14.99,-2.04 c -121.34,0.01 -242.69,0.03 -364.03,0.04 c -4.28,1.43 -9.34,1.03 -13.84,2.18 c -26.18,6.58 -48.55,18.39 -57.45,45.45 c -0.15,2.51 -0.56,4.96 -1.21,7.35 Z M 314.36,429 c -1.91,0.51 -3.15,3.06 -4.46,4.4 c -5.59,6.04 -11.9,11.18 -18.94,15.42 c -4.94,1.94 -9.37,4.56 -14.62,5.97 c -1.58,-0.01 -3.01,0.44 -4.28,1.36 c -7.32,1.22 -18.32,0.66 -25.11,0.1 c -1.88,-1.25 -10.3,-3.35 -12.97,-4.3 c -0.15,-2.05 -0.05,-4.09 0.31,-6.1 c 7.98,6.85 28.4,6.53 38.06,4.95 c 2.47,-1.06 5.03,-1.82 7.67,-2.28 c 20.26,-9.56 29.77,-19.33 39.49,-39.5 c 18.36,-42.18 2.52,-98.96 -44.17,-113.81 c -34.5,-8.57 -61.35,10.51 -75.85,40.77 c -11.24,29.03 -9.96,54.78 4.68,82.4 c 1.54,2.17 4.09,5.91 5.94,7.77 c -0.41,2.26 0.63,6.35 -0.87,8.11 c -0.37,-0.93 -0.85,-1.8 -1.43,-2.62 c -18,-23.02 -23.44,-46.19 -19.47,-74.97 c 7.7,-51.27 60.71,-89.33 108.19,-56.71 c 39.73,27.76 46.21,88 18.68,126.68 c -0.39,0.74 -0.68,1.53 -0.85,2.36 Z M 586.26,414.05 c -0.6,-0.14 -11.62,22.65 -15.37,24.72 c -1.77,1.47 -4.76,7.15 -8.91,8.79 c -2.49,2.21 -7.67,7.38 -11.08,7.34 c 0.01,-1.69 0.1,-3.38 0.25,-5.06 c 34.36,-23.39 43.5,-68.3 29.63,-106.17 c -9.51,-20.65 -18.45,-32.64 -39.45,-42.45 c -17.43,-5.85 -25.23,-5.85 -42.66,0 c -20.46,9.64 -29.76,21.63 -39.18,41.76 c -10.46,31.86 -8.87,54.42 7.08,84.04 c 9.66,13.9 18.32,22 34.08,28.77 c 8.62,2.31 15.1,4.08 24.23,3.06 c 0.17,1.71 0.2,3.42 0.11,5.13 c -7.15,0.09 -11.92,0.41 -18.64,-1.78 c -0.88,-0.18 -1.77,-0.21 -2.67,-0.11 c -9.01,-3.9 -16.79,-6.77 -24.57,-13.2 c -1.29,-2.57 -4.38,-3.02 -6.11,-5.36 c -1.5,-2.2 -7.14,-9.5 -9.19,-10.71 c -0.11,-1.3 -9.55,-17.16 -10.12,-20.75 c -8.28,-25.39 -7.49,-50.32 2.8,-75.09 c 2.38,-3.88 5.87,-10.04 8.07,-14 c 2.44,-2.61 8.87,-11.45 11.46,-12.54 c 22.93,-23.7 62.92,-24.5 86.45,-1.44 c 6.08,3.76 8.25,9.11 12.97,13.98 c 14.01,19.74 20.29,50.37 14.59,73.52 c 0.7,2.86 -4.63,16.08 -3.77,17.55 Z M 473.99,344 c 3.41,-21.12 22.23,-30.19 41.03,-19.44 c 6.79,6.36 8.39,8.2 10.78,17.09 c 3.46,40.52 -52.33,42.35 -51.81,2.35 Z M 256.99,387 c 5.71,-35.49 53.69,-30.15 51.99,5.51 c -0.68,1.54 -1.08,3.15 -1.18,4.84 c -12.87,29.13 -51.18,20.23 -50.81,-10.35 Z"/></g>' +
        '<g><path fill="#141414" stroke="#141414" stroke-width="0.5" d="M 336.79,414 c -0.01,-1.3 -0.28,-3.29 1.66,-3.2 c 7.03,0.02 14.06,0.02 21.09,0.02 c 0.61,0.01 1.07,0.26 1.39,0.77 c 4.79,19.05 9.65,38.05 14.58,57.02 c 4.94,-18.96 9.79,-37.97 14.57,-57.02 c 0.65,-0.67 1.45,-0.93 2.4,-0.8 c 6.69,0.02 13.38,0.02 20.08,0 c 0.64,-0.03 1.16,0.21 1.55,0.71 c 0.23,37.67 0.32,75.34 0.27,113.03 c 0.14,1 -0.18,1.79 -0.95,2.38 c -6.31,0.09 -12.63,0.12 -18.95,0.1 c -0.58,0.04 -1.03,-0.17 -1.37,-0.63 c -0.17,-20.29 -0.22,-40.58 -0.17,-60.88 c -0.27,-1.44 0.41,-5.28 -0.58,-6.27 c -3.24,11.98 -6.46,23.99 -9.67,36.02 c -0.31,0.4 -0.71,0.57 -1.22,0.52 c -3.66,0.01 -7.32,0.01 -10.98,0 c -0.8,0.09 -1.5,-0.1 -2.11,-0.59 c -2.93,-9.5 -5.81,-19 -8.64,-28.52 c -0.68,-1.09 -1.15,-2.25 -1.44,-3.49 c -0.22,0.39 -0.33,0.81 -0.31,1.27 c 0.19,20.66 0.17,41.31 -0.06,61.96 c -0.35,0.46 -0.82,0.66 -1.41,0.62 c -6.01,-0.02 -12.03,-0.02 -18.04,0 c -0.59,0.05 -1.08,-0.15 -1.46,-0.6 c -0.21,-37.46 -0.29,-74.94 -0.23,-112.42 Z M 453.69,412.07 c 0.57,3.59 10.01,19.45 10.12,20.75 c -3.09,3.22 -4.3,6.14 -4.02,10.68 c -0.02,17.33 0,34.67 0.06,52 c -0.01,13.95 20.27,14.69 19.26,-2 c 0,-14.87 0,-29.74 0,-44.61 c 7.78,6.43 15.56,9.3 24.57,13.2 c -1.84,21.88 7.62,55 -19.67,64.39 c -21.68,6.26 -46.94,-0.88 -48.42,-26.78 c -0.27,-20.57 -0.3,-41.13 -0.09,-61.7 c 0.33,-11.56 5.59,-20.05 15.78,-25.45 c 0.76,-0.41 1.56,-0.57 2.41,-0.48 Z M 586.26,414.05 c 6.53,6.16 8.59,14.83 9.5,23.45 c 0.27,20.33 0.28,40.67 0.04,61 c -1.11,14.97 -7.32,29.4 -24.3,30.23 c -9.03,0.08 -16.93,-4.84 -20.86,-12.89 c -0.32,-0.35 -0.72,-0.56 -1.19,-0.61 c -0.07,19.38 -0.2,38.79 -0.41,58.21 c -0.41,0.44 -0.92,0.64 -1.52,0.58 c -7.01,-0.02 -14.03,-0.02 -21.04,0 c -0.59,0.05 -1.08,-0.15 -1.46,-0.6 c -0.28,-36.48 -0.29,-72.96 -0.03,-109.44 c 0.09,-1.71 0.06,-3.42 -0.11,-5.13 c 0.12,-12.46 0.16,-24.91 0.11,-37.37 c -0.04,-0.58 0.17,-1.02 0.64,-1.35 c 7.96,-0.13 15.92,-0.18 23.89,-0.14 c 0.58,-0.04 1.02,0.17 1.35,0.64 c 0.08,9.73 0.18,19.47 0.28,29.21 c -0.15,1.68 -0.24,3.37 -0.25,5.06 c 0.04,15.15 0.14,30.31 0.29,45.46 c 6.67,11.92 20.54,5.44 20.46,-7.9 c -0.24,-16.59 1.05,-37.64 -0.76,-53.69 c 3.75,-2.07 14.77,-24.86 15.37,-24.72 Z M 234.29,445.85 c -0.36,2.01 -0.46,4.05 -0.31,6.1 c 0.35,1.27 -0.47,5.23 0.68,5.88 c 3.61,0.17 7.24,0.23 10.86,0.19 c 1.15,-0.07 1.62,-0.65 1.43,-1.77 c 6.79,0.56 17.79,1.12 25.11,-0.1 c -0.95,4.39 -0.18,29.79 -0.45,36.35 c -1.07,17.56 18.57,17.02 19.33,4 c 0.11,-15.89 0.12,-31.78 0.02,-47.68 c 7.04,-4.24 13.35,-9.38 18.94,-15.42 c 1.31,-1.34 2.55,-3.89 4.46,-4.4 c 1.98,20.31 0.6,42.87 1.02,63.5 c 1.13,26.54 -15.19,38.79 -40.88,35.54 c -25.84,-4.22 -28.21,-22.04 -27.4,-44.58 c 0.04,-0.6 -0.18,-1.08 -0.67,-1.43 c -3.65,-0.21 -7.31,-0.29 -10.98,-0.24 c -0.6,0.02 -1.03,0.29 -1.29,0.83 c 0,14.6 -0.06,29.2 -0.2,43.8 c -0.36,0.46 -0.84,0.67 -1.43,0.63 c -7.02,-0.02 -14.04,-0.02 -21.05,0 c -0.62,0.06 -1.14,-0.14 -1.56,-0.59 c -0.32,-29.65 -0.38,-59.3 -0.18,-88.97 c -0.02,-1.1 -0.19,-2.18 -0.5,-3.23 c 1.5,-1.76 0.46,-5.85 0.87,-8.11 c -0.11,-3.22 -0.15,-6.45 -0.12,-9.67 c -0.04,-0.58 0.17,-1.02 0.64,-1.35 c 7.58,-0.18 15.16,-0.18 22.74,0 c 0.47,0.33 0.68,0.77 0.64,1.35 c -0.1,9.8 -0.01,19.59 0.28,29.37 Z"/></g>' +
        '<g><path fill="#f7c30e" stroke="#f7c30e" stroke-width="0.5" d="M 140.99,295 c 0.65,-2.39 1.06,-4.84 1.21,-7.35 c 8.9,-27.06 31.27,-38.87 57.45,-45.45 c 4.5,-1.15 9.56,-0.75 13.84,-2.18 c 121.34,-0.01 242.69,-0.03 364.03,-0.04 c 4.71,1.07 10.15,1.43 14.99,2.04 c 28.96,6.89 55.55,20.65 61.47,52.47 c 0.01,86.68 0.03,173.35 0.04,260.03 c -5.1,30.76 -27,43.13 -54.68,52.27 c -4.49,1.35 -13.44,1.87 -17.83,3.19 c -123.01,0.01 -246.02,0.03 -369.03,0.04 c -30.64,-2.99 -66.11,-19.67 -71.46,-53.51 c -0.02,-87.17 -0.03,-174.34 -0.03,-261.51 Z M 209.24,434.26 c 0.31,1.05 0.48,2.13 0.5,3.23 c -0.2,29.67 -0.14,59.32 0.18,88.97 c 0.42,0.45 0.94,0.65 1.56,0.59 c 7.01,-0.02 14.03,-0.02 21.05,0 c 0.59,0.04 1.07,-0.17 1.43,-0.63 c 0.14,-14.6 0.2,-29.2 0.2,-43.8 c 0.26,-0.54 0.69,-0.81 1.29,-0.83 c 3.67,-0.05 7.33,0.03 10.98,0.24 c 0.49,0.35 0.71,0.83 0.67,1.43 c -0.81,22.54 1.56,40.36 27.4,44.58 c 25.69,3.25 42.01,-9 40.88,-35.54 c -0.42,-20.63 0.96,-43.19 -1.02,-63.5 c 0.17,-0.83 0.46,-1.62 0.85,-2.36 c 27.53,-38.68 21.05,-98.92 -18.68,-126.68 c -47.48,-32.62 -100.49,5.44 -108.19,56.71 c -3.97,28.78 1.47,51.95 19.47,74.97 c 0.58,0.82 1.06,1.69 1.43,2.62 Z M 453.69,412.07 c -0.85,-0.09 -1.65,0.07 -2.41,0.48 c -10.19,5.4 -15.45,13.89 -15.78,25.45 c -0.21,20.57 -0.18,41.13 0.09,61.7 c 1.48,25.9 26.74,33.04 48.42,26.78 c 27.29,-9.39 17.83,-42.51 19.67,-64.39 c 0.9,-0.1 1.79,-0.07 2.67,0.11 c 6.72,2.19 11.49,1.87 18.64,1.78 c -0.26,36.48 -0.25,72.96 0.03,109.44 c 0.38,0.45 0.87,0.65 1.46,0.6 c 7.01,-0.02 14.03,-0.02 21.04,0 c 0.6,0.06 1.11,-0.14 1.52,-0.58 c 0.21,-19.42 0.34,-38.83 0.41,-58.21 c 0.47,0.05 0.87,0.26 1.19,0.61 c 3.93,8.05 11.83,12.97 20.86,12.89 c 16.98,-0.83 23.19,-15.26 24.3,-30.23 c 0.24,-20.33 0.23,-40.67 -0.04,-61 c -0.91,-8.62 -2.97,-17.29 -9.5,-23.45 c -0.86,-1.47 4.47,-14.69 3.77,-17.55 c 5.7,-23.15 -0.58,-53.78 -14.59,-73.52 c -4.72,-4.87 -6.89,-10.22 -12.97,-13.98 c -23.53,-23.06 -63.52,-22.26 -86.45,1.44 c -2.59,1.09 -9.02,9.93 -11.46,12.54 c -2.2,3.96 -5.69,10.12 -8.07,14 c -10.29,24.77 -11.08,49.7 -2.8,75.09 Z M 336.79,414 c -0.06,37.48 0.02,74.96 0.23,112.42 c 0.38,0.45 0.87,0.65 1.46,0.6 c 6.01,-0.02 12.03,-0.02 18.04,0 c 0.59,0.04 1.06,-0.16 1.41,-0.62 c 0.23,-20.65 0.25,-41.3 0.06,-61.96 c -0.02,-0.46 0.09,-0.88 0.31,-1.27 c 0.29,1.24 0.76,2.4 1.44,3.49 c 2.83,9.52 5.71,19.02 8.64,28.52 c 0.61,0.49 1.31,0.68 2.11,0.59 c 3.66,0.01 7.32,0.01 10.98,0 c 0.51,0.05 0.91,-0.12 1.22,-0.52 c 3.21,-12.03 6.43,-24.04 9.67,-36.02 c 0.99,0.99 0.31,4.83 0.58,6.27 c -0.05,20.3 0,40.59 0.17,60.88 c 0.34,0.46 0.79,0.67 1.37,0.63 c 6.32,0.02 12.64,-0.01 18.95,-0.1 c 0.77,-0.59 1.09,-1.38 0.95,-2.38 c 0.05,-37.69 -0.04,-75.36 -0.27,-113.03 c -0.39,-0.5 -0.91,-0.74 -1.55,-0.71 c -6.7,0.02 -13.39,0.02 -20.08,0 c -0.95,-0.13 -1.75,0.13 -2.4,0.8 c -4.78,19.05 -9.63,38.06 -14.57,57.02 c -4.93,-18.97 -9.79,-37.97 -14.58,-57.02 c -0.32,-0.51 -0.78,-0.76 -1.39,-0.77 c -7.03,0 -14.06,0 -21.09,-0.02 c -1.94,-0.09 -1.67,1.9 -1.66,3.2 Z M 463.81,432.82 c 2.05,1.21 7.69,8.51 9.19,10.71 c 1.73,2.34 4.82,2.79 6.11,5.36 c 0,14.87 0,29.74 0,44.61 c 1.01,16.69 -19.27,15.95 -19.26,2 c -0.06,-17.33 -0.08,-34.67 -0.06,-52 c -0.28,-4.54 0.93,-7.46 4.02,-10.68 Z M 570.89,438.77 c 1.81,16.05 0.52,37.1 0.76,53.69 c 0.08,13.34 -13.79,19.82 -20.46,7.9 c -0.15,-15.15 -0.25,-30.31 -0.29,-45.46 c 3.41,0.04 8.59,-5.13 11.08,-7.34 c 4.15,-1.64 7.14,-7.32 8.91,-8.79 Z M 290.96,448.82 c 0.1,15.9 0.09,31.79 -0.02,47.68 c -0.76,13.02 -20.4,13.56 -19.33,-4 c 0.27,-6.56 -0.5,-31.96 0.45,-36.35 c 1.27,-0.92 2.7,-1.37 4.28,-1.36 c 5.25,-1.41 9.68,-4.03 14.62,-5.97 Z M 233.98,451.95 c 2.67,0.95 11.09,3.05 12.97,4.3 c 0.19,1.12 -0.28,1.7 -1.43,1.77 c -3.62,0.04 -7.25,-0.02 -10.86,-0.19 c -1.15,-0.65 -0.33,-4.61 -0.68,-5.88 Z"/></g>' +
        '<g><path fill="#222024" d="M 649.29,582.13 c -0.79,2.52 -2.84,3.4 -3.86,5.89 c -2.42,2.18 -4.4,5.23 -7.47,6.53 c -0.98,0.95 -1.96,1.91 -2.94,2.88 c -2.22,1.45 -4.43,2.91 -6.64,4.39 c -4.47,2.2 -8.92,4.43 -13.36,6.69 c -4.12,1.13 -8.14,3.13 -12.36,3.69 c -1.71,0.62 -3.43,1.21 -5.15,1.77 c -1.01,0.02 -2.01,0.04 -3.02,0.05 c -1,0.3 -1.99,0.62 -2.98,0.96 c -2.44,-0.3 -4.77,0.03 -7,0.99 c -124.34,0.02 -248.69,0.04 -373.03,0.05 c -1.38,-0.1 -2.7,-0.44 -3.97,-1 c -1.56,-0.25 -4.53,0.54 -5.67,-0.76 c 2.21,-0.28 4.44,-0.36 6.67,-0.24 c 1.25,0.63 2.58,0.96 3.97,1 c 123.01,-0.02 246.02,-0.03 369.03,-0.03 c 1.01,-0.29 2,-0.61 2.98,-0.97 c 1.96,0.05 3.92,-0.02 5.86,-0.19 c 1.78,-1.15 3.03,-0.64 5,-1 c 2.67,-0.67 5.33,-1.34 8,-2.01 c 2.95,-1.15 5.94,-2.16 8.99,-3.01 c 2.44,-1.38 5.01,-2.47 7.69,-3.26 c 2.6,-1.88 5.38,-3.44 8.34,-4.71 c 2.21,-1.47 4.43,-2.94 6.66,-4.39 c 1.86,-2.2 4.04,-4.01 6.51,-5.44 c 2.22,-2.15 4.2,-4.48 5.96,-6.99 c 0.52,-0.45 1.11,-0.75 1.79,-0.89 Z"/></g>' +
        '</svg>';
    }

    /* «РАЗБОЙ» — твой трассированный SVG (временно сидел на heritage) */
    function artHeritage() {
        return '<svg viewBox="0 0 838 845" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' +
        '<g><path fill="#ffffff" stroke="#ffffff" stroke-width="0.5" d="M 0,0 c 279.33,0 558.67,0 838,0 c 0,281.67 0,563.33 0,845 c -279.33,0 -558.67,0 -838,0 c 0,-281.67 0,-563.33 0,-845 Z M 132.99,334 c 0,93.84 0.01,187.67 0.03,281.51 c 6.29,35.57 37.28,52.49 69.63,60.29 c 7.08,1.67 14.66,1.96 21.83,3.22 c 141.68,-0.01 283.35,-0.03 425.03,-0.04 c 3.77,-1.29 11.01,-1.25 15,-2 c 35.21,-7.59 71,-22.93 77.51,-62.46 c -0.01,-94.01 -0.03,-188.02 -0.04,-282.03 c -7.28,-38.83 -42.68,-53.92 -77.47,-61.47 c -5.1,-0.79 -11,-0.84 -15.99,-2.04 c -141.68,0.01 -283.35,0.03 -425.03,0.04 c -4.42,2.12 -8.54,-0.15 -12.99,1.95 c -28.74,4.79 -53.48,15.58 -70.33,40.65 c -4.31,7.49 -5.97,14.02 -7.18,22.38 Z M 474,379.97 c 0,1.68 0,3.35 0,5.02 c 0.66,18.5 -17.56,24.32 -31.38,30.18 c -1.61,1.13 -3.19,2.29 -4.74,3.49 c -3.08,0.43 -15.36,-7.21 -16.55,-11.37 c -0.84,-1.3 -1.29,-2.73 -1.34,-4.28 c 2.23,-4.65 20.31,-11.37 25.35,-14.13 c 2.64,-3.42 3.81,-5.6 4.66,-9.88 c 0.6,-1.61 0.94,-3.28 1.01,-5 c -0.19,-4.71 -0.43,-6.12 3.59,-8.81 c 5.27,-0.25 10.53,-0.25 15.8,0 c 1.32,0.95 2.46,2.09 3.41,3.41 c 0.19,3.79 0.25,7.58 0.19,11.37 Z M 461.98,392.98 c 0.52,4.86 5.85,5.44 7.01,0.52 c -1.06,-4.33 -5.17,-4.6 -7.01,-0.52 Z M 415.01,407.57 c 0.3,-0.2 0.59,-0.18 0.86,0.07 c 3.4,7.76 10.52,12.03 17.89,15.45 c 0.73,2.94 -1.24,6.73 -0.75,10.45 c -0.06,3.22 4.84,-1.99 5.61,-2.37 c 8.96,-4.13 18.17,-2.73 26.4,2.39 c 1.1,1.27 2.38,2.31 3.84,3.12 c 2.61,3.64 4.35,7.04 5.94,10.97 c 0.07,2.35 0.47,4.63 1.22,6.83 c -0.01,21.68 -0.03,43.35 -0.04,65.03 c -5.3,22.76 -20.33,26.29 -41.49,25.47 c -17.81,-3.56 -26.08,-13.52 -27.51,-31.46 c 0.01,-27.34 0.03,-54.69 0.04,-82.03 c 1.4,-3.16 0.85,-9.55 2.18,-12.84 c 1.94,-4.07 2.74,-7.57 5.81,-11.08 Z M 594.98,411.98 c 0.39,-1.24 1.22,-1.89 2.51,-1.96 c 12.67,-0.01 25.35,-0.03 38.02,-0.04 c 4.17,-0.56 4.74,4.71 1,5 c -12.67,0.01 -25.35,0.03 -38.02,0.04 c -2.29,0.25 -3.46,-0.76 -3.51,-3.04 Z M 146.99,587 c -0.05,-53.14 0.01,-106.27 0.2,-159.4 c 0.41,-1.02 1.18,-1.55 2.3,-1.58 c 7.63,-0.07 15.26,-0.03 22.88,0.12 c 0.47,0.32 0.68,0.77 0.64,1.34 c -0.01,2.69 -0.01,5.37 -0.01,8.06 c 0.15,1.19 0.64,1.35 1.46,0.48 c 3.71,-8.46 13.28,-10.52 21.04,-12.01 c 15.99,2.77 19.89,10.56 23.48,25.48 c 0.01,23.01 0.03,46.02 0.04,69.03 c -4.27,17.97 -9.05,27.16 -29.53,26.46 c -6.28,-2.29 -11.72,-4.72 -15.02,-11.01 c -0.37,-0.52 -0.81,-0.62 -1.31,-0.3 c -0.11,18.57 -0.21,37.13 -0.3,55.7 c -0.32,0.47 -0.77,0.68 -1.34,0.64 c -7.68,-0.01 -15.36,-0.01 -23.04,0 c -1.86,0.16 -1.46,-1.83 -1.49,-3.01 Z M 274.13,424.24 c 3.27,0.02 12.19,1.04 15.89,2.24 c 13.7,6.84 16.81,11.24 20,26 c 0.02,30.3 -0.03,60.6 -0.16,90.89 c -0.32,0.47 -0.77,0.68 -1.34,0.64 c -7.3,0.04 -14.6,-0.01 -21.89,-0.15 c -1.3,-0.67 -0.31,-6.01 -0.63,-7.4 c -0.15,-1.19 -0.64,-1.35 -1.47,-0.49 c -5.65,11.49 -25.27,11.07 -34.91,4.86 c -15.53,-12.43 -13.51,-32.67 -8.13,-49.85 c 4.08,-9.23 10.49,-13.34 19.69,-16.66 c 1.73,0 3.31,-0.44 4.76,-1.33 c 6.2,0.01 12.39,0.02 18.58,0.02 c 0.57,0.04 1.02,-0.17 1.35,-0.64 c 0.13,-4.59 1.19,-18.64 -2.53,-21.52 c -0.98,-3.16 -3.09,-4.44 -6.35,-3.85 c -6.69,-0.55 -12.79,3.12 -11.98,10.52 c 0.04,0.58 -0.17,1.02 -0.64,1.34 c -7.91,0.18 -15.83,0.18 -23.74,0 c -2.02,-1.15 0.68,-9.18 0.57,-11.21 c 1.4,-4.16 3.32,-8.05 5.76,-11.68 c 2.34,-1.92 4.63,-3.87 6.88,-5.85 c 0.48,-1.32 3.94,-2.31 5.15,-3.09 c 1.88,-0.54 3.71,-1.21 5.5,-2 c 1.86,-0.4 8.62,0.72 9.64,-0.79 Z M 323.99,458 c 0.42,-17.81 3.74,-27.35 21.66,-32.8 c 12.78,-1.64 22.54,-1.53 33.67,5.94 c 3.87,4.8 7.4,8.4 7.71,15.37 c 1.9,6.14 1.82,22.9 -1.59,28.51 c -1.75,1.59 -3.59,4.27 -5.81,5.12 c -0.47,0.27 -0.64,0.67 -0.5,1.19 c 2.57,1.34 5.02,2.89 7.34,4.65 c 1.17,2.02 2.77,4.26 3.33,6.67 c 0.53,25.51 4.82,45.17 -25.29,52.33 c -28.15,0.93 -41.18,-6.67 -40.49,-36.49 c 0.32,-1.94 1.47,-2.77 3.47,-2.51 c 6.63,-0.03 13.26,0.03 19.88,0.16 c 2.23,1.83 -2.69,11.71 6.28,14.66 c 8.08,0.88 10.34,0.17 13.15,-7.45 c 1.55,-21.84 -1.9,-21.89 -22.32,-21.34 c -0.57,0.04 -1.02,-0.18 -1.34,-0.64 c -0.18,-6.58 -0.18,-13.16 0,-19.74 c 0.32,-0.46 0.77,-0.68 1.34,-0.64 c 6.57,-0.61 15.38,2.4 19.33,-4.59 c 0.12,-2.54 0.79,-12.73 -0.34,-14.45 c -3.66,-3.6 -3.29,-4.4 -8.98,-3.93 c -9.38,1.98 -4.97,11.35 -7.12,12.84 c -7.29,0.13 -14.59,0.18 -21.89,0.15 c -1.86,0.16 -1.46,-1.83 -1.49,-3.01 Z M 493.99,452 c -0.05,-0.79 0.02,-1.57 0.21,-2.34 c 4.91,-24.05 27.27,-28.45 48.15,-23.45 c 12.62,4.18 17.65,11.93 20.63,24.28 c 0.03,22.67 0.03,45.35 0,68.02 c -2.37,9.96 -5.47,15.97 -13.94,21.94 c -23.1,9.57 -49.18,5.73 -55.02,-21.94 c -0.01,-22.17 -0.03,-44.34 -0.03,-66.51 Z M 582.99,540 c -0.04,-37.79 0.01,-75.59 0.15,-113.37 c 0.32,-0.47 0.77,-0.68 1.34,-0.64 c 6.34,0.02 12.69,0.01 19.04,-0.01 c 0.9,-0.15 1.68,0.07 2.34,0.65 c 0.14,20.96 0.18,41.92 0.13,62.89 c -0.11,0.81 0.06,1.55 0.49,2.21 c 8.5,-21.65 17.18,-43.24 26.03,-64.78 c 0.28,-0.38 0.64,-0.63 1.09,-0.76 c 5.63,-0.2 11.27,-0.25 16.91,-0.17 c 1.94,0.32 2.77,1.47 2.51,3.47 c -0.03,37.01 -0.03,74.02 0,111.03 c 0.15,0.9 -0.07,1.68 -0.65,2.34 c -6.96,0.13 -13.92,0.18 -20.89,0.15 c -0.57,0.04 -1.02,-0.18 -1.34,-0.64 c -0.16,-20.97 -0.19,-41.94 -0.09,-62.92 c 0.11,-0.87 -0.1,-1.65 -0.64,-2.32 c -8.36,21.73 -17,43.36 -25.94,64.9 c -0.51,0.59 -1.17,0.91 -1.96,0.94 c -5.68,0.02 -11.35,0.04 -17.03,0.04 c -1.86,0.16 -1.46,-1.83 -1.49,-3.01 Z M 208.23,446.79 c -0.36,-0.32 -0.7,-0.66 -1.02,-1.02 c -0.74,-0.68 -1.6,-0.87 -2.58,-0.59 c -1.83,0.84 -2.65,2.24 -2.46,4.19 c 2.22,3.49 4.44,3.49 6.65,0 c 0.28,-0.98 0.09,-1.84 -0.59,-2.58 Z M 172.99,511 c 2.54,14.1 16.99,15.33 20.81,1.35 c 0.21,-18.28 0.27,-36.57 0.18,-54.86 c -3.29,-12.93 -16.7,-13.64 -20.78,-0.84 c -0.2,18.11 -0.27,36.23 -0.21,54.35 Z M 518.99,459 c -0.06,18.12 0.01,36.24 0.21,54.35 c 2.88,7.69 5.02,8.28 13.2,7.47 c 4.71,-3.51 4.09,-4.09 5.58,-9.31 c 0.09,-18.29 0.03,-36.58 -0.18,-54.86 c -3.88,-14.67 -19.46,-9.14 -18.81,2.35 Z M 432.98,516.02 c 2,3.53 1.97,6.11 6.51,6.96 c 4.11,0.67 7.43,-0.64 9.98,-3.93 c 0.33,-1.89 0.83,-3.74 1.51,-5.54 c 0.03,-18.01 0.03,-36.01 0,-54.02 c -2.32,-7 -3.65,-8.98 -11.49,-8.48 c -4.78,1.25 -5.27,3.2 -6.47,7.48 c -0.01,19.18 -0.03,38.36 -0.04,57.53 Z M 547.79,451.77 c -0.32,0.36 -0.66,0.7 -1.02,1.02 c -0.68,0.74 -0.87,1.6 -0.59,2.58 c 0.84,1.83 2.24,2.66 4.19,2.46 c 3.49,-2.22 3.49,-4.44 0,-6.65 c -0.98,-0.28 -1.84,-0.09 -2.58,0.59 Z M 414.98,461.98 c 0.52,4.86 5.85,5.44 7.01,0.52 c -1.06,-4.33 -5.17,-4.6 -7.01,-0.52 Z M 641.23,462.79 c -0.36,-0.32 -0.7,-0.66 -1.02,-1.02 c -0.74,-0.68 -1.6,-0.87 -2.58,-0.59 c -1.83,0.84 -2.65,2.24 -2.46,4.19 c 2.22,3.49 4.44,3.49 6.65,0 c 0.28,-0.98 0.09,-1.84 -0.59,-2.58 Z M 374.21,481.23 c 0.32,-0.36 0.66,-0.7 1.02,-1.02 c 0.68,-0.74 0.87,-1.6 0.59,-2.58 c -2.21,-3.49 -4.43,-3.49 -6.65,0 c -0.2,1.95 0.63,3.35 2.46,4.19 c 0.98,0.28 1.84,0.09 2.58,-0.59 Z M 546.79,475.77 c -0.32,0.36 -0.66,0.7 -1.02,1.02 c -0.68,0.74 -0.87,1.6 -0.59,2.58 c 0.84,1.83 2.24,2.66 4.19,2.46 c 3.49,-2.22 3.49,-4.44 0,-6.65 c -0.98,-0.28 -1.84,-0.09 -2.58,0.59 Z M 509.79,478.77 c -0.32,0.36 -0.66,0.7 -1.02,1.02 c -0.68,0.74 -0.87,1.6 -0.59,2.58 c 2.21,3.48 4.43,3.48 6.65,0 c 0.2,-1.95 -0.63,-3.35 -2.46,-4.19 c -0.98,-0.28 -1.84,-0.09 -2.58,0.59 Z M 464.23,490.79 c -0.36,-0.32 -0.7,-0.66 -1.02,-1.02 c -0.74,-0.68 -1.6,-0.87 -2.58,-0.59 c -1.83,0.84 -2.65,2.24 -2.46,4.19 c 2.22,3.49 4.44,3.49 6.65,0 c 0.28,-0.98 0.09,-1.84 -0.59,-2.58 Z M 261.99,507 c -0.12,7.1 -1.05,12.66 6.66,15.81 c 19.36,3.25 17.9,-15.02 17.22,-28.18 c -0.33,-0.47 -0.77,-0.68 -1.35,-0.64 c -12.17,-0.17 -19.78,-1.07 -22.53,13.01 Z M 596.2,507.25 c 1.88,-1.18 2.21,-2.68 0.98,-4.5 c -2.75,-4.3 -9.19,0.93 -4.22,4.71 c 1.14,0.73 2.22,0.67 3.24,-0.21 Z M 166.23,503.79 c -0.36,-0.32 -0.7,-0.66 -1.02,-1.02 c -0.74,-0.68 -1.6,-0.87 -2.58,-0.59 c -1.83,0.84 -2.65,2.24 -2.46,4.19 c 2.22,3.49 4.44,3.49 6.65,0 c 0.28,-0.98 0.09,-1.84 -0.59,-2.58 Z M 638.79,516.77 c -0.32,0.36 -0.66,0.7 -1.02,1.02 c -0.68,0.74 -0.87,1.6 -0.59,2.58 c 2.21,3.49 4.43,3.49 6.65,0 c 0.2,-1.95 -0.63,-3.35 -2.46,-4.19 c -0.98,-0.28 -1.84,-0.09 -2.58,0.59 Z M 262.18,530.25 c 1.23,-1.82 0.9,-3.32 -0.98,-4.5 c -1.02,-0.88 -2.1,-0.94 -3.24,-0.21 c -4.97,3.78 1.47,9.01 4.22,4.71 Z M 348.21,532.23 c 0.32,-0.36 0.66,-0.7 1.02,-1.02 c 0.68,-0.74 0.87,-1.6 0.59,-2.58 c -2.21,-3.49 -4.43,-3.49 -6.65,0 c -0.2,1.95 0.63,3.35 2.46,4.19 c 0.98,0.28 1.84,0.09 2.58,-0.59 Z M 642.77,531.21 c 0.36,0.32 0.7,0.66 1.02,1.02 c 0.74,0.68 1.6,0.87 2.58,0.59 c 3.49,-2.21 3.49,-4.43 0,-6.65 c -1.95,-0.19 -3.35,0.63 -4.19,2.46 c -0.28,0.98 -0.09,1.84 0.59,2.58 Z M 546.01,532.97 c 0.01,-1.99 -0.99,-2.99 -2.98,-2.98 c -1.67,0.31 -2.96,1.19 -3.87,2.64 c -0.41,5.34 6.3,5.76 6.85,0.34 Z M 463.23,532.79 c -0.36,-0.32 -0.7,-0.66 -1.02,-1.02 c -0.74,-0.68 -1.6,-0.87 -2.58,-0.59 c -1.83,0.84 -2.65,2.24 -2.46,4.19 c 2.22,3.49 4.44,3.49 6.65,0 c 0.28,-0.98 0.09,-1.84 -0.59,-2.58 Z M 265.04,618.98 c 2.55,-6.09 3.84,-12.71 6.74,-18.65 c 5.35,-16.26 10.79,-32.5 16.33,-48.69 c 0.82,-1.29 7.77,-0.34 9.41,-0.65 c 0.58,-0.04 1.02,0.18 1.32,0.66 c 0.04,0.75 0.28,1.4 0.71,1.95 c 4.65,-3.35 9.77,-5.61 14.94,-1.64 c 3.46,8.43 -0.42,13.8 -3.27,21.71 c -3.61,11.08 -7.19,29.35 -22.57,27.13 c -1.79,-0.44 -3.05,-1.48 -3.79,-3.12 c -0.65,-0.76 -1.51,0.3 -1.64,0.92 c -2.18,6.84 -4.42,13.66 -6.73,20.45 c -1.54,1.66 -8.56,0.92 -10.86,0.77 c -0.37,-0.17 -0.57,-0.45 -0.59,-0.84 Z M 312.99,591 c 2.33,-9.5 7.65,-29.71 14.99,-36.44 c 8.05,-4.77 13.5,-7.21 22.5,-1.58 c 2.49,3.51 1.25,7.51 1.49,11.53 c -1.54,5.01 -3.26,9.96 -5.13,14.84 c -0.3,0.48 -0.74,0.7 -1.32,0.66 c -5.98,-0.08 -11.95,-0.02 -17.92,0.18 c -0.45,0.13 -0.81,0.38 -1.09,0.76 c -0.75,2.24 -1.52,4.48 -2.3,6.72 c -0.29,1.76 2.55,3.79 4.28,3.33 c 1.25,-0.33 2.43,-0.84 3.53,-1.53 c 0.9,-1.43 1.78,-2.87 2.64,-4.31 c 3.24,-0.21 6.49,-0.21 9.73,-0.01 c 0.46,0.27 0.61,0.67 0.43,1.18 c -5.4,12.05 -11.13,15.17 -24.33,14.64 c -4.59,-1.19 -7.97,-5.05 -7.5,-9.97 Z M 469.01,594 c 1.51,-2.14 0.68,-4 1.19,-6.35 c 2.89,-7.38 8.24,-16.14 17.31,-16.68 c 2.57,-1 5.24,-1.32 8.01,-0.96 c 0.58,0.04 1.02,-0.18 1.32,-0.65 c 0.69,-2.3 1.39,-4.59 2.13,-6.87 c 0,-4.5 -7.43,-2.45 -8.5,1.54 c -0.26,0.39 -0.61,0.66 -1.07,0.78 c -1.54,0.13 -9.26,0.66 -10,-0.32 c 0.33,-0.94 0.6,-1.89 0.81,-2.86 c 7.22,-10.39 12.77,-13.89 25.81,-10.15 c 5.08,1.84 4.07,7.57 3.78,11.87 c -3.91,11.98 -8.01,23.88 -12.31,35.7 c -1.51,1.64 -7.63,0.93 -9.83,0.79 c -1.73,-2.35 -1.04,-1.28 -3.29,-0.06 c -7.87,2 -12.38,3.14 -15.36,-5.78 Z M 177.04,598.98 c 5.7,-15.9 11.24,-31.85 16.6,-47.84 c 2.62,-0.14 5.25,-0.19 7.88,-0.15 c 1.97,-0.14 1.59,2.15 1.28,3.36 c -1.09,2.69 -7.18,18.24 -6.66,19.96 c 0.5,0.34 0.95,0.24 1.33,-0.29 c 2.25,-2.85 4.28,-5.87 6.09,-9.04 c 2.5,-1.84 9.39,-14.24 11.93,-13.97 c 1.39,0.25 6.67,-0.65 7.36,0.62 c -5.15,15.98 -10.48,31.88 -16.01,47.72 c -0.3,0.48 -0.74,0.7 -1.32,0.66 c -2.68,-0.01 -5.37,-0.02 -8.06,-0.02 c -0.45,0.02 -0.81,-0.15 -1.07,-0.5 c 2.55,-7.03 5.03,-14.08 7.41,-21.16 c 0.62,-1.86 -0.59,-3.58 -1.34,-0.31 c -3.38,2.81 -14.71,22.17 -17.95,21.97 c -2.01,0.01 -4.02,0.02 -6.03,0.01 c -0.76,0.02 -1.24,-0.32 -1.44,-1.02 Z M 235.04,598.98 c 5.33,-15.79 10.69,-31.57 16.07,-47.34 c 0.81,-1.29 6.85,-0.34 8.4,-0.65 c 1.97,-0.34 2.74,0.45 2.3,2.34 c -1.87,5.45 -3.75,10.9 -5.63,16.35 c -0.82,1.92 3.44,1.68 4.29,0.35 c 3.76,-6.18 7.4,-12.58 11.48,-18.53 c 2.12,-1.02 7.95,-0.49 10.44,-0.35 c 0.57,0.58 0.6,1.2 0.08,1.87 c -4.75,7.55 -9.51,15.09 -14.28,22.63 c -0.15,7.91 -0.26,15.81 -0.33,23.72 c -0.32,0.47 -0.77,0.68 -1.34,0.64 c -2.34,-0.01 -4.69,-0.01 -7.04,0 c -0.9,0.16 -1.68,-0.06 -2.34,-0.64 c -0.14,-5.63 -0.18,-11.26 -0.13,-16.89 c -0.26,-1.35 -1.1,-1.85 -2.51,-1.51 c -0.91,-0.15 -1.69,0.07 -2.34,0.67 c -1.6,6.13 -4.22,11.76 -6.27,17.72 c -0.83,1.29 -7.77,0.36 -9.41,0.64 c -0.76,0.02 -1.24,-0.32 -1.44,-1.02 Z M 348.04,598.98 c 1.38,-4.29 2.96,-8.51 4.74,-12.65 c 3.84,-11.79 7.8,-23.52 11.86,-35.19 c 2.95,-0.13 5.92,-0.18 8.88,-0.15 c 0.57,-0.04 1.02,0.18 1.34,0.64 c 1.01,6.56 -1.66,12.27 -0.86,18.91 c -0.01,0.48 0.15,0.88 0.49,1.2 c 2.64,-4.53 5.42,-8.98 8.34,-13.36 c 3.83,-8.89 4.32,-7.36 13.7,-7.39 c 0.56,-0.03 1,0.19 1.32,0.64 c -5.5,16.08 -11,32.16 -16.49,48.23 c -2.62,0.14 -5.25,0.19 -7.88,0.15 c -1.41,-0.19 -1.84,-0.98 -1.29,-2.34 c 1.88,-5.45 3.75,-10.9 5.62,-16.35 c 0.53,-1.26 -0.16,-2.82 -1.28,-1.35 c -0.55,1.15 -1.12,2.28 -1.7,3.41 c -0.93,1.1 -1.75,2.25 -2.49,3.47 c -1.26,0.08 -5.47,0.69 -6.2,-0.48 c -0.57,-1.56 0.49,-7.39 -0.71,-8.22 c -2.58,7.02 -5.09,14.09 -7.54,21.22 c -0.82,1.27 -6.86,0.36 -8.41,0.63 c -0.76,0.02 -1.24,-0.32 -1.44,-1.02 Z M 390.21,599.8 c 5.21,-16.04 10.64,-31.99 16.3,-47.85 c 0.53,-0.58 1.19,-0.88 1.98,-0.92 c 1.34,0.19 7.52,-0.56 8.11,0.48 c -2.38,7.43 -4.85,14.82 -7.39,22.19 c -0.15,0.4 -0.04,0.69 0.31,0.88 c 3.19,-1.76 6.97,-9.49 9.92,-12.55 c 2.42,-3.57 4.93,-7.08 7.52,-10.53 c 1.52,-0.95 6.53,-0.48 8.42,-0.36 c 0.62,0.62 0.76,1.35 0.43,2.19 c -1.31,4.2 -2.85,8.31 -4.59,12.34 c -3.61,11.29 -7.39,22.52 -11.33,33.7 c -0.9,1.21 -7.64,0.51 -9.27,0.49 c -0.61,-0.62 -0.76,-1.35 -0.43,-2.19 c 1.96,-6.21 4.17,-12.33 6.62,-18.34 c 0.31,-0.75 0.19,-1.4 -0.35,-1.93 c -2.57,1.44 -9.17,11.63 -11.02,14.62 c -1.94,2.69 -3.98,5.3 -6.1,7.83 c -3.04,0.22 -6.08,0.2 -9.13,-0.05 Z M 429.01,598 c 2.21,-6.44 13.91,-44.47 16.65,-46.84 c 2.95,-0.16 5.9,-0.21 8.87,-0.17 c 0.56,-0.02 1,0.19 1.32,0.64 c -1.88,6.38 -4.03,12.67 -6.45,18.86 c 0.54,0.8 6.83,0.89 7.49,-0.12 c 2.23,-6.2 4.32,-12.44 6.27,-18.72 c 0.3,-0.48 0.74,-0.7 1.32,-0.66 c 2.97,-0.03 5.94,0.02 8.9,0.15 c 0.62,0.62 0.76,1.35 0.43,2.19 c -2.23,6.42 -13.72,44.13 -16.47,46.51 c -2.95,0.16 -5.9,0.21 -8.87,0.17 c -0.56,0.03 -1,-0.19 -1.32,-0.64 c 1.79,-5.71 3.68,-11.39 5.67,-17.05 c 0.79,-2.15 -4.39,-1.1 -5.33,-1.29 c -0.79,0.04 -1.45,0.34 -1.98,0.92 c -1.94,6.03 -3.99,12 -6.15,17.91 c -2.95,0.14 -5.92,0.19 -8.88,0.15 c -1.2,-0.13 -1.69,-0.8 -1.47,-2.01 Z M 502.98,599 c 1.01,-4.63 2.08,-7.79 6.56,-10 c 3.55,-4.02 6.04,-18.01 9.24,-23.67 c 1.46,-4.81 3.08,-9.54 4.86,-14.19 c 8.62,-0.13 17.25,-0.18 25.88,-0.15 c 3.39,-0.14 0.33,5.42 -0.3,6.68 c -4.49,13.56 -8.97,27.14 -13.44,40.71 c -0.38,1.04 -1.14,1.58 -2.27,1.59 c -2.68,0.03 -5.36,0.04 -8.04,0.04 c -0.56,0.03 -1,-0.19 -1.32,-0.64 c 3.7,-11.22 7.39,-22.46 11.07,-33.7 c 0.51,-1.77 3.05,-4.11 -0.7,-3.69 c -1.16,0.2 -3.65,-0.48 -4.41,0.65 c -2.87,8.2 -5.65,16.44 -8.33,24.7 c -2.9,7.89 -8.55,13.57 -17.3,13.69 c -1.19,-0.14 -1.69,-0.81 -1.5,-2.02 Z M 286.96,588 c 0.43,1.05 0.99,2 1.7,2.85 c 4.26,0.77 5.13,-1.69 7.17,-4.47 c 2.76,-7.64 5.42,-15.32 7.97,-23.05 c 0.28,-1.34 -1.43,-2.6 -2.43,-3.17 c -4.48,-0.25 -5.65,2.98 -7.15,6.51 c -2.21,7.18 -4.63,14.3 -7.26,21.33 Z M 330.03,569.98 c 0.2,0.7 0.69,1.04 1.45,1.02 c 2.29,0.06 4.58,0.01 6.86,-0.15 c 0.57,-0.49 0.96,-1.1 1.17,-1.83 c 1.44,-3.58 3.71,-11.13 -3.55,-8.48 c -3.62,3.04 -4.41,4.97 -5.93,9.44 Z M 480.98,589 c -0.51,3.13 3.76,1.71 5.53,1.99 c 3.51,-0.6 5.71,-7.33 6.34,-10.36 c -0.68,-1.09 -5.89,-0.82 -6.9,-0.1 c -3.4,3.2 -4.01,3.8 -4.97,8.47 Z"/></g>' +
        '<g><path fill="#000000" stroke="#000000" stroke-width="0.5" d="M 132.99,334 c 1.21,-8.36 2.87,-14.89 7.18,-22.38 c 16.85,-25.07 41.59,-35.86 70.33,-40.65 c 4.45,-2.1 8.57,0.17 12.99,-1.95 c 141.68,-0.01 283.35,-0.03 425.03,-0.04 c 4.99,1.2 10.89,1.25 15.99,2.04 c 34.79,7.55 70.19,22.64 77.47,61.47 c 0.01,94.01 0.03,188.02 0.04,282.03 c -6.51,39.53 -42.3,54.87 -77.51,62.46 c -3.99,0.75 -11.23,0.71 -15,2 c -141.68,0.01 -283.35,0.03 -425.03,0.04 c -7.17,-1.26 -14.75,-1.55 -21.83,-3.22 c -32.35,-7.8 -63.34,-24.72 -69.63,-60.29 c -0.02,-93.84 -0.03,-187.67 -0.03,-281.51 Z M 137.99,334 c -0.05,93.78 0.01,187.56 0.18,281.35 c 6.51,39.1 51.65,56 86.45,58.51 c 141.58,0.2 283.15,0.19 424.72,-0.03 c 34.12,-2.69 82.54,-20.12 87.52,-59.45 c 0.2,-93.91 0.19,-187.82 -0.04,-281.73 c -7.17,-39.9 -53.15,-55.51 -88.44,-58.51 c -141.58,-0.2 -283.15,-0.19 -424.72,0.03 c -6.79,1.06 -13.99,1.54 -20.89,3.11 c -28.57,6.76 -60.81,24.66 -64.78,56.72 Z"/></g>' +
        '<g><path fill="#121212" stroke="#121212" stroke-width="0.5" d="M 137.99,334 c 3.97,-32.06 36.21,-49.96 64.78,-56.72 c 6.9,-1.57 14.1,-2.05 20.89,-3.11 c 141.57,-0.22 283.14,-0.23 424.72,-0.03 c 35.29,3 81.27,18.61 88.44,58.51 c 0.23,93.91 0.24,187.82 0.04,281.73 c -4.98,39.33 -53.4,56.76 -87.52,59.45 c -141.57,0.22 -283.14,0.23 -424.72,0.03 c -34.8,-2.51 -79.94,-19.41 -86.45,-58.51 c -0.17,-93.79 -0.23,-187.57 -0.18,-281.35 Z M 545.98,363.02 c 3.62,9.63 27.82,17.95 36.76,22.64 c 3.91,0.76 10.55,-4.64 11.94,-8.38 c 4.06,-9.32 23.39,-39.09 22.01,-47.54 c -1.97,-8.08 -34.94,-25.81 -41.95,-21.41 c -6.62,3.49 -29.17,47.03 -28.76,54.69 Z M 451.01,374 c -8.75,0.42 -17.85,2.42 -25.28,7.27 c -1.33,1.16 -2.73,2.22 -4.19,3.16 c -1.37,-0.43 -2.75,-0.84 -4.14,-1.23 c -1.64,-0.04 -3.24,0.16 -4.79,0.6 c -1.57,-1.2 -3.3,-2.07 -5.2,-2.59 c -1.64,-0.05 -3.24,0.15 -4.8,0.59 c -5.36,-4.06 -5.71,-4.55 -12.15,-2.37 c -1.12,-0.6 -2.19,-1.31 -3.2,-2.12 c -2.91,-2.06 -6.09,-0.96 -8.92,0.55 c -4.15,-0.91 -6.59,-3.47 -10.74,0.27 c -0.97,1.34 -2.04,2.57 -3.21,3.69 c -1.55,-0.46 -3.16,-0.66 -4.8,-0.61 c -2.26,0.44 -4.02,1.61 -5.27,3.53 c -0.8,1.57 -1.41,3.19 -1.83,4.85 c -4.87,-1.59 -7.91,0.97 -10.4,4.77 c -1.77,-0.24 -3.54,-0.24 -5.32,0 c -1.75,0.64 -3.29,1.62 -4.62,2.92 c -2.13,-0.59 -4.32,-0.94 -6.56,-1.07 c -1.8,0.53 -3.49,1.28 -5.09,2.24 c -1.39,-0.76 -2.81,-1.46 -4.28,-2.09 c -3.22,-0.43 -5.93,0.58 -8.15,3.01 c -0.41,0.13 -0.8,0.1 -1.18,-0.1 c -3.13,-2.58 -6.39,-2.77 -9.76,-0.57 c -0.99,0.9 -1.89,1.86 -2.7,2.89 c -4.11,-2.02 -7.55,-2.16 -10.74,1.54 c -0.84,1.56 -1.62,3.13 -2.33,4.71 c -1,-0.15 -1.99,-0.36 -2.97,-0.64 c -4.84,-0.41 -7.9,1.72 -9.18,6.38 c -0.12,1.63 0.08,3.21 0.62,4.74 c -1.38,-0.09 -2.79,-0.13 -4.24,-0.11 c -4.48,1.21 -6.68,4.15 -6.6,8.82 c -1.21,0.78 -4.67,1.77 -5.15,3.09 c -12.47,-0.37 -25.85,5.13 -28.64,18.5 c -0.23,20.1 19.24,26.05 35.98,25.7 c -9.2,3.32 -15.61,7.43 -19.69,16.66 c -5.38,17.18 -7.4,37.42 8.13,49.85 c 9.64,6.21 29.26,6.63 34.91,-4.86 c 0.83,-0.86 1.32,-0.7 1.47,0.49 c 0.32,1.39 -0.67,6.73 0.63,7.4 c 7.29,0.14 14.59,0.19 21.89,0.15 c 0.57,0.04 1.02,-0.17 1.34,-0.64 c 0.13,-30.29 0.18,-60.59 0.16,-90.89 c -3.19,-14.76 -6.3,-19.16 -20,-26 c -3.7,-1.2 -12.62,-2.22 -15.89,-2.24 c -0.31,-0.66 -1.56,-2.22 -0.64,-2.8 c 3.44,0.92 7.56,0.49 9.82,-2.57 c 0.85,-1.56 1.62,-3.13 2.33,-4.71 c 3.25,0.48 5.18,1.48 8.23,-0.86 c 0.99,-0.9 1.89,-1.86 2.69,-2.89 c 2.79,1.33 5.94,2.25 8.71,0.26 c 1.01,-0.83 2.09,-1.54 3.23,-2.12 c 2.32,0.97 4.16,2.76 6.91,2.24 c 1.8,-0.53 3.49,-1.28 5.09,-2.24 c 1.39,0.76 2.81,1.46 4.28,2.09 c 1.42,0.33 2.8,0.23 4.15,-0.29 c 1.58,-0.83 3.09,-1.76 4.53,-2.78 c 6.12,2.27 8.77,1.62 12.45,-3.93 c 6.02,0.59 10.74,-1.05 11.25,-7.96 c 1.37,0.07 2.79,0.11 4.25,0.11 c 1.48,-0.33 2.81,-0.97 3.99,-1.92 c 0.97,-1.34 2.04,-2.57 3.21,-3.69 c 1.55,0.46 3.15,0.66 4.8,0.61 c 1.64,-0.6 3.28,-1.15 4.93,-1.65 c 1.61,0.93 3.33,1.49 5.15,1.69 c 1.74,-0.19 3.43,-0.61 5.05,-1.26 c 1.61,1.23 3.35,2.26 5.24,3.07 c 2.33,0.74 3.51,-0.44 5.61,-0.44 c 2.73,1.84 4.3,3.98 8.02,3.6 c 0.97,-0.35 1.96,-0.55 2.98,-0.6 c 1.22,0.75 2.37,1.57 3.46,2.45 c 0.35,3.32 0.74,6.62 1.16,9.92 c -3.07,3.51 -3.87,7.01 -5.81,11.08 c -1.33,3.29 -0.78,9.68 -2.18,12.84 c -0.01,27.34 -0.03,54.69 -0.04,82.03 c 1.43,17.94 9.7,27.9 27.51,31.46 c 21.16,0.82 36.19,-2.71 41.49,-25.47 c 0.01,-21.68 0.03,-43.35 0.04,-65.03 c -0.75,-2.2 -1.15,-4.48 -1.22,-6.83 c -1.59,-3.93 -3.33,-7.33 -5.94,-10.97 c -1.46,-0.81 -2.74,-1.85 -3.84,-3.12 c -8.23,-5.12 -17.44,-6.52 -26.4,-2.39 c -0.77,0.38 -5.67,5.59 -5.61,2.37 c -0.49,-3.72 1.48,-7.51 0.75,-10.45 c 17.47,5.36 35.05,3.71 49.11,-8.69 c 10.81,-12.52 5.82,-28.54 -8.87,-34.43 c 0.06,-3.79 0,-7.58 -0.19,-11.37 c -0.95,-1.32 -2.09,-2.46 -3.41,-3.41 c -5.27,-0.25 -10.53,-0.25 -15.8,0 c -4.02,2.69 -3.78,4.1 -3.59,8.81 Z M 368.98,381.98 c 2.25,-5.32 9.18,-2.96 7.83,2.4 c -2.34,4.71 -8.41,2.63 -7.83,-2.4 Z M 378.98,381.98 c 2,-4.74 9.1,-3.95 9.04,1.52 c -1.58,5.59 -9.51,4.47 -9.04,-1.52 Z M 450,379 c -0.85,4.28 -2.02,6.46 -4.66,9.88 c -5.04,2.76 -23.12,9.48 -25.35,14.13 c -0.78,-0.1 -1.13,-0.57 -1.07,-1.4 c 0.04,-2.7 0.07,-5.39 0.08,-8.08 c -1.36,0.3 -2.79,0.37 -4.27,0.21 c -3.4,-2.06 -3.66,-4.46 -0.77,-7.19 c 1.05,-0.65 2.16,-0.75 3.32,-0.32 c 1.25,0.98 2.35,2.1 3.3,3.35 c 1.26,-0.85 2.44,-1.81 3.54,-2.88 c 7.15,-3.56 17.83,-7.5 25.88,-7.7 Z M 391.98,383.98 c 2.25,-5.32 9.18,-2.96 7.83,2.4 c -2.34,4.71 -8.41,2.63 -7.83,-2.4 Z M 355.98,386.98 c 2.25,-5.32 9.18,-2.96 7.83,2.4 c -2.34,4.71 -8.41,2.63 -7.83,-2.4 Z M 401.98,386.98 c 2.25,-5.32 9.18,-2.96 7.83,2.4 c -2.34,4.71 -8.41,2.63 -7.83,-2.4 Z M 474,384.99 c 17.55,11.69 9.62,27.03 -7.08,33.37 c -9.26,2.94 -19.82,3.94 -29.04,0.3 c 1.55,-1.2 3.13,-2.36 4.74,-3.49 c 13.82,-5.86 32.04,-11.68 31.38,-30.18 Z M 345.98,395.98 c 2.25,-5.32 9.18,-2.96 7.83,2.4 c -2.33,4.71 -8.41,2.63 -7.83,-2.4 Z M 333.98,399.98 c 2.25,-5.32 9.18,-2.96 7.83,2.4 c -2.34,4.71 -8.41,2.63 -7.83,-2.4 Z M 309.98,404 c -0.58,-4.98 5.49,-7.13 7.83,-2.39 c 2.07,6.46 -6.67,9.41 -7.83,2.39 Z M 321.98,401.98 c 2.25,-5.32 9.18,-2.96 7.83,2.4 c -2.34,4.71 -8.41,2.63 -7.83,-2.4 Z M 296.98,402.98 c 2.25,-5.32 9.18,-2.96 7.83,2.4 c -2.34,4.71 -8.41,2.63 -7.83,-2.4 Z M 285.98,405.98 c 2.25,-5.32 9.18,-2.96 7.83,2.4 c -2.34,4.71 -8.41,2.63 -7.83,-2.4 Z M 272.98,412.98 c 2.25,-5.32 9.18,-2.96 7.83,2.4 c -2.34,4.71 -8.41,2.63 -7.83,-2.4 Z M 594.98,411.98 c 0.05,2.28 1.22,3.29 3.51,3.04 c 12.67,-0.01 25.35,-0.03 38.02,-0.04 c 3.74,-0.29 3.17,-5.56 -1,-5 c -12.67,0.01 -25.35,0.03 -38.02,0.04 c -1.29,0.07 -2.12,0.72 -2.51,1.96 Z M 146.99,587 c 0.03,1.18 -0.37,3.17 1.49,3.01 c 7.68,-0.01 15.36,-0.01 23.04,0 c 0.57,0.04 1.02,-0.17 1.34,-0.64 c 0.09,-18.57 0.19,-37.13 0.3,-55.7 c 0.5,-0.32 0.94,-0.22 1.31,0.3 c 3.3,6.29 8.74,8.72 15.02,11.01 c 20.48,0.7 25.26,-8.49 29.53,-26.46 c -0.01,-23.01 -0.03,-46.02 -0.04,-69.03 c -3.59,-14.92 -7.49,-22.71 -23.48,-25.48 c -7.76,1.49 -17.33,3.55 -21.04,12.01 c -0.82,0.87 -1.31,0.71 -1.46,-0.48 c 0,-2.69 0,-5.37 0.01,-8.06 c 0.04,-0.57 -0.17,-1.02 -0.64,-1.34 c -7.62,-0.15 -15.25,-0.19 -22.88,-0.12 c -1.12,0.03 -1.89,0.56 -2.3,1.58 c -0.19,53.13 -0.25,106.26 -0.2,159.4 Z M 323.99,458 c 0.03,1.18 -0.37,3.17 1.49,3.01 c 7.3,0.03 14.6,-0.02 21.89,-0.15 c 2.15,-1.49 -2.26,-10.86 7.12,-12.84 c 5.69,-0.47 5.32,0.33 8.98,3.93 c 1.13,1.72 0.46,11.91 0.34,14.45 c -3.95,6.99 -12.76,3.98 -19.33,4.59 c -0.57,-0.04 -1.02,0.18 -1.34,0.64 c -0.18,6.58 -0.18,13.16 0,19.74 c 0.32,0.46 0.77,0.68 1.34,0.64 c 20.42,-0.55 23.87,-0.5 22.32,21.34 c -2.81,7.62 -5.07,8.33 -13.15,7.45 c -8.97,-2.95 -4.05,-12.83 -6.28,-14.66 c -6.62,-0.13 -13.25,-0.19 -19.88,-0.16 c -2,-0.26 -3.15,0.57 -3.47,2.51 c -0.69,29.82 12.34,37.42 40.49,36.49 c 30.11,-7.16 25.82,-26.82 25.29,-52.33 c -0.56,-2.41 -2.16,-4.65 -3.33,-6.67 c -2.32,-1.76 -4.77,-3.31 -7.34,-4.65 c -0.14,-0.52 0.03,-0.92 0.5,-1.19 c 2.22,-0.85 4.06,-3.53 5.81,-5.12 c 3.41,-5.61 3.49,-22.37 1.59,-28.51 c -0.31,-6.97 -3.84,-10.57 -7.71,-15.37 c -11.13,-7.47 -20.89,-7.58 -33.67,-5.94 c -17.92,5.45 -21.24,14.99 -21.66,32.8 Z M 493.99,452 c 0,22.17 0.02,44.34 0.03,66.51 c 5.84,27.67 31.92,31.51 55.02,21.94 c 8.47,-5.97 11.57,-11.98 13.94,-21.94 c 0.03,-22.67 0.03,-45.35 0,-68.02 c -2.98,-12.35 -8.01,-20.1 -20.63,-24.28 c -20.88,-5 -43.24,-0.6 -48.15,23.45 c -0.19,0.77 -0.26,1.55 -0.21,2.34 Z M 582.99,540 c 0.03,1.18 -0.37,3.17 1.49,3.01 c 5.68,0 11.35,-0.02 17.03,-0.04 c 0.79,-0.03 1.45,-0.35 1.96,-0.94 c 8.94,-21.54 17.58,-43.17 25.94,-64.9 c 0.54,0.67 0.75,1.45 0.64,2.32 c -0.1,20.98 -0.07,41.95 0.09,62.92 c 0.32,0.46 0.77,0.68 1.34,0.64 c 6.97,0.03 13.93,-0.02 20.89,-0.15 c 0.58,-0.66 0.8,-1.44 0.65,-2.34 c -0.03,-37.01 -0.03,-74.02 0,-111.03 c 0.26,-2 -0.57,-3.15 -2.51,-3.47 c -5.64,-0.08 -11.28,-0.03 -16.91,0.17 c -0.45,0.13 -0.81,0.38 -1.09,0.76 c -8.85,21.54 -17.53,43.13 -26.03,64.78 c -0.43,-0.66 -0.6,-1.4 -0.49,-2.21 c 0.05,-20.97 0.01,-41.93 -0.13,-62.89 c -0.66,-0.58 -1.44,-0.8 -2.34,-0.65 c -6.35,0.02 -12.7,0.03 -19.04,0.01 c -0.57,-0.04 -1.02,0.17 -1.34,0.64 c -0.14,37.78 -0.19,75.58 -0.15,113.37 Z M 246.96,435.97 c -2.44,3.63 -4.36,7.52 -5.76,11.68 c 0.11,2.03 -2.59,10.06 -0.57,11.21 c 7.91,0.18 15.83,0.18 23.74,0 c 0.47,-0.32 0.68,-0.76 0.64,-1.34 c -0.81,-7.4 5.29,-11.07 11.98,-10.52 c 4.28,39.56 -64.79,18.38 -42.84,-5.36 c 3.81,-3.08 7.73,-5.58 12.81,-5.67 Z M 207.21,445.77 c 0.32,0.36 0.66,0.7 1.02,1.02 c -0.18,1.35 -0.8,3.44 -2.6,3.02 c -3.04,-1.32 -1.16,-3.98 1.58,-4.04 Z M 172.99,511 c -0.06,-18.12 0.01,-36.24 0.21,-54.35 c 4.08,-12.8 17.49,-12.09 20.78,0.84 c 0.09,18.29 0.03,36.58 -0.18,54.86 c -3.82,13.98 -18.27,12.75 -20.81,-1.35 Z M 518.99,459 c -0.65,-11.49 14.93,-17.02 18.81,-2.35 c 0.21,18.28 0.27,36.57 0.18,54.86 c -1.49,5.22 -0.87,5.8 -5.58,9.31 c -8.18,0.81 -10.32,0.22 -13.2,-7.47 c -0.2,-18.11 -0.27,-36.23 -0.21,-54.35 Z M 283.34,450.85 c 3.72,2.88 2.66,16.93 2.53,21.52 c -0.33,0.47 -0.78,0.68 -1.35,0.64 c -6.19,0 -12.38,-0.01 -18.58,-0.02 c 0.08,-0.4 0.3,-0.69 0.67,-0.88 c 10.49,-3.2 16.07,-10.29 16.73,-21.26 Z M 432.98,516.02 c 0.01,-19.17 0.03,-38.35 0.04,-57.53 c 1.2,-4.28 1.69,-6.23 6.47,-7.48 c 7.84,-0.5 9.17,1.48 11.49,8.48 c 0.03,18.01 0.03,36.01 0,54.02 c -0.68,1.8 -1.18,3.65 -1.51,5.54 c -2.55,3.29 -5.87,4.6 -9.98,3.93 c -4.54,-0.85 -4.51,-3.43 -6.51,-6.96 Z M 547.79,451.77 c 1.76,0.18 3.96,1.14 2.73,3.27 c -1.96,2.15 -3.64,-0.13 -3.75,-2.25 c 0.36,-0.32 0.7,-0.66 1.02,-1.02 Z M 640.21,461.77 c 0.32,0.36 0.66,0.7 1.02,1.02 c -0.18,1.35 -0.8,3.44 -2.6,3.02 c -3.04,-1.32 -1.16,-3.98 1.58,-4.04 Z M 546.79,475.77 c 1.76,0.18 3.96,1.14 2.73,3.27 c -1.96,2.15 -3.64,-0.13 -3.75,-2.25 c 0.36,-0.32 0.7,-0.66 1.02,-1.02 Z M 375.23,480.21 c -0.36,0.32 -0.7,0.66 -1.02,1.02 c -2.12,-0.11 -4.4,-1.79 -2.25,-3.75 c 2.14,-1.23 3.09,0.97 3.27,2.73 Z M 545.77,476.79 c 0.11,2.12 1.79,4.4 3.75,2.25 c 1.23,-2.13 -0.97,-3.09 -2.73,-3.27 c 0.74,-0.68 1.6,-0.87 2.58,-0.59 c 3.49,2.21 3.49,4.43 0,6.65 c -1.95,0.2 -3.35,-0.63 -4.19,-2.46 c -0.28,-0.98 -0.09,-1.84 0.59,-2.58 Z M 508.77,479.79 c 0.11,2.12 1.79,4.4 3.75,2.25 c 1.23,-2.13 -0.97,-3.09 -2.73,-3.27 c 0.74,-0.68 1.6,-0.87 2.58,-0.59 c 1.83,0.84 2.66,2.24 2.46,4.19 c -2.22,3.48 -4.44,3.48 -6.65,0 c -0.28,-0.98 -0.09,-1.84 0.59,-2.58 Z M 463.21,489.77 c -2.74,0.06 -4.62,2.72 -1.58,4.04 c 1.8,0.42 2.42,-1.67 2.6,-3.02 c 0.68,0.74 0.87,1.6 0.59,2.58 c -2.21,3.49 -4.43,3.49 -6.65,0 c -0.19,-1.95 0.63,-3.35 2.46,-4.19 c 0.98,-0.28 1.84,-0.09 2.58,0.59 Z M 597.18,502.75 c -3.31,0.28 -4.27,3.25 -0.98,4.5 c -1.02,0.88 -2.1,0.94 -3.24,0.21 c -4.97,-3.78 1.47,-9.01 4.22,-4.71 Z M 165.21,502.77 c -2.74,0.06 -4.62,2.72 -1.58,4.04 c 1.8,0.42 2.42,-1.67 2.6,-3.02 c 0.68,0.74 0.87,1.6 0.59,2.58 c -2.21,3.49 -4.43,3.49 -6.65,0 c -0.19,-1.95 0.63,-3.35 2.46,-4.19 c 0.98,-0.28 1.84,-0.09 2.58,0.59 Z M 637.77,517.79 c 0.08,2.71 2.73,4.63 4.04,1.58 c 0.44,-1.87 -1.64,-2.4 -3.02,-2.6 c 0.74,-0.68 1.6,-0.87 2.58,-0.59 c 1.83,0.84 2.66,2.24 2.46,4.19 c -2.22,3.49 -4.44,3.49 -6.65,0 c -0.28,-0.98 -0.09,-1.84 0.59,-2.58 Z M 261.2,525.75 c -3.29,1.22 -2.33,4.23 0.98,4.5 c -2.75,4.3 -9.19,-0.93 -4.22,-4.71 c 1.14,-0.73 2.22,-0.67 3.24,0.21 Z M 349.23,531.21 c -0.18,-1.76 -1.13,-3.96 -3.27,-2.73 c -2.15,1.96 0.13,3.64 2.25,3.75 c -0.74,0.68 -1.6,0.87 -2.58,0.59 c -1.83,-0.84 -2.66,-2.24 -2.46,-4.19 c 2.22,-3.49 4.44,-3.49 6.65,0 c 0.28,0.98 0.09,1.84 -0.59,2.58 Z M 643.79,532.23 c -0.32,-0.36 -0.66,-0.7 -1.02,-1.02 c 0.06,-2.74 2.72,-4.62 4.04,-1.58 c 0.42,1.8 -1.67,2.42 -3.02,2.6 Z M 543.03,529.99 c -2.24,2.56 0.34,5.2 2.98,2.98 c -0.55,5.42 -7.26,5 -6.85,-0.34 c 0.91,-1.45 2.2,-2.33 3.87,-2.64 Z M 462.21,531.77 c -2.74,0.06 -4.62,2.72 -1.58,4.04 c 1.8,0.42 2.42,-1.67 2.6,-3.02 c 0.68,0.74 0.87,1.6 0.59,2.58 c -2.21,3.49 -4.43,3.49 -6.65,0 c -0.19,-1.95 0.63,-3.35 2.46,-4.19 c 0.98,-0.28 1.84,-0.09 2.58,0.59 Z M 265.04,618.98 c 0.02,0.39 0.22,0.67 0.59,0.84 c 2.3,0.15 9.32,0.89 10.86,-0.77 c 2.31,-6.79 4.55,-13.61 6.73,-20.45 c 0.13,-0.62 0.99,-1.68 1.64,-0.92 c 0.74,1.64 2,2.68 3.79,3.12 c 15.38,2.22 18.96,-16.05 22.57,-27.13 c 2.85,-7.91 6.73,-13.28 3.27,-21.71 c -5.17,-3.97 -10.29,-1.71 -14.94,1.64 c -0.43,-0.55 -0.67,-1.2 -0.71,-1.95 c -0.3,-0.48 -0.74,-0.7 -1.32,-0.66 c -1.64,0.31 -8.59,-0.64 -9.41,0.65 c -5.54,16.19 -10.98,32.43 -16.33,48.69 c -2.9,5.94 -4.19,12.56 -6.74,18.65 Z M 312.99,591 c -0.47,4.92 2.91,8.78 7.5,9.97 c 13.2,0.53 18.93,-2.59 24.33,-14.64 c 0.18,-0.51 0.03,-0.91 -0.43,-1.18 c -3.24,-0.2 -6.49,-0.2 -9.73,0.01 c -0.86,1.44 -1.74,2.88 -2.64,4.31 c -1.1,0.69 -2.28,1.2 -3.53,1.53 c -1.73,0.46 -4.57,-1.57 -4.28,-3.33 c 0.78,-2.24 1.55,-4.48 2.3,-6.72 c 0.28,-0.38 0.64,-0.63 1.09,-0.76 c 5.97,-0.2 11.94,-0.26 17.92,-0.18 c 0.58,0.04 1.02,-0.18 1.32,-0.66 c 1.87,-4.88 3.59,-9.83 5.13,-14.84 c -0.24,-4.02 1,-8.02 -1.49,-11.53 c -9,-5.63 -14.45,-3.19 -22.5,1.58 c -7.34,6.73 -12.66,26.94 -14.99,36.44 Z M 469.01,594 c 2.98,8.92 7.49,7.78 15.36,5.78 c 2.25,-1.22 1.56,-2.29 3.29,0.06 c 2.2,0.14 8.32,0.85 9.83,-0.79 c 4.3,-11.82 8.4,-23.72 12.31,-35.7 c 0.29,-4.3 1.3,-10.03 -3.78,-11.87 c -13.04,-3.74 -18.59,-0.24 -25.81,10.15 c -0.21,0.97 -0.48,1.92 -0.81,2.86 c 0.74,0.98 8.46,0.45 10,0.32 c 0.46,-0.12 0.81,-0.39 1.07,-0.78 c 1.07,-3.99 8.5,-6.04 8.5,-1.54 c -0.74,2.28 -1.44,4.57 -2.13,6.87 c -0.3,0.47 -0.74,0.69 -1.32,0.65 c -2.77,-0.36 -5.44,-0.04 -8.01,0.96 c -9.07,0.54 -14.42,9.3 -17.31,16.68 c -0.51,2.35 0.32,4.21 -1.19,6.35 Z M 177.04,598.98 c 0.2,0.7 0.68,1.04 1.44,1.02 c 2.01,0.01 4.02,0 6.03,-0.01 c 3.24,0.2 14.57,-19.16 17.95,-21.97 c 0.75,-3.27 1.96,-1.55 1.34,0.31 c -2.38,7.08 -4.86,14.13 -7.41,21.16 c 0.26,0.35 0.62,0.52 1.07,0.5 c 2.69,0 5.38,0.01 8.06,0.02 c 0.58,0.04 1.02,-0.18 1.32,-0.66 c 5.53,-15.84 10.86,-31.74 16.01,-47.72 c -0.69,-1.27 -5.97,-0.37 -7.36,-0.62 c -2.54,-0.27 -9.43,12.13 -11.93,13.97 c -1.81,3.17 -3.84,6.19 -6.09,9.04 c -0.38,0.53 -0.83,0.63 -1.33,0.29 c -0.52,-1.72 5.57,-17.27 6.66,-19.96 c 0.31,-1.21 0.69,-3.5 -1.28,-3.36 c -2.63,-0.04 -5.26,0.01 -7.88,0.15 c -5.36,15.99 -10.9,31.94 -16.6,47.84 Z M 235.04,598.98 c 0.2,0.7 0.68,1.04 1.44,1.02 c 1.64,-0.28 8.58,0.65 9.41,-0.64 c 2.05,-5.96 4.67,-11.59 6.27,-17.72 c 0.65,-0.6 1.43,-0.82 2.34,-0.67 c 1.41,-0.34 2.25,0.16 2.51,1.51 c -0.05,5.63 -0.01,11.26 0.13,16.89 c 0.66,0.58 1.44,0.8 2.34,0.64 c 2.35,-0.01 4.7,-0.01 7.04,0 c 0.57,0.04 1.02,-0.17 1.34,-0.64 c 0.07,-7.91 0.18,-15.81 0.33,-23.72 c 4.77,-7.54 9.53,-15.08 14.28,-22.63 c 0.52,-0.67 0.49,-1.29 -0.08,-1.87 c -2.49,-0.14 -8.32,-0.67 -10.44,0.35 c -4.08,5.95 -7.72,12.35 -11.48,18.53 c -0.85,1.33 -5.11,1.57 -4.29,-0.35 c 1.88,-5.45 3.76,-10.9 5.63,-16.35 c 0.44,-1.89 -0.33,-2.68 -2.3,-2.34 c -1.55,0.31 -7.59,-0.64 -8.4,0.65 c -5.38,15.77 -10.74,31.55 -16.07,47.34 Z M 348.04,598.98 c 0.2,0.7 0.68,1.04 1.44,1.02 c 1.55,-0.27 7.59,0.64 8.41,-0.63 c 2.45,-7.13 4.96,-14.2 7.54,-21.22 c 1.2,0.83 0.14,6.66 0.71,8.22 c 0.73,1.17 4.94,0.56 6.2,0.48 c 0.74,-1.22 1.56,-2.37 2.49,-3.47 c 0.58,-1.13 1.15,-2.26 1.7,-3.41 c 1.12,-1.47 1.81,0.09 1.28,1.35 c -1.87,5.45 -3.74,10.9 -5.62,16.35 c -0.55,1.36 -0.12,2.15 1.29,2.34 c 2.63,0.04 5.26,-0.01 7.88,-0.15 c 5.49,-16.07 10.99,-32.15 16.49,-48.23 c -0.32,-0.45 -0.76,-0.67 -1.32,-0.64 c -9.38,0.03 -9.87,-1.5 -13.7,7.39 c -2.92,4.38 -5.7,8.83 -8.34,13.36 c -0.34,-0.32 -0.5,-0.72 -0.49,-1.2 c -0.8,-6.64 1.87,-12.35 0.86,-18.91 c -0.32,-0.46 -0.77,-0.68 -1.34,-0.64 c -2.96,-0.03 -5.93,0.02 -8.88,0.15 c -4.06,11.67 -8.02,23.4 -11.86,35.19 c -1.78,4.14 -3.36,8.36 -4.74,12.65 Z M 390.21,599.8 c 3.05,0.25 6.09,0.27 9.13,0.05 c 2.12,-2.53 4.16,-5.14 6.1,-7.83 c 1.85,-2.99 8.45,-13.18 11.02,-14.62 c 0.54,0.53 0.66,1.18 0.35,1.93 c -2.45,6.01 -4.66,12.13 -6.62,18.34 c -0.33,0.84 -0.18,1.57 0.43,2.19 c 1.63,0.02 8.37,0.72 9.27,-0.49 c 3.94,-11.18 7.72,-22.41 11.33,-33.7 c 1.74,-4.03 3.28,-8.14 4.59,-12.34 c 0.33,-0.84 0.19,-1.57 -0.43,-2.19 c -1.89,-0.12 -6.9,-0.59 -8.42,0.36 c -2.59,3.45 -5.1,6.96 -7.52,10.53 c -2.95,3.06 -6.73,10.79 -9.92,12.55 c -0.35,-0.19 -0.46,-0.48 -0.31,-0.88 c 2.54,-7.37 5.01,-14.76 7.39,-22.19 c -0.59,-1.04 -6.77,-0.29 -8.11,-0.48 c -0.79,0.04 -1.45,0.34 -1.98,0.92 c -5.66,15.86 -11.09,31.81 -16.3,47.85 Z M 429.01,598 c -0.22,1.21 0.27,1.88 1.47,2.01 c 2.96,0.04 5.93,-0.01 8.88,-0.15 c 2.16,-5.91 4.21,-11.88 6.15,-17.91 c 0.53,-0.58 1.19,-0.88 1.98,-0.92 c 0.94,0.19 6.12,-0.86 5.33,1.29 c -1.99,5.66 -3.88,11.34 -5.67,17.05 c 0.32,0.45 0.76,0.67 1.32,0.64 c 2.97,0.04 5.92,-0.01 8.87,-0.17 c 2.75,-2.38 14.24,-40.09 16.47,-46.51 c 0.33,-0.84 0.19,-1.57 -0.43,-2.19 c -2.96,-0.13 -5.93,-0.18 -8.9,-0.15 c -0.58,-0.04 -1.02,0.18 -1.32,0.66 c -1.95,6.28 -4.04,12.52 -6.27,18.72 c -0.66,1.01 -6.95,0.92 -7.49,0.12 c 2.42,-6.19 4.57,-12.48 6.45,-18.86 c -0.32,-0.45 -0.76,-0.66 -1.32,-0.64 c -2.97,-0.04 -5.92,0.01 -8.87,0.17 c -2.74,2.37 -14.44,40.4 -16.65,46.84 Z M 502.98,599 c -0.19,1.21 0.31,1.88 1.5,2.02 c 8.75,-0.12 14.4,-5.8 17.3,-13.69 c 2.68,-8.26 5.46,-16.5 8.33,-24.7 c 0.76,-1.13 3.25,-0.45 4.41,-0.65 c 3.75,-0.42 1.21,1.92 0.7,3.69 c -3.68,11.24 -7.37,22.48 -11.07,33.7 c 0.32,0.45 0.76,0.67 1.32,0.64 c 2.68,0 5.36,-0.01 8.04,-0.04 c 1.13,-0.01 1.89,-0.55 2.27,-1.59 c 4.47,-13.57 8.95,-27.15 13.44,-40.71 c 0.63,-1.26 3.69,-6.82 0.3,-6.68 c -8.63,-0.03 -17.26,0.02 -25.88,0.15 c -1.78,4.65 -3.4,9.38 -4.86,14.19 c -3.2,5.66 -5.69,19.65 -9.24,23.67 c -4.48,2.21 -5.55,5.37 -6.56,10 Z M 286.96,588 c 2.63,-7.03 5.05,-14.15 7.26,-21.33 c 1.5,-3.53 2.67,-6.76 7.15,-6.51 c 1,0.57 2.71,1.83 2.43,3.17 c -2.55,7.73 -5.21,15.41 -7.97,23.05 c -2.04,2.78 -2.91,5.24 -7.17,4.47 c -0.71,-0.85 -1.27,-1.8 -1.7,-2.85 Z M 330.03,569.98 c 1.52,-4.47 2.31,-6.4 5.93,-9.44 c 7.26,-2.65 4.99,4.9 3.55,8.48 c -0.21,0.73 -0.6,1.34 -1.17,1.83 c -2.28,0.16 -4.57,0.21 -6.86,0.15 c -0.76,0.02 -1.25,-0.32 -1.45,-1.02 Z M 480.98,589 c 0.96,-4.67 1.57,-5.27 4.97,-8.47 c 1.01,-0.72 6.22,-0.99 6.9,0.1 c -0.63,3.03 -2.83,9.76 -6.34,10.36 c -1.77,-0.28 -6.04,1.14 -5.53,-1.99 Z"/></g>' +
        '<g><path fill="#85573e" stroke="#85573e" stroke-width="0.5" d="M 545.98,363.02 c -0.41,-7.66 22.14,-51.2 28.76,-54.69 c 7.01,-4.4 39.98,13.33 41.95,21.41 c 1.38,8.45 -17.95,38.22 -22.01,47.54 c -1.39,3.74 -8.03,9.14 -11.94,8.38 c -8.94,-4.69 -33.14,-13.01 -36.76,-22.64 Z M 550.97,362.02 c 1.77,5.11 25.59,14.76 31.03,18.55 c 6.53,4.22 25.6,-38.31 28.34,-43.64 c 2.1,-4.37 2.16,-7.61 -2.07,-10.63 c -5.66,-2.26 -26.2,-16.25 -31.18,-13.61 c -6.5,5.89 -24,40.64 -26.12,49.33 Z"/></g>' +
        '<g><path fill="#ad7151" stroke="#ad7151" stroke-width="0.5" d="M 550.97,362.02 c 2.12,-8.69 19.62,-43.44 26.12,-49.33 c 4.98,-2.64 25.52,11.35 31.18,13.61 c 4.23,3.02 4.17,6.26 2.07,10.63 c -2.74,5.33 -21.81,47.86 -28.34,43.64 c -5.44,-3.79 -29.26,-13.44 -31.03,-18.55 Z M 567.98,337.98 c -0.22,3.15 4.67,4.09 6.48,5.98 c 0.36,2.69 0.72,5.38 1.06,8.08 c 2.43,3.12 7.14,-2.99 10.7,-1.69 c 1.56,0.63 7.71,4.17 7.78,0.16 c -0.03,-2.54 0.17,-5.05 0.6,-7.53 c 2.06,-1.78 9.06,-3.9 5.37,-7.48 c -1.85,-1.09 -3.65,-2.24 -5.4,-3.46 c -0.39,-2.69 -0.76,-5.38 -1.09,-8.08 c -0.51,-0.61 -1.16,-0.92 -1.96,-0.93 c -2.41,0.96 -4.74,2.09 -6.97,3.4 c -2.18,-0.81 -4.32,-1.74 -6.42,-2.78 c -1.3,-0.26 -3.18,0.16 -3.13,1.84 c 0.01,2.54 -0.17,5.06 -0.54,7.55 c -1.82,1.6 -5.2,2.91 -6.48,4.94 Z"/></g>' +
        '<g><path fill="#ad8909" stroke="#ad8909" stroke-width="0.5" d="M 567.98,337.98 c 1.28,-2.03 4.66,-3.34 6.48,-4.94 c 0.37,-2.49 0.55,-5.01 0.54,-7.55 c -0.05,-1.68 1.83,-2.1 3.13,-1.84 c 2.1,1.04 4.24,1.97 6.42,2.78 c 2.23,-1.31 4.56,-2.44 6.97,-3.4 c 0.8,0.01 1.45,0.32 1.96,0.93 c 0.33,2.7 0.7,5.39 1.09,8.08 c 1.75,1.22 3.55,2.37 5.4,3.46 c 3.69,3.58 -3.31,5.7 -5.37,7.48 c -0.43,2.48 -0.63,4.99 -0.6,7.53 c -0.07,4.01 -6.22,0.47 -7.78,-0.16 c -3.56,-1.3 -8.27,4.81 -10.7,1.69 c -0.34,-2.7 -0.7,-5.39 -1.06,-8.08 c -1.81,-1.89 -6.7,-2.83 -6.48,-5.98 Z"/></g>' +
        '<g><path fill="#404040" stroke="#404040" stroke-width="0.5" d="M 451.01,374 c -0.07,1.72 -0.41,3.39 -1.01,5 c -8.05,0.2 -18.73,4.14 -25.88,7.7 c -1.1,1.07 -2.28,2.03 -3.54,2.88 c -0.95,-1.25 -2.05,-2.37 -3.3,-3.35 c -1.16,-0.43 -2.27,-0.33 -3.32,0.32 c -2.89,2.73 -2.63,5.13 0.77,7.19 c 1.48,0.16 2.91,0.09 4.27,-0.21 c -0.01,2.69 -0.04,5.38 -0.08,8.08 c -0.06,0.83 0.29,1.3 1.07,1.4 c 0.05,1.55 0.5,2.98 1.34,4.28 c 1.19,4.16 13.47,11.8 16.55,11.37 c 9.22,3.64 19.78,2.64 29.04,-0.3 c 16.7,-6.34 24.63,-21.68 7.08,-33.37 c 0,-1.67 0,-3.34 0,-5.02 c 14.69,5.89 19.68,21.91 8.87,34.43 c -14.06,12.4 -31.64,14.05 -49.11,8.69 c -7.37,-3.42 -14.49,-7.69 -17.89,-15.45 c -0.27,-0.25 -0.56,-0.27 -0.86,-0.07 c -0.42,-3.3 -0.81,-6.6 -1.16,-9.92 c -1.09,-0.88 -2.24,-1.7 -3.46,-2.45 c -1.02,0.05 -2.01,0.25 -2.98,0.6 c -3.72,0.38 -5.29,-1.76 -8.02,-3.6 c -2.1,0 -3.28,1.18 -5.61,0.44 c -1.89,-0.81 -3.63,-1.84 -5.24,-3.07 c -1.62,0.65 -3.31,1.07 -5.05,1.26 c -1.82,-0.2 -3.54,-0.76 -5.15,-1.69 c -1.65,0.5 -3.29,1.05 -4.93,1.65 c -1.65,0.05 -3.25,-0.15 -4.8,-0.61 c -1.17,1.12 -2.24,2.35 -3.21,3.69 c -1.18,0.95 -2.51,1.59 -3.99,1.92 c -1.46,0 -2.88,-0.04 -4.25,-0.11 c -0.51,6.91 -5.23,8.55 -11.25,7.96 c -3.68,5.55 -6.33,6.2 -12.45,3.93 c -1.44,1.02 -2.95,1.95 -4.53,2.78 c -1.35,0.52 -2.73,0.62 -4.15,0.29 c -1.47,-0.63 -2.89,-1.33 -4.28,-2.09 c -1.6,0.96 -3.29,1.71 -5.09,2.24 c -2.75,0.52 -4.59,-1.27 -6.91,-2.24 c -1.14,0.58 -2.22,1.29 -3.23,2.12 c -2.77,1.99 -5.92,1.07 -8.71,-0.26 c -0.8,1.03 -1.7,1.99 -2.69,2.89 c -3.05,2.34 -4.98,1.34 -8.23,0.86 c -0.71,1.58 -1.48,3.15 -2.33,4.71 c -2.26,3.06 -6.38,3.49 -9.82,2.57 c -0.92,0.58 0.33,2.14 0.64,2.8 c -1.02,1.51 -7.78,0.39 -9.64,0.79 c -1.79,0.79 -3.62,1.46 -5.5,2 c -0.08,-4.67 2.12,-7.61 6.6,-8.82 c 1.45,-0.02 2.86,0.02 4.24,0.11 c -0.54,-1.53 -0.74,-3.11 -0.62,-4.74 c 1.28,-4.66 4.34,-6.79 9.18,-6.38 c 0.98,0.28 1.97,0.49 2.97,0.64 c 0.71,-1.58 1.49,-3.15 2.33,-4.71 c 3.19,-3.7 6.63,-3.56 10.74,-1.54 c 0.81,-1.03 1.71,-1.99 2.7,-2.89 c 3.37,-2.2 6.63,-2.01 9.76,0.57 c 0.38,0.2 0.77,0.23 1.18,0.1 c 2.22,-2.43 4.93,-3.44 8.15,-3.01 c 1.47,0.63 2.89,1.33 4.28,2.09 c 1.6,-0.96 3.29,-1.71 5.09,-2.24 c 2.24,0.13 4.43,0.48 6.56,1.07 c 1.33,-1.3 2.87,-2.28 4.62,-2.92 c 1.78,-0.24 3.55,-0.24 5.32,0 c 2.49,-3.8 5.53,-6.36 10.4,-4.77 c 0.42,-1.66 1.03,-3.28 1.83,-4.85 c 1.25,-1.92 3.01,-3.09 5.27,-3.53 c 1.64,-0.05 3.25,0.15 4.8,0.61 c 1.17,-1.12 2.24,-2.35 3.21,-3.69 c 4.15,-3.74 6.59,-1.18 10.74,-0.27 c 2.83,-1.51 6.01,-2.61 8.92,-0.55 c 1.01,0.81 2.08,1.52 3.2,2.12 c 6.44,-2.18 6.79,-1.69 12.15,2.37 c 1.56,-0.44 3.16,-0.64 4.8,-0.59 c 1.9,0.52 3.63,1.39 5.2,2.59 c 1.55,-0.44 3.15,-0.64 4.79,-0.6 c 1.39,0.39 2.77,0.8 4.14,1.23 c 1.46,-0.94 2.86,-2 4.19,-3.16 c 7.43,-4.85 16.53,-6.85 25.28,-7.27 Z M 368.98,381.98 c -0.58,5.03 5.49,7.11 7.83,2.4 c 1.35,-5.36 -5.58,-7.72 -7.83,-2.4 Z M 378.98,381.98 c -0.47,5.99 7.46,7.11 9.04,1.52 c 0.06,-5.47 -7.04,-6.26 -9.04,-1.52 Z M 391.98,383.98 c -0.58,5.03 5.49,7.11 7.83,2.4 c 1.35,-5.36 -5.58,-7.72 -7.83,-2.4 Z M 355.98,386.98 c -0.58,5.03 5.49,7.11 7.83,2.4 c 1.35,-5.36 -5.58,-7.72 -7.83,-2.4 Z M 401.98,386.98 c -0.58,5.03 5.49,7.11 7.83,2.4 c 1.35,-5.36 -5.58,-7.72 -7.83,-2.4 Z M 461.98,392.98 c 1.84,-4.08 5.95,-3.81 7.01,0.52 c -1.16,4.92 -6.49,4.34 -7.01,-0.52 Z M 345.98,395.98 c -0.58,5.03 5.5,7.11 7.83,2.4 c 1.35,-5.36 -5.58,-7.72 -7.83,-2.4 Z M 333.98,399.98 c -0.58,5.03 5.49,7.11 7.83,2.4 c 1.35,-5.36 -5.58,-7.72 -7.83,-2.4 Z M 309.98,404 c 1.16,7.02 9.9,4.07 7.83,-2.39 c -2.34,-4.74 -8.41,-2.59 -7.83,2.39 Z M 321.98,401.98 c -0.58,5.03 5.49,7.11 7.83,2.4 c 1.35,-5.36 -5.58,-7.72 -7.83,-2.4 Z M 296.98,402.98 c -0.58,5.03 5.49,7.11 7.83,2.4 c 1.35,-5.36 -5.58,-7.72 -7.83,-2.4 Z M 285.98,405.98 c -0.58,5.03 5.49,7.11 7.83,2.4 c 1.35,-5.36 -5.58,-7.72 -7.83,-2.4 Z M 272.98,412.98 c -0.58,5.03 5.49,7.11 7.83,2.4 c 1.35,-5.36 -5.58,-7.72 -7.83,-2.4 Z M 253.84,430.12 c -2.25,1.98 -4.54,3.93 -6.88,5.85 c -5.08,0.09 -9,2.59 -12.81,5.67 c -21.95,23.74 47.12,44.92 42.84,5.36 c 3.26,-0.59 5.37,0.69 6.35,3.85 c -0.66,10.97 -6.24,18.06 -16.73,21.26 c -0.37,0.19 -0.59,0.48 -0.67,0.88 c -1.45,0.89 -3.03,1.33 -4.76,1.33 c -16.74,0.35 -36.21,-5.6 -35.98,-25.7 c 2.79,-13.37 16.17,-18.87 28.64,-18.5 Z M 207.21,445.77 c -2.74,0.06 -4.62,2.72 -1.58,4.04 c 1.8,0.42 2.42,-1.67 2.6,-3.02 c 0.68,0.74 0.87,1.6 0.59,2.58 c -2.21,3.49 -4.43,3.49 -6.65,0 c -0.19,-1.95 0.63,-3.35 2.46,-4.19 c 0.98,-0.28 1.84,-0.09 2.58,0.59 Z M 546.77,452.79 c 0.11,2.12 1.79,4.4 3.75,2.25 c 1.23,-2.13 -0.97,-3.09 -2.73,-3.27 c 0.74,-0.68 1.6,-0.87 2.58,-0.59 c 3.49,2.21 3.49,4.43 0,6.65 c -1.95,0.2 -3.35,-0.63 -4.19,-2.46 c -0.28,-0.98 -0.09,-1.84 0.59,-2.58 Z M 414.98,461.98 c 1.84,-4.08 5.95,-3.81 7.01,0.52 c -1.16,4.92 -6.49,4.34 -7.01,-0.52 Z M 640.21,461.77 c -2.74,0.06 -4.62,2.72 -1.58,4.04 c 1.8,0.42 2.42,-1.67 2.6,-3.02 c 0.68,0.74 0.87,1.6 0.59,2.58 c -2.21,3.49 -4.43,3.49 -6.65,0 c -0.19,-1.95 0.63,-3.35 2.46,-4.19 c 0.98,-0.28 1.84,-0.09 2.58,0.59 Z M 375.23,480.21 c -0.18,-1.76 -1.13,-3.96 -3.27,-2.73 c -2.15,1.96 0.13,3.64 2.25,3.75 c -0.74,0.68 -1.6,0.87 -2.58,0.59 c -1.83,-0.84 -2.66,-2.24 -2.46,-4.19 c 2.22,-3.49 4.44,-3.49 6.65,0 c 0.28,0.98 0.09,1.84 -0.59,2.58 Z M 545.77,476.79 c 0.11,2.12 1.79,4.4 3.75,2.25 c 1.23,-2.13 -0.97,-3.09 -2.73,-3.27 c 0.74,-0.68 1.6,-0.87 2.58,-0.59 c 3.49,2.21 3.49,4.43 0,6.65 c -1.95,0.2 -3.35,-0.63 -4.19,-2.46 c -0.28,-0.98 -0.09,-1.84 0.59,-2.58 Z M 508.77,479.79 c 0.11,2.12 1.79,4.4 3.75,2.25 c 1.23,-2.13 -0.97,-3.09 -2.73,-3.27 c 0.74,-0.68 1.6,-0.87 2.58,-0.59 c 1.83,0.84 2.66,2.24 2.46,4.19 c -2.22,3.48 -4.44,3.48 -6.65,0 c -0.28,-0.98 -0.09,-1.84 0.59,-2.58 Z M 463.21,489.77 c -2.74,0.06 -4.62,2.72 -1.58,4.04 c 1.8,0.42 2.42,-1.67 2.6,-3.02 c 0.68,0.74 0.87,1.6 0.59,2.58 c -2.21,3.49 -4.43,3.49 -6.65,0 c -0.19,-1.95 0.63,-3.35 2.46,-4.19 c 0.98,-0.28 1.84,-0.09 2.58,0.59 Z M 597.18,502.75 c -3.31,0.28 -4.27,3.25 -0.98,4.5 c -1.02,0.88 -2.1,0.94 -3.24,0.21 c -4.97,-3.78 1.47,-9.01 4.22,-4.71 Z M 165.21,502.77 c -2.74,0.06 -4.62,2.72 -1.58,4.04 c 1.8,0.42 2.42,-1.67 2.6,-3.02 c 0.68,0.74 0.87,1.6 0.59,2.58 c -2.21,3.49 -4.43,3.49 -6.65,0 c -0.19,-1.95 0.63,-3.35 2.46,-4.19 c 0.98,-0.28 1.84,-0.09 2.58,0.59 Z M 637.77,517.79 c 0.08,2.71 2.73,4.63 4.04,1.58 c 0.44,-1.87 -1.64,-2.4 -3.02,-2.6 c 0.74,-0.68 1.6,-0.87 2.58,-0.59 c 1.83,0.84 2.66,2.24 2.46,4.19 c -2.22,3.49 -4.44,3.49 -6.65,0 c -0.28,-0.98 -0.09,-1.84 0.59,-2.58 Z M 261.2,525.75 c -3.29,1.22 -2.33,4.23 0.98,4.5 c -2.75,4.3 -9.19,-0.93 -4.22,-4.71 c 1.14,-0.73 2.22,-0.67 3.24,0.21 Z M 349.23,531.21 c -0.18,-1.76 -1.13,-3.96 -3.27,-2.73 c -2.15,1.96 0.13,3.64 2.25,3.75 c -0.74,0.68 -1.6,0.87 -2.58,0.59 c -1.83,-0.84 -2.66,-2.24 -2.46,-4.19 c 2.22,-3.49 4.44,-3.49 6.65,0 c 0.28,0.98 0.09,1.84 -0.59,2.58 Z M 643.79,532.23 c 1.35,-0.18 3.44,-0.8 3.02,-2.6 c -1.32,-3.04 -3.98,-1.16 -4.04,1.58 c -0.68,-0.74 -0.87,-1.6 -0.59,-2.58 c 0.84,-1.83 2.24,-2.65 4.19,-2.46 c 3.49,2.22 3.49,4.44 0,6.65 c -0.98,0.28 -1.84,0.09 -2.58,-0.59 Z M 543.03,529.99 c -2.24,2.56 0.34,5.2 2.98,2.98 c -0.55,5.42 -7.26,5 -6.85,-0.34 c 0.91,-1.45 2.2,-2.33 3.87,-2.64 Z M 462.21,531.77 c -2.74,0.06 -4.62,2.72 -1.58,4.04 c 1.8,0.42 2.42,-1.67 2.6,-3.02 c 0.68,0.74 0.87,1.6 0.59,2.58 c -2.21,3.49 -4.43,3.49 -6.65,0 c -0.19,-1.95 0.63,-3.35 2.46,-4.19 c 0.98,-0.28 1.84,-0.09 2.58,0.59 Z M 265.04,618.98 c 0.02,0.39 0.22,0.67 0.59,0.84 c 2.3,0.15 9.32,0.89 10.86,-0.77 c 2.31,-6.79 4.55,-13.61 6.73,-20.45 c 0.13,-0.62 0.99,-1.68 1.64,-0.92 c 0.74,1.64 2,2.68 3.79,3.12 c 15.38,2.22 18.96,-16.05 22.57,-27.13 c 2.85,-7.91 6.73,-13.28 3.27,-21.71 c -5.17,-3.97 -10.29,-1.71 -14.94,1.64 c -0.43,-0.55 -0.67,-1.2 -0.71,-1.95 c -0.3,-0.48 -0.74,-0.7 -1.32,-0.66 c -1.64,0.31 -8.59,-0.64 -9.41,0.65 c -5.54,16.19 -10.98,32.43 -16.33,48.69 c -2.9,5.94 -4.19,12.56 -6.74,18.65 Z M 312.99,591 c -0.47,4.92 2.91,8.78 7.5,9.97 c 13.2,0.53 18.93,-2.59 24.33,-14.64 c 0.18,-0.51 0.03,-0.91 -0.43,-1.18 c -3.24,-0.2 -6.49,-0.2 -9.73,0.01 c -0.86,1.44 -1.74,2.88 -2.64,4.31 c -1.1,0.69 -2.28,1.2 -3.53,1.53 c -1.73,0.46 -4.57,-1.57 -4.28,-3.33 c 0.78,-2.24 1.55,-4.48 2.3,-6.72 c 0.28,-0.38 0.64,-0.63 1.09,-0.76 c 5.97,-0.2 11.94,-0.26 17.92,-0.18 c 0.58,0.04 1.02,-0.18 1.32,-0.66 c 1.87,-4.88 3.59,-9.83 5.13,-14.84 c -0.24,-4.02 1,-8.02 -1.49,-11.53 c -9,-5.63 -14.45,-3.19 -22.5,1.58 c -7.34,6.73 -12.66,26.94 -14.99,36.44 Z M 469.01,594 c 2.98,8.92 7.49,7.78 15.36,5.78 c 2.25,-1.22 1.56,-2.29 3.29,0.06 c 2.2,0.14 8.32,0.85 9.83,-0.79 c 4.3,-11.82 8.4,-23.72 12.31,-35.7 c 0.29,-4.3 1.3,-10.03 -3.78,-11.87 c -13.04,-3.74 -18.59,-0.24 -25.81,10.15 c -0.21,0.97 -0.48,1.92 -0.81,2.86 c 0.74,0.98 8.46,0.45 10,0.32 c 0.46,-0.12 0.81,-0.39 1.07,-0.78 c 1.07,-3.99 8.5,-6.04 8.5,-1.54 c -0.74,2.28 -1.44,4.57 -2.13,6.87 c -0.3,0.47 -0.74,0.69 -1.32,0.65 c -2.77,-0.36 -5.44,-0.04 -8.01,0.96 c -9.07,0.54 -14.42,9.3 -17.31,16.68 c -0.51,2.35 0.32,4.21 -1.19,6.35 Z M 177.04,598.98 c 0.2,0.7 0.68,1.04 1.44,1.02 c 2.01,0.01 4.02,0 6.03,-0.01 c 3.24,0.2 14.57,-19.16 17.95,-21.97 c 0.75,-3.27 1.96,-1.55 1.34,0.31 c -2.38,7.08 -4.86,14.13 -7.41,21.16 c 0.26,0.35 0.62,0.52 1.07,0.5 c 2.69,0 5.38,0.01 8.06,0.02 c 0.58,0.04 1.02,-0.18 1.32,-0.66 c 5.53,-15.84 10.86,-31.74 16.01,-47.72 c -0.69,-1.27 -5.97,-0.37 -7.36,-0.62 c -2.54,-0.27 -9.43,12.13 -11.93,13.97 c -1.81,3.17 -3.84,6.19 -6.09,9.04 c -0.38,0.53 -0.83,0.63 -1.33,0.29 c -0.52,-1.72 5.57,-17.27 6.66,-19.96 c 0.31,-1.21 0.69,-3.5 -1.28,-3.36 c -2.63,-0.04 -5.26,0.01 -7.88,0.15 c -5.36,15.99 -10.9,31.94 -16.6,47.84 Z M 235.04,598.98 c 0.2,0.7 0.68,1.04 1.44,1.02 c 1.64,-0.28 8.58,0.65 9.41,-0.64 c 2.05,-5.96 4.67,-11.59 6.27,-17.72 c 0.65,-0.6 1.43,-0.82 2.34,-0.67 c 1.41,-0.34 2.25,0.16 2.51,1.51 c -0.05,5.63 -0.01,11.26 0.13,16.89 c 0.66,0.58 1.44,0.8 2.34,0.64 c 2.35,-0.01 4.7,-0.01 7.04,0 c 0.57,0.04 1.02,-0.17 1.34,-0.64 c 0.07,-7.91 0.18,-15.81 0.33,-23.72 c 4.77,-7.54 9.53,-15.08 14.28,-22.63 c 0.52,-0.67 0.49,-1.29 -0.08,-1.87 c -2.49,-0.14 -8.32,-0.67 -10.44,0.35 c -4.08,5.95 -7.72,12.35 -11.48,18.53 c -0.85,1.33 -5.11,1.57 -4.29,-0.35 c 1.88,-5.45 3.76,-10.9 5.63,-16.35 c 0.44,-1.89 -0.33,-2.68 -2.3,-2.34 c -1.55,0.31 -7.59,-0.64 -8.4,0.65 c -5.38,15.77 -10.74,31.55 -16.07,47.34 Z M 348.04,598.98 c 0.2,0.7 0.68,1.04 1.44,1.02 c 1.55,-0.27 7.59,0.64 8.41,-0.63 c 2.45,-7.13 4.96,-14.2 7.54,-21.22 c 1.2,0.83 0.14,6.66 0.71,8.22 c 0.73,1.17 4.94,0.56 6.2,0.48 c 0.74,-1.22 1.56,-2.37 2.49,-3.47 c 0.58,-1.13 1.15,-2.26 1.7,-3.41 c 1.12,-1.47 1.81,0.09 1.28,1.35 c -1.87,5.45 -3.74,10.9 -5.62,16.35 c -0.55,1.36 -0.12,2.15 1.29,2.34 c 2.63,0.04 5.26,-0.01 7.88,-0.15 c 5.49,-16.07 10.99,-32.15 16.49,-48.23 c -0.32,-0.45 -0.76,-0.67 -1.32,-0.64 c -9.38,0.03 -9.87,-1.5 -13.7,7.39 c -2.92,4.38 -5.7,8.83 -8.34,13.36 c -0.34,-0.32 -0.5,-0.72 -0.49,-1.2 c -0.8,-6.64 1.87,-12.35 0.86,-18.91 c -0.32,-0.46 -0.77,-0.68 -1.34,-0.64 c -2.96,-0.03 -5.93,0.02 -8.88,0.15 c -4.06,11.67 -8.02,23.4 -11.86,35.19 c -1.78,4.14 -3.36,8.36 -4.74,12.65 Z M 390.21,599.8 c 3.05,0.25 6.09,0.27 9.13,0.05 c 2.12,-2.53 4.16,-5.14 6.1,-7.83 c 1.85,-2.99 8.45,-13.18 11.02,-14.62 c 0.54,0.53 0.66,1.18 0.35,1.93 c -2.45,6.01 -4.66,12.13 -6.62,18.34 c -0.33,0.84 -0.18,1.57 0.43,2.19 c 1.63,0.02 8.37,0.72 9.27,-0.49 c 3.94,-11.18 7.72,-22.41 11.33,-33.7 c 1.74,-4.03 3.28,-8.14 4.59,-12.34 c 0.33,-0.84 0.19,-1.57 -0.43,-2.19 c -1.89,-0.12 -6.9,-0.59 -8.42,0.36 c -2.59,3.45 -5.1,6.96 -7.52,10.53 c -2.95,3.06 -6.73,10.79 -9.92,12.55 c -0.35,-0.19 -0.46,-0.48 -0.31,-0.88 c 2.54,-7.37 5.01,-14.76 7.39,-22.19 c -0.59,-1.04 -6.77,-0.29 -8.11,-0.48 c -0.79,0.04 -1.45,0.34 -1.98,0.92 c -5.66,15.86 -11.09,31.81 -16.3,47.85 Z M 429.01,598 c -0.22,1.21 0.27,1.88 1.47,2.01 c 2.96,0.04 5.93,-0.01 8.88,-0.15 c 2.16,-5.91 4.21,-11.88 6.15,-17.91 c 0.53,-0.58 1.19,-0.88 1.98,-0.92 c 0.94,0.19 6.12,-0.86 5.33,1.29 c -1.99,5.66 -3.88,11.34 -5.67,17.05 c 0.32,0.45 0.76,0.67 1.32,0.64 c 2.97,0.04 5.92,-0.01 8.87,-0.17 c 2.75,-2.38 14.24,-40.09 16.47,-46.51 c 0.33,-0.84 0.19,-1.57 -0.43,-2.19 c -2.96,-0.13 -5.93,-0.18 -8.9,-0.15 c -0.58,-0.04 -1.02,0.18 -1.32,0.66 c -1.95,6.28 -4.04,12.52 -6.27,18.72 c -0.66,1.01 -6.95,0.92 -7.49,0.12 c 2.42,-6.19 4.57,-12.48 6.45,-18.86 c -0.32,-0.45 -0.76,-0.66 -1.32,-0.64 c -2.97,-0.04 -5.92,0.01 -8.87,0.17 c -2.74,2.37 -14.44,40.4 -16.65,46.84 Z M 502.98,599 c -0.19,1.21 0.31,1.88 1.5,2.02 c 8.75,-0.12 14.4,-5.8 17.3,-13.69 c 2.68,-8.26 5.46,-16.5 8.33,-24.7 c 0.76,-1.13 3.25,-0.45 4.41,-0.65 c 3.75,-0.42 1.21,1.92 0.7,3.69 c -3.68,11.24 -7.37,22.48 -11.07,33.7 c 0.32,0.45 0.76,0.67 1.32,0.64 c 2.68,0 5.36,-0.01 8.04,-0.04 c 1.13,-0.01 1.89,-0.55 2.27,-1.59 c 4.47,-13.57 8.95,-27.15 13.44,-40.71 c 0.63,-1.26 3.69,-6.82 0.3,-6.68 c -8.63,-0.03 -17.26,0.02 -25.88,0.15 c -1.78,4.65 -3.4,9.38 -4.86,14.19 c -3.2,5.66 -5.69,19.65 -9.24,23.67 c -4.48,2.21 -5.55,5.37 -6.56,10 Z M 286.96,588 c 2.63,-7.03 5.05,-14.15 7.26,-21.33 c 1.5,-3.53 2.67,-6.76 7.15,-6.51 c 1,0.57 2.71,1.83 2.43,3.17 c -2.55,7.73 -5.21,15.41 -7.97,23.05 c -2.04,2.78 -2.91,5.24 -7.17,4.47 c -0.71,-0.85 -1.27,-1.8 -1.7,-2.85 Z M 330.03,569.98 c 1.52,-4.47 2.31,-6.4 5.93,-9.44 c 7.26,-2.65 4.99,4.9 3.55,8.48 c -0.21,0.73 -0.6,1.34 -1.17,1.83 c -2.28,0.16 -4.57,0.21 -6.86,0.15 c -0.76,0.02 -1.25,-0.32 -1.45,-1.02 Z M 480.98,589 c 0.96,-4.67 1.57,-5.27 4.97,-8.47 c 1.01,-0.72 6.22,-0.99 6.9,0.1 c -0.63,3.03 -2.83,9.76 -6.34,10.36 c -1.77,-0.28 -6.04,1.14 -5.53,-1.99 Z"/></g>' +
        '</svg>';
    }

    /* «SEX» — твой трассированный SVG */
    function artSex() {
        return '<svg viewBox="0 0 838 845" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' +
        '<g><path fill="#ffffff" stroke="#ffffff" stroke-width="0.5" d="M 0,0 c 279.33,0 558.67,0 838,0 c 0,281.67 0,563.33 0,845 c -279.33,0 -558.67,0 -838,0 c 0,-281.67 0,-563.33 0,-845 Z M 135.99,562 c 6.03,33.93 30.72,48.2 61.66,56.8 c 4.14,1.09 9.93,0.81 13.84,2.18 c 123.34,0.01 246.69,0.03 370.03,0.04 c 4.43,-0.91 9.38,-1.62 13.99,-2.04 c 28.61,-7.04 54.02,-20.72 63.29,-50.63 c 0.44,-2.99 -0.19,-4.96 1.18,-7.84 c 0.01,-86.68 0.03,-173.35 0.04,-260.03 c -5.3,-37.05 -34.72,-52.93 -68.52,-59.51 c -4.11,-1.98 -7.91,0.05 -11.99,-1.95 c -121.68,-0.01 -243.35,-0.03 -365.03,-0.04 c -3.22,1.3 -8.84,0.54 -11.98,1.99 c -31.99,5.92 -59.99,22.28 -66.48,56.52 c -0.02,88.17 -0.03,176.34 -0.03,264.51 Z"/></g>' +
        '<g><path fill="#000000" stroke="#000000" stroke-width="0.5" d="M 135.99,562 c 0,-88.17 0.01,-176.34 0.03,-264.51 c 6.49,-34.24 34.49,-50.6 66.48,-56.52 c 3.14,-1.45 8.76,-0.69 11.98,-1.99 c 121.68,0.01 243.35,0.03 365.03,0.04 c 4.08,2 7.88,-0.03 11.99,1.95 c 33.8,6.58 63.22,22.46 68.52,59.51 c -0.01,86.68 -0.03,173.35 -0.04,260.03 c -1.37,2.88 -0.74,4.85 -1.18,7.84 c -9.27,29.91 -34.68,43.59 -63.29,50.63 c -4.61,0.42 -9.56,1.13 -13.99,2.04 c -123.34,-0.01 -246.69,-0.03 -370.03,-0.04 c -3.91,-1.37 -9.7,-1.09 -13.84,-2.18 c -30.94,-8.6 -55.63,-22.87 -61.66,-56.8 Z M 140.99,299 c -0.04,87.78 0.02,175.56 0.19,263.34 c 4.52,30.7 34.77,47.1 62.6,52.37 c 2.98,0.17 5.93,0.55 8.84,1.15 c 123.24,0.19 246.48,0.18 369.72,-0.04 c 20.88,-3.02 34.57,-7.03 52.06,-19.96 c 11.54,-10.38 18.39,-19.61 20.45,-35.48 c 0.2,-87.24 0.19,-174.48 -0.03,-261.72 c -5.91,-36.26 -43.85,-51.72 -76.44,-54.52 c -121.58,-0.19 -243.15,-0.18 -364.72,0.04 c -31.73,3.26 -67.67,19.61 -72.67,54.82 Z M 322.05,363.97 c 19.36,0.66 25.8,14.57 20.6,31.89 c -0.39,1.67 -1.45,2.44 -3.16,2.33 c -6.7,0.28 -13.39,0.29 -20.06,0.03 c -1.61,-1.45 2.75,-7.84 -2.56,-11.42 c -12.75,-5.54 -26.41,16.87 -13.5,23.4 c 12.74,6.55 29.58,10.2 26.85,28.58 c -4.11,27.29 -26.31,46.61 -54.28,44.62 c -20.01,-2.17 -25.59,-17.46 -19.19,-35.18 c 0.2,-1.76 4.99,-0.87 6.25,-1.26 c 5.47,-0.01 10.94,0.04 16.41,0.16 c 0.47,0.31 0.64,0.74 0.51,1.3 c -5.58,16.5 13.9,16.23 21.51,5.73 c 16.33,-21.96 -29.97,-17.68 -28.55,-44.62 c 1.94,-24.96 23.45,-46.72 49.17,-45.56 Z M 420.89,426.95 c -0.6,1.09 -1.44,5.5 -2.55,5.86 c -7,0.05 -42.8,-1.08 -46.48,1.13 c -2.4,4.75 -4.35,11.48 -5.61,16.72 c -2.72,14.77 15.99,12.24 21.67,3.29 c 0.82,-1.98 1.76,-3.88 2.81,-5.7 c 6.92,-0.22 13.85,-0.28 20.79,-0.2 c 0.81,-0.09 1.55,0.09 2.21,0.54 c -2.71,8.9 -7.41,16.6 -14.09,23.09 c -12.08,10.25 -27.24,13.82 -42.74,10.72 c -20.29,-5.41 -17.74,-24.12 -11.98,-40.03 c 3.67,-10.81 7.35,-21.61 11.04,-32.41 c 4.68,-15.45 11.72,-29.05 25.18,-38.57 c 14.69,-9.68 47.24,-13.06 51.17,9.8 c 1.59,14.57 -7.43,31.79 -11.42,45.76 Z M 532.64,368.6 c -4.64,5.38 -9.3,10.76 -13.97,16.11 c -9.99,11.53 -19.98,23.05 -29.99,34.56 c -2.4,3.04 -3.64,4.18 -2.61,8.25 c 3.61,17.38 7.22,34.76 10.85,52.13 c 0.51,1.42 0.04,2.2 -1.4,2.35 c -7.68,0.01 -15.35,0 -23.03,-0.02 c -0.56,0.04 -1.01,-0.16 -1.34,-0.61 c -1.64,-11.05 -3.26,-22.08 -4.88,-33.1 c -0.44,-0.07 -0.79,0.08 -1.06,0.45 c -4.66,6.13 -9.42,12.19 -14.29,18.16 c -3.81,4.99 -7.77,9.85 -11.89,14.59 c -7.75,1.13 -17.42,0.6 -25.35,0.35 c -0.25,-0.28 -0.23,-0.55 0.07,-0.81 c 8.77,-9.99 17.54,-19.98 26.31,-29.98 c 7.37,-8.38 14.75,-16.76 22.12,-25.15 c 0.35,-0.4 0.57,-0.87 0.68,-1.39 c -2.78,-19.32 -5.65,-38.63 -8.6,-57.93 c 0.62,-0.55 1.36,-0.78 2.22,-0.69 c 7.01,0.01 14.02,0.01 21.03,-0.01 c 1.28,0.03 3.26,-0.15 3.15,1.72 c 0.72,10.34 1.4,20.68 2.05,31.03 c 0.01,0.55 0.24,0.97 0.7,1.25 c 8.35,-11.28 16.79,-22.5 25.31,-33.66 c 7.94,-0.17 15.88,-0.26 23.83,-0.26 c 0.82,-0.12 1.55,0.05 2.18,0.5 c -0.67,0.74 -1.36,1.46 -2.09,2.16 Z M 392.78,387.53 c -8.46,5.41 -10.59,15.29 -13.86,24.09 c -0.63,1.58 -0.1,2.37 1.57,2.36 c 6.95,0.03 13.88,-0.03 20.82,-0.2 c 1.06,-0.51 3.33,-9.06 4.09,-10.63 c 4.47,-11.12 1.01,-21.63 -12.62,-15.62 Z"/></g>' +
        '<g><path fill="#880015" stroke="#880015" stroke-width="0.5" d="M 140.99,299 c 5,-35.21 40.94,-51.56 72.67,-54.82 c 121.57,-0.22 243.14,-0.23 364.72,-0.04 c 32.59,2.8 70.53,18.26 76.44,54.52 c 0.22,87.24 0.23,174.48 0.03,261.72 c -2.06,15.87 -8.91,25.1 -20.45,35.48 c -17.49,12.93 -31.18,16.94 -52.06,19.96 c -123.24,0.22 -246.48,0.23 -369.72,0.04 c -2.91,-0.6 -5.86,-0.98 -8.84,-1.15 c -27.83,-5.27 -58.08,-21.67 -62.6,-52.37 c -0.17,-87.78 -0.23,-175.56 -0.19,-263.34 Z M 532.64,368.6 c 0.73,-0.7 1.42,-1.42 2.09,-2.16 c -0.63,-0.45 -1.36,-0.62 -2.18,-0.5 c -7.95,0 -15.89,0.09 -23.83,0.26 c -8.52,11.16 -16.96,22.38 -25.31,33.66 c -0.46,-0.28 -0.69,-0.7 -0.7,-1.25 c -0.65,-10.35 -1.33,-20.69 -2.05,-31.03 c 0.11,-1.87 -1.87,-1.69 -3.15,-1.72 c -7.01,0.02 -14.02,0.02 -21.03,0.01 c -0.86,-0.09 -1.6,0.14 -2.22,0.69 c 2.95,19.3 5.82,38.61 8.6,57.93 c -0.11,0.52 -0.33,0.99 -0.68,1.39 c -7.37,8.39 -14.75,16.77 -22.12,25.15 c -2.72,-4 -15.55,-23.89 -19.17,-24.08 c 3.99,-13.97 13.01,-31.19 11.42,-45.76 c -3.93,-22.86 -36.48,-19.48 -51.17,-9.8 c -14.8,-20.17 -29.67,-40.29 -44.62,-60.36 c -0.31,-0.41 -0.43,-0.87 -0.36,-1.38 c 2.5,-1.14 5.05,-2.24 7.63,-3.29 c 59.88,-24.12 134.76,0.38 165.23,58.15 c 1.09,0.56 2.26,0.78 3.51,0.68 c 6.01,0.08 12.01,0.1 18.02,0.04 c 0.53,0 0.91,-0.22 1.16,-0.66 c -71.22,-142.9 -292.94,-96.95 -289.54,68.78 c 9.3,84.68 75.39,137 159.22,135.51 c 85.69,-7.28 145.85,-67.52 143.44,-155.21 c 0.18,-6.41 -7.79,-42.84 -12.19,-45.05 Z M 322.05,363.97 c -25.72,-1.16 -47.23,20.6 -49.17,45.56 c -1.42,26.94 44.88,22.66 28.55,44.62 c -7.61,10.5 -27.09,10.77 -21.51,-5.73 c 0.13,-0.56 -0.04,-0.99 -0.51,-1.3 c -5.47,-0.12 -10.94,-0.17 -16.41,-0.16 c -6.78,-40.88 5.28,-80.33 34.46,-109.95 c 0.47,-0.44 1,-0.56 1.6,-0.36 c 8.73,8.52 12.49,20.75 22.99,27.32 Z M 518.67,384.71 c 10.94,37.12 7.79,70.96 -11.97,104.57 c -5.2,8.54 -11.43,16.25 -18.68,23.12 c -0.66,0.5 -1.34,0.53 -2.05,0.09 c -10.98,-15 -21.97,-30.01 -32.95,-45.02 c -0.61,-0.53 -1.31,-0.73 -2.1,-0.59 c 4.87,-5.97 9.63,-12.03 14.29,-18.16 c 0.27,-0.37 0.62,-0.52 1.06,-0.45 c 1.62,11.02 3.24,22.05 4.88,33.1 c 0.33,0.45 0.78,0.65 1.34,0.61 c 7.68,0.02 15.35,0.03 23.03,0.02 c 1.44,-0.15 1.91,-0.93 1.4,-2.35 c -3.63,-17.37 -7.24,-34.75 -10.85,-52.13 c -1.03,-4.07 0.21,-5.21 2.61,-8.25 c 10.01,-11.51 20,-23.03 29.99,-34.56 Z M 342.65,395.86 c 0.65,0.35 1.23,0.79 1.75,1.31 c 3.36,4.34 6.55,8.79 9.59,13.34 c 0.72,0.71 1.21,-0.4 1.97,-0.55 c -3.69,10.8 -7.37,21.6 -11.04,32.41 c -5.76,15.91 -8.31,34.62 11.98,40.03 c 15.5,3.1 30.66,-0.47 42.74,-10.72 c 14.52,19.51 29.08,39 43.68,58.45 c 2.22,3.03 4.3,6.14 6.26,9.32 c -1.34,0.91 -2.8,1.65 -4.38,2.2 c -64.48,25.59 -134.87,2.26 -169.26,-58.25 c 27.97,1.99 50.17,-17.33 54.28,-44.62 c 2.73,-18.38 -14.11,-22.03 -26.85,-28.58 c -12.91,-6.53 0.75,-28.94 13.5,-23.4 c 5.31,3.58 0.95,9.97 2.56,11.42 c 6.67,0.26 13.36,0.25 20.06,-0.03 c 1.71,0.11 2.77,-0.66 3.16,-2.33 Z M 405.4,403.15 c -4.39,-4.49 -8.07,-11.51 -12.62,-15.62 c 13.63,-6.01 17.09,4.5 12.62,15.62 Z M 371.86,433.94 c 4.77,6.48 9.52,12.97 14.24,19.49 c 0.51,0.49 1.12,0.66 1.82,0.52 c -5.68,8.95 -24.39,11.48 -21.67,-3.29 c 1.26,-5.24 3.21,-11.97 5.61,-16.72 Z"/></g>' +
        '<g><path fill="#ab001a" stroke="#ab001a" stroke-width="0.5" d="M 381.14,371.39 c -13.46,9.52 -20.5,23.12 -25.18,38.57 c -0.76,0.15 -1.25,1.26 -1.97,0.55 c -3.04,-4.55 -6.23,-9 -9.59,-13.34 c -0.52,-0.52 -1.1,-0.96 -1.75,-1.31 c 5.2,-17.32 -1.24,-31.23 -20.6,-31.89 c -10.5,-6.57 -14.26,-18.8 -22.99,-27.32 c -0.6,-0.2 -1.13,-0.08 -1.6,0.36 c -29.18,29.62 -41.24,69.07 -34.46,109.95 c -1.26,0.39 -6.05,-0.5 -6.25,1.26 c -6.4,17.72 -0.82,33.01 19.19,35.18 c 34.39,60.51 104.78,83.84 169.26,58.25 c 1.58,-0.55 3.04,-1.29 4.38,-2.2 c -1.96,-3.18 -4.04,-6.29 -6.26,-9.32 c -14.6,-19.45 -29.16,-38.94 -43.68,-58.45 c 6.68,-6.49 11.38,-14.19 14.09,-23.09 c -0.66,-0.45 -1.4,-0.63 -2.21,-0.54 c -6.94,-0.08 -13.87,-0.02 -20.79,0.2 c -1.05,1.82 -1.99,3.72 -2.81,5.7 c -0.7,0.14 -1.31,-0.03 -1.82,-0.52 c -4.72,-6.52 -9.47,-13.01 -14.24,-19.49 c 3.68,-2.21 39.48,-1.08 46.48,-1.13 c 1.11,-0.36 1.95,-4.77 2.55,-5.86 c 3.62,0.19 16.45,20.08 19.17,24.08 c -8.77,10 -17.54,19.99 -26.31,29.98 c -0.3,0.26 -0.32,0.53 -0.07,0.81 c 7.93,0.25 17.6,0.78 25.35,-0.35 c 4.12,-4.74 8.08,-9.6 11.89,-14.59 c 0.79,-0.14 1.49,0.06 2.1,0.59 c 10.98,15.01 21.97,30.02 32.95,45.02 c 0.71,0.44 1.39,0.41 2.05,-0.09 c 7.25,-6.87 13.48,-14.58 18.68,-23.12 c 19.76,-33.61 22.91,-67.45 11.97,-104.57 c 4.67,-5.35 9.33,-10.73 13.97,-16.11 c 4.4,2.21 12.37,38.64 12.19,45.05 c 2.41,87.69 -57.75,147.93 -143.44,155.21 c -83.83,1.49 -149.92,-50.83 -159.22,-135.51 c -3.4,-165.73 218.32,-211.68 289.54,-68.78 c -0.25,0.44 -0.63,0.66 -1.16,0.66 c -6.01,0.06 -12.01,0.04 -18.02,-0.04 c -1.25,0.1 -2.42,-0.12 -3.51,-0.68 c -30.47,-57.77 -105.35,-82.27 -165.23,-58.15 c -2.58,1.05 -5.13,2.15 -7.63,3.29 c -0.07,0.51 0.05,0.97 0.36,1.38 c 14.95,20.07 29.82,40.19 44.62,60.36 Z M 392.78,387.53 c 4.55,4.11 8.23,11.13 12.62,15.62 c -0.76,1.57 -3.03,10.12 -4.09,10.63 c -6.94,0.17 -13.87,0.23 -20.82,0.2 c -1.67,0.01 -2.2,-0.78 -1.57,-2.36 c 3.27,-8.8 5.4,-18.68 13.86,-24.09 Z"/></g>' +
        '</svg>';
    }

    function artFear() {
        var t = swBg('#202327');
        t += '<g transform="translate(196,74) rotate(-8)">';
        t += '<path d="M -72 -18 L 16 -30 L 22 26 L -66 34 Z" fill="#7d8186"/>';
        t += '<rect x="16" y="-30" width="74" height="16" fill="#a06b4a"/>';
        t += '<rect x="84" y="-33" width="12" height="22" fill="#7d4f33"/>';
        t += '<path d="M 96 -22 q 24 8 14 30 q -8 15 -17 5" fill="none" stroke="#7d4f33" stroke-width="4"/>';
        t += '</g>';
        t += swText(200, 190, 92, '#8b0016', 'страх', 'textLength="330" lengthAdjust="spacingAndGlyphs"');
        t += '<path d="M 96 196 q 6 26 0 34 q -8 -6 -6 -34 Z" fill="#8b0016"/>';
        t += '<path d="M 152 196 q 4 16 0 22 q -6 -4 -4 -22 Z" fill="#8b0016"/>';
        t += '<path d="M 332 168 q 5 20 0 26 q -7 -5 -5 -26 Z" fill="#8b0016"/>';
        t += '<circle cx="66" cy="148" r="4.5" fill="#000"/>';
        t += '<rect x="84" y="152" width="26" height="13" rx="2" fill="#cfc3a0"/>';
        t += '<circle cx="91" cy="157" r="1.4" fill="#a99e7d"/><circle cx="97" cy="160" r="1.4" fill="#a99e7d"/><circle cx="103" cy="157" r="1.4" fill="#a99e7d"/>';
        t += '<path d="M 150 172 l 30 22 M 156 166 l 26 20 M 146 180 l 26 18" stroke="#a3132f" stroke-width="2.5" fill="none"/>';
        return t;
    }
    function artDrugs() {
        var t = swBg('#202124');
        t += '<g transform="translate(232,182) rotate(8)">';
        t += '<line x1="-190" y1="-14" x2="-70" y2="0" stroke="#3f444a" stroke-width="4"/>';
        t += '<circle cx="-192" cy="-10" r="2.5" fill="#8a9199"/><circle cx="-196" cy="-2" r="2" fill="#8a9199"/><circle cx="-190" cy="4" r="2" fill="#8a9199"/>';
        t += '<rect x="-72" y="-26" width="150" height="56" rx="14" fill="#4a4f54"/>';
        t += '<rect x="-52" y="-14" width="96" height="32" rx="10" fill="#565d64"/>';
        t += '<circle cx="-20" cy="-2" r="3" fill="#8a9199"/><circle cx="16" cy="6" r="3" fill="#8a9199"/>';
        t += '<rect x="76" y="-14" width="26" height="28" rx="6" fill="#3f444a"/>';
        t += '<ellipse cx="112" cy="0" rx="12" ry="26" fill="#3f444a"/><ellipse cx="112" cy="0" rx="5" ry="14" fill="#202124"/>';
        t += '</g>';
        t += swSmall(170, 118, 32, '#f5f5f5', 'употребление');
        return t + swText(195, 200, 100, '#f5f5f5', 'нарк.', 'textLength="310" lengthAdjust="spacingAndGlyphs"');
    }
    function artReal() {
        var t = swBg('#101214');
        t += '<circle cx="160" cy="150" r="92" fill="#050505"/>';
        t += '<circle cx="160" cy="150" r="50" fill="#0c0e10"/>';
        t += '<circle cx="310" cy="72" r="9" fill="#a3132f"/><circle cx="310" cy="72" r="4" fill="#6b0c1a"/>';
        t += swSmall(258, 142, 30, '#f5f5f5', 'реальные');
        return t + swText(200, 208, 88, '#f5f5f5', 'события', 'textLength="340" lengthAdjust="spacingAndGlyphs"');
    }
    function artCrime() {
        var t = swBg('#2b2e33');
        t += '<circle cx="272" cy="78" r="26" fill="none" stroke="#9a9a9a" stroke-width="8"/>';
        t += '<circle cx="300" cy="142" r="24" fill="none" stroke="#9a9a9a" stroke-width="7"/>';
        var ch = [[305,58],[317,66],[326,76],[332,88],[334,101],[332,114]], i;
        for (i = 0; i < ch.length; i++) t += '<circle cx="' + ch[i][0] + '" cy="' + ch[i][1] + '" r="5" fill="#8a8a8a"/>';
        t += '<path d="M 300 128 q 18 -2 20 14 q 2 14 -12 16" fill="none" stroke="#55595e" stroke-width="10"/>';
        t += swText(200, 172, 90, '#696d72', 'разбой', 'textLength="350" lengthAdjust="spacingAndGlyphs"');
        return t + swText(170, 218, 40, '#5f6367', 'и криминал');
    }
    function artKids() {
        var t = swBg('#b5772f'), i;
        t += '<circle cx="128" cy="72" r="34" fill="#f7f7f7" stroke="#000" stroke-width="3"/>';
        t += '<circle cx="212" cy="74" r="34" fill="#f7f7f7" stroke="#000" stroke-width="3"/>';
        t += '<circle cx="130" cy="86" r="7" fill="#000"/><circle cx="214" cy="88" r="7" fill="#000"/>';
        t += '<rect x="160" y="104" width="22" height="4" fill="#333"/>';
        t += '<text x="170" y="146" text-anchor="middle" font-size="26" font-weight="800" fill="#0c0c0c" font-family="' + SW_FONT + '">ПОДХОДИТ ДЛЯ</text>';
        t += swText(200, 216, 96, '#0c0c0c', 'детей', 'textLength="300" lengthAdjust="spacingAndGlyphs"');
        var L = [[96,226],[88,240],[82,254],[78,266]], R = [[286,220],[292,238],[296,254],[298,266]];
        for (i = 0; i < L.length; i++) t += '<circle cx="' + L[i][0] + '" cy="' + L[i][1] + '" r="2.5" fill="#9a9a9a"/>';
        for (i = 0; i < R.length; i++) t += '<circle cx="' + R[i][0] + '" cy="' + R[i][1] + '" r="2.5" fill="#9a9a9a"/>';
        return t;
    }

    // ======================================================================
    // ФИКС v71: у трассированных SVG вырезаем белый холст (первый прямоугольник
    // во всю страницу) и кадрируем viewBox по рисунку, чтобы арт заполнял
    // карточку без белых полей и серых рамок. «Разбой» (2-й SVG) встаёт на
    // карточку криминала, «достояние» возвращаем рисованное.
    // ======================================================================
    function swClean(s, vb) {
        s = s.replace('M 0,0 c 279.33,0 558.67,0 838,0 c 0,281.67 0,563.33 0,845 c -279.33,0 -558.67,0 -838,0 c 0,-281.67 0,-563.33 0,-845 Z ', '');
        if (vb) s = s.replace('viewBox="0 0 838 845"', 'viewBox="' + vb + '"');
        return s;
    }
    (function () {
        var tracedHumor = artHumor, tracedRazboy = artHeritage, tracedSex = artSex;
        artHumor = function(){ return swClean(tracedHumor(), '135 240 522 384'); };
        artSex   = function(){ return swClean(tracedSex(),   '133 238 470 384'); };
        artCrime = function(){ return swClean(tracedRazboy(),'130 268 615 412'); };
        artHeritage = function(){
            var t = swBg('#20242b');
            t += '<g transform="translate(118,108) rotate(-9)">';
            t += '<rect x="-56" y="-70" width="112" height="140" fill="#8a4a20"/>';
            t += '<rect x="-45" y="-59" width="90" height="118" fill="#7a1626"/>';
            t += '<ellipse cx="0" cy="-24" rx="20" ry="22" fill="#6b4a2a"/>';
            t += '<rect x="-20" y="-24" width="8" height="34" fill="#6b4a2a"/><rect x="12" y="-24" width="8" height="34" fill="#6b4a2a"/>';
            t += '<circle cx="0" cy="-22" r="14" fill="#f2d3a7"/>';
            t += '<circle cx="-5" cy="-24" r="2.2" fill="#000"/><circle cx="5" cy="-24" r="2.2" fill="#000"/>';
            t += '<path d="M -22 44 Q -20 4 0 2 Q 20 4 22 44 Z" fill="#2e7d4f"/>';
            t += '</g>';
            t += '<g transform="translate(238,116) rotate(6)"><rect x="-46" y="-56" width="92" height="112" fill="#4a3a14"/><rect x="-37" y="-47" width="74" height="94" fill="#070707"/></g>';
            t += swSmall(298, 118, 26, '#a9a9a9', 'достояние');
            return t + swText(200, 190, 88, '#8f8f8f', 'жанра');
        };
    })();

    var CARD_SLOTS = 6;
    var SW_CUSTOM_CARDS = [
        { id: 'war',      re: /война/i,                                      art: artWar },
        { id: 'humor',    re: /развеселит|комедия|чёрный юмор|черный юмор/i, art: artHumor },
        { id: 'heritage', re: /культурное наследие/i,                        art: artHeritage },
        { id: 'fear',     re: /страшно/i,                                    art: artFear },
        { id: 'drugs',    re: /наркотик/i,                                   art: artDrugs },
        { id: 'real',     re: /реальных событи/i,                            art: artReal },
        { id: 'sex',      re: /откровенные сцен/i,                           art: artSex },
        { id: 'crime',    re: /криминальная тематик/i,                       art: artCrime },
        { id: 'kids',     re: /детский|семейный/i,                           art: artKids }
    ];

    function pickCards(result) {
        var cards = [], used = {};
        var F = (result.factors || []).slice().sort(function(a, b){ return b.w - a.w; });
        F.forEach(function(f){
            if (cards.length >= CARD_SLOTS) return;
            for (var i = 0; i < SW_CUSTOM_CARDS.length; i++) {
                var c = SW_CUSTOM_CARDS[i];
                if (c.re.test(f.text) && !used[c.id]) {
                    used[c.id] = 1;
                    cards.push({ id: c.id, svg: c.art(), title: f.text });
                    break;
                }
            }
        });
        return cards;
    }

    function renderCards(el, movie) {
        try {
            if (!el || !el.length || el.find('.sw-cards-row').length) return;
            var row = $('<div class="sw-cards-row"></div>');
            var anchor = el.find('.full-start__buttons,.full-start-new__buttons,.full-card__buttons').last();
            var box = anchor.length ? anchor.closest('.full-start,.full-start-new') : null;
            if (box && box.length) box.after(row);
            else if (anchor.length) anchor.after(row);
            else el.append(row);

            analyze(movie).then(function(result) {
                var cards = pickCards(result);
                if (!cards.length) { row.remove(); return; }
                cards.forEach(function(c){
                    var html = (c.svg && c.svg.indexOf('<svg') === 0) ? c.svg : svgWrap(c.svg);
                    row.append($('<div class="sw-card"></div>').attr('title', c.title).html(html));
                });
                row.attr('data-sw-ready', '1');
                row.get(0).swResult = result;
                row.get(0).swCards = cards;
                try { document.dispatchEvent(new CustomEvent('sw:analysis-ready', { detail: { movie: movie, result: result, row: row.get(0), cards: cards } })); } catch(e) {}
                if (typeof window.SW_renderCards === 'function') {
                    try { window.SW_renderCards(row.get(0), result, movie, cards); } catch(e) { console.error('[SW] SW_renderCards:', e); }
                }
            }).catch(function(err){ console.error('[SW] analyze:', err); row.remove(); });
        } catch(e) { console.error('[SW] renderCards:', e); }
    }

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
        console.log('[ShouldWatch] v71.0-clean (без белых полей и серых рамок, отступ от краёв)');
    }

    try { if (window.appready) startPlugin(); else Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') startPlugin(); }); } catch(e) {}
})();
