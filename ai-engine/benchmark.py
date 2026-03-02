import time
import requests
import json

BASE_URL = "http://localhost:8000"

def benchmark():
    payload = {
        "jobTitle": "Software Engineer",
        "jobDescription": "Looking for a Python developer with FastAPI and Pydantic experience. Cloud knowledge is a plus.",
        "candidateSkills": json.dumps([{"skill": "Python", "weight": 10}, {"skill": "FastAPI", "weight": 8}]),
        "profileText": "Experienced developer skilled in Python and web frameworks.",
        "resumeText": "Professional Resume\nExperience: 5 years of Python development. Built multiple APIs using FastAPI and Pydantic. Familiar with AWS and Docker.",
        "auditSkills": json.dumps(["Python", "FastAPI"])
    }

    print("--- First Request (Cold Cache) ---")
    start = time.time()
    try:
        response = requests.post(f"{BASE_URL}/match", data=payload)
        print(f"Status: {response.status_code}")
        print(f"Time: {time.time() - start:.3f}s")
        print(f"Score: {response.json().get('fidelityScore')}%")
    except Exception as e:
        print(f"Error: {e}")

    print("\n--- Second Request (Warm Job Cache) ---")
    start = time.time()
    try:
        response = requests.post(f"{BASE_URL}/match", data=payload)
        print(f"Status: {response.status_code}")
        print(f"Time: {time.time() - start:.3f}s")
        print(f"Score: {response.json().get('fidelityScore')}%")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Wait for server to be up if needed, but assuming user has it running
    benchmark()
