import { Component, OnInit } from '@angular/core';
import { ConfigService } from '../config.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { LocalConfig } from '../local-config';

@Component({
  selector: 'app-config-form',
  templateUrl: './config-form.component.html',
  styleUrls: ['./config-form.component.scss']
})
export class ConfigFormComponent implements OnInit {
  configForm: FormGroup;

  constructor(private configService: ConfigService, private formBuilder: FormBuilder) {
    this.configForm = this.formBuilder.group({
      clipServerHost: '',
      clipServerPort: '',
      nodeServerHost: '',
      nodeServerPort: '',
      dataBaseUrl: '',
      dataBaseUrlVideos: '',
      username: '',
      password: ''
      // ...add other fields
    });
  }

  ngOnInit(): void {
    const localConfig = this.configService.getConfiguration();
    if (localConfig) {
      this.configForm.patchValue(localConfig);
    } else {
      // Initialize with default values from LocalConfig
      this.configForm.patchValue({
        clipServerHost: LocalConfig.config_CLIP_SERVER_HOST,
        clipServerPort: LocalConfig.config_CLIP_SERVER_PORT,
        nodeServerHost: LocalConfig.config_NODE_SERVER_HOST, 
        nodeServerPort: LocalConfig.config_NODE_SERVER_PORT, 
        dataBaseUrl: LocalConfig.config_DATA_BASE_URL, 
        dataBaseUrlVideos: LocalConfig.config_DATA_BASE_URL_VIDEOS,
        username: LocalConfig.config_USER, 
        password: LocalConfig.config_PASS
      });
    }
  }

  onSave() {
    //TODO this.configService.saveLocalConfig(this.configForm.value);
  }
}
