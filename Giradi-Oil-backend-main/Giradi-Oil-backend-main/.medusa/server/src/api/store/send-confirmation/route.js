"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
async function POST(req, res) {
    try {
        const { order_id } = req.body;
        if (!order_id) {
            return res.status(400).json({ message: "order_id is required" });
        }
        const query = req.scope.resolve("query");
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
        });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const currencyCode = (order.currency_code || "EUR").toUpperCase();
        // Helper: Cents → EUR formatiert (z.B. 1490 → "14,90")
        const fmt = (cents) => (cents / 100).toFixed(2).replace(".", ",");
        const itemRows = (order.items || [])
            .map((item) => {
            const unitPrice = fmt(Number(item.unit_price || 0));
            const lineTotal = fmt(Number(item.unit_price || 0) * Number(item.quantity || 1));
            return `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #3a3a2a;">
              ${item.title}<br><span style="color: #999; font-size: 13px;">x${item.quantity} à ${unitPrice} ${currencyCode}</span>
            </td>
            <td style="padding: 8px 0; border-bottom: 1px solid #3a3a2a; text-align: right;">
              ${lineTotal} ${currencyCode}
            </td>
          </tr>`;
        })
            .join("");
        const subtotal = fmt(Number(order.subtotal || 0));
        const shipping = fmt(Number(order.shipping_total || 0));
        const tax = fmt(Number(order.tax_total || 0));
        const total = fmt(Number(order.total || 0));
        const addr = order.shipping_address;
        // Versandart erkennen
        const isPickup = Number(order.shipping_total || 0) === 0;
        const shippingLabel = isPickup ? "Abholung (gratis)" : `${shipping} ${currencyCode}`;
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
    </div>`;
        await resend.emails.send({
            from: process.env.RESEND_FROM || "onboarding@resend.dev",
            to: order.email,
            subject: `Bestellbestätigung #${order.display_id} – The Girardi Oil`,
            html,
        });
        console.log(`✅ Order confirmation email sent to: ${order.email} – Total: ${total} ${currencyCode}`);
        return res.json({ success: true, email_sent: true });
    }
    catch (error) {
        console.error("❌ send-confirmation error:", error);
        return res.status(500).json({ message: error.message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL3NlbmQtY29uZmlybWF0aW9uL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBS0Esb0JBaUlDO0FBcklELG1DQUErQjtBQUUvQixNQUFNLE1BQU0sR0FBRyxJQUFJLGVBQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFBO0FBRTlDLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxJQUFJLENBQUM7UUFDSCxNQUFNLEVBQUUsUUFBUSxFQUFFLEdBQUcsR0FBRyxDQUFDLElBQTRCLENBQUE7UUFFckQsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2QsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxDQUFDLENBQUE7UUFDbEUsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1FBRXhDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztZQUMxQyxNQUFNLEVBQUUsT0FBTztZQUNmLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUU7WUFDekIsTUFBTSxFQUFFO2dCQUNOLElBQUk7Z0JBQ0osWUFBWTtnQkFDWixPQUFPO2dCQUNQLE9BQU87Z0JBQ1AsVUFBVTtnQkFDVixnQkFBZ0I7Z0JBQ2hCLFdBQVc7Z0JBQ1gsZUFBZTtnQkFDZixTQUFTO2dCQUNULG9CQUFvQjthQUNyQjtTQUNGLENBQUMsQ0FBQTtRQUVGLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNYLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxH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