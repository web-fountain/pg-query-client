# What goes in `assets/`

### TL;DR

Use **`assets/`** for *all* your non-code, static resources—images, fonts, stylesheets, videos, JSON data, icons—so that they’re organized separately from your application logic and helper code.

>An **`assets/`** folder is where you keep all your *static, non-code resources*—things that your app will serve or bundle, but that aren’t JavaScript/TypeScript modules. Here’s what typically belongs there:

## Common asset types

| Type                    | Examples                                      | Notes                                                     |
| ----------------------- | --------------------------------------------- | --------------------------------------------------------- |
| **Fonts**               | `Inter-Regular.woff2`, `Roboto-Bold.ttf`      | Custom web fonts you include alongside system fonts.      |
| **Styles**              | `styles/globals.css`, `styles/variables.scss` | Global CSS, Sass/SCSS, or other static stylesheet files.  |

---

## Example folder structure

```
assets/
├─ fonts/
│  ├─ Inter-Regular.woff2
│  └─ Inter-Bold.woff2
├─ styles/
│  ├─ globals.css
│  └─ themes/
│     ├─ light.css
│     └─ dark.css
```
