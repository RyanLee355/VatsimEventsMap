import { forwardRef, memo } from "react";
import GlobeComponent, { GlobeHandle } from "./globeComponents";

const GlobeWrapper = forwardRef<GlobeHandle, any>(
    ({ routes, rings, airportPoints, pilotData, dayNightMode, rangeCircle }, ref) => {
        return (
            <GlobeComponent
                ref={ref}
                routes={routes}
                rings={rings}
                airportPoints={airportPoints}
                pilotData={pilotData}
                dayNightMode={dayNightMode}
                rangeCircle={rangeCircle}
            />
        );
    }
);

GlobeWrapper.displayName = "GlobeWrapper";

export default memo(GlobeWrapper);