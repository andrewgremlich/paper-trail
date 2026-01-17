import * as React from "react";
import { cn } from "@/lib/utils";
import styles from "./styles.module.css";

export type MainProps = React.ComponentPropsWithoutRef<"main">;
export const Main = React.forwardRef<HTMLElement, MainProps>(
	({ className, children, ...rest }, ref) => (
		<main
			ref={ref as React.Ref<HTMLElement>}
			className={cn(styles.main, className)}
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
			className={cn(styles.section, className)}
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
		<h1 ref={ref} className={cn(styles.h1, className)} {...rest}>
			{children}
		</h1>
	),
);
H1.displayName = "H1";

export type H2Props = React.ComponentPropsWithoutRef<"h2">;
export const H2 = React.forwardRef<HTMLHeadingElement, H2Props>(
	({ className, children, ...rest }, ref) => (
		<h2 ref={ref} className={cn(styles.h2, className)} {...rest}>
			{children}
		</h2>
	),
);
H2.displayName = "H2";

export type H3Props = React.ComponentPropsWithoutRef<"h3">;
export const H3 = React.forwardRef<HTMLHeadingElement, H3Props>(
	({ className, children, ...rest }, ref) => (
		<h3 ref={ref} className={cn(styles.h3, className)} {...rest}>
			{children}
		</h3>
	),
);
H3.displayName = "H3";

export type PProps = React.ComponentPropsWithoutRef<"p">;
export const P = React.forwardRef<HTMLParagraphElement, PProps>(
	({ className, children, ...rest }, ref) => (
		<p ref={ref} className={cn(styles.p, className)} {...rest}>
			{children}
		</p>
	),
);
P.displayName = "P";

export type SpanProps = React.ComponentPropsWithoutRef<"span">;
export const Span = React.forwardRef<HTMLSpanElement, SpanProps>(
	({ className, children, ...rest }, ref) => (
		<span ref={ref} className={className} {...rest}>
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
		<label ref={ref} className={cn(styles.label, className)} {...props} />
	),
);
Label.displayName = "Label";
