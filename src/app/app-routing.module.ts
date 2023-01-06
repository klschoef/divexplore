import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ShotlistComponent } from './shotlist/shotlist.component';
import { AppComponent } from './app.component';

//'' is default route
const routes: Routes = [
  {path: '', component: AppComponent},
  {path: 'video/:id', component: ShotlistComponent}
];

// /login and /register etc.

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
