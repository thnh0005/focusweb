import { redirect } from "next/navigation";

export default function SettingsPage() {
  // Redirect to the profile sub-page
  redirect("/settings/profile");
}
