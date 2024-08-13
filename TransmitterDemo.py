import serial
import time

# Replace with your Arduino's serial port
SERIAL_PORT = 'COM4'  # Use the correct COM port on your system
BAUD_RATE = 9600

def send_message(message):
    try:
        with serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1) as ser:
            # Give some time for the serial connection to establish
            time.sleep(2)
            ser.write((message + '\n').encode())
            print(f"Sent message: {message}")
            time.sleep(1)  # Wait for Arduino to process and respond
            while ser.in_waiting > 0:
                response = ser.readline().decode().strip()
                print(f"Arduino response: {response}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    message = input("Enter a message to send to Arduino: ")
    send_message(message)