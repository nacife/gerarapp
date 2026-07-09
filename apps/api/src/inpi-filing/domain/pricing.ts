export interface PricingBreakdown {
  serviceFeeCents: number;
  gruFeeCents: number;
  totalCents: number;
}

/** Preço do Registro Assistido: honorários EduForge + repasse da GRU 730, sempre decompostos (§3.2). */
export function computePricing(serviceFeeCents: number, gruFeeCents: number): PricingBreakdown {
  return { serviceFeeCents, gruFeeCents, totalCents: serviceFeeCents + gruFeeCents };
}
