import { Component, EventEmitter, Output } from '@angular/core';
import { VbsServiceCommunication } from '../../shared/interfaces/vbs-task-interface';
import { NodeServerConnectionService } from '../../services/nodeserver-connection/nodeserver-connection.service';
import { ClipServerConnectionService } from '../../services/clipserver-connection/clipserver-connection.service';
import { VBSServerConnectionService } from '../../services/vbsserver-connection/vbsserver-connection.service';
import { QueryEvent, QueryEventCategory } from 'openapi/dres';

@Component({
  selector: 'app-status-bar',
  templateUrl: './status-bar.component.html',
  styleUrls: ['./status-bar.component.scss']
})
export class StatusBarComponent implements VbsServiceCommunication{
  @Output() answerFieldFocusChange = new EventEmitter<boolean>();

  statusTaskRemainingTime: string = '';
  statusTaskInfoText: string = '';
  topicanswer: string = '';
  answerFieldHasFocus = false; 

  constructor(
    public vbsService: VBSServerConnectionService,
    public nodeService: NodeServerConnectionService,
    public clipService: ClipServerConnectionService) {
  }

  sendTopicAnswer() {
    this.vbsService.submitText(this.topicanswer)

    let queryEvent: QueryEvent = {
      timestamp: Date.now(),
      category: QueryEventCategory.OTHER,
      type: 'submitAnswer1',
      value: this.topicanswer
    }
    this.vbsService.queryEvents.push(queryEvent);
    this.vbsService.submitQueryResultLog('interaction');
  }

  getRemainingTaskTime() {
    if (this.vbsService.selectedServerRun !== undefined) {
      let remainingTime = this.vbsService.serverRunsRemainingSecs.get(this.vbsService.serverRunIDs[this.vbsService.selectedServerRun]);
      return remainingTime;
    }
    return "";
  }

  selectRun() {
    if (this.vbsService.selectedServerRun !== undefined) {
      localStorage.setItem('selectedEvaluation', '' + this.vbsService.selectedServerRun!);
    }
  }

  onAnswerInputFocus() { 
    this.answerFieldHasFocus = true;
    this.answerFieldFocusChange.emit(true);
  }

  onAnswerInputBlur() { 
    this.answerFieldHasFocus = false
    this.answerFieldFocusChange.emit(true);
  }
}
