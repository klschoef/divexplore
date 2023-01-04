import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ShotlistComponent } from './shotlist/shotlist.component';
import { AppComponent } from './app.component';

const routes: Routes = [
  {path: '', component: AppComponent},
  {path: 'shots/:videoid', component: ShotlistComponent}
];

// /login and /register etc.

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
