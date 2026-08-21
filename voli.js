/* --- CAPSULE MOD v6.1 --- */
(function () {
'use strict';
if (window.plugin_capsule_mod) return;
window.plugin_capsule_mod = true;

/* ============================== УТИЛИТЫ ============================== */
function el(t, c, h) { var d = document.createElement(t); if (c) d.className = c; if (h != null) d.innerHTML = h; return d; }
function addClass(n, c) { if (n && !hasClass(n, c)) n.className += (n.className ? ' ' : '') + c; }
function removeClass(n, c) { if (!n) return; n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/\s+/g, ' ').replace(/^ +| +$/g, ''); }
function hasClass(n, c) { return n && (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1; }
function closestAttr(n, a) { while (n && n !== document) { if (n.getAttribute && n.getAttribute(a)) return n; n = n.parentNode; } return null; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function nowMs() { return Date.now(); }
function dayMs() { return 86400000; }
function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function normTitle(s) { return String(s || '').toLowerCase().replace(/[^a-zа-яё0-9]/gi, ''); }
var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(nowMs()); }, 16); };
function tweenScroll(n, p, to, ms) { if (!n) return; var from = n[p], t0 = nowMs(); ms = ms || 200; function s() { var q = Math.min(1, (nowMs() - t0) / ms), e = 1 - Math.pow(1 - q, 3); n[p] = Math.round(from + (to - from) * e); if (q < 1) raf(s); } raf(s); }

