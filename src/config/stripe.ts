import Stripe from "stripe";
import { env } from "./env";

const isDummy =
  !env.stripeSecretKey ||
  env.stripeSecretKey.includes("placeholder") ||
  env.stripeSecretKey === "sk_test_dummy";

if (env.nodeEnv === "production" && isDummy) {
  throw new Error("Production requires a real STRIPE_SECRET_KEY — placeholder/dummy keys are not allowed");
}

export const stripe = isDummy
  ? ({
    isMock: true,
    paymentIntents: {
      create: async (params: any) => ({
        id: "pi_mock_" + Math.random().toString(36).substr(2, 9),
        client_secret: "pi_mock_secret_" + Math.random().toString(36).substr(2, 9),
        status: "requires_payment_method",
        amount: params.amount,
        metadata: params.metadata,
      }),
    },
    webhooks: {
      constructEvent: (body: any, _sig: any, _secret: any) => {
        // Simple mock of constructEvent
        const payload = JSON.parse(body.toString());
        return {
          type: payload.type || "payment_intent.succeeded",
          data: { object: payload.data?.object || {} },
        };
      },
    },
  } as any)
  : Object.assign(new Stripe(env.stripeSecretKey, {
    apiVersion: "2023-10-16",
  } as any), { isMock: false });
