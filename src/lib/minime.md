# What goes in `lib/`

### TL;DR

* **`lib/`** = *“the heart of your app”* – domain logic, feature modules, 3rd-party SDK wraps.

>Your app’s *domain-specific modules* or *library code* contains core business logic, abstractions, or feature packs that are specific to your application’s needs.

### Domain modules
* e.g. `lib/auth.ts`
* e.g. `lib/payment-gateway.ts`

### Higher-level abstractions
* Wrappers around third-party SDKs (e.g. `lib/aws/`, `lib/firebase/`)

### Feature bundles
* Collections of related functions, classes, types, e.g. `lib/shoppingCart/`

## Ask yourself

| Question                                           | If **yes** ⇒ Put it in… |
| -------------------------------------------------- | ----------------------- |
| Is this code *only* meaningful in your domain?     | `lib/`                  |
| Is it a cohesive module or feature (multiple fns)? | `lib/`                  |
| Is this code a tiny, generic helper (pure fn)?     | `utils/`                |
| Will you reuse it across *different* apps?         | `utils/`                |

---

## Examples

1. **Email-sending**

   * `lib/email/sendWelcome.ts`
     Contains template selection, personalized links, logging.
   * `utils/templateReplace.ts`
     A generic function that replaces `{{placeholder}}` tokens in any string.

2. **Date manipulation**

   * `utils/formatDate.ts`
     A lightweight wrapper around `Intl.DateTimeFormat`.
   * `lib/reporting/generateMonthlyReport.ts`
     Uses `formatDate` but includes domain logic (grouping, filtering, layout).
