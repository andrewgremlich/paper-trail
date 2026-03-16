import clsx from "clsx";
import {
	forwardRef,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
} from "react";
import styles from "./styles.module.css";

interface DialogProps {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
	titleId?: string;
	ariaLabel?: string;
	className?: string;
	variant?: "solid" | "liquidGlass";
}

export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
	(
		{
			isOpen,
			onClose,
			children,
			titleId,
			ariaLabel,
			className,
			variant = "solid",
		},
		forwardedRef,
	) => {
		const internalRef = useRef<HTMLDialogElement | null>(null);
		const dialogRef =
			(forwardedRef as React.RefObject<HTMLDialogElement | null>) ||
			internalRef;
		const onCloseRef = useRef(onClose);
		onCloseRef.current = onClose;

		// Open/close the native dialog
		useEffect(() => {
			const dialog = dialogRef.current;
			if (!dialog) return;

			if (isOpen) {
				if (!dialog.open) {
					dialog.showModal();
				}
			} else {
				if (dialog.open) {
					dialog.close();
				}
			}
		}, [isOpen, dialogRef]);

		// Handle native cancel event (Escape key) and backdrop click
		const handleCancel = useCallback(
			(e: React.SyntheticEvent<HTMLDialogElement>) => {
				e.preventDefault();
				onClose();
			},
			[onClose],
		);

		const handlePointerDown = useCallback(
			(e: React.MouseEvent<HTMLDialogElement>) => {
				if (dialogRef.current && e.target === dialogRef.current) {
					onClose();
				}
			},
			[onClose, dialogRef],
		);

		// Browser back button closes the dialog
		useEffect(() => {
			if (!isOpen) return;
			history.pushState({ dialogModal: true }, "");
			const handler = () => onCloseRef.current();
			window.addEventListener("popstate", handler);
			return () => {
				window.removeEventListener("popstate", handler);
				if (history.state?.dialogModal) {
					history.back();
				}
			};
		}, [isOpen]);

		return (
			<dialog
				ref={dialogRef}
				onCancel={handleCancel}
				onPointerDown={handlePointerDown}
				aria-modal="true"
				aria-labelledby={titleId}
				aria-label={titleId ? undefined : ariaLabel}
				className={clsx(
					styles.dialog,
					styles[variant],
					styles.animate,
					className,
				)}
				data-variant={variant}
			>
				{children}
			</dialog>
		);
	},
);

Dialog.displayName = "Dialog";
