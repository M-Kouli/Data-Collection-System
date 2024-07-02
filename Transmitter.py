import serial
import time

# Setup the serial connection to Arduino
arduino = serial.Serial('COM4', 115200)  # Change COM3 to the port your Arduino is connected to

def read_last_line(file_path):
    with open(file_path, 'r') as file:
        lines = file.readlines()
        if lines:
            return lines[-1].strip()
        return None

def main():
    file_path = 'data.txt'
    last_line = ''
    
    while True:
        new_line = read_last_line(file_path)
        if new_line and new_line != last_line:
            last_line = new_line
            arduino.write((last_line + '\n').encode('utf-8'))
            print(f"Sent to Arduino: {last_line}")
        time.sleep(1)

if __name__ == "__main__":
    main()
