//This is just to upload
#include <WiFi.h>
#include <ArduinoWebsockets.h>
#include <ArduinoJson.h>
#include <Adafruit_MAX31856.h>
#include <time.h>

// WiFi credentials
const char* ssid = "VM0376737";
const char* password = "npsk4GwFvsqx";

// WebSocket server address (use local IP address of your server)
const char* websockets_server = "ws://192.168.0.11:3000";

// NTP server and timezone settings
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 0;
const int   daylightOffset_sec = 0;

using namespace websockets;

// Create a WebSocket client
WebsocketsClient client;

// Variables to store the oven name and JSON configuration
String storedOvenName = "";
String currentState = "";
String previousState = "";  // To track state changes
unsigned long lastMessageTime = 0;  // To track the time of the last message sent
unsigned long lastTempCheckTime = 0;  // To track the time of the last temperature check
unsigned long rampStartTime = 0;      // To track when the ramping started
const unsigned long messageInterval = 60000;  // 1 minute in milliseconds
const unsigned long tempCheckInterval = 10000; // 10 seconds in milliseconds

DynamicJsonDocument configDoc(2048);  // Allocate enough memory to store the incoming JSON config

// Temperature storage array and index
double temperatureReadings[12] = {0};
int temperatureIndex = 0;
bool arrayFilled = false;

const double BASELINE_RAMP_RATE = 1.8; // 1.8 degrees per minute

// Initialize MAX31856 (CS, DI, DO, CLK)
Adafruit_MAX31856 max31856 = Adafruit_MAX31856(10, 11, 12, 13); 

void onEventsCallback(WebsocketsEvent event, String data) {
  if (event == WebsocketsEvent::ConnectionOpened) {
    Serial.println("WebSocket connection opened");
  } else if (event == WebsocketsEvent::ConnectionClosed) {
    Serial.println("WebSocket connection closed");
  } else if (event == WebsocketsEvent::GotPing) {
    Serial.println("Received a Ping!");
  } else if (event == WebsocketsEvent::GotPong) {
    Serial.println("Received a Pong!");
  }
}

void sendConnectMessage(String ovenName) {
  DynamicJsonDocument doc(1024);
  doc["type"] = "identify";
  doc["clientId"] = ovenName;

  String output;
  serializeJson(doc, output);
  client.send(output);
  Serial.println("Sent CONNECT message: " + output);
}

void sendJsonMessage(String type, String ovenName) {
  DynamicJsonDocument doc(1024);
  doc["type"] = type;

  JsonObject data = doc.createNestedObject("data");
  data["ovenId"] = ovenName;

  String output;
  serializeJson(doc, output);
  client.send(output);
  Serial.println("Sent message: " + output);
}

void storeJsonConfig(String jsonString) {
  Serial.println("Starting JSON deserialization...");
  DeserializationError error = deserializeJson(configDoc, jsonString);
  if (error) {
    Serial.print(F("Failed to parse JSON: "));
    Serial.println(error.f_str());
  } else {
    Serial.println(F("JSON configuration stored successfully"));
    // Access some values as an example
    bool logBoardData = configDoc["log_board_data"];
    float lowerTempValue = configDoc["temperature_control"]["lower_temp_value"];
    float highTempValue = configDoc["temperature_control"]["high_temp_value"];
    String modbusBurnsys = configDoc["board_data"]["modbus_burnsys"];
    String folderPath = configDoc["board_data"]["folder_path"];

    Serial.print("log_board_data: ");
    Serial.println(logBoardData);
    Serial.print("lower_temp_value: ");
    Serial.println(lowerTempValue);
    Serial.print("high_temp_value: ");
    Serial.println(highTempValue);
    Serial.print("modbus_burnsys: ");
    Serial.println(modbusBurnsys);
    Serial.print("folder_path: ");
    Serial.println(folderPath);
  }
  Serial.println("Finished JSON deserialization.");
}

void sendTemperatureData(double temperature, float lowerTempValue, float tempLimitsPlusMinus, bool allowControlLimits) {
  DynamicJsonDocument doc(1024);
  
  // Calculate upper and lower control limits
  float upperControlLimit = lowerTempValue + tempLimitsPlusMinus;
  float lowerControlLimit = lowerTempValue - tempLimitsPlusMinus;

  // Create the inner data structure
  JsonObject data = doc.createNestedObject("data");
  data["ovenId"] = storedOvenName;
  data["temperature"] = temperature;
  
  // Set control limits based on configuration
  if (allowControlLimits) {
    data["temperatureUpperControlLimit"] = upperControlLimit;
    data["temperatureLowerControlLimit"] = lowerControlLimit;
  } else {
    data["temperatureUpperControlLimit"] = nullptr; // This represents `None` in Python
    data["temperatureLowerControlLimit"] = nullptr; // This represents `None` in Python
  }
  
  data["dataType"] = "Oven";
  data["timestamp"] = timeStamp(); // Create a timestamp function
  data["hasOvenControlLimits"] = allowControlLimits;
  data["hasBoardControlLimits"] = false;

  // Create the outer structure with the type "newOvenData"
  doc["type"] = "newOvenData";
  
  String output;
  serializeJson(doc, output);
  client.send(output);
  Serial.println("Sent temperature data: " + output);
}

