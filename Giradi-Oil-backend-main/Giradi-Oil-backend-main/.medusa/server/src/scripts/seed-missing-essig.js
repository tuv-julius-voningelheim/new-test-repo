"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = seedMissingEssig;
const utils_1 = require("@medusajs/framework/utils");
const core_flows_1 = require("@medusajs/medusa/core-flows");
async function seedMissingEssig({ container }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const salesChannelModuleService = container.resolve(utils_1.Modules.SALES_CHANNEL);
    const fulfillmentModuleService = container.resolve(utils_1.Modules.FULFILLMENT);
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
    await (0, core_flows_1.createProductsWorkflow)(container).run({
        input: {
            products: [
                {
                    title: "Balsamessig Blaubeere",
                    handle: "balsamessig-blaubeere",
                    description: "Feiner Balsamessig mit Blaubeere-Geschmack. 250ml Flasche.",
                    category_ids: [catBalsam.id],
                    weight: 350,
                    status: utils_1.ProductStatus.PUBLISHED,
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
                    status: utils_1.ProductStatus.PUBLISHED,
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
                    status: utils_1.ProductStatus.PUBLISHED,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VlZC1taXNzaW5nLWVzc2lnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjcmlwdHMvc2VlZC1taXNzaW5nLWVzc2lnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBVUEsbUNBa0dDO0FBM0dELHFEQUltQztBQUNuQyw0REFFcUM7QUFFdEIsS0FBSyxVQUFVLGdCQUFnQixDQUFDLEVBQUUsU0FBUyxFQUFZO0lBQ3BFLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsaUNBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkUsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxpQ0FBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNqRSxNQUFNLHlCQUF5QixHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsZUFBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQzNFLE1BQU0sd0JBQXdCLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxlQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7SUFFeEUsc0NBQXNDO0lBQ3RDLE1BQU0sRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEdBQUcsTUFBTSxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQzdDLE1BQU0sRUFBRSxrQkFBa0I7UUFDMUIsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQztRQUN0QixPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFO0tBQ2pDLENBQUMsQ0FBQztJQUNILE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDZixNQUFNLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7UUFDbEQsT0FBTztJQUNULENBQUM7SUFFRCxvQkFBb0I7SUFDcEIsTUFBTSxhQUFhLEdBQUcsTUFBTSx5QkFBeUIsQ0FBQyxpQkFBaUIsQ0FBQztR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