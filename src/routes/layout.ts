import { Router } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../middleware/errorHandler";
import rateLimit from "express-rate-limit";

const router = Router();

// Protect layout endpoint from abuse
const layoutLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200, // 200 requests per 5 minutes (fairly generous as it's read-only)
    message: { error: "Too many layout requests, please slow down" },
    standardHeaders: true,
    legacyHeaders: false,
});

router.get(
    "/layout",
    layoutLimiter,
    asyncHandler(async (_req, res) => {
        const activeLayout = await prisma.layout.findFirst({
            where: { isActive: true },
            include: {
                tables: {
                    orderBy: { id: "asc" },
                },
            },
        });

        if (!activeLayout) {
            throw new HttpError(404, "No active layout found");
        }

        res.json({
            layoutId: activeLayout.id,
            name: activeLayout.name,
            tables: activeLayout.tables.map((table) => ({
                id: table.id,
                type: table.type,
                minCapacity: table.minCapacity,
                maxCapacity: table.maxCapacity,
                x: table.x,
                y: table.y,
                width: table.width,
                height: table.height,
                shape: table.shape, // RECTANGLE, CIRCLE
                rotation: table.rotation,
                priorityScore: table.priorityScore,
            })),
        });
    })
);

export default router;
