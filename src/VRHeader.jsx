/**
 * VRHeader — 5つのVRアプリ共通ヘッダーコンポーネント
 *
 * VR (Visualize Rule) stack 全体で共有:
 *   🪐 わっかずかん  (ring classification)
 *   📚 たなずかん    (tier × 軸 grid)
 *   🌀 バネットマップ (bird's-eye map)
 *   🔢 百ます       (NxN matchup matrix)
 *   🧙 VR Akinator  (method recommender)
 *
 * マスター: osakenpiro/claude-shared/components/VRHeader.jsx
 * 配布先:   各VRアプリリポの src/VRHeader.jsx へコピー
 *
 * 更新時の同期:
 *   cp claude-shared/components/VRHeader.jsx <app-repo>/src/VRHeader.jsx
 *   各アプリで npm run build && git push
 */

import React from 'react'

export const VR_APPS = [
  { id:'wakka',    url:'https://osakenpiro.github.io/wakkazukan/', emoji:'🪐', label:'わっか',   title:'わっかずかん' },
  { id:'tana',     url:'https://osakenpiro.github.io/tana-zukan/', emoji:'📚', label:'たな',     title:'たなずかん' },
  { id:'banet',    url:'https://osakenpiro.github.io/banet-map/',  emoji:'🌀', label:'バネット', title:'バネットマップ' },
  { id:'hyakumasu',url:'https://osakenpiro.github.io/hyakumasu/',  emoji:'🔢', label:'百ます',   title:'百ますグリッド' },
  { id:'akinator', url:'https://osakenpiro.github.io/vr-akinator/',emoji:'🧙', label:'魔神',     title:'VRアキネーター' },
]

/**
 * VRHeader
 *
 * Props:
 *   title        string | ReactNode   左の大見出し（例: "📚 たなずかん"）
 *   currentApp   VR_APPS[i].id        現アプリID（このIDのリンクは非表示）
 *   version      string               右端のバージョンバッジ（例: "v0.6"）。省略可
 *   centerSlot   ReactNode            タイトル右の自由スロット（データセット切替・軸切替・検索など）
 *   rightSlot    ReactNode            他アプリリンクの左側の自由スロット（CSV・設定などアプリ固有のアクション）
 *   compact      boolean              省スペース版（padding・フォント小さめ）
 *
 * 利用例:
 *   <VRHeader
 *     title="📚 たなずかん"
 *     currentApp="tana"
 *     version="v0.7"
 *     centerSlot={<><DatasetSwitcher/><AxisSwitcher/><Search/></>}
 *     rightSlot={<><button>📥 CSV</button><button>📤 CSV</button></>}
 *   />
 */
export default function VRHeader({
  title,
  currentApp,
  version,
  centerSlot,
  rightSlot,
  compact = false,
}) {
  const others = VR_APPS.filter(a => a.id !== currentApp)
  return (
    <header style={{
      padding: compact ? '6px 12px' : '10px 16px',
      borderBottom: '1px solid #1e2640',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: '#0b0f1a', position: 'sticky', top: 0, zIndex: 10,
      color: '#e4e8f0',
      fontFamily: "'Zen Kaku Gothic New','Noto Sans JP',system-ui,sans-serif",
    }}>
      <div style={{
        fontSize: compact ? 15 : 18,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}>{title}</div>

      {centerSlot}

      <div style={{
        display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        {rightSlot}

        <div style={{
          display: 'flex', gap: 2, padding: '2px 4px',
          background: '#0d1320', borderRadius: 10, border: '1px solid #1e2640',
        }}>
          {others.map(a => (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
              title={a.title}
              style={{
                color: '#8892b0', fontSize: 11, textDecoration: 'none',
                padding: '3px 7px', borderRadius: 6,
                display: 'inline-flex', alignItems: 'center', gap: 3,
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#1e2640'
                e.currentTarget.style.color = '#e4e8f0'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#8892b0'
              }}
            >
              <span style={{fontSize: 12}}>{a.emoji}</span>
              <span>{a.label}</span>
            </a>
          ))}
        </div>

        {version && (
          <span style={{
            fontSize: 10, padding: '3px 8px',
            background: '#ffd166', color: '#0b0f1a',
            borderRadius: 10, fontWeight: 700,
          }}>{version}</span>
        )}
      </div>
    </header>
  )
}
