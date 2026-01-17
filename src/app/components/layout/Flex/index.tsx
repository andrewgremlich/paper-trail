import type { HTMLAttributes, JSX } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import styles from "./styles.module.css";

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

		const directionClassMap: Record<Direction, string> = {
			row: styles.flexRow,
			"row-reverse": styles.flexRowReverse,
			col: styles.flexCol,
			"col-reverse": styles.flexColReverse,
		};

		const justifyClassMap: Record<Justify, string> = {
			start: styles.justifyStart,
			end: styles.justifyEnd,
			center: styles.justifyCenter,
			between: styles.justifyBetween,
			around: styles.justifyAround,
			evenly: styles.justifyEvenly,
		};

		const itemsClassMap: Record<Items, string> = {
			start: styles.itemsStart,
			end: styles.itemsEnd,
			center: styles.itemsCenter,
			baseline: styles.itemsBaseline,
			stretch: styles.itemsStretch,
		};

		const contentClassMap: Record<Content, string> = {
			start: styles.contentStart,
			end: styles.contentEnd,
			center: styles.contentCenter,
			between: styles.contentBetween,
			around: styles.contentAround,
			evenly: styles.contentEvenly,
		};

		const wrapClassMap: Record<Wrap, string> = {
			wrap: styles.flexWrap,
			"wrap-reverse": styles.flexWrapReverse,
			nowrap: styles.flexNowrap,
		};

		const classes = cn(
			inline ? styles.inlineFlex : styles.flex,
			directionClassMap[direction],
			justify && justifyClassMap[justify],
			items && itemsClassMap[items],
			content && contentClassMap[content],
			wrap && wrapClassMap[wrap],
			className,
		);

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
