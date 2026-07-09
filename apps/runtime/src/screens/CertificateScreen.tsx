import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { RuntimeTheme } from '../interactions/theme';

interface VerifyResult {
  valid: boolean;
  learnerName: string;
  projectTitle: string;
  issuedAt: string;
}

export function CertificateScreen({ theme, verifyCode }: { theme: RuntimeTheme; verifyCode: string }) {
  const [info, setInfo] = useState<VerifyResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<VerifyResult>(`/public/certificates/${verifyCode}/verify`).then((res) => {
      if (res.ok && res.data) setInfo(res.data);
    });
  }, [verifyCode]);

  async function download() {
    const res = await apiFetch<{ url: string }>(`/public/certificates/${verifyCode}/pdf`);
    if (res.ok && res.data) {
      setDownloadUrl(res.data.url);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div style={{ background: theme.bg, color: theme.text }} className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full text-3xl" style={{ background: theme.accent }}>
          🏆
        </div>
        <h1 className="text-2xl font-bold">Parabéns, curso concluído!</h1>
        {info ? (
          <div className="mt-4 rounded-xl border p-5" style={{ borderColor: theme.border, background: theme.surface }}>
            <p style={{ color: theme.muted }} className="text-sm">
              Certificado de conclusão
            </p>
            <p className="mt-1 text-lg font-semibold">{info.learnerName}</p>
            <p style={{ color: theme.muted }} className="text-sm">
              {info.projectTitle}
            </p>
            <p style={{ color: theme.muted }} className="mt-2 text-xs">
              Emitido em {new Date(info.issuedAt).toLocaleDateString('pt-BR')} · código {verifyCode}
            </p>
            <p style={{ color: theme.accent }} className="mt-2 text-xs">
              ✓ Certificado verificado e autêntico
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm" style={{ color: theme.muted }}>
            Verificando certificado…
          </p>
        )}
        <button
          onClick={download}
          style={{ background: theme.primary, color: theme.bg }}
          className="mt-5 rounded-xl px-5 py-3 font-semibold"
        >
          Baixar certificado (PDF)
        </button>
        {downloadUrl && (
          <p className="mt-2 text-xs" style={{ color: theme.muted }}>
            Se o download não abrir automaticamente,{' '}
            <a href={downloadUrl} target="_blank" rel="noreferrer" className="underline">
              clique aqui
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
