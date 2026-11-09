import { fireEvent, render, screen } from '@testing-library/react';
import { Badge } from './Badge';
import { ComfortMeter } from './ComfortMeter';
import { Pagination } from './Pagination';
import { PeriodSelector } from './PeriodSelector';
import { Empty, ErrorMessage, Loading } from './QueryState';

describe('Badge', () => {
  it('renders the text with the tone class', () => {
    render(<Badge tone="danger" title="hint">Offline</Badge>);
    expect(screen.getByText('Offline')).toHaveClass('badge--danger');
    expect(screen.getByTitle('hint')).toBeInTheDocument();
  });
});

describe('ComfortMeter', () => {
  it('exposes the value accessibly and colors it by target', () => {
    render(<ComfortMeter value={72.5} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '72.5');
    expect(meter).toHaveAttribute('aria-valuetext', '72,5%');
    expect(meter).toHaveClass('meter--danger');
  });

  it('shows a dash when there is no data', () => {
    render(<ComfortMeter value={null} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', 'sem dados');
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('PeriodSelector', () => {
  it('marks the active period and reports changes', () => {
    const onChange = jest.fn();
    render(<PeriodSelector value="7d" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Última semana' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '30 dias' }));
    expect(onChange).toHaveBeenCalledWith('30d');
  });
});

describe('Pagination', () => {
  it('shows the visible range and moves between pages', () => {
    const onChange = jest.fn();
    render(<Pagination page={3} pageSize={20} total={45} onChange={onChange} />);
    expect(screen.getByText('41–45 de 45')).toBeInTheDocument();
    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('handles an empty result', () => {
    render(<Pagination page={1} pageSize={20} total={0} onChange={jest.fn()} />);
    expect(screen.getByText('0–0 de 0')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
  });
});

describe('QueryState', () => {
  it('renders loading, error without retry and empty states', () => {
    render(
      <>
        <Loading />
        <ErrorMessage error={new Error('boom')} />
        <Empty>nothing</Empty>
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('nothing')).toBeInTheDocument();
  });
});
