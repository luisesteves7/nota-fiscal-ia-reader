import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
      <LoginForm />
      <p className="text-sm text-slate-500">
        Só quer ver como funciona?{" "}
        <Link href="/demo" className="text-brand-600 hover:underline">
          Testar o modo demo
        </Link>{" "}
        (sem criar conta, dados fictícios)
      </p>
    </main>
  );
}
