import { MedusaContainer } from "@medusajs/framework/types"

export default async function({ container }: { container: MedusaContainer }) {
  const fileService = container.resolve("file") as any
  console.log("=== FILE MODULE DEBUG ===")
  console.log("Provider keys:", Object.keys(fileService))
  
  // Try uploading via Medusa's file service
  try {
    const result = await fileService.createFiles([{
      filename: "test-medusa.txt",
      mimeType: "text/plain",
      content: Buffer.from("test from medusa file service").toString("base64"),
    }])
    console.log("Upload result:", JSON.stringify(result, null, 2))
  } catch (e: any) {
    console.log("Upload error:", e.message)
  }
}
