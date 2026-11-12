import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reviewer: draft from an SC decision",
  robots: { index: false, follow: false },
};

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
