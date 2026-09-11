export function formatPricePerM2(pricePerM2: number): string {
  return `${Math.round(pricePerM2).toLocaleString('pl-PL')} zł/m²`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
