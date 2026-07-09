export interface ProjectWeeklyStat {
  title: string;
  sessionsThisWeek: number;
  certificatesThisWeek: number;
}

/** Feed de destaques da home (RF-08): "seu app X teve N sessões esta semana". */
export function buildHighlights(stats: ProjectWeeklyStat[]): string[] {
  const highlights: string[] = [];

  const top = [...stats].sort((a, b) => b.sessionsThisWeek - a.sessionsThisWeek)[0];
  if (top && top.sessionsThisWeek > 0) {
    highlights.push(`"${top.title}" teve ${top.sessionsThisWeek} sessões esta semana.`);
  }

  const totalCerts = stats.reduce((sum, p) => sum + p.certificatesThisWeek, 0);
  if (totalCerts > 0) {
    highlights.push(
      `${totalCerts} certificado${totalCerts > 1 ? 's' : ''} emitido${totalCerts > 1 ? 's' : ''} esta semana.`,
    );
  }

  return highlights;
}
