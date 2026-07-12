import nodemailer, { type Transporter } from "nodemailer";
import type { Logger } from "@platform/logger";
import type { NotificationServiceConfig } from "../config.js";
import {
  renderEmailTemplate,
  type EmailTemplateData,
  type EmailTemplateId,
} from "../templates/index.js";

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(
    config: NotificationServiceConfig,
    private readonly logger: Logger,
  ) {
    this.from = config.MAIL_FROM ?? config.MAIL_USER;
    this.transporter = nodemailer.createTransport({
      host: config.MAIL_HOST,
      port: config.MAIL_PORT,
      secure: config.MAIL_PORT === 465,
      auth: {
        user: config.MAIL_USER,
        pass: config.MAIL_PASSWORD,
      },
    });
  }

  async verify(): Promise<void> {
    await this.transporter.verify();
    this.logger.info("mail transport verified");
  }

  async send(options: SendMailOptions): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    this.logger.info(
      { to: options.to, subject: options.subject, messageId: info.messageId },
      "email sent",
    );
  }

  async sendTemplate<T extends EmailTemplateId>(
    to: string,
    templateId: T,
    data: EmailTemplateData[T],
  ): Promise<void> {
    const content = renderEmailTemplate(templateId, data);
    await this.send({ to, ...content });
  }
}
