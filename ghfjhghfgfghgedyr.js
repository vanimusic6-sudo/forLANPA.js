/* ==========================================================================
 * Should Watch? — плагин для Lampa
 * --------------------------------------------------------------------------
 * Добавляет кнопку "Стоит смотреть?" на страницу фильма/сериала.
 * По клику открывается модальное окно с анализом (жанры, рейтинг, актёры,
 * настроение) и анимацией "кубика", дающего вердикт: СТОИТ / НЕ СТОИТ.
 *
 * Требования, учтённые в реализации:
 *  - IIFE + защита от повторного запуска
 *  - Интеграция через Lampa.Listener.follow('full', ...)
 *  - Фоллбэк на DEMO_DATA, если e.data.movie недоступен/невалиден
 *  - Lampa.Modal.open с корректным onBack
 *  - Полное управление жизненным циклом: DOM, обработчики, таймеры,
 *    контроллер навигации, ссылки — всё очищается в cleanupModal
 *  - Гибридная навигация: Lampa.Controller (D-Pad) + click/hover:enter (touch)
 *  - SW_VERDICTS жёстко ограничен двумя значениями: ['СТОИТ', 'НЕ СТОИТ']
 *  - Инкапсуляция CSS через один <style> тег с уникальным префиксом sw-
 *  - Экранирование всех подставляемых данных через _esc (защита от XSS)
 *  - Только встроенный jQuery ($), никаких внешних библиотек
 * ========================================================================== */

(function () {
    'use strict';

    // ---- Защита от повторного запуска -------------------------------------
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;

    // ---- Константы ---------------------------------------------------------
    // ЖЁСТКО ограничено двумя значениями — вариант "СПОРНО" исключён.
    var SW_VERDICTS = ['СТОИТ', 'НЕ СТОИТ'];

    var CONTROLLER_NAME = 'should_watch_modal_enhanced';

    var DEMO_DATA = {
        id: 0,
        title: 'Демонстрационный фильм',
        name: 'Демонстрационный фильм',
        original_title: 'Demo Movie',
        release_date: '2024-01-01',
        first_air_date: '2024-01-01',
        vote_average: 7.4,
        vote_count: 1280,
        genres: [{ id: 1, name: 'Драма' }, { id: 2, name: 'Фантастика' }],
        overview: 'Это тестовые данные, отображаемые, когда информация о фильме недоступна.'
    };

    // ---- Глобальные ссылки плагина (для последующей очистки) ---------------
    window._sw_currentModalHtml = null;
    window._sw_prevController = null;
    window._sw_loaderTimer = null;
    window._sw_activeRequests = [];
    window._sw_pendingClose = false;

    // ==========================================================================
    // Утилиты
    // ==========================================================================

    function _esc(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isValidMovie(movie) {
        return !!(movie && (movie.id || movie.title || movie.name));
    }

    function normalizeMovie(movie) {
        return isValidMovie(movie) ? movie : DEMO_DATA;
    }

    // ==========================================================================
    // Стили (инкапсулированные, с префиксом sw-)
    // ==========================================================================

    function injectCSS() {
        var css = ''
            + '.sw-root{font-family:inherit;color:#fff;padding:10px 4px;}'
            + '.sw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;'
            + 'padding:60px 20px;text-align:center;}'
            + '.sw-loader-emoji{font-size:48px;margin-bottom:16px;transition:transform .3s;}'
            + '.sw-loader-text{font-size:16px;opacity:.8;}'
            + '.sw-section{margin-bottom:20px;}'
            + '.sw-section-title{font-size:15px;font-weight:600;margin-bottom:8px;opacity:.85;}'
            + '.sw-tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;}'
            + '.sw-tab{padding:8px 16px;border-radius:8px;background:rgba(255,255,255,.08);cursor:pointer;'
            + 'transition:background .2s,transform .15s;}'
            + '.sw-tab.focus,.sw-tab:hover{background:rgba(255,255,255,.22);transform:scale(1.04);}'
            + '.sw-tab.active{background:rgba(120,170,255,.35);}'
            + '.sw-tab-content{display:none;}'
            + '.sw-tab-content.active{display:block;}'
            + '.sw-progress-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}'
            + '.sw-progress-label{width:120px;font-size:13px;opacity:.8;flex-shrink:0;}'
            + '.sw-progress-track{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;}'
            + '.sw-progress-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#5a8dee,#7ad0a0);}'
            + '.sw-progress-value{width:36px;text-align:right;font-size:13px;opacity:.8;}'
            + '.sw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;}'
            + '.sw-card{background:rgba(255,255,255,.06);border-radius:10px;padding:10px;font-size:13px;'
            + 'transition:background .2s,transform .15s;cursor:pointer;}'
            + '.sw-card.focus,.sw-card:hover{background:rgba(255,255,255,.18);transform:scale(1.03);}'
            + '.sw-args{display:flex;flex-direction:column;gap:6px;}'
            + '.sw-arg{padding:8px 12px;border-radius:8px;font-size:13px;}'
            + '.sw-arg-pro{background:rgba(122,208,160,.15);border-left:3px solid #7ad0a0;}'
            + '.sw-arg-con{background:rgba(230,120,120,.15);border-left:3px solid #e67878;}'
            + '.sw-dice-wrap{display:flex;flex-direction:column;align-items:center;padding:30px 10px;}'
            + '.sw-dice{font-size:64px;cursor:pointer;transition:transform .15s;user-select:none;}'
            + '.sw-dice.focus,.sw-dice:hover{transform:scale(1.08);}'
            + '.sw-dice.rolling{animation:sw-spin .6s linear infinite;}'
            + '@keyframes sw-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}'
            + '.sw-verdict{margin-top:16px;font-size:26px;font-weight:700;text-align:center;min-height:34px;}'
            + '.sw-verdict.yes{color:#7ad0a0;}'
            + '.sw-verdict.no{color:#e67878;}'
            + '.sw-btn{display:inline-block;padding:6px 14px;border-radius:8px;background:rgba(255,255,255,.35);'
            + 'font-size:13px;margin-left:8px;cursor:pointer;}'
            + '.sw-btn.focus,.sw-btn:hover{background:rgba(120,170,255,.6);}';

        var style = document.createElement('style');
        style.setAttribute('data-sw-plugin', 'true');
        style.innerHTML = css;
        $('head').append(style);
    }

    // ==========================================================================
    // Загрузка и анализ данных
    // ==========================================================================

    function loadCredits(movie) {
        // Заглушка/точка расширения: интеграция с Lampa.Api / TMDB для актёров и съёмочной группы.
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve({ cast: [], crew: [] });
            }, 150);
        });
    }

    function loadMeta(movie) {
        // Заглушка/точка расширения: ключевые слова, возрастной рейтинг, отзывы.
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve({ keywords: [], certification: null, reviews: [] });
            }, 150);
        });
    }

    function lampaLocal(movie) {
        // Локальная статистика из библиотеки Lampa (просмотрено/избранное), если доступна.
        try {
            if (window.Lampa && Lampa.Favorite && typeof Lampa.Favorite.check === 'function') {
                return Promise.resolve({ inFavorites: !!Lampa.Favorite.check(movie) });
            }
        } catch (e) { /* игнорируем — фоллбэк ниже */ }
        return Promise.resolve({ inFavorites: false });
    }

    function analyze(movie) {
        return Promise.all([
            loadCredits(movie),
            loadMeta(movie),
            lampaLocal(movie)
        ]).then(function (results) {
            var credits = results[0];
            var meta = results[1];
            var local = results[2];

            var rating = parseFloat(movie.vote_average) || 0;
            var votes = parseInt(movie.vote_count, 10) || 0;
            var genres = (movie.genres || []).map(function (g) { return g.name || g; });

            var pros = [];
            var cons = [];

            if (rating >= 7) pros.push('Высокий рейтинг зрителей (' + rating.toFixed(1) + ')');
            if (rating > 0 && rating < 5.5) cons.push('Невысокий рейтинг зрителей (' + rating.toFixed(1) + ')');
            if (votes >= 1000) pros.push('Большое количество оценок — рейтингу можно доверять');
            if (votes > 0 && votes < 100) cons.push('Мало оценок — рейтинг может быть неточным');
            if (genres.length) pros.push('Жанры: ' + genres.join(', '));
            if (local.inFavorites) pros.push('Уже в вашей библиотеке избранного');

            if (!pros.length) pros.push('Недостаточно данных для явных плюсов');
            if (!cons.length) cons.push('Явных минусов не обнаружено');

            var moods = [
                { title: 'Атмосфера', value: rating >= 7 ? 'Позитивная' : 'Неоднозначная' },
                { title: 'Темп', value: 'Средний' },
                { title: 'Жанровая насыщенность', value: genres.length > 1 ? 'Высокая' : 'Обычная' }
            ];

            return {
                movie: movie,
                rating: rating,
                votes: votes,
                genres: genres,
                pros: pros,
                cons: cons,
                moods: moods,
                credits: credits,
                meta: meta,
                local: local
            };
        });
    }

    // ==========================================================================
    // Генерация разметки
    // ==========================================================================

    function buildProgressRow(label, value, max) {
        max = max || 10;
        var pct = Math.max(0, Math.min(100, (value / max) * 100));
        return ''
            + '<div class="sw-progress-row">'
            + '<div class="sw-progress-label">' + _esc(label) + '</div>'
            + '<div class="sw-progress-track"><div class="sw-progress-fill" style="width:' + pct.toFixed(0) + '%"></div></div>'
            + '<div class="sw-progress-value">' + _esc(value.toFixed(1)) + '</div>'
            + '</div>';
    }

    function buildReadyInner(data) {
        var movie = data.movie;
        var title = movie.title || movie.name || 'Без названия';
        var year = (movie.release_date || movie.first_air_date || '').slice(0, 4);

        var prosHtml = data.pros.map(function (p) {
            return '<div class="sw-arg sw-arg-pro">✓ ' + _esc(p) + '</div>';
        }).join('');

        var consHtml = data.cons.map(function (c) {
            return '<div class="sw-arg sw-arg-con">✗ ' + _esc(c) + '</div>';
        }).join('');

        var moodsHtml = data.moods.map(function (m) {
            return '<div class="sw-card">' 
                + '<div style="font-weight:600;margin-bottom:4px;">' + _esc(m.title) + '</div>'
                + '<div style="opacity:.8;">' + _esc(m.value) + '</div>'
                + '</div>';
        }).join('');

        return ''
            + '<div class="sw-root">'
            +   '<div class="sw-section">'
            +     '<div class="sw-section-title">' + _esc(title) + (year ? ' (' + _esc(year) + ')' : '') + '</div>'
            +     buildProgressRow('Рейтинг', data.rating, 10)
            +   '</div>'

            +   '<div class="sw-tabs">'
            +     '<div class="sw-tab sw-focusable active" data-sw-tab="args">Аргументы</div>'
            +     '<div class="sw-tab sw-focusable" data-sw-tab="mood">Настроение</div>'
            +     '<div class="sw-tab sw-focusable" data-sw-tab="dice">Вердикт</div>'
            +   '</div>'

            +   '<div class="sw-tab-content active" data-sw-content="args">'
            +     '<div class="sw-section"><div class="sw-section-title">За</div><div class="sw-args">' + prosHtml + '</div></div>'
            +     '<div class="sw-section"><div class="sw-section-title">Против</div><div class="sw-args">' + consHtml + '</div></div>'
            +   '</div>'

            +   '<div class="sw-tab-content" data-sw-content="mood">'
            +     '<div class="sw-grid">' + moodsHtml + '</div>'
            +   '</div>'

            +   '<div class="sw-tab-content" data-sw-content="dice">'
            +     '<div class="sw-dice-wrap">'
            +       '<div class="sw-dice sw-focusable" tabindex="0">🎲</div>'
            +       '<div class="sw-verdict"></div>'
            +     '</div>'
            +   '</div>'
            + '</div>';
    }

    // ==========================================================================
    // Загрузочный экран
    // ==========================================================================

    function loaderHtml() {
        return ''
            + '<div class="sw-loader">'
            +   '<div class="sw-loader-emoji">🎬</div>'
            +   '<div class="sw-loader-text">Анализируем фильм…</div>'
            + '</div>';
    }

    function startLoaderAnimation($container) {
        var emojis = ['🎬', '🍿', '🎞️', '📽️'];
        var texts = ['Анализируем фильм…', 'Считаем плюсы и минусы…', 'Собираем рейтинг…', 'Почти готово…'];
        var i = 0;

        clearLoader();

        window._sw_loaderTimer = setInterval(function () {
            i = (i + 1) % emojis.length;
            var $emoji = $container.find('.sw-loader-emoji');
            var $text = $container.find('.sw-loader-text');
            if ($emoji.length) $emoji.text(emojis[i]);
            if ($text.length) $text.text(texts[i]);
        }, 500);
    }

    function clearLoader() {
        if (window._sw_loaderTimer) {
            clearInterval(window._sw_loaderTimer);
            window._sw_loaderTimer = null;
        }
    }

    // ==========================================================================
    // Гибридная навигация: D-Pad (Lampa.Controller) + touch (click/hover:enter)
    // ==========================================================================

    var swScrollRAF = null;

    function swScrollToFocus($container, $el) {
        if (!$container.length || !$el.length) return;

        if (swScrollRAF) {
            cancelAnimationFrame(swScrollRAF);
            swScrollRAF = null;
        }

        var containerEl = $container[0];
        var elTop = $el.position().top + containerEl.scrollTop;
        var target = elTop - (containerEl.clientHeight / 2) + ($el.outerHeight() / 2);
        target = Math.max(0, target);

        var start = containerEl.scrollTop;
        var change = target - start;
        var duration = 250;
        var startTime = null;

        function easeInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function step(ts) {
            if (!startTime) startTime = ts;
            var elapsed = ts - startTime;
            var progress = Math.min(1, elapsed / duration);
            containerEl.scrollTop = start + change * easeInOutCubic(progress);
            if (progress < 1) {
                swScrollRAF = requestAnimationFrame(step);
            } else {
                swScrollRAF = null;
            }
        }

        swScrollRAF = requestAnimationFrame(step);
    }

    function registerController($modalRoot) {
        window._sw_prevController = Lampa.Controller.enabled ? Lampa.Controller.enabled().name : null;

        Lampa.Controller.add(CONTROLLER_NAME, {
            toggle: function () {
                Lampa.Controller.collectSet($modalRoot.find('.sw-focusable').toArray(), $modalRoot[0]);
                Lampa.Controller.enable(CONTROLLER_NAME);
            },
            left: function () { moveFocus(-1); },
            right: function () { moveFocus(1); },
            up: function () { moveFocus(-1); },
            down: function () { moveFocus(1); },
            back: function () {
                closeModal();
            },
            enter: function () {
                var $focused = $modalRoot.find('.sw-focusable.focus');
                if ($focused.length) $focused.trigger('click');
            }
        });

        Lampa.Controller.toggle(CONTROLLER_NAME);

        function moveFocus(dir) {
            var $items = $modalRoot.find('.sw-focusable');
            if (!$items.length) return;

            var idx = $items.index($modalRoot.find('.sw-focusable.focus'));
            idx = idx === -1 ? 0 : idx + dir;
            if (idx < 0) idx = $items.length - 1;
            if (idx >= $items.length) idx = 0;

            $items.removeClass('focus');
            var $target = $items.eq(idx).addClass('focus');
            swScrollToFocus($modalRoot, $target);
        }
    }

    function restorePrev() {
        if (window._sw_prevController) {
            Lampa.Controller.toggle(window._sw_prevController);
        }
        window._sw_prevController = null;
    }

    function bindTabs($modalRoot) {
        $modalRoot.find('.sw-tab').on('click.swPlugin hover:enter.swPlugin', function () {
            var name = $(this).data('sw-tab');
            $modalRoot.find('.sw-tab').removeClass('active');
            $(this).addClass('active');
            $modalRoot.find('.sw-tab-content').removeClass('active');
            $modalRoot.find('[data-sw-content="' + name + '"]').addClass('active');
        });
    }

    function bindDice($modalRoot) {
        var $dice = $modalRoot.find('.sw-dice');
        var $verdict = $modalRoot.find('.sw-verdict');
        var rolling = false;

        function roll() {
            if (rolling) return;
            rolling = true;
            $dice.addClass('rolling');
            $verdict.removeClass('yes no').text('');

            setTimeout(function () {
                $dice.removeClass('rolling');
                var verdict = SW_VERDICTS[Math.floor(Math.random() * SW_VERDICTS.length)];
                $verdict.text(verdict).addClass(verdict === 'СТОИТ' ? 'yes' : 'no');
                rolling = false;
            }, 600);
        }

        $dice.on('click.swPlugin hover:enter.swPlugin', roll);

        // Обработка "OK" на пульте, когда кубик в фокусе, идёт через controller.enter(),
        // который триггерит click на .sw-focusable.focus — тот же обработчик roll().
    }

    // ==========================================================================
    // Управление жизненным циклом модального окна
    // ==========================================================================

    function cleanupModal() {
        clearLoader();

        if (swScrollRAF) {
            cancelAnimationFrame(swScrollRAF);
            swScrollRAF = null;
        }

        // Отменяем/игнорируем устаревшие запросы
        window._sw_activeRequests.forEach(function (req) {
            if (req && typeof req.abort === 'function') {
                try { req.abort(); } catch (e) { /* игнорируем */ }
            }
        });
        window._sw_activeRequests = [];

        // Снимаем именованные обработчики через пространство имён jQuery
        $(document).off('.swPlugin');
        var $root = $('.sw-root');
        if ($root.length) {
            $root.find('*').off('.swPlugin');
            $root.off('.swPlugin');
        }

        // Полностью очищаем DOM модального окна
        $('.sw-root').empty().remove();

        // Возвращаем контроллер навигации предыдущему владельцу
        restorePrev();

        // Обнуляем внутренние ссылки плагина
        window._sw_currentModalHtml = null;
        window._sw_pendingClose = false;
    }

    function closeModal() {
        if (window._sw_pendingClose) return;
        window._sw_pendingClose = true;
        Lampa.Modal.close();
        cleanupModal();
    }

    // ==========================================================================
    // Открытие модального окна
    // ==========================================================================

    function showModal(rawMovie) {
        var movie = normalizeMovie(rawMovie);
        window._sw_pendingClose = false;

        var html = $(loaderHtml());
        window._sw_currentModalHtml = html;

        Lampa.Modal.open({
            title: 'Стоит ли смотреть: ' + (movie.title || movie.name || ''),
            html: html,
            size: 'large',
            onBack: function () {
                closeModal();
            },
            onOverlayClick: function () {
                closeModal();
            }
        });

        startLoaderAnimation(html);

        analyze(movie).then(function (data) {
            clearLoader();
            var innerHtml = buildReadyInner(data);
            html.html(innerHtml);

            var $modalRoot = html;
            registerController($modalRoot);
            bindTabs($modalRoot);
            bindDice($modalRoot);

            // Фокус по умолчанию на первую доступную вкладку
            var $first = $modalRoot.find('.sw-focusable').first().addClass('focus');
            swScrollToFocus($modalRoot, $first);
        }).catch(function () {
            clearLoader();
            html.html(buildReadyInner({
                movie: DEMO_DATA,
                rating: 0,
                votes: 0,
                genres: [],
                pros: ['Не удалось получить данные — показаны демо-данные'],
                cons: ['Проверьте соединение или попробуйте позже'],
                moods: []
            }));
        });
    }

    // ==========================================================================
    // Настройки плагина (точка расширения под Lampa.Settings, если нужно)
    // ==========================================================================

    function initSettings() {
        // Точка расширения: регистрация пунктов в настройках Lampa при необходимости.
    }

    // ==========================================================================
    // Точка входа
    // ==========================================================================

    function startPlugin() {
        injectCSS();
        initSettings();
        registerButtonListener();
    }

    function registerButtonListener() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite' && e.type !== 'build') return;

            var root = e.object && e.object.activity ? e.object.activity.render() : (e.body || null);
            if (!root) return;

            var $root = $(root);
            if ($root.find('.sw-watch-btn').length) return; // уже добавлена

            var $btn = $('<div class="full-start__button selector sw-watch-btn">Стоит смотреть?</div>');

            $btn.on('click hover:enter', function () {
                showModal(e.data && e.data.movie);
            });

            var $watchBtn = $root.find('.button--play, .full-start__button[data-subtitle]').first();
            var $actions = $root.find('.full-start__buttons, .info__actions').first();

            if ($watchBtn.length) {
                $watchBtn.after($btn);
            } else if ($actions.length) {
                $actions.append($btn);
            }
        });
    }

    // ---- Запуск --------------------------------------------------------------
    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') startPlugin();
        });
    }

})();
