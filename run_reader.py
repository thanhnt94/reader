import subprocess
import os
import sys
import time

def build_frontend():
    if os.environ.get("SKIP_BUILD"):
        print("[VITE] Skipping frontend compilation because SKIP_BUILD is set.")
        return
        
    if os.name == 'nt':
        print("[VITE] Starting automated frontend build...")
        try:
            import build_vite
            build_vite.build_frontend()
        except ImportError:
            print("[VITE] build_vite module not found, skipping compilation.")
        except Exception as e:
            print(f"[VITE] Automated build failed: {e}")

def run_backend():
    print("Starting Reader LMS (Standalone via FastAPI)...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Run uvicorn on port 5070
    cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "5070", "--host", "0.0.0.0"]
    return subprocess.Popen(cmd, cwd=script_dir)

if __name__ == "__main__":
    print("[INIT] Initializing Reader Ecosystem...")
    build_frontend()
    process = run_backend()
    print("\n[OK] Reader is running!")
    print("URL: http://localhost:5070")
    print("\nPress Ctrl+C to stop.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping Reader...")
