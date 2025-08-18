# What goes in `utils/`

### TL;DR

* **`utils/`** = *“your Swiss Army knife”* – pure, side-effect-free helpers, reusable everywhere.

>General-purpose *utility functions* or *helpers* that contains small, reusable functions that could apply to many different parts of your codebase (or even other projects).

### Pure helper functions
* e.g. `utils/formatDate.ts`
* e.g. `utils/capitalize.ts`

### Pipe-and-compose utilities
* tiny functions for data transformations

### Platform-agnostic tools
* URL builders, deep-clone, assertion helpers

<details>
<summary>Example `utils/` structure</summary>

```
utils/
├─ assert.ts           # throw if conditions aren’t met
├─ debounce.ts         # throttle/debounce callbacks
├─ deepClone.ts        # JSON-safe or structuredClone wrapper
├─ formatDate.ts       # date → string formats
└─ pick.ts             # select keys from an object
```

</details>

---

## Ask yourself

| Question                                           | If **yes** ⇒ Put it in… |
| -------------------------------------------------- | ----------------------- |
| Is this code a tiny, generic helper (pure fn)?     | `utils/`                |
| Will you reuse it across *different* apps?         | `utils/`                |
| Is it a cohesive module or feature (multiple fns)? | `lib/`                  |
| Is this code *only* meaningful in your domain?     | `lib/`                  |

---

## Examples

1. **Email-sending**

   * `utils/templateReplace.ts`
     A generic function that replaces `{{placeholder}}` tokens in any string.
   * `lib/email/sendWelcome.ts`
     Contains template selection, personalized links, logging.

2. **Date manipulation**

   * `utils/formatDate.ts`
     A lightweight wrapper around `Intl.DateTimeFormat`.
   * `lib/reporting/generateMonthlyReport.ts`
     Uses `formatDate` but includes domain logic (grouping, filtering, layout).
