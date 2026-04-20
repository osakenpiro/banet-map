/**
 * VRHeader v1.1 — 5つのVRアプリ共通ヘッダーコンポーネント
 *
 * VR (Visualize Rule) stack 全体で共有:
 *   🪐 わっかずかん  (ring classification)      - variant="floating"
 *   📚 たなずかん    (tier × 軸 grid)            - variant="sticky" (default)
 *   🌀 バネットマップ (bird's-eye map)           - variant="sticky"
 *   🔢 百ます       (NxN matchup matrix)        - variant="sticky"
 *   🧙 VR Akinator  (method recommender)        - variant="sticky"
 *
 * マスター: osakenpiro/claude-shared/components/VRHeader.jsx
 *
 * 更新時の同期:
 *   cp claude-shared/components/VRHeader.jsx <app-repo>/src/VRHeader.jsx
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
 *   title        string | ReactNode   左の大見出し（例: "📚 たなずかん"）。floatingでは省略可
 *   currentApp   VR_APPS[i].id        現アプリID（このIDのリンクは非表示）
 *   version      string               右端のバージョン/ステータスバッジ（例: "v0.6" | "β"）
 *   centerSlot   ReactNode            タイトル右の自由スロット
 *   rightSlot    ReactNode            他アプリリンク左の自由スロット
 *   compact      boolean              省スペース版（stickyで適用）
 *   variant      'sticky'|'floating'  配置モード。デフォルト 'sticky'
 *                                     floating: わっか用、右上absoluteの浮遊パネル（glassmorphism）
 */
export default function VRHeader({
  title,
  currentApp,
  version,
  centerSlot,
  rightSlot,
  compact = false,
  variant = 'sticky',
}) {
  const others = VR_APPS.filter(a => a.id !== currentApp)
  const floating = variant === 'floating'

  const containerStyle = floating ? {
    position: 'absolute', top: 8, right: 10, zIndex: 50,
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    padding: '6px 10px',
    background: 'rgba(10,22,40,0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    border: '1px solid #ffffff18',
    borderRadius: 12,
    color: '#e0e0e0',
    fontFamily: "'Noto Sans JP','Hiragino Sans',sans-serif",
    fontSize: 11,
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
  } : {
    padding: compact ? '6px 12px' : '10px 16px',
    borderBottom: '1px solid #1e2640',
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    background: '#0b0f1a', position: 'sticky', top: 0, zIndex: 10,
    color: '#e4e8f0',
    fontFamily: "'Zen Kaku Gothic New','Noto Sans JP',system-ui,sans-serif",
  }

  const titleSize = floating ? 13 : (compact ? 15 : 18)

  const rightGroupStyle = {
    display: 'flex',
    gap: floating ? 4 : 6,
    marginLeft: floating ? 0 : 'auto',
    alignItems: 'center',
    flexWrap: 'wrap',
  }

  const appLinksContainerStyle = floating ? {
    display: 'flex', gap: 3, alignItems: 'center',
  } : {
    display: 'flex', gap: 2, padding: '2px 4px',
    background: '#0d1320', borderRadius: 10, border: '1px solid #1e2640',
  }

  const baseAppLinkStyle = floating ? {
    color: '#ffffff88', fontSize: 11, textDecoration: 'none',
    padding: '3px 8px', borderRadius: 10,
    border: '1px solid #ffffff22',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  } : {
    color: '#8892b0', fontSize: 11, textDecoration: 'none',
    padding: '3px 7px', borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', gap: 3,
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
    background: 'transparent',
  }

  const versionStyle = floating ? {
    background: '#e9b44c22', border: '1px solid #e9b44c88',
    color: '#e9b44c', padding: '3px 8px', borderRadius: 10,
    fontWeight: 'bold', letterSpacing: '0.05em', fontSize: 10,
  } : {
    fontSize: 10, padding: '3px 8px',
    background: '#ffd166', color: '#0b0f1a',
    borderRadius: 10, fontWeight: 700,
  }

  const handleLinkEnter = (e) => {
    if (floating) {
      e.currentTarget.style.background = '#ffffff11'
      e.currentTarget.style.borderColor = '#ffffff66'
      e.currentTarget.style.color = '#ffffff'
    } else {
      e.currentTarget.style.background = '#1e2640'
      e.currentTarget.style.color = '#e4e8f0'
    }
  }
  const handleLinkLeave = (e) => {
    if (floating) {
      e.currentTarget.style.background = 'transparent'
      e.currentTarget.style.borderColor = '#ffffff22'
      e.currentTarget.style.color = '#ffffff88'
    } else {
      e.currentTarget.style.background = 'transparent'
      e.currentTarget.style.color = '#8892b0'
    }
  }

  const Wrapper = floating ? 'div' : 'header'

  return (
    <Wrapper style={containerStyle}>
      {title && (
        <div style={{fontSize: titleSize, fontWeight: 700, whiteSpace: 'nowrap'}}>{title}</div>
      )}

      {centerSlot}

      <div style={rightGroupStyle}>
        {rightSlot}

        <div style={appLinksContainerStyle}>
          {others.map(a => (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
              title={a.title}
              style={baseAppLinkStyle}
              onMouseEnter={handleLinkEnter}
              onMouseLeave={handleLinkLeave}
            >
              {floating
                ? `${a.emoji} ${a.label}`
                : <><span style={{fontSize: 12}}>{a.emoji}</span><span>{a.label}</span></>
              }
            </a>
          ))}
        </div>

        {version && <span style={versionStyle}>{version}</span>}
      </div>
    </Wrapper>
  )
}