function sGet(k, d) {
    try { if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') { var v = Lampa.Storage.get(k, d); return (v === undefined || v === null) ? d : v; } } catch (e) {}
    try { if (window.localStorage) { var r = localStorage.getItem('cm_' + k); if (r != null) return JSON.parse(r); } } catch (e) {}
    return d;
}
function sSet(k, v) {
    try { if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') { Lampa.Storage.set(k, v); return; } } catch (e) {}
    try { if (window.localStorage) localStorage.setItem('cm_' + k, JSON.stringify(v)); } catch (e) {}
}
function sDel(k) {
    try { if (window.Lampa && Lampa.Storage && Lampa.Storage.remove) Lampa.Storage.remove(k); } catch (e) {}
    try { if (window.localStorage) localStorage.removeItem('cm_' + k); } catch (e) {}
}
function httpGet(u, ok, err) {
    try {
        var x = new XMLHttpRequest(); x.open('GET', u, true); x.timeout = 12000;
        x.onreadystatechange = function () {
            if (x.readyState === 4) {
                if (x.status >= 200 && x.status < 400) { var d = null; try { d = JSON.parse(x.responseText); } catch (e) {} if (d) ok(d); else if (err) err('parse'); }
                else if (err) err('status:' + x.status);
            }
        };
        x.onerror = function () { if (err) err('network'); };
        x.ontimeout = function () { if (err) err('timeout'); };
        x.send();
    } catch (e) { if (err) err('exception'); }
}
function notify(t) { try { if (window.Lampa && Lampa.Noty && Lampa.Noty.show) { Lampa.Noty.show(t); return; } } catch (e) {} try { console.log('[CapsuleMod]', t); } catch (e2) {} }
function safeLog(tag, e) { try { console.warn('[CapsuleMod]', tag, e && (e.message || e)); } catch (er) {} }

/* ============================== КОНСТАНТЫ ============================== */
var COMPONENT = 'capsule_mod_view';
var TMDB_BASE = 'https://api.themoviedb.org/3';
var TMDB_DEFAULT_KEY = '04c35731a5ee918f014970082a0088b1';
var CACHE_TTL = dayMs();
var PROFILE_TTL = 12 * 60 * 60 * 1000;

var CAT_WEIGHT = { like: 5, book: 2, look: 1, scheduled: 1, viewed: 3, continued: 2, wath: 3, thrown: -6, history: 0.6 };
var CAT_EXCLUDE = { history: 1, viewed: 1, thrown: 1, continued: 1, wath: 1 };

var GENRE_RU = { 28: 'боевик', 12: 'приключения', 16: 'анимация', 35: 'комедия', 80: 'криминал', 99: 'документальный', 18: 'драма', 10751: 'семейный', 14: 'фэнтези', 27: 'ужасы', 9648: 'детектив', 10749: 'мелодрама', 878: 'фантастика', 53: 'триллер', 37: 'вестерн', 10752: 'военный', 36: 'история', 10402: 'музыка', 10770: 'ТВ-фильм' };
var NOISY_KEYWORD_IDS = { 818: 1, 9663: 1, 155792: 1 };

var PHRASES = {
    hello: ['Привет! Подобрал кое-что интересное.', 'Приветствую — есть пара хороших находок.'],
    morning: ['Доброе утро! Начнём день с хорошей истории?'],
    evening: ['Добрый вечер! Время для хорошего кино.'],
    loading: ['Изучаю ваши вкусы…', 'Подбираю варианты…'],
    error: ['Сеть подводит. Попробуйте обновить.'],
    empty: ['Пока маловато данных — посмотрите что-нибудь, и я подстроюсь под вас.'],
    done: ['Готово! Профиль пересчитан.'],
    noKey: ['Нужен рабочий TMDB-ключ — загляните в настройки Lampa.']
};

/* ============================== СТИЛИ ============================== */
var CSS_TEXT = [
':root{--cm-bg:#0f1011;--cm-panel:#17181a;--cm-panel2:#1d1f21;--cm-accent:#66707c;--cm-accent-soft:#4a525c;--cm-text:#c9cbce;--cm-sub:#6e7175;--cm-danger:#8a5656;--cm-good:#567a68;}',
'.cm-root{position:fixed;inset:0;background:var(--cm-bg);z-index:99999;color:var(--cm-text);font-family:-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden}',
'.cm-rail{position:absolute;left:0;top:0;bottom:0;width:4.8em;background:#131416;display:flex;flex-direction:column;align-items:center;padding:0.9em 0 1em;gap:1em;z-index:6}',
'.cm-hbtn{width:2.6em;height:2.6em;flex:none;display:flex;align-items:center;justify-content:center;border-radius:0.7em;cursor:pointer;background:transparent;border:0.2em solid transparent;transition:background .12s,transform .12s}',
'.cm-hbtn svg{width:1.25em;height:1.25em;fill:#9a9da2}',
'.cm-hbtn.cm-focus{background:var(--cm-accent-soft);transform:scale(1.06);border-color:var(--cm-accent)}',
'.cm-rail-ico{width:2.1em;height:2.1em;opacity:0.5;pointer-events:none}',
'.cm-rail-ico svg{width:100%;height:100%;fill:#84878c}',
'.cm-rail-spacer{flex:1}',
'.cm-rail-clock{font-size:0.78em;color:#5f6266;font-variant-numeric:tabular-nums}',
'.cm-content{position:absolute;top:0;bottom:0;left:4.8em;right:0;overflow-y:auto;overflow-x:hidden;padding:1.2em 1.6em 9em;scrollbar-width:none}',
'.cm-content::-webkit-scrollbar{display:none}',
'.cm-row{margin-bottom:1.4em}',
'.cm-row-head{display:flex;align-items:baseline;gap:0.6em;margin:0.4em 0 0.7em 0.1em}',
'.cm-row-title{font-size:1.08em;color:var(--cm-text);font-weight:600}',
'.cm-row-sub{font-size:0.82em;color:var(--cm-sub)}',
'.cm-strip{display:flex;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;padding:0.5em 0.2em 0.8em;scrollbar-width:none}',
'.cm-strip::-webkit-scrollbar{display:none}',
'.cm-card{position:relative;flex:none;width:11em;height:16.5em;border-radius:0.8em;overflow:hidden;margin-right:1em;background:var(--cm-panel);border:0.2em solid transparent;transition:transform .15s,border-color .15s;cursor:pointer}',
'.cm-card img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;filter:saturate(0.82) brightness(0.95) contrast(0.97)}',
'.cm-card.cm-focus{border-color:var(--cm-accent);transform:scale(1.05);z-index:2;box-shadow:0 0.4em 1em rgba(0,0,0,.5)}',
'.cm-b-type{position:absolute;top:0.5em;left:0.5em;background:rgba(23,24,26,.85);color:#a7aab0;font-size:0.68em;font-weight:700;padding:0.16em 0.5em;border-radius:0.4em;letter-spacing:.02em}',
'.cm-b-type.tv{background:rgba(70,76,84,.9);color:#c3c7cc}',
'.cm-b-rate{position:absolute;bottom:0.4em;right:0.4em;background:rgba(0,0,0,0.66);color:#b9bcc0;font-size:0.8em;font-weight:600;padding:0.1em 0.5em;border-radius:0.5em}',
'.cm-b-match{position:absolute;top:0.5em;right:0.5em;background:rgba(70,92,82,.85);color:#cfd8d2;font-size:0.65em;font-weight:700;padding:0.14em 0.45em;border-radius:0.4em}',
'.cm-t{position:absolute;left:0;right:0;bottom:0;padding:1.8em 0.6em 0.5em 0.6em;font-size:0.8em;color:#d3d5d8;background:linear-gradient(transparent,rgba(0,0,0,0.8));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.cm-robot-wrap{position:absolute;left:6em;bottom:1.2em;z-index:30;display:flex;align-items:flex-end;max-width:66%}',
'.cm-robot{width:4.6em;height:5.4em;flex:none;cursor:pointer;will-change:transform;animation:cm-float 3.8s ease-in-out infinite}',
'.cm-robot.cm-focus{filter:drop-shadow(0 0 0.3em var(--cm-accent));transform:scale(1.06)}',
'.cm-robot svg{width:100%;height:100%}',
'.cm-bubble{position:relative;background:var(--cm-panel);border-radius:0.9em;padding:0.75em 1.05em;margin-left:1.1em;max-width:20em;font-size:0.95em;color:var(--cm-text);line-height:1.4;box-shadow:0 0.2em 0.5em rgba(0,0,0,0.25)}',
'.cm-bubble:before{content:"";position:absolute;left:-0.8em;bottom:1em;border-top:0.7em solid transparent;border-bottom:0.7em solid transparent;border-right:0.9em solid var(--cm-panel)}',
'@keyframes cm-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-0.3em)}}',
'.cm-details{display:flex;gap:1.6em;padding:1.4em 0 8em}',
'.cm-d-left{flex:none;width:17em}',
'.cm-d-left .cm-card{width:16em;height:24em;margin:0;cursor:default}',
'.cm-d-meta{margin-top:0.9em;color:var(--cm-sub);font-size:0.92em;line-height:1.6}',
'.cm-d-meta b{color:var(--cm-text);font-size:1.1em;font-weight:600}',
'.cm-d-genres{margin-top:0.5em;display:flex;flex-wrap:wrap;gap:0.4em}',
'.cm-d-genre{background:var(--cm-panel2);color:var(--cm-sub);font-size:0.78em;padding:0.22em 0.65em;border-radius:0.8em}',
'.cm-d-center{flex:none;width:12em;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:0.9em;padding-top:1em}',
'.cm-play{width:100%;height:7em;background:var(--cm-panel2);border-radius:1.2em;border:0.2em solid transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.35em;cursor:pointer;transition:transform .15s,border-color .15s}',
'.cm-play svg{width:2.4em;height:2.4em;fill:var(--cm-text)}',
'.cm-play span{font-size:0.72em;color:var(--cm-sub)}',
'.cm-play.cm-focus{border-color:var(--cm-accent);transform:scale(1.04)}',
'.cm-feedback{display:flex;gap:0.6em;width:100%}',
'.cm-fbtn{flex:1;height:3em;border-radius:0.8em;background:var(--cm-panel2);border:0.2em solid transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.1em;opacity:.7;filter:grayscale(.4)}',
'.cm-fbtn.cm-focus{border-color:var(--cm-accent);transform:scale(1.05);opacity:1}',
'.cm-fbtn.cm-active-like{background:rgba(86,122,104,.25);opacity:1;filter:none}',
'.cm-fbtn.cm-active-dislike{background:rgba(138,86,86,.22);opacity:1;filter:none}',
'.cm-d-right{flex:1;padding-top:0.2em;min-width:0}',
'.cm-ai-item{background:var(--cm-panel);border:0.2em solid transparent;border-radius:0.8em;padding:0.75em 1.05em;margin-bottom:0.7em;font-size:0.96em;color:var(--cm-text);cursor:pointer;transition:border-color .12s,background .12s}',
'.cm-ai-item.cm-focus{border-color:var(--cm-accent);background:var(--cm-panel2)}',
'.cm-overlay{position:fixed;inset:0;background:rgba(8,9,10,0.9);z-index:100000;display:flex;align-items:center;justify-content:center;padding:2em}',
'.cm-panel{position:relative;background:var(--cm-panel);border-radius:1.1em;padding:1.6em 1.9em;min-width:26em;max-width:92%;max-height:86%;overflow-y:auto}',
'.cm-panel h2{margin:0 0 1em 0;font-size:1.2em;font-weight:600}',
'.cm-modal-body{padding:0.2em;color:var(--cm-text);font-size:0.96em;line-height:1.5;max-height:26em;overflow:auto}',
'.cm-modal-body h4{color:var(--cm-text);margin:0.6em 0 0.35em;font-weight:600}',
'.cm-chip{display:inline-block;background:var(--cm-panel2);border:0.2em solid transparent;border-radius:1.6em;padding:0.5em 1.1em;margin:0 0.5em 0.6em 0;color:var(--cm-text);cursor:pointer}',
'.cm-chip.cm-focus{border-color:var(--cm-accent);background:#242629}',
'.cm-kb-row{display:flex;gap:0.35em;margin-bottom:0.35em;justify-content:center}',
'.cm-kb-key{min-width:2.2em;height:2.4em;padding:0 0.5em;display:flex;align-items:center;justify-content:center;background:var(--cm-panel2);border:0.2em solid transparent;border-radius:0.55em;cursor:pointer;font-size:0.95em;color:var(--cm-text)}',
'.cm-kb-key.cm-focus{border-color:var(--cm-accent);background:#242629}',
'.cm-kb-key.wide{min-width:6em}',
'.cm-kb-display{background:#101214;border:0.2em dashed #33363a;border-radius:0.7em;padding:0.7em 0.9em;margin-bottom:0.9em;min-height:1.2em;color:var(--cm-text);font-size:1em;word-break:break-all}',
'.cm-skel{background:linear-gradient(90deg,#17181a,#1e2022,#17181a);background-size:200% 100%;animation:cm-shimmer 1.4s infinite}',
'@keyframes cm-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}',
'.cm-empty-block{padding:2em 1em;text-align:center;color:var(--cm-sub);background:var(--cm-panel);border-radius:0.9em}',
'.cm-empty-block b{display:block;color:var(--cm-text);font-size:1.05em;margin-bottom:0.4em;font-weight:600}',
'.cm-modal-close{position:absolute;top:0.9em;right:0.9em;width:2.2em;height:2.2em;border-radius:0.6em;background:var(--cm-panel2);display:flex;align-items:center;justify-content:center;cursor:pointer;border:0.2em solid transparent;z-index:2}',
'.cm-modal-close.cm-focus{border-color:var(--cm-accent)}',
'.cm-modal-close svg{width:1.1em;height:1.1em;fill:var(--cm-sub)}',
'@media (max-width:768px){.cm-root{font-size:12px}.cm-rail{width:3.4em}.cm-content{left:3.4em;padding:0.8em 1em 8em}.cm-robot-wrap{left:4.2em;bottom:0.7em;max-width:88%}.cm-robot{width:3.4em;height:4em}.cm-bubble{max-width:14em;font-size:0.86em}.cm-details{flex-direction:column;padding:1em 0 4em;gap:1em}.cm-d-left{width:100%;display:flex;gap:1em;align-items:flex-start}.cm-d-left .cm-card{width:6.4em;height:9.6em}.cm-d-meta{margin-top:0}.cm-d-center{width:100%;flex-direction:row}.cm-play{height:4.6em}.cm-d-right{width:100%}}',
'@media (min-width:2200px){.cm-root{font-size:22px}}'
].join('\n');
function injectCSS() { if (document.getElementById('capsule_mod_css')) return; var st = el('style'); st.id = 'capsule_mod_css'; st.type = 'text/css'; st.innerHTML = CSS_TEXT; (document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(st); }

/* ============================== ИКОНКИ ============================== */
var SVG_ROBOT = '<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">' +
'<g fill="#c9cbce"><circle cx="34" cy="26" r="17"/><circle cx="20" cy="101" r="5.5"/><circle cx="100" cy="90" r="5.5"/><circle cx="90" cy="121" r="5.5"/><circle cx="31" cy="132" r="5.5"/><ellipse cx="52" cy="86" rx="23" ry="29" transform="rotate(14 52 86)"/></g>' +
'<g fill="#0f1011"><circle cx="28" cy="22" r="3.4"/><circle cx="39" cy="22" r="3.4"/></g>' +
'<g fill="none" stroke="#c9cbce" stroke-width="9" stroke-linecap="round"><path d="M36 70 C26 78 23 88 21 97"/><path d="M66 74 C80 78 90 83 97 87"/><path d="M60 110 C68 116 78 119 86 120"/><path d="M46 112 C44 120 39 126 33 130"/></g></svg>';
var SVG_BACK = '<svg viewBox="0 0 24 24"><path d="M15.5 4.5 8 12l7.5 7.5 1.6-1.6L11.2 12l5.9-5.9z"/></svg>';
var SVG_GEAR = '<svg viewBox="0 0 24 24"><path d="M19.4 13c.04-.32.06-.66.06-1s-.02-.68-.07-1l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.9 8.78a.5.5 0 0 0 .12.64L5.05 11c-.05.32-.08.66-.08 1s.03.68.08 1l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.34.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.12-.56 1.62-.94l2.39.96c.24.1.5 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>';
var SVG_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
var SVG_CLOSE = '<svg viewBox="0 0 24 24"><path d="M6.4 4.98 4.98 6.4 10.59 12l-5.61 5.6 1.42 1.42L12 13.4l5.6 5.61 1.42-1.42L13.4 12l5.6-5.6-1.41-1.4L12 10.6z"/></svg>';
var RAIL_ICONS = [
'<svg viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3z"/></svg>',
'<svg viewBox="0 0 24 24"><path d="M12 2l2.7 6.8 7.3.5-5.6 4.7 1.8 7-6.2-3.9L5.8 21l1.8-7L2 9.3l7.3-.5z"/></svg>',
'<svg viewBox="0 0 24 24"><path d="M3 4h18v4H3zm0 6h18v4H3zm0 6h18v4H3z"/></svg>',
'<svg viewBox="0 0 24 24"><path d="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm6 3v6l5-3z"/></svg>',
'<svg viewBox="0 0 24 24"><path d="M12 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 8c3.3 0 6 1.6 6 3.5V19H6v-1.5C6 15.6 8.7 14 12 14z"/></svg>',
'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
'<svg viewBox="0 0 24 24"><path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2zm2 2v3h3V6zm7 0v3h3V6z"/></svg>'
];

function posterPlaceholder(title) {
    var t = esc(String(title || 'capsule').slice(0, 16));
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#17181a"/><rect x="8" y="8" width="184" height="284" rx="10" fill="none" stroke="#26282b" stroke-width="2"/><text x="100" y="155" fill="#66707c" font-size="14" text-anchor="middle" font-family="sans-serif">' + t + '</text></svg>');
}

/* ============================== НАСТРОЙКИ (вкладка в Lampa) ============================== */
function isOn(v) { return v === true || v === 'on' || v === 'true' || v === 1 || v === '1'; }
function cfgMascot() { return isOn(sGet('capsule_mod_mascot', true)); }
function cfgDepth() { var v = sGet('capsule_mod_depth', 'month'); return (v === 'all') ? 'all' : 'month'; }
function cfgSens() { var v = sGet('capsule_mod_sens', 'balanced'); return (v === 'exp' || v === 'strict') ? v : 'balanced'; }
function cfgKey() { return sGet('capsule_mod_tmdb_key', '') || sGet('tmdb_api_key', '') || TMDB_DEFAULT_KEY; }

function registerSettings() {
    try {
        if (!window.Lampa || !Lampa.SettingsApi || typeof Lampa.SettingsApi.addComponent !== 'function') return false;
        Lampa.SettingsApi.addComponent({ component: 'capsule_mod', name: 'Capsule Mod', icon: SVG_GEAR });
        Lampa.SettingsApi.addParam({ component: 'capsule_mod', param: { name: 'capsule_mod_mascot', type: 'trigger', 'default': true }, field: { name: 'Робот-помощник', description: 'Показывать анимированного помощника с подсказками' }, onChange: function (v) { sSet('capsule_mod_mascot', isOn(v)); } });
        Lampa.SettingsApi.addParam({ component: 'capsule_mod', param: { name: 'capsule_mod_depth', type: 'select', values: { month: 'Последний месяц', all: 'Вся история' }, 'default': 'month' }, field: { name: 'Глубина анализа', description: 'Сколько истории просмотров учитывать при подборе' }, onChange: function (v) { sSet('capsule_mod_depth', v); } });
        Lampa.SettingsApi.addParam({ component: 'capsule_mod', param: { name: 'capsule_mod_sens', type: 'select', values: { strict: 'Точный', balanced: 'Сбалансированный', exp: 'Разнообразие' }, 'default': 'balanced' }, field: { name: 'Алгоритм подбора', description: 'Точный — меньше жанров, но точнее; разнообразие — шире подборка' }, onChange: function (v) { sSet('capsule_mod_sens', v); } });
        Lampa.SettingsApi.addParam({ component: 'capsule_mod', param: { name: 'capsule_mod_tmdb_key', type: 'input', 'default': '' }, field: { name: 'Свой TMDB ключ', description: 'Оставьте пустым, чтобы использовать стандартный' }, onChange: function (v) { if (v) sSet('capsule_mod_tmdb_key', v); } });
        Lampa.SettingsApi.addParam({ component: 'capsule_mod', param: { name: 'capsule_mod_reset_btn', type: 'button' }, field: { name: 'Пересчитать профиль', description: 'Полный пересбор рекомендаций из истории просмотров' }, onChange: function () { notify('Пересчитываю профиль…'); Engine.resetProfile(function () { notify('Профиль пересчитан'); }); } });
        return true;
    } catch (e) { safeLog('registerSettings', e); return false; }
}

/* ============================== КЭШ TMDB ============================== */
var cacheMem = sGet('capsule_mod_cache', {}) || {};
function cacheGet(u) { var e = cacheMem[u]; if (e && e.d && (nowMs() - e.t) < CACHE_TTL) return e.d; return null; }
function cacheSet(u, d) {
    var ks = [], k;
    for (k in cacheMem) if (Object.prototype.hasOwnProperty.call(cacheMem, k)) ks.push({ k: k, t: cacheMem[k].t || 0 });
    if (ks.length > 80) { ks.sort(function (a, b) { return a.t - b.t; }); for (var i = 0; i < 30; i++) delete cacheMem[ks[i].k]; }
    cacheMem[u] = { t: nowMs(), d: d };
    sSet('capsule_mod_cache', cacheMem);
}
var TMDB = {
    url: function (p, q) {
        var s = 'api_key=' + encodeURIComponent(cfgKey()) + '&language=ru-RU';
        if (q) for (var k in q) if (q[k] != null && q[k] !== '') s += '&' + k + '=' + encodeURIComponent(q[k]);
        return TMDB_BASE + p + '?' + s;
    },
    get: function (p, q, cb, err) {
        var u = this.url(p, q), c = cacheGet(u);
        if (c) { cb(c); return; }
        httpGet(u, function (d) { cacheSet(u, d); cb(d); }, function (reason) { if (err) err(reason); });
    },
    img: function (p, size) {
        if (!p) return null;
        try { if (window.Lampa && Lampa.TMDB && Lampa.TMDB.image) return Lampa.TMDB.image(p, size || 'w342'); } catch (e) {}
        return 'https://image.tmdb.org/t/p/' + (size || 'w342') + p;
    }
};
function setPoster(img, path, title, size) {
    var urls = [], tried = 0, a = TMDB.img(path, size);
    if (a) urls.push(a);
    if (path) urls.push('https://www.themoviedb.org/t/p/' + (size || 'w342') + path);
    if (!urls.length) { img.src = posterPlaceholder(title); return; }
    img.onerror = function () { tried++; if (tried < urls.length) img.src = urls[tried]; else { img.onerror = null; img.src = posterPlaceholder(title); } };
    img.src = urls[0];
}

/* ============================== ИСТОРИЯ ============================== */
function favGet(type) {
    try { if (window.Lampa && Lampa.Favorite && typeof Lampa.Favorite.get === 'function') { var r = Lampa.Favorite.get({ type: type }); return r instanceof Array ? r : []; } } catch (e) { safeLog('fav:' + type, e); }
    return [];
}
function seenGet() { return sGet('capsule_mod_seen', {}) || {}; }
function seenSet(m) {
    try {
        var s = seenGet(); s[m.type + ':' + m.id] = nowMs();
        var ks = Object.keys(s);
        if (ks.length > 600) { ks.sort(function (a, b) { return s[a] - s[b]; }); for (var i = 0; i < 100; i++) delete s[ks[i]]; }
        sSet('capsule_mod_seen', s);
    } catch (e) {}
}
function cardType(c) { return (c && (c.name || c.original_name || c.first_air_date || c.number_of_seasons)) ? 'tv' : 'movie'; }

function readHistoryRaw() {
    var byId = {}, order = [], cat, i, k;
    function pushItem(card, c2) {
        if (!card || !card.id) return;
        var t = cardType(card), key = t + ':' + card.id, w = CAT_WEIGHT[c2] || 0;
        if (!byId[key]) { byId[key] = { id: card.id, type: t, weight: w, cats: {}, card: card }; order.push(key); }
        byId[key].cats[c2] = 1;
        if (Math.abs(w) > Math.abs(byId[key].weight)) byId[key].weight = w;
    }
    for (cat in CAT_WEIGHT) { var list = favGet(cat); for (i = 0; i < list.length; i++) pushItem(list[i], cat); }
    var seen = seenGet();
    for (k in seen) {
        if (!Object.prototype.hasOwnProperty.call(seen, k)) continue;
        var parts = k.split(':');
        if (!byId[k]) { byId[k] = { id: +parts[1] || parts[1], type: parts[0], weight: 0.4, cats: { seen: 1 }, card: { id: +parts[1] || parts[1] } }; order.push(k); }
        else byId[k].cats.seen = 1;
    }
    var out = []; for (i = 0; i < order.length; i++) out.push(byId[order[i]]);
    return out;
}

var MANUAL_KEY = 'capsule_mod_manual';
function manualGet() { return sGet(MANUAL_KEY, {}) || {}; }
function manualSet(map) { sSet(MANUAL_KEY, map); }
function setManualFeedback(type, id, val) { var m = manualGet(), key = type + ':' + id; if (val === 0) delete m[key]; else m[key] = val; manualSet(m); }
function getManualFeedback(type, id) { var m = manualGet(); return m[type + ':' + id] || 0; }

/* ============================== ТАЙМЛАЙН ============================== */
var _hashFn = null;
function getHashFn() {
    if (_hashFn) return _hashFn;
    try { if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.hash === 'function') { _hashFn = function (s) { return Lampa.Utils.hash(s); }; return _hashFn; } } catch (e) {}
    _hashFn = function (s) { var str = (s || '') + '', h = 0; for (var i = 0; i < str.length; i++) { var c = str.charCodeAt(i); h = ((h << 5) - h) + c; h = h & h; } return Math.abs(h) + ''; };
    return _hashFn;
}
function tlPercent(m) {
    try {
        if (!window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return 0;
        var hf = getHashFn();
        var ot = m.original_title || m.original_name || m.title || '';
        if (!ot) return 0;
        var isTv = (m.media_type === 'tv') || m.original_name || m.first_air_date, max = 0, i, v;
        if (isTv) { for (i = 1; i <= 3; i++) { v = Lampa.Timeline.view(hf([1, i, ot].join(''))); if (v && v.percent > max) max = v.percent; } }
        else { v = Lampa.Timeline.view(hf(ot)); if (v && v.percent > max) max = v.percent; }
        return max;
    } catch (e) { return 0; }
}

/* ============================== ДВИЖОК РЕКОМЕНДАЦИЙ ============================== */
var Engine = {
    readHistory: function () { return readHistoryRaw(); },
    classify: function (hist) {
        var ev = [], manual = manualGet(), i;
        for (i = 0; i < hist.length; i++) {
            var it = hist[i], key = it.type + ':' + it.id, w = it.weight;
            if (manual[key]) w = manual[key] > 0 ? 5 : -6;
            if (!w) continue;
            ev.push({ id: it.id, type: it.type, weight: w, date: 0 });
        }
        ev.sort(function (a, b) { return Math.abs(b.weight) - Math.abs(a.weight); });
        return ev.slice(0, 40);
    },
    computeProfile: function (cb) {
        var events = this.classify(this.readHistory()), interests = {}, watched = { ids: {}, titles: {} }, idx = 0, failed = 0;
        function next() {
            if (idx >= events.length) return finish();
            var ev = events[idx++];
            TMDB.get('/' + ev.type + '/' + ev.id, { append_to_response: 'keywords,credits' }, function (d) {
                var i;
                watched.ids[ev.type + ':' + ev.id] = 1;
                if (d.title) watched.titles[normTitle(d.title)] = 1;
                if (d.name) watched.titles[normTitle(d.name)] = 1;
                var genreIds = d.genre_ids || (d.genres ? d.genres.map(function (g) { return g.id; }) : []);
                for (i = 0; i < genreIds.length; i++) interests['g' + genreIds[i]] = (interests['g' + genreIds[i]] || 0) + ev.weight;
                var kw = d.keywords && d.keywords.keywords ? d.keywords.keywords : (d.keywords && d.keywords.results ? d.keywords.results : (d.keywords instanceof Array ? d.keywords : []));
                var kwUsed = 0;
                for (i = 0; i < kw.length && kwUsed < 6; i++) { if (NOISY_KEYWORD_IDS[kw[i].id]) continue; interests['k' + kw[i].id] = (interests['k' + kw[i].id] || 0) + ev.weight * 0.5; kwUsed++; }
                var cast = d.credits && d.credits.cast ? d.credits.cast : [];
                for (i = 0; i < Math.min(cast.length, 3); i++) interests['p' + cast[i].id] = (interests['p' + cast[i].id] || 0) + ev.weight * 0.35;
                next();
            }, function () { failed++; next(); });
        }
        function finish() {
            for (var k in interests) if (Object.prototype.hasOwnProperty.call(interests, k) && interests[k] === 0) delete interests[k];
            var p = { interests: interests, watched: watched, last_updated: nowMs(), sampleSize: events.length, historySize: window.__cm_hist_size || 0, failedLookups: failed };
            sSet('capsule_mod_profile', p);
            cb(p);
        }
        window.__cm_hist_size = this.readHistory().length;
        if (!events.length) return finish();
        next();
    },
    ensureProfile: function (force, cb) {
        var p = sGet('capsule_mod_profile', null);
        if (!force && p && p.interests && (nowMs() - (p.last_updated || 0)) < PROFILE_TTL) { cb(p); return; }
        this.computeProfile(cb);
    },
    extWatched: function (profile) {
        var w = {}, p = (profile && profile.watched) || {}, k, i;
        if (p.ids) for (k in p.ids) w[k] = 1;
        if (p.titles) for (k in p.titles) w['t' + k] = 1;
        var hist = this.readHistory();
        window.__cm_hist_size = hist.length;
        for (i = 0; i < hist.length; i++) {
            var h = hist[i];
            var excluded = !!h.cats.seen, c;
            for (c in CAT_EXCLUDE) if (h.cats[c]) excluded = true;
            if (excluded) { w[h.type + ':' + h.id] = 1; w['id' + h.id] = 1; }
            if (h.card && (h.card.title || h.card.name)) w['t' + normTitle(h.card.title || h.card.name)] = 1;
        }
        var manual = manualGet();
        for (k in manual) w[k] = 1;
        return w;
    },
    positiveGenreSum: function (profile) {
        var inter = (profile && profile.interests) || {}, sum = 0, k;
        for (k in inter) if (k.charAt(0) === 'g' && inter[k] > 0) sum += inter[k];
        return sum || 1;
    },
    topGenres: function (profile, sens) {
        var inter = (profile && profile.interests) || {}, pos = [], neg = [], k;
        for (k in inter) {
            if (k.charAt(0) !== 'g') continue;
            var id = k.slice(1), w = inter[k];
            if (w > 0) pos.push({ id: id, w: w }); else if (w < 0) neg.push({ id: id, w: w });
        }
        pos.sort(function (a, b) { return b.w - a.w; });
        neg.sort(function (a, b) { return a.w - b.w; });
        var limit = sens === 'strict' ? 2 : (sens === 'exp' ? 5 : 3);
        pos = pos.slice(0, limit);
        var posIds = {}; for (var i = 0; i < pos.length; i++) posIds[pos[i].id] = 1;
        neg = neg.filter(function (n) { return !posIds[n.id]; }).slice(0, 3);
        return { pos: pos.map(function (x) { return x.id; }), neg: neg.map(function (x) { return x.id; }) };
    },
    topKeywords: function (profile, sens) {
        var inter = (profile && profile.interests) || {}, kw = [], k;
        for (k in inter) if (k.charAt(0) === 'k' && inter[k] > 0) kw.push({ id: k.slice(1), w: inter[k] });
        kw.sort(function (a, b) { return b.w - a.w; });
        return kw.slice(0, sens === 'exp' ? 4 : 2).map(function (x) { return x.id; });
    },
    discover: function (profile, extra, cb) {
        var sens = cfgSens(), genres = this.topGenres(profile, sens), kws = this.topKeywords(profile, sens);
        var hasProfile = profile && profile.sampleSize > 0;
        var params = { 'vote_average.gte': 5.8, include_adult: false, page: 1, 'vote_count.gte': hasProfile ? 60 : 100 };
        if (!hasProfile) params['vote_count.lte'] = 3000;
        if (genres.pos.length) params.with_genres = genres.pos.join(',');
        if (genres.neg.length) params.without_genres = genres.neg.join(',');
        if (kws.length) params.with_keywords = kws.join('|');
        if (extra) for (var k in extra) params[k] = extra[k];
        var done = 0, merged = [], anyOk = false;
        function fin(ok) { if (ok) anyOk = true; done++; if (done === 2) cb(merged, anyOk); }
        function one(t) {
            var p2 = {}, k2; for (k2 in params) p2[k2] = params[k2];
            p2['vote_count.gte'] = t === 'movie' ? 120 : 40;
            if (!hasProfile && t === 'movie') p2['vote_count.lte'] = 3000;
            var pages = [1, 2], loaded = 0, all = [];
            pages.forEach(function (pg) {
                var p3 = {}, k3; for (k3 in p2) p3[k3] = p2[k3]; p3.page = pg;
                TMDB.get('/discover/' + t, p3, function (d) {
                    var r = d.results || [];
                    for (var j = 0; j < r.length; j++) { r[j].media_type = t; all.push(r[j]); }
                    loaded++; if (loaded === pages.length) { for (var m = 0; m < all.length; m++) merged.push(all[m]); fin(true); }
                }, function () { loaded++; if (loaded === pages.length) { for (var m2 = 0; m2 < all.length; m2++) merged.push(all[m2]); fin(all.length > 0); } });
            });
        }
        one('movie'); one('tv');
    },
    pick: function (list, profile, watched, seen, mode, n) {
        var inter = (profile && profile.interests) || {}, base = this.positiveGenreSum(profile), i, j, out = [];
        for (i = 0; i < list.length; i++) {
            var m0 = list[i], g0 = m0.genre_ids || [], w0 = 0;
            for (j = 0; j < g0.length; j++) w0 += inter['g' + g0[j]] || 0;
            m0._gw = w0;
        }
        for (i = 0; i < list.length && out.length < n * 4; i++) {
            var mm = list[i], t = mm.media_type || (mm.name ? 'tv' : 'movie'), key = t + ':' + mm.id;
            if (watched[key] || watched['id' + mm.id] || watched['t' + normTitle(mm.title || mm.name)] || seen[key]) continue;
            var manualScore = getManualFeedback(t, mm.id);
            if (manualScore < 0) continue;
            if (tlPercent(mm) >= 10) continue;
            seen[key] = 1;
            var rt = mm.vote_average || 0;
            var rel = mm.release_date || mm.first_air_date || '';
            var days = rel ? Math.max(0, (nowMs() - new Date(rel).getTime()) / dayMs()) : 3650;
            var recency = Math.max(0, 10 * (1 - days / (365 * 3)));
            var gn = clamp(mm._gw / (base / 10), 0, 10);
            var pop = mm.vote_count || 0;
            var popScore = Math.min(10, pop / 200);
            var mainstream = pop > 8000 ? 1.2 : (pop > 4000 ? 0.5 : 0);
            var gem = (pop >= 60 && pop <= 2500 && rt >= 6.6) ? 1.5 : 0;
            var score;
            if (mode === 'stable') score = gn * 0.6 + rt * 0.35 + gem - mainstream * 0.5 + popScore * 0.05 + Math.random() * 0.3;
            else score = gn * 0.35 + rt * 0.2 + recency * 0.35 + gem - mainstream * 0.4 + popScore * 0.05 + Math.random() * 1.2;
            if (manualScore > 0) score += 3;
            out.push({ m: mm, s: score });
        }
        out.sort(function (a, b) { return b.s - a.s; });
        var res = []; for (i = 0; i < out.length && i < n; i++) res.push(out[i].m);
        return res;
    },
    buildBundle: function (profile, cb) {
        var self = this, watched = this.extWatched(profile), seen = {}, out = { stable: [], exp: [], ok: true };
        var done = 0;
        function fin() { done++; if (done === 2) cb(out); }
        this.discover(profile, { sort_by: 'vote_average.desc' }, function (l) { out.stable = self.pick(l, profile, watched, seen, 'stable', 8); fin(); });
        this.discover(profile, { sort_by: 'popularity.desc', 'primary_release_date.gte': (new Date().getFullYear() - 3) + '-01-01' }, function (l) { out.exp = self.pick(l, profile, watched, seen, 'exp', 8); fin(); });
    },
    queryBundle: function (profile, f, cb) {
        var self = this, watched = this.extWatched(profile), seen = {}, p = { sort_by: 'popularity.desc', 'vote_average.gte': 5.8 };
        if (f.with_genres && f.with_genres.length) p.with_genres = f.with_genres.join(',');
        if (f.without_genres && f.without_genres.length) p.without_genres = f.without_genres.join(',');
        if (f.year_gte) p['primary_release_date.gte'] = f.year_gte + '-01-01';
        if (f.year_lte) p['primary_release_date.lte'] = f.year_lte + '-12-31';
        this.discover(profile, p, function (l) { cb(self.pick(l, profile, watched, seen, 'exp', 10)); });
    },
    resetProfile: function (cb) { sDel('capsule_mod_profile'); this.computeProfile(cb || function () {}); },
    setFeedback: function (type, id, val) { setManualFeedback(type, id, val); }
};

/* ============================== ПАРСЕР ЗАПРОСОВ ============================== */
function parseUserQuery(text) {
    var s = String(text || '').toLowerCase(), f = { with_genres: [], without_genres: [], phrase: '' };
    var rules = [
        { re: /комед|смешн|весел|юмор/, g: 35 }, { re: /боевик|экшн|экшен/, g: 28 }, { re: /фантаст|космос/, g: 878 },
        { re: /ужас|хоррор|страш/, g: 27 }, { re: /триллер|напряж/, g: 53 }, { re: /драм/, g: 18 },
        { re: /романти|мелодрам|любов/, g: 10749 }, { re: /детектив|криминал/, g: 80 }, { re: /приключени/, g: 12 },
        { re: /аниме|манга|мульт/, g: 16 }, { re: /семейн|детск/, g: 10751 }, { re: /фэнтези/, g: 14 }, { re: /документал/, g: 99 }
    ];
    for (var i = 0; i < rules.length; i++) {
        var m = s.match(rules[i].re);
        if (m) { var before = s.substring(Math.max(0, m.index - 14), m.index); if (/без|кроме|не\s/.test(before)) f.without_genres.push(rules[i].g); else f.with_genres.push(rules[i].g); }
    }
    if (/90[-хx]/.test(s)) { f.year_gte = 1990; f.year_lte = 1999; }
    else if (/80[-хx]/.test(s)) { f.year_gte = 1980; f.year_lte = 1989; }
    else if (/новинк|свеж/.test(s)) f.year_gte = new Date().getFullYear() - 1;
    else if (/стар|классик|ретро/.test(s)) f.year_lte = 2000;
    var names = []; for (var j = 0; j < f.with_genres.length; j++) names.push(GENRE_RU[f.with_genres[j]] || '');
    f.phrase = f.with_genres.length ? 'Принял! Собираю: ' + names.join(', ') + '.' : 'Попробую угадать настроение по запросу.';
    return f;
}
var MOODS = [
    { title: 'Весёлое', f: { with_genres: [35] } },
    { title: 'Мрачное', f: { with_genres: [53, 27] } },
    { title: 'Романтичное', f: { with_genres: [10749] } },
    { title: 'Приключенческое', f: { with_genres: [12, 878] } },
    { title: 'Семейное', f: { with_genres: [10751, 16] } }
];
function robotPhrase(st) { var h = new Date().getHours(); if (st === 'hello') return h < 6 ? rnd(PHRASES.evening) : (h < 12 ? rnd(PHRASES.morning) : rnd(PHRASES.hello)); return rnd(PHRASES[st] || PHRASES.hello); }

/* ============================== ФОКУС-МЕНЕДЖЕР ============================== */
var FocusManager = {
    rows: [], r: 0, i: 0, stack: [],
    setRows: function (rows, r, i) { this.rows = rows || []; this.r = clamp(r || 0, 0, Math.max(0, this.rows.length - 1)); this.i = i || 0; this.apply(); },
    push: function () { this.stack.push({ rows: this.rows, r: this.r, i: this.i }); },
    pop: function () { var s = this.stack.pop(); if (s) { this.rows = s.rows; this.r = clamp(s.r, 0, Math.max(0, this.rows.length - 1)); this.i = s.i; this.apply(); } return !!s; },
    clearStack: function () { this.stack = []; },
    current: function () { var row = this.rows[this.r]; if (!row || !row.length) return null; return row[clamp(this.i, 0, row.length - 1)]; },
    apply: function () {
        var nodes = document.querySelectorAll('.cm-focus');
        for (var i = 0; i < nodes.length; i++) removeClass(nodes[i], 'cm-focus');
        var n = this.current();
        if (!n || !document.body.contains(n)) return;
        addClass(n, 'cm-focus');
        var strip = n.parentNode && hasClass(n.parentNode, 'cm-strip') ? n.parentNode : null;
        if (strip) {
            var to = n.offsetLeft - strip.clientWidth / 2 + n.clientWidth / 2;
            tweenScroll(strip, 'scrollLeft', clamp(to, 0, Math.max(0, strip.scrollWidth - strip.clientWidth)), 180);
        }
        var content = document.querySelector('.cm-content');
        if (content && n.getBoundingClientRect) {
            var rect = n.getBoundingClientRect(), crect = content.getBoundingClientRect();
            var top = rect.top - crect.top + content.scrollTop;
            if (top < 70 || top > content.scrollTop + content.clientHeight - 220) tweenScroll(content, 'scrollTop', Math.max(0, top - content.clientHeight / 2), 180);
        }
        if (typeof Capsule.onFocus === 'function') Capsule.onFocus(n);
    },
    centerOf: function (n) { var r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    move: function (dir) {
        if (!this.rows.length) return;
        var cur = this.current();
        if (dir === 'left' || dir === 'right') {
            var row = this.rows[this.r]; if (!row) return;
            var ni = this.i + (dir === 'right' ? 1 : -1);
            if (ni < 0 || ni >= row.length) return;
            this.i = ni; this.apply(); return;
        }
        if (!cur) { for (var rr = 0; rr < this.rows.length; rr++) if (this.rows[rr] && this.rows[rr].length) { this.r = rr; this.i = 0; this.apply(); } return; }
        var curC = this.centerOf(cur), step = dir === 'down' ? 1 : -1;
        var nr = this.r + step, best = -1, bestRow = -1, bestScore = Infinity;
        while (nr >= 0 && nr < this.rows.length) {
            var target = this.rows[nr];
            if (target && target.length) {
                for (var ti = 0; ti < target.length; ti++) {
                    if (!document.body.contains(target[ti])) continue;
                    var tc = this.centerOf(target[ti]);
                    var dy = (tc.y - curC.y) * step;
                    if (dy <= 0) continue;
                    var dx = Math.abs(tc.x - curC.x);
                    var score = dy * 1.0 + dx * 0.35;
                    if (score < bestScore) { bestScore = score; best = ti; bestRow = nr; }
                }
                if (best > -1) break;
            }
            nr += step;
        }
        if (best > -1) { this.r = bestRow; this.i = best; this.apply(); }
    }
};

/* ============================== СОСТОЯНИЕ ============================== */
var state = { active: false, view: 'main', cards: {}, bundle: null, profile: null, custom: null, current: null, root: null, clockTimer: null, modals: [], kb: null };

function normMovie(m) {
    return {
        id: m.id,
        type: m.media_type ? (m.media_type === 'tv' ? 'tv' : 'movie') : (m.name || m.original_name ? 'tv' : 'movie'),
        title: m.title || m.name || 'Без названия',
        original_title: m.original_title || m.original_name || m.title || '',
        poster_path: m.poster_path,
        vote_average: m.vote_average || 0,
        release_date: m.release_date || m.first_air_date || '',
        overview: m.overview || '',
        genre_ids: m.genre_ids || [],
        matchPct: typeof m._matchPct === 'number' ? m._matchPct : null
    };
}
function buildCard(m) {
    var mm = normMovie(m);
    state.cards[mm.type + ':' + mm.id] = mm;
    var card = el('div', 'cm-card');
    card.setAttribute('data-cm-action', 'card');
    card.setAttribute('data-key', mm.type + ':' + mm.id);
    var img = el('img'); img.alt = ''; img.loading = 'lazy'; setPoster(img, mm.poster_path, mm.title, 'w342'); card.appendChild(img);
    card.appendChild(el('div', 'cm-b-type' + (mm.type === 'tv' ? ' tv' : ''), mm.type === 'tv' ? 'TV' : 'FILM'));
    card.appendChild(el('div', 'cm-b-rate', mm.vote_average ? mm.vote_average.toFixed(1) : '—'));
    if (mm.matchPct != null && mm.matchPct > 0) card.appendChild(el('div', 'cm-b-match', mm.matchPct + '%'));
    card.appendChild(el('div', 'cm-t', esc(mm.title)));
    return card;
}
function buildRow(title, sub, movies) {
    var row = el('div', 'cm-row');
    var head = el('div', 'cm-row-head');
    head.appendChild(el('div', 'cm-row-title', esc(title)));
    if (sub) head.appendChild(el('div', 'cm-row-sub', esc(sub)));
    row.appendChild(head);
    var strip = el('div', 'cm-strip');
    for (var i = 0; i < movies.length; i++) strip.appendChild(buildCard(movies[i]));
    if (!movies.length) strip.appendChild(el('div', 'cm-empty-block', '<b>Пока пусто</b>Попробуйте обновить подборку'));
    row.appendChild(strip);
    return row;
}
function skeletonRows() {
    var content = state.root.querySelector('.cm-content'); content.innerHTML = '';
    for (var r = 0; r < 2; r++) {
        var row = el('div', 'cm-row');
        var strip = el('div', 'cm-strip');
        for (var i = 0; i < 6; i++) strip.appendChild(el('div', 'cm-card cm-skel'));
        row.appendChild(strip);
        content.appendChild(row);
    }
}
function buildRobotWrap() {
    var wrap = el('div', 'cm-robot-wrap');
    var robot = el('div', 'cm-robot'); robot.setAttribute('data-cm-action', 'robot'); robot.innerHTML = SVG_ROBOT;
    var bubble = el('div', 'cm-bubble', esc(robotPhrase('hello'))); bubble.id = 'cm_bubble';
    wrap.appendChild(robot); wrap.appendChild(bubble);
    return wrap;
}
function robotSay(t) { var b = document.getElementById('cm_bubble'); if (b) b.innerHTML = esc(t); }
function buildRail() {
    var rail = el('div', 'cm-rail');
    var back = el('div', 'cm-hbtn'); back.setAttribute('data-cm-action', 'back'); back.innerHTML = SVG_BACK;
    rail.appendChild(back);
    for (var i = 0; i < RAIL_ICONS.length; i++) rail.appendChild(el('div', 'cm-rail-ico', RAIL_ICONS[i]));
    rail.appendChild(el('div', 'cm-rail-spacer'));
    var gear = el('div', 'cm-hbtn'); gear.setAttribute('data-cm-action', 'open_lampa_settings'); gear.innerHTML = SVG_GEAR;
    rail.appendChild(gear);
    var clock = el('div', 'cm-rail-clock', '--:--'); clock.id = 'cm_clock';
    rail.appendChild(clock);
    return rail;
}
function tickClock() { var c = document.getElementById('cm_clock'); if (c) { var d = new Date(); c.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes()); } }

function focusableRowsFromContent(content, extraTail) {
    var rows = [[state.root.querySelector('[data-cm-action="back"]'), state.root.querySelector('[data-cm-action="open_lampa_settings"]')]];
    var strips = content.querySelectorAll('.cm-strip');
    for (var i = 0; i < strips.length; i++) {
        var cards = strips[i].querySelectorAll('.cm-card[data-cm-action="card"]');
        if (cards.length) rows.push([].slice.call(cards, 0));
    }
    if (extraTail) for (var j = 0; j < extraTail.length; j++) if (extraTail[j] && extraTail[j].length) rows.push(extraTail[j]);
    return rows;
}

function renderMain(keepFocus) {
    state.view = 'main'; state.cards = {};
    var root = state.root;
    var existingRobotWrap = root.querySelector('.cm-robot-wrap');
    if (existingRobotWrap) existingRobotWrap.parentNode.removeChild(existingRobotWrap);
    var content = root.querySelector('.cm-content'); content.innerHTML = '';
    var b = state.bundle || { stable: [], exp: [] };
    if (state.custom && state.custom.list) {
        content.appendChild(buildRow(state.custom.title, 'по вашему запросу', state.custom.list));
    } else {
        var profile = state.profile;
        var sampleNote = profile ? ('на основе ' + (profile.historySize != null ? profile.historySize : 0) + ' просмотров') : '';
        content.appendChild(buildRow('Стабильно на вечер', sampleNote, b.stable));
        content.appendChild(buildRow('Новое и неожиданное', '', b.exp));
    }
    if (cfgMascot()) root.appendChild(buildRobotWrap());
    var robot = root.querySelector('[data-cm-action="robot"]');
    var rows = focusableRowsFromContent(content, robot ? [[robot]] : null);
    FocusManager.clearStack();
    if (keepFocus && keepFocus.r != null) FocusManager.setRows(rows, keepFocus.r, keepFocus.i);
    else FocusManager.setRows(rows, rows.length > 1 ? 1 : 0, 0);
}

function loadMainData(force) {
    skeletonRows(); robotSay(robotPhrase('loading'));
    if (!cfgKey()) { robotSay(robotPhrase('noKey')); renderMain(); return; }
    Engine.ensureProfile(force, function (profile) {
        state.profile = profile;
        Engine.buildBundle(profile, function (bundle) {
            state.bundle = bundle;
            renderMain();
            var total = bundle.stable.length + bundle.exp.length;
            robotSay(total ? robotPhrase('hello') : robotPhrase('empty'));
        });
    });
}

function renderDetails(movie) {
    state.view = 'details'; state.current = movie;
    seenSet(movie);
    var root = state.root;
    var existingRobotWrap = root.querySelector('.cm-robot-wrap');
    if (existingRobotWrap) existingRobotWrap.parentNode.removeChild(existingRobotWrap);
    var content = root.querySelector('.cm-content'); content.innerHTML = '';
    var wrap = el('div', 'cm-details');

    var left = el('div', 'cm-d-left');
    var poster = el('div', 'cm-card');
    var img = el('img'); img.alt = ''; setPoster(img, movie.poster_path, movie.title, 'w500'); poster.appendChild(img);
    poster.appendChild(el('div', 'cm-b-rate', movie.vote_average ? movie.vote_average.toFixed(1) : '—'));
    if (movie.matchPct != null && movie.matchPct > 0) poster.appendChild(el('div', 'cm-b-match', movie.matchPct + '%'));
    left.appendChild(poster);
    var genresList = (movie.genre_ids || []).map(function (id) { return GENRE_RU[id]; }).filter(Boolean).slice(0, 4);
    var metaHtml = '<b>' + esc(movie.title) + '</b><br>' + ((movie.release_date || '').slice(0, 4) || '—') + ' · ' + (movie.type === 'tv' ? 'сериал' : 'фильм');
    left.appendChild(el('div', 'cm-d-meta', metaHtml));
    if (genresList.length) {
        var gWrap = el('div', 'cm-d-genres');
        for (var gi = 0; gi < genresList.length; gi++) gWrap.appendChild(el('div', 'cm-d-genre', esc(genresList[gi])));
        left.appendChild(gWrap);
    }
    wrap.appendChild(left);

    var center = el('div', 'cm-d-center');
    var play = el('div', 'cm-play'); play.setAttribute('data-cm-action', 'play'); play.innerHTML = SVG_PLAY + '<span>Смотреть</span>'; center.appendChild(play);
    var fbWrap = el('div', 'cm-feedback');
    var curFb = getManualFeedback(movie.type, movie.id);
    var likeBtn = el('div', 'cm-fbtn' + (curFb > 0 ? ' cm-active-like' : ''), '👍'); likeBtn.setAttribute('data-cm-action', 'like');
    var dislikeBtn = el('div', 'cm-fbtn' + (curFb < 0 ? ' cm-active-dislike' : ''), '👎'); dislikeBtn.setAttribute('data-cm-action', 'dislike');
    fbWrap.appendChild(likeBtn); fbWrap.appendChild(dislikeBtn);
    center.appendChild(fbWrap);
    wrap.appendChild(center);

    var right = el('div', 'cm-d-right');
    var items = [
        { a: 'ai_desc', t: 'Описание и сюжет' },
        { a: 'ai_fit', t: 'Кому подойдёт' },
        { a: 'ai_rev', t: 'Отзывы зрителей' },
        { a: 'ai_facts', t: 'Актёры и факты' }
    ];
    for (var i = 0; i < items.length; i++) { var it = el('div', 'cm-ai-item', esc(items[i].t)); it.setAttribute('data-cm-action', items[i].a); right.appendChild(it); }
    wrap.appendChild(right);
    content.appendChild(wrap);

    var rows = [
        [root.querySelector('[data-cm-action="back"]'), root.querySelector('[data-cm-action="open_lampa_settings"]')],
        [play, likeBtn, dislikeBtn],
        [].slice.call(right.querySelectorAll('.cm-ai-item'), 0)
    ];
    FocusManager.clearStack();
    FocusManager.setRows(rows, 1, 0);
    robotSay('Расскажу всё о «' + movie.title + '» — меню справа.');
}

/* ============================== "СМОТРЕТЬ" ============================== */
function pushFullCard(m) {
    try {
        Lampa.Activity.push({
            url: '',
            component: 'full',
            id: m.id,
            method: m.type,
            card: { id: m.id, title: m.title, name: m.type === 'tv' ? m.title : undefined, original_title: m.original_title, original_name: m.type === 'tv' ? m.original_title : undefined, poster_path: m.poster_path, release_date: m.release_date, first_air_date: m.type === 'tv' ? m.release_date : undefined, vote_average: m.vote_average, overview: m.overview },
            source: 'tmdb'
        });
        return true;
    } catch (e) { safeLog('pushFullCard', e); return false; }
}
function openWatch(m) {
    seenSet(m);
    if (!pushFullCard(m)) { notify('Не удалось открыть карточку Lampa'); return; }
    var tries = 0, done = false;
    var iv = setInterval(function () {
        tries++;
        try {
            var b = document.querySelector('.button--play');
            if (b && (window.jQuery || window.$)) {
                done = true; clearInterval(iv);
                setTimeout(function () { try { (window.jQuery || window.$)(b).trigger('hover:enter'); } catch (e) {} }, 150);
            }
        } catch (e) {}
        if (tries > 40 || done) { try { clearInterval(iv); } catch (e2) {} }
    }, 150);
}

/* ============================== МОДАЛКИ ============================== */
function modalOpen(title, node, opts) {
    opts = opts || {};
    FocusManager.push();
    var ov = el('div', 'cm-overlay');
    var panel = el('div', 'cm-panel');
    panel.appendChild(el('h2', '', esc(title)));
    var closeBtn = el('div', 'cm-modal-close'); closeBtn.setAttribute('data-cm-action', 'modal_close'); closeBtn.innerHTML = SVG_CLOSE;
    panel.appendChild(closeBtn);
    panel.appendChild(node);
    ov.appendChild(panel);
    state.root.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) modalClose(); });
    bindMouse(ov);
    var focusable = [].slice.call(panel.querySelectorAll('[data-cm-action]'), 0);
    state.modals.push({ ov: ov, kb: opts.kb || null });
    if (opts.kb) state.kb = opts.kb;
    FocusManager.setRows([focusable], 0, 0);
    return ov;
}
function modalClose() {
    var top = state.modals.pop();
    if (!top) return;
    if (top.ov && top.ov.parentNode) top.ov.parentNode.removeChild(top.ov);
    if (top.kb) state.kb = null;
    FocusManager.pop();
}
function closeAllModals() { while (state.modals.length) modalClose(); }

