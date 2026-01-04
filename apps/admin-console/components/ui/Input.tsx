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
  "peer w-full rounded-[28px] border bg-white/[0.04] px-5 py-3 text-base text-white placeholder:text-white/30 transition focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none";

const toneClasses: Record<InputTone, string> = {
  default: "border-white/10 focus-visible:border-white/40",
  light: "border-white/30 bg-white/[0.08] text-black placeholder:text-black/40 focus-visible:ring-black/20",
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
      errorText && "border-red-400/50 focus-visible:ring-red-300/60",
      className
    );

    return (
      <label className="flex w-full flex-col gap-2 text-sm text-white/70">
        {label && (
          <span className="text-xs font-medium uppercase tracking-[0.35em] text-white/50">
            {label} {required && <span className="text-peach">*</span>}
          </span>
        )}
        <div className="relative flex items-center">
          {leadingIcon && <span className="pointer-events-none absolute left-4 text-white/40">{leadingIcon}</span>}
          <input ref={ref} type={type} className={fieldClasses} {...rest} />
          {trailingIcon && <span className="pointer-events-none absolute right-4 text-white/40">{trailingIcon}</span>}
        </div>
        {errorText ? (
          <span className="text-xs text-red-300">{errorText}</span>
        ) : (
          helperText && <span className="text-xs text-white/40">{helperText}</span>
        )}
      </label>
    );
  }
);

Input.displayName = "Input";

export default Input;
