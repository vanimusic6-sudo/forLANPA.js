/**
 * Lampa Plugin: "Стоит ли смотреть?" (Should Watch?)
 * Version: 50.3 (Ultimate Polish, TV D-Pad Hybrid Navigation, Strict Binary Verdict)
 * Compliant with Lampa API, Memory-safe, Pure jQuery/DOM, Zero external dependencies.
 */
(function () {
    'use strict';
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;
    window.should_watch_plugin_enhanced = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var SETTINGS_FLAG = 'sw_settings_ready_v50';
    var ICON = '<svg viewBox="0 0 24 24" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>';
    var DISPLAY = '"Trebuchet MS","Segoe UI",system-ui,-apple-system,sans-serif';
    var COND = '"Oswald","Roboto Condensed","Arial Narrow",' + DISPLAY;
    var GENRE_ID_ANIM = 16, GENRE_ID_FAMILY = 10751, GENRE_ID_KIDS = 10762;

    // Strict Binary Verdicts (Technical Requirement: exclude 'СПОРНО')
    var SW_DICE_VERDICTS = ['СТОИТ', 'НЕ СТОИТ'];

    // Safe Fallback Demo Data for crash prevention
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
    window._sw_closingFromController = false;
    window._sw_loaderTimer = null;
    window._sw_scrollRaf = null;
    window._sw_blocknav = false;
    window._sw_activeInteractive = null;
    window._sw_keyBound = false;

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
        if (document.getElementById('sw-plugin-styles-enhanced')) return;
        var s = document.createElement('style');
        s.id = 'sw-plugin-styles-enhanced';
        s.innerHTML =
            '.sw-custom-button-enhanced{cursor:pointer;transition:background .25s cubic-bezier(.22,1,.36,1),color .25s ease,transform .25s ease;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;user-select:none}' +
            '.sw-custom-button-enhanced.focus{background:rgba(255,255,255,.22)!important;color:#fff!important;transform:scale(1.03);box-shadow:0 0 0 2px rgba(255,255,255,.4)}' +
            '.sw-modal-content{padding:26px 30px 42px;color:#e9ebeb;font-family:' + DISPLAY + ';font-size:20px;box-sizing:border-box;max-height:86vh;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-y}' +
            '.sw-modal-content::-webkit-scrollbar{width:6px}.sw-modal-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:10px}' +
            '.sw-body{animation:swFadeIn .45s cubic-bezier(.22,1,.36,1)}' +
            '@keyframes swFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
            '.sw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:60px 20px;min-height:42vh;color:#9aa1a6}' +
            '.sw-loader-emoji{font-size:3.2em;line-height:1;animation:swFloat 2.4s ease-in-out infinite}' +
            '@keyframes swFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}' +
            '.sw-loader-text{font-size:1em;font-weight:600;min-height:1.5em;text-align:center;color:#cbd5e1;letter-spacing:.02em}' +
            '.sw-loader-progress{width:220px;height:4px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;position:relative;margin-top:6px}' +
            '.sw-loader-progress::after{content:"";position:absolute;left:-100%;top:0;height:100%;width:100%;background:linear-gradient(90deg,transparent,#4caf50,transparent);animation:swSlide 1.3s ease-in-out infinite}' +
            '@keyframes swSlide{0%{left:-100%}100%{left:100%}}' +
            '.sw-dossier{position:relative;background:rgba(40,45,50,0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:32px 36px;margin-bottom:20px;box-shadow:0 8px 32px rgba(0,0,0,.4);animation:swRise .5s cubic-bezier(.22,1,.36,1) both}' +
            '@keyframes swRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}' +
            '.sw-badges{position:absolute;top:22px;right:24px;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:55%}' +
            '.sw-mode-badge{display:inline-flex;align-items:center;gap:6px;font-size:.65em;padding:5px 12px;border-radius:16px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.08);color:#a0aab2}' +
            '.sw-mode-dot{width:6px;height:6px;border-radius:50%;display:inline-block}' +
            '.sw-mode-dot.active{background:#4caf50;box-shadow:0 0 6px rgba(76,175,80,.6)}.sw-mode-dot.inactive{background:#64748b}' +
            '.sw-verdict-word{font-family:' + COND + ';font-size:2.8em;font-weight:700;letter-spacing:.02em;line-height:1;margin:0 0 20px;text-transform:uppercase;opacity:0;transform:translateY(8px);transition:opacity .5s ease,transform .5s cubic-bezier(.22,1,.36,1)}' +
            '.sw-verdict-word.appear{opacity:1;transform:translateY(0)}' +
            '.sw-verdict-word.yes{color:#4caf50;text-shadow:0 2px 14px rgba(76,175,80,.4),0 0 30px rgba(76,175,80,.2)}' +
            '.sw-verdict-word.no{color:#e53935;text-shadow:0 2px 14px rgba(229,57,53,.4),0 0 30px rgba(229,57,53,.2)}' +
            '.sw-meter{height:6px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:4px}' +
            '.sw-meter-fill{height:100%;width:0;transition:width 1.2s cubic-bezier(.22,1,.36,1)}' +
            '.sw-meter-fill.yes{background:linear-gradient(90deg,#2e7d32,#4caf50);box-shadow:0 0 12px rgba(76,175,80,.5)}' +
            '.sw-meter-fill.no{background:linear-gradient(90deg,#b71c1c,#e53935);box-shadow:0 0 12px rgba(229,57,53,.5)}' +
            '.sw-dicebtn{display:block;width:100%;height:104px;border-radius:16px;background:linear-gradient(180deg,#9fa2a6 0%,#888b90 100%);position:relative;overflow:hidden;will-change:transform;transition:transform .2s cubic-bezier(.16,1,.3,1),box-shadow .2s ease;border:none;margin:0 0 20px;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent}' +
            '.sw-dicebtn.focus{box-shadow:0 0 0 4px #ffffff,0 8px 24px rgba(0,0,0,.45);transform:scale(1.02)}' +
            '.sw-dicebtn:active,.sw-dicebtn.spinning{transform:scale(.985)}' +
            '.sw-label-wrap{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:0 80px 0 100px;overflow:hidden;pointer-events:none}' +
            '.sw-label{font-family:' + COND + ';font-size:2.2em;font-weight:700;color:#2c3033;text-transform:lowercase;text-align:center;white-space:nowrap;opacity:0;transform:translateX(-8px);letter-spacing:-.01em;will-change:transform,opacity;transition:opacity .25s ease-out,transform .25s ease-out,letter-spacing .25s ease-out}' +
            '.sw-label.show{opacity:1;transform:translateX(0);letter-spacing:.02em}' +
            '.sw-label.res-yes{color:#1b5e20;text-transform:uppercase;font-weight:800}' +
            '.sw-label.res-no{color:#b71c1c;text-transform:uppercase;font-weight:800}' +
            '.sw-dice{position:absolute;left:18px;top:50%;width:64px;height:64px;margin-top:-32px;will-change:transform;transform:translateX(0);transition:transform .4s cubic-bezier(.34,1.25,.64,1)}' +
            '.sw-dice::after{content:"";position:absolute;bottom:-6px;left:10%;width:80%;height:8px;background:rgba(0,0,0,.3);border-radius:50%;filter:blur(4px);transform:scale(1);opacity:.6;transition:transform .1s,opacity .1s;pointer-events:none}' +
            '.sw-dicebtn.spinning .sw-dice{transform:translateX(var(--sw-dist, 140px))}' +
            '.sw-dice-core{display:block;width:100%;height:100%}' +
            '.sw-dice-core svg{width:100%;height:100%;display:block;transform:rotate(-6deg)}' +
            '.sw-dice.sw-spin .sw-dice-core{animation:swSpin .9s cubic-bezier(.25,1,.5,1) forwards}' +
            '.sw-dice.sw-spin::after{animation:swShadow .9s cubic-bezier(.25,1,.5,1) forwards}' +
            '@keyframes swSpin{0%{transform:translateY(0) rotate(0) scale(1,1)}20%{transform:translateY(-18px) rotate(180deg) scale(.94,1.06)}40%{transform:translateY(0) rotate(360deg) scale(1.08,.92)}60%{transform:translateY(-8px) rotate(540deg) scale(.97,1.03)}80%{transform:translateY(0) rotate(680deg) scale(1.04,.96)}90%{transform:translateY(-2px) rotate(723deg) scale(1.01,.99)}100%{transform:translateY(0) rotate(720deg) scale(1,1)}}' +
            '@keyframes swShadow{0%,40%,80%,100%{transform:scale(1);opacity:.6}20%{transform:scale(.5);opacity:.2}60%{transform:scale(.75);opacity:.35}}' +
            '.sw-tabs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 16px}' +
            '.sw-tab-btn{position:relative;padding:14px 18px;border-radius:14px;background:linear-gradient(160deg,#2f3538,#24282a);border:1px solid rgba(255,255,255,.08);color:#9aa1a6;font-family:' + COND + ';font-size:1.1em;font-weight:700;text-transform:lowercase;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;outline:none;transition:all .2s ease;user-select:none;overflow:hidden}' +
            '.sw-tab-btn.active{background:linear-gradient(160deg,#383f43,#2a3033);border-color:rgba(255,255,255,.3);color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.4)}' +
            '.sw-tab-btn.focus{box-shadow:0 0 0 3px #4caf50,0 8px 20px rgba(0,0,0,.5);transform:scale(1.02);color:#fff;background:linear-gradient(160deg,#384f3b,#2a332d)}' +
            '.sw-tab-graphic{width:36px;height:18px;display:flex;align-items:center;justify-content:center;opacity:.85}' +
            '.sw-tab-wave{width:100%;height:100%;display:flex;align-items:center;gap:2px}' +
            '.sw-tab-wave-bar{flex:1;background:#e53935;border-radius:1px}' +
            '.sw-tab-procon-bar{width:100%;height:6px;border-radius:3px;background:linear-gradient(90deg,#4caf50 50%,#e53935 50%)}' +
            '.sw-tab-pane{display:none;animation:swFadeIn .3s cubic-bezier(.22,1,.36,1)}' +
            '.sw-tab-pane.active{display:block}' +
            '.sw-metrics-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}' +
            '.sw-metric-card{background:linear-gradient(160deg,#343a3d,#292e31);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px 16px;box-shadow:0 4px 12px rgba(0,0,0,.2)}' +
            '.sw-metric-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}' +
            '.sw-metric-name{font-size:.85em;font-weight:700;color:#cbd5e1;text-transform:uppercase;letter-spacing:.03em}' +
            '.sw-metric-score{font-family:' + COND + ';font-size:1.15em;font-weight:800;color:#4caf50;letter-spacing:.02em}' +
            '.sw-metric-score.hi{color:#e53935}.sw-metric-score.mid{color:#fb8c00}.sw-metric-score.ok{color:#4caf50}' +
            '.sw-metric-bar-bg{height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;margin-bottom:6px}' +
            '.sw-metric-bar-fill{height:100%;border-radius:3px;transition:width .8s cubic-bezier(.22,1,.36,1)}' +
            '.sw-metric-desc{font-size:.72em;color:#94a3b8;line-height:1.3}' +
            '.sw-audience-box{background:linear-gradient(160deg,#24322d,#1a2420);border:1px solid rgba(76,175,80,.25);border-radius:14px;padding:16px 20px;box-shadow:0 6px 16px rgba(0,0,0,.3);margin-top:12px}' +
            '.sw-audience-title{font-size:.85em;font-weight:800;text-transform:uppercase;color:#81c784;letter-spacing:.04em;display:flex;align-items:center;gap:6px;margin-bottom:8px}' +
            '.sw-audience-text{font-size:.92em;line-height:1.55;color:#e2e8f0;margin:0}' +
            '.sw-audience-warn{font-size:.84em;line-height:1.45;color:#fca5a5;margin-top:8px;padding-top:8px;border-top:1px dashed rgba(229,57,53,.3)}' +
            '.sw-col{position:relative;background:linear-gradient(160deg,#343a3d,#292e31);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:22px 24px 22px 32px;box-shadow:0 4px 14px rgba(0,0,0,.25);overflow:hidden}' +
            '.sw-col::before{content:"";position:absolute;left:0;top:0;bottom:0;width:8px}' +
            '.sw-col.pros::before{background:linear-gradient(180deg,#4caf50,#2e7d32)}' +
            '.sw-col.cons::before{background:linear-gradient(180deg,#e53935,#b71c1c)}' +
            '.sw-title{font-size:.85em;font-weight:700;margin-bottom:12px;text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:6px}' +
            '.sw-title.pros{color:#81c784}.sw-title.cons{color:#e57373}' +
            '.sw-list{margin:0;padding-left:14px;font-size:1em;line-height:1.6;color:#cdd2d5;list-style-position:inside}' +
            '.sw-list li{margin-bottom:8px;opacity:0;transform:translateX(-6px);transition:opacity .4s ease,transform .4s cubic-bezier(.22,1,.36,1)}' +
            '.sw-list li.appear{opacity:1;transform:translateX(0)}' +
            '.sw-focusable{outline:none;cursor:pointer}' +
            '@media(max-width:680px){.sw-modal-content{padding:18px 16px 32px}.sw-columns{grid-template-columns:1fr}.sw-col{padding:18px 18px 18px 26px}.sw-verdict-word{font-size:2.2em}.sw-label{font-size:1.6em}.sw-label-wrap{padding:0 60px 0 74px}.sw-dice{width:48px;height:48px;margin-top:-24px;left:12px}}';
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

    function swScrollToFocus(targetEl, center) {
        if (!window._sw_blocknav) return;
        try {
            if (!targetEl || !targetEl.length) return;
            var cn = getScrollContainer(); if (!cn) return;
            var cRect = cn.getBoundingClientRect(), eRect = targetEl[0].getBoundingClientRect();
            var delta = eRect.top - cRect.top;
            var targetScroll;
            if (center) targetScroll = cn.scrollTop + delta - (cn.clientHeight / 2) + (eRect.height / 2);
            else if (eRect.top < cRect.top + 8) targetScroll = cn.scrollTop + delta - 20;
            else if (eRect.bottom > cRect.bottom - 8) targetScroll = cn.scrollTop + (eRect.bottom - cRect.bottom) + 20;
            else return;

            var maxScroll = Math.max(0, cn.scrollHeight - cn.clientHeight);
            targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));

            if (window._sw_scrollRaf) { cancelAnimationFrame(window._sw_scrollRaf); window._sw_scrollRaf = null; }
            var startPos = cn.scrollTop;
            var change = targetScroll - startPos;
            if (Math.abs(change) < 2) return;
            var startTime = performance.now();
            var duration = 220;

            function animate(now) {
                var elapsed = now - startTime;
                var progress = Math.min(1, elapsed / duration);
                var ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                cn.scrollTop = startPos + change * ease;
                if (progress < 1) {
                    window._sw_scrollRaf = requestAnimationFrame(animate);
                } else {
                    window._sw_scrollRaf = null;
                }
            }
            window._sw_scrollRaf = requestAnimationFrame(animate);
        } catch(e) {}
    }

    function interactiveSet() {
        var h = window._sw_currentModalHtml;
        if (!h) return $();
        return h.find('.sw-focusable:visible');
    }

    function focusRing(el, doScroll) {
        var h = window._sw_currentModalHtml;
        if (!h) return;
        h.find('.sw-focusable').removeClass('focus');
        el.addClass('focus');
        window._sw_activeInteractive = el[0];
        if (doScroll !== false) swScrollToFocus(el, false);
    }

    function highlightVisible() {
        if (!window._sw_blocknav) return;
        var set = interactiveSet();
        if (!set.length) return;
        var cn = getScrollContainer(), mid;
        if (cn) { var r = cn.getBoundingClientRect(); mid = r.top + r.height / 2; } else mid = window.innerHeight / 2;
        var best = null, bd = 1e9;
        set.each(function(){
            var rr = this.getBoundingClientRect();
            var d = Math.abs((rr.top + rr.height/2) - mid);
            if (d < bd) { bd = d; best = this; }
        });
        if (best) focusRing($(best), false);
    }

    function moveHorizontal(dir) {
        if (!window._sw_blocknav) return;
        var set = interactiveSet();
        if (!set.length) return;
        var idx = -1;
        if (window._sw_activeInteractive) idx = set.index(window._sw_activeInteractive);
        if (idx < 0) idx = dir > 0 ? -1 : 0;
        var n = idx + dir;
        if (n < 0) n = set.length - 1;
        if (n >= set.length) n = 0;
        focusRing(set.eq(n));
    }

    function scrollStep(dir) {
        if (!window._sw_blocknav) return;
        var cn = getScrollContainer();
        if (!cn) return;
        var step = Math.max(120, Math.round(cn.clientHeight * 0.55));
        var maxScroll = Math.max(0, cn.scrollHeight - cn.clientHeight);
        var target = Math.min(Math.max(0, cn.scrollTop + dir * step), maxScroll);
        try {
            $(cn).stop(true, false).animate({ scrollTop: target }, 200, 'swing', highlightVisible);
        } catch(e) {
            cn.scrollTop = target;
            highlightVisible();
        }
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
        if (!id) return Promise.resolve({ kw: [], age: null, reviews: [], hasTrailer: false, enOv: '' });
        if (_metaCache[id]) return Promise.resolve(_metaCache[id]);
        if (Object.keys(_metaCache).length > 120) _metaCache = {};
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
            var r = { kw: kw, age: age, reviews: reviews, hasTrailer: hasTrailer, enOv: enOv };
            _metaCache[id] = r;
            return r;
        });
    }

    function hasKw(ctx, re) { return ctx.kw.some(function(k){ return re.test(k); }); }

    function reviewStats(reviews) {
        var posRe = /шедевр|великолепн|потрясающ|восхитит|блестящ|лучш|мощн|гениальн|masterpiece|brilliant|amazing|great|best|loved|perfect|outstanding|must-watch|замечательн|превосходн|отличн|весел|смешн|funny|понрав|советую|хорош/i;
        var negRe = /скучн|ужасн|провал|разочаров|слаб|затян|бессмысл|плох|boring|bad|worst|terrible|awful|disappoint|waste|dull|pointless|утомительн|неинтересн/i;
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
            // Ограничение длины текста для предотвращения зависаний на тяжелых страницах
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

            if (votes >= 3000 && adj >= 8.0) add('card','pro','✨ Высокий рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' оценок)', 30, 'ratehi');
            else if (votes >= 500 && adj >= cfg.min_rating) add('card','pro','✨ Хороший рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' оценок)', 20, 'ratehi');
            else if (votes >= 100 && adj >= cfg.min_rating) add('card','pro','✨ Достойный рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' оценок)', 14, 'ratehi');
            if (votes > 0 && votes < 1500 && adj >= 7.6) add('card','pro','🔍 Скрытая жемчужина', 12);
            if (votes >= 2000 && adj >= 7.8 && yr > 0 && yr <= now - 5) add('card','pro','🏛 Культурное признание', 12);
            if (yr === now) add('card','pro','🆕 Новинка ' + yr + ' года', 6, 'fresh');
            if (votes > 0 && votes < 100) add('card','con','❓ Мало оценок (' + votes + ')', 14, 'rateunc');
            if (votes === 0) add('card','con','⚠️ Нет оценок', 16, 'rateunc');
            if (votes >= 100 && adj < cfg.min_rating) add('card','con','📉 Рейтинг ниже порога: ' + rating.toFixed(1), 22, 'ratelow');
            else if (votes >= 50 && rating > 0 && rating < 5) add('card','con','📉 Низкий рейтинг: ' + rating.toFixed(1), 26, 'ratelow');
            if (runtime > 0 && runtime <= 95) add('card','pro','⏱ Компактный хронометраж: ' + runtime + ' мин', 7, 'runtime');
            else if (runtime > 150) add('card','con','⌛ Долгий хронометраж: ' + runtime + ' мин', 12, 'runtime');
            if (/CAM|TS|HDCAM|HDRIP|TELECINE|SCR|WORKPRINT|TELESYNC/i.test(q)) add('card','con','📺 Экранная копия / низкое качество', 26, 'quality');
            else if (/4K|UHD|2160p/i.test(q)) add('card','pro','🎥 Доступно в 4K UHD', 10, 'quality');
            else if (q) add('card','pro','🎥 Высокое качество (' + q + ')', 7, 'quality');

            if (mG.length) add('user','con','⛔ Нелюбимые жанры: ' + mG.join(', '), 40);
            if (mA.length) add('user','con','⛔ Нелюбимые актёры: ' + uniq(mA).slice(0,2).join(', '), 35);
            if (mD.length) add('user','con','⛔ Нелюбимые авторы: ' + uniq(mD).slice(0,2).join(', '), 35);

            if (familyOK && isAnim) add('tmdb','pro','🧸 Детский мультфильм' + (age !== null ? ' (' + age + '+)' : ''), 16, 'family');
            else if (familyOK) add('tmdb','pro','👨‍👩‍👧‍👦 Семейный фильм' + (age !== null ? ' (' + age + '+)' : ''), 16, 'family');
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

            if (rt.total >= 2 && rt.tone === 'pos') add('reviews','pro','💬 ' + who + ' высоко оценивают картину', 20, 'rev');
            else if (rt.total >= 2 && rt.tone === 'neg') add('reviews','con','💬 ' + who + ' оставляют критические отзывы', 22, 'rev');
            else if (rt.total >= 2 && rt.tone === 'mix') add('reviews','pro','💬 Разносторонние мнения аудитории', 10, 'rev');

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
            
            // Strict Binary Verdict (Technical Requirement: exclude 'СПОРНО')
            var vClass = score >= 0 ? 'yes' : 'no';
            var vWord = score >= 0 ? 'СТОИТ' : 'НЕ СТОИТ';
            
            var sortF = function(a,b){ return b.w - a.w; };
            var pros = F.filter(function(f){ return f.kind === 'pro'; }).sort(sortF).map(function(f){ return f.text; });
            var cons = F.filter(function(f){ return f.kind === 'con'; }).sort(sortF).map(function(f){ return f.text; });
            if (!pros.length) pros.push('ℹ️ Нет данных для анализа');
            if (!cons.length) cons.push((blG.length || blA.length || blD.length) ? '✅ Фильтры и ограничения чисты' : '✅ Явных минусов не обнаружено');

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
                movie: movie,
                pros: pros,
                cons: cons,
                review: rt,
                score: score,
                norm: meterW,
                vClass: vClass,
                vWord: vWord,
                mode: metaRich ? 'TMDB' : 'TAGS',
                metaRich: metaRich,
                atmosphere: {
                    metrics: atmosMetrics,
                    targetAudience: targetAudience,
                    notSuitableFor: notSuitableFor
                }
            };
        });
    }

    function restorePrev() {
        var prev = window._sw_prevController;
        window._sw_prevController = null;
        try {
            if (window.Lampa && Lampa.Controller) {
                if (prev && prev.name) Lampa.Controller.toggle(prev.name);
                else Lampa.Controller.toggle('full');
            }
        } catch(e) {
            try { if (window.Lampa && Lampa.Controller) Lampa.Controller.toggle('full'); } catch(_) {}
        }
    }

    function clearLoader() {
        if (window._sw_loaderTimer) {
            clearInterval(window._sw_loaderTimer);
            window._sw_loaderTimer = null;
        }
    }

    function swKeyCapture(e) {
        if (!window._sw_blocknav) return;
        var ae = document.activeElement;
        if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) return;
        if (e.keyCode === 13 || e.keyCode === 32) {
            var a = window._sw_activeInteractive;
            if (a && !e.defaultPrevented) {
                e.preventDefault();
                try { e.stopImmediatePropagation(); } catch(_) {}
                $(a).trigger('click');
            }
        }
    }

    function cleanupModal() {
        window._sw_rolling = false;
        window._sw_currentModalHtml = null;
        window._sw_activeInteractive = null;
        clearLoader();
        if (window._sw_scrollRaf) {
            cancelAnimationFrame(window._sw_scrollRaf);
            window._sw_scrollRaf = null;
        }
        if (window._sw_keyBound) {
            document.removeEventListener('keydown', swKeyCapture, true);
            window._sw_keyBound = false;
        }
    }

    function registerController() {
        try {
            if (!window.Lampa || !Lampa.Controller) return;
            Lampa.Controller.add('should_watch_modal_enhanced', {
                toggle: function() {
                    var h = window._sw_currentModalHtml;
                    if (h && window._sw_blocknav) highlightVisible();
                },
                up: function(){ scrollStep(-1); },
                down: function(){ scrollStep(1); },
                left: function(){ moveHorizontal(-1); },
                right: function(){ moveHorizontal(1); },
                back: function() {
                    cleanupModal();
                    window._sw_closingFromController = true;
                    try { Lampa.Modal.close(); } catch(e) {}
                    restorePrev();
                }
            });
        } catch(e) { console.error('[SW] registerController:', e); }
    }

    var PIPS = {
        1: [[50,50]],
        2: [[34,34],[66,66]],
        3: [[30,30],[50,50],[70,70]],
        4: [[34,34],[66,34],[34,66],[66,66]],
        5: [[34,34],[66,34],[50,50],[34,66],[66,66]],
        6: [[34,30],[66,30],[34,50],[66,50],[34,70],[66,70]]
    };

    function diceSVG(n) {
        var p = PIPS[n] || PIPS[1], c = '';
        for (var i = 0; i < p.length; i++) c += '<circle cx="' + p[i][0] + '" cy="' + p[i][1] + '" r="9" fill="#c62828"/>';
        return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="88" height="88" rx="20" fill="#fafafa" stroke="#cfd2d5" stroke-width="5"/>' + c + '</svg>';
    }

    function rndFace() { return 1 + Math.floor(Math.random() * 6); }
    function setFace(dice, f) { dice.innerHTML = '<span class="sw-dice-core">' + diceSVG(f) + '</span>'; }

    function buildReadyInner(a) {
        var movieTitle = esc(a.movie ? (a.movie.title || a.movie.name || '') : '');
        var badges = '<div class="sw-badges"><span class="sw-mode-badge"><span class="sw-mode-dot ' + (a.metaRich ? 'active' : 'inactive') + '"></span>' + (a.metaRich ? 'TMDB PRO' : 'Lampa AI') + '</span></div>';
        
        var atmos = a.atmosphere || { metrics: [], targetAudience: '' };
        var metricsHtml = (atmos.metrics || []).map(function(m){
            var scoreCls = m.score >= 7.5 ? 'hi' : (m.score >= 5 ? 'mid' : 'ok');
            var fillBg = m.score >= 7.5 ? 'linear-gradient(90deg,#b71c1c,#e53935)' : (m.score >= 5 ? 'linear-gradient(90deg,#e65100,#fb8c00)' : 'linear-gradient(90deg,#2e7d32,#4caf50)');
            return '<div class="sw-metric-card">' +
                '<div class="sw-metric-header">' +
                '<span class="sw-metric-name">' + esc(m.name) + '</span>' +
                '<span class="sw-metric-score ' + scoreCls + '">' + m.score.toFixed(1) + ' <small style="font-size:0.7em;opacity:0.7">/ 10</small></span>' +
                '</div>' +
                '<div class="sw-metric-bar-bg">' +
                '<div class="sw-metric-bar-fill" style="width:' + (m.score * 10) + '%;background:' + fillBg + '"></div>' +
                '</div>' +
                (m.desc ? '<div class="sw-metric-desc">' + esc(m.desc) + '</div>' : '') +
                '</div>';
        }).join('');

        var audienceHtml = '<div class="sw-audience-box">' +
            '<div class="sw-audience-title">🎯 Кому подходит</div>' +
            '<p class="sw-audience-text">' + esc(atmos.targetAudience || 'Любителям качественного кино.') + '</p>' +
            (atmos.notSuitableFor ? '<div class="sw-audience-warn">⚠️ ' + esc(atmos.notSuitableFor) + '</div>' : '') +
            '</div>';

        return (movieTitle ? '<div class="sw-internal-title">смотреть ли: ' + movieTitle + '</div>' : '') +
            '<div class="sw-dossier">' + badges +
            '<div class="sw-verdict-word ' + a.vClass + '" id="sw-vword">' + esc(a.vWord) + '</div>' +
            '<div class="sw-meter"><div class="sw-meter-fill ' + a.vClass + '" data-w="' + a.norm + '"></div></div></div>' +
            '<button class="sw-dicebtn sw-focusable" id="sw-dice-btn" tabindex="0" title="Бросить жребий">' +
            '<span class="sw-label-wrap"><span class="sw-label show" id="sw-dice-label">🎲 бросить кубик</span></span>' +
            '<span class="sw-dice" id="sw-dice"><span class="sw-dice-core">' + diceSVG(1) + '</span></span></button>' +
            '<div class="sw-tabs">' +
            '<button class="sw-tab-btn sw-focusable active" id="sw-tab-btn-proscons" tabindex="0" data-tab="proscons">' +
            '<div class="sw-tab-graphic"><div class="sw-tab-procon-bar"></div></div>' +
            '<span>за и против</span>' +
            '</button>' +
            '<button class="sw-tab-btn sw-focusable" id="sw-tab-btn-atmos" tabindex="0" data-tab="atmos">' +
            '<div class="sw-tab-graphic"><div class="sw-tab-wave"><div class="sw-tab-wave-bar" style="height:40%"></div><div class="sw-tab-wave-bar" style="height:90%"></div><div class="sw-tab-wave-bar" style="height:60%"></div><div class="sw-tab-wave-bar" style="height:100%"></div><div class="sw-tab-wave-bar" style="height:50%"></div></div></div>' +
            '<span>атмосфера и темп</span>' +
            '</button>' +
            '</div>' +
            '<div class="sw-tab-pane active" id="sw-pane-proscons">' +
            '<div class="sw-columns">' +
            '<div class="sw-col pros"><div class="sw-title pros">✓ аргументы за</div><ul class="sw-list">' + a.pros.map(function(p){ return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
            '<div class="sw-col cons"><div class="sw-title cons">✗ аргументы против</div><ul class="sw-list">' + a.cons.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' +
            '</div></div>' +
            '<div class="sw-tab-pane" id="sw-pane-atmos">' +
            '<div class="sw-metrics-grid">' + metricsHtml + '</div>' +
            audienceHtml +
            '</div>';
    }

    function bindTabs(html) {
        var tabBtns = html.find('.sw-tab-btn');
        tabBtns.on('hover:enter click keydown', function(e){
            if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
            var target = $(this).attr('data-tab');
            tabBtns.removeClass('active');
            $(this).addClass('active');
            html.find('.sw-tab-pane').removeClass('active');
            html.find('#sw-pane-' + target).addClass('active');
            if (window._sw_blocknav) highlightVisible();
        });
    }

    function bindDice(html) {
        var btn = html.find('#sw-dice-btn')[0];
        var btnJ = html.find('#sw-dice-btn');
        var dice = html.find('#sw-dice')[0];
        var label = html.find('#sw-dice-label')[0];
        if (!btn || !dice || !label) return;

        $(btn).on('hover:enter click keydown', function(e){
            if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
            if (window._sw_rolling) return;
            window._sw_rolling = true;

            // Блокировка вкладок на время анимации для предотвращения случайных нажатий
            html.find('.sw-tab-btn').css({'pointer-events': 'none', 'opacity': '0.5'});

            var choice = SW_DICE_VERDICTS[Math.floor(Math.random() * SW_DICE_VERDICTS.length)];
            var isYes = choice === 'СТОИТ';
            var final = isYes ? 'смотреть' : 'не смотреть';

            label.classList.remove('show');
            var dist = Math.max(0, Math.round(btn.clientWidth / 2 - 44));
            dice.style.setProperty('--sw-dist', dist + 'px');
            btnJ.addClass('spinning');

            setTimeout(function(){
                dice.classList.add('sw-spin');
                setTimeout(function(){
                    dice.classList.remove('sw-spin');
                    setFace(dice, rndFace());
                    btnJ.removeClass('spinning');
                    setTimeout(function(){
                        label.textContent = final;
                        label.className = 'sw-label show ' + (isYes ? 'res-yes' : 'res-no');
                        window._sw_rolling = false;
                        // Разблокировка вкладок
                        html.find('.sw-tab-btn').css({'pointer-events': '', 'opacity': ''});
                    }, 250);
                }, 900);
            }, 350);
        });
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
            try {
                window._sw_prevController = (window.Lampa && Lampa.Controller && Lampa.Controller.enabled) ? Lampa.Controller.enabled() : null;
            } catch(e) { window._sw_prevController = null; }

            var phases = [
                'Сканирую вселенную кино…',
                'Анализирую скрытые смыслы…',
                'Проверяю настроение зрителей…',
                'Считаю аргументы за и против…',
                'Выношу окончательный вердикт…'
            ];
            var html = $('<div class="sw-modal-content"><div id="sw-body"><div class="sw-loader"><div class="sw-loader-emoji" id="sw-loader-emoji">🔍</div><div class="sw-loader-text" id="sw-loader-text">' + phases[0] + '</div><div class="sw-loader-progress"></div></div></div></div>');
            html.css('font-size', cfg.font_scale + 'px');
            window._sw_currentModalHtml = html;
            window._sw_activeInteractive = null;

            var pi = 0;
            window._sw_loaderTimer = setInterval(function(){
                pi = (pi + 1) % phases.length;
                var t = html.find('#sw-loader-text');
                if (t.length) t.text(phases[pi]);
            }, 650);

            if (window.Lampa && Lampa.Modal && typeof Lampa.Modal.open === 'function') {
                Lampa.Modal.open({
                    title: 'Стоит ли смотреть: ' + title,
                    html: html,
                    size: 'large',
                    onBack: function() {
                        var closing = window._sw_closingFromController;
                        cleanupModal();
                        if (closing) { window._sw_closingFromController = false; return; }
                        restorePrev();
                    }
                });
            }

            if (window._sw_blocknav && !window._sw_keyBound) {
                document.addEventListener('keydown', swKeyCapture, true);
                window._sw_keyBound = true;
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
                        setTimeout(function(){ li.addClass('appear'); }, i * 35);
                    });
                    if (window._sw_blocknav) highlightVisible();
                }, 80);
                if (window.Lampa && Lampa.Controller) Lampa.Controller.toggle('should_watch_modal_enhanced');
            }).catch(function(err){
                clearLoader();
                console.error('[SW] analyze:', err);
                html.find('#sw-body').html('<div class="sw-body" style="text-align:center;padding:48px 20px;color:#e53935">⚠️ Ошибка анализа данных</div>');
            });
        } catch(e) { console.error('[SW] showModal:', e); }
    }

    function addBtn(el, rawMovie) {
        try {
            if (!el || !el.length || el.find('.sw-custom-button-enhanced').length) return;
            var movie = sanitizeMovie(rawMovie);
            var btn = $('<div class="full-start__button selector sw-custom-button-enhanced" data-type="should_watch" tabindex="0"><div class="full-start__icon">' + ICON + '</div><span>Стоит ли</span></div>');
            btn.on('hover:enter click', function(){
                showModal(movie);
            });
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
        if (!window.Lampa) {
            console.warn('[SW] Lampa not found. Plugin disabled.');
            return;
        }
        try {
            var ua = navigator.userAgent || '';
            var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            var isTV = /TV|SmartTV|HbbTV|Web0S|webOS|Tizen|NetCast|Viera|BRAVIA|CrKey|AFT|FireTV|POVIDE|Maple/i.test(ua);
            window._sw_blocknav = !hasTouch || isTV;
        } catch(e) { window._sw_blocknav = true; }

        try { registerController(); } catch(e) {}
        try {
            if (window.Lampa && Lampa.Listener) {
                Lampa.Listener.follow('full', function(e){
                    if (e.type !== 'complite') return;
                    try {
                        var renderEl = null;
                        if (e.object && typeof e.object.render === 'function') renderEl = e.object.render();
                        else if (e.object && e.object.activity && typeof e.object.activity.render === 'function') renderEl = e.object.activity.render();
                        var movie = e.data ? (e.data.movie || e.data) : DEMO_DATA;
                        if (renderEl) addBtn(renderEl, movie);
                    } catch(err) { console.error('[SW]', err); }
                });
            }
        } catch(e) {}
        try { initSettings(); } catch(e) {}
        try { injectCSS(); } catch(e) {}
        console.log('[ShouldWatch] v50.3 Plugin initialized successfully with memory-safe lifecycle and strict binary dice logic.');
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
