import tkinter as tk
from tkinter import messagebox, filedialog, ttk
import threading
import time
import json
import serial
import re
import os

# Define the CONFIG File
CONFIG_FILE = "oven_config.json"

# Function to load the configuration from a file
def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as file:
            config = json.load(file)
    else:
        config = {
            "log_board_data": False,
            "temperature_control": {
                "allow_control_limits": False,
                "lower_temp_value": 0.0,
                "high_temp_value": 0.0,
                "temp_limits_plus_minus": 0.0,
                "ramp_rate": None
            },
            "board_data": {
                "modbus_burnsys": "Modbus",
                "is_treebeard": False,
                "folder_path": "",
                "com_port": "",
                "allow_control_limits": False,
                "control_limits": {
                    "P1": {"plus_minus": 0.0},
                    "P2": {"plus_minus": 0.0},
                    "T1": {"plus_minus": 0.0, "low_temp_value": 0.0, "high_temp_value": 0.0},
                    "T2": {"plus_minus": 0.0, "low_temp_value": 0.0, "high_temp_value": 0.0},
                    "Vx": {"plus_minus": 0.0},
                    "Vz": {"plus_minus": 0.0},
                    "Ct": {"plus_minus": 0.0},
                    "Vt": {"plus_minus": 0.0}
                },
                "sequence": "P1 P2 T1 T2 Vx Vz Ct Vt"
            }
        }
        save_config(config)  # Save default config to file

    # Ensure the 'com_port' key exists
    if "com_port" not in config["board_data"]:
        config["board_data"]["com_port"] = ""

    return config

# Function to save the configuration to a file
def save_config(config):
    with open(CONFIG_FILE, 'w') as file:
        json.dump(config, file, indent=4)