/* ============================== ЭКРАННАЯ КЛАВИАТУРА ============================== */
var KB_ROWS = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['й','ц','у','к','е','н','г','ш','щ','з','х'],
    ['ф','ы','в','а','п','р','о','л','д','ж','э'],
    ['я','ч','с','м','и','т','ь','б','ю','ё']
];
function kbUpdateDisplay() { var d = document.getElementById('cm_kb_display'); if (d) d.textContent = state.kb ? (state.kb.value || ' ') : ''; }
function kbAppend(ch) { if (!state.kb) return; state.kb.value = (state.kb.value || '') + ch; kbUpdateDisplay(); }
function kbBackspace() { if (!state.kb) return; state.kb.value = (state.kb.value || '').slice(0, -1); kbUpdateDisplay(); }
function kbSubmit() {
    if (!state.kb) return;
    var v = (state.kb.value || '').trim(), cb = state.kb.cb;
    modalClose();
    if (v && cb) cb(v);
}
function openKeyboard(title, onSubmit) {
    var body = el('div', 'cm-modal-body');
    var disp = el('div', 'cm-kb-display', ' '); disp.id = 'cm_kb_display';
    body.appendChild(disp);
    var r, c;
    for (r = 0; r < KB_ROWS.length; r++) {
        var rowDiv = el('div', 'cm-kb-row');
        for (c = 0; c < KB_ROWS[r].length; c++) {
            (function (ch) {
                var k = el('div', 'cm-kb-key', esc(ch)); k.setAttribute('data-cm-action', 'kb_char'); k.setAttribute('data-ch', ch);
                rowDiv.appendChild(k);
            })(KB_ROWS[r][c]);
        }
        body.appendChild(rowDiv);
    }
    var ctrlRow = el('div', 'cm-kb-row');
    var space = el('div', 'cm-kb-key wide', '␣'); space.setAttribute('data-cm-action', 'kb_char'); space.setAttribute('data-ch', ' ');
    var bsp = el('div', 'cm-kb-key', '⌫'); bsp.setAttribute('data-cm-action', 'kb_bs');
    var ok = el('div', 'cm-kb-key wide', 'Отправить'); ok.setAttribute('data-cm-action', 'kb_ok');
    ctrlRow.appendChild(space); ctrlRow.appendChild(bsp); ctrlRow.appendChild(ok);
    body.appendChild(ctrlRow);
    modalOpen(title, body, { kb: { value: '', cb: onSubmit } });
    kbUpdateDisplay();
}

