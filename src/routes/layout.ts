import { Router } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../middleware/errorHandler";

const router = Router();

router.get(
    "/layout",
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
