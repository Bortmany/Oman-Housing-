import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// min-h-11 keeps every field at least 44px tall — a comfortable thumb target.
const inputBase =
  "block min-h-11 w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-stone-900 ring-1 ring-inset placeholder:text-stone-400 focus:ring-2 focus:ring-inset";

// One ring color at a time: normal teal focus, or the red error state a form
// switches on for the specific field that failed.
const ringNormal = "ring-stone-300 focus:ring-teal-700";
const ringError = "ring-rose-600 focus:ring-rose-600";

function fieldClass(error: boolean | undefined, className: string) {
  return `${inputBase} ${error ? ringError : ringNormal} ${className}`;
}

export function Label({
  className = "",
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1 block text-sm font-medium text-stone-700 ${className}`}
      {...props}
    />
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-stone-500">{children}</p>;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-rose-700">{children}</p>;
}

export function Input({
  className = "",
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={fieldClass(error, className)}
      aria-invalid={error || undefined}
      {...props}
    />
  );
}

export function Select({
  className = "",
  error,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      className={fieldClass(error, className)}
      aria-invalid={error || undefined}
      {...props}
    />
  );
}

export function Textarea({
  className = "",
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={fieldClass(error, className)}
      aria-invalid={error || undefined}
      rows={4}
      {...props}
    />
  );
}
