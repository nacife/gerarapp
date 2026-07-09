import { getRequestConfig } from 'next-intl/server';

// MVP monolíngue (pt-BR); a estrutura já suporta en/es depois (§0.5.10).
export default getRequestConfig(async () => {
  const locale = 'pt-BR';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
