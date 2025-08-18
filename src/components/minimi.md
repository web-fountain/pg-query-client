# What goes in `components/`

### TL;DR

>Typically holds your **shared components**—the building blocks of your UI that get reused across multiple routes or features.

* **Reusability**: Anything you find yourself copy-pasting from one page/route into another belongs here.
* **Consistency**: Centralizes styling and behavior so buttons, cards, modals, etc., look and act the same everywhere.
* **Separation of concerns**: Keeps your `app/` directory focused on routing and data fetching; your UI “lego pieces” go in `components/`.

---

## Example usage

```tsx
// components/ui/Button.tsx
export function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
      {...props}
    >
      {children}
    </button>
  );
}

// components/layout/Header.tsx
import { Button } from '../ui/Button';

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 bg-gray-100">
      <h1 className="text-xl font-bold">MyApp</h1>
      <Button onClick={() => console.log('clicked')}>Sign In</Button>
    </header>
  );
}

// app/layout.tsx
import { Header } from '@Components/layout/Header';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

---

### When **not** to add something to `components/`

* If it’s a **one-off** UI piece used by only a single page, you can co-locate it in that route folder:

  ```
  app/dashboard/
  ├ page.tsx
  └ ChartWidget.tsx   ← no need to pollute components/
  ```
* If it’s **pure logic** or a hook—put it in `hooks/` or `utils/` instead.
