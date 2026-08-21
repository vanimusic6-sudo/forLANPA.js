/* --- CAPSULE MOD PART 1/8 --- */
(function () {
'use strict';
if (window.plugin_capsule_mod) return;
function el(tag, cls, html) { var d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }
function addClass(n, c) { if (!hasClass(n, c)) n.className += (n.className ? ' ' : '') + c; }
function removeClass(n, c) { n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/\s+/g, ' ').replace(/^ +| +$/g, ''); }
function hasClass(n, c) { return (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1; }
function closestAttr(node, attr) { while (node && node !== document) { if (node.getAttribute && node.getAttribute(attr)) return node; node = node.parentNode; } return null; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function nowMs() { return Date.now(); }
function dayMs() { return 86400000; }
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(nowMs()); }, 16); };
function tweenScroll(node, prop, to, ms) {
    if (!node) return; var from = node[prop]; var t0 = nowMs(); ms = ms || 220;
    function step() { var p = Math.min(1, (nowMs() - t0) / ms); var e = 1 - Math.pow(1 - p, 3); node[prop] = Math.round(from + (to - from) * e); if (p < 1) raf(step); }
    raf(step);
}
function sGet(k, d) {
    try { if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') { var v = Lampa.Storage.get(k, d); return (v === undefined || v === null) ? d : v; } } catch (e) {}
    try { if (window.localStorage) { var raw = localStorage.getItem('cm_' + k); if (raw != null) return JSON.parse(raw); } } catch (e) {} return d;
}
function sSet(k, v) {
    try { if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') { Lampa.Storage.set(k, v); return; } } catch (e) {}
    try { if (window.localStorage) localStorage.setItem('cm_' + k, JSON.stringify(v)); } catch (e) {}
}
function sDel(k) {
    try { if (window.Lampa && Lampa.Storage && Lampa.Storage.remove) Lampa.Storage.remove(k); } catch (e) {}
    try { if (window.localStorage) localStorage.removeItem('cm_' + k); } catch (e) {}
}
function httpGet(url, onOk, onErr) {
    try { var xhr = new XMLHttpRequest(); xhr.open('GET', url, true); xhr.timeout = 15000;
        xhr.onreadystatechange = function () { if (xhr.readyState === 4) { if (xhr.status >= 200 && xhr.status < 400) { var data = null; try { data = JSON.parse(xhr.responseText); } catch (e) {} if (data) onOk(data); else if (onErr) onErr(); } else if (onErr) onErr(); } };
        xhr.onerror = function () { if (onErr) onErr(); }; xhr.ontimeout = function () { if (onErr) onErr(); }; xhr.send();
    } catch (e) { if (onErr) onErr(); }
}
function notify(text) { try { if (window.Lampa && Lampa.Noty && Lampa.Noty.show) { Lampa.Noty.show(text); return; } } catch (e) {} console.log('[CapsuleMod]', text); }
var PLUGIN_ID = 'capsule_mod', COMPONENT = 'capsule_mod_view', CTRL_NAME = 'capsule_mod', TMDB_BASE = 'https://api.themoviedb.org/3', TMDB_DEFAULT_KEY = '04c35731a5ee918f014970082a0088b1', CACHE_TTL = dayMs(), PROFILE_TTL = dayMs();
var WEIGHTS = { completed: 3.0, favorite: 5.0, abandoned: -2.0 };
var SCORE_K = { genre: 0.4, keywords: 0.3, rating: 0.15, recency: 0.15 };
var GENRE_RU = { 28:'Боевик',12:'Приключения',16:'Анимация',35:'Комедия',80:'Криминал',99:'Документальный',18:'Драма',10751:'Семейный',14:'Фэнтези',36:'История',27:'Ужасы',10402:'Музыка',9648:'Детектив',10749:'Мелодрама',878:'Фантастика',10770:'ТВ-фильм',53:'Триллер',10752:'Военный',37:'Вестерн',10759:'Экшен',10762:'Детское',10763:'Новости',10764:'Реалити',10765:'Фантастика и фэнтези',10766:'Мыльные оперы',10767:'Ток-шоу',10768:'Война и политика' };
var PHRASES = { hello:['привет. я всегда готов помочь!','приветствую! подберём что-нибудь на вечер?'], morning:['доброе утро! начнём день с хорошей истории?'], evening:['добрый вечер! время для хорошего кино.'], loading:['сканирую ваши предпочтения...'], error:['ой. сеть мигает, но я не сдаюсь.'], empty:['история пуста. расскажите мне, что любите!'], done:['готово! капсула пересчитана.'], picked:['случайный, но не случайный выбор!'] };
var CSS_TEXT = [
'.cm-root{position:fixed;left:0;top:0;right:0;bottom:0;background:#141414;z-index:9000;color:#fff;font-family:-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden}',
'.cm-header{position:absolute;top:0;left:0;right:0;height:4.2em;display:flex;align-items:center;padding:0 2em;z-index:5}',
'.cm-hbtn{width:2.6em;height:2.6em;display:flex;align-items:center;justify-content:center;border-radius:0.6em;cursor:pointer}',
'.cm-hbtn svg{width:1.5em;height:1.5em;fill:#fff}',
'.cm-title{margin-left:auto;font-size:1.5em;font-weight:600;letter-spacing:0.04em;color:#eee}',
'.cm-dots{margin-left:0.9em;color:#888;font-size:1.4em;line-height:1}',
'.cm-clock{margin-left:0.9em;font-size:1.7em;font-weight:700;color:#fff}',
'.cm-content{position:absolute;top:4.2em;bottom:0;left:0;right:0;overflow:hidden;padding:0 2em}',
'.cm-row{margin-bottom:1.6em}',
'.cm-row-title{font-size:1.25em;color:#cfcfcf;margin:0.4em 0 0.7em 0.1em;font-weight:600}',
'.cm-strip{display:flex;flex-direction:row;overflow:hidden;padding:0.6em 0.2em}',
'.cm-card{position:relative;flex:none;width:11.5em;height:17em;border-radius:0.9em;overflow:hidden;margin-right:1.1em;background:#222;border:0.22em solid transparent;transition:transform 0.15s;cursor:pointer}',
'.cm-card img{width:100%;height:100%;object-fit:cover;display:block}',
'.cm-card.cm-focus{border-color:#fff;transform:scale(1.05);box-shadow:0 0 2em rgba(0,0,0,0.9);z-index:2}',
'.cm-b-type{position:absolute;top:0.5em;left:0.5em;background:#e50914;color:#fff;font-size:0.8em;font-weight:700;padding:0.15em 0.5em;border-radius:0.4em}',
'.cm-b-type.mov{background:#3a3a3a}',
'.cm-b-rate{position:absolute;bottom:0.5em;right:0.5em;background:rgba(0,0,0,0.75);color:#fff;font-size:0.95em;font-weight:700;padding:0.1em 0.5em;border-radius:0.5em}',
'.cm-b-q{position:absolute;top:0.5em;right:0.5em;background:rgba(0,0,0,0.6);color:#9fe3a1;font-size:0.7em;font-weight:700;padding:0.12em 0.45em;border-radius:0.4em}',
'.cm-robot-row{display:flex;align-items:flex-end;margin:1em 0 1em 0}',
'.cm-robot{width:16em;height:16em;flex:none;cursor:pointer;will-change:transform;animation:cm-float 3.4s ease-in-out infinite}',
'.cm-robot.cm-focus{outline:0.22em solid #fff;border-radius:1em;transform:scale(1.05)}',
'.cm-robot svg{width:100%;height:100%}',
'.cm-bubble{position:relative;background:#222;border-radius:1em;padding:1em 1.4em;margin-left:1.6em;max-width:26em;font-size:1.15em;color:#eaeaea;line-height:1.45}',
'.cm-bubble:before{content:"";position:absolute;left:-0.9em;bottom:1.2em;border-top:0.8em solid transparent;border-bottom:0.8em solid transparent;border-right:1em solid #222}',
'@keyframes cm-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-0.5em)}}',
'.cm-details{display:flex;flex-direction:row;height:100%}',
'.cm-d-left{flex:none;width:20em;padding-top:1em}',
'.cm-d-left .cm-card{width:19em;height:28em;margin:0;cursor:default}',
'.cm-d-meta{margin-top:0.9em;color:#bbb;font-size:1.05em;line-height:1.5}',
'.cm-d-meta b{color:#fff}',
'.cm-d-center{flex:1;display:flex;align-items:center;justify-content:center}',
'.cm-play{width:13em;height:8.6em;background:#222;border-radius:1.6em;border:0.25em solid transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.15s}',
'.cm-play svg{width:4em;height:4em;fill:#161616}',
'.cm-play.cm-focus{border-color:#fff;transform:scale(1.06)}',
'.cm-play.cm-focus svg{fill:#000}',
'.cm-d-right{flex:none;width:26em;padding:2em 1em 1em 0}',
'.cm-ai-item{background:#222;border:0.22em solid transparent;border-radius:0.9em;padding:0.8em 1.1em;margin-bottom:0.9em;font-size:1.1em;color:#e6e6e6;cursor:pointer}',
'.cm-ai-item.cm-focus{border-color:#fff;background:#2a2a2a}',
'.cm-drawer{position:absolute;right:0;top:40%;width:1.6em;height:7em;background:#222;border-radius:0.8em 0 0 0.8em;display:flex;align-items:center;justify-content:center;color:#9a9a9a;cursor:pointer;border:0.2em solid transparent;border-right:none}',
'.cm-drawer.cm-focus{border-color:#fff;color:#fff}',
'.cm-overlay{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(10,10,10,0.88);z-index:9500;display:flex;align-items:center;justify-content:center}',
'.cm-panel{background:#1b1b1b;border-radius:1.2em;padding:2em 2.4em;min-width:34em;max-width:60em;max-height:80%;overflow:hidden}',
'.cm-panel h2{margin:0 0 1em 0;font-size:1.5em;color:#fff}',
'.cm-set-item{background:#242424;border:0.22em solid transparent;border-radius:0.8em;padding:0.8em 1.2em;margin-bottom:0.8em;font-size:1.15em;color:#ddd;cursor:pointer;display:flex;justify-content:space-between}',
'.cm-set-item.cm-focus{border-color:#fff}',
'.cm-set-item .val{color:#8fd3ff}',
'.cm-modal-body{padding:0.5em 0.5em;color:#ddd;font-size:1.1em;line-height:1.55;max-height:24em;overflow:hidden}',
'.cm-modal-body h4{color:#fff;margin:0.7em 0 0.4em}',
'.cm-chip{display:inline-block;background:#2a2a2a;border:0.2em solid transparent;border-radius:2em;padding:0.5em 1.2em;margin:0 0.6em 0.8em 0;color:#cfe8ff;cursor:pointer;font-size:1.05em}',
'.cm-chip.cm-focus{border-color:#fff;background:#333}',
'.cm-input-fake{background:#242424;border:0.2em dashed #555;border-radius:0.8em;padding:0.8em 1.2em;margin-bottom:1em;color:#9ad1ff;cursor:pointer}',
'.cm-input-fake.cm-focus{border-color:#fff}',
'.cm-skel{background:#222;animation:cm-pulse 1.2s infinite}',
'@keyframes cm-pulse{0%,100%{opacity:1}50%{opacity:0.45}}'
].join('\n');/* --- CAPSULE MOD PART 2/8 --- */
function injectCSS() {
    if (document.getElementById('capsule_mod_css')) return;
    var st = el('style'); st.id = 'capsule_mod_css'; st.type = 'text/css'; st.innerHTML = CSS_TEXT;
    (document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(st);
}
var SVG_ROBOT = '<svg viewBox="0 0 220 230" xmlns="http://www.w3.org/2000/svg"><g fill="#d8d8d8"><rect x="118" y="8" width="86" height="66" rx="16" transform="rotate(4 161 41)"/><rect x="112" y="86" width="96" height="88" rx="24" transform="rotate(-7 160 130)"/><path d="M120 168 C104 176 96 196 92 214 L112 220 C118 202 126 188 138 182 Z"/><path d="M188 170 C196 186 202 202 206 218 L186 226 C180 208 172 194 164 186 Z"/><path d="M118 100 C96 108 84 124 78 140 L96 148 C104 132 114 120 126 114 Z"/></g><circle cx="146" cy="38" r="9" fill="#111"/><circle cx="149" cy="35" r="2.6" fill="#fff"/><circle cx="180" cy="40" r="9" fill="#111"/><circle cx="183" cy="37" r="2.6" fill="#fff"/><g stroke="#9a9a9a" stroke-width="4" stroke-linecap="round"><path d="M146 112 L176 108"/><path d="M148 124 L178 120"/><path d="M150 136 L180 132"/></g><path d="M128 156 L146 152" stroke="#a33" stroke-width="5" stroke-linecap="round"/></svg>';
var SVG_BACK  = '<svg viewBox="0 0 24 24"><path d="M15.5 4.5 8 12l7.5 7.5 1.6-1.6L11.2 12l5.9-5.9z"/></svg>';
var SVG_GEAR  = '<svg viewBox="0 0 24 24"><path d="M19.4 13c.04-.32.06-.66.06-1s-.02-.68-.07-1l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.9 8.78a.5.5 0 0 0 .12.64L5.05 11c-.05.32-.08.66-.08 1s.03.68.08 1l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.34.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.12-.56 1.62-.94l2.39.96c.24.1.5 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>';
var SVG_PLAY  = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
var SVG_MENU  = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a2.2 2.2 0 1 1 0 4.4A2.2 2.2 0 0 1 12 7zm-4.4 8.6c.6-2 2.3-3.2 4.4-3.2s3.8 1.2 4.4 3.2c-1.2 1.2-2.7 1.9-4.4 1.9s-3.2-.7-4.4-1.9z"/></svg>';
var POSTER_PH = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#222"/><text x="100" y="150" fill="#666" font-size="16" text-anchor="middle">capsule</text></svg>');
function isOn(v) { return v === true || v === 'on' || v === 'true' || v === 1 || v === '1'; }
function cfgMascot() { return isOn(sGet('capsule_mod_mascot', true)); }
function cfgDepth()  { var v = sGet('capsule_mod_depth', 'month'); return (String(v).indexOf('все') > -1 || v === 'all') ? 'all' : 'month'; }
function cfgSens()   { var v = sGet('capsule_mod_sens', 'strict'); return (String(v).indexOf('эксп') > -1 || v === 'experimental') ? 'exp' : 'strict'; }
function cfgKey()    { return sGet('capsule_mod_tmdb_key', '') || sGet('tmdb_api_key', '') || TMDB_DEFAULT_KEY; }
var cacheMem = sGet('capsule_mod_cache', {}) || {};
function cacheGet(url) { var e = cacheMem[url]; if (e && e.d && (nowMs() - e.t) < CACHE_TTL) return e.d; return null; }
function cacheSet(url, d) {
    var keys = [], k; for (k in cacheMem) if (Object.prototype.hasOwnProperty.call(cacheMem, k)) keys.push({ k: k, t: cacheMem[k].t || 0 });
    if (keys.length > 90) { keys.sort(function (a, b) { return a.t - b.t; }); for (var i = 0; i < 30; i++) delete cacheMem[keys[i].k]; }
    cacheMem[url] = { t: nowMs(), d: d }; sSet('capsule_mod_cache', cacheMem);
}
var TMDB = {
    url: function (path, params) {
        var q = 'api_key=' + encodeURIComponent(cfgKey()) + '&language=ru-RU';
        if (params) for (var k in params) if (params[k] != null && params[k] !== '') q += '&' + k + '=' + encodeURIComponent(params[k]);
        return TMDB_BASE + path + '?' + q;
    },
    get: function (path, params, cb, err) {
        var u = this.url(path, params); var c = cacheGet(u); if (c) { cb(c); return; }
        httpGet(u, function (d) { cacheSet(u, d); cb(d); }, err || function () {});
    },
    img: function (p, size) {
        if (!p) return POSTER_PH;
        try { if (window.Lampa && Lampa.TMDB && Lampa.TMDB.image) return Lampa.TMDB.image(p, size || 'w342'); } catch (e) {}
        return 'https://image.tmdb.org/t/p/' + (size || 'w342') + p;
    }
};
var Engine = {
    readHistory: function () {
        var out = [], seen = {}, h, i;
        try {
            var tl = sGet('timeline', {});
            if (tl && typeof tl === 'object') {
                for (h in tl) {
                    if (!Object.prototype.hasOwnProperty.call(tl, h)) continue; var e = tl[h]; if (!e || typeof e !== 'object') continue;
                    var id = e.id || (e.card && e.card.id); if (!id) continue;
                    var type = (e.method === 'tv' || e.type === 'tv' || (e.card && (e.card.name || e.card.original_name))) ? 'tv' : 'movie';
                    var percent = typeof e.percent === 'number' ? e.percent : ((e.timeline && e.timeline.percent) || 0);
                    var date = e.date || e.last_time || e.updated || 0; var key = type + ':' + id; if (seen[key]) continue; seen[key] = 1;
                    out.push({ id: id, type: type, percent: percent, date: date, favorite: false });
                }
            }
        } catch (e) {}
        try {
            if (window.Lampa && Lampa.Timeline && typeof Lampa.Timeline.view === 'function') {
                var list = Lampa.Timeline.view(0, 200);
                if (list && list.length) { for (i = 0; i < list.length; i++) { var it = list[i]; if (!it || !it.id) continue; var kk = (it.type || 'movie') + ':' + it.id; if (seen[kk]) continue; seen[kk] = 1; out.push({ id: it.id, type: it.type === 'tv' ? 'tv' : 'movie', percent: it.progress || it.percent || 0, date: it.date || 0, favorite: false }); } }
            }
        } catch (e) {}
        try {
            var fav = sGet('favorite', {});
            var walk = function (v) {
                if (!v) return; if (v instanceof Array) { for (var j = 0; j < v.length; j++) walk(v[j]); return; }
                if (typeof v === 'object' && v.id) { var t = (v.name || v.original_name) ? 'tv' : 'movie'; var key2 = t + ':' + v.id; if (!seen[key2]) { seen[key2] = 1; out.push({ id: v.id, type: t, percent: 100, date: v.date || 0, favorite: true, card: v }); } }
            }; walk(fav);
        } catch (e) {}
        return out;
    },
    classify: function (history) {
        var events = []; var cutoff = cfgDepth() === 'month' ? (nowMs() - 30 * dayMs()) : 0;
        for (var i = 0; i < history.length; i++) {
            var it = history[i]; if (cutoff && it.date && it.date * (String(it.date).length > 11 ? 1 : 1000) < cutoff) continue;
            var w = 0; if (it.favorite) w = WEIGHTS.favorite; else if (it.percent >= 85) w = WEIGHTS.completed;
            else if (it.percent > 0 && it.percent < 25) { var ts = String(it.date).length > 11 ? it.date : it.date * 1000; if (it.date && (nowMs() - ts) > 7 * dayMs()) w = WEIGHTS.abandoned; }
            if (w !== 0) events.push({ id: it.id, type: it.type, weight: w, date: it.date, card: it.card });
        }
        events.sort(function (a, b) { return Math.abs(b.weight) - Math.abs(a.weight) || (b.date || 0) - (a.date || 0); }); return events;
    },/* --- CAPSULE MOD PART 3/8 --- */
    watchedMap: function () { var m = {}, h = this.readHistory(); for (var i = 0; i < h.length; i++) m[h[i].type + ':' + h[i].id] = 1; return m; },
    computeProfile: function (cb) {
        var events = this.classify(this.readHistory()).slice(0, 20); var interests = {}; var idx = 0; var self = this;
        function aggregate(d, w) {
            var i; if (d.genre_ids) for (i = 0; i < d.genre_ids.length; i++) interests['g' + d.genre_ids[i]] = (interests['g' + d.genre_ids[i]] || 0) + w;
            if (d.genres) for (i = 0; i < d.genres.length; i++) interests['g' + d.genres[i].id] = (interests['g' + d.genres[i].id] || 0) + w;
            var kw = d.keywords && d.keywords.keywords ? d.keywords.keywords : (d.keywords instanceof Array ? d.keywords : []);
            for (i = 0; i < Math.min(kw.length, 10); i++) interests['k' + kw[i].id] = (interests['k' + kw[i].id] || 0) + w;
            var cast = d.credits && d.credits.cast ? d.credits.cast : [];
            for (i = 0; i < Math.min(cast.length, 5); i++) interests['p' + cast[i].id] = (interests['p' + cast[i].id] || 0) + w * 0.5;
        }
        function next() { if (idx >= events.length) return finish(); var ev = events[idx++]; TMDB.get('/' + ev.type + '/' + ev.id, { append_to_response: 'keywords,credits' }, function (d) { aggregate(d, ev.weight); next(); }, function () { next(); }); }
        function finish() { for (var k in interests) if (Object.prototype.hasOwnProperty.call(interests, k) && interests[k] <= 0) delete interests[k]; var profile = { interests: interests, last_updated: nowMs() }; sSet('capsule_mod_profile', profile); cb(profile); }
        if (!events.length) return finish(); next();
    },
    ensureProfile: function (force, cb) {
        var p = sGet('capsule_mod_profile', null); if (!force && p && p.interests && (nowMs() - (p.last_updated || 0)) < PROFILE_TTL) { cb(p); return; } this.computeProfile(cb);
    },
    topCompleted: function (events, n) { var r = []; for (var i = 0; i < events.length && r.length < n; i++) if (events[i].weight >= WEIGHTS.completed) r.push(events[i]); return r; },
    discover: function (profile, extra, cb, err) {
        var pos = [], neg = [], kws = [], k, i; var inter = (profile && profile.interests) || {}; var g = [], kk = [];
        for (k in inter) { if (!Object.prototype.hasOwnProperty.call(inter, k)) continue; if (k.charAt(0) === 'g') g.push({ id: k.slice(1), w: inter[k] }); if (k.charAt(0) === 'k') kk.push({ id: k.slice(1), w: inter[k] }); }
        g.sort(function (a, b) { return b.w - a.w; }); kk.sort(function (a, b) { return b.w - a.w; });
        for (i = 0; i < Math.min(g.length, 4); i++) if (g[i].w > 0) pos.push(g[i].id); else neg.push(g[i].id);
        for (i = 0; i < Math.min(kk.length, 4); i++) if (kk[i].w > 0) kws.push(kk[i].id);
        if (cfgSens() === 'strict' && pos.length > 2) pos = pos.slice(0, 2);
        var params = { sort_by: (extra && extra.sort) || 'popularity.desc', 'vote_average.gte': 6.0, include_adult: false, include_video: false, page: 1 };
        if (pos.length) params.with_genres = pos.join(','); if (neg.length) params.without_genres = neg.join(','); if (kws.length) params.with_keywords = kws.join('|');
        if (extra) for (k in extra) if (k !== 'sort') params[k] = extra[k];
        var done = 0, merged = [];
        function one(type) { TMDB.get('/discover/' + type, params, function (d) { var r = d.results || []; for (var j = 0; j < r.length; j++) { r[j].media_type = type; merged.push(r[j]); } fin(); }, fin); }
        function fin() { done++; if (done === 2) cb(merged); } one('movie'); one('tv');
    },
    similar: function (profile, cb) {
        var tops = this.topCompleted(this.classify(this.readHistory()), 3); var merged = [], done = 0;
        function fin() { done++; if (done === Math.max(tops.length, 1)) cb(merged); } if (!tops.length) return cb([]);
        for (var i = 0; i < tops.length; i++) { (function (ev) { TMDB.get('/' + ev.type + '/' + ev.id + '/recommendations', { page: 1 }, function (d) { var r = d.results || []; for (var j = 0; j < r.length; j++) { r[j].media_type = ev.type; merged.push(r[j]); } fin(); }, fin); })(tops[i]); }
    },
    scoreAsync: function (list, profile, watched, seen, cb) {
        var inter = (profile && profile.interests) || {}; var maxG = 1, i, j;
        for (i = 0; i < list.length; i++) { var gw0 = 0, g0 = list[i].genre_ids || []; for (j = 0; j < g0.length; j++) gw0 += inter['g' + g0[j]] || 0; if (gw0 > maxG) maxG = gw0; list[i]._gw = gw0; }
        list.sort(function (a, b) { return (b._gw || 0) - (a._gw || 0) || (b.vote_average || 0) - (a.vote_average || 0); });
        var top = list.slice(0, 14); var cnt = 0, out = [];
        function final() {
            out.sort(function (a, b) { return b.score - a.score; }); var res = [];
            for (var q = 0; q < out.length; q++) { var mm = out[q].movie; var t = mm.media_type || (mm.name ? 'tv' : 'movie'); var key = t + ':' + mm.id; if (watched[key] || seen[key]) continue; seen[key] = 1; res.push(mm); if (res.length >= 20) break; } cb(res);
        }
        function push(m, kw) {
            var gw2 = m._gw || 0; var gn = Math.min(10, (gw2 / maxG) * 10); var kn = Math.min(10, (kw / Math.max(maxG, 3)) * 10); var rating = m.vote_average || 0;
            var rel = (m.release_date || m.first_air_date || ''); var days = rel ? Math.max(0, (nowMs() - new Date(rel).getTime()) / dayMs()) : 3650; var rec = Math.max(0, 10 * (1 - days / (365 * 3)));
            out.push({ movie: m, score: gn * SCORE_K.genre + kn * SCORE_K.keywords + rating * SCORE_K.rating + rec * SCORE_K.recency });
        }
        if (!top.length) return cb([]);
        for (i = 0; i < top.length; i++) {
            (function (m) {
                var t = m.media_type || (m.name ? 'tv' : 'movie');
                TMDB.get('/' + t + '/' + m.id + '/keywords', {}, function (d) { var kw = 0, ks = d.keywords || (d.results || []); for (var j3 = 0; j3 < ks.length; j3++) kw += inter['k' + ks[j3].id] || 0; push(m, kw); cnt++; if (cnt === top.length) final(); }, function () { push(m, 0); cnt++; if (cnt === top.length) final(); });
            })(top[i]);
        }
    },/* --- CAPSULE MOD PART 4/8 --- */
    buildBundle: function (profile, cb) {
        var self = this; var watched = this.watchedMap(); var seen = {}; var bundle = { day: [], similar: [], fresh: [] }; var done = 0;
        function fin() { done++; if (done === 3) cb(bundle); }
        this.discover(profile, {}, function (list) { self.scoreAsync(list, profile, watched, seen, function (r) { bundle.day = r; fin(); }); }, fin);
        this.similar(profile, function (list) { self.scoreAsync(list, profile, watched, seen, function (r) { bundle.similar = r; fin(); }); }, fin);
        var year = new Date().getFullYear();
        this.discover(profile, { sort_by: 'popularity.desc', 'primary_release_date.gte': (year - 2) + '-01-01', 'first_air_date.gte': (year - 2) + '-01-01' }, function (list) { self.scoreAsync(list, profile, watched, seen, function (r) { bundle.fresh = r; fin(); }); }, fin);
    },
    queryBundle: function (profile, f, cb) {
        var self = this; var watched = this.watchedMap(); var seen = {};
        var params = { sort_by: 'popularity.desc', 'vote_average.gte': 6.0 };
        if (f.with_genres && f.with_genres.length) params.with_genres = f.with_genres.join(',');
        if (f.without_genres && f.without_genres.length) params.without_genres = f.without_genres.join(',');
        if (f.year_gte) params['primary_release_date.gte'] = f.year_gte + '-01-01';
        if (f.year_lte) params['primary_release_date.lte'] = f.year_lte + '-12-31';
        this.discover(profile, params, function (list) { self.scoreAsync(list, profile, watched, seen, cb); }, function () { cb([]); });
    },
    resetProfile: function (cb) { sDel('capsule_mod_profile'); this.computeProfile(cb); }
};
function parseUserQuery(text) {
    var s = String(text || '').toLowerCase(); var f = { with_genres: [], without_genres: [], phrase: '' };
    var rules = [ { re: /комед|смешн|весел|юмор/, g: 35 }, { re: /боевик|экшн|экшен/, g: 28 }, { re: /фантаст|космос|sci-?fi/, g: 878 }, { re: /ужас|хоррор|страш/, g: 27 }, { re: /триллер|напряж|саспенс/, g: 53 }, { re: /драм/, g: 18 }, { re: /романти|мелодрам|любов/, g: 10749 }, { re: /детектив|криминал|расслед/, g: 80 }, { re: /приключени/, g: 12 }, { re: /аниме|манга|мульт/, g: 16 }, { re: /семейн|детск|ребен/, g: 10751 }, { re: /документал/, g: 99 }, { re: /фэнтези|маги|дракон/, g: 14 } ];
    for (var i = 0; i < rules.length; i++) { var m = s.match(rules[i].re); if (m) { var posIdx = m.index; var before = s.substring(Math.max(0, posIdx - 14), posIdx); if (/без|кроме|не\s/.test(before)) f.without_genres.push(rules[i].g); else f.with_genres.push(rules[i].g); } }
    if (/90[-хx]/.test(s)) { f.year_gte = 1990; f.year_lte = 1999; } else if (/80[-хx]/.test(s)) { f.year_gte = 1980; f.year_lte = 1989; } else if (/2000[-хx]/.test(s)) { f.year_gte = 2000; f.year_lte = 2009; } else if (/новинк|свеж/.test(s)) { f.year_gte = new Date().getFullYear() - 1; } else if (/стар|классик|ретро/.test(s)) { f.year_lte = 2000; }
    var names = []; for (var j = 0; j < f.with_genres.length; j++) names.push((GENRE_RU[f.with_genres[j]] || '').toLowerCase());
    f.phrase = f.with_genres.length ? 'принял! собираю ' + names.join(' + ') + (f.without_genres.length ? ', без лишнего.' : '.') : 'хм, попробую прочитать настроение по-своему!'; return f;
}
var MOODS = [ { title: '🎉 Весёлое и лёгкое', f: { with_genres: [35], 'vote_average.gte': 6.5 } }, { title: '🌚 Мрачное и напряжённое', f: { with_genres: [53, 27] } }, { title: '💖 Романтичное', f: { with_genres: [10749] } }, { title: '🚀 Приключенческое', f: { with_genres: [12, 878] } }, { title: '👨👩‍ Семейное', f: { with_genres: [10751, 16] } }, { title: '🧠 Загадочное', f: { with_genres: [9648, 80] } } ];
function robotPhrase(state) { var h = new Date().getHours(); if (state === 'hello') return h < 6 ? rnd(PHRASES.evening) : (h < 12 ? rnd(PHRASES.morning) : rnd(PHRASES.hello)); return rnd(PHRASES[state] || PHRASES.hello); }
var FM = {
    rows: [], r: 0, i: 0, stack: [],
    setRows: function (rows, r, i) { this.rows = rows || []; this.r = r || 0; this.i = i || 0; this.apply(); },
    push: function () { this.stack.push({ rows: this.rows, r: this.r, i: this.i }); },
    pop: function () { var s = this.stack.pop(); if (s) { this.rows = s.rows; this.r = s.r; this.i = s.i; this.apply(); } },
    current: function () { var row = this.rows[this.r]; return row && row.length ? row[Math.min(this.i, row.length - 1)] : null; },
    apply: function () {
        var nodes = document.querySelectorAll('.cm-focus'); for (var i = 0; i < nodes.length; i++) removeClass(nodes[i], 'cm-focus');
        var n = this.current(); if (!n) return; addClass(n, 'cm-focus');
        var strip = n.parentNode && hasClass(n.parentNode, 'cm-strip') ? n.parentNode : null;
        if (strip) { var to = n.offsetLeft - strip.clientWidth / 2 + n.clientWidth / 2; to = Math.max(0, Math.min(to, strip.scrollWidth - strip.clientWidth)); tweenScroll(strip, 'scrollLeft', to, 200); }
        var content = document.querySelector('.cm-content');
        if (content && n.offsetTop !== undefined) { var top = n.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop; if (top < 60 || top > content.clientHeight - 220) tweenScroll(content, 'scrollTop', Math.max(0, top - content.clientHeight / 2), 220); }
        if (typeof Capsule.onFocus === 'function') Capsule.onFocus(n);
    },
    move: function (dir) {
        if (!this.rows.length) return;
        if (dir === 'left' || dir === 'right') { var row = this.rows[this.r]; var ni = this.i + (dir === 'right' ? 1 : -1); if (ni < 0 || ni >= row.length) return; this.i = ni; this.apply(); return; }
        var nr = this.r + (dir === 'down' ? 1 : -1); if (nr < 0 || nr >= this.rows.length) return;
        var cur = this.current(); var target = this.rows[nr]; var best = 0, bestD = 1e9, cx = cur ? cur.getBoundingClientRect().left : 0;
        for (var i = 0; i < target.length; i++) { var d = Math.abs(target[i].getBoundingClientRect().left - cx); if (d < bestD) { bestD = d; best = i; } }
        this.r = nr; this.i = best; this.apply();
    }
};/* --- CAPSULE MOD PART 5/8 --- */
var state = { view: 'main', cards: {}, bundle: null, profile: null, custom: null, current: null, root: null, clockTimer: null, settingsOpen: false };
function normMovie(m) {
    return { id: m.id, type: m.media_type ? (m.media_type === 'tv' ? 'tv' : 'movie') : (m.name || m.original_name ? 'tv' : 'movie'), title: m.title || m.name || 'Без названия', poster_path: m.poster_path, vote_average: m.vote_average || 0, release_date: m.release_date || m.first_air_date || '', genre_ids: m.genre_ids || [], overview: m.overview || '' };
}
function buildCard(m) {
    var mm = normMovie(m); state.cards[mm.type + ':' + mm.id] = mm;
    var card = el('div', 'cm-card'); card.setAttribute('data-cm-action', 'card'); card.setAttribute('data-key', mm.type + ':' + mm.id);
    var img = el('img'); img.src = TMDB.img(mm.poster_path, 'w342'); img.alt = esc(mm.title); card.appendChild(img);
    card.appendChild(el('div', 'cm-b-type' + (mm.type === 'movie' ? ' mov' : ''), mm.type === 'tv' ? 'TV' : 'FILM'));
    card.appendChild(el('div', 'cm-b-q', 'HD'));
    card.appendChild(el('div', 'cm-b-rate', mm.vote_average ? mm.vote_average.toFixed(1) : '—'));
    return card;
}
function buildRow(title, movies) {
    var row = el('div', 'cm-row'); row.appendChild(el('div', 'cm-row-title', esc(title)));
    var strip = el('div', 'cm-strip');
    for (var i = 0; i < movies.length; i++) strip.appendChild(buildCard(movies[i]));
    if (!movies.length) strip.appendChild(el('div', 'cm-bubble', 'пусто... робот уже ищет исправление'));
    row.appendChild(strip); return row;
}
function skeletonRows() {
    var content = state.root.querySelector('.cm-content'); content.innerHTML = '';
    for (var r = 0; r < 3; r++) {
        var row = el('div', 'cm-row'); row.appendChild(el('div', 'cm-row-title', '...'));
        var strip = el('div', 'cm-strip');
        for (var i = 0; i < 6; i++) strip.appendChild(el('div', 'cm-card cm-skel'));
        row.appendChild(strip); content.appendChild(row);
    }
}
function buildRobotRow() {
    var row = el('div', 'cm-robot-row');
    var robot = el('div', 'cm-robot'); robot.setAttribute('data-cm-action', 'robot'); robot.innerHTML = SVG_ROBOT;
    var bubble = el('div', 'cm-bubble', esc(robotPhrase('hello'))); bubble.id = 'cm_bubble';
    row.appendChild(robot); row.appendChild(bubble); return row;
}
function robotSay(text) { var b = document.getElementById('cm_bubble'); if (b) b.innerHTML = esc(text); }
function buildHeader() {
    var h = el('div', 'cm-header');
    var back = el('div', 'cm-hbtn'); back.setAttribute('data-cm-action', 'back'); back.innerHTML = SVG_BACK;
    var title = el('div', 'cm-title', 'capsule mod');
    var gear = el('div', 'cm-hbtn'); gear.setAttribute('data-cm-action', 'settings'); gear.innerHTML = SVG_GEAR;
    var dots = el('div', 'cm-dots', '⋮');
    var clock = el('div', 'cm-clock', '--:--'); clock.id = 'cm_clock';
    h.appendChild(back); h.appendChild(title); h.appendChild(gear); h.appendChild(dots); h.appendChild(clock); return h;
}
function tickClock() { var c = document.getElementById('cm_clock'); if (c) { var d = new Date(); c.innerHTML = pad2(d.getHours()) + ':' + pad2(d.getMinutes()); } }
function renderMain() {
    state.view = 'main'; state.cards = {};
    var content = state.root.querySelector('.cm-content'); content.innerHTML = '';
    var drawer = state.root.querySelector('.cm-drawer'); if (drawer) drawer.parentNode.removeChild(drawer);
    var b = state.bundle || { day: [], similar: [], fresh: [] };
    if (state.custom && state.custom.list) content.appendChild(buildRow(state.custom.title, state.custom.list));
    content.appendChild(buildRow('Капсула дня', b.day));
    content.appendChild(buildRow('Похоже на то, что вы досмотрели', b.similar));
    content.appendChild(buildRow('Новые горизонты (микс жанров)', b.fresh));
    if (cfgMascot()) content.appendChild(buildRobotRow());
    var rows = [[state.root.querySelector('[data-cm-action="back"]'), state.root.querySelector('[data-cm-action="settings"]')]];
    var strips = content.querySelectorAll('.cm-strip');
    for (var i = 0; i < strips.length; i++) { var cards = strips[i].querySelectorAll('.cm-card[data-cm-action="card"]'); if (cards.length) rows.push([].slice.call(cards, 0)); }
    var robot = content.querySelector('[data-cm-action="robot"]'); if (robot) rows.push([robot]);
    FM.setRows(rows, 1, 0);
}
function loadMainData(force) {
    skeletonRows(); robotSay(robotPhrase('loading'));
    Engine.ensureProfile(force, function (profile) {
        state.profile = profile;
        Engine.buildBundle(profile, function (bundle) { state.bundle = bundle; renderMain(); var total = bundle.day.length + bundle.similar.length + bundle.fresh.length; robotSay(total ? robotPhrase('hello') : robotPhrase('empty')); });
    });
}
function renderDetails(movie) {
    state.view = 'details'; state.current = movie;
    var content = state.root.querySelector('.cm-content'); content.innerHTML = '';
    var wrap = el('div', 'cm-details');
    var left = el('div', 'cm-d-left');
    var poster = el('div', 'cm-card');
    var img = el('img'); img.src = TMDB.img(movie.poster_path, 'w500'); poster.appendChild(img);
    poster.appendChild(el('div', 'cm-b-type' + (movie.type === 'movie' ? ' mov' : ''), movie.type === 'tv' ? 'TV' : 'HD'));
    poster.appendChild(el('div', 'cm-b-rate', movie.vote_average ? movie.vote_average.toFixed(1) : '—'));
    left.appendChild(poster);
    var year = (movie.release_date || '').slice(0, 4);
    left.appendChild(el('div', 'cm-d-meta', '<b>' + esc(movie.title) + '</b><br>' + (year ? year + ' · ' : '') + (movie.type === 'tv' ? 'сериал' : 'фильм')));
    wrap.appendChild(left);
    var center = el('div', 'cm-d-center');
    var play = el('div', 'cm-play'); play.setAttribute('data-cm-action', 'play'); play.innerHTML = SVG_PLAY; center.appendChild(play);
    wrap.appendChild(center);
    var right = el('div', 'cm-d-right');
    var items = [ { a: 'ai_desc', t: '📝 Показать описание и сюжет' }, { a: 'ai_fit', t: '👥 Кому подойдёт, а кому нет' }, { a: 'ai_rev', t: '💬 Отзывы и мнения зрителей' }, { a: 'ai_facts', t: '🎭 Актёры и интересные факты' } ];
    for (var i = 0; i < items.length; i++) { var it = el('div', 'cm-ai-item', esc(items[i].t)); it.setAttribute('data-cm-action', items[i].a); right.appendChild(it); }
    wrap.appendChild(right); content.appendChild(wrap);
    var drawer = el('div', 'cm-drawer', '‹'); drawer.setAttribute('data-cm-action', 'drawer'); state.root.appendChild(drawer);
    FM.setRows([ [state.root.querySelector('[data-cm-action="back"]'), state.root.querySelector('[data-cm-action="settings"]')], [play, drawer], [].slice.call(right.querySelectorAll('.cm-ai-item'), 0) ], 1, 0);
    robotSay('отличный выбор! меню робота справа расскажет всё о «' + movie.title + '».');
}
function openFullCard(m) { try { Lampa.Activity.push({ url: '', component: 'full', id: m.id, method: m.type, card: m, source: 'tmdb' }); } catch (e) { notify('Не удалось открыть карточку Lampa'); } }/* --- CAPSULE MOD PART 6/8 --- */
function modalOpen(title, node, onBack) {
    try { if (window.Lampa && Lampa.Modal && Lampa.Modal.open) { Lampa.Modal.open({ title: title, html: node, size: 'large', onBack: onBack || function () { Lampa.Modal.close(); Lampa.Controller.toggle(CTRL_NAME); } }); bindMouse(node); return; } } catch (e) {}
    var ov = el('div', 'cm-overlay'); var panel = el('div', 'cm-panel');
    panel.appendChild(el('h2', '', esc(title))); panel.appendChild(node); ov.appendChild(panel); state.root.appendChild(ov); bindMouse(ov);
}
function modalClose() {
    try { if (window.Lampa && Lampa.Modal && Lampa.Modal.close) { Lampa.Modal.close(); return; } } catch (e) {}
    var ov = state.root && state.root.querySelector('.cm-overlay'); if (ov) ov.parentNode.removeChild(ov);
}
function openAiDialog() {
    var body = el('div', 'cm-modal-body');
    var input = el('div', 'cm-input-fake selector', '✍️ Написать запрос роботу...'); input.setAttribute('data-cm-action', 'ai_input'); body.appendChild(input);
    var chips = el('div');
    var chipDefs = [ { t: '🔄 Обновить рекомендации', a: 'ai_refresh' }, { t: '🍿 Случайный фильм на вечер', a: 'ai_random' }, { t: '🎯 Фильтр по настроению', a: 'ai_mood' } ];
    for (var i = 0; i < chipDefs.length; i++) { var c = el('div', 'cm-chip selector', esc(chipDefs[i].t)); c.setAttribute('data-cm-action', chipDefs[i].a); chips.appendChild(c); }
    body.appendChild(chips);
    body.appendChild(el('div', '', '<br><span style="color:#777">Робот понимает: «найди космическую фантастику без ужасов», «комедия 90-х», «что-то романтичное на вечер»...</span>'));
    modalOpen('Капсула: диалог с роботом', body);
}
function aiApplyFilters(title, f) {
    modalClose(); robotSay(f.phrase || robotPhrase('loading')); skeletonRows();
    Engine.queryBundle(state.profile || { interests: {} }, f, function (list) {
        state.custom = { title: title, list: list }; state.bundle = null; renderMain();
        robotSay(list.length ? 'готово! обновил «Капсулу дня» под ваш запрос.' : robotPhrase('empty'));
    });
}
function aiRandom() {
    var pool = (state.bundle && state.bundle.day.length ? state.bundle.day : []);
    function show(m) {
        var mm = normMovie(m);
        var body = el('div', 'cm-modal-body');
        body.appendChild(el('div', '', '<h4>🎲 ' + esc(mm.title) + '</h4><img src="' + TMDB.img(mm.poster_path, 'w342') + '" style="height:14em;border-radius:0.7em;float:left;margin-right:1em"/><div>⭐ ' + (mm.vote_average ? mm.vote_average.toFixed(1) : '—') + ' · ' + ((mm.release_date || '').slice(0, 4) || '—') + '</div><div style="clear:both;margin-top:0.8em">' + esc((mm.overview || 'Описание появится после загрузки.').slice(0, 300)) + '</div>'));
        var go = el('div', 'cm-chip selector', '▶ Смотреть'); go.setAttribute('data-cm-action', 'ai_random_play'); body.appendChild(go);
        modalOpen(rnd(PHRASES.picked), body); state.cards['rand'] = mm;
    }
    if (pool.length) { show(rnd(pool)); return; }
    TMDB.get('/discover/movie', { sort_by: 'popularity.desc', 'vote_average.gte': 6.5 }, function (d) { var r = d.results || []; if (r.length) show(rnd(r)); else notify('пусто'); }, function () { notify(robotPhrase('error')); });
}
function aiInfo(kind) {
    var m = state.current; if (!m) return;
    var path = '/' + m.type + '/' + m.id;
    if (kind === 'ai_desc') {
        TMDB.get(path, {}, function (d) { modalOpen('Описание и сюжет', el('div', 'cm-modal-body', '<h4>📝 ' + esc(d.title || d.name || m.title) + '</h4><div>' + esc(d.overview || 'Описание отсутствует.') + '</div>')); }, function () { notify(robotPhrase('error')); });
    }
    if (kind === 'ai_fit') {
        TMDB.get(path, {}, function (d) {
            var g = d.genres || [], pros = [], cons = [], i, ids = [];
            for (i = 0; i < g.length; i++) ids.push(g[i].id);
            if (ids.indexOf(28) > -1 || ids.indexOf(53) > -1) { pros.push('любителям динамики и адреналина'); cons.push('тем, кто хочет спокойное созерцательное кино'); }
            if (ids.indexOf(35) > -1) { pros.push('для лёгкого вечера и хорошего настроения'); cons.push('ищущим тяжёлую драму'); }
            if (ids.indexOf(27) > -1) { pros.push('крепким нервам и фанатам адреналина'); cons.push('впечатлительным зрителям и детям'); }
            if (ids.indexOf(10751) > -1 || ids.indexOf(16) > -1) pros.push('для семейного просмотра');
            if (ids.indexOf(18) > -1) { pros.push('ценителям глубины и актёрской игры'); cons.push('любителям чистого экшена'); }
            if (ids.indexOf(10749) > -1) pros.push('романтично настроенным зрителям');
            if (!pros.length) pros.push('широкой аудитории');
            var consF = []; for (i = 0; i < cons.length; i++) if (cons[i]) consF.push(cons[i]);
            var rt = d.runtime || (d.episode_run_time && d.episode_run_time[0]) || 0;
            var html = '<h4>👥 Кому подойдёт</h4><div>✅ ' + pros.join('<br>✅ ') + '</div>';
            if (consF.length) html += '<h4>Кому нет</h4><div>⛔ ' + consF.join('<br>⛔ ') + '</div>';
            html += '<div style="margin-top:0.8em;color:#888">Темп: ' + (rt && rt > 120 ? 'основательный, ' + rt + ' мин.' : rt ? 'бодрый, ' + rt + ' мин.' : 'неизвестен') + '</div>';
            modalOpen('Кому подойдёт', el('div', 'cm-modal-body', html));
        }, function () { notify(robotPhrase('error')); });
    }
    if (kind === 'ai_rev') {
        TMDB.get(path + '/reviews', { language: 'ru-RU' }, function (d) {
            var r = d.results || [];
            if (!r.length) TMDB.get(path + '/reviews', { language: 'en-US' }, function (d2) { renderRev(d2.results || []); }, function () { notify(robotPhrase('error')); });
            else renderRev(r);
            function renderRev(list) {
                var html = '<h4>💬 Отзывы зрителей</h4>';
                if (!list.length) html += '<div>Отзывов пока нет — станьте первым!</div>';
                for (var i = 0; i < Math.min(list.length, 3); i++) html += '<div style="margin-bottom:0.9em"><b>' + esc(list[i].author) + ':</b> ' + esc(String(list[i].content).slice(0, 260)) + '…</div>';
                modalOpen('Отзывы', el('div', 'cm-modal-body', html));
            }
        }, function () { notify(robotPhrase('error')); });
    }
    if (kind === 'ai_facts') {
        TMDB.get(path, { append_to_response: 'credits,keywords' }, function (d) {
            var html = '<h4>🎭 Актёры</h4><div>';
            var cast = (d.credits && d.credits.cast) || [];
            for (var i = 0; i < Math.min(cast.length, 6); i++) html += '• ' + esc(cast[i].name) + ' — ' + esc(cast[i].character) + '<br>';
            var crew = (d.credits && d.credits.crew) || [], dir = '';
            for (var j = 0; j < crew.length; j++) if (crew[j].job === 'Director') { dir = crew[j].name; break; }
            if (dir) html += '<br>Режиссёр: <b>' + esc(dir) + '</b>';
            html += '</div><h4>✨ Факты</h4><div>';
            if (d.budget) html += 'Бюджет: $' + (d.budget / 1000000).toFixed(1) + ' млн<br>';
            if (d.revenue) html += 'Сборы: $' + (d.revenue / 1000000).toFixed(1) + ' млн<br>';
            var kw = (d.keywords && (d.keywords.keywords || d.keywords)) || [];
            if (kw.length) { var names = []; for (var k = 0; k < Math.min(kw.length, 6); k++) names.push(esc(kw[k].name)); html += 'Ключевые темы: ' + names.join(', '); }
            html += '</div>';
            modalOpen('Актёры и факты', el('div', 'cm-modal-body', html));
        }, function () { notify(robotPhrase('error')); });
    }
}/* --- CAPSULE MOD PART 7/8 --- */
function openSettings() {
    state.settingsOpen = true; FM.push();
    var ov = el('div', 'cm-overlay'); ov.id = 'cm_settings';
    var panel = el('div', 'cm-panel'); panel.appendChild(el('h2', '', '⚙️ Capsule Mod — настройки'));
    function item(label, valText, action) { var it = el('div', 'cm-set-item'); it.setAttribute('data-cm-action', action); it.appendChild(el('span', '', esc(label))); it.appendChild(el('span', 'val', esc(valText))); return it; }
    panel.appendChild(item('🤖 Маскот-робот', cfgMascot() ? 'вкл' : 'выкл', 'set_mascot'));
    panel.appendChild(item('🕓 Глубина анализа истории', cfgDepth() === 'all' ? 'за всё время' : 'за месяц', 'set_depth'));
    panel.appendChild(item('🧠 Алгоритм', cfgSens() === 'exp' ? 'больше экспериментов' : 'точные совпадения', 'set_sens'));
    panel.appendChild(item('🔑 TMDB API ключ', cfgKey() === TMDB_DEFAULT_KEY ? 'по умолчанию' : 'свой', 'set_key'));
    panel.appendChild(item('♻️ Сбросить и пересчитать профиль', '', 'set_reset'));
    panel.appendChild(item('✖ Закрыть', '', 'set_close'));
    ov.appendChild(panel); state.root.appendChild(ov); bindMouse(ov);
    FM.setRows([].slice.call(ov.querySelectorAll('.cm-set-item'), 0), 0, 0);
}
function closeSettings() { var ov = document.getElementById('cm_settings'); if (ov) ov.parentNode.removeChild(ov); state.settingsOpen = false; FM.pop(); }
function settingsAction(a) {
    if (a === 'set_close') { closeSettings(); return; }
    if (a === 'set_mascot') { sSet('capsule_mod_mascot', cfgMascot() ? false : true); closeSettings(); openSettings(); if (state.view === 'main') renderMain(); return; }
    if (a === 'set_depth') { sSet('capsule_mod_depth', cfgDepth() === 'all' ? 'month' : 'all'); closeSettings(); openSettings(); return; }
    if (a === 'set_sens') { sSet('capsule_mod_sens', cfgSens() === 'exp' ? 'strict' : 'exp'); closeSettings(); openSettings(); return; }
    if (a === 'set_key') {
        try { Lampa.Input.edit({ title: 'TMDB API ключ', value: cfgKey() === TMDB_DEFAULT_KEY ? '' : cfgKey(), free: true, nosave: true }, function (v) { if (v) sSet('capsule_mod_tmdb_key', v); Lampa.Controller.toggle(CTRL_NAME); closeSettings(); openSettings(); }); } catch (e) { notify('Ввод недоступен на этой платформе'); }
        return;
    }
    if (a === 'set_reset') {
        closeSettings(); robotSay(robotPhrase('loading'));
        Engine.resetProfile(function (p) { state.profile = p; state.custom = null; notify('Профиль Капсулы пересчитан'); robotSay(robotPhrase('done')); if (state.view === 'main') loadMainData(true); });
    }
}
function doAction(node) {
    var a = node.getAttribute('data-cm-action'); if (!a) return;
    if (state.settingsOpen && a.indexOf('set_') === 0) { settingsAction(a); return; }
    if (state.settingsOpen && a !== 'back') return;
    switch (a) {
        case 'back':
            if (state.settingsOpen) { closeSettings(); return; }
            if (state.view === 'details') { renderMain(); return; }
            try { Lampa.Activity.backward(); } catch (e) { try { Lampa.Activity.back(); } catch (e2) {} }
            return;
        case 'settings': openSettings(); return;
        case 'card': var key = node.getAttribute('data-key'); if (state.cards[key]) renderDetails(state.cards[key]); return;
        case 'robot': openAiDialog(); return;
        case 'play': if (state.current) openFullCard(state.current); return;
        case 'drawer':
            try {
                Lampa.Select.show({ title: 'Меню капсулы', items: [ { title: '🎬 К ленте рекомендаций', a: 'feed' }, { title: '🔄 Обновить рекомендации', a: 'ref' }, { title: '⚙️ Настройки', a: 'set' } ], onSelect: function (s) { Lampa.Controller.toggle(CTRL_NAME); if (s.a === 'feed') renderMain(); if (s.a === 'ref') { state.custom = null; loadMainData(true); } if (s.a === 'set') openSettings(); }, onBack: function () { Lampa.Controller.toggle(CTRL_NAME); } });
            } catch (e) { renderMain(); }
            return;
        case 'ai_input':
            try { Lampa.Input.edit({ title: 'Ваш запрос роботу', value: '', free: true, nosave: true }, function (v) { Lampa.Controller.toggle(CTRL_NAME); if (v) aiApplyFilters('Ответ робота: «' + v.slice(0, 24) + '»', parseUserQuery(v)); }); } catch (e) { notify('Экранная клавиатура недоступна'); }
            return;
        case 'ai_refresh': modalClose(); state.custom = null; loadMainData(true); return;
        case 'ai_random': aiRandom(); return;
        case 'ai_random_play': if (state.cards['rand']) { modalClose(); openFullCard(state.cards['rand']); } return;
        case 'ai_mood':
            try { Lampa.Select.show({ title: '🎯 Настроение', items: MOODS, onSelect: function (s) { Lampa.Controller.toggle(CTRL_NAME); aiApplyFilters('Настроение: ' + s.title, s.f); }, onBack: function () { Lampa.Controller.toggle(CTRL_NAME); } }); } catch (e) {}
            return;
        case 'ai_desc': case 'ai_fit': case 'ai_rev': case 'ai_facts': aiInfo(a); return;
    }
}
function bindMouse(scope) {
    scope.addEventListener('click', function (e) { var n = closestAttr(e.target, 'data-cm-action'); if (n) doAction(n); });
    scope.addEventListener('mouseover', function (e) {
        var n = closestAttr(e.target, 'data-cm-action');
        if (n && !hasClass(n, 'cm-focus')) { for (var r = 0; r < FM.rows.length; r++) { var idx = FM.rows[r].indexOf(n); if (idx > -1) { FM.r = r; FM.i = idx; FM.apply(); break; } } }
    });
}/* --- CAPSULE MOD PART 8/8 (FIXED) --- */
var Capsule = {
    onFocus: function (n) {
        if (n.getAttribute('data-cm-action') === 'card' && state.view === 'main') { var m = state.cards[n.getAttribute('data-key')]; if (m) robotSay('«' + m.title + '» — рейтинг ' + (m.vote_average ? m.vote_average.toFixed(1) : '—') + '. Enter — подробнее.'); }
    }
};
function CapsuleComponent() {
    var html = el('div', 'cm-root');
    this.create = function () {
        injectCSS();
        try { if (window.Lampa && Lampa.Background && Lampa.Background.immediately) Lampa.Background.immediately(''); } catch (e) {}
        state.root = html; html.innerHTML = '';
        html.appendChild(buildHeader()); html.appendChild(el('div', 'cm-content'));
        bindMouse(html); tickClock();
        if (state.clockTimer) clearInterval(state.clockTimer);
        state.clockTimer = setInterval(tickClock, 1000);
        state.custom = null; loadMainData(false);
        return this.render();
    };
    this.start = function () {
        try {
            Lampa.Controller.add(CTRL_NAME, { toggle: function () { FM.apply(); }, up: function () { FM.move('up'); }, down: function () { FM.move('down'); }, left: function () { FM.move('left'); }, right: function () { FM.move('right'); }, enter: function () { var n = FM.current(); if (n) doAction(n); }, back: function () { doAction(html.querySelector('[data-cm-action="back"]')); } });
            Lampa.Controller.toggle(CTRL_NAME);
        } catch (e) {
            document.addEventListener('keydown', function (ev) {
                var k = ev.keyCode;
                if (k === 37) FM.move('left'); else if (k === 39) FM.move('right'); else if (k === 38) FM.move('up'); else if (k === 40) FM.move('down');
                else if (k === 13) { var n = FM.current(); if (n) doAction(n); }
                else if (k === 8 || k === 27 || k === 461 || k === 10009) doAction(html.querySelector('[data-cm-action="back"]'));
            });
        }
    };
    this.render = function () { return html; };
    this.pause = function () {};
    this.stop = function () {};
    this.back = function () { doAction(html.querySelector('[data-cm-action="back"]')); };
    this.destroy = function () { if (state.clockTimer) clearInterval(state.clockTimer); state.clockTimer = null; html.innerHTML = ''; };
}
function addMenuItem() {
    var done = false;
    var mk = function () {
        if (done) return;
        try {
            if (document.querySelector('[data-action="capsule_mod"]')) { done = true; return; }
            if (window.jQuery || window.$) {
                var list = $('.menu .menu__list').eq(0);
                if (!list.length) return;
                var btn = $('<li class="menu__item selector" data-action="capsule_mod"><div class="menu__ico">' + SVG_MENU + '</div><div class="menu__text">Capsule Mod</div></li>');
                btn.on('hover:enter', function () { try { Lampa.Activity.push({ url: '', title: 'Capsule Mod', component: COMPONENT, page: 1 }); } catch (e) {} });
                list.append(btn);
            } else {
                var list2 = document.querySelector('.menu .menu__list');
                if (!list2) return;
                var b2 = el('li', 'menu__item', '<div class="menu__ico">' + SVG_MENU + '</div><div class="menu__text">Capsule Mod</div>');
                b2.setAttribute('data-action', 'capsule_mod');
                b2.onclick = function () { try { Lampa.Activity.push({ url: '', title: 'Capsule Mod', component: COMPONENT, page: 1 }); } catch (e) {} };
                list2.appendChild(b2);
            }
            done = true;
        } catch (e) {}
    };
    if (window.appready) setTimeout(mk, 500);
    else if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) {
        Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') setTimeout(mk, 500); });
        setTimeout(function () { if (window.appready) setTimeout(mk, 500); }, 2500);
    } else setTimeout(mk, 1000);
}
function addLampaSettings() {
    var safe = function (fn) { try { fn(); } catch (e) {} };
    safe(function () {
        if (!window.Lampa || !Lampa.SettingsApi || !Lampa.SettingsApi.addComponent) return;
        Lampa.SettingsApi.addComponent({ component: 'capsule_mod', name: 'Capsule Mod', icon: SVG_MENU });
        safe(function () { Lampa.SettingsApi.addParam({ component: 'capsule_mod', param: { name: 'capsule_mod_mascot', type: 'toggle', default: 'on' }, field: { name: 'Маскот-робот', description: 'Показывать робота-помощника' }, onChange: function () { if (state.root && state.view === 'main') renderMain(); } }); });
        safe(function () { Lampa.SettingsApi.addParam({ component: 'capsule_mod', param: { name: 'capsule_mod_depth', type: 'select', values: ['За месяц', 'За все время'], default: 'За месяц' }, field: { name: 'Глубина анализа', description: 'Период истории просмотров' } }); });
        safe(function () { Lampa.SettingsApi.addParam({ component: 'capsule_mod', param: { name: 'capsule_mod_sens', type: 'select', values: ['Точные совпадения', 'Больше экспериментов'], default: 'Точные совпадения' }, field: { name: 'Алгоритм', description: 'Строгость движка рекомендаций' } }); });
        safe(function () { Lampa.SettingsApi.addParam({ component: 'capsule_mod', param: { name: 'capsule_mod_tmdb_key', type: 'input', default: '' }, field: { name: 'TMDB API ключ', description: 'Пусто = ключ по умолчанию' } }); });
        safe(function () { Lampa.SettingsApi.addParam({ component: 'capsule_mod', param: { name: 'capsule_mod_reset', type: 'trigger', default: false }, field: { name: 'Сбросить профиль', description: 'Пересчитать матрицу предпочтений' }, onChange: function () { Engine.resetProfile(function (p) { state.profile = p; notify('Capsule Mod: профиль пересчитан'); }); } }); });
    });
}
function startPlugin() {
    if (window.plugin_capsule_mod) return;
    window.plugin_capsule_mod = true;
    injectCSS();
    var booted = false;
    var boot = function () {
        if (booted) return; booted = true;
        setTimeout(function () {
            try { if (window.Lampa && Lampa.Component && Lampa.Component.add) Lampa.Component.add(COMPONENT, CapsuleComponent); } catch (e) {}
            setTimeout(function () { addLampaSettings(); addMenuItem(); }, 300);
            console.log('[CapsuleMod] v1.0.1 safe-регистрация выполнена');
        }, 300);
    };
    if (window.appready) boot();
    else if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) {
        Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') boot(); });
        setTimeout(function () { if (window.appready) boot(); }, 2500);
    } else boot();
}
startPlugin();
})();