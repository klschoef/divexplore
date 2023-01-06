import { Component } from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';

@Component({
  selector: 'app-shotlist',
  templateUrl: './shotlist.component.html',
  styleUrls: ['./shotlist.component.scss']
})

export class ShotlistComponent {
  videoid: string | undefined;
  
  constructor( //inject an instance of ActivatedRoute
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    console.log('shot list initiated');
    this.route.queryParams.subscribe(params => {
      this.videoid = params['id'];
      console.log(this.videoid);
    });
  }
}
