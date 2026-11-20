import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log(" Nodemailer transporter configured.");
  } catch (err) {
    console.warn("⚠️ Failed to initialize email transporter:", err.message);
  }
}

// In-memory alert log for UI retrieval & auditing
export const sentNotifications = [];

// In-memory or persisted user notification settings
export let notificationSettings = {
  alertEmail: process.env.ALERT_EMAIL_TO || "admin@example.com",
  sendOnDown: true,
  sendOnRecovery: true,
  cooldownMinutes: 5,
};

export function updateNotificationSettings(newSettings) {
  notificationSettings = { ...notificationSettings, ...newSettings };
  return notificationSettings;
}

export function getNotificationSettings() {
  return notificationSettings;
}

export async function sendDownAlert({ monitor, check, incident }) {
  if (!notificationSettings.sendOnDown) {
    console.log("ℹ️ Down alerts are disabled in notification preferences.");
    return null;
  }

  const subject = `ALERT: ${monitor.name || "API"} is DOWN!`;
  const text = `
APIWATCH ALERT
--------------------------------------------------
Monitor: ${monitor.name}
Endpoint: ${monitor.url}
Method: ${monitor.method || "GET"}
Status: DOWN
Error / Reason: ${check.error || `HTTP ${check.statusCode} (Expected: ${JSON.stringify(monitor.expectedStatusCodes || [200])})`}
Response Time: ${check.responseTime}ms
Incident ID: ${incident?.id || "N/A"}
Detected At: ${new Date(check.checkedAt).toLocaleString()}
--------------------------------------------------
Please investigate your API.
  `.trim();

  const record = {
    id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type: "DOWN",
    monitorId: monitor.id,
    userId: monitor.userId || "anonymous",
    monitorName: monitor.name,
    timestamp: new Date().toISOString(),
    subject,
    text,
  };
  sentNotifications.unshift(record);
  if (sentNotifications.length > 100) sentNotifications.pop();

  console.log(`\n🚨 [EMAIL ALERT SENT] 🚨\nTo: ${process.env.ALERT_EMAIL_TO || "admin@example.com"}\nSubject: ${subject}\n${text}\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.ALERT_EMAIL_FROM || "alerts@apiwatch.local",
        to: process.env.ALERT_EMAIL_TO || "admin@example.com",
        subject,
        text,
      });
    } catch (err) {
      console.error("Failed to send real email alert:", err.message);
    }
  }

  return record;
}

export async function sendRecoveryAlert({ monitor, check, incident }) {
  if (!notificationSettings.sendOnRecovery) {
    console.log("ℹ️ Recovery alerts are disabled in notification preferences.");
    return null;
  }

  const subject = `RECOVERED: ${monitor.name || "API"} is back UP!`;
  const text = `
APIWATCH RECOVERY
--------------------------------------------------
Monitor: ${monitor.name}
Endpoint: ${monitor.url}
Status: UP (HTTP ${check.statusCode})
Response Time: ${check.responseTime}ms
Incident ID: ${incident?.id || "N/A"}
Downtime Duration: ${incident?.durationSeconds ? `${incident.durationSeconds}s` : "Calculated"}
Recovered At: ${new Date(check.checkedAt).toLocaleString()}
--------------------------------------------------
Service has resumed normal operation.
  `.trim();

  const record = {
    id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type: "RECOVERED",
    monitorId: monitor.id,
    userId: monitor.userId || "anonymous",
    monitorName: monitor.name,
    timestamp: new Date().toISOString(),
    subject,
    text,
  };
  sentNotifications.unshift(record);
  if (sentNotifications.length > 100) sentNotifications.pop();

  console.log(`\n [EMAIL RECOVERY SENT] \nTo: ${process.env.ALERT_EMAIL_TO || "admin@example.com"}\nSubject: ${subject}\n${text}\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.ALERT_EMAIL_FROM || "alerts@apiwatch.local",
        to: process.env.ALERT_EMAIL_TO || "admin@example.com",
        subject,
        text,
      });
    } catch (err) {
      console.error("Failed to send real recovery email:", err.message);
    }
  }

  return record;
}

export default {
  sendDownAlert,
  sendRecoveryAlert,
  sentNotifications,
};
