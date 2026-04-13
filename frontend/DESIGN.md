# DeepSub Design System

## 1. Typography
- **Primary Font**: INTER
- **Headline Font**: INTER
- **Body Font**: INTER
- **Label Font**: INTER

## 2. Shapes
- **Roundness**: ROUND_FOUR

## 3. Color Palette (Light Mode)

### Base & Surface
- **background**: `#f9f9f9`
- **on_background**: `#2d3435`
- **surface**: `#f9f9f9`
- **on_surface**: `#2d3435`
- **surface_variant**: `#dde4e5`
- **on_surface_variant**: `#5a6061`
- **inverse_surface**: `#0c0f0f`
- **inverse_on_surface**: `#9c9d9d`
- **surface_container_lowest**: `#ffffff`
- **surface_container_low**: `#f2f4f4`
- **surface_container**: `#ebeeef`
- **surface_container_high**: `#e4e9ea`
- **surface_container_highest**: `#dde4e5`

### Primary
- **primary**: `#004ced` (Override: `#a600ff`)
- **on_primary**: `#f8f7ff`
- **primary_container**: `#dde1ff`
- **on_primary_container**: `#0041d0`
- **primary_dim**: `#0042d1`

### Secondary
- **secondary**: `#605f5f` (Override: `#262626`)
- **on_secondary**: `#fbf8f8`
- **secondary_container**: `#e4e2e1`
- **on_secondary_container**: `#525151`
- **secondary_dim**: `#535353`

### Tertiary
- **tertiary**: `#5e5f5f` (Override: `#E5E5E5`)
- **on_tertiary**: `#f9f9f9`
- **tertiary_container**: `#f4f3f3`
- **on_tertiary_container**: `#5a5c5c`
- **tertiary_dim**: `#525354`

### Error & Utility
- **error**: `#9f403d`
- **on_error**: `#fff7f6`
- **error_container**: `#fe8983`
- **on_error_container**: `#752121`
- **error_dim**: `#4e0309`
- **outline**: `#757c7d`
- **outline_variant**: `#adb3b4`

---

# Design System Strategy: The Precision Instrument

## 1. Overview & Creative North Star: The Digital Scalpel
This design system is built for **DeepSub**, a platform where technical precision meets linguistic art. Our Creative North Star is **"The Digital Scalpel."** Unlike generic translation tools that feel like word processors, this system treats video subtitles as data points requiring surgical accuracy. 

To achieve a "High-End Editorial" feel, we move away from traditional "boxed" layouts. Instead, we use a hyper-disciplined grid, intentional asymmetry, and a monochromatic hierarchy. The interface should feel like a high-end Leica camera or a professional code editor—utilitarian, expensive, and devastatingly quiet. We break the "template" look by utilizing extreme whitespace as a functional element, allowing the content (the subtitles) to breathe in an environment of absolute focus.

---

## 2. Colors: Monochromatic Authority
Our palette is a study in Grayscale, using blue only as a functional "signal" for primary intent.

