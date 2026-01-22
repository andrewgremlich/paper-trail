import { Edit, FolderOpen, Globe, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TD } from "@/components/ui/Table";
import type { Project, Transaction } from "@/lib/db";
import { openAttachment } from "@/lib/files/fileStorage";
import { formatDate } from "@/lib/utils";
import styles from "./styles.module.css";

interface TransactionViewRowProps {
  tx: Transaction;
  projects: Project[] | undefined;
  path: string;
  onEdit: () => void;
  onDelete: (formData: FormData) => Promise<void>;
}

export const TransactionViewRow = ({
  tx,
  projects,
  path,
  onEdit,
  onDelete,
}: TransactionViewRowProps) => (
  <>
    <TD>
      <span>{formatDate(tx.date)}</span>
    </TD>
    <TD>
      <span>{tx.description}</span>
    </TD>
    <TD>
      <span>
        {projects?.find((project) => project.id === tx.projectId)?.name}
      </span>
    </TD>
    <TD>
      <span>${tx.amount.toFixed(2)}</span>
    </TD>
    <TD>
      {path.length > 0 ? (
        <Button
          aria-label="Open Invoice Location"
          type="button"
          size="sm"
          variant="ghost"
          onClick={async () => {
            await openAttachment(path);
          }}
        >
          {path.startsWith("http://") || path.startsWith("https://") ? (
            <Globe />
          ) : (
            <FolderOpen />
          )}
        </Button>
      ) : (
        <span className={styles.noFile} aria-label="No attachment">
          No File
        </span>
      )}
    </TD>
    <TD>
      <Button
        variant="ghost"
        type="button"
        onClick={onEdit}
        aria-label="Edit Transaction"
      >
        <Edit />
      </Button>
    </TD>
    <TD>
      <form
        onSubmit={async (evt) => {
          evt.preventDefault();
          const confirmed = window.confirm(
            "Are you sure you want to delete this transaction?",
          );
          if (!confirmed) return;
          const fd = new FormData(evt.currentTarget);
          await onDelete(fd);
        }}
      >
        <input type="hidden" name="id" value={tx.id} />
        <Button
          variant="ghost"
          size="icon"
          type="submit"
          aria-label="Delete Transaction"
        >
          <TrashIcon />
        </Button>
      </form>
    </TD>
  </>
);
