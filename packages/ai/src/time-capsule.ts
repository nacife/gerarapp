/**
 * Time Capsule (RF-06.8): gravação de nota + agendamento de e-mail 30 dias depois.
 * A entrega real do e-mail depende do MAILER configurado (console em dev).
 */
export interface TimeCapsuleNote {
  id: string;
  enrollmentId: string;
  learnerEmail: string;
  learnerName: string;
  projectTitle: string;
  message: string;
  createdAt: Date;
  deliverAt: Date;
  delivered: boolean;
}

export function buildTimeCapsuleQuiz(projectTitle: string): { question: string; options: string[]; correctIndex: number } {
  return {
    question: `O que você mais lembra sobre o conteúdo de "${projectTitle}"?`,
    options: [
      'Lembro bem dos conceitos principais',
      'Lembro parcialmente, preciso revisar',
      'Lembro pouco, faria o curso novamente',
      'Não me recordo do conteúdo',
    ],
    correctIndex: 0, // resposta autoavaliativa — qualquer uma é válida
  };
}
