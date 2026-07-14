import type { Metadata } from "next";
import { RegisterForm } from "@/components/features/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Tạo không gian tập trung | FocusOS",
  description: "Tạo tài khoản FocusOS và thiết lập một cách nhẹ nhàng hơn để bắt đầu deep work.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
