import { defineConfig, loadEnv, Modules } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const redisUrl = process.env.EVENTS_REDIS_URL || process.env.REDIS_URL
const storeCors =
  process.env.STORE_CORS || "http://localhost:8000,https://docs.medusajs.com"
const adminCors =
  process.env.ADMIN_CORS ||
  "http://localhost:5173,http://localhost:9000,https://docs.medusajs.com"
const authCors =
  process.env.AUTH_CORS ||
  "http://localhost:5173,http://localhost:9000,http://localhost:8000,https://docs.medusajs.com"

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL || "postgres://localhost/medusa",
    redisUrl,
    http: {
      storeCors,
      adminCors,
      authCors,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    {
      key: Modules.FILE,
      resolve: "@medusajs/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/file-s3",
            id: "s3",
            options: {
              file_url: "https://afawjsfbtsisryafwyyq.supabase.co/storage/v1/object/public/product-images",
              access_key_id: process.env.SUPABASE_S3_ACCESS_KEY,
              secret_access_key: process.env.SUPABASE_S3_SECRET_KEY,
              region: "eu-north-1",
              bucket: "product-images",
              endpoint: "https://afawjsfbtsisryafwyyq.supabase.co/storage/v1/s3",
              additional_client_config: {
                forcePathStyle: true,
              },
            },
          },
        ],
      },
    },
    {
      key: Modules.EVENT_BUS,
      resolve: "@medusajs/event-bus-redis",
      options: {
        redisUrl,
      },
    },
    ...(process.env.PAYPAL_CLIENT_ID
      ? [
          {
            key: Modules.PAYMENT,
            resolve: "@medusajs/payment",
            options: {
              providers: [
                {
                  resolve: "./src/modules/paypal",
                  id: "paypal",
                  options: {
                    clientId: process.env.PAYPAL_CLIENT_ID,
                    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
                    sandbox: process.env.PAYPAL_SANDBOX !== "false",
                  },
                },
              ],
            },
          },
        ]
      : []),
  ],
})
