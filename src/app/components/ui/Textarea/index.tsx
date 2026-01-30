import type { ReactNode, TextareaHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { Flex } from "@/components/layout/Flex";
import { Label } from "@/components/layout/HtmlElements";
import styles from "./styles.module.css";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
	className?: string;
	label?: ReactNode;
	labelClassName?: string;
	containerClassName?: string;
	invalid?: boolean;
	descriptionId?: string;
	errorId?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	(
		{
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
			rows = 4,
			...rest
		},
		ref,
	) => {
		const textareaClasses = className
			? `${styles.textarea} ${className}`
			: styles.textarea;
		const generatedId = useId();
		const textareaId = id ?? generatedId;

		// Merge any provided aria-describedby with description and error ids
		const { "aria-describedby": restAriaDescribedBy, ...restProps } =
			rest as Record<string, unknown>;
		const ariaDescribedBy =
			[restAriaDescribedBy as string | undefined, descriptionId, errorId]
				.filter(Boolean)
				.join(" ") || undefined;

		return (
			<Flex className={containerClassName} direction="col" gap={10}>
				{label ? (
					<Label htmlFor={textareaId} className={labelClassName}>
						{label}
					</Label>
				) : null}
				<textarea
					ref={ref}
					id={textareaId}
					placeholder={placeholder}
					required={required}
					aria-invalid={invalid || undefined}
					aria-describedby={ariaDescribedBy}
					className={textareaClasses}
					rows={rows}
					{...restProps}
				/>
			</Flex>
		);
	},
);

Textarea.displayName = "Textarea";
