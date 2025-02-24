import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-upload',
  standalone: true,
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  selectedFile: File | null = null;
  uploadMessage: string = '';

  constructor(private http: HttpClient) { }

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
    this.uploadMessage = 'Errore durante il caricamento.';
  }
);
  }
}