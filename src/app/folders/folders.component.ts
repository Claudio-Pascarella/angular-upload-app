import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-folders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './folders.component.html',
  styleUrls: ['./folders.component.css']
})
export class FoldersComponent implements OnInit {

  takeoffTimestamps: string[] = [];
  landingTimestamps: string[] = [];
  flightPath: { lat: number, lon: number, alt: number }[] = [];
  errorMessage: string = '';
  private apiUrlLogArray = 'http://localhost:3000/log-array';
  private apiUrlNavData = 'http://localhost:3000/nav-data';

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
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

    console.log('🛫 TAKEOFF DETECTED:', this.takeoffTimestamps);
    console.log('🛬 LANDING DETECTED:', this.landingTimestamps);
  }

  extractNavData(flightData: string): void {
    console.log('📄 File .nav ricevuto:', flightData.slice(0, 500)); // Mostra solo i primi 500 caratteri per debug

    if (!flightData || typeof flightData !== 'string' || flightData.trim() === '') {
      console.error('❌ Errore: Il file .nav è vuoto o non valido.');
      this.errorMessage = 'Errore: Il file .nav è vuoto o non valido.';
      return;
    }

    const lines = flightData.split('\n').map(line => line.trim()).filter(line => line !== '');
    console.log('📊 Dati divisi in righe:', lines); // Log delle righe separate per il debug

    this.flightPath = lines.map(line => {
      const parts = line.split(';'); // Cambiato separatore per il tuo formato .nav
      console.log('📌 Riga divisa:', parts); // Log dei dati divisi per vedere il contenuto

      if (parts.length >= 4) {
        const timestamp = parts[0].trim();
        const lat = parseFloat(parts[4].trim());
        const lon = parseFloat(parts[5].trim());
        const alt = parseFloat(parts[6].trim());

        // Verifica che lat, lon, alt siano numeri validi
        if (!isNaN(lat) && !isNaN(lon) && !isNaN(alt)) {
          return { lat, lon, alt };
        } else {
          console.error('❌ Dati di volo non validi nella riga:', line);
          return null; // Ritorna null se i dati non sono validi
        }
      }
      return null; // Se la riga non ha abbastanza campi, ritorna null
    }).filter(entry => entry !== null); // Filtra i dati null

    // Log per verificare il contenuto finale di flightPath
    console.log('📍 Dati estratti dal file .nav:', this.flightPath);

    if (this.flightPath.length === 0) {
      console.error('❌ Nessun dato valido trovato nel file .nav');
      this.errorMessage = 'Nessun dato valido trovato nel file .nav';
    }

    // Dopo aver estratto i dati validi, inizializza la mappa
    this.initializeMap();
  }

  initializeMap(): void {
    if (this.flightPath.length === 0) {
      console.error('❌ Nessun dato per visualizzare la mappa.');
      return;
    }

    // Crea la mappa
    const map = L.map('flightMap').setView([this.flightPath[0].lat, this.flightPath[0].lon], 13);

    // Aggiungi una tile layer (ad esempio OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Traccia il percorso del volo come polyline
    const latlngs: L.LatLngTuple[] = this.flightPath.map(point => [point.lat, point.lon]);  // Mappa a LatLngTuple
    L.polyline(latlngs, { color: 'blue' }).addTo(map);

    // Aggiungi un marker iniziale al primo punto del volo
    L.marker([this.flightPath[0].lat, this.flightPath[0].lon]).addTo(map)
      .bindPopup('Start of the flight')
      .openPopup();

    // Aggiungi un marker finale all'ultimo punto del volo
    L.marker([this.flightPath[this.flightPath.length - 1].lat, this.flightPath[this.flightPath.length - 1].lon]).addTo(map)
      .bindPopup('End of the flight')
      .openPopup();
  }
}
