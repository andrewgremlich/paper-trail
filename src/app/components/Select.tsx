import type { ReactNode, SelectHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { Flex } from "./Flex";
import { Label } from "./HtmlElements";

export type SelectOption = {
	value: string | number;
	label: ReactNode;
	disabled?: boolean;
};

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
	className?: string;
	label?: ReactNode;
	labelClassName?: string;
	containerClassName?: string;
	invalid?: boolean;
	descriptionId?: string;
	errorId?: string;
	options?: SelectOption[];
};

const baseClasses =
	"h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
	(
		{
			className,
			label,
			labelClassName,
			containerClassName,
			invalid,
			descriptionId,
			errorId,
			id,
			options,
			children,
			...rest
		},
		ref,
	) => {
		const selectClasses = className
			? `${baseClasses} ${className}`
			: baseClasses;
		const generatedId = useId();
		const selectId = id ?? generatedId;

		const { "aria-describedby": restAriaDescribedBy, ...restProps } =
			rest as Record<string, unknown>;
		const ariaDescribedBy =
			[restAriaDescribedBy as string | undefined, descriptionId, errorId]
				.filter(Boolean)
				.join(" ") || undefined;

		return (
			<Flex className={containerClassName} direction="col" gap={10}>
				{label ? (
					<Label htmlFor={selectId} className={labelClassName}>
						{label}
					</Label>
				) : null}
				<select
					ref={ref}
					id={selectId}
					aria-invalid={invalid || undefined}
					aria-describedby={ariaDescribedBy}
					className={selectClasses}
					{...restProps}
				>
					{options?.map((opt) => (
						<option
							key={String(opt.value)}
							value={opt.value}
							disabled={opt.disabled}
						>
							{opt.label}
						</option>
					))}
					{children}
				</select>
			</Flex>
		);
	},
);

Select.displayName = "Select";
