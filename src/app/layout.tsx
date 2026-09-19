import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FutureWallet",
  description: "An AI budget and expense advisor that shows you what your money does to your future.",
};

/** Applies the saved (or system) theme before first paint so there is no light flash. */
const themeScript = `(function(){try{var t=localStorage.getItem("fw-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);var s=localStorage.getItem("fw-text");if(s)document.documentElement.style.setProperty("--text-scale",s)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background text-on-surface antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
