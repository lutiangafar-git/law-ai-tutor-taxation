"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loadState } from "@/lib/storage";

/** Sends users back to the landing page until they have identified their year or bar status. */
export function GroupGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname === "/" || pathname.startsWith("/onboarding")) {
      setReady(true);
      return;
    }
    const state = loadState();
    if (!state.userGroup) {
      router.replace("/");
      return;
    }
    if (!state.usageNoticeSeen) {
      router.replace("/?notice=1");
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <p className="text-muted" role="status">
        Loading…
      </p>
    );
  }

  return <>{children}</>;
}
