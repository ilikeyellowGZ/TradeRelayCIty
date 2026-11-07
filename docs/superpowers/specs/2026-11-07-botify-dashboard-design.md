# Botify Dashboard Frontend Design

## Goal

Create the first responsive, presentational Botify trading dashboard in the empty repository. It is an interface preview only: no authentication, broker connectivity, persistence, strategy evaluation, order management, or live account data.

## Direction

Use the supplied candlestick-in-a-C mark as inspiration for an original Botify emblem, and carry the sports scoreboard visual language into the shell: navy navigation, Barlow Condensed headings, strong score bands and disciplined alignment. Use a fresher palette than the older muted reference values: electric blue, vivid red and warm cream. Keep core data surfaces calm and legible. No MLB marks or affiliation claims.

## Screen and content

- Responsive application shell with desktop sidebar, tablet/mobile drawer and top account bar.
- Overview dashboard with an explicit visual-preview notice and sample labels.
- Account mode and connection preview state; show DEMO separately from connection status.
- Three illustrative metrics, account performance chart, strategy preview/status, positions table and recent activity.
- Sidebar destinations for Overview, Accounts, Bots & Strategies, Positions, Trade History, Backtests, Risk Settings and Notifications. Non-overview destinations clearly explain that this preview contains no connected application logic.
- Any action requiring a backend remains disabled with a reason. Local-only presentation controls such as navigation and chart range selection may respond.

## Responsive and accessibility requirements

- Reflow at 320, 640, 1024 and 1440 CSS px; no page-wide horizontal overflow.
- Tables scroll within their own region.
- Semantic landmarks, headings, table headers, accessible names, keyboard focus, focus return after drawer close, reduced-motion support and explicit labels for sample data.

## Implementation choices

- React, TypeScript and Vite.
- `motion` (Motion for React, formerly Framer Motion) for interface transitions.
- GSAP for a single decorative chart line reveal.
- Lucide icons; original Botify vector emblem.
- No API client, secrets, user credentials or backend actions.

## Visual acceptance

- The product reads as a polished trading terminal with a distinctive sports identity, not as a copy of MLB branding.
- Sample numbers cannot be mistaken for verified live performance.
- Blue and red are distinct brand accents; semantic positive/negative colors remain separate.
- Mobile navigation and dashboard panels stay usable without clipped controls.
- Reduced-motion preference shows the same information without nonessential animation.
