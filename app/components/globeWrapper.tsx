import { forwardRef } from "react";
import GlobeComponent, { GlobeHandle } from "./globeComponents";

const GlobeWrapper = forwardRef<GlobeHandle, any>(({ routes, rings, airportPoints, pilotData, dayNightMode }, ref) => {
    return (
        <GlobeComponent
            routes={routes}
            rings={rings}
            airportPoints={airportPoints}
            pilotData={pilotData}
            dayNightMode={dayNightMode}
            ref={ref}
        />
    );
});

export default GlobeWrapper;