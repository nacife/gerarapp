export interface PlanSeed {
  key: 'free' | 'pro' | 'business';
  name: string;
  priceCentsMonth: number;
  limits: {
    apps: number;
    uploadMb: number;
    aiCreditsMonthly: number;
    customDomains: number;
    sso: boolean;
  };
}

/** Planos base do MVP (PRD RF-13, §0.4 M0). */
export const PLANS: PlanSeed[] = [
  {
    key: 'free',
    name: 'Free',
    priceCentsMonth: 0,
    limits: { apps: 1, uploadMb: 50, aiCreditsMonthly: 200, customDomains: 0, sso: false },
  },
  {
    key: 'pro',
    name: 'Pro',
    priceCentsMonth: 4900,
    limits: { apps: 10, uploadMb: 200, aiCreditsMonthly: 3000, customDomains: 1, sso: false },
  },
  {
    key: 'business',
    name: 'Business',
    priceCentsMonth: 19900,
    limits: { apps: 100, uploadMb: 200, aiCreditsMonthly: 20000, customDomains: 10, sso: true },
  },
];
