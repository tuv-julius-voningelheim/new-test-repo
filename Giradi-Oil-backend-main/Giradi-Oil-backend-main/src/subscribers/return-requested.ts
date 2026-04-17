import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function returnRequestedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string; order_id?: string }>) {
  console.log("↩️ [Subscriber] order.return_requested fired – data:", JSON.stringify(event.data))

  try {
    const query = container.resolve("query")
    const orderId = event.data.order_id || event.data.id

    const { data: [order] } = await query.graph({
      entity: "order",
      filters: { id: orderId },
      fields: [
        "id", "display_id", "email", "currency_code",
        "items.*", "shipping_address.*",
      ],
    })

    if (!order) {
      console.warn("⚠️ [Subscriber] Order not found:", orderId)
      return
    }

    const html = `
    <div style="max-width:480px;margin:0 auto;background:#1a1a14;color:#FAF8F3;font-family:Georgia,serif;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#C5A572;margin:0;font-size:28px;">The Girardi Oil</h1>
        <p style="color:#7a9a58;margin:4px 0 0;">1000 Horia</p>
      </div>
      <h2 style="color:#7a9a58;font-size:22px;">Rücksendung eingeleitet</h2>
      <p>Für deine Bestellung <strong>#${order.display_id}</strong> wurde eine Rücksendung eingeleitet.</p>
      <div style="background:#275425;padding:16px;border-radius:8px;margin:24px 0;">
        <p style="color:#C5A572;margin:0 0 4px;font-weight:bold;">Nächster Schritt</p>
        <p style="color:#FAF8F3;margin:0;font-size:14px;">Wir melden uns bei dir mit weiteren Informationen zur Rücksendung.</p>
      </div>
      <p style="text-align:center;color:#666;font-size:13px;margin-top:24px;">The Girardi Oil / 1000 Horia</p>
    </div>`

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: order.email,
      subject: `Rücksendung für Bestellung #${order.display_id} – The Girardi Oil`,
      html,
    })

    console.log(`✅ [Subscriber] Return requested email sent to: ${order.email}`)
  } catch (err: any) {
    console.error("❌ [Subscriber] order.return_requested error:", err.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.return_requested",
}
