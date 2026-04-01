import type { LayoutResponse, Table } from "../../api/layout.api";
import clsx from "clsx";

type FloorMapProps = {
    layout: LayoutResponse;
    unavailableTableIds?: string[];
    selectedTableIds?: string[];
    onSelectTable?: (tableId: string) => void;
    readOnly?: boolean;
    isAdminView?: boolean;
    partySize?: number;
};


export default function FloorMap({
    layout,
    unavailableTableIds = [],
    selectedTableIds = [],
    onSelectTable,
    readOnly = false,
    isAdminView = false,
    partySize,
}: FloorMapProps) {
    const PADDING = 40;

    // Calculate bounds dynamically from tables to ensure they are all visible
    const bounds = layout.tables.length > 0 
        ? layout.tables.reduce(
            (acc, t) => {
                return {
                    minX: Math.min(acc.minX, t.x),
                    minY: Math.min(acc.minY, t.y),
                    maxX: Math.max(acc.maxX, t.x + t.width),
                    maxY: Math.max(acc.maxY, t.y + t.height),
                };
            },
            { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
        )
        : { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

    // Set fallback if still Infinity (e.g. invalid tables)
    if (bounds.minX === Infinity) {
        bounds.minX = 0; bounds.minY = 0; bounds.maxX = 1000; bounds.maxY = 1000;
    }

    // Determine effective view mode
    const effectiveIsAdminView = isAdminView || layout.name === "Floor View";

    const getTableStatus = (table: Table) => {
        if (unavailableTableIds.includes(table.id)) return 'LOCKED';
        if (selectedTableIds.includes(table.id)) return 'SELECTED';

        // Kiosk/User View: Check if party fits
        if (!effectiveIsAdminView && partySize) {
            // Rule: Party must fit max capacity
            if (partySize > table.maxCapacity) return 'INVALID';

            // Rule: Large tables (merged) must meet min capacity
            const isLarge = table.type === "MERGED_FIXED" || table.maxCapacity >= 8;
            if (isLarge && partySize < table.minCapacity) return 'INVALID';

            // Rule: Circular tables for 5-7 only
            if (table.type === "CIRCULAR" && (partySize < 5 || partySize > 7)) return 'INVALID';
        }

        return table.status || 'AVAILABLE';
    };

    // deleted const isAdminView line


    return (
        <div className="w-full h-full relative select-none flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
            <div className="flex-grow relative overflow-hidden flex items-center justify-center bg-white/40 min-h-[400px]">
                <div className="w-full max-w-7xl p-4 sm:p-6 h-full flex items-center justify-center">
                    <svg
                        viewBox={`${bounds.minX - PADDING} ${bounds.minY - PADDING} ${bounds.maxX - bounds.minX + PADDING * 2} ${bounds.maxY - bounds.minY + PADDING * 2}`}
                        className="w-full h-full drop-shadow-xl"
                        style={{ filter: 'drop-shadow(0 20px 30px rgb(0 0 0 / 0.15))' }}
                    >
                        {/* Floor rendering */}
                        <path
                            d={`M ${bounds.minX - PADDING + 20} ${bounds.minY - PADDING}
                        h ${bounds.maxX - bounds.minX + PADDING * 2 - 40}
                        q 20 0 20 20
                        v ${bounds.maxY - bounds.minY + PADDING * 2 - 40}
                        q 0 20 -20 20
                        h -${bounds.maxX - bounds.minX + PADDING * 2 - 40}
                        q -20 0 -20 -20
                        v -${bounds.maxY - bounds.minY + PADDING * 2 - 40}
                        q 0 -20 20 -20 z`}
                            fill="#f8fafc"
                            stroke="#e2e8f0"
                            strokeWidth="4"
                        />

                        {/* Tables rendering */}
                        {layout.tables
                            .filter(t => t.id !== 'T15') // Always hide internal overflow table
                            .map((table) => {
                            const status = getTableStatus(table);
                            const isSelected = status === 'SELECTED';

                            const isTrulyLocked = status === 'LOCKED';
                            const isDimmed = !effectiveIsAdminView && (status === 'LOCKED' || status === 'INVALID' || status === 'OCCUPIED' || status === 'RESERVED');

                            let fillColor = "#ffffff";
                            let strokeColor = "#cbd5e1";
                            let opacity = "1";

                            if (isSelected) {
                                fillColor = "#2563eb"; // Blue
                                strokeColor = "#1e40af";
                            } else if (isDimmed) {
                                fillColor = "#f1f5f9"; // Slate 100 
                                strokeColor = "#cbd5e1";
                                opacity = "0.7";
                            } else if (status === 'OCCUPIED' && effectiveIsAdminView) {
                                fillColor = "#fffbeb"; // Amber 50
                                strokeColor = "#fbbf24";
                            } else if (status === 'RESERVED' && effectiveIsAdminView) {
                                fillColor = "#faf5ff"; // Purple 50
                                strokeColor = "#a855f7";
                            } else {
                                // Available
                                strokeColor = "#94a3b8";
                            }

                            const handleClick = () => {
                                if (readOnly || isTrulyLocked) return;
                                onSelectTable?.(table.id);
                            };

                            const commonProps = {
                                fill: fillColor,
                                stroke: strokeColor,
                                strokeWidth: "2",
                                opacity: opacity,
                                className: clsx(
                                    "transition-all duration-200",
                                    (!isTrulyLocked && !readOnly) && "cursor-pointer hover:opacity-80"
                                )
                            };

                            // Center for text
                            let cx = table.x + table.width / 2;
                            let cy = table.y + table.height / 2;

                            if (table.shape === "CIRCLE") {
                                const r = Math.min(table.width, table.height) / 2;
                                cx = table.x + r;
                                cy = table.y + r;

                                return (
                                    <g key={table.id} onClick={handleClick}>
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={r}
                                            {...commonProps}
                                        />
                                        <text
                                            x={cx}
                                            y={cy}
                                            dy="0.3em"
                                            textAnchor="middle"
                                            className={clsx(
                                                "text-[24px] font-black pointer-events-none select-none",
                                                isSelected ? "fill-white" :
                                                    (status === "OCCUPIED" && effectiveIsAdminView) ? "fill-amber-900" :
                                                        (status === "RESERVED" && effectiveIsAdminView) ? "fill-purple-900" :
                                                            "fill-slate-900"
                                            )}
                                        >
                                            {table.id.replace(/[A-Z]/g, "")}
                                        </text>
                                    </g>
                                );
                            }

                            return (
                                <g key={table.id} onClick={handleClick}>
                                    <rect
                                        x={table.x}
                                        y={table.y}
                                        width={table.width}
                                        height={table.height}
                                        rx={4}
                                        {...commonProps}
                                    />
                                    <text
                                        x={cx}
                                        y={cy}
                                        dy="0.3em"
                                        textAnchor="middle"
                                        className={clsx(
                                            "text-[24px] font-black pointer-events-none select-none",
                                            isSelected ? "fill-white" :
                                                (status === "OCCUPIED" && effectiveIsAdminView) ? "fill-amber-900" :
                                                    (status === "RESERVED" && effectiveIsAdminView) ? "fill-purple-900" :
                                                        "fill-slate-900"
                                        )}
                                    >
                                        {table.id.replace(/[A-Z]/g, "")}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>
            <div className="p-4 bg-white/90 backdrop-blur-sm flex flex-wrap items-center justify-start xs:justify-center gap-x-4 sm:gap-x-6 gap-y-2 text-[10px] sm:text-xs font-semibold border-t border-slate-200">
                {/* Legend */}
                {isAdminView ? (
                    // Admin Legend
                    <>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-white border border-slate-200 shadow-sm" />
                            <span className="text-xs font-medium text-slate-600">Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-50 border border-amber-200 shadow-sm" />
                            <span className="text-xs font-medium text-slate-600">Occupied</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-purple-50 border border-purple-200 shadow-sm" />
                            <span className="text-xs font-medium text-slate-600">Reserved</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-600 shadow-sm" />
                            <span className="text-xs font-medium text-slate-600">Your Selection</span>
                        </div>
                    </>
                ) : (
                    // User Legend
                    <>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-white border border-slate-200 shadow-sm" />
                            <span className="text-xs font-medium text-slate-600">Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-100 border border-slate-200" />
                            <span className="text-xs font-medium text-slate-600">Unavailable</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-600 shadow-sm" />
                            <span className="text-xs font-medium text-slate-600">Your Selection</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