function openAiDialog() {
    var body = el('div', 'cm-modal-body');
    var input = el('div', 'cm-chip', '✏️ Написать запрос роботу…'); input.setAttribute('data-cm-action', 'ai_input'); body.appendChild(input);
    var chips = [ { t: 'Обновить рекомендации', a: 'ai_refresh' }, { t: 'Случайный фильм', a: 'ai_random' }, { t: 'По настроению', a: 'ai_mood' } ];
    for (var i = 0; i < chips.length; i++) { var c = el('div', 'cm-chip', esc(chips[i].t)); c.setAttribute('data-cm-action', chips[i].a); body.appendChild(c); }
    body.appendChild(el('div', '', '<span style="color:var(--cm-sub)">Понимаю запросы вида: «фантастика без ужасов», «комедия 90-х»…</span>'));
    modalOpen('Диалог с роботом', body);
}
function aiApplyFilters(title, f) {
    closeAllModals(); robotSay(f.phrase || robotPhrase('loading')); skeletonRows();
    Engine.queryBundle(state.profile || { interests: {}, sampleSize: 0 }, f, function (list) {
        state.custom = { title: title, list: list }; renderMain();
        robotSay(list.length ? 'Готово! Обновил выдачу под запрос.' : robotPhrase('empty'));
    });
}
function aiRandom() {
    var pool = (state.bundle && state.bundle.stable ? state.bundle.stable : []).concat(state.bundle && state.bundle.exp ? state.bundle.exp : []);
    function show(m) {
        var mm = normMovie(m), body = el('div', 'cm-modal-body');
        body.appendChild(el('div', '', '<h4>' + esc(mm.title) + '</h4><div>' + (mm.vote_average ? mm.vote_average.toFixed(1) : '—') + ' · ' + ((mm.release_date || '').slice(0, 4) || '—') + '</div><div style="margin-top:0.6em">' + esc((mm.overview || 'Описание появится после загрузки.').slice(0, 280)) + '</div>'));
        var go = el('div', 'cm-chip', 'Смотреть'); go.setAttribute('data-cm-action', 'ai_random_play'); body.appendChild(go);
        modalOpen('Случайный выбор', body); state.cards['rand'] = mm;
    }
    if (pool.length) { show(rnd(pool)); return; }
    TMDB.get('/discover/movie', { sort_by: 'popularity.desc', 'vote_average.gte': 6.5, 'vote_count.gte': 150 }, function (d) { var r = d.results || []; if (r.length) show(rnd(r)); else notify(robotPhrase('empty')); }, function () { notify(robotPhrase('error')); });
}
function aiInfo(kind) {
    var m = state.current; if (!m) return;
    var path = '/' + m.type + '/' + m.id;
    if (kind === 'ai_desc') {
        TMDB.get(path, {}, function (d) { modalOpen('Описание и сюжет', el('div', 'cm-modal-body', '<h4>' + esc(d.title || d.name || m.title) + '</h4><div>' + esc(d.overview || 'Описание отсутствует.') + '</div>')); }, function () { notify(robotPhrase('error')); });
    }
    if (kind === 'ai_fit') {
        TMDB.get(path, {}, function (d) {
            var ids = [], i, pros = [], cons = [];
            var g = d.genres || []; for (i = 0; i < g.length; i++) ids.push(g[i].id);
            if (ids.indexOf(28) > -1 || ids.indexOf(53) > -1) { pros.push('любителям динамики'); cons.push('ищущим спокойное кино'); }
            if (ids.indexOf(35) > -1) pros.push('для лёгкого вечера');
            if (ids.indexOf(27) > -1) { pros.push('крепким нервам'); cons.push('впечатлительным и детям'); }
            if (ids.indexOf(10751) > -1 || ids.indexOf(16) > -1) pros.push('для семейного просмотра');
            if (ids.indexOf(18) > -1) pros.push('ценителям глубины');
            if (!pros.length) pros.push('широкой аудитории');
            var html = '<h4>Кому подойдёт</h4><div>' + pros.join('<br>') + '</div>';
            if (cons.length) html += '<h4>Кому нет</h4><div>' + cons.join('<br>') + '</div>';
            modalOpen('Кому подойдёт', el('div', 'cm-modal-body', html));
        }, function () { notify(robotPhrase('error')); });
    }
    if (kind === 'ai_rev') {
        TMDB.get(path + '/reviews', { language: 'ru-RU' }, function (d) {
            var r = d.results || [];
            function renderRev(list) {
                var html = '<h4>Отзывы зрителей</h4>';
                if (!list.length) html += '<div>Отзывов пока нет.</div>';
                for (var i = 0; i < Math.min(list.length, 3); i++) html += '<div style="margin-bottom:0.8em"><b>' + esc(list[i].author) + ':</b> ' + esc(String(list[i].content).slice(0, 240)) + '…</div>';
                modalOpen('Отзывы зрителей', el('div', 'cm-modal-body', html));
            }
            if (!r.length) TMDB.get(path + '/reviews', { language: 'en-US' }, function (d2) { renderRev(d2.results || []); }, function () { renderRev([]); });
            else renderRev(r);
        }, function () { notify(robotPhrase('error')); });
    }
    if (kind === 'ai_facts') {
        TMDB.get(path, { append_to_response: 'credits,keywords' }, function (d) {
            var html = '<h4>Актёры</h4><div>', cast = (d.credits && d.credits.cast) || [], i;
            for (i = 0; i < Math.min(cast.length, 6); i++) html += '• ' + esc(cast[i].name) + ' — ' + esc(cast[i].character) + '<br>';
            var crew = (d.credits && d.credits.crew) || [], dir = '';
            for (i = 0; i < crew.length; i++) if (crew[i].job === 'Director') { dir = crew[i].name; break; }
            if (dir) html += '<br>Режиссёр: <b>' + esc(dir) + '</b>';
            html += '</div><h4>Факты</h4><div>';
            if (d.budget) html += 'Бюджет: $' + (d.budget / 1000000).toFixed(1) + ' млн<br>';
            if (d.revenue) html += 'Сборы: $' + (d.revenue / 1000000).toFixed(1) + ' млн<br>';
            var kw = (d.keywords && (d.keywords.keywords || d.keywords.results || d.keywords)) || [], names = [];
            for (i = 0; i < Math.min(kw.length, 5); i++) names.push(esc(kw[i].name));
            if (names.length) html += 'Темы: ' + names.join(', ');
            html += '</div>';
            modalOpen('Актёры и факты', el('div', 'cm-modal-body', html));
        }, function () { notify(robotPhrase('error')); });
    }
}

