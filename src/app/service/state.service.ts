import { Injectable } from '@angular/core';
import { TargetTimestamps, TargetVisibility, SimpleMs1Point, Task, Waypoint } from './interfaces.service';
import * as L from 'leaflet';

@Injectable({
    providedIn: 'root'
})

export class StateService {
    takeoffTimestamps: string[] = [];
    landingTimestamps: string[] = [];
    flightPath: { lat: number, lon: number, alt: number }[] = [];
    errorMessage: string = '';
    folderPath: string = '';
    folderName: string = '';
    trolleysName: string = '';
    trolleysFolders: string[] = [];
    sbeconfData: any = null;
    vertexes: any[] = [];
    vertexCoordinates: [number, number][] = [];
    extractedTargets: { targetname: string; lat: number; lon: number; length: number }[] = [];
    targets: any[] = [];
    showFlightPath: boolean = true;  // Stato della checkbox per il volo
    showTargets: boolean = true;     // Stato della checkbox per i target
    uniqueTargets: any[] = [];
    ms1Data: any[] = [];
    showMs1: boolean = false;
    me1Data: any[] = [];
    imageCount: number = 0;
    totalDurationInSeconds: number = 0;
    totalDistance: number = 0;
    targetsData: any[] = [];
    totalDistancesPerGroup: { [key: string]: number } = {};
    targetDistances: { [key: string]: number[] } = {};
    flightStartTime: number = 0; // Timestamp di inizio volo 
    flightEndTime: number = 0;   // Timestamp di fine volo 
    entryTimestamp: number = 0;
    exitTimestamp: number = 0;
    timestamps: TargetTimestamps = {};
    flightTimes: { [key: string]: number } = {};
    targetFlightTimes: { targetname: string; flightTime: number }[] = [];
    logArray: string[] = [];
    filteredMs1Points: SimpleMs1Point[] = [];
    targetVisibility: TargetVisibility = {};
    takeoffTimestampsNumeric: number[] = [];
    landingTimestampsNumeric: number[] = [];
    tasks: Task[] = [];
    showTasks: boolean = true;
    tasksLayer: L.LayerGroup = L.layerGroup();
    totalLegs: number = 0;
    inCountPerTarget: { [targetId: string]: number } = {};
    extractedTasks: { taskId: string; taskName: string; waypoints: Waypoint[]; totalLegs: number; targetName: string }[] = [];
    targetGroups: { [key: string]: L.LayerGroup } = {};
    legsPerTarget: { targetName: string; totalLegs: number }[] = [];
    targetPointCounts: { targetName: string, pointCount: number }[] = [];
    targetIdToNameMap: { [id: string]: string } = {};
    targetMap: Map<string, string> = new Map();
    targetAssociations: { targetId: string; targetName: string }[] = [];
    metadata: any[] = [];
    targetNamesAndIds: { targetname: string; targetId: string }[] = [];
    taskLegsVisibility: { [key: string]: boolean } = {};
    strobeVisibility: { [key: string]: boolean } = {};
    isMobile = false;

}