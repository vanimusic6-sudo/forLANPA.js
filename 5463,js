(function () {
    'use strict';
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;
    window.should_watch_plugin_enhanced = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var SETTINGS_FLAG = 'sw_settings_ready_v74';
    var ICON = '<svg viewBox="0 0 24 24" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>';
    var GENRE_ID_ANIM = 16, GENRE_ID_FAMILY = 10751, GENRE_ID_KIDS = 10762;
    var SW_BG = '#1b1c20';

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
            min_rating: parseFloat(getSetting('min_rating', '6')) || 6
        };
    }
    function parseBL(s) { return s ? s.split(',').map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean) : []; }

    function injectCSS() {
        if (document.getElementById('sw-plugin-styles-enhanced')) return;
        var s = document.createElement('style'); s.id = 'sw-plugin-styles-enhanced';
        s.innerHTML =
            '.sw-cards-row{' +
                'display:flex;' +
                'align-items:center;' +
                'gap:18px;' +
                'margin:20px 0 16px 0;' +
                'padding:4px 2px 10px 2px;' +
                'overflow-x:auto;' +
                'overflow-y:hidden;' +
                'scroll-behavior:smooth;' +
                '-webkit-overflow-scrolling:touch;' +
                'animation:swFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;' +
            '}' +
            '.sw-cards-row::-webkit-scrollbar{height:4px}' +
            '.sw-cards-row::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:6px}' +
            '.sw-card{' +
                'flex:0 0 auto;' +
                'width:280px;' +
                'aspect-ratio:4/3;' +
                'border-radius:24px;' +
                'overflow:hidden;' +
                'position:relative;' +
                'background:#1b1c20;' +
                'border:1px solid rgba(255,255,255,0.08);' +
                'box-shadow:0 6px 18px rgba(0,0,0,0.35);' +
                'transition:transform 0.2s ease,box-shadow 0.2s ease,border-color 0.2s ease;' +
            '}' +
            '.sw-card:hover,.sw-card.focus{' +
                'transform:translateY(-4px) scale(1.03);' +
                'border-color:rgba(255,255,255,0.3);' +
                'box-shadow:0 10px 28px rgba(0,0,0,0.6);' +
            '}' +
            '.sw-card svg{position:absolute;inset:0;width:100%;height:100%;display:block}' +
            '@keyframes swFadeIn{' +
                'from{opacity:0;transform:translateY(14px)}' +
                'to{opacity:1;transform:translateY(0)}' +
            '}' +
            '@media(max-width:640px){.sw-card{width:220px;border-radius:18px}}';
        document.head.appendChild(s);
    }

    var escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) { if (typeof s !== 'string') return ''; return s.replace(/[&<>"']/g, function(m){ return escMap[m]; }); }
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
            _metaCache[id] = r; return r;
        });
    }
    function hasKw(ctx, re) { return ctx.kw.some(function(k){ return re.test(k); }); }

    /* Очищенные SVG без белых рамок (fill="#ffffff" удален) */
    var SW_SVG_WAR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="7 146 797 598" preserveAspectRatio="xMidYMid meet" width="100%" height="100%"><rect x="7" y="146" width="797" height="598" rx="55" fill="' + SW_BG + '"/><g><path fill="#85573e" stroke="#85573e" stroke-width="0.5" d="M 467.99,290.97 c -6.61,2.81 -13.16,5.77 -19.64,8.89 c -44.63,21.88 -89.15,44 -133.54,66.36 c -0.89,0.66 -1.57,0.51 -2.05,-0.45 c -4.63,-9.43 -9.17,-18.92 -13.6,-28.45 c -0.04,-0.76 0.26,-1.36 0.9,-1.79 c 51.28,-25.71 102.73,-51.21 154.39,-76.11 c 4.85,9.42 9.55,18.95 14.1,28.58 c 0.42,1.08 0.23,2.07 -0.56,2.97 Z M 494.12,382.12 c -0.15,0.95 -0.23,1.9 -0.22,2.85 c -6.64,3.08 -13.3,6.09 -19.98,9.05 c -0.01,-1.66 -0.01,-3.33 0.01,-4.99 c 5.91,-2.97 11.83,-5.93 17.76,-8.87 c 1.65,-0.43 2.46,0.22 2.43,1.96 Z M 341.96,402.98 c 1.81,-2.63 10.04,-5.66 13.03,-7.54 c 3.25,-2.02 2.78,4.46 1.51,5.51 c -4.02,1.68 -8.03,3.35 -12.05,5.02 c -1.75,-0.21 -2.58,-1.2 -2.49,-2.99 Z M 426.06,418.01 c -0.02,-1.99 -0.03,-3.99 -0.02,-5.99 c 7.25,-3.18 14.46,-6.47 21.63,-9.87 c 2.08,-0.82 2.49,4.49 0.44,5.18 c -7.31,3.65 -14.66,7.21 -22.05,10.68 Z"/></g><g><path fill="#ed1c24" stroke="#ed1c24" stroke-width="0.5" d="M 473.92,423.98 c 2.53,0.89 11.26,2.28 12.11,5.02 c -3.81,0.05 -7.62,0.01 -11.42,-0.11 c -1.3,-0.69 -0.5,-3.68 -0.69,-4.91 Z M 449.73,425.97 c 0.01,4 0.01,8.01 -0.01,12.01 c -1.18,1.34 -2.17,0.98 -3.64,1.68 c -6.97,4.06 -12.36,9.65 -16.17,16.76 c -1.23,0.63 -2.52,1.16 -3.86,1.58 c -0.02,-6.33 -0.02,-12.66 0,-19 c 7.78,-5.07 15.12,-9.35 23.68,-13.03 Z M 541.37,450.78 c -0.79,2 -1.3,4.08 -1.52,6.23 c -7.82,-3.89 -13.24,-4.24 -21.85,-4.01 c 0,-1.99 0,-3.98 0,-5.97 c 4.28,-1.43 8.81,-0.82 13.24,-0.74 c 2.16,0.8 9.69,1.91 10.13,4.49 Z M 206.1,460.96 c 7.38,0.02 14.75,0.05 22.13,0.06 c 0.74,17.89 -6.86,15.26 -21.51,14.7 c -0.16,-0.15 -0.31,-0.29 -0.47,-0.44 c -0.22,-4.77 -0.27,-9.54 -0.15,-14.32 Z M 404,466.97 c 0.01,1.67 0.01,3.34 0,5 c -6.32,4.33 -10.01,16.16 -10.15,23.4 c -0.6,0.62 -1.33,0.77 -2.17,0.47 c -4.06,-2.02 -8.37,-2.99 -12.9,-2.9 c 1.85,-4.72 3.73,-9.43 5.63,-14.13 c 3.24,0.45 6.47,0.96 9.67,1.52 c 2.03,-3.49 4.23,-6.89 6.59,-10.2 c 1,-1.17 2.11,-2.22 3.33,-3.16 Z M 182.74,468.02 c 0.11,9.92 0.09,19.84 -0.06,29.75 c -0.33,-1.38 -0.44,-2.81 -0.32,-4.31 c -0.1,-0.9 -0.57,-1.21 -1.4,-0.92 c -3.3,4.29 -4.92,9.65 -7.73,14.19 c -2.82,0.6 -12.77,7.41 -14.87,6.27 c -11.59,-8.02 -22.09,-8.87 -35.13,-3.85 c -0.27,-3.28 -0.56,-9.12 0.16,-12.17 c 5.37,-3.82 19.82,1.55 25.06,4.61 c 2.33,-4.44 4.94,-8.73 7.83,-12.88 c 5.82,-8.68 16.77,-16.9 26.46,-20.69 Z M 251.87,471.98 c 5.36,4.16 9.71,9.18 13.05,15.07 c 0.34,1.86 1.36,3.23 3.07,4.1 c 1.77,2.65 3.64,5.22 5.59,7.73 c 7,2.76 12.86,5.2 18.28,10.73 c 1.2,1.7 2.43,3.36 3.69,4.97 c 1.75,-0.42 3.5,-0.85 5.24,-1.3 c 2.44,-0.18 4.86,-0.46 7.26,-0.82 c 5.14,-6.66 10.33,-12.99 17.26,-17.93 c 9.97,-7.16 20.16,-12.59 32.4,-14.5 c -0.07,5.88 -0.06,11.77 0.02,17.66 c -0.83,-1.69 -2.16,-2.16 -3.96,-1.4 c -6.77,2.22 -11.14,6.06 -16.51,10.38 c -14.13,8.17 -31.98,11.06 -41.23,25.82 c -0.42,0.32 -0.89,0.42 -1.41,0.32 c -2.7,-3.21 -5.61,-6.26 -8.75,-9.13 c -11.74,-8.53 -16.41,-10.29 -31.23,-9.5 c -1.5,-0.05 -4.38,1.79 -5.5,0.19 c -0.45,-9.01 -3.82,-13.82 -7.4,-21.58 c 7.58,-5.6 9.1,-11.88 10.13,-20.81 Z M 563.1,472.1 c 6.05,0 15.17,0.69 21.06,1.95 c -4.28,6.14 -18.16,6.84 -21.06,-1.95 Z M 611,473.02 c 6.22,-0.48 10.86,2.29 16.65,3.81 c 14.19,-0.05 31.95,5.55 41.69,16.31 c 2.76,2.92 4.68,8.06 8.27,9.84 c 0.46,2.7 0.53,5.43 0.23,8.17 c -20.3,-13.58 -42.24,-21.75 -66.85,-21.15 c -0.02,-5.66 -0.02,-11.32 0.01,-16.98 Z"/></g></svg>';

    var SW_SVG_HUMOR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="37 154 720 540" preserveAspectRatio="xMidYMid meet" width="100%" height="100%"><rect x="37" y="154" width="720" height="540" rx="55" fill="' + SW_BG + '"/><g><path fill="#f7c30e" stroke="#f7c30e" stroke-width="0.5" d="M 140.99,295 c 0.65,-2.39 1.06,-4.84 1.21,-7.35 c 8.9,-27.06 31.27,-38.87 57.45,-45.45 c 4.5,-1.15 9.56,-0.75 13.84,-2.18 c 121.34,-0.01 242.69,-0.03 364.03,-0.04 c 4.71,1.07 10.15,1.43 14.99,2.04 c 28.96,6.89 55.55,20.65 61.47,52.47 c 0.01,86.68 0.03,173.35 0.04,260.03 c -5.1,30.76 -27,43.13 -54.68,52.27 c -4.49,1.35 -13.44,1.87 -17.83,3.19 c -123.01,0.01 -246.02,0.03 -369.03,0.04 c -30.64,-2.99 -66.11,-19.67 -71.46,-53.51 c -0.02,-87.17 -0.03,-174.34 -0.03,-261.51 Z M 209.24,434.26 c 0.31,1.05 0.48,2.13 0.5,3.23 c -0.2,29.67 -0.14,59.32 0.18,88.97 c 0.42,0.45 0.94,0.65 1.56,0.59 c 7.01,-0.02 14.03,-0.02 21.05,0 c 0.59,0.04 1.07,-0.17 1.43,-0.63 c 0.14,-14.6 0.2,-29.2 0.2,-43.8 c 0.26,-0.54 0.69,-0.81 1.29,-0.83 c 3.67,-0.05 7.33,0.03 10.98,0.24 c 0.49,0.35 0.71,0.83 0.67,1.43 c -0.81,22.54 1.56,40.36 27.4,44.58 c 25.69,3.25 42.01,-9 40.88,-35.54 c -0.42,-20.63 0.96,-43.19 -1.02,-63.5 c 0.17,-0.83 0.46,-1.62 0.85,-2.36 c 27.53,-38.68 21.05,-98.92 -18.68,-126.68 c -47.48,-32.62 -100.49,5.44 -108.19,56.71 c -3.97,28.78 1.47,51.95 19.47,74.97 c 0.58,0.82 1.06,1.69 1.43,2.62 Z M 453.69,412.07 c -0.85,-0.09 -1.65,0.07 -2.41,0.48 c -10.19,5.4 -15.45,13.89 -15.78,25.45 c -0.21,20.57 -0.18,41.13 0.09,61.7 c 1.48,25.9 26.74,33.04 48.42,26.78 c 27.29,-9.39 17.83,-42.51 19.67,-64.39 c 0.9,-0.1 1.79,-0.07 2.67,0.11 c 6.72,2.19 11.49,1.87 18.64,1.78 c -0.26,36.48 -0.25,72.96 0.03,109.44 c 0.38,0.45 0.87,0.65 1.46,0.6 c 7.01,-0.02 14.03,-0.02 21.04,0 c 0.6,0.06 1.11,-0.14 1.52,-0.58 c 0.21,-19.42 0.34,-38.83 0.41,-58.21 c 0.47,0.05 0.87,0.26 1.19,0.61 c 3.93,8.05 11.83,12.97 20.86,12.89 c 16.98,-0.83 23.19,-15.26 24.3,-30.23 c 0.24,-20.33 0.23,-40.67 -0.04,-61 c -0.91,-8.62 -2.97,-17.29 -9.5,-23.45 c -0.86,-1.47 4.47,-14.69 3.77,-17.55 c 5.7,-23.15 -0.58,-53.78 -14.59,-73.52 c -4.72,-4.87 -6.89,-10.22 -12.97,-13.98 c -23.53,-23.06 -63.52,-22.26 -86.45,1.44 c -2.59,1.09 -9.02,9.93 -11.46,12.54 c -2.2,3.96 -5.69,10.12 -8.07,14 c -10.29,24.77 -11.08,49.7 -2.8,75.09 Z"/></g></svg>';

    var SW_SVG_FEAR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="37 158 723 542" preserveAspectRatio="xMidYMid meet" width="100%" height="100%"><rect x="37" y="158" width="723" height="542" rx="55" fill="' + SW_BG + '"/><g><path fill="#946246" stroke="#946246" stroke-width="0.5" d="M 496.31,278.03 c -3.13,3.6 4.82,30.72 6.96,35.7 c -24.57,6.9 -49.99,12.99 -74.58,19.58 c -0.52,0.17 -0.98,0.45 -1.37,0.85 c -2.8,-1.57 -9.21,-31.12 -10.33,-36.15 c 25.61,-6.58 51.21,-13.17 76.82,-19.76 c 0.82,-0.14 1.66,-0.21 2.5,-0.22 Z"/></g><g><path fill="#880015" stroke="#880015" stroke-width="0.5" d="M 399.09,389.07 c 8.98,5.52 12.08,14.73 13.38,24.71 c -0.87,21.57 4.86,63.38 -5.23,81.88 c -9.17,15.37 -30.34,14 -39.35,-1.05 c -0.63,-0.48 -1.19,-1.02 -1.52,0.01 c -0.06,18.66 -0.1,37.31 -0.11,55.97 c -0.01,0.62 -0.29,1.05 -0.84,1.31 c -7.31,0.07 -14.62,0.1 -21.93,0.09 c -0.6,0.07 -1.08,-0.12 -1.46,-0.57 c -0.18,-22.25 -0.29,-44.51 -0.35,-66.77 c 0.66,-5.35 -8.07,-5.56 -11.46,-7.34 c -6.26,-1.68 -13.17,-2.15 -18.65,-5.89 c -0.98,0.42 -3.39,8.32 -3.92,9.83 c -0.71,0.91 -1.46,1.8 -2.22,2.66 c 0.01,6.86 -0.11,13.71 -0.36,20.55 c -0.43,0.43 -0.95,0.61 -1.56,0.54 c -7.01,-0.03 -14.02,-0.03 -21.02,-0.01 c -0.59,0.06 -1.05,-0.14 -1.39,-0.6 c -0.1,-30.55 -0.23,-61.11 -0.36,-91.66 c -0.32,-0.43 -0.76,-0.61 -1.3,-0.55 c -5.66,-0.03 -11.33,-0.05 -16.99,-0.06 c -0.6,0.03 -1.06,-0.21 -1.36,-0.71 c -0.09,-6.97 -0.11,-13.95 -0.09,-20.92 c -0.03,-1.01 0.45,-1.56 1.43,-1.66 c 10.15,-0.02 20.29,-0.01 30.43,0.06 c 1.56,5.96 3.1,11.91 4.64,17.85 c 0.33,-0.33 0.5,-0.73 0.49,-1.21 c -0.02,-5.97 0.03,-11.94 0.15,-17.9 c 0.32,-0.47 0.77,-0.67 1.35,-0.62 c 8.3,-0.04 16.59,0 24.88,0.13 c 0.47,0.32 0.67,0.77 0.62,1.35 c 0,5.9 0.06,11.81 0.2,17.72 c -0.08,2.1 -0.14,4.21 -0.18,6.32 c 0.04,0.57 -0.17,1.01 -0.64,1.33 c -5.94,0.13 -11.89,0.21 -17.84,0.24 c -0.54,-0.04 -0.94,0.17 -1.21,0.63 c -0.09,9.84 -0.08,19.68 0.03,29.52 c 0.13,0.16 0.26,0.33 0.39,0.49 c 1.7,0.17 3.37,0.49 5.02,0.95 c 9.3,-0.05 20.68,-6.52 26.83,-13.55 c 1.44,-0.89 2.81,-1.85 4.1,-2.89 c 0.11,-9 0.15,-17.99 0.13,-26.99 c 0.12,-5.26 0.18,-10.51 0.19,-15.77 c -0.05,-0.58 0.15,-1.03 0.62,-1.35 c 7.58,-0.17 15.16,-0.17 22.74,0 c 1.92,1.3 -1.07,10.19 2.11,9.87 c 3.21,-0.65 6.46,-1.09 9.74,-1.3 c 6.62,-1.36 15.46,-4.11 21.87,-4.64 Z M 260.19,428.97 c -8.06,0.03 -16.12,0.03 -24.17,-0.01 c 0.31,-9.01 -0.82,-19.86 -12.41,-19.58 c -16.87,0.88 -8.61,34.82 -10.45,45.45 c -0.11,6.79 -0.04,13.58 0.21,20.37 c 3.29,14.68 22.74,12.05 22.64,-7.71 c -0.03,-0.57 0.18,-1 0.65,-1.3 c 7.57,-0.05 15.14,-0.01 22.71,0.14 c 0.5,-0.04 0.88,0.13 1.17,0.53 c 0.3,7.51 -0.62,13.27 -2.4,20.27 c -13.01,29.88 -67.82,25.98 -69.71,-9.97 c -0.39,-19.16 -0.43,-38.32 -0.13,-57.48 c 0.81,-17.36 9.48,-28.66 26.67,-32.21 c 30.75,-3.66 47.49,9.92 45.22,41.5 Z"/></g></svg>';

    var SW_CUSTOM_CARDS = [
        { id: 'war',      re: /война|военный/i,                              art: function(){ return SW_SVG_WAR; } },
        { id: 'humor',    re: /развеселит|комедия|чёрный юмор|черный юмор/i, art: function(){ return SW_SVG_HUMOR; } },
        { id: 'fear',     re: /страшно|ужас/i,                               art: function(){ return SW_SVG_FEAR; } }
    ];

    function pickCards(movie) {
        var cards = [];
        var txt = ((movie.genres || []).map(function(g){ return typeof g==='string'?g:g.name||''; }).join(' ') + ' ' + (movie.overview || '')).toLowerCase();
        if (/военн|война/i.test(txt)) cards.push({ id: 'war', svg: SW_SVG_WAR, title: 'Война' });
        if (/комед|юмор|развесел/i.test(txt)) cards.push({ id: 'humor', svg: SW_SVG_HUMOR, title: 'Юмор' });
        if (/ужас|страх|триллер/i.test(txt)) cards.push({ id: 'fear', svg: SW_SVG_FEAR, title: 'Страх' });
        return cards;
    }

    function renderCards(el, movie) {
        try {
            if (!el || !el.length || el.find('.sw-cards-row').length) return;
            var row = $('<div class="sw-cards-row"></div>');
            var anchor = el.find('.full-start__buttons, .full-start-new__buttons, .full-card__buttons, .full-descr__buttons').last();
            var box = anchor.length ? anchor.closest('.full-start, .full-start-new, .full-descr') : null;
            if (box && box.length) box.append(row);
            else if (anchor.length) anchor.after(row);
            else el.append(row);

            var cards = pickCards(movie);
            if (!cards.length) { row.remove(); return; }
            cards.forEach(function(c){
                row.append($('<div class="sw-card"></div>').attr('title', c.title).html(c.svg));
            });
        } catch(e) { console.error('[SW] renderCards:', e); }
    }

    function startPlugin() {
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
    }

    try { if (window.appready) startPlugin(); else Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') startPlugin(); }); } catch(e) {}
})();
