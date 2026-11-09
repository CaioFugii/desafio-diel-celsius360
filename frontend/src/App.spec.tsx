import { render, screen } from '@testing-library/react';
import App from './App';

function mockFetchJson(body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(body) });
}

describe('App', () => {
  it('shows the database as online when the API is healthy', async () => {
    mockFetchJson({
      status: 'ok',
      uptimeSeconds: 1,
      database: { status: 'up', timescaledb: '2.17.2' },
    });

    render(<App />);

    expect(await screen.findByText('online (TimescaleDB 2.17.2)')).toBeInTheDocument();
  });

  it('unwraps the 503 payload and shows the database as offline', async () => {
    mockFetchJson({
      message: { status: 'degraded', uptimeSeconds: 1, database: { status: 'down' } },
    });

    render(<App />);

    expect(await screen.findByText('offline')).toBeInTheDocument();
    expect(screen.getByText('degradada')).toBeInTheDocument();
  });

  it('shows an alert when the API cannot be reached', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
  });
});
