import { mailer } from "./client";

const FROM = process.env.SMTP_FROM ?? "Beto Training <no-reply@betotraining.com.ar>";

export async function sendVerificationEmail(to: string, link: string): Promise<void> {
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "Confirmá tu cuenta de Beto Training",
    text: `Confirmá tu cuenta entrando a este link: ${link}\n\nEste link vence en 24 horas.`,
    html: `<p>Confirmá tu cuenta entrando a este link:</p><p><a href="${link}">${link}</a></p><p>Este link vence en 24 horas.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "Recuperá tu contraseña de Beto Training",
    text: `Entrá a este link para elegir una nueva contraseña: ${link}\n\nEste link vence en 1 hora. Si no lo pediste vos, ignorá este mensaje.`,
    html: `<p>Entrá a este link para elegir una nueva contraseña:</p><p><a href="${link}">${link}</a></p><p>Este link vence en 1 hora. Si no lo pediste vos, ignorá este mensaje.</p>`,
  });
}