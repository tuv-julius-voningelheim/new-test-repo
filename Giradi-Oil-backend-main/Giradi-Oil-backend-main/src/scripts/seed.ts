import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { ApiKey } from "../../.medusa/types/query-entry-points";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => {
              return {
                currency_code: currency.currency_code,
                is_default: currency.is_default ?? false,
              };
            }
          ),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  const countries = ["de", "at", "ch"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
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

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
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
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
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

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
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
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
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

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  let publishableApiKey: ApiKey | null = null;
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: {
      type: "publishable",
    },
  });

  publishableApiKey = data?.[0];

  if (!publishableApiKey) {
    const {
      result: [publishableApiKeyResult],
    } = await createApiKeysWorkflow(container).run({
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

    publishableApiKey = publishableApiKeyResult as ApiKey;
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding product categories...");
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        { name: "BIO Olivenoel", is_active: true },
        { name: "Olivenoel Extra Nativ", is_active: true },
        { name: "Olivenoel mit Aroma", is_active: true },
        { name: "Balsamessig", is_active: true },
      ],
    },
  });

  const catBio = categoryResult.find((c) => c.name === "BIO Olivenoel")!;
  const catExtraNativ = categoryResult.find((c) => c.name === "Olivenoel Extra Nativ")!;
  const catAroma = categoryResult.find((c) => c.name === "Olivenoel mit Aroma")!;
  const catBalsam = categoryResult.find((c) => c.name === "Balsamessig")!;

  logger.info("Seeding product data...");

  const makeProduct = (
    title: string,
    handle: string,
    description: string,
    categoryId: string,
    priceEur: number,
    sku: string,
    weight: number = 500,
    sizeLabel: string = "250ml"
  ) => ({
    title,
    handle,
    description,
    category_ids: [categoryId],
    weight,
    status: ProductStatus.PUBLISHED,
    shipping_profile_id: shippingProfile!.id,
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

  await createProductsWorkflow(container).run({
    input: {
      products: [
        // ===== BIO Olivenoel =====
        makeProduct(
          "BIO-Olivenoel Extra Nativ Frisch Gepresst 1L",
          "bio-olivenoel-1l",
          "Naturtrueb / 1 Liter. Frisch gepresst Anfang November 2025. Begrenzte Stueckanzahl. Zertifiziertes BIO-Olivenoel aus 100% Koroneiki-Oliven.",
          catBio.id, 22.50, "BIO-OEL-1L", 1100, "1 Liter"
        ),
        makeProduct(
          "BIO-Olivenoel Extra Nativ Frisch Gepresst 500ml",
          "bio-olivenoel-500ml",
          "Naturtrueb / 500 ml. Frisch gepresst Anfang November 2025. Begrenzte Stueckanzahl. Zertifiziertes BIO-Olivenoel aus 100% Koroneiki-Oliven.",
          catBio.id, 14.50, "BIO-OEL-500ML", 600, "500 ml"
        ),

        // ===== Olivenoel Extra Nativ =====
        makeProduct(
          "Olivenoel Extra Nativ 5L Kanister",
          "olivenoel-extra-nativ-5l",
          "Erste Gueteklasse - direkt aus Oliven ausschliesslich mit mechanischen Verfahren gewonnen. 100% Koroneiki-Oliven. Intensives Fruchtaroma, tiefgruene Farbe, kraeftiger Geschmack.",
          catExtraNativ.id, 69.90, "OEL-EN-5L", 5200, "5 Liter"
        ),
        makeProduct(
          "Olivenoel Extra Nativ 1L Flasche",
          "olivenoel-extra-nativ-1l",
          "Erste Gueteklasse - direkt aus Oliven ausschliesslich mit mechanischen Verfahren gewonnen. 100% Koroneiki-Oliven aus Griechenland.",
          catExtraNativ.id, 17.90, "OEL-EN-1L", 1100, "1 Liter"
        ),
        makeProduct(
          "Olivenoel Extra Nativ 0,75L Flasche",
          "olivenoel-extra-nativ-075l",
          "Erste Gueteklasse - direkt aus Oliven ausschliesslich mit mechanischen Verfahren gewonnen. 100% Koroneiki-Oliven aus Griechenland.",
          catExtraNativ.id, 14.90, "OEL-EN-075L", 850, "0,75 Liter"
        ),

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

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    const inventoryLevel = {
      location_id: stockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    };
    inventoryLevels.push(inventoryLevel);
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info("Finished seeding inventory levels data.");
  logger.info("=== SEEDING COMPLETE: 31 Produkte angelegt! ===");
}
