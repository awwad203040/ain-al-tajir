import { COOKIE_NAME } from "../shared/const.js";
import { MERCHANT_MONTHLY_PLAN } from "../shared/payment";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getProviderAvailability } from "./payments/providers";
import { createStripeCheckout, createStripeCustomerPortal, scheduleStripeCancellation } from "./payments/stripe";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { canOpenCustomerPortal, canScheduleSubscriptionCancellation, hasPaidAccess } from "../shared/payment";
import { resolveAccountAccess, trialEndsAtFrom } from "../shared/trial";
import { testPartnerApiConnection } from "./partner-api";
import { calculateSmartPriceRecommendation, calculateTotalUnitCostMinor, isPublicHttpsUrl, type PricingGoal } from "../shared/price-research";
import { canTransitionPurchaseOrder, totalPurchaseOrderMinor } from "../shared/procurement";
import { invokeLLM } from "./_core/llm";
import { canApproveBranchReceipt } from "../shared/branch-manager-access";
import { branchTransferNotificationCopy } from "../shared/branch-transfer-notification";
import { dispatchBranchTransferPushNotifications, isExpoPushToken } from "./branch-transfer-notifications";
import { notifyOwner } from "./_core/notification";
import { branchTransferOwnerReceiptNotification } from "../shared/branch-transfer-owner-notification";
import { dispatchInventoryReplenishmentPushNotifications } from "./inventory-replenishment-notifications";

const pricingGoals = ["fast_sale", "balanced", "higher_margin"] as const;

async function assertMerchantAccess(userId: number) {
  const [subscription, profile] = await Promise.all([db.getSubscriptionByUserId(userId), db.getMerchantProfileByUserId(userId)]);
  const access = resolveAccountAccess({ subscriptionStatus: subscription?.status, hasMerchantProfile: Boolean(profile), trialEndsAt: profile?.trialEndsAt });
  if (!access.hasAccess) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "An active trial or subscription is required" });
  return profile;
}

async function getActiveManagedBranches(managerUserId: number) {
  const assignments = await db.listBranchManagerAssignmentsForManager(managerUserId);
  const merchantUserIds = [...new Set(assignments.map((assignment) => assignment.merchantUserId))];
  if (!merchantUserIds.length) return [];
  const accessEntries = await Promise.all(merchantUserIds.map(async (merchantUserId) => {
    const [subscription, profile] = await Promise.all([db.getSubscriptionByUserId(merchantUserId), db.getMerchantProfileByUserId(merchantUserId)]);
    return { merchantUserId, access: resolveAccountAccess({ subscriptionStatus: subscription?.status, hasMerchantProfile: Boolean(profile), trialEndsAt: profile?.trialEndsAt }) };
  }));
  const activeMerchantIds = new Set(accessEntries.filter((entry) => entry.access.hasAccess).map((entry) => entry.merchantUserId));
  return assignments.filter((assignment) => activeMerchantIds.has(assignment.merchantUserId));
}

async function assertTargetBranchManagerReceipt(managerUserId: number, transferId: number) {
  const managedBranches = await getActiveManagedBranches(managerUserId);
  const assignmentForTransfer = await db.getBranchManagerAssignmentForTransfer(managerUserId, transferId);
  const isAssignedTargetManager = Boolean(assignmentForTransfer && managedBranches.some((assignment) => assignment.branchId === assignmentForTransfer.assignment.branchId && assignment.merchantUserId === assignmentForTransfer.assignment.merchantUserId));
  if (!assignmentForTransfer || !canApproveBranchReceipt({ isAssignedTargetManager, transferStatus: assignmentForTransfer.transfer.status })) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the assigned target-branch manager may approve this receipt" });
  }
  return assignmentForTransfer.assignment.merchantUserId;
}

async function dispatchInventoryReplenishmentAlerts(notifications: db.InventoryReplenishmentNotificationTarget[]) {
  const results: { recipientUserId: number; push: { attempted: number; accepted: number } }[] = [];
  for (const notification of notifications) {
    try {
      const devices = await db.listDevicePushTokensForUser(notification.recipientUserId);
      const push = await dispatchInventoryReplenishmentPushNotifications(devices.map((device) => device.expoToken), {
        title: notification.title,
        body: notification.body,
        replenishmentRequestId: notification.replenishmentRequestId,
      });
      results.push({ recipientUserId: notification.recipientUserId, push });
    } catch (error) {
      console.warn("[Replenishment notification] Push delivery unavailable", error instanceof Error ? error.message : error);
      results.push({ recipientUserId: notification.recipientUserId, push: { attempted: 0, accepted: 0 } });
    }
  }
  return results;
}

