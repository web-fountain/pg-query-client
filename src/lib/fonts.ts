// This replaces the font layer and @font-face definitions in typography.css
// See: https://nextjs.org/docs/app/api-reference/components/font
import localFont from 'next/font/local';


export const interVariable = localFont({
  src: [
    {
      path: '../assets/fonts/InterVariable.woff2',
      style: 'normal',
    },
    {
      path: '../assets/fonts/InterVariable-Italic.woff2',
      style: 'italic',
    },
  ],
  display: 'swap',
  variable: '--font-inter-variable'
});

// Used for headings
export const interDisplay = localFont({
  src: [
    { path: '../assets/fonts/InterDisplay-Thin.woff2', weight: '100', style: 'normal' },
    { path: '../assets/fonts/InterDisplay-ThinItalic.woff2', weight: '100', style: 'italic' },
    { path: '../assets/fonts/InterDisplay-ExtraLight.woff2', weight: '200', style: 'normal' },
    { path: '../assets/fonts/InterDisplay-ExtraLightItalic.woff2', weight: '200', style: 'italic' },
    { path: '../assets/fonts/InterDisplay-Light.woff2', weight: '300', style: 'normal' },
    { path: '../assets/fonts/InterDisplay-LightItalic.woff2', weight: '300', style: 'italic' },
    { path: '../assets/fonts/InterDisplay-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../assets/fonts/InterDisplay-Italic.woff2', weight: '400', style: 'italic' },
    { path: '../assets/fonts/InterDisplay-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../assets/fonts/InterDisplay-MediumItalic.woff2', weight: '500', style: 'italic' },
    { path: '../assets/fonts/InterDisplay-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../assets/fonts/InterDisplay-SemiBoldItalic.woff2', weight: '600', style: 'italic' },
    { path: '../assets/fonts/InterDisplay-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../assets/fonts/InterDisplay-BoldItalic.woff2', weight: '700', style: 'italic' },
    { path: '../assets/fonts/InterDisplay-ExtraBold.woff2', weight: '800', style: 'normal' },
    { path: '../assets/fonts/InterDisplay-ExtraBoldItalic.woff2', weight: '800', style: 'italic' },
    { path: '../assets/fonts/InterDisplay-Black.woff2', weight: '900', style: 'normal' },
    { path: '../assets/fonts/InterDisplay-BlackItalic.woff2', weight: '900', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-inter-display'
});
