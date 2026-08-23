import * as nodemailer from 'nodemailer';
import type { Mailer, MailMessage } from '../ports';

/**
 * Driver de e-mail para produção (MAILER=smtp): envia via SMTP real.
 * Suporta Google Workspace / Gmail (smtp.gmail.com:587, STARTTLS).
 *
 * Env necessárias:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *   (ou SMTP_URL no formato smtp://user:pass@host:port)
 */
export class SmtpMailer implements Mailer {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
    url?: string;
  }) {
    if (config.url) {
      this.transporter = nodemailer.createTransport(config.url);
    } else {
      const port = config.port ?? 587;
      this.transporter = nodemailer.createTransport({
        host: config.host ?? 'smtp.gmail.com',
        port,
        secure: port === 465, // SSL direto na 465; STARTTLS na 587/25
        auth: config.user && config.pass ? {
          user: config.user,
          pass: config.pass,
        } : undefined,
      });
    }
    this.from = config.from ?? config.user ?? 'noreply@eduforge.app';
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
