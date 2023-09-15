import { Component } from '@angular/core';
//import { HttpClient } from '@angular/common/http';

interface Link {
  title: string;
  url: string;
  content: string;
}

@Component({
  selector: 'app-exploration',
  templateUrl: './exploration.component.html',
  styleUrls: ['./exploration.component.scss']
})
export class ExplorationComponent {
  links: Link[] = [
    { title: 'cluster0', url: 'cluster0.html', content: '<h1>Cluster 0 (1 items)</h1><a href="cluster-1.html">prev</a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="cluster1.html">next</a></br><div id="container"><img class="image" src="https://divexplore.itec.aau.at/summaries/07787/07787_summary_1_1_1_1.jpg"><img class="zoom" src="https://divexplore.itec.aau.at/summaries/07787/07787_summary_1_1_1_1.jpg"><a href="localhost:4200/video/07787">07787</a><br/></div>'},
    { title: 'cluster1', url: 'http://www.orf.at/', content: '' },
    { title: 'cluster2', url: 'cluster/cluster2.html', content: '' },
    { title: 'cluster3', url: './cluster/cluster3.html', content: '' },
    { title: 'cluster4', url: './cluster/cluster4.html', content: '' },
    { title: 'cluster5', url: './cluster/cluster5.html', content: '' },
    { title: 'cluster6', url: './cluster/cluster6.html', content: '' },
    { title: 'cluster7', url: './cluster/cluster7.html', content: '' },
    { title: 'cluster8', url: './cluster/cluster8.html', content: '' },
    { title: 'cluster9', url: './cluster/cluster9.html', content: '' },
    { title: 'cluster10', url: './cluster/cluster10.html', content: '' }
  ];
  selectedLink: Link | undefined;
  localPageHtml: String | undefined

  //constructor(private http: HttpClient) { }

  onSelectLink(link: Link) {
    this.selectedLink = link;
    /*this.http.get(link.url, { responseType: 'text' }).subscribe(html => {
      this.localPageHtml = html;
    });*/
  }
  sandbox="allow-scripts"
}
