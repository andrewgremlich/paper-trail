import * as React from "react";
import { cn } from "../lib/utils";

function cx(...classes: (string | undefined | false)[]) {
	return classes.filter(Boolean).join(" ");
}

export type MainProps = React.ComponentPropsWithoutRef<"main">;
export const Main = React.forwardRef<HTMLElement, MainProps>(
	({ className, children, ...rest }, ref) => (
		<main
			ref={ref as React.Ref<HTMLElement>}
			className={cx("flex-1 px-4 md:px-8 pb-8", className)}
			{...rest}
		>
			{children}
		</main>
	),
);
Main.displayName = "Main";

export type SectionProps = React.ComponentPropsWithoutRef<"section">;
export const Section = React.forwardRef<HTMLElement, SectionProps>(
	({ className, children, ...rest }, ref) => (
		<section
			ref={ref as React.Ref<HTMLElement>}
			className={cx("mt-8 mb-6", className)}
			{...rest}
		>
			{children}
		</section>
	),
);
Section.displayName = "Section";

export type H1Props = React.ComponentPropsWithoutRef<"h1">;
export const H1 = React.forwardRef<HTMLHeadingElement, H1Props>(
	({ className, children, ...rest }, ref) => (
		<h1
			ref={ref}
			className={cx("text-4xl text-foreground font-bold mb-6", className)}
			{...rest}
		>
			{children}
		</h1>
	),
);
H1.displayName = "H1";

export type H2Props = React.ComponentPropsWithoutRef<"h2">;
export const H2 = React.forwardRef<HTMLHeadingElement, H2Props>(
	({ className, children, ...rest }, ref) => (
		<h2
			ref={ref}
			className={cx("text-3xl text-foreground font-bold mb-4", className)}
			{...rest}
		>
			{children}
		</h2>
	),
);
H2.displayName = "H2";

export type H3Props = React.ComponentPropsWithoutRef<"h3">;
export const H3 = React.forwardRef<HTMLHeadingElement, H3Props>(
	({ className, children, ...rest }, ref) => (
		<h3
			ref={ref}
			className={cx("text-2xl text-foreground font-bold mb-2", className)}
			{...rest}
		>
			{children}
		</h3>
	),
);
H3.displayName = "H3";

export type PProps = React.ComponentPropsWithoutRef<"p">;
export const P = React.forwardRef<HTMLParagraphElement, PProps>(
	({ className, children, ...rest }, ref) => (
		<p ref={ref} className={cx("mb-4 text-foreground", className)} {...rest}>
			{children}
		</p>
	),
);
P.displayName = "P";

export type SpanProps = React.ComponentPropsWithoutRef<"span">;
export const Span = React.forwardRef<HTMLSpanElement, SpanProps>(
	({ className, children, ...rest }, ref) => (
		<span ref={ref} className={cx("", className)} {...rest}>
			{children}
		</span>
	),
);
Span.displayName = "Span";

export interface LabelProps
	extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
	({ className, ...props }, ref) => (
		// biome-ignore lint/a11y/noLabelWithoutControl: used in other components
		<label
			ref={ref}
			className={cn(
				"text-foreground text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				className,
			)}
			{...props}
		/>
	),
);
Label.displayName = "Label";