/* ============================== ДЕЙСТВИЯ ============================== */
function doBack() {
    if (state.modals.length) { modalClose(); return; }
    if (state.view === 'details') { renderMain(); return; }
    closeAllModals();
    try { Lampa.Activity.backward(); } catch (e) { try { Lampa.Activity.back(); } catch (e2) {} }
}
function doAction(node) {
    if (!node) return;
    var a = node.getAttribute('data-cm-action'); if (!a) return;
    switch (a) {
        case 'back': doBack(); return;
        case 'modal_close': modalClose(); return;
        case 'open_lampa_settings':
            try { Lampa.Activity.push({ url: '', title: 'Настройки', component: 'settings', page: 'capsule_mod' }); }
            catch (e) { safeLog('open_lampa_settings', e); notify('Откройте Настройки → Capsule Mod'); }
            return;
        case 'card': var key = node.getAttribute('data-key'); if (state.cards[key]) renderDetails(state.cards[key]); return;
        case 'robot': openAiDialog(); return;
        case 'play': if (state.current) openWatch(state.current); return;
        case 'like': if (state.current) { var cur = getManualFeedback(state.current.type, state.current.id); Engine.setFeedback(state.current.type, state.current.id, cur > 0 ? 0 : 1); renderDetails(state.current); } return;
        case 'dislike': if (state.current) { var curD = getManualFeedback(state.current.type, state.current.id); Engine.setFeedback(state.current.type, state.current.id, curD < 0 ? 0 : -1); renderDetails(state.current); } return;
        case 'ai_input':
            openKeyboard('Запрос роботу', function (v) { aiApplyFilters('Ответ: «' + v.slice(0, 24) + '»', parseUserQuery(v)); });
            return;
        case 'kb_char': kbAppend(node.getAttribute('data-ch') || ''); return;
        case 'kb_bs': kbBackspace(); return;
        case 'kb_ok': kbSubmit(); return;
        case 'ai_refresh': closeAllModals(); state.custom = null; loadMainData(true); return;
        case 'ai_random': aiRandom(); return;
        case 'ai_random_play': if (state.cards['rand']) { modalClose(); openWatch(state.cards['rand']); } return;
        case 'ai_mood': {
            var body = el('div', 'cm-modal-body');
            for (var i = 0; i < MOODS.length; i++) {
                var mchip = el('div', 'cm-chip', esc(MOODS[i].title));
                mchip.setAttribute('data-cm-action', 'mood_' + i);
                body.appendChild(mchip);
            }
            modalOpen('Настроение', body);
            return;
        }
        case 'ai_desc': case 'ai_fit': case 'ai_rev': case 'ai_facts': aiInfo(a); return;
        default:
            if (a.indexOf('mood_') === 0) {
                var idx = parseInt(a.slice(5), 10);
                if (MOODS[idx]) aiApplyFilters('Настроение: ' + MOODS[idx].title, MOODS[idx].f);
            }
            return;
    }
}
function bindMouse(scope) {
    scope.addEventListener('click', function (e) { var n = closestAttr(e.target, 'data-cm-action'); if (n) doAction(n); });
    scope.addEventListener('mouseover', function (e) {
        var n = closestAttr(e.target, 'data-cm-action');
        if (n && !hasClass(n, 'cm-focus')) {
            for (var r = 0; r < FocusManager.rows.length; r++) {
                var idx = FocusManager.rows[r].indexOf(n);
                if (idx > -1) { FocusManager.r = r; FocusManager.i = idx; FocusManager.apply(); break; }
            }
        }
    });
}

