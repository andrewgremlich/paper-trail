import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
	className?: string;
};

const baseClasses =
	"h-10 rounded-md border border-input bg-white px-3 py-2 text-sm";

export const Input = forwardRef<HTMLInputElement, InputProps>(
	({ type, step, min, placeholder, required, className, ...rest }, ref) => {
		const classes = className ? `${baseClasses} ${className}` : baseClasses;
		return (
			<input
				ref={ref}
				type={type}
				step={step}
				min={min}
				placeholder={placeholder}
				required={required}
				className={classes}
				{...rest}
			/>
		);
	},
);

Input.displayName = "Input";
