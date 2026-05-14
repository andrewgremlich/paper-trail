import { HandCoins, Settings, Table, Timer, Users } from "lucide-react";
import { Flex } from "@/components/layout/Flex";
import { Button } from "@/components/ui/Button";
import { usePaperTrailStore } from "@/lib/store";
import { ProjectPageTab } from "@/lib/types";
import { cn } from "@/lib/utils";
import styles from "./styles.module.css";

export const Nav = () => {
	const { changeActiveTab, activeTab } = usePaperTrailStore();

	return (
		<div className={styles.navWrapper}>
			<Flex as="nav" justify="between" className={styles.nav}>
				<div>
					<Button
						type="button"
						variant="secondary"
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
						variant="secondary"
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
						variant="secondary"
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
					<Button
						type="button"
						variant="secondary"
						size="icon"
						onClick={() => changeActiveTab(ProjectPageTab.Customers)}
						className={cn(
							styles.navButtonSpacing,
							activeTab === ProjectPageTab.Customers && styles.navButtonActive,
						)}
						aria-pressed={activeTab === ProjectPageTab.Customers}
						aria-label="Customers"
					>
						<Users size={40} />
					</Button>
				</div>

				<div>
					<Button
						className={cn(
							styles.settings,
							activeTab === ProjectPageTab.Settings && styles.navButtonActive,
						)}
						variant="ghost"
						size="icon"
						onClick={() => changeActiveTab(ProjectPageTab.Settings)}
						type="button"
						aria-label="Settings"
						aria-pressed={activeTab === ProjectPageTab.Settings}
					>
						<Settings size={40} />
					</Button>
				</div>
			</Flex>
		</div>
	);
};
