import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-folders',
  standalone: true,
  imports: [],
  templateUrl: './folders.component.html',
  styleUrl: './folders.component.css'
})
export class FoldersComponent {

  currentPath: string = '';

  constructor(private route: ActivatedRoute) { }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.currentPath = params.get('path') || ''; // ✅ Ottiene il valore del parametro "path"
      console.log('Percorso selezionato:', this.currentPath);
    });
  }

}
