export interface FilteredMs1Data {
    [key: string]: {
        IN: number;
        OUT: number;
        data: any[];
    }[];
}

export interface TargetTimestamps {
    [key: string]: {
        IN: number[];
        OUT: number[];
    };
}

export interface SimpleMs1Point {
    targetId: string;
    targetName?: string;
    lat: number;
    lon: number;
}

export interface TargetVisibility {
    [targetId: string]: boolean;
}

export interface Waypoint {
    WPid: string;
    nextWPid: string;
    lat: number | null;
    lon: number | null;
    alt_asl: number | null;
}

export interface Task {
    taskId: string;
    taskName: string;
    waypoints: Waypoint[];
    totalLegs: number;
    targetName: string;
}