/* ============================== КЛАВИШИ ============================== */
function isBackCode(k) { return k === 27 || k === 8 || k === 461 || k === 10009 || k === 10000; }
function handleKey(ev) {
    if (!state.active) return;
    var k = ev.keyCode, handled = true;
    if (state.kb) {
        if (ev.key && ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) kbAppend(ev.key);
        else if (k === 8) kbBackspace();
        else if (k === 13) { var n0 = FocusManager.current(); if (n0) doAction(n0); }
        else if (isBackCode(k)) modalClose();
        else if (k === 37) FocusManager.move('left');
        else if (k === 39) FocusManager.move('right');
        else if (k === 38) FocusManager.move('up');
        else if (k === 40) FocusManager.move('down');
        else handled = false;
        if (handled) { ev.preventDefault(); ev.stopPropagation(); }
        return;
    }
    if (isBackCode(k)) { ev.preventDefault(); ev.stopPropagation(); doBack(); return; }
    if (k === 37) FocusManager.move('left');
    else if (k === 39) FocusManager.move('right');
    else if (k === 38) FocusManager.move('up');
    else if (k === 40) FocusManager.move('down');
    else if (k === 13) { var n = FocusManager.current(); if (n) doAction(n); }
    else handled = false;
    if (handled) { ev.preventDefault(); ev.stopPropagation(); }
}

