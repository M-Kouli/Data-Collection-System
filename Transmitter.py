import tkinter as tk
from tkinter import messagebox, filedialog, ttk
import threading
import time
import json
import serial
import os
from websocket import create_connection

# Define the WebSocket URL
WEBSOCKET_URL = "wss://9611-82-46-133-26.ngrok-free.app"
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
                }
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

    def establish_connection(self, oven_name):
        try:
            self.ser = serial.Serial('COM3', 9600, timeout=1)  # Adjust 'COM3' as per your setup
            self.ws = create_connection(WEBSOCKET_URL)
            self.ws.send(json.dumps({"type": "identify", "clientId": oven_name}))
            self.connected = True
            app.show_active_session_controls()
            threading.Thread(target=self.idle_monitor_temperature, args=(oven_name,)).start()
            messagebox.showinfo("Connection", f"Connected to oven '{oven_name}' and idling.")
        except Exception as e:
            messagebox.showerror("Connection Error", f"Failed to establish connection: {str(e)}")

    def end_connection(self):
        self.connected = False
        self.monitoring = False
        if self.ws:
            self.ws.close()
        if self.ser:
            self.ser.close()
        app.show_connection_controls()
        messagebox.showinfo("Connection", "Connection ended.")

    def start_active_session(self, oven_name):
        if self.connected:
            self.monitoring = True
            messagebox.showinfo("Active Session", "Active session started.")
            threading.Thread(target=self.monitor_temperature_active, args=(oven_name,)).start()

    def end_active_session(self):
        self.monitoring = False
        messagebox.showinfo("Active Session", "Switched back to idle state.")
        threading.Thread(target=self.idle_monitor_temperature, args=(app.oven_name,)).start()

    def idle_monitor_temperature(self, oven_name):
        try:
            while self.connected and not self.monitoring:
                if self.ser.in_waiting > 0:
                    self.temperature = float(self.ser.readline().decode('utf-8').strip())
                    data = generate_oven_data(oven_name, self.temperature)
                    send_websocket_notification(self.ws, data)
                    app.update_temperature_display(self.temperature)
                time.sleep(1)
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            self.end_connection()

    def monitor_temperature_active(self, oven_name):
        try:
            while self.monitoring:
                if self.ser.in_waiting > 0:
                    self.temperature = float(self.ser.readline().decode('utf-8').strip())
                    data = generate_oven_data(oven_name, self.temperature)
                    data["sessionState"] = "Active"
                    send_websocket_notification(self.ws, data)
                    app.update_temperature_display(self.temperature)
                time.sleep(1)
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            self.end_connection()

# UI Class for editing configuration
class EditConfigWindow(tk.Toplevel):
    def __init__(self, master):
        super().__init__(master)
        self.title("Edit Configuration")
        self.geometry("400x450")
        self.config = master.config

        # Logging Board Data Checkbox
        self.log_board_data_var = tk.BooleanVar(value=self.config["log_board_data"])
        self.log_board_data_checkbox = tk.Checkbutton(self, text="Log Board Data", variable=self.log_board_data_var)
        self.log_board_data_checkbox.pack(pady=10)

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
        self.folder_path_var = tk.StringVar(value=self.config["board_data"]["folder_path"])
        self.folder_path_label = tk.Label(self.board_frame, text="Folder Path")
        self.folder_path_entry = tk.Entry(self.board_frame, textvariable=self.folder_path_var)
        self.folder_path_button = tk.Button(self.board_frame, text="Browse", command=self.browse_folder)

        self.com_port_var = tk.StringVar(value=self.config["board_data"]["com_port"])
        self.com_port_label = tk.Label(self.board_frame, text="COM Port")
        self.com_port_entry = tk.Entry(self.board_frame, textvariable=self.com_port_var)

        self.update_board_data_options()

        self.allow_board_control_limits_var = tk.BooleanVar(value=self.config["board_data"]["allow_control_limits"])
        self.allow_board_control_limits_checkbox = tk.Checkbutton(self.board_frame, text="Allow Control Limits", variable=self.allow_board_control_limits_var)
        self.allow_board_control_limits_checkbox.pack(anchor="w", pady=5)

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
        self.temperature_label = tk.Label(self, text="Current Temperature: N/A")

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
        self.temperature_label.pack(pady=20)

    def hide_active_session_controls(self):
        self.start_active_button.pack_forget()
        self.end_active_button.pack_forget()
        self.temperature_label.pack_forget()

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
