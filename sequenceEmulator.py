import random
import time
import json
from websocket import create_connection

# Define the WebSocket URL
WEBSOCKET_URL = "wss://9611-82-46-133-26.ngrok-free.app"

# Define the oven sequence for "Gollum"
sequence = [
    {"temperature": 25, "heat_cool_duration": 5, "soak_time": 30},
    {"temperature": 145, "heat_cool_duration": 35, "soak_time": 540},
    {"temperature": 25, "heat_cool_duration": 35, "soak_time": 30},
    {"temperature": 145, "heat_cool_duration": 30, "soak_time": 570},
    {"temperature": 25, "heat_cool_duration": 35, "soak_time": 30},
    {"temperature": 145, "heat_cool_duration": 30, "soak_time": 570},
    {"temperature": 25, "heat_cool_duration": 35, "soak_time": 30},
    {"temperature": 145, "heat_cool_duration": 30, "soak_time": 570},
    {"temperature": 25, "heat_cool_duration": 35, "soak_time": 30},
    {"temperature": 145, "heat_cool_duration": 30, "soak_time": 570},
    {"temperature": 25, "heat_cool_duration": 35, "soak_time": 30}
]

# Function to generate oven data
def generate_oven_data(oven_name, temperature, upper_control_limit, lower_control_limit, is_ramping):
    return {
        "ovenId": oven_name,
        "temperature": temperature,
        "temperatureUpperControlLimit": upper_control_limit if not is_ramping else None,
        "temperatureLowerControlLimit": lower_control_limit if not is_ramping else None,
        "dataType": "Oven",
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "hasOvenControlLimits": not is_ramping,
        "hasBoardControlLimits": False
    }

# Function to generate board data
def generate_board_data(oven_name, temperature, upper_control_limit, lower_control_limit):
    board_limits = {
        "p1": (65, 15),
        "p2": (65, 15),
        "t1": (65, 15),
        "t2": (65, 15),
        "vx": (65, 15),
        "vz": (65, 15),
        "ct": (65, 15),
        "vt": (65, 15)
    }
    return {
        "ovenId": oven_name,
        "temperature": temperature,
        "temperatureUpperControlLimit": upper_control_limit,
        "temperatureLowerControlLimit": lower_control_limit,
        "p1": random.uniform(20, 80),
        "p1UpperControlLimit": board_limits["p1"][0],
        "p1LowerControlLimit": board_limits["p1"][1],
        "p2": random.uniform(20, 60),
        "p2UpperControlLimit": board_limits["p2"][0],
        "p2LowerControlLimit": board_limits["p2"][1],
        "t1": random.uniform(20, 60),
        "t1UpperControlLimit": board_limits["t1"][0],
        "t1LowerControlLimit": board_limits["t1"][1],
        "t2": random.uniform(20, 60),
        "t2UpperControlLimit": board_limits["t2"][0],
        "t2LowerControlLimit": board_limits["t2"][1],
        "vx": random.uniform(20, 60),
        "vxUpperControlLimit": board_limits["vx"][0],
        "vxLowerControlLimit": board_limits["vx"][1],
        "vz": random.uniform(20, 60),
        "vzUpperControlLimit": board_limits["vz"][0],
        "vzLowerControlLimit": board_limits["vz"][1],
        "ct": random.uniform(20, 60),
        "ctUpperControlLimit": board_limits["ct"][0],
        "ctLowerControlLimit": board_limits["ct"][1],
        "vt": random.uniform(20, 60),
        "vtUpperControlLimit": board_limits["vt"][0],
        "vtLowerControlLimit": board_limits["vt"][1],
        "dataType": "Board",
        "boardId": f"{random.randint(1, 5)}",
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "hasOvenControlLimits": False,
        "hasBoardControlLimits": True
    }

# Function to send a WebSocket notification
def send_websocket_notification(ws, data):
    ws.send(json.dumps({"type": "newOvenData", "data": data}))

def send_oven_active_message(ws, oven_name):
    ws.send(json.dumps({"type": "ovenActive", "data": {"ovenId": oven_name}}))

# Main loop to emulate the sequence
def emulate_oven_sequence(oven_name, sequence):
    ws = create_connection(WEBSOCKET_URL)
    ws.send(json.dumps({"type": "identify", "clientId": oven_name}))
    try:
        current_temp = sequence[0]["temperature"]  # Initialize current temperature
        idle_time = 20
        
        # Send idle data for 20 seconds
        for _ in range(idle_time):
            data = generate_oven_data(oven_name, 25, 27, 23, False)
            send_websocket_notification(ws, data)
            time.sleep(1)
        
        # Send oven active message
        send_oven_active_message(ws, oven_name)
        
        for step in sequence:
            target_temp = step["temperature"]
            soak_time = step["soak_time"]
            initial_temp = current_temp
            
            # Determine if we are heating or cooling
            if current_temp < target_temp:
                ramp_rate = 4.1  # degrees per second for heating
            else:
                ramp_rate = -2.1  # degrees per second for cooling
            
            time_passed = 0
            
            # Ramp up or down to the target temperature
            while (ramp_rate > 0 and current_temp < target_temp) or (ramp_rate < 0 and current_temp > target_temp):
                current_temp += ramp_rate
                time_passed += 1
                # Calculate expected target temperature at this point
                expected_temp = initial_temp + ramp_rate * time_passed
                # Generate random fluctuation
                fluctuated_temp = current_temp + random.uniform(-0.5, 0.5)
                upper_control_limit = expected_temp + 2  # Control limit based on expected temperature
                lower_control_limit = expected_temp - 2  # Control limit based on expected temperature
                data = generate_oven_data(oven_name, fluctuated_temp, upper_control_limit, lower_control_limit, True)
                send_websocket_notification(ws, data)
                time.sleep(1)
            
            # Adjust current_temp to target_temp after ramping
            current_temp = target_temp
            upper_control_limit = target_temp + 2
            lower_control_limit = target_temp - 2
            
            # Soak at the target temperature
            for _ in range(soak_time):
                # Generate random fluctuation and occasional out-of-bound temperature
                if random.choice([True, False]):
                    fluctuated_temp = current_temp + random.uniform(-3, 3)
                else:
                    fluctuated_temp = current_temp + random.uniform(-0.5, 0.5)
                
                data = generate_oven_data(oven_name, fluctuated_temp, upper_control_limit, lower_control_limit, False)
                send_websocket_notification(ws, data)
                
                # Occasionally send board data
                if random.choice([True, False]):
                    board_data = generate_board_data(oven_name, fluctuated_temp,upper_control_limit,lower_control_limit)
                    send_websocket_notification(ws, board_data)
                
                time.sleep(1)  # wait for 1 second
    
    finally:
        ws.close()

# Start the sequence emulation
emulate_oven_sequence("Gimli", sequence)
