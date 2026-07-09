import type { Mailer, MailMessage } from '../ports';

/**
 * Driver de e-mail para dev (MAILER=console): apenas registra no stdout.
 * TODO(prd:RF-07): SmtpMailer quando MAILER=smtp.
 */
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      `\n📧 [mailer:console]\n   Para: ${message.to}\n   Assunto: ${message.subject}\n   ${message.text}\n`,
    );
  }
}
