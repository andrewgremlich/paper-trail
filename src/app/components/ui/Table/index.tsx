import * as React from "react";
import styles from "./styles.module.css";

type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
	wrapperClassName?: string;
};
type THeadProps = React.HTMLAttributes<HTMLTableSectionElement>;
type TBodyProps = React.HTMLAttributes<HTMLTableSectionElement>;
type TRProps = React.HTMLAttributes<HTMLTableRowElement>;
type THProps = React.ThHTMLAttributes<HTMLTableCellElement>;
type TDProps = React.TdHTMLAttributes<HTMLTableCellElement>;

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
	({ className, wrapperClassName, children, ...props }, ref) => {
		const tableClasses = className
			? `${styles.table} ${className}`
			: styles.table;
		const wrapperClasses = wrapperClassName
			? `${styles.tableWrapper} ${wrapperClassName}`
			: styles.tableWrapper;

		return (
			<div className={wrapperClasses}>
				<table ref={ref} className={tableClasses} {...props}>
					{children}
				</table>
			</div>
		);
	},
);
Table.displayName = "Table";

export const THead = React.forwardRef<HTMLTableSectionElement, THeadProps>(
	({ className, children, ...props }, ref) => {
		const theadClasses = className
			? `${styles.thead} ${className}`
			: styles.thead;

		return (
			<thead ref={ref} className={theadClasses} {...props}>
				{children}
			</thead>
		);
	},
);
THead.displayName = "THead";

export const TBody = React.forwardRef<HTMLTableSectionElement, TBodyProps>(
	({ className, children, ...props }, ref) => {
		const tbodyClasses = className
			? `${styles.tbody} ${className}`
			: styles.tbody;

		return (
			<tbody ref={ref} className={tbodyClasses} {...props}>
				{children}
			</tbody>
		);
	},
);
TBody.displayName = "TBody";

export const TR = React.forwardRef<HTMLTableRowElement, TRProps>(
	({ className, children, ...props }, ref) => {
		return (
			<tr ref={ref} className={className} {...props}>
				{children}
			</tr>
		);
	},
);
TR.displayName = "TR";

export const TH = React.forwardRef<HTMLTableCellElement, THProps>(
	({ className, children, ...props }, ref) => {
		const thClasses = className ? `${styles.th} ${className}` : styles.th;

		return (
			<th ref={ref} className={thClasses} {...props}>
				{children}
			</th>
		);
	},
);
TH.displayName = "TH";

export const TD = React.forwardRef<HTMLTableCellElement, TDProps>(
	({ className, children, ...props }, ref) => {
		const tdClasses = className ? `${styles.td} ${className}` : styles.td;

		return (
			<td ref={ref} className={tdClasses} {...props}>
				{children}
			</td>
		);
	},
);
TD.displayName = "TD";
