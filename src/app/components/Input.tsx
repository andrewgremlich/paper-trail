import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";
import { Label } from "./Label";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
	className?: string;
	label?: ReactNode;
	labelClassName?: string;
	containerClassName?: string;
	invalid?: boolean;
	descriptionId?: string;
	errorId?: string;
};

const baseClasses =
	"h-10 rounded-md border border-input bg-white px-3 py-2 text-sm placeholder:text-slate-500 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 read-only:opacity-75";

export const Input = forwardRef<HTMLInputElement, InputProps>(
	(
		{
			type,
			step,
			min,
			placeholder,
			required,
			className,
			label,
			labelClassName,
			containerClassName,
			invalid,
			descriptionId,
			errorId,
			id,
			...rest
		},
		ref,
	) => {
		const inputClasses = className ? `${baseClasses} ${className}` : baseClasses;
		const generatedId = useId();
		const inputId = id ?? generatedId;

		// Merge any provided aria-describedby with description and error ids
		const { ["aria-describedby"]: restAriaDescribedBy, ...restProps } =
			(rest as Record<string, unknown>);
		const ariaDescribedBy = [
			restAriaDescribedBy as string | undefined,
			descriptionId,
			errorId,
		]
			.filter(Boolean)
			.join(" ") || undefined;

		return (
			<div className={containerClassName}>
				{label ? (
					<Label htmlFor={inputId} className={labelClassName}>
						{label}
					</Label>
				) : null}
				<input
					ref={ref}
					id={inputId}
					type={type}
					step={step}
					min={min}
					placeholder={placeholder}
					required={required}
					aria-invalid={invalid || undefined}
					aria-describedby={ariaDescribedBy}
					className={inputClasses}
					{...restProps}
				/>
			</div>
		);
	},
);

Input.displayName = "Input";
