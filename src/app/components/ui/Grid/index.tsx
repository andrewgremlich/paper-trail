import type { HTMLAttributes, JSX, ReactNode } from "react";
import styles from "./styles.module.css";

type ColCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type GridProps = HTMLAttributes<HTMLElement> & {
	as?: keyof JSX.IntrinsicElements;
	className?: string;
	/** Number of columns (1-12). */
	cols?: ColCount;
	/** Number of rows (1-12). */
	rows?: ColCount;
	/** Grid auto-flow direction. */
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

	const colsClassMap: Record<ColCount, string> = {
		1: styles.cols1,
		2: styles.cols2,
		3: styles.cols3,
		4: styles.cols4,
		5: styles.cols5,
		6: styles.cols6,
		7: styles.cols7,
		8: styles.cols8,
		9: styles.cols9,
		10: styles.cols10,
		11: styles.cols11,
		12: styles.cols12,
	};

	const rowsClassMap: Record<ColCount, string> = {
		1: styles.rows1,
		2: styles.rows2,
		3: styles.rows3,
		4: styles.rows4,
		5: styles.rows5,
		6: styles.rows6,
		7: styles.rows7,
		8: styles.rows8,
		9: styles.rows9,
		10: styles.rows10,
		11: styles.rows11,
		12: styles.rows12,
	};

	const flowClassMap: Record<NonNullable<GridProps["flow"]>, string> = {
		row: styles.flowRow,
		col: styles.flowCol,
		"row-dense": styles.flowRowDense,
		"col-dense": styles.flowColDense,
	};

	const classes = [
		inline ? styles.inlineGrid : styles.grid,
		cols ? colsClassMap[cols] : null,
		rows ? rowsClassMap[rows] : null,
		flow ? flowClassMap[flow] : null,
		fullWidth ? styles.fullWidth : null,
		className,
	]
		.filter(Boolean)
		.join(" ");

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
				<div key={h} className={styles.headerCell}>
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
