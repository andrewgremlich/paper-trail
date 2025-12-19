import { File, Settings, Table, Timer } from "lucide-react";
import { ProjectPageTab } from "@/lib/types";
import { useSimpletimesheetStore } from "../lib/store";

export const Nav = () => {
	const { toggleSettingsModal, changeActiveTab } = useSimpletimesheetStore();

	return (
		<nav className="fixed top-0 left-0 w-full z-50 flex items-center justify-between p-4">
			<button
				className="cursor-pointer"
				onClick={toggleSettingsModal}
				type="button"
			>
				<Settings size={40} />
			</button>
			<div>
				<button
					className="cursor-pointer"
					type="button"
					onClick={() => changeActiveTab(ProjectPageTab.Accounting)}
				>
					<Table size={40} />
				</button>
				<button
					className="cursor-pointer"
					type="button"
					onClick={() => changeActiveTab(ProjectPageTab.Timesheet)}
				>
					<Timer size={40} />
				</button>
				<button
					className="cursor-pointer"
					type="button"
					onClick={() => changeActiveTab(ProjectPageTab.FileStorage)}
				>
					<File size={40} />
				</button>
			</div>
		</nav>
	);
};
