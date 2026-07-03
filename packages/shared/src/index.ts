export const PROCESS_STEPS = ["打磨", "装配", "喷漆", "包覆", "完工"] as const;

export const USER_ROLES = ["ADMIN", "PROCESS_OWNER"] as const;

export const EQUIPMENT_STATUSES = ["PENDING", "IN_PROGRESS", "FINISHED", "OVERDUE"] as const;

export type ProcessStepName = (typeof PROCESS_STEPS)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];