function fallbackRecommendationNarrative({ goal, sourceCount, preliminary, variancePercent, floorApplied }: { goal: PricingGoal; sourceCount: number; preliminary: boolean; variancePercent: number; floorApplied: boolean }) {
  const goalLabel = goal === "fast_sale" ? "لتحفيز سرعة البيع" : goal === "higher_margin" ? "لتحسين الهامش" : "للسعر المتوازن";
  const evidence = preliminary ? "يعتمد التقدير على مصدر حديث واحد فقط، لذا راجعه قبل اعتماد السعر." : `يعتمد التقدير على ${sourceCount} مصادر حديثة أدخلها التاجر.`;
  const variance = variancePercent > 0 ? `سعرك الحالي أعلى من السعر المستهدف بنسبة ${variancePercent}%.` : variancePercent < 0 ? `سعرك الحالي أقل من السعر المستهدف بنسبة ${Math.abs(variancePercent)}%.` : "سعرك الحالي قريب من السعر المستهدف.";
  const floorWarning = floorApplied ? "رُفع السعر المستهدف إلى حدّ التكلفة الذي أدخلته؛ راجع الرسوم والشحن والضريبة قبل اتخاذ القرار." : "تحقق من الشحن والضمان والعروض قبل اتخاذ قرار التسعير.";
  return { summary: `${goalLabel}: ${variance}`, cautions: [evidence, floorWarning] };
}

