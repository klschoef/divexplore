/// <reference lib="webworker" />

import { WebSocketEvent,GlobalConstants } from "./global-constants";

var socket: WebSocket = new WebSocket(GlobalConstants.clipServerURL);
 
addEventListener('message', ({ data }) => {
  console.log('worker received message');
  if (data.event === WebSocketEvent.OPEN) {
    connectWebSocket();
  }
  else if (data.event === WebSocketEvent.CLOSE) {
    socket.close();
  } 
  else if (data.event === WebSocketEvent.MESSAGE) {
    socket.send(JSON.stringify(data.content));
  }
  //const response = `worker response to ${data}`;
  //postMessage(response);
});

function connectWebSocket() {  
  console.log('connectWebSocket() called');

  socket.onmessage = (message: MessageEvent) => {
    console.log('websocket onmessage (content received)');
    postMessage({ event:WebSocketEvent.MESSAGE, content: message.data});
  }
  socket.onclose = (event) => {
    console.log('websocket onclose');
    postMessage({ event: WebSocketEvent.CLOSE });
  }
  socket.onopen = (event) => {
    console.log('websocket onopen');
    postMessage({ event: WebSocketEvent.OPEN });
  }
  socket.onerror = (event) => {
    console.log('websocket onerror');
    postMessage({ event: WebSocketEvent.ERROR });
  }

}
