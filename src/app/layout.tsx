import type { Metadata } from 'next';
import { interVariable, interDisplay } from '@Lib/fonts';

import '@Styles/scale.css';
import '@Styles/normalize.css';
import '@Styles/base.css';
import '@Styles/mediaQueries.css';
import '@Styles/typography.css';
import '@Styles/layouts.css';
import '@Styles/themes.css';
import '@Styles/utilities.css';
import '@Styles/semantics.css';
import '@Styles/forms.css';
import '@Styles/motion.css';
import '@Styles/a11y.css';
import '@Styles/scrollbars.css';
import '@Styles/prose.css';
import '@Styles/print.css';


const metadata: Metadata = {
  title: 'PG Query Client',
  description: 'A PostgreSQL Query Client with AI'
};

async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${interVariable.variable} ${interDisplay.variable}`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="PG Query Client" />

        <link rel="manifest"          href="favicon/manifest.json" />
        <link rel="icon"              href="favicon/favicon.ico"    type="image/x-icon"   sizes="48x48"   />
        <link rel="icon"              href="favicon/icon.svg"       type="image/svg+xml"  sizes="any"     />
        <link rel="icon"              href="favicon/icon.png"       type="image/png"      sizes="96x96"   />
        <link rel="apple-touch-icon"  href="favicon/apple-icon.png" type="image/png"      sizes="180x180" />

        {/* Persist user-selected theme; fallback to system preference */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('pg-query-client-theme');
                  var theme = (saved === 'light' || saved === 'dark')
                    ? saved
                    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {
                  var isLight = window.maπtchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
                  document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
                }
              })();
            `,
          }}
        />

        <style>@layer normalize, base, scale, themes, semantics, typography, motion, layouts, forms, a11y, scrollbars, prose, print, utilities;</style>
      </head>

      <body>
        {children}
      </body>

    </html>
  );
}


export { metadata };
export default RootLayout;
