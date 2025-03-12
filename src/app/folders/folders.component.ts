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

  private map!: L.Map;
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

    // Richiesta per ottenere i dati dal server
    this.http.get<any>(this.apiUrlSbeconf).subscribe(
      data => {
        console.log('📥 Dati ricevuti da sbeconf.jsn:', data);

        // Salva i dati nella variabile targets
        this.targets = data;

        if (data && data.MissionPlanInfo && Array.isArray(data.MissionPlanInfo.target)) {
          this.extractedTargets = this.extractTargetsFromJSON(data.MissionPlanInfo.target);
          if (this.extractedTargets.length === 0) {
            console.error('❌ Nessuna coordinate valida trovata.');
          } else {
            console.log('✅ Targets estratti:', this.extractedTargets);
          }
        } else {
          console.error('❌ La struttura del JSON non contiene "MissionPlanInfo.target".');
          this.errorMessage = 'Dati non validi';
        }
      },
      error => {
        console.error('❌ Errore nel recupero dei dati di sbeconf.jsn:', error);
        this.errorMessage = 'Impossibile recuperare i dati dal server';
      }
    );



    // 1. Recupera folderPath dai parametri della route
    this.route.paramMap.subscribe(params => {
      this.folderPath = params.get('folderPath') || ''; // Ottieni il parametro folderPath
      console.log('Parametro folderPath dalla route:', this.folderPath);
    });

    // 2. Recupera folderPath dallo stato del router (se presente)
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.folderPath = navigation.extras.state['folderPath'] || this.folderPath;
      console.log('Parametro folderPath dallo stato del router:', this.folderPath);
    }

    // Aggiunta richiesta per ottenere i nomi delle cartelle dentro "Trolleys"
    console.log('📡 Richiesta in corso per /get-trolleys-folders');
    this.getTrolleysFolders().subscribe({
      next: (response) => {
        if (response && response.folders) {
          console.log('✅ Nomi delle cartelle ricevuti:', response.folders);
          this.trolleysFolders = response.folders; // Assegna i nomi delle cartelle alla variabile
        } else {
          console.error('❌ Risposta del server non valida. Nomi delle cartelle mancanti.');
        }
      },
      error: (err) => {
        console.error('❌ Errore nel recupero dei nomi delle cartelle:', err);
      }
    });

    // Chiamate API per ottenere log e dati di volo
    console.log('📡 Richiesta in corso per /log-array');
    this.getLogArray().subscribe({
      next: (response) => {
        console.log('✅ Risposta ricevuta per log-array:', response);
        if (response && response.array) {
          this.extractTimestamps(response.array);
        } else {
          console.error('❌ Risposta non valida da log-array:', response);
        }
      },
      error: (err) => {
        console.error('❌ Errore nel recupero dei log:', err);
      }
    });

    console.log('📡 Richiesta in corso per /nav-data');
    this.getNavData().subscribe({
      next: (response) => {
        console.log('✅ Risposta ricevuta per nav-data:', response);
        if (response && response.flightData && typeof response.flightData === 'string' && response.flightData.trim() !== '') {
          this.extractNavData(response.flightData);
        } else {
          console.error('❌ Errore: dati di volo non validi. Risposta:', response);
          this.errorMessage = 'Errore: dati di volo non validi.';
        }
      },
      error: (err) => {
        console.error('❌ Errore nel recupero dei dati di volo:', err);
        this.errorMessage = 'Errore nel recupero dei dati di volo.';
      }
    });

    // Aggiunta richiesta per ottenere il nome della cartella (trolleysName)
    console.log('📡 Richiesta in corso per /get-folder-name');
    this.getTrolleysName().subscribe({
      next: (response) => {
        if (response && response.trolleysName) {
          console.log('✅ Nome della cartella ricevuto:', response.trolleysName);
          this.trolleysName = response.trolleysName;
          this.trolleysFolders.pop();
        } else {
          console.error('❌ Risposta del server non valida. trolleysName mancante.');
        }
      },
      error: (err) => {
        console.error('❌ Errore nel recupero del nome della cartella:', err);
      }
    });
  }

  extractTargetsFromJSON(targets: any[]): { targetname: string; lat: number; lon: number }[] {
    let extracted: { targetname: string; lat: number; lon: number }[] = [];

    console.log("📜 JSON ricevuto:", targets);  // DEBUG

    if (!Array.isArray(targets)) {
      console.error("❌ ERRORE: 'targets' non è un array!", targets);
      return extracted;
    }

    // Itera su ogni target
    targets.forEach((target: any) => {
      console.log("🎯 Target:", target); // DEBUG

      const targetname: string = target["@targetname"] || "Senza nome";  // Estrai @targetname

      // Verifica se il target ha dei vertexes
      if (target.vertexes && Array.isArray(target.vertexes)) {
        target.vertexes.forEach((vertex: any) => {
          console.log("📌 Vertex:", vertex); // DEBUG

          if (vertex.wgs84_coord) {
            // Estrai lat e lon
            const lat = parseFloat(vertex.wgs84_coord["@lat"]);
            const lon = parseFloat(vertex.wgs84_coord["@lon"]);

            if (!isNaN(lat) && !isNaN(lon)) {
              // Aggiungi il target con le coordinate valide
              extracted.push({ targetname, lat, lon });
              console.log(`✅ Target valido: ${targetname} -> Lat: ${lat}, Lon: ${lon}`);
            } else {
              console.warn(`⚠️ Coordinate non valide per target "${targetname}":`, vertex);
            }
          }
        });
      } else {
        console.warn(`⚠️ Nessun vertex per target "${targetname}".`, target);
      }
    });

    return extracted;
  }




  // Metodo per ottenere i nomi delle cartelle dentro "Trolleys"
  getTrolleysFolders(): Observable<any> {
    return this.http.get<{ folders: string[] }>(this.apiUrlTrolleysFolders);
  }

  // Metodo per ottenere il nome della cartella (trolleysName)
  getTrolleysName(): Observable<any> {
    return this.http.get<{ trolleysName: string }>(`${this.apiUrlFolderName}`);
  }

  getLogArray(): Observable<any> {
    return this.http.get<any>(this.apiUrlLogArray, {
      params: { path: 'Volo20250210-IT-PIE06/Mission/BIU/02101335.log' }
    });
  }

  getNavData(): Observable<any> {
    return this.http.get<any>(this.apiUrlNavData, {
      params: { path: 'Volo20250210-IT-PIE06/Mission/BIU/02101335.nav' }
    });
  }

  extractTimestamps(logArray: string[]): void {
    this.takeoffTimestamps = logArray
      .filter(line => line.includes("INFO: TAKEOFF DETECTED"))
      .map(line => {
        const parts = line.split(' - ');
        if (parts.length > 0) {
          const timestamp = parts[0].trim();
          const date = new Date(parseInt(timestamp) * 1000);
          return date.toLocaleString();
        }
        return 'Data non valida';
      });

    this.landingTimestamps = logArray
      .filter(line => line.includes("INFO: LANDING DETECTED"))
      .map(line => {
        const parts = line.split(' - ');
        if (parts.length > 0) {
          const timestamp = parts[0].trim();
          const date = new Date(parseInt(timestamp) * 1000);
          return date.toLocaleString();
        }
        return 'Data non valida';
      });

    console.log('🛫 Takeoff timestamps:', this.takeoffTimestamps);
    console.log('🛬 Landing timestamps:', this.landingTimestamps);
  }

  extractNavData(flightData: string): void {
    if (!flightData || typeof flightData !== 'string' || flightData.trim() === '') {
      console.error('❌ Errore: Il file .nav è vuoto o non valido.');
      this.errorMessage = 'Errore: Il file .nav è vuoto o non valido.';
      return;
    }

    const lines = flightData.split('\n').map(line => line.trim()).filter(line => line !== '');

    this.flightPath = lines.map(line => {
      const parts = line.split(';');

      if (parts.length >= 4) {
        const timestamp = parts[0].trim();
        const lat = parseFloat(parts[4].trim());
        const lon = parseFloat(parts[5].trim());
        const alt = parseFloat(parts[6].trim());

        if (!isNaN(lat) && !isNaN(lon) && !isNaN(alt)) {
          return { lat, lon, alt };
        } else {
          console.error('❌ Dati di volo non validi in questa riga:', line);
        }
      }
      return null;
    }).filter(item => item !== null);

    console.log('✅ Dati di volo estratti:', this.flightPath);
    this.initMap();
  }


  initMap(): void {
    if (!this.flightPath || this.flightPath.length === 0) {
      console.error('❌ Nessun dato disponibile per la mappa.');
      return;
    }

    const firstPoint = this.flightPath[0];
    console.log('Dati di vertexCoordinates:', this.vertexCoordinates);

    // Inizializzazione della mappa con la posizione di partenza del volo
    this.map = L.map('flightMap', {
      center: [firstPoint.lat, firstPoint.lon],
      zoom: 13,
      maxZoom: 20,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Aggiungi il percorso dell'aereo (flightPath) sulla mappa in rosso
    const flightCoordinates: [number, number][] = this.flightPath.map(point => [point.lat, point.lon]);
    L.polyline(flightCoordinates, {
      color: '#FF0000',  // Rosso
      weight: 3,
      opacity: 0.7
    }).addTo(this.map);

    // Aggiungi un marker di partenza
    const startMarker = L.marker([firstPoint.lat, firstPoint.lon]).addTo(this.map);
    startMarker.bindPopup(`<b>Partenza</b><br>Lat: ${firstPoint.lat}<br>Lon: ${firstPoint.lon}<br>Alt: ${firstPoint.alt}m`);

    // Raggruppa dinamicamente i target in base al targetname
    const targetsGrouped = this.targets.reduce((groups, t: Target) => {  // Specifica esplicitamente il tipo per 't'
      if (t.targetname) {
        if (!groups[t.targetname]) {
          groups[t.targetname] = [];
        }
        groups[t.targetname].push({ lat: t.lat, lon: t.lon });
      }
      return groups;
    }, {} as { [key: string]: { lat: number, lon: number }[] });

    // Ciclo attraverso ogni gruppo di target e crea i rettangoli
    for (const targetName in targetsGrouped) {
      const targetGroup = targetsGrouped[targetName];

      if (targetGroup.length >= 3) {  // Assicurati che ci siano almeno 3 punti per formare un rettangolo
        const polygonCoords: [number, number][] = targetGroup.map(t => [t.lat, t.lon]);

        // Crea il rettangolo blu per il gruppo di target
        L.polygon(polygonCoords, {
          color: '#0000FF',  // Blu
          weight: 2,
          opacity: 0.7,
          fillColor: '#0000FF',  // Colore di riempimento per il rettangolo
          fillOpacity: 0.2
        }).addTo(this.map);
      }
    }

    // Aggiusta la mappa per includere sia il volo che i target
    const allCoordinates: [number, number][] = [
      ...flightCoordinates,
      ...(this.targets ? this.targets.map(t => [t.lat, t.lon] as [number, number]) : [])
    ];
    this.map.fitBounds(allCoordinates);
  }

}
