import { useMutation, useQuery } from "@tanstack/react-query";
import { H1, H2, Main } from "@/components/layout/HtmlElements";
import styles from "./Page.module.css";

export const Invoices = () => {
	const invoices = useQuery({
		queryKey: ["invoices"],
		queryFn: async () => {
			// Placeholder for fetching one-time invoices
			return [];
		},
	});
	const generateInvoice = useMutation({
		mutationFn: async (invoiceData: any) => {
			// Placeholder for generating a one-time invoice
			return {};
		},
	});

	return (
		<Main className={styles.container}>
			<H1>Invoices</H1>
      <div>
        <H2>Invoices Table here</H2>
      </div>
      <form>
        <H2>Generate Invoice (could be modal)</H2>
      </form>
		</Main>
	);
};
