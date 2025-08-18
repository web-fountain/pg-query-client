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


export const metadata: Metadata = {
  title: 'MyWebSite',
  description: 'MyWebSite'
};

async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${interVariable.variable} ${interDisplay.variable}`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="MyWebSite" />

        <link rel="manifest"          href="favicon/manifest.json" />
        <link rel="icon"              href="favicon/favicon.ico"    type="image/x-icon"   sizes="48x48"   />
        <link rel="icon"              href="favicon/icon.svg"       type="image/svg+xml"  sizes="any"     />
        <link rel="icon"              href="favicon/icon.png"       type="image/png"      sizes="96x96"   />
        <link rel="apple-touch-icon"  href="favicon/apple-icon.png" type="image/png"      sizes="180x180" />

        {/* set the theme based on the user's preference */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
                document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
              })();
            `,
          }}
        />

        <style>@layer normalize, scale, typography, base, layouts, themes, utilities;</style>
      </head>

      <body>
        {children}
      </body>

    </html>
  );
}


export default RootLayout;