async function createRecommendationNarrative({ productQuery, goal, sourceCount, preliminary, variancePercent, floorApplied }: { productQuery: string; goal: PricingGoal; sourceCount: number; preliminary: boolean; variancePercent: number; floorApplied: boolean }) {
  const fallback = fallbackRecommendationNarrative({ goal, sourceCount, preliminary, variancePercent, floorApplied });
  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      maxTokens: 300,
      messages: [
        { role: "system", content: "أنت مساعد تسعير للتاجر السعودي. اشرح أرقامًا محسوبة مسبقًا فقط. لا تتصفح الويب ولا تذكر أسعارًا أو مواقع أو مواصفات غير واردة. اكتب العربية بوضوح وباختصار." },
        { role: "user", content: JSON.stringify({ productQuery, goal, sourceCount, preliminary, variancePercent, floorApplied }) },
      ],
      outputSchema: {
        name: "pricing_explanation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            cautions: { type: "array", items: { type: "string" }, maxItems: 3 },
          },
          required: ["summary", "cautions"],
          additionalProperties: false,
        },
      },
    });
    const content = response.choices[0]?.message.content;
    if (typeof content !== "string") return fallback;
    const parsed = JSON.parse(content) as { summary?: unknown; cautions?: unknown };
    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.cautions) || !parsed.cautions.every((item) => typeof item === "string")) return fallback;
    return { summary: parsed.summary.slice(0, 500), cautions: parsed.cautions.slice(0, 3).map((item) => item.slice(0, 250)) };
  } catch (error) {
    console.warn("[Price research] AI explanation unavailable", error instanceof Error ? error.message : error);
    return fallback;
  }
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  merchant: router({
    profile: protectedProcedure.query(({ ctx }) => db.getMerchantProfileByUserId(ctx.user.id)),
    startTrial: protectedProcedure.input(z.object({
      ownerName: z.string().trim().min(2).max(191),
      ownerEmail: z.string().trim().email().max(320),
      storeName: z.string().trim().min(2).max(191),
      businessType: z.string().trim().min(2).max(128),
      city: z.string().trim().min(2).max(128),
      branchCount: z.number().int().min(1).max(999),
      contactPhone: z.string().trim().min(7).max(32),
      taxNumber: z.string().trim().min(5).max(32).optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getMerchantProfileByUserId(ctx.user.id);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A merchant profile already exists for this account" });
      const trialStartedAt = new Date();
      const profile = await db.createMerchantProfile({ ...input, userId: ctx.user.id, trialStartedAt, trialEndsAt: trialEndsAtFrom(trialStartedAt) });
      return { profile };
    }),
  }),

  access: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const [subscription, profile] = await Promise.all([db.getSubscriptionByUserId(ctx.user.id), db.getMerchantProfileByUserId(ctx.user.id)]);
      const merchantAccess = resolveAccountAccess({ subscriptionStatus: subscription?.status, hasMerchantProfile: Boolean(profile), trialEndsAt: profile?.trialEndsAt });
      if (merchantAccess.hasAccess) return { access: merchantAccess, profile, subscription, managedBranches: [] };
      const managedBranches = await getActiveManagedBranches(ctx.user.id);
      const access = managedBranches.length ? { kind: "branch_manager" as const, hasAccess: true, trialDaysRemaining: 0 } : merchantAccess;
      return { access, profile, subscription, managedBranches };
    }),
  }),

  partnerApi: router({
    testConnection: protectedProcedure.input(z.object({ connectorId: z.enum(["extra", "jarir"]) })).mutation(async ({ ctx, input }) => {
      const [subscription, profile] = await Promise.all([db.getSubscriptionByUserId(ctx.user.id), db.getMerchantProfileByUserId(ctx.user.id)]);
      const access = resolveAccountAccess({ subscriptionStatus: subscription?.status, hasMerchantProfile: Boolean(profile), trialEndsAt: profile?.trialEndsAt });
      if (!access.hasAccess) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "An active trial or subscription is required" });
      return testPartnerApiConnection(input.connectorId);
    }),
  }),

  priceResearch: router({
    list: protectedProcedure.input(z.object({
      productQuery: z.string().trim().min(2).max(191).optional(),
      productSku: z.string().trim().min(2).max(128).optional(),
      productBarcode: z.string().trim().min(8).max(32).optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const [subscription, profile] = await Promise.all([db.getSubscriptionByUserId(ctx.user.id), db.getMerchantProfileByUserId(ctx.user.id)]);
      const access = resolveAccountAccess({ subscriptionStatus: subscription?.status, hasMerchantProfile: Boolean(profile), trialEndsAt: profile?.trialEndsAt });
      if (!access.hasAccess) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "An active trial or subscription is required" });
      return db.listPriceObservationsByUserId(ctx.user.id, input);
    }),
    addObservation: protectedProcedure.input(z.object({
      productQuery: z.string().trim().min(2).max(191),
      productSku: z.string().trim().min(2).max(128).optional(),
      productBarcode: z.string().trim().min(8).max(32).optional(),
      sourceName: z.string().trim().min(2).max(191),
      sourceUrl: z.string().trim().url().max(2000).refine(isPublicHttpsUrl, "A public HTTPS source URL is required"),
      priceMinor: z.number().int().min(1).max(1_000_000_000),
      currency: z.literal("SAR").default("SAR"),
    })).mutation(async ({ ctx, input }) => {
      const [subscription, profile] = await Promise.all([db.getSubscriptionByUserId(ctx.user.id), db.getMerchantProfileByUserId(ctx.user.id)]);
      const access = resolveAccountAccess({ subscriptionStatus: subscription?.status, hasMerchantProfile: Boolean(profile), trialEndsAt: profile?.trialEndsAt });
      if (!access.hasAccess) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "An active trial or subscription is required" });
      const observation = await db.createPriceObservation({ ...input, userId: ctx.user.id });
      return { observation };
    }),
    recommend: protectedProcedure.input(z.object({
      productQuery: z.string().trim().min(2).max(191),
      productSku: z.string().trim().min(2).max(128).optional(),
      productBarcode: z.string().trim().min(8).max(32).optional(),
      ownPriceMinor: z.number().int().min(1).max(1_000_000_000),
      costPriceMinor: z.number().int().min(1).max(1_000_000_000).optional(),
      additionalCostMinor: z.number().int().min(1).max(1_000_000_000).optional(),
      goal: z.enum(pricingGoals),
    })).mutation(async ({ ctx, input }) => {
      const [subscription, profile] = await Promise.all([db.getSubscriptionByUserId(ctx.user.id), db.getMerchantProfileByUserId(ctx.user.id)]);
      const access = resolveAccountAccess({ subscriptionStatus: subscription?.status, hasMerchantProfile: Boolean(profile), trialEndsAt: profile?.trialEndsAt });
      if (!access.hasAccess) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "An active trial or subscription is required" });
      const observations = await db.listPriceObservationsByUserId(ctx.user.id, input);
      const totalCostMinor = calculateTotalUnitCostMinor(input.costPriceMinor, input.additionalCostMinor);
      if ((input.costPriceMinor || input.additionalCostMinor) && !totalCostMinor) throw new TRPCError({ code: "BAD_REQUEST", message: "The combined per-unit costs are too high" });
      const recommendation = calculateSmartPriceRecommendation({ ownPriceMinor: input.ownPriceMinor, floorPriceMinor: totalCostMinor, goal: input.goal, observations });
      if (!recommendation) return { recommendation: null, narrative: null };
      const narrative = await createRecommendationNarrative({ productQuery: input.productQuery, goal: input.goal, sourceCount: recommendation.sourceCount, preliminary: recommendation.preliminary, variancePercent: recommendation.variancePercent, floorApplied: recommendation.floorApplied });
      return { recommendation, narrative };
    }),
    decisions: protectedProcedure.input(z.object({
      productQuery: z.string().trim().min(2).max(191).optional(),
      productSku: z.string().trim().min(2).max(128).optional(),
      productBarcode: z.string().trim().min(8).max(32).optional(),
    }).optional()).query(async ({ ctx, input }) => {
      const [subscription, profile] = await Promise.all([db.getSubscriptionByUserId(ctx.user.id), db.getMerchantProfileByUserId(ctx.user.id)]);
      const access = resolveAccountAccess({ subscriptionStatus: subscription?.status, hasMerchantProfile: Boolean(profile), trialEndsAt: profile?.trialEndsAt });
      if (!access.hasAccess) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "An active trial or subscription is required" });
      return db.listPriceRecommendationDecisionsByUserId(ctx.user.id, input);
    }),
    recordDecision: protectedProcedure.input(z.object({
      productQuery: z.string().trim().min(2).max(191),
      productSku: z.string().trim().min(2).max(128).optional(),
      productBarcode: z.string().trim().min(8).max(32).optional(),
      ownPriceMinor: z.number().int().min(1).max(1_000_000_000),
      costPriceMinor: z.number().int().min(1).max(1_000_000_000).optional(),
      additionalCostMinor: z.number().int().min(1).max(1_000_000_000).optional(),
      goal: z.enum(pricingGoals),
      action: z.enum(["accepted", "customized", "dismissed"]),
      selectedPriceMinor: z.number().int().min(1).max(1_000_000_000).optional(),
      note: z.string().trim().min(1).max(500).optional(),
    })).mutation(async ({ ctx, input }) => {
      const [subscription, profile] = await Promise.all([db.getSubscriptionByUserId(ctx.user.id), db.getMerchantProfileByUserId(ctx.user.id)]);
      const access = resolveAccountAccess({ subscriptionStatus: subscription?.status, hasMerchantProfile: Boolean(profile), trialEndsAt: profile?.trialEndsAt });
      if (!access.hasAccess) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "An active trial or subscription is required" });
      if (input.action === "customized" && !input.selectedPriceMinor) throw new TRPCError({ code: "BAD_REQUEST", message: "A selected price is required for a customized decision" });
      if (input.action !== "customized" && input.selectedPriceMinor) throw new TRPCError({ code: "BAD_REQUEST", message: "A selected price is only allowed for a customized decision" });
      const observations = await db.listPriceObservationsByUserId(ctx.user.id, input);
      const totalCostMinor = calculateTotalUnitCostMinor(input.costPriceMinor, input.additionalCostMinor);
      if ((input.costPriceMinor || input.additionalCostMinor) && !totalCostMinor) throw new TRPCError({ code: "BAD_REQUEST", message: "The combined per-unit costs are too high" });
      const recommendation = calculateSmartPriceRecommendation({ ownPriceMinor: input.ownPriceMinor, floorPriceMinor: totalCostMinor, goal: input.goal, observations });
      if (!recommendation) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Current verified price evidence is required" });
      const decision = await db.createPriceRecommendationDecision({
        userId: ctx.user.id,
        productQuery: input.productQuery,
        productSku: input.productSku,
        productBarcode: input.productBarcode,
        goal: input.goal,
        action: input.action,
        ownPriceMinor: input.ownPriceMinor,
        costPriceMinor: input.costPriceMinor,
        additionalCostMinor: input.additionalCostMinor,
        targetPriceMinor: recommendation.targetPriceMinor,
        selectedPriceMinor: input.action === "accepted" ? recommendation.targetPriceMinor : input.selectedPriceMinor,
        sourceCount: recommendation.sourceCount,
        note: input.note,
      });
      return { decision, recommendation };
    }),
  }),

  procurement: router({
    suppliers: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        await assertMerchantAccess(ctx.user.id);
        return db.listSuppliersByUserId(ctx.user.id);
      }),
      create: protectedProcedure.input(z.object({
        name: z.string().trim().min(2).max(191),
        contactName: z.string().trim().min(2).max(191).optional(),
        contactPhone: z.string().trim().min(7).max(32).optional(),
        contactEmail: z.string().trim().email().max(320).optional(),
        paymentTerms: z.string().trim().min(2).max(191).optional(),
        leadTimeDays: z.number().int().min(0).max(365).optional(),
      })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        const supplier = await db.createSupplier({ ...input, userId: ctx.user.id });
        return { supplier };
      }),
    }),
    purchaseOrders: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        await assertMerchantAccess(ctx.user.id);
        return db.listPurchaseOrdersByUserId(ctx.user.id);
      }),
      create: protectedProcedure.input(z.object({
        supplierId: z.number().int().positive(),
        expectedDeliveryDate: z.string().datetime({ offset: true }).optional(),
        notes: z.string().trim().min(1).max(500).optional(),
        lines: z.array(z.object({
          productName: z.string().trim().min(2).max(191),
          productSku: z.string().trim().min(2).max(128).optional(),
          orderedQuantity: z.number().int().min(1).max(1_000_000),
          unitCostMinor: z.number().int().min(1).max(1_000_000_000),
        })).min(1).max(100),
      })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        const totalMinor = totalPurchaseOrderMinor(input.lines);
        if (!totalMinor) throw new TRPCError({ code: "BAD_REQUEST", message: "Purchase order total is invalid or too high" });
        try {
          const order = await db.createPurchaseOrderWithLines({
            userId: ctx.user.id,
            supplierId: input.supplierId,
            totalMinor,
            currency: "SAR",
            notes: input.notes,
            expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : undefined,
          }, input.lines.map((line) => ({ ...line, receivedQuantity: 0, rejectedQuantity: 0 })));
          return { order };
        } catch (error) {
          throw new TRPCError({ code: "NOT_FOUND", message: error instanceof Error ? error.message : "Supplier not found" });
        }
      }),
      changeStatus: protectedProcedure.input(z.object({
        purchaseOrderId: z.number().int().positive(),
        status: z.enum(["submitted", "approved", "canceled"]),
      })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        const current = await db.getPurchaseOrderForUser(ctx.user.id, input.purchaseOrderId);
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
        if (!canTransitionPurchaseOrder(current.status, input.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This purchase-order transition is not allowed" });
        const order = await db.transitionPurchaseOrderStatus(ctx.user.id, input.purchaseOrderId, input.status);
        return { order };
      }),
      receive: protectedProcedure.input(z.object({
        purchaseOrderId: z.number().int().positive(),
        note: z.string().trim().min(1).max(500).optional(),
        lines: z.array(z.object({
          lineId: z.number().int().positive(),
          receivedQuantity: z.number().int().min(0).max(1_000_000),
          rejectedQuantity: z.number().int().min(0).max(1_000_000),
        }).refine((line) => line.receivedQuantity + line.rejectedQuantity > 0, "A received or rejected quantity is required")).min(1).max(100),
      })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        const current = await db.getPurchaseOrderForUser(ctx.user.id, input.purchaseOrderId);
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
        if (current.status !== "approved" && current.status !== "partially_received") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Approve the purchase order before receiving it" });
        try {
          const order = await db.recordPurchaseOrderReceipt(ctx.user.id, input.purchaseOrderId, input.lines, input.note);
          return { order, inventoryUpdated: false };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Receipt could not be recorded" });
        }
      }),
    }),
  }),

  branches: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await assertMerchantAccess(ctx.user.id);
      return db.listBranchesByUserId(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().trim().min(2).max(191),
      city: z.string().trim().min(2).max(128).optional(),
    })).mutation(async ({ ctx, input }) => {
      await assertMerchantAccess(ctx.user.id);
      try {
        const branch = await db.createBranch({ ...input, userId: ctx.user.id });
        return { branch };
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "Branch could not be created" });
      }
    }),
    managers: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        await assertMerchantAccess(ctx.user.id);
        return db.listBranchManagerAssignmentsByMerchantUserId(ctx.user.id);
      }),
      assign: protectedProcedure.input(z.object({
        branchId: z.number().int().positive(),
        managerEmail: z.string().trim().email().max(320),
      })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        try {
          const assignment = await db.assignBranchManager(ctx.user.id, input.branchId, input.managerEmail, ctx.user.id);
          return { assignment };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Branch manager could not be assigned" });
        }
      }),
      remove: protectedProcedure.input(z.object({ branchId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        await db.removeBranchManager(ctx.user.id, input.branchId);
        return { success: true };
      }),
    }),
  }),

  branchTransfers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await assertMerchantAccess(ctx.user.id);
      return db.listBranchInventoryTransfersByUserId(ctx.user.id);
    }),
    send: protectedProcedure.input(z.object({
      sourceBranchId: z.number().int().positive(),
      targetBranchId: z.number().int().positive(),
      note: z.string().trim().min(1).max(500).optional(),
      lines: z.array(z.object({
        productKey: z.string().trim().min(1).max(191),
        quantity: z.number().int().min(1).max(1_000_000),
      })).min(1).max(100),
    })).mutation(async ({ ctx, input }) => {
      await assertMerchantAccess(ctx.user.id);
      const targetManager = await db.getBranchManagerAssignmentByBranch(ctx.user.id, input.targetBranchId);
      if (!targetManager) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Assign a manager to the target branch before sending inventory" });
      try {
        const notification = branchTransferNotificationCopy({ branchName: "فرعك", lineCount: input.lines.length, quantitySent: input.lines.reduce((sum, line) => sum + line.quantity, 0) });
        const transfer = await db.createBranchInventoryTransfer(ctx.user.id, input.sourceBranchId, input.targetBranchId, input.lines, input.note, ctx.user.id, { managerUserId: targetManager.managerUserId, ...notification });
        const devices = await db.listDevicePushTokensForUser(targetManager.managerUserId);
        const push = await dispatchBranchTransferPushNotifications(devices.map((device) => device.expoToken), { ...notification, transferId: transfer.transferId });
        return { transfer, notification: { id: transfer.notificationId, push } };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Inventory transfer could not be sent" });
      }
    }),
    incoming: protectedProcedure.query(async ({ ctx }) => {
      const managedBranches = await getActiveManagedBranches(ctx.user.id);
      if (!managedBranches.length) throw new TRPCError({ code: "FORBIDDEN", message: "No active target-branch manager assignment was found" });
      return db.listIncomingBranchTransfersForManager(ctx.user.id, [...new Set(managedBranches.map((assignment) => assignment.merchantUserId))]);
    }),
    receive: protectedProcedure.input(z.object({ transferId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const merchantUserId = await assertTargetBranchManagerReceipt(ctx.user.id, input.transferId);
        const receipt = await db.receiveBranchInventoryTransfer(merchantUserId, input.transferId, ctx.user.id);
        const ownerAlert = branchTransferOwnerReceiptNotification({
          transferId: receipt.transferId,
          targetBranchName: receipt.targetBranch.name,
          lineCount: receipt.lineCount,
          quantityReceived: receipt.quantityReceived,
        });
        let ownerNotified = false;
        try {
          ownerNotified = await notifyOwner(ownerAlert);
        } catch (notificationError) {
          console.warn("[Branch transfer] Owner receipt notification unavailable", notificationError instanceof Error ? notificationError.message : notificationError);
        }
        return { receipt, ownerNotified };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : "Inventory transfer could not be received";
        const code = message.includes("Only the assigned") ? "FORBIDDEN" : message.includes("not awaiting") || message.includes("already approved") ? "CONFLICT" : "BAD_REQUEST";
        throw new TRPCError({ code, message });
      }
    }),
    cancel: protectedProcedure.input(z.object({
      transferId: z.number().int().positive(),
      cancellationReason: z.string().trim().min(3).max(500),
    })).mutation(async ({ ctx, input }) => {
      await assertMerchantAccess(ctx.user.id);
      try {
        const result = await db.cancelBranchInventoryTransfer(ctx.user.id, input.transferId, ctx.user.id, input.cancellationReason);
        const { managerNotification, ...cancellation } = result;
        let push = { attempted: 0, accepted: 0 };
        if (managerNotification) {
          try {
            const devices = await db.listDevicePushTokensForUser(managerNotification.managerUserId);
            push = await dispatchBranchTransferPushNotifications(devices.map((device) => device.expoToken), { title: managerNotification.title, body: managerNotification.body, transferId: cancellation.transferId });
          } catch (notificationError) {
            console.warn("[Branch transfer] Manager cancellation push unavailable", notificationError instanceof Error ? notificationError.message : notificationError);
          }
        }
        return { cancellation, notification: managerNotification ? { id: managerNotification.id, push } : null };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Inventory transfer could not be canceled";
        const code = message.includes("in-transit") || message.includes("already approved") || message.includes("already canceled") ? "CONFLICT" : message.includes("not found") ? "NOT_FOUND" : "BAD_REQUEST";
        throw new TRPCError({ code, message });
      }
    }),
  }),

  branchNotifications: router({
    inbox: protectedProcedure.query(async ({ ctx }) => {
      const managedBranches = await getActiveManagedBranches(ctx.user.id);
      if (!managedBranches.length) throw new TRPCError({ code: "FORBIDDEN", message: "An active branch-manager assignment is required" });
      const allowedBranches = new Set(managedBranches.map((assignment) => `${assignment.merchantUserId}:${assignment.branchId}`));
      const notifications = await db.listBranchTransferNotificationsForManager(ctx.user.id);
      return notifications.filter((notification) => allowedBranches.has(`${notification.merchantUserId}:${notification.branchId}`));
    }),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const managedBranches = await getActiveManagedBranches(ctx.user.id);
      const notifications = await db.listBranchTransferNotificationsForManager(ctx.user.id);
      const notification = notifications.find((item) => item.id === input.notificationId);
      const activeAssignment = notification && managedBranches.some((assignment) => assignment.merchantUserId === notification.merchantUserId && assignment.branchId === notification.branchId);
      if (!activeAssignment) throw new TRPCError({ code: "FORBIDDEN", message: "This notification is not available to the current branch manager" });
      await db.markBranchTransferNotificationRead(ctx.user.id, input.notificationId);
      return { success: true };
    }),
    replenishmentInbox: protectedProcedure.query(async ({ ctx }) => {
      const managedBranches = await getActiveManagedBranches(ctx.user.id);
      if (!managedBranches.length) throw new TRPCError({ code: "FORBIDDEN", message: "An active branch-manager assignment is required" });
      const allowedBranches = new Set(managedBranches.map((assignment) => `${assignment.merchantUserId}:${assignment.branchId}`));
      const notifications = await db.listInventoryReplenishmentNotificationsForUser(ctx.user.id);
      return notifications.filter((notification) => allowedBranches.has(`${notification.merchantUserId}:${notification.branchId}`));
    }),
    replenishments: protectedProcedure.query(async ({ ctx }) => {
      const managedBranches = await getActiveManagedBranches(ctx.user.id);
      if (!managedBranches.length) throw new TRPCError({ code: "FORBIDDEN", message: "An active branch-manager assignment is required" });
      return db.listInventoryReplenishmentRequestsForManager(managedBranches);
    }),
    changeReplenishmentStatus: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), status: z.enum(["approved", "closed"]), receivedQuantity: z.number().int().min(0).max(1_000_000).optional() })).mutation(async ({ ctx, input }) => {
      const request = await db.getInventoryReplenishmentRequestById(input.requestId);
      const managedBranches = await getActiveManagedBranches(ctx.user.id);
      const assignment = request && managedBranches.find((item) => item.merchantUserId === request.userId && item.branchId === request.branchId);
      if (!assignment || !request) throw new TRPCError({ code: "FORBIDDEN", message: "Only the assigned branch manager can update this replenishment request" });
      try {
        const result = await db.transitionInventoryReplenishmentRequest(request.userId, input.requestId, input.status, ctx.user.id, input.receivedQuantity);
        let push = { attempted: 0, accepted: 0 };
        if (result.notification) {
          try {
            const devices = await db.listDevicePushTokensForUser(result.notification.recipientUserId);
            push = await dispatchInventoryReplenishmentPushNotifications(devices.map((device) => device.expoToken), { title: result.notification.title, body: result.notification.body, replenishmentRequestId: result.notification.replenishmentRequestId });
          } catch (notificationError) {
            console.warn("[Replenishment status notification] Owner push unavailable", notificationError instanceof Error ? notificationError.message : notificationError);
          }
        }
        return { request: result.request, notification: result.notification ? { push } : null };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Replenishment request could not be updated";
        throw new TRPCError({ code: message.includes("not found") ? "NOT_FOUND" : "PRECONDITION_FAILED", message });
      }
    }),
    markReplenishmentRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const managedBranches = await getActiveManagedBranches(ctx.user.id);
      const notifications = await db.listInventoryReplenishmentNotificationsForUser(ctx.user.id);
      const notification = notifications.find((item) => item.id === input.notificationId);
      const activeAssignment = notification && managedBranches.some((assignment) => assignment.merchantUserId === notification.merchantUserId && assignment.branchId === notification.branchId);
      if (!activeAssignment) throw new TRPCError({ code: "FORBIDDEN", message: "This replenishment notification is not available to the current branch manager" });
      await db.markInventoryReplenishmentNotificationRead(ctx.user.id, input.notificationId);
      return { success: true };
    }),
    deviceStatus: protectedProcedure.query(async ({ ctx }) => {
      const managedBranches = await getActiveManagedBranches(ctx.user.id);
      if (!managedBranches.length) throw new TRPCError({ code: "FORBIDDEN", message: "An active branch-manager assignment is required" });
      const devices = await db.listDevicePushTokensForUser(ctx.user.id);
      return { activeDevices: devices.length };
    }),
    registerDevice: protectedProcedure.input(z.object({ expoToken: z.string().trim().max(255).refine(isExpoPushToken, "A valid Expo push token is required"), platform: z.enum(["android", "ios"]) })).mutation(async ({ ctx, input }) => {
      const managedBranches = await getActiveManagedBranches(ctx.user.id);
      if (!managedBranches.length) throw new TRPCError({ code: "FORBIDDEN", message: "An active branch-manager assignment is required" });
      await db.upsertDevicePushToken({ userId: ctx.user.id, expoToken: input.expoToken.trim(), platform: input.platform });
      return { success: true };
    }),
    unregisterDevice: protectedProcedure.input(z.object({ expoToken: z.string().trim().max(255).refine(isExpoPushToken, "A valid Expo push token is required") })).mutation(async ({ ctx, input }) => {
      const managedBranches = await getActiveManagedBranches(ctx.user.id);
      if (!managedBranches.length) throw new TRPCError({ code: "FORBIDDEN", message: "An active branch-manager assignment is required" });
      await db.removeDevicePushToken(ctx.user.id, input.expoToken.trim());
      return { success: true };
    }),
  }),

  inventory: router({
    balances: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      await assertMerchantAccess(ctx.user.id);
      return db.listInventoryBalancesByUserId(ctx.user.id, input?.branchId);
    }),
    pendingReceipts: protectedProcedure.query(async ({ ctx }) => {
      await assertMerchantAccess(ctx.user.id);
      return db.listPendingInventoryReceiptsByUserId(ctx.user.id);
    }),
    approveReceipt: protectedProcedure.input(z.object({
      receiptEventId: z.number().int().positive(),
    })).mutation(async ({ ctx, input }) => {
      await assertMerchantAccess(ctx.user.id);
      try {
        const posting = await db.postReviewedReceiptToInventory(ctx.user.id, input.receiptEventId, ctx.user.id);
        return { posting };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Receipt could not be posted to inventory";
        throw new TRPCError({ code: message.includes("already been posted") ? "CONFLICT" : "BAD_REQUEST", message });
      }
    }),
    reorderRules: router({
      list: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        return db.listInventoryReorderRulesByUserId(ctx.user.id, input?.branchId);
      }),
      upsert: protectedProcedure.input(z.object({
        branchId: z.number().int().positive(),
        productKey: z.string().trim().min(1).max(191),
        productName: z.string().trim().min(2).max(191),
        productSku: z.string().trim().max(128).optional(),
        minimumQuantity: z.number().int().min(0).max(1_000_000),
        targetQuantity: z.number().int().min(1).max(1_000_000),
        isActive: z.boolean().default(true),
      })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        try {
          const rule = await db.upsertInventoryReorderRule({ ...input, userId: ctx.user.id, productSku: input.productSku || null });
          return { rule };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Reorder rule could not be saved" });
        }
      }),
    }),
    replenishments: router({
      list: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        const synced = await db.syncAndListInventoryReplenishmentRequests(ctx.user.id, input?.branchId);
        await dispatchInventoryReplenishmentAlerts(synced.notifications);
        return synced.requests;
      }),
      audit: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional(), requestId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        return db.listInventoryReplenishmentAudits(ctx.user.id, input?.branchId, input?.requestId);
      }),
      changeStatus: protectedProcedure.input(z.object({
        requestId: z.number().int().positive(),
        status: z.enum(["approved", "ordered", "closed", "dismissed"]),
        receivedQuantity: z.number().int().min(0).max(1_000_000).optional(),
      })).mutation(async ({ ctx, input }) => {
        let merchantUserId = ctx.user.id;
        try {
          await assertMerchantAccess(ctx.user.id);
        } catch (ownerError) {
          const request = await db.getInventoryReplenishmentRequestById(input.requestId);
          const managedBranches = await getActiveManagedBranches(ctx.user.id);
          const assigned = request && managedBranches.some((assignment) => assignment.merchantUserId === request.userId && assignment.branchId === request.branchId);
          if (!assigned) throw ownerError;
          merchantUserId = request.userId;
        }
        try {
          const result = await db.transitionInventoryReplenishmentRequest(merchantUserId, input.requestId, input.status, ctx.user.id, input.receivedQuantity);
          let push = { attempted: 0, accepted: 0 };
          if (result.notification) {
            try {
              const devices = await db.listDevicePushTokensForUser(result.notification.recipientUserId);
              push = await dispatchInventoryReplenishmentPushNotifications(devices.map((device) => device.expoToken), { title: result.notification.title, body: result.notification.body, replenishmentRequestId: result.notification.replenishmentRequestId });
            } catch (notificationError) {
              console.warn("[Replenishment status notification] Owner push unavailable", notificationError instanceof Error ? notificationError.message : notificationError);
            }
          }
          return { request: result.request, notification: result.notification ? { push } : null };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Replenishment request could not be updated";
          throw new TRPCError({ code: message.includes("not found") ? "NOT_FOUND" : "PRECONDITION_FAILED", message });
        }
      }),
    }),
    replenishmentNotifications: router({
      inbox: protectedProcedure.query(async ({ ctx }) => {
        await assertMerchantAccess(ctx.user.id);
        return db.listInventoryReplenishmentNotificationsForUser(ctx.user.id);
      }),
      markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        await db.markInventoryReplenishmentNotificationRead(ctx.user.id, input.notificationId);
        return { success: true };
      }),
      registerDevice: protectedProcedure.input(z.object({ expoToken: z.string().trim().max(255).refine(isExpoPushToken, "A valid Expo push token is required"), platform: z.enum(["android", "ios"]) })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        await db.upsertDevicePushToken({ userId: ctx.user.id, expoToken: input.expoToken.trim(), platform: input.platform });
        return { success: true };
      }),
      deviceStatus: protectedProcedure.query(async ({ ctx }) => {
        await assertMerchantAccess(ctx.user.id);
        const devices = await db.listDevicePushTokensForUser(ctx.user.id);
        return { activeDevices: devices.length };
      }),
    }),
    counts: router({
      list: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        return db.listInventoryCountSessionsByUserId(ctx.user.id, input?.branchId);
      }),
      create: protectedProcedure.input(z.object({
        branchId: z.number().int().positive(),
        note: z.string().trim().min(1).max(500).optional(),
        submit: z.boolean().default(true),
        lines: z.array(z.object({
          productKey: z.string().trim().min(1).max(191),
          productName: z.string().trim().min(2).max(191),
          productSku: z.string().trim().max(128).optional(),
          systemQuantity: z.number().int().min(0).max(1_000_000),
          countedQuantity: z.number().int().min(0).max(1_000_000),
          note: z.string().trim().max(300).optional(),
        })).min(1).max(500),
      })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        try {
          const session = await db.createInventoryCountSession(ctx.user.id, input.branchId, input.lines, input.note, ctx.user.id, input.submit);
          return { session };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Stock count could not be created" });
        }
      }),
      submit: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        try {
          return { session: await db.submitInventoryCountSession(ctx.user.id, input.sessionId) };
        } catch (error) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Stock count could not be submitted" });
        }
      }),
      approve: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await assertMerchantAccess(ctx.user.id);
        try {
          return { adjustment: await db.approveInventoryCountSession(ctx.user.id, input.sessionId, ctx.user.id) };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Stock count could not be approved";
          throw new TRPCError({ code: message.includes("not found") ? "NOT_FOUND" : message.includes("already") ? "CONFLICT" : "PRECONDITION_FAILED", message });
        }
      }),
    }),
  }),

  billing: router({
    config: publicProcedure.query(() => ({
      plan: MERCHANT_MONTHLY_PLAN,
      providers: getProviderAvailability(),
    })),
    status: protectedProcedure.query(async ({ ctx }) => {
      const subscription = await db.getSubscriptionByUserId(ctx.user.id);
      return { subscription, hasAccess: hasPaidAccess(subscription?.status ?? "inactive") };
    }),
    invoices: protectedProcedure.query(({ ctx }) => db.listInvoicesByUserId(ctx.user.id)),
    createStripeCheckout: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await createStripeCheckout({ userId: ctx.user.id, email: ctx.user.email });
      await db.upsertSubscription({
        userId: ctx.user.id,
        provider: "stripe",
        status: "checkout_pending",
        amountMinor: MERCHANT_MONTHLY_PLAN.amountMinor,
        currency: MERCHANT_MONTHLY_PLAN.currency,
      });
      return result;
    }),
    createCustomerPortal: protectedProcedure.mutation(async ({ ctx }) => {
      const subscription = await db.getSubscriptionByUserId(ctx.user.id);
      if (!canOpenCustomerPortal(subscription)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payment method management is unavailable for this subscription" });
      }
      return createStripeCustomerPortal(subscription!.providerCustomerId!);
    }),
    cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
      const subscription = await db.getSubscriptionByUserId(ctx.user.id);
      if (!subscription || subscription.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription to cancel" });
      }
      if (!canScheduleSubscriptionCancellation(subscription)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cancellation is not available for this provider" });
      }
      await scheduleStripeCancellation(subscription.providerSubscriptionId!);
      const updated = await db.setSubscriptionCancelAtPeriodEnd(ctx.user.id, true);
      return { subscription: updated };
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
