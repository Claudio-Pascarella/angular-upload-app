import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDividerModule } from '@angular/material/divider';


@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [MatDividerModule],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  selectedFile: File | null = null;
  uploadMessage: string = '';
  folders: { name: string; path: string }[] = [];
  files: { name: string }[] = [];
  currentPath: string = '';


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

  // Metodo per tornare alla cartella precedente
  goBack() {
    const parentPath = this.currentPath.split('/').slice(0, -1).join('/');
    this.currentPath = parentPath;
    this.loadFolderContent();
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0] as File;
  }

  onUpload() {
    if (!this.selectedFile) {
      return;
    }

    const formData = new FormData();
    formData.append('photo', this.selectedFile);

    this.http.post('http://localhost:3000/upload', formData).subscribe(
      (response) => {
        console.log('Success:', response); // Log della risposta
        this.uploadMessage = 'File caricato con successo!';
      },
      (error) => {
        console.error('Errore:', error); // Log dell'errore
        console.error('Dettagli errore:', error.error); // Log dei dettagli dell'errore
        this.uploadMessage = 'Errore durante il caricamento.';
      }
    );
  }
}