var Capsule = {
    onFocus: function (n) {
        if (n.getAttribute('data-cm-action') === 'card' && state.view === 'main') {
            var m = state.cards[n.getAttribute('data-key')];
            if (m) {
                var extra = (m.matchPct != null && m.matchPct > 0) ? (', совпадение ' + m.matchPct + '%') : '';
                robotSay('«' + m.title + '» — рейтинг ' + (m.vote_average ? m.vote_average.toFixed(1) : '—') + extra + '.');
            }
        }
    }
};

/* ============================== КОМПОНЕНТ LAMPA ============================== */
function CapsuleComponent() {
    var html = el('div', 'cm-root');
    this.create = function () {
        injectCSS();
        try { if (window.Lampa && Lampa.Head && Lampa.Head.hide) Lampa.Head.hide(); } catch (e) {}
        state.root = html; html.innerHTML = '';
        html.appendChild(buildRail()); html.appendChild(el('div', 'cm-content'));
        bindMouse(html); tickClock();
        if (state.clockTimer) clearInterval(state.clockTimer);
        state.clockTimer = setInterval(tickClock, 1000);
        state.active = true; state.custom = null; state.modals = []; state.kb = null;
        document.addEventListener('keydown', handleKey, true);
        loadMainData(false);
        return this.render();
    };
    this.start = function () {};
    this.render = function () { return html; };
    this.pause = function () {};
    this.stop = function () {};
    this.back = function () { doBack(); };
    this.destroy = function () {
        state.active = false;
        if (state.clockTimer) clearInterval(state.clockTimer); state.clockTimer = null;
        document.removeEventListener('keydown', handleKey, true);
        try { if (window.Lampa && Lampa.Head && Lampa.Head.show) Lampa.Head.show(); } catch (e) {}
        html.innerHTML = '';
    };
}
function addMenuItem() {
    var done = false;
    var mk = function () {
        if (done) return;
        try {
            if (document.querySelector('[data-action="capsule_mod"]')) { done = true; return; }
            if (window.jQuery || window.$) {
                var list = $('.menu .menu__list').eq(0); if (!list.length) return;
                var btn = $('<li class="menu__item selector" data-action="capsule_mod"><div class="menu__ico">' + RAIL_ICONS[3] + '</div><div class="menu__text">Capsule Mod</div></li>');
                btn.on('hover:enter', function () { try { Lampa.Activity.push({ url: '', title: 'Capsule Mod', component: COMPONENT, page: 1 }); } catch (e) {} });
                list.append(btn);
            } else {
                var l2 = document.querySelector('.menu .menu__list'); if (!l2) return;
                var b2 = el('li', 'menu__item', '<div class="menu__ico">' + RAIL_ICONS[3] + '</div><div class="menu__text">Capsule Mod</div>');
                b2.setAttribute('data-action', 'capsule_mod');
                b2.onclick = function () { try { Lampa.Activity.push({ url: '', title: 'Capsule Mod', component: COMPONENT, page: 1 }); } catch (e) {} };
                l2.appendChild(b2);
            }
            done = true;
        } catch (e) {}
    };
    if (window.appready) setTimeout(mk, 500);
    else if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) { Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') setTimeout(mk, 500); }); setTimeout(function () { if (window.appready) setTimeout(mk, 500); }, 2500); }
    else setTimeout(mk, 1000);
}
function startPlugin() {
    injectCSS();
    var booted = false;
    var boot = function () {
        if (booted) return; booted = true;
        setTimeout(function () {
            try { if (window.Lampa && Lampa.Component && Lampa.Component.add) Lampa.Component.add(COMPONENT, CapsuleComponent); } catch (e) {}
            registerSettings();
            addMenuItem();
            console.log('[CapsuleMod] v6.1 готов');
        }, 300);
    };
    if (window.appready) boot();
    else if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) { Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') boot(); }); setTimeout(function () { if (window.appready) boot(); }, 2500); }
    else boot();
}
startPlugin();
})();
