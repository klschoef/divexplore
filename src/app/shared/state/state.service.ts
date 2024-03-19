import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StateService {
  private sessionIdSource = new BehaviorSubject<string>('');
  private serverRunIDsSource = new BehaviorSubject<string[]>([]);
  private selectedServerRunSource = new BehaviorSubject<number>(0);

  // Publicly exposed observables for components/services to subscribe to
  sessionId$ = this.sessionIdSource.asObservable();
  serverRunIDs$ = this.serverRunIDsSource.asObservable();
  selectedServerRun$ = this.selectedServerRunSource.asObservable();

  // Methods to update the state
  updateSessionId(sessionId: string) {
    this.sessionIdSource.next(sessionId);
  }

  updateServerRunIDs(serverRunIDs: string[]) {
    this.serverRunIDsSource.next(serverRunIDs);
  }

  updateSelectedServerRun(selectedServerRun: number) {
    this.selectedServerRunSource.next(selectedServerRun);
  }

  // Methods to retrieve the state
  getSessionId() {
    return this.sessionIdSource.getValue();
  }

  getServerRunIDs() {
    return this.serverRunIDsSource.getValue();
  }

  getSelectedServerRun() {
    return this.selectedServerRunSource.getValue();
  }
}