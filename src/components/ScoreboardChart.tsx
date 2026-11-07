import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useReducedMotion } from 'motion/react'

const ranges = ['1D', '1W', '1M', '3M', 'YTD', 'ALL']

type ScoreboardChartProps = {
  range: string
  onRangeChange: (range: string) => void
}

export function ScoreboardChart({ range, onRangeChange }: ScoreboardChartProps) {
  const lineRef = useRef<SVGPathElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const line = lineRef.current
    if (!line) return
    const length = line.getTotalLength()
    gsap.set(line, { strokeDasharray: length, strokeDashoffset: reducedMotion ? 0 : length })
    if (reducedMotion) return
    const tween = gsap.to(line, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out', delay: 0.2 })
    return () => { tween.kill() }
  }, [reducedMotion])

  return (
    <section className="panel chart-panel" aria-labelledby="chart-heading">
      <div className="panel-heading panel-heading--chart">
        <div className="panel-title-wrap">
          <span className="eyebrow">THE MARKET BOARD <span className="eyebrow-dot" /></span>
          <h2 className="panel-title" id="chart-heading">Account performance</h2>
        </div>
        <div className="range-control" role="group" aria-label="Chart time range">
          {ranges.map((item) => (
            <button key={item} className={`range-button${range === item ? ' is-selected' : ''}`} type="button" aria-pressed={range === item} onClick={() => onRangeChange(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-legend"><span className="legend-key" />Illustrative equity index <span className="sample-tag">SAMPLE</span></div>
      <div className="chart-scroll">
        <svg className="performance-chart" viewBox="0 0 780 280" role="img" aria-labelledby="chart-title chart-desc" preserveAspectRatio="none">
          <title id="chart-title">Illustrative account performance chart</title>
          <desc id="chart-desc">A sample-only line with mild fluctuations. It is not connected to an account and does not represent actual trading results.</desc>
          <defs>
            <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--blue-500)" stopOpacity=".18" />
              <stop offset="100%" stopColor="var(--blue-500)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="chart-grid">
            <path d="M54 24H770M54 76H770M54 128H770M54 180H770M54 232H770" />
            <path d="M54 24V232M197 24V232M340 24V232M483 24V232M626 24V232M770 24V232" className="chart-grid-vertical" />
          </g>
          <g className="chart-axis-labels">
            <text x="0" y="28">100</text><text x="0" y="80">75</text><text x="0" y="132">50</text><text x="0" y="184">25</text><text x="0" y="236">0</text>
            <text x="54" y="264">MON</text><text x="197" y="264">TUE</text><text x="340" y="264">WED</text><text x="483" y="264">THU</text><text x="626" y="264">FRI</text><text x="747" y="264">NOW</text>
          </g>
          <path className="chart-area" d="M54 183 C87 171 101 155 128 165 S174 158 197 144 S239 155 270 133 S309 143 340 115 S380 127 411 106 S450 117 483 88 S523 103 554 76 S595 94 626 65 S668 81 698 54 S739 68 770 42 L770 232 L54 232Z" />
          <path ref={lineRef} className="chart-line" d="M54 183 C87 171 101 155 128 165 S174 158 197 144 S239 155 270 133 S309 143 340 115 S380 127 411 106 S450 117 483 88 S523 103 554 76 S595 94 626 65 S668 81 698 54 S739 68 770 42" />
          <circle className="chart-endpoint-halo" cx="770" cy="42" r="9" />
          <circle className="chart-endpoint" cx="770" cy="42" r="4" />
        </svg>
      </div>
      <p className="panel-footnote">Illustrative interface data only · no live or historical account feed is connected.</p>
    </section>
  )
}
