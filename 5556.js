(function () {
    'use strict';
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;
    window.should_watch_plugin_enhanced = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var SETTINGS_FLAG = 'sw_settings_ready_v65';
    var ICON = '<svg viewBox="0 0 24 24" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>';
    var DISPLAY = '"Trebuchet MS","Segoe UI",system-ui,-apple-system,sans-serif';
    var COND = '"Oswald","Roboto Condensed","Arial Narrow",' + DISPLAY;
    var GENRE_ID_ANIM = 16, GENRE_ID_FAMILY = 10751, GENRE_ID_KIDS = 10762;

    var _metaCache = {};
    var _domCache = null;

    window._sw_rolling = false;
    window._sw_currentModalHtml = null;
    window._sw_prevController = null;
    window._sw_closingFromController = false;
    window._sw_loaderTimer = null;
    window._sw_blocknav = false;
    window._sw_activeInteractive = null;
    window._sw_keyBound = false;

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
            '.sw-custom-button-enhanced{cursor:pointer;transition:background .25s ease,color .25s ease,transform .25s ease}' +
            '.sw-custom-button-enhanced.focus{background:rgba(255,255,255,.18);color:#fff;transform:scale(1.02)}' +
            '.sw-modal-content{padding:28px 32px 48px;color:#e9ebeb;font-family:' + DISPLAY + ';font-size:20px;box-sizing:border-box;max-height:88vh;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-y}' +
            '.sw-modal-content::-webkit-scrollbar{width:5px}.sw-modal-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:10px}' +
            '.sw-body{animation:swFadeIn .5s cubic-bezier(.22,1,.36,1)}' +
            '@keyframes swFadeIn{from{opacity:0}to{opacity:1}}' +
            '.sw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:60px 20px;min-height:45vh;color:#9aa1a6}' +
            '.sw-loader-emoji{font-size:3.2em;line-height:1;animation:swFloat 2.2s ease-in-out infinite}' +
            '@keyframes swFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.05)}}' +
            '.sw-loader-text{font-size:1em;font-weight:600;min-height:1.5em;text-align:center;color:#cbd5e1;letter-spacing:.01em}' +
            '.sw-loader-progress{width:220px;height:3px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;position:relative;margin-top:8px}' +
            '.sw-loader-progress::after{content:"";position:absolute;left:-100%;top:0;height:100%;width:100%;background:linear-gradient(90deg,transparent,#b98a5e,transparent);animation:swSlide 1.1s ease-in-out infinite}' +
            '@keyframes swSlide{0%{left:-100%}100%{left:100%}}' +
            '.sw-dossier{position:relative;background:linear-gradient(160deg,rgba(44,47,50,.94),rgba(30,32,35,.9));border:1px solid rgba(255,255,255,.07);border-radius:24px;padding:34px 40px;margin-bottom:22px;box-shadow:0 10px 28px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05);animation:swRise .5s cubic-bezier(.22,1,.36,1) both}' +
            '@keyframes swRise{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}' +
            '.sw-badges{position:absolute;top:24px;right:26px;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:55%}' +
            '.sw-mode-badge{display:inline-flex;align-items:center;gap:6px;font-size:.65em;padding:6px 14px;border-radius:20px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.06);color:#9aa1a6;border:1px solid rgba(255,255,255,.06)}' +
            '.sw-mode-dot{width:6px;height:6px;border-radius:50%;display:inline-block;box-shadow:0 0 6px currentColor}' +
            '.sw-mode-dot.active{background:#b98a5e;color:#b98a5e}.sw-mode-dot.inactive{background:#64748b;color:#64748b}' +
            '.sw-verdict-word{font-family:' + COND + ';font-size:3em;font-weight:700;letter-spacing:.02em;line-height:1;margin:0 0 24px;text-transform:uppercase;opacity:0;transform:translateY(6px);transition:opacity .5s cubic-bezier(.22,1,.36,1),transform .5s cubic-bezier(.22,1,.36,1);text-shadow:0 2px 14px rgba(0,0,0,.25)}' +
            '.sw-verdict-word.appear{opacity:1;transform:translateY(0)}' +
            '.sw-verdict-word.yes{color:#8bab74}.sw-verdict-word.no{color:#c47b83}.sw-verdict-word.maybe{color:#c99968}' +
            '.sw-meter{height:5px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;position:relative}' +
            '.sw-meter-fill{height:100%;width:0;transition:width 1s cubic-bezier(.22,1,.36,1);position:relative;overflow:hidden}' +
            '.sw-meter-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:translateX(-100%);animation:swMeterSheen 1.6s ease-out .4s 1}' +
            '@keyframes swMeterSheen{to{transform:translateX(100%)}}' +
            '.sw-meter-fill.yes{background:linear-gradient(90deg,#4d5f3a,#7d9a66)}' +
            '.sw-meter-fill.no{background:linear-gradient(90deg,#5d3138,#a25e67)}' +
            '.sw-meter-fill.maybe{background:linear-gradient(90deg,#7a5231,#c99968)}' +
            '.sw-dicebtn{display:block;width:100%;height:130px;border-radius:16px;background:linear-gradient(180deg,#adaeb1 0%,#8f9195 100%);position:relative;overflow:hidden;border:none;margin:0 0 22px;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;transition:transform .25s cubic-bezier(.22,1,.36,1),box-shadow .25s ease;box-shadow:0 6px 16px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.25)}' +
            '.sw-dicebtn:hover{transform:translateY(-2px)}' +
            '.sw-dicebtn.focus{box-shadow:0 0 0 3px rgba(255,255,255,.35),0 6px 16px rgba(0,0,0,.28)}' +
            '.sw-dice-spin{animation:swDiceSpin 1.6s cubic-bezier(.22,1,.36,1) 1}' +
            '@keyframes swDiceSpin{0%{transform:rotate(0deg) scale(1)}18%{transform:rotate(200deg) scale(1.06)}45%{transform:rotate(470deg) scale(1.1)}72%{transform:rotate(650deg) scale(1.05)}100%{transform:rotate(720deg) scale(1)}}' +
            '.sw-label-wrap{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:0;overflow:hidden}' +
            '.sw-label{font-family:' + COND + ';font-weight:700;color:#43464a;text-transform:lowercase;text-align:center;white-space:nowrap;opacity:0;transition:opacity .3s ease;letter-spacing:-.02em}' +
            '.sw-label.show{opacity:1}' +
            '.sw-label.res-yes{color:#40512f}.sw-label.res-no{color:#4e2830}' +
            '#sw-dice{position:absolute;left:18px;top:50%;width:70px;height:70px;margin-top:-35px;display:flex;align-items:center;justify-content:center}' +
            '#sw-dice-face{width:100%;height:100%;display:block;transition:opacity .12s ease-in}' +
            '.premium-dice-svg{width:100%;height:100%;border-radius:22%;box-shadow:0 4px 12px rgba(0,0,0,.25)}' +
            '@media(prefers-reduced-motion:reduce){.sw-dice-spin{animation:none !important}.sw-dicebtn{transition:none !important}}' +
            '.sw-columns{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;align-items:stretch}' +
            '.sw-col{position:relative;background:linear-gradient(160deg,rgba(42,45,48,.92),rgba(28,30,33,.88));border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:24px 28px 24px calc(13% + 28px);box-shadow:0 6px 16px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.04)}' +
            '.sw-col::before{content:"";position:absolute;left:0;top:0;bottom:0;width:13%;border-radius:10px 0 0 10px}' +
            '.sw-col.pros::before{background:linear-gradient(180deg,#6d8659,#40512f)}' +
            '.sw-col.cons::before{background:linear-gradient(180deg,#82505a,#4e2830)}' +
            '.sw-title{font-size:.85em;font-weight:700;margin-bottom:14px;text-transform:lowercase;letter-spacing:.04em}' +
            '.sw-title.pros{color:#9dbb86}.sw-title.cons{color:#cf989e}' +
            '.sw-list{margin:0;padding-left:18px;font-size:1.02em;line-height:1.7;color:#d2d6d9}' +
            '.sw-list li{margin-bottom:11px;opacity:0;transform:translateY(6px);transition:opacity .4s cubic-bezier(.22,1,.36,1),transform .4s cubic-bezier(.22,1,.36,1)}' +
            '.sw-list li.appear{opacity:1;transform:translateY(0)}' +
            '.sw-focusable{outline:none;cursor:pointer}' +
            '@media(max-width:640px){.sw-modal-content{padding:20px 18px 36px}.sw-columns{grid-template-columns:1fr}.sw-col{padding:20px 22px 20px calc(16% + 22px)}.sw-col::before{width:16%}.sw-verdict-word{font-size:2.2em}.sw-label-wrap{padding:0}#sw-dice{width:56px;height:56px;margin-top:-28px;left:14px}}';
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
            var cn = getScrollContainer(); if (!cn) return;
            var cRect = cn.getBoundingClientRect(), eRect = el[0].getBoundingClientRect();
            var delta = eRect.top - cRect.top, target;
            if (center) target = cn.scrollTop + delta - (cn.clientHeight / 2) + (eRect.height / 2);
            else if (eRect.top < cRect.top + 8) target = cn.scrollTop + delta - 20;
            else if (eRect.bottom > cRect.bottom - 8) target = cn.scrollTop + (eRect.bottom - cRect.bottom) + 20;
            else return;
            try { $(cn).stop(true, false).animate({ scrollTop: target }, 200, 'swing'); }
            catch(e) { cn.scrollTop = target; }
        } catch(e) {}
    }
    function interactiveSet() { var h = window._sw_currentModalHtml; if (!h) return $(); return h.find('.sw-focusable:visible'); }
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
        if (cn) { var r = cn.getBoundingClientRect(); mid = r.top + r.height / 2; } else mid = window.innerHeight / 2;
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
        var cn = getScrollContainer(); if (!cn) return;
        var step = Math.max(100, Math.round(cn.clientHeight * 0.6));
        var maxScroll = Math.max(0, cn.scrollHeight - cn.clientHeight);
        var target = Math.min(Math.max(0, cn.scrollTop + dir * step), maxScroll);
        try { $(cn).stop(true, false).animate({ scrollTop: target }, 200, 'swing', highlightVisible); }
        catch(e) { cn.scrollTop = target; highlightVisible(); }
    }

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
            return { pros: pros, cons: cons, review: rt, score: score, norm: meterW, vClass: vClass, vWord: vWord, mode: metaRich ? 'TMDB' : 'TAGS', metaRich: metaRich };
        });
    }

    function restorePrev() {
        var prev = window._sw_prevController; window._sw_prevController = null;
        try { if (prev && prev.name) Lampa.Controller.toggle(prev.name); else Lampa.Controller.toggle('full'); }
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
                toggle: function() { var h = window._sw_currentModalHtml; if (h && window._sw_blocknav) highlightVisible(); },
                up: function(){ scrollStep(-1); }, down: function(){ scrollStep(1); },
                left: function(){ moveHorizontal(-1); }, right: function(){ moveHorizontal(1); },
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
        1: [[50, 50]],
        2: [[34, 34], [66, 66]],
        3: [[30, 30], [50, 50], [70, 70]],
        4: [[34, 34], [66, 34], [34, 66], [66, 66]],
        5: [[34, 34], [66, 34], [50, 50], [34, 66], [66, 66]],
        6: [[34, 30], [66, 30], [34, 50], [66, 50], [34, 70], [66, 70]]
    };
    function pipsSVG(n) {
        var p = PIPS[n] || PIPS[6], c = '';
        var isOne = (n === 1);
        var gradId = isOne ? 'diceRed' : 'diceGray';
        for (var i = 0; i < p.length; i++) {
            c += '<circle cx="' + p[i][0] + '" cy="' + p[i][1] + '" r="9.5" fill="url(#' + gradId + ')"/>';
        }
        return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="premium-dice-svg">' +
            '<defs>' +
            '<linearGradient id="diceRed" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#ef5350" />' +
            '<stop offset="100%" stop-color="#b71c1c" />' +
            '</linearGradient>' +
            '<linearGradient id="diceGray" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#555555" />' +
            '<stop offset="100%" stop-color="#1a1a1a" />' +
            '</linearGradient>' +
            '</defs>' +
            '<rect width="100" height="100" rx="22" fill="#ffffff" />' +
            c + '</svg>';
    }
    function rndFace() { return 1 + Math.floor(Math.random() * 6); }

    function buildReadyInner(a) {
        var badges = '<div class="sw-badges"><span class="sw-mode-badge"><span class="sw-mode-dot ' + (a.metaRich ? 'active' : 'inactive') + '"></span>TMDB</span></div>';
        return '<div class="sw-dossier">' + badges +
            '<div class="sw-verdict-word ' + a.vClass + '" id="sw-vword">' + esc(a.vWord) + '</div>' +
            '<div class="sw-meter"><div class="sw-meter-fill ' + a.vClass + '" data-w="' + a.norm + '"></div></div></div>' +
            '<button class="sw-dicebtn sw-focusable" id="sw-dice-btn" tabindex="0">' +
            '<span class="sw-label-wrap"><span class="sw-label show" id="sw-dice-label">бросить кубик</span></span>' +
            '<span id="sw-dice"><span id="sw-dice-face">' + pipsSVG(1) + '</span></span></button>' +
            '<div class="sw-columns">' +
            '<div class="sw-col pros"><div class="sw-title pros">✓ аргументы за</div><ul class="sw-list">' + a.pros.map(function(p){ return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
            '<div class="sw-col cons"><div class="sw-title cons">✗ аргументы против</div><ul class="sw-list">' + a.cons.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div></div>';
    }

    function bindDice(html, cfg) {
        var btnJ = html.find('#sw-dice-btn');
        var btn = btnJ[0];
        var wheel = html.find('#sw-dice')[0];
        var dice = html.find('#sw-dice-face')[0];
        var label = html.find('#sw-dice-label')[0];
        if (!btn || !wheel || !dice || !label) return;

        label.style.fontSize = cfg.dice_font + 'px';

        var faceTimer = null;
        var stopCycle = false;
        var currentFace = 1;
        var startTime = 0;

        function clearCycle(){ stopCycle = true; if (faceTimer) clearTimeout(faceTimer); faceTimer = null; }

        function scheduleSwap(){
            faceTimer = setTimeout(function(){
                if (stopCycle) return;
                if (Date.now() - startTime > 1000) return;
                var f; do { f = rndFace(); } while (f === currentFace);
                currentFace = f;
                dice.style.opacity = '0.25';
                setTimeout(function(){
                    if (stopCycle) return;
                    dice.innerHTML = pipsSVG(f);
                    dice.style.opacity = '1';
                }, 90);
                scheduleSwap();
            }, 180);
        }

        btnJ.on('click hover:enter keydown', function(e) {
            if (e.type === 'keydown' && e.keyCode !== 13 && e.keyCode !== 32) return;
            if (window._sw_rolling) return;
            window._sw_rolling = true;
            stopCycle = false;
            currentFace = 1;
            startTime = Date.now();
            try {
                label.classList.remove('show');
                wheel.classList.remove('sw-dice-spin'); void wheel.offsetWidth; wheel.classList.add('sw-dice-spin');
                scheduleSwap();
                setTimeout(function(){
                    clearCycle();
                    dice.style.opacity = '1';
                    var finalResult = Math.random() > 0.5 ? 'смотреть' : 'не смотреть';
                    wheel.classList.remove('sw-dice-spin');
                    label.textContent = finalResult;
                    label.className = 'sw-label show ' + (finalResult === 'смотреть' ? 'res-yes' : 'res-no');
                    label.style.fontSize = cfg.dice_font + 'px';
                    window._sw_rolling = false;
                }, 1600);
            } catch (err) {
                console.error('[SW] dice:', err);
                clearCycle();
                window._sw_rolling = false;
                wheel.classList.remove('sw-dice-spin');
            }
        });
    }

    function showModal(movie) {
        try {
            try {
                if (getSetting('reset_cache', '0') === '1') {
                    _metaCache = {}; _domCache = null;
                    Lampa.Storage.set(PLUGIN_ID + '_reset_cache', '0');
                }
            } catch(e) {}

            var cfg = getSettings();
            var title = esc(movie.title || movie.name || 'Фильм');
            try { window._sw_prevController = Lampa.Controller.enabled ? Lampa.Controller.enabled() : null; } catch(e) { window._sw_prevController = null; }
            var phases = ['Собираю данные','Спрашиваю TMDB','Читаю настроения','Смотрю комментарии','Считаю вердикт'];
            var phaseEmoji = ['🎬','🛰','🎭','💬','⚖️'];
            var html = $('<div class="sw-modal-content"><div id="sw-body"><div class="sw-loader"><div class="sw-loader-emoji" id="sw-loader-emoji">' + phaseEmoji[0] + '</div><div class="sw-loader-text" id="sw-loader-text">' + phases[0] + '</div><div class="sw-loader-progress"></div></div></div></div>');
            html.css('font-size', cfg.font_scale + 'px');
            window._sw_currentModalHtml = html; window._sw_activeInteractive = null;

            var pi = 0, dots = 0;
            window._sw_loaderTimer = setInterval(function(){
                dots = (dots + 1) % 4;
                if (dots === 0) {
                    pi = (pi + 1) % phases.length;
                    var em = html.find('#sw-loader-emoji');
                    if (em.length) em.text(phaseEmoji[pi]);
                }
                var t = html.find('#sw-loader-text');
                if (t.length) t.text(phases[pi] + Array(dots + 1).join('.'));
            }, 350);

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
                bindDice(html, cfg);
                setTimeout(function(){
                    html.find('#sw-vword').addClass('appear');
                    html.find('.sw-meter-fill').each(function(){ this.style.width = (this.getAttribute('data-w') || 50) + '%'; });
                    html.find('.sw-list li').each(function(i){ var li = $(this); setTimeout(function(){ li.addClass('appear'); }, i * 25); });
                    if (window._sw_blocknav) highlightVisible();
                }, 100);
                Lampa.Controller.toggle('should_watch_modal_enhanced');
            }).catch(function(err){
                clearLoader(); console.error('[SW] analyze:', err);
                html.find('#sw-body').html('<div class="sw-body" style="text-align:center;padding:48px 20px;color:#b06a72">Ошибка анализа</div>');
            });
        } catch(e) { console.error('[SW] showModal:', e); }
    }

    function addBtn(el, movie) {
        try {
            if (!el || !el.length || el.find('.sw-custom-button-enhanced').length) return;
            var btn = $('<div class="full-start__button selector sw-custom-button-enhanced" data-type="should_watch"><div class="full-start__icon">' + ICON + '</div><span>Стоит ли</span></div>');
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
                if (renderEl && e.data && e.data.movie) addBtn(renderEl, e.data.movie);
            } catch(err) { console.error('[SW]', err); }
        }); } catch(e) {}
        try { initSettings(); } catch(e) {}
        try { injectCSS(); } catch(e) {}
        console.log('[ShouldWatch] v65.4 (clean dice spin, less confident review-tone signal)');
    }

    try { if (window.appready) startPlugin(); else Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') startPlugin(); }); } catch(e) {}
})();
