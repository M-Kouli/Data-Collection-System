import serial
import time
import websocket
import json

def read_and_send_data(serial_port, baud_rate, ws_url):
    ser = None
    ws = None
    try:
        ser = serial.Serial(serial_port, baud_rate, timeout=1)
        ws = websocket.create_connection(ws_url)

        print(f"Connected to {serial_port} and WebSocket server at {ws_url}")

        while True:
            if ser.in_waiting > 0:
                data = ser.readline().decode('utf-8').strip()
                print(f"Read from {serial_port}: {data}")
                message = json.dumps({'port': 'com6', 'data': data})
                ws.send(message)
                print(f"Sent to WebSocket server: {message}")
            time.sleep(1)

    except Exception as e:
        print(f"Error: {e}")

    finally:
        if ser:
            ser.close()
        if ws:
            ws.close()

if __name__ == "__main__":
    serial_port = 'COM6'
    baud_rate = 9600
    ws_url = "ws://192.168.43.198:5001"  # Replace with your server's IP address or hostname

    read_and_send_data(serial_port, baud_rate, ws_url)
