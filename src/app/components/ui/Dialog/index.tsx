import clsx from "clsx";
import {
	forwardRef,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
} from "react";
import { createPortal } from "react-dom";
import styles from "./styles.module.css";

// Shared back-button handling across all Dialog instances.
//
// A single history entry is pushed when the first dialog opens and popped
// when the last one closes. Each open dialog registers an onClose callback;
// a back/escape navigation closes the most-recently-opened dialog.
//
// This must be shared (not per-instance) because switching directly from
// one modal to another mounts the new dialog and unmounts the old in the
// same commit. A per-instance "pushState on open / history.back() on close"
// scheme would have the closing dialog's history.back() asynchronously pop
// the entry the opening dialog just pushed — closing the new modal the
// instant it appears. Ref-counting the single entry avoids that race.
const openDialogClosers: Array<() => void> = [];
let dialogHistoryActive = false;
// When the last dialog closes we want to pop our guard history entry — but
// only if no dialog re-opens in the same tick (a modal-to-modal switch
// unmounts one dialog and mounts the next in one commit). Defer the pop so
// an imminent re-registration can cancel it.
let pendingTeardown = false;

const handleDialogPopstate = () => {
	dialogHistoryActive = false;
	const close = openDialogClosers[openDialogClosers.length - 1];
	// Re-arm the guard entry while any dialog is still open so a subsequent
	// back press is still intercepted rather than navigating the app away.
	if (openDialogClosers.length > 0) {
		history.pushState({ dialogModal: true }, "");
		dialogHistoryActive = true;
	}
	close?.();
};

const registerOpenDialog = (onClose: () => void): (() => void) => {
	// A dialog opened before the deferred teardown ran — cancel it and reuse
	// the still-active history entry/listener instead of tearing down and
	// immediately rebuilding (which is the modal-switch race).
	pendingTeardown = false;
	if (openDialogClosers.length === 0 && !dialogHistoryActive) {
		history.pushState({ dialogModal: true }, "");
		dialogHistoryActive = true;
		window.addEventListener("popstate", handleDialogPopstate);
	}
	openDialogClosers.push(onClose);

	return () => {
		const idx = openDialogClosers.lastIndexOf(onClose);
		if (idx !== -1) openDialogClosers.splice(idx, 1);
		if (openDialogClosers.length > 0) return;
		// Last dialog closed. Defer the actual teardown; if another dialog
		// registers before this runs, pendingTeardown is reset and we keep the
		// guard entry alive — no spurious history.back() to pop a new modal.
		pendingTeardown = true;
		queueMicrotask(() => {
			if (!pendingTeardown || openDialogClosers.length > 0) return;
			pendingTeardown = false;
			window.removeEventListener("popstate", handleDialogPopstate);
			if (dialogHistoryActive && history.state?.dialogModal) {
				dialogHistoryActive = false;
				history.back();
			}
		});
	};
};

interface DialogProps {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
	titleId?: string;
	ariaLabel?: string;
	className?: string;
	variant?: "solid";
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

		// Browser back button closes the dialog. Registration is shared across
		// all Dialog instances (see registerOpenDialog) so switching directly
		// between modals doesn't trigger a history.back() that closes the new
		// modal the instant it opens.
		useEffect(() => {
			if (!isOpen) return;
			return registerOpenDialog(() => onCloseRef.current());
		}, [isOpen]);

		return createPortal(
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
				<div className={styles.scrollBody}>{children}</div>
			</dialog>,
			document.body,
		);
	},
);

Dialog.displayName = "Dialog";
