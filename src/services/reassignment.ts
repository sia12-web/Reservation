import { PrismaClient, Reservation } from "@prisma/client";
import { TableConfig } from "./tableAssignment/types";
import { findBestTableAssignment } from "./tableAssignment/engine";
import { checkAvailability } from "./availability";

interface ReassignmentResult {
    canReassign: boolean;
    moves: { reservationId: string; newTableIds: string[] }[];
    assignment: { tableIds: string[] };
}

export async function trySmartReassignment(
    prisma: PrismaClient,
    {
        newPartySize,
        startTime,
        endTime,
        layoutId,
        allTables,
        adjacency,
    }: {
        newPartySize: number;
        startTime: Date;
        endTime: Date;
        layoutId: string;
        allTables: TableConfig[];
        adjacency: Record<string, string[]>;
    }
): Promise<ReassignmentResult> {
    // 1. Find ALL conflicting assignments in the time window
    // Fix #4: Include WAITLIST in conflict detection
    const conflicts = await prisma.reservationTable.findMany({
        where: {
            layoutId,
            reservation: {
                startTime: { lt: endTime },
                endTime: { gt: startTime },
                status: { in: ["HOLD", "WAITLIST", "PENDING_DEPOSIT", "CONFIRMED", "CHECKED_IN"] },
            },
        },
        include: {
            reservation: true,
        },
    });

    const reservationMap = new Map<string, { reservation: Reservation; tableIds: string[] }>();

    // Group by reservation
    for (const c of conflicts) {
        if (!c.reservationId || !c.reservation) continue;
        if (!reservationMap.has(c.reservationId)) {
            reservationMap.set(c.reservationId, { reservation: c.reservation, tableIds: [] });
        }
        reservationMap.get(c.reservationId)!.tableIds.push(c.tableId);
    }

    // 2. Find IDEAL assignment for the new party assuming NO conflicts (using all tables)
    const idealResult = findBestTableAssignment(newPartySize, allTables.map((t) => t.id), {
        tables: allTables,
        adjacency,
    });

    if (!idealResult.best) {
        // If we can't fit them even in an empty restaurant, we certainly can't fit them now.
        return { canReassign: false, moves: [], assignment: { tableIds: [] } };
    }

    // Try top 10 candidates (increased search depth for large groups)
    const candidates = idealResult.candidates.slice(0, 10);

    for (const candidate of candidates) {
        const targetTableIds = candidate.tableIds;

        // Identify blocking reservations in this target zone
        const blockingReservations = new Set<string>();

        for (const tId of targetTableIds) {
            const conflict = conflicts.find((c) => c.tableId === tId);
            if (conflict) {
                blockingReservations.add(conflict.reservationId);
            }
        }

        if (blockingReservations.size === 0) {
            // This path is technically free, but maybe findBestTableAssignmentWithAvailability failed 
            // because of some other reason or we are using this function proactively.
            // If it's free, return it.
            return { canReassign: true, moves: [], assignment: { tableIds: targetTableIds } };
        }

        // 3. Try to move EACH blocking reservation
        const moves: { reservationId: string; newTableIds: string[] }[] = [];
        let allMoved = true;

        // Fix #11: Track tables already claimed by previous moves in this iteration
        // to prevent two blocking reservations from being assigned to the same table.
        const claimedByMoves = new Set<string>();

        for (const resId of blockingReservations) {
            const resData = reservationMap.get(resId)!;
            const resStartTime = new Date(resData.reservation.startTime);
            const resEndTime = new Date(resData.reservation.endTime);

            // CRITICAL FIX: To move resData, we need tables that are free for its FULL original duration.
            // Not just the simulatedFree set (which only looks at the new party's window).

            // 1. Find what's unavailable during THIS specific reservation's full stay
            const unavailableDuringFullStay = await checkAvailability(prisma, {
                startTime: resStartTime,
                endTime: resEndTime,
                excludeReservationId: resId, // Exclude itself
            });

            // 2. Further exclude the tables targetTableIds because they are reserved for the new party
            // during the [startTime, endTime] window. Since there is an overlap between these windows,
            // we must not move resId into targetTableIds.
            // Fix #11: Also exclude tables already claimed by previous moves in this iteration.
            const restrictedIds = new Set([...unavailableDuringFullStay, ...targetTableIds, ...claimedByMoves]);

            const validPoolForThisMove = allTables
                .map(t => t.id)
                .filter(id => !restrictedIds.has(id));

            const moveResult = findBestTableAssignment(
                resData.reservation.partySize,
                validPoolForThisMove,
                { tables: allTables, adjacency }
            );

            if (moveResult.best) {
                moves.push({
                    reservationId: resId,
                    newTableIds: moveResult.best.tableIds,
                });

                // Fix #11: Mark these tables as claimed so subsequent moves can't use them
                for (const tid of moveResult.best.tableIds) {
                    claimedByMoves.add(tid);
                }
            } else {
                // Cannot move this blocking reservation
                allMoved = false;
                break;
            }
        }

        if (allMoved) {
            return {
                canReassign: true,
                moves,
                assignment: { tableIds: targetTableIds },
            };
        }
    }

    return { canReassign: false, moves: [], assignment: { tableIds: [] } };
}
