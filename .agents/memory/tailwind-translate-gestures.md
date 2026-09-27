---
name: Tailwind translate and drag gestures
description: CSS translate utilities can compound with inline transform during interactive sliding panels.
---

When a panel uses Tailwind's `translate-x-*` utilities, update the CSS `translate` property for pointer-driven positioning rather than adding an inline `transform`.

**Why:** In this project's Tailwind version, translation utilities use the independent CSS `translate` property. An inline `transform` does not override it; the two offsets accumulate, leaving a dragged panel off-screen even while its arrow moves correctly.

**How to apply:** For any draggable panel using Tailwind translate utilities, use the same `translate` property during the held gesture and verify its edge in a browser before relying on release animation.