# Class to handle the oven monitoring logic
class OvenMonitor:
    def __init__(self):
        self.ws = None
        self.ser = None
        self.connected = False
        self.monitoring = False
        self.temperature = 0
        self.board_number = 1
        self.last_data_time = time.time()
        self.BOARD_RESET_TIME = 20 * 60  # 20 minutes in seconds

    def establish_connection(self, oven_name):
        try:
            if not self.connected:
                self.ser = serial.Serial('COM4', 9600, timeout=1)  # Adjust 'COM4' as per your setup
                time.sleep(2)  # Allow time for the serial connection to establish
                
                # Send CONNECT command
                connect_message = f"CONNECT {oven_name}\n"
                self.ser.write(connect_message.encode('ascii'))
                print(f"Sent: {connect_message.strip()}")
                time.sleep(1)  # Wait for Arduino to process the CONNECT command

                # Read and serialize JSON configuration
                with open(CONFIG_FILE, 'r') as f:
                    json_data = json.load(f)
                
                json_str = json.dumps(json_data)
                
                # Prepend "JSON:" identifier to the JSON string
                full_message = f"JSON:{json_str}\n"
                self.ser.write(full_message.encode('ascii'))
                print(f"Sent JSON data: {full_message.strip()}")
                time.sleep(2)  # Wait for Arduino to process the JSON data

                # Optionally, read Arduino responses for debugging
                while self.ser.in_waiting > 0:
                    response = self.ser.readline().decode().strip()
                    print(f"Arduino response: {response}")

                self.connected = True

                messagebox.showinfo("Connection", f"Connected to oven '{oven_name}' and idling.")
            else:
                idle_message = f"IDLE\n"
                self.ser.write(idle_message.encode('ascii'))
                print(f"Sent: {idle_message.strip()}")
                time.sleep(1)
                
                # Read Arduino responses
                while self.ser.in_waiting > 0:
                    response = self.ser.readline().decode().strip()
                    print(f"Arduino response: {response}")
            app.show_active_session_controls()
        except Exception as e:
            messagebox.showerror("Connection Error", f"Failed to establish connection: {str(e)}")

    def end_connection(self):
        self.connected = False
        self.monitoring = False
        if self.ser:
            self.ser.write("DISCONNECT\n".encode('utf-8'))
            time.sleep(1)  # Wait for Arduino to process and respond
            while self.ser.in_waiting > 0:
                response = self.ser.readline().decode().strip()
                print(f"Arduino response: {response}")
            self.ser.close()
        app.show_connection_controls()
        messagebox.showinfo("Connection", "Connection ended.")

    def start_active_session(self, oven_name):
        if self.connected:
            self.monitoring = True
            self.ser.write("ACTIVE\n".encode('utf-8'))
            time.sleep(1)  # Wait for Arduino to process and respond
            while self.ser.in_waiting > 0:
                response = self.ser.readline().decode().strip()
                print(f"Arduino response: {response}")
            
            # # Check if logging is enabled
            # if app.config["log_board_data"]:
            #     self.execute_logging_script(app.config["board_data"])

            messagebox.showinfo("Active Session", "Active session started.")
        

    def end_active_session(self):
        self.monitoring = False
        self.ser.write("IDLE\n".encode('utf-8'))
        time.sleep(1)  # Wait for Arduino to process and respond
        while self.ser.in_waiting > 0:
            response = self.ser.readline().decode().strip()
            print(f"Arduino response: {response}")
        messagebox.showinfo("Active Session", "Switched back to idle state.")
        app.show_connection_controls()

    def execute_logging_script(self, board_data):
        data_source = board_data["modbus_burnsys"]

        if data_source == "Modbus":
            is_treebeard = board_data["is_treebeard"]
            folder_path = board_data["folder_path"]
            # Call your specific function or script here based on the Modbus configuration
            print(f"Data Source: {data_source}, Treebeard: {is_treebeard}, Folder Path: {folder_path}")
            # For example:
            self.log_modbus_data(is_treebeard, folder_path)

        elif data_source == "Burnsys":
            com_port = board_data["com_port"]
            # Call your specific function or script here based on the Burnsys configuration
            print(f"Data Source: {data_source}, COM Port: {com_port}")
            # For example:
            self.log_burnsys_data(com_port)

    # Example methods for handling logging (implement these based on your specific needs)
    def log_modbus_data(self, is_treebeard, folder_path):
        # Dictionary to keep track of the last read positions for each file
        last_read_positions = {}

        def get_last_line(file_path):
            with open(file_path, 'rb') as file:
                file.seek(0, os.SEEK_END)
                file_size = file.tell()
                buffer_size = 1024
                buffer = b''
                while file_size > 0:
                    file_size = max(0, file_size - buffer_size)
                    file.seek(file_size)
                    buffer = file.read(min(buffer_size, file_size)) + buffer
                    if b'\n' in buffer:
                        last_line = buffer.split(b'\n')[-2].decode('utf-8')  # The last line is empty, so take the second last
                        return last_line
                return buffer.decode('utf-8')  # If there's no newline, return the buffer

        def parse_and_send_to_arduino(last_line,filename):
            # Assuming sequence is read from the config and passed here
            sequence = app.config["board_data"]["sequence"]
            
            if is_treebeard:
                # Parse the last line differently if it is Treebeard
                parsed_data = parse_treebeard_format(last_line,filename)
            else:
                # Parse the last line normally with the provided sequence
                parsed_data = parse_normal_format(last_line, sequence,filename)

            # Send the parsed data to Arduino
            self.ser.write((parsed_data + '\n').encode('utf-8'))
            print(f"Sent to Arduino: {parsed_data}")


        def parse_treebeard_format(line,filename):
            # Define a sequence mapping based on your requirement
            field_mapping = {
                "P1": "P1.Pi",
                "P2": "P2.Pd",
                "T1": "P3.Ti",
                "T2": "P11.Td",
                "Vx": "P6.Ax",
                "Vz": "P13.Ay"
            }
            # Extract the board number from the filename
            board_number_match = re.search(r'_(\d+)_', filename)
            board_number = board_number_match.group(1) if board_number_match else "Unknown"
            # Split the line into parts using spaces (since tabs might not be consistent)
            parts = line.strip().split()

            # Check that the line has a sufficient number of columns
            if len(parts) < len(field_mapping):
                return None  # This line doesn't contain the required data, skip it

            # Extract the timestamp and initialize parsed_data
            timestamp = parts[1]  # Assuming the timestamp is the second item
            parsed_data = {"timestamp": timestamp, "board_number": board_number}

            # Extract the correct data based on known positions in the parts list
            # Since we don't have the exact positions, you'll need to find out the indices
            # Here we assume positions directly but this needs to be adapted to your exact data format

            # Example positions, these need to be checked against your actual data:
            position_mapping = {
                "P1": 36,  # Example index, adjust based on your file format
                "P2": 37,  # Example index, adjust based on your file format
                "T1": 38,  # Example index, adjust based on your file format
                "T2": 46,  # Example index, adjust based on your file format
                "Vx": 41,  # Example index, adjust based on your file format
                "Vz": 48   # Example index, adjust based on your file format
            }

            # Map the sequence to the corresponding values
            for key, index in position_mapping.items():
                if index < len(parts):
                    parsed_data[key] = parts[index]
                else:
                    parsed_data[key] = "N/A"

            # Convert the parsed data to a string that can be sent to Arduino
            parsed_data_str = f"Board:{parsed_data['board_number']} {parsed_data['timestamp']} " + " ".join(f"{key}:{parsed_data[key]}" for key in field_mapping.keys())

            return parsed_data_str



        def parse_normal_format(line, sequence, filename):
            # The sequence comes from the config file and is a string like "P1 P2 T1 T2 Vx Vz Ct Vt"
            sequence_list = sequence.split()

            # Example line: "2024-06-25 13:20:16.451 <00000>    99    98   253   264    23    11   100  1210"
            # Split the line into components
            parts = line.strip().split()

            # Extract the timestamp (assumed to be the first two parts)
            timestamp = parts[0] + " " + parts[1]  # e.g., "2024-06-25 13:20:16.451"

            # The values start after the sequence number "<00000>", which we assume is at parts[2]
            values = parts[3:3 + len(sequence_list)]  # Extract the number of values corresponding to the sequence

            # Map the sequence to the corresponding values
            parsed_data = {}
            for i, key in enumerate(sequence_list):
                parsed_data[key] = values[i]

            # Extract the board number from the filename
            board_number_match = re.search(r'(\d+)', filename)
            board_number = board_number_match.group(1) if board_number_match else "Unknown"

            # Convert the parsed data to a string that can be sent to Arduino, including the board number
            parsed_data_str = f"Board:{board_number} {timestamp} " + " ".join(f"{key}:{parsed_data[key]}" for key in sequence_list)

            return parsed_data_str


        def read_new_data():
            # Get all the files in the directory
            for filename in os.listdir(folder_path):
                # Only select the files that have the extension .txt
                if filename.endswith((".txt", ".TST", ".Raw", ".raw", ".tst")):
                    file_path = os.path.join(folder_path, filename)
                    # Open the file
                    with open(file_path, 'rb') as file:
                        # Get the current file size
                        file.seek(0, os.SEEK_END)
                        current_size = file.tell()

                        # Get the last read position
                        last_read_position = last_read_positions.get(file_path, 0)

                        # Check if there's new data to read
                        if current_size > last_read_position:
                            file.seek(last_read_position, os.SEEK_SET)
                            new_data = file.read(current_size - last_read_position).decode('utf-8')

                            # Update the last read position
                            last_read_positions[file_path] = current_size

                            # Print new data
                            print(f"New data in {filename}:\n{new_data}")

                            # Get and parse the last line
                            try:
                                last_line = get_last_line(file_path)
                                print(f"Last line in {filename}: {last_line}")
                                parse_and_send_to_arduino(last_line,filename)
                            except Exception as e:
                                print(f"Could not read or parse the last line from {filename}: {e}")

        def logging_loop():
            # Run the logging process every 5 minutes
            while self.monitoring:
                read_new_data()
                time.sleep(300)  # Check for new data every 5 minutes

        # Start the logging in a separate thread
        threading.Thread(target=logging_loop, daemon=True).start()


    def log_burnsys_data(self, com_port):
        print(f"Logging Burnsys data on COM port: {com_port}")

        def read_data_from_com(port):
            try:
                ser = serial.Serial(port, 9600, timeout=1)
                ser.flush()

                while True:
                    if ser.in_waiting > 0:
                        data = ser.read(ser.in_waiting)
                        return data
                    time.sleep(0.1)  # Small delay to avoid busy waiting

            except serial.SerialException as e:
                print(f"Serial exception: {e}")
                return None

        def parse_e6_data(data):
            if len(data) < 28:
                print("Not E6 Card Information")
                return None

            try:
                p1 = (data[3] << 8 | data[4]) / 10
                p2 = (data[5] << 8 | data[6]) / 10
                t1 = (data[7] << 8 | data[8]) / 10
                t2 = (data[9] << 8 | data[10]) / 10
                vx = (data[11] << 8 | data[12]) / 1000
                vz = (data[13] << 8 | data[14]) / 1000
                ct = (data[15] << 8 | data[16]) / 10
                vt = (data[17] << 8 | data[18]) / 10

                parsed_data = {
                    'P1': p1, 'P2': p2, 'T1': t1, 'T2': t2,
                    'Vx': vx, 'Vz': vz, 'Ct': ct, 'Vt': vt
                }

                return parsed_data

            except Exception as e:
                print(f"Error parsing data: {e}")
                return None

        def logging_loop():
            while self.monitoring:
                data = read_data_from_com(com_port)

                if data:
                    self.last_data_time = time.time()
                    print(f"Raw data: {data.hex()}")

                    parsed_data = parse_e6_data(data)

                    if parsed_data:
                        print(f"Board {self.board_number} Data:")
                        for key, value in parsed_data.items():
                            print(f"{key}: {value}")

                        self.board_number += 1  # Increment board number after successful data processing

                    else:
                        print("Data could not be parsed correctly.")
                else:
                    print("No data received")

                # Check if 20 minutes have passed without receiving data
                if time.time() - self.last_data_time > self.BOARD_RESET_TIME:
                    print("No data received for 20 minutes. Resetting board number counter.")
                    self.board_number = 1  # Reset board number counter

                time.sleep(1)  # Small delay between loops

        # Start the logging in a separate thread to allow the UI to remain responsive
        threading.Thread(target=logging_loop, daemon=True).start()

