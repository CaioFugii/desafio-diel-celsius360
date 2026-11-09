export interface CustomerSummary {
  id: string;
  name: string;
  segment: string | null;
  stores: number;
}

export abstract class CustomersReader {
  abstract list(): Promise<CustomerSummary[]>;
}
