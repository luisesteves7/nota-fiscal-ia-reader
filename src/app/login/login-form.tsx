"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signIn, signUp, type AuthActionState } from "./actions";

const initialState: AuthActionState = { error: null };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction] = useFormState(action, initialState);

  return (
    <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-xl font-semibold">
        {mode === "signin" ? "Entrar" : "Criar conta"}
      </h1>

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          E-mail
          <input
            name="email"
            type="email"
            required
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Senha
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
          />
        </label>

        {state.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <SubmitButton
          label={mode === "signin" ? "Entrar" : "Criar conta"}
          pendingLabel="Aguarde..."
        />
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-4 text-sm text-brand-600 hover:underline"
      >
        {mode === "signin"
          ? "Não tem conta? Cadastre-se"
          : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}