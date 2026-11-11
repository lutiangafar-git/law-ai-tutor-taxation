import { redirect } from "next/navigation";

/** Old address kept so saved links still work: identification now happens on the landing page. */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  redirect(notice === "1" ? "/?notice=1" : "/");
}
