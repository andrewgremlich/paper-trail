import { DeleteDataSection } from "./components/features/settings/DeleteDataSection";
import { EmailDeliverySection } from "./components/features/settings/EmailDeliverySection";
import { ExportImportSection } from "./components/features/settings/ExportImportSection";
import { InvoiceProfileSection } from "./components/features/settings/InvoiceProfileSection";
import { ThemeSection } from "./components/features/settings/ThemeSection";
import { H1, Main, P } from "./components/layout/HtmlElements";

export const Settings = () => {
	return (
		<Main>
			<H1>Settings</H1>
			<P>Modify settings for the application here.</P>
			<ThemeSection />
			<InvoiceProfileSection />
			<EmailDeliverySection />
			<ExportImportSection />
			<DeleteDataSection />
		</Main>
	);
};
