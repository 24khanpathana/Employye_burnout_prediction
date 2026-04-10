import requests

url = "http://localhost:8000/upload"
with open("sample_data.csv", "rb") as f:
    files = {"file": ("sample_data.csv", f, "text/csv")}
    try:
        response = requests.post(url, files=files)
        print("Status Code:", response.status_code)
        print("Response:", response.json())
    except Exception as e:
        print("Error connecting:", str(e))
