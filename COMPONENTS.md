# bonkersUI — Components

A library of extreme, physics-based, animated React + TypeScript components. All components are fluid (container-driven) and respect `prefers-reduced-motion`.

---

## AuroraContact

A self-contained dark contact section: frosted glass panel, floating-label form, submit → "Sent" success morph, a contact strip and social icons. Pointer parallax tilt + idle bob respond to `floatIntensity` and are disabled under reduced motion.

```tsx
import { AuroraContact } from "bonkersui";

<AuroraContact
  heading="Let’s Build Something Bright"
  onSubmit={(values) => console.log(values)}
/>;
```

### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `heading` | `string` | `"Let’s Build Something Bright"` | Main heading text. |
| `subheading` | `string` | `"Share your idea…"` | Supporting sub-heading. |
| `formFields` | `AuroraContactField[]` | name / email / message | Fields missing `name`/`label` are skipped. |
| `contactStrip` | `AuroraContactItem[]` | email / phone / location | Chips below the panel. |
| `socialIcons` | `AuroraSocialItem[]` | X / LinkedIn / GitHub / Dribbble | Social links. |
| `glassBlur` | `number` | `18` | Backdrop blur (px) of the glass panel. |
| `floatIntensity` | `number` | `0.5` | Parallax/bob intensity, 0–1. 0 disables. |
| `buttonGradient` | `string` | violet→teal gradient | Submit button background. |
| `onSubmit` | `(values: Record<string,string>) => void` | — | Called on a valid submit. |
| `onChange` | `(name: string, value: string) => void` | — | Called on each field change. |
| `successResetMs` | `number` | `1900` | How long "Sent" stays before reset. |
| `maxWidth` | `number` | `560` | Max width (px) of the glass panel. |
| `style` / `className` | `CSSProperties` / `string` | — | Applied to the outer `<section>`. |

---

## BookFeatures

A hardcover "book" that pages through feature spreads with a 3D page-turn, a cover-open reveal, a sliding bookmark and optional drag-to-turn. Built at a fixed 920×560 and uniformly `transform: scale()`-d down to the measured width.

```tsx
import { BookFeatures } from "bonkersui";

<BookFeatures maxWidth={920} onIndexChange={(i) => console.log(i)} />;
```

### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `features` | `BookFeatureItem[]` | 3 sample spreads | Illustration + title + copy per spread. |
| `coverStyle` | `BookCoverStyle` | black / "Product Features" | Cover color + title. |
| `pageTexture` | `"Cream" \| "White" \| "Aged"` | `"Cream"` | Paper texture. |
| `dragToTurn` | `boolean` | `true` | Right-edge drag-to-turn affordance. |
| `bookmark` | `boolean` | `true` | Sliding ribbon bookmark. |
| `serifFont` | `BookFontConfig` | — | Font config for cover/title/copy. |
| `turnSpeed` | `number` | `0.8` | Page-turn duration (s), clamped 0.4–1.2. |
| `curlShadow` | `number` | `0.5` | Curl/gutter shadow strength, 0–1. |
| `openOnLoad` | `boolean` | `true` | Play the cover-open on mount. |
| `maxWidth` | `number` | `920` | Max book width (px) at full scale. |
| `index` | `number` | — | Controlled current spread. |
| `defaultIndex` | `number` | `0` | Uncontrolled initial spread. |
| `onIndexChange` | `(index: number) => void` | — | Fires when the settled spread changes. |
| `style` / `className` | `CSSProperties` / `string` | — | Applied to the outer wrapper. |

---

## Footer

A responsive dark footer: brand column, newsletter form, link columns, social icons, legal row, locale button, and an oversized background wordmark that reveals (translate + fade) on scroll. Layout uses container queries.

```tsx
import { Footer } from "bonkersui";

<Footer wordmark="NEBULA" onNewsletterSubmit={(email) => console.log(email)} />;
```

### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `wordmark` | `string` | `"NEBULA"` | Brand wordmark (and big background wordmark). |
| `tagline` | `string` | sample tagline | Brand tagline paragraph. |
| `showNewsletter` | `boolean` | `true` | Show the newsletter form. |
| `newsletterLabel` | `string` | `"Stay in the loop"` | Newsletter label. |
| `newsletterPlaceholder` | `string` | `"you@company.com"` | Input placeholder. |
| `newsletterAction` | `string` | — | Form action; navigated to on valid submit. |
| `linkColumns` | `FooterLinkColumn[]` | Product / Company / Resources | Link columns. |
| `socials` | `FooterSocialItem[]` | X / IG / LinkedIn / GitHub / YouTube | Social links. |
| `legalLinks` | `FooterLinkItem[]` | Privacy / Terms / Cookies | Bottom legal links. |
| `copyright` | `string` | `"© 2025 Nebula Labs, Inc."` | Copyright line. |
| `showLocale` | `boolean` | `true` | Show the locale button. |
| `localeLabel` | `string` | `"English (US)"` | Locale button label. |
| `showBigWordmark` | `boolean` | `true` | Show the oversized wordmark. |
| `wordmarkReveal` | `boolean` | `true` | Animate the big wordmark on scroll. |
| `accentColor` | `string` | `"#4D8DFF"` | Accent (dot, button, focus). |
| `backgroundColor` | `string` | `"#08090C"` | Footer background. |
| `textColor` | `string` | `"#FFFFFF"` | Primary text color. |
| `onNewsletterSubmit` | `(email: string) => void` | — | Called with the email on submit. |
| `onLocaleClick` | `() => void` | — | Called when the locale button is clicked. |
| `style` / `className` | `CSSProperties` / `string` | — | Applied to the outer `<footer>`. |

---

## LiquidCTA

