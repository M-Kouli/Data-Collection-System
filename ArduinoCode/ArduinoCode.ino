#include <WiFi.h>
#include <ArduinoWebsockets.h>

// WiFi credentials
const char* ssid = "VM0376737";
const char* password = "npsk4GwFvsqx";

// WebSocket server address (use local IP address of your server)
const char* websockets_server = "ws://192.168.0.11:8080";

using namespace websockets;

// Create a WebSocket client
WebsocketsClient client;

void onMessageCallback(WebsocketsMessage message) {
  Serial.print("Received data from server: ");
  Serial.println(message.data());
}

void onEventsCallback(WebsocketsEvent event, String data) {
  if(event == WebsocketsEvent::ConnectionOpened) {
    Serial.println("WebSocket connection opened");
  } else if(event == WebsocketsEvent::ConnectionClosed) {
    Serial.println("WebSocket connection closed");
  } else if(event == WebsocketsEvent::GotPing) {
    Serial.println("Received a Ping!");
  } else if(event == WebsocketsEvent::GotPong) {
    Serial.println("Received a Pong!");
  }
}

void setup() {
  // Start serial communication
  Serial.begin(115200);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");

  // Setup WebSocket event callbacks
  client.onMessage(onMessageCallback);
  client.onEvent(onEventsCallback);

  // Connect to WebSocket server
  client.connect(websockets_server);

  // Check if connection is successful
  if(client.available()) {
    Serial.println("Connected to WebSocket server");
  } else {
    Serial.println("Failed to connect to WebSocket server");
  }
}

void loop() {
  // Handle WebSocket events
  client.poll();

  // Check for data from the serial port
  if (Serial.available() > 0) {
    String data = Serial.readStringUntil('\n');
    client.send(data);
    Serial.println("Data sent to server: " + data);
  }
}
