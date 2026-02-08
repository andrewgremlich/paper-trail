import { HandCoins, Settings, Table, Timer } from "lucide-react";
import { Flex } from "@/components/layout/Flex";
import { Button } from "@/components/ui/Button";
import { usePaperTrailStore } from "@/lib/store";
import { ProjectPageTab } from "@/lib/types";
import { cn } from "@/lib/utils";
import styles from "./styles.module.css";

export const Nav = () => {
	const { toggleSettingsModal, changeActiveTab, activeTab } =
		usePaperTrailStore();

	return (
		<div className={styles.navWrapper}>
			<Flex as="nav" justify="between" className={styles.nav}>
				<div>
					<Button
						type="button"
						variant="liquidGlass"
						size="icon"
						onClick={() => changeActiveTab(ProjectPageTab.Timesheets)}
						className={cn(
							styles.navButtonSpacing,
							activeTab === ProjectPageTab.Timesheets && styles.navButtonActive,
						)}
						aria-pressed={activeTab === ProjectPageTab.Timesheets}
					>
						<Timer size={40} />
					</Button>
					<Button
						type="button"
						variant="liquidGlass"
						size="icon"
						onClick={() => changeActiveTab(ProjectPageTab.Transactions)}
						className={cn(
							styles.navButtonSpacing,
							activeTab === ProjectPageTab.Transactions &&
								styles.navButtonActive,
						)}
						aria-pressed={activeTab === ProjectPageTab.Transactions}
					>
						<Table size={40} />
					</Button>
					<Button
						type="button"
						variant="liquidGlass"
						size="icon"
						onClick={() => changeActiveTab(ProjectPageTab.Invoices)}
						className={cn(
							styles.navButtonSpacing,
							activeTab === ProjectPageTab.Invoices && styles.navButtonActive,
						)}
						aria-pressed={activeTab === ProjectPageTab.Invoices}
					>
						<HandCoins size={40} />
					</Button>
				</div>

				<Button
					variant="liquidGlass"
					size="icon"
					onClick={toggleSettingsModal}
					type="button"
					aria-label="Open settings"
				>
					<Settings size={40} />
				</Button>
			</Flex>
		</div>
	);
};
