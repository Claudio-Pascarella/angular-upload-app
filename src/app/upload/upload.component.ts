import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDividerModule } from '@angular/material/divider';
import { HttpHeaders } from '@angular/common/http';

interface FileItem {
  name: string;
  type: string;
  path: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [MatDividerModule],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  selectedFiles: File[] = [];
  uploadMessage: string = '';
  currentPath: string = '';
  folders: FileItem[] = []; // Elenco delle sottocartelle
  files: FileItem[] = []; // Elenco dei file

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.loadFolderContent(); // Carica le cartelle all'avvio del componente
  }

  // Metodo per caricare l'elenco delle cartelle
  loadFolderContent() {
    this.http.get<any>(`http://localhost:3000/folders?path=${this.currentPath}`)
      .subscribe(
        (response) => {
          this.folders = response.folders;
          this.files = response.files;
        },
        (error) => {
          console.error('Errore durante il caricamento del contenuto della cartella:', error);
        }
      );
  }

  // Metodo per navigare in una sottocartella
  navigateToFolder(folderPath: string) {
    this.currentPath = folderPath;
    this.loadFolderContent();
  }

  onFileSelected(event: any) {
    this.selectedFiles = Array.from(event.target.files); // Memorizza i file selezionati
  }

  onFolderSelected(event: any) {
    this.selectedFiles = Array.from(event.target.files); // Memorizza i file della cartella selezionata
  }

  onUpload() {
    if (!this.selectedFiles || this.selectedFiles.length === 0) {
      this.uploadMessage = '⚠️ Nessun file selezionato!';
      return;
    }

    const formData = new FormData();
    this.selectedFiles.forEach((file) => {
      formData.append('photos', file);
    });

    const headers = new HttpHeaders().set('current-path', this.currentPath);

    this.http.post<{ message: string, files: string[] }>(
      'http://localhost:3000/upload',
      formData,
      { headers }
    ).subscribe({
      next: (response) => {
        this.uploadMessage = '✅ File/Cartelle caricati con successo!';
        alert(this.uploadMessage);
        console.log('File caricati:', response.files);
        this.selectedFiles = []; // Pulisce la selezione dopo l'upload

        setTimeout(() => {
          window.location.reload();
        }, 1000);
      },
      error: (error) => {
        this.uploadMessage = '❌ Errore durante il caricamento.';
        alert(this.uploadMessage);
        console.error(error);
      }
    });
  }

  // Metodo per tornare alla cartella precedente
  goBack() {
    const parentPath = this.currentPath.split('/').slice(0, -1).join('/');
    this.currentPath = parentPath;
    this.loadFolderContent();
  }

  // Metodo per scaricare un file
  downloadFile(filePath: string) {
    const encodedPath = encodeURIComponent(filePath);
    const url = `http://localhost:3000/download?path=${encodedPath}`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filePath.split('/').pop() || 'file';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Metodo per scaricare una cartella come ZIP
  downloadFolder(folderPath: string) {
    const encodedPath = encodeURIComponent(folderPath);
    const url = `http://localhost:3000/download-folder?path=${encodedPath}`;

    const link = document.createElement('a');
    link.href = url;
    link.download = folderPath.split('/').pop() + '.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
