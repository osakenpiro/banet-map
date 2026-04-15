# 🌀 Banet Map / バネットマップ

**Force-directed relation visualizer with Float weights and hypothesis edges.**
A VR v0.1 Level-1 viewer by [osakenpiro](https://github.com/osakenpiro).

> 🌐 https://osakenpiro.github.io/banet-map/

## なにそれ

**バネットマップ**は「関係」を見るための図鑑。
ノードはバネで繋がっていて、ドラッグで引っ張ると揺れて振動する。
関係の強さは Float (0..1)、関係の状態は `confirmed` / `hypothesis` / `refuted` の3段階。

**Obsidian graph view の Float 版**と思ってもらえばいい。

## 3つの新規性

1. **写真=節点** — 抽象円ではなく具体画像で認知負荷ゼロ
2. **バネ物理の表層化** — 張力・慣性・振動を情報として見せる
3. **仮説モード** — 実線=確定、点線=仮説、×=反証済み。edge クリックで evidence card

## VR v0.1 準拠

このアプリは [VR (Visualize Rule) v0.1](./spec/VR-v0.1.md) Level-1 viewer です。
同じ [VR データプロトコル](./spec/VR-v0.1.md#2-l0-data-protocol-v01-minimum-viable) を読む他のアプリ:

- 🪐 [わっかずかん](https://osakenpiro.github.io/wakkazukan/) — 分類ビューア (classification viewer)
- 🌀 バネットマップ (本アプリ) — 関係ビューア (relation viewer)

## 開発

```bash
npm install
npm run dev
```

## ライセンス

MIT (予定)

## 関連

- [osakenpiro/wakkazukan](https://github.com/osakenpiro/wakkazukan) — 姉妹アプリ
- [VR v0.1 仕様](./spec/VR-v0.1.md)
