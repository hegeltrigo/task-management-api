import { Activity } from '@prisma/client';

export type ActivityResponse = Activity & {

};

export type CreateActivityData = {
  taskId: string;
  userId: string;
  action: string;
  changes: Record<string, { old?: any; new?: any }>;
  taskTitle: string;
  userName: string;
};