void sendActiveTemperatureData(double temperature, float lowerTempValue, float highTempValue, float tempLimitsPlusMinus, bool allowControlLimits, float rampRate, String trend) {
  DynamicJsonDocument doc(1024);
  
  float upperControlLimit = 0;
  float lowerControlLimit = 0;
  bool controlLimitsEnabled = allowControlLimits;

  if (trend == "Ramping Up" || trend == "Ramping Down") {
    if (rampRate > 0) {
      // Calculate the time elapsed since ramping started
      unsigned long elapsedTime = (millis() - rampStartTime) / 60000.0; // Convert milliseconds to minutes
      float estimatedTemp = 0;
      
      if (trend == "Ramping Up") {
        // Estimate the current temperature during ramping up
        estimatedTemp = lowerTempValue + (rampRate * elapsedTime);
      } else if (trend == "Ramping Down") {
        // Estimate the current temperature during ramping down
        estimatedTemp = highTempValue - (rampRate * elapsedTime);
      }

      // Set control limits around the estimated temperature
      upperControlLimit = estimatedTemp + tempLimitsPlusMinus;
      lowerControlLimit = estimatedTemp - tempLimitsPlusMinus;
    } else {
      // Disable control limits if no ramp rate is selected
      controlLimitsEnabled = false;
    }
  } else {
    // Stable No ramping
    // Determine which value we are closer to: high_temp_value or lower_temp_value
    if (fabs(temperature - highTempValue) < fabs(temperature - lowerTempValue)) {
        // Closer to high_temp_value
        upperControlLimit = highTempValue + tempLimitsPlusMinus;
        lowerControlLimit = highTempValue - tempLimitsPlusMinus;
    } else {
        // Closer to lower_temp_value
        upperControlLimit = lowerTempValue + tempLimitsPlusMinus;
        lowerControlLimit = lowerTempValue - tempLimitsPlusMinus;
    }
  }

  // Create the inner data structure
  JsonObject data = doc.createNestedObject("data");
  data["ovenId"] = storedOvenName;
  data["temperature"] = temperature;
  
  // Set control limits based on the logic above
  if (controlLimitsEnabled) {
    data["temperatureUpperControlLimit"] = upperControlLimit;
    data["temperatureLowerControlLimit"] = lowerControlLimit;
  } else {
    data["temperatureUpperControlLimit"] = nullptr; // This represents `None` in Python
    data["temperatureLowerControlLimit"] = nullptr; // This represents `None` in Python
  }
  
  data["dataType"] = "Oven";
  data["timestamp"] = timeStamp(); // Create a timestamp function
  data["hasOvenControlLimits"] = controlLimitsEnabled;
  data["hasBoardControlLimits"] = false;

  // Create the outer structure with the type "newOvenData"
  doc["type"] = "newOvenData";
  
  String output;
  serializeJson(doc, output);
  client.send(output);
  Serial.println("Sent active temperature data: " + output);
}

String timeStamp() {
  time_t now = time(nullptr);
  struct tm* p_tm = gmtime(&now);

  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", p_tm);

  return String(buffer);
}

void storeTemperature(double temperature) {
  // Store temperature in the circular buffer
  temperatureReadings[temperatureIndex] = temperature;
  temperatureIndex = (temperatureIndex + 1) % 12;
  if (temperatureIndex == 0) {
    arrayFilled = true;
  }
}

String analyzeTemperatureTrend(float lowerTempValue, float highTempValue, float tempLimitsPlusMinus) {
    const int MIN_READINGS = 6;

    int validEntries = arrayFilled ? 12 : temperatureIndex;

    if (validEntries < MIN_READINGS) {
        return "Not enough data";
    }

    double sumChanges = 0;
    for (int i = 1; i < validEntries; i++) {
        sumChanges += temperatureReadings[i] - temperatureReadings[i - 1];
    }

    double avgChange = (sumChanges / (validEntries - 1)) * (60.0 / (tempCheckInterval / 1000.0));

    if (avgChange > BASELINE_RAMP_RATE) {
        if (rampStartTime == 0) {
            rampStartTime = millis();  // Log the start time when ramping begins
        }
        return "Ramping Up";
    } else if (avgChange < -BASELINE_RAMP_RATE) {
        if (rampStartTime == 0) {
            rampStartTime = millis();  // Log the start time when ramping begins
        }
        return "Ramping Down";
    } else {
        if (rampStartTime != 0) {
            rampStartTime = 0;  // Reset the ramp start time when stabilizing
        }
        double avgTemp = 0;
        for (int i = 0; i < validEntries; i++) {
            avgTemp += temperatureReadings[i];
        }
        avgTemp /= validEntries;

        // Determine if stable around lower or high temp value
        if (fabs(avgTemp - highTempValue) <= tempLimitsPlusMinus) {
            return "Stable around High Temp";
        } else if (fabs(avgTemp - lowerTempValue) <= tempLimitsPlusMinus) {
            return "Stable around Low Temp";
        } else {
            return "Stable but not near target";
        }
    }
}

