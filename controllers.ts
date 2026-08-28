import { Request, Response } from "express";
import { CreateAppointmentBody, createAppointmentSchema, GetSlotsBody, getSlotsSchema, subscribeWebhookSchema } from "./validations";
import { z } from "zod";
import { dispatchWebhooks, webHookSubscribers } from "./webhook";

const isLive = (): boolean => Boolean(process.env.APPOINTO_API_TOKEN);

const APPOINTO_BASE_URL = process.env.APPOINTO_BASE_URL;

export const getHealth = (req: Request, res: Response): void => {
  res.json({ status: "ok", mode: isLive() ? "live" : "mocked" });
};

export const getAvailableSlots = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as GetSlotsBody;
  const result = getSlotsSchema.safeParse(body);

  if (!result.success) {
    res.status(400).json({ error: "validation_error", details: z.treeifyError(result.error) });
    return;
  }

  const {
    appointment_id,
    start_date,
    end_date,
  } = result.data;

  if (isLive()) {
    const params = new URLSearchParams({ start_date });
    if (end_date) params.set("end_date", end_date);

    const response = await fetch(
      `${APPOINTO_BASE_URL}/appointments/${appointment_id}/calendar_availability?${params}`,
      { headers: { "APPOINTO-TOKEN": process.env.APPOINTO_API_TOKEN as string } }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      res.status(response.status).json({ error: "appointo_error", details: errorBody });
      return;
    }

    const slots = await response.json();

    void dispatchWebhooks("available.slots", slots);
    res.status(200).json({ source: "live", slots });

    return;
  }

  const mockedSlots = [
    { date: start_date, start_time: "09:00AM", end_time: "09:30AM" },
    { date: start_date, start_time: "02:00PM", end_time: "03:00PM" },
  ];

  void dispatchWebhooks("available.slots", mockedSlots);
  res.status(200).json({ source: "mock", slots: mockedSlots });
};

export const createAppointment = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as CreateAppointmentBody;
  const result = createAppointmentSchema.safeParse(body);

  if (!result.success) {
    res.status(400).json({ error: "validation_error", details: z.treeifyError(result.error) });
    return;
  }

  const {
    appointment_id,
    name,
    email,
    phone,
    quantity,
    timestring
  } = result.data;

  if (isLive()) {
    const response = await fetch(
      `${APPOINTO_BASE_URL}/bookings`,
      {
        method: "POST",
        headers: {
          "APPOINTO-TOKEN": process.env.APPOINTO_API_TOKEN as string
        },
        body: JSON.stringify({
          appointment_id,
          timestring,
          email,
          name,
          phone,
          quantity,
        })
      }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      res.status(response.status).json({ error: "appointo_error", details: errorBody });
      return;
    }

    const slots = await response.json();

    void dispatchWebhooks("booking.created", slots);
    res.status(200).json({ source: "live", slots });

    return;
  }

  const booking = {
    id: Math.floor(Math.random() * 100000),
    appointment_id,
    timestring,
    email,
    name,
    phone: phone ?? "Not supplied",
    quantity: quantity ?? 1,
    created_at: new Date().toISOString(),
  };

  void dispatchWebhooks("booking.created", booking);

  res.status(200).json({ source: "mock", booking });
};

export const subscribeWebhook = (req: Request, res: Response): void => {
  const result = subscribeWebhookSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: "validation_error", details: z.treeifyError(result.error) });
    return;
  }

  webHookSubscribers.push({ url: result.data.url });
  res.status(201).json({ url: result.data.url });
};
