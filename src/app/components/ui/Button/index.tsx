import * as React from "react";

import { Spinner } from "@/components/ui/Spinner";
import styles from "./Button.module.css";

type ButtonVariant =
	| "default"
	| "secondary"
	| "outline"
	| "ghost"
	| "liquidGlass";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	isLoading?: boolean;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
	fullWidth?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			className,
			variant = "default",
			size = "md",
			type = "button",
			isLoading = false,
			disabled,
			leftIcon,
			rightIcon,
			fullWidth,
			children,
			...rest
		},
		ref,
	) => {
		const variantClassMap: Record<ButtonVariant, string> = {
			default: styles.default,
			secondary: styles.secondary,
			outline: styles.outline,
			ghost: styles.ghost,
			liquidGlass: styles.liquidGlass,
		};

		const sizeClassMap: Record<ButtonSize, string> = {
			sm: styles.sm,
			md: styles.md,
			lg: styles.lg,
			icon: styles.icon,
		};

		const classes = [
			styles.button,
			variantClassMap[variant],
			sizeClassMap[size],
			fullWidth ? styles.fullWidth : null,
			className,
		]
			.filter(Boolean)
			.join(" ");

		return (
			<button
				ref={ref}
				type={type}
				className={classes}
				disabled={disabled || isLoading}
				{...rest}
			>
				{isLoading ? (
					<Spinner className={styles.spinner} />
				) : (
					leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>
				)}
				<span>{children}</span>
				{!isLoading && rightIcon ? (
					<span className={styles.rightIcon}>{rightIcon}</span>
				) : null}
			</button>
		);
	},
);

Button.displayName = "Button";
