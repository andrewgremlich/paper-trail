import { Customers } from "./Customers";
import { Files } from "./Files";
import { Invoices } from "./Invoices";
import { usePaperTrailStore } from "./lib/store";
import { ProjectPageTab } from "./lib/types";
import { Settings } from "./Settings";
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
		case ProjectPageTab.Customers:
			return <Customers />;
		case ProjectPageTab.Files:
			return <Files />;
		case ProjectPageTab.Settings:
			return <Settings />;
		default:
			return <Timesheets />;
	}
};
