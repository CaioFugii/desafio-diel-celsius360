import { render, screen } from '@testing-library/react';
import { zoneSeries } from '../../testing/fixtures';
import { ChartRow } from './chart-data';
import { ChartTooltip, TemperatureChart } from './TemperatureChart';

const SP = 'America/Sao_Paulo';

describe('TemperatureChart', () => {
  it('draws the comfort band, the gap areas and the average line', () => {
    const { container } = render(<TemperatureChart series={zoneSeries()} timeZone={SP} />);

    expect(container.querySelectorAll('.recharts-reference-area')).toHaveLength(2);
    expect(container.querySelector('.recharts-line')).toBeInTheDocument();
    expect(screen.getByText(/Faixa de conforto \(20,0 °C – 24,0 °C\)/)).toBeInTheDocument();
    expect(screen.getByText('Sem dados (falha ≥ 15 min)')).toBeInTheDocument();
  });

  it('labels the time axis with hours for one day and with dates for longer periods', () => {
    const { container, rerender } = render(<TemperatureChart series={zoneSeries()} timeZone={SP} />);
    const ticks = () =>
      [...container.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick-value')].map(
        (t) => t.textContent,
      );
    expect(ticks().every((t) => /^\d{2}:\d{2}$/.test(t ?? ''))).toBe(true);

    rerender(
      <TemperatureChart
        series={zoneSeries({ from: '2026-02-03T12:00:00Z', to: '2026-02-10T12:00:00Z', gaps: [] })}
        timeZone={SP}
      />,
    );
    expect(ticks().every((t) => /^\d{2}\/\d{2}$/.test(t ?? ''))).toBe(true);
  });
});

describe('ChartTooltip', () => {
  const row: ChartRow = {
    t: Date.parse('2026-02-10T12:00:00Z'),
    avg: 21.456,
    range: [21.2, 21.8],
    samples: 2,
  };
  const payload = (r: ChartRow) => [{ payload: r, value: r.avg ?? 0 }];

  it('shows time in the store zone, average, min/max and sample count', () => {
    render(<ChartTooltip active payload={payload(row)} timeZone={SP} />);
    expect(screen.getByText('10/02, 09:00')).toBeInTheDocument();
    expect(screen.getByText('Média 21,46 °C')).toBeInTheDocument();
    expect(screen.getByText('Mín 21,2 °C · Máx 21,8 °C')).toBeInTheDocument();
    expect(screen.getByText('2 leituras')).toBeInTheDocument();
  });

  it('renders nothing when inactive or over a gap', () => {
    const { container, rerender } = render(
      <ChartTooltip active={false} payload={payload(row)} timeZone={SP} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<ChartTooltip active payload={payload({ ...row, avg: null, range: null })} timeZone={SP} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ChartTooltip active payload={[]} timeZone={SP} />);
    expect(container).toBeEmptyDOMElement();
  });
});
