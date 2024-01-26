import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private config: any; // Holds the current configuration

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    const localConfig = localStorage.getItem('diveXploreConfig');
    this.config = localConfig ? JSON.parse(localConfig) : {};
  }

  getConfiguration() {
    return this.config;
  }

  updateConfiguration(newConfig: any) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('localConfig', JSON.stringify(this.config));
  }
}

