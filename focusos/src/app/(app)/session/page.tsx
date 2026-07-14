import { redirect } from "next/navigation";

export default function SessionRedirectPage() {
  redirect("/dashboard");
}
