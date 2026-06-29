import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMI Calculator — Shared Workspace",
  description:
    "Loan EMI calculator with amortization schedule, comparison, sensitivity grid, and prepayment planner. State is shared across browser tabs in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* inline theme bootstrap — runs before paint to avoid FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('emi:theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(_){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
