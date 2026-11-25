/** What a learning item is (docs/design/v0.5-learning.md). */
export const LEARNING_KINDS = ['video', 'course', 'article', 'book', 'project', 'other'] as const;
export type LearningKind = (typeof LEARNING_KINDS)[number];

/** How far along it is (decision 041). */
export const LEARNING_STATUSES = ['to_start', 'in_progress', 'done', 'dropped'] as const;
export type LearningStatus = (typeof LEARNING_STATUSES)[number];
