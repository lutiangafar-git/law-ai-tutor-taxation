"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { categoryPath } from "@/lib/profiles";
import { loadState } from "@/lib/storage";

/** Old address: sends the user to their category's drills page (or to Register). */
export default function DrillsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(categoryPath(loadState().userGroup));
  }, [router]);
  return <p className="text-muted">Loading…</p>;
}
