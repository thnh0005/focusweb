import type { Metadata } from "next";
import { LoginForm } from "@/components/features/auth/LoginForm";

export const metadata: Metadata = {
  title: "Đăng nhập | FocusOS",
  description: "Đăng nhập để vào không gian tập trung và bắt đầu phiên deep work tiếp theo.",
};

export default function LoginPage() {
  return <LoginForm />;
}
