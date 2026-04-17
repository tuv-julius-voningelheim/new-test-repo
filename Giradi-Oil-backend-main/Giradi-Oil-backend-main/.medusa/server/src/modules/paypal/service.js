"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
class PayPalPaymentProvider extends utils_1.AbstractPaymentProvider {
    static validateOptions(options) {
        if (!options.clientId) {
            throw new Error("PayPal clientId is required");
        }
        if (!options.clientSecret) {
            throw new Error("PayPal clientSecret is required");
        }
    }
    constructor(container, options) {
        super(container, options);
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.baseUrl = options.sandbox !== false
            ? "https://api-m.sandbox.paypal.com"
            : "https://api-m.paypal.com";
    }
    async getAccessToken() {
        const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
        const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
        });
        const data = await res.json();
        if (!data.access_token) {
            throw new Error(`PayPal auth failed: ${JSON.stringify(data)}`);
        }
        return data.access_token;
    }
    async paypalRequest(method, path, body) {
        const token = await this.getAccessToken();
        const res = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(method === "POST" ? { Prefer: "return=representation" } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (res.status === 204)
            return {};
        return res.json();
    }
    async initiatePayment(input) {
        const { amount, currency_code } = input;
        const majorAmount = (Number(amount) / 100).toFixed(2);
        const cc = currency_code.toUpperCase();
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
        });
        return {
            id: order.id,
            data: {
                id: order.id,
                status: order.status,
            },
        };
    }
    async authorizePayment(input) {
        const { data } = input;
        const paypalOrderId = data.id;
        const order = await this.paypalRequest("GET", `/v2/checkout/orders/${paypalOrderId}`);
        const status = order.status === "APPROVED" || order.status === "COMPLETED"
            ? utils_1.PaymentSessionStatus.AUTHORIZED
            : order.status === "VOIDED"
                ? utils_1.PaymentSessionStatus.CANCELED
                : utils_1.PaymentSessionStatus.PENDING;
        return {
            status,
            data: {
                id: order.id,
                status: order.status,
            },
        };
    }
    async capturePayment(input) {
        const { data } = input;
        const paypalOrderId = data.id;
        const capture = await this.paypalRequest("POST", `/v2/checkout/orders/${paypalOrderId}/capture`);
        return {
            data: {
                id: capture.id,
                status: capture.status,
                capture_id: capture.purchase_units?.[0]?.payments?.captures?.[0]?.id,
            },
        };
    }
    async cancelPayment(input) {
        return { data: input.data };
    }
    async deletePayment(input) {
        return await this.cancelPayment(input);
    }
    async refundPayment(input) {
        const { data, amount } = input;
        const captureId = data.capture_id;
        if (!captureId) {
            throw new Error("No capture_id found in payment data for refund");
        }
        const majorAmount = (Number(amount) / 100).toFixed(2);
        const currencyCode = (data.currency_code || "EUR").toUpperCase();
        const refund = await this.paypalRequest("POST", `/v2/payments/captures/${captureId}/refund`, {
            amount: {
                value: majorAmount,
                currency_code: currencyCode,
            },
        });
        return {
            data: {
                ...data,
                refund_id: refund.id,
            },
        };
    }
    async getPaymentStatus(input) {
        const { data } = input;
        const paypalOrderId = data.id;
        try {
            const order = await this.paypalRequest("GET", `/v2/checkout/orders/${paypalOrderId}`);
            switch (order.status) {
                case "COMPLETED":
                case "APPROVED":
                    return { status: utils_1.PaymentSessionStatus.AUTHORIZED };
                case "VOIDED":
                    return { status: utils_1.PaymentSessionStatus.CANCELED };
                default:
                    return { status: utils_1.PaymentSessionStatus.PENDING };
            }
        }
        catch {
            return { status: utils_1.PaymentSessionStatus.PENDING };
        }
    }
    async retrievePayment(input) {
        const paypalOrderId = input.data.id;
        const order = await this.paypalRequest("GET", `/v2/checkout/orders/${paypalOrderId}`);
        return { data: order };
    }
    async updatePayment(input) {
        const { data, amount, currency_code } = input;
        const paypalOrderId = data.id;
        const majorAmount = (Number(amount) / 100).toFixed(2);
        const cc = (currency_code || "EUR").toUpperCase();
        await this.paypalRequest("PATCH", `/v2/checkout/orders/${paypalOrderId}`, [
            {
                op: "replace",
                path: "/purchase_units/@reference_id=='default'/amount",
                value: {
                    currency_code: cc,
                    value: majorAmount,
                },
            },
        ]);
        return { data: data };
    }
    async getWebhookActionAndData(webhookData) {
        const event = webhookData.data?.event_type;
        switch (event) {
            case "CHECKOUT.ORDER.APPROVED":
                return {
                    action: utils_1.PaymentActions.AUTHORIZED,
                    data: {
                        session_id: webhookData.data?.resource?.id,
                        amount: webhookData.data?.resource?.purchase_units?.[0]?.amount?.value
                            ? Math.round(parseFloat(webhookData.data.resource.purchase_units[0].amount.value) * 100)
                            : 0,
                    },
                };
            case "PAYMENT.CAPTURE.COMPLETED":
                return {
                    action: utils_1.PaymentActions.SUCCESSFUL,
                    data: {
                        session_id: webhookData.data?.resource?.supplementary_data?.related_ids?.order_id || "",
                        amount: webhookData.data?.resource?.amount?.value
                            ? Math.round(parseFloat(webhookData.data.resource.amount.value) * 100)
                            : 0,
                    },
                };
            default:
                return {
                    action: utils_1.PaymentActions.NOT_SUPPORTED,
                    data: { session_id: "", amount: 0 },
                };
        }
    }
}
PayPalPaymentProvider.identifier = "paypal";
exports.default = PayPalPaymentProvider;
