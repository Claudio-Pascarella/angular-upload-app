import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDividerModule } from '@angular/material/divider';
import { HttpHeaders } from '@angular/common/http';
import { RouterModule, Router, } from '@angular/router';



interface FileItem {
  name: string;
  type: string;
  path: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [MatDividerModule, RouterModule],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  selectedFiles: File[] = [];
  uploadMessage: string = '';
  currentPath: string = '';
  folders: FileItem[] = []; // Elenco delle sottocartelle
  files: FileItem[] = []; // Elenco dei file

  constructor(private http: HttpClient, private router: Router) { }

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

  navigateToFolder(folderPath: string) {
    this.router.navigate(['/folders'], { state: { folderPath } });
  }


}