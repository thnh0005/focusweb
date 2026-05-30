import { redirect } from "next/navigation";

export default function OnboardingPage() {
  // Redirect to the first step
  redirect("/onboarding/domain");
}
