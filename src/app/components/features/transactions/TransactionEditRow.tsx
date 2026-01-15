import { Ban, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TD } from "@/components/ui/Table";
import type { Project, Transaction } from "@/lib/db";
import { openAttachment } from "@/lib/fileStorage";

interface TransactionEditRowProps {
	tx: Transaction;
	projects: Project[] | undefined;
	path: string;
	onSave: (formData: FormData) => Promise<void>;
	onCancel: () => void;
}

export const TransactionEditRow = ({
	tx,
	projects,
	path,
	onSave,
	onCancel,
}: TransactionEditRowProps) => (
	<>
		<TD>
			<Input
				name="date"
				type="date"
				defaultValue={tx.date}
				form={`tx-edit-form-${tx.id}`}
				required
			/>
		</TD>
		<TD>
			<Input
				name="description"
				type="text"
				defaultValue={tx.description}
				form={`tx-edit-form-${tx.id}`}
				required
			/>
		</TD>
		<TD>
			<Select
				name="projectId"
				value={tx.projectId}
				options={
					projects?.map((project) => ({
						value: project.id,
						label: project.name,
					})) ?? []
				}
				form={`tx-edit-form-${tx.id}`}
			/>
		</TD>
		<TD>
			<Input
				name="amount"
				type="number"
				step="0.01"
				className="w-32"
				defaultValue={tx.amount.toFixed(2)}
				form={`tx-edit-form-${tx.id}`}
				required
			/>
		</TD>
		<TD>
			{path.length > 0 ? (
				<Button
					type="button"
					variant="ghost"
					className="text-blue-500 underline"
					onClick={async () => {
						await openAttachment(path);
					}}
				>
					View File
				</Button>
			) : (
				<span className="text-gray-500">No File</span>
			)}
		</TD>
		<TD>
			<form
				id={`tx-edit-form-${tx.id}`}
				onSubmit={async (evt) => {
					evt.preventDefault();
					const fd = new FormData(evt.currentTarget);
					fd.set("id", String(tx.id));
					try {
						await onSave(fd);
					} catch (e) {
						console.error(e);
					}
				}}
			>
				<Button type="submit" size="sm" variant="ghost">
					<Save color="black" />
				</Button>
			</form>
		</TD>
		<TD>
			<Button type="button" size="sm" variant="ghost" onClick={onCancel}>
				<Ban color="black" />
			</Button>
		</TD>
	</>
);
