import serial
import time
import random

# Define the COM port and the baud rate (adjust these as needed)
COM_PORT = 'COM16'  # Replace with your actual COM port
BAUD_RATE = 9600

# Binary data to send every 5 seconds
binary_data_5s = b'\x02\x03\x04\x00\xf8\x00\xfa\xc8\x81'

# Function to generate fake data
def generate_fake_data():
    p1 = random.uniform(0, 100)  # Generate a random value for P1
    p2 = random.uniform(0, 100)  # Generate a random value for P2
    t1 = random.uniform(0, 100)  # Generate a random value for T1
    t2 = random.uniform(0, 100)  # Generate a random value for T2
    vx = random.uniform(0, 10)   # Generate a random value for Vx
    vz = random.uniform(0, 10)   # Generate a random value for Vz
    ct = random.uniform(0, 100)  # Generate a random value for Ct
    vt = random.uniform(0, 100)  # Generate a random value for Vt

    return {
        'P1': int(p1 * 10),
        'P2': int(p2 * 10),
        'T1': int(t1 * 10),
        'T2': int(t2 * 10),
        'Vx': int(vx * 1000),
        'Vz': int(vz * 1000),
        'Ct': int(ct * 10),
        'Vt': int(vt * 10)
    }

# Function to replace values in the binary data with generated fake data
def create_custom_binary_data(fake_data):
    binary_data = bytearray(b'\n\x03(\x00\x08\x00\x07\x00\xff\x01\x05\x00\x93\x00\xb3\x00b\x04\xb3\x00u\x00a\x03\x0b\x03\x16\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xb1\xfb')

    # Replace values in the binary data
    binary_data[3:5] = fake_data['P1'].to_bytes(2, byteorder='big')
    binary_data[5:7] = fake_data['P2'].to_bytes(2, byteorder='big')
    binary_data[7:9] = fake_data['T1'].to_bytes(2, byteorder='big')
    binary_data[9:11] = fake_data['T2'].to_bytes(2, byteorder='big')
    binary_data[11:13] = fake_data['Vx'].to_bytes(2, byteorder='big')
    binary_data[13:15] = fake_data['Vz'].to_bytes(2, byteorder='big')
    binary_data[15:17] = fake_data['Ct'].to_bytes(2, byteorder='big')
    binary_data[17:19] = fake_data['Vt'].to_bytes(2, byteorder='big')

    return binary_data

# Open the serial port
try:
    ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=1)
    time.sleep(2)  # Wait for the serial connection to establish

    # Time tracking for sending intervals
    last_time_5s = time.time()
    last_time_10s = time.time()

    while True:
        current_time = time.time()

        # Check if 5 seconds have passed to send the first binary data
        if current_time - last_time_5s >= 560:
            ser.write(binary_data_5s)
            print(f"Sent binary data 5s: {binary_data_5s.hex()}")
            last_time_5s = current_time

        # Check if 10 seconds have passed to send the custom binary data
        if current_time - last_time_10s >= 15:
            # Generate fake data
            fake_data = generate_fake_data()

            # Create custom binary data with the generated fake data
            custom_binary_data = create_custom_binary_data(fake_data)

            # Send the custom binary data
            ser.write(custom_binary_data)
            print(f"Sent custom binary data 10s: {custom_binary_data.hex()}")
            last_time_10s = current_time

        # Small sleep to prevent high CPU usage
        time.sleep(0.1)

except serial.SerialException as e:
    print(f"Error: {e}")

finally:
    # Close the serial port
    if ser.is_open:
        ser.close()
