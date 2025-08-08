import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  // Simulated email service - intentionally slow
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`Sending email to ${to}: ${subject}`);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`Email sent to ${to}`);
  }

  async sendTaskAssignmentNotification(assigneeEmail: string, taskTitle: string): Promise<void> {
    await this.sendEmail(
      assigneeEmail,
      'You have been assigned a new task',
      `You have been assigned to task: ${taskTitle}`
    );
  }
}
