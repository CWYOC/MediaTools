import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Media Tools",
  description: "Image and video converter website",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en">
        <head>
            <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3685958224758369"crossorigin="anonymous">
            </script>
        </head>
        <body>
          {children}
        </body>
      </html>
    );
  }