---
title: 旭野 テラ / ASAHINO TERRA
---

# 旭野 テラ / ASAHINO TERRA

AI人狼キャラクター「旭野テラ（ASAHINO TERRA）」のVRMモデルと、WebGLによるインタラクティブ・プレビューです。

![旭野テラ DAWN FIELD TERMINAL](artifacts/desktop-relaxed-final.png)

## Concept — DAWN FIELD TERMINAL / 太陽観測フィールド端末

旭野テラは太陽光を観測するソーラーテックのフィールド調査員であり、AI人狼の局面を冷静に解析するキャラクターです。本リポジトリは「DAWN FIELD TERMINAL（夜明けのフィールド端末）」をコンセプトに、明るい太陽光の映り込み、イオンシアンの流体エフェクト、そして全身を落ち着きで俯瞰するフレーミングで、観測データベースの生きた端末としてモデルを表示します。マウス・タッチでモデルを回転し、スクロールまたはピンチでズームできます。

## Local usage

開発サーバー:

```bash
npm install
npm run dev
```

プロダクションビルド:

```bash
npm run build
```

ビルド結果のプレビュー:

```bash
npm run preview
```

## Controls

5つの表示コントロールと、10本のAI人狼モーションを用意しています。

- **AUTO ORBIT** (`#rotate-button`) — 自動回転の ON / OFF
- **SOLAR / ANALYSIS LIGHT** (`#light-button`) — 太陽光モードと解析光モードの切替
- **FRAMING** (`#frame-button`) — FULL BODY と PORTRAIT の切替
- **RESET CAMERA** (`#reset-button`) — 全身フレーム・既定回転・カメラ位置のリセット
- **FULLSCREEN** (`#fullscreen-button`) — フルスクリーン表示の切替

モーションラボは `GAME / IDLE / TALK` の3カテゴリです。各モーションは再生・
一時停止・再開・シーク・停止に対応し、`Esc` でも停止できます。ページ読込後は
10本から同じ演技の連続を避けながらランダムに自動再生します。手動選択または停止で
自動再生を解除し、`RANDOM AUTO`から再開できます。

## Project structure

- `public/models/asahino-tera.vrm` — VRM 1.0 モデル
- `public/renders/{front,oblique,back}.png` — 参考用レンダー（ビューアには使用しない）
- `public/motions/*.vrma` — 夜凪ノア版で補正済みのAI人狼モーション10本
- `index.html` — エントリーページ（デザイン担当）
- `src/main.js` — Three.js / three-vrm ビューア
- `src/style.css` — ビジュアルデザイン（デザイン担当）
- `src/canvasui/LiquidVanilla.ts` — Canvas UI Liquid 流体エンジン
- `vite.config.js` — Vite 設定（GitHub Pages サブパス `/asahino-tera-vrm/`）
- `.github/workflows/pages.yml` — GitHub Pages デプロイ

## Technology

- [Vite](https://vite.dev/) 8.1.5 — ビルド・開発サーバー
- Vanilla TypeScript / JavaScript（フレームワーク非依存）
- [Three.js](https://threejs.org/) 0.185.1
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) 3.5.5
- [@pixiv/three-vrm-animation](https://github.com/pixiv/three-vrm) 3.5.5
- [Canvas UI](https://canvasui.dev/) — Liquid 流体エフェクト

### Motion system

通常待機時は spine / chest / head の微細な手続きモーションを使い、選択時は
`@pixiv/three-vrm-animation` で補正済みVRMAを旭野テラのリグへ適用します。
停止・ビューリセット時は正規化ポーズをリセットしてからテラの自然な立ち姿へ戻すため、
直前の演技姿勢は残りません。手続き待機は `prefers-reduced-motion` を尊重します。

サードパーティのライセンス表記は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にまとめています。

## Source and reference acknowledgment

- 流体エフェクトの `src/canvasui/LiquidVanilla.ts` は [Canvas UI](https://canvasui.dev/) の Liquid（Vanilla TypeScript）コンポーネントを取り込んで本サイト向けに最小限の調整を行ったものです。
- 本リポジトリは独立した新規制作です。`yonagi-noa-vrm` は読取専用の参考実装として扱い、
  同リポジトリの `public/motions/` にある補正済み10本のみを正式に再利用しています。
  `raw-ardy/` の未補正版は接続していません。

## Asset rights

VRMモデルデータ（`public/models/asahino-tera.vrm`）および参考レンダー（`public/renders/*.png`）は、旭野テラの権利者によって提供されたソース資産です。本リポジトリでの閲覧を目的としており、権利者の明示的な許可なくモデルデータを再配布・販売・再利用することはできません。
