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

  private map!: L.Map;
  private flightPathLayer?: L.Polyline;
  private targetsLayer?: L.LayerGroup;
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



}