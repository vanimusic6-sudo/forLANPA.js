(function () {
    'use strict';
    if (window.should_watch_plugin_enhanced) return;
    window.should_watch_plugin_enhanced = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var ICON = '<svg viewBox="0 0 24 24" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>';
    var DISPLAY = '"Trebuchet MS","Segoe UI",system-ui,sans-serif';
    var GENRE_ID_ANIM = 16, GENRE_ID_FAMILY = 10751, GENRE_ID_KIDS = 10762;

    // Кэши
    var _metaCache = {};
    var _domCache = null;

    // Предварительно скомпилированные регулярки
    var INTERESTING_TAGS = [
        { re: /based on novel|основан на романе|экранизац/i, text: '✨ Экранизация книги' },
        { re: /based on true story|основан на реальных событиях|true story/i, text: '✨ На реальных событиях' },
        { re: /based on comic|comic book|графическ роман/i, text: '✨ По мотивам комикса' },
        { re: /oscar winner|academy award|лауреат оскар/i, text: '🏆 Лауреат премии Оскар' },
        { re: /cannes|venice|berlin|film festival winner/i, text: '🎬 Призёр кинофестиваля' },
        { re: /cult film|культов/i, text: '🎭 Культовый фильм' },
        { re: /time travel|путешестви[яе] во времени/i, text: '⏳ Путешествия во времени' },
        { re: /heist|ограблен/i, text: '💼 История ограбления' },
        { re: /post[- ]?apocalyptic|постапокалипсис/i, text: '☣️ Постапокалипсис' },
        { re: /dystopia|антиутопи/i, text: '🏙 Антиутопия' },
        { re: /coming of age|взрослен/i, text: '🌱 История взросления' },
        { re: /cyberpunk|киберпанк/i, text: '🤖 Киберпанк' },
        { re: /space|космос|moon|lunar|mars|марс/i, text: '🚀 Космос' },
        { re: /artificial intelligence|ai|искусственн интеллект/i, text: '🤖 Искусственный интеллект' },
        { re: /biographical|biopic|биограф/i, text: '📖 Биографическая история' }
    ];

    // Настройки
    function getSetting(k, d) { 
        try { 
            var v = Lampa.Storage.get(PLUGIN_ID + '_' + k); 
            if (v !== undefined && v !== null && v !== '') return v; 
        } catch(e) {} 
        return d; 
    }

    function getSettings() {
        return {
            bad_genres: String(getSetting('bad_genres', '') || ''),
            bad_actors: String(getSetting('bad_actors', '') || ''),
            bad_directors: String(getSetting('bad_directors', '') || ''),
            min_rating: parseFloat(getSetting('min_rating', '6')) || 6
        };
    }

    function parseBL(s) { 
        return s ? s.split(',').map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean) : []; 
    }

    function initSettings() {
        try {
            if (!window.Lampa || !Lampa.SettingsApi || window.sw_settings_ready) return;
            window.sw_settings_ready = true;
            Lampa.SettingsApi.addComponent({ component: PLUGIN_ID, name: 'Стоит ли смотреть?', icon: ICON });
            [
                { name: 'bad_genres', type: 'input', title: 'Нелюбимые жанры', description: 'Через запятую', default: '' },
                { name: 'bad_actors', type: 'input', title: 'Нелюбимые актёры', description: 'Через запятую', default: '' },
                { name: 'bad_directors', type: 'input', title: 'Нелюбимые авторы', description: 'Через запятую', default: '' },
                { name: 'min_rating', type: 'select', title: 'Минимальный рейтинг', values: {'0':'Любой','5':'5.0','6':'6.0','7':'7.0','8':'8.0'}, default: '6' }
            ].forEach(function(p) {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: { name: PLUGIN_ID + '_' + p.name, type: p.type, values: p.values || '', default: p.default },
                    field: { name: p.title, description: p.description }
                });
            });
        } catch(e) { console.error('[SW] initSettings:', e); }
    }

    // Стили
    function injectCSS() {
        if (document.getElementById('sw-plugin-styles-enhanced')) return;
        var s = document.createElement('style'); 
        s.id = 'sw-plugin-styles-enhanced';
        s.innerHTML =
            '.sw-inline-tags{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px}' +
            '.sw-badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:12px;font-size:.75em;font-weight:600;letter-spacing:.03em}' +
            '.sw-badge--pro{background:rgba(126,194,96,.15);color:#7ec260;border:1px solid rgba(126,194,96,.3)}' +
            '.sw-badge--con{background:rgba(224,91,86,.15);color:#e05b56;border:1px solid rgba(224,91,86,.3)}' +
            '.sw-badge--neutral{background:rgba(255,255,255,.08);color:#9aa1a6;border:1px solid rgba(255,255,255,.15)}' +
            '.sw-detail-btn{margin-top:12px;padding:8px 16px;background:rgba(126,194,96,.15);color:#7ec260;border:1px solid rgba(126,194,96,.3);border-radius:12px;cursor:pointer;font-size:.85em;font-weight:600;transition:all .2s ease}' +
            '.sw-detail-btn:hover{background:rgba(126,194,96,.25);transform:translateY(-1px)}' +
            // Модалка
            '.sw-modal-content{padding:22px 26px 44px;color:#fff;font-family:' + DISPLAY + ';box-sizing:border-box;max-height:88vh;overflow-y:auto;overflow-x:hidden}' +
            '.sw-modal-content::-webkit-scrollbar{width:6px}.sw-modal-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22);border-radius:3px}' +
            '.sw-body{animation:swFadeIn .5s ease}' +
            '@keyframes swFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +
            '.sw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:70px 20px;min-height:50vh;color:#9aa1a6}' +
            '.sw-loader-emoji{font-size:3.4em;line-height:1;animation:swFloat 2.2s ease-in-out infinite}' +
            '@keyframes swFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}' +
            '.sw-loader-text{font-size:1.05em;font-weight:600;min-height:1.5em;transition:opacity .3s ease;text-align:center}' +
            '.sw-loader-progress{width:220px;height:4px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden;position:relative;margin-top:8px}' +
            '.sw-loader-progress::after{content:"";position:absolute;left:-100%;top:0;height:100%;width:100%;background:linear-gradient(90deg,transparent,#7ec260,transparent);animation:swSlide 1.6s linear infinite}' +
            '@keyframes swSlide{0%{left:-100%}100%{left:100%}}' +
            '.sw-dossier{position:relative;background:#2b2e31;border-radius:16px;padding:26px 28px;margin-bottom:18px;animation:swRise .6s cubic-bezier(.22,1,.36,1) both}' +
            '@keyframes swRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}' +
            '.sw-verdict-word{font-size:2.7em;font-weight:800;letter-spacing:.01em;line-height:1;margin:0 0 16px;text-transform:uppercase;opacity:0;transform:translateY(8px);transition:opacity .5s ease,transform .5s ease}' +
            '.sw-verdict-word.appear{opacity:1;transform:translateY(0)}' +
            '.sw-verdict-word.yes{color:#7ec260}.sw-verdict-word.no{color:#e05b56}.sw-verdict-word.maybe{color:#e0a93b}' +
            '.sw-meter{height:5px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden}' +
            '.sw-meter-fill{height:100%;width:0;border-radius:3px;transition:width 1s cubic-bezier(.25,.8,.3,1)}' +
            '.sw-meter-fill.yes{background:#7ec260}.sw-meter-fill.no{background:#e05b56}.sw-meter-fill.maybe{background:#e0a93b}' +
            '.sw-dicebtn{position:relative;display:block;width:100%;height:104px;background:#f2f3f5;border:none;border-radius:16px;margin:0 0 20px;overflow:hidden;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent}' +
            '.sw-label-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 108px;overflow:hidden}' +
            '.sw-label{font-family:' + DISPLAY + ';font-size:2.2em;font-weight:800;color:#878c91;letter-spacing:.01em;text-align:center;white-space:nowrap;opacity:1;transition:opacity .3s ease}' +
            '.sw-label.hidden{opacity:0}' +
            '.sw-label.res-yes{color:#3f8f2f}.sw-label.res-no{color:#c9443f}' +
            '.sw-dice{position:absolute;left:16px;top:50%;width:74px;height:74px;margin-top:-37px;will-change:transform}' +
            '.sw-dice svg{width:100%;height:100%;display:block;transform:rotate(-8deg)}' +
            '.sw-dice.sw-rolling{animation:swRoll 1.1s cubic-bezier(.25,.46,.45,.94) forwards}' +
            '@keyframes swRoll{0%{transform:translateX(0) rotate(0) translateY(0)}15%{transform:translateX(calc(var(--sw-dist) * .15)) rotate(108deg) translateY(-12px)}35%{transform:translateX(calc(var(--sw-dist) * .35)) rotate(252deg) translateY(0)}55%{transform:translateX(calc(var(--sw-dist) * .55)) rotate(396deg) translateY(-8px)}75%{transform:translateX(calc(var(--sw-dist) * .75)) rotate(540deg) translateY(0)}90%{transform:translateX(calc(var(--sw-dist) * .92)) rotate(648deg) translateY(-4px)}100%{transform:translateX(var(--sw-dist)) rotate(720deg) translateY(0)}}' +
            '.sw-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}' +
            '.sw-col{position:relative;background:#2b2e31;border-radius:14px;padding:22px 24px}' +
            '.sw-col::before{content:"";position:absolute;top:0;left:24px;right:24px;height:2px;border-radius:2px}' +
            '.sw-col.pros::before{background:#7ec260}.sw-col.cons::before{background:#e05b56}' +
            '.sw-title{font-size:.85em;font-weight:800;margin-bottom:14px;text-transform:uppercase;letter-spacing:.05em}' +
            '.sw-title.pros{color:#7ec260}.sw-title.cons{color:#e05b56}' +
            '.sw-list{margin:0;padding-left:20px;font-size:.96em;line-height:1.6;color:#c6ccd0}' +
            '.sw-list li{margin-bottom:9px;opacity:0;transform:translateX(-8px);transition:opacity .45s ease,transform .45s ease}' +
            '.sw-list li.appear{opacity:1;transform:translateX(0)}';
        document.head.appendChild(s);
    }

    // Утилиты
    function esc(s) { 
        if (typeof s !== 'string') return ''; 
        return s.replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); 
    }

    function hasGenre(g, re) { 
        return g.some(function(x){ return re.test((x || '').toLowerCase()); }); 
    }

    function mediaType(m) { 
        return (m && m.name && !m.title) ? 'tv' : 'movie'; 
    }

    function uniq(arr) { 
        return arr.filter(function(v,i,s){ return s.indexOf(v) === i; }); 
    }

    function fmtN(n) { 
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); 
    }

    // TMDB API
    function tmdbKey() { 
        try { if (Lampa.TMDB && Lampa.TMDB.key) return Lampa.TMDB.key; } catch(e) {} 
        return '4ef0d7355d9ffb5151e987764708ce96'; 
    }

    function curLangCode() { 
        try { var l = Lampa.Storage.get('language', 'ru') || 'ru'; return l + '-' + l.toUpperCase(); } catch(e) { return 'ru-RU'; } 
    }

    function tmdbGet(path, lang) {
        return new Promise(function(res){
            try {
                var langCode = lang || curLangCode();
                var url = 'https://api.themoviedb.org/3' + path + (path.indexOf('?') > -1 ? '&' : '?') + 'language=' + langCode + '&api_key=' + tmdbKey();
                if (Lampa.Request && typeof Lampa.Request.get === 'function') {
                    Lampa.Request.get(url, function(d){ res(d && d.status_code ? null : d); }, function(){ res(null); }, { dataType: 'json' });
                } else if (typeof fetch !== 'undefined') {
                    fetch(url).then(function(r){ return r.json(); }).then(function(d){ res(d && d.status_code ? null : d); }).catch(function(){ res(null); });
                } else res(null);
            } catch(e) { res(null); }
        });
    }

    function loadCredits(movie) {
        try {
            if (movie.credits && ((movie.credits.cast && movie.credits.cast.length) || (movie.credits.crew && movie.credits.crew.length))) return Promise.resolve(movie.credits);
            var id = movie.id || movie.tmdb_id; 
            if (!id) return Promise.resolve(null);
            if (Lampa.TMDB && typeof Lampa.TMDB.credits === 'function') {
                return new Promise(function(res){ 
                    Lampa.TMDB.credits(id, function(d){ res(d && !d.status_code ? d : null); }, function(){ res(null); }); 
                });
            }
        } catch(e) {}
        return Promise.resolve(null);
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

    // Анализ DOM
    function readDomSignals(key) {
        if (_domCache && _domCache.key === key) return _domCache.data;
        var out = { mm: {}, moods: [], ok: false, age: null, reviews: [] };
        try {
            var container = document.querySelector('.activity__body, .full-start__content') || document.body;
            var txt = container.innerText || '';
            var amAll = txt.match(/\b(0|6|12|16|18)\+/g);
            if (amAll) {
                for (var i = 0; i < amAll.length; i++) { 
                    var v3 = parseInt(amAll[i], 10); 
                    if (!isNaN(v3) && (out.age === null || v3 > out.age)) out.age = v3; 
                }
            }
            var mm = {}, found = 0;
            [['pace','Темп'],['fear','Страх'],['action','Экшен'],['violence','Насилие'],['sadness','Грусть'],['language','Лексика']].forEach(function(p){
                var r = txt.match(new RegExp(p[1] + '[\\s\\S]{0,60}?([\\d.,]+)\\s*/\\s*10'));
                if (r) { mm[p[0]] = parseFloat(r[1].replace(',', '.')); found++; }
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
            if (ci > -1) {
                var lines = txt.substring(ci + 11, ci + 6000).split(/\n+/);
                for (var i2 = 0; i2 < lines.length && out.reviews.length < 6; i2++) {
                    var ln = lines[i2].trim();
                    if (!ln) continue;
                    if (/^(Сезон|Режиссёр|Актёры|Производство|Теги|Настроения|Подробно)/.test(ln)) break;
                    if (ln.length >= 40) out.reviews.push({ author: 'зритель', text: ln });
                }
            }
        } catch(e) {}
        _domCache = { key: key, data: out };
        return out;
    }

    function hasKw(ctx, re) { 
        return ctx.kw.some(function(k){ return re.test(k); }); 
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

    // Быстрый анализ для inline-бейджей
    function quickAnalyze(movie, meta, dom) {
        var results = [];
        function add(type, label, category) {
            results.push({ type: type, label: label, category: category });
        }

        var rating = parseFloat(movie.vote_average) || 0;
        var votes = parseInt(movie.vote_count) || 0;
        var q = (movie.quality || '').toString().toUpperCase();
        var age = dom.age;

        // Рейтинг
        if (votes >= 3000 && rating >= 8.0) add('pro', '✨ Высокий рейтинг ' + rating.toFixed(1), 'rating');
        else if (votes >= 100 && rating < 5) add('con', '📉 Низкий рейтинг ' + rating.toFixed(1), 'rating');

        // Качество
        if (/CAM|TS|HDCAM|HDRIP|TELECINE|SCR|WORKPRINT|TELESYNC/i.test(q)) {
            add('con', '📺 Плохое качество', 'quality');
        } else if (/4K|UHD|2160p/i.test(q)) {
            add('pro', '🎥 4K', 'quality');
        }

        // Возраст
        if (age !== null && age >= 18) add('con', '🔞 18+', 'age');
        else if (age !== null && age <= 6) add('pro', '🧸 Детский', 'age');

        // Искры
        var sparks = findSparkle(meta, null);
        sparks.forEach(function(s){ add('neutral', s, 'sparkle'); });

        return results.slice(0, 5); // Максимум 5 бейджей
    }

    // Полный анализ для модалки
    function fullAnalyze(movie) {
        return Promise.all([loadCredits(movie), loadMeta(movie), Promise.resolve(readDomSignals(movie.id || movie.tmdb_id || 'x'))]).then(function(arr){
            var credits = arr[0], meta = arr[1], dom = arr[2];
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
            var mm, moods;
            if (dom.ok) { mm = dom.mm; moods = dom.moods; } else { mm = {}; moods = []; }
            var ctx = { kw: meta.kw };
            var M = 150, C = 6.1;
            var adj = votes > 0 ? ((votes * rating) + (M * C)) / (votes + M) : 0;
            var cast = (credits && credits.cast || []).slice(0, 15).map(function(c){ return c.name; }).filter(Boolean);
            var crew = credits && credits.crew || [];
            var dirs = crew.filter(function(c){ return c.job === 'Director'; }).map(function(c){ return c.name; }).filter(Boolean);
            var wrts = crew.filter(function(c){ return ['Writer','Screenplay','Story','Author'].indexOf(c.job) >= 0; }).map(function(c){ return c.name; }).filter(Boolean);
            var isAnim = genresRaw.some(function(g){ return g && (g.id === GENRE_ID_ANIM || /animation|анимац|мульт|anime|аниме/i.test(g.name || '')); });
            var hasFamilyGenre = genresRaw.some(function(g){ return g && (g.id === GENRE_ID_FAMILY || g.id === GENRE_ID_KIDS || /family|семейн|kids|детск/i.test(g.name || '')); });

            function dim(kwRe, ovRe) { 
                var k = hasKw(ctx, kwRe); 
                var o = !!ovRe && ovBoth.some(function(s){ return ovRe.test(s || ''); }); 
                return { k: k, o: o }; 
            }

            var dViol = dim(/violenc|violent|gore|murder|blood|tortur|brutal|weapon|massacre|execution|stab|slaughter|gunfight|shootout|hitman|serial killer|battle/, /убийств|насил|жесток|кровь|крови|кровью|кровав|кровопролит|стрельб|перестрел|взрыв|оружи|резн|террор|бойн/);
            var dDrugs = dim(/drug|meth|coke|cocaine|heroin|marijuan|cannabis|narcotic|addiction|overdose|dealer|cartel|crack|lsd|ecstasy|opium/, /метамфетам|амфетам|наркот|кокаин|героин|марихуан|лсд|экстази|опиум|дилер|картел|зависимост|зелье|травк|варит/);
            var dNud = dim(/nudity|topless|strip club|stripper|full frontal|rear nudity/, /обнаж|нагот|голы|стриптиз/);
            var dSex = dim(/sex scene|sexual content|orgy|prostitut|erotic|one night stand|hooker|threesome|explicit/, /эротик|откровен|проститут|интим|секс|постельн|презерватив/);
            var dProf = dim(/profanity|strong language|swearing|f word|vulgarity/, /нецензур|бран|руган|сквернослов|матерщин/);
            var dSuic = dim(/suicide|self harm|suicidal/, /суицид|самоубийств|покончи/);
            var dCrime = dim(/criminal|crime|heist|robbery|mafia|gangster|prison|police|detective|thief|outlaw|cartel|drug lord|dea agent/, /криминал|преступ|грабеж|ограб|мафи|банд|тюрьм|полици|следовател|мошенник|контрабанд|крад|похищ|вору/);
            var dIll = dim(/terminal illness|cancer|chemotherapy|leukemia|leukaemia|tumor|tumour|alzheimer|parkinson|aids|brain tumor|lung cancer|incurable/, /онколог|злокачествен|химиотерап|лейкеми|неизлечим|терминальн|альцгеймер|паркинсон|рак лёгких|рак мозга|опухол/);
            var dChild = dim(/child abuse|abused child|child neglect|cruelty to children|child cruelty|abusive parent|child violence|pedophile|pedophilia/, /насилие над детьми|жестокое обращение с детьми|издевается над детьми|избивает детей|абьюз детей|педофил/);

            var gHorror = hasGenre(genres, /horror|ужас|slasher/i);
            var gWar = hasGenre(genres, /war|военн/i);
            var gCrime = hasGenre(genres, /crime|криминал/i);
            var gThr = hasGenre(genres, /thriller|триллер/i);
            var age = dom.age;

            var cViol = (dViol.k?50:0)+(dViol.o?30:0)+((mm.violence||0)>=6?40:((mm.violence||0)>=4?20:0))+(gHorror||gWar?20:(gCrime&&gThr?15:0))+(age!==null&&age>=18?15:(age!==null&&age>=16?10:0));
            var cDrugs = (dDrugs.k?50:0)+(dDrugs.o?30:0)+(gCrime?10:0)+(age!==null&&age>=16?10:0);
            var cSex = (dSex.k?50:0)+(dNud.k?40:0)+(dSex.o?30:0)+(dNud.o?30:0)+(age!==null&&age>=18?15:0);
            var cProf = (dProf.k?50:0)+(dProf.o?30:0)+((mm.language||0)>=5?40:((mm.language||0)>=3?20:0))+(age!==null&&age>=18?10:0);
            var cFear = (gHorror?50:0)+(hasKw(ctx,/horror|scary|haunted|possess|demon|jump scare|ghost/)?30:0)+((mm.fear||0)>=6?40:((mm.fear||0)>=4?20:0))+(gThr?10:0);
            var cSuic = (dSuic.k?50:0)+(dSuic.o?30:0)+(dIll.k?10:0);
            var cCrime = (dCrime.k?35:0)+(dCrime.o?25:0)+(gCrime?35:0)+(age!==null&&age>=16?15:0);
            var cChild = (dChild.k?60:0)+(dChild.o?40:0);

            var hardAdult = cViol >= 50 || cDrugs >= 30 || cSex >= 30 || cChild >= 50 || !!movie.adult;
            var familyOK;
            if (isAnim) {
                if (age !== null && age <= 6) familyOK = !hardAdult;
                else if (age <= 12) familyOK = !hardAdult && cSuic < 40 && cFear < 40 && cViol < 30;
                else if (age >= 16) familyOK = false;
                else familyOK = !hardAdult && cSuic < 40 && cProf < 40 && hasFamilyGenre;
            } else {
                familyOK = !hardAdult && cFear < 40 && cSuic < 40 && rating >= 5 && ((age !== null && age <= 12) || hasFamilyGenre);
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
            if (runtime > 0 && runtime <= 95) add('card','pro','⏱ Короткометражка: ' + runtime + ' мин', 7, 'runtime');
            else if (runtime > 150) add('card','con','⌛ Длинный фильм: ' + runtime + ' мин', 12, 'runtime');
            if (/CAM|TS|HDCAM|HDRIP|TELECINE|SCR|WORKPRINT|TELESYNC/i.test(q)) add('card','con','📺 Плохое качество', 26, 'quality');
            else if (/4K|UHD|2160p/i.test(q)) add('card','pro','🎥 4K', 10, 'quality');
            else if (q) add('card','pro','🎥 Высокое качество', 7, 'quality');

            if (mG.length) add('user','con','⛔ Нелюбимые жанры: ' + mG.join(', '), 40);
            if (mA.length) add('user','con','⛔ Нелюбимые актёры: ' + uniq(mA).slice(0,2).join(', '), 35);
            if (mD.length) add('user','con','⛔ Нелюбимые авторы: ' + uniq(mD).slice(0,2).join(', '), 35);

            if (familyOK && isAnim) add('tmdb','pro','🧸 Детский' + (age !== null ? ' (' + age + '+)' : ''), 16, 'family');
            else if (familyOK) add('tmdb','pro','👨‍👩‍👧‍👦 Семейный' + (age !== null ? ' (' + age + '+)' : ''), 16, 'family');
            if (age !== null && age >= 18) add('tmdb','con','🔞 Для взрослых (18+)', 14, 'age');
            else if (age !== null && age >= 16) add('tmdb','con','🔞 Ограничение 16+', 12, 'age');
            if (isAnim && !familyOK) add('tmdb','con','🎭 Взрослая анимация' + (age !== null ? ' (' + age + '+)' : ''), 14, 'adultanim');

            if (cViol >= 50) add('tmdb','con','🔪 Сцены насилия', 16, 'violence');
            if (cDrugs >= 30) add('tmdb','con','💉 Упоминание наркотиков', 14, 'drugs');
            if (cSex >= 30) add('tmdb','con','🫣 Сцены секса и обнажёнки', 12, 'sex');
            if (cProf >= 40) add('tmdb','con','🤬 Нецензурная лексика', 10, 'lang');
            if (cFear >= 40) add('moods','con','😱 Страшно', 14, 'scare');
            if (cSuic >= 40) add('tmdb','con','⚠️ Тема суицида', 16, 'suic');
            if (cCrime >= 50) add('tmdb','con','⚖️ Криминальная тематика', 8, 'crime');
            if (cChild >= 50) add('tmdb','con','🚸 Насилие над детьми', 18, 'childabuse');
            if (meta.hasTrailer) add('tmdb','pro','▶ Есть трейлер', 5);

            moods.forEach(function(md){
                var n = (md.name || '').toLowerCase();
                if (/вес[её]л|комедий|юмор/.test(n) && md.pct >= 20) add('moods','pro','😂 Развеселит', 14, 'fun');
                else if (/напряжен/.test(n) && md.pct >= 30) add('moods','pro','🔥 Напряжённый', 8, 'tension');
                else if (/груст/.test(n) && md.pct >= 20) add('moods','con','😔 Не для ранимых', 6, 'sad');
            });

            var CAPS = { card: 55, user: 50, tmdb: 45, moods: 40, sparkle: 50 };
            var per = {};
            F.forEach(function(f){ var s = per[f.src] || (per[f.src] = { pro: 0, con: 0 }); s[f.kind] += f.w; });
            var score = 0;
            Object.keys(per).forEach(function(k){
                var cap = CAPS[k] || 40;
                score += Math.min(per[k].pro, cap) - Math.min(per[k].con, cap);
            });
            if (score > 100) score = 100; if (score < -100) score = -100;
            var norm = Math.round((score + 100) / 2);
            var vClass = score >= 22 ? 'yes' : (score <= -22 ? 'no' : 'maybe');
            var vWord = score >= 22 ? 'СТОИТ' : (score <= -22 ? 'НЕ СТОИТ' : 'СПОРНО');
            var sortF = function(a,b){ return b.w - a.w; };
            var pros = F.filter(function(f){ return f.kind === 'pro'; }).sort(sortF).map(function(f){ return f.text; });
            var cons = F.filter(function(f){ return f.kind === 'con'; }).sort(sortF).map(function(f){ return f.text; });
            if (!pros.length) pros.push('ℹ️ Нет данных');
            if (!cons.length) cons.push((blG.length || blA.length || blD.length) ? '✅ Фильтры чисты' : '✅ Минусов нет');
            return { pros: pros, cons: cons, score: score, norm: norm, vClass: vClass, vWord: vWord, metaRich: !!(meta.kw.length || meta.reviews.length) };
        });
    }

    // Рендер inline-бейджей
    function renderInlineBadges(el, movie) {
        try {
            if (!el || !el.length || el.find('.sw-inline-tags').length) return;
            
            var key = movie.id + '_' + (movie.media_type || 'movie');
            var dom = readDomSignals(key);
            
            Promise.all([loadCredits(movie), loadMeta(movie)]).then(function(arr){
                var credits = arr[0], meta = arr[1];
                var tags = quickAnalyze(movie, meta, dom);
                
                if (!tags.length) return;
                
                var html = '<div class="sw-inline-tags">';
                tags.forEach(function(t) {
                    html += '<span class="sw-badge sw-badge--' + t.type + '">' + esc(t.label) + '</span>';
                });
                html += '</div>';
                html += '<button class="sw-detail-btn" onclick="window._sw_showModal && window._sw_showModal(' + movie.id + ')">📊 Подробный анализ</button>';
                
                var renderArea = el.find('.full-start__tags, .full-descr');
                if (renderArea.length) {
                    renderArea.append(html);
                } else {
                    el.append(html);
                }
            });
        } catch(e) { console.error('[SW] renderInlineBadges:', e); }
    }

    // Модалка (опционально)
    window._sw_rolling = false;
    window._sw_currentModalHtml = null;
    window._sw_loaderTimer = null;

    window._sw_showModal = function(movieId) {
        try {
            var movie = null;
            // Ищем фильм в текущей активности
            var activity = Lampa.Activity && Lampa.Activity.active && Lampa.Activity.active();
            if (activity && activity.data && activity.data.movie && activity.data.movie.id === movieId) {
                movie = activity.data.movie;
            }
            if (!movie) return;

            var title = esc(movie.title || movie.name || 'Фильм');
            var phases = [
                { emoji: '🔍', text: 'Анализирую…' },
                { emoji: '📊', text: 'TMDB…' },
                { emoji: '🎭', text: 'Настроения…' },
                { emoji: '💬', text: 'Комментарии…' },
                { emoji: '⚖️', text: 'Взвешиваю…' }
            ];
            var html = $('<div class="sw-modal-content"><div id="sw-body"><div class="sw-loader"><div class="sw-loader-emoji" id="sw-loader-emoji">' + phases[0].emoji + '</div><div class="sw-loader-text" id="sw-loader-text">' + phases[0].text + '</div><div class="sw-loader-progress"></div></div></div></div>');
            window._sw_currentModalHtml = html;

            var pi = 0;
            window._sw_loaderTimer = setInterval(function(){
                pi = (pi + 1) % phases.length;
                var t = html.find('#sw-loader-text'), e = html.find('#sw-loader-emoji');
                if (t.length) { t.css('opacity', 0); setTimeout(function(){ t.text(phases[pi].text).css('opacity', 1); }, 220); }
                if (e.length) setTimeout(function(){ e.text(phases[pi].emoji); }, 150);
            }, 750);

            Lampa.Modal.open({
                title: 'Стоит ли смотреть: ' + title, html: html, size: 'large',
                onBack: function() {
                    if (window._sw_loaderTimer) { clearInterval(window._sw_loaderTimer); window._sw_loaderTimer = null; }
                    window._sw_currentModalHtml = null;
                }
            });

            fullAnalyze(movie).then(function(a){
                if (window._sw_loaderTimer) { clearInterval(window._sw_loaderTimer); window._sw_loaderTimer = null; }
                
                var badges = '<div style="position:absolute;top:18px;right:18px"><span style="display:inline-flex;align-items:center;gap:6px;font-size:.68em;padding:4px 12px;border-radius:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:rgba(255,255,255,.07);color:#9aa1a6"><span style="width:5px;height:5px;border-radius:50%;display:inline-block;background:' + (a.metaRich ? '#7ec260' : '#7d8388') + '"></span>TMDB</span></div>';
                
                var inner = '<div class="sw-dossier">' + badges +
                    '<div class="sw-verdict-word ' + a.vClass + '" id="sw-vword">' + esc(a.vWord) + '</div>' +
                    '<div class="sw-meter"><div class="sw-meter-fill ' + a.vClass + '" data-w="' + a.norm + '"></div></div>' +
                    '</div>' +
                    '<div class="sw-columns">' +
                    '<div class="sw-col pros"><div class="sw-title pros">✓ Аргументы за</div><ul class="sw-list">' + a.pros.map(function(p){ return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
                    '<div class="sw-col cons"><div class="sw-title cons">✗ Аргументы против</div><ul class="sw-list">' + a.cons.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' +
                    '</div>';
                
                html.find('#sw-body').html('<div class="sw-body">' + inner + '</div>');
                
                setTimeout(function(){
                    html.find('#sw-vword').addClass('appear');
                    html.find('.sw-meter-fill').each(function(){ this.style.width = (this.getAttribute('data-w') || 50) + '%'; });
                    html.find('.sw-list li').each(function(i){ var li = $(this); setTimeout(function(){ li.addClass('appear'); }, i * 45); });
                }, 100);
            }).catch(function(err){
                if (window._sw_loaderTimer) { clearInterval(window._sw_loaderTimer); window._sw_loaderTimer = null; }
                console.error('[SW] analyze:', err);
                html.find('#sw-body').html('<div class="sw-body" style="text-align:center;padding:48px 20px;color:#e05b56">Ошибка анализа</div>');
            });
        } catch(e) { console.error('[SW] showModal:', e); }
    };

    // Инициализация
    function init() {
        injectCSS();
        initSettings();
        
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                try {
                    var renderEl = null;
                    if (e.object && typeof e.object.render === 'function') {
                        renderEl = e.object.render();
                    } else if (e.object && e.object.activity && typeof e.object.activity.render === 'function') {
                        renderEl = e.object.activity.render();
                    }
                    if (renderEl && e.data && e.data.movie) {
                        setTimeout(function(){ renderInlineBadges(renderEl, e.data.movie); }, 50);
                    }
                } catch(err) { console.error('[SW]', err); }
            }
        });
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
