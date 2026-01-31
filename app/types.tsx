export type Route = {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    color: string[];
    eventName: string;
    startTime: Date;
    endTime: Date;
    banner: string | null;
    airportsInvolved: string[];
    category: DateCategory;
    startIcao: string;
    endIcao: string;
    link: string;
};

export type Ring = {
    lat: number;
    lng: number;
    color: string[];
    eventName: string;
    startTime: Date;
    endTime: Date;
    radius?: number;
    banner: string | null;
    category: DateCategory;
    icao: string;
    link: string;
};

export type DateCategory =
    | 'ongoing'
    | 'today'
    | 'tomorrow'
    | 'day2'
    | 'day3'
    | 'day4to5'
    | 'day6plus';

export type NetworkData = {
    general: GeneralInfo;
    pilots: Pilot[];
    controllers: Controller[];
    atis: Atis[];
    servers: Server[];
};

export type GeneralInfo = {
    version: number;
    reload: number;
    update: string; // ISO timestamp string
};

export type Pilot = {
    cid: number;
    name: string;
    callsign: string;
    server: string;

    pilot_rating: number;
    military_rating: number;

    latitude: number;
    longitude: number;
    altitude: number;
    groundspeed: number;
    heading: number;
    transponder: string;

    qnh_i_hg: number;
    qnh_mb: number;

    flight_plan: FlightPlan | null;

    logon_time: string;
    last_updated: string;
};

export type FlightPlan = {
    flight_rules: string;
    aircraft: string;
    aircraft_faa: string;

    departure: string;
    arrival: string;
    alternate: string;

    cruise_tas: number;
    altitude: string;

    route: string;
    remarks: string;

    enroute_time: string;
    fuel_time: string;
};

export type Controller = {
    cid: number;
    name: string;
    callsign: string;
    frequency: string;

    facility: number;
    rating: number;
    server: string;

    visual_range: number;
    text_atis: string | null;

    logon_time: string;
    last_updated: string;
};

export type Atis = {
    cid: number;
    callsign: string;
    frequency: string;
    facility: number;

    text_atis: string[];
    logon_time: string;
    last_updated: string;
};

export type Server = {
    ident: string;
    hostname: string;
    location: string;
};