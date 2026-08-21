/*
 * Lampa Plugin: "Стоит ли смотреть?" (Should Watch?)
 * Version: 53.4 (Final stitched + safety fixes)
 * Compliant with Lampa API, Memory-safe, Pure jQuery/DOM, Zero external dependencies.
 */
(function () {
    'use strict';
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;
    window.should_watch_plugin_enhanced = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var CONTROLLER_ID = 'should_watch_modal_enhanced';
    var SETTINGS_FLAG = 'sw_settings_ready_v52';
    var ICON = '<svg viewBox="0 0 24 24" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>';
    var ARROW_ICON = '<svg class="sw-aud-arrow" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 5v5a6 6 0 0 0 6 6h8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M15 12l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    var DEMO_DATA = {
        id: 27205,
        title: 'Начало (Inception)',
        name: 'Начало',
        vote_average: 8.4,
        vote_count: 36500,
        runtime: 148,
        release_date: '2010-07-16',
        genres: [{ id: 28, name: 'боевик' }, { id: 878, name: 'научная фантастика' }, { id: 53, name: 'триллер' }],
        overview: 'Кобб — талантливый вор, лучший из лучших в опасном искусстве извлечения: он крадёт ценные секреты из глубин подсознания во время сна.'
    };

    window._sw_rolling = false;
    window._sw_currentModalHtml = null;
    window._sw_closed = false;
    window._sw_loaderTimer = null;
    window._sw_activeInteractive = null;
    window._sw_prevController = null;
    window._sw_triggerElement = null;

    var INTERESTING_TAGS = [
        { re: /based on novel|основан на романе|экранизац/i, text: '✨ Экранизация книги' },
        { re: /based on true story|основан на реальных событиях|true story/i, text: '✨ На реальных событиях' },
        { re: /based on comic|comic book|графическ роман/i, text: '✨ По мотивам комикса' },
        { re: /based on video game|по мотивам игры|video game/i, text: '🎮 По мотивам игры' },
        { re: /oscar winner|academy award|лауреат оскар/i, text: '🏆 Лауреат премии Оскар' },
        { re: /cannes|venice|berlin|film festival winner/i, text: '🎬 Призёр кинофестиваля' },
        { re: /cult film|культов/i, text: '🎭 Культовый фильм' },
        { re: /remake|римейк/i, text: '🔁 Римейк' },
        { re: /sequel|сиквел/i, text: '➕ Сиквел' },
        { re: /prequel|приквел/i, text: '⏪ Приквел' },
        { re: /time travel|путешестви[яе] во времени/i, text: '⏳ Путешествия во времени' },
        { re: /heist|ограблен/i, text: '💼 История ограбления' },
        { re: /post[- ]?apocalyptic|постапокалипсис/i, text: '☣️ Постапокалипсис' },
        { re: /dystopia|антиутопи/i, text: '🏙 Антиутопия' },
        { re: /coming of age|взрослен/i, text: '🌱 История взросления' },
        { re: /cyberpunk|киберпанк/i, text: '🤖 Киберпанк' },
        { re: /space|космос|moon|lunar|mars|марс/i, text: '🚀 Космос' },
        { re: /biographical|biopic|биограф/i, text: '📖 Биографическая история' }
    ];

    var FEATURES = [
        { re: /plot twist|twist ending|неожиданн поворот|сюжетн поворот/i, text: '🌀 Неожиданные повороты' },
        { re: /superhero|супергеро/i, text: '🦸 Супергероика' },
        { re: /strong female lead|сильн героин/i, text: '💪 Сильная героиня' },
        { re: /musical|мюзикл/i, text: '🎶 Мюзикл' },
        { re: /magic|маги|волшеб/i, text: '🪄 Магия' },
        { re: /dragon|дракон/i, text: '🐉 Драконы' },
        { re: /detective|детектив/i, text: '🕵️ Детектив' },
        { re: /spy|шпион/i, text: '🕶 Шпионские игры' },
        { re: /zombie|зомби/i, text: '🧟 Зомби' },
        { re: /vampire|вампир/i, text: '🧛 Вампиры' },
        { re: /robot|android|робот/i, text: '🤖 Роботы' },
        { re: /time loop|временн[ао]я петл/i, text: '🔁 Временная петля' },
        { re: /animal|животн/i, text: '🐾 Животные' },
        { re: /кошк|кошач/i, text: '🐱 Котики' },
        { re: /собак|пёс|пес|dog/i, text: '🐶 Собаки' },
        { re: /friendship|дружб/i, text: '🤝 О дружбе' },
        { re: /romance|романтик/i, text: '❤️ Романтика' }
    ];

    var DOM_METRICS = [['pace','Темп'],['fear','Страх'],['action','Экшен'],['violence','Насилие'],['sadness','Грусть'],['language','Лексика']].map(function(p){
        return { key: p[0], re: new RegExp(p[1] + '[\\s\\S]{0,60}?([\\d.,]+)\\s*/\\s*10') };
    });

    function getSetting(k, d) {
        try {
            if (window.Lampa && Lampa.Storage) {
                var v = Lampa.Storage.get(PLUGIN_ID + '_' + k);
                if (v !== undefined && v !== null && v !== '') return v;
            }
        } catch(e) {}
        return d;
    }

    function getSettings() {
        return {
            bad_genres: String(getSetting('bad_genres', '') || ''),
            bad_actors: String(getSetting('bad_actors', '') || ''),
            bad_directors: String(getSetting('bad_directors', '') || ''),
            min_rating: parseFloat(getSetting('min_rating', '6')) || 6,
            font_scale: parseInt(getSetting('font_scale', '20')) || 20
        };
    }

    function parseBL(s) {
        return s ? s.split(',').map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean) : [];
    }

    function initSettings() {
        try {
            if (!window.Lampa || !Lampa.SettingsApi || window[SETTINGS_FLAG]) return;
            window[SETTINGS_FLAG] = true;
            Lampa.SettingsApi.addComponent({ component: PLUGIN_ID, name: 'Стоит ли смотреть', icon: ICON });
            [
                { name: 'bad_genres', type: 'input', title: 'Нелюбимые жанры', description: 'Через запятую (напр: ужасы, мелодрама)', default: '' },
                { name: 'bad_actors', type: 'input', title: 'Нелюбимые актёры', description: 'Через запятую', default: '' },
                { name: 'bad_directors', type: 'input', title: 'Нелюбимые авторы/режиссёры', description: 'Через запятую', default: '' },
                { name: 'min_rating', type: 'select', title: 'Минимальный рейтинг', values: {'0':'Любой','5':'5.0','6':'6.0','7':'7.0','8':'8.0'}, default: '6' },
                { name: 'font_scale', type: 'select', title: 'Размер шрифта', values: {'14':'14px','16':'16px','18':'18px','20':'20px','24':'24px','28':'28px'}, default: '20' },
                { name: 'reset_cache', type: 'select', title: 'Кэш данных', values: {'0':'Хранить','1':'Сбросить при следующем открытии'}, default: '0' }
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
        if (document.getElementById('sw-plugin-styles-v55')) return;
        ['sw-plugin-styles-v51', 'sw-plugin-styles-v52', 'sw-plugin-styles-v53', 'sw-plugin-styles-v54'].forEach(function(id){
            var old = document.getElementById(id);
            if (old && old.parentNode) old.parentNode.removeChild(old);
        });
        var s = document.createElement('style');
        s.id = 'sw-plugin-styles-v55';
        s.innerHTML =
            '.sw-custom-button-enhanced{cursor:pointer;position:relative;transition:background .25s ease,color .25s,transform .2s ease,box-shadow .25s;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;user-select:none;overflow:hidden;margin-right:10px}' +
            '.sw-custom-button-enhanced.focus{background:#343a40!important;color:#fff!important;transform:scale(1.02);box-shadow:0 2px 8px rgba(0,0,0,.4)}' +
            '.sw-custom-button-enhanced.focus svg path{fill:#fff}' +
            '.sw-wrap{--sw-green:#4CAF50;--sw-red:#EF5350;--sw-orange:#FFB74D;--sw-ink:#e9ecef;--sw-mut:#adb5bd;--sw-mono:"PT Mono","Ubuntu Mono","Droid Sans Mono","Courier New",monospace;padding:12px 6px 40px;color:var(--sw-ink);font-family:' + FONT + ';font-size:20px;box-sizing:border-box;-webkit-font-smoothing:antialiased}' +
            '.sw-body{animation:swFadeIn .35s ease}' +
            '@keyframes swFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
            '.sw-dossier{position:relative;background:#212529;border:1px solid #2a2e32;border-radius:16px;padding:22px 24px 20px;margin-bottom:14px;box-shadow:0 4px 16px rgba(0,0,0,.3);animation:swRise .4s ease both;overflow:hidden}' +
            '@keyframes swRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +
            '.sw-verdict-word{position:relative;font-family:var(--sw-mono);font-size:2.2em;font-weight:700;letter-spacing:.04em;line-height:1;margin:0 0 16px;text-transform:uppercase;opacity:0;transform:translateY(10px);transition:opacity .55s cubic-bezier(.16,.8,.24,1),transform .55s cubic-bezier(.16,.8,.24,1);will-change:transform,opacity}' +
            '.sw-verdict-word.appear{opacity:1;transform:translateY(0)}' +
            '.sw-verdict-word.yes{color:var(--sw-green)}' +
            '.sw-verdict-word.no{color:var(--sw-red)}' +
            '.sw-verdict-word.meh{color:var(--sw-orange)}' +
            '.sw-meter{height:6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.3)}' +
            '.sw-meter-fill{height:100%;width:0;border-radius:4px;transition:width 1.1s cubic-bezier(.16,.8,.24,1) .1s;will-change:width}' +
            '.sw-meter-fill.yes{background:var(--sw-green)}' +
            '.sw-meter-fill.no{background:var(--sw-red)}' +
            '.sw-meter-fill.meh{background:var(--sw-orange)}' +
            '.sw-dicebtn{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:70px;border-radius:14px;background:#262b30;border:1px solid rgba(255,255,255,.08);margin:0 0 14px;cursor:pointer;outline:none;transition:box-shadow .25s ease,background .25s ease;-webkit-tap-highlight-color:transparent;box-shadow:0 4px 12px rgba(0,0,0,.25)}' +
            '.sw-dicebtn.focus{background:#2f353a!important;box-shadow:0 0 0 2px rgba(255,255,255,.8),0 4px 12px rgba(0,0,0,.3)}' +
            '.sw-dicebtn:not(.sw-rolling) .sw-dice{animation:swIdleBob 2.4s ease-in-out infinite;will-change:transform}' +
            '@keyframes swIdleBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}' +
            '.sw-dice{position:absolute;left:16px;top:50%;width:44px;height:44px;margin-top:-22px}' +
            '.sw-dice-core{display:block;width:100%;height:100%;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4));transform-origin:50% 100%;will-change:transform}' +
            '.sw-dice-core svg{width:100%;height:100%;display:block}' +
            '.sw-dice-core.sw-knock{animation:swKnock .56s cubic-bezier(.33,.02,.17,1) both}' +
            '@keyframes swKnock{0%{transform:translateY(0) scale(1,1)}28%{transform:translateY(-18px) scale(1.04,1.04)}50%{transform:translateY(0) scale(1,1)}64%{transform:translateY(2px) scale(1.14,.8)}80%{transform:translateY(-4px) scale(.98,1.04)}100%{transform:translateY(0) scale(1,1)}}' +
            '.sw-dice-label{position:relative;font-family:var(--sw-mono);font-size:1.4em;font-weight:700;color:#fff;text-align:center;text-transform:lowercase;letter-spacing:.02em;transition:opacity .25s ease,transform .25s ease;pointer-events:none;padding:0 16px}' +
            '.sw-dice-label.hide{opacity:0;transform:translateY(8px)}' +
            '.sw-dice-label.res-yes{color:#66bb6a}' +
            '.sw-dice-label.res-no{color:#f19898}' +
            '.sw-tabs{display:grid;grid-template-columns:1fr 1fr;background:transparent;border-radius:12px;overflow:hidden;margin-bottom:14px;padding:0;gap:8px}' +
            '.sw-tab-btn{position:relative;min-height:48px;padding:10px 8px;display:flex;align-items:center;justify-content:center;gap:8px;background:#1e2226;border:1px solid transparent;outline:none;border-radius:10px;cursor:pointer;color:#c7cdd2;font-family:var(--sw-mono);font-size:0.95em;font-weight:700;text-transform:lowercase;letter-spacing:.02em;opacity:.7;transition:opacity .2s,background .2s ease,border-color .2s;user-select:none}' +
            '.sw-tab-btn.active{opacity:1;color:#fff;background:#262b30;border-color:#e9ecef;box-shadow:0 2px 8px rgba(0,0,0,.25)}' +
            '.sw-tab-btn.focus{opacity:1;background:#343a40!important;box-shadow:0 0 0 2px rgba(255,255,255,.8),0 2px 8px rgba(0,0,0,.3)}' +
            '.sw-tab-pane{display:none}' +
            '.sw-tab-pane.active{display:block;animation:swPaneIn .35s cubic-bezier(.16,.8,.24,1) both}' +
            '@keyframes swPaneIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}' +
            '.sw-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px}' +
            '.sw-col{position:relative;background:#1e2226;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px 18px;box-shadow:0 4px 12px rgba(0,0,0,.25)}' +
            '.sw-col.pros{border-left:8px solid #4CAF50}' +
            '.sw-col.cons{border-left:8px solid #EF5350}' +
            '.sw-list{margin:0;padding:0;list-style:none;font-size:0.95em;line-height:1.5;color:#eef1f2}' +
            '.sw-list li{position:relative;margin-bottom:14px;padding-left:0;opacity:0;transform:translateY(6px);transition:opacity .45s cubic-bezier(.16,.8,.24,1),transform .45s cubic-bezier(.16,.8,.24,1);will-change:transform,opacity}' +
            '.sw-list li:last-child{margin-bottom:0}' +
            '.sw-list li.appear{opacity:1;transform:translateY(0)}' +
            '.sw-metrics-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}' +
            '.sw-metric-card{position:relative;background:#1e2226;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px 14px;box-shadow:0 4px 12px rgba(0,0,0,.2);opacity:0;transform:translateY(8px);transition:opacity .45s cubic-bezier(.16,.8,.24,1),transform .45s cubic-bezier(.16,.8,.24,1);will-change:transform,opacity}' +
            '.sw-metric-card.appear{opacity:1;transform:translateY(0)}' +
            '.sw-metric-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px}' +
            '.sw-metric-name{font-family:var(--sw-mono);font-size:.78em;font-weight:700;color:#c7cdd2;text-transform:uppercase;letter-spacing:.04em}' +
            '.sw-metric-score{font-family:var(--sw-mono);font-size:1.05em;font-weight:700;white-space:nowrap}' +
            '.sw-metric-score small{font-size:0.7em;opacity:0.6;font-weight:700}' +
            '.sw-metric-score.hi{color:#EF5350}.sw-metric-score.mid{color:#E6A23C}.sw-metric-score.ok{color:#81C784}' +
            '.sw-metric-bar-bg{height:5px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden;margin-bottom:0}' +
            '.sw-metric-bar-fill{height:100%;width:0;border-radius:4px;transition:width .9s cubic-bezier(.16,.8,.24,1) .1s;will-change:width}' +
            '.sw-audience-box{position:relative;background:#1e2226;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px 18px;box-shadow:0 4px 12px rgba(0,0,0,.2);margin-top:4px;overflow:hidden}' +
            '.sw-audience-title{font-family:var(--sw-mono);font-size:.95em;font-weight:700;text-transform:lowercase;color:#fff;letter-spacing:.02em;margin:0 0 12px}' +
            '.sw-audience-title.second{margin-top:18px}' +
            '.sw-aud-line{display:flex;align-items:flex-start;gap:10px;font-family:var(--sw-mono);font-weight:700;font-size:.9em;line-height:1.45;margin:0;text-transform:lowercase}' +
            '.sw-aud-line.yes{color:#4CAF50}' +
            '.sw-aud-line.no{color:#EF5350}' +
            '.sw-aud-arrow{width:1.1em;height:1.1em;flex:0 0 auto;margin-top:.12em}' +
            '.sw-focusable{outline:none;cursor:pointer}' +
            '@media(max-width:680px){.sw-columns{grid-template-columns:1fr}.sw-metrics-grid{grid-template-columns:1fr}.sw-verdict-word{font-size:1.8em}.sw-dice-label{font-size:1.2em}.sw-dice{width:38px;height:38px;margin-top:-19px;left:12px}.sw-dossier{padding:18px 14px 14px}}';
        document.head.appendChild(s);
    }

    var escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) { if (typeof s !== 'string') return ''; return s.replace(/[&<>"']/g, function(m){ return escMap[m]; }); }
    function hasGenre(g, re) { return g.some(function(x){ return re.test((x || '').toLowerCase()); }); }
    function inText(s, re) { return re.test((s || '').toLowerCase()); }
    function hasKw(s, re) { return inText(s, re); }
    function mediaType(m) { return (m && m.name && !m.title) ? 'tv' : 'movie'; }
    function sanitizeMovie(movie) {
        if (!movie || typeof movie !== 'object') return DEMO_DATA;
        if (!movie.id && !movie.tmdb_id && !movie.title && !movie.name) return DEMO_DATA;
        return movie;
    }

    function tmdbKey() {
        return (window.Lampa && Lampa.TMDB && Lampa.TMDB.key) ? Lampa.TMDB.key : '';
    }
    function curLangCode() {
        return (window.Lampa && Lampa.Storage && Lampa.Storage.get('language', 'ru')) || 'ru';
    }
    function tmdbGet(url, callback) {
        if (!window.Lampa || !Lampa.TMDB || !Lampa.TMDB.get) {
            $.ajax({
                url: 'https://api.themoviedb.org/3' + url + (url.indexOf('?') > -1 ? '&' : '?') + 'api_key=' + tmdbKey() + '&language=' + curLangCode(),
                dataType: 'json',
                success: callback,
                error: function(){ callback(null); }
            });
            return;
        }
        Lampa.TMDB.get(url, callback);
    }

    function loadCredits(movie, callback) {
        var type = mediaType(movie);
        tmdbGet('/' + type + '/' + movie.id + '/credits', function(data){ callback(data || {cast:[], crew:[]}); });
    }

    function loadMeta(movie, callback) {
        var type = mediaType(movie);
        tmdbGet('/' + type + '/' + movie.id + '/keywords', function(kwData){
            var keywords = [];
            if (kwData && kwData.keywords) keywords = kwData.keywords.map(function(k){ return k.name; });
            else if (kwData && kwData.results) keywords = kwData.results.map(function(k){ return k.name; });
            callback({ keywords: keywords });
        });
    }

    function lampaLocal() {
        var dom = $('.full-card, .modal-content');
        var mm = {};
        var text = dom.text();
        DOM_METRICS.forEach(function(m){
            var match = text.match(m.re);
            mm[m.key] = match ? match[1] : 0;
        });
        return mm;
    }

    function readDomSignals(movie) {
        var text = (movie.overview || '') + ' ' + (movie.keywords || []).join(' ');
        var lower = text.toLowerCase();
        var dPsych = { k: /псих|психолог|психопат|шизофрен|безум|mental|psycho|insan/i.test(lower), o: false };
        var dSuic = { k: /суицид|самоубийств|suicid/i.test(lower), o: false };
        var dIll = { k: /болезн|рак|онколог|смертельн|illness|cancer|disease/i.test(lower), o: false };
        var cCrime = 0;
        if (/криминал|crime|мафи|банд|gangster|murder|убийств/i.test(lower)) cCrime = 50;
        return { dPsych: dPsych, dSuic: dSuic, dIll: dIll, cCrime: cCrime };
    }

    function analyze(movie, credits, meta) {
        var genres = (movie.genres || []).map(function(g){ return g.name; });
        var cast = (credits.cast || []).slice(0, 10).map(function(c){ return c.name; });
        var crew = (credits.crew || []).filter(function(c){ return c.job === 'Director' || c.job === 'Writer'; }).map(function(c){ return c.name; });
        var keywords = meta.keywords || [];
        var ctx = (movie.overview || '') + ' ' + keywords.join(' ');
        
        var mm = lampaLocal();
        var signals = readDomSignals(movie);
        var dPsych = signals.dPsych, dSuic = signals.dSuic, dIll = signals.dIll, cCrime = signals.cCrime;

        var settings = getSettings();
        var bad_genres = parseBL(settings.bad_genres);
        var bad_actors = parseBL(settings.bad_actors);
        var bad_directors = parseBL(settings.bad_directors);
        var min_rating = settings.min_rating;

        var pros = [], cons = [], audience_yes = [], audience_no = [];
        
        if (movie.vote_average >= 7.5) pros.push('⭐ Высокий рейтинг (' + movie.vote_average + ')');
        else if (movie.vote_average < 5.0) cons.push('📉 Низкий рейтинг (' + movie.vote_average + ')');
        
        if (movie.vote_average < min_rating && movie.vote_average > 0) cons.push('⚠️ Рейтинг ниже вашего минимума (' + min_rating + ')');
        
        var hasBadGenre = false;
        genres.forEach(function(g){ if (bad_genres.indexOf(g.toLowerCase()) !== -1) hasBadGenre = true; });
        if (hasBadGenre) cons.push('🚫 Присутствует нелюбимый жанр');
        
        var hasBadActor = false;
        cast.forEach(function(c){ if (bad_actors.indexOf(c.toLowerCase()) !== -1) hasBadActor = true; });
        if (hasBadActor) cons.push('🚫 В ролях нелюбимый актёр');
        
        var hasBadDirector = false;
        crew.forEach(function(c){ if (bad_directors.indexOf(c.toLowerCase()) !== -1) hasBadDirector = true; });
        if (hasBadDirector) cons.push('🚫 Нелюбимый режиссёр/автор');

        var fearBase = 2.5;
        if (hasGenre(genres, /ужасы|хоррор|horror/i)) fearBase = 8.8;
        else if (hasGenre(genres, /триллер|thriller/i)) fearBase = 7.2;
        else if (hasGenre(genres, /криминал|crime|детектив|mystery/i)) fearBase = 6.0;
        else if (hasGenre(genres, /драма|drama|психологический|psychological/i)) fearBase = 5.0;
        else fearBase = 3.0;

        if (hasKw(ctx, /horror|scary|haunted|possess|demon|jump scare|ghost|psychological|psychopath|serial killer|paranoia|disturbing|thriller|suspense|tension|напряжен|жутк|страшн|мистическ|паранормальн|маньяк|ужас/i)) {
            fearBase = Math.max(fearBase, 7.5);
        }
        if (dPsych.k || dPsych.o) fearBase = Math.max(fearBase, 6.5);
        if (dSuic.k || dSuic.o || dIll.k || dIll.o) fearBase = Math.max(fearBase, 5.5);
        if (cCrime >= 50) fearBase = Math.max(fearBase, 6.5);

        // FIX 1: Безопасный парсинг mm.fear с учетом запятых
        var parsedFear = parseFloat(String(mm.fear).replace(',', '.'));
        var mFear = (!isNaN(parsedFear) && parsedFear > 2.5) ? parsedFear : fearBase;

        var atmosMetrics = [
            { name: 'Темп', val: parseFloat(String(mm.pace).replace(',', '.')) || 5.0 },
            { name: 'Страх', val: mFear },
            { name: 'Экшен', val: parseFloat(String(mm.action).replace(',', '.')) || (hasGenre(genres, /боевик|action/i) ? 8.0 : 4.0) },
            { name: 'Насилие', val: parseFloat(String(mm.violence).replace(',', '.')) || (mFear > 6 ? 6.5 : 3.0) },
            { name: 'Грусть', val: parseFloat(String(mm.sadness).replace(',', '.')) || (dIll.k ? 7.0 : 3.0) },
            { name: 'Лексика', val: parseFloat(String(mm.language).replace(',', '.')) || 4.0 }
        ];

        var sparkles = INTERESTING_TAGS.filter(function(t){ return t.re.test(ctx); });
        var features = FEATURES.filter(function(f){ return f.re.test(ctx); });

        if (hasGenre(genres, /семейн|family|детск|animation|мульт/i)) audience_yes.push('👨‍👩‍👧‍👦 Подходит для семейного просмотра');
        if (mFear > 6.5 || dPsych.k) audience_no.push('🔞 Не рекомендуется детям и впечатлительным');
        if (hasGenre(genres, /комеди|comedy/i)) audience_yes.push('😂 Отличный выбор, чтобы расслабиться');
        if (mFear > 7.5 || dSuic.k || dIll.k) audience_no.push('⚠️ Содержит тяжелые темы (триггеры)');

        var score = 50;
        score += (movie.vote_average - 5) * 10;
        if (hasBadGenre) score -= 30;
        if (hasBadActor) score -= 15;
        if (hasBadDirector) score -= 20;
        if (sparkles.length > 0) score += 10;
        
        var verdict = 'СПОРНО';
        var vClass = 'meh';
        if (score >= 65) { verdict = 'СТОИТ'; vClass = 'yes'; }
        else if (score < 40) { verdict = 'НЕ СТОИТ'; vClass = 'no'; }

        return {
            verdict: verdict,
            vClass: vClass,
            score: Math.max(0, Math.min(100, score)),
            pros: pros.length ? pros : ['✨ Стандартный набор, без особых плюсов'],
            cons: cons.length ? cons : ['👍 Явных минусов не найдено'],
            atmos: atmosMetrics,
            audience_yes: audience_yes.length ? audience_yes : ['✅ Широкая аудитория'],
            audience_no: audience_no.length ? audience_no : ['✅ Нет явных противопоказаний'],
            sparkles: sparkles,
            features: features
        };
    }

    function buildUI(data) {
        var html = '<div class="sw-wrap"><div class="sw-body">';
        html += '<div class="sw-dossier">';
        html += '<div class="sw-verdict-word ' + data.vClass + '">' + data.verdict + '</div>';
        html += '<div class="sw-meter"><div class="sw-meter-fill ' + data.vClass + '" style="width:' + data.score + '%"></div></div>';
        html += '</div>';
        
        html += '<div class="sw-dicebtn sw-focusable" tabindex="0">';
        html += '<div class="sw-dice"><div class="sw-dice-core">' + ICON + '</div></div>';
        html += '<div class="sw-dice-label">Бросить кубик</div>';
        html += '</div>';
        
        html += '<div class="sw-tabs">';
        html += '<div class="sw-tab-btn sw-focusable active" data-tab="main" tabindex="0">Главное</div>';
        html += '<div class="sw-tab-btn sw-focusable" data-tab="atmos" tabindex="0">Атмосфера</div>';
        html += '</div>';
        
        html += '<div class="sw-tab-pane active" data-pane="main">';
        html += '<div class="sw-columns">';
        html += '<div class="sw-col pros"><ul class="sw-list">';
        data.pros.forEach(function(p){ html += '<li>' + esc(p) + '</li>'; });
        html += '</ul></div>';
        html += '<div class="sw-col cons"><ul class="sw-list">';
        data.cons.forEach(function(c){ html += '<li>' + esc(c) + '</li>'; });
        html += '</ul></div>';
        html += '</div>';
        
        html += '<div class="sw-audience-box">';
        html += '<div class="sw-audience-title">Кому зайдет?</div>';
        data.audience_yes.forEach(function(a){ html += '<div class="sw-aud-line yes">' + ARROW_ICON + esc(a) + '</div>'; });
        html += '<div class="sw-audience-title second">Кому не стоит?</div>';
        data.audience_no.forEach(function(a){ html += '<div class="sw-aud-line no">' + ARROW_ICON + esc(a) + '</div>'; });
        html += '</div>';
        html += '</div>';
        
        html += '<div class="sw-tab-pane" data-pane="atmos">';
        html += '<div class="sw-metrics-grid">';
        data.atmos.forEach(function(m){
            var val = Math.max(0, Math.min(10, m.val));
            var cls = val >= 7 ? 'hi' : (val >= 4 ? 'mid' : 'ok');
            html += '<div class="sw-metric-card">';
            html += '<div class="sw-metric-header"><div class="sw-metric-name">' + esc(m.name) + '</div><div class="sw-metric-score ' + cls + '">' + val.toFixed(1) + '<small>/10</small></div></div>';
            html += '<div class="sw-metric-bar-bg"><div class="sw-metric-bar-fill ' + cls + '" style="width:' + (val * 10) + '%"></div></div>';
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
        
        html += '</div></div>';
        return $(html);
    }

    function findScrollParent() {
        try {
            var root = (window._sw_currentModalHtml && window._sw_currentModalHtml.length) ? window._sw_currentModalHtml[0] : null;
            if (!root) return null;
            var p = root.parentElement;
            while (p && p !== document.documentElement) {
                var cs = window.getComputedStyle(p);
                var oy = cs.overflowY;
                if (oy === 'scroll' || oy === 'auto' || oy === 'overlay') {
                    if (p.scrollHeight > p.clientHeight + 4) return p;
                }
                p = p.parentElement;
            }
            return null;
        } catch(e) { return null; }
    }

    function scrollModalBy(dir) {
        var el = findScrollParent();
        if (!el) return;
        var step = Math.max(140, Math.round((el.clientHeight || 360) * 0.4));
        var max = Math.max(0, el.scrollHeight - el.clientHeight);
        var next = el.scrollTop + dir * step;
        el.scrollTop = Math.max(0, Math.min(max, next));
    }

    function interactiveSet() {
        var h = window._sw_currentModalHtml;
        if (!h || !h.length) return $();
        return h.find('.sw-focusable').filter(':visible');
    }

    function swScrollToFocus(targetEl) {
        try {
            var el = targetEl[0];
            if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } catch(e) {}
    }

    function focusRing(el, doScroll) {
        var h = window._sw_currentModalHtml;
        if (!h || !el || !el.length) return;
        h.find('.sw-focusable').removeClass('focus');
        el.addClass('focus');
        window._sw_activeInteractive = el[0];
        if (doScroll !== false) swScrollToFocus(el);
    }

    function moveFocus(dir) {
        var set = interactiveSet();
        if (!set.length) return;
        var idx = -1;
        if (window._sw_activeInteractive) idx = set.index(window._sw_activeInteractive);
        if (idx < 0) idx = (dir > 0) ? 0 : set.length - 1;
        else {
            idx += dir;
            if (idx < 0) idx = set.length - 1;
            if (idx >= set.length) idx = 0;
        }
        focusRing(set.eq(idx), true);
    }

    function triggerActiveAction() {
        if (!window._sw_activeInteractive) return;
        var el = $(window._sw_activeInteractive);
        if (el.length) el.trigger('hover:enter').trigger('click');
    }

    function registerController() {
        if (!window.Lampa || !Lampa.Controller) return;
        Lampa.Controller.add(CONTROLLER_ID, {
            toggle: function () {
                var set = interactiveSet();
                if (set.length) focusRing(set.first(), false);
            },
            up: function () { scrollModalBy(-1); },
            down: function () { scrollModalBy(1); },
            left: function () { moveFocus(-1); },
            right: function () { moveFocus(1); },
            enter: function () { triggerActiveAction(); },
            back: function () { doClose(); return true; }
        });
        Lampa.Controller.toggle(CONTROLLER_ID);
    }

    // FIX 3: Безопасный сброс фокуса без поломки списков Lampa
    function restorePrevController() {
        try {
            if (window.Lampa && Lampa.Controller) {
                var target = window._sw_prevController || 'full';
                Lampa.Controller.toggle(target);
                setTimeout(function(){
                    if (window._sw_triggerElement && window._sw_triggerElement.length) {
                        $('.focus').not(window._sw_triggerElement).removeClass('focus');
                        window._sw_triggerElement.addClass('focus');
                    }
                }, 50);
            }
        } catch(e) { console.error('[SW] restorePrevController:', e); }
    }

    // FIX 2: Принудительная очистка таймеров и флага анимации
    function cleanupModal() {
        try {
            if (window._sw_loaderTimer) {
                clearTimeout(window._sw_loaderTimer);
                window._sw_loaderTimer = null;
            }
            window._sw_rolling = false;
            window._sw_activeInteractive = null;
        } catch(e) {}
    }

    function doClose() {
        if (window._sw_closed) return;
        window._sw_closed = true;
        cleanupModal();
        try { Lampa.Modal.close(); } catch(e) {}
        setTimeout(function(){ restorePrevController(); }, 100);
    }

    function bindDice(html) {
        var btn = html.find('.sw-dicebtn');
        var core = btn.find('.sw-dice-core');
        var label = btn.find('.sw-dice-label');
        var faces = ['СТОИТ', 'НЕ СТОИТ'];
        var lastFace = '';
        
        btn.on('click hover:enter', function(){
            if (window._sw_rolling) return;
            window._sw_rolling = true;
            label.addClass('hide');
            core.addClass('sw-knock');
            
            setTimeout(function(){
                var nextFace;
                do { nextFace = faces[Math.floor(Math.random() * faces.length)]; } 
                while (nextFace === lastFace && faces.length > 1);
                lastFace = nextFace;
                
                label.removeClass('hide res-yes res-no')
                     .addClass(nextFace === 'СТОИТ' ? 'res-yes' : 'res-no')
                     .text(nextFace);
                core.removeClass('sw-knock');
                window._sw_rolling = false;
            }, 600);
        });
    }

    function bindTabs(html) {
        html.find('.sw-tab-btn').on('click hover:enter', function(){
            var btn = $(this);
            if (btn.hasClass('active')) return;
            html.find('.sw-tab-btn').removeClass('active');
            btn.addClass('active');
            var tab = btn.data('tab');
            html.find('.sw-tab-pane').removeClass('active');
            html.find('.sw-tab-pane[data-pane="' + tab + '"]').addClass('active');
            focusRing(btn, false);
        });
    }

    function showModal(movie) {
        window._sw_closed = false; // FIX: Сброс флага закрытия
        window._sw_triggerElement = $('.focus');
        window._sw_prevController = (window.Lampa && Lampa.Controller) ? Lampa.Controller.enabled() : 'full';
        
        var html = buildUI({ verdict: 'ЗАГРУЗКА...', vClass: 'meh', score: 0, pros: ['⏳ Анализируем данные...'], cons: [], atmos: [], audience_yes: [], audience_no: [] });
        window._sw_currentModalHtml = html;
        
        Lampa.Modal.open({
            title: 'Стоит ли смотреть?',
            html: html,
            size: 'medium',
            onBack: function(){
                if (window._sw_closed) return;
                window._sw_closed = true;
                cleanupModal();
                setTimeout(function(){ restorePrevController(); }, 100);
                return true;
            },
            onDestroy: function(){ cleanupModal(); }
        });
        
        registerController();
        
        window._sw_loaderTimer = setTimeout(function(){
            if (!window._sw_closed) html.find('.sw-verdict-word').text('Почти готово...');
        }, 1500);
        
        loadCredits(movie, function(credits){
            loadMeta(movie, function(meta){
                if (window._sw_closed) return;
                clearTimeout(window._sw_loaderTimer);
                var data = analyze(movie, credits, meta);
                var newHtml = buildUI(data);
                html.html(newHtml.html());
                
                setTimeout(function(){
                    html.find('.sw-verdict-word').addClass('appear');
                    html.find('.sw-list li, .sw-metric-card').each(function(i){
                        var el = $(this);
                        setTimeout(function(){ el.addClass('appear'); }, i * 80);
                    });
                }, 100);
                
                bindDice(html);
                bindTabs(html);
                focusRing(html.find('.sw-dicebtn'), true);
            });
        });
    }

    function injectButton() {
        if (!window.Lampa || !Lampa.Listener) return;
        Lampa.Listener.follow('full', function(e){
            if (e.type === 'create' && e.object && e.object.id) {
                var movie = sanitizeMovie(e.object);
                var btn = $('<div class="sw-custom-button-enhanced sw-focusable selector" tabindex="0">' + ICON + '</div>');
                btn.on('click hover:enter', function(){
                    showModal(movie);
                });
                var target = $('.full-start__buttons').first();
                if (target.length) target.append(btn);
                else $('.full-card .full-start').append(btn);
            }
        });
    }

    function init() {
        if (!window.Lampa) { setTimeout(init, 500); return; }
        initSettings();
        injectCSS();
        injectButton();
    }

    init();
})();
