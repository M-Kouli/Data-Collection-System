import random
import time
import json
from websocket import create_connection

# Define the WebSocket URL
WEBSOCKET_URL = "ws://localhost:3000"

# Define the list of ovens
ovens = ["Gollum", "Treebeard", "Gimli", "Saruman", "Galadriel", "Peregrin", "Frodo"]

# Function to generate random oven data
def generate_oven_data(oven_name):
    return {
        "ovenId": oven_name,  # Use oven name as ovenId
        "temperature": random.uniform(150, 250),  # Random temperature between 150 and 250
        "dataType": "Oven",
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }

# Function to generate random board data
def generate_board_data(oven_name):
    return {
        "ovenId": oven_name,  # Use oven name as ovenId
        "temperature": random.uniform(150, 250),
        "p1": random.uniform(20, 60),
        "p2": random.uniform(20, 60),
        "t1": random.uniform(20, 60),
        "t2": random.uniform(20, 60),
        "vx": random.uniform(20, 60),
        "vz": random.uniform(20, 60),
        "ct": random.uniform(20, 60),
        "vt": random.uniform(20, 60),
        "dataType": "Board",
        "boardId": f"{random.randint(1, 7)}",  # Example boardId
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }

# Function to send a WebSocket notification
def send_websocket_notification(data):
    ws = create_connection(WEBSOCKET_URL)
    ws.send(json.dumps({"type": "newOvenData", "data": data}))
    ws.close()

# Main loop to generate and send data
while True:
    for oven in ovens:
        if random.choice([True, False]):
            data = generate_oven_data(oven)
        else:
            data = generate_board_data(oven)
        send_websocket_notification(data)
    time.sleep(5)  # Wait for 5 seconds before sending the next batch of data
