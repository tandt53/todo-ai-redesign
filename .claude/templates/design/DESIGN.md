# Design System
<!-- Written by: design-agent. Read by: web-agent, mobile-agent, QA agents, reviewer-agent (C4). -->
<!-- Lives at: {design}/_shared/DESIGN.md -->
<!-- Keep under 100 lines — this is a reference, not a textbook. -->

## Identity
<!-- REQUIRED. Where this product's look comes from — see design-agent.md ## Craft. -->
<!-- 1. Subject material: what belongs to this product's world (objects, rituals, instruments)? -->
<!-- 2. Three directions considered (conservative / subject-grounded / experimental) and which won, why. -->
<!-- 3. The ONE place the novelty budget is spent. Everything else stays quiet. -->
[subject material] · [chosen direction + two rejects] · [the one bold move]

## Principles
<!-- 2-3 sentences on the visual philosophy. -->
[e.g. "Clean, spacious, content-first. Minimize chrome. Use color sparingly — only for actions and status."]

## Typography
| Role | Font | Size | Weight | Line height |
|------|------|------|--------|-------------|
| Heading 1 | [font] | [size] | 700 | 1.2 |
| Heading 2 | [font] | [size] | 600 | 1.3 |
| Body | [font] | [size] | 400 | 1.5 |
| Caption | [font] | [size] | 400 | 1.4 |
| Mono | [font] | [size] | 400 | 1.5 |

## Color
| Token | Value | Usage |
|-------|-------|-------|
| color.primary | [hex] | Primary actions, links |
| color.secondary | [hex] | Secondary actions |
| color.danger | [hex] | Destructive actions, errors |
| color.success | [hex] | Confirmations, success states |
| color.text.primary | [hex] | Body text |
| color.text.secondary | [hex] | Captions, placeholder text |
| color.bg.primary | [hex] | Page background |
| color.bg.secondary | [hex] | Card backgrounds, alternate rows |

All values live in `{design}/_shared/tokens.json`. Never hardcode — reviewer-agent C4 catches violations.

## Spacing scale
4px base: `spacing.1` = 4px, `spacing.2` = 8px, `spacing.3` = 12px, `spacing.4` = 16px, `spacing.6` = 24px, `spacing.8` = 32px

## Border radius
`radius.sm` = 4px (inputs), `radius.md` = 8px (cards), `radius.lg` = 12px (modals), `radius.full` = 9999px (pills/avatars)

## Shadows
`shadow.sm` = subtle lift (cards), `shadow.md` = modal/dropdown elevation

## Component inventory
See `{design}/_shared/components.md` for the full inventory with variants and states.

## Accessibility baseline
- Color contrast: WCAG AA minimum (4.5:1 for text, 3:1 for large text)
- Focus indicators: visible ring on all interactive elements
- Touch targets: ≥ 44×44px (web), ≥ 44pt (iOS), ≥ 48dp (Android)
- Motion: respect `prefers-reduced-motion`