void setup() {
  // Start serial communication
  Serial.begin(9600);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");

  // Synchronize time using NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Time synchronized with NTP");

  // Setup WebSocket event callbacks
  client.onEvent(onEventsCallback);

  // Initialize MAX31856
  if (!max31856.begin()) {
    Serial.println("Could not find a valid MAX31856 sensor, check wiring!");
    while (1);
  }
  max31856.setThermocoupleType(MAX31856_TCTYPE_K);  // Set the thermocouple type to K

  Serial.println("Ready to receive commands.");
}

void loop() {
  // Handle WebSocket events
  client.poll();

  // Check for data from the serial port
  if (Serial.available() > 0) {
    String serialInput = Serial.readStringUntil('\n');
    serialInput.trim();  // Remove any trailing newline or spaces

    // Check if the input starts with "JSON:"
    if (serialInput.startsWith("JSON:")) {
      String jsonString = serialInput.substring(5);  // Extract the JSON part
      storeJsonConfig(jsonString);  // Store the JSON configuration
    } else {
      int separatorIndex = serialInput.indexOf(' ');
      if (separatorIndex != -1) {
        String command = serialInput.substring(0, separatorIndex);
        String ovenName = serialInput.substring(separatorIndex + 1);
        ovenName.trim();  // Trim any whitespace around the oven name

        if (command == "CONNECT") {
          if (!client.available()) {  // Only connect if not already connected
            storedOvenName = ovenName;  // Store the oven name
            Serial.println("Connecting to WebSocket server...");
            client.connect(websockets_server);  // Connect to the WebSocket server
            delay(500);  // Small delay to ensure connection is established
            if (client.available()) {
              sendConnectMessage(storedOvenName);  // Send the identify message
              currentState = "Idle";
            } else {
              Serial.println("Failed to connect to WebSocket server");
            }
          } else {
            Serial.println("Already connected to WebSocket server");
            currentState = "Idle";
          }
        }
      } else if (serialInput == "IDLE" && storedOvenName != "") {
        sendJsonMessage("stop", storedOvenName);
        currentState = "Idle";
      } else if (serialInput == "ACTIVE" && storedOvenName != "") {
        sendJsonMessage("ovenActive", storedOvenName);
        currentState = "Active";
      } else if (serialInput == "DISCONNECT") {
        if (client.available()) {  // Only disconnect if connected
          Serial.println("Disconnecting from WebSocket server...");
          client.close();
          currentState = "Disconnected";
        } else {
          Serial.println("Not connected to WebSocket server");
        }
      } else {
        Serial.println("Invalid command received or oven name not set: " + serialInput);
      }
    }
  }

  // Perform actions in Idle state
  if (currentState == "Idle") {
    unsigned long currentTime = millis();
    if (currentTime - lastMessageTime >= messageInterval) {
      // Read temperature from MAX31856
      double thermocoupleTemp = max31856.readThermocoupleTemperature();

      Serial.print("Thermocouple Temperature: ");
      Serial.println(thermocoupleTemp);

      // Retrieve configuration parameters
      float lowerTempValue = configDoc["temperature_control"]["lower_temp_value"];
      float tempLimitsPlusMinus = configDoc["temperature_control"]["temp_limits_plus_minus"];
      bool allowControlLimits = configDoc["temperature_control"]["allow_control_limits"];

      // Send temperature data as part of the message
      sendTemperatureData(thermocoupleTemp, lowerTempValue, tempLimitsPlusMinus, allowControlLimits);
      lastMessageTime = currentTime;
    }
  }
  // Perform actions in Active state
  else if (currentState == "Active") {
    unsigned long currentTime = millis();
    
    // Log temperature every 10 seconds
    if (currentTime - lastTempCheckTime >= tempCheckInterval) {
      // Read temperature from MAX31856
      double thermocoupleTemp = max31856.readThermocoupleTemperature();

      Serial.print("Thermocouple Temperature: ");
      Serial.println(thermocoupleTemp);

      // Store temperature in the array
      storeTemperature(thermocoupleTemp);

      lastTempCheckTime = currentTime;
    }

    // Send temperature data every 1 minute
    if (currentTime - lastMessageTime >= messageInterval) {
      // Retrieve configuration parameters
      float lowerTempValue = configDoc["temperature_control"]["lower_temp_value"];
      float highTempValue = configDoc["temperature_control"]["high_temp_value"];
      float tempLimitsPlusMinus = configDoc["temperature_control"]["temp_limits_plus_minus"];
      bool allowControlLimits = configDoc["temperature_control"]["allow_control_limits"];
      float rampRate = configDoc["temperature_control"]["ramp_rate"]; // Added missing semicolon

      // Analyze the temperature trend
      String trend = analyzeTemperatureTrend(lowerTempValue, highTempValue, tempLimitsPlusMinus);
      Serial.println("Temperature Trend: " + trend);

      // Send active temperature data with the new logic
      sendActiveTemperatureData(max31856.readThermocoupleTemperature(), lowerTempValue, highTempValue, tempLimitsPlusMinus, allowControlLimits, rampRate, trend);

      lastMessageTime = currentTime;
    }
  }
}
