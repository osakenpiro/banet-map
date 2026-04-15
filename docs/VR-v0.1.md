# VR v0.1 — Visualize Rule / Visionium Rule

**Status**: Draft v0.1 · 2026-04-15  
**Author**: osakenpiro (Kenshiro Osada)  
**Purpose of this doc**: バネずかん/わっかずかんが依拠する最小共通プロトコルを言語化する。実装は含めない。v0.1 は **バネずかん MVP を動かすのに必要な最小セット**。

---

## 0. 一行定義

> **VR = 「データの切り取り方を自分で増やせる」基盤。共通のデータプロトコル + ドリルダウン規則。**

Boolean→Float の二重化の、分類軸側の表現。個々の判断を連続値にするだけでなく、**分類の角度そのもの**を連続的に切り替えられる器。

---

## 1. 階層 (Layers)

```
L0: Data Protocol          ← JSON スキーマ (このドキュメント)
L1: Viewer Apps            ← 単独で起動できるアプリ
    🪐 わっかずかん (classification viewer)
    🌀 バネずかん    (relation viewer)
    🗺️ ちずずかん    (future: 2.5D map)
    📜 ねんぴょうずかん (future: timeline)
L2: Chart Formats          ← L1に埋め込まれる描画部品
    💧 ながれずかん / 📊 ぼうずかん / 🥧 まるずかん
    📈 おれせんずかん / 🎯 ちらばりずかん
```

**L1 は L0 を読む**。**L2 は L1 の中でドリルダウン時に呼ばれる**。L1 同士は L0 を介してデータを共有できる (同じ dataset を別角度で見る)。

---

## 2. L0 Data Protocol v0.1 (minimum viable)

### 2.1 全体構造

```json
{
  "meta": {
    "id": "ikimono-20",
    "title": "いきもの20キャラ",
    "version": "0.1",
    "author": "osakenpiro"
  },
  "nodes": [ ... ],
  "relations": [ ... ],
  "axes": [ ... ]
}
```

### 2.2 Node (必須)

```json
{
  "id": "kin-sakchan",
  "name": "サッちゃん",
  "icon": "🫁",              // emoji fallback
  "image": "images/sakchan.png",  // optional, preferred for バネずかん
  "attrs": {
    "species": "乳酸菌",
    "volume": 1,
    "color": "#06d6a0"
  }
}
```

- `id` は dataset 内で unique
- `attrs` は自由辞書。L1 アプリが attribute axis として使える
- `image` があれば L1 はそれを優先、なければ `icon` (emoji) にフォールバック

### 2.3 Relation (バネずかん専用、わっかずかんは無視してよい)

```json
{
  "id": "r-001",
  "source": "kin-sakchan",
  "target": "kusaki-midori",
  "kind": "symbiosis",       // 関係の種類 (任意ラベル)
  "weight": 0.8,             // バネの強さ 0..1 (Float)
  "status": "confirmed",     // confirmed | hypothesis | refuted
  "evidence": "巻2 p.34"     // optional, drill-down で表示
}
```

- `weight` は Float (Boolean→Float 原則)
- `status` は 3 値列挙 → バネずかんの「仮説モード」で見た目が変わる
  - `confirmed` → 実線
  - `hypothesis` → 点線
  - `refuted` → × 印

### 2.4 Axis (わっかずかん専用、バネずかんは無視してよい)

```json
{
  "id": "by-volume",
  "title": "巻で分ける",
  "group": (node) => node.attrs.volume
}
```

わっかずかんの L1 は node を attribute で group 化してリング化する。実装では関数ではなく attribute path 指定にする (例: `"groupBy": "attrs.volume"`)。

---

## 3. L1 Viewer Contract

L1 アプリは以下を満たす:

1. **読む**: VR v0.1 の JSON をロードできる
2. **無視できる**: 自分に関係ないフィールドは無視する (例: わっかずかんは `relations` を無視、バネずかんは `axes` を無視)
3. **ドリルダウン点を持つ**: クリック or hover で Level 2 Format に展開できる箇所を最低 1 つ以上提供する
4. **フィードバック導線**: βバナーで外部へリンクする

### L1 の最小 UI 要件

| 要素 | わっかずかん | バネずかん |
|---|---|---|
| 主表示 | リング入れ子 | 力学ネットワーク |
| 主インタラクション | ズーム/軸切替 | ドラッグ/関係クリック |
| ドリルダウン | リング → 葉カード | ノード → 詳細カード / エッジ → evidence カード |
| L2 呼び出し | 現状なし (v0.2 で追加) | v0.2 で ながれずかん を edge から展開 |

