/**
 * 現況ヘッドライン（右から左へ流れるティッカー）
 *
 * 全タブ共通。ヘッダー直下に置き、備蓄水準の「空気感」だけを言葉で伝える。
 * 備蓄日数そのものはカウンターの大きな数字で見せているため、ここでは
 * 数字を出さない。
 *
 * 判定は 充填率 = 公表値の日数 / PEAK_REFERENCE.days の 1 つの軸のみ。
 * 秒按分の値を購読すると文言が頻繁に入れ替わって読めなくなるため、
 * 公表値（snapshots.json の最新 total）で 1 回だけ評価して固定する。
 * しきい値は粗いので、秒按分後の値との差で判定が変わることはまずない。
 *
 * base.html がマークアップと本スクリプトを全ページに焼き込むため、ここでは
 * ページ側の呼び出しに頼らず、DOM の data-snapshots を読んで自走する。
 * サブディレクトリ差を吸収するためデータ URL は data-snapshots で受け取る。
 */

import { loadHistory, PEAK_REFERENCE } from '../core/data.js';
import { onReady } from '../core/dom.js';

/** 充填率のしきい値と、それに対応する現況コメント（高い順に評価する）。 */
const LEVELS = [
  {
    minRatio: 0.75,
    level: 'safe',
    text: '現在の備蓄水準は安全水域です。国際的な備蓄義務の水準を大きく上回っており、供給が止まった場合でも当面は落ち着いて対応できる余裕があります。',
  },
  {
    minRatio: 0.6,
    level: 'normal',
    text: '現在の備蓄水準は平常の範囲内です。ただちに生活や経済活動に影響が出る状況ではありません。',
  },
  {
    minRatio: 0.4,
    level: 'watch',
    text: '現在の備蓄水準はやや低下しています。直ちに不足する段階ではありませんが、今後の推移を注視したい局面です。',
  },
  {
    minRatio: 0,
    level: 'low',
    text: '現在の備蓄水準は低めです。輸入の停滞が続く場合の影響を見込んでおきたい局面です。',
  },
];

export function pickStatusMessage(days, peakDays = PEAK_REFERENCE.days) {
  if (!Number.isFinite(days) || !Number.isFinite(peakDays) || peakDays <= 0) return null;
  const ratio = days / peakDays;
  return LEVELS.find((entry) => ratio >= entry.minRatio) ?? LEVELS[LEVELS.length - 1];
}

/** history から現況を確定させて描画する（テスト可能な純粋寄りの本体）。 */
export function renderStatusTicker(history) {
  const track = document.getElementById('status-ticker-track');
  const textEl = document.getElementById('status-ticker-text');
  if (!track || !textEl) return;

  const latest = Array.isArray(history) && history.length > 0 ? history[history.length - 1] : null;
  const match = latest ? pickStatusMessage(Number(latest.total)) : null;
  if (!match) return;

  textEl.textContent = match.text;
  track.dataset.level = match.level;

  // 途切れずにループさせるため同じ文言をもう 1 つ並べる。
  // 複製は読み上げ・検索の重複になるので aria-hidden で隠す。
  const clone = textEl.cloneNode(true);
  clone.removeAttribute('id');
  clone.setAttribute('aria-hidden', 'true');
  track.appendChild(clone);
  track.classList.add('is-scrolling');
}

/** 全ページ共通の自走初期化。data-snapshots からデータ URL を得て取得する。 */
async function initStatusTicker() {
  const ticker = document.querySelector('.status-ticker');
  if (!ticker) return;
  // data-snapshots が無ければ loadHistory の既定に委ねる（ホーム相当）。
  const url = ticker.dataset.snapshots || undefined;
  try {
    renderStatusTicker(await loadHistory(url));
  } catch {
    // 取得できなければ初期文言「判定しています」のまま静かに留める（推測しない）。
  }
}

onReady(initStatusTicker);
