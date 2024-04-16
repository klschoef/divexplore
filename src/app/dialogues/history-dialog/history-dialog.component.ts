import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-history-dialog',
  templateUrl: './history-dialog.component.html',
  styleUrls: ['./history-dialog.component.scss']
})
export class HistoryDialogComponent {
  @Output() clickOnClose: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
}
