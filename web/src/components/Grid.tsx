import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cell } from "./Cell";
import type { CurrentCell } from "@/lib/types";

const MARKETS = ["US", "UK", "CA/EN", "CA/FR", "AU", "NZ", "DE", "FR", "BE/FR", "BE/NL", "SE"];
const CONCERNS = ["main", "coachlist", "coachdet", "eventdet", "locdet"] as const;

export function Grid({ cells, onSelect }: { cells: CurrentCell[]; onSelect: (c: CurrentCell) => void }) {
  const byKey = new Map(cells.map((c) => [`${c.market}|${c.concern}`, c]));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Market</TableHead>
          {CONCERNS.map((c) => <TableHead key={c} className="text-center">{c}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {MARKETS.map((m) => (
          <TableRow key={m}>
            <TableCell className="font-medium">{m}</TableCell>
            {CONCERNS.map((concern) => {
              const cell = byKey.get(`${m}|${concern}`);
              return <Cell key={concern} cell={cell} onClick={() => cell && onSelect(cell)} />;
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
