import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tokenomics Scam Detector",
  description: "Analyze tokenomics for potential scams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-900 text-white`}>
        <header className="bg-gray-800 p-4 shadow-md">
          <div className="container mx-auto">
            <h1 className="text-2xl font-bold text-teal-400">Tokenomics Scam Detector</h1>
          </div>
        </header>
        <main className="container mx-auto p-4 mt-8">
          {children}
        </main>
        <footer className="text-center p-4 mt-12 text-gray-500">
          <p>&copy; 2024 Tokenomics Scam Detector. Stay safe!</p>
        </footer>
      </body>
    </html>
  );
}
