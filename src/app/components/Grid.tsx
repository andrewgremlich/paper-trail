import type { ElementType, ReactNode } from "react";

type BaseProps = {
	as?: ElementType;
	className?: string;
	colsClass?: string; // e.g. "grid-cols-6" or arbitrary template classes
	gapClass?: string; // e.g. "gap-4"
	fullWidth?: boolean;
	children: ReactNode;
};

export function Grid({
	as: Component = "div",
	className,
	colsClass = "grid-cols-6",
	gapClass = "gap-4",
	fullWidth = true,
	children,
	...rest
}: BaseProps & Record<string, unknown>) {
	const classes = [
		"grid",
		colsClass,
		gapClass,
		fullWidth ? "w-full" : "",
		className,
	]
		.filter(Boolean)
		.join(" ");
	return (
		<Component className={classes} {...rest}>
			{children}
		</Component>
	);
}

type GridHeaderProps = {
	headers: string[];
	className?: string;
	colsClass?: string;
	gapClass?: string;
};

export function GridHeader({
	headers,
	className,
	colsClass,
	gapClass,
}: GridHeaderProps) {
	return (
		<Grid className={className} colsClass={colsClass} gapClass={gapClass}>
			{headers.map((h) => (
				<div key={h} className="font-bold">
					{h}
				</div>
			))}
		</Grid>
	);
}

type GridRowProps = {
	children: ReactNode;
	className?: string;
	colsClass?: string;
	gapClass?: string;
};

export function GridRow({
	children,
	className,
	colsClass,
	gapClass,
}: GridRowProps) {
	return (
		<Grid className={className} colsClass={colsClass} gapClass={gapClass}>
			{children}
		</Grid>
	);
}
