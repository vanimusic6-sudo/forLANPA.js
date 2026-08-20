(function () {
    'use strict';

    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;

    const SW_VERDICTS = ['СТОИТ', 'НЕ СТОИТ'];

    const DEMO_DATA = {
        verdict: 'СТОИТ',
        score: 82,
        pros: [
            'Захватывающий нелинейный сюжет',
            'Убедительные актёрские работы',
            'Атмосферная операторская работа',
            'Неожиданная многогранная концовка'
        ],
        cons: [
            'Затянутый второй акт',
            'Предсказуемый антагонист'
        ],
        mood: {
            pace: 8, action: 6, fear: 3,
            violence: 5, sadness: 4, language: 2
        },
        tags: ['Для вечера', 'Напряжённый', 'Атмосферный', 'Интеллектуальный', 'На один раз']
    };

    const SW_CSS = `
.sw-modal-wrap {
  width: 100%;
  max-width: 740px;
  background: #141414;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  overflow: hidden;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10000;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}
.sw-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.75);
  z-index: 9999;
}
.sw-modal-content {
  max-height: 85vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 32px;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.sw-modal-content::-webkit-scrollbar { display: none; }
.sw-focusable {
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  cursor: pointer;
  border: none;
  outline: none;
  min-width: 44px;
  min-height: 44px;
}
.sw-focusable:focus-visible,
.sw-focusable.focus {
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2), 0 0 15px rgba(255, 255, 255, 0.1);
  outline: none;
  background: rgba(255, 255, 255, 0.08);
}
.sw-dossier {
  margin-bottom: 28px;
  padding-bottom: 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.sw-dossier-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}
.sw-verdict-group { flex: 1 1 auto; }
.sw-verdict-eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #a0a0a0;
  margin-bottom: 8px;
}
.sw-verdict-word {
  font-size: clamp(28px, 5vw, 48px);
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1;
  text-transform: uppercase;
  color: #ffffff;
}
.sw-verdict-word.positive { color: #2ecc71; }
.sw-verdict-word.negative { color: #e74c3c; }
.sw-verdict-word.neutral  { color: #f39c12; }
.sw-score-block {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 56px;
}
.sw-score-num {
  font-size: 38px;
  font-weight: 800;
  line-height: 1;
  color: #ffffff;
}
.sw-score-cap {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #a0a0a0;
}
.sw-meter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sw-meter-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #a0a0a0;
  white-space: nowrap;
  flex: 0 0 auto;
}
.sw-meter {
  flex: 1 1 auto;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}
.sw-meter-fill {
  height: 100%;
  border-radius: 2px;
  background: #2ecc71;
  transition: width 0.7s cubic-bezier(0.4, 0, 0.2, 1);
}
.sw-meter-fill.negative { background: #e74c3c; }
.sw-meter-fill.neutral  { background: #f39c12; }
.sw-meter-pct {
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  flex: 0 0 auto;
  min-width: 36px;
  text-align: right;
}
.sw-dicebtn {
  display: flex;
  align-items: center;
  gap: 20px;
  min-height: 96px;
  width: 100%;
  padding: 20px 24px;
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  margin-bottom: 24px;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.sw-dicebtn:hover,
.sw-dicebtn.focus {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2), 0 0 15px rgba(255, 255, 255, 0.1);
}
.sw-dice {
  flex: 0 0 52px;
  width: 52px;
  height: 52px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 5px;
  padding: 9px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.sw-dicebtn.rolling .sw-dice {
  transform: rotate(540deg) scale(1.12);
}
.sw-pip {
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  transition: opacity 0.1s ease;
}
.sw-pip.off { opacity: 0; }
.sw-dicebtn-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.sw-dice-cta {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #a0a0a0;
}
.sw-label {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: #ffffff;
  transition: opacity 0.12s ease;
}
.sw-dicebtn.rolling .sw-label { opacity: 0.35; }
.sw-tabs-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}
.sw-tab-toggle {
  flex: 1;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 12px 16px;
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #a0a0a0;
  letter-spacing: 0.01em;
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.sw-tab-toggle.active {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.18);
}
.sw-tab-toggle:hover,
.sw-tab-toggle.focus {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2), 0 0 15px rgba(255, 255, 255, 0.1);
}
.sw-pane { display: none; }
.sw-pane.active { display: block; }
.sw-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.sw-col {
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 20px;
}
.sw-col-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.sw-col-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sw-col.pros .sw-col-dot { background: #2ecc71; }
.sw-col.cons .sw-col-dot { background: #e74c3c; }
.sw-col-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a0a0a0;
}
.sw-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
}
.sw-list li {
  font-size: 14px;
  line-height: 1.55;
  color: #e0e0e0;
  padding-left: 16px;
  position: relative;
}
.sw-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
.sw-col.pros .sw-list li::before { background: rgba(46, 204, 113, 0.65); }
.sw-col.cons .sw-list li::before { background: rgba(231, 76, 60, 0.65); }
.sw-list-empty {
  font-size: 13px;
  color: #a0a0a0;
  font-style: italic;
}
.sw-mood-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.sw-mood-section-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a0a0a0;
  margin-bottom: 14px;
}
.sw-mood-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.sw-mood-card {
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sw-mood-card-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.sw-mood-card-label {
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #a0a0a0;
}
.sw-mood-card-value {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1;
}
.sw-mood-card-value sub {
  font-size: 10px;
  font-weight: 400;
  color: #a0a0a0;
  margin-left: 1px;
  vertical-align: baseline;
  font-style: normal;
}
.sw-mood-card-bar {
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}
.sw-mood-card-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.sw-mood-card-fill[data-lvl="low"]    { background: rgba(255, 255, 255, 0.2);  }
.sw-mood-card-fill[data-lvl="mid"]    { background: rgba(255, 255, 255, 0.35); }
.sw-mood-card-fill[data-lvl="high"]   { background: rgba(243, 156, 18, 0.65); }
.sw-mood-card-fill[data-lvl="danger"] { background: rgba(231, 76, 60, 0.7);  }
.sw-tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sw-tag {
  padding: 7px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 100px;
  font-size: 12px;
  color: #b8b8b8;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
@media (max-width: 640px) {
  .sw-modal-content { padding: 20px; }
  .sw-columns        { grid-template-columns: 1fr; }
  .sw-tabs-bar       { flex-direction: column; }
  .sw-mood-grid      { grid-template-columns: repeat(2, 1fr); }
  .sw-dicebtn        { gap: 14px; }
}
`;

    function _esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function _pips(n) {
        const MAP = {
            1: new Set([4]),
            2: new Set([2, 6]),
            3: new Set([2, 4, 6]),
            4: new Set([0, 2, 6, 8]),
            5: new Set([0, 2, 4, 6, 8]),
            6: new Set([0, 2, 3, 5, 6, 8])
        };
        const on = MAP[n] || MAP[5];
        return Array.from({ length: 9 }, (_, i) =>
            `<span class="sw-pip${on.has(i) ? '' : ' off'}"></span>`
        ).join('');
    }

    function buildReadyInner(data) {
        const verdict = ((data.verdict || 'СПОРНО') + '').toUpperCase();
        const score   = typeof data.score === 'number' ? Math.max(0, Math.min(100, data.score)) : 70;
        const pros    = Array.isArray(data.pros)  ? data.pros  : [];
        const cons    = Array.isArray(data.cons)  ? data.cons  : [];
        const mood    = (data.mood && typeof data.mood === 'object') ? data.mood : {};
        const tags    = Array.isArray(data.tags)  ? data.tags  : [];

        const vClass  = verdict === 'СТОИТ'     ? 'positive'
                      : verdict === 'НЕ СТОИТ'  ? 'negative'
                      : 'neutral';

        const dossier = `
<div class="sw-dossier">
  <div class="sw-dossier-top">
    <div class="sw-verdict-group">
      <div class="sw-verdict-eyebrow">Вердикт</div>
      <div class="sw-verdict-word ${vClass}">${_esc(verdict)}</div>
    </div>
    <div class="sw-score-block">
      <div class="sw-score-num">${score}</div>
      <div class="sw-score-cap">из 100</div>
    </div>
  </div>
  <div class="sw-meter-row">
    <span class="sw-meter-title">Ценность</span>
    <div class="sw-meter">
      <div class="sw-meter-fill ${vClass}" style="width:${score}%"></div>
    </div>
    <span class="sw-meter-pct">${score}%</span>
  </div>
</div>`;

        const dicebtn = `
<div class="sw-dicebtn sw-focusable"
     role="button" tabindex="0"
     id="sw-dice-btn">
  <div class="sw-dice" id="sw-dice-face" aria-hidden="true">${_pips(5)}</div>
  <div class="sw-dicebtn-body">
    <div class="sw-dice-cta">Случайный вердикт</div>
    <div class="sw-label" id="sw-dice-label">Бросить кости</div>
  </div>
</div>`;

        const tabs = `
<div class="sw-tabs-bar" role="tablist">
  <button class="sw-tab-toggle sw-focusable active"
          role="tab" tabindex="0"
          data-tab="pros-cons">
    📋 Плюсы и минусы
  </button>
  <button class="sw-tab-toggle sw-focusable"
          role="tab" tabindex="0"
          data-tab="mood">
    🔥 Атмосфера &amp; Темп
  </button>
</div>`;

        const prosHtml = pros.length
            ? pros.map(p => `<li>${_esc(p)}</li>`).join('')
            : `<li class="sw-list-empty">Нет данных</li>`;
        const consHtml = cons.length
            ? cons.map(c => `<li>${_esc(c)}</li>`).join('')
            : `<li class="sw-list-empty">Нет данных</li>`;

        const panePC = `
<div class="sw-pane active" id="sw-pane-pros-cons" role="tabpanel">
  <div class="sw-columns">
    <div class="sw-col pros">
      <div class="sw-col-header">
        <span class="sw-col-dot"></span>
        <span class="sw-col-title">Плюсы</span>
      </div>
      <ul class="sw-list">${prosHtml}</ul>
    </div>
    <div class="sw-col cons">
      <div class="sw-col-header">
        <span class="sw-col-dot"></span>
        <span class="sw-col-title">Минусы</span>
      </div>
      <ul class="sw-list">${consHtml}</ul>
    </div>
  </div>
</div>`;

        const MOOD_META = [
            { key: 'pace',     alt: null,   icon: '⚡', label: 'Темп'    },
            { key: 'action',   alt: null,   icon: '💥', label: 'Экшен'   },
            { key: 'fear',     alt: null,   icon: '😱', label: 'Страх'   },
            { key: 'violence', alt: 'gore', icon: '🩸', label: 'Насилие' },
            { key: 'sadness',  alt: null,   icon: '💔', label: 'Грусть'  },
            { key: 'language', alt: null,   icon: '🤬', label: 'Мат'     }
        ];

        const moodCards = MOOD_META.map(m => {
            const raw = mood[m.key] !== undefined ? mood[m.key]
                      : (m.alt && mood[m.alt] !== undefined) ? mood[m.alt]
                      : 0;
            const val = Math.max(0, Math.min(10, +raw || 0));
            const pct = Math.round(val * 10);
            const lvl = val <= 2 ? 'low' : val <= 5 ? 'mid' : val <= 7 ? 'high' : 'danger';
            return `
<div class="sw-mood-card">
  <div class="sw-mood-card-top">
    <span class="sw-mood-card-label">${m.icon} ${m.label}</span>
    <span class="sw-mood-card-value">${val}<sub>/10</sub></span>
  </div>
  <div class="sw-mood-card-bar">
    <div class="sw-mood-card-fill" data-lvl="${lvl}" style="width:${pct}%"></div>
  </div>
</div>`;
        }).join('');

        const tagsBlock = tags.length ? `
<div>
  <div class="sw-mood-section-title">Настроение</div>
  <div class="sw-tags-wrap">
    ${tags.map(t => `<span class="sw-tag">${_esc(t)}</span>`).join('')}
  </div>
</div>` : '';

        const paneMood = `
<div class="sw-pane" id="sw-pane-mood" role="tabpanel">
  <div class="sw-mood-panel">
    <div>
      <div class="sw-mood-section-title">Интенсивность</div>
      <div class="sw-mood-grid">${moodCards}</div>
    </div>
    ${tagsBlock}
  </div>
</div>`;

        return dossier + dicebtn + tabs + panePC + paneMood;
    }

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function swScrollToFocus(container, targetElement) {
        if (container._swScrollAnimation) {
            cancelAnimationFrame(container._swScrollAnimation);
            container._swScrollAnimation = null;
        }

        const containerRect = container.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        const containerHeight = container.clientHeight;
        const targetHeight = targetRect.height;

        const currentScrollTop = container.scrollTop;
        const elementOffsetFromTop = targetRect.top - containerRect.top;

        const desiredScrollTop =
            currentScrollTop + elementOffsetFromTop - (containerHeight / 2) + (targetHeight / 2);

        const maxScrollTop = container.scrollHeight - containerHeight;
        const targetScrollTop = Math.max(0, Math.min(desiredScrollTop, maxScrollTop));

        if (Math.abs(targetScrollTop - currentScrollTop) < 1) {
            container.scrollTop = targetScrollTop;
            return;
        }

        const duration = 200;
        const startScrollTop = currentScrollTop;
        const diff = targetScrollTop - startScrollTop;
        const startTime = performance.now();

        function animateScroll(timestamp) {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeInOutCubic(progress);
            container.scrollTop = startScrollTop + diff * eased;

            if (progress < 1) {
                container._swScrollAnimation = requestAnimationFrame(animateScroll);
            } else {
                container._swScrollAnimation = null;
            }
        }

        container._swScrollAnimation = requestAnimationFrame(animateScroll);
    }

    function swRollDice(btn) {
        if (btn.classList.contains('rolling')) return;
        if (btn._swDiceAnimation) {
            cancelAnimationFrame(btn._swDiceAnimation);
            btn._swDiceAnimation = null;
        }

        btn.classList.add('rolling');

        const label = btn.querySelector('#sw-dice-label') || document.getElementById('sw-dice-label');
        const face  = btn.querySelector('#sw-dice-face') || document.getElementById('sw-dice-face');
        label.textContent = '—';

        const duration = 800;
        const startTime = performance.now();
        let lastUpdateTime = startTime;

        function update(timestamp) {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const currentInterval = 65 + progress * 150;

            if (timestamp - lastUpdateTime >= currentInterval) {
                face.innerHTML = _pips(Math.ceil(Math.random() * 6));
                lastUpdateTime = timestamp;
            }

            if (progress < 1) {
                btn._swDiceAnimation = requestAnimationFrame(update);
            } else {
                const pick = SW_VERDICTS[Math.floor(Math.random() * SW_VERDICTS.length)];
                label.textContent = pick;
                btn.classList.remove('rolling');
                btn._swDiceAnimation = null;
            }
        }

        btn._swDiceAnimation = requestAnimationFrame(update);
    }

    function swTab(id) {
        const root = document.querySelector('.sw-modal-wrap');
        if (!root) return;
        root.querySelectorAll('.sw-tab-toggle').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.tab === id)
        );
        root.querySelectorAll('.sw-pane').forEach(pane =>
            pane.classList.toggle('active', pane.id === 'sw-pane-' + id)
        );
    }

    let currentModalWrap = null;
    let currentOverlay = null;
    let prevController = null;
    let focusables = [];
    let currentIndex = 0;

    function cleanupModal() {
        if (currentModalWrap) {
            currentModalWrap.remove();
            currentModalWrap = null;
        }
        if (currentOverlay) {
            currentOverlay.remove();
            currentOverlay = null;
        }
        focusables = [];
        currentIndex = 0;
        if (prevController) {
            try {
                Lampa.Controller.toggle(prevController.name || prevController);
            } catch(e) {}
            prevController = null;
        }
    }

    function updateFocus(newIndex) {
        if (focusables.length === 0) return;
        focusables.forEach(el => el.classList.remove('focus'));
        currentIndex = newIndex;
        const target = focusables[currentIndex];
        target.classList.add('focus');
        target.focus();

        const container = document.querySelector('.sw-modal-content');
        if (container) {
            swScrollToFocus(container, target);
        }
    }

    function openShouldWatchModal(movieData) {
        const data = movieData || DEMO_DATA;
        const html = buildReadyInner(data);

        prevController = Lampa.Controller.enabled ? Lampa.Controller.enabled() : null;

        currentOverlay = document.createElement('div');
        currentOverlay.className = 'sw-overlay';
        currentOverlay.addEventListener('click', function() {
            cleanupModal();
        });

        currentModalWrap = document.createElement('div');
        currentModalWrap.className = 'sw-modal-wrap';
        currentModalWrap.innerHTML = `<div class="sw-modal-content">${html}</div>`;

        document.body.appendChild(currentOverlay);
        document.body.appendChild(currentModalWrap);

        focusables = Array.from(currentModalWrap.querySelectorAll('.sw-focusable'));
        currentIndex = 0;

        const diceBtn = currentModalWrap.querySelector('#sw-dice-btn');
        if (diceBtn) {
            diceBtn.addEventListener('click', function() {
                swRollDice(diceBtn);
            });
            diceBtn.addEventListener('hover:enter', function() {
                swRollDice(diceBtn);
            });
        }

        const tabBtns = currentModalWrap.querySelectorAll('.sw-tab-toggle');
        tabBtns.forEach(btn => {
            const tabId = btn.dataset.tab;
            btn.addEventListener('click', function() {
                swTab(tabId);
            });
            btn.addEventListener('hover:enter', function() {
                swTab(tabId);
            });
        });

        if (focusables.length > 0) {
            updateFocus(0);
        }

        Lampa.Controller.toggle('should_watch');
    }

    Lampa.Controller.add('should_watch', {
        toggle: function() {
            if (focusables.length > 0) {
                updateFocus(currentIndex);
            }
        },
        up: function() {
            if (focusables.length === 0) return;
            let newIndex = currentIndex - 1;
            if (newIndex < 0) newIndex = focusables.length - 1;
            updateFocus(newIndex);
        },
        down: function() {
            if (focusables.length === 0) return;
            let newIndex = currentIndex + 1;
            if (newIndex >= focusables.length) newIndex = 0;
            updateFocus(newIndex);
        },
        left: function() {
            if (focusables.length === 0) return;
            let newIndex = currentIndex - 1;
            if (newIndex < 0) newIndex = focusables.length - 1;
            updateFocus(newIndex);
        },
        right: function() {
            if (focusables.length === 0) return;
            let newIndex = currentIndex + 1;
            if (newIndex >= focusables.length) newIndex = 0;
            updateFocus(newIndex);
        },
        enter: function() {
            if (focusables.length === 0) return;
            const target = focusables[currentIndex];
            if (target) {
                target.click();
            }
        },
        back: function() {
            cleanupModal();
        }
    });

    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;

        let renderEl = null;
        if (e.object && typeof e.object.render === 'function') {
            renderEl = e.object.render();
        } else if (e.object && e.object.activity && typeof e.object.activity.render === 'function') {
            renderEl = e.object.activity.render();
        }

        if (!renderEl) return;

        const $renderEl = $(renderEl);
        if ($renderEl.find('.sw-plugin-button').length > 0) return;

        const btn = $('<div class="full-start__button selector sw-plugin-button"><div class="full-start__icon">🎲</div><span>Стоит смотреть?</span></div>');
        btn.on('hover:enter click', function() {
            const movieData = e.data && e.data.movie ? {
                verdict: e.data.movie.vote_average >= 7 ? 'СТОИТ' : 'НЕ СТОИТ',
                score: Math.round((e.data.movie.vote_average || 0) * 10),
                pros: e.data.movie.overview ? [e.data.movie.overview] : [],
                cons: [],
                mood: {
                    pace: 5,
                    action: 5,
                    fear: 3,
                    violence: 4,
                    sadness: 3,
                    language: 2
                },
                tags: e.data.movie.genres ? e.data.movie.genres.map(g => g.name || g) : []
            } : null;

            openShouldWatchModal(movieData);
        });

        const actions = $renderEl.find('.full-start__buttons, .full-start-new__buttons, .full-card__buttons, .info__actions');
        if (actions.length > 0) {
            actions.first().append(btn);
        }
    });

    $(document).ready(function() {
        if (!document.getElementById('sw-plugin-styles')) {
            const style = document.createElement('style');
            style.id = 'sw-plugin-styles';
            style.innerHTML = SW_CSS;
            $('head').append(style);
        }
    });

})();
