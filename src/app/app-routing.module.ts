import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ShotlistComponent } from './shotlist/shotlist.component';
import { AppComponent } from './app.component';
import { QueryComponent } from './query/query.component';
import { ExplorationComponent } from './exploration/exploration.component';

//'' is default route
const routes: Routes = [
  {path: '', component: AppComponent},
  {path: 'query', component: QueryComponent},
  {path: 'filesimilarity/:id/:id2', component: QueryComponent},
  {path: 'filesimilarity/:id/:id2/:page', component: QueryComponent},
  {path: 'video/:id', component: ShotlistComponent},
  {path: 'video/:id/:id2', component: ShotlistComponent},
  {path: 'exploration', component: ExplorationComponent}
];

// /login and /register etc.

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
