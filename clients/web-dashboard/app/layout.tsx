import "./globals.css";

export const metadata = {
  title: "TestPilot AI Agent",
  description: "Hackathon demo for AI PR automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
