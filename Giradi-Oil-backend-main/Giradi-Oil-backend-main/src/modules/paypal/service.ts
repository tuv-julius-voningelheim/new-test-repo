import {
  AbstractPaymentProvider,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  InitiatePaymentOutput,
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"

type PayPalOptions = {
  clientId: string
  clientSecret: string
  sandbox?: boolean
}

export default class PayPalPaymentProvider extends AbstractPaymentProvider<PayPalOptions> {
  static identifier = "paypal"

  private clientId: string
  private clientSecret: string
  private baseUrl: string

  static validateOptions(options: Record<any, any>) {
    if (!options.clientId) {
      throw new Error("PayPal clientId is required")
    }
    if (!options.clientSecret) {
      throw new Error("PayPal clientSecret is required")
    }
  }

  constructor(container: Record<string, unknown>, options: PayPalOptions) {
    super(container, options)
    this.clientId = options.clientId
    this.clientSecret = options.clientSecret
    this.baseUrl = options.sandbox !== false
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com"
  }

  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })
    const data = await res.json() as any
    if (!data.access_token) {
      throw new Error(`PayPal auth failed: ${JSON.stringify(data)}`)
    }
    return data.access_token
  }

  private async paypalRequest(method: string, path: string, body?: any): Promise<any> {
    const token = await this.getAccessToken()
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(method === "POST" ? { Prefer: "return=representation" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (res.status === 204) return {}
    return res.json()
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const { amount, currency_code } = input
    const majorAmount = (Number(amount) / 100).toFixed(2)
    const cc = currency_code.toUpperCase()

    const order = await this.paypalRequest("POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: cc,
            value: majorAmount,
          },
        },
      ],
    })

    return {
      id: order.id,
      data: {
        id: order.id,
        status: order.status,
      },
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const { data } = input
    const paypalOrderId = (data as any).id

    const order = await this.paypalRequest("GET", `/v2/checkout/orders/${paypalOrderId}`)

    const status = order.status === "APPROVED" || order.status === "COMPLETED"
      ? PaymentSessionStatus.AUTHORIZED
      : order.status === "VOIDED"
        ? PaymentSessionStatus.CANCELED
        : PaymentSessionStatus.PENDING

    return {
      status,
      data: {
        id: order.id,
        status: order.status,
      },
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const { data } = input
    const paypalOrderId = (data as any).id

    const capture = await this.paypalRequest("POST", `/v2/checkout/orders/${paypalOrderId}/capture`)

    return {
      data: {
        id: capture.id,
        status: capture.status,
        capture_id: capture.purchase_units?.[0]?.payments?.captures?.[0]?.id,
      },
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data as Record<string, unknown> }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return await this.cancelPayment(input as any)
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const { data, amount } = input
    const captureId = (data as any).capture_id

    if (!captureId) {
      throw new Error("No capture_id found in payment data for refund")
    }

    const majorAmount = (Number(amount) / 100).toFixed(2)
    const currencyCode = ((data as any).currency_code || "EUR").toUpperCase()

    const refund = await this.paypalRequest("POST", `/v2/payments/captures/${captureId}/refund`, {
      amount: {
        value: majorAmount,
        currency_code: currencyCode,
      },
    })

    return {
      data: {
        ...(data as Record<string, unknown>),
        refund_id: refund.id,
      },
    }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const { data } = input
    const paypalOrderId = (data as any).id

    try {
      const order = await this.paypalRequest("GET", `/v2/checkout/orders/${paypalOrderId}`)

      switch (order.status) {
        case "COMPLETED":
        case "APPROVED":
          return { status: PaymentSessionStatus.AUTHORIZED }
        case "VOIDED":
          return { status: PaymentSessionStatus.CANCELED }
        default:
          return { status: PaymentSessionStatus.PENDING }
      }
    } catch {
      return { status: PaymentSessionStatus.PENDING }
    }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const paypalOrderId = (input.data as any).id
    const order = await this.paypalRequest("GET", `/v2/checkout/orders/${paypalOrderId}`)
    return { data: order }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const { data, amount, currency_code } = input
    const paypalOrderId = (data as any).id
    const majorAmount = (Number(amount) / 100).toFixed(2)
    const cc = (currency_code || "EUR").toUpperCase()

    await this.paypalRequest("PATCH", `/v2/checkout/orders/${paypalOrderId}`, [
      {
        op: "replace",
        path: "/purchase_units/@reference_id=='default'/amount",
        value: {
          currency_code: cc,
          value: majorAmount,
        },
      },
    ])

    return { data: data as Record<string, unknown> }
  }

  async getWebhookActionAndData(
    webhookData: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const event = (webhookData.data as any)?.event_type

    switch (event) {
      case "CHECKOUT.ORDER.APPROVED":
        return {
          action: PaymentActions.AUTHORIZED,
          data: {
            session_id: (webhookData.data as any)?.resource?.id,
            amount: (webhookData.data as any)?.resource?.purchase_units?.[0]?.amount?.value
              ? Math.round(parseFloat((webhookData.data as any).resource.purchase_units[0].amount.value) * 100)
              : 0,
          },
        }
      case "PAYMENT.CAPTURE.COMPLETED":
        return {
          action: PaymentActions.SUCCESSFUL,
          data: {
            session_id: (webhookData.data as any)?.resource?.supplementary_data?.related_ids?.order_id || "",
            amount: (webhookData.data as any)?.resource?.amount?.value
              ? Math.round(parseFloat((webhookData.data as any).resource.amount.value) * 100)
              : 0,
          },
        }
      default:
        return {
          action: PaymentActions.NOT_SUPPORTED,
          data: { session_id: "", amount: 0 },
        }
    }
  }
}
