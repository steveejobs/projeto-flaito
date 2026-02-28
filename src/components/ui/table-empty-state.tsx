import { TableRow, TableCell } from "./table";

interface TableEmptyStateProps {
  colSpan: number;
  message?: string;
}

export function TableEmptyState({
  colSpan,
  message = "Nenhum registro encontrado.",
}: TableEmptyStateProps) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="h-32 text-center text-sm text-muted-foreground"
      >
        {message}
      </TableCell>
    </TableRow>
  );
}
