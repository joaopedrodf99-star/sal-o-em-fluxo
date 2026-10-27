import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createBookings, getSlots, rescheduleBooking } from "@/lib/booking-core";

const pick = z.object({ service_id: z.string().uuid(), professional_id: z.union([z.string().uuid(), z.literal("any")]) });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);

export const fetchSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ companyId: z.string().uuid(), date, picks: z.array(pick).min(1).max(10), parallel: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const slots = await getSlots(context.supabase, data.companyId, data.date, data.picks, { parallel: data.parallel });
    return { slots };
  });

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        clientId: z.string().uuid().nullable(),
        date,
        time,
        picks: z.array(pick).min(1).max(10),
        parallel: z.boolean().optional(),
        notes: z.string().max(1000).nullable().optional(),
        isFitIn: z.boolean().optional(),
        recurrence: z.object({ freq: z.enum(["weekly", "biweekly", "monthly"]), count: z.number().int().min(1).max(52) }).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    return createBookings(context.supabase, { ...data, source: "manual" });
  });

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ appointmentId: z.string().uuid(), date, time, professionalId: z.string().uuid().nullable().optional() }).parse(i))
  .handler(async ({ data, context }) => rescheduleBooking(context.supabase, data));
