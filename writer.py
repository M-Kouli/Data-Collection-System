import time

def read_data_from_file(input_file_path):
    with open(input_file_path, 'r') as file:
        lines = file.readlines()
    return [line.strip() for line in lines]

def write_data_to_file(output_file_path, data):
    with open(output_file_path, 'a') as file:
        for line in data:
            file.write(line + '\n')
            file.flush()  # Ensure the data is written to the file immediately
            print(f"Wrote line: {line}")
            time.sleep(1)  # Wait for 1 second

def main():
    input_file_path = "E:\C2 Raw Files\CB05136_240625.txt"  # Change this to your input file path
    output_file_path = 'data.txt'  # Change this to your output file path
    
    # Read data from input file
    data = read_data_from_file(input_file_path)
    
    # Write data to output file
    write_data_to_file(output_file_path, data)

if __name__ == "__main__":
    main()
