import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http'; // Assicurati che apiUrl sia correttamente configurato
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-folders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './folders.component.html',
  styleUrls: ['./folders.component.css']
})
export class FoldersComponent implements OnInit {

  takeoffTimestamps: string[] = [];  // Array per memorizzare i timestamp di TAKEOFF
  landingTimestamps: string[] = [];  // Array per memorizzare i timestamp di LANDING
  flightData: { lat: number, lon: number, alt: number }[] = [];  // Array per memorizzare i dati di latitudine, longitudine e altitudine
  errorMessage: string = ''; // Messaggio di errore

  // Endpoint del backend
  private apiUrlLogArray = 'http://localhost:3000/log-array';


  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    // Richiesta per i log array (per i timestamp)
    console.log('Richiesta in corso per /log-array');
    this.getLogArray().subscribe({
      next: (response) => {
        console.log('Risposta ricevuta per log-array:', response);
        this.extractTimestamps(response.array); // Estrai e traduci i timestamp
      },
      error: (err) => {
        console.error('Errore nel recupero dell\'array:', err);
      }
    });
  }

  // Metodo per fare la richiesta HTTP per il log array
  getLogArray(): Observable<any> {
    return this.http.get<any>(this.apiUrlLogArray, {
      params: { path: 'Volo20250210-IT-PIE06/Mission/BIU/02101335.log' } // Percorso del file .log
    });
  }

  // Metodo per estrarre e tradurre i timestamp per "INFO: TAKEOFF DETECTED" e "INFO: LANDING DETECTED"
  extractTimestamps(logArray: string[]): void {
    // Estrai i timestamp per TAKEOFF DETECTED
    this.takeoffTimestamps = logArray
      .filter(line => line.includes("INFO: TAKEOFF DETECTED"))  // Filtra solo le righe che contengono "INFO: TAKEOFF DETECTED"
      .map(line => {
        const timestamp = line.split(' - ')[0]; // Estrai il timestamp
        const date = new Date(parseInt(timestamp) * 1000); // Converte il timestamp Unix in una data
        return date.toLocaleString(); // Ritorna la data in formato leggibile
      });

    // Estrai i timestamp per LANDING DETECTED
    this.landingTimestamps = logArray
      .filter(line => line.includes("INFO: LANDING DETECTED"))  // Filtra solo le righe che contengono "INFO: LANDING DETECTED"
      .map(line => {
        const timestamp = line.split(' - ')[0]; // Estrai il timestamp
        const date = new Date(parseInt(timestamp) * 1000); // Converte il timestamp Unix in una data
        return date.toLocaleString(); // Ritorna la data in formato leggibile
      });

    console.log('Timestamp di TAKEOFF DETECTED tradotti:', this.takeoffTimestamps); // Debug: stampa i timestamp tradotti per TAKEOFF
    console.log('Timestamp di LANDING DETECTED tradotti:', this.landingTimestamps); // Debug: stampa i timestamp tradotti per LANDING
  }
}
