/** How a contact relates to the user's search (docs/design/v0.4-contacts.md). */
export const CONTACT_KINDS = ['recruiter', 'hiring_manager', 'interviewer', 'referral', 'employee', 'other'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

/** How a conversation took place (decision 038). */
export const INTERACTION_CHANNELS = ['email', 'linkedin', 'call', 'meeting', 'other'] as const;
export type InteractionChannel = (typeof INTERACTION_CHANNELS)[number];
