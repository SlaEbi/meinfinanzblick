# Design System: FinTech Plataforma Financeira

## 1. Definição do Estilo

- **Nome:** FinTech Plataforma Financeira
- **Tipo:** Premium, Dark, Trustworthy
- **Keywords:** fintech landing, finance dashboard, charts, security, gold and dark palette, premium, trust, transactions, cards, modern UI
- **Era:** 2020s FinTech
- **Light/Dark:** ✗ No / ✓ Full

## 2. Paleta de Cores

- **Primárias:** Gold #FFD700, Dark Grey #1A1A1A, Black #000000
- **Secundárias:** White #FFFFFF, Soft Gold #C9A84C, Charcoal #333333

## 3. Efeitos Visuais

Fundo escuro com detalhes em dourado, gráficos minimalistas em SVG, hover com glow sutil (box-shadow), animações de números incrementais, cards com sombra e borda suave.

## 4. AI Prompt Keywords

fintech landing, finance dashboard, charts, security, gold and dark palette, premium, trust, transactions, cards, modern UI.

## 5. CSS Technical

```css
background: #1A1A1A, color: #FFFFFF, box-shadow: 0 0 15px rgba(255,215,0,0.2), border-radius: 8px, font-family: 'Inter, sans-serif', @keyframes counter-increment, SVG chart elements, gold accent borders.
```

## 6. Design System Variables

```css
--gold: #FFD700, --dark-bg: #1A1A1A, --black: #000000, --white: #FFFFFF, --glow-gold: rgba(255,215,0,0.2), --font-fintech: 'Inter, sans-serif'.
```

## 7. Checklist de Implementação

- ☐ Navbar + Hero com números/benefícios
- ☐ Metrics + Security
- ☐ Testimonials + Pricing
- ☐ CTA 'Criar conta'
- ☐ Meta tags SEO
- ☐ Contraste texto/fundo escuro
- ☐ Animações de números
- ☐ Ícones SVG financeiros.

## 8. Visual Theme & Atmosphere

FinTech Plataforma Financeira — Design thematic com fintech landing, finance dashboard, charts. Template e prompt pronto para IA. Estilo FinTech Plataforma Financeira representa uma tendência moderna em design UI/UX web com foco em thematic.

- Density: 8/10 — Dense
- Variance: 4/10 — Moderate
- Motion: 4/10 — Subtle

## 9. Color Palette & Roles

- **Gold** (#FFD700) — Premium accent, decorative highlights
- **Dark Grey** (#1A1A1A) — Dark surface, primary background
- **Black** (#000000) — Dark surface, primary background
- **White** (#FFFFFF) — Secondary surface
- **Soft Gold** (#C9A84C) — Premium accent, decorative highlights
- **Charcoal** (#333333) — Deep contrast surface

## 10. Typography Rules

- **Display / Hero:** Inter — Weight 700, tight tracking, used for headline impact
- **Body:** Inter — Weight 400, 16px/1.6 line-height, max 72ch per line
- **UI Labels / Captions:** Inter — 0.875rem, weight 500, slight letter-spacing
- **Monospace:** JetBrains Mono — Used for code, metadata, and technical values

Scale:
- Hero: clamp(2.5rem, 5vw, 4rem)
- H1: 2.25rem
- H2: 1.5rem
- Body: 1rem / 1.6
- Small: 0.875rem

## 11. Component Stylings

- **Primary Button:** Rounded (8px) shape. Accent color fill. Hover: 8% darken + subtle lift shadow. Active: -1px translate tactile press. Font weight 600. No outer glows.
- **Secondary / Ghost Button:** Outline variant. 1.5px border in muted color. Text in primary color. Hover: subtle background fill.
- **Cards:** Rounded (8px) corners. Surface background. Subtle shadow (0 2px 12px rgba(0,0,0,0.06)). 1px border stroke.
- **Inputs:** Label above input. 1px border stroke. Focus ring: 2px accent color offset 2px. Error text below in semantic red. No floating labels.
- **Navigation:** Primary surface background. Active item: accent color indicator. Font weight 500 when active.
- **Skeletons:** Shimmer animation matching component dimensions. No circular spinners.
- **Empty States:** Icon-based composition with descriptive text and action button.

## 12. Layout Principles

- **Grid:** CSS Grid primary. Max-width containment: 1280px centered with 1.5rem side padding.
- **Spacing rhythm:** Balanced. Base unit: 0.5rem (8px).
- **Section vertical gaps:** clamp(4rem, 8vw, 8rem).
- **Hero layout:** Split-screen (text left, visual right).
- **Feature sections:** Zig-zag alternating text+image rows. No 3-equal-columns.
- **Mobile collapse:** All multi-column layouts collapse below 768px. No horizontal overflow.
- **z-index contract:** base (0) / sticky-nav (100) / overlay (200) / modal (300) / toast (500).

## 13. Motion & Interaction

- **Physics:** Ease-out curves, 200-300ms duration. Smooth and predictable.
- **Entry animations:** Fade + translate-Y (16px → 0) over 420ms ease-out. Staggered cascades for lists: 80ms between items.
- **Hover states:** Subtle color shift + shadow adjustment over 200ms.
- **Page transitions:** Fade only (200ms).
- **Performance:** Only transform and opacity animated. No layout-triggering properties.

## 14. Anti-Patterns (Banned)

- No emojis in UI — use icon system only (Lucide, Heroicons)
- No pure white (#FFFFFF) backgrounds — use off-white or dark surfaces
- No oversaturated accent colors (saturation cap: 80%)
- No 3-column equal-width feature layouts — use zig-zag or asymmetric grid
- No `h-screen` — use `min-h-[100dvh]`
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No broken external image links — use picsum.photos or inline SVG
- No generic lorem ipsum in demos

## Contexto Histórico

Estilo FinTech Plataforma Financeira representa uma tendência moderna em design UI/UX web com foco em thematic.

## Caso de Uso

Landing pages, Websites modernas
