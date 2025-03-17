import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { LeafletModule } from '@bluehalo/ngx-leaflet';
import { ActivatedRoute, Router } from '@angular/router';

interface Target {
  targetname: string;
  lat: number;
  lon: number;
  visible?: boolean;
}

@Component({
  selector: 'app-folders',
  standalone: true,
  imports: [CommonModule, LeafletModule],
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
  extractedTargets: { targetname: string; lat: number; lon: number }[] = [];
  targets: Target[] = [];
  showFlightPath: boolean = true;  // Stato della checkbox per il volo
  showTargets: boolean = true;     // Stato della checkbox per i target
  uniqueTargets: any[] = [];
  ms1Data: any[] = [];
  showMs1: boolean = false;
  me1Data: any[] = [];
  imageCount: number = 0;
  totalDurationInSeconds: number = 0;


  private map!: L.Map;
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
    private router: Router
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

    //File MS
    this.http.get<any[]>('http://localhost:3000/api/ms1').subscribe(
      data => {
        console.log('📥 Dati ricevuti:', data);
        this.ms1Data = data;
      },
      error => console.error('Errore nel recupero dati:', error)
    );
    // Caricamento dei dati
    this.http.get<any>(this.apiUrlSbeconf).subscribe(
      data => {
        console.log('📥 Dati ricevuti da sbeconf.jsn:', data);
        this.targets = data;

        if (data && data.MissionPlanInfo && Array.isArray(data.MissionPlanInfo.target)) {
          this.extractedTargets = this.extractTargetsFromJSON(data.MissionPlanInfo.target);
        } else {
          this.errorMessage = 'Dati non validi';
        }
      },
      error => {
        this.errorMessage = 'Impossibile recuperare i dati dal server';
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

  extractTargetsFromJSON(targets: any[]): { targetname: string; lat: number; lon: number }[] {
    let extracted: { targetname: string; lat: number; lon: number }[] = [];
    if (!Array.isArray(targets)) return extracted;

    targets.forEach((target: any) => {
      const targetname: string = target["@targetname"] || "Senza nome";
      if (target.vertexes && Array.isArray(target.vertexes)) {
        target.vertexes.forEach((vertex: any) => {
          if (vertex.wgs84_coord) {
            const lat = parseFloat(vertex.wgs84_coord["@lat"]);
            const lon = parseFloat(vertex.wgs84_coord["@lon"]);
            if (!isNaN(lat) && !isNaN(lon)) {
              extracted.push({ targetname, lat, lon });
            }
          }
        });
      }
    });
    return extracted;
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

  extractTimestamps(logArray: string[]): void {
    this.takeoffTimestamps = logArray.filter(line => line.includes("INFO: TAKEOFF DETECTED"))
      .map(line => new Date(parseInt(line.split(' - ')[0].trim()) * 1000).toLocaleString());
    this.landingTimestamps = logArray.filter(line => line.includes("INFO: LANDING DETECTED"))
      .map(line => new Date(parseInt(line.split(' - ')[0].trim()) * 1000).toLocaleString());

    // Somma delle differenze (in secondi, puoi cambiare unità come desideri)
    this.totalDurationInSeconds = this.calculateTotalDurationInSeconds();
  }

  calculateTotalDurationInSeconds(): number {
    let totalDuration = 0;

    // Assumiamo che i timestamp di atterraggio e decollo siano sincronizzati
    for (let i = 0; i < Math.min(this.takeoffTimestamps.length, this.landingTimestamps.length); i++) {
      const takeoff = new Date(this.takeoffTimestamps[i]);
      const landing = new Date(this.landingTimestamps[i]);

      // Calcola la differenza in millisecondi e poi convertila in secondi
      const durationInMilliseconds = landing.getTime() - takeoff.getTime();
      const durationInSeconds = durationInMilliseconds / 1000;

      // Aggiungi la durata alla somma totale
      totalDuration += durationInSeconds;
    }

    return totalDuration;
  }

  // Funzione per convertire i secondi in formato ore:minuti:secondi
  convertSecondsToHMS(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const sec = seconds % 60;

    // Restituisce la stringa formattata in HH:MM:SS
    return `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(sec)}`;
  }

  // Funzione di supporto per aggiungere uno zero davanti ai numeri singoli
  padZero(num: number): string {
    return num < 10 ? `0${num}` : `${num}`;
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
    this.initMap();

  }

  initMap(): void {
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

    if (this.targets && this.targets.length > 0) {
      this.targetsLayer = L.layerGroup().addTo(this.map);
      this.updateTargetVisibility();
    }

    this.map.fitBounds([...this.flightPath.map(p => [p.lat, p.lon] as [number, number])]);

    // Aggiusta la mappa per includere sia il volo che i target
    const flightCoordinates: [number, number][] = this.flightPath && this.flightPath.length > 0
      ? this.flightPath
        .map(point => [point.lat, point.lon] as [number, number])  // Forza il tipo [number, number]
        .filter(coord => coord.length === 2 && coord.every(val => !isNaN(val)))  // Verifica che ci siano esattamente 2 valori numerici
      : [];

    const targetCoordinates: [number, number][] = this.targets && this.targets.length > 0
      ? this.targets
        .map(t => [t.lat, t.lon] as [number, number])  // Forza il tipo [number, number]
        .filter(coord => coord.length === 2 && coord.every(val => !isNaN(val)))  // Verifica che ci siano esattamente 2 valori numerici
      : [];

    this.uniqueTargets = this.getUniqueTargets();
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

  getUniqueTargets() {
    const seen = new Set();
    return this.targets.filter(target => {
      if (seen.has(target.targetname)) {
        return false;
      }
      seen.add(target.targetname);
      return true;
    });
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

  updateMs1Visibility(): void {
    if (!this.ms1Data || this.ms1Data.length === 0) return; // Verifica che i dati siano disponibili

    // Se targetsLayer è undefined, inizializzalo
    if (!this.targetsLayer) {
      this.targetsLayer = L.layerGroup();  // Inizializza targetsLayer se è undefined
      this.targetsLayer.addTo(this.map);    // Aggiungi targetsLayer alla mappa
    }

    this.targetsLayer.clearLayers(); // Rimuove i marker esistenti

    // Personalizza il punto (marker) per i dati MS1
    const ms1MarkerOptions = {
      radius: 2, // Imposta il raggio del cerchio
      ffillColor: '#8A2BE2', // Colore di riempimento (viola)
      color: '#4B0082', // Colore del bordo (viola scuro)
      weight: 1, // Spessore del bordo
      opacity: 1, // Opacità
      fillOpacity: 0.6 // Opacità del riempimento
    };

    this.ms1Data.forEach(point => {
      // Aggiungi un cerchio per ogni punto ms1Data
      L.circleMarker([point.lat, point.lon], ms1MarkerOptions)
        .addTo(this.targetsLayer)
        .bindPopup(`Target: ${point.targetname}`); // Mostra info al click
    });
  }


  toggleMs1Polygons(): void {
    this.showMs1 = !this.showMs1;

    if (!this.targetsLayer) {
      console.warn('targetsLayer non è inizializzato!');
      return;
    }

    if (this.showMs1) {
      this.updateMs1Visibility();
    } else {
      this.targetsLayer.clearLayers(); // Rimuove i poligoni se disattivato
    }
  }

  toggleMs1(): void {
    this.showMs1 = !this.showMs1;

    if (!this.targetsLayer) {
      console.warn('targetsLayer non è inizializzato!');
      return;
    }

    this.updateMs1Visibility();
  }

}