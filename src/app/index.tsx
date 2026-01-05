import { FileStorage } from "./FileStorage";
import { usePaperTrailStore } from "./lib/store";
import { ProjectPageTab } from "./lib/types";
import { Timesheet } from "./Timesheet";
import { Transactions } from "./Transactions";

export const App = () => {
	const { activeTab } = usePaperTrailStore();

	switch (activeTab) {
		case ProjectPageTab.Timesheet:
			return <Timesheet />;
		case ProjectPageTab.FileStorage:
			return <FileStorage />;
		case ProjectPageTab.Transactions:
			return <Transactions />;
		default:
			return <Timesheet />;
	}
};
