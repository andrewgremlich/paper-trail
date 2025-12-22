import clsx from "clsx";
import React, {
	forwardRef,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
} from "react";

interface DialogProps {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
	titleId?: string;
	ariaLabel?: string;
	modal?: boolean;
	className?: string;
	returnFocusRef?: React.RefObject<HTMLElement>;
	initialFocusRef?: React.RefObject<HTMLElement>;
	closeOnEsc?: boolean;
	closeOnBackdrop?: boolean;
	lockScroll?: boolean;
	animate?: boolean;
	animationDuration?: number;
}

/**
 * Accessible Dialog primitive built on the native <dialog> element.
 * Handles: open/close lifecycle, focus management, optional scroll lock, ESC & backdrop close.
 */
export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
	(
		{
			isOpen,
			onClose,
			children,
			titleId,
			ariaLabel,
			modal = true,
			className,
			returnFocusRef,
			initialFocusRef,
			closeOnEsc = true,
			closeOnBackdrop = true,
			lockScroll = true,
			animate = true,
			animationDuration = 150,
		},
		forwardedRef,
	) => {
		const internalRef = useRef<HTMLDialogElement | null>(null);
		const dialogRef =
			(forwardedRef as React.MutableRefObject<HTMLDialogElement | null>) ||
			internalRef;
		const lastFocusedRef = useRef<HTMLElement | null>(null);
		const closeTimerRef = useRef<number | null>(null);
		const [stage, setStage] = React.useState<
			"closed" | "opening" | "open" | "closing"
		>("closed");
		const dataState = stage === "open" || stage === "opening" ? "open" : stage;

		useEffect(() => {
			const dialog = dialogRef.current;
			if (!dialog) return;

			if (isOpen) {
				if (closeTimerRef.current) {
					window.clearTimeout(closeTimerRef.current);
					closeTimerRef.current = null;
				}
				lastFocusedRef.current = document.activeElement as HTMLElement;
				if (!dialog.open) {
					try {
						modal ? dialog.showModal() : dialog.show();
					} catch {}
				}
				if (animate) {
					setStage((s) => (s === "closed" ? "opening" : s));
					requestAnimationFrame(() => setStage("open"));
				} else {
					setStage("open");
				}
				queueMicrotask(() => {
					if (initialFocusRef?.current) {
						initialFocusRef.current.focus();
					} else {
						const focusable = dialog.querySelector<HTMLElement>(
							'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
						);
						focusable?.focus();
					}
				});
				if (lockScroll) {
					const htmlEl = document.documentElement;
					htmlEl.dataset.dialogPrevOverflow = htmlEl.style.overflow;
					htmlEl.style.overflow = "hidden";
				}
			} else {
				if (animate && dialog.open && stage === "open") {
					setStage("closing");
					closeTimerRef.current = window.setTimeout(() => {
						if (dialog.open) dialog.close();
						if (lockScroll) {
							const htmlEl = document.documentElement;
							const prev = htmlEl.dataset.dialogPrevOverflow ?? "";
							htmlEl.style.overflow = prev;
						}
						const restoreTarget =
							returnFocusRef?.current || lastFocusedRef.current;
						restoreTarget?.focus?.();
						setStage("closed");
					}, animationDuration);
				} else {
					if (dialog.open) dialog.close();
					if (lockScroll) {
						const htmlEl = document.documentElement;
						const prev = htmlEl.dataset.dialogPrevOverflow ?? "";
						htmlEl.style.overflow = prev;
					}
					const restoreTarget =
						returnFocusRef?.current || lastFocusedRef.current;
					restoreTarget?.focus?.();
					setStage("closed");
				}
			}

			return () => {
				if (closeTimerRef.current) {
					window.clearTimeout(closeTimerRef.current);
					closeTimerRef.current = null;
				}
				if (dialog.open && stage !== "closing") dialog.close();
				if (lockScroll) {
					const htmlEl = document.documentElement;
					const prev = htmlEl.dataset.dialogPrevOverflow ?? "";
					htmlEl.style.overflow = prev;
				}
			};
		}, [
			isOpen,
			modal,
			initialFocusRef,
			returnFocusRef,
			lockScroll,
			animate,
			animationDuration,
			stage,
			dialogRef,
		]);

		useEffect(() => {
			if (!isOpen || !closeOnEsc) return;
			const handler = (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					e.stopPropagation();
					onClose();
				}
			};
			window.addEventListener("keydown", handler, { capture: true });
			return () =>
				window.removeEventListener("keydown", handler, { capture: true });
		}, [isOpen, closeOnEsc, onClose]);

		const handlePointerDown = useCallback(
			(e: React.MouseEvent<HTMLDialogElement>) => {
				if (!closeOnBackdrop) return;
				const el = dialogRef.current;
				if (el && e.target === el) onClose();
			},
			[closeOnBackdrop, onClose, dialogRef],
		);

		const handleCancel: React.ReactEventHandler<HTMLDialogElement> = (e) => {
			e.preventDefault();
			if (closeOnEsc) onClose();
		};

		return (
			<dialog
				ref={dialogRef}
				onCancel={handleCancel}
				onPointerDown={handlePointerDown}
				data-state={dataState}
				aria-modal={modal ? "true" : undefined}
				aria-labelledby={titleId}
				aria-label={titleId ? undefined : ariaLabel}
				className={clsx(
					"fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0 w-full max-w-3xl",
					"rounded-md p-4 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 backdrop:backdrop-blur-sm",
					animate &&
						"opacity-0 scale-95 data-[state=open]:opacity-100 data-[state=open]:scale-100 transition-all duration-150 ease-out will-change-transform will-change-opacity",
					className,
				)}
				style={
					animate ? { transitionDuration: `${animationDuration}ms` } : undefined
				}
			>
				{children}
			</dialog>
		);
	},
);

Dialog.displayName = "Dialog";
