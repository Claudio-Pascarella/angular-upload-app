import { Routes } from '@angular/router';
import { UploadComponent } from './upload/upload.component';
import { FoldersComponent } from './folders/folders.component';

export const routes: Routes = [
    { path: '', component: UploadComponent },
    { path: 'folders/:path', component: FoldersComponent } // ✅ Rotta dinamica per cartelle
];
