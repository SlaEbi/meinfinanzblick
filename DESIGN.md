# Design System: Sumi-e Tech Scroll

## 1. Definição do Estilo

- **Nome:** Sumi-e Tech Scroll
- **Tipo:** Cultural, Artistic, Fused
- **Keywords:** sumi-e, ink, asian, traditional, landscape, tech, isometric, red accent
- **Era:** Traditional/Modern Fusion
- **Light/Dark:** ✓ Full / ✗ No

## 2. Paleta de Cores

- **Primárias:** Background #F4F1E8, Text #0D0D0D, Accent #8A1C15
- **Secundárias:** Ink Black #000000, Wash Grey #808080, Paper Cream #F4F1E8

## 3. Efeitos Visuais

Traditional ink wash landscapes mixed with modern isometric technical diagrams, aged rice paper grain, ink bleed.

## 4. AI Prompt Keywords

sumi-e style landing, ink wash painting, rice paper texture, red seal accent, isometric tech details, east asian aesthetic.

## 5. CSS Technical

```css
background-color: #F4F1E8; color: #0D0D0D; font-family: 'Noto Serif JP', serif; background-image: url('https://www.transparenttextures.com/patterns/rice-paper.png'); border-left: 5px solid #8A1C15;
```

## 6. Design System Variables

```css
--rice-paper: #F4F1E8, --ink-black: #0D0D0D, --seal-red: #8A1C15, --font-serif: 'Noto Serif JP', serif, --ink-wash: rgba(0,0,0,0.1)
```

## 7. Checklist de Implementação

- ☐ Rice paper texture background
- ☐ Ink wash (sumi-e) visual elements
- ☐ Red stamp/seal accents
- ☐ Isometric/Tech overlays on traditional art
- ☐ Brush stroke borders

## 8. Visual Theme & Atmosphere

Sumi-e Tech Scroll — Design artistic com sumi-e, ink, asian. Template e prompt pronto para IA. Estilo Sumi-e Tech Scroll representa uma tendência moderna em design UI/UX web com foco em artistic.

- Density: 5/10 — Balanced
- Variance: 8/10 — Expressive
- Motion: 4/10 — Subtle

## 9. Color Palette & Roles

- **Background** (#F4F1E8) — Primary background surface
- **Text** (#0D0D0D) — Primary text color
- **Accent** (#8A1C15) — Primary accent, CTAs and interactive elements
- **Ink Black** (#000000) — Deep contrast surface
- **Wash Grey** (#808080) — Secondary text, borders, muted elements
- **Paper Cream** (#F4F1E8) — Secondary surface

## 10. Typography Rules

- **Display / Hero:** Noto Serif JP — Weight 700, tight tracking, used for headline impact
- **Body:** Noto Serif JP — Weight 400, 16px/1.6 line-height, max 72ch per line
- **UI Labels / Captions:** Noto Serif JP — 0.875rem, weight 500, slight letter-spacing
- **Monospace:** JetBrains Mono — Used for code, metadata, and technical values

Scale:
- Hero: clamp(2.5rem, 5vw, 4rem)
- H1: 2.25rem
- H2: 1.5rem
- Body: 1rem / 1.6
- Small: 0.875rem

## 11. Component Stylings

- **Primary Button:** Subtly rounded (0.5rem) shape. Accent color fill. Hover: 8% darken + subtle lift shadow. Active: -1px translate tactile press. Font weight 600. No outer glows.
- **Secondary / Ghost Button:** Outline variant. 1.5px border in muted color. Text in primary color. Hover: subtle background fill.
- **Cards:** Subtly rounded (0.5rem) corners. Surface background. Subtle shadow (0 2px 12px rgba(0,0,0,0.06)). 1px border stroke.
- **Inputs:** Label above input. 1px border stroke. Focus ring: 2px accent color offset 2px. Error text below in semantic red. No floating labels.
- **Navigation:** Primary surface background. Active item: accent color indicator. Font weight 500 when active.
- **Skeletons:** Shimmer animation matching component dimensions. No circular spinners.
- **Empty States:** Icon-based composition with descriptive text and action button.

## 12. Layout Principles

- **Grid:** CSS Grid primary. Max-width containment: 1280px centered with 1.5rem side padding.
- **Spacing rhythm:** Balanced. Base unit: 0.5rem (8px).
- **Section vertical gaps:** clamp(4rem, 8vw, 8rem).
- **Hero layout:** Asymmetric composition.
- **Feature sections:** Asymmetric grid with varied card sizes. No 3-equal-columns.
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
- No pure black (#000000) — use off-black or charcoal variants
- No oversaturated accent colors (saturation cap: 80%)
- No 3-column equal-width feature layouts — use zig-zag or asymmetric grid
- No `h-screen` — use `min-h-[100dvh]`
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No broken external image links — use picsum.photos or inline SVG
- No generic lorem ipsum in demos

## Contexto Histórico

Estilo Sumi-e Tech Scroll representa uma tendência moderna em design UI/UX web com foco em artistic.

## Caso de Uso

Landing pages, Websites modernas