# UI Class for editing configuration
class EditConfigWindow(tk.Toplevel):
    def __init__(self, master):
        super().__init__(master)
        self.title("Edit Configuration")
        self.geometry("400x1000")
        self.config = master.config

        # Logging Board Data Checkbox
        self.logging_frame = tk.LabelFrame(self, text="Logging")
        self.logging_frame.pack(pady=10, fill="x", padx=10)
        self.log_board_data_var = tk.BooleanVar(value=self.config["log_board_data"])
        self.log_board_data_checkbox = tk.Checkbutton(self.logging_frame, text="Log Board Data", variable=self.log_board_data_var)
        self.log_board_data_checkbox.pack(anchor="w",pady=5)

        # Temperature Control Settings
        self.temperature_frame = tk.LabelFrame(self, text="Temperature Control")
        self.temperature_frame.pack(pady=10, fill="x", padx=10)

        self.allow_control_limits_var = tk.BooleanVar(value=self.config["temperature_control"]["allow_control_limits"])
        self.allow_control_limits_checkbox = tk.Checkbutton(self.temperature_frame, text="Allow Control Limits", variable=self.allow_control_limits_var)
        self.allow_control_limits_checkbox.pack(anchor="w", pady=5)

        self.lower_temp_value_var = tk.DoubleVar(value=self.config["temperature_control"]["lower_temp_value"])
        tk.Label(self.temperature_frame, text="Lower Temp Value").pack(anchor="w")
        tk.Entry(self.temperature_frame, textvariable=self.lower_temp_value_var).pack(fill="x", pady=5)

        self.high_temp_value_var = tk.DoubleVar(value=self.config["temperature_control"]["high_temp_value"])
        tk.Label(self.temperature_frame, text="High Temp Value").pack(anchor="w")
        tk.Entry(self.temperature_frame, textvariable=self.high_temp_value_var).pack(fill="x", pady=5)

        self.temp_limits_plus_minus_var = tk.DoubleVar(value=self.config["temperature_control"]["temp_limits_plus_minus"])
        tk.Label(self.temperature_frame, text="Temp Limits Plus/Minus").pack(anchor="w")
        tk.Entry(self.temperature_frame, textvariable=self.temp_limits_plus_minus_var).pack(fill="x", pady=5)

        self.ramp_rate_var = tk.DoubleVar(value=self.config["temperature_control"].get("ramp_rate", 0.0))
        tk.Label(self.temperature_frame, text="Ramp Rate (Optional)").pack(anchor="w")
        tk.Entry(self.temperature_frame, textvariable=self.ramp_rate_var).pack(fill="x", pady=5)

        # Board Data Settings
        self.board_frame = tk.LabelFrame(self, text="Board Data")
        self.board_frame.pack(pady=10, fill="x", padx=10)

        self.modbus_burnsys_var = tk.StringVar(value=self.config["board_data"]["modbus_burnsys"])
        tk.Label(self.board_frame, text="Board Data Source").pack(anchor="w")
        self.modbus_burnsys_combobox = ttk.Combobox(self.board_frame, textvariable=self.modbus_burnsys_var, values=["Modbus", "Burnsys"])
        self.modbus_burnsys_combobox.pack(fill="x", pady=5)
        self.modbus_burnsys_combobox.bind("<<ComboboxSelected>>", self.update_board_data_options)

        self.is_treebeard_var = tk.BooleanVar(value=self.config["board_data"]["is_treebeard"])
        self.is_treebeard_checkbox = tk.Checkbutton(self.board_frame, text="Is Treebeard?", variable=self.is_treebeard_var)
        self.is_treebeard_checkbox.pack(anchor="w", pady=5)

        # Initialize both, but show only the relevant one based on the selection
        self.sequence_var = tk.StringVar(value=self.config["board_data"]["sequence"])
        self.sequence_label = tk.Label(self.board_frame, text="ModBus Sequence")
        self.sequence_entry = tk.Entry(self.board_frame, textvariable=self.sequence_var)
        self.folder_path_var = tk.StringVar(value=self.config["board_data"]["folder_path"])
        self.folder_path_label = tk.Label(self.board_frame, text="Folder Path")
        self.folder_path_entry = tk.Entry(self.board_frame, textvariable=self.folder_path_var)
        self.folder_path_button = tk.Button(self.board_frame, text="Browse", command=self.browse_folder)

        self.com_port_var = tk.StringVar(value=self.config["board_data"]["com_port"])
        self.com_port_label = tk.Label(self.board_frame, text="COM Port")
        self.com_port_entry = tk.Entry(self.board_frame, textvariable=self.com_port_var)

        self.allow_board_control_limits_var = tk.BooleanVar(value=self.config["board_data"]["allow_control_limits"])
        self.allow_board_control_limits_checkbox = tk.Checkbutton(self.board_frame, text="Allow Control Limits", variable=self.allow_board_control_limits_var)
        self.allow_board_control_limits_checkbox.pack(anchor="w", pady=5)

        self.update_board_data_options()



        # Control limits for P1, P2, T1, T2, Vx, Vz, Ct, Vt
        self.control_limits_frame = tk.LabelFrame(self, text="Control Limits")
        self.control_limits_frame.pack(pady=10, fill="x", padx=10)

        self.control_limits_vars = {}
        for param in ["P1", "P2", "T1", "T2", "Vx", "Vz", "Ct", "Vt"]:
            param_frame = tk.Frame(self.control_limits_frame)
            param_frame.pack(fill="x", pady=5)

            tk.Label(param_frame, text=param).pack(side="left", padx=5)
            plus_minus_var = tk.DoubleVar(value=self.config["board_data"]["control_limits"][param]["plus_minus"])
            tk.Entry(param_frame, textvariable=plus_minus_var, width=10).pack(side="left", padx=5)
            self.control_limits_vars[param] = {"plus_minus": plus_minus_var}

            if param in ["T1", "T2"]:
                low_temp_var = tk.DoubleVar(value=self.config["board_data"]["control_limits"][param]["low_temp_value"])
                high_temp_var = tk.DoubleVar(value=self.config["board_data"]["control_limits"][param]["high_temp_value"])
                tk.Label(param_frame, text="Low Temp").pack(side="left", padx=5)
                tk.Entry(param_frame, textvariable=low_temp_var, width=10).pack(side="left", padx=5)
                tk.Label(param_frame, text="High Temp").pack(side="left", padx=5)
                tk.Entry(param_frame, textvariable=high_temp_var, width=10).pack(side="left", padx=5)
                self.control_limits_vars[param]["low_temp_value"] = low_temp_var
                self.control_limits_vars[param]["high_temp_value"] = high_temp_var

        # Save Button
        self.save_button = tk.Button(self, text="Save Configuration", command=self.save_config)
        self.save_button.pack(pady=20)

    def toggle_treebeard_options(self):
        pass  # Treebeard is just a checkbox, no additional inputs needed

    def browse_folder(self):
        folder_selected = filedialog.askdirectory()
        if folder_selected:
            self.folder_path_var.set(folder_selected)

    def update_board_data_options(self, event=None):
        # Remove current inputs
        self.sequence_label.pack_forget()
        self.sequence_entry.pack_forget()
        self.folder_path_label.pack_forget()
        self.folder_path_entry.pack_forget()
        self.folder_path_button.pack_forget()
        self.com_port_label.pack_forget()
        self.com_port_entry.pack_forget()


        if self.modbus_burnsys_var.get() == "Modbus":
            # Show folder path input
            self.folder_path_label.pack(anchor="w")
            self.folder_path_entry.pack(fill="x", pady=5)
            self.folder_path_button.pack(anchor="w")
            self.sequence_label.pack(anchor="w")
            self.sequence_entry.pack(fill="x", pady=5)
        elif self.modbus_burnsys_var.get() == "Burnsys":
            # Show COM port input
            self.com_port_label.pack(anchor="w")
            self.com_port_entry.pack(fill="x", pady=5)

    def save_config(self):
        self.config["log_board_data"] = self.log_board_data_var.get()
        self.config["temperature_control"]["allow_control_limits"] = self.allow_control_limits_var.get()
        self.config["temperature_control"]["lower_temp_value"] = self.lower_temp_value_var.get()
        self.config["temperature_control"]["high_temp_value"] = self.high_temp_value_var.get()
        self.config["temperature_control"]["temp_limits_plus_minus"] = self.temp_limits_plus_minus_var.get()
        self.config["temperature_control"]["ramp_rate"] = self.ramp_rate_var.get() if self.ramp_rate_var.get() else None

        self.config["board_data"]["modbus_burnsys"] = self.modbus_burnsys_var.get()
        self.config["board_data"]["is_treebeard"] = self.is_treebeard_var.get()

        if self.modbus_burnsys_var.get() == "Modbus":
            self.config["board_data"]["folder_path"] = self.folder_path_var.get()
            self.config["board_data"]["sequence"] = self.sequence_var.get()
        elif self.modbus_burnsys_var.get() == "Burnsys":
            self.config["board_data"]["com_port"] = self.com_port_var.get()

        self.config["board_data"]["allow_control_limits"] = self.allow_board_control_limits_var.get()

        for param, vars in self.control_limits_vars.items():
            self.config["board_data"]["control_limits"][param]["plus_minus"] = vars["plus_minus"].get()
            if param in ["T1", "T2"]:
                self.config["board_data"]["control_limits"][param]["low_temp_value"] = vars["low_temp_value"].get()
                self.config["board_data"]["control_limits"][param]["high_temp_value"] = vars["high_temp_value"].get()

        save_config(self.config)
        messagebox.showinfo("Save Configuration", "Configuration saved successfully!")

