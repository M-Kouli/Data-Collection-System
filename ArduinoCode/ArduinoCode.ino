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
void handleBoardData(String boardData, double currentTemperature, float upperControlLimit, float lowerControlLimit) {
    if (boardData.startsWith("Board:")) {
        // Initialize variables with default values representing "no value"
        int boardNumber = -1;
        int P1 = -1, P2 = -1, T1 = -1, T2 = -1, Vx = -1, Vz = -1, Ct = -1, Vt = -1;
        char timestamp[25];

        // Tokenize the input string
        char inputCopy[boardData.length() + 1];
        boardData.toCharArray(inputCopy, boardData.length() + 1);

        char* token = strtok(inputCopy, " :");
        while (token != nullptr) {
            if (strcmp(token, "Board") == 0) {
                token = strtok(nullptr, " :");
                boardNumber = atoi(token);
            } else if (strcmp(token, "P1") == 0) {
                token = strtok(nullptr, " :");
                P1 = atoi(token);
            } else if (strcmp(token, "P2") == 0) {
                token = strtok(nullptr, " :");
                P2 = atoi(token);
            } else if (strcmp(token, "T1") == 0) {
                token = strtok(nullptr, " :");
                T1 = atoi(token);
            } else if (strcmp(token, "T2") == 0) {
                token = strtok(nullptr, " :");
                T2 = atoi(token);
            } else if (strcmp(token, "Vx") == 0) {
                token = strtok(nullptr, " :");
                Vx = atoi(token);
            } else if (strcmp(token, "Vz") == 0) {
                token = strtok(nullptr, " :");
                Vz = atoi(token);
            } else if (strcmp(token, "Ct") == 0) {
                token = strtok(nullptr, " :");
                Ct = atoi(token);
            } else if (strcmp(token, "Vt") == 0) {
                token = strtok(nullptr, " :");
                Vt = atoi(token);
            }
            token = strtok(nullptr, " :");
        }

        // Debug output
        Serial.println("Debug: Tokenized extraction results:");
        Serial.print("Board Number: "); Serial.println(boardNumber);
        Serial.print("P1: "); Serial.println(P1);
        Serial.print("P2: "); Serial.println(P2);
        Serial.print("T1: "); Serial.println(T1);
        Serial.print("T2: "); Serial.println(T2);
        Serial.print("Vx: "); Serial.println(Vx);
        Serial.print("Vz: "); Serial.println(Vz);
        Serial.print("Ct: "); Serial.println(Ct);
        Serial.print("Vt: "); Serial.println(Vt);


        // Retrieve control limits from the config file
        // Retrieve control limits from the config file
        bool allowControlLimits = configDoc["board_data"]["allow_control_limits"];
        bool allowTempControlLimits = configDoc["board_data"]["allow_control_limits"];

        float p1PlusMinus = configDoc["board_data"]["control_limits"]["P1"]["plus_minus"];
        float p1AdditionalValue = configDoc["board_data"]["control_limits"]["P1"]["additional_value"];

        float p2PlusMinus = configDoc["board_data"]["control_limits"]["P2"]["plus_minus"];
        float p2AdditionalValue = configDoc["board_data"]["control_limits"]["P2"]["additional_value"];

        float t1LowTemp = configDoc["board_data"]["control_limits"]["T1"]["low_temp_value"];
        float t1HighTemp = configDoc["board_data"]["control_limits"]["T1"]["high_temp_value"];
        float t1PlusMinus = configDoc["board_data"]["control_limits"]["T1"]["plus_minus"];

        float t2LowTemp = configDoc["board_data"]["control_limits"]["T2"]["low_temp_value"];
        float t2HighTemp = configDoc["board_data"]["control_limits"]["T2"]["high_temp_value"];
        float t2PlusMinus = configDoc["board_data"]["control_limits"]["T2"]["plus_minus"];

        float vxPlusMinus = configDoc["board_data"]["control_limits"]["Vx"]["plus_minus"];
        float vxAdditionalValue = configDoc["board_data"]["control_limits"]["Vx"]["additional_value"];

        float vzPlusMinus = configDoc["board_data"]["control_limits"]["Vz"]["plus_minus"];
        float vzAdditionalValue = configDoc["board_data"]["control_limits"]["Vz"]["additional_value"];

        float ctPlusMinus = configDoc["board_data"]["control_limits"]["Ct"]["plus_minus"];
        float ctAdditionalValue = configDoc["board_data"]["control_limits"]["Ct"]["additional_value"];

        float vtPlusMinus = configDoc["board_data"]["control_limits"]["Vt"]["plus_minus"];
        float vtAdditionalValue = configDoc["board_data"]["control_limits"]["Vt"]["additional_value"];

        // Prepare the data to be sent to the WebSocket server
        DynamicJsonDocument sendDoc(1024);
        sendDoc["type"] = "newOvenData";

        JsonObject data = sendDoc.createNestedObject("data");
        data["ovenId"] = storedOvenName;
        data["boardId"] = boardNumber;
        data["dataType"] = "Board";
        data["timestamp"] = timeStamp(); // Create a timestamp function

        // Include the current oven temperature and its control limits
        data["temperature"] = currentTemperature;
        data["temperatureUpperControlLimit"] = nullptr;
        data["temperatureLowerControlLimit"] = nullptr;

        // Assign values to the JSON object, or set to null if the value is missing (-1 means missing)
        if (P1 != -1) {
            data["p1"] = P1;
        } else {
            data["p1"] = nullptr;
        }

        if (P2 != -1) {
            data["p2"] = P2;
        } else {
            data["p2"] = nullptr;
        }

        if (T1 != -1) {
            data["t1"] = T1;
        } else {
            data["t1"] = nullptr;
        }

        if (T2 != -1) {
            data["t2"] = T2;
        } else {
            data["t2"] = nullptr;
        }

        if (Vx != -1) {
            data["vx"] = Vx;
        } else {
            data["vx"] = nullptr;
        }

        if (Vz != -1) {
            data["vz"] = Vz;
        } else {
            data["vz"] = nullptr;
        }

        if (Ct != -1) {
            data["ct"] = Ct;
        } else {
            data["ct"] = nullptr;
        }

        if (Vt != -1) {
            data["vt"] = Vt;
        } else {
            data["vt"] = nullptr;
        }
       // Calculate and set control limits for P1 if plus_minus is greater than 0
        if (allowControlLimits && p1PlusMinus > 0.0) {
            float p1UpperControlLimit = p1AdditionalValue + p1PlusMinus;
            float p1LowerControlLimit = p1AdditionalValue - p1PlusMinus;
            data["p1UpperControlLimit"] = p1UpperControlLimit;
            data["p1LowerControlLimit"] = p1LowerControlLimit;
        } else {
            data["p1UpperControlLimit"] = nullptr;
            data["p1LowerControlLimit"] = nullptr;
        }

        // Calculate and set control limits for P2 if plus_minus is greater than 0
        if (allowControlLimits && p2PlusMinus > 0.0) {
            float p2UpperControlLimit = p2AdditionalValue + p2PlusMinus;
            float p2LowerControlLimit = p2AdditionalValue - p2PlusMinus;
            data["p2UpperControlLimit"] = p2UpperControlLimit;
            data["p2LowerControlLimit"] = p2LowerControlLimit;
        } else {
            data["p2UpperControlLimit"] = nullptr;
            data["p2LowerControlLimit"] = nullptr;
        }

        // Determine and set control limits for T1 based on proximity to lowTemp or highTemp
        if (T1 != -1 && allowControlLimits && t1PlusMinus > 0.0) {
            float t1UpperControlLimit, t1LowerControlLimit;
            if (fabs(T1 - t1LowTemp) < fabs(T1 - t1HighTemp)) {
                t1UpperControlLimit = t1LowTemp + t1PlusMinus;
                t1LowerControlLimit = t1LowTemp - t1PlusMinus;
            } else {
                t1UpperControlLimit = t1HighTemp + t1PlusMinus;
                t1LowerControlLimit = t1HighTemp - t1PlusMinus;
            }
            data["t1UpperControlLimit"] = t1UpperControlLimit;
            data["t1LowerControlLimit"] = t1LowerControlLimit;
        } else {
            data["t1UpperControlLimit"] = nullptr;
            data["t1LowerControlLimit"] = nullptr;
        }

        // Determine and set control limits for T2 based on proximity to lowTemp or highTemp
        if (T2 != -1 && allowControlLimits && t2PlusMinus > 0.0) {
            float t2UpperControlLimit, t2LowerControlLimit;
            if (fabs(T2 - t2LowTemp) < fabs(T2 - t2HighTemp)) {
                t2UpperControlLimit = t2LowTemp + t2PlusMinus;
                t2LowerControlLimit = t2LowTemp - t2PlusMinus;
            } else {
                t2UpperControlLimit = t2HighTemp + t2PlusMinus;
                t2LowerControlLimit = t2HighTemp - t2PlusMinus;
            }
            data["t2UpperControlLimit"] = t2UpperControlLimit;
            data["t2LowerControlLimit"] = t2LowerControlLimit;
        } else {
            data["t2UpperControlLimit"] = nullptr;
            data["t2LowerControlLimit"] = nullptr;
        }

        // Calculate and set control limits for Vx if plus_minus is greater than 0
        if (allowControlLimits && vxPlusMinus > 0.0) {
            float vxUpperControlLimit = vxAdditionalValue + vxPlusMinus;
            float vxLowerControlLimit = vxAdditionalValue - vxPlusMinus;
            data["vxUpperControlLimit"] = vxUpperControlLimit;
            data["vxLowerControlLimit"] = vxLowerControlLimit;
        } else {
            data["vxUpperControlLimit"] = nullptr;
            data["vxLowerControlLimit"] = nullptr;
        }

        // Calculate and set control limits for Vz if plus_minus is greater than 0
        if (allowControlLimits && vzPlusMinus > 0.0) {
            float vzUpperControlLimit = vzAdditionalValue + vzPlusMinus;
            float vzLowerControlLimit = vzAdditionalValue - vzPlusMinus;
            data["vzUpperControlLimit"] = vzUpperControlLimit;
            data["vzLowerControlLimit"] = vzLowerControlLimit;
        } else {
            data["vzUpperControlLimit"] = nullptr;
            data["vzLowerControlLimit"] = nullptr;
        }

        // Calculate and set control limits for Ct if plus_minus is greater than 0
        if (allowControlLimits && ctPlusMinus > 0.0) {
            float ctUpperControlLimit = ctAdditionalValue + ctPlusMinus;
            float ctLowerControlLimit = ctAdditionalValue - ctPlusMinus;
            data["ctUpperControlLimit"] = ctUpperControlLimit;
            data["ctLowerControlLimit"] = ctLowerControlLimit;
        } else {
            data["ctUpperControlLimit"] = nullptr;
            data["ctLowerControlLimit"] = nullptr;
        }

        // Calculate and set control limits for Vt if plus_minus is greater than 0
        if (allowControlLimits && vtPlusMinus > 0.0) {
            float vtUpperControlLimit = vtAdditionalValue + vtPlusMinus;
            float vtLowerControlLimit = vtAdditionalValue - vtPlusMinus;
            data["vtUpperControlLimit"] = vtUpperControlLimit;
            data["vtLowerControlLimit"] = vtLowerControlLimit;
        } else {
            data["vtUpperControlLimit"] = nullptr;
            data["vtLowerControlLimit"] = nullptr;
        }
        data["hasOvenControlLimits"] = false;
        data["hasBoardControlLimits"] = allowControlLimits;

        String output;
        serializeJson(sendDoc, output);
        // Check if the boardNumber is valid (i.e., a number larger than 0)
        if (boardNumber > 0) {
            // Serialize and send the JSON data over WebSocket
            String output;
            serializeJson(sendDoc, output);
            client.send(output);
            Serial.println("Sent board data: " + output);
        } else {
            Serial.println("Invalid board number, data not sent.");
        }
        Serial.println("Sent board data: " + output);
    } else {
        Serial.println("Received invalid board data format.");
    }
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
  // Variable to store board data if available
  String boardData = "";
  // Check for data from the serial port
  if (Serial.available() > 0) {
    String serialInput = Serial.readStringUntil('\n');
    serialInput.trim();  // Remove any trailing newline or spaces
    Serial.println(serialInput);
    // Check if the input starts with "JSON:"
    if (serialInput.startsWith("JSON:")) {
      String jsonString = serialInput.substring(5);  // Extract the JSON part
      storeJsonConfig(jsonString);  // Store the JSON configuration
    } else if (serialInput.startsWith("Board:")) {
      // Store board data if it starts with "Board:"
          handleBoardData(serialInput, max31856.readThermocoupleTemperature(), 0, 0);
      Serial.println(serialInput);
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

      // Send active temperature data with the new logic, passing boardData if available
      sendActiveTemperatureData(max31856.readThermocoupleTemperature(), lowerTempValue, highTempValue, tempLimitsPlusMinus, allowControlLimits, rampRate, trend);

      lastMessageTime = currentTime;
    }
  }
}
