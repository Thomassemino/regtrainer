import { mailer } from "./client";

const FROM = process.env.SMTP_FROM ?? "RegTrainer <no-reply@betotraining.com.ar>";

export async function sendComprobanteEmail(to: string, pdf: Buffer, nombreArchivo: string): Promise<void> {
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "Tu comprobante de pago — RegTrainer",
    text: "Te adjuntamos el comprobante de tu pago. Recordá que es un comprobante interno, no una factura fiscal.",
    html: "<p>Te adjuntamos el comprobante de tu pago.</p><p>Recordá que es un comprobante interno, no una factura fiscal.</p>",
    attachments: [{ filename: nombreArchivo, content: pdf, contentType: "application/pdf" }],
  });
}

export async function sendVerificationEmail(to: string, link: string): Promise<void> {
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "Confirmá tu cuenta de RegTrainer",
    text: `Confirmá tu cuenta entrando a este link: ${link}\n\nEste link vence en 24 horas.`,
    html: `<p>Confirmá tu cuenta entrando a este link:</p><p><a href="${link}">${link}</a></p><p>Este link vence en 24 horas.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "Recuperá tu contraseña de RegTrainer",
    text: `Entrá a este link para elegir una nueva contraseña: ${link}\n\nEste link vence en 1 hora. Si no lo pediste vos, ignorá este mensaje.`,
    html: `<p>Entrá a este link para elegir una nueva contraseña:</p><p><a href="${link}">${link}</a></p><p>Este link vence en 1 hora. Si no lo pediste vos, ignorá este mensaje.</p>`,
  });
}

export async function sendCobroFallidoEmail(to: string, mensaje: string): Promise<void> {
  await mailer.sendMail({
    from: FROM,
    to,
    subject: "No se pudo procesar tu cobro — RegTrainer",
    text: mensaje,
    html: `<p>${mensaje}</p>`,
  });
}