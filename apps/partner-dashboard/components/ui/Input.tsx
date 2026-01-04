import clsx from "clsx";
import { forwardRef, type HTMLInputTypeAttribute, type InputHTMLAttributes, type ReactNode } from "react";

type InputTone = "default" | "light";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  tone?: InputTone;
  type?: HTMLInputTypeAttribute;
}

const baseFieldStyles =
  "peer w-full rounded-[28px] border px-5 py-3 text-base transition focus-visible:ring-2 focus-visible:outline-none";

const toneClasses: Record<InputTone, string> = {
  default: "bg-white/[0.04] text-white placeholder:text-white/30 border-white/10 focus-visible:border-white/40 focus-visible:ring-white/50",
  light: "bg-slate-50 text-slate-900 placeholder:text-slate-400 border-slate-200 focus-visible:bg-white focus-visible:border-indigo-300 focus-visible:ring-indigo-100",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, helperText, errorText, leadingIcon, trailingIcon, tone = "default", className, required, type = "text", ...rest },
    ref
  ) => {
    const fieldClasses = clsx(
      baseFieldStyles,
      toneClasses[tone],
      (leadingIcon || trailingIcon) && "pl-12",
      trailingIcon && "pr-12",
      errorText && (tone === 'light' ? "border-rose-300 ring-rose-100 focus-visible:ring-rose-100" : "border-red-400/50 focus-visible:ring-red-300/60"),
      className
    );

    return (
      <label className={clsx(
        "flex w-full flex-col gap-2 text-sm",
        tone === 'light' ? 'text-slate-600' : 'text-white/70'
      )}>
        {label && (
          <span className={clsx(
            "text-xs font-medium uppercase tracking-[0.35em]",
            tone === 'light' ? 'text-slate-400' : 'text-white/50'
          )}>
            {label} {required && <span className="text-peach">*</span>}
          </span>
        )}
        <div className="relative flex items-center">
          {leadingIcon && (
            <span className={clsx(
              "pointer-events-none absolute left-4",
              tone === 'light' ? 'text-slate-400' : 'text-white/40'
            )}>
              {leadingIcon}
            </span>
          )}
          <input ref={ref} type={type} className={fieldClasses} {...rest} />
          {trailingIcon && (
            <span className={clsx(
              "pointer-events-none absolute right-4",
              tone === 'light' ? 'text-slate-400' : 'text-white/40'
            )}>
              {trailingIcon}
            </span>
          )}
        </div>
        {errorText ? (
          <span className="text-xs text-red-500 font-medium">{errorText}</span>
        ) : (
          helperText && (
            <span className={clsx(
              "text-xs",
              tone === 'light' ? 'text-slate-400' : 'text-white/40'
            )}>
              {helperText}
            </span>
          )
        )}
      </label>
    );
  }
);

Input.displayName = "Input";

export default Input;
