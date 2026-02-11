import "./globals.css";

export const metadata = {
  title: "TestPilot Enterprise",
  description: "Enterprise AI code review control plane with GitHub App, Sonar, and VS Code integration.",
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
