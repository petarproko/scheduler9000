import "dotenv/config";
import express from "express";
import { createAppointment, getAvailableSlots, getHealth, subscribeWebhook } from "./controllers";

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());

app.get("/health", getHealth);
app.post("/api/appointments", createAppointment);
app.post("/api/appointments/slots", getAvailableSlots);
app.post("/api/webhooks/subscribe", subscribeWebhook);

app.listen(PORT, () => {
  console.log(`scheduler9000 listening on port ${PORT}`);
  console.log(`Mode: ${process.env.APPOINTO_API_TOKEN ? "LIVE" : "MOCKED"}`);
});
