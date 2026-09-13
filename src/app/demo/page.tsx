import Link from "next/link";
import { DemoFlow } from "@/components/demo-flow";

export default function DemoPage() {
  return (
    <main className="min-h-screen px-4 py-10">
      <header className="mx-auto mb-8 flex w-full max-w-3xl items-center justify-between">
        <h1 className="text-xl font-semibold">Nota Fiscal IA Reader — Demo</h1>
        <Link href="/login" className="text-brand-600 hover:underline">
          Criar conta / entrar
        </Link>
      </header>

      <DemoFlow />
    </main>
  );
}
