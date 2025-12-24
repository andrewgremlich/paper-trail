import { HardDrive, Settings, Table, Timer } from "lucide-react";
import { ProjectPageTab } from "@/lib/types";
import { usePaperTrailStore } from "../lib/store";
import { Button } from "./Button";

export const Nav = () => {
	const { toggleSettingsModal, changeActiveTab, activeTab } =
		usePaperTrailStore();

	return (
		<nav className="fixed top-0 left-0 w-full z-50 flex items-center justify-between p-4 backdrop-blur-lg bg-black/60 shadow-lg">
			<div>
				<Button
					type="button"
					variant="ghost"
					onClick={() => changeActiveTab(ProjectPageTab.Timesheet)}
					className={`${activeTab === ProjectPageTab.Timesheet ? "bg-blue-600/20" : ""} mr-4`}
					aria-pressed={activeTab === ProjectPageTab.Timesheet}
				>
					<Timer size={40} />
				</Button>
				<Button
					type="button"
					variant="ghost"
					onClick={() => changeActiveTab(ProjectPageTab.Transactions)}
					className={`${activeTab === ProjectPageTab.Transactions ? "bg-blue-600/20" : ""} mr-4`}
					aria-pressed={activeTab === ProjectPageTab.Transactions}
				>
					<Table size={40} />
				</Button>
				<Button
					type="button"
					variant="ghost"
					onClick={() => changeActiveTab(ProjectPageTab.FileStorage)}
					className={`${activeTab === ProjectPageTab.FileStorage ? "bg-blue-600/20" : ""}`}
					aria-pressed={activeTab === ProjectPageTab.FileStorage}
				>
					<HardDrive size={40} />
				</Button>
			</div>

			<Button
				variant="ghost"
				onClick={toggleSettingsModal}
				type="button"
				aria-label="Open settings"
			>
				<Settings size={40} />
			</Button>
		</nav>
	);
};
