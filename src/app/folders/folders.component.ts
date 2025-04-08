import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { LeafletModule } from '@bluehalo/ngx-leaflet';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';

interface FilteredMs1Data {
  [key: string]: {
    IN: number;    // Timestamp in ms
    OUT: number;   // Timestamp in ms
    data: any[];
  }[];
}

interface TargetTimestamps {
  [key: string]: {
    IN: number[];
    OUT: number[];
  };
}

interface SimpleMs1Point {
  targetId: string;
  targetName?: string;
  lat: number;
  lon: number;
}

interface TargetVisibility {
  [targetId: string]: boolean;
}

interface Waypoint {
  WPid: string;
  nextWPid: string;
  lat: number | null;
  lon: number | null;
  alt_asl: number | null;
}

interface Task {
  taskId: string;
  taskName: string;
  waypoints: Waypoint[];
  totalLegs: number;
  targetName: string;
}

@Component({
  selector: 'app-folders',
  standalone: true,
  imports: [CommonModule, LeafletModule, FormsModule, MatCardModule],
  templateUrl: './folders.component.html',
  styleUrls: ['./folders.component.css']
})
export class FoldersComponent implements OnInit {

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




  private map!: L.Map;
  private ms1PointsLayers: { [targetId: string]: L.LayerGroup } = {};
  private flightPathLayer?: L.Polyline;
  private targetsLayer: L.LayerGroup = L.layerGroup();
  private apiUrlLogArray = 'http://localhost:3000/log-array';
  private apiUrlNavData = 'http://localhost:3000/nav-data';
  private apiUrlFolderName = 'http://localhost:3000/get-folder-name';
  private apiUrlTrolleysFolders = 'http://localhost:3000/get-trolleys-folders';
  private apiUrlSbeconf = 'http://localhost:3000/sbeconf';

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
  ) { }


  ngOnInit(): void {

    this.http.get<{ count: number }>('http://localhost:3000/api/image-count').subscribe(
      data => {
        this.imageCount = data.count; // Assegna il numero di immagini
      },
      error => {
        console.error('Errore nel recupero del numero di immagini:', error);
      }
    );


    // Chiamata API per recuperare i dati dal server
    this.http.get<{ data: any[] }>('http://localhost:3000/api/me1')
      .subscribe(
        (response) => {
          this.me1Data = response.data; // Assegna i dati ricevuti alla variabile me1Data
          console.log(this.me1Data); // Log per assicurarsi che i dati siano correttamente caricati
        },
        (error) => {
          console.error('Errore nel recupero dei dati:', error);
        }
      );

    this.http.get<any[]>('http://localhost:3000/api/ms1').subscribe(
      data => {
        console.log('📥 Dati ricevuti dal server:', data);

        // Salva direttamente i dati senza formattare il timestamp
        this.ms1Data = data.map(item => ({
          timestamp: item.timestamp, // Mantiene il valore numerico
          lat: item.lat,
          lon: item.lon
        }));

        console.log("📊 ms1Data popolato con:", this.ms1Data);

        // Chiamo extractTimestamps() PRIMA di filtrare i dati
        this.extractTimestamps(this.logArray);

        // Ora chiamo il filtro SOLO DOPO extractTimestamps
        setTimeout(() => {
          const filteredResults = this.filterMs1DataByFlightTimes();

          // Aggiungi i dati di targetNamesAndIds al log
          console.log("📌 Dati filtrati per target:", JSON.stringify(filteredResults, null, 2));
          console.log("Dati targetNamesAndIds:", JSON.stringify(this.targetNamesAndIds, null, 2));
        }, 100);
      },
      error => console.error('Errore nel recupero dati:', error)
    );

    this.http.get<any>(this.apiUrlSbeconf).subscribe(
      response => {
        console.log('📥 Dati ricevuti da sbeconf:', response);

        // Estraiamo metadata, targets e tasks dalla risposta
        const { metadata = [], targets = [], tasks = [] } = response;

        if (!Array.isArray(metadata)) {
          console.error('❌ Errore: "metadata" non è un array valido!', metadata);
          return;
        }

        if (!Array.isArray(targets)) {
          console.error('❌ Errore: "targets" non è un array valido!', targets);
          return;
        }

        if (!Array.isArray(tasks)) {
          console.error('❌ Errore: "tasks" non è un array valido!', tasks);
          return;
        }

        // ✅ Salviamo separatamente i metadati, i targets e i tasks
        this.metadata = metadata;
        this.targets = this.extractTargetsFromJSON(targets);
        this.tasks = tasks;

        console.log('📊 Metadati ricevuti:', this.metadata);
        console.log('✅ Targets estratti:', this.targets);
        console.log('✅ Tasks ricevuti:', this.tasks);

        // Processiamo il conteggio dei punti per target
        this.targetPointCounts = this.countPointsPerTarget(this.tasks);

        // Il resto della logica rimane invariato
        const targetGroups = this.groupTargetsByName();
        this.assignTargetIdsToGroups(targetGroups);
        this.assignFlightTimes(this.targets, this.flightTimes);
        this.uniqueTargets = this.getUniqueTargets(this.targets);
        this.uniqueTargets.forEach(target => {
          target.totalDistance = this.calculateTotalDistanceForTarget(target.targetname);
        });

        console.log('🚀 Lista targets unici con distanza:', this.uniqueTargets);
      },
      error => {
        console.error('❌ Errore durante la chiamata API a sbeconf:', error);
      }
    );

    // Recupero del folderPath dai parametri della route
    this.route.paramMap.subscribe(params => {
      this.folderPath = params.get('folderPath') || '';
    });

    // Altri metodi per recuperare i dati
    this.getTrolleysFolders().subscribe(response => {
      this.trolleysFolders = response.folders;
    });

    this.getLogArray().subscribe(response => {
      this.extractTimestamps(response.array);
    });

    this.getNavData().subscribe(response => {
      this.extractNavData(response.flightData);
    });

    this.getTrolleysName().subscribe(response => {
      this.trolleysName = response.trolleysName;
      this.trolleysFolders.pop();
    });

    this.loadTrolleysFolders();

    // Chiamata HTTP per ottenere i dati dal backend
    this.http.get<any>(this.apiUrlSbeconf).subscribe(
      data => {
        console.log('📥 Dati ricevuti da sbeconf:', data); // Log dei dati ricevuti
        console.log('Dati tasks:', data?.tasks);

        if (!data || !Array.isArray(data.targets)) {
          console.error('❌ Errore: "targets" non è un array', data.targets);
          return;
        }

        if (!data || !Array.isArray(data.tasks)) {
          console.error('❌ Errore: "tasks" non è un array', data.tasks);
          return;
        }

        this.targets = data.targets;
        this.tasks = data.tasks || []; // Se tasks è undefined, assegna un array vuoto

        console.log('✅ Targets:', this.targets);
        console.log('✅ Tasks:', this.tasks);

        // Continua con la logica esistente
        const targetGroups = this.groupTargetsByName();
        this.assignTargetIdsToGroups(targetGroups);
        this.assignFlightTimes(this.targets, this.flightTimes);
        this.uniqueTargets = this.getUniqueTargets(this.targets);
        console.log('✅ Unique Targets:', this.uniqueTargets);
        this.uniqueTargets.forEach(target => {
          target.totalDistance = this.calculateTotalDistanceForTarget(target.targetname);
        });

        console.log('🎯 Targets unici:', this.uniqueTargets);
      },
      error => {
        console.error('❌ Errore nella chiamata a sbeconf:', error);
      }

    );


  }


  calculateTotalDistanceForTarget(targetName: string): number {
    // Filtra i target per nome
    const targetsForName = this.targets.filter(t => t.targetname === targetName);

    let totalDistance = 0;

    // Calcola la distanza tra i punti consecutivi
    for (let i = 1; i < targetsForName.length; i++) {
      const target1 = targetsForName[i - 1];
      const target2 = targetsForName[i];
      totalDistance += this.haversineDistance(target1.lat, target1.lon, target2.lat, target2.lon);
    }

    return totalDistance / 1000; // Converti da metri a chilometri
  }
  assignFlightTimes(targets: any[], flightTimes: { [key: number]: number }): void {
    targets.forEach(target => {
      if (flightTimes.hasOwnProperty(target.targetId)) {
        target.flightTime = flightTimes[target.targetId];
      }
    });
  }

  formatFlightTime(seconds: number): string {
    // Controllo se il valore non è un numero valido
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "00:00:00";
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  assignTargetIdsToGroups(targetGroups: { [key: string]: any[] }): void {
    let nextId = 0; // Partiamo da 0

    for (const targetname of Object.keys(targetGroups)) {
      targetGroups[targetname].forEach(target => {
        target.targetId = nextId; // Assegna lo stesso ID a tutti i target con lo stesso nome
      });
      nextId++; // Incrementa l'ID per il prossimo gruppo
    }
  }
  assignFlightTimesToTargets(targets: any[], flightTimes: { [key: string]: number }): void {
    targets.forEach(target => {
      if (target.targetId !== undefined && flightTimes[target.targetId]) {
        target.flightTime = flightTimes[target.targetId]; // Assegna il flightTime
      } else {
        target.flightTime = 0; // Se non esiste, imposta flightTime a 0
      }
    });
  }

  getKeys(obj: object): string[] {
    return Object.keys(obj);
  }

  getObjectKeys(obj: { [key: string]: any }): string[] {
    return Object.keys(obj);
  }

  getTargets(): Observable<any> {
    return this.http.get<any>(this.apiUrlSbeconf);
  }

  getlastIndex(): number {
    const lastItem = this.me1Data[this.me1Data.length - 1];
    return this.me1Data.length
  }

  getTotalElements() {
    return this.ms1Data.length;
  }

  loadTrolleysFolders() {
    this.http.get<{ folders: string[] }>(this.apiUrlTrolleysFolders).subscribe(response => {
      this.trolleysFolders = response.folders; // Imposta l'array di cartelle
    });
  }

  // Funzione per navigare al componente Sensor
  navigateToSensor(folder: string) {
    // Crea una copia dell'array trolleysFolders
    const folderArrayCopy = [...this.trolleysFolders];

    // Rimuovi l'ultimo elemento dalla copia
    folderArrayCopy.pop();

    // Naviga al componente Sensor con il nome della cartella
    if (folderArrayCopy.length > 0) {
      this.router.navigate(['/sensor', folder]);
    }
  }


  // Funzione per estrarre i targets in modo unico con targetId progressivi
  extractTargetsFromJSON(targets: any[]): { targetname: string; lat: number; lon: number; targetId: string; flightTime: number }[] {
    console.log('🔍 targets ricevuti:', targets);

    // Verifica che i targets siano un array valido
    if (!Array.isArray(targets)) {
      console.error('❌ Errore: targets non è un array!', targets);
      return [];
    }

    // Usa una mappa per ottenere targets unici
    const uniqueTargets = new Map<string, { targetname: string; lat: number; lon: number; targetId: string; flightTime: number }>();

    // Variabile per salvare i targetname e targetId con ID progressivi
    this.targetNamesAndIds = [];

    // Set per tracciare targetname unici
    const seenTargetNames = new Set<string>();

    // Contatore per targetId progressivo
    let targetCounter = 0;

    targets.forEach(target => {
      if (!target || typeof target !== 'object') {
        console.error('⚠️ Target non valido:', target);
        return;
      }

      const targetname = target.targetname || "Sconosciuto";

      // Aggiungi targetname e assegna un targetId progressivo solo se non è già stato visto
      if (!seenTargetNames.has(targetname)) {
        const targetId = `${targetCounter++}`; // Assegna un targetId progressivo
        this.targetNamesAndIds.push({
          targetname: targetname,
          targetId: targetId
        });
        seenTargetNames.add(targetname); // Marca il targetname come visto
      }
    });

    // Logga i targetname e targetId solo una volta, dopo che l'elaborazione è completa
    console.log('📌 targetname e targetId ', this.targetNamesAndIds);

    return [];
  }


  /// Funzione per estrarre i tasks dal file sbeconf.jsn
  extractTasksFromJSON(jsonData: any): { taskId: string; taskName: string; waypoints: Waypoint[]; totalLegs: number; targetName: string }[] {
    console.log('🔍 JSON ricevuto:', jsonData);

    if (!jsonData?.MissionPlanInfo?.target || !Array.isArray(jsonData.MissionPlanInfo.target)) {
      console.error('❌ Errore: Nessun target trovato nel JSON!');
      return [];
    }

    // Definiamo il tipo per target
    type Target = {
      "@targetid": string;
      "@targetname": string;
      tasks?: Task[];
    };

    // Definiamo il tipo per task
    type Task = {
      "@taskid": string;
      "@taskname": string;
      waypoint?: any[];
    };

    // Creiamo una mappa dei target per associarli ai task
    const targetMap = new Map<string, string>(); // targetId -> targetName
    jsonData.MissionPlanInfo.target.forEach((target: Target) => {
      if (target["@targetid"] && target["@targetname"]) {
        targetMap.set(target["@targetid"], target["@targetname"]);
      }
    });

    console.log('🔍 targetMap:', targetMap);

    // Estrazione di tutti i tasks
    const extractedTasks: { taskId: string; taskName: string; waypoints: Waypoint[]; totalLegs: number; targetName: string }[] = [];

    jsonData.MissionPlanInfo.target.forEach((target: Target) => {
      if (!Array.isArray(target.tasks)) return;

      target.tasks.forEach((task: Task) => {
        const taskId = task["@taskid"] || "Sconosciuto";
        const taskName = task["@taskname"] || "Sconosciuto";

        // Associa targetName al task
        const targetName = targetMap.get(target["@targetid"]) || "Sconosciuto";

        console.log(`📌 Task ID: ${taskId}, Task Name: ${taskName}, Target Name: ${targetName}`);

        // Estrazione dei waypoint validi
        const waypoints: Waypoint[] = task.waypoint?.map((wp: any) => ({
          WPid: wp["@WPid"] || "Sconosciuto",
          nextWPid: wp["@nextWPid"] || "Sconosciuto",
          lat: wp.wgs84_coord?.["@lat"] ? parseFloat(wp.wgs84_coord["@lat"]) : null,
          lon: wp.wgs84_coord?.["@lon"] ? parseFloat(wp.wgs84_coord["@lon"]) : null,
          alt_asl: wp.wgs84_coord?.["@alt_asl"] ? parseFloat(wp.wgs84_coord["@alt_asl"]) : null
        })) || [];

        // Filtriamo i waypoint con lat/lon nulli
        const validWaypoints = waypoints.filter(wp => wp.lat !== null && wp.lon !== null);

        // Calcoliamo il numero di leg (tratti tra waypoint consecutivi)
        const totalLegs = validWaypoints.length > 0 ? validWaypoints.length - 1 : 0;

        console.log(`📌 Task ${taskId} (${targetName}): ${validWaypoints.length} waypoint(s), ${totalLegs} leg(s)`);

        extractedTasks.push({
          taskId,
          taskName,
          waypoints: validWaypoints,
          totalLegs,
          targetName // Assicuriamo che il task abbia il nome del target corretto
        });
      });
    });

    // Calcoliamo il totale complessivo di tutti i leg
    this.totalLegs = extractedTasks.reduce((sum, task) => sum + task.totalLegs, 0);
    console.log(`Totale generale: ${this.totalLegs} leg(s)`);

    // Raggruppiamo per targetName e calcoliamo i leg per target
    const legsPerTarget = extractedTasks.reduce((acc, task) => {
      if (!acc[task.targetName]) {
        acc[task.targetName] = 0;
      }
      acc[task.targetName] += task.totalLegs;
      return acc;
    }, {} as { [key: string]: number });

    console.log('Legs per target:', legsPerTarget);

    // Aggiorniamo la variabile this.tasks
    this.tasks = extractedTasks;
    console.log("📝 Tasks Estratti:", this.tasks);
    this.legsPerTarget = this.calculateLegsPerTarget();
    console.log('Legs per target:', this.legsPerTarget);

    return extractedTasks;
  }

  getLegsPerTarget(): { targetName: string; legsCount: number }[] {
    const legsMap = this.tasks.reduce((acc, task) => {
      if (!acc[task.targetName]) {
        acc[task.targetName] = 0;
      }
      acc[task.targetName] += task.totalLegs;
      return acc;
    }, {} as { [key: string]: number });

    return Object.keys(legsMap).map(targetName => ({
      targetName,
      legsCount: legsMap[targetName]
    }));
  }

  calculateLegsPerTarget(): { targetName: string; totalLegs: number }[] {
    const legsMap = this.tasks.reduce((acc, task) => {
      if (!acc[task.targetName]) {
        acc[task.targetName] = 0;
      }
      acc[task.targetName] += task.totalLegs;
      return acc;
    }, {} as { [key: string]: number });

    return Object.keys(legsMap).map(targetName => ({
      targetName,
      totalLegs: legsMap[targetName]
    }));
  }
  countPointsPerTarget(tasks: Task[]): { targetName: string, pointCount: number }[] {
    const countMap = new Map<string, number>();

    tasks.forEach(task => {
      // Filtra solo i waypoint con lat/lon validi
      const validWaypoints = task.waypoints.filter(wp => wp.lat !== null && wp.lon !== null);
      const currentCount = countMap.get(task.targetName) || 0;
      countMap.set(task.targetName, currentCount + validWaypoints.length / 2);
    });

    return Array.from(countMap.entries()).map(([targetName, pointCount]) => ({
      targetName,
      pointCount
    }));
  }

  getTotalPoints(): number {
    return this.targetPointCounts.reduce((sum, item) => sum + item.pointCount, 0);
  }

  getPointCountForTarget(targetName: string): number | null {
    const target = this.targetPointCounts.find(t => t.targetName === targetName);
    return target ? target.pointCount : null;
  }

  // Verifica se un target ha punti strobe
  hasStrobePoints(targetName: string): boolean {
    const targetId = this.getTargetId(targetName);
    return this.filteredMs1Points.some(p => p.targetId === targetId);
  }

  // Conta i punti strobe per target
  countStrobePoints(targetName: string): number {
    const targetId = this.getTargetId(targetName);
    return this.filteredMs1Points.filter(p => p.targetId === targetId).length;
  }

  // Verifica se un target ha task legs
  hasTaskLegs(targetName: string): boolean {
    return this.tasks.some(task => task.targetName === targetName);
  }

  // Ottieni l'ID del target dal nome
  getTargetId(targetName: string): string {
    const target = this.uniqueTargets.find(t => t.targetname === targetName);
    return target?.targetId || '';
  }
  // Funzione che calcola la distanza tra due punti usando la formula di Haversine
  haversineTargetDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Raggio della Terra in metri
    const φ1 = lat1 * Math.PI / 180; // Latitudine 1 in radianti
    const φ2 = lat2 * Math.PI / 180; // Latitudine 2 in radianti
    const Δφ = (lat2 - lat1) * Math.PI / 180; // Differenza in latitudine
    const Δλ = (lon2 - lon1) * Math.PI / 180; // Differenza in longitudine

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distanza in metri
  }

  // Funzione che calcola la distanza tra ogni target per gruppo e la distanza totale per ciascun gruppo
  calculateTargetDistances(): void {
    const groupedTargets = this.groupTargetsByName();

    // Per ogni gruppo calcoliamo la distanza tra i target consecutivi
    Object.keys(groupedTargets).forEach(group => {
      const targetsInGroup = groupedTargets[group];
      let totalDistance = 0;
      const distances = [];

      for (let i = 1; i < targetsInGroup.length; i++) {
        const target1 = targetsInGroup[i - 1];
        const target2 = targetsInGroup[i];

        const distance = this.haversineTargetDistance(target1.lat, target1.lon, target2.lat, target2.lon);
        const distanceInKm = distance / 1000; // Distanza in chilometri
        distances.push(distanceInKm); // Aggiungi la distanza dell'intervallo
        totalDistance += distanceInKm; // Aggiungi alla distanza totale
      }

      // Salva le distanze e la distanza totale per ciascun gruppo
      this.targetDistances[group] = distances;
      this.totalDistancesPerGroup[group] = totalDistance;
    });
  }

  // Funzione che raggruppa i target per nome
  groupTargetsByName(): any {
    return this.targets.reduce((groups, target) => {
      const { targetname } = target;
      if (!groups[targetname]) {
        groups[targetname] = [];
      }
      groups[targetname].push(target);
      return groups;
    }, {});
  }

  getTrolleysFolders(): Observable<any> {
    return this.http.get<{ folders: string[] }>(this.apiUrlTrolleysFolders);
  }

  getTrolleysName(): Observable<any> {
    return this.http.get<{ trolleysName: string }>(this.apiUrlFolderName);
  }

  getLogArray(): Observable<any> {
    return this.http.get<any>(this.apiUrlLogArray, { params: { path: 'Volo20250210-IT-PIE06/Mission/BIU/02101335.log' } });
  }

  getNavData(): Observable<any> {
    return this.http.get<any>(this.apiUrlNavData, { params: { path: 'Volo20250210-IT-PIE06/Mission/BIU/02101335.nav' } });
  }

  extractTimestamps(logArray: string[] | undefined): void {
    if (!logArray || !Array.isArray(logArray)) {
      console.error('logArray non è definito o non è un array:', logArray);
      return;
    }


    // Conserva i timestamp come numeri (millisecondi)
    this.takeoffTimestampsNumeric = logArray
      .filter(line => line.includes("INFO: TAKEOFF DETECTED"))
      .map(line => parseInt(line.split(' - ')[0].trim()) * 1000);

    this.landingTimestampsNumeric = logArray
      .filter(line => line.includes("INFO: LANDING DETECTED"))
      .map(line => parseInt(line.split(' - ')[0].trim()) * 1000);

    // Converti in stringhe solo per visualizzazione
    this.takeoffTimestamps = this.takeoffTimestampsNumeric
      .map(ts => new Date(ts).toLocaleString());

    this.landingTimestamps = this.landingTimestampsNumeric
      .map(ts => new Date(ts).toLocaleString());

    // Calcola la durata usando i valori numerici
    this.totalDurationInSeconds = this.calculateTotalDurationInSeconds();

    // Inizializza l'oggetto per memorizzare i timestamp per target
    this.timestamps = {};
    this.inCountPerTarget = {};



    logArray.forEach(line => {
      const match = line.match(/^(\d+) - INFO: (IN|OUT) TARGET (\d+) \(\d+\) \(DSA\)/);
      if (match) {
        const targetId = String(match[3]);
        const type = match[2] as keyof { IN: number[]; OUT: number[] };

        if (!this.timestamps[targetId]) {
          this.timestamps[targetId] = { IN: [], OUT: [] };
          this.inCountPerTarget[targetId] = 0; // Inizializza a 0 per questo target
        }

        if (type === 'IN') {
          this.inCountPerTarget[targetId]++; // Incrementa il conteggio
        }

        const timestamp = parseInt(match[1]) * 1000;
        this.timestamps[targetId][type].push(timestamp);
      }
    });

    console.log('Conteggio IN per target:', this.inCountPerTarget);
    console.log('Timestamps estratti:', this.timestamps);


    this.flightTimes = this.calculateFlightTime();
    console.log('Tempi di volo:', this.flightTimes);


  }


  getTimestampKeys(): string[] {
    return Object.keys(this.timestamps);
  }

  calculateFlightTime(): { [key: string]: number } {
    const flightTimes: { [key: string]: number } = {};

    for (const targetId of Object.keys(this.timestamps)) {
      const target = this.timestamps[targetId];
      let totalFlightTime = 0;

      const numPairs = Math.min(target.IN.length, target.OUT.length);

      for (let i = 0; i < numPairs; i++) {
        const inTime = target.IN[i];
        const outTime = target.OUT[i];

        if (typeof inTime === 'number' && !isNaN(inTime) &&
          typeof outTime === 'number' && !isNaN(outTime)) {
          const flightTime = (outTime - inTime) / 1000;
          totalFlightTime += flightTime;
        }
      }

      // Assegna 0 se non c'è un tempo di volo valido
      flightTimes[targetId] = totalFlightTime || 0;
    }

    return flightTimes;
  }

  // 4. Modifica calculateTotalDurationInSeconds()
  calculateTotalDurationInSeconds(): number {
    let totalDuration = 0;

    // Verifica che gli array esistano e abbiano elementi
    if (!this.takeoffTimestampsNumeric || !this.landingTimestampsNumeric ||
      this.takeoffTimestampsNumeric.length === 0 ||
      this.landingTimestampsNumeric.length === 0) {
      return 0; // Restituisce 0 invece di NaN
    }

    for (let i = 0; i < Math.min(
      this.takeoffTimestampsNumeric.length,
      this.landingTimestampsNumeric.length
    ); i++) {
      const takeoff = this.takeoffTimestampsNumeric[i];
      const landing = this.landingTimestampsNumeric[i];

      if (typeof takeoff === 'number' && !isNaN(takeoff) &&
        typeof landing === 'number' && !isNaN(landing)) {
        const durationMs = landing - takeoff;
        totalDuration += durationMs / 1000;
      }
    }

    return totalDuration || 0; // Restituisce 0 se totalDuration è NaN
  }

  formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
    const hours = Math.floor(seconds / 3600); // Calcola le ore
    const minutes = Math.floor((seconds % 3600) / 60); // Calcola i minuti
    const secs = Math.floor(seconds % 60); // Calcola i secondi

    // Formatta il tempo come HH:MM:SS
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Funzione per convertire i secondi in formato ore:minuti:secondi
  convertSecondsToHMS(seconds: number): string {
    // Controllo se il valore non è un numero valido
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "00:00:00";
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(secs)}`;
  }

  private padZero(num: number): string {
    // Gestione dei casi non numerici
    if (!Number.isFinite(num)) {
      return "00";
    }
    return num < 10 ? `0${Math.floor(num)}` : `${Math.floor(num)}`;
  }

  extractNavData(flightData: string): void {
    if (!flightData) return;

    const lines = flightData.split('\n').map(line => line.trim()).filter(line => line !== '');
    this.flightPath = lines.map(line => {
      const parts = line.split(';');
      if (parts.length >= 4) {
        const lat = parseFloat(parts[4].trim());
        const lon = parseFloat(parts[5].trim());
        const alt = parseFloat(parts[6].trim());
        return { lat, lon, alt };
      }
      return null;
    }).filter(item => item !== null);

    // Calcola la lunghezza del tracciato in chilometri
    let totalDistance = 0;
    for (let i = 0; i < this.flightPath.length - 1; i++) {
      const point1 = this.flightPath[i];
      const point2 = this.flightPath[i + 1];
      totalDistance += this.haversineDistance(point1.lat, point1.lon, point2.lat, point2.lon);
    }

    // Convertiamo la distanza da metri a chilometri
    this.totalDistance = totalDistance / 1000;  // Assegna il risultato alla proprietà totalDistance

    console.log('Lunghezza totale del tracciato di volo (in chilometri):', this.totalDistance);

    this.initMap();
  }

  haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Raggio della Terra in metri
    const φ1 = lat1 * Math.PI / 180; // Latitudine 1 in radianti
    const φ2 = lat2 * Math.PI / 180; // Latitudine 2 in radianti
    const Δφ = (lat2 - lat1) * Math.PI / 180; // Differenza in latitudine
    const Δλ = (lon2 - lon1) * Math.PI / 180; // Differenza in longitudine

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distanza in metri
  }

  // Calcola la distanza totale per un target
  calculateTotalDistance(targetName: string): number {
    if (!this.targetDistances || !this.targetDistances[targetName] || this.targetDistances[targetName].length === 0) {
      console.error(`Nessuna distanza trovata per il target: ${targetName}`);
      return 0;
    }
    return this.targetDistances[targetName].reduce((sum, distance) => sum + distance, 0);
  }


  // Funzione che filtra i dati di ms1Data usando timestamp numerici
  filterMs1DataByFlightTimes(): {
    [key: string]: {
      targetName: string;
      data: { IN: number; OUT: number; data: any[] }[];
    };
  } {
    const filteredData: {
      [key: string]: {
        targetName: string;
        data: { IN: number; OUT: number; data: any[] }[];
      };
    } = {};

    this.filteredMs1Points = [];

    if (!this.timestamps || Object.keys(this.timestamps).length === 0) {
      console.warn('⛔ Nessun timestamp disponibile');
      return filteredData;
    }

    // 🔹 Mappa ID -> Nome target
    const targetIdToName = this.targetNamesAndIds.reduce((acc, t) => {
      acc[String(t.targetId)] = t.targetname; // Assicura che targetId sia trattato come stringa
      return acc;
    }, {} as { [key: string]: string });

    const mapReady = !!this.map && typeof this.map.addLayer === 'function';

    Object.entries(this.timestamps).forEach(([targetId, targetTimestamps]) => {
      const targetIdStr = String(targetId); // Assicura che targetId sia una stringa
      const targetName = targetIdToName[targetIdStr] || "Sconosciuto";  // Usa "Sconosciuto" come fallback

      // Se la mappa è pronta e il layer non esiste, crea il layer
      if (mapReady && !this.ms1PointsLayers[targetIdStr]) {
        this.ms1PointsLayers[targetIdStr] = L.layerGroup().addTo(this.map);
      }

      this.targetVisibility[targetIdStr] = this.targetVisibility[targetIdStr] ?? false;

      filteredData[targetIdStr] = {
        targetName,
        data: []
      };

      const numPairs = Math.min(targetTimestamps.IN.length, targetTimestamps.OUT.length);

      for (let i = 0; i < numPairs; i++) {
        const inTime = targetTimestamps.IN[i];
        const outTime = targetTimestamps.OUT[i];

        // Se i timestamp non sono validi, salta questo ciclo
        if (!this.isValidTimestamp(inTime) || !this.isValidTimestamp(outTime)) {
          console.warn(`⚠️ Timestamp non valido per targetId ${targetIdStr}: IN=${inTime}, OUT=${outTime}`);
          continue;
        }

        // Filtra i dati MS1 in base ai timestamp
        const ms1Filtered = this.ms1Data.filter(entry =>
          this.isValidTimestamp(entry.timestamp) &&
          entry.timestamp >= inTime &&
          entry.timestamp <= outTime
        );

        ms1Filtered.forEach(point => {
          this.filteredMs1Points.push({
            targetId: targetIdStr,
            targetName,
            lat: point.lat,
            lon: point.lon
          });
        });

        // Aggiungi il dato filtrato per il target
        filteredData[targetIdStr].data.push({
          IN: inTime,
          OUT: outTime,
          data: ms1Filtered
        });
      }
    });

    // Aggiorna la visibilità dei punti MS1 sulla mappa (solo se la mappa è pronta)
    if (mapReady) {
      setTimeout(() => {
        this.updateFilteredMs1Visibility();
        console.log('✅ Mappa aggiornata con punti filtrati');
      }, 0);
    }

    return filteredData;
  }

  // 🔹 Funzione di supporto per verificare se un timestamp è valido
  isValidTimestamp(time: any): boolean {
    return typeof time === 'number' && !isNaN(time);
  }

  getTargetNames(): string[] {
    return this.targetNamesAndIds.map(t => t.targetname);
  }

  countPointsForTarget(targetName: string): number {
    if (!this.filteredMs1Points) return 0;

    // Conta i punti filtrati per targetName
    const count = this.filteredMs1Points.filter(p => p.targetName === targetName).length;

    // Trova il target corrispondente
    const target = this.targetNamesAndIds.find(t => t.targetname === targetName);
    const name = target ? target.targetname : "Sconosciuto";

    console.log(`ℹ️ ${name} (${targetName}) ha ${count} punti filtrati`);

    return count;
  }


  initMap(): void {
    if (this.map) return;
    if ((!this.targets || this.targets.length === 0) && (!this.flightPath || this.flightPath.length === 0)) {
      console.error('❌ Nessun dato disponibile per la mappa.');
      return;
    }

    const firstPoint = this.flightPath && this.flightPath.length > 0 ? this.flightPath[0] : this.targets[0];

    this.map = L.map('flightMap', {
      center: [firstPoint.lat, firstPoint.lon],
      zoom: 13,
      maxZoom: 20,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Aggiunta del tracciato di volo
    this.updateFlightPath();
    Object.keys(this.timestamps).forEach(targetId => {
      this.ms1PointsLayers[targetId] = L.layerGroup().addTo(this.map);
      this.targetVisibility[targetId] = false;  // Default: nascosto
    });

    if (this.targets && this.targets.length > 0) {
      this.targetsLayer = L.layerGroup().addTo(this.map);
      this.updateTargetVisibility();
    }

    // Aggiungere i waypoint dei tasks sulla mappa
    this.addTasksToMap();

    this.map.fitBounds([...this.flightPath.map(p => [p.lat, p.lon] as [number, number])]);
    this.uniqueTargets = this.getUniqueTargets(this.targets);
    setTimeout(() => {
      this.updateFilteredMs1Visibility();
      this.updateFlightPath();
      this.updateTargetVisibility();
    }, 500);
  }


  loadMe1Data(): void {
    this.http.get<any[]>('http://localhost:3000/api/me1').subscribe(
      data => {
        console.log('📥 Dati .me1 ricevuti:', data);
        this.me1Data = data;
      },
      error => console.error('Errore nel recupero dati .me1:', error)
    );
  }

  getUniqueTargets(targets: any[]): any[] {
    const uniqueTargets = new Map<string, any>();

    targets.forEach(target => {
      if (!uniqueTargets.has(target.targetname)) {
        uniqueTargets.set(target.targetname, target);
      }
    });

    return Array.from(uniqueTargets.values());
  }

  // Funzione per aggiungere i task alla mappa
  addTasksToMap(): void {
    if (this.tasks && this.tasks.length > 0) {
      this.tasksLayer.clearLayers(); // Pulizia dei poligoni precedenti

      this.tasks.forEach(task => {
        task.waypoints.forEach((wp, index) => {
          if (
            index < task.waypoints.length - 1 &&
            wp.lat != null && wp.lon != null &&
            task.waypoints[index + 1].lat != null &&
            task.waypoints[index + 1].lon != null
          ) {
            const latLngStart: [number, number] = [wp.lat as number, wp.lon as number];
            const latLngEnd: [number, number] = [task.waypoints[index + 1].lat as number, task.waypoints[index + 1].lon as number];

            const segment = L.polyline([latLngStart, latLngEnd], {
              color: 'black',
              weight: 3,
              opacity: 0.7
            });

            // Crea un LayerGroup per ogni targetName se non esiste già
            if (!this.targetGroups[task.targetName]) {
              this.targetGroups[task.targetName] = L.layerGroup();
              // Imposta la visibilità iniziale su false (nascosto)
              this.targetVisibility[task.targetName] = false;
            }

            // Aggiungi il segmento al gruppo specifico per il target
            this.targetGroups[task.targetName].addLayer(segment);
          }
        });
      });

      // Inizialmente NON aggiungere i gruppi alla mappa
      Object.keys(this.targetGroups).forEach(targetName => {
        if (this.targetVisibility[targetName]) {
          this.map.addLayer(this.targetGroups[targetName]);
        }
      });
    }
  }

  // La funzione toggle per mostrare/nascondere i task divisi per targetName
  toggleTasksVisibility(targetName: string): void {
    // Cambia solo la visibilità dei Task Legs per il target
    this.taskLegsVisibility[targetName] = !this.taskLegsVisibility[targetName];

    // Verifica se la visibilità dei Task Legs è attiva
    if (this.taskLegsVisibility[targetName]) {
      // Aggiungi il layer dei task legs
      if (!this.map.hasLayer(this.targetGroups[targetName])) {
        this.map.addLayer(this.targetGroups[targetName]);
      }
    } else {
      // Rimuovi il layer dei task legs
      if (this.map.hasLayer(this.targetGroups[targetName])) {
        this.map.removeLayer(this.targetGroups[targetName]);
      }
    }
  }

  updateFlightPath(): void {
    if (this.flightPathLayer) {
      this.map.removeLayer(this.flightPathLayer);
      this.flightPathLayer = undefined;
    }

    if (this.showFlightPath && this.flightPath.length > 0) {
      const flightCoordinates: [number, number][] = this.flightPath.map(p => [p.lat, p.lon]);

      this.flightPathLayer = L.polyline(flightCoordinates, {
        color: '#FF0000', // Rosso
        weight: 2,
        opacity: 0.7
      }).addTo(this.map);
    }
  }

  updateTargetVisibility(): void {
    if (!this.targetsLayer) return;
    this.targetsLayer.clearLayers();

    const targetsGrouped = this.targets.reduce((groups, t) => {
      if (t.visible) {
        if (!groups[t.targetname]) {
          groups[t.targetname] = [];
        }
        groups[t.targetname].push([t.lat, t.lon]);
      }
      return groups;
    }, {} as { [key: string]: [number, number][] });

    for (const targetName in targetsGrouped) {
      if (targetsGrouped[targetName].length >= 3) {
        L.polygon(targetsGrouped[targetName], {
          color: '#0000FF',
          weight: 2,
          opacity: 0.7,
          fillColor: '#0000FF',
          fillOpacity: 0.2
        }).addTo(this.targetsLayer);
      }
    }
  }

  toggleTargetVisibility(targetName: string): void {
    this.targets.forEach(t => {
      if (t.targetname === targetName) {
        t.visible = !t.visible;
      }
    });
    this.updateTargetVisibility();
  }

  toggleFlightPathVisibility(): void {
    this.showFlightPath = !this.showFlightPath;
    this.updateFlightPath();
  }


  updateFilteredMs1Visibility(): void {
    if (!this.map) {
      console.warn('Mappa non ancora inizializzata - riprovo tra 500ms');
      setTimeout(() => this.updateFilteredMs1Visibility(), 500);
      return;
    }

    this.ms1PointsLayers = this.ms1PointsLayers || {};
    this.targetVisibility = this.targetVisibility || {};

    if (!this.filteredMs1Points?.length) {
      console.log('Nessun punto MS1 da visualizzare');
      return;
    }

    try {
      Object.keys(this.targetVisibility).forEach(targetname => {
        if (!this.ms1PointsLayers[targetname]) {
          this.ms1PointsLayers[targetname] = L.layerGroup().addTo(this.map);
        }

        const shouldShow = this.targetVisibility[targetname];
        const layer = this.ms1PointsLayers[targetname];

        layer.clearLayers();

        if (shouldShow) {
          this.filteredMs1Points
            .filter(p => p.targetName === targetname) // Filtra per targetName
            .forEach(point => {
              L.circleMarker([point.lat, point.lon], {
                radius: 5,
                fillColor: this.getColorForTarget(targetname), // Usa targetname per determinare il colore
                color: 'dark' + this.getColorForTarget(targetname),
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
              }).addTo(layer);
            });
        }
      });
    } catch (error) {
      console.error('Errore nell\'aggiornamento della visibilità:', error);
    }
  }



  // Metodo helper per colori diversi
  getColorForTarget(targetName: string): string {
    const colors = ['orange', 'blue', 'green', 'red', 'purple', 'yellow'];

    // Usa una funzione hash semplice per mappare il targetName in un numero
    const hash = [...targetName].reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // Restituisci un colore in base al targetName
    return colors[hash % colors.length];
  }

  toggleStrobeVisibility(targetName: string): void {
    this.strobeVisibility[targetName] = !this.strobeVisibility[targetName];

    // Logica per aggiornare la visibilità dei punti Strobe sulla mappa
    this.updateFilteredMs1Visibility();
  }

  toggleTargetMsVisibility(targetName: string): void {
    this.targetVisibility[targetName] = !this.targetVisibility[targetName];

    if (this.targetVisibility[targetName]) {
      this.map.addLayer(this.targetGroups[targetName]);
    } else {
      this.map.removeLayer(this.targetGroups[targetName]);
    }

    this.updateFilteredMs1Visibility();
  }

}