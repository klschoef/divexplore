/// <reference lib="webworker" />

import { WebSocketEvent,GlobalConstants } from "./global-constants";

var nodeSocket: WebSocket = new WebSocket(GlobalConstants.nodeServerURL);
 
addEventListener('message', ({ data }) => {
  console.log('node worker received message');
  if (data.event === WebSocketEvent.OPEN) {
    connectWebSocket();
  }
  else if (data.event === WebSocketEvent.CLOSE) {
    nodeSocket.close();
  } 
  else if (data.event === WebSocketEvent.MESSAGE) {
    nodeSocket.send(JSON.stringify(data.content));
  }
});

function connectWebSocket() {  
  console.log('node connectWebSocket() called');

  nodeSocket.onmessage = (message: MessageEvent) => {
    console.log('node websocket onmessage (content received)');
    postMessage({ event:WebSocketEvent.MESSAGE, content: message.data});
  }
  nodeSocket.onclose = (event) => {
    console.log('node websocket onclose');
    postMessage({ event: WebSocketEvent.CLOSE });
  }
  nodeSocket.onopen = (event) => {
    console.log('node websocket onopen');
    postMessage({ event: WebSocketEvent.OPEN });
  }
  nodeSocket.onerror = (event) => {
    console.log('node websocket onerror');
    postMessage({ event: WebSocketEvent.ERROR });
  }

}
