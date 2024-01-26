/// <reference lib="webworker" />

import { WebSocketEvent,GlobalConstants } from "./global-constants";

var clipSocket: WebSocket = new WebSocket(GlobalConstants.clipServerURL);
/*var clipSocket: WebSocket; // = new WebSocket(GlobalConstants.clipServerURL);

addEventListener('message', ({ data }) => {
  switch(data.event) {
    case WebSocketEvent.OPEN:
      // Initialize and connect the WebSocket using provided URL
      clipSocket = new WebSocket(data.clipServerURL);
      connectWebSocket();
      break;
    case WebSocketEvent.CLOSE:
      clipSocket?.close();
      break;
    case WebSocketEvent.MESSAGE:
      clipSocket?.send(JSON.stringify(data.content));
      break;
    // Add other cases as needed
  }
});*/

addEventListener('message', ({ data }) => {
  console.log('clip worker received message');
  if (data.event === WebSocketEvent.OPEN) {
    connectWebSocket();
  }
  else if (data.event === WebSocketEvent.CLOSE) {
    clipSocket.close();
  } 
  else if (data.event === WebSocketEvent.MESSAGE) {
    clipSocket.send(JSON.stringify(data.content));
  }
  //const response = `worker response to ${data}`;
  //postMessage(response);
});


function connectWebSocket() {  
  console.log('clip connectWebSocket() called');

  clipSocket.onmessage = (message: MessageEvent) => {
    console.log('clip websocket onmessage (content received)');
    postMessage({ event:WebSocketEvent.MESSAGE, content: message.data});
  }
  clipSocket.onclose = (event) => {
    console.log('clip websocket onclose');
    postMessage({ event: WebSocketEvent.CLOSE });
  }
  clipSocket.onopen = (event) => {
    console.log('clip websocket onopen');
    postMessage({ event: WebSocketEvent.OPEN });
  }
  clipSocket.onerror = (event) => {
    console.log('clip websocket onerror');
    postMessage({ event: WebSocketEvent.ERROR });
  }

}
