import * as React from "react";
import { cn } from "../lib/utils";

type TableProps = React.TableHTMLAttributes<HTMLTableElement>;
type THeadProps = React.HTMLAttributes<HTMLTableSectionElement>;
type TBodyProps = React.HTMLAttributes<HTMLTableSectionElement>;
type TRProps = React.HTMLAttributes<HTMLTableRowElement>;
type THProps = React.ThHTMLAttributes<HTMLTableCellElement>;
type TDProps = React.TdHTMLAttributes<HTMLTableCellElement>;

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
	({ className, children, ...props }, ref) => {
		return (
			<div className="rounded-lg border overflow-hidden">
				<table
					ref={ref}
					className={cn("w-full border-separate border-spacing-0", className)}
					{...props}
				>
					{children}
				</table>
			</div>
		);
	},
);
Table.displayName = "Table";

export const THead = React.forwardRef<HTMLTableSectionElement, THeadProps>(
	({ className, children, ...props }, ref) => {
		return (
			<thead ref={ref} className={cn("bg-gray-50", className)} {...props}>
				{children}
			</thead>
		);
	},
);
THead.displayName = "THead";

export const TBody = React.forwardRef<HTMLTableSectionElement, TBodyProps>(
	({ className, children, ...props }, ref) => {
		return (
			<tbody
				ref={ref}
				className={cn("bg-white divide-y divide-gray-200", className)}
				{...props}
			>
				{children}
			</tbody>
		);
	},
);
TBody.displayName = "TBody";

export const TR = React.forwardRef<HTMLTableRowElement, TRProps>(
	({ className, children, ...props }, ref) => {
		return (
			<tr ref={ref} className={cn(className)} {...props}>
				{children}
			</tr>
		);
	},
);
TR.displayName = "TR";

export const TH = React.forwardRef<HTMLTableCellElement, THProps>(
	({ className, children, ...props }, ref) => {
		return (
			<th
				ref={ref}
				className={cn(
					"px-4 py-3 text-left text-sm font-medium text-gray-900",
					className,
				)}
				{...props}
			>
				{children}
			</th>
		);
	},
);
TH.displayName = "TH";

export const TD = React.forwardRef<HTMLTableCellElement, TDProps>(
	({ className, children, ...props }, ref) => {
		return (
			<td
				ref={ref}
				className={cn("px-4 py-3 text-sm text-gray-900", className)}
				{...props}
			>
				{children}
			</td>
		);
	},
);
TD.displayName = "TD";