# UI Class
class OvenApp(tk.Tk):
    def __init__(self, monitor):
        super().__init__()
        self.monitor = monitor
        self.oven_name = ""
        self.title("Oven Monitor")
        self.geometry("300x200")
        self.config = load_config()

        # Initial connection controls
        self.oven_name_label = tk.Label(self, text="Oven Name:")
        self.oven_name_label.pack(pady=5)
        self.oven_name_entry = tk.Entry(self)
        self.oven_name_entry.pack(pady=5)
        self.connect_button = tk.Button(self, text="Establish Connection", command=self.establish_connection)
        self.connect_button.pack(pady=5)
        self.disconnect_button = tk.Button(self, text="End Connection", command=self.end_connection)
        self.disconnect_button.pack(pady=5)
        self.edit_config_button = tk.Button(self, text="Edit Configuration", command=self.open_edit_window)
        self.edit_config_button.pack(pady=5)

        # Active session controls (initially hidden)
        self.start_active_button = tk.Button(self, text="Start Active Session", command=self.start_active_session)
        self.end_active_button = tk.Button(self, text="End Active Session", command=self.end_active_session)

        # Hide active session controls initially
        self.hide_active_session_controls()

    def establish_connection(self):
        self.oven_name = self.oven_name_entry.get()
        if self.oven_name:
            self.monitor.establish_connection(self.oven_name)
        else:
            messagebox.showwarning("Input Error", "Please enter the oven name.")

    def end_connection(self):
        self.monitor.end_connection()

    def start_active_session(self):
        self.monitor.start_active_session(self.oven_name)

    def end_active_session(self):
        self.monitor.end_active_session()


    def update_temperature_display(self, temperature):
        self.temperature_label.config(text=f"Current Temperature: {temperature:.2f}°C")

    def show_active_session_controls(self):
        self.oven_name_label.pack_forget()
        self.oven_name_entry.pack_forget()
        self.connect_button.pack_forget()
        self.disconnect_button.pack_forget()
        self.edit_config_button.pack_forget()

        self.start_active_button.pack(pady=5)
        self.end_active_button.pack(pady=5)

    def hide_active_session_controls(self):
        self.start_active_button.pack_forget()
        self.end_active_button.pack_forget()

    def show_connection_controls(self):
        self.oven_name_label.pack(pady=5)
        self.oven_name_entry.pack(pady=5)
        self.connect_button.pack(pady=5)
        self.disconnect_button.pack(pady=5)
        self.edit_config_button.pack(pady=5)
        self.hide_active_session_controls()

    def open_edit_window(self):
        EditConfigWindow(self)

# Main execution
if __name__ == "__main__":
    monitor = OvenMonitor()
    app = OvenApp(monitor)
    app.mainloop()
