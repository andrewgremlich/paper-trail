import * as React from "react";
import styles from "./Card.module.css";

const Card = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={className ? `${styles.card} ${className}` : styles.card}
		{...props}
	/>
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={
			className ? `${styles.cardHeader} ${className}` : styles.cardHeader
		}
		{...props}
	/>
));
CardHeader.displayName = "CardHeader";

const CardContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={
			className ? `${styles.cardContent} ${className}` : styles.cardContent
		}
		{...props}
	/>
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={
			className ? `${styles.cardFooter} ${className}` : styles.cardFooter
		}
		{...props}
	/>
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardContent };
