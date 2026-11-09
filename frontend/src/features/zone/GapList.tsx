import { Gap } from '../../api/types';
import { formatDateTime, formatDuration } from '../../lib/format';

export const MAX_LISTED_GAPS = 20;

export function GapList({ gaps, timeZone }: { gaps: Gap[]; timeZone: string }) {
  if (gaps.length === 0) {
    return <p className="muted">Nenhuma falha de comunicação no período.</p>;
  }
  const newestFirst = [...gaps].reverse();
  const listed = newestFirst.slice(0, MAX_LISTED_GAPS);
  return (
    <>
      <table className="table table--compact">
        <thead>
          <tr>
            <th scope="col">Início</th>
            <th scope="col">Fim</th>
            <th scope="col">Duração</th>
          </tr>
        </thead>
        <tbody>
          {listed.map((g) => (
            <tr key={g.from}>
              <td>{formatDateTime(g.from, timeZone)}</td>
              <td>{formatDateTime(g.to, timeZone)}</td>
              <td>{formatDuration((Date.parse(g.to) - Date.parse(g.from)) / 60_000)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {gaps.length > listed.length && (
        <p className="muted">e mais {gaps.length - listed.length} falhas mais antigas.</p>
      )}
    </>
  );
}