### The "Precision Line" vs. "Structural Sectioning"
While the aesthetic calls for a technical, line-based feel, we must avoid "The Box Trap." 
- **The "No-Line" Rule:** Do not use 1px solid borders to define major layout sections (e.g., Sidebar vs. Main Content). Structural boundaries are defined solely by background shifts: Use `surface-container-low` (#f2f4f4) for the sidebar against a `surface` (#f9f9f9) main area.
- **The Signature Stroke:** Reserve 1px solid lines (using `outline-variant` at 20% opacity) specifically for *internal* data relationships, such as separating timestamp markers or dividing the source language from the translation. Lines are for data, not for architecture.

### Surface Hierarchy & Nesting
Treat the UI as stacked sheets of architectural vellum.
- **Base:** `background` (#f9f9f9).
- **Secondary Workspaces:** `surface-container-low` (#f2f4f4).
- **Active Editing Cards:** `surface-container-lowest` (#ffffff).
By nesting a "Lowest" (White) card inside a "Low" (Light Gray) section, we create a "natural lift" that feels premium and tactile without resorting to heavy shadows.

### The "Glass & Signal" Rule
For floating panels (like a video playback controller), use **Glassmorphism**. Apply `surface-container-lowest` with 80% opacity and a `20px` backdrop blur. This ensures the technical UI feels integrated with the video content behind it.
- **Primary Signal:** Use `primary` (#a600ff) only for the "Export" or "Commit" action. It should be the only vibrant pixel on the screen.

---

## 3. Typography: The Editorial Grid
We use **Inter** for its neutral, technical clarity. To achieve an editorial look, we rely on high-contrast scaling and generous letter-spacing (tracking).

- **Display & Headlines:** Use `headline-sm` (1.5rem) for page titles. Set letter-spacing to `-0.02em` to make it feel "tight" and professional.
- **The Subtitle Matrix:** Subtitle text uses `title-md` (1.125rem). This is the hero of the application. Ensure a line height of `1.6` for maximum readability.
- **Technical Labels:** Use `label-sm` (0.6875rem) in all-caps with `+0.05em` tracking for timestamps and metadata. This mimics the look of technical blueprints.

---

## 4. Elevation & Depth: Tonal Layering
We reject the "drop shadow" of standard web design. Depth is achieved through **Tonal Layering**.

- **The Layering Principle:** To highlight a selected subtitle block, shift its background from `surface-container-lowest` to `primary-container` (#dde1ff) at 30% opacity. No border is needed; the color shift provides the boundary.
- **Ambient Shadows:** Only use shadows for "Temporary Overlays" (e.g., a dropdown menu). Use a 32px blur, 4% opacity, using the `on-surface` color. It should feel like a soft glow, not a dark edge.
- **The "Ghost Border":** For input fields, use a 1px border with `outline-variant` (#adb3b4). However, at a "Resting" state, set the opacity to 15%. On "Focus," move to `primary` (#a600ff) at 100% with no glow. Precision is key.

---

## 5. Components: The Primitive Set

### Buttons (The Tactical Trigger)
- **Primary:** Background `primary` (#a600ff), text `on-primary` (#f8f7ff), `0rem` (0px) radius. No gradient.
- **Secondary:** Background `transparent`, 1px ghost border, text `on-surface`.
- **States:** On hover, the `primary` button shifts to `primary-dim` (#0042d1). No "bounce" animations—use a swift 150ms linear fade to maintain a technical feel.

### Input Fields (The Data Entry)
- **Structure:** Forbid rounded capsules. Use the `0rem` (0px) radius. 
- **The Line Rule:** Use a bottom-border only for "Inline Editing" within a list, but a full ghost-border for "Global Settings."

### Subtitle Cards & Lists
- **The Divider Ban:** Never use a horizontal line to separate list items. Use 0px of vertical white space and a subtle background change (`surface-container-high`) on hover to define the row.
- **Timeline Component:** Use 1px vertical lines (`outline-variant`) to denote time increments. These are "Grid Lines," not containers.

### Video Transport Controls
- **Style:** Use icons with a 1px stroke weight to match the `outline` tokens. Avoid "filled" icons unless the state is active.

---

## 6. Do's and Don'ts

### Do:
- **Use Asymmetry:** Place the video preview off-center if it allows for a more functional "Editor" sidebar.
- **Embrace the "Empty":** If a section has no data, don't fill it with a "Get Started" illustration. Use a single line of `label-md` text in `on-surface-variant`.
- **Maintain the 4px Grid:** Every margin, padding, and gap must be a multiple of 4. Precision is the brand.

### Don't:
- **No 100% Black:** Never use `#000000` for text. Use `on-background` (#2d3435) for a softer, high-end ink-on-paper look.
- **No Rounded Corners > 0px:** Anything more than `0rem` (0px) breaks the "Technical Tool" aesthetic and begins to look like a consumer social app.
- **No Heavy Borders:** If you feel you need a border to "separate" things, you have likely failed at using your `surface-container` tiers correctly. Re-evaluate your background colors first.
