"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Result returned by form Server Actions (used with useActionState). */
export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export function Field({
  label,
  name,
  errors,
  hint,
  ...input
}: { label: string; name: string; errors?: string[]; hint?: ReactNode } & ComponentProps<"input">) {
  const id = `field-${name}`;
  const describedBy = errors?.length ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 aria-invalid:border-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        {...input}
      />
      {errors?.length ? (
        <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-400">
          {errors[0]}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children, pendingText, variant = "primary", ...props }: { pendingText?: string; variant?: "primary" | "danger" | "secondary" } & ComponentProps<"button">) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
    danger: "bg-red-700 text-white hover:bg-red-600",
    secondary: "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-md px-4 py-2.5 font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${styles}`}
      {...props}
    >
      {pending ? (pendingText ?? "Enviando…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"}`}
    >
      {state.message}
    </p>
  );
}