---

## 4. L2 Format Contract

L2 は **単体で起動しない**。L1 から呼ばれる描画部品。v0.1 では L2 の内部仕様は定義しない (バネずかん MVP に L2 は不要)。

将来的な契約の予定:
- 入力: `{ nodes[], values[], options }` の標準形
- 出力: 単一 SVG or Canvas 要素
- ホスト: L1 アプリの modal or inline panel

---

## 5. Drill-down 規則 (v0.1 の原則のみ)

- **常に 1 方向**: overview → detail → (optional) evidence
- **戻れる**: breadcrumb or ESC で必ず前階層に戻れる
- **context を失わない**: ドリルダウン中も親階層の位置情報は視覚的に残す (わっかずかんのリング/バネずかんの背景ノードを薄く表示)

---

## 6. 命名と色の共通化 (任意、v0.1 は強制しない)

- 色: Tailwind-like palette (#06d6a0 teal / #ffd166 yellow / #ef476f red / #118ab2 blue / #8338ec purple)
- 余白: 8px grid
- フォント: Zen Kaku Gothic New (UI) / Noto Serif JP (見出し)

v0.2 で強制化候補。

---

## 7. v0.1 の範囲外 (v0.2 以降)

- L1 同士のリアルタイム連動 (同じ node を両方でハイライト)
- L2 Format の標準化
- データ提供 API (現状は静的 JSON のみ)
- 複数 dataset の合成
- 編集 UI (現状は JSON 手書き)
- VR 認証マーク (どの L1/L2 が v0.1 準拠かの表示)
- **Obsidian 連携** (§7.5 参照)

## 7.5 Obsidian 連携 (v0.2 最有力候補)

### 背景
Obsidian のグラフビューは実装的には force-directed で、バネずかんと同種。ただし Obsidian は vault 内 `[[wikilink]]` 一種類しか扱えず、relation の `kind` / `weight` / `status` を持たない。つまり **バネずかんは Obsidian graph の Float 版** と位置付けられる。

### 連携の3経路

1. **Obsidian → VR (exporter)** — vault の frontmatter + wikilinks を VR v0.1 JSON に変換
2. **VR → Obsidian (importer)** — VR JSON を vault 構造に展開 (1 node = 1 ノート)
3. **双方向 sync** — 編集を両側で保持 (v0.3 以降の妄想)

### v0.1 で先回りしておくこと

- `node.attrs` に予約フィールド `obsidian_path` (optional, string) を認める
- `relation.kind` を自由文字列のままにしておく (Obsidian frontmatter `links:` の任意ラベルに対応できる)
- `meta.source` に `"obsidian-vault"` / `"hand-written"` / `"generated"` を入れられるようにする

### 差別化の価値
- Paper 10 の引用ポイント (PKM 文脈、学術界で Obsidian は広く使われてる)
- ケンシロウの思想ノート蓄積が vault にあるなら、exporter 一本で即座にバネずかん化できる
- Cowork 側の Obsidian 可視化作業が VR L0 経由で還流できる

---

## 8. バネずかん MVP が v0.1 のどこに依拠するか

| MVP 要件 | 依拠する節 |
|---|---|
| ノード = 画像 or emoji | §2.2 `image` + `icon` |
| バネ = 関係、強さ Float | §2.3 `weight` |
| 仮説モード (実線/点線/×) | §2.3 `status` |
| ドラッグで動かせる | §3 L1 最小UI |
| クリックで詳細カード | §5 Drill-down |
| エッジクリックで evidence | §5 Drill-down |

→ **v0.1 で足りる**。バネずかん MVP は VR v0.1 準拠で作る。

---

## 9. Open Questions (次セッション以降で決める)

1. `attrs` の標準キー (name/volume/color はほぼ毎回出てくるので "reserved" にするか自由にするか)
2. `relations.kind` のラベル系を列挙型にするか自由文字列にするか
3. JSON の命名: camelCase vs snake_case (現状混在。v0.2 で統一)
4. L1 間で node を同期ハイライトする場合の id 衝突回避 (namespace?)
5. VR 認証マークを出すなら、最小 compliance test をどう書くか

---

## 10. 一言

> 「世の中のデータ洪水に対して、その日の目的と気分でバイキングできる器を自分で育てていく」

VR v0.1 はその器の**お椀の形**。まずは2人前 (わっかずかん + バネずかん) を盛れるお椀から始める。

---

*End of VR v0.1*
