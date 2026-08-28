import { z } from "zod";

export const getSlotsSchema = z.object({
  appointment_id: z.number().int().positive(),
  start_date: z.iso.date(),
  end_date: z.iso.date().optional()
});

export const createAppointmentSchema = z.object({
  appointment_id: z.number().int().positive(),
  timestring: z.iso.datetime({ offset: true }).transform((val, ctx) => {
    const date = new Date(val);

    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid timestring" });
      return z.NEVER;
    }

    return date.toISOString();
  }),
  email: z.email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  quantity: z.number().int().positive().optional(),
});

export const subscribeWebhookSchema = z.object({
  url: z.url()
});

export type GetSlotsBody = z.infer<typeof getSlotsSchema>;
export type CreateAppointmentBody = z.infer<typeof createAppointmentSchema>;