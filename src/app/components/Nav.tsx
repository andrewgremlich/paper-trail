import { HardDrive, Settings, Table, Timer } from "lucide-react";
import { ProjectPageTab } from "@/lib/types";
import { usePaperTrailStore } from "../lib/store";
import { Button } from "./Button";
import { Flex } from "./Flex";

export const Nav = () => {
	const { toggleSettingsModal, changeActiveTab, activeTab } =
		usePaperTrailStore();

	return (
		<Flex
			as="nav"
			justify="between"
			className="fixed top-0 left-0 right-0 py-6 px-4"
		>
			<div>
				<Button
					type="button"
					variant="liquidGlass"
					size="icon"
					onClick={() => changeActiveTab(ProjectPageTab.Timesheet)}
					className={`${activeTab === ProjectPageTab.Timesheet ? "bg-blue-600/20" : ""} mr-4`}
					aria-pressed={activeTab === ProjectPageTab.Timesheet}
				>
					<Timer size={40} />
				</Button>
				<Button
					type="button"
					variant="liquidGlass"
					size="icon"
					onClick={() => changeActiveTab(ProjectPageTab.Transactions)}
					className={`${activeTab === ProjectPageTab.Transactions ? "bg-blue-600/20" : ""} mr-4`}
					aria-pressed={activeTab === ProjectPageTab.Transactions}
				>
					<Table size={40} />
				</Button>
				<Button
					type="button"
					variant="liquidGlass"
					size="icon"
					onClick={() => changeActiveTab(ProjectPageTab.FileStorage)}
					className={`${activeTab === ProjectPageTab.FileStorage ? "bg-blue-600/20" : ""}`}
					aria-pressed={activeTab === ProjectPageTab.FileStorage}
				>
					<HardDrive size={40} />
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
	);
};
