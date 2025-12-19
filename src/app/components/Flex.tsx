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

		const classes = [
			inline ? "inline-flex" : "flex",
			direction ? `flex-${direction}` : null,
			justify ? `justify-${justify}` : null,
			items ? `items-${items}` : null,
			content ? `content-${content}` : null,
			wrap ? (wrap === "nowrap" ? "flex-nowrap" : `flex-${wrap}`) : null,
			gap !== undefined && gap !== null ? `gap-${gap}` : null,
			className,
		]
			.filter(Boolean)
			.join(" ");

		return (
			<Comp
				className={classes}
				{...(rest as unknown as Record<string, unknown>)}
			/>
		);
	},
);

Flex.displayName = "Flex";
