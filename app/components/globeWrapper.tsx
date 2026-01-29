import GlobeComponent from "./globeComponents";
import { Route, Ring, Pilot } from "@/app/types";

type Props = {
    routes: Route[];
    rings: Ring[];
    airportPoints: any[];
    pilotData: Pilot[];
    dayNightMode: boolean;
};

export default function GlobeWrapper({ routes, rings, airportPoints, pilotData, dayNightMode }: Props) {
    return (
        <GlobeComponent
            routes={routes}
            rings={rings}
            airportPoints={airportPoints}
            pilotData={pilotData}
            dayNightMode={dayNightMode}
        />
    );
}