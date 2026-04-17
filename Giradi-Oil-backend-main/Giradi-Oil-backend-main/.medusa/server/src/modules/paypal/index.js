"use strict";
const service_1 = require("./service");
const utils_1 = require("@medusajs/framework/utils");
const PayPalService = service_1.default || service_1;
module.exports = (0, utils_1.ModuleProvider)(utils_1.Modules.PAYMENT, {
    services: [PayPalService],
});
