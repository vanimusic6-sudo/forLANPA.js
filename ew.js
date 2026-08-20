/**
 * Lampa Plugin: "Стоит ли смотреть?" (Should Watch?)
 * Version: 52.3 (Fixed exit, dice shake, simplified UI)
 * Compliant with Lampa API, Memory-safe, Pure jQuery/DOM, Zero external dependencies.
 */
(function () {
    'use strict';
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;
    window.should_watch_plugin_enhanced = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var SETTINGS_FLAG = 'sw_settings_ready_v51';
    var CONTROLLER_NAME = 'should_watch_modal';
    var ICON = '<svg viewBox="0 0 24 24" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>';
    var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    var GENRE_ID_ANIM = 16, GENRE_ID_FAMILY = 10751, GENRE_ID_KIDS = 10762;

    var SW_DICE_VERDICTS = ['СТОИТ', 'НЕ СТОИТ'];

    var DEMO_DATA = {
        id: 27205,
        title: 'Начало (Inception)',
        name: 'Начало',
        vote_average: 8.4,
        vote_count: 36500,
        runtime: 148,
        release_date: '2010-07-16',
        genres: [{ id: 28, name: 'боевик' }, { id: 878, name: 'научная фантастика' }, { id: 53, name: 'триллер' }],
        overview: 'Кобб — талантливый вор, лучший из лучших в опасном искусстве извлечения: он крадет ценные секреты из глубин подсознания во время сна.'
    };

    var _metaCache = {};
    var _domCache = null;

    window._sw_rolling = false;
    window._sw_currentModalHtml = null;
    window._sw_prevController = null;
    window._sw_closed = false;
    window._sw_loaderTimer = null;
    window._sw_blocknav = false;
    window._sw_activeInteractive = null;

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
        if (document.getElementById('sw-plugin-styles-v52')) return;
        var old = document.getElementById('sw-plugin-styles-v51');
        if (old) old.parentNode.removeChild(old);
        var s = document.createElement('style');
        s.id = 'sw-plugin-styles-v52';
        s.innerHTML =
            '.sw-custom-button-enhanced{cursor:pointer;position:relative;transition:background .25s ease,color .25s,transform .2s ease,box-shadow .25s;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;user-select:none;overflow:hidden}' +
            '.sw-custom-button-enhanced.focus{background:linear-gradient(135deg,#ffd166,#ff7a3d)!important;color:#1a0f04!important;transform:scale(1.03);box-shadow:0 0 0 2px rgba(255,255,255,.55),0 8px 20px rgba(255,138,61,.35)}' +
            '.sw-custom-button-enhanced.focus svg path{fill:#1a0f04}' +
            '.sw-wrap{--sw-gold:#f2c14e;--sw-gold-2:#ffb238;--sw-green:#33e08a;--sw-green-2:#17b869;--sw-red:#ff5b6e;--sw-red-2:#e8283f;--sw-ink:#eef2f4;--sw-mut:#9aa7b4;padding:12px 6px 40px;color:var(--sw-ink);font-family:' + FONT + ';font-size:20px;box-sizing:border-box;-webkit-font-smoothing:antialiased}' +
            '.sw-body{animation:swFadeIn .35s ease}' +
            '@keyframes swFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
            '.sw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:60px 20px;min-height:40vh;color:#9aa1a6}' +
            '.sw-loader-emoji{font-size:2.8em;line-height:1;animation:swFloat 2s ease-in-out infinite}' +
            '@keyframes swFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}' +
            '.sw-loader-text{font-size:1em;font-weight:500;min-height:1.5em;text-align:center;color:#dfe6ec;letter-spacing:.02em}' +
            '.sw-loader-progress{width:220px;height:4px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;position:relative;margin-top:4px}' +
            '.sw-loader-progress::after{content:"";position:absolute;left:-100%;top:0;height:100%;width:100%;background:linear-gradient(90deg,transparent,var(--sw-gold-2),transparent);animation:swSlide 1.2s ease-in-out infinite}' +
            '@keyframes swSlide{0%{left:-100%}100%{left:100%}}' +
            '.sw-dossier{position:relative;background:#1e2226;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:24px 24px 18px;margin-bottom:14px;box-shadow:0 4px 16px rgba(0,0,0,.3);animation:swRise .4s ease both;overflow:hidden}' +
            '@keyframes swRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +
            '.sw-verdict-word{position:relative;font-size:2.5em;font-weight:700;letter-spacing:.03em;line-height:1;margin:0 0 16px;text-transform:uppercase;opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s cubic-bezier(.2,.8,.2,1)}' +
            '.sw-verdict-word.appear{opacity:1;transform:translateY(0)}' +
            '.sw-verdict-word.yes{color:#33e08a;text-shadow:0 0 20px rgba(51,224,138,.35)}' +
            '.sw-verdict-word.no{color:#ff5b6e;text-shadow:0 0 20px rgba(255,91,110,.35)}' +
            '.sw-verdict-word.yes::before{content:"✔ ";font-size:0.8em;vertical-align:middle}' +
            '.sw-verdict-word.no::before{content:"✖ ";font-size:0.8em;vertical-align:middle}' +
            '.sw-meter{height:6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.3)}' +
            '.sw-meter-fill{height:100%;width:0;border-radius:4px;transition:width 1s cubic-bezier(.2,.8,.2,1)}' +
            '.sw-meter-fill.yes{background:linear-gradient(90deg,#17b869,#33e08a)}' +
            '.sw-meter-fill.no{background:linear-gradient(90deg,#c21f34,#ff5b6e)}' +
            '.sw-dicebtn{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:84px;border-radius:16px;background:#262b30;border:1px solid rgba(255,255,255,.08);margin:0 0 14px;cursor:pointer;outline:none;transition:transform .2s ease,box-shadow .2s,background .2s;-webkit-tap-highlight-color:transparent;box-shadow:0 4px 12px rgba(0,0,0,.25)}' +
            '.sw-dicebtn.focus{background:#2f353a;transform:scale(1.01);box-shadow:0 4px 12px rgba(0,0,0,.25)}' +
            '.sw-dicebtn:active{transform:scale(.98)}' +
            '.sw-dicebtn.shake{animation:swShake .8s cubic-bezier(.36,.07,.19,.97)}' +
            '@keyframes swShake{0%,100%{transform:translate(0,0) rotate(0)}10%,30%,50%,70%,90%{transform:translate(-4px,2px) rotate(-0.5deg)}20%,40%,60%,80%{transform:translate(4px,-2px) rotate(0.5deg)}}' +
            '.sw-dice{position:absolute;left:16px;top:50%;width:52px;height:52px;margin-top:-26px;transition:transform .3s ease;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4))}' +
            '.sw-dice-core{display:block;width:100%;height:100%}' +
            '.sw-dice-core svg{width:100%;height:100%;display:block}' +
            '.sw-dice.sw-spin .sw-dice-core{animation:swSpin 0.8s ease-in-out infinite}' +
            '@keyframes swSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}' +
            '.sw-dice-label{position:relative;font-size:1.5em;font-weight:600;color:#fff;text-align:center;transition:opacity .25s ease,transform .25s ease;pointer-events:none;padding:0 16px}' +
            '.sw-dice-label.hide{opacity:0;transform:translateY(8px)}' +
            '.sw-dice-label.res-yes{color:#8dffc2;text-shadow:0 0 12px rgba(51,224,138,.4)}' +
            '.sw-dice-label.res-no{color:#ffb3ba;text-shadow:0 0 12px rgba(255,91,110,.4)}' +
            '.sw-tabs{display:grid;grid-template-columns:1fr 1fr;background:#1e2226;border-radius:12px;overflow:hidden;margin-bottom:14px;padding:3px;gap:3px}' +
            '.sw-tab-btn{position:relative;min-height:44px;padding:10px 8px;display:flex;align-items:center;justify-content:center;gap:8px;background:transparent;border:none;outline:none;border-radius:10px;cursor:pointer;color:#c7cdd2;font-size:0.9em;font-weight:600;text-transform:none;opacity:.6;transition:opacity .2s,background .2s ease,transform .15s;user-select:none}' +
            '.sw-tab-btn.active{opacity:1;color:#fff;background:#2d3338;box-shadow:0 2px 8px rgba(0,0,0,.25)}' +
            '.sw-tab-btn.focus{opacity:1;background:#343a3f;transform:scale(1.01);box-shadow:0 2px 8px rgba(0,0,0,.25)}' +
            '.sw-tab-btn.sw-disabled{opacity:.35;pointer-events:none}' +
            '.sw-tagplus{background:#33e08a;border:none;color:#04150c;padding:2px 10px;font-weight:700;text-transform:uppercase;border-radius:6px;font-size:.8em}' +
            '.sw-tagminus{background:#ff5b6e;border:none;color:#180307;padding:2px 10px;font-weight:700;text-transform:uppercase;border-radius:6px;font-size:.8em}' +
            '.sw-tab-i{color:#9aa7b4;font-weight:500;padding:0 4px;font-size:.9em}' +
            '.sw-tab-atmos{display:inline-flex;align-items:center;gap:6px}' +
            '.sw-tab-pane{display:none;animation:swFadeIn .3s ease}' +
            '.sw-tab-pane.active{display:block}' +
            '.sw-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px}' +
            '.sw-col{position:relative;background:#1e2226;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px 18px;box-shadow:0 4px 12px rgba(0,0,0,.25)}' +
            '.sw-col.pros{border-left:4px solid #33e08a}' +
            '.sw-col.cons{border-left:4px solid #ff5b6e}' +
            '.sw-col-title{font-size:0.85em;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px;color:#c7cdd2}' +
            '.sw-col.pros .sw-col-title{color:#5fe6a0}' +
            '.sw-col.cons .sw-col-title{color:#ff8a95}' +
            '.sw-list{margin:0;padding:0;list-style:none;font-size:0.95em;line-height:1.5;color:#eef1f2}' +
            '.sw-list li{position:relative;margin-bottom:10px;padding-left:0;opacity:0;transform:translateY(6px);transition:opacity .4s ease,transform .4s ease}' +
            '.sw-list li:last-child{margin-bottom:0}' +
            '.sw-list li.appear{opacity:1;transform:translateY(0)}' +
            '.sw-metrics-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}' +
            '.sw-metric-card{position:relative;background:#1e2226;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px 14px;box-shadow:0 4px 12px rgba(0,0,0,.2);transition:transform .2s ease}' +
            '.sw-metric-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}' +
            '.sw-metric-name{font-size:.75em;font-weight:600;color:#c7cdd2;text-transform:uppercase;letter-spacing:.03em}' +
            '.sw-metric-score{font-size:1em;font-weight:700;letter-spacing:.02em}' +
            '.sw-metric-score.hi{color:#ff8a95}.sw-metric-score.mid{color:#ffc266}.sw-metric-score.ok{color:#5fe6a0}' +
            '.sw-metric-bar-bg{height:5px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden;margin-bottom:6px}' +
            '.sw-metric-bar-fill{height:100%;border-radius:4px;transition:width .8s ease}' +
            '.sw-metric-desc{font-size:.7em;color:#8b98a5;line-height:1.35}' +
            '.sw-audience-box{position:relative;background:#1e2a23;border:1px solid rgba(51,224,138,.25);border-radius:12px;padding:14px 16px;box-shadow:0 4px 12px rgba(0,0,0,.2);margin-top:10px;overflow:hidden}' +
            '.sw-audience-title{font-size:.75em;font-weight:700;text-transform:uppercase;color:#7fe6ac;letter-spacing:.04em;display:flex;align-items:center;gap:6px;margin-bottom:6px}' +
            '.sw-audience-text{font-size:.88em;line-height:1.5;color:#e6ece8;margin:0}' +
            '.sw-audience-warn{font-size:.8em;line-height:1.4;color:#ffb0b8;margin-top:8px;padding-top:8px;border-top:1px dashed rgba(255,91,110,.3)}' +
            '.sw-focusable{outline:none;cursor:pointer}' +
            '@media(max-width:680px){.sw-columns{grid-template-columns:1fr}.sw-metrics-grid{grid-template-columns:1fr}.sw-verdict-word{font-size:2em}.sw-dice-label{font-size:1.3em}.sw-dice{width:42px;height:42px;margin-top:-21px;left:12px}.sw-dossier{padding:18px 14px 14px}}';
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

    function sanitizeMovie(movie) {
        if (!movie || typeof movie !== 'object') return DEMO_DATA;
        if (!movie.id && !movie.tmdb_id && !movie.title && !movie.name) return DEMO_DATA;
        return movie;
    }

    function modalScroll() {
        try { if (window.Lampa && Lampa.Modal && typeof Lampa.Modal.scroll === 'function') return Lampa.Modal.scroll(); } catch(e) {}
        return null;
    }

    function interactiveSet() {
        var h = window._sw_currentModalHtml;
        if (!h) return $();
        return h.find('.sw-focusable').filter(':visible');
    }

    function focusRing(el, doUpdate) {
        var h = window._sw_currentModalHtml;
        if (!h || !el || !el.length) return;
        h.find('.sw-focusable').removeClass('focus');
        el.addClass('focus');
        window._sw_activeInteractive = el[0];
        if (doUpdate !== false) {
            var sc = modalScroll();
            if (sc && sc.update) { try { sc.update(el, false); } catch(e) {} }
        }
    }

    function highlightVisible() {
        var set = interactiveSet();
        if (!set.length) return;
        var mid = window.innerHeight / 2;
        var best = null, bd = 1e9;
        set.each(function(){
            var rr = this.getBoundingClientRect();
            var d = Math.abs((rr.top + rr.height/2) - mid);
            if (d < bd) { bd = d; best = this; }
        });
        if (best) focusRing($(best), false);
    }

    function moveHorizontal(dir) {
        var set = interactiveSet();
        if (!set.length) return;
        var idx = -1;
        if (window._sw_activeInteractive) idx = set.index(window._sw_activeInteractive);
        if (idx < 0) idx = dir > 0 ? -1 : 0;
        var n = idx + dir;
        if (n < 0) n = set.length - 1;
        if (n >= set.length) n = 0;
        focusRing(set.eq(n), true);
    }

    function scrollStep(dir) {
        var sc = modalScroll();
        if (!sc || typeof sc.wheel !== 'function') return;
        var size = Math.max(120, Math.round(window.innerHeight * 0.18));
        try { sc.wheel(dir * size); } catch(e) {}
    }

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

    function loadCredits(movie) {
        try {
            if (movie.credits && ((movie.credits.cast && movie.credits.cast.length) || (movie.credits.crew && movie.credits.crew.length))) {
                return Promise.resolve(movie.credits);
            }
            var id = movie.id || movie.tmdb_id;
            if (!id) return Promise.resolve(null);
            if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.credits === 'function') {
                return new Promise(function(res){
                    Lampa.TMDB.credits(id, function(d){ res(d && !d.status_code ? d : null); }, function(){ res(null); });
                });
            }
        } catch(e) {}
        return Promise.resolve(null);
    }

    function tmdbKey() {
        try { if (window.Lampa && Lampa.TMDB && Lampa.TMDB.key) return Lampa.TMDB.key; } catch(e) {}
        return '4ef0d7355d9ffb5151e987764708ce96';
    }

    function curLangCode() {
        try {
            var l = (window.Lampa && Lampa.Storage) ? Lampa.Storage.get('language', 'ru') : 'ru';
            return (l || 'ru') + '-' + (l || 'ru').toUpperCase();
        } catch(e) { return 'ru-RU'; }
    }

    function tmdbGet(path, lang) {
        return new Promise(function(res){
            try {
                var langCode = lang || curLangCode();
                var url = 'https://api.themoviedb.org/3' + path + (path.indexOf('?') > -1 ? '&' : '?') + 'language=' + langCode + '&api_key=' + tmdbKey();
                if (window.Lampa && Lampa.Request && typeof Lampa.Request.get === 'function') {
                    Lampa.Request.get(url, function(d){ res(d && d.status_code ? null : d); }, function(){ res(null); }, { dataType: 'json' });
                } else if (typeof fetch !== 'undefined') {
                    fetch(url).then(function(r){ return r.json(); }).then(function(d){ res(d && d.status_code ? null : d); }).catch(function(){ res(null); });
                } else res(null);
            } catch(e) { res(null); }
        });
    }

    function mapUSRating(s) {
        return { 'G':0,'PG':7,'PG-13':13,'R':17,'NC-17':17,'TV-MA':17,'TV-14':14,'TV-PG':7,'TV-G':0,'TV-Y7':7,'TV-Y':0,'MA':17,'18':18,'16':16,'12':12,'12A':12,'15':15 }[(s || '').toUpperCase().trim()] || null;
    }

    function loadMeta(movie) {
        var id = movie.id || movie.tmdb_id;
        if (!id) return Promise.resolve({ kw: [], age: null, reviews: [], hasTrailer: false, enOv: '', popularity: 0 });
        if (_metaCache[id]) return Promise.resolve(_metaCache[id]);
        if (Object.keys(_metaCache).length > 120) _metaCache = {};
        var type = mediaType(movie);
        return Promise.all([
            tmdbGet('/' + type + '/' + id + '/keywords'),
            tmdbGet('/' + type + '/' + id + '/content_ratings'),
            tmdbGet('/' + type + '/' + id + '/reviews'),
            tmdbGet('/' + type + '/' + id + '/videos'),
            tmdbGet('/' + type + '/' + id, 'en-US'),
            tmdbGet('/' + type + '/' + id)
        ]).then(function(arr){
            var kw = [];
            if (arr[0]) (arr[0].keywords || arr[0].results || []).forEach(function(k){ if (k && k.name) kw.push(k.name.toLowerCase()); });
            var age = null;
            if (arr[1] && arr[1].results) {
                var ru = arr[1].results.find(function(x){ return x.iso_3166_1 === 'RU'; });
                var us = arr[1].results.find(function(x){ return x.iso_3166_1 === 'US'; });
                if (ru && ru.rating) { var n = parseInt(ru.rating); if (!isNaN(n)) age = n; }
                if (age === null && us && us.rating) age = mapUSRating(us.rating);
                if (age === null && arr[1].results.length) {
                    var f = arr[1].results[0];
                    if (f.rating) { var n2 = parseInt(f.rating); age = !isNaN(n2) ? n2 : mapUSRating(f.rating); }
                }
            }
            var reviews = [];
            if (arr[2] && arr[2].results) {
                reviews = arr[2].results.slice(0, 6).map(function(r){
                    return { author: r.author || 'Аноним', text: (r.content || '').replace(/<[^>]+>/g, '').trim() };
                }).filter(function(r){ return r.text.length > 20; });
            }
            var hasTrailer = false;
            if (arr[3] && arr[3].results) {
                hasTrailer = arr[3].results.some(function(v){ return v.type === 'Trailer' && v.site === 'YouTube'; });
            }
            var enOv = (arr[4] && arr[4].overview) ? arr[4].overview : '';
            var popularity = (arr[5] && arr[5].popularity) ? arr[5].popularity : 0;
            var r = { kw: kw, age: age, reviews: reviews, hasTrailer: hasTrailer, enOv: enOv, popularity: popularity };
            _metaCache[id] = r;
            return r;
        });
    }

    function hasKw(ctx, re) { return ctx.kw.some(function(k){ return re.test(k); }); }

    function reviewStats(reviews) {
        var posRe = /шедевр|великолепн|потрясающ|восхитит|блестящ|лучш|мощн|гениальн|masterpiece|brilliant|amazing|great|best|loved|perfect|outstanding|must-watch|замечательн|превосходн|отличн|весел|смешн|funny|понрав|советую|хорош|восторг|класс|рекомендую|отпад|fire|awesome|fantastic|superb|excellent/i;
        var negRe = /скучн|ужасн|провал|разочаров|слаб|затян|бессмысл|плох|boring|bad|worst|terrible|awful|disappoint|waste|dull|pointless|утомительн|неинтересн|отвратительн|глуп|слабеньк|shallow|mediocre|overrated|разочаровал|не рекомендую|уныл/i;
        var pos = 0, neg = 0;
        reviews.forEach(function(r){
            var t = r.text.toLowerCase();
            var p = (t.match(posRe) || []).length, n = (t.match(negRe) || []).length;
            if (p > n) pos++; else if (n > p) neg++;
        });
        var tone = (pos === 0 && neg === 0) ? null : (pos > neg ? 'pos' : (neg > pos ? 'neg' : 'mix'));
        return { total: reviews.length, pos: pos, neg: neg, tone: tone };
    }

    function readDomSignals(key) {
        if (_domCache && _domCache.key === key) return _domCache.data;
        var out = { mm: {}, moods: [], ok: false, age: null, reviews: [] };
        try {
            var txt = (document.body.innerText || '').substring(0, 25000);
            var amAll = txt.match(/\b(0|6|12|16|18)\+/g);
            if (amAll) {
                for (var i = 0; i < amAll.length; i++) {
                    var v3 = parseInt(amAll[i], 10);
                    if (!isNaN(v3) && (out.age === null || v3 > out.age)) out.age = v3;
                }
            }
            var mm = {}, found = 0;
            DOM_METRICS.forEach(function(p){
                var r = txt.match(p.re);
                if (r) { mm[p.key] = parseFloat(r[1].replace(',', '.')); found++; }
            });
            var moods = [];
            var mi = txt.indexOf('Настроения');
            if (mi > -1) {
                var chunk = txt.substring(mi + 10, mi + 1600);
                var re = /(\d{1,3})\s*%\s*\n?\s*([А-Яа-яЁёA-Za-z][А-Яа-яЁёA-Za-z….-]{2,24})/g, r2;
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

    function analyze(rawMovie) {
        var movie = sanitizeMovie(rawMovie);
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

            var age = dom.age !== null ? dom.age : meta.age;

            function dim(kwRe, ovRe) {
                var k = hasKw(ctx, kwRe);
                var o = !!ovRe && inAnyText(ovBoth, ovRe);
                return { k: k, o: o };
            }

            var dViol = dim(/violenc|violent|gore|murder|blood|tortur|brutal|weapon|massacre|execution|stab|slaughter|gunfight|shootout|hitman|serial killer|battle/, /убийств|насил|жесток|кровь|крови|кровью|кровав|кровопролит|стрельб|перестрел|взрыв|оружи|резн|террор|бойн/);
            var dDrugs = dim(/drug|meth lab|methamphetamine|crystal meth|cocaine|heroin|marijuan|cannabis|narcotic|addiction|overdose|dealer|cartel|crack|lsd|ecstasy|opium/, /метамфетам|амфетам|наркот|кокаин|героин|марихуан|лсд|экстази|опиум|дилер|картел|зависимост|зелье|травк|варит/);
            var dNud = dim(/nudity|topless|strip club|stripper|full frontal|rear nudity/, /обнаж|нагот|голы|стриптиз/);
            var dSex = dim(/sex scene|sexual content|orgy|prostitut|erotic|one night stand|hooker|threesome|explicit/, /эротик|откровенн|проститут|интим|секс|постельн|презерватив/);
            var dSmoke = dim(/smoking|cigarette|cigar/, /курени|сигарет|табак/);
            var dAlc = dim(/alcohol|drunkenness|drunk|booze|hangover|beer|wine|vodka|whiskey/, /алкогол|водк|виски|выпив|пьян|похмел/);
            var dProf = dim(/profanity|strong language|swearing|f word|vulgarity/, /нецензур|сквернослов|матерщин/);
            var dSuic = dim(/suicide|self harm|suicidal/, /суицид|самоубийств|покончи/);
            var dGamb = dim(/gambl|casino|poker|betting|bookmaker|lottery|roulette|slot machine|blackjack/, /азарт|казино|ставк|покер|рулетк|лотере|букмекер/);
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

            if (meta.popularity > 100) add('card','pro','🔥 Очень популярно', 15, 'popular');
            else if (meta.popularity > 30) add('card','pro','📈 Популярно', 8, 'popular');

            if (votes >= 3000 && adj >= 8.0) add('card','pro','✨ Высокий рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' голосов)', 30, 'ratehi');
            else if (votes >= 500 && adj >= cfg.min_rating) add('card','pro','✨ Хороший рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' голосов)', 20, 'ratehi');
            else if (votes >= 100 && adj >= cfg.min_rating) add('card','pro','✨ Достойный рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' голосов)', 14, 'ratehi');
            if (votes > 0 && votes < 1500 && adj >= 7.6) add('card','pro','🔍 Скрытая жемчужина', 12);
            if (votes >= 2000 && adj >= 7.8 && yr > 0 && yr <= now - 5) add('card','pro','🏛 Культурное признание', 12);
            if (yr === now) add('card','pro','🆕 Новинка ' + yr + ' года', 6, 'fresh');
            if (votes > 0 && votes < 100) add('card','con','❓ Мало оценок (' + votes + ')', 14, 'rateunc');
            if (votes === 0) add('card','con','⚠️ Нет оценок', 16, 'rateunc');
            if (votes >= 100 && adj < cfg.min_rating) add('card','con','📉 Рейтинг ниже порога: ' + rating.toFixed(1), 22, 'ratelow');
            else if (votes >= 50 && rating > 0 && rating < 5) add('card','con','📉 Низкий рейтинг: ' + rating.toFixed(1), 26, 'ratelow');
            if (runtime > 0 && runtime <= 95) add('card','pro','⏱ Короткометражка: ' + runtime + ' мин', 7, 'runtime');
            else if (runtime > 150) add('card','con','⌛ Долгий хронометраж: ' + runtime + ' мин', 12, 'runtime');
            if (/CAM|TS|HDCAM|HDRIP|TELECINE|SCR|WORKPRINT|TELESYNC/i.test(q)) add('card','con','📺 Экранная копия / низкое качество', 26, 'quality');
            else if (/4K|UHD|2160p/i.test(q)) add('card','pro','🎥 Доступно в 4K UHD', 10, 'quality');
            else if (q) add('card','pro','🎥 Высокое качество (' + q + ')', 7, 'quality');

            if (mG.length) add('user','con','⛔ Нелюбимые жанры: ' + mG.join(', '), 40);
            if (mA.length) add('user','con','⛔ Нелюбимые актёры: ' + uniq(mA).slice(0,2).join(', '), 35);
            if (mD.length) add('user','con','⛔ Нелюбимые авторы: ' + uniq(mD).slice(0,2).join(', '), 35);

            if (familyOK && isAnim) add('tmdb','pro','🧸 Детский' + (age !== null ? ' (' + age + '+)' : ''), 16, 'family');
            else if (familyOK) add('tmdb','pro','👨‍👩‍👧 Семейный фильм' + (age !== null ? ' (' + age + '+)' : ''), 16, 'family');
            if (age !== null && age >= 18) add('tmdb','con','🔞 Возрастное ограничение 18+', 14, 'age');
            else if (age !== null && age >= 16) add('tmdb','con','🔞 Возрастное ограничение 16+', 12, 'age');
            if (isAnim && !familyOK) add('tmdb','con','🎭 Взрослая анимация' + (age !== null ? ' (' + age + '+)' : ''), 14, 'adultanim');

            if (cViol >= 50) add('tmdb','con','🔪 Сцены насилия и жестокости', 16, 'violence');
            if (cDrugs >= 30) add('tmdb','con','💉 Упоминание веществ/наркотиков', 14, 'drugs');
            if (cSex >= 30) add('tmdb','con','🫣 Откровенные сцены', 12, 'sex');
            if (cProf >= 40) add('tmdb','con','🤬 Ненормативная лексика', 10, 'lang');
            if (cFear >= 40) add('moods','con','😱 Слишком страшно / хоррор', 14, 'scare');
            else if ((mm.fear||0) >= 3.5) add('moods','pro','😬 Напряжённый сюжет', 9, 'tension');
            if (cSuic >= 40) add('tmdb','con','⚠️ Тяжёлые темы / суицид', 16, 'suic');
            if (cAlc >= 40) add('tmdb','con','🍺 Сцены алкоголя/опьянения', 6, 'alc');
            if (cSmoke >= 40) add('tmdb','con','🚬 Сцены курения', 5, 'smoke');
            if (cGamb >= 40) add('tmdb','con','🎰 Азартные игры', 10, 'gamb');
            if (cCrime >= 50) add('tmdb','con','⚖️ Криминальный фокус', 8, 'crime');
            if (dPsych.k || dPsych.o) add('tmdb','con','🧠 Психологическое давление', 8, 'psych');
            if (dIll.k || dIll.o) add('tmdb','con','🏥 Тема неизлечимой болезни', 6, 'ill');
            if (dWar.k || dWar.o) add('tmdb','con','🎖 Военные действия', 8, 'war');
            if (cChild >= 50) add('tmdb','con','🚸 Жестокость к детям', 18, 'childabuse');
            if (dDarkCom) add('tmdb','pro','🖤 Чёрный юмор и сатира', 8, 'darkcom');
            if (meta.hasTrailer) add('tmdb','pro','▶ Есть официальный трейлер', 5);
            if (hasGenre(genres, /documentary|документ/i)) add('tmdb','pro','🦉 Документальное кино', 8);

            if (mm.pace >= 6.5) add('moods','pro','⚡ Высокий темп и динамика', 12);
            else if (mm.pace > 0 && mm.pace <= 2.5 && runtime > 120) add('moods','con','🐢 Очень размеренный темп', 8);
            if (mm.action >= 6) add('moods','pro','💥 Насыщенный экшен', 12);
            if (mm.sadness >= 6) add('moods','pro','😢 Трогательный и эмоциональный', 10, 'sad');
            moods.forEach(function(md){
                var n = (md.name || '').toLowerCase();
                if (/вес[её]л|комедий|юмор/.test(n) && md.pct >= 20) add('moods','pro','😂 Развеселит', 14, 'fun');
                else if (/напряжен/.test(n) && md.pct >= 30) add('moods','pro','🔥 Напряжённый', 8, 'tension');
                else if (/тревож/.test(n) && md.pct >= 40) add('moods','pro','😰 Тревожная интрига', 6, 'anxiety');
                else if (/задумчив|драматич/.test(n) && md.pct >= 25) add('moods','pro','🎭 Глубокий смысл', 8);
                else if (/романтич/.test(n) && md.pct >= 18) add('moods','pro','❤️ Романтичное настроение', 8);
                else if (/загадоч/.test(n) && md.pct >= 15) add('moods','pro','🕵️ Интригующая тайна', 8);
                else if (/ностальг/.test(n) && md.pct >= 8) add('moods','pro','🕰 Ностальгический вайб', 6);
                else if (/груст/.test(n) && md.pct >= 20) add('moods','con','😔 Не для ранимых', 6, 'sad');
            });
            if (hasGenre(genres, /comedy|комедия/i) && (mm.sadness || 0) <= 3) add('moods','pro','😂 Комедийный жанр', 10, 'fun');

            if (rt.total >= 2 && rt.tone === 'pos') add('reviews','pro','💬 ' + who + ' в восторге', 20, 'rev');
            else if (rt.total >= 2 && rt.tone === 'neg') add('reviews','con','💬 ' + who + ' раскритиковали', 22, 'rev');
            else if (rt.total >= 2 && rt.tone === 'mix') add('reviews','pro','💬 Мнения разделились', 10, 'rev');

            if (local.inFavorite && local.favList === 'viewed') add('lampa','con','👁 Уже просмотрено вами', 8, 'lampa');
            else if (local.inFavorite) add('lampa','pro','🔖 Сохранено в закладках', 8, 'lampa');
            if (local.viewedPercent >= 90) add('lampa','con','👁 Досмотрено до конца (' + local.viewedPercent + '%)', 8, 'lampa');
            else if (local.viewedPercent >= 10) add('lampa','con','⏸ Приостановлено на ' + local.viewedPercent + '%', 12, 'lampa');

            var CAPS = { card: 55, user: 50, tmdb: 45, moods: 40, reviews: 28, lampa: 18, sparkle: 60 };
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
            var activeSrc = 1 + (metaRich ? 1 : 0) + (rt.total >= 2 ? 1 : 0) + (dom.ok || moods.length ? 1 : 0) + (local.inFavorite || local.viewedPercent > 0 ? 1 : 0);
            var lowConf = activeSrc <= 2;
            if (lowConf) score = Math.round(score * 0.6);
            if (score > 100) score = 100; if (score < -100) score = -100;

            var meterW = (sumPro + sumCon) > 0 ? Math.round(100 * sumPro / (sumPro + sumCon)) : 50;
            if (meterW < 5) meterW = 5; if (meterW > 95) meterW = 95;

            var vClass = score >= 0 ? 'yes' : 'no';
            var vWord = score >= 0 ? 'СТОИТ' : 'НЕ СТОИТ';

            var sortF = function(a,b){ return b.w - a.w; };
            var pros = F.filter(function(f){ return f.kind === 'pro'; }).sort(sortF).map(function(f){ return f.text; });
            var cons = F.filter(function(f){ return f.kind === 'con'; }).sort(sortF).map(function(f){ return f.text; });
            if (!pros.length) pros.push('ℹ️ Нет данных для анализа');
            if (!cons.length) cons.push((blG.length || blA.length || blD.length) ? '✅ Фильтры и ограничения чисты' : '✅ Минусов нет');

            var mPace = mm.pace > 0 ? mm.pace : (runtime > 140 ? 4.5 : (hasGenre(genres, /action|боевик|триллер/i) ? 7.8 : 6.2));
            var mFear = mm.fear > 0 ? mm.fear : (hasGenre(genres, /ужасы|хоррор/i) ? 8.8 : (hasGenre(genres, /триллер/i) ? 7.2 : 2.5));
            var mAction = mm.action > 0 ? mm.action : (hasGenre(genres, /боевик|action|приключен/i) ? 8.4 : 4.2);
            var mViol = (age !== null && age >= 18) ? 8.2 : (hasGenre(genres, /ужасы|криминал/i) ? 7.5 : 3.8);
            var mDrama = mm.sadness > 0 ? mm.sadness : (hasGenre(genres, /драма|биография/i) ? 8.0 : 4.5);
            var mComplex = (hasGenre(genres, /фантастика|детектив|mystery/i) || inText(ovRu, /twist|mind|сон|подсознан/i)) ? 8.4 : 5.8;
            var mHumor = hasGenre(genres, /комедия|comedy/i) ? 8.5 : (hasGenre(genres, /ужасы|драма/i) ? 2.0 : 4.0);
            var mImmersion = rating >= 7.8 ? 8.9 : (rating >= 6.8 ? 7.2 : 5.4);

            var atmosMetrics = [
                { key: 'pace', name: 'Темп повествования', score: Math.min(10, Math.max(1, +(mPace).toFixed(1))), desc: mPace >= 7 ? 'Динамичный и насыщенный' : (mPace <= 4 ? 'Размеренный и медитативный' : 'Умеренный темп') },
                { key: 'fear', name: 'Страх и саспенс', score: Math.min(10, Math.max(1, +(mFear).toFixed(1))), desc: mFear >= 7.5 ? 'Высокое психологическое напряжение' : (mFear >= 5 ? 'Умеренная тревожность' : 'Без пугающих элементов') },
                { key: 'action', name: 'Экшен и зрелищность', score: Math.min(10, Math.max(1, +(mAction).toFixed(1))), desc: mAction >= 7.5 ? 'Масштабные сцены и трюки' : 'Камерная подача' },
                { key: 'violence', name: 'Насилие и жестокость', score: Math.min(10, Math.max(1, +(mViol).toFixed(1))), desc: mViol >= 7.5 ? '18+ контент, жесткие сцены' : 'Мягкий возрастной ценз' },
                { key: 'drama', name: 'Эмоциональность / Драма', score: Math.min(10, Math.max(1, +(mDrama).toFixed(1))), desc: mDrama >= 7 ? 'Глубокий эмоциональный накал' : 'Легкий развлекательный тон' },
                { key: 'complexity', name: 'Сложность сюжета', score: Math.min(10, Math.max(1, +(mComplex).toFixed(1))), desc: mComplex >= 7.5 ? 'Нелинейный сюжет и твисты' : 'Понятная линейная история' },
                { key: 'humor', name: 'Юмор и легкость', score: Math.min(10, Math.max(1, +(mHumor).toFixed(1))), desc: mHumor >= 7 ? 'Много шуток и комедийных ситуаций' : 'Серьезная мрачная атмосфера' },
                { key: 'immersion', name: 'Атмосферность и визуал', score: Math.min(10, Math.max(1, +(mImmersion).toFixed(1))), desc: mImmersion >= 8 ? 'Глубокое визуальное погружение' : 'Стандартный продакшн' }
            ];

            var targetAudience = '';
            var notSuitableFor = '';
            if (hasGenre(genres, /ужасы|хоррор/i) || inText(ovRu, /одержим|сталкер|маньяк|пугающ/i)) {
                targetAudience = 'Любителям психологических триллеров, напряжённых историй про сталкеров и фатальную одержимость с непредсказуемой развязкой.';
                notSuitableFor = 'Не рекомендуется тем, кто избегает тяжёлого психологического давления, скримеров и откровенных сцен насилия.';
            } else if (hasGenre(genres, /фантастика|sci-fi/i) && rating >= 7.5) {
                targetAudience = 'Ценителям сложного научно-фантастического кино, концептуальных идей и глубоких визуальных миров.';
                notSuitableFor = 'Не подходит любителям простых прямолинейных сюжетов.';
            } else if (isAnim || hasFamilyGenre) {
                targetAudience = 'Для уютного семейного просмотра, любителей доброй анимации, сказочной эстетики и юмора.';
                notSuitableFor = 'Не подходит тем, кто ищет жесткий взрослый экшен или мрачный реализм.';
            } else if (rating >= 7.8) {
                targetAudience = 'Поклонникам качественного кинематографа с сильной актёрской игрой, драматургией и глубоким смыслом.';
                notSuitableFor = 'Зрителям, ищущим фоновое легкое видео без необходимости вникать в сюжет.';
            } else {
                targetAudience = 'Зрителям, заинтересованным в легком вечернем просмотре фильмов данного жанра.';
                notSuitableFor = 'Искушенным критикам с высокими требованиями к сценарию.';
            }

            return {
                movie: movie, pros: pros, cons: cons, review: rt, score: score, norm: meterW,
                vClass: vClass, vWord: vWord, metaRich: metaRich,
                atmosphere: { metrics: atmosMetrics, targetAudience: targetAudience, notSuitableFor: notSuitableFor }
            };
        });
    }

    var PIPS = {
        1: [[50,50]], 2: [[34,34],[66,66]], 3: [[30,30],[50,50],[70,70]],
        4: [[34,34],[66,34],[34,66],[66,66]], 5: [[34,34],[66,34],[50,50],[34,66],[66,66]],
        6: [[34,30],[66,30],[34,50],[66,50],[34,70],[66,70]]
    };

    function diceSVG(n) {
        var p = PIPS[n] || PIPS[1], c = '';
        for (var i = 0; i < p.length; i++) {
            c += '<circle cx="' + p[i][0] + '" cy="' + p[i][1] + '" r="9.4" fill="#e53935"/>';
        }
        return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="5" y="5" width="90" height="90" rx="20" fill="#ffffff" stroke="#b0bec5" stroke-width="3"/>' +
            c + '</svg>';
    }

    function rndFace() { return 1 + Math.floor(Math.random() * 6); }
    function setFace(dice, f) { dice.html('<span class="sw-dice-core">' + diceSVG(f) + '</span>'); }

    function buildReadyInner(a) {
        var atmos = a.atmosphere || { metrics: [], targetAudience: '' };
        var metricsHtml = (atmos.metrics || []).map(function(m){
            var scoreCls = m.score >= 7.5 ? 'hi' : (m.score >= 5 ? 'mid' : 'ok');
            var fillBg = m.score >= 7.5 ? 'linear-gradient(90deg,#c62828,#ef5350)' : (m.score >= 5 ? 'linear-gradient(90deg,#e65100,#fb8c00)' : 'linear-gradient(90deg,#1f9d5b,#2fd57c)');
            return '<div class="sw-metric-card">' +
                '<div class="sw-metric-header">' +
                '<span class="sw-metric-name">' + esc(m.name) + '</span>' +
                '<span class="sw-metric-score ' + scoreCls + '">' + m.score.toFixed(1) + ' <small style="font-size:0.7em;opacity:0.7">/ 10</small></span>' +
                '</div>' +
                '<div class="sw-metric-bar-bg"><div class="sw-metric-bar-fill" style="width:' + (m.score * 10) + '%;background:' + fillBg + '"></div></div>' +
                (m.desc ? '<div class="sw-metric-desc">' + esc(m.desc) + '</div>' : '') +
                '</div>';
        }).join('');

        var audienceHtml = '<div class="sw-audience-box">' +
            '<div class="sw-audience-title">🎯 Кому подходит</div>' +
            '<p class="sw-audience-text">' + esc(atmos.targetAudience || 'Любителям качественного кино.') + '</p>' +
            (atmos.notSuitableFor ? '<div class="sw-audience-warn">⚠️ ' + esc(atmos.notSuitableFor) + '</div>' : '') +
            '</div>';

        return '<div class="sw-dossier">' +
            '<div class="sw-verdict-word ' + a.vClass + '" id="sw-vword">' + esc(a.vWord) + '</div>' +
            '<div class="sw-meter"><div class="sw-meter-fill ' + a.vClass + '" data-w="' + a.norm + '"></div></div></div>' +
            '<div class="sw-dicebtn selector sw-focusable" id="sw-dice-btn">' +
            '<span class="sw-dice" id="sw-dice"><span class="sw-dice-core">' + diceSVG(1) + '</span></span>' +
            '<span class="sw-dice-label" id="sw-dice-label">довериться случаю</span></div>' +
            '<div class="sw-tabs">' +
            '<div class="sw-tab-btn selector sw-focusable active" data-tab="proscons">' +
            '<span class="sw-tagplus">ПЛЮСЫ</span><span class="sw-tab-i">и</span><span class="sw-tagminus">МИНУСЫ</span>' +
            '</div>' +
            '<div class="sw-tab-btn selector sw-focusable" data-tab="atmos">' +
            '<span class="sw-tab-atmos">🌡️ атмосфера</span>' +
            '</div>' +
            '</div>' +
            '<div class="sw-tab-pane active" id="sw-pane-proscons">' +
            '<div class="sw-columns">' +
            '<div class="sw-col pros"><div class="sw-col-title">Плюсы</div><ul class="sw-list">' + a.pros.map(function(p){ return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
            '<div class="sw-col cons"><div class="sw-col-title">Минусы</div><ul class="sw-list">' + a.cons.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' +
            '</div></div>' +
            '<div class="sw-tab-pane" id="sw-pane-atmos">' +
            '<div class="sw-metrics-grid">' + metricsHtml + '</div>' +
            audienceHtml +
            '</div>';
    }

    function bindTabs(html) {
        var tabBtns = html.find('.sw-tab-btn');
        function activateTab(target) {
            tabBtns.removeClass('active');
            tabBtns.filter('[data-tab="' + target + '"]').addClass('active');
            html.find('.sw-tab-pane').removeClass('active');
            html.find('#sw-pane-' + target).addClass('active');
        }
        tabBtns.on('hover:enter', function(){
            var target = $(this).attr('data-tab');
            activateTab(target);
            window._sw_activeInteractive = this;
            try {
                var sc = modalScroll();
                if (sc && sc.update) sc.update($(this), false);
            } catch(e) {}
        });
        tabBtns.on('hover:hover', function(){ window._sw_activeInteractive = this; });
        tabBtns.on('click', function(){
            var target = $(this).attr('data-tab');
            activateTab(target);
            window._sw_activeInteractive = this;
        });
    }

    function bindDice(html) {
        var btn = html.find('#sw-dice-btn');
        var dice = html.find('#sw-dice');
        var label = html.find('#sw-dice-label');
        if (!btn.length || !dice.length || !label.length) return;

        function rollDice() {
            if (window._sw_rolling) return;
            window._sw_rolling = true;

            html.find('.sw-tab-btn').addClass('sw-disabled');

            var choice = SW_DICE_VERDICTS[Math.floor(Math.random() * SW_DICE_VERDICTS.length)];
            var isYes = choice === 'СТОИТ';
            var final = isYes ? 'смотреть' : 'не смотреть';

            label.removeClass('res-yes res-no').addClass('hide');
            btn.addClass('shake');
            dice.addClass('sw-spin');

            setTimeout(function(){
                if (document.body.contains(btn[0])) {
                    btn.removeClass('shake');
                    dice.removeClass('sw-spin');
                    setFace(dice, rndFace());
                    label.text(final).removeClass('hide').addClass(isYes ? 'res-yes' : 'res-no');
                    html.find('.sw-tab-btn').removeClass('sw-disabled');
                }
                window._sw_rolling = false;
            }, 800);
        }

        btn.on('hover:hover', function(){ window._sw_activeInteractive = btn[0]; });
        btn.on('hover:enter', rollDice);
        btn.on('click', rollDice);
    }

    function restorePrev() {
        // Не используется, так как мы не переключали контроллер вручную.
        // Оставлено для совместимости на случай будущих изменений.
    }

    function clearLoader() {
        if (window._sw_loaderTimer) { clearInterval(window._sw_loaderTimer); window._sw_loaderTimer = null; }
    }

    function cleanupModal() {
        window._sw_rolling = false;
        window._sw_currentModalHtml = null;
        window._sw_activeInteractive = null;
        clearLoader();
    }

    function doClose() {
        if (window._sw_closed) return;
        window._sw_closed = true;
        cleanupModal();
        try { if (window.Lampa && Lampa.Modal) Lampa.Modal.close(); } catch(e) {}
        // Не вызываем restorePrev, т.к. Lampa сама вернёт контроллер.
    }

    function registerController() {
        // Контроллер больше не используется, так как Lampa сама управляет модалкой.
        // Оставляем пустую функцию для совместимости.
    }

    function showModal(rawMovie) {
        try {
            var movie = sanitizeMovie(rawMovie);
            try {
                if (getSetting('reset_cache', '0') === '1') {
                    _metaCache = {}; _domCache = null;
                    if (window.Lampa && Lampa.Storage) Lampa.Storage.set(PLUGIN_ID + '_reset_cache', '0');
                }
            } catch(e) {}

            var cfg = getSettings();
            var title = esc(movie.title || movie.name || 'Фильм');
            window._sw_closed = false;

            var phases = [
                'Сканирую вселенную кино…',
                'Анализирую скрытые смыслы…',
                'Проверяю настроение зрителей…',
                'Считаю аргументы за и против…',
                'Выношу окончательный вердикт…'
            ];
            var html = $('<div class="sw-wrap"><div id="sw-body"><div class="sw-loader"><div class="sw-loader-emoji">🔍</div><div class="sw-loader-text">' + phases[0] + '</div><div class="sw-loader-progress"></div></div></div></div>');
            html.css('font-size', cfg.font_scale + 'px');
            window._sw_currentModalHtml = html;
            window._sw_activeInteractive = null;

            var pi = 0;
            window._sw_loaderTimer = setInterval(function(){
                pi = (pi + 1) % phases.length;
                var t = html.find('.sw-loader-text');
                if (t.length) t.text(phases[pi]);
            }, 650);

            if (window.Lampa && Lampa.Modal && typeof Lampa.Modal.open === 'function') {
                Lampa.Modal.open({
                    title: 'Стоит ли смотреть: ' + title,
                    html: html,
                    size: 'large',
                    onBack: function(){
                        if (window._sw_closed) return;
                        window._sw_closed = true;
                        cleanupModal();
                        // Lampa сама закроет модалку при возврате, не нужно вызывать Lampa.Modal.close()
                        // restorePrev не нужен
                    }
                });
            }

            analyze(movie).then(function(a){
                clearLoader();
                html.find('#sw-body').html('<div class="sw-body">' + buildReadyInner(a) + '</div>');
                bindDice(html);
                bindTabs(html);
                setTimeout(function(){
                    html.find('#sw-vword').addClass('appear');
                    html.find('.sw-meter-fill').each(function(){ this.style.width = (this.getAttribute('data-w') || 50) + '%'; });
                    html.find('.sw-list li').each(function(i){
                        var li = $(this);
                        setTimeout(function(){ li.addClass('appear'); }, i * 30);
                    });
                }, 60);
            }).catch(function(err){
                clearLoader();
                console.error('[SW] analyze:', err);
                html.find('#sw-body').html('<div class="sw-body" style="text-align:center;padding:40px 20px;color:#ff5252">⚠️ Ошибка анализа данных</div>');
            });
        } catch(e) { console.error('[SW] showModal:', e); }
    }

    function addBtn(el, rawMovie) {
        try {
            if (!el || !el.length || el.find('.sw-custom-button-enhanced').length) return;
            var movie = sanitizeMovie(rawMovie);
            var btn = $('<div class="full-start__button selector sw-custom-button-enhanced" data-type="should_watch" tabindex="0"><div class="full-start__icon">' + ICON + '</div><span>Стоит ли</span></div>');
            btn.on('hover:enter', function(){ showModal(movie); });
            btn.on('click', function(){ showModal(movie); });
            var anchor = el.find('.view--torrent,.view--online,.view--trailer').last();
            if (anchor.length) anchor.after(btn);
            else {
                var fb = el.find('.full-start__buttons,.full-start-new__buttons,.full-card__buttons');
                if (fb.length) fb.append(btn);
                else el.append(btn);
            }
        } catch(e) { console.error('[SW] addBtn:', e); }
    }

    function startPlugin() {
        if (!window.Lampa) { console.warn('[SW] Lampa not found. Plugin disabled.'); return; }
        try {
            var ua = navigator.userAgent || '';
            var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            var isTV = /TV|SmartTV|HbbTV|Web0S|webOS|Tizen|NetCast|Viera|BRAVIA|CrKey|AFT|FireTV|POVIDE|Maple/i.test(ua);
            window._sw_blocknav = !hasTouch || isTV;
        } catch(e) { window._sw_blocknav = true; }

        try { initSettings(); } catch(e) {}
        try { injectCSS(); } catch(e) {}
        console.log('[ShouldWatch] v52.3 initialized: fixed exit, dice shake, improved UI.');
    }

    try {
        if (window.appready) startPlugin();
        else if (window.Lampa && Lampa.Listener) {
            Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') startPlugin(); });
        } else {
            $(document).ready(startPlugin);
        }
    } catch(e) {
        if (document.readyState === 'complete') startPlugin();
        else window.addEventListener('load', startPlugin);
    }
})();
