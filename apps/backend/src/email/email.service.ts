import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
    this.from = this.config.get<string>('SMTP_FROM', 'no-reply@madad.ai');
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');
    const resetUrl = `${webUrl}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 24 hours.</p>`,
    });

    this.logger.log(`Password reset email sent to ${email}`);
  }

  async sendAlertNotification(email: string, alertData: any): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: `Alert: ${alertData.alert_type}`,
      html: `<p>A new ${alertData.severity} alert has been triggered: ${alertData.alert_type}</p>`,
    });

    this.logger.log(`Alert notification email sent to ${email}`);
  }
}
