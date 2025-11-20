import clsx from "clsx";
import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from "react";

type TextAreaTone = "default" | "surface";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  tone?: TextAreaTone;
  leadingIcon?: ReactNode;
}

const baseStyles =
  "peer min-h-[140px] w-full rounded-[32px] border bg-white/[0.04] px-5 py-4 text-base text-white placeholder:text-white/30 transition focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none";

const tones: Record<TextAreaTone, string> = {
  default: "border-white/10 focus-visible:border-white/40",
  surface: "border-white/15 bg-white/[0.08] focus-visible:ring-white/20",
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, helperText, errorText, tone = "default", leadingIcon, className, required, ...rest }, ref) => (
    <label className="flex w-full flex-col gap-2 text-sm text-white/70">
      {label && (
        <span className="text-xs font-medium uppercase tracking-[0.35em] text-white/50">
          {label} {required && <span className="text-peach">*</span>}
        </span>
      )}
      <div className="relative flex items-start">
        {leadingIcon && <span className="pointer-events-none absolute left-4 top-4 text-white/40">{leadingIcon}</span>}
        <textarea
          ref={ref}
          className={clsx(baseStyles, tones[tone], leadingIcon && "pl-12", errorText && "border-red-400/50", className)}
          {...rest}
        />
      </div>
      {errorText ? (
        <span className="text-xs text-red-300">{errorText}</span>
      ) : (
        helperText && <span className="text-xs text-white/40">{helperText}</span>
      )}
    </label>
  )
);

TextArea.displayName = "TextArea";

export default TextArea;