A CTA section whose button fills with animated liquid on hover: wave meniscus, rising bubbles, a damped slosh wobble and a click droplet burst — all on one `requestAnimationFrame` loop. Reduced motion collapses to an instant fill.

```tsx
import { LiquidCTA } from "bonkersui";

<LiquidCTA ctaLabel="Get started" fillDirection="up" onClick={() => {}} />;
```

### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `headline` | `string` | `"Dive right in"` | Headline (an accent dot is appended). |
| `subtext` | `string` | sample sub-text | Supporting sub-text. |
| `ctaLabel` | `string` | `"Get started"` | Button label. |
| `liquidColor` | `string` | `"#22D3EE"` | Primary liquid color. |
| `fillDirection` | `"up" \| "down" \| "left" \| "right"` | `"up"` | Hover fill direction. |
| `bubbles` | `boolean` | `true` | Rising bubbles (vertical fills). |
| `sloshOnHover` | `boolean` | `true` | Damped slosh wobble on hover. |
| `burstOnClick` | `boolean` | `true` | Droplet burst on click. |
| `glassOutline` | `boolean` | `true` | Frosted glass outline. |
| `accentColor` | `string` | `"#06B6D4"` | Accent (gradient, glow, droplets). |
| `sectionBackground` | `string` | `"#FFFFFF"` | Section background. |
| `headlineColor` | `string` | `"#000000"` | Headline color. |
| `subtextColor` | `string` | `"#666666"` | Sub-text color. |
| `buttonTextRestColor` | `string` | `"#000000"` | Label color when fill is low. |
| `buttonTextFilledColor` | `string` | `"#FFFFFF"` | Label color once fill passes ~82%. |
| `sectionMaxWidth` | `number` | `980` | Max content width (px). |
| `sectionPadding` | `string` | `"72px 24px 88px 24px"` | Section padding (desktop). |
| `buttonWidth` | `number` | `360` | Button width (px) at desktop. |
| `buttonHeight` | `number` | `76` | Button height (px) at desktop. |
| `buttonRadius` | `string \| number` | `"999px"` | Button border radius. |
| `headlineFont` / `subtextFont` / `buttonFont` | `LiquidCTAFontConfig` | sensible defaults | Per-slot font config. |
| `onClick` | `() => void` | — | Activation callback. |
| `disabled` | `boolean` | `false` | Disable the button. |
| `style` / `className` | `CSSProperties` / `string` | — | Applied to the outer `<section>`. |

---

## LiquidNav

A sticky glass nav bar with a liquid pill indicator that springs between the hovered/active item and stretches with travel speed. Contracts on scroll; collapses to a hamburger + dropdown on phones. Sizing is driven by the measured container width.

```tsx
import { LiquidNav } from "bonkersui";

<LiquidNav
  logoText="Aurora"
  onActiveIndexChange={(i, item) => console.log(i, item.label)}
/>;
```

### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `menuItems` | `LiquidNavMenuItem[]` | Home / Features / Pricing / About | Menu items. |
| `logo` | `LiquidNavLogo` | sample image | Logo image (`src`/`srcSet`/`alt`). |
| `logoText` | `string` | `"Aurora"` | Brand text when no logo image. |
| `ctaLabel` | `string` | `"Get Started"` | CTA label. |
| `ctaLink` | `string` | `"/"` | CTA link. |
| `indicatorColor` | `string` | `"#C8D2DE"` | Liquid pill color. |
| `barBackground` | `string` | `"rgba(10,12,16,0.55)"` | Bar background. |
| `blurIntensity` | `number` | `16` | Backdrop blur (px). |
| `contractOnScroll` | `boolean` | `true` | Contract the bar on scroll. |
| `morphStiffness` | `number` | `180` | Indicator snappiness / stretch amount. |
| `textColor` | `string` | `"#FFFFFF"` | Primary text color. |
| `logoFont` / `menuFont` / `ctaFont` | `LiquidNavFontConfig` | — | Per-slot font config. |
| `activeIndex` | `number` | — | Controlled active index. |
| `defaultActiveIndex` | `number` | `0` | Uncontrolled initial active index. |
| `onActiveIndexChange` | `(index, item) => void` | — | Fires on active change. |
| `renderLink` | `(href, children, props) => ReactNode` | `<a>` | Custom link renderer (e.g. router Link). |
| `style` / `className` | `CSSProperties` / `string` | — | Applied to the outer wrapper. |

---

## PolaroidGallery

A scattered, seeded polaroid wall with handwritten captions, idle sway, hover lift/straighten + dimming of the others, and an optional lightbox. Layout derives from the measured container width.

```tsx
import { PolaroidGallery } from "bonkersui";

<PolaroidGallery
  photos={[{ src: "/a.jpg", caption: "Summer '22" }]}
  onPhotoOpen={(i) => console.log(i)}
/>;
```

### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `photos` | `PolaroidPhoto[]` | 5 sample photos | Photos to scatter. |
| `rotationRange` | `number` | `12` | Max absolute rotation (deg). |
| `scatterDensity` | `number` | `1` | Scatter spread multiplier (0.5–2). |
| `captionFont` | `string` | `"Caveat"` | Google-font for captions. |
| `hoverStraighten` | `boolean` | `true` | Straighten to 0° on hover. |
| `lightboxOnClick` | `boolean` | `true` | Open a fullscreen lightbox on click. |
| `polaroidWidth` | `number` | `200` | Base polaroid width (px) at desktop. |
| `onPhotoOpen` | `(index: number) => void` | — | Fires when a lightbox opens. |
| `onLightboxClose` | `() => void` | — | Fires when the lightbox closes. |
| `style` / `className` | `CSSProperties` / `string` | — | Applied to the outer wrapper. |
