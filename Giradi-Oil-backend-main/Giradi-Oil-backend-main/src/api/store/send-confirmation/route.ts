import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { order_id } = req.body as { order_id: string }

    if (!order_id) {
      return res.status(400).json({ message: "order_id is required" })
    }

    const query = req.scope.resolve("query")

    const { data: [order] } = await query.graph({
      entity: "order",
      filters: { id: order_id },
      fields: [
        "id",
        "display_id",
        "email",
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
        "currency_code",
        "items.*",
        "shipping_address.*",
      ],
    })

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    const currencyCode = (order.currency_code || "EUR").toUpperCase()

    // Helper: Cents → EUR formatiert (z.B. 1490 → "14,90")
    const fmt = (cents: number) =>
      (cents / 100).toFixed(2).replace(".", ",")

    const itemRows = (order.items || [])
      .map((item: any) => {
        const unitPrice = fmt(Number(item.unit_price || 0))
        const lineTotal = fmt(Number(item.unit_price || 0) * Number(item.quantity || 1))
        return `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #3a3a2a;">
              ${item.title}<br><span style="color: #999; font-size: 13px;">x${item.quantity} à ${unitPrice} ${currencyCode}</span>
            </td>
            <td style="padding: 8px 0; border-bottom: 1px solid #3a3a2a; text-align: right;">
              ${lineTotal} ${currencyCode}
            </td>
          </tr>`
      })
      .join("")

    const subtotal = fmt(Number(order.subtotal || 0))
    const shipping = fmt(Number(order.shipping_total || 0))
    const tax = fmt(Number(order.tax_total || 0))
    const total = fmt(Number(order.total || 0))
    const addr = order.shipping_address

    // Versandart erkennen
    const isPickup = Number(order.shipping_total || 0) === 0
    const shippingLabel = isPickup ? "Abholung (gratis)" : `${shipping} ${currencyCode}`

    const html = `
    <div style="max-width: 480px; margin: 0 auto; background: #1a1a14; color: #FAF8F3; font-family: Georgia, serif; padding: 32px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #C5A572; margin: 0; font-size: 28px;">The Girardi Oil</h1>
        <p style="color: #7a9a58; margin: 4px 0 0;">1000 Horia</p>
      </div>

      <h2 style="color: #7a9a58; font-size: 22px;">Vielen Dank für deine Bestellung!</h2>
      <p style="margin: 0 0 16px;">Bestellnummer: <strong>#${order.display_id}</strong></p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        ${itemRows}
      </table>

      <table style="width: 100%; font-size: 14px; margin-bottom: 8px;">
        <tr>
          <td style="padding: 4px 0; color: #ccc;">Zwischensumme</td>
          <td style="padding: 4px 0; text-align: right;">${subtotal} ${currencyCode}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #ccc;">Versand</td>
          <td style="padding: 4px 0; text-align: right;">${shippingLabel}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #ccc;">MwSt.</td>
          <td style="padding: 4px 0; text-align: right;">${tax} ${currencyCode}</td>
        </tr>
      </table>

      <p style="font-size: 18px; margin: 16px 0; border-top: 2px solid #C5A572; padding-top: 12px;">
        Gesamtbetrag: <strong style="color: #C5A572;">${total} ${currencyCode}</strong>
      </p>

      <h3 style="color: #7a9a58; font-size: 16px; margin: 24px 0 8px;">Lieferadresse</h3>
      <p style="margin: 0; line-height: 1.6;">
        ${addr?.first_name || ""} ${addr?.last_name || ""}<br>
        ${addr?.address_1 || ""}<br>
        ${addr?.postal_code || ""} ${addr?.city || ""}<br>
        ${addr?.country_code?.toUpperCase() || ""}
      </p>

      <div style="background: #275425; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="color: #C5A572; margin: 0 0 4px; font-weight: bold;">Nächster Schritt</p>
        <p style="color: #FAF8F3; margin: 0; font-size: 14px;">
          Wir melden uns bei dir mit den Zahlungsinformationen per E-Mail.
        </p>
      </div>

      <p style="text-align: center; color: #666; font-size: 13px; margin-top: 24px;">
        The Girardi Oil / 1000 Horia
      </p>
    </div>`

    await resend.emails.send({
      from: process.env.RESEND_FROM || "onboarding@resend.dev",
      to: order.email,
      subject: `Bestellbestätigung #${order.display_id} – The Girardi Oil`,
      html,
    })

    console.log(`✅ Order confirmation email sent to: ${order.email} – Total: ${total} ${currencyCode}`)
    return res.json({ success: true, email_sent: true })
  } catch (error: any) {
    console.error("❌ send-confirmation error:", error)
    return res.status(500).json({ message: error.message })
  }
}