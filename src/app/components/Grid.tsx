import type { HTMLAttributes, JSX, ReactNode } from "react";

type ColCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type GridProps = HTMLAttributes<HTMLElement> & {
	as?: keyof JSX.IntrinsicElements;
	className?: string;
	/** Number of columns (Tailwind mapped 1-12). */
	cols?: ColCount;
	/** Number of rows (Tailwind mapped 1-12). */
	rows?: ColCount;
	/** Grid auto-flow direction (Tailwind mapped). */
	flow?: "row" | "col" | "row-dense" | "col-dense";
	/** Gap between grid items (inline style, e.g., 8 or "1rem"). */
	gap?: string | number;
	/** Gap between rows (inline style, e.g., 8 or "1rem"). */
	rowGap?: string | number;
	/** Gap between columns (inline style, e.g., 8 or "1rem"). */
	columnGap?: string | number;
	/** Set inline grid instead of block grid. */
	inline?: boolean;
	/** Apply full width utility. */
	fullWidth?: boolean;
	/** Optional CSS grid template columns via inline style. */
	templateCols?: string;
	/** Optional CSS grid template rows via inline style. */
	templateRows?: string;
	children: ReactNode;
};

export function Grid({
	as = "div",
	className,
	cols,
	rows,
	flow,
	gap,
	rowGap,
	columnGap,
	inline = false,
	fullWidth = true,
	templateCols,
	templateRows,
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

	const rowsClassMap: Record<ColCount, string> = {
		1: "grid-rows-1",
		2: "grid-rows-2",
		3: "grid-rows-3",
		4: "grid-rows-4",
		5: "grid-rows-5",
		6: "grid-rows-6",
		7: "grid-rows-7",
		8: "grid-rows-8",
		9: "grid-rows-9",
		10: "grid-rows-10",
		11: "grid-rows-11",
		12: "grid-rows-12",
	};

	const flowClassMap: Record<NonNullable<GridProps["flow"]>, string> = {
		row: "grid-flow-row",
		col: "grid-flow-col",
		"row-dense": "grid-flow-row-dense",
		"col-dense": "grid-flow-col-dense",
	};

	const classes = [
		inline ? "inline-grid" : "grid",
		cols ? colsClassMap[cols] : null,
		rows ? rowsClassMap[rows] : null,
		flow ? flowClassMap[flow] : null,
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
		...(rowGap !== undefined && rowGap !== null
			? { rowGap: typeof rowGap === "number" ? `${rowGap}px` : rowGap }
			: {}),
		...(columnGap !== undefined && columnGap !== null
			? {
					columnGap:
						typeof columnGap === "number" ? `${columnGap}px` : columnGap,
				}
			: {}),
		...(templateCols ? { gridTemplateColumns: templateCols } : {}),
		...(templateRows ? { gridTemplateRows: templateRows } : {}),
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
	rows?: ColCount;
	flow?: GridProps["flow"];
	gap?: string | number;
	rowGap?: string | number;
	columnGap?: string | number;
	inline?: boolean;
	fullWidth?: boolean;
	templateCols?: string;
	templateRows?: string;
};

export function GridHeader({
	headers,
	className,
	cols,
	rows,
	flow,
	gap,
	rowGap,
	columnGap,
	inline,
	fullWidth,
	templateCols,
	templateRows,
}: GridHeaderProps) {
	return (
		<Grid
			className={className}
			cols={cols}
			rows={rows}
			flow={flow}
			gap={gap}
			rowGap={rowGap}
			columnGap={columnGap}
			inline={inline}
			fullWidth={fullWidth}
			templateCols={templateCols}
			templateRows={templateRows}
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
	rows?: ColCount;
	flow?: GridProps["flow"];
	gap?: string | number;
	rowGap?: string | number;
	columnGap?: string | number;
	inline?: boolean;
	fullWidth?: boolean;
	templateCols?: string;
	templateRows?: string;
};

export function GridRow({
	children,
	className,
	cols,
	rows,
	flow,
	gap,
	rowGap,
	columnGap,
	inline,
	fullWidth,
	templateCols,
	templateRows,
}: GridRowProps) {
	return (
		<Grid
			className={className}
			cols={cols}
			rows={rows}
			flow={flow}
			gap={gap}
			rowGap={rowGap}
			columnGap={columnGap}
			inline={inline}
			fullWidth={fullWidth}
			templateCols={templateCols}
			templateRows={templateRows}
		>
			{children}
		</Grid>
	);
}
