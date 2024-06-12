import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
  animations: [
    trigger('toastAnimation', [
      transition('void => *', [
        animate('400ms ease-in', keyframes([
          style({ opacity: 0, transform: 'translateX(100%)', offset: 0 }),
          style({ opacity: 1, transform: 'translateX(0)', offset: 0.8 }),
        ]))
      ]),
      transition('* => void', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateX(100%)' }))
      ])
    ])
  ]
})

export class ToastComponent implements OnInit {
  @Input() toastMessage: string = 'User shared a video: ';
  @Input() showToast: boolean = true;
  @Input() toastLink: string = "";
  @Input() imageSrc: string | null = null;

  @Output() closeToast = new EventEmitter<void>();

  constructor() { }

  openLink() {
    //remove "query/" from the current url
    let cleanLink = window.location.href.replace("/query", "");
    let link = cleanLink + this.toastLink;

    window.open(link, '_blank')
    this.close();
  }

  close() {
    this.closeToast.emit();
  }

  ngOnInit(): void {

  }
}
