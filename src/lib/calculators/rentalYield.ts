// Pure functions — no UI, no I/O. Amounts in OMR.

export type RentalYieldInput = {
  purchasePrice: number;
  monthlyRent: number;
  annualExpenses: number;
};

export type RentalYieldResult = {
  annualRent: number;
  annualNet: number;
  grossYieldPct: number;
  netYieldPct: number;
};

export function rentalYield(input: RentalYieldInput): RentalYieldResult {
  const { purchasePrice, monthlyRent, annualExpenses } = input;
  if (purchasePrice <= 0) {
    return { annualRent: 0, annualNet: 0, grossYieldPct: 0, netYieldPct: 0 };
  }
  const annualRent = monthlyRent * 12;
  const annualNet = annualRent - annualExpenses;
  return {
    annualRent,
    annualNet,
    grossYieldPct: (annualRent / purchasePrice) * 100,
    netYieldPct: (annualNet / purchasePrice) * 100,
  };
}
