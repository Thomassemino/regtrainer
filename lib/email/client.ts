import nodemailer from "nodemailer";

const rawPort = Number(process.env.SMTP_PORT ?? 25);
const SMTP_PORT = Number.isInteger(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : 25;

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
});