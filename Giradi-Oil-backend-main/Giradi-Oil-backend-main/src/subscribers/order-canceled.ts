import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function orderCanceledHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  console.log("🚫 [Subscriber] order.canceled fired – order:", event.data.id)

  try {
    const query = container.resolve("query")

    const { data: [order] } = await query.graph({
      entity: "order",
      filters: { id: event.data.id },
      fields: [
        "id", "display_id", "email", "total", "currency_code",
        "items.*", "shipping_address.*",
      ],
    })

    if (!order) {
      console.warn("⚠️ [Subscriber] Order not found:", event.data.id)
      return
    }

    const cc = (order.currency_code || "EUR").toUpperCase()
    const fmt = (cents: number) => (cents / 100).toFixed(2).replace(".", ",")
    const addr = order.shipping_address

    const itemRows = (order.items || [])
      .map((item: any) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid #3a3a2a;">
          ${item.title} <span style="color:#999;font-size:13px;">x${item.quantity}</span>
        </td>
        <td style="padding:6px 0;border-bottom:1px solid #3a3a2a;text-align:right;">
          ${fmt(Number(item.unit_price || 0) * Number(item.quantity || 1))} ${cc}
        </td>
      </tr>`).join("")

    const html = `
    <div style="max-width:480px;margin:0 auto;background:#1a1a14;color:#FAF8F3;font-family:Georgia,serif;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#C5A572;margin:0;font-size:28px;">The Girardi Oil</h1>
        <p style="color:#7a9a58;margin:4px 0 0;">1000 Horia</p>
      </div>
      <h2 style="color:#c0392b;font-size:22px;">Bestellung storniert</h2>
      <p>Deine Bestellung <strong>#${order.display_id}</strong> wurde storniert.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${itemRows}</table>
      <p style="font-size:16px;border-top:2px solid #C5A572;padding-top:12px;">
        Betrag: <strong style="color:#C5A572;">${fmt(Number(order.total || 0))} ${cc}</strong>
      </p>
      <div style="background:#275425;padding:16px;border-radius:8px;margin:24px 0;">
        <p style="color:#C5A572;margin:0 0 4px;font-weight:bold;">Fragen?</p>
        <p style="color:#FAF8F3;margin:0;font-size:14px;">Falls du Fragen zur Stornierung hast, antworte einfach auf diese E-Mail.</p>
      </div>
      <p style="text-align:center;color:#666;font-size:13px;margin-top:24px;">The Girardi Oil / 1000 Horia</p>
    </div>`

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: order.email,
      subject: `Bestellung #${order.display_id} storniert – The Girardi Oil`,
      html,
    })

    console.log(`✅ [Subscriber] Cancellation email sent to: ${order.email}`)
  } catch (err: any) {
    console.error("❌ [Subscriber] order.canceled error:", err.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
