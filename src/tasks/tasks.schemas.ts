import { z } from 'zod';
import { text } from '../jobs/jobs.schemas.js';
import type { Task } from './task.entity.js';

/** The fields a user writes (docs/design/v0.3-today.md). */
const taskFields = {
  title: z.string().trim().min(1).max(200),
  notes: text(5_000),
  /** A calendar day, YYYY-MM-DD. */
  dueOn: z.iso.date().nullable().optional(),
  /** One of the user's own jobs. */
  jobId: z.uuid().nullable().optional(),
};

export const createTaskSchema = z.strictObject(taskFields);
export type CreateTaskDto = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .strictObject({
    ...taskFields,
    /** true marks it done; false opens it again. */
    done: z.boolean(),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'send at least one field' });
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;

export const listTasksQuerySchema = z.strictObject({
  /** Only this job's tasks. */
  jobId: z.uuid().optional(),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

export const taskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  notes: z.string().nullable(),
  dueOn: z.iso.date().nullable(),
  /** The job it belongs to, with what Today needs to show and link it. */
  job: z.object({ id: z.uuid(), company: z.string(), title: z.string() }).nullable(),
  doneAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TaskResponse = z.infer<typeof taskSchema>;

/** The response never carries the owner: every task a user sees is theirs. `task.job` must be loaded. */
export function toTaskResponse(task: Task): TaskResponse {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    dueOn: task.dueOn,
    job: task.job ? { id: task.job.id, company: task.job.company, title: task.job.title } : null,
    doneAt: task.doneAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
