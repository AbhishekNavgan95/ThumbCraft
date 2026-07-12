export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export type EmailTemplateId =
  | "otp-verification"
  | "welcome"
  | "generation-completed"
  | "generation-failed";

export interface EmailTemplateData {
  "otp-verification": {
    name: string;
    otp: string;
    expiresAt: string;
  };
  welcome: {
    name: string;
  };
  "generation-completed": {
    name: string;
  };
  "generation-failed": {
    name: string;
    error: string;
  };
}

export type EmailTemplateRenderer<T extends EmailTemplateId> = (
  data: EmailTemplateData[T],
) => EmailContent;
