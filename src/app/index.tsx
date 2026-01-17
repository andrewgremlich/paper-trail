import { Invoices } from "./Invoices";
import { usePaperTrailStore } from "./lib/store";
import { ProjectPageTab } from "./lib/types";
import { Timesheets } from "./Timesheets";
import { Transactions } from "./Transactions";

export const App = () => {
	const { activeTab } = usePaperTrailStore();

	switch (activeTab) {
		case ProjectPageTab.Timesheets:
			return <Timesheets />;
		case ProjectPageTab.Transactions:
			return <Transactions />;
		case ProjectPageTab.Invoices:
			return <Invoices />;
		default:
			return <Timesheets />;
	}
};
