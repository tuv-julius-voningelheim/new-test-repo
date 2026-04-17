"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = seedDemoData;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const core_flows_1 = require("@medusajs/medusa/core-flows");
const updateStoreCurrencies = (0, workflows_sdk_1.createWorkflow)("update-store-currencies", (input) => {
    const normalizedInput = (0, workflows_sdk_1.transform)({ input }, (data) => {
        return {
            selector: { id: data.input.store_id },
            update: {
                supported_currencies: data.input.supported_currencies.map((currency) => {
                    return {
                        currency_code: currency.currency_code,
                        is_default: currency.is_default ?? false,
                    };
                }),
            },
        };
    });
    const stores = (0, core_flows_1.updateStoresStep)(normalizedInput);
    return new workflows_sdk_1.WorkflowResponse(stores);
});
async function seedDemoData({ container }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const link = container.resolve(utils_1.ContainerRegistrationKeys.LINK);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const fulfillmentModuleService = container.resolve(utils_1.Modules.FULFILLMENT);
    const salesChannelModuleService = container.resolve(utils_1.Modules.SALES_CHANNEL);
    const storeModuleService = container.resolve(utils_1.Modules.STORE);
    const countries = ["de", "at", "ch"];
    logger.info("Seeding store data...");
    const [store] = await storeModuleService.listStores();
    let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
        name: "Default Sales Channel",
    });
    if (!defaultSalesChannel.length) {
        const { result: salesChannelResult } = await (0, core_flows_1.createSalesChannelsWorkflow)(container).run({
            input: {
                salesChannelsData: [
                    {
                        name: "Default Sales Channel",
                    },
                ],
            },
        });
        defaultSalesChannel = salesChannelResult;
    }
    await updateStoreCurrencies(container).run({
        input: {
            store_id: store.id,
            supported_currencies: [
                {
                    currency_code: "eur",
                    is_default: true,
                },
            ],
        },
    });
    await (0, core_flows_1.updateStoresWorkflow)(container).run({
        input: {
            selector: { id: store.id },
            update: {
                default_sales_channel_id: defaultSalesChannel[0].id,
            },
        },
    });
    logger.info("Seeding region data...");
    const { result: regionResult } = await (0, core_flows_1.createRegionsWorkflow)(container).run({
        input: {
            regions: [
                {
                    name: "DACH",
                    currency_code: "eur",
                    countries,
                    payment_providers: ["pp_system_default"],
                },
            ],
        },
    });
    const region = regionResult[0];
    logger.info("Finished seeding regions.");
    logger.info("Seeding tax regions...");
    await (0, core_flows_1.createTaxRegionsWorkflow)(container).run({
        input: countries.map((country_code) => ({
            country_code,
            provider_id: "tp_system",
        })),
    });
    logger.info("Finished seeding tax regions.");
    logger.info("Seeding stock location data...");
    const { result: stockLocationResult } = await (0, core_flows_1.createStockLocationsWorkflow)(container).run({
        input: {
            locations: [
                {
                    name: "Die Werkstatt",
                    address: {
                        city: "Innsbruck",
                        country_code: "AT",
                        address_1: "Baeckerbuehel\u0067asse 14",
                        postal_code: "6020",
                        province: "Tirol",
                    },
                },
            ],
        },
    });
    const stockLocation = stockLocationResult[0];
    await (0, core_flows_1.updateStoresWorkflow)(container).run({
        input: {
            selector: { id: store.id },
            update: {
                default_location_id: stockLocation.id,
            },
        },
    });
    await link.create({
        [utils_1.Modules.STOCK_LOCATION]: {
            stock_location_id: stockLocation.id,
        },
        [utils_1.Modules.FULFILLMENT]: {
            fulfillment_provider_id: "manual_manual",
        },
    });
    logger.info("Seeding fulfillment data...");
    const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
        type: "default",
    });
    let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;
    if (!shippingProfile) {
        const { result: shippingProfileResult } = await (0, core_flows_1.createShippingProfilesWorkflow)(container).run({
            input: {
                data: [
                    {
                        name: "Default Shipping Profile",
                        type: "default",
                    },
                ],
            },
        });
        shippingProfile = shippingProfileResult[0];
    }
    const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
        name: "DACH Versand",
        type: "shipping",
        service_zones: [
            {
                name: "DACH",
                geo_zones: [
                    { country_code: "de", type: "country" },
                    { country_code: "at", type: "country" },
                    { country_code: "ch", type: "country" },
                ],
            },
        ],
    });
    await link.create({
        [utils_1.Modules.STOCK_LOCATION]: {
            stock_location_id: stockLocation.id,
        },
        [utils_1.Modules.FULFILLMENT]: {
            fulfillment_set_id: fulfillmentSet.id,
        },
    });
    await (0, core_flows_1.createShippingOptionsWorkflow)(container).run({
        input: [
            {
                name: "Standardversand",
                price_type: "flat",
                provider_id: "manual_manual",
                service_zone_id: fulfillmentSet.service_zones[0].id,
                shipping_profile_id: shippingProfile.id,
                type: {
                    label: "Standard",
                    description: "Lieferung in 2-5 Werktagen.",
                    code: "standard",
                },
                prices: [
                    { currency_code: "eur", amount: 5.90 },
                    { region_id: region.id, amount: 5.90 },
                ],
                rules: [
                    { attribute: "enabled_in_store", value: "true", operator: "eq" },
                    { attribute: "is_return", value: "false", operator: "eq" },
                ],
            },
            {
                name: "Abholung in Innsbruck (Die Werkstatt)",
                price_type: "flat",
                provider_id: "manual_manual",
                service_zone_id: fulfillmentSet.service_zones[0].id,
                shipping_profile_id: shippingProfile.id,
                type: {
                    label: "Abholung",
                    description: "Selbstabholung bei Die Werkstatt, Baeckerbuehel\u0067asse 14, 6020 Innsbruck - kostenlos.",
                    code: "pickup",
                },
                prices: [
                    { currency_code: "eur", amount: 0 },
                    { region_id: region.id, amount: 0 },
                ],
                rules: [
                    { attribute: "enabled_in_store", value: "true", operator: "eq" },
                    { attribute: "is_return", value: "false", operator: "eq" },
                ],
            },
        ],
    });
    logger.info("Finished seeding fulfillment data.");
    await (0, core_flows_1.linkSalesChannelsToStockLocationWorkflow)(container).run({
        input: {
            id: stockLocation.id,
            add: [defaultSalesChannel[0].id],
        },
    });
    logger.info("Finished seeding stock location data.");
    logger.info("Seeding publishable API key data...");
    let publishableApiKey = null;
    const { data } = await query.graph({
        entity: "api_key",
        fields: ["id"],
        filters: {
            type: "publishable",
        },
    });
    publishableApiKey = data?.[0];
    if (!publishableApiKey) {
        const { result: [publishableApiKeyResult], } = await (0, core_flows_1.createApiKeysWorkflow)(container).run({
            input: {
                api_keys: [
                    {
                        title: "Giradi Webshop",
                        type: "publishable",
                        created_by: "",
                    },
                ],
            },
        });
        publishableApiKey = publishableApiKeyResult;
    }
    await (0, core_flows_1.linkSalesChannelsToApiKeyWorkflow)(container).run({
        input: {
            id: publishableApiKey.id,
            add: [defaultSalesChannel[0].id],
        },
    });
    logger.info("Finished seeding publishable API key data.");
    logger.info("Seeding product categories...");
    const { result: categoryResult } = await (0, core_flows_1.createProductCategoriesWorkflow)(container).run({
        input: {
            product_categories: [
                { name: "BIO Olivenoel", is_active: true },
                { name: "Olivenoel Extra Nativ", is_active: true },
                { name: "Olivenoel mit Aroma", is_active: true },
                { name: "Balsamessig", is_active: true },
            ],
        },
    });
    const catBio = categoryResult.find((c) => c.name === "BIO Olivenoel");
    const catExtraNativ = categoryResult.find((c) => c.name === "Olivenoel Extra Nativ");
    const catAroma = categoryResult.find((c) => c.name === "Olivenoel mit Aroma");
    const catBalsam = categoryResult.find((c) => c.name === "Balsamessig");
    logger.info("Seeding product data...");
    const makeProduct = (title, handle, description, categoryId, priceEur, sku, weight = 500, sizeLabel = "250ml") => ({
        title,
        handle,
        description,
        category_ids: [categoryId],
        weight,
        status: utils_1.ProductStatus.PUBLISHED,
        shipping_profile_id: shippingProfile.id,
        options: [{ title: "Groesse", values: [sizeLabel] }],
        variants: [
            {
                title: sizeLabel,
                sku,
                options: { "Groesse": sizeLabel },
                prices: [{ amount: Math.round(priceEur * 100), currency_code: "eur" }],
            },
        ],
        sales_channels: [{ id: defaultSalesChannel[0].id }],
    });
    await (0, core_flows_1.createProductsWorkflow)(container).run({
        input: {
            products: [
                // ===== BIO Olivenoel =====
                makeProduct("BIO-Olivenoel Extra Nativ Frisch Gepresst 1L", "bio-olivenoel-1l", "Naturtrueb / 1 Liter. Frisch gepresst Anfang November 2025. Begrenzte Stueckanzahl. Zertifiziertes BIO-Olivenoel aus 100% Koroneiki-Oliven.", catBio.id, 22.50, "BIO-OEL-1L", 1100, "1 Liter"),
                makeProduct("BIO-Olivenoel Extra Nativ Frisch Gepresst 500ml", "bio-olivenoel-500ml", "Naturtrueb / 500 ml. Frisch gepresst Anfang November 2025. Begrenzte Stueckanzahl. Zertifiziertes BIO-Olivenoel aus 100% Koroneiki-Oliven.", catBio.id, 14.50, "BIO-OEL-500ML", 600, "500 ml"),
                // ===== Olivenoel Extra Nativ =====
                makeProduct("Olivenoel Extra Nativ 5L Kanister", "olivenoel-extra-nativ-5l", "Erste Gueteklasse - direkt aus Oliven ausschliesslich mit mechanischen Verfahren gewonnen. 100% Koroneiki-Oliven. Intensives Fruchtaroma, tiefgruene Farbe, kraeftiger Geschmack.", catExtraNativ.id, 69.90, "OEL-EN-5L", 5200, "5 Liter"),
                makeProduct("Olivenoel Extra Nativ 1L Flasche", "olivenoel-extra-nativ-1l", "Erste Gueteklasse - direkt aus Oliven ausschliesslich mit mechanischen Verfahren gewonnen. 100% Koroneiki-Oliven aus Griechenland.", catExtraNativ.id, 17.90, "OEL-EN-1L", 1100, "1 Liter"),
                makeProduct("Olivenoel Extra Nativ 0,75L Flasche", "olivenoel-extra-nativ-075l", "Erste Gueteklasse - direkt aus Oliven ausschliesslich mit mechanischen Verfahren gewonnen. 100% Koroneiki-Oliven aus Griechenland.", catExtraNativ.id, 14.90, "OEL-EN-075L", 850, "0,75 Liter"),
                // ===== Olivenoel mit Aroma (je 250ml) =====
                makeProduct("Olivenoel Basilikum", "olivenoel-basilikum", "Extra Natives Olivenoel mit Basilikum-Aroma. 250ml Flasche.", catAroma.id, 8.50, "OEL-BASIL", 350, "250 ml"),
                makeProduct("Olivenoel Blutorange", "olivenoel-blutorange", "Extra Natives Olivenoel mit Blutorange-Aroma. 250ml Flasche.", catAroma.id, 8.50, "OEL-BLUTO", 350, "250 ml"),
                makeProduct("Olivenoel Chili", "olivenoel-chili", "Extra Natives Olivenoel mit Chili-Aroma. 250ml Flasche.", catAroma.id, 8.70, "OEL-CHILI", 350, "250 ml"),
                makeProduct("Olivenoel Knoblauch", "olivenoel-knoblauch", "Extra Natives Olivenoel mit Knoblauch-Aroma. 250ml Flasche.", catAroma.id, 8.50, "OEL-KNOBL", 350, "250 ml"),
                makeProduct("Olivenoel Kraeuter der Toskana", "olivenoel-kraeuter-toskana", "Extra Natives Olivenoel mit Kraeutern der Toskana. 250ml Flasche.", catAroma.id, 8.70, "OEL-TOSK", 350, "250 ml"),
                makeProduct("Olivenoel Limette", "olivenoel-limette", "Extra Natives Olivenoel mit Limette-Aroma. 250ml Flasche.", catAroma.id, 8.50, "OEL-LIMET", 350, "250 ml"),
                makeProduct("Olivenoel Orange", "olivenoel-orange", "Extra Natives Olivenoel mit Orange-Aroma. 250ml Flasche.", catAroma.id, 8.50, "OEL-ORANG", 350, "250 ml"),
                makeProduct("Olivenoel Oregano", "olivenoel-oregano", "Extra Natives Olivenoel mit Oregano-Aroma. 250ml Flasche.", catAroma.id, 8.50, "OEL-OREG", 350, "250 ml"),
                makeProduct("Olivenoel Pesto", "olivenoel-pesto", "Extra Natives Olivenoel mit Pesto-Aroma. 250ml Flasche.", catAroma.id, 8.70, "OEL-PESTO", 350, "250 ml"),
                makeProduct("Olivenoel Rosmarin", "olivenoel-rosmarin", "Extra Natives Olivenoel mit Rosmarin-Aroma. 250ml Flasche.", catAroma.id, 8.50, "OEL-ROSM", 350, "250 ml"),
                makeProduct("Olivenoel Thymian", "olivenoel-thymian", "Extra Natives Olivenoel mit Thymian-Aroma. 250ml Flasche.", catAroma.id, 8.50, "OEL-THYM", 350, "250 ml"),
                makeProduct("Olivenoel Trueffel", "olivenoel-trueffel", "Extra Natives Olivenoel mit Trueffel-Aroma. 250ml Flasche.", catAroma.id, 8.90, "OEL-TRUEF", 350, "250 ml"),
                makeProduct("Olivenoel Zitrone", "olivenoel-zitrone", "Extra Natives Olivenoel mit Zitrone-Aroma. 250ml Flasche.", catAroma.id, 8.50, "OEL-ZITR", 350, "250 ml"),
                // ===== Balsamessig (je 250ml) =====
                makeProduct("Balsamessig Apfel", "balsamessig-apfel", "Feiner Balsamessig mit Apfel-Geschmack. 250ml Flasche.", catBalsam.id, 8.40, "BAL-APFEL", 350, "250 ml"),
                makeProduct("Balsamessig Blaubeere", "balsamessig-blaubeere", "Feiner Balsamessig mit Blaubeere-Geschmack. 250ml Flasche.", catBalsam.id, 8.40, "BAL-BLAUB", 350, "250 ml"),
                makeProduct("Balsamessig Cranberry", "balsamessig-cranberry", "Feiner Balsamessig mit Cranberry-Geschmack. 250ml Flasche.", catBalsam.id, 8.40, "BAL-CRANB", 350, "250 ml"),
                makeProduct("Balsamessig Feige", "balsamessig-feige", "Feiner Balsamessig mit Feige-Geschmack. 250ml Flasche.", catBalsam.id, 8.40, "BAL-FEIGE", 350, "250 ml"),
                makeProduct("Balsamessig Granatapfel", "balsamessig-granatapfel", "Feiner Balsamessig mit Granatapfel-Geschmack. 250ml Flasche.", catBalsam.id, 8.40, "BAL-GRANAT", 350, "250 ml"),
                makeProduct("Balsamessig Himbeere", "balsamessig-himbeere", "Feiner Balsamessig mit Himbeere-Geschmack. 250ml Flasche.", catBalsam.id, 8.40, "BAL-HIMB", 350, "250 ml"),
                makeProduct("Balsamessig Honig", "balsamessig-honig", "Feiner Balsamessig mit Honig-Geschmack. 250ml Flasche.", catBalsam.id, 8.40, "BAL-HONIG", 350, "250 ml"),
                makeProduct("Balsamessig Kirsche", "balsamessig-kirsche", "Feiner Balsamessig mit Kirsche-Geschmack. 250ml Flasche.", catBalsam.id, 8.40, "BAL-KIRSCH", 350, "250 ml"),
                makeProduct("Balsamessig Klassisch", "balsamessig-klassisch", "Klassischer Balsamessig. 250ml Flasche.", catBalsam.id, 8.00, "BAL-KLASS", 350, "250 ml"),
                makeProduct("Balsamessig Mango", "balsamessig-mango", "Feiner Balsamessig mit Mango-Geschmack. 250ml Flasche.", catBalsam.id, 8.40, "BAL-MANGO", 350, "250 ml"),
                makeProduct("Balsamessig Pflaume", "balsamessig-pflaume", "Feiner Balsamessig mit Pflaume-Geschmack. 250ml Flasche.", catBalsam.id, 8.40, "BAL-PFLAU", 350, "250 ml"),
                makeProduct("Balsamessig Trueffel", "balsamessig-trueffel", "Feiner Balsamessig mit Trueffel-Geschmack. 250ml Flasche.", catBalsam.id, 8.80, "BAL-TRUEF", 350, "250 ml"),
                makeProduct("Balsamessig Weiss", "balsamessig-weiss", "Weisser Balsamessig. 250ml Flasche.", catBalsam.id, 8.00, "BAL-WEISS", 350, "250 ml"),
            ],
        },
    });
    logger.info("Finished seeding product data.");
    logger.info("Seeding inventory levels.");
    const { data: inventoryItems } = await query.graph({
        entity: "inventory_item",
        fields: ["id"],
    });
    const inventoryLevels = [];
    for (const inventoryItem of inventoryItems) {
        const inventoryLevel = {
            location_id: stockLocation.id,
            stocked_quantity: 1000000,
            inventory_item_id: inventoryItem.id,
        };
        inventoryLevels.push(inventoryLevel);
    }
    await (0, core_flows_1.createInventoryLevelsWorkflow)(container).run({
        input: {
            inventory_levels: inventoryLevels,
        },
    });
    logger.info("Finished seeding inventory levels data.");
    logger.info("=== SEEDING COMPLETE: 31 Produkte angelegt! ===");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY3JpcHRzL3NlZWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUF5REEsK0JBOFlDO0FBdGNELHFEQUltQztBQUNuQyxxRUFJMkM7QUFDM0MsNERBZXFDO0FBR3JDLE1BQU0scUJBQXFCLEdBQUcsSUFBQSw4QkFBYyxFQUMxQyx5QkFBeUIsRUFDekIsQ0FBQyxLQUdBLEVBQUUsRUFBRTtJQUNILE1BQU0sZUFBZSxHQUFHLElBQUEseUJBQVMsRUFBQyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7UUFDcEQsT0FBTztZQUNMLFFBQVEsRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRTtZQUNyQyxNQUFNLEVBQUU7Z0JBQ04sb0JBQW9CLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQ3ZELENBQUMsUUFBUSxFQUFFLEVBQUU7b0JBQ1gsT0FBTzt3QkFDTCxhQUFhLEVBQUUsUUFBUSxDQUFDLGFBQWE7d0JBQ3JDLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVSxJQUFJLEtBQUs7cUJBQ3pDLENBQUM7Z0JBQ0osQ0FBQyxDQUNGO2FBQ0Y7U0FDRixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxNQUFNLE1BQU0sR0FBRyxJQUFBLDZCQUFnQixFQUFDLGVBQWUsQ0FBQyxDQUFDO0lBRWpELE9BQU8sSUFBSSxnQ0FBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN0QyxDQUFDLENBQ0YsQ0FBQztBQUVhLEtBQUssVUFBVSxZQUFZLENBQUMsRUFBRSxTQUFTLEVBQVk7SUFDaEUsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxpQ0FBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuRSxNQUFNLElBQUksR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGlD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