import type { HTMLAttributes, JSX, ReactNode } from "react";

type ColCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type GridProps = HTMLAttributes<HTMLElement> & {
	as?: keyof JSX.IntrinsicElements;
	className?: string;
	/** Number of columns (Tailwind mapped 1-12). */
	cols?: ColCount;
	/** Gap between grid items (inline style, e.g., 8 or "1rem"). */
	gap?: string | number;
	/** Set inline grid instead of block grid. */
	inline?: boolean;
	/** Apply full width utility. */
	fullWidth?: boolean;
	/** Optional CSS grid template columns via inline style. */
	templateCols?: string;
	children: ReactNode;
};

export function Grid({
	as = "div",
	className,
	cols,
	gap,
	inline = false,
	fullWidth = true,
	templateCols,
	children,
	...rest
}: GridProps) {
	const Comp: keyof JSX.IntrinsicElements = as;

	// Explicit class map so Tailwind can statically detect classes
	const colsClassMap: Record<ColCount, string> = {
		1: "grid-cols-1",
		2: "grid-cols-2",
		3: "grid-cols-3",
		4: "grid-cols-4",
		5: "grid-cols-5",
		6: "grid-cols-6",
		7: "grid-cols-7",
		8: "grid-cols-8",
		9: "grid-cols-9",
		10: "grid-cols-10",
		11: "grid-cols-11",
		12: "grid-cols-12",
	};

	const classes = [
		inline ? "inline-grid" : "grid",
		cols ? colsClassMap[cols] : null,
		fullWidth ? "w-full" : null,
		className,
	]
		.filter(Boolean)
		.join(" ");

	// Prefer inline style for gap/template to avoid dynamic class generation
	const { style, ...restProps } = rest as HTMLAttributes<HTMLElement>;
	const mergedStyle = {
		...style,
		...(gap !== undefined && gap !== null
			? { gap: typeof gap === "number" ? `${gap}px` : gap }
			: {}),
		...(templateCols ? { gridTemplateColumns: templateCols } : {}),
	} as HTMLAttributes<HTMLElement>["style"];

	return (
		<Comp
			className={classes}
			style={mergedStyle}
			{...(restProps as unknown as Record<string, unknown>)}
		>
			{children}
		</Comp>
	);
}

type GridHeaderProps = {
	headers: string[];
	className?: string;
	cols?: ColCount;
	gap?: string | number;
	inline?: boolean;
	fullWidth?: boolean;
	templateCols?: string;
};

export function GridHeader({
	headers,
	className,
	cols,
	gap,
	inline,
	fullWidth,
	templateCols,
}: GridHeaderProps) {
	return (
		<Grid
			className={className}
			cols={cols}
			gap={gap}
			inline={inline}
			fullWidth={fullWidth}
			templateCols={templateCols}
		>
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
	cols?: ColCount;
	gap?: string | number;
	inline?: boolean;
	fullWidth?: boolean;
	templateCols?: string;
};

export function GridRow({
	children,
	className,
	cols,
	gap,
	inline,
	fullWidth,
	templateCols,
}: GridRowProps) {
	return (
		<Grid
			className={className}
			cols={cols}
			gap={gap}
			inline={inline}
			fullWidth={fullWidth}
			templateCols={templateCols}
		>
			{children}
		</Grid>
	);
}
