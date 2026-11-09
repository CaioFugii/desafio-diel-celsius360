import { render, screen, within } from '@testing-library/react';
import { Gap } from '../../api/types';
import { GapList, MAX_LISTED_GAPS } from './GapList';

const gapAt = (hour: number): Gap => ({
  from: new Date(Date.UTC(2026, 1, 10, hour, 0)).toISOString(),
  to: new Date(Date.UTC(2026, 1, 10, hour, 20)).toISOString(),
});

describe('GapList', () => {
  it('says so when there are no gaps', () => {
    render(<GapList gaps={[]} timeZone="UTC" />);
    expect(screen.getByText('Nenhuma falha de comunicação no período.')).toBeInTheDocument();
  });

  it('lists the newest gaps first and summarizes the rest', () => {
    const gaps = Array.from({ length: MAX_LISTED_GAPS + 3 }, (_, i) => gapAt(i));
    render(<GapList gaps={gaps} timeZone="UTC" />);

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(MAX_LISTED_GAPS);
    expect(rows[0]).toHaveTextContent('10/02, 22:00');
    expect(rows[0]).toHaveTextContent('20 min');
    expect(screen.getByText('e mais 3 falhas mais antigas.')).toBeInTheDocument();
  });
});
