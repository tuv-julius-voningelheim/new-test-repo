import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function seedMissingEssig({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  // Get existing category "Balsamessig"
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
    filters: { name: "Balsamessig" },
  });
  const catBalsam = categories[0];
  if (!catBalsam) {
    logger.error("Category 'Balsamessig' not found!");
    return;
  }

  // Get sales channel
  const salesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });
  const defaultSalesChannel = salesChannels[0];

  // Get shipping profile
  const shippingProfile = await fulfillmentModuleService.listShippingProfiles();
  const profile = shippingProfile[0];

  logger.info("Seeding 3 missing Balsamessig products...");

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Balsamessig Blaubeere",
          handle: "balsamessig-blaubeere",
          description: "Feiner Balsamessig mit Blaubeere-Geschmack. 250ml Flasche.",
          category_ids: [catBalsam.id],
          weight: 350,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: profile.id,
          sales_channels: [{ id: defaultSalesChannel.id }],
          options: [{ title: "Size", values: ["250 ml"] }],
          variants: [
            {
              title: "250 ml",
              sku: "BAL-BLAUB",
              options: { Size: "250 ml" },
              manage_inventory: true,
              prices: [{ amount: 840, currency_code: "eur" }],
            },
          ],
        },
        {
          title: "Balsamessig Pflaume",
          handle: "balsamessig-pflaume",
          description: "Feiner Balsamessig mit Pflaume-Geschmack. 250ml Flasche.",
          category_ids: [catBalsam.id],
          weight: 350,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: profile.id,
          sales_channels: [{ id: defaultSalesChannel.id }],
          options: [{ title: "Size", values: ["250 ml"] }],
          variants: [
            {
              title: "250 ml",
              sku: "BAL-PFLAU",
              options: { Size: "250 ml" },
              manage_inventory: true,
              prices: [{ amount: 840, currency_code: "eur" }],
            },
          ],
        },
        {
          title: "Balsamessig Cranberry",
          handle: "balsamessig-cranberry",
          description: "Feiner Balsamessig mit Cranberry-Geschmack. 250ml Flasche.",
          category_ids: [catBalsam.id],
          weight: 350,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: profile.id,
          sales_channels: [{ id: defaultSalesChannel.id }],
          options: [{ title: "Size", values: ["250 ml"] }],
          variants: [
            {
              title: "250 ml",
              sku: "BAL-CRANB",
              options: { Size: "250 ml" },
              manage_inventory: true,
              prices: [{ amount: 840, currency_code: "eur" }],
            },
          ],
        },
      ],
    },
  });

  logger.info("✅ 3 missing Balsamessig products seeded successfully!");
}
