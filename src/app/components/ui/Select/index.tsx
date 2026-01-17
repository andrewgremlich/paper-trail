import type { ReactNode, SelectHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { Flex } from "@/components/layout/Flex";
import { Label } from "@/components/layout/HtmlElements";
import styles from "./styles.module.css";

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
			? `${styles.select} ${className}`
			: styles.select;
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
