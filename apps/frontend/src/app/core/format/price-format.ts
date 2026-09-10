export function formatPricePerM2(pricePerM2: number): string {
  return `${Math.round(pricePerM2).toLocaleString('pl-PL')} zł/m²`;
}
