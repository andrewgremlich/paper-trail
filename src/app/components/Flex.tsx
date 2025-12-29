import type { HTMLAttributes, JSX } from "react";
import { forwardRef } from "react";

type Direction = "row" | "row-reverse" | "col" | "col-reverse";
type Justify = "start" | "end" | "center" | "between" | "around" | "evenly";
type Items = "start" | "end" | "center" | "baseline" | "stretch";
type Content = "start" | "end" | "center" | "between" | "around" | "evenly";
type Wrap = "wrap" | "nowrap" | "wrap-reverse";

export type FlexProps = HTMLAttributes<HTMLElement> & {
	as?: keyof JSX.IntrinsicElements;
	direction?: Direction;
	justify?: Justify;
	items?: Items;
	content?: Content;
	wrap?: Wrap;
	gap?: string | number;
	inline?: boolean;
	className?: string;
};

export const Flex = forwardRef<HTMLElement, FlexProps>(
	(
		{
			as = "div",
			direction = "row",
			justify,
			items,
			content,
			wrap,
			gap,
			inline = false,
			className,
			...rest
		},
		_ref,
	) => {
		const Comp: keyof JSX.IntrinsicElements = as;

		// Use explicit class maps so Tailwind can statically detect classes
		const directionClassMap: Record<Direction, string> = {
			row: "flex-row",
			"row-reverse": "flex-row-reverse",
			col: "flex-col",
			"col-reverse": "flex-col-reverse",
		};

		const justifyClassMap: Record<Justify, string> = {
			start: "justify-start",
			end: "justify-end",
			center: "justify-center",
			between: "justify-between",
			around: "justify-around",
			evenly: "justify-evenly",
		};

		const itemsClassMap: Record<Items, string> = {
			start: "items-start",
			end: "items-end",
			center: "items-center",
			baseline: "items-baseline",
			stretch: "items-stretch",
		};

		const contentClassMap: Record<Content, string> = {
			start: "content-start",
			end: "content-end",
			center: "content-center",
			between: "content-between",
			around: "content-around",
			evenly: "content-evenly",
		};

		const wrapClassMap: Record<Wrap, string> = {
			wrap: "flex-wrap",
			"wrap-reverse": "flex-wrap-reverse",
			nowrap: "flex-nowrap",
		};

		const classes = [
			inline ? "inline-flex" : "flex",
			directionClassMap[direction],
			justify ? justifyClassMap[justify] : null,
			items ? itemsClassMap[items] : null,
			content ? contentClassMap[content] : null,
			wrap ? wrapClassMap[wrap] : null,
			className,
		]
			.filter(Boolean)
			.join(" ");

		// Prefer inline style for gap to avoid dynamic class generation
		const { style, ...restProps } = rest as HTMLAttributes<HTMLElement>;
		const mergedStyle =
			gap !== undefined && gap !== null
				? {
					...style,
					gap: typeof gap === "number" ? `${gap}px` : gap,
				}
				: style;

		return (
			<Comp
				className={classes}
				style={mergedStyle}
				{...(restProps as unknown as Record<string, unknown>)}
			/>
		);
	},
);

Flex.displayName = "Flex";
