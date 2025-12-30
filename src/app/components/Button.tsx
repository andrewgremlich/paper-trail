import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib/utils";

const buttonVariants = cva(
	"cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-lg text-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground border hover:border-border",
				secondary:
					"bg-gray-600 text-primary-foreground border hover:border-border",
				outline: "bg-transparent",
				ghost: "bg-transparent border-transparent text-primary-foreground",
				liquidGlass:
					"relative bg-white/10 text-primary-foreground border border-white/20 backdrop-blur-md shadow-md hover:bg-white/20 hover:border-white/30",
			},
			size: {
				sm: "h-8 px-3 py-1.5",
				md: "h-10 px-4 py-2",
				lg: "h-12 px-6 py-3",
				icon: "h-10 w-10 p-6 rounded-full",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "md",
		},
	},
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof buttonVariants> & {
		isLoading?: boolean;
		leftIcon?: React.ReactNode;
		rightIcon?: React.ReactNode;
		fullWidth?: boolean;
	};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			className,
			variant,
			size,
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
		const classes = cn(
			buttonVariants({ variant, size }),
			fullWidth && "w-full",
			className,
		);

		return (
			<button
				ref={ref}
				type={type}
				className={classes}
				disabled={disabled || isLoading}
				{...rest}
			>
				{isLoading ? (
					<Spinner className="mr-2 h-4 w-4" />
				) : (
					leftIcon && (
						<span className="mr-2 inline-flex items-center">{leftIcon}</span>
					)
				)}
				<span>{children}</span>
				{!isLoading && rightIcon ? (
					<span className="ml-2 inline-flex items-center">{rightIcon}</span>
				) : null}
			</button>
		);
	},
);

Button.displayName = "Button";

function Spinner({ className }: { className?: string }) {
	return (
		<svg
			className={cn("animate-spin", className)}
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<circle
				className="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
			/>
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
			/>
		</svg>
	);
}

export { buttonVariants };
