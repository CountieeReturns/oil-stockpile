/**
 * /simulator/index.html のエントリーポイント（有事シナリオ・シミュレーター）。
 *
 * トップのカウンターと同じ「残り日数」を counter.js の subscribe() で購読し、
 * 選んだシナリオ（供給維持率）と節約率から残り日数を再計算して表示する。
 *
 * モデル（§ 仕様書 2-A/2-C）:
 *   1日あたりの純減少割合 = (1 − 節約率) − 維持率
 *   残り日数(シナリオ)     = 現在の残り日数 / 純減少割合
 *   → 完全遮断（維持率0・節約0）は純減少割合1で、カウンター値と一致（自己検算）。
 *   → 純減少割合が 0 以下（輸入＋節約が消費を満たす）なら目減りしない。
 *
 * 維持率の根拠は原油のホルムズ依存度93.0%／中東依存度94.0%
 * （内閣官房・経産省「中東情勢を踏まえた燃料油・石油製品の安定供給確保」2026-03、
 *  原データ：財務省貿易統計）。数値は推計で、新規データ源は持たない。
 */

import { initCounter, subscribe } from '../components/counter.js';
import { elapsedDaysSince, loadHistory, STALE_THRESHOLD_DAYS } from '../core/data.js';
import { onReady, safeInit, setText, showElement } from '../core/dom.js';
import { formatInt } from '../core/format.js';

/** 現在の残り日数（counter.js の購読値）。未取得のうちは NaN。 */
let baseDays = Number.NaN;
/** 選択中シナリオの供給維持率（0–1）。 */
let maintainRate = 0;
/** 節約率（0–0.3）。 */
let savingRate = 0;

function render() {
  if (!Number.isFinite(baseDays)) {
    setText('sim-days', '—');
    setText('sim-delta', 'データを取得できませんでした。');
    return;
  }

  const netDrain = 1 - savingRate - maintainRate;

  // 輸入＋節約が消費を満たす（純減少 0 以下）＝ 目減りしない。
  if (netDrain <= 0) {
    setText('sim-days', '∞');
    setText('sim-delta', '供給が消費を満たすため、備蓄は目減りしません。');
    return;
  }

  const days = baseDays / netDrain;
  setText('sim-days', formatInt(days));

  if (maintainRate === 0 && savingRate === 0) {
    setText('sim-delta', '完全遮断の想定。トップのカウンター表示と同じ値です。');
  } else {
    const delta = days - baseDays;
    setText('sim-delta', `完全遮断より 約${formatInt(delta)}日 長くもちます。`);
  }
}

function setupControls() {
  const group = document.getElementById('sim-scenarios');
  const slider = document.getElementById('sim-saving');
  if (!group || !slider) return;

  const scenarios = Array.from(group.querySelectorAll('.sim-scenario'));

  function selectScenario(btn) {
    scenarios.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    maintainRate = Number.parseFloat(btn.dataset.maintain) || 0;
    render();
  }

  scenarios.forEach((btn) => {
    btn.addEventListener('click', () => selectScenario(btn));
  });

  // ラジオグループのキーボード操作（左右上下で移動＋選択）。
  group.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const idx = scenarios.indexOf(document.activeElement);
    if (idx < 0) return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = scenarios[(idx + dir + scenarios.length) % scenarios.length];
    next.focus();
    selectScenario(next);
  });

  slider.addEventListener('input', () => {
    savingRate = Number(slider.value) / 100;
    setText('sim-saving-value', `${slider.value}%`);
    render();
  });
}

onReady(async () => {
  setupControls();

  let history;
  try {
    // /simulator/ はサブディレクトリなのでルート相対でデータを取得する。
    history = await loadHistory('../data/snapshots.json');
  } catch {
    render();
    return;
  }

  // カウンターを初期化し、トップと同じ秒推計値を購読する（独自に再計算しない）。
  safeInit('simulator-counter', () => initCounter(history));
  subscribe((days) => {
    baseDays = days;
    render();
  });

  const latest = history[history.length - 1];
  if (latest && elapsedDaysSince(latest.asOf) > STALE_THRESHOLD_DAYS) {
    showElement('sim-stale-warning');
  }
});
