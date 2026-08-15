(function () {
    'use strict';
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var ICON = '<svg viewBox="0 0 100 100" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><g stroke="currentColor" stroke-width="8" stroke-linecap="square" fill="none"><path d="M20,55 L40,75 L80,25"/><path d="M25,25 L75,75" stroke-dasharray="4,4"/></g></svg>';
    var DISPLAY = '"Trebuchet MS","Segoe UI",system-ui,sans-serif';

    var GENRE_ID_ANIM = 16, GENRE_ID_FAMILY = 10751, GENRE_ID_KIDS = 10762;

    /* Байесовская поправка рейтинга: мало голосов -> рейтинг тянется к среднему */
    var BAYES_M = 150, BAYES_C = 6.1;
    /* Потолки вклада источников, чтобы ни один не доминировал */
    var SRC_CAPS = { card: 55, user: 50, tmdb: 40, reviews: 28, lampa: 18 };
    var SRC_LABEL = { card: 'карточка', user: 'ваши фильтры', tmdb: 'TMDB', reviews: 'отзывы', lampa: 'Lampa' };

    window._sw_rolling = false;
    window._sw_currentModalHtml = null;
    window._sw_prevController = null;
    window._sw_closingFromController = false;
    window._sw_loaderTimer = null;
    window._sw_blocknav = false;
    window._sw_activeInteractive = null;
    window._sw_keyBound = false;
    var _metaCache = {};

    /* ===== НАСТРОЙКИ ===== */
    function getSetting(k, d) { try { var v = Lampa.Storage.get(PLUGIN_ID + '_' + k); if (v !== undefined && v !== null && v !== '') return v; } catch(e) {} return d; }
    function getSettings() {
        return {
            bad_genres: String(getSetting('bad_genres', '') || ''),
            bad_actors: String(getSetting('bad_actors', '') || ''),
            bad_directors: String(getSetting('bad_directors', '') || ''),
            min_rating: parseFloat(getSetting('min_rating', '6')) || 6
        };
    }
    function parseBL(s) { return s ? s.split(',').map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean) : []; }
    function initSettings() {
        try {
            if (!window.Lampa || !Lampa.SettingsApi || window.sw_settings_ready) return;
            window.sw_settings_ready = true;
            Lampa.SettingsApi.addComponent({ component: PLUGIN_ID, name: 'Стоит ли смотреть?', icon: ICON });
            [
                { name: 'bad_genres', type: 'input', title: 'Нелюбимые жанры', description: 'Через запятую', default: '' },
                { name: 'bad_actors', type: 'input', title: 'Нелюбимые актёры', description: 'Через запятую', default: '' },
                { name: 'bad_directors', type: 'input', title: 'Нелюбимые авторы', description: 'Через запятую', default: '' },
                { name: 'min_rating', type: 'select', title: 'Мин. рейтинг', values: {'0':'Любой','5':'5.0','6':'6.0','7':'7.0','8':'8.0'}, default: '6' }
            ].forEach(function(p) {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: { name: PLUGIN_ID + '_' + p.name, type: p.type, values: p.values || '', default: p.default },
                    field: { name: p.title, description: p.description }
                });
            });
        } catch(e) { console.error('[SW] initSettings:', e); }
    }

    /* ===== СТИЛИ (новый дизайн) ===== */
    function injectCSS() {
        try {
            if (document.getElementById('sw-plugin-styles-v14')) return;
            var s = document.createElement('style'); s.id = 'sw-plugin-styles-v14';
            s.innerHTML =
                '.sw-modal-content{padding:20px 24px 40px;color:#fff;font-family:' + DISPLAY + ';box-sizing:border-box;max-height:88vh;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-y}' +
                '.sw-modal-content::-webkit-scrollbar{width:6px}.sw-modal-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22);border-radius:3px}' +
                '.sw-body{animation:swFadeIn .45s cubic-bezier(.25,.8,.25,1)}' +
                '@keyframes swFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +

                /* загрузчик */
                '.sw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:70px 20px;min-height:50vh;color:#9aa0a4}' +
                '.sw-loader-emoji{font-size:3.4em;line-height:1;animation:swFloat 2.4s ease-in-out infinite}' +
                '@keyframes swFloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-8px) rotate(3deg)}}' +
                '.sw-loader-text{font-size:1.05em;font-weight:600;min-height:1.5em;transition:opacity .3s ease;color:#8b9195;text-align:center}' +
                '.sw-loader-progress{width:220px;height:4px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden;position:relative;margin-top:8px}' +
                '.sw-loader-progress::after{content:"";position:absolute;left:-100%;top:0;height:100%;width:100%;background:linear-gradient(90deg,transparent,#7ec260,transparent);animation:swSlide 1.8s linear infinite}' +
                '@keyframes swSlide{0%{left:-100%}100%{left:100%}}' +

                /* карточка вердикта */
                '.sw2-dossier{position:relative;background:#2b2e30;border-radius:16px;padding:24px 26px 22px;margin-bottom:16px;animation:swRise .5s cubic-bezier(.22,1,.36,1) both}' +
                '@keyframes swRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}' +
                '.sw2-badge{position:absolute;top:18px;right:18px;display:inline-flex;align-items:center;gap:6px;font-size:.68em;padding:4px 12px;border-radius:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:#3a3d40;color:#9aa0a4}' +
                '.sw2-badge .sw2-dot{width:5px;height:5px;border-radius:50%;background:#7d8488;display:inline-block}' +
                '.sw2-badge.tmdb .sw2-dot{background:#7ec260;box-shadow:0 0 8px rgba(126,194,96,.6)}' +
                '.sw2-verdict{font-size:2.7em;font-weight:800;letter-spacing:.01em;line-height:1;margin:0 0 10px;text-transform:uppercase;opacity:0;transform:scale(.92);transition:opacity .5s ease,transform .55s cubic-bezier(.34,1.56,.64,1)}' +
                '.sw2-verdict.appear{opacity:1;transform:scale(1)}' +
                '.sw2-verdict.yes{color:#7ec260}.sw2-verdict.no{color:#e05b56}.sw2-verdict.maybe{color:#e0a93b}' +
                '.sw2-reason{font-size:1em;color:#b9c0c4;line-height:1.65;margin:0 0 18px;max-width:70ch;opacity:0;transform:translateY(6px);transition:opacity .45s ease .1s,transform .45s ease .1s}' +
                '.sw2-reason.appear{opacity:1;transform:translateY(0)}' +
                '.sw2-meter{height:5px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden}' +
                '.sw2-meter-fill{height:100%;width:0;border-radius:3px;transition:width 1s cubic-bezier(.3,.8,.3,1)}' +
                '.sw2-meter-fill.yes{background:#7ec260}.sw2-meter-fill.no{background:#d84b46}.sw2-meter-fill.maybe{background:#e0a93b}' +

                /* кнопка с кубиком */
                '.sw2-dicebtn{position:relative;background:#f6f7f8;border-radius:16px;height:112px;margin-bottom:16px;display:flex;align-items:center;overflow:hidden;cursor:pointer;outline:none;border:none}' +
                '.sw2-dicebtn.focus{box-shadow:0 0 0 4px rgba(126,194,96,.7)}' +
                '.sw2-dice{position:absolute;left:14px;top:50%;margin-top:-44px;width:88px;height:88px;pointer-events:none}' +
                '.sw2-dice svg{width:100%;height:100%;display:block;transform:rotate(-10deg)}' +
                '.sw2-dice.rolling{animation:sw2Roll 1.15s cubic-bezier(.35,.6,.3,1) forwards}' +
                '@keyframes sw2Roll{0%{left:14px;transform:rotate(0deg) translateY(0)}25%{transform:rotate(180deg) translateY(-12px)}50%{transform:rotate(360deg) translateY(0)}75%{transform:rotate(540deg) translateY(-8px)}100%{left:86%;transform:rotate(720deg) translateY(0)}}' +
                '.sw2-dice-label{flex:1;text-align:center;font-family:' + DISPLAY + ';font-size:2.7em;font-weight:800;color:#8b9095;letter-spacing:.01em;white-space:nowrap;padding:0 90px;overflow:hidden}' +
                '.sw2-dice-label.res-yes{color:#4f9a33}.sw2-dice-label.res-no{color:#cf4a45}' +

                /* колонки */
                '.sw2-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}' +
                '.sw2-col{position:relative;background:#2b2e30;border-radius:14px;padding:22px 22px 16px}' +
                '.sw2-col::before{content:"";position:absolute;top:0;left:22px;right:22px;height:2px;border-radius:2px}' +
                '.sw2-col.pros::before{background:#7ec260}.sw2-col.cons::before{background:#d84b46}' +
                '.sw2-title{font-size:.85em;font-weight:800;margin-bottom:14px;text-transform:uppercase;letter-spacing:.05em}' +
                '.sw2-title.pros{color:#7ec260}.sw2-title.cons{color:#e05b56}' +
                '.sw2-list{margin:0;padding-left:18px;font-size:.95em;line-height:1.55;color:#c3c9cc}' +
                '.sw2-list li{margin-bottom:9px;opacity:0;transform:translateX(-8px);transition:opacity .4s ease,transform .4s cubic-bezier(.25,.8,.25,1)}' +
                '.sw2-list li.appear{opacity:1;transform:translateX(0)}' +
                '.sw2-src{color:#7d8488;font-size:.78em;margin-left:6px;white-space:nowrap}' +

                /* цитата */
                '.sw2-quote{background:#2b2e30;border-left:3px solid #7ec260;border-radius:10px;padding:16px 20px;margin-bottom:16px}' +
                '.sw2-quote.neg{border-left-color:#d84b46}.sw2-quote.mix{border-left-color:#e0a93b}' +
                '.sw2-quote-text{font-size:.98em;line-height:1.6;color:#dfe3e5;font-style:italic}' +
                '.sw2-quote-meta{margin-top:10px;font-size:.8em;color:#8b9195;display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
                '.sw2-quote-tone{padding:2px 9px;border-radius:6px;font-style:normal;font-weight:700;text-transform:uppercase;font-size:.72em;letter-spacing:.05em}' +
                '.sw2-quote-tone.pos{background:rgba(126,194,96,.16);color:#7ec260}.sw2-quote-tone.neg{background:rgba(216,75,70,.16);color:#e05b56}.sw2-quote-tone.mix{background:rgba(224,169,59,.16);color:#e0a93b}' +

                '.sw-focusable{outline:none;cursor:pointer}' +
                '.sw-focusable.focus{box-shadow:0 0 0 3px rgba(255,255,255,.85),0 0 18px rgba(255,255,255,.18);border-radius:12px}' +
                '.sw2-dicebtn.sw-focusable.focus{border-radius:16px}' +
                '@media (hover:none) and (pointer:coarse){.sw-focusable.focus{box-shadow:none}.sw2-dicebtn.focus{box-shadow:0 0 0 3px rgba(126,194,96,.6)}}' +
                '@media(max-width:640px){.sw-modal-content{padding:14px 14px 30px}.sw2-verdict{font-size:2.1em}.sw2-columns{grid-template-columns:1fr}.sw2-dicebtn{height:88px}.sw2-dice{width:66px;height:66px;margin-top:-33px}.sw2-dice-label{font-size:1.6em;padding:0 70px}}';
            document.head.appendChild(s);
        } catch(e) { console.error('[SW] injectCSS:', e); }
    }

    /* ===== УТИЛИТЫ ===== */
    var escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) { if (typeof s !== 'string') return ''; return s.replace(/[&<>"']/g, function(m){ return escMap[m]; }); }
    function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    function hasGenre(g, re) { return g.some(function(x){ return re.test((x || '').toLowerCase()); }); }
    function inText(s, re) { return re.test((s || '').toLowerCase()); }
    function inAnyText(texts, re) { return texts.some(function(s){ return inText(s, re); }); }
    function mediaType(m) { return (m && m.name && !m.title) ? 'tv' : 'movie'; }
    function uniq(arr) { return arr.filter(function(v,i,s){ return s.indexOf(v) === i; }); }

    /* ===== СКРОЛЛ / ФОКУС (без изменений, для TV) ===== */
    function findScrollParent(node) {
        try {
            var el = node;
            while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
                var oy = window.getComputedStyle(el).overflowY;
                if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 4) return el;
                el = el.parentNode;
            }
        } catch(e) {}
        return document.scrollingElement || document.documentElement;
    }
    function getScrollContainer() {
        var h = window._sw_currentModalHtml;
        if (!h || !h.length) return null;
        var inner = h.find('.sw-modal-content')[0] || h[0];
        return findScrollParent(inner);
    }
    function scrollContainerTo(el, center) {
        if (!window._sw_blocknav) return;
        try {
            if (!el || !el.length) return;
            var cn = getScrollContainer();
            if (!cn) return;
            var cRect = cn.getBoundingClientRect(), eRect = el[0].getBoundingClientRect();
            var delta = eRect.top - cRect.top, target;
            if (center) target = cn.scrollTop + delta - (cn.clientHeight / 2) + (eRect.height / 2);
            else if (eRect.top < cRect.top + 8) target = cn.scrollTop + delta - 20;
            else if (eRect.bottom > cRect.bottom - 8) target = cn.scrollTop + (eRect.bottom - cRect.bottom) + 20;
            else return;
            try { $(cn).stop(true, false).animate({ scrollTop: target }, 220, 'swing'); }
            catch(e) { cn.scrollTop = target; }
        } catch(e) {}
    }
    function interactiveSet() {
        var h = window._sw_currentModalHtml; if (!h) return $();
        return h.find('.sw-focusable:visible');
    }
    function focusRing(el, doScroll) {
        var h = window._sw_currentModalHtml; if (!h) return;
        h.find('.sw-focusable').removeClass('focus');
        el.addClass('focus');
        window._sw_activeInteractive = el[0];
        if (doScroll !== false) scrollContainerTo(el, false);
    }
    function highlightVisible() {
        if (!window._sw_blocknav) return;
        var set = interactiveSet(); if (!set.length) return;
        var cn = getScrollContainer(), mid;
        if (cn) { var r = cn.getBoundingClientRect(); mid = r.top + r.height / 2; }
        else mid = window.innerHeight / 2;
        var best = null, bd = 1e9;
        set.each(function(){ var rr = this.getBoundingClientRect(); var d = Math.abs((rr.top + rr.height/2) - mid); if (d < bd) { bd = d; best = this; } });
        if (best) focusRing($(best), false);
    }
    function moveHorizontal(dir) {
        if (!window._sw_blocknav) return;
        var set = interactiveSet(); if (!set.length) return;
        var idx = -1;
        if (window._sw_activeInteractive) idx = set.index(window._sw_activeInteractive);
        if (idx < 0) idx = dir > 0 ? -1 : 0;
        var n = idx + dir; if (n < 0) n = set.length - 1; if (n >= set.length) n = 0;
        focusRing(set.eq(n));
    }
    function scrollStep(dir) {
        if (!window._sw_blocknav) return;
        var cn = getScrollContainer();
        if (!cn) return;
        var step = Math.max(100, Math.round(cn.clientHeight * 0.6));
        var maxScroll = Math.max(0, cn.scrollHeight - cn.clientHeight);
        var target = cn.scrollTop + dir * step;
        if (target < 0) target = 0;
        if (target > maxScroll) target = maxScroll;
        try { $(cn).stop(true, false).animate({ scrollTop: target }, 220, 'swing', highlightVisible); }
        catch(e) { cn.scrollTop = target; highlightVisible(); }
    }

    /* ===== ДЕТЕКТОР ЖАНРОВ ===== */
    function genreByIdOrName(genresRaw, ids, nameRe) {
        if (!genresRaw || !genresRaw.length) return false;
        for (var i = 0; i < genresRaw.length; i++) {
            var g = genresRaw[i];
            if (g && typeof g === 'object') {
                if (g.id && ids.indexOf(g.id) >= 0) return true;
                if (nameRe.test((g.name || '').toLowerCase())) return true;
            } else if (typeof g === 'string') {
                if (nameRe.test(g.toLowerCase())) return true;
            }
        }
        return false;
    }

    /* ===== TMDB ===== */
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
    function mapUSRating(s) {
        return { 'G':0,'PG':7,'PG-13':13,'R':17,'NC-17':17,'TV-MA':17,'TV-14':14,'TV-PG':7,'TV-G':0,'TV-Y7':7,'TV-Y':0,'MA':17,'18':18,'16':16,'12':12,'12A':12,'15':15,'7':7,'6':6,'U':0,'0':0 }[(s || '').toUpperCase().trim()] || null;
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
                var de = arr[1].results.find(function(x){ return x.iso_3166_1 === 'DE'; });
                var gb = arr[1].results.find(function(x){ return x.iso_3166_1 === 'GB'; });
                if (ru && ru.rating) { var n = parseInt(ru.rating); if (!isNaN(n)) age = n; }
                if (age === null && us && us.rating) age = mapUSRating(us.rating);
                if (age === null && de && de.rating) { var n2 = parseInt(de.rating.replace('FSK ', '')); if (!isNaN(n2)) age = n2; }
                if (age === null && gb && gb.rating) age = mapUSRating(gb.rating);
                if (age === null && arr[1].results.length > 0) { var f = arr[1].results[0]; if (f.rating) { var n3 = parseInt(f.rating); age = !isNaN(n3) ? n3 : mapUSRating(f.rating); } }
            }
            var reviews = [];
            if (arr[2] && arr[2].results) reviews = arr[2].results.slice(0, 6).map(function(r){ return { author: r.author || 'Аноним', text: (r.content || '').replace(/<[^>]+>/g, '').trim() }; }).filter(function(r){ return r.text.length > 20; });
            var hasTrailer = false;
            if (arr[3] && arr[3].results) hasTrailer = arr[3].results.some(function(v){ return v.type === 'Trailer' && v.site === 'YouTube'; });
            var enOv = (arr[4] && arr[4].overview) ? arr[4].overview : '';
            var r = { kw: kw, age: age, reviews: reviews, hasTrailer: hasTrailer, enOv: enOv };
            _metaCache[id] = r; return r;
        });
    }

    /* ===== ЛОКАЛЬНЫЕ ДАННЫЕ LAMPA (история, закладки) ===== */
    function lampaLocal(movie) {
        var out = { inFavorite: false, favList: null, viewedPercent: 0, hasData: false };
        try {
            if (!window.Lampa) return out;
            var card = movie.movie || movie;
            var id = movie.id || movie.tmdb_id || card.id;
            try {
                if (Lampa.Favorite) {
                    if (typeof Lampa.Favorite.check === 'function') {
                        try { out.inFavorite = !!Lampa.Favorite.check(card); } catch(e) {}
                    }
                    if (!out.inFavorite && typeof Lampa.Favorite.list === 'function') {
                        ['viewed','scheduled','later','favorite'].forEach(function(n){
                            try {
                                var l = Lampa.Favorite.list(n) || [];
                                if (l.some && l.some(function(x){ return (x.id || x.tmdb_id) == id; })) { out.inFavorite = true; out.favList = n; }
                            } catch(e) {}
                        });
                    }
                    if (out.inFavorite && !out.favList && typeof Lampa.Favorite.check === 'function') out.favList = 'favorite';
                }
            } catch(e) {}
            try {
                if (Lampa.Timeline && typeof Lampa.Timeline.get === 'function') {
                    var t = Lampa.Timeline.get(id) || Lampa.Timeline.get(card.id);
                    if (t) {
                        if (t.duration > 0 && t.time >= 0) out.viewedPercent = Math.round(100 * t.time / t.duration);
                        else if (typeof t.percent === 'number') out.viewedPercent = Math.round(t.percent);
                    }
                }
            } catch(e) {}
            if (out.viewedPercent > 100) out.viewedPercent = 100;
            out.hasData = out.inFavorite || out.viewedPercent > 3;
        } catch(e) {}
        return out;
    }

    /* ===== ОТЗЫВЫ: статистика вместо впечатления ===== */
    function reviewStats(reviews) {
        if (!reviews.length) return { total: 0, pos: 0, neg: 0, tone: null, sample: null };
        var posRe = /шедевр|великолепн|потрясающ|восхитит|блестящ|лучш|мощн|гениальн|masterpiece|brilliant|amazing|great|best|loved|perfect|outstanding|flawless|must-watch|замечательн|превосходн|отличн/i;
        var negRe = /скучн|ужасн|провал|разочаров|слаб|затян|бессмысл|плох|boring|bad|worst|terrible|awful|disappoint|waste|dull|pointless|ridiculous|утомительн|неинтересн/i;
        var pos = 0, neg = 0, firstNeg = null, firstPos = null;
        reviews.forEach(function(r){
            var t = r.text.toLowerCase();
            var p = (t.match(posRe) || []).length, n = (t.match(negRe) || []).length;
            if (p > n) { pos++; if (!firstPos) firstPos = r; }
            else if (n > p) { neg++; if (!firstNeg) firstNeg = r; }
        });
        var tone = (pos === 0 && neg === 0) ? null : (pos > neg ? 'pos' : (neg > pos ? 'neg' : 'mix'));
        return { total: reviews.length, pos: pos, neg: neg, tone: tone, sample: (tone === 'neg' ? firstNeg : (tone === 'pos' ? firstPos : (firstNeg || firstPos))) || reviews[0] };
    }

    /* ===== АНАЛИЗ v2: факты, источники с потолками, без доминации ===== */
    function analyze(movie) {
        return Promise.all([ loadCredits(movie), loadMeta(movie), Promise.resolve(lampaLocal(movie)) ]).then(function(arr){
            var credits = arr[0], meta = arr[1], local = arr[2];
            var cfg = getSettings();
            var blG = parseBL(cfg.bad_genres), blA = parseBL(cfg.bad_actors), blD = parseBL(cfg.bad_directors);
            var now = new Date().getFullYear();

            var q = (movie.quality || movie.source_quality || '').toString().toUpperCase();
            var rating = parseFloat(movie.vote_average) || 0;
            var votes = parseInt(movie.vote_count) || 0;
            var adj = votes > 0 ? ((votes * rating) + (BAYES_M * BAYES_C)) / (votes + BAYES_M) : 0;
            var runtime = parseInt(movie.runtime) || 0;
            var genresRaw = movie.genres || [];
            var genres = genresRaw.map(function(g){ return typeof g === 'string' ? g : (g && g.name) || ''; }).filter(Boolean);
            var ovRu = (movie.overview || '').trim(), ovEn = (meta.enOv || '').trim(), ovBoth = [ovRu, ovEn];
            var age = meta.age;
            var yr = movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : 0;
            var rt = reviewStats(meta.reviews);
            var ctxKw = meta.kw;
            function hasKw(re) { return ctxKw.some(function(k){ return re.test(k); }); }

            var cast = (credits && credits.cast || []).slice(0, 15).map(function(c){ return c.name; }).filter(Boolean);
            var crew = credits && credits.crew || [];
            var dirs = crew.filter(function(c){ return c.job === 'Director'; }).map(function(c){ return c.name; }).filter(Boolean);
            var wrts = crew.filter(function(c){ return ['Writer','Screenplay','Story','Author'].indexOf(c.job) >= 0; }).map(function(c){ return c.name; }).filter(Boolean);

            /* --- сбор фактов по источникам --- */
            var F = [];
            function add(src, kind, text, w) { F.push({ src: src, kind: kind, text: text, w: w }); }

            /* Источник 1: карточка (рейтинг, голоса, год, хронометраж, качество) */
            if (votes >= 3000 && adj >= 8.0) add('card','pro','Высокий рейтинг ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' оценок)', 30);
            else if (votes >= 500 && adj >= cfg.min_rating) add('card','pro','Рейтинг ' + rating.toFixed(1) + ' — выше вашего порога ' + cfg.min_rating.toFixed(1), 20);
            else if (votes >= 100 && adj >= cfg.min_rating) add('card','pro','Рейтинг ' + rating.toFixed(1) + ' при ' + fmtN(votes) + ' оценках', 14);
            if (votes > 0 && votes < 1500 && adj >= 7.6) add('card','pro','Малоизвестная работа с высоким рейтингом', 12);
            if (votes >= 2000 && adj >= 7.8 && yr > 0 && yr <= now - 5) add('card','pro','Проверенная временем классика', 12);
            if (yr === now || yr === now - 1) add('card','pro','Новинка ' + yr + ' года', 5);
            if (votes > 0 && votes < 100) add('card','con','Всего ' + votes + ' оценок — рейтинг ненадёжен', 14);
            if (votes === 0) add('card','con','Нет оценок — рейтинг неизвестен', 16);
            if (rating > 0 && adj < cfg.min_rating && votes >= 100) add('card','con','Рейтинг ' + rating.toFixed(1) + ' ниже вашего порога ' + cfg.min_rating.toFixed(1), 25);
            if (rating > 0 && adj < 5 && votes >= 50) add('card','con','Низкий рейтинг ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' оценок)', 28);
            if (runtime > 0 && runtime <= 95) add('card','pro','Недолгий просмотр: ' + runtime + ' мин', 6);
            if (runtime > 160 && runtime <= 200) add('card','con','Большой хронометраж: ' + runtime + ' мин', 10);
            if (runtime > 200) add('card','con','Очень долгий просмотр: ' + runtime + ' мин', 14);
            if (/CAM|TS|HDCAM|HDRIP|TELECINE|SCR|WORKPRINT|TELESYNC/i.test(q || '')) add('card','con','Источник низкого качества (' + q + ')', 26);
            else if (/4K|UHD|2160p/i.test(q || '')) add('card','pro','Доступно в 4K', 8);
            else if (q) add('card','pro','Хорошее качество источника (' + q + ')', 6);

            /* Источник 2: ваши фильтры */
            var mG = genres.filter(function(g){ return blG.some(function(b){ return g.toLowerCase().indexOf(b) >= 0; }); });
            var mA = cast.filter(function(a){ return blA.some(function(b){ return a.toLowerCase().indexOf(b) >= 0; }); });
            var mD = [].concat(dirs, wrts).filter(function(p){ return blD.some(function(b){ return p.toLowerCase().indexOf(b) >= 0; }); });
            if (mG.length) add('user','con','Нелюбимый жанр: ' + mG.join(', '), 40);
            if (mA.length) add('user','con','Нелюбимый актёр: ' + uniq(mA).slice(0,2).join(', '), 35);
            if (mD.length) add('user','con','Нелюбимый автор: ' + uniq(mD).slice(0,2).join(', '), 35);

            /* Источник 3: TMDB (теги, ценз, трейлер). Описание — только как неподтверждённая подсказка */
            var dims = [
                { id:'drugs', kw:/drug|narcotic|addiction|meth|cocaine|heroin|marijuan|substance|lsd|ecstasy|opium|overdose|dealer|cartel|crack/, ov:/нарко|кокаин|героин|марихуан|каннабис|опиум|амфетамин/, text:'тема наркотиков', w:16 },
                { id:'nudity', kw:/nudity|female nudity|male nudity|full frontal|rear nudity|topless|strip club|stripper/, ov:/обнаж|нагот|голы/, text:'нагота', w:14 },
                { id:'sex', kw:/sex scene|sexual content|sexuality|orgy|prostitut|seduction|affair|infidelity|erotic|one night stand|threesome/, ov:/эротик|откровен|проститутк|интимн/, text:'сексуальные сцены', w:14 },
                { id:'viol', kw:/violenc|gore|murder|blood|tortur|brutal|weapon|massacre|execution|stab|slaughter/, ov:/насил|жесток|кров|убийств|резн|стрельб/, text:'насилие и жестокость', w:16 },
                { id:'smoke', kw:/smok|cigarette|cigar/, ov:/курени|сигарет|табак/, text:'курение', w:6 },
                { id:'alc', kw:/alcohol|drunkenness|drunk|booze|hangover|alcoholic/, ov:/алкогол|водк|виски|пьян/, text:'алкоголь', w:7 },
                { id:'prof', kw:/profanity|f word|strong language|vulgarity|cursing|swearing/, ov:/нецензур|матер|ругательств/, text:'нецензурная лексика', w:7 },
                { id:'suicide', kw:/suicide|self harm|self injury|self mutilation/, ov:/суицид|самоубийств|покончи/, text:'тема суицида', w:18 },
                { id:'abuse', kw:/abuse|domestic violence|child abuse|spousal abuse/, ov:/домашнее насилие|абьюз/, text:'тема насилия в семье', w:16 },
                { id:'animal', kw:/animal death|dead animal|pet death|animal cruelty/, ov:/смерть животного|гибель животного/, text:'гибель животных', w:9 }
            ];
            var fl = {};
            dims.forEach(function(d){
                var k = hasKw(new RegExp(d.kw.source, 'i'));
                var o = inAnyText(ovBoth, new RegExp(d.ov.source, 'i'));
                fl[d.id] = k;
                if (k) add('tmdb','con','По тегам TMDB: ' + d.text, d.w);
                else if (o) add('tmdb','con','В описании: ' + d.text + ' (тегами не подтверждено)', Math.ceil(d.w / 2));
            });
            var hardAdult = fl.drugs || fl.nudity || fl.sex || fl.viol || fl.suicide || fl.abuse || !!movie.adult;

            if (age !== null && age >= 18) add('tmdb','con','Возрастной рейтинг: ' + age + '+', 14);
            else if (age !== null && age >= 16) add('tmdb','con','Возрастной рейтинг: ' + age + '+', 12);
            else if (age !== null && age >= 12) add('tmdb','con','Возрастной рейтинг: ' + age + '+', 7);

            var isAnim = genreByIdOrName(genresRaw, [GENRE_ID_ANIM], /animation|анимац|мульт|anime|аниме/);
            var hasFamilyGenre = genreByIdOrName(genresRaw, [GENRE_ID_FAMILY, GENRE_ID_KIDS], /family|семейн|kids|детск/);
            var kidsKw = hasKw(/for kids|children|kids|family-friendly|детям|семейн|для детей|preschool|educational/i);
            var familyOK;
            if (isAnim) {
                if (hardAdult) familyOK = false;
                else if (age !== null && age >= 16) familyOK = false;
                else if (hasFamilyGenre || kidsKw || (age !== null && age <= 12)) familyOK = true;
                else familyOK = false;
            } else {
                familyOK = !hardAdult && rating >= 5 && ((age !== null && age <= 12) || hasFamilyGenre || kidsKw);
            }
            if (familyOK) add('tmdb','pro','Подходит для семейного просмотра' + (age !== null ? ' (ценз ' + age + '+)' : ' (детские теги TMDB)'), 16);
            if (isAnim && !familyOK && (hardAdult || (age !== null && age >= 16))) add('tmdb','con','Анимация для взрослой аудитории' + (age !== null ? ' (' + age + '+)' : ''), 14);
            if (meta.hasTrailer) add('tmdb','pro','Есть официальный трейлер', 4);
            if (hasGenre(genres, /documentary|документ/i)) add('tmdb','pro','Документальный фильм', 8);

            /* Источник 4: отзывы в цифрах */
            if (rt.total >= 2 && rt.tone === 'pos') add('reviews','pro','Отзывы зрителей: положительных ' + rt.pos + ' из ' + rt.total, 20);
            if (rt.total >= 2 && rt.tone === 'neg') add('reviews','con','Отзывы зрителей: отрицательных ' + rt.neg + ' из ' + rt.total, 22);
            if (rt.total >= 2 && rt.tone === 'mix') { add('reviews','pro','Есть хвалебные отзывы (' + rt.pos + ' из ' + rt.total + ')', 8); add('reviews','con','Есть критические отзывы (' + rt.neg + ' из ' + rt.total + ')', 9); }
            if (rt.total === 1) add('reviews', rt.tone === 'neg' ? 'con' : 'pro', 'Единственный отзыв зрителя: ' + (rt.tone === 'neg' ? 'критический' : 'положительный'), 6);

            /* Источник 5: локальная Lampa (история просмотров, закладки) */
            if (local.viewedPercent >= 90) add('lampa','con','Вы уже досмотрели (' + local.viewedPercent + '% просмотра) — это повтор', 10);
            else if (local.viewedPercent >= 5) add('lampa','con','Вы бросили просмотр на ' + local.viewedPercent + '%', 14);
            if (local.inFavorite) add('lampa','pro', local.favList === 'viewed' ? 'Отмечено в Lampa как просмотренное' : 'Уже в ваших закладках Lampa', 8);

            /* --- подсчёт с потолками источников (без доминации) --- */
            var perSrc = {};
            F.forEach(function(f){
                var s = perSrc[f.src] || (perSrc[f.src] = { pro: 0, con: 0 });
                s[f.kind === 'pro' ? 'pro' : 'con'] += f.w;
            });
            var score = 0;
            Object.keys(perSrc).forEach(function(k){
                var cap = SRC_CAPS[k] || 40;
                score += Math.min(perSrc[k].pro, cap) - Math.min(perSrc[k].con, cap);
            });

            /* уверенность: сколько источников реально дали данные */
            var srcActive = 1 + (meta.kw.length || age !== null ? 1 : 0) + (rt.total > 0 ? 1 : 0) + (local.hasData ? 1 : 0) + ((blG.length || blA.length || blD.length) ? 1 : 0);
            var lowConf = srcActive <= 2;
            if (lowConf) score = Math.round(score * 0.6);
            if (score > 100) score = 100; if (score < -100) score = -100;
            var norm = Math.round((score + 100) / 2);
            var vClass = score >= 22 ? 'yes' : (score <= -22 ? 'no' : 'maybe');
            var vWord = score >= 22 ? 'СТОИТ' : (score <= -22 ? 'НЕ СТОИТ' : 'СПОРНО');

            /* факт-резюме вместо «воды» */
            var lead = vClass === 'yes' ? (score >= 45 ? 'Определённо стоит посмотреть' : 'Стоит посмотреть')
                     : vClass === 'no' ? (score <= -45 ? 'Лучше пропустить' : 'Не стоит смотреть')
                     : 'Спорный вариант — решайте сами';
            var facts = [];
            if (votes > 0) facts.push('рейтинг ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' оценок)');
            if (age !== null) facts.push('ценз ' + age + '+');
            if (rt.total >= 2) facts.push('отзывы: ' + rt.pos + ' из ' + rt.total + ' положительных');
            var reason = lead + (facts.length ? ' — ' + facts.join(', ') : '') + '.';
            if (lowConf) reason += ' Данных мало — вердикт осторожный.';

            /* списки для показа, с подписью источника */
            var pros = F.filter(function(f){ return f.kind === 'pro'; }).sort(function(a,b){ return b.w - a.w; })
                        .map(function(f){ return { t: f.text, s: SRC_LABEL[f.src] }; });
            var cons = F.filter(function(f){ return f.kind === 'con'; }).sort(function(a,b){ return b.w - a.w; })
                        .map(function(f){ return { t: f.text, s: SRC_LABEL[f.src] }; });
            if (!pros.length) pros.push({ t: 'Данных «за» недостаточно', s: '' });
            if (!cons.length) cons.push({ t: (blG.length || blA.length || blD.length) ? 'Под ваши фильтры ничего не попало' : 'Явных минусов не выявлено', s: '' });

            return {
                pros: pros, cons: cons, review: rt, score: score, norm: norm,
                vClass: vClass, vWord: vWord, reason: reason,
                mode: (meta.kw.length || age !== null || meta.reviews.length) ? 'TMDB' : 'TAGS'
            };
        });
    }

    /* ===== КОНТРОЛЛЕР ===== */
    function restorePrev() {
        var prev = window._sw_prevController; window._sw_prevController = null;
        try { if (prev && prev.name) Lampa.Controller.toggle(prev.name); else Lampa.Controller.toggle('full_start'); }
        catch(e) { try { Lampa.Controller.toggle('full'); } catch(_) {} }
    }
    function clearLoader() { if (window._sw_loaderTimer) { clearInterval(window._sw_loaderTimer); window._sw_loaderTimer = null; } }
    function swKeyCapture(e) {
        if (!window._sw_blocknav) return;
        var ae = document.activeElement;
        if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) return;
        if (e.keyCode === 13 || e.keyCode === 32) {
            var a = window._sw_activeInteractive;
            if (a) { e.preventDefault(); try { e.stopImmediatePropagation(); } catch(_) {} $(a).trigger('click'); }
        }
    }
    function cleanupModal() {
        window._sw_rolling = false; window._sw_currentModalHtml = null;
        window._sw_activeInteractive = null;
        clearLoader();
        if (window._sw_keyBound) { document.removeEventListener('keydown', swKeyCapture, true); window._sw_keyBound = false; }
    }
    function registerController() {
        try {
            Lampa.Controller.add('should_watch_modal_enhanced', {
                toggle: function() {
                    var h = window._sw_currentModalHtml; if (!h) return;
                    if (window._sw_blocknav) highlightVisible();
                },
                up: function() { if (window._sw_blocknav) scrollStep(-1); },
                down: function() { if (window._sw_blocknav) scrollStep(1); },
                left: function() { if (window._sw_blocknav) moveHorizontal(-1); },
                right: function() { if (window._sw_blocknav) moveHorizontal(1); },
                back: function() {
                    cleanupModal();
                    window._sw_closingFromController = true;
                    try { Lampa.Modal.close(); } catch(e) {}
                    restorePrev();
                }
            });
        } catch(e) { console.error('[SW] registerController:', e); }
    }

    /* ===== РЕНДЕР (новый дизайн) ===== */
    var DICE_SVG = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="88" height="88" rx="22" fill="#b9bdc1" stroke="#6f7477" stroke-width="5"/><circle cx="36" cy="36" r="9" fill="#17181a"/><circle cx="64" cy="64" r="9" fill="#17181a"/></svg>';

    function listItem(x) {
        return '<li>' + esc(x.t) + (x.s ? '<span class="sw2-src">· ' + esc(x.s) + '</span>' : '') + '</li>';
    }
    function buildReadyInner(a) {
        var badge = a.mode === 'TMDB'
            ? '<span class="sw2-badge tmdb"><span class="sw2-dot"></span>TMDB</span>'
            : '<span class="sw2-badge"><span class="sw2-dot"></span>TAGS</span>';
        var quote = '';
        if (a.review.sample && a.review.total >= 2 && a.review.tone) {
            var toneLabel = a.review.tone === 'pos' ? 'хвалебный' : (a.review.tone === 'neg' ? 'критический' : 'спорный');
            var txt = a.review.sample.text.length > 240 ? a.review.sample.text.substring(0, 240).trim() + '…' : a.review.sample.text;
            quote = '<div class="sw2-quote ' + a.review.tone + '"><div class="sw2-quote-text">' + esc(txt) + '</div><div class="sw2-quote-meta">— ' + esc(a.review.sample.author) + ', отзыв зрителя <span class="sw2-quote-tone ' + a.review.tone + '">' + toneLabel + '</span></div></div>';
        }
        return '' +
            '<div class="sw2-dossier">' + badge +
                '<div class="sw2-verdict ' + a.vClass + '" id="sw-vword">' + esc(a.vWord) + '</div>' +
                '<div class="sw2-reason" id="sw-vreason">' + esc(a.reason) + '</div>' +
                '<div class="sw2-meter"><div class="sw2-meter-fill ' + a.vClass + '" data-w="' + a.norm + '"></div></div>' +
            '</div>' +
            '<button class="sw2-dicebtn sw-focusable" id="sw-dice-btn" tabindex="0">' +
                '<span class="sw2-dice" id="sw-dice">' + DICE_SVG + '</span>' +
                '<span class="sw2-dice-label" id="sw-dice-label">Бросить кости</span>' +
            '</button>' +
            '<div class="sw2-columns">' +
                '<div class="sw2-col pros"><div class="sw2-title pros">✓ Аргументы за</div><ul class="sw2-list">' + a.pros.map(listItem).join('') + '</ul></div>' +
                '<div class="sw2-col cons"><div class="sw2-title cons">✗ Аргументы против</div><ul class="sw2-list">' + a.cons.map(listItem).join('') + '</ul></div>' +
            '</div>' +
            quote;
    }

    /* ===== АНИМАЦИЯ КУБИКА: катится по кнопке, текст расшифровывается ===== */
    function bindDice(html) {
        var btn = html.find('#sw-dice-btn');
        var dice = html.find('#sw-dice');
        var label = html.find('#sw-dice-label');

        dice.on('animationend', function(){
            /* плавно вернуть кубик на старт */
            try {
                var d = dice[0], b = btn[0];
                var dr = d.getBoundingClientRect(), br = b.getBoundingClientRect();
                d.classList.remove('rolling');
                d.style.transition = 'none';
                d.style.left = (dr.left - br.left) + 'px';
                d.style.transform = 'rotate(720deg)';
                void d.offsetWidth;
                d.style.transition = 'left .55s cubic-bezier(.34,1.56,.64,1), transform .55s ease';
                d.style.left = '14px';
                d.style.transform = 'rotate(0deg)';
                setTimeout(function(){ d.style.transition = ''; d.style.left = ''; d.style.transform = ''; }, 650);
            } catch(e) {}
        });

        btn.on('hover:enter click keydown', function(e){
            try {
                if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
                if (window._sw_rolling) return; window._sw_rolling = true;

                var final = Math.random() > 0.5 ? 'СМОТРЕТЬ' : 'НЕ СМОТРЕТЬ';
                var pool = 'СМОТРЕТЬНЕ';
                label.removeClass('res-yes res-no');
                dice[0].style.left = ''; dice[0].style.transform = ''; dice[0].style.transition = '';
                dice.removeClass('rolling');
                void dice[0].offsetWidth;
                dice.addClass('rolling');

                var t0 = Date.now(), DUR = 1150;
                var iv = setInterval(function(){
                    var p = Math.min(1, (Date.now() - t0) / DUR);
                    if (p < 1) {
                        var reveal = Math.floor(Math.max(0, (p - 0.25) / 0.75) * final.length);
                        var s = final.slice(0, reveal);
                        for (var i = reveal; i < final.length; i++) {
                            s += final[i] === ' ' ? ' ' : pool[Math.floor(Math.random() * pool.length)];
                        }
                        label.text(s);
                    } else {
                        clearInterval(iv);
                        label.text(final).addClass(final === 'СМОТРЕТЬ' ? 'res-yes' : 'res-no');
                        window._sw_rolling = false;
                        if (window._sw_blocknav) focusRing(btn);
                    }
                }, 55);
            } catch(err) { console.error('[SW] dice handler:', err); window._sw_rolling = false; }
        });
    }

    /* ===== ОТКРЫТИЕ МОДАЛКИ ===== */
    function showModal(movie) {
        try {
            var title = esc(movie.title || movie.name || 'Фильм');
            try { window._sw_prevController = Lampa.Controller.enabled ? Lampa.Controller.enabled() : null; } catch(e) { window._sw_prevController = null; }
            var phases = [
                { emoji: '🔍', text: 'Анализирую карточку…' },
                { emoji: '📊', text: 'Тяну данные с TMDB…' },
                { emoji: '💬', text: 'Читаю отзывы зрителей…' },
                { emoji: '🎭', text: 'Проверяю ценз и теги…' },
                { emoji: '🗂', text: 'Сверяю с вашей Lampa…' },
                { emoji: '⚖️', text: 'Взвешиваю источники…' }
            ];
            var html = $('<div class="sw-modal-content"><div id="sw-body"><div class="sw-loader"><div class="sw-loader-emoji" id="sw-loader-emoji">' + phases[0].emoji + '</div><div class="sw-loader-text" id="sw-loader-text">' + phases[0].text + '</div><div class="sw-loader-progress"></div></div></div></div>');
            window._sw_currentModalHtml = html; window._sw_activeInteractive = null;

            var pi = 0;
            window._sw_loaderTimer = setInterval(function(){
                pi = (pi + 1) % phases.length;
                var t = html.find('#sw-loader-text');
                var e = html.find('#sw-loader-emoji');
                if (t.length) { t.css('opacity', 0); setTimeout(function(){ t.text(phases[pi].text).css('opacity', 1); }, 220); }
                if (e.length) {
                    e.css('transform', 'scale(0.7) rotate(10deg)');
                    setTimeout(function(){ e.text(phases[pi].emoji).css('transform', 'scale(1) rotate(0deg)'); }, 180);
                }
            }, 750);

            Lampa.Modal.open({
                title: 'Стоит ли смотреть: ' + title, html: html, size: 'large',
                onBack: function() {
                    var closing = window._sw_closingFromController;
                    cleanupModal();
                    if (closing) { window._sw_closingFromController = false; return; }
                    restorePrev();
                }
            });

            if (window._sw_blocknav && !window._sw_keyBound) {
                document.addEventListener('keydown', swKeyCapture, true);
                window._sw_keyBound = true;
            }

            analyze(movie).then(function(a){
                clearLoader();
                html.find('#sw-body').html('<div class="sw-body">' + buildReadyInner(a) + '</div>');
                bindDice(html);
                setTimeout(function(){
                    html.find('#sw-vword').addClass('appear');
                    html.find('#sw-vreason').addClass('appear');
                    html.find('.sw2-meter-fill').each(function(){ this.style.width = (this.getAttribute('data-w') || 50) + '%'; });
                    html.find('.sw2-list li').each(function(i){ var li = $(this); setTimeout(function(){ li.addClass('appear'); }, i * 45); });
                    if (window._sw_blocknav) highlightVisible();
                }, 120);
                Lampa.Controller.toggle('should_watch_modal_enhanced');
            }).catch(function(err){
                clearLoader(); console.error('[SW] analyze:', err);
                html.find('#sw-body').html('<div class="sw-body" style="text-align:center;padding:48px 20px;color:#e05b56">Не удалось проанализировать фильм. Проверьте сеть и попробуйте снова.</div>');
            });
        } catch(e) { console.error('[SW] showModal:', e); }
    }

    /* ===== ИНЪЕКЦИЯ КНОПКИ ===== */
    function addBtn(el, movie) {
        try {
            if (!el || !el.length || el.find('.sw-custom-button-enhanced').length) return;
            var btn = $('<div class="full-start__button selector sw-custom-button-enhanced" data-type="should_watch"><div class="full-start__icon">' + ICON + '</div><span>Стоит ли?</span></div>');
            btn.on('hover:enter', function(){ if (movie) showModal(movie); });
            var anchor = el.find('.view--torrent,.view--online,.view--trailer').last();
            if (anchor.length) anchor.after(btn);
            else { var fb = el.find('.full-start__buttons,.full-start-new__buttons,.full-card__buttons'); if (fb.length) fb.append(btn); }
        } catch(e) { console.error('[SW] addBtn:', e); }
    }

    function startPlugin() {
        try {
            var ua = navigator.userAgent || '';
            var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            var isTV = /TV|SmartTV|HbbTV|Web0S|webOS|Tizen|NetCast|Viera|BRAVIA|CrKey|AFT|FireTV|POVIDE|Maple/i.test(ua);
            window._sw_blocknav = !hasTouch || isTV;
        } catch(e) { window._sw_blocknav = true; }
        try { registerController(); } catch(e) {}
        try { Lampa.Listener.follow('full', function(e){
            if (e.type !== 'complite') return;
            try {
                var renderEl = null;
                if (e.object && typeof e.object.render === 'function') renderEl = e.object.render();
                else if (e.object && e.object.activity && typeof e.object.activity.render === 'function') renderEl = e.object.activity.render();
                if (renderEl) addBtn(renderEl, e.data.movie);
            } catch(err) { console.error('[SW]', err); }
        }); } catch(e) {}
        try { initSettings(); } catch(e) {}
        try { injectCSS(); } catch(e) {}
        console.log('[ShouldWatch] v14.0 (new design + balanced sources)');
    }
    try { if (window.appready) startPlugin(); else Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') startPlugin(); }); } catch(e) {}
})();
