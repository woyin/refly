import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { SendEmailRequest, User } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { ParamsError } from '@refly/errors';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly resend: Resend;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.resend = new Resend(this.configService.get('auth.email.resendApiKey'));
  }

  /**
   * Send email using Resend service
   * @param param - Email parameters
   * @returns BaseResponse
   */
  async sendEmail(param: SendEmailRequest, user?: User) {
    this.logger.log(`Sending email with param: ${JSON.stringify(param)}`);

    const now = new Date();
    const { to, subject, html, from } = param;
    const sender = from || this.configService.get('auth.email.sender');

    let receiver = to || user?.email;

    // Fallback to user email if not provided
    if (!receiver && user?.uid) {
      const userPo = await this.prisma.user.findUnique({
        select: { email: true },
        where: { uid: user.uid },
      });
      if (userPo) {
        receiver = userPo.email;
      }
    }

    if (!receiver) {
      throw new ParamsError('No receiver specified');
    }

    const res = await this.resend.emails.send({
      from: sender,
      to: receiver,
      subject,
      html,
    });

    this.logger.log(`Email sent successfully to ${to}`);

    if (res.error) {
      throw new Error(res.error?.message);
    }

    this.logger.log(`Email sent to successfully in ${new Date().getTime() - now.getTime()}ms`);
  }
}
