import { Processor, Process } from '@nestjs/bull';
import { EmailService } from '../email/email.service';
import { Job } from 'bull';

@Processor('notifications')
export class NotificationsProcessor {
  constructor(private readonly emailService: EmailService) {}

  @Process('task-assigned')
  async handleTaskAssignment(job: Job<{
    assigneeEmail: string;
    taskTitle: string;
  }>) {
    try {
      await this.emailService.sendTaskAssignmentNotification(
        job.data.assigneeEmail,
        `Nueva tarea asignada: ${job.data.taskTitle}`
      );
      console.log(`Email sent to ${job.data.assigneeEmail}`);
    } catch (error) {
      console.error(`Failed to send email to ${job.data.assigneeEmail}`, error);
      throw error; // Para reintentos automáticos
    }
  }
}