#we decided not write tags with hexadecimal 
#we decinded not to do this becase the implimaentation of a encrypted NDEF message would have been too complex for the time we had for this proejct. 
#one of, but not the only, reason to write the tags with hexadecmial is to meverage MAC crypto techniques

def generate_rfid_payload(link):
    """
    Generates a hexadecimal RFID payload for a given URL.

    Args:
        link (str): The URL to encode into the RFID payload.

    Returns:
        str: The hexadecimal representation of the payload.
    """
    # Check if the link is valid
    if not link.startswith(("http://", "https://")):
        raise ValueError("Invalid link. Make sure it starts with 'http://' or 'https://'.")
    
    # Convert the link to bytes
    link_bytes = link.encode("utf-8")
    
    # Convert the bytes to a hexadecimal string
    hex_payload = link_bytes.hex()
    
    return hex_payload


# Example usage
if __name__ == "__main__":
    url = "https://example.com/my-data"
    try:
        hex_payload = generate_rfid_payload(url)
        print(f"Hexadecimal RFID Payload: {hex_payload}")
    except ValueError as e:
        print